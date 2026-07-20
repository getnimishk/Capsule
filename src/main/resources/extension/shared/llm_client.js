// shared/llm_client.js
// Universal LLM Client — Capsule v2.0
//
// Supports 7 providers through a single callLLM(systemPrompt, userPrompt, config) interface:
//   openai      → api.openai.com          (OpenAI Chat Completions)
//   anthropic   → api.anthropic.com       (Anthropic Messages API)
//   gemini      → generativelanguage.googleapis.com (Google Gemini)
//   groq        → api.groq.com            (OpenAI-compatible, ultra-fast)
//   openrouter  → openrouter.ai           (200+ models, one key)
//   ollama      → localhost:11434         (local, no key needed)
//   custom      → user-defined URL        (any OpenAI-compatible endpoint)
//
// Storage key: 'cs_llm_config'

const LLM_CONFIG_KEY = 'cs_llm_config';

// ── Provider catalogue ────────────────────────────────────────────────────────

const LLM_PROVIDERS = {
  openai: {
    label:    'OpenAI',
    baseUrl:  'https://api.openai.com/v1/chat/completions',
    format:   'openai',
    keyLabel: 'API Key (sk-…)',
    keyHint:  'platform.openai.com/api-keys',
    models:   ['gpt-4.1', 'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    label:    'Anthropic',
    baseUrl:  'https://api.anthropic.com/v1/messages',
    format:   'anthropic',
    keyLabel: 'API Key (sk-ant-…)',
    keyHint:  'console.anthropic.com/settings/keys',
    models:   ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
  },
  gemini: {
    label:    'Google Gemini',
    baseUrl:  'https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent',
    format:   'gemini',
    keyLabel: 'API Key (AIzaSy…)',
    keyHint:  'aistudio.google.com/app/apikey',
    models:   ['gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
  groq: {
    label:    'Groq',
    baseUrl:  'https://api.groq.com/openai/v1/chat/completions',
    format:   'openai',
    keyLabel: 'API Key (gsk_…)',
    keyHint:  'console.groq.com/keys',
    models:   ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  openrouter: {
    label:    'OpenRouter',
    baseUrl:  'https://openrouter.ai/api/v1/chat/completions',
    format:   'openai',
    keyLabel: 'API Key (sk-or-…)',
    keyHint:  'openrouter.ai/settings/keys',
    models:   ['anthropic/claude-3.5-sonnet', 'openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-2.5-flash'],
  },
  ollama: {
    label:    'Ollama (Local)',
    baseUrl:  'http://localhost:11434/v1/chat/completions',
    format:   'openai',
    keyLabel: 'No key needed',
    keyHint:  'ollama.com — runs 100% offline',
    models:   ['llama3.2', 'llama3.1', 'mistral', 'qwen2.5', 'phi4', 'deepseek-r1'],
    noKey:    true,
  },
  custom: {
    label:    'Custom URL',
    baseUrl:  '',
    format:   'openai',
    keyLabel: 'API Key (optional)',
    keyHint:  'Any OpenAI-compatible endpoint',
    models:   ['custom-model'],
  },
};

// ── Cryptographic Key Obfuscation Helpers (Web Crypto AES-GCM) ──────────────────
const CRYPTO_SALT = new Uint8Array([83, 101, 99, 117, 114, 101, 75, 101, 121, 83, 97, 108, 116, 49, 50, 51]); // static salt

async function getCryptoKey() {
  const seedString = (typeof chrome !== 'undefined' && chrome.runtime?.id) || "capsule-obfuscation-fallback-key";
  const enc = new TextEncoder();
  const rawKey = enc.encode(seedString);
  const baseKey = await crypto.subtle.importKey(
    "raw",
    rawKey,
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: CRYPTO_SALT,
      iterations: 1000,
      hash: "SHA-256"
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptApiKey(plaintext) {
  if (!plaintext) return "";
  try {
    const key = await getCryptoKey();
    const cryptoInstance = (typeof crypto !== 'undefined' && crypto.getRandomValues)
      ? crypto
      : (typeof self !== 'undefined' && self.crypto ? self.crypto : null);

    if (!cryptoInstance) throw new Error("Web Crypto context unavailable");

    const iv = cryptoInstance.getRandomValues(new Uint8Array(12));
    const enc = new TextEncoder();
    const encrypted = await cryptoInstance.subtle.encrypt(
      { name: "AES-GCM", iv: iv },
      key,
      enc.encode(plaintext)
    );

    const ivHex = Array.from(iv).map(b => b.toString(16).padStart(2, "0")).join("");
    const ctHex = Array.from(new Uint8Array(encrypted)).map(b => b.toString(16).padStart(2, "0")).join("");
    return `${ivHex}:${ctHex}`;
  } catch (err) {
    console.error("[Capsule] API Key encryption failed:", err);
    return plaintext;
  }
}

async function decryptApiKey(cipherTextPack) {
  if (!cipherTextPack) return "";
  if (!cipherTextPack.includes(":")) return cipherTextPack; // Already decrypted or legacy plain text
  try {
    const [ivHex, ctHex] = cipherTextPack.split(":");
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const ct = new Uint8Array(ctHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
    const key = await getCryptoKey();

    const cryptoInstance = (typeof crypto !== 'undefined' && crypto.subtle)
      ? crypto
      : (typeof self !== 'undefined' && self.crypto ? self.crypto : null);

    if (!cryptoInstance) throw new Error("Web Crypto context unavailable");

    const decrypted = await cryptoInstance.subtle.decrypt(
      { name: "AES-GCM", iv: iv },
      key,
      ct
    );
    const dec = new TextDecoder();
    return dec.decode(decrypted);
  } catch (err) {
    console.warn("[Capsule] API Key decryption failed:", err.message);
    return cipherTextPack;
  }
}

// ── Config helpers ────────────────────────────────────────────────────────────

function getLLMConfig() {
  return new Promise(resolve => {
    (typeof chrome !== 'undefined' ? chrome : self.chrome)
      .storage.local.get([LLM_CONFIG_KEY], async res => {
        const conf = res[LLM_CONFIG_KEY] || null;
        if (conf && conf.apiKey) {
          conf.apiKey = await decryptApiKey(conf.apiKey);
        }
        resolve(conf);
      });
  });
}

function saveLLMConfig(config) {
  return new Promise(async resolve => {
    let secureConfig = config;
    if (config && config.apiKey) {
      secureConfig = { ...config };
      secureConfig.apiKey = await encryptApiKey(config.apiKey);
    }
    (typeof chrome !== 'undefined' ? chrome : self.chrome)
      .storage.local.set({ [LLM_CONFIG_KEY]: secureConfig }, resolve);
  });
}

// ── OpenAI-compatible adapter (covers: openai, groq, openrouter, ollama, custom) ──

async function _callOpenAICompat(baseUrl, apiKey, model, systemPrompt, userPrompt, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  try {
    const res = await fetch(baseUrl, {
      method:  'POST',
      headers,
      signal:  controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: userPrompt   },
        ],
        temperature:  0.2,
        max_tokens:   2048,
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${err}`);
    }
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error('Empty response from LLM');
    return text;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Anthropic adapter ─────────────────────────────────────────────────────────

async function _callAnthropic(apiKey, model, systemPrompt, userPrompt, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userPrompt }],
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${err}`);
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Anthropic');
    return text;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Gemini adapter ────────────────────────────────────────────────────────────

async function _callGeminiNative(apiKey, model, systemPrompt, userPrompt, timeoutMs = 30000) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method:  'POST',
      signal:  controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 2048 },
      }),
    });
    clearTimeout(timer);
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`HTTP ${res.status}: ${err}`);
    }
    const data = await res.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

// ── Main callLLM() — unified entry point ──────────────────────────────────────

/**
 * Call the configured LLM with a system prompt and user prompt.
 *
 * @param {string}  systemPrompt - Instruction for the model
 * @param {string}  userPrompt   - The content/question
 * @param {Object}  [config]     - LLM config (loaded from storage if omitted)
 * @returns {Promise<string>}    - Model response text
 * @throws {Error} if no config, no API key (where required), or call fails
 */
async function callLLM(systemPrompt, userPrompt, config) {
  const conf = config || await getLLMConfig();

  if (!conf || !conf.provider) {
    throw new Error('No LLM provider configured. Open Settings → AI Provider.');
  }

  const providerMeta = LLM_PROVIDERS[conf.provider];
  if (!providerMeta) throw new Error(`Unknown provider: ${conf.provider}`);

  const model  = conf.model  || providerMeta.models[0];
  const apiKey = conf.apiKey || '';

  if (!providerMeta.noKey && !apiKey) {
    throw new Error(`API key required for ${providerMeta.label}. Open Settings → AI Provider.`);
  }

  switch (conf.provider) {
    case 'anthropic':
      return _callAnthropic(apiKey, model, systemPrompt, userPrompt);

    case 'gemini':
      return _callGeminiNative(apiKey, model, systemPrompt, userPrompt);

    case 'openai':
    case 'groq':
    case 'openrouter':
    case 'ollama': {
      const baseUrl = providerMeta.baseUrl;
      return _callOpenAICompat(baseUrl, apiKey, model, systemPrompt, userPrompt);
    }

    case 'custom': {
      const baseUrl = conf.customUrl?.trim();
      if (!baseUrl) throw new Error('Custom provider selected but no URL configured.');
      return _callOpenAICompat(baseUrl, apiKey, model, systemPrompt, userPrompt);
    }

    default:
      throw new Error(`Unhandled provider: ${conf.provider}`);
  }
}

// ── Test connection ───────────────────────────────────────────────────────────

/**
 * Send a minimal test ping to verify the current LLM config works.
 * @param {Object} config - LLM config object
 * @returns {Promise<{ok: boolean, latencyMs: number, error?: string}>}
 */
async function testLLMConnection(config) {
  const t0 = Date.now();
  try {
    await callLLM('You are a test assistant.', 'Reply with exactly: OK', config);
    return { ok: true, latencyMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t0, error: err.message };
  }
}

// ── Prompt templates ──────────────────────────────────────────────────────────

/**
 * System prompt for AI-powered handoff prompt generation.
 */
const HANDOFF_SYSTEM_PROMPT = `You are a conversation context packager for Capsule, an AI context management tool.

Given a conversation, generate a structured HANDOFF PROMPT that enables another AI to continue the conversation seamlessly.

The handoff prompt must:
1. Assign the next AI a specific expert role based on the topic
2. List established facts and decisions as ground truth (do not re-derive)
3. Surface open questions the user is still waiting on
4. Describe the communication style of the previous AI (bullet-heavy? code-heavy? concise?)
5. Include specific hard constraints: what NOT to say or do
6. End with a clear instruction to continue without any re-introduction

Output ONLY the handoff prompt text — no preamble, no meta-commentary.
Use clear section headers with ═══ dividers. Be specific, not generic.`;

/**
 * System prompt for "Ask My Capsule" Q&A.
 */
const ASK_CAPSULE_SYSTEM_PROMPT = `You are a precise Q&A assistant operating on a captured AI conversation provided to you as context.

Rules:
- Answer ONLY based on what is in the conversation provided.
- If the answer is not in the conversation, say so clearly rather than guessing.
- Be concise. Quote specific passages when relevant.
- Do not re-summarise the whole conversation — just answer the question asked.
- If the question is ambiguous, answer the most likely interpretation.`;

/**
 * System prompt for AI-powered compression.
 */
const COMPRESSION_SYSTEM_PROMPT = `You are a lossless technical summariser. 
Compress the following AI message to 40-50% of its original length.
Rules: preserve all technical details, code, decisions, numbers, and conclusions.
Remove: filler words, repetition, unnecessary explanations of obvious things.
Output ONLY the compressed text — no preamble.`;

// ── Exports ───────────────────────────────────────────────────────────────────

if (typeof self !== 'undefined') {
  self.LLM_PROVIDERS         = LLM_PROVIDERS;
  self.LLM_CONFIG_KEY        = LLM_CONFIG_KEY;
  self.callLLM               = callLLM;
  self.testLLMConnection     = testLLMConnection;
  self.getLLMConfig          = getLLMConfig;
  self.saveLLMConfig         = saveLLMConfig;
  self.HANDOFF_SYSTEM_PROMPT = HANDOFF_SYSTEM_PROMPT;
  self.ASK_CAPSULE_SYSTEM_PROMPT = ASK_CAPSULE_SYSTEM_PROMPT;
  self.COMPRESSION_SYSTEM_PROMPT = COMPRESSION_SYSTEM_PROMPT;
}

// Also expose on window for popup.html context
if (typeof window !== 'undefined') {
  window.LLM_PROVIDERS         = LLM_PROVIDERS;
  window.LLM_CONFIG_KEY        = LLM_CONFIG_KEY;
  window.callLLM               = callLLM;
  window.testLLMConnection     = testLLMConnection;
  window.getLLMConfig          = getLLMConfig;
  window.saveLLMConfig         = saveLLMConfig;
  window.HANDOFF_SYSTEM_PROMPT = HANDOFF_SYSTEM_PROMPT;
  window.ASK_CAPSULE_SYSTEM_PROMPT = ASK_CAPSULE_SYSTEM_PROMPT;
  window.COMPRESSION_SYSTEM_PROMPT = COMPRESSION_SYSTEM_PROMPT;
}
