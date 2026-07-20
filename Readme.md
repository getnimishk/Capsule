# 💊 Capsule v2.0 — Multi-AI Context Bridge & Exporter

![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension-blue)
![Manifest V3](https://img.shields.io/badge/Manifest-V3-green)
![License](https://img.shields.io/badge/License-MIT-yellow)
![Status](https://img.shields.io/badge/Status-Active-success)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)
![Version](https://img.shields.io/badge/Version-2.0.0-purple)

> **Never lose your AI context again.** Save, copy, download, and seamlessly transfer your AI conversation state across **8 major AI platforms** — Claude, ChatGPT, Gemini, DeepSeek, Perplexity, Grok, Mistral, and Kimi (+ NotebookLM integration).

```
   ██████╗ █████╗ ██████╗ ███████╗██╗   ██╗██╗     ███████╗
  ██╔════╝██╔══██╗██╔══██╗██╔════╝██║   ██║██║     ██╔════╝
  ██║     ███████║██████╔╝███████╗██║   ██║██║     █████╗  
  ██║     ██╔══██║██╔═══╝ ╚════██║██║   ██║██║     ██╔══╝  
  ╚██████╗██║  ██║██║     ███████║╚██████╔╝███████╗███████╗
   ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚══════╝╚══════╝
   
             ──▶ MULTI-AI CONTEXT BRIDGE ◀──
```

---

## 📋 Table of Contents

1. [The Problem](#-the-problem)
2. [The Solution](#-the-solution)
3. [Supported AI Platforms & Matrix](#-supported-ai-platforms--matrix)
4. [Comprehensive Feature Breakdown](#-comprehensive-feature-breakdown)
   - [Unified Popup UI](#1-unified-popup-ui)
   - [Injected Context Pill & Export Panel](#2-injected-context-pill--export-panel)
   - [Resilient Context Injection (Unauthenticated / Pop-up Handling)](#3-resilient-context-injection)
   - [AI Context Compression Pipeline](#4-ai-context-compression-pipeline)
   - [Security & Cryptography System](#5-security--cryptography-system)
   - [DOM Scraper & Event Proxy Interceptor](#6-dom-scraper--event-proxy-interceptor)
5. [Configuration & Customization Guide](#-configuration--customization-guide)
   - [Extension Options Page](#1-extension-options-page)
   - [Configuring Gemini API for Compression](#2-configuring-gemini-api-for-compression)
   - [Storage Architecture & Keys](#3-storage-architecture--keys)
6. [Architecture & Data Flow](#-architecture--data-flow)
7. [Installation & Build Guide](#-installation--build-guide)
8. [Testing & Quality Assurance](#-testing--quality-assurance)
9. [🚀 Next Release Plan & Roadmap (v2.1 - v3.0)](#-next-release-plan--roadmap)
10. [File Structure](#-file-structure)
11. [License](#-license)

---

## 😤 The Problem

You've spent **2 hours** on an intense session with an AI model:
- Debugging a complex microservice architecture
- Designing an entire SQL database schema together
- Making 15 architectural trade-offs and code decisions
- Writing 500 lines of code collaboratively

Then — **BAM.** You hit your hourly message limit. Or the AI service experiences an outage. Or you want to compare how Claude vs. ChatGPT vs. DeepSeek solves the remaining problem.

**Everything is lost.** The context, decisions, and nuance are gone. You have to manually copy-paste snippets or re-explain the entire conversation to a fresh AI that has zero context about what you've built.

---

## 💡 The Solution

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Claude / ChatGPT / Gemini / DeepSeek / Perplexity / Grok / Mistral / Kimi   │
│                                      │                                       │
│                                      ▼                                       │
│                           💊 Capsule v2.0 Extension                          │
│                                      │                                       │
│             ┌────────────────────────┴────────────────────────┐              │
│             ▼                                                 ▼              │
│    1-Click Auto-Inject                              Floating Action Banner   │
│    (Target AI input box)                          (For unauthenticated/popups) │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Capsule v2.0** is a local, privacy-first Chrome extension that automatically records your conversations across 8 AI platforms and lets you port, copy, compress, or export your context with a single click.

---

## 🌐 Supported AI Platforms & Matrix

| AI Platform | Domain Match | Input Area Selector / Mechanism | Scraper Engine | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Claude** | `claude.ai` | `div.ProseMirror`, `div[contenteditable="true"]` | API Interceptor + DOM Observer | ✅ Production |
| **ChatGPT** | `chatgpt.com` | `#prompt-textarea`, `textarea`, `div.ProseMirror` | `[data-message-author-role]` DOM Scraper | ✅ Production |
| **Gemini** | `gemini.google.com` | `rich-textarea .ql-editor`, `[contenteditable]` | Angular DOM Scraper | ✅ Production |
| **DeepSeek** | `chat.deepseek.com` | `#chat-input`, `textarea` | Virtualized List Scraper | ✅ Production |
| **Perplexity**| `perplexity.ai` | `textarea[placeholder*="Ask"]`, `[role="textbox"]` | AnswerBody / UserMessage Scraper | ✅ Production |
| **Grok** | `grok.com`, `x.com` | `textarea`, `div[data-testid="tweetTextarea_0"]` | DraftJS / Textarea Scraper | ✅ Production |
| **Mistral** | `chat.mistral.ai` | `textarea[placeholder*="Ask"]`, `textarea` | Markdown Node Scraper | ✅ Production |
| **Kimi** | `kimi.ai` | `div[contenteditable="true"]`, `textarea` | Segment Node Scraper | ✅ Production |
| **NotebookLM**| `notebooklm.google.com` | Automated Source Dialog & Text Importer | 5-Step Pipeline Automator | ✅ Production |

---

## ⚡ Comprehensive Feature Breakdown

### 1. Unified Popup UI
- **Multi-Source Aggregation:** Displays saved conversations from all 8 AI services in one chronological list.
- **Color-Coded Source Badges:** Visually distinguish between `CLAUDE` (orange), `CHATGPT` (green), `GEMINI` (blue), `DEEPSEEK` (cyan), `PERPLEXITY` (teal), `GROK` (dark blue), `MISTRAL` (amber), and `KIMI` (indigo).
- **Instant Live Search:** Real-time fuzzy filter across conversation titles, system prompts, user queries, and AI responses.
- **Message Expand / Collapse:** Inline message history viewer inside the popup without opening extra windows.
- **Per-Card Controls:** 
  - 📥 **Download JSON:** Download a single conversation as a clean portable Capsule JSON file.
  - 🗑️ **Delete Card:** Delete individual conversations with smooth CSS fade animations.
- **Global Actions:** Bulk JSON export of all saved conversations and one-click clear history.

### 2. Injected Context Pill & Export Panel
- **Native Styling:** Capsule injects a sleek pill button (`Capsule`) inside the input bar of every supported AI platform that adapts to light/dark themes.
- **One-Click Target Transfer:** Pick any destination AI (e.g. from Gemini to Claude or ChatGPT to Grok) — Capsule opens the tab, waits for the target input element, and injects the formatted conversation history.
- **Copy to Clipboard:** Copy formatted markdown context to clipboard in 1 click.
- **Download JSON:** Download conversation JSON directly from the inline panel on the active AI page.

### 3. Resilient Context Injection (Unauthenticated / Pop-up Handling)
- **Unauthenticated / Login Fallback:** If you open a target AI where you are logged out or blocked by a Cloudflare / cookie overlay:
  - Capsule **safely holds your scraped context in local storage** (5-minute TTL).
  - Capsule displays a floating top pill on the target site:
    `💡 Capsule Context Ready ["Title..."] [Inject Now] [Copy] [✕]`
- **Background Auto-Retry Polling:** A background observer polls every 1s for up to 90 seconds. As soon as you log in or close the modal and the chat input mounts, Capsule **automatically auto-injects** the prompt and dismisses the banner!

### 4. AI Context Compression Pipeline
- **Gemini 2.5 Flash Compression:** Optional integration with Gemini 2.5 Flash API to compress lengthy multi-hour conversations down to essential technical facts, code snippets, and active decisions.
- **Token Estimator:** Built-in token counter calculates raw vs. compressed token savings before injection.

### 5. Security & Cryptography System
- **AES-GCM 256 Encryption:** API keys saved in extension options are encrypted before write to `chrome.storage.local`.
- **Per-Installation Salt & PBKDF2:** Keys are derived using PBKDF2 with **600,000 iterations** and a 16-byte cryptographically random per-installation salt (`cc_crypto_salt`).
- **No Plaintext Fallback:** Throws strict errors if decryption fails, preventing plaintext key leaks.

### 6. DOM Scraper & Event Proxy Interceptor
- **`api_hook.js`:** Intercepts JSON network payloads for platforms using API responses (Claude). Built with strict domain checks (`isAIUrl`) to prevent CSP errors on Google/analytics domains.
- **Debounced Mutation Observer:** MutationObserver attached to `document.body` saves chat updates after 1.5 seconds of streaming pause to avoid saving partial sentences mid-generation.

---

## ⚙️ Configuration & Customization Guide

### 1. Extension Options Page
Open the extension options by right-clicking the Capsule extension icon in Chrome → **Options**, or navigating to `chrome-extension://<EXTENSION_ID>/options/options.html`.

In Options, you can configure:
- **Gemini API Key:** Enter your Google Gemini API key to enable AI-powered conversation compression.
- **Default Export Format:** Choose between Plain Text Markdown or Portable JSON.
- **Max Saved Conversations:** Set local storage limit (default: 50 conversations).

### 2. Configuring Gemini API for Compression
1. Get a free API key from [Google AI Studio](https://aistudio.google.com/).
2. Open Capsule **Options**.
3. Paste your API key and click **Save Settings**.
4. The key is instantly encrypted with AES-GCM 256 and stored securely.

### 3. Storage Architecture & Keys
Capsule uses `chrome.storage.local` with standardized storage keys:
- `cc_all_conversations`: Array of saved conversation objects.
- `pending_context_inject`: Temporary object holding context targeted for injection into another AI tab.
- `cc_crypto_salt`: 16-byte hex salt generated per installation.
- `gemini_api_key_enc`: Encrypted ciphertext of user's Gemini API key.

---

## 🏗️ Architecture & Data Flow

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

## 📦 Installation & Build Guide

### Option A: Install Unpacked Extension (Development)
1. Clone the repository:
   ```bash
   git clone https://github.com/getnimishk/Capsule.git
   ```
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Toggle **Developer mode** on (top right).
4. Click **Load unpacked** and select the `target/capsule-extension` folder (or `src/main/resources/extension`).

### Option B: Production Maven Package Build
Prerequisites: Java 17+, Apache Maven 3.8+

```bash
# Clone repository
git clone https://github.com/getnimishk/Capsule.git
cd Capsule

# Run Maven Release Build
mvn clean package -P release
```
The compiled ZIP archive will be located at:
`target/capsule-2.0.0.zip`

---

## 🧪 Testing & Quality Assurance

Capsule includes a full suite of automated unit tests using **Jest**:

```bash
# Run unit tests
npm test
```

### Test Suites Included:
- `tests/storage.test.js`: Validates `chrome.storage.local` CRUD operations, deduplication, and max item eviction.
- `tests/ui.test.js`: Validates DOM sanitization, panel creation, and event dispatching.

---

## 🚀 Next Release Plan & Roadmap (v2.1 - v3.0)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CAPSULE ROADMAP                                   │
│                                                                              │
│  v2.1 (Q3 2026) ──▶ IndexedDB Storage & Local LLM (Ollama/WebUI) Support    │
│  v2.2 (Q3 2026) ──▶ Semantic Vector RAG Search & Context Diffs               │
│  v3.0 (Q4 2026) ──▶ Encrypted Peer-to-Peer Multi-Browser Sync (WebRTC)       │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 🗓️ Upcoming Releases

#### **v2.1 — IndexedDB Storage & Local AI Ecosystem Support**
- **Unlimited History:** Migrate from `chrome.storage.local` (5MB limit) to `IndexedDB` for storing thousands of conversation capsules with attachments and code snippets.
- **Local AI Support:** Add native injectors for **Ollama**, **LM Studio**, and **Open WebUI**.

#### **v2.2 — Semantic Vector Search (RAG) & Context Diffing**
- **Semantic Search:** Local vector embeddings running in WASM to search past conversations by topic, concept, or code function name.
- **Context Diffs:** Visual diff view highlighting what changed between conversation iterations when transferring context.

#### **v3.0 — Encrypted Peer-to-Peer Sync & Cross-Browser Support**
- **E2E Encrypted P2P Sync:** WebRTC peer-to-peer sync between your work laptop, home PC, and mobile browser without central servers.
- **Cross-Browser Manifest V3:** Firefox (Gecko) and Safari (Webkit) extension packages.

---

## 📁 File Structure

```
Capsule/
├── manifest.json                  # Manifest V3 Extension Configuration
├── background.js                  # Service Worker & Storage Router
├── content.js                     # Claude Content Script & DOM Observer
├── pom.xml                        # Maven Build Specification
├── package.json                   # NPM Dependencies & Test Scripts
├── Readme.md                      # Complete Project Documentation
├── LICENSE                        # MIT License
├── popup/
│   ├── popup.html                 # Extension Popup Interface
│   ├── popup.js                   # Popup Logic & Search Controller
│   └── popup.css                  # Modern Glassmorphic Dark Styling
├── options/
│   ├── options.html               # Extension Settings Page
│   ├── options.js                 # AES Encryption & Storage Settings
│   └── options.css                # Options Page Styles
├── injectors/
│   ├── chatgpt.js                 # ChatGPT Injector
│   ├── gemini.js                  # Gemini Injector
│   ├── deepseek.js                # DeepSeek Injector
│   ├── perplexity.js              # Perplexity Injector
│   ├── grok.js                    # Grok Injector
│   ├── mistral.js                 # Mistral Injector
│   ├── kimi.js                    # Kimi Injector
│   └── notebooklm.js              # NotebookLM Automator
├── shared/
│   ├── api_hook.js                # Network Event Proxy Interceptor
│   ├── llm_client.js              # Encrypted Gemini API Client
│   ├── nlp_compress.js            # Heuristic & LLM Context Compressor
│   ├── selectors.js               # Cross-Platform DOM Selectors
│   └── token_estimator.js         # Token Estimator Engine
├── assets/                        # Documentation Screenshots & Diagrams
├── icons/                         # HiDPI Extension Icons (16, 32, 48, 128px)
└── tests/                         # Jest Unit Test Suites
```

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

---

**Author:** Nimish Kanungo  
**GitHub:** [@getnimishk](https://github.com/getnimishk)  
**Project Link:** [https://github.com/getnimishk/Capsule](https://github.com/getnimishk/Capsule)
