// shared/selectors.js
// Centralised selector config — loaded by all injectors.
// Users can override any selector via the Settings page (options/).
// Storage key: "cs_selector_config" in chrome.storage.local.

const DEFAULT_SELECTORS = {
  claude: {
    userMessage:  '[data-testid="user-message"]',
    aiMessage:    '.font-claude-response',
    input:        'div[data-testid="chat-input"][contenteditable="true"]',
    submitBtn:    'button[aria-label*="Send" i]:not([disabled])',
    slot:         '.flex.flex-row.items-center.min-w-0.gap-1',
    slotAnchor:   'button[aria-label="Add files, connectors, and more"]',
  },
  gemini: {
    userMessage:  'user-query-content',
    aiMessage:    'model-response',
    input:        'rich-textarea .ql-editor[contenteditable="true"]:not(.ql-clipboard)',
    submitBtn:    'button[aria-label="Send message"]:not([aria-disabled="true"]):not([disabled])',
    slot:         '.leading-actions-wrapper',
  },
  chatgpt: {
    userMessage:  '[data-message-author-role="user"]',
    aiMessage:    '[data-message-author-role="assistant"]',
    input:        '#prompt-textarea, div.ProseMirror[contenteditable="true"]',
    submitBtn:    '[data-testid="send-button"]:not([disabled]), button[aria-label="Send message"]:not([disabled])',
    slot:         'button[data-testid="composer-plus-btn"]',
  },
  deepseek: {
    userMessage:  '.fbb737a4, [class*="user-message"]',
    aiMessage:    '.f9bf7997, [class*="assistant-message"], .ds-markdown',
    input:        'textarea#chat-input, textarea',
    submitBtn:    'button[aria-label*="Send" i]:not([disabled]), button[type="submit"]:not([disabled])',
    slot:         '.ec4f5d61',
  },
  perplexity: {
    userMessage:  '[data-testid="user-message"], [class*="UserMessage"]',
    aiMessage:    '[class*="AnswerBody"], .prose, [class*="answer"]',
    input:        'textarea[placeholder*="Ask" i], textarea',
    submitBtn:    'button[aria-label*="Submit" i]:not([disabled]), button[type="submit"]:not([disabled])',
    slot:         'form',
  },
  grok: {
    userMessage:  '[data-testid*="UserMessage" i], [class*="human" i]',
    aiMessage:    '[data-testid*="GrokMessage" i], [class*="ai-response" i]',
    input:        'div[contenteditable="true"][data-testid="tweetTextarea_0"], div[contenteditable="true"][role="textbox"]',
    submitBtn:    'button[data-testid="tweetButtonInline"]:not([aria-disabled="true"])',
    slot:         '[data-testid="toolBar"]',
  },
  mistral: {
    userMessage:  '[data-message-role="user"], [class*="UserMessage"]',
    aiMessage:    '[data-message-role="assistant"], [class*="AssistantMessage"]',
    input:        'textarea[placeholder*="message" i], textarea',
    submitBtn:    'button[data-testid*="send" i]:not([disabled]), button[type="submit"]:not([disabled])',
    slot:         'form, [class*="InputWrapper"]',
  },
  kimi: {
    userMessage:  '[class*="send-item"], [data-role="user"]',
    aiMessage:    '[class*="receive-item"], [data-role="assistant"]',
    input:        'div[contenteditable="true"][class*="editor" i], textarea[class*="input" i]',
    submitBtn:    'button[class*="send" i]:not([disabled])',
    slot:         '[class*="input-wrap" i], [class*="chat-input" i]',
  },
};

/**
 * Returns merged selector config: user overrides on top of defaults.
 * @returns {Promise<typeof DEFAULT_SELECTORS>}
 */
async function getSelectorConfig() {
  return new Promise((resolve) => {
    try {
      chrome.storage.local.get(['cs_selector_config'], (res) => {
        if (chrome.runtime.lastError) { resolve(DEFAULT_SELECTORS); return; }
        const userConfig = res['cs_selector_config'] || {};
        // Deep merge: user overrides per-platform per-selector
        const merged = {};
        for (const platform of Object.keys(DEFAULT_SELECTORS)) {
          merged[platform] = { ...DEFAULT_SELECTORS[platform], ...(userConfig[platform] || {}) };
        }
        resolve(merged);
      });
    } catch {
      resolve(DEFAULT_SELECTORS);
    }
  });
}

// Make available globally for content scripts loaded as web-accessible resources
if (typeof window !== 'undefined') {
  window.__CS_DEFAULT_SELECTORS = DEFAULT_SELECTORS;
  window.__CS_getSelectorConfig = getSelectorConfig;
}
// Also export for service worker (background.js) via importScripts
if (typeof self !== 'undefined' && typeof window === 'undefined') {
  self.__CS_DEFAULT_SELECTORS = DEFAULT_SELECTORS;
  self.__CS_getSelectorConfig = getSelectorConfig;
}
