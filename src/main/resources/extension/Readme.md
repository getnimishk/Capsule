# 💊 Capsule — Multi-AI Transfer Prompt & Context Bridge

[![Chrome Extension](https://img.shields.io/badge/Chrome_Extension-MV3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Core Feature](https://img.shields.io/badge/Flagship-1--Click%20Transfer%20Prompt-orange.svg)](#-core-feature-1-click-cross-ai-transfer-prompt-engine)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)](pom.xml)
[![Security](https://img.shields.io/badge/Security-AES--GCM--256-success.svg)](shared/llm_client.js)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-2.0.0-purple.svg)](package.json)

> **Transfer any AI prompt and conversation context to another AI in 1 click.** Seamlessly bridge your active session state across **8 major AI platforms**: **Claude**, **ChatGPT**, **Gemini**, **DeepSeek**, **Perplexity**, **Grok**, **Mistral**, and **Kimi**, plus **NotebookLM**.

```
   ██████╗ █████╗ ██████╗ ███████╗██╗   ██╗██╗     ███████╗
  ██╔════╝██╔══██╗██╔══██╗██╔════╝██║   ██║██║     ██╔════╝
  ██║     ███████║██████╔╝███████╗██║   ██║██║     █████╗  
  ██║     ██╔══██║██╔═══╝ ╚════██║██║   ██║██║     ██╔══╝  
  ╚██████╗██║  ██║██║     ███████║╚██████╔╝███████╗███████╗
   ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚══════╝╚══════╝
   
             ──▶ 🚀 1-CLICK TRANSFER PROMPT ENGINE ◀──
```

---

## 📋 Table of Contents

1. [The Problem](#-the-problem)
2. [The Solution: Transfer Prompt Engine](#-the-solution-transfer-prompt-engine)
3. [🚀 Flagship Feature: 1-Click Cross-AI Transfer Prompt](#-flagship-feature-1-click-cross-ai-transfer-prompt)
4. [Supported AI Platforms & Capability Matrix](#-supported-ai-platforms--capability-matrix)
5. [In-Depth Feature Breakdown](#-in-depth-feature-breakdown)
   - [Unified Management Console (Popup UI)](#1-unified-management-console-popup-ui)
   - [Injected Transfer Pill & Panel](#2-injected-transfer-pill--panel)
   - [Resilient Unauthenticated & Modal Injection](#3-resilient-unauthenticated--modal-injection)
   - [AI Context Compression Pipeline](#4-ai-context-compression-pipeline)
   - [Security & Cryptography System](#5-security--cryptography-system)
6. [Configuration & Storage Guide](#-configuration--storage-guide)
7. [Architecture & Data Flow](#-architecture--data-flow)
8. [Build & Installation Guide](#-build--installation-guide)
9. [Testing Suite](#-testing-suite)
10. [🚀 Next Release Plan & Roadmap (v2.1 - v3.0)](#-next-release-plan--roadmap)
11. [License](#-license)

---

## 😤 The Problem

You're in the middle of an intense technical prompt session with an AI model:
- Debugging a complex microservice architecture
- Designing an entire SQL database schema together
- Making 15 architectural trade-offs and code decisions
- Writing 500 lines of code collaboratively

Then — **BAM.** You hit an hourly message cap, experience a service outage, or want to compare how Claude vs. ChatGPT vs. DeepSeek handles your prompt.

**Everything is lost.** You have to manually copy-paste snippets or re-explain your entire prompt to a fresh AI model that has zero context about what you've built.

---

## 💡 The Solution: Transfer Prompt Engine

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  Claude / ChatGPT / Gemini / DeepSeek / Perplexity / Grok / Mistral / Kimi   │
│                                      │                                       │
│                       🚀 1-Click "Transfer Prompt"                           │
│                                      │                                       │
│                                      ▼                                       │
│  Capsule formats & injects full prompt context into target AI input box      │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Capsule** solves prompt isolation by providing a **universal Transfer Prompt engine**. In a single click from the inline Capsule pill button, your entire prompt history, code blocks, and conversation state are captured, structured with continuity headers, and injected directly into your choice of destination AI.

---

## 🚀 Flagship Feature: 1-Click Cross-AI Transfer Prompt

The **Transfer Prompt** engine is Capsule's primary capability, built to eliminate prompt re-typing across models.

### How Transfer Prompt Works:
1. **Instant Prompt Capture:** Click **Capsule** → **Send context to [Target AI]** directly inside your prompt editor.
2. **Context Formatting:** Capsule structures your active prompt thread with standardized continuity headers:
   ```markdown
   [Context from Gemini conversation: "Refactoring Auth Middleware"]
   [Scraped: 7/20/2026, 11:45:00 AM]

   User: How do I implement OAuth2 PKCE flow in Node.js?
   Gemini: Here is the implementation using crypto module...

   ---
   I'm continuing this conversation. What are your thoughts?
   ```
3. **Automated Target Injection:** Capsule opens the destination AI tab (e.g. `claude.ai/new`, `chatgpt.com`, `chat.deepseek.com`, `grok.com`), waits for the DOM prompt element to mount, auto-fills the prompt editor, dispatches synthetic input events, and focuses the field for immediate sending.

---

## 🌐 Supported AI Platforms & Capability Matrix

Capsule injects custom UI components and extraction adapters tailored to each AI platform's specific DOM structure:

| AI Platform | Supported Host Patterns | Input Target Selectors | Transfer Prompt Support | Injection Method |
| :--- | :--- | :--- | :--- | :--- |
| **Claude** | `*.claude.ai` | `div.ProseMirror[contenteditable="true"]`, `div[contenteditable="true"]` | ✅ Full 1-Click Transfer | `document.execCommand('insertText')` |
| **ChatGPT** | `chatgpt.com`, `*.chatgpt.com` | `#prompt-textarea`, `textarea[tabindex="0"]`, `div.ProseMirror` | ✅ Full 1-Click Transfer | React Native Value Setter + Input Events |
| **Gemini** | `gemini.google.com` | `rich-textarea .ql-editor`, `[role="textbox"]` | ✅ Full 1-Click Transfer | Custom Event Chain + Dispatch |
| **DeepSeek** | `chat.deepseek.com`, `*.deepseek.com` | `#chat-input`, `textarea[placeholder*="DeepSeek"]` | ✅ Full 1-Click Transfer | Native Setter + `input`/`change` Events |
| **Perplexity** | `perplexity.ai`, `*.perplexity.ai` | `textarea[placeholder*="Ask" i]`, `[role="textbox"]` | ✅ Full 1-Click Transfer | Synthetic React Event Dispatch |
| **Grok** | `grok.com`, `*.grok.com`, `x.com` | `textarea`, `div[data-testid="tweetTextarea_0"]` | ✅ Full 1-Click Transfer | Multi-target Input Setter |
| **Mistral** | `chat.mistral.ai`, `*.mistral.ai` | `textarea[placeholder*="Ask" i]`, `textarea` | ✅ Full 1-Click Transfer | Native Property Setter |
| **Kimi** | `kimi.ai`, `*.kimi.ai`, `kimi.moonshot.cn` | `div[contenteditable="true"]`, `textarea` | ✅ Full 1-Click Transfer | `execCommand` + Native Fallback |
| **NotebookLM** | `notebooklm.google.com`, `notebooklm.google` | Source Modal Dialog Automated Inputs | ✅ Automated Import | 5-Step Automated Modal Ingestion |

---

## ⚡ In-Depth Feature Breakdown

### 1. Unified Management Console (Popup UI)
- **Aggregated Prompt Stream:** Consolidates saved histories from all 8 supported AI platforms into a single unified workspace.
- **Real-Time Fuzzy Search:** Instantly query conversation titles, code snippets, user prompts, and AI responses.
- **Visual Source Markers:** Distinct color-coded badges indicating origin (`CLAUDE`, `CHATGPT`, `GEMINI`, `DEEPSEEK`, `PERPLEXITY`, `GROK`, `MISTRAL`, `KIMI`).
- **Granular Data Operations:**
  - 💾 **Export Individual Capsule:** Download a single conversation as a structured portable `.json` file.
  - 🗑️ **Animated Eviction:** Remove specific items with smooth UI transition animations.
  - 📦 **Bulk Backup:** Export your entire conversation store in a single JSON payload.

### 2. Injected Transfer Pill & Panel
- **Adaptive Inline Controls:** Injects a native `Capsule` control pill into each platform's prompt toolbar.
- **Direct Transfer Dispatch:** Select a target platform from the inline popover panel; Capsule opens a new tab, waits for DOM readiness, and auto-injects the prompt context.
- **Instant Plaintext Copy:** One-click copy of formatted markdown conversation context directly to the OS clipboard.

### 3. Resilient Unauthenticated & Modal Injection
If a target AI platform opens in a logged-out state, triggers a Cloudflare challenge, or presents a modal popup overlay:
- **Persistent Storage Hold:** The context payload is preserved in `chrome.storage.local` under `pending_context_inject` (5-minute TTL).
- **Floating Action Banner:** Displays a non-intrusive floating control bar at top of the window:
  `💡 Capsule Context Ready ["Title..."] [Inject Now] [Copy] [✕]`
- **Background Auto-Retry Loop:** An asynchronous polling loop monitors the page for up to 90 seconds. Once you log in or dismiss the modal, Capsule **automatically auto-fills** the prompt box and clears the banner.

### 4. Smart Context Compression Engine
- **Gemini 2.5 Flash Integration:** Optional AI-powered compression distills long multi-hour prompt discussions down to essential code blocks, technical decisions, and active goals.
- **Pre-flight Token Estimation:** Built-in token counter calculates token savings prior to transfer.

### 5. Enterprise-Grade Security & Encryption
- **AES-GCM 256 Bit Encryption:** User-provided API keys are encrypted before being written to persistent extension storage.
- **Key Derivation via PBKDF2:** Master key derived using **600,000 iterations** of PBKDF2 combined with a cryptographically secure 16-byte installation-unique salt (`cc_crypto_salt`).
- **Strict Error Boundaries:** Fails securely without fallback to unencrypted plaintext storage.

---

## ⚙️ Configuration & Storage Guide

### Extension Options Configuration
Access extension settings by navigating to `chrome-extension://<EXTENSION_ID>/options/options.html` or right-clicking the extension icon → **Options**.

Configurable parameters:
- **Gemini API Key:** Encrypted API key for context compression.
- **Storage Limits:** Adjust local conversation retention caps (Default: 50 items).
- **Export Preferences:** Choose default export mode (Markdown vs Portable JSON).

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

---

## 🧪 Testing Suite

Run unit tests via **Jest**:

```bash
# Install dependencies
npm install

# Run Jest unit test suite
npm test
```

---

## 🚀 Future Roadmap & Development Plan

### **v2.1 — Storage Scalability & Local Model Ecosystem (Q3 2026)**
- **IndexedDB Storage Engine:** Transition from `chrome.storage.local` to IndexedDB to allow unlimited conversation storage with code snippet indexing.
- **Local AI Support:** Dedicated injection adapters for **Ollama**, **LM Studio**, and **Open WebUI**.

### **v2.2 — WASM Semantic Search & Context Diffing (Q3 2026)**
- **Local Vector Search (RAG):** In-browser vector embeddings generated via WASM for semantic search across past conversations.
- **Visual Context Diffs:** Highlight what information was added or modified during Transfer Prompt operations.

### **v3.0 — Encrypted Multi-Device Sync (Q4 2026)**
- **Peer-to-Peer WebRTC Sync:** End-to-end encrypted device synchronization without central server storage.
- **Cross-Browser Ports:** Native Manifest V3 releases for Firefox and Safari.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

**Author:** Nimish Kanungo  
**GitHub:** [@getnimishk](https://github.com/getnimishk)  
**Repository:** [https://github.com/getnimishk/Capsule](https://github.com/getnimishk/Capsule)
