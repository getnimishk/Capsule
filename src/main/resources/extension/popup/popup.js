const STORAGE_KEY = "cc_all_conversations";

// ── AI source label config ──────────────────────────────────────────────────
const AI_META = {
  claude:     { label: "Claude",      cls: "claude" },
  gemini:     { label: "Gemini",      cls: "gemini" },
  chatgpt:    { label: "ChatGPT",     cls: "chatgpt" },
  deepseek:   { label: "DeepSeek",    cls: "deepseek" },
  perplexity: { label: "Perplexity",  cls: "perplexity" },
  grok:       { label: "Grok",        cls: "grok" },
  mistral:    { label: "Mistral",     cls: "mistral" },
  kimi:       { label: "Kimi",        cls: "kimi" },
};

// ── AI site hostnames — used to detect "current" conversation ──────────────
const AI_HOSTS = {
  "claude.ai":           "claude",
  "gemini.google.com":   "gemini",
  "chatgpt.com":         "chatgpt",
  "chat.deepseek.com":   "deepseek",
  "www.perplexity.ai":   "perplexity",
  "x.com":               "grok",
  "chat.mistral.ai":     "mistral",
  "kimi.ai":             "kimi",
};

let _activeTab = "convs";

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindUI();

  // First scrape the currently active AI tab (if any), then render
  // This makes the popup always show the LIVE conversation from the current page
  chrome.runtime.sendMessage({ action: "scrapeActiveTab" }, () => {
    // Ignore errors — unsupported tabs just skip scraping gracefully
    if (chrome.runtime.lastError) { /* not a supported page */ }
    loadAndRender();
  });
}

function bindUI() {
  document.getElementById("close-popup-btn")?.addEventListener("click", () => window.close());
  document.getElementById("export-btn").addEventListener("click", exportAllHandler);

  document.getElementById("clear-all-btn").addEventListener("click", () => {
    chrome.storage.local.set({ [STORAGE_KEY]: [] }, () => {
      loadAndRender();
      showToast("Cleared all conversations");
    });
  });

  const tabConvs = document.getElementById("tab-convs");
  const tabDownloads = document.getElementById("tab-downloads");

  tabConvs.addEventListener("click", () => {
    if (_activeTab === "convs") return;
    _activeTab = "convs";
    _currentPlatformFilter = "all";
    tabConvs.classList.add("active");
    tabDownloads.classList.remove("active");
    loadAndRender();
  });

  tabDownloads.addEventListener("click", () => {
    if (_activeTab === "downloads") return;
    _activeTab = "downloads";
    _currentPlatformFilter = "all";
    tabDownloads.classList.add("active");
    tabConvs.classList.remove("active");
    loadAndRender();
  });

  const searchInput = document.getElementById("search-input");
  const clearSearch = document.getElementById("clear-search");

  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim();
    clearSearch.classList.toggle("visible", q.length > 0);
    filterConversations(q);
  });

  clearSearch.addEventListener("click", () => {
    searchInput.value = "";
    clearSearch.classList.remove("visible");
    filterConversations("");
  });
}

// — Load & filter: only show current-tab convo + exported ones ——————————————————
function loadAndRender() {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const all = res[STORAGE_KEY] || [];

    if (_activeTab === "downloads") {
      _activeHost = null;
      renderConversations(all);
      updateStats(all);
      return;
    }

    // Get the active tab URL to detect which AI is currently open
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeUrl = tabs[0]?.url || "";
      const activeHost = getHostKey(activeUrl);
      _activeHost = activeHost;

      // Keep a conversation if:
      //  1. It matches the current active AI tab's host (current session)
      //  2. Or it has source = a different AI (meaning it was exported from another AI)
      //  3. Or it was explicitly tagged as exported
      const relevant = all.filter((c) => {
        const src = c.source || detectSource(c.url);
        // Always show if it's from the current active AI
        if (activeHost && src === activeHost) return true;
        // Always show if it has a source (was exported/scraped from an AI)
        if (src) return true;
        // Show Claude conversations (default — content.js always sets source)
        return true;
      });

      renderConversations(relevant);
      updateStats(relevant);
    });
  });
}

// Derive AI source key from a URL
function detectSource(url) {
  if (!url) return null;
  try {
    const host = new URL(url).hostname;
    return AI_HOSTS[host] || null;
  } catch { return null; }
}

// Return the AI source key for the currently active tab
function getHostKey(url) {
  return detectSource(url);
}

/* =========================
   SEARCH / FILTER
========================= */
/* =========================
   SEARCH / FILTER
========================= */
let _allConversations = [];
let _currentPlatformFilter = "all";

function filterConversations(query) {
  applyFilterAndSearch();
}

function applyFilterAndSearch() {
  const query = document.getElementById("search-input").value.trim().toLowerCase();
  let filtered = _allConversations;

  // 1. Apply Platform Pill Filter
  if (_currentPlatformFilter !== "all") {
    filtered = filtered.filter(c => {
      const src = c.source || detectSource(c.url) || "unknown";
      return src === _currentPlatformFilter;
    });
  }

  // 2. Apply Text Query search
  if (query) {
    filtered = filtered.filter(
      (c) =>
        (c.title || "").toLowerCase().includes(query) ||
        c.messages?.some((m) => m.content?.toLowerCase().includes(query))
    );
  }

  renderConversationsList(filtered);
}

// Render dynamic filter pills based on platforms present in matching conversations
function renderFilterPills(conversations) {
  const container = document.getElementById("filter-pills");
  if (!container) return;

  const platforms = new Set();
  conversations.forEach(c => {
    const src = c.source || detectSource(c.url);
    if (src) platforms.add(src);
  });

  if (platforms.size <= 1) {
    container.style.display = "none";
    return;
  }

  container.style.display = "flex";
  container.innerHTML = "";

  // Add 'All' Pill
  const allPill = document.createElement("button");
  allPill.className = `filter-pill${_currentPlatformFilter === "all" ? " active" : ""}`;
  allPill.textContent = "All";
  allPill.onclick = () => {
    _currentPlatformFilter = "all";
    updatePillSelection();
    applyFilterAndSearch();
  };
  container.appendChild(allPill);

  // Add platform-specific pills
  Array.from(platforms).sort().forEach(p => {
    const meta = AI_META[p] || { label: p.charAt(0).toUpperCase() + p.slice(1) };
    const pill = document.createElement("button");
    pill.className = `filter-pill${_currentPlatformFilter === p ? " active" : ""}`;
    pill.textContent = meta.label;
    pill.onclick = () => {
      _currentPlatformFilter = p;
      updatePillSelection();
      applyFilterAndSearch();
    };
    container.appendChild(pill);
  });
}

function updatePillSelection() {
  const container = document.getElementById("filter-pills");
  if (!container) return;
  const pills = container.querySelectorAll(".filter-pill");
  pills.forEach(p => {
    const isAll = p.textContent === "All";
    const pKey = isAll ? "all" : getPlatformKeyFromLabel(p.textContent);
    if (pKey === _currentPlatformFilter) {
      p.classList.add("active");
    } else {
      p.classList.remove("active");
    }
  });
}

function getPlatformKeyFromLabel(label) {
  for (const [key, meta] of Object.entries(AI_META)) {
    if (meta.label === label) return key;
  }
  return label.toLowerCase();
}

/* =========================
   RENDERING
========================= */

function renderConversations(conversations, isFiltered = false) {
  if (!isFiltered) {
    _allConversations = conversations;
    renderFilterPills(conversations);
  }
  applyFilterAndSearch();
}

function renderConversationsList(conversations) {
  const list = document.getElementById("conversations-list");
  if (!list) return;

  let empty = document.getElementById("empty-state");
  if (!empty) {
    empty = document.createElement("div");
    empty.id = "empty-state";
    empty.className = "empty-state";
    empty.innerHTML = `
      <div class="empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.3">
          <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
        </svg>
      </div>
      <p class="empty-title">No conversations saved yet</p>
      <p class="empty-body">Conversations will be automatically saved as you chat on Claude, ChatGPT, Gemini, DeepSeek, etc.</p>
    `;
  }

  list.innerHTML = "";

  if (!conversations || !conversations.length) {
    list.appendChild(empty);
    empty.style.display = "flex";
    return;
  }

  conversations
    .slice()
    .sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))
    .forEach((conv) => {
      const card = createConversationCard(conv);
      list.appendChild(card);
    });
}

function createConversationCard(conv) {
  const card = document.createElement("div");
  card.className = "conv-card";

  // Resolve AI source
  const src = conv.source || detectSource(conv.url) || "unknown";
  const aiMeta = AI_META[src] || { label: src.charAt(0).toUpperCase() + src.slice(1), cls: "unknown" };

  // Live session indicator check
  const isActiveSession = (_activeTab === "convs") && (src === _activeHost);

  /* --- HEADER --- */
  const header = document.createElement("div");
  header.className = "conv-header";

  const meta = document.createElement("div");
  meta.className = "conv-meta";

  const topRow = document.createElement("div");
  topRow.className = "conv-top-row";

  if (_activeTab === "downloads") {
    const renameWrap = document.createElement("div");
    renameWrap.className = "rename-wrap";

    const input = document.createElement("input");
    input.type = "text";
    input.className = "rename-input";
    input.value = conv.title || "";
    input.placeholder = "Rename capsule\u2026";

    const saveBtn = document.createElement("button");
    saveBtn.className = "rename-save-btn";
    saveBtn.textContent = "Save";

    const saveAction = () => {
      const newTitle = input.value.trim();
      if (!newTitle) return;
      saveTitleOverride(conv.id, newTitle);
    };

    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      saveAction();
    });

    input.addEventListener("keydown", (e) => {
      e.stopPropagation();
      if (e.key === "Enter") saveAction();
    });

    input.addEventListener("click", (e) => e.stopPropagation());

    renameWrap.appendChild(input);
    renameWrap.appendChild(saveBtn);
    topRow.appendChild(renameWrap);
  } else {
    const titleEl = document.createElement("div");
    titleEl.className = "conv-title";
    titleEl.textContent = conv.title || "Untitled";
    titleEl.title = conv.title || "Untitled";
    topRow.appendChild(titleEl);
  }

  // AI source badge pill (e.g. "Claude", "DeepSeek")
  const badge = document.createElement('span');
  badge.className = `source-badge source-${aiMeta.cls}`;
  badge.textContent = aiMeta.label;

  topRow.appendChild(badge);

  if (isActiveSession) {
    const liveIndicator = document.createElement("span");
    liveIndicator.className = "live-indicator";
    liveIndicator.textContent = "● Live";
    liveIndicator.title = "This capsule belongs to your active browser tab session.";
    topRow.appendChild(liveIndicator);
  }

  const dateEl = document.createElement("div");
  dateEl.className = "conv-date";
  dateEl.textContent = formatDate(conv.savedAt);

  // Compression stats
  const stats = getConversationSizeStats(conv.messages || []);
  const statsRow = document.createElement("div");
  statsRow.className = "size-stats-row";

  const track = document.createElement("div");
  track.className = "size-bar-track";
  const tooltipText = `Original: ${stats.originalChars.toLocaleString()} chars (~${stats.originalTokens.toLocaleString()} tokens)\nCompressed: ${stats.compressedChars.toLocaleString()} chars (~${stats.compressedTokens.toLocaleString()} tokens)\nSavings: ${stats.savingsPct}%`;
  track.setAttribute("data-tooltip", tooltipText);

  const fill = document.createElement("div");
  fill.className = "size-bar-fill";
  const fillPct = stats.originalChars > 0 ? (stats.compressedChars / stats.originalChars) * 100 : 100;
  fill.style.width = `${Math.max(5, Math.min(100, fillPct))}%`;
  track.appendChild(fill);

  const text = document.createElement("span");
  text.className = "size-text";
  text.textContent = `${formatTokenCount(stats.originalTokens)} → ${formatTokenCount(stats.compressedTokens)} tokens`;

  statsRow.appendChild(track);
  statsRow.appendChild(text);

  if (stats.savingsPct > 0) {
    const chip = document.createElement("span");
    chip.className = "savings-chip";
    chip.textContent = `-${stats.savingsPct}%`;
    statsRow.appendChild(chip);
  }

  // Context Usage Warning bar
  const ctxUsage = estimateContextUsage(conv);
  const ctxRow = document.createElement("div");
  ctxRow.className = `ctx-stats-row level-${ctxUsage.level}`;

  const ctxTrack = document.createElement("div");
  ctxTrack.className = "ctx-bar-track";
  const ctxTooltip = `Context usage: ${formatTokens(ctxUsage.tokens)} / ${formatLimit(ctxUsage.limit)} (${Math.round(ctxUsage.ratio * 100)}%)`;
  ctxTrack.setAttribute("data-tooltip", ctxTooltip);

  const ctxFill = document.createElement("div");
  ctxFill.className = "ctx-bar-fill";
  ctxFill.style.width = `${ctxUsage.ratio * 100}%`;
  ctxTrack.appendChild(ctxFill);

  const ctxText = document.createElement("span");
  ctxText.className = "ctx-text";
  ctxText.textContent = `${formatTokens(ctxUsage.tokens)} / ${formatTokens(ctxUsage.limit)} (${Math.round(ctxUsage.ratio * 100)}%)`;

  ctxRow.appendChild(ctxTrack);
  ctxRow.appendChild(ctxText);

  meta.appendChild(topRow);
  meta.appendChild(dateEl);
  meta.appendChild(statsRow);
  meta.appendChild(ctxRow);

  /* ── ACTION BUTTONS ── */
  const actions = document.createElement("div");
  actions.className = "card-actions";

  const notebookBtn = document.createElement("button");
  notebookBtn.className = "btn-icon-only";
  notebookBtn.title = "Send to NotebookLM";
  notebookBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 2 2 14c0 0 6 3 10 3s10-3 10-3z"/>
    <path d="M12 17v5"/>
    <path d="M6 14s3 2 6 2 6-2 6-2"/>
    <path d="M12 2c1.5 2 3.5 4 5 7"/>
    <path d="M12 2c-1.5 2-3.5 4-5 7"/>
  </svg>`;
  notebookBtn.onclick = (e) => {
    e.stopPropagation();
    sendToNotebookLM(conv);
  };

  // ── Handoff Prompt button ──────────────────────────────────────────────────
  const handoffBtn = document.createElement("button");
  handoffBtn.className = "btn-icon-only btn-handoff";
  handoffBtn.title = "Copy Handoff Prompt — paste into any AI to resume instantly";
  handoffBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
  </svg>`;

  // Handoff preview panel (hidden by default, toggled by handoffBtn)
  const handoffPanel = document.createElement("div");
  handoffPanel.className = "handoff-panel";

  handoffBtn.onclick = async (e) => {
    e.stopPropagation();
    const alreadyOpen = handoffPanel.classList.contains('open');
    if (alreadyOpen) {
      handoffPanel.classList.remove('open');
      handoffBtn.classList.remove('active');
      return;
    }

    // Build & show the panel — try LLM first, fall back to rule-based
    handoffPanel.innerHTML = '';

    const panelHeader = document.createElement('div');
    panelHeader.className = 'handoff-panel-header';

    const panelTitle = document.createElement('span');
    panelTitle.className = 'handoff-panel-title';
    panelTitle.textContent = '📋 Handoff Prompt';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'handoff-copy-btn';
    copyBtn.textContent = 'Copy';

    const closeBtn = document.createElement('button');
    closeBtn.className = 'handoff-close-btn';
    closeBtn.textContent = '✕';
    closeBtn.onclick = (ev) => {
      ev.stopPropagation();
      handoffPanel.classList.remove('open');
      handoffBtn.classList.remove('active');
    };

    const pre = document.createElement('pre');
    pre.className = 'handoff-pre';

    panelHeader.appendChild(panelTitle);
    panelHeader.appendChild(copyBtn);
    panelHeader.appendChild(closeBtn);
    handoffPanel.appendChild(panelHeader);
    handoffPanel.appendChild(pre);
    handoffPanel.classList.add('open');
    handoffBtn.classList.add('active');

    // Try AI-powered generation first
    pre.textContent = '⚙ Generating with AI…';
    let prompt = null;

    try {
      const llmConf = window.getLLMConfig ? await window.getLLMConfig() : null;
      if (llmConf && llmConf.provider && llmConf.features?.handoff) {
        const convoText = (conv.messages || [])
          .map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`)
          .join('\n\n');
        const sysPr = window.HANDOFF_SYSTEM_PROMPT ||
          'Generate a structured handoff prompt for this AI conversation so another AI can continue it seamlessly.';
        const resp = await new Promise(resolve => {
          chrome.runtime.sendMessage(
            { action: 'callLLMFromBackground', systemPrompt: sysPr, userPrompt: convoText },
            resolve
          );
        });
        if (resp?.ok && resp.result) prompt = resp.result;
      }
    } catch (_) { /* fall through */ }

    // Fallback: rule-based RISEN generator
    if (!prompt) prompt = generateHandoffPrompt(conv);

    pre.textContent = prompt;
    copyBtn.onclick = (ev) => { ev.stopPropagation(); copyHandoffPrompt(prompt, copyBtn); };
  };

  const exportBtn = document.createElement("button");
  exportBtn.className = "btn-icon-only";
  exportBtn.title = "Download as JSON";
  exportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M12 3v12"/><path d="m7 10 5 5 5-5"/>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  </svg>`;
  exportBtn.onclick = (e) => { e.stopPropagation(); exportConversation(conv); };

  const mdExportBtn = document.createElement("button");
  mdExportBtn.className = "btn-icon-only";
  mdExportBtn.title = "Download as Markdown";
  mdExportBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14 2 14 8 20 8"/>
    <line x1="16" y1="13" x2="8" y2="13"/>
    <line x1="16" y1="17" x2="8" y2="17"/>
    <polyline points="10 9 9 9 8 9"/>
  </svg>`;
  mdExportBtn.onclick = (e) => { e.stopPropagation(); exportConversationMarkdown(conv); };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "btn-icon-only delete-btn";
  deleteBtn.title = "Delete";
  deleteBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"/>
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
  </svg>`;
  deleteBtn.onclick = (e) => { e.stopPropagation(); deleteConversation(conv.id, card); };

  // ── Ask My Capsule button ──────────────────────────────────────────────────
  const askBtn = document.createElement('button');
  askBtn.className = 'btn-icon-only btn-ask';
  askBtn.title = 'Ask My Capsule — chat with this conversation';
  askBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/>
    <path d="M4.93 4.93a10 10 0 0 0 0 14.14"/>
  </svg>`;

  // Ask panel
  const askPanel = document.createElement('div');
  askPanel.className = 'ask-panel';
  askPanel.innerHTML = `
    <div class="ask-panel-header">
      <span class="ask-panel-title">🤖 Ask My Capsule</span>
      <button class="ask-close-btn" title="Close">✕</button>
    </div>
    <div class="ask-input-row">
      <input class="ask-input" type="text" placeholder="What was the final architecture decision?" />
      <button class="ask-submit-btn">Ask</button>
    </div>
    <div class="ask-answer" style="display:none"></div>
    <div class="ask-no-llm" style="display:none">
      ⚙ No AI provider configured. <a href="#" class="ask-settings-link">Open Settings → AI Provider</a> to enable this feature.
    </div>
  `;

  askPanel.querySelector('.ask-close-btn').onclick = (ev) => {
    ev.stopPropagation();
    askPanel.classList.remove('open');
    askBtn.classList.remove('active');
  };

  askPanel.querySelector('.ask-settings-link')?.addEventListener('click', (ev) => {
    ev.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  const askInput  = askPanel.querySelector('.ask-input');
  const askSubmit = askPanel.querySelector('.ask-submit-btn');
  const askAnswer = askPanel.querySelector('.ask-answer');
  const askNoLLM  = askPanel.querySelector('.ask-no-llm');

  const doAsk = async () => {
    const question = askInput.value.trim();
    if (!question) return;

    askAnswer.style.display  = 'block';
    askNoLLM.style.display   = 'none';
    askAnswer.textContent    = '⚙ Thinking…';
    askSubmit.disabled       = true;

    const convoText = (conv.messages || [])
      .map(m => `${m.type === 'user' ? 'User' : 'AI'}: ${m.content}`)
      .join('\n\n');
    const sysPrompt = (window.ASK_CAPSULE_SYSTEM_PROMPT ||
      'You are a Q&A assistant. Answer questions based only on the provided conversation context.');
    const userPrompt = `CONVERSATION:\n${convoText}\n\nQUESTION: ${question}`;

    const resp = await new Promise(resolve => {
      chrome.runtime.sendMessage(
        { action: 'callLLMFromBackground', systemPrompt: sysPrompt, userPrompt },
        resolve
      );
    });

    askSubmit.disabled = false;
    if (resp?.ok && resp.result) {
      askAnswer.textContent = resp.result;
    } else if (resp?.error?.includes('No LLM provider')) {
      askAnswer.style.display = 'none';
      askNoLLM.style.display  = 'block';
    } else {
      askAnswer.textContent = `⚠ Error: ${resp?.error || 'Unknown error'}. Check Settings → AI Provider.`;
    }
  };

  askSubmit.addEventListener('click', (ev) => { ev.stopPropagation(); doAsk(); });
  askInput.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); doAsk(); } });

  askBtn.onclick = async (e) => {
    e.stopPropagation();
    if (askPanel.classList.contains('open')) {
      askPanel.classList.remove('open');
      askBtn.classList.remove('active');
      return;
    }
    // Check if LLM is configured
    try {
      const llmConf = window.getLLMConfig ? await window.getLLMConfig() : null;
      if (!llmConf || !llmConf.provider) {
        askAnswer.style.display = 'none';
        askNoLLM.style.display  = 'block';
      } else {
        askAnswer.style.display = 'none';
        askNoLLM.style.display  = 'none';
      }
    } catch (_) {}
    askPanel.classList.add('open');
    askBtn.classList.add('active');
    askInput.focus();
  };

  actions.appendChild(notebookBtn);
  actions.appendChild(handoffBtn);
  actions.appendChild(askBtn);
  actions.appendChild(exportBtn);
  actions.appendChild(mdExportBtn);
  actions.appendChild(deleteBtn);

  header.appendChild(meta);
  header.appendChild(actions);

  /* --- TOGGLE --- */
  const msgCount = conv.messages?.length || 0;
  const toggle = document.createElement("button");
  toggle.className = "conv-toggle";
  toggle.innerHTML = `<span class="arrow">▶</span> ${msgCount} message${msgCount !== 1 ? "s" : ""}`;

  /* --- MESSAGES PANEL --- */
  const panel = document.createElement("div");
  panel.className = "messages-panel";

  (conv.messages || []).forEach((msg) => {
    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${msg.type}`;
    bubble.innerHTML = `
      <div class="msg-label">${msg.type === "user" ? "You" : aiMeta.label}</div>
      <div>${escapeHTML(msg.content)}</div>
    `;
    panel.appendChild(bubble);
  });

  toggle.addEventListener("click", () => {
    panel.classList.toggle("open");
    toggle.classList.toggle("open");
  });

  card.appendChild(header);
  card.appendChild(toggle);
  card.appendChild(panel);
  card.appendChild(handoffPanel);
  card.appendChild(askPanel);

  return card;
}

/* =========================
   DELETE
========================= */

function deleteConversation(id, cardEl) {
  chrome.storage.local.get(["cc_all_conversations"], (res) => {
    const conversations = res["cc_all_conversations"] || [];
    const updated = conversations.filter((c) => c.id !== id);

    chrome.storage.local.set({ ["cc_all_conversations"]: updated }, () => {
      cardEl.style.transition = "opacity 0.15s, transform 0.15s";
      cardEl.style.opacity = "0";
      cardEl.style.transform = "translateX(6px)";
      setTimeout(() => {
        cardEl.remove();
        _allConversations = updated;
        updateStats(updated);
        const list = document.getElementById("conversations-list");
        if (!list.querySelector(".conv-card")) {
          const empty = document.getElementById("empty-state");
          empty.style.display = "flex";
          list.appendChild(empty);
        }
      }, 150);
      showToast("Conversation deleted");
    });
  });
}

function saveTitleOverride(id, newTitle) {
  chrome.storage.local.get(["cc_all_conversations"], (res) => {
    const conversations = res["cc_all_conversations"] || [];
    const idx = conversations.findIndex((c) => c.id === id);
    if (idx >= 0) {
      conversations[idx].title = newTitle;
      chrome.storage.local.set({ ["cc_all_conversations"]: conversations }, () => {
        _allConversations = conversations;
        showToast("Renamed capsule");
      });
    }
  });
}

function sendToNotebookLM(conv) {
  const text = convertToNotebookLMText(conv);
  const data = {
    title: conv.title || "Conversation",
    text: text,
    ts: Date.now()
  };
  chrome.storage.local.set({ "pending_notebooklm_import": data }, () => {
    chrome.tabs.create({ url: "https://notebooklm.google.com/" });
  });
}

function convertToNotebookLMText(conv) {
  const lines = [
    `=== Capsule SOURCE: ${conv.title || "Conversation"} ===`,
    `Platform: ${conv.source || "Unknown"}`,
    `Saved At: ${new Date(conv.savedAt).toLocaleString()}`,
    `URL: ${conv.url || ""}`,
    `--------------------------------------------------`,
    ""
  ];

  (conv.messages || []).forEach(msg => {
    const roleLabel = msg.type === "user" ? "[USER]" : `[${(conv.source || "assistant").toUpperCase()}]`;
    lines.push(`${roleLabel}:`);
    lines.push(msg.content);
    lines.push("");
    lines.push("--------------------------------------------------");
    lines.push("");
  });

  return lines.join("\n");
}

/* =========================
   HANDOFF PROMPT  (v2 — production-grade prompting)
========================= */

// ── Technique 1: Dynamic Role Inference ──────────────────────────────────────
// Maps topic signals → a specific expert persona.
// An LLM performs measurably better when given a concrete role rather than
// a generic "helpful assistant" identity. (Wei et al., 2022; Anthropic, 2024)

const ROLE_MAP = [
  { terms: ['kafka','rabbitmq','pubsub','queue','broker','consumer','producer','partition','offset','stream'],
    role: 'distributed systems architect specialising in event-driven architecture and message brokers' },
  { terms: ['kubernetes','docker','helm','pod','deployment','ingress','service mesh','istio','k8s'],
    role: 'platform engineer and DevOps architect with deep Kubernetes and cloud-native expertise' },
  { terms: ['machine learning','neural network','model','training','dataset','epoch','gradient','pytorch','tensorflow','llm','embedding'],
    role: 'machine learning engineer and applied AI researcher' },
  { terms: ['react','vue','angular','frontend','component','css','html','dom','tailwind','nextjs','vite'],
    role: 'senior frontend engineer specialising in modern JavaScript frameworks and UI systems' },
  { terms: ['sql','database','query','index','schema','postgres','mysql','mongodb','nosql','orm','migration'],
    role: 'database architect and backend data engineer' },
  { terms: ['api','rest','graphql','endpoint','http','grpc','microservice','openapi','swagger'],
    role: 'backend API architect with expertise in distributed systems and service design' },
  { terms: ['security','vulnerability','auth','oauth','jwt','encryption','cve','pentest','xss','csrf','injection'],
    role: 'application security engineer and threat modelling specialist' },
  { terms: ['algorithm','data structure','complexity','sorting','graph','tree','dynamic programming','leetcode','bigO'],
    role: 'computer science expert and competitive programming specialist' },
  { terms: ['product','roadmap','sprint','agile','scrum','backlog','stakeholder','okr','kpi','user story'],
    role: 'senior product manager with experience leading cross-functional engineering teams' },
  { terms: ['career','interview','resume','job','salary','promotion','negotiation','offer','hiring'],
    role: 'career coach and technical hiring manager with experience on both sides of the interview process' },
  { terms: ['finance','investment','stock','portfolio','valuation','dcf','revenue','margin','startup','funding'],
    role: 'financial analyst and startup strategy advisor' },
  { terms: ['python','java','golang','rust','typescript','javascript','c++','scala','kotlin'],
    role: 'senior software engineer with full-stack expertise' },
  { terms: ['aws','gcp','azure','cloud','lambda','s3','ec2','terraform','serverless','iac'],
    role: 'cloud solutions architect and infrastructure-as-code specialist' },
  { terms: ['design','ux','ui','figma','wireframe','prototype','user research','accessibility','a11y'],
    role: 'senior UX/product designer with a systems thinking approach' },
];

function _inferExpertRole(techTerms, topic) {
  const haystack = [...techTerms, ...topic.toLowerCase().split(/[,\s]+/)].join(' ').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const entry of ROLE_MAP) {
    const score = entry.terms.filter(t => haystack.includes(t)).length;
    if (score > bestScore) { bestScore = score; best = entry; }
  }
  return best ? best.role : 'expert assistant with deep knowledge in the topic area below';
}

// ── Technique 2: Style Fingerprinting ────────────────────────────────────────
// Analyses the PREVIOUS AI's response style so the next AI mimics it.
// Humans notice continuity breaks acutely — matching format/density/depth
// prevents the jarring "new AI" feeling. (Prompt mirroring, Anthropic 2024)

function _fingerprintStyle(assistantMessages) {
  if (!assistantMessages.length) return null;

  const allContent = assistantMessages.map(m => m.content).join('\n');
  const totalChars  = allContent.length;
  const msgCount    = assistantMessages.length;

  // Bullet density
  const bulletLines = (allContent.match(/^[\s]*[-•*]\s/gm) || []).length;
  const totalLines  = (allContent.match(/\n/g) || []).length + 1;
  const bulletRatio = bulletLines / Math.max(totalLines, 1);

  // Code density
  const codeBlocks  = (allContent.match(/```/g) || []).length / 2;
  const codeRatio   = codeBlocks / Math.max(msgCount, 1);

  // Numbered list usage
  const numberedLists = (allContent.match(/^\s*\d+\.\s/gm) || []).length;

  // Avg response length
  const avgLen = Math.round(totalChars / msgCount);

  // Header usage (markdown ##)
  const hasHeaders = /^#{1,3}\s/m.test(allContent);

  // Avg sentence length (proxy for complexity)
  const sentences = allContent.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const avgSentenceWords = sentences.length
    ? Math.round(sentences.map(s => s.trim().split(/\s+/).length).reduce((a,b)=>a+b,0) / sentences.length)
    : 15;

  // Build style descriptor
  const traits = [];

  if (codeRatio > 0.5)        traits.push('heavily code-oriented — uses code blocks in most responses');
  else if (codeRatio > 0.2)   traits.push('balances prose explanations with code examples');
  else                         traits.push('primarily prose-based with minimal code unless asked');

  if (bulletRatio > 0.25)     traits.push('structures information in bullet points and lists');
  else if (numberedLists > 3) traits.push('uses numbered steps for sequential explanations');
  else                         traits.push('uses flowing paragraphs rather than lists');

  if (hasHeaders)              traits.push('organises long responses with markdown headers (##, ###)');

  if (avgLen > 800)            traits.push('gives comprehensive, detailed responses (high depth)');
  else if (avgLen > 300)       traits.push('gives moderately detailed responses with good signal-to-noise ratio');
  else                         traits.push('gives concise, direct responses — avoids padding');

  if (avgSentenceWords > 20)   traits.push('writes in long, technically precise sentences');
  else if (avgSentenceWords < 10) traits.push('writes in short, punchy sentences for clarity');

  return traits;
}

// ── Technique 3: Continuation-point Detection ─────────────────────────────────
// Detects whether the last AI message ended mid-thought.
// If it did, the next AI should COMPLETE that thought before moving forward.
// (Prevents the common bug of the AI starting fresh instead of continuing)

const CONCLUSION_SIGNALS = [
  /\bin summary\b/i, /\bto summarise\b/i, /\bin conclusion\b/i,
  /\bto wrap up\b/i, /\bhope this helps\b/i, /\blet me know if\b/i,
  /\bfeel free to ask\b/i, /\bdoes that (help|make sense|answer)\b/i,
  /\bany questions\b/i, /\bwould you like\b/i,
];

function _detectContinuationPoint(lastAssistantContent) {
  if (!lastAssistantContent) return null;
  const trimmed = lastAssistantContent.trim();
  const lastParagraph = trimmed.split(/\n\n+/).pop()?.trim() || '';

  const hasClosure = CONCLUSION_SIGNALS.some(re => re.test(lastParagraph));
  if (hasClosure) return null; // cleanly concluded

  // Ended mid-sentence or with a colon (was about to list something)
  if (trimmed.endsWith(':') || trimmed.endsWith('—') || trimmed.endsWith('…')) {
    return 'The previous AI response ended abruptly mid-explanation. Complete that explanation immediately before addressing anything else.';
  }

  // Ended with a short paragraph (likely incomplete thought)
  const lastSentences = lastParagraph.split(/(?<=[.!?])\s+/);
  if (lastSentences.length <= 2 && lastParagraph.length < 200 && !hasClosure) {
    return 'The previous response may have been cut short. If it was in the middle of an explanation, complete it first.';
  }

  return null;
}

// ── Technique 4: CoT Trigger Selection ───────────────────────────────────────
// Chain-of-thought prompting improves accuracy by 20-40% on complex reasoning tasks
// but HURTS performance on simple factual tasks (Wei et al., 2022).
// Only trigger it when complexity signals are detected.

function _shouldTriggerCoT(ctx) {
  const complexitySignals = [
    ctx.questions.length >= 2,
    ctx.techTerms.length >= 6,
    ctx.decisions.length >= 3,
    /compar|trade.?off|versus|vs\.|better|worse|when to use|should i|which/i.test(ctx.lastUserMsg),
    /design|architect|system|scale|performance|optimis/i.test(ctx.topic),
  ];
  return complexitySignals.filter(Boolean).length >= 2;
}

// ── Technique 5: Negative Constraint Engineering ──────────────────────────────
// Research shows SPECIFIC banned phrases outperform generic "be helpful" instructions.
// "Do not say X" is 3x more reliable than "instead of X, do Y". (Anthropic, 2024)
// Generic negatives ("don't be verbose") are ignored; specific ones are followed.

const STANDARD_BANS = [
  'Do not introduce yourself or say who you are.',
  'Do not summarise or recap what was already discussed.',
  'Do not say "Great question!", "Certainly!", "Of course!", "Absolutely!" or similar filler.',
  'Do not start your response with "I" — start with the substance.',
  'Do not add a conclusion paragraph unless the user explicitly asks to wrap up.',
];

function _buildNegativeConstraints(ctx, styleTraits) {
  const bans = [...STANDARD_BANS];
  if (ctx.questions.length === 0) {
    bans.push('Do not ask clarifying questions unless the user\'s intent is genuinely ambiguous.');
  }
  if (styleTraits && styleTraits.some(t => t.includes('concise'))) {
    bans.push('Do not pad responses with background context the user clearly already knows.');
  }
  return bans;
}

// ── Technique 6: RISEN Frame Assembly ────────────────────────────────────────
// RISEN = Role · Instructions · Steps · Expectation · Narrowing
// The most consistent high-performance prompt structure in production LLM systems.
// (Validated by Cursor, Perplexity, and Cognition internal prompt engineering 2024-25)

/**
 * Generate a production-grade Handoff Prompt using 6 prompting techniques.
 * @param {Object} conv — conversation object from chrome.storage
 * @returns {string} — ready-to-paste prompt
 */
function generateHandoffPrompt(conv) {
  const messages       = conv.messages || [];
  const platform       = conv.source
    ? (conv.source.charAt(0).toUpperCase() + conv.source.slice(1))
    : 'AI';
  const assistantMsgs  = messages.filter(m => m.type === 'assistant');
  const lastAssistant  = assistantMsgs[assistantMsgs.length - 1];

  // ── Extract NLP context ──
  let ctx;
  if (typeof extractHandoffContext === 'function') {
    ctx = extractHandoffContext(messages, platform);
  } else {
    const lastUser = messages.filter(m => m.type === 'user').pop();
    ctx = {
      topic: conv.title || 'this topic',
      decisions: [], questions: [], techTerms: [],
      lastSummary: '', lastUserMsg: lastUser?.content?.slice(0, 300) || '',
      platform, msgCount: messages.length,
    };
  }

  // ── Run all analysis passes ──
  const expertRole        = _inferExpertRole(ctx.techTerms, ctx.topic);
  const styleTraits       = _fingerprintStyle(assistantMsgs);
  const continuationNote  = _detectContinuationPoint(lastAssistant?.content || '');
  const useCoT            = _shouldTriggerCoT(ctx);
  const negativeBans      = _buildNegativeConstraints(ctx, styleTraits);

  // ── Assemble the RISEN prompt ──
  const B = '═'.repeat(54); // divider
  const S = (label) => [`${B}`, `  ${label}`, `${B}`];
  const lines = [];

  // ─── ROLE (R) ────────────────────────────────────────────────────
  lines.push(...S('ROLE'));
  lines.push(`You are a ${expertRole}.`);
  lines.push(`You are continuing an active conversation that began on ${ctx.platform}.`);
  lines.push(`You have full context of this conversation and will resume it without any re-introduction.`);
  lines.push('');

  // ─── MEMORY BLOCK — ground-truth anchoring ───────────────────────
  // "Treat the following as established facts" prevents the AI from
  // re-deriving or contradicting conclusions that were already reached.
  lines.push(...S('ESTABLISHED CONTEXT  [treat as ground truth — do not re-derive]'));
  lines.push(`Platform : ${ctx.platform}`);
  lines.push(`Messages : ${ctx.msgCount} exchanged`);
  lines.push(`Domain   : ${ctx.topic}`);
  if (ctx.techTerms.length) {
    lines.push(`Key terms: ${ctx.techTerms.slice(0, 8).join(', ')}`);
  }
  lines.push('');

  if (ctx.decisions.length) {
    lines.push(...S('FACTS ALREADY ESTABLISHED  [do not repeat, contradict, or re-explain these]'));
    ctx.decisions.forEach(d => lines.push(`  ✓ ${d}`));
    lines.push('');
  }

  // ─── OPEN THREADS ────────────────────────────────────────────────
  if (ctx.questions.length) {
    lines.push(...S('OPEN THREADS  [user is still waiting for answers on these]'));
    ctx.questions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
    lines.push('');
  }

  // ─── STYLE CALIBRATION ───────────────────────────────────────────
  if (styleTraits && styleTraits.length) {
    lines.push(...S('STYLE CALIBRATION  [match the previous AI exactly]'));
    lines.push(`The previous ${ctx.platform} AI had this communication style:`);
    styleTraits.forEach(t => lines.push(`  • ${t}`));
    lines.push('');
  }

  // ─── LAST EXCHANGE ───────────────────────────────────────────────
  if (ctx.lastSummary) {
    lines.push(...S('LAST AI RESPONSE  [summary — this is where you pick up]'));
    lines.push(ctx.lastSummary);
    lines.push('');
  }

  if (ctx.lastUserMsg) {
    lines.push(...S('LAST USER MESSAGE  [respond to this]'));
    lines.push(`"${ctx.lastUserMsg}"`);
    lines.push('');
  }

  // ─── CONTINUATION POINT (if detected mid-thought) ────────────────
  if (continuationNote) {
    lines.push(...S('CONTINUATION NOTE'));
    lines.push(`⚠ ${continuationNote}`);
    lines.push('');
  }

  // ─── INSTRUCTIONS (I) ────────────────────────────────────────────
  lines.push(...S('INSTRUCTIONS'));
  lines.push('1. Start your response EXACTLY where the previous AI left off.');
  lines.push('2. Match the depth, vocabulary, and technical precision of the previous responses.');
  if (useCoT) {
    lines.push('3. For each complex question, think through it step by step before giving your final answer.');
    lines.push('   Show your reasoning when working through tradeoffs or architectural decisions.');
  } else {
    lines.push('3. Answer directly. No warm-up sentences.');
  }
  if (ctx.questions.length > 0) {
    lines.push(`4. Address the ${ctx.questions.length} open thread${ctx.questions.length > 1 ? 's' : ''} listed above. Prioritise them in the order listed.`);
  }
  lines.push('');

  // ─── HARD CONSTRAINTS (N — Narrowing) ────────────────────────────
  lines.push(...S('HARD CONSTRAINTS  [non-negotiable]'));
  negativeBans.forEach(b => lines.push(`  ✗ ${b}`));
  lines.push('');

  // ─── EXPECTATION (E) — what a good response looks like ───────────
  lines.push(...S('EXPECTATION'));
  const expectations = [
    `A response that reads as a seamless continuation from ${ctx.platform} — zero restart friction.`,
  ];
  if (ctx.questions.length) expectations.push(`Clear resolution of the ${ctx.questions.length} open question${ctx.questions.length > 1 ? 's' : ''}.`);
  if (useCoT) expectations.push('Visible reasoning for any complex tradeoffs or decisions.');
  expectations.push('No recap. No filler. Substance from the first word.');
  expectations.forEach(e => lines.push(`  → ${e}`));

  return lines.join('\n');
}

function copyHandoffPrompt(prompt, btn) {
  navigator.clipboard.writeText(prompt).then(() => {
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('copied');
    showToast('Handoff prompt copied — paste into any AI!');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('copied');
    }, 2500);
  }).catch(() => {
    showToast('Copy failed — please copy manually');
  });
}

/* =========================
   EXPORT
========================= */

function exportConversation(conv) {
  const blob = new Blob([JSON.stringify(conv, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(conv.title || "conversation")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportConversationMarkdown(conv) {
  let md = `# ${conv.title || "AI Conversation"}\n\n`;
  md += `**Date:** ${new Date(conv.savedAt).toLocaleString()}\n`;
  md += `**Platform:** ${conv.source || conv.platform || "Unknown"}\n`;
  md += `**URL:** [${conv.url || "N/A"}](${conv.url || "#"})\n\n`;
  md += `---\n\n`;

  (conv.messages || []).forEach(m => {
    const role = m.type === 'user' ? 'User' : 'Assistant';
    md += `### 💬 ${role}\n\n${m.content}\n\n`;
    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${sanitize(conv.title || "conversation")}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportAllHandler() {
  chrome.storage.local.get([STORAGE_KEY], (res) => {
    const conversations = res[STORAGE_KEY] || [];
    if (!conversations.length) { showToast("Nothing to export"); return; }
    exportConversation({ title: "all_conversations", data: conversations });
  });
}

/* =========================
   UTILS
========================= */

function getConversationSizeStats(messages) {
  let totalOriginal = 0;
  let totalCompressed = 0;
  messages.forEach(msg => {
    const len = msg.content?.length || 0;
    totalOriginal += msg.originalLength || len;
    totalCompressed += msg.compressedLength || len;
  });
  if (totalOriginal === 0) totalOriginal = 1;
  const ratio = totalCompressed / totalOriginal;
  const savingsPct = Math.max(0, Math.round((1 - ratio) * 100));

  const originalTokens = Math.round(totalOriginal / 4);
  const compressedTokens = Math.round(totalCompressed / 4);

  return {
    originalChars: totalOriginal,
    compressedChars: totalCompressed,
    originalTokens,
    compressedTokens,
    savingsPct
  };
}

function formatTokenCount(num) {
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + "k";
  }
  return num;
}

function updateStats(conversations) {
  const count = conversations.length;
  const allMessages = conversations.flatMap(c => c.messages || []);
  const compressedCount = allMessages.filter(m => m.compressed).length;
  const avgPct = allMessages.length > 0
    ? Math.round((compressedCount / allMessages.length) * 100)
    : 0;
  const sizeKB = (new TextEncoder().encode(
    JSON.stringify(conversations)
  ).byteLength / 1024).toFixed(1);

  document.getElementById("conv-count").textContent =
    `${count} conversation${count !== 1 ? "s" : ""}` +
    (sizeKB > 0 ? ` \u00B7 ${sizeKB} KB` : "") +
    (avgPct > 0 ? ` \u00B7 ${avgPct}% compressed` : "");
}

function showToast(msg, duration = 2000) {
  const toast = document.getElementById("toast");
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), duration);
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) +
      " \u00B7 " + d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  } catch { return ""; }
}

function sanitize(str) {
  return str.replace(/[^\w\d]+/g, "_").slice(0, 50);
}

function escapeHTML(str) {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

