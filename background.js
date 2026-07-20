// background.js — Capsule service worker

// ── Import shared modules ────────────────────────────────────────────────────
importScripts('shared/nlp_compress.js');
importScripts('shared/llm_client.js');

// M-2 FIX: Renamed from 'claude_conversations' to 'cc_all_conversations'
// to accurately reflect that this stores conversations from ALL 8 AI platforms.
const STORAGE_KEY        = 'cc_all_conversations';
const PENDING_INJECT_KEY = 'pending_context_inject';

const COMPRESSION_KEY    = 'cs_compression_config';
const STORAGE_CONF_KEY   = 'cs_storage_config';
const DEFAULT_MAX_CONVERSATIONS = 50;
const MAX_CONVERSATION_BYTES = 5 * 1024 * 1024;

// chrome.storage.local has no compare-and-swap operation. Keep all conversation
// mutations in the service worker and serialize them so concurrent content scripts
// cannot overwrite one another with stale read/modify/write snapshots.
let conversationMutationQueue = Promise.resolve();

function getStorageConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get([STORAGE_CONF_KEY], res => {
      const requested = Number(res[STORAGE_CONF_KEY]?.maxConversations);
      const maxConversations = Number.isFinite(requested)
        ? Math.min(200, Math.max(10, Math.floor(requested)))
        : DEFAULT_MAX_CONVERSATIONS;
      resolve({ maxConversations });
    });
  });
}

function estimateBytes(value) {
  return new Blob([JSON.stringify(value)]).size;
}

function mergeConversation(existing, incoming) {
  const merged = [...(existing.messages || [])];
  for (const message of incoming.messages || []) {
    if (!merged.some(item => item.type === message.type && item.content === message.content)) {
      merged.push(message);
    }
  }
  return {
    ...incoming,
    messages: merged,
    id: existing.id,
    savedAt: existing.savedAt,
  };
}

async function saveConversation(conversation) {
  if (!conversation || !Array.isArray(conversation.messages) || !conversation.messages.length) {
    throw new Error('A conversation with at least one message is required.');
  }

  const current = await new Promise(resolve => chrome.storage.local.get([STORAGE_KEY], resolve));
  const conversations = current[STORAGE_KEY] || [];
  let index = -1;
  if (conversation.fingerprint) {
    index = conversations.findIndex(c => c.fingerprint === conversation.fingerprint &&
      (!conversation.url || c.url === conversation.url));
  }
  if (index < 0 && conversation.id) index = conversations.findIndex(c => c.id === conversation.id);
  if (index < 0 && conversation.url) index = conversations.findIndex(c => c.url === conversation.url);

  if (index >= 0) conversations[index] = mergeConversation(conversations[index], conversation);
  else conversations.push(conversation);

  const { maxConversations } = await getStorageConfig();
  let retained = conversations
    .sort((a, b) => new Date(a.savedAt || 0) - new Date(b.savedAt || 0))
    .slice(-maxConversations);
  let evictedCount = conversations.length - retained.length;
  while (retained.length > 1 && estimateBytes(retained) > MAX_CONVERSATION_BYTES) {
    retained.shift();
    evictedCount++;
  }
  if (estimateBytes(retained) > MAX_CONVERSATION_BYTES) {
    throw new Error('Conversation is larger than the local storage safety limit. Export it instead.');
  }
  await new Promise((resolve, reject) => {
    chrome.storage.local.set({ [STORAGE_KEY]: retained }, () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
      else resolve();
    });
  });
  return { count: retained.length, evictedCount };
}

function enqueueConversationMutation(operation) {
  const result = conversationMutationQueue.then(operation, operation);
  conversationMutationQueue = result.catch(() => {});
  return result;
}

// ── Default selector config (mirrored here for getDefaultSelectors message) ──
const DEFAULT_SELECTORS = {
  claude:     { userMessage: '[data-testid="user-message"]', aiMessage: '.font-claude-response', input: 'div[data-testid="chat-input"][contenteditable="true"]', submitBtn: 'button[aria-label*="Send" i]:not([disabled])', slot: '.flex.flex-row.items-center.min-w-0.gap-1', slotAnchor: 'button[aria-label="Add files, connectors, and more"]' },
  gemini:     { userMessage: 'user-query-content', aiMessage: 'model-response', input: 'rich-textarea .ql-editor[contenteditable="true"]:not(.ql-clipboard)', submitBtn: 'button[aria-label="Send message"]:not([aria-disabled="true"]):not([disabled])', slot: '.leading-actions-wrapper' },
  chatgpt:    { userMessage: '[data-message-author-role="user"]', aiMessage: '[data-message-author-role="assistant"]', input: '#prompt-textarea, div.ProseMirror[contenteditable="true"]', submitBtn: '[data-testid="send-button"]:not([disabled])', slot: 'button[data-testid="composer-plus-btn"]' },
  deepseek:   { userMessage: '.fbb737a4, [class*="user-message"]', aiMessage: '.f9bf7997, [class*="assistant-message"]', input: 'textarea#chat-input, textarea', submitBtn: 'button[aria-label*="Send" i]:not([disabled])', slot: '.ec4f5d61' },
  perplexity: { userMessage: '[data-testid="user-message"], [class*="UserMessage"]', aiMessage: '[class*="AnswerBody"], .prose', input: 'textarea[placeholder*="Ask" i], textarea', submitBtn: 'button[type="submit"]:not([disabled])', slot: 'form' },
  grok:       { userMessage: '[data-testid*="UserMessage" i]', aiMessage: '[data-testid*="GrokMessage" i]', input: 'div[contenteditable="true"][data-testid="tweetTextarea_0"]', submitBtn: 'button[data-testid="tweetButtonInline"]:not([aria-disabled="true"])', slot: '[data-testid="toolBar"]' },
  mistral:    { userMessage: '[data-message-role="user"]', aiMessage: '[data-message-role="assistant"]', input: 'textarea[placeholder*="message" i], textarea', submitBtn: 'button[type="submit"]:not([disabled])', slot: 'form' },
  kimi:       { userMessage: '[class*="send-item"], [data-role="user"]', aiMessage: '[class*="receive-item"], [data-role="assistant"]', input: 'div[contenteditable="true"][class*="editor" i], textarea', submitBtn: 'button[class*="send" i]:not([disabled])', slot: '[class*="input-wrap" i]' },
};

// ── LLM config loader ────────────────────────────────────────────────────────
async function getCompressionConfig() {
  return new Promise(resolve => {
    chrome.storage.local.get([COMPRESSION_KEY], res => {
      resolve(res[COMPRESSION_KEY] || { mode: 'local', ratio: 40 });
    });
  });
}

// ── AI target URLs (all 8 platforms) ────────────────────────────────────────
const AI_URLS = {
  claude:     'https://claude.ai/new',
  gemini:     'https://gemini.google.com/app',
  chatgpt:    'https://chatgpt.com/',
  deepseek:   'https://chat.deepseek.com/',
  perplexity: 'https://www.perplexity.ai/',
  grok:       'https://x.com/i/grok',
  mistral:    'https://chat.mistral.ai/chat',
  kimi:       'https://kimi.ai/',
};

const SUPPORTED_HOSTS = [
  'claude.ai', 'gemini.google.com', 'chatgpt.com', 'chat.deepseek.com',
  'www.perplexity.ai', 'x.com', 'chat.mistral.ai', 'kimi.ai',
];

// â”€â”€ Message listener â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'saveConversation': {
      enqueueConversationMutation(() => saveConversation(message.conversation))
        .then(result => sendResponse({ ok: true, ...result }))
        .catch(error => sendResponse({ ok: false, error: error.message }));
      return true;
    }

    // â”€â”€ Compress a single message â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'compressMessage': {
      const { type, content } = message;
      (async () => {
        const compConf = await getCompressionConfig();

        if (compConf.mode === 'off') {
          sendResponse({ ok: true, compressed: content, stats: null });
          return;
        }

        // Try configured LLM first (if mode==='llm' OR legacy mode==='gemini' with llm_config set)
        const llmConf = await getLLMConfig();
        const useLLM  = llmConf && llmConf.provider &&
          llmConf.features?.compression &&
          (compConf.mode === 'llm' || compConf.mode === 'gemini');

        if (useLLM) {
          const sysPrompt = COMPRESSION_SYSTEM_PROMPT ||
            (type === 'assistant'
              ? 'Compress this AI message preserving all technical details. Output compressed text only.'
              : 'Compress this user message preserving full intent. Output compressed text only.');
          try {
            const compressed = await callLLM(sysPrompt, content, llmConf);
            sendResponse({ ok: true, compressed: compressed || content, stats: null });
          } catch (err) {
            console.warn('[Capsule] LLM compression failed, falling back to local NLP:', err.message);
            const result = localCompressMessage({ type, content }, (compConf.ratio || 40) / 100);
            sendResponse({ ok: true, compressed: result.content, stats: result });
          }
          return;
        }

        // Default: Local NLP
        const result = localCompressMessage({ type, content }, (compConf.ratio || 40) / 100);
        sendResponse({ ok: true, compressed: result.content, stats: result });
      })();
      return true;
    }

    // â”€â”€ Scrape active tab â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'scrapeActiveTab': {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];
        if (!tab?.url) { sendResponse({ ok: false, error: 'No active tab' }); return; }
        const isSupported = SUPPORTED_HOSTS.some(h => tab.url.includes(h));
        if (!isSupported) { sendResponse({ ok: false, error: 'Unsupported site' }); return; }
        chrome.tabs.sendMessage(tab.id, { action: 'scrapeNow' }, (response) => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
            return;
          }
          sendResponse({ ok: true, response });
        });
      });
      return true;
    }

    // â”€â”€ Open target AI with context injected â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    case 'openAIWithContext': {
      const { target, context } = message;
      if (!AI_URLS[target]) { sendResponse({ ok: false, error: 'Unknown AI target' }); return true; }
      chrome.storage.local.set(
        { [PENDING_INJECT_KEY]: { target, context, ts: Date.now() } },
        () => {
          chrome.tabs.create({ url: AI_URLS[target] }, (tab) => {
            sendResponse({ ok: true, tabId: tab.id });
          });
        }
      );
      return true;
    }

    // ── Proxy LLM call from popup (service worker has host_permissions) ────────
    case 'callLLMFromBackground': {
      const { systemPrompt, userPrompt } = message;
      (async () => {
        try {
          const llmConf = await getLLMConfig();
          if (!llmConf || !llmConf.provider) {
            sendResponse({ ok: false, error: 'No LLM provider configured. Open Settings → AI Provider.' });
            return;
          }
          const result = await callLLM(systemPrompt, userPrompt, llmConf);
          sendResponse({ ok: true, result });
        } catch (err) {
          sendResponse({ ok: false, error: err.message });
        }
      })();
      return true;
    }

    // ── Test LLM connection (from options page) ──────────────────────────────
    case 'testLLMConnection': {
      const { config } = message;
      (async () => {
        const result = await testLLMConnection(config);
        sendResponse(result);
      })();
      return true;
    }

    // ── Expose default selectors to options page ──────────────────────────────
    case 'getDefaultSelectors': {
      sendResponse({ ok: true, defaults: DEFAULT_SELECTORS });
      return false;
    }

    default:
      break;
  }
});

// â”€â”€ Rolling 10-Session Tiered Compression â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function applyTieredCompression(conversations) {
  let modified = false;

  // Sort by date descending (newest first)
  const sorted = [...conversations].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));

  for (let i = 0; i < sorted.length; i++) {
    const conv = sorted[i];
    const currentTier = conv.tieredTier || 0;

    if (i < 3) {
      // Tier 1 (Newest 3): Keep full detail
      if (currentTier !== 1) {
        conv.tieredTier = 1;
        modified = true;
      }
    } else if (i < 10) {
      // Tier 2 (Sessions 4-10): Medium compression (50% ratio)
      if (currentTier < 2) {
        conv.messages = conv.messages.map(msg => {
          const result = localCompressMessage(msg, 0.5);
          return {
            ...msg,
            content: result.content,
            compressed: result.compressed,
            originalLength: msg.originalLength || result.originalLength,
            compressedLength: result.compressedLength
          };
        });
        conv.tieredTier = 2;
        modified = true;
      }
    } else {
      // Tier 3 (Sessions > 10): Aggressive compression (25% ratio)
      if (currentTier < 3) {
        conv.messages = conv.messages.map(msg => {
          const result = localCompressMessage(msg, 0.25);
          return {
            ...msg,
            content: result.content,
            compressed: result.compressed,
            originalLength: msg.originalLength || result.originalLength,
            compressedLength: result.compressedLength
          };
        });
        conv.tieredTier = 3;
        modified = true;
      }
    }
  }

  return { sorted, modified };
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes[STORAGE_KEY]) return;
  enqueueConversationMutation(async () => {
    const current = await new Promise(resolve => chrome.storage.local.get([STORAGE_KEY], resolve));
    const { sorted, modified } = applyTieredCompression(current[STORAGE_KEY] || []);
    if (!modified) return;
    await new Promise((resolve, reject) => {
      chrome.storage.local.set({ [STORAGE_KEY]: sorted }, () => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else resolve();
      });
    });
  }).catch(error => console.error('[Capsule] Tiered compression failed:', error));
});

