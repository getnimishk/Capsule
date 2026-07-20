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
3. [Supported AI Platforms](#-supported-ai-platforms)
4. [Key Features](#-key-features)
5. [Resilient Context Injection (Login & Popup Handling)](#-resilient-context-injection)
6. [Security & Encryption](#-security--encryption)
7. [Architecture](#-architecture)
8. [Installation & Build](#-installation--build)
9. [How to Use](#-how-to-use)
10. [File Structure](#-file-structure)
11. [License](#-license)

---

## 😤 The Problem

You've spent hours having a deep technical session with an AI model:
- Debugging a complex authentication flow
- Designing database schemas and system architecture
- Making detailed design decisions and trade-offs
- Writing hundreds of lines of code collaboratively

Then — **BAM.** You hit your usage limit, reach an hourly message cap, or want to switch to another AI model to compare answers.

**Everything is gone.** You have to manually copy-paste or re-explain the entire conversation to a fresh AI that has zero context about what you've built.

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

**Capsule v2.0** is a privacy-first, zero-server Chrome extension that:

1. **Silently scrapes & saves** your active conversations across 8 AI platforms using DOM observers.
2. **Injects a native Capsule pill button** directly inside every AI platform's input bar.
3. **1-Click Transfer:** Opens any destination AI, automatically waits for the input area to mount, and injects your full conversation state.
4. **Resilient Popup & Login Handling:** If you are logged out or blocked by a modal overlay, Capsule holds your context and displays a sleek floating top action banner: `💡 Capsule Context Ready [Inject Now] [Copy]`.
5. **Unified Popup & Storage:** View, search, export as JSON, or copy any saved conversation across all platforms in one local interface.

---

## 🌐 Supported AI Platforms

| AI Platform | Domain Match | Injection Selector / Mechanism |
| :--- | :--- | :--- |
| **Claude** | `claude.ai` | `div.ProseMirror`, `div[contenteditable="true"]` |
| **ChatGPT** | `chatgpt.com` | `#prompt-textarea`, `textarea`, `div.ProseMirror` |
| **Gemini** | `gemini.google.com` | `rich-textarea .ql-editor`, `[contenteditable]` |
| **DeepSeek** | `chat.deepseek.com` | `#chat-input`, `textarea` |
| **Perplexity** | `perplexity.ai` | `textarea[placeholder*="Ask"]`, `[role="textbox"]` |
| **Grok** | `grok.com`, `x.com` | `textarea`, `div[data-testid="tweetTextarea_0"]` |
| **Mistral** | `chat.mistral.ai` | `textarea[placeholder*="Ask"]`, `textarea` |
| **Kimi** | `kimi.ai` | `div[contenteditable="true"]`, `textarea` |
| **NotebookLM** | `notebooklm.google.com` | Automated Source Dialog & Text Importer |

---

## ✨ Key Features

### 🖥️ Unified Extension Popup
- **Unified List:** All saved conversations from all 8 AIs rendered in one searchable list.
- **Source Badges:** Color-coded badges for CLAUDE, CHATGPT, GEMINI, DEEPSEEK, PERPLEXITY, GROK, MISTRAL, and KIMI.
- **Search & Filter:** Instant real-time search across titles, prompt text, and AI responses.
- **Export & Backup:** One-click JSON export for individual conversations or bulk export.

### 🛡️ Resilient Context Injection
- **Automatic Fallback Banner:** If you're logged out or a cookie/login modal blocks the screen, Capsule displays a floating action bar:
  `💡 Capsule Context Ready ["Title..."] [Inject Now] [Copy] [✕]`
- **Background Auto-Retry:** Capsule continuously polls in the background for up to 90 seconds — the moment you complete login or close the popup, it auto-injects your prompt automatically!
- **1-Click Copy:** Copy formatted conversation context directly to your clipboard if manual paste is needed.

### 🔒 Security & Encryption
- **AES-GCM 256 Encryption:** User API keys (e.g. Gemini API keys for AI-powered context compression) are encrypted before writing to `chrome.storage.local`.
- **Per-Installation Crypto Salt:** Derived using PBKDF2 with 600,000 hashing iterations and an installation-unique salt stored in local storage.
- **No Plaintext Fallback:** Prevents accidental plaintext leakage if decryption fails.

---

## 🏗️ Architecture

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

## 📦 Installation & Build

### Option A: Install from Built Extension Package
1. Clone or download the repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `target/capsule-extension` folder (or extract `target/capsule-2.0.0.zip`).

### Option B: Build from Source using Maven
Prerequisites: Java 17+, Apache Maven 3.8+

```bash
# Clone the repository
git clone https://github.com/getnimishk/Capsule.git
cd Capsule

# Build production ZIP package
mvn clean package -P release
```
The output package will be generated at `target/capsule-2.0.0.zip`.

---

## 📄 License

Distributed under the MIT License. See `LICENSE` for more information.

---

**Author:** Nimish Kanungo  
**GitHub:** [@getnimishk](https://github.com/getnimishk)
