# Capsule — Multi-AI Context Bridge & Exporter

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-MV3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](pom.xml)
[![Security](https://img.shields.io/badge/Security-AES--GCM--256-success.svg)](shared/llm_client.js)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-purple.svg)](package.json)

Capsule is a high-performance, privacy-first Chrome Extension (Manifest V3) that continuously captures, indexes, and transfers your conversation state across **8 major AI platforms**: **Claude**, **ChatGPT**, **Gemini**, **DeepSeek**, **Perplexity**, **Grok**, **Mistral**, and **Kimi**, plus **NotebookLM**.

---

## 📌 Executive Summary & Core Value

Modern LLM workflows often suffer from **context fragmentation**. When you hit an hourly rate limit, experience a platform outage, or need to cross-verify code solutions across models, transferring multi-turn conversations manually leads to lost context, formatted code degradation, and wasted time.

**Capsule** addresses this by operating directly at the browser layer:
- **Zero Cloud Middleman:** All conversation capture, storage, and cross-platform injections occur 100% locally inside your browser runtime.
- **Universal Context Portability:** Shift from Claude to ChatGPT, or Gemini to DeepSeek with a single click — retaining code blocks, technical decisions, and conversation history.
- **Resilient Execution Engine:** Handles unauthenticated tabs, modal overlays, login gates, and single-page application (SPA) DOM hydration seamlessly.

---

## 🌐 Platform Capability & Selector Matrix

Capsule injects custom UI components and extraction adapters tailored to each AI platform's specific DOM structure:

| AI Platform | Supported Host Patterns | Input Target Selectors | Context Extractor Strategy | Injection Method |
| :--- | :--- | :--- | :--- | :--- |
| **Claude** | `*.claude.ai` | `div.ProseMirror[contenteditable="true"]`, `div[contenteditable="true"]` | API Interceptor Proxy + DOM Observer | `document.execCommand('insertText')` |
| **ChatGPT** | `chatgpt.com`, `*.chatgpt.com` | `#prompt-textarea`, `textarea[tabindex="0"]`, `div.ProseMirror` | `[data-message-author-role]` DOM Parser | React Native Value Setter + Input Events |
| **Gemini** | `gemini.google.com` | `rich-textarea .ql-editor`, `[role="textbox"]` | Angular Element Stream Parser | Custom Event Chain + Dispatch |
| **DeepSeek** | `chat.deepseek.com`, `*.deepseek.com` | `#chat-input`, `textarea[placeholder*="DeepSeek"]` | Virtualized Message Tree Parser | Native Setter + `input`/`change` Events |
| **Perplexity** | `perplexity.ai`, `*.perplexity.ai` | `textarea[placeholder*="Ask" i]`, `[role="textbox"]` | Query & Answer Container Harvester | Synthetic React Event Dispatch |
| **Grok** | `grok.com`, `*.grok.com`, `x.com` | `textarea`, `div[data-testid="tweetTextarea_0"]` | DraftJS & Standard Textarea Parser | Multi-target Input Setter |
| **Mistral** | `chat.mistral.ai`, `*.mistral.ai` | `textarea[placeholder*="Ask" i]`, `textarea` | Markdown Response Node Scraper | Native Property Setter |
| **Kimi** | `kimi.ai`, `*.kimi.ai`, `kimi.moonshot.cn` | `div[contenteditable="true"]`, `textarea` | Segmented Node Parser | `execCommand` + Native Fallback |
| **NotebookLM** | `notebooklm.google.com`, `notebooklm.google` | Source Modal Dialog Automated Inputs | DOM Automation Pipeline | 5-Step Automated Modal Ingestion |

---

## ⚡ In-Depth Technical Features

### 1. Unified Management Console (Popup UI)
- **Aggregated Stream:** Consolidates saved histories from all 8 supported AI platforms into a single unified workspace.
- **Real-Time Fuzzy Search:** Instantly query conversation titles, code snippets, user prompts, and AI responses.
- **Visual Source Markers:** Distinct color-coded badges indicating origin (`CLAUDE`, `CHATGPT`, `GEMINI`, `DEEPSEEK`, `PERPLEXITY`, `GROK`, `MISTRAL`, `KIMI`).
- **Granular Data Operations:**
  - 💾 **Export Individual Capsule:** Download a single conversation as a structured portable `.json` file.
  - 🗑️ **Animated Eviction:** Remove specific items with smooth UI transition animations.
  - 📦 **Bulk Backup:** Export your entire conversation store in a single JSON payload.

### 2. Embedded Control Bar & Context Transfer Panel
- **Adaptive Inline Controls:** Injects a native `Capsule` control pill into each platform's prompt toolbar.
- **Direct Cross-Platform Dispatch:** Select a target platform from the inline popover panel; Capsule opens a new tab, waits for DOM readiness, and auto-injects the conversation state.
- **Instant Plaintext Copy:** One-click copy of formatted markdown conversation context directly to the OS clipboard.

### 3. Resilient Unauthenticated & Modal Handling System
If a target AI platform opens in a logged-out state, triggers a Cloudflare challenge, or presents a modal popup overlay:
- **Persistent Storage Hold:** The context payload is preserved in `chrome.storage.local` under `pending_context_inject` (5-minute TTL).
- **Floating Action Banner:** Displays a non-intrusive floating control bar at top of the window:
  `💡 Capsule Context Ready ["Title..."] [Inject Now] [Copy] [✕]`
- **Background Auto-Retry Loop:** An asynchronous polling loop monitors the page for up to 90 seconds. Once you log in or dismiss the modal, Capsule **automatically auto-fills** the prompt box and clears the banner.

### 4. Smart Context Compression Engine
- **Gemini 2.5 Flash Integration:** Optional AI-powered compression distills long multi-hour discussions down to essential code blocks, technical decisions, and active goals.
- **Pre-flight Token Estimation:** Built-in token counter calculates token savings prior to context transfer.

### 5. Enterprise-Grade Security & Encryption
- **AES-GCM 256 Bit Encryption:** User-provided API keys are encrypted before being written to persistent extension storage.
- **Key Derivation via PBKDF2:** Master key derived using **600,000 iterations** of PBKDF2 combined with a cryptographically secure 16-byte installation-unique salt (`cc_crypto_salt`).
- **Strict Error Boundaries:** Fails securely without fallback to unencrypted plaintext storage.

---

## ⚙️ Configuration & Storage Engine

### Extension Options Configuration
Access extension settings by navigating to `chrome-extension://<EXTENSION_ID>/options/options.html` or right-clicking the extension icon → **Options**.

Configurable parameters:
- **Gemini API Key:** Encrypted API key for context compression.
- **Storage Limits:** Adjust local conversation retention caps (Default: 50 items).
- **Export Preferences:** Choose default export mode (Markdown vs Portable JSON).

### Internal Storage Schema
Data is managed locally inside `chrome.storage.local`:
```typescript
interface CapsuleStorageSchema {
  cc_all_conversations: CapsuleEntry[];
  pending_context_inject?: {
    target: string;
    context: string;
    ts: number;
  };
  cc_crypto_salt?: string;
  gemini_api_key_enc?: string;
}

interface CapsuleEntry {
  id: string;
  title: string;
  url: string;
  source: string;
  savedAt: string;
  messages: Array<{
    type: 'user' | 'assistant';
    content: string;
    timestamp?: string;
  }>;
}
```

---

## 🏗️ Architecture & Module Structure

```
┌───────────────────────────────────────────────────────────────────────────┐
│                           Capsule Extension (MV3)                         │
│                                                                           │
│   ┌───────────────────┐    ┌───────────────────┐    ┌─────────────────┐   │
│   │   Content Scripts │    │  Service Worker   │    │    Popup UI     │   │
│   │                   │    │  (background.js)  │    │                 │   │
│   │ • content.js      │───▶│                   │◀───│ • popup.html    │   │
│   │   (Claude)        │    │ • Storage Router  │    │ • popup.js      │   │
│   │                   │    │ • API Key Cipher  │    │ • popup.css     │   │
│   │ • injectors/      │    │ • LLM Compressor  │    └─────────────────┘   │
│   │   ├ chatgpt.js    │    └─────────┬─────────┘                         │
│   │   ├ gemini.js     │              │                                   │
│   │   ├ deepseek.js   │              ▼                                   │
│   │   ├ perplexity.js │    ┌───────────────────┐                         │
│   │   ├ grok.js       │    │   Storage Engine  │                         │
│   │   ├ mistral.js    │    │                   │                         │
│   │   └ kimi.js       │    │ chrome.storage.   │                         │
│   └───────────────────┘    │       local       │                         │
│                            └───────────────────┘                         │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## 📦 Build & Installation Guide

### Building Unpacked Extension from Source
Prerequisites: **Java 17+**, **Apache Maven 3.8+**, **Node.js 18+**

```bash
# Clone repository
git clone https://github.com/getnimishk/Capsule.git
cd Capsule

# Run Maven Release Build
mvn clean package -P release
```
The compiled distribution package is output to: `target/capsule-2.0.0.zip`.

### Loading in Google Chrome
1. Open Chrome and go to `chrome://extensions`.
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked** and select `target/capsule-extension` (or `src/main/resources/extension`).

---

## 🧪 Testing Suite

Run unit tests via **Jest**:

```bash
# Install dependencies
npm install

# Run Jest unit test suite
npm test
```

Test coverage includes:
- `tests/storage.test.js`: Storage CRUD operations, capacity eviction logic, and indexing.
- `tests/ui.test.js`: DOM sanitization, panel creation, and event handling.

---

## 🚀 Future Roadmap & Development Plan

### **v2.1 — Storage Scalability & Local Model Ecosystem (Q3 2026)**
- **IndexedDB Storage Engine:** Transition from `chrome.storage.local` to IndexedDB to allow unlimited conversation storage with code snippet indexing.
- **Local LLM Support:** Dedicated injection adapters for **Ollama**, **LM Studio**, and **Open WebUI**.

### **v2.2 — WASM Semantic Search & Context Diffing (Q3 2026)**
- **Local Vector Search (RAG):** In-browser vector embeddings generated via WASM for semantic search across past conversations.
- **Visual Context Diffs:** Highlight what information was added or modified during model transfer.

### **v3.0 — Encrypted Multi-Device Sync (Q4 2026)**
- **Peer-to-Peer WebRTC Sync:** End-to-end encrypted device synchronization without central server storage.
- **Cross-Browser Ports:** Native Manifest V3 releases for Firefox and Safari.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

**Author:** Nimish Kanungo  
**GitHub:** [@getnimishk](https://github.com/getnimishk)  
**Repository:** [https://github.com/getnimishk/Capsule](https://github.com/getnimishk/Capsule)
