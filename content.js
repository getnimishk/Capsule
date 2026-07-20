// content.js â€” DOM Scraper + Send-to-AI button for Claude.ai

// â”€â”€ Code-block helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function extractCodeBlocks(text) {
  const blocks = [];
  let idx = 0;
  const stripped = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__CODE_BLOCK_${idx++}__`;
    blocks.push({ placeholder, code: match });
    return placeholder;
  });
  return { stripped, blocks };
}

function restoreCodeBlocks(text, blocks) {
  let result = text;
  for (const { placeholder, code } of blocks) {
    result = result.replace(placeholder, code);
  }
  return result;
}

// â”€â”€ Single-message compressor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function compressMessage(message) {
  const { content, type } = message;
  if (!content || content.length < 120) return { ...message, compressed: false };

  const { stripped, blocks } = extractCodeBlocks(content);
  const proseOnly = stripped.replace(/__CODE_BLOCK_\d+__/g, "").trim();
  if (!proseOnly) return { ...message, compressed: false };

  return new Promise((resolve) => {
    chrome.runtime.sendMessage(
      { action: "compressMessage", type, content: stripped },
      (response) => {
        if (chrome.runtime.lastError || !response?.ok || !response?.compressed) {
          resolve({ ...message, compressed: false });
          return;
        }
        const compressedContent = restoreCodeBlocks(response.compressed, blocks);
        resolve({ ...message, content: compressedContent, compressed: true });
      }
    );
  });
}

// â”€â”€ Conversation compressor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function compressConversation(messages) {
  const userMessages = messages.filter((m) => m.type === "user").slice(-5);
  const assistantMessages = messages.filter((m) => m.type === "assistant").slice(-5);

  const keptUserSet = new Set(userMessages.map((m) => m.timestamp + m.content.slice(0, 40)));
  const keptAssistantSet = new Set(assistantMessages.map((m) => m.timestamp + m.content.slice(0, 40)));

  const kept = messages.filter((m) => {
    const key = m.timestamp + m.content.slice(0, 40);
    return m.type === "user" ? keptUserSet.has(key) : keptAssistantSet.has(key);
  });

  return await Promise.all(kept.map((msg) => compressMessage(msg)));
}

// â”€â”€ Fingerprint (SHA-256 of first 3 user messages) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function generateFingerprint(messages) {
  try {
    const seed = messages
      .filter(m => m.type === 'user')
      .slice(0, 3)
      .map(m => m.content.slice(0, 100))
      .join('||');
    if (!seed) return null;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  } catch { return null; }
}

// â”€â”€ Capsule â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const Capsule = {
  async build(messages, url) {
    const title = this._inferTitle(messages, url);
    const fingerprint = await generateFingerprint(messages);
    return {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      title, url, messages, fingerprint,
      savedAt: new Date().toISOString(),
      source: "claude",
      version: 1,
    };
  },
  _inferTitle(messages, url) {
    const firstUser = messages.find((m) => m.type === "user");
    if (firstUser && firstUser.content.length > 0) {
      return firstUser.content.substring(0, 60).replace(/\n/g, " ").trim() +
        (firstUser.content.length > 60 ? "â€¦" : "");
    }
    try {
      const u = new URL(url);
      const parts = u.pathname.split("/").filter(Boolean);
      return parts[parts.length - 1] || "Untitled Conversation";
    } catch { return "Untitled Conversation"; }
  },
};

// â”€â”€ Storage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const STORAGE_KEY = "cc_all_conversations";
const MAX_CONVERSATIONS = 50;

function storageGetAll() {
  return new Promise((resolve) => {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      if (chrome.runtime.lastError) { resolve([]); return; }
      resolve(result[STORAGE_KEY] || []);
    });
  });
}

async function storageSave(conversation) {
  // MV3 service workers can go to sleep and reject messages with
  // "message channel closed before a response was received".
  // Retry once after 300ms to give the worker time to restart.
  function trySend(resolve, reject, attemptsLeft) {
    chrome.runtime.sendMessage({ action: 'saveConversation', conversation }, response => {
      const err = chrome.runtime.lastError;
      if (err) {
        const isChannelClosed = err.message?.includes('message channel closed') ||
                                err.message?.includes('Could not establish connection');
        if (isChannelClosed && attemptsLeft > 0) {
          setTimeout(() => trySend(resolve, reject, attemptsLeft - 1), 300);
        } else {
          reject(new Error(err.message));
        }
        return;
      }
      if (!response?.ok) reject(new Error(response?.error || 'Unable to save conversation.'));
      else resolve(response);
    });
  }
  return new Promise((resolve, reject) => trySend(resolve, reject, 1));
}


// â”€â”€ Scraper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function scrapeMessages() {
  const messages = [];
  const now = new Date().toISOString();

  document.querySelectorAll('[data-testid="user-message"], .font-claude-response')
    .forEach((el) => {
      const isUser = el.matches('[data-testid="user-message"]');
      const type = isUser ? "user" : "assistant";

      if (isUser) {
        const content = el.innerText?.trim();
        if (content) messages.push({ type, content, format: "text", timestamp: now });
      } else {
        const parts = [];
        el.querySelectorAll('p, li, h1, h2, h3, pre.code-block__code, [role="group"] pre.code-block__code')
          .forEach((child) => {
            if (child.tagName === "PRE" && child.classList.contains("code-block__code")) {
              const code = child.querySelector("code");
              const lang = child.closest('[role="group"]')?.querySelector(".text-text-500")?.innerText?.trim() || "";
              const c = code?.innerText?.trim() || child.innerText?.trim();
              if (c) parts.push(`\`\`\`${lang}\n${c}\n\`\`\``);
            } else {
              const text = child.innerText?.trim();
              if (text) parts.push(text);
            }
          });
        if (parts.length) messages.push({ type, content: parts.join("\n\n"), format: "text", timestamp: now });
      }
    });

  return messages;
}

// â”€â”€ Debounced save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _debounceTimer = null;

async function scheduleConversationSave() {
  clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(async () => {
    const rawMessages = scrapeMessages();
    if (!rawMessages.length) return;
    
    // Auto-Handoff Trigger warning banner check
    if (typeof checkContextAndShowWarning === 'function') {
      checkContextAndShowWarning(rawMessages, "claude");
    }

    let messages;
    try { messages = await compressConversation(rawMessages); }
    catch { messages = rawMessages; }
    const capsule = await Capsule.build(messages, window.location.href);
    try { await storageSave(capsule); }
    catch (err) { console.error("[ContextClaw] save failed:", err); }
  }, 1500);
}

// â”€â”€ Format context â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function formatContextBlock(conversation) {
  if (!conversation?.messages?.length) return null;
  const lines = [
    `[CONTEXT HANDOFF â€” Do NOT reply to this message]`,
    ``,
    `The following is the full context of a conversation I was having on Claude.`,
    `Please read and remember this context. Do not respond to it.`,
    `I will send my next message separately to continue the conversation.`,
    ``,
    `--- Conversation: "${conversation.title || "Untitled"}" ---`,
    `Saved: ${new Date(conversation.savedAt).toLocaleString()}`,
    ``,
  ];
  for (const msg of conversation.messages) {
    lines.push(`${msg.type === "user" ? "User" : "Claude"}: ${msg.content}`, "");
  }
  lines.push(
    `--- End of context ---`,
    ``,
    `(Please acknowledge you have read the above context by saying "Got it â€” context received." ` +
    `Then wait for my next message.)`
  );
  return lines.join("\n");
}


// â”€â”€ Copy current chat to clipboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function copyCurrentChat() {
  const messages = scrapeMessages();
  if (!messages.length) { showToast("No messages found to copy."); return; }
  const firstUser = messages.find(m => m.type === "user");
  const title = firstUser?.content?.slice(0, 60) || "conversation";
  const lines = [
    `[Claude conversation: "${title}"]`,
    `[Copied: ${new Date().toLocaleString()}]`,
    "",
  ];
  for (const msg of messages) {
    lines.push(`${msg.type === "user" ? "User" : "Claude"}: ${msg.content}`, "");
  }
  navigator.clipboard.writeText(lines.join("\n")).then(
    () => showToast("âœ“ Conversation copied to clipboard"),
    () => showToast("âš ï¸ Copy failed â€” try again.")
  );
}

// â”€â”€ Download current chat as JSON â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function downloadCurrentChat() {
  const messages = scrapeMessages();
  if (!messages.length) { showToast("No messages found to download."); return; }
  const capsule = Capsule.build(messages, window.location.href);
  const blob = new Blob([JSON.stringify(capsule, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${capsule.title.replace(/[^\w\d]+/g, "_").slice(0, 50)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast("âœ“ Downloading JSONâ€¦");
}

// â”€â”€ Send to AI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function sendToAI(target) {
  const all = await storageGetAll();
  if (!all.length) { showToast("âš ï¸ No saved conversations. Click Refresh in the popup first."); return; }

  const conversation = all.slice().reverse().find(c => c.url === window.location.href) || all[all.length - 1];
  const ctx = formatContextBlock(conversation);
  if (!ctx) { showToast("No messages to send."); return; }

  chrome.runtime.sendMessage({ action: "openAIWithContext", target, context: ctx }, (res) => {
    const names = { claude: "Claude", gemini: "Gemini", chatgpt: "ChatGPT", deepseek: "DeepSeek" };
    showToast(res?.ok ? `â†— Opening ${names[target]}â€¦` : "Failed to open tab.");
  });
}

// â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showToast(msg) {
  document.getElementById("cc-toast")?.remove();
  const t = document.createElement("div");
  t.id = "cc-toast";
  t.textContent = msg;
  Object.assign(t.style, {
    position: "fixed", bottom: "90px", left: "50%",
    transform: "translateX(-50%) translateY(6px)",
    background: "#18181b", color: "#fafafa",
    fontFamily: "system-ui, sans-serif", fontSize: "13px", fontWeight: "500",
    padding: "8px 16px", borderRadius: "999px",
    border: "1px solid #3f3f46", boxShadow: "0 4px 20px rgba(0,0,0,0.4)",
    zIndex: "2147483647", pointerEvents: "none", opacity: "0",
    transition: "opacity 0.2s, transform 0.2s", whiteSpace: "nowrap",
  });
  document.body.appendChild(t);
  requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translateX(-50%) translateY(0)"; });
  setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 250); }, 2800);
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// â”€â”€ BUTTON INJECTION â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

const CC_BTN_ID = "cc-ask-ai-btn";
const CC_PANEL_ID = "cc-ask-ai-panel";

const AI_OPTIONS = [
  {
    id: "gemini", label: "Gemini",
    color: "#4285F4", bg: "rgba(66,133,244,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C9.5 7.5 6.5 9.5 2 12c4.5 2.5 7.5 4.5 10 10 2.5-5.5 5.5-7.5 10-10-4.5-2.5-7.5-4.5-10-10z" fill="#4285F4"/>
    </svg>`,
  },
  {
    id: "chatgpt", label: "ChatGPT",
    color: "#10a37f", bg: "rgba(16,163,127,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#10a37f"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>`,
  },
  {
    id: "deepseek", label: "DeepSeek",
    color: "#1A6BFF", bg: "rgba(26,107,255,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1A6BFF"/><circle cx="12" cy="12" r="5" fill="white"/><circle cx="12" cy="12" r="2.5" fill="#1A6BFF"/></svg>`,
  },
  {
    id: "perplexity", label: "Perplexity",
    color: "#20B2AA", bg: "rgba(32,178,170,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#20B2AA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
  {
    id: "grok", label: "Grok",
    color: "#1DA1F2", bg: "rgba(29,161,242,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`,
  },
  {
    id: "mistral", label: "Mistral",
    color: "#FF7000", bg: "rgba(255,112,0,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#FF7000"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9.5" y="2" width="5" height="5" rx="1"/><rect x="17" y="2" width="5" height="5" rx="1"/><rect x="2" y="9.5" width="5" height="5" rx="1"/><rect x="17" y="9.5" width="5" height="5" rx="1"/><rect x="2" y="17" width="5" height="5" rx="1"/><rect x="9.5" y="17" width="5" height="5" rx="1"/><rect x="17" y="17" width="5" height="5" rx="1"/></svg>`,
  },
  {
    id: "kimi", label: "Kimi",
    color: "#60A5FA", bg: "rgba(96,165,250,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1D4ED8"/><path d="M8 16V8l4 4 4-4v8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  },
];

function ensureStyles() {
  if (document.getElementById("cc-styles")) return;
  const s = document.createElement("style");
  s.id = "cc-styles";
  s.textContent = `
    #cc-ask-ai-btn {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      padding: 5px 12px !important;
      height: 32px !important;
      background: #18181b !important;
      color: #ffffff !important;
      border: 1px solid rgba(255,255,255,0.25) !important;
      border-radius: 16px !important;
      cursor: pointer !important;
      font-family: system-ui, -apple-system, sans-serif !important;
      font-size: 12px !important;
      font-weight: 600 !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important;
      flex-shrink: 0 !important;
      white-space: nowrap !important;
      outline: none !important;
      z-index: 2147483646 !important;
      transition: all 0.15s ease !important;
      margin: 0 6px !important;
    }
    #cc-ask-ai-btn:hover {
      background: #27272a !important;
      border-color: #60a5fa !important;
      color: #60a5fa !important;
      transform: translateY(-1px) !important;
      box-shadow: 0 6px 20px rgba(0,0,0,0.5) !important;
    }
    #cc-ask-ai-btn.active {
      background: #27272a !important;
      border-color: #3b82f6 !important;
      color: #60a5fa !important;
    }

    #cc-ask-ai-panel {
      position: fixed !important;
      background: hsl(var(--bg-000)) !important;
      border: 1px solid hsl(var(--border-300) / 0.5) !important;
      border-radius: 14px !important;
      padding: 8px !important;
      box-shadow: 0 8px 32px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.03) !important;
      z-index: 2147483647 !important;
      display: none !important;
      flex-direction: column !important;
      gap: 3px !important;
      min-width: 205px !important;
      font-family: inherit !important;
    }
    #cc-ask-ai-panel.cc-open {
      display: flex !important;
      animation: cc-pop 0.16s cubic-bezier(0.16,1,0.3,1) !important;
    }
    @keyframes cc-pop {
      from { opacity:0; transform:translateY(6px) scale(0.97); }
      to   { opacity:1; transform:translateY(0) scale(1); }
    }
    .cc-panel-hdr {
      font-size: 10px !important;
      font-weight: 700 !important;
      color: hsl(var(--text-500)) !important;
      text-transform: uppercase !important;
      letter-spacing: 0.8px !important;
      padding: 3px 8px 8px !important;
      border-bottom: 1px solid hsl(var(--border-300) / 0.35) !important;
      margin-bottom: 2px !important;
    }
    .cc-ai-opt {
      display: flex !important;
      align-items: center !important;
      gap: 10px !important;
      width: 100% !important;
      padding: 8px 10px !important;
      background: transparent !important;
      border: none !important;
      border-radius: 8px !important;
      cursor: pointer !important;
      font-family: inherit !important;
      transition: background 0.12s, transform 0.1s !important;
      text-align: left !important;
    }
    .cc-ai-opt:hover { background: hsl(var(--bg-100)) !important; transform: translateX(2px) !important; }
    .cc-ai-opt:active { transform: scale(0.97) !important; }
    .cc-ai-ico {
      width: 28px !important; height: 28px !important;
      border-radius: 8px !important;
      display: flex !important; align-items: center !important; justify-content: center !important;
      flex-shrink: 0 !important;
    }
    .cc-ai-lbl { font-size: 13px !important; font-weight: 600 !important; color: hsl(var(--text-100)) !important; display:block !important; }
    .cc-ai-sub { font-size: 10px !important; color: hsl(var(--text-500)) !important; display:block !important; margin-top:1px !important; }
    .cc-arr { margin-left: auto !important; color: hsl(var(--text-500)) !important; flex-shrink: 0 !important; }
    .cc-divider { height: 1px !important; background: hsl(var(--border-300) / 0.35) !important; margin: 3px 0 !important; }
    .cc-action-row {
      display: flex !important;
      gap: 4px !important;
      padding: 2px !important;
    }
    .cc-action-btn {
      flex: 1 !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 6px !important;
      padding: 7px 10px !important;
      background: transparent !important;
      border: 1px solid hsl(var(--border-300) / 0.4) !important;
      border-radius: 8px !important;
      color: hsl(var(--text-400)) !important;
      cursor: pointer !important;
      font-family: inherit !important;
      font-size: 11px !important;
      font-weight: 500 !important;
      transition: background 0.12s, color 0.12s, border-color 0.12s !important;
      white-space: nowrap !important;
    }
    .cc-action-btn:hover {
      background: hsl(var(--bg-100)) !important;
      border-color: hsl(var(--border-200)) !important;
      color: hsl(var(--text-200)) !important;
    }
    .cc-action-btn:active { opacity: 0.75 !important; }
  `;
  document.head.appendChild(s);
}

// â”€â”€ Find exact injection point from real Claude DOM â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Claude toolbar structure:
//   <div class="relative flex gap-2 w-full items-center">          â† toolbar row
//     <div class="relative flex-1 flex items-center shrink ...">   â† left side
//       <div>                                                       â† wraps + button
//         <button aria-label="Add files, connectors, and more">    â† the + btn
//       <div class="flex flex-row items-center min-w-0 gap-1">     â† chip slot (inject here)
//     <div>                                                         â† model selector
//     <div>                                                         â† voice btn
function findSlot() {
  // 1. Anchor on the + button â€” most stable identifier
  const plusBtn = document.querySelector('button[aria-label="Add files, connectors, and more"]');
  if (!plusBtn) return null;

  // 2. Its grandparent is the flex-1 container. Find the chip slot inside it.
  const flexContainer = plusBtn.closest('.relative.flex-1') || plusBtn.parentElement?.parentElement;
  if (!flexContainer) return null;

  // 3. The chip slot is a flex row inside that container (after the + button wrapper)
  const chipSlot = flexContainer.querySelector('.flex.flex-row.items-center.min-w-0.gap-1');
  if (chipSlot) return chipSlot;

  // 4. Fallback: insert right after the + button's wrapper div
  const plusWrapper = plusBtn.parentElement;
  return plusWrapper?.parentElement || null;
}

function buildPanel() {
  const panel = document.createElement("div");
  panel.id = CC_PANEL_ID;

  const hdr = document.createElement("div");
  hdr.className = "cc-panel-hdr";
  hdr.textContent = "Send context to";
  panel.appendChild(hdr);

  for (const ai of AI_OPTIONS) {
    const opt = document.createElement("button");
    opt.className = "cc-ai-opt";
    opt.type = "button";
    opt.innerHTML = `
      <span class="cc-ai-ico" style="background:${ai.bg}">${ai.svg}</span>
      <span>
        <span class="cc-ai-lbl">${ai.label}</span>
        <span class="cc-ai-sub">Open &amp; inject context</span>
      </span>
      <svg class="cc-arr" width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    `;
    opt.addEventListener("mousedown", (e) => {
      e.preventDefault(); // prevent input blur
      closePanel();
      sendToAI(ai.id);
    });
    panel.appendChild(opt);
  }

  const divider = document.createElement("div");
  divider.className = "cc-divider";
  panel.appendChild(divider);

  const actionRow = document.createElement("div");
  actionRow.className = "cc-action-row";

  const copyBtn = document.createElement("button");
  copyBtn.className = "cc-action-btn";
  copyBtn.type = "button";
  copyBtn.title = "Copy conversation to clipboard";
  copyBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
    </svg>
    Copy
  `;
  copyBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    closePanel();
    copyCurrentChat();
  });

  const dlBtn = document.createElement("button");
  dlBtn.className = "cc-action-btn";
  dlBtn.type = "button";
  dlBtn.title = "Download conversation as JSON";
  dlBtn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    </svg>
    Download
  `;
  dlBtn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    closePanel();
    downloadCurrentChat();
  });

  actionRow.appendChild(copyBtn);
  actionRow.appendChild(dlBtn);
  panel.appendChild(actionRow);

  document.body.appendChild(panel);
  return panel;
}

let _panel = null;
let _panelOpen = false;

function openPanel(btn) {
  if (!_panel) _panel = buildPanel();
  const r = btn.getBoundingClientRect();
  const panelH = 185;
  if (r.top > panelH + 10) {
    _panel.style.bottom = `${window.innerHeight - r.top + 8}px`;
    _panel.style.top = "auto";
  } else {
    _panel.style.top = `${r.bottom + 8}px`;
    _panel.style.bottom = "auto";
  }
  _panel.style.left = `${Math.min(r.left, window.innerWidth - 215)}px`;
  _panel.classList.add("cc-open");
  btn.classList.add("active");
  _panelOpen = true;
}

function closePanel() {
  _panel?.classList.remove("cc-open");
  document.getElementById(CC_BTN_ID)?.classList.remove("active");
  _panelOpen = false;
}

function injectButton() {
  if (document.getElementById(CC_BTN_ID)) return;

  ensureStyles();

  const slot = findSlot();
  if (!slot) return;

  const btn = document.createElement("button");
  btn.id = CC_BTN_ID;
  btn.type = "button";
  btn.title = "Send conversation context to another AI";
  btn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="22" y1="2" x2="11" y2="13"/>
      <polygon points="22 2 15 22 11 13 2 9 22 2"/>
    </svg>
    Export
  `;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    _panelOpen ? closePanel() : openPanel(btn);
  });

  document.addEventListener("click", (e) => {
    if (_panelOpen && !_panel?.contains(e.target) && e.target !== btn) closePanel();
  });

  // Insert into chip slot
  slot.appendChild(btn);
}

// â”€â”€ Message listener â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "scrapeNow") { scheduleConversationSave(); sendResponse({ ok: true }); }
  if (message.action === "ping") { sendResponse({ ok: true, url: window.location.href }); }
  return false;
});

// â”€â”€ MutationObserver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _observer = null;

function startObserver() {
  if (_observer) return;
  _observer = new MutationObserver((mutations) => {
    if (mutations.some((m) => m.addedNodes.length > 0 || m.type === "characterData")) {
      scheduleConversationSave();
      if (!document.getElementById(CC_BTN_ID)) setTimeout(injectButton, 300);
    }
  });
  _observer.observe(document.body, { childList: true, subtree: true, characterData: true });
}

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function isConversationPage() {
  return (
    /\/chat\/|\/c\/|\/conversation/.test(window.location.pathname) ||
    /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(window.location.pathname)
  );
}

let _injectAttempts = 0;
function retryInject() {
  if (document.getElementById(CC_BTN_ID)) return;
  // continuous retry fallback
  injectButton();
  if (!document.getElementById(CC_BTN_ID)) setTimeout(retryInject, 400);
}

// â”€â”€ Pending context injection (receive context from other AIs) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// -- Pending context injection (receive context from other AIs) ----------------
function showPendingContextBanner(pending, onInject) {
  if (document.getElementById("cc-pending-banner")) return;
  const b = document.createElement("div");
  b.id = "cc-pending-banner";
  Object.assign(b.style, {
    position: "fixed", top: "16px", left: "50%",
    transform: "translateX(-50%)",
    background: "#18181b", color: "#fafafa",
    fontFamily: "system-ui, -apple-system, sans-serif", fontSize: "13px", fontWeight: "500",
    padding: "8px 14px", borderRadius: "30px",
    border: "1px solid rgba(255,255,255,0.2)",
    boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
    zIndex: "2147483647", display: "flex", alignItems: "center", gap: "10px",
    whiteSpace: "nowrap",
  });

  const firstLine = pending.context?.split("\n")[0]?.replace(/^[\[\s]*/, '') || "Context";

  b.innerHTML = `
    <span style="color:#60a5fa;display:flex;align-items:center;gap:4px;font-weight:600;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      Capsule Context
    </span>
    <span style="color:#a1a1aa;max-width:160px;overflow:hidden;text-overflow:ellipsis;">"${firstLine}"</span>
    <button id="cc-btn-do-inject" style="background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:14px;font-size:12px;font-weight:600;cursor:pointer;">Inject Now</button>
    <button id="cc-btn-do-copy" style="background:#27272a;color:#d4d4d8;border:1px solid #3f3f46;padding:5px 12px;border-radius:14px;font-size:12px;font-weight:600;cursor:pointer;">Copy</button>
    <button id="cc-btn-dismiss" style="background:none;border:none;color:#71717a;cursor:pointer;font-size:14px;padding:0 4px;">&#x2715;</button>
  `;

  document.body.appendChild(b);

  b.querySelector("#cc-btn-do-inject").addEventListener("click", async () => {
    const injected = await onInject();
    if (injected) {
      try { await chrome.storage.local.remove(["pending_context_inject"]); } catch (_) {}
      b.remove();
    } else {
      showToast("Input field not visible. Please log in or close popups first.");
    }
  });

  b.querySelector("#cc-btn-do-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(pending.context);
    try { chrome.storage.local.remove(["pending_context_inject"]); } catch (_) {}
    b.remove();
    showToast("Copied context to clipboard!");
  });

  b.querySelector("#cc-btn-dismiss").addEventListener("click", () => {
    try { chrome.storage.local.remove(["pending_context_inject"]); } catch (_) {}
    b.remove();
  });
}

function findClaudeInput() {
  return document.querySelector('div.ProseMirror[contenteditable="true"]') ||
         document.querySelector('div[contenteditable="true"]') ||
         document.querySelector('fieldset div[contenteditable="true"]') ||
         document.querySelector('textarea');
}

function injectIntoClaude(el, context) {
  el.focus();
  if (el.tagName === "TEXTAREA") {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    nativeSetter ? nativeSetter.call(el, context) : (el.value = context);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, context);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function checkAndInjectPendingContext() {
  try {
    chrome.storage.local.get(["pending_context_inject"], (result) => {
      const pending = result["pending_context_inject"];
      if (!pending || pending.target !== "claude" || Date.now() - pending.ts > 300000) return;

      const input = findClaudeInput();
      if (input && input.offsetParent !== null) {
        chrome.storage.local.remove(["pending_context_inject"]);
        injectIntoClaude(input, pending.context);
        showToast("\u2713 Context injected \u2014 review and send!");
        return;
      }

      showPendingContextBanner(pending, async () => {
        const el = findClaudeInput();
        if (el && el.offsetParent !== null) {
          injectIntoClaude(el, pending.context);
          return true;
        }
        return false;
      });

      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        const el = findClaudeInput();
        if (el && el.offsetParent !== null) {
          clearInterval(poll);
          document.getElementById("cc-pending-banner")?.remove();
          chrome.storage.local.remove(["pending_context_inject"]);
          injectIntoClaude(el, pending.context);
          showToast("\u2713 Context injected \u2014 review and send!");
        } else if (attempts >= 90) {
          clearInterval(poll);
        }
      }, 1000);
    });
  } catch (e) {}
}

function injectApiHook() {
  try {
    const s = document.createElement("script");
    s.src = chrome.runtime.getURL("shared/api_hook.js");
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  } catch (e) {
    console.error("[ContextClaw] api hook injection failed:", e);
  }
}

function parseClaudeApiConversation(data) {
  const messages = [];
  const chatMessages = data.chat_messages || [];
  chatMessages.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  chatMessages.forEach(m => {
    const role = m.sender;
    const text = m.text;
    if (role && text) {
      messages.push({
        type: role === "human" ? "user" : "assistant",
        content: text.trim(),
        format: "text",
        timestamp: m.created_at
      });
    }
  });
  return messages;
}

window.addEventListener("message", async (e) => {
  if (e.data && e.data.type === "Capsule_API_CAPTURE") {
    if (e.data.url.includes("api/organizations/") && e.data.url.includes("/chat_conversations/")) {
      const messages = parseClaudeApiConversation(e.data.data);
      if (messages.length) {
        const capsule = await Capsule.build(messages, window.location.href);
        storageSave(capsule);
      }
    }
  }
});

function init() {
  injectApiHook();
  checkAndInjectPendingContext();
  if (!isConversationPage()) {
    let last = window.location.href;
    const poll = setInterval(() => {
      if (window.location.href !== last) {
        last = window.location.href;
        if (isConversationPage()) { clearInterval(poll); startObserver(); scheduleConversationSave(); _injectAttempts = 0; retryInject(); }
      }
    }, 800);
    return;
  }
  startObserver();
  scheduleConversationSave();
  _injectAttempts = 0;
  retryInject();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}

// SPA nav
let _lastHref = window.location.href;
const _navObserver = new MutationObserver(() => {
  if (window.location.href !== _lastHref) {
    _lastHref = window.location.href;
    if (_observer) { _observer.disconnect(); _observer = null; }
    document.getElementById(CC_BTN_ID)?.remove();
    document.getElementById(CC_PANEL_ID)?.remove();
    _panel = null; _panelOpen = false;
    init();
  }
});
_navObserver.observe(document.documentElement, { childList: true, subtree: false });

window.__contextClaw = { scrapeNow: scheduleConversationSave, scrapeMessages };

