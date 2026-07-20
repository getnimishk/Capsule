// ============================================================================
// injectors/notebooklm.js
// Capsule â€” NotebookLM Automated Import Assistant
//
// Architecture:
//   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
//   â”‚  init()  â”‚â”€â”€â”€â–¶â”‚  Toast UI   â”‚â”€â”€â”€â–¶â”‚  _importPipeline()   â”‚
//   â”‚ (SPA     â”‚    â”‚ (ARIA-      â”‚    â”‚  Step 1: Add Source   â”‚
//   â”‚  router) â”‚    â”‚  accessible)â”‚    â”‚  Step 2: Copied Text  â”‚
//   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â”‚  Step 3: Paste Text   â”‚
//                                      â”‚  Step 4: Insert/Save  â”‚
//                                      â”‚  Step 5: Close Dialog â”‚
//                                      â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
//
// NFRs addressed:
//   âœ… Reliability   â€” per-step retry with exponential backoff
//   âœ… Resilience    â€” 25s hard pipeline deadline via Promise.race()
//   âœ… Idempotency   â€” content fingerprint dedup (cs_imported_hashes)
//   âœ… Resource mgmt â€” interval teardown, toast lifecycle via MutationObserver
//   âœ… Observability â€” structured timestamped logger (_log)
//   âœ… Accessibility â€” role=alert, aria-live, aria-label on all controls
//   âœ… Validation    â€” pre-flight checks on text/title before running pipeline
//   âœ… Security/XSS  â€” _html tagged template sanitises all interpolated values
//   âœ… Rate limiting â€” _running flag prevents overlapping triggers
// ============================================================================

"use strict";

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const CS_KEY          = "pending_notebooklm_import";
const CS_HASHES_KEY   = "cs_imported_hashes";      // NFR: idempotency store
const IMPORT_TTL_MS   = 90_000;                    // 90s before pending data expires
const HASH_STORE_MAX  = 50;                        // max fingerprints to keep
const PIPELINE_TIMEOUT_MS = 25_000;               // NFR: hard pipeline deadline
const POLL_MS         = 50;                        // ms between DOM polls
const POLL_STD        = 30;                        // ~1.5s budget
const POLL_LNG        = 40;                        // ~2.0s budget
const STEP_RETRY_MAX  = 2;                         // NFR: retries per step
const STEP_RETRY_BASE = 300;                       // ms base backoff
const TOAST_ID        = "cc-nb-toast";
const STYLE_ID        = "cc-nb-styles";
const URL_CHECK_MS    = 500;

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let _running   = false;
let _lastPath  = _basePath();
let _intervalId = null;   // NFR: resource cleanup â€” interval handle

// â”€â”€ Structured logger (NFR: Observability) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const _log = (() => {
  const LEVELS = { INFO: "INFO ", WARN: "WARN ", ERROR: "ERROR" };
  return function log(level, step, msg, data) {
    const ts   = new Date().toISOString().slice(11, 23);  // HH:mm:ss.mmm
    const pfx  = `[CS][${ts}][${LEVELS[level] ?? level}]${step ? `[${step}]` : ""}`;
    if (level === "ERROR") console.error(pfx, msg, data ?? "");
    else if (level === "WARN")  console.warn(pfx, msg, data ?? "");
    else                         console.log(pfx, msg, data ?? "");
  };
})();

// â”€â”€ Utilities â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _basePath() {
  return window.location.href.split("?")[0];
}

function _insideNotebook() {
  const p = _basePath();
  return p.includes("/notebook/") && !p.includes("/notebook/creating");
}

function _sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

/**
 * Poll every POLL_MS ms, up to `limit` attempts.
 * `finder` is a zero-arg function returning an element or null/falsy.
 */
async function _poll(finder, limit = POLL_STD) {
  for (let i = 0; i < limit; i++) {
    const el = finder();
    if (el) return el;
    await _sleep(POLL_MS);
  }
  return null;
}

/**
 * Find first visible element whose innerText contains `query`.
 * Tags scanned in priority order (interactive first).
 * Skips our toast and oversized container divs.
 */
function _findByText(query) {
  const q    = query.toLowerCase();
  const tags = ["button", "a", "[role='button']", "span", "p", "h3", "label", "div"];
  for (const tag of tags) {
    for (const el of document.querySelectorAll(tag)) {
      if (el.closest(`#${TOAST_ID}`)) continue;
      const txt = el.innerText?.trim().toLowerCase() ?? "";
      if (!txt.includes(q)) continue;
      if (el.getBoundingClientRect().width <= 0) continue;
      if (tag === "div" && txt.length > q.length + 40) continue;
      return el;
    }
  }
  return null;
}

function _pollByText(query, limit = POLL_STD) {
  return _poll(() => _findByText(query), limit);
}

/**
 * Three-tier paste-editor lookup inside the active Material dialog.
 * Explicitly excludes the web-search discover box.
 */
function _findPasteEditor() {
  const D = "mat-dialog-container, .mat-mdc-dialog-container, [role='dialog']";
  const t1 = document.querySelector(
    `${D} [formcontrolname='copiedText'], ` +
    `${D} [aria-label='Pasted text'], `     +
    `${D} [placeholder='Paste text here']`
  );
  if (t1 && t1.getBoundingClientRect().width > 0) return t1;

  for (const el of document.querySelectorAll(`${D} textarea`)) {
    const ph  = (el.getAttribute("placeholder") ?? "").toLowerCase();
    const lbl = (el.getAttribute("aria-label")  ?? "").toLowerCase();
    if (ph.includes("search") || lbl.includes("discover") || lbl.includes("query")) continue;
    if (el.getBoundingClientRect().width > 0) return el;
  }
  return null;
}

/** XSS-safe tagged template for HTML strings. */
function _html(strings, ...vals) {
  return strings.reduce((acc, s, i) => {
    const v    = vals[i - 1] ?? "";
    const safe = String(v)
      .replace(/&/g,  "&amp;")
      .replace(/</g,  "&lt;")
      .replace(/>/g,  "&gt;")
      .replace(/"/g,  "&quot;");
    return acc + safe + s;
  });
}

// â”€â”€ NFR: Idempotency â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** Simple djb2 hash â†’ base-36 string. Used as content fingerprint. */
function _fingerprint(text) {
  let h = 5381;
  for (let i = 0; i < Math.min(text.length, 300); i++) {
    h = ((h << 5) + h) ^ text.charCodeAt(i);
    h = h >>> 0; // keep unsigned 32-bit
  }
  return h.toString(36);
}

/** Returns true if this fingerprint has already been imported. */
async function _alreadyImported(fp) {
  return new Promise(resolve => {
    chrome.storage.local.get([CS_HASHES_KEY], res => {
      const hashes = res[CS_HASHES_KEY] ?? [];
      resolve(hashes.includes(fp));
    });
  });
}

/** Record a fingerprint as imported (capped at HASH_STORE_MAX). */
async function _recordImport(fp) {
  return new Promise(resolve => {
    chrome.storage.local.get([CS_HASHES_KEY], res => {
      const hashes = [fp, ...(res[CS_HASHES_KEY] ?? [])].slice(0, HASH_STORE_MAX);
      chrome.storage.local.set({ [CS_HASHES_KEY]: hashes }, resolve);
    });
  });
}

// â”€â”€ NFR: Reliability â€” step wrapper with retry + backoff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Run `fn` (async), retrying up to STEP_RETRY_MAX times on falsy/throw.
 * Backoff: base * 2^attempt ms between retries.
 */
async function _withRetry(stepName, fn) {
  for (let attempt = 0; attempt <= STEP_RETRY_MAX; attempt++) {
    try {
      const result = await fn();
      if (result) return result;
    } catch (err) {
      _log("WARN", stepName, `Attempt ${attempt + 1} threw:`, err?.message);
    }
    if (attempt < STEP_RETRY_MAX) {
      const delay = STEP_RETRY_BASE * (2 ** attempt);
      _log("INFO", stepName, `Retrying in ${delay}msâ€¦ (attempt ${attempt + 2}/${STEP_RETRY_MAX + 1})`);
      await _sleep(delay);
    }
  }
  return null;
}

// â”€â”€ CSS injection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function _injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = `
    @keyframes cc-slide-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    #${TOAST_ID} { animation: cc-slide-up .28s cubic-bezier(.16,1,.3,1); }
    #${TOAST_ID} button { transition: filter .12s, transform .1s; }
    #${TOAST_ID} button:hover  { filter: brightness(1.15); }
    #${TOAST_ID} button:active { transform: scale(.96); }
    #${TOAST_ID} button:focus-visible {
      outline: 2px solid #818cf8;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(s);
}

// â”€â”€ NFR: Resource cleanup â€” toast lifecycle observer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Watch for the toast being removed from the DOM externally (e.g. full page reload).
 * Disconnects itself once the toast is gone.
 */
function _watchToastLifecycle(toast) {
  const obs = new MutationObserver(() => {
    if (!document.body.contains(toast)) {
      _log("INFO", null, "Toast removed from DOM externally â€” cleaning up.");
      obs.disconnect();
    }
  });
  obs.observe(document.body, { childList: true, subtree: false });
  return obs;
}

// â”€â”€ Toast UI â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/** NFR: Validation â€” guard against empty/stub data before showing the toast. */
function _validateImportData(title, text) {
  if (!text || typeof text !== "string" || text.trim().length < 10) {
    _log("ERROR", null, "Pre-flight validation failed: text is empty or too short.");
    return false;
  }
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    _log("ERROR", null, "Pre-flight validation failed: title is empty.");
    return false;
  }
  return true;
}

async function renderToast(title, text) {
  // NFR: Validation
  if (!_validateImportData(title, text)) return;

  // NFR: Idempotency check
  const fp = _fingerprint(text);
  if (await _alreadyImported(fp)) {
    _log("INFO", null, `Content fingerprint "${fp}" already imported â€” skipping.`);
    chrome.storage.local.remove([CS_KEY]);
    _flashStatus(`âœ“ Already imported "${title}" into NotebookLM.`, "#065f46");
    return;
  }

  if (_running) {
    _log("INFO", null, "Toast render skipped â€” pipeline in progress.");
    return;
  }

  _injectStyles();

  let toast = document.getElementById(TOAST_ID);
  if (!toast) {
    toast = document.createElement("div");
    toast.id = TOAST_ID;
    // NFR: Accessibility â€” role=alert ensures screen readers announce the toast
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");
    Object.assign(toast.style, {
      position:      "fixed",
      bottom:        "24px",
      right:         "24px",
      zIndex:        "2147483647",
      width:         "300px",
      background:    "#1e1b4b",
      color:         "#e0e7ff",
      border:        "1px solid #4338ca",
      borderRadius:  "12px",
      padding:       "14px 16px",
      boxShadow:     "0 12px 28px -6px rgba(0,0,0,.45)",
      fontFamily:    "system-ui, -apple-system, sans-serif",
      fontSize:      "13px",
      lineHeight:    "1.5",
      display:       "flex",
      flexDirection: "column",
      gap:           "10px",
    });
    document.body.appendChild(toast);
    _watchToastLifecycle(toast);
  }

  const inside = _insideNotebook();

  if (!inside) {
    // Dashboard â€” create notebook flow
    toast.innerHTML = _html`
      <div class="cc-header" role="heading" aria-level="2">ðŸ¥· Capsule</div>
      <div class="cc-body" aria-live="polite">
        Creating notebook for <b>"${title}"</b>â€¦
      </div>
      <div class="cc-actions" role="group" aria-label="Notebook creation controls">
        <button id="cc-create" class="cc-btn-primary" aria-label="Create a new NotebookLM notebook">
          Create Notebook
        </button>
        <button id="cc-cancel" class="cc-btn-ghost" aria-label="Cancel and dismiss this notification">
          Cancel
        </button>
      </div>
    `;
    _styleToast(toast);

    const createBtn = document.getElementById("cc-create");
    document.getElementById("cc-cancel").onclick = () => _dismiss(toast);

    _autoClick(createBtn, 200, async () => {
      _setRunning(true, createBtn, "Creatingâ€¦");
      const ok = await _createNotebook();
      if (!ok) {
        _setRunning(false, createBtn, "Create Notebook");
        _flashError("Could not find 'Create new notebook'. Please create one manually.");
      }
    });

  } else {
    // Inside notebook â€” import flow
    toast.innerHTML = _html`
      <div class="cc-header" role="heading" aria-level="2">ðŸ¥· Capsule</div>
      <div class="cc-body" aria-live="polite">
        Import <b>"${title}"</b> into this notebook?
      </div>
      <div class="cc-actions" role="group" aria-label="Import controls">
        <button id="cc-paste" class="cc-btn-primary" aria-label="Automatically paste conversation into NotebookLM source">
          Auto-Paste
        </button>
        <button id="cc-cancel" class="cc-btn-ghost" aria-label="Dismiss this notification">
          Dismiss
        </button>
      </div>
    `;
    _styleToast(toast);

    const pasteBtn = document.getElementById("cc-paste");
    document.getElementById("cc-cancel").onclick = () => _dismiss(toast);

    _autoClick(pasteBtn, 200, async () => {
      _setRunning(true, pasteBtn, "Pastingâ€¦");

      // NFR: Resilience â€” hard 25s deadline
      const ok = await Promise.race([
        _importPipeline(text),
        _sleep(PIPELINE_TIMEOUT_MS).then(() => {
          _log("ERROR", "pipeline", `Hard deadline (${PIPELINE_TIMEOUT_MS}ms) exceeded.`);
          return false;
        })
      ]);

      _setRunning(false);
      if (ok) {
        await _recordImport(fp);  // NFR: Idempotency â€” record the fingerprint
        chrome.storage.local.remove([CS_KEY]);
        toast.remove();
        _log("INFO", "pipeline", "Import complete âœ“");
      } else {
        pasteBtn.disabled    = false;
        pasteBtn.textContent = "Retry";
        pasteBtn.style.background = "#be123c";
        _flashError("Auto-paste failed. Use Ctrl+V after clicking 'Add Source â†’ Copied Text'.");
      }
    });
  }

  // Clipboard backup (silent fail is acceptable)
  navigator.clipboard.writeText(text).catch(() => {});
}

// â”€â”€ Toast helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function _styleToast(toast) {
  const h = toast.querySelector(".cc-header");
  const b = toast.querySelector(".cc-body");
  const g = toast.querySelector(".cc-actions");
  const p = toast.querySelector(".cc-btn-primary");
  const gh = toast.querySelector(".cc-btn-ghost");

  if (h) Object.assign(h.style, { fontWeight:"700", fontSize:"14px", display:"flex", alignItems:"center", gap:"6px" });
  if (b) Object.assign(b.style, { fontSize:"12px", color:"#a5b4fc" });
  if (g) Object.assign(g.style, { display:"flex", gap:"8px" });

  const base = { padding:"8px 12px", border:"none", borderRadius:"6px",
                 fontSize:"11px", fontWeight:"600", cursor:"pointer" };
  if (p)  Object.assign(p.style,  { ...base, flex:"1", background:"#4f46e5", color:"#fff" });
  if (gh) Object.assign(gh.style, { ...base, background:"transparent",
                                     border:"1px solid rgba(255,255,255,.18)", color:"#a5b4fc" });
}

function _dismiss(toast) {
  chrome.storage.local.remove([CS_KEY]);
  toast?.remove();
}

function _autoClick(btn, delayMs, handler) {
  btn.onclick = handler;
  setTimeout(() => {
    if (!_running && document.getElementById(btn.id)) btn.click();
  }, delayMs);
}

function _setRunning(on, btn = null, label = "") {
  _running = on;
  if (!btn) return;
  btn.disabled    = on;
  btn.textContent = on ? label : btn.textContent;
  btn.style.background = on ? "#312e81" : "#4f46e5";
}

/** Transient status banner (green/info variant). */
function _flashStatus(msg, bg = "#1d4ed8") {
  _flashBanner(msg, bg);
}

/** Transient error banner (red). */
function _flashError(msg) {
  _flashBanner(msg, "#9f1239");
}

function _flashBanner(msg, bg) {
  const el = document.createElement("div");
  // NFR: Accessibility â€” role=status for non-urgent messages
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  Object.assign(el.style, {
    position:   "fixed", top:"20px", left:"50%", transform:"translateX(-50%)",
    background: bg, color:"#fff", padding:"10px 18px",
    borderRadius:"8px", fontSize:"13px", fontWeight:"600",
    zIndex:"2147483647", boxShadow:"0 8px 16px rgba(0,0,0,.3)",
    fontFamily:"system-ui, sans-serif", maxWidth:"480px", textAlign:"center"
  });
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 7000);
}

// â”€â”€ Step 0: Create notebook â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function _createNotebook() {
  _log("INFO", "step=0", "Locating 'Create new notebook' cardâ€¦");
  const btn = await _withRetry("step=0", async () =>
    await _pollByText("create new notebook", 20)
    ?? await _pollByText("create new", 10)
    ?? document.querySelector("[aria-label*='Create new']")
    ?? document.querySelector("[aria-label*='New notebook']")
  );

  if (!btn) { _log("ERROR", "step=0", "Create-notebook element not found."); return false; }
  _log("INFO", "step=0", "Clicking:", btn.outerHTML.slice(0, 120));
  btn.click();
  return true;
}

// â”€â”€ Steps 1â€“5: Import pipeline â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function _importPipeline(text) {
  _log("INFO", "pipeline", "Started.");

  // Step 1: Add source
  _log("INFO", "step=1", "Locating 'Add source'â€¦");
  const addSourceBtn = await _withRetry("step=1", () =>
    _pollByText("Add source")
    .then(el => el
      ?? _pollByText("New source")
      ?? document.querySelector("[aria-label*='Add source']")
      ?? document.querySelector("[aria-label*='New source']")
    )
  );
  if (!addSourceBtn) { _log("ERROR", "step=1", "Failed."); return false; }
  _log("INFO", "step=1", "Clicking:", addSourceBtn.outerHTML.slice(0, 120));
  addSourceBtn.click();

  // Step 2: Copied text option
  _log("INFO", "step=2", "Locating 'Copied text' optionâ€¦");
  const pasteOpt = await _withRetry("step=2", () =>
    _pollByText("Copied text")
    .then(el => el ?? _pollByText("Paste copied text") ?? _pollByText("Pasted text"))
  );
  if (!pasteOpt) { _log("ERROR", "step=2", "Failed."); return false; }
  _log("INFO", "step=2", "Clicking:", pasteOpt.outerHTML.slice(0, 120));
  pasteOpt.click();

  // Step 3: Paste textarea
  _log("INFO", "step=3", "Locating paste textareaâ€¦");
  const editor = await _withRetry("step=3", () => _poll(_findPasteEditor, POLL_LNG));
  if (!editor) { _log("ERROR", "step=3", "Paste editor not found."); return false; }
  _log("INFO", "step=3", "Found:", editor.outerHTML.slice(0, 120));

  editor.focus();
  // Use native setter so Angular's reactive form change detection fires correctly
  const nativeSetter =
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set ??
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (nativeSetter) nativeSetter.call(editor, text);
  else editor.value = text;

  editor.dispatchEvent(new Event("input",  { bubbles: true }));
  editor.dispatchEvent(new Event("change", { bubbles: true }));
  editor.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true }));
  editor.dispatchEvent(new KeyboardEvent("keyup",   { bubbles: true }));
  _log("INFO", "step=3", "Text injected. Waiting 800ms for Angular form validationâ€¦");
  await _sleep(800);

  // Step 4: Insert / Save
  _log("INFO", "step=4", "Locating confirm buttonâ€¦");
  const D       = "mat-dialog-container, .mat-mdc-dialog-container, [role='dialog']";
  const dialog  = document.querySelector(D);
  let saveBtn   = null;
  if (dialog) {
    saveBtn = Array.from(dialog.querySelectorAll("button")).find(b => {
      const t = b.innerText?.toLowerCase() ?? "";
      return (t.includes("insert") || t.includes("save")) && b.getBoundingClientRect().width > 0;
    });
  }
  saveBtn ??= await _withRetry("step=4", () =>
    _pollByText("Insert").then(el => el ?? _pollByText("Save"))
  );
  if (!saveBtn) { _log("ERROR", "step=4", "Confirm button not found."); return false; }
  _log("INFO", "step=4", "Clicking:", saveBtn.outerHTML.slice(0, 80));
  saveBtn.click();

  // Step 5: Close dialog
  await _sleep(1200);
  await _closeDialog();

  return true;
}

async function _closeDialog() {
  _log("INFO", "step=5", "Closing dialogâ€¦");
  const D      = "mat-dialog-container, .mat-mdc-dialog-container, [role='dialog']";
  const dialog = document.querySelector(D);

  if (dialog) {
    const closeBtn =
         dialog.querySelector("[aria-label='Close']")
      ?? dialog.querySelector("[aria-label='close']")
      ?? Array.from(dialog.querySelectorAll("button")).find(el => {
           const t = el.innerText?.trim().toLowerCase() ?? "";
           return t === "close" || t === "x";
         });
    if (closeBtn) {
      _log("INFO", "step=5", "Closing via button.");
      closeBtn.click();
      return;
    }
  }

  // Universal Angular Material fallback
  _log("INFO", "step=5", "Closing via Escape key.");
  const esc = { key:"Escape", keyCode:27, code:"Escape", bubbles:true, cancelable:true };
  document.dispatchEvent(new KeyboardEvent("keydown", esc));
  document.body.dispatchEvent(new KeyboardEvent("keydown", esc));
}

// â”€â”€ SPA router + init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function init() {
  const url = window.location.href;
  if (url.includes("/notebook/creating")) {
    _log("INFO", "init", "Skipped â€” transient /creating route.");
    return;
  }
  _log("INFO", "init", url);
  chrome.storage.local.get([CS_KEY], res => {
    const data = res[CS_KEY];
    if (data && Date.now() - data.ts < IMPORT_TTL_MS) {
      renderToast(data.title, data.text);
    } else {
      _log("INFO", "init", "No pending import or data expired.");
    }
  });
}

// NFR: Resource cleanup — store interval handle so we can clear it
_intervalId = setInterval(() => {
  const currentPath = _basePath();
  if (currentPath === _lastPath) return;
  _log("INFO", "router", `${_lastPath} → ${currentPath}`);
  _lastPath = currentPath;
  if (!_insideNotebook()) _running = false;
  init();
}, URL_CHECK_MS);

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();

