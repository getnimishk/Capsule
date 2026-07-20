// injectors/perplexity.js
// Runs on https://www.perplexity.ai/*
// Capsule â€” Platform Support: Perplexity AI

const PENDING_INJECT_KEY = "pending_context_inject";

// â”€â”€ BLOCK A: Wait for Perplexity input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function waitForPerplexityInput(maxRetries = 60) {
  for (let i = 0; i < maxRetries; i++) {
    const el = findPerplexityInput();
    if (el) return el;
    await new Promise(r => setTimeout(r, 300));
  }
  return null;
}

function findPerplexityInput() {
  // 1. Primary: Textarea with any standard Perplexity placeholder or label
  const ta1 = document.querySelector('textarea[placeholder*="Ask" i], textarea[placeholder*="search" i], textarea[placeholder*="anything" i], textarea[aria-label*="Ask" i]');
  if (ta1 && ta1.offsetParent !== null) return ta1;

  // 2. Fallback: Any visible textarea
  for (const el of document.querySelectorAll("textarea")) {
    if (el.offsetParent !== null) return el;
  }

  // 3. Contenteditable fallback
  const ce = document.querySelector('div[contenteditable="true"], [role="textbox"], .ProseMirror');
  if (ce && ce.offsetParent !== null) return ce;

  return null;
}

// ── BLOCK B: Inject context + submit ──────────────────────────────────────────
function injectIntoPerplexity(el, context) {
  el.focus();
  if (el.tagName === "TEXTAREA") {
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    nativeSetter ? nativeSetter.call(el, context) : (el.value = context);
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    document.execCommand("selectAll", false, null);
    document.execCommand("delete", false, null);
    document.execCommand("insertText", false, context);
    el.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

async function submitPerplexityInput() {
  for (let i = 0; i < 20; i++) {
    const btn = document.querySelector(
      'button[aria-label*="Submit" i]:not([disabled]),' +
      'button[data-testid*="submit" i]:not([disabled]),' +
      'button[type="submit"]:not([disabled])'
    );
    if (btn) { btn.click(); return true; }
    await new Promise(r => setTimeout(r, 200));
  }
  // Fallback: Enter key
  const inp = findPerplexityInput();
  if (inp) {
    inp.focus();
    inp.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Enter", code: "Enter", keyCode: 13,
      bubbles: true, cancelable: true, composed: true,
    }));
    return true;
  }
  return false;
}

// â”€â”€ BLOCK C: Pending context injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function tryInjectContext() {
  let pending;
  try {
    const result = await chrome.storage.local.get([PENDING_INJECT_KEY]);
    pending = result[PENDING_INJECT_KEY];
  } catch (e) { return; }

  if (!pending || pending.target !== "perplexity" || Date.now() - pending.ts > 300000) return;

  const input = await waitForPerplexityInput(10);
  if (input) {
    try { await chrome.storage.local.remove([PENDING_INJECT_KEY]); } catch (_) {}
    injectIntoPerplexity(input, pending.context);
    showBanner("\u2713 Context injected \u2014 review and send!");
    return;
  }

  showPendingContextBanner(pending, async () => {
    const el = await waitForPerplexityInput(5);
    if (el) {
      injectIntoPerplexity(el, pending.context);
      return true;
    }
    return false;
  });

  let attempts = 0;
  const pollTimer = setInterval(async () => {
    attempts++;
    const el = findPerplexityInput();
    if (el && el.offsetParent !== null) {
      clearInterval(pollTimer);
      document.getElementById("cc-pending-banner")?.remove();
      try { await chrome.storage.local.remove([PENDING_INJECT_KEY]); } catch (_) {}
      injectIntoPerplexity(el, pending.context);
      showBanner("\u2713 Context injected \u2014 review and send!");
    } else if (attempts >= 90) {
      clearInterval(pollTimer);
    }
  }, 1000);
}

// â”€â”€ BLOCK D: Scrape conversation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function scrapeCurrentConversation() {
  const messages = [];
  const now = new Date().toISOString();

  // Primary: user messages
  const userEls = document.querySelectorAll('[data-testid="user-message"], [class*="UserMessage"]');
  // Primary: AI messages
  const aiEls   = document.querySelectorAll('[class*="AnswerBody"], .prose, [class*="answer-content"]');

  if (userEls.length > 0 || aiEls.length > 0) {
    const all = [
      ...[...userEls].map(el => ({ el, type: "user" })),
      ...[...aiEls].map(el  => ({ el, type: "assistant" })),
    ].sort((a, b) =>
      a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
    );
    for (const { el, type } of all) {
      let text;
      if (type === "assistant") {
        const clone = el.cloneNode(true);
        clone.querySelectorAll("button, svg, [aria-hidden], .citation").forEach(n => n.remove());
        text = clone.innerText?.trim();
      } else {
        text = el.innerText?.trim();
      }
      if (text) messages.push({ type, content: text, format: "text", timestamp: now });
    }
    if (messages.length) return messages;
  }

  // Fallback: search results containers
  document.querySelectorAll(".my-auto, [role='listitem'], article").forEach(el => {
    const text = el.innerText?.trim();
    if (text && text.length > 10) messages.push({ type: "unknown", content: text, timestamp: now });
  });
  return messages;
}

// â”€â”€ BLOCK E: UI helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showBanner(msg, isError = false) {
  document.getElementById("cc-banner")?.remove();
  const b = document.createElement("div");
  b.id = "cc-banner";
  Object.assign(b.style, {
    position: "fixed", top: "16px", left: "50%",
    transform: "translateX(-50%) translateY(-8px)",
    background: "#18181b", color: "#fafafa",
    fontFamily: "system-ui, sans-serif", fontSize: "13px", fontWeight: "500",
    padding: "10px 20px", borderRadius: "999px",
    border: `1px solid ${isError ? "#f43f5e" : "#3f3f46"}`,
    boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
    zIndex: "2147483647", display: "flex", alignItems: "center", gap: "8px",
    opacity: "0", transition: "opacity 0.2s, transform 0.2s", whiteSpace: "nowrap",
  });
  b.innerHTML = isError
    ? `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>${msg}`
    : `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>${msg}`;
  document.body.appendChild(b);
  requestAnimationFrame(() => { b.style.opacity = "1"; b.style.transform = "translateX(-50%) translateY(0)"; });
  setTimeout(() => { b.style.opacity = "0"; setTimeout(() => b.remove(), 300); }, 3500);
}

function downloadCurrentChat() {
  const messages = scrapeCurrentConversation();
  if (!messages.length) { showBanner("No conversation found to download.", true); return; }
  const title = messages.find(m => m.type === "user")?.content?.slice(0, 60) || "conversation";
  const data = {
    id: `scraped_${Date.now()}`, title, url: window.location.href,
    messages, savedAt: new Date().toISOString(), source: "perplexity", version: 1,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^\w\d]+/g, "_").slice(0, 50)}.json`;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function copyCurrentChat() {
  const messages = scrapeCurrentConversation();
  if (!messages.length) { showBanner("No conversation found to copy.", true); return; }
  const title = messages.find(m => m.type === "user")?.content?.slice(0, 60) || "conversation";
  const lines = [
    `[Perplexity conversation: "${title}"]`,
    `[Copied: ${new Date().toLocaleString()}]`, "",
  ];
  for (const msg of messages) {
    lines.push(`${msg.type === "user" ? "User" : "Perplexity"}: ${msg.content}`, "");
  }
  navigator.clipboard.writeText(lines.join("\n")).then(
    () => showBanner("Conversation copied to clipboard"),
    () => showBanner("Copy failed â€” try again.", true)
  );
}

function sendFromThisPage(target) {
  const messages = scrapeCurrentConversation();
  if (!messages.length) { showBanner("No conversation found on this page.", true); return; }
  const title = messages.find(m => m.type === "user")?.content?.slice(0, 60) || "Untitled";
  const lines = [
    `[Context from Perplexity conversation: "${title}"]`,
    `[Scraped: ${new Date().toLocaleString()}]`, "",
  ];
  for (const msg of messages) {
    lines.push(`${msg.type === "user" ? "User" : "Perplexity"}: ${msg.content}`, "");
  }
  lines.push("---", "I'm continuing this conversation. What are your thoughts?");
  const context = lines.join("\n");
  const AI_URLS = {
    claude:   "https://claude.ai/new",
    gemini:   "https://gemini.google.com/app",
    chatgpt:  "https://chatgpt.com/",
    deepseek: "https://chat.deepseek.com/",
    grok:       "https://grok.com/",
    mistral:  "https://chat.mistral.ai/chat",
    kimi:     "https://kimi.ai/",
  };
  try {
    chrome.storage.local.set({ [PENDING_INJECT_KEY]: { target, context, ts: Date.now() } }); window.open(AI_URLS[target], "_blank");
  } catch (e) { window.open(AI_URLS[target], "_blank"); }
}

// â”€â”€ CC_AI_OPTIONS (all except perplexity) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CC_AI_OPTIONS = [
  { id: "claude",   label: "Claude",   color: "#d97706", bg: "rgba(217,119,6,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M14.5 2C11 2 8.5 4.5 8.5 7.5c0 1.5.5 2.8 1.4 3.8L4 17.5l1.5 1.5 5.9-6.2c1 .9 2.3 1.4 3.6 1.4C18 14.2 20.5 11.7 20.5 8.5S18 2 14.5 2zm0 2c2.2 0 4 1.8 4 4s-1.8 4-4 4-4-1.8-4-4 1.8-4 4-4z" fill="#d97706"/></svg>` },
  { id: "gemini",   label: "Gemini",   color: "#4285F4", bg: "rgba(66,133,244,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2C9.5 7.5 6.5 9.5 2 12c4.5 2.5 7.5 4.5 10 10 2.5-5.5 5.5-7.5 10-10-4.5-2.5-7.5-4.5-10-10z" fill="#4285F4"/></svg>` },
  { id: "chatgpt",  label: "ChatGPT",  color: "#10a37f", bg: "rgba(16,163,127,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#10a37f"><circle cx="12" cy="12" r="10"/><path d="M8 12h8M12 8v8" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>` },
  { id: "deepseek", label: "DeepSeek", color: "#1A6BFF", bg: "rgba(26,107,255,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1A6BFF"/><circle cx="12" cy="12" r="5" fill="white"/><circle cx="12" cy="12" r="2.5" fill="#1A6BFF"/></svg>` },
  { id: "grok",     label: "Grok",     color: "#1DA1F2", bg: "rgba(29,161,242,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>` },
  { id: "mistral",  label: "Mistral",  color: "#FF7000", bg: "rgba(255,112,0,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#FF7000"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9.5" y="2" width="5" height="5" rx="1"/><rect x="17" y="2" width="5" height="5" rx="1"/><rect x="2" y="9.5" width="5" height="5" rx="1"/><rect x="17" y="9.5" width="5" height="5" rx="1"/><rect x="2" y="17" width="5" height="5" rx="1"/><rect x="9.5" y="17" width="5" height="5" rx="1"/><rect x="17" y="17" width="5" height="5" rx="1"/></svg>` },
  { id: "kimi",     label: "Kimi",     color: "#60A5FA", bg: "rgba(96,165,250,0.12)",
    svg: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#1D4ED8"/><path d="M8 16V8l4 4 4-4v8" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>` },
];

// â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ensureStyles() {
  if (document.getElementById("cc-styles")) return;
  const s = document.createElement("style");
  s.id = "cc-styles";
  s.textContent = `
    #cc-ask-ai-btn {
      display: inline-flex !important; align-items: center !important; gap: 5px !important;
      padding: 0 10px !important; height: 32px !important;
      background: #18181b !important;
      color: #ffffff !important;
      border: 1px solid rgba(255,255,255,0.25) !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important; border: 1px solid rgba(255,255,255,0.15) !important;
      border-radius: 8px !important; color: rgba(255,255,255,0.65) !important;
      cursor: pointer !important; font-family: system-ui, sans-serif !important;
      font-size: 12px !important; font-weight: 600 !important;
      transition: background 0.15s, border-color 0.15s, color 0.15s !important;
      flex-shrink: 0 !important; white-space: nowrap !important;
      outline: none !important; box-shadow: none !important;
    }
    #cc-ask-ai-btn:hover { background: rgba(255,255,255,0.07) !important; border-color: rgba(255,255,255,0.3) !important; color: rgba(255,255,255,0.9) !important; }
    #cc-ask-ai-btn.cc-active { background: rgba(255,255,255,0.1) !important; border-color: rgba(255,255,255,0.35) !important; }
    #cc-ask-ai-panel {
      position: fixed !important; background: #18181b !important;
      border: 1px solid rgba(255,255,255,0.1) !important; border-radius: 14px !important;
      padding: 8px !important; box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
      z-index: 2147483647 !important; display: none !important;
      flex-direction: column !important; gap: 3px !important;
      min-width: 210px !important; font-family: system-ui, sans-serif !important;
    }
    #cc-ask-ai-panel.cc-open { display: flex !important; animation: cc-pop 0.16s cubic-bezier(0.16,1,0.3,1) !important; }
    @keyframes cc-pop { from { opacity:0; transform:translateY(6px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
    .cc-panel-hdr { font-size: 10px !important; font-weight: 700 !important; color: rgba(255,255,255,0.35) !important; text-transform: uppercase !important; letter-spacing: 0.8px !important; padding: 3px 8px 8px !important; border-bottom: 1px solid rgba(255,255,255,0.07) !important; margin-bottom: 2px !important; }
    .cc-ai-opt { display: flex !important; align-items: center !important; gap: 10px !important; width: 100% !important; padding: 8px 10px !important; background: #18181b !important;
      color: #ffffff !important;
      border: 1px solid rgba(255,255,255,0.25) !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important; border: none !important; border-radius: 8px !important; cursor: pointer !important; font-family: system-ui, sans-serif !important; transition: background 0.12s, transform 0.1s !important; text-align: left !important; }
    .cc-ai-opt:hover { background: rgba(255,255,255,0.06) !important; transform: translateX(2px) !important; }
    .cc-ai-opt:active { transform: scale(0.97) !important; }
    .cc-ai-ico { width: 28px !important; height: 28px !important; border-radius: 8px !important; display: flex !important; align-items: center !important; justify-content: center !important; flex-shrink: 0 !important; }
    .cc-ai-lbl { font-size: 13px !important; font-weight: 600 !important; color: rgba(255,255,255,0.9) !important; display:block !important; }
    .cc-ai-sub { font-size: 10px !important; color: rgba(255,255,255,0.4) !important; display:block !important; margin-top:1px !important; }
    .cc-arr { margin-left: auto !important; color: rgba(255,255,255,0.35) !important; flex-shrink: 0 !important; }
    .cc-divider { height: 1px !important; background: rgba(255,255,255,0.07) !important; margin: 3px 0 !important; }
    .cc-action-row { display: flex !important; gap: 4px !important; padding: 2px !important; }
    .cc-action-btn { flex: 1 !important; display: flex !important; align-items: center !important; justify-content: center !important; gap: 6px !important; padding: 7px 10px !important; background: #18181b !important;
      color: #ffffff !important;
      border: 1px solid rgba(255,255,255,0.25) !important;
      border-radius: 16px !important;
      box-shadow: 0 4px 14px rgba(0,0,0,0.35) !important; border: 1px solid rgba(255,255,255,0.08) !important; border-radius: 8px !important; color: rgba(255,255,255,0.55) !important; cursor: pointer !important; font-family: system-ui, sans-serif !important; font-size: 11px !important; font-weight: 500 !important; transition: background 0.12s, color 0.12s !important; white-space: nowrap !important; }
    .cc-action-btn:hover { background: rgba(255,255,255,0.07) !important; color: rgba(255,255,255,0.9) !important; }
    .cc-action-btn:active { opacity: 0.75 !important; }
  `;
  document.head.appendChild(s);
}

let _panel = null;
let _panelOpen = false;

function buildPanel() {
  const panel = document.createElement("div");
  panel.id = "cc-ask-ai-panel";
  const hdr = document.createElement("div");
  hdr.className = "cc-panel-hdr";
  hdr.style.display = "flex";
  hdr.style.alignItems = "center";
  hdr.style.justifyContent = "space-between";
  hdr.innerHTML = 
    <span>Send context to</span>
    <button class="cc-close-panel-btn" type="button" title="Close panel" style="background:none;border:none;color:rgba(255,255,255,0.4);cursor:pointer;font-size:14px;padding:0 4px;line-height:1;transition:color 0.15s;">&#x2715;</button>
  ;
  hdr.querySelector(".cc-close-panel-btn").addEventListener("click", (e) => {
    e.stopPropagation();
    closePanel();
  });
  panel.appendChild(hdr);
  for (const ai of CC_AI_OPTIONS) {
    const opt = document.createElement("button");
    opt.className = "cc-ai-opt";
    opt.type = "button";
    opt.innerHTML = `
      <span class="cc-ai-ico" style="background:${ai.bg}">${ai.svg}</span>
      <span>
        <span class="cc-ai-lbl">${ai.label}</span>
        <span class="cc-ai-sub">Open &amp; inject context</span>
      </span>
      <svg class="cc-arr" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
      </svg>
    `;
    opt.addEventListener("mousedown", (e) => { e.preventDefault(); closePanel(); sendFromThisPage(ai.id); });
    panel.appendChild(opt);
  }
  const divider = document.createElement("div");
  divider.className = "cc-divider";
  panel.appendChild(divider);
  const actionRow = document.createElement("div");
  actionRow.className = "cc-action-row";
  const copyBtn = document.createElement("button");
  copyBtn.className = "cc-action-btn"; copyBtn.type = "button"; copyBtn.title = "Copy";
  copyBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy`;
  copyBtn.addEventListener("mousedown", (e) => { e.preventDefault(); closePanel(); copyCurrentChat(); });
  const dlBtn = document.createElement("button");
  dlBtn.className = "cc-action-btn"; dlBtn.type = "button"; dlBtn.title = "Download";
  dlBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/></svg>Download`;
  dlBtn.addEventListener("mousedown", (e) => { e.preventDefault(); closePanel(); downloadCurrentChat(); });
  actionRow.appendChild(copyBtn); actionRow.appendChild(dlBtn);
  panel.appendChild(actionRow);
  document.body.appendChild(panel);
  return panel;
}

function openPanel(btn) {
  if (!_panel) _panel = buildPanel();
  const r = btn.getBoundingClientRect();
  const panelH = 280;
  if (r.top > panelH + 10) {
    _panel.style.bottom = `${window.innerHeight - r.top + 8}px`;
    _panel.style.top = "auto";
  } else {
    _panel.style.top = `${r.bottom + 8}px`;
    _panel.style.bottom = "auto";
  }
  _panel.style.left = `${Math.min(r.left, window.innerWidth - 220)}px`;
  _panel.classList.add("cc-open");
  btn.classList.add("cc-active");
  _panelOpen = true;
}

function closePanel() {
  _panel?.classList.remove("cc-open");
  document.getElementById("cc-ask-ai-btn")?.classList.remove("cc-active");
  _panelOpen = false;
}

function createAskAIButton() {
  const btn = document.createElement("button");
  btn.id = "cc-ask-ai-btn";
  btn.type = "button";
  btn.title = "Send this conversation to another AI";
  btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> Export`;
  btn.addEventListener("click", (e) => { e.stopPropagation(); _panelOpen ? closePanel() : openPanel(btn); });
  document.addEventListener("click", (e) => { if (_panelOpen && !_panel?.contains(e.target) && e.target !== btn) closePanel(); });
  return btn;
}

// â”€â”€ Slot finder + injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function findPerplexitySlot() {
  const ta = findPerplexityInput();
  if (ta) {
    const form = ta.closest("form");
    if (form) return form;
    if (ta.parentElement) return ta.parentElement;
  }

  let floatWrapper = document.getElementById("cc-floating-wrapper");
  if (!floatWrapper) {
    floatWrapper = document.createElement("div");
    floatWrapper.id = "cc-floating-wrapper";
    Object.assign(floatWrapper.style, {
      position: "fixed", bottom: "84px", right: "28px", zIndex: "2147483647",
      display: "flex", alignItems: "center", gap: "8px"
    });
    document.body.appendChild(floatWrapper);
  }
  return floatWrapper;
}

function injectPerplexityButton() {
  if (document.getElementById("cc-ask-ai-btn")) return;
  ensureStyles();
  const slot = findPerplexitySlot();
  if (!slot) return;
  const btn = createAskAIButton();
  btn.style.position = "absolute";
  btn.style.top = "8px";
  btn.style.right = "50px";
  btn.style.zIndex = "99999";
  if (getComputedStyle(slot).position === "static") slot.style.position = "relative";
  slot.appendChild(btn);
}

// â”€â”€ MutationObserver â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _observer = null;
function watchForButtonRemoval() {
  if (_observer) return;
  _observer = new MutationObserver(() => {
    if (!document.getElementById("cc-ask-ai-btn")) setTimeout(injectPerplexityButton, 300);
  });
  _observer.observe(document.body, { childList: true, subtree: true });
}

let _injectAttempts = 0;
function retryInjectButton() {
  if (document.getElementById("cc-ask-ai-btn")) { watchForButtonRemoval(); return; }
  // continuous retry fallback
  injectPerplexityButton();
  if (!document.getElementById("cc-ask-ai-btn")) setTimeout(retryInjectButton, 500);
  else watchForButtonRemoval();
}

// â”€â”€ Auto-save â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CC_STORAGE_KEY = "cc_all_conversations";

function saveMessagesToStorage(messages) {
  if (!messages.length) return Promise.resolve({ ok: false });

  // Auto-Handoff Trigger warning banner check
  if (typeof checkContextAndShowWarning === 'function') {
    checkContextAndShowWarning(messages, "perplexity");
  }

  const title = messages.find(m => m.type === "user")?.content?.slice(0, 60) || "Perplexity conversation";
  const convId = `perplexity_${window.location.href}`;
  return new Promise(async (resolve) => {
    let fingerprint = null;
    try {
      const seed = messages.filter(m => m.type === "user").slice(0, 3).map(m => m.content.slice(0, 100)).join("|");
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
      fingerprint = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
    } catch (_) {}
    const entry = { id: convId, title, url: window.location.href, messages, fingerprint, savedAt: new Date().toISOString(), source: "perplexity", version: 1 };
    chrome.runtime.sendMessage({ action: 'saveConversation', conversation: entry }, response => {
      if (chrome.runtime.lastError) resolve({ ok: false, error: chrome.runtime.lastError.message });
      else resolve(response || { ok: false, error: 'Unable to save conversation.' });
    });
  });
}

function scrapeAndSave() {
  const messages = scrapeCurrentConversation();
  return saveMessagesToStorage(messages);
}

function parsePerplexityApiConversation(data) {
  const list = data.messages || [];
  if (!Array.isArray(list)) return [];
  const messages = [];
  list.forEach(m => {
    const role = m.role;
    const text = m.content;
    if (role && text) {
      messages.push({
        type: role === "user" ? "user" : "assistant",
        content: text.trim(),
        format: "text",
        timestamp: m.created_at || new Date().toISOString()
      });
    }
  });
  return messages;
}



// Listen for intercepted API response events from MAIN world
window.addEventListener("message", (e) => {
  if (e.data && e.data.type === "Capsule_API_CAPTURE") {
    if (e.data.url.includes("api/thread/")) {
      const messages = parsePerplexityApiConversation(e.data.data);
      if (messages.length) {
        saveMessagesToStorage(messages);
      }
    }
  }
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.action === "scrapeNow") {
    Promise.resolve()
      .then(() => scrapeAndSave())
      .then(res => sendResponse(res))
      .catch(err => sendResponse({ ok: false, error: err.message }));
    return true;
  }
});

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function init() {
  tryInjectContext();
  retryInjectButton();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
else init();





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

  const firstLine = (pending.context || "").split("\n")[0].replace(/^[\[\s]*/, '') || "Context";

  b.innerHTML = `
    <span style="color:#60a5fa;display:flex;align-items:center;gap:4px;font-weight:600;">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
      Capsule Context
    </span>
    <span style="color:#a1a1aa;max-width:160px;overflow:hidden;text-overflow:ellipsis;">"\"</span>
    <button id="cc-btn-do-inject" style="background:#2563eb;color:#fff;border:none;padding:5px 12px;border-radius:14px;font-size:12px;font-weight:600;cursor:pointer;">Inject Now</button>
    <button id="cc-btn-do-copy" style="background:#27272a;color:#d4d4d8;border:1px solid #3f3f46;padding:5px 12px;border-radius:14px;font-size:12px;font-weight:600;cursor:pointer;">Copy</button>
    <button id="cc-btn-dismiss" style="background:none;border:none;color:#71717a;cursor:pointer;font-size:14px;padding:0 4px;">&#x2715;</button>
  `;

  document.body.appendChild(b);

  b.querySelector("#cc-btn-do-inject").addEventListener("click", async () => {
    const injected = await onInject();
    if (injected) {
      try { await chrome.storage.local.remove([PENDING_INJECT_KEY]); } catch (_) {}
      b.remove();
    } else {
      showBanner("Input field not visible. Please log in or close popups first.", true);
    }
  });

  b.querySelector("#cc-btn-do-copy").addEventListener("click", () => {
    navigator.clipboard.writeText(pending.context);
    try { chrome.storage.local.remove([PENDING_INJECT_KEY]); } catch (_) {}
    b.remove();
    showBanner("Copied context to clipboard!");
  });

  b.querySelector("#cc-btn-dismiss").addEventListener("click", () => {
    try { chrome.storage.local.remove([PENDING_INJECT_KEY]); } catch (_) {}
    b.remove();
  });
}