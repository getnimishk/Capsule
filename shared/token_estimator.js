// shared/token_estimator.js
// Context window limits and token estimation for Capsule
// Used by: popup.js (context bar), content.js (auto-handoff trigger)

'use strict';

// ── Known context window limits (in tokens) ───────────────────────────────────
// Conservative figures — model pages updated as of 2025-Q4
const CONTEXT_LIMITS = {
  claude:     200_000,   // Claude 3.5 Sonnet / Haiku (200K)
  chatgpt:    128_000,   // GPT-4o / GPT-4-turbo (128K)
  gemini:   1_000_000,   // Gemini 1.5/2.5 Flash & Pro (1M)
  deepseek:    64_000,   // DeepSeek V2 (64K)
  perplexity: 127_000,   // Perplexity (Sonar 127K)
  grok:       131_072,   // Grok-2 (131K)
  mistral:    128_000,   // Mistral Large 2 (128K)
  kimi:       128_000,   // Kimi (128K)
};

// Threshold at which we fire the auto-handoff warning (0.0–1.0)
const WARN_THRESHOLD = 0.80;
const DANGER_THRESHOLD = 0.92;

// ── Token estimation ──────────────────────────────────────────────────────────
// Rule of thumb: 1 token ≈ 4 chars for English prose.
// We apply a 1.1× multiplier to be conservative (code, JSON, etc. tokenise heavier).

function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.round((text.length / 4) * 1.1);
}

/**
 * Estimate total token usage for a conversation object.
 * @param {Object} conv  — { messages: [{type, content}], source }
 * @returns {Object}  { tokens, limit, ratio, level }
 *   level: 'ok' | 'warn' | 'danger'
 */
function estimateContextUsage(conv) {
  const messages = conv?.messages || [];
  const source   = (conv?.source || conv?.platform || 'chatgpt').toLowerCase();

  const limit  = CONTEXT_LIMITS[source] || 128_000;
  const tokens = messages.reduce((sum, m) => sum + estimateTokens(m?.content || ''), 0);
  const ratio  = Math.min(tokens / limit, 1.0);

  let level = 'ok';
  if (ratio >= DANGER_THRESHOLD) level = 'danger';
  else if (ratio >= WARN_THRESHOLD) level = 'warn';

  return { tokens, limit, ratio, level };
}

/**
 * Format token count compactly: 1234 → "1.2K", 1200000 → "1.2M"
 */
function formatTokens(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

/**
 * Format a context limit label (e.g. "128K context")
 */
function formatLimit(n) {
  if (n >= 1_000_000) return `${Math.round(n / 1_000_000)}M ctx`;
  return `${Math.round(n / 1_000)}K ctx`;
}

// ── Warning Banner UI Logic ───────────────────────────────────────────────────
let _warningBanner = null;
let _warningBannerDismissed = false;
let _lastMessages = null;
let _platformName = null;

function checkContextAndShowWarning(messages, platform) {
  if (typeof document === 'undefined') return;
  _lastMessages = messages;
  _platformName = platform;

  if (_warningBannerDismissed) return;

  const usage = estimateContextUsage({ messages, source: platform });

  if (usage.ratio >= WARN_THRESHOLD) {
    showWarningBanner(usage.tokens, usage.limit, usage.ratio);
  } else {
    removeWarningBanner();
  }
}

function showWarningBanner(tokens, limit, ratio) {
  if (typeof document === 'undefined') return;
  if (_warningBanner) {
    updateWarningBanner(tokens, limit, ratio);
    return;
  }

  _warningBanner = document.createElement("div");
  _warningBanner.id = "capsule-warning-banner";
  _warningBanner.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    width: 320px;
    background: #18181b;
    color: #f4f4f5;
    border: 1px solid #f59e0b;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 13px;
    padding: 14px;
    box-sizing: border-box;
    z-index: 2147483647;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5), 0 8px 10px -6px rgba(0,0,0,0.5);
    line-height: 1.5;
  `;

  // Header row
  const header = document.createElement("div");
  header.style.cssText = `
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 700;
    color: #f59e0b;
  `;

  const titleSpan = document.createElement("span");
  titleSpan.innerHTML = "⚠️ Capsule Warning";
  header.appendChild(titleSpan);

  const btnClose = document.createElement("button");
  btnClose.textContent = "✕";
  btnClose.style.cssText = `
    background: transparent;
    color: #a1a1aa;
    border: none;
    cursor: pointer;
    font-size: 14px;
    padding: 0 4px;
    font-weight: bold;
    line-height: 1;
    transition: color 0.15s;
  `;
  btnClose.onmouseover = () => btnClose.style.color = '#f4f4f5';
  btnClose.onmouseout = () => btnClose.style.color = '#a1a1aa';
  btnClose.onclick = (e) => {
    e.stopPropagation();
    removeWarningBanner();
    _warningBannerDismissed = true;
  };
  header.appendChild(btnClose);
  _warningBanner.appendChild(header);

  // Description text
  const textSpan = document.createElement("div");
  textSpan.id = "capsule-warning-text";
  textSpan.style.cssText = `
    color: #e4e4e7;
    font-size: 12px;
  `;
  _warningBanner.appendChild(textSpan);

  // Button row
  const btnAction = document.createElement("button");
  btnAction.textContent = "Copy Handoff Prompt";
  btnAction.style.cssText = `
    background: #f59e0b;
    color: #000;
    border: none;
    padding: 6px 12px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 11px;
    font-weight: 600;
    transition: background 0.15s;
    width: 100%;
    text-align: center;
  `;
  btnAction.onmouseover = () => btnAction.style.background = '#d97706';
  btnAction.onmouseout = () => btnAction.style.background = '#f59e0b';
  btnAction.onclick = (e) => {
    e.stopPropagation();
    btnAction.disabled = true;
    btnAction.textContent = "Generating...";

    chrome.runtime.sendMessage({
      action: "callLLMFromBackground",
      systemPrompt: "Generate a structured handoff prompt for this conversation so another AI can continue it seamlessly. Output ONLY the handoff prompt text.",
      userPrompt: (_lastMessages || []).map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n\n')
    }, (resp) => {
      let promptText = "";
      if (resp?.ok && resp.result) {
        promptText = resp.result;
      } else {
        promptText = `[Handoff Prompt]\nRole: Senior Specialist\nPlatform: ${_platformName}\n\nContext:\n` +
          (_lastMessages || []).map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`).join('\n');
      }
      navigator.clipboard.writeText(promptText).then(() => {
        btnAction.textContent = "Copied!";
        btnAction.disabled = false;
        setTimeout(() => { btnAction.textContent = "Copy Handoff Prompt"; }, 2000);
      }).catch(() => {
        btnAction.textContent = "Error copying";
        btnAction.disabled = false;
      });
    });
  };
  _warningBanner.appendChild(btnAction);

  document.body.appendChild(_warningBanner);
  updateWarningBanner(tokens, limit, ratio);
}

function updateWarningBanner(tokens, limit, ratio) {
  const textSpan = document.getElementById("capsule-warning-text");
  if (!textSpan) return;
  const pct = Math.round(ratio * 100);
  textSpan.innerHTML = `Your conversation is using <strong>${pct}%</strong> of the context limit (~${formatTokens(tokens)} of ${formatLimit(limit)} tokens). You should copy a handoff prompt soon to avoid losing active state.`;
}

function removeWarningBanner() {
  if (typeof document === 'undefined') return;
  const banner = document.getElementById("capsule-warning-banner");
  if (banner) {
    banner.remove();
  }
  _warningBanner = null;
}

// ── Exports ───────────────────────────────────────────────────────────────────

const _exports = {
  CONTEXT_LIMITS,
  WARN_THRESHOLD,
  DANGER_THRESHOLD,
  estimateTokens,
  estimateContextUsage,
  formatTokens,
  formatLimit,
  checkContextAndShowWarning,
  removeWarningBanner
};

if (typeof self !== 'undefined')   Object.assign(self,   _exports);
if (typeof window !== 'undefined') Object.assign(window, _exports);

