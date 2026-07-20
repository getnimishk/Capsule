// options/options.js â€” Settings page logic for Capsule

const STORAGE_KEY      = 'cc_all_conversations';
const SELECTOR_KEY     = 'cs_selector_config';
const COMPRESSION_KEY  = 'cs_compression_config';
const STORAGE_CONF_KEY = 'cs_storage_config';

// â”€â”€ Platform metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const PLATFORMS = [
  { id: 'claude',      label: 'Claude',      dot: '#c8a97a' },
  { id: 'chatgpt',     label: 'ChatGPT',     dot: '#7ec8a8' },
  { id: 'gemini',      label: 'Gemini',      dot: '#7aabf5' },
  { id: 'deepseek',    label: 'DeepSeek',    dot: '#9ab0f5' },
  { id: 'perplexity',  label: 'Perplexity',  dot: '#20B2AA' },
  { id: 'grok',        label: 'Grok',        dot: '#1DA1F2' },
  { id: 'mistral',     label: 'Mistral',     dot: '#FF7000' },
  { id: 'kimi',        label: 'Kimi',        dot: '#60A5FA' },
];

// Selector fields per platform (keys must match shared/selectors.js DEFAULT_SELECTORS)
const SELECTOR_FIELDS = [
  { key: 'userMessage', label: 'User message container' },
  { key: 'aiMessage',   label: 'AI message container' },
  { key: 'input',       label: 'Input field' },
  { key: 'submitBtn',   label: 'Submit button' },
  { key: 'slot',        label: 'Button injection slot' },
];

// â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
document.addEventListener('DOMContentLoaded', async () => {
  setupNavigation();
  await loadAndApplyCompressionSettings();
  buildSelectorPlatforms();
  await loadSelectorOverrides();
  await loadStorageSettings();
  await loadStorageStats();
  bindCompressionHandlers();
  bindSelectorHandlers();
  bindStorageHandlers();
});

// â”€â”€ Navigation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function setupNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const sections = document.querySelectorAll('.section');

  navItems.forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.dataset.section;
      navItems.forEach(n => n.classList.remove('active'));
      sections.forEach(s => s.classList.remove('active'));
      item.classList.add('active');
      document.getElementById(target)?.classList.add('active');

      // Refresh storage stats when switching to storage tab
      if (target === 'storage') loadStorageStats();
    });
  });
}

// â”€â”€ Compression Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadAndApplyCompressionSettings() {
  const res = await storageGet([COMPRESSION_KEY]);
  const conf = res[COMPRESSION_KEY] || { mode: 'local', ratio: 40, geminiKey: '' };

  // Set radio
  const radio = document.querySelector(`input[name="compression-mode"][value="${conf.mode}"]`);
  if (radio) radio.checked = true;

  // Set slider
  const slider = document.getElementById('nlp-ratio');
  const sliderVal = document.getElementById('nlp-ratio-value');
  slider.value = conf.ratio ?? 40;
  sliderVal.textContent = `${slider.value}%`;

  // Set API key (masked)
  if (conf.geminiKey) {
    document.getElementById('gemini-api-key').value = conf.geminiKey;
  }

  applyCompressionModeUI(conf.mode);
}

function applyCompressionModeUI(mode) {
  const localSettings  = document.getElementById('local-nlp-settings');
  const geminiSettings = document.getElementById('gemini-api-settings');
  localSettings.style.display  = (mode === 'local') ? '' : 'none';
  geminiSettings.style.display = (mode === 'gemini') ? '' : 'none';
}

function bindCompressionHandlers() {
  // Mode change
  document.querySelectorAll('input[name="compression-mode"]').forEach(radio => {
    radio.addEventListener('change', () => applyCompressionModeUI(radio.value));
  });

  // Slider live update
  const slider = document.getElementById('nlp-ratio');
  const sliderVal = document.getElementById('nlp-ratio-value');
  slider.addEventListener('input', () => { sliderVal.textContent = `${slider.value}%`; });

  // API key visibility toggle
  const keyInput = document.getElementById('gemini-api-key');
  const toggleBtn = document.getElementById('toggle-key-visibility');
  toggleBtn.addEventListener('click', () => {
    const isHidden = keyInput.type === 'password';
    keyInput.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? 'Hide' : 'Show';
  });

  // Save
  document.getElementById('save-compression').addEventListener('click', async () => {
    const mode      = document.querySelector('input[name="compression-mode"]:checked')?.value || 'local';
    const ratio     = parseInt(slider.value, 10);
    const geminiKey = document.getElementById('gemini-api-key').value.trim();

    await storageSet({ [COMPRESSION_KEY]: { mode, ratio, geminiKey } });
    showInlineToast('compression-toast', '\u2713 Saved');
  });
}

// â”€â”€ Selector Overrides â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function buildSelectorPlatforms() {
  const container = document.getElementById('selector-platforms');

  PLATFORMS.forEach(platform => {
    const card = document.createElement('div');
    card.className = 'platform-card';
    card.dataset.platform = platform.id;

    const header = document.createElement('div');
    header.className = 'platform-header';
    header.innerHTML = `
      <div class="platform-dot" style="background:${platform.dot}"></div>
      <span class="platform-name">${platform.label}</span>
      <span class="platform-arrow">\u25B6</span>
    `;
    header.addEventListener('click', () => card.classList.toggle('open'));

    const fields = document.createElement('div');
    fields.className = 'platform-fields';

    SELECTOR_FIELDS.forEach(field => {
      const row = document.createElement('div');
      row.className = 'selector-field';
      row.innerHTML = `
        <label class="selector-label">${field.label}</label>
        <div class="selector-row">
          <input
            type="text"
            class="selector-input"
            data-platform="${platform.id}"
            data-field="${field.key}"
            placeholder="Leave blank to use default"
            autocomplete="off"
            spellcheck="false"
          />
          <button class="selector-test-btn" data-platform="${platform.id}" data-field="${field.key}">Test</button>
        </div>
        <div class="selector-default" id="def-${platform.id}-${field.key}">Default: loading\u2026</div>
      `;
      fields.appendChild(row);
    });

    card.appendChild(header);
    card.appendChild(fields);
    container.appendChild(card);
  });

  // Load defaults from background via message
  chrome.runtime.sendMessage({ action: 'getDefaultSelectors' }, (res) => {
    if (chrome.runtime.lastError || !res?.defaults) return;
    const defaults = res.defaults;
    PLATFORMS.forEach(p => {
      SELECTOR_FIELDS.forEach(f => {
        const el = document.getElementById(`def-${p.id}-${f.key}`);
        if (el) el.textContent = `Default: ${defaults[p.id]?.[f.key] || '(not set)'}`;
      });
    });
  });

  // Test button listeners
  container.querySelectorAll('.selector-test-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const inp = container.querySelector(
        `.selector-input[data-platform="${btn.dataset.platform}"][data-field="${btn.dataset.field}"]`
      );
      const selector = inp?.value.trim();
      if (!selector) return;
      try {
        // Validate syntax â€” if invalid querySelector throws
        document.createElement('div').querySelector(selector);
        inp.classList.remove('invalid');
        inp.classList.add('valid');
        setTimeout(() => inp.classList.remove('valid'), 2000);
        showGlobalToast(`\u2713 Selector syntax OK`);
      } catch {
        inp.classList.add('invalid');
        inp.classList.remove('valid');
        showGlobalToast(`\u2715 Invalid CSS selector`, true);
      }
    });
  });
}

async function loadSelectorOverrides() {
  const res = await storageGet([SELECTOR_KEY]);
  const overrides = res[SELECTOR_KEY] || {};
  const inputs = document.querySelectorAll('.selector-input');
  inputs.forEach(inp => {
    const val = overrides[inp.dataset.platform]?.[inp.dataset.field];
    if (val) inp.value = val;
  });
}

function bindSelectorHandlers() {
  document.getElementById('save-selectors').addEventListener('click', async () => {
    const overrides = {};
    document.querySelectorAll('.selector-input').forEach(inp => {
      const val = inp.value.trim();
      if (!val) return;
      if (!overrides[inp.dataset.platform]) overrides[inp.dataset.platform] = {};
      overrides[inp.dataset.platform][inp.dataset.field] = val;
    });
    await storageSet({ [SELECTOR_KEY]: overrides });
    showInlineToast('selectors-toast', '\u2713 Overrides saved');
  });

  document.getElementById('reset-selectors').addEventListener('click', async () => {
    await storageSet({ [SELECTOR_KEY]: {} });
    document.querySelectorAll('.selector-input').forEach(inp => { inp.value = ''; });
    showInlineToast('selectors-toast', '\u2713 Reset to defaults');
  });
}

// â”€â”€ Storage Settings & Stats â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async function loadStorageSettings() {
  const res = await storageGet([STORAGE_CONF_KEY]);
  const conf = res[STORAGE_CONF_KEY] || { maxConversations: 50 };
  document.getElementById('max-conversations').value = conf.maxConversations;
}

async function loadStorageStats() {
  const res = await storageGet([STORAGE_KEY]);
  const conversations = res[STORAGE_KEY] || [];

  const count = conversations.length;
  const jsonStr = JSON.stringify(conversations);
  const sizeKB = (new TextEncoder().encode(jsonStr).byteLength / 1024).toFixed(1);
  const maxKB = 5120;

  // Compression stats
  const allMessages = conversations.flatMap(c => c.messages || []);
  const compressedCount = allMessages.filter(m => m.compressed).length;
  const avgCompressed = allMessages.length > 0
    ? Math.round((compressedCount / allMessages.length) * 100)
    : 0;

  // Saved KB estimate
  const savedKB = allMessages.reduce((acc, m) => {
    if (m.compressed && m.originalLength && m.compressedLength) {
      return acc + (m.originalLength - m.compressedLength) / 1024;
    }
    return acc;
  }, 0).toFixed(1);

  document.getElementById('stat-count').textContent = count;
  document.getElementById('stat-size').textContent = sizeKB;
  document.getElementById('stat-compressed').textContent = avgCompressed;
  document.getElementById('stat-saved').textContent = savedKB;

  const pct = Math.min((parseFloat(sizeKB) / maxKB) * 100, 100).toFixed(1);
  document.getElementById('storage-bar-fill').style.width = `${pct}%`;
  document.getElementById('storage-bar-label').textContent = `${sizeKB} / ${maxKB} KB`;
}

function bindStorageHandlers() {
  document.getElementById('save-storage').addEventListener('click', async () => {
    const max = parseInt(document.getElementById('max-conversations').value, 10);
    await storageSet({ [STORAGE_CONF_KEY]: { maxConversations: Math.max(10, Math.min(200, max)) } });
    showInlineToast('storage-toast', '\u2713 Saved');
  });

  document.getElementById('clear-all-storage').addEventListener('click', async () => {
    if (!confirm('Delete all saved conversations? This cannot be undone.')) return;
    await storageSet({ [STORAGE_KEY]: [] });
    await loadStorageStats();
    showGlobalToast('\u2713 All conversations cleared');
  });
}

// â”€â”€ Storage helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function storageGet(keys) {
  return new Promise(resolve => chrome.storage.local.get(keys, resolve));
}
function storageSet(obj) {
  return new Promise(resolve => chrome.storage.local.set(obj, resolve));
}

// â”€â”€ Toast helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function showInlineToast(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

function showGlobalToast(msg, isError = false) {
  const el = document.getElementById('global-toast');
  el.textContent = msg;
  el.style.color = isError ? '#e05252' : '#f0f0f0';
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 2500);
}

// ── LLM Provider catalogue ────────────────────────────────────────────────────
const LLM_PROVIDERS_META = {
  openai:     { keyLabel: 'API Key (sk-…)',      keyHint: 'platform.openai.com/api-keys',      models: ['gpt-4.1','gpt-4o','gpt-4o-mini','gpt-4-turbo','gpt-3.5-turbo'],                                    noKey: false },
  anthropic:  { keyLabel: 'API Key (sk-ant-…)',  keyHint: 'console.anthropic.com/settings/keys', models: ['claude-3-5-sonnet-20241022','claude-3-5-haiku-20241022','claude-3-opus-20240229','claude-3-haiku-20240307'], noKey: false },
  gemini:     { keyLabel: 'API Key (AIzaSy…)',   keyHint: 'aistudio.google.com/app/apikey',    models: ['gemini-2.5-flash','gemini-2.5-pro','gemini-1.5-flash','gemini-1.5-pro'],                            noKey: false },
  groq:       { keyLabel: 'API Key (gsk_…)',     keyHint: 'console.groq.com/keys',             models: ['llama-3.3-70b-versatile','llama-3.1-8b-instant','mixtral-8x7b-32768','gemma2-9b-it'],              noKey: false },
  openrouter: { keyLabel: 'API Key (sk-or-…)',   keyHint: 'openrouter.ai/settings/keys',       models: ['anthropic/claude-3.5-sonnet','openai/gpt-4o','meta-llama/llama-3.3-70b-instruct','google/gemini-2.5-flash'], noKey: false },
  ollama:     { keyLabel: 'No key needed',        keyHint: 'Runs at localhost:11434',           models: ['llama3.2','llama3.1','mistral','qwen2.5','phi4','deepseek-r1'],                                     noKey: true  },
  custom:     { keyLabel: 'API Key (optional)',   keyHint: 'Any OpenAI-compatible endpoint',    models: ['custom-model'],                                                                                       noKey: false },
};

const LLM_CONFIG_KEY_OPT = 'cs_llm_config';

// ── Load saved LLM settings ───────────────────────────────────────────────────
async function loadLLMSettings() {
  const conf = typeof getLLMConfig === 'function' ? await getLLMConfig() : {};

  const providerEl = document.getElementById('llm-provider-select');
  if (conf.provider) providerEl.value = conf.provider;
  updateLLMProviderUI(conf.provider || '');

  if (conf.model) {
    const modelEl = document.getElementById('llm-model-select');
    [...modelEl.options].forEach(o => { if (o.value === conf.model) o.selected = true; });
  }
  if (conf.apiKey)    document.getElementById('llm-api-key').value    = conf.apiKey;
  if (conf.customUrl) document.getElementById('llm-custom-url').value = conf.customUrl;

  const feat = conf.features || {};
  document.getElementById('llm-feat-compression').checked = feat.compression !== false;
  document.getElementById('llm-feat-handoff').checked     = feat.handoff     !== false;
  document.getElementById('llm-feat-ask').checked         = feat.ask         !== false;
}

// ── Update UI when provider changes ──────────────────────────────────────────
function updateLLMProviderUI(provider) {
  const meta = LLM_PROVIDERS_META[provider];

  const modelRow  = document.getElementById('llm-model-row');
  const customRow = document.getElementById('llm-custom-url-row');
  const keyRow    = document.getElementById('llm-key-row');
  const keyHintEl = document.getElementById('llm-key-hint');
  const keyInput  = document.getElementById('llm-api-key');
  const noKeyNote = document.getElementById('llm-no-key-note');
  const featCard  = document.getElementById('llm-features-card');
  const secCard   = document.getElementById('llm-security-card');
  const testBtn   = document.getElementById('test-llm');

  if (!provider || !meta) {
    [modelRow, customRow, keyRow, noKeyNote, featCard, secCard].forEach(el => el.style.display = 'none');
    testBtn.style.display = 'none';
    return;
  }

  // Populate model dropdown
  const modelEl = document.getElementById('llm-model-select');
  modelEl.innerHTML = meta.models.map(m => `<option value="${m}">${m}</option>`).join('');
  modelRow.style.display = 'flex';
  customRow.style.display = provider === 'custom' ? 'flex' : 'none';

  if (meta.noKey) {
    keyRow.style.display    = 'none';
    noKeyNote.style.display = 'flex';
  } else {
    keyRow.style.display    = 'flex';
    noKeyNote.style.display = 'none';
    keyInput.placeholder    = meta.keyLabel;
    if (keyHintEl) keyHintEl.textContent = meta.keyHint ? `Get key at: ${meta.keyHint}` : '';
  }

  featCard.style.display = 'block';
  secCard.style.display  = provider !== 'ollama' ? 'block' : 'none';
  testBtn.style.display  = 'inline-flex';
}

// ── Permission Helper mapping ─────────────────────────────────────────────────
const PROVIDER_PERMISSION_MATCHES = {
  openai:     "https://api.openai.com/*",
  anthropic:  "https://api.anthropic.com/*",
  gemini:     "https://generativelanguage.googleapis.com/*",
  groq:       "https://api.groq.com/*",
  openrouter: "https://openrouter.ai/*",
  ollama:     "http://localhost:11434/*"
};

function getCustomUrlOrigin(urlStr) {
  try {
    const url = new URL(urlStr);
    return `${url.protocol}//${url.hostname}${url.port ? ':' + url.port : ''}/*`;
  } catch {
    return null;
  }
}

function requestProviderPermissions(provider, customUrl) {
  const origin = provider === 'custom' ? getCustomUrlOrigin(customUrl) : PROVIDER_PERMISSION_MATCHES[provider];
  if (!origin) return Promise.resolve(true);

  return new Promise((resolve) => {
    chrome.permissions.request({
      origins: [origin]
    }, (granted) => {
      resolve(granted);
    });
  });
}

// ── Save LLM settings ─────────────────────────────────────────────────────────
async function saveLLMSettings() {
  const provider  = document.getElementById('llm-provider-select').value;
  const model     = document.getElementById('llm-model-select').value;
  const apiKey    = document.getElementById('llm-api-key').value.trim();
  const customUrl = document.getElementById('llm-custom-url').value.trim();

  // Dynamic host permission request before saving
  if (provider) {
    const hasPermission = await requestProviderPermissions(provider, customUrl);
    if (!hasPermission) {
      showGlobalToast('⚠️ Connection permission denied. Capsule will not be able to talk to the provider API.', true);
      return;
    }
  }

  const conf = {
    provider, model, apiKey, customUrl,
    features: {
      compression: document.getElementById('llm-feat-compression').checked,
      handoff:     document.getElementById('llm-feat-handoff').checked,
      ask:         document.getElementById('llm-feat-ask').checked,
    },
  };

  if (typeof saveLLMConfig === 'function') {
    await saveLLMConfig(conf);
  } else {
    await storageSet({ [LLM_CONFIG_KEY_OPT]: conf });
  }

  // Bump compression mode to 'llm' when a provider is first saved
  if (provider && conf.features.compression) {
    const compRes  = await storageGet([COMPRESSION_KEY]);
    const compConf = compRes[COMPRESSION_KEY] || { mode: 'local', ratio: 40 };
    if (compConf.mode === 'local') {
      compConf.mode = 'llm';
      await storageSet({ [COMPRESSION_KEY]: compConf });
    }
  }
  showInlineToast('llm-toast', '✓ Saved');
}

// ── Test connection (proxied through background) ───────────────────────────────
async function testLLMConnectionFromPage() {
  const provider  = document.getElementById('llm-provider-select').value;
  const model     = document.getElementById('llm-model-select').value;
  const apiKey    = document.getElementById('llm-api-key').value.trim();
  const customUrl = document.getElementById('llm-custom-url').value.trim();

  if (!provider) { showGlobalToast('Select a provider first', true); return; }

  // Dynamic host permission request before testing
  const hasPermission = await requestProviderPermissions(provider, customUrl);
  if (!hasPermission) {
    showGlobalToast('Connection permission denied.', true);
    return;
  }

  const testBtn = document.getElementById('test-llm');
  const orig    = testBtn.textContent;
  testBtn.textContent = 'Testing…';
  testBtn.disabled    = true;

  const config = { provider, model, apiKey, customUrl,
    features: { compression: true, handoff: true, ask: true } };

  chrome.runtime.sendMessage({ action: 'testLLMConnection', config }, res => {
    testBtn.textContent = orig;
    testBtn.disabled    = false;
    if (res?.ok) {
      showGlobalToast(`✓ Connected in ${res.latencyMs}ms`);
    } else {
      showGlobalToast(`✗ ${res?.error || 'Connection failed'}`, true);
    }
  });
}

// ── Bind LLM handlers ────────────────────────────────────────────────────────
function bindLLMHandlers() {
  document.getElementById('llm-provider-select').addEventListener('change', e => {
    updateLLMProviderUI(e.target.value);
  });

  document.getElementById('llm-toggle-key')?.addEventListener('click', function () {
    const inp  = document.getElementById('llm-api-key');
    const show = inp.type === 'password';
    inp.type       = show ? 'text' : 'password';
    this.textContent = show ? 'Hide' : 'Show';
  });

  document.getElementById('save-llm').addEventListener('click', saveLLMSettings);
  document.getElementById('test-llm').addEventListener('click', testLLMConnectionFromPage);
}

// Hook into existing DOMContentLoaded — append as a second listener
document.addEventListener('DOMContentLoaded', async () => {
  await loadLLMSettings();
  bindLLMHandlers();
});
