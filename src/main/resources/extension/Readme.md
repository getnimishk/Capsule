# 💊 Capsule — Multi-AI Transfer Prompt & Context Bridge

![Chrome Extension](https://img.shields.io/badge/Platform-Chrome%20Extension%20MV3-blue.svg)
![Core Feature](https://img.shields.io/badge/Flagship-1--Click%20Transfer%20Prompt-orange.svg)
![Compression](https://img.shields.io/badge/Compression-Local%20NLP%20%7C%20Gemini%202.5-teal.svg)
![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen.svg)
![Security](https://img.shields.io/badge/Security-AES--GCM--256%20%7C%20PBKDF2-success.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)
![Version](https://img.shields.io/badge/Version-2.0.0-purple.svg)

> **Never lose your AI prompt or context again.** Transfer your active prompt thread and conversation state between **Claude**, **ChatGPT**, **Gemini**, **DeepSeek**, **Perplexity**, **Grok**, **Mistral**, and **Kimi** in a single click (+ NotebookLM integration).

```
   ██████╗ █████╗ ██████╗ ███████╗██╗   ██╗██╗     ███████╗
  ██╔════╝██╔══██╗██╔══██╗██╔════╝██║   ██║██║     ██╔════╝
  ██║     ███████║██████╔╝███████╗██║   ██║██║     █████╗  
  ██║     ██╔══██║██╔═══╝ ╚════██║██║   ██║██║     ██╔══╝  
  ╚██████╗██║  ██║██║     ███████║╚██████╔╝███████╗███████╗
   ╚═════╝╚═╝  ╚═╝╚═╝     ╚══════╝ ╚═════╝ ╚══════╝╚══════╝
   
             ──▶ 🚀 1-CLICK CROSS-AI TRANSFER PROMPT ENGINE ◀──
```

---

## 📋 Table of Contents

1. [Why Capsule Exists (Problem Statement)](#-why-capsule-exists-problem-statement)
2. [What Makes Capsule Different](#-what-makes-capsule-different)
3. [🚀 Flagship Feature: 1-Click Cross-AI Transfer Prompt](#-flagship-feature-1-click-cross-ai-transfer-prompt)
4. [Dual Compression Pipeline (Local NLP + Optional Gemini)](#-dual-compression-pipeline-local-nlp--optional-gemini)
5. [Feature Walkthrough (14 Core Features)](#-feature-walkthrough-14-core-features)
6. [Screenshots](#-screenshots)
7. [Supported AI Platforms](#-supported-ai-platforms)
8. [How Capsule Works (Flow Diagram)](#-how-capsule-works-flow-diagram)
9. [Architecture](#-architecture)
10. [Security & Privacy](#-security--privacy)
11. [Performance](#-performance)
12. [Permissions Explained](#-permissions-explained)
13. [Installation](#-installation)
14. [Build from Source](#-build-from-source)
15. [Development Guide](#-development-guide)
16. [Project Structure](#-project-structure)
17. [Roadmap](#-roadmap)
18. [FAQ](#-faq)
19. [Contributing](#-contributing)
20. [License](#-license)

---

## 😤 Why Capsule Exists (Problem Statement)

You're in the middle of a deep, multi-turn technical session with an AI model:
- Debugging a complex microservice architecture
- Designing an entire SQL database schema together
- Making 15 architectural trade-offs and code decisions
- Writing 500 lines of code collaboratively

Then — **BAM.** You hit an hourly rate limit, experience a platform outage, or want to compare how Claude vs. ChatGPT vs. DeepSeek solves the remaining problem.

**Everything is lost.** You have to manually copy-paste snippets or re-explain your entire prompt to a fresh AI model that has zero context about what you've built.

---

## 🌟 What Makes Capsule Different

Unlike generic bookmarking or export tools, **Capsule** acts as a **dynamic multi-AI bridge**:
- **Zero Cloud Storage / Zero Tracking:** 100% of your data stays locally inside your Chrome browser.
- **1-Click Active Context Transfer:** Don't just save chats — transfer your active state directly into another model's prompt area.
- **Dual Compression Engine:** Includes a **100% offline Local Extractive NLP Engine** as the default, plus optional **Gemini 2.5 Flash API Compression**.
- **Resilient Unauthenticated Injection:** If a target AI opens in a logged-out state or behind a Cloudflare/modal gate, Capsule holds your context and auto-injects the instant you log in.
- **Unified 8-Platform Engine:** One extension seamlessly handles Claude, ChatGPT, Gemini, DeepSeek, Perplexity, Grok, Mistral, and Kimi.

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

## 🧠 Dual Compression Pipeline (Local NLP + Optional Gemini)

Capsule features two independent context compression engines to fit your workflow:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                        Capsule Compression Pipeline                          │
│                                                                              │
│    ┌────────────────────────────────────────────────────────────────────┐    │
│    │  DEFAULT: Local Extractive NLP Engine (Pure JS, 100% Offline)      │    │
│    │  • Verbatim Code Block Extraction & Protection (`...` & ```...```)│    │
│    │  • Sentence Tokenization & Stop-Word Filtering                     │    │
│    │  • TF-IDF Extractive Sentence Scoring & Order Preservation          │    │
│    │  • Zero network calls / Zero external dependencies                 │    │
│    └────────────────────────────────────────────────────────────────────┘    │
│                                      │                                       │
│                                      ▼ (Optional Switch in Settings)         │
│    ┌────────────────────────────────────────────────────────────────────┐    │
│    │  OPTIONAL: Gemini 2.5 Flash API Compression                       │    │
│    │  • LLM Abstractive Summarization via Google Gemini 2.5 Flash API    │    │
│    │  • Encrypted API Key Storage via AES-GCM-256 + PBKDF2 (600k)       │    │
│    └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Local Extractive NLP Summarizer (Default):**
   - Pure JavaScript TF-IDF sentence scoring engine running locally in your browser service worker.
   - Extracts and preserves code blocks (` ```...``` `) and inline code verbatim.
   - Requires zero API keys and zero internet requests.
2. **Gemini 2.5 Flash Compression (Optional):**
   - Abstractive LLM summarization that condenses multi-hour conversations down to active technical goals, decisions, and code blocks.
   - Configurable via extension Settings with encrypted API key storage.

---

## 🔍 Feature Walkthrough (14 Core Features)

### 1. 🚀 1-Click Cross-AI Transfer Prompt
Click the **Capsule** pill injected inside your prompt toolbar, choose another AI, and your entire prompt thread opens and populates in the destination AI automatically.

### 2. 💡 "Context Ready" Floating Rescue Bar
If you're not logged into the destination AI or a popup blocks the page, Capsule holds your context in storage and displays a top floating bar (`Capsule Context Ready [Inject Now] [Copy]`). Log in or close the modal, and Capsule auto-injects your prompt.

### 3. ⏱️ 90-Second Background Auto-Retry Polling
When waiting on a target page to load or finish authentication, a background observer continuously monitors the DOM for up to 90 seconds. The moment the chat input mounts, Capsule fills your prompt and clears the banner.

### 4. 📋 1-Click Plaintext Markdown Copy
Copy your formatted conversation history directly to your OS clipboard with one click from the inline Capsule panel.

### 5. 📄 Portable JSON Conversation Download
Download any conversation thread as a structured `.json` capsule directly from the active web page or popup console.

### 6. 🖥️ Unified History Workspace
View, manage, and read all your saved conversations from Claude, ChatGPT, Gemini, DeepSeek, Perplexity, Grok, Mistral, and Kimi in one central popup window.

### 7. 🎨 Color-Coded AI Source Badges
Every saved conversation card features a distinct color badge (`CLAUDE`, `CHATGPT`, `GEMINI`, `DEEPSEEK`, `PERPLEXITY`, `GROK`, `MISTRAL`, `KIMI`) for visual clarity.

### 8. ⚡ Real-Time Live Search
Type any keyword, topic name, or code snippet into the popup search box to filter your saved conversation history instantly.

### 9. 📖 Inline Message Inspector
Expand any conversation card in the extension popup to view and read full message histories without leaving your active tab.

### 10. 🗑️ Granular Eviction & History Cleanup
Delete individual conversation cards with a single click (featuring smooth CSS fade animations) or wipe your entire local history using "Clear All".

### 11. 🔄 Automatic Background Saving
You never need to click "Save". Capsule automatically records your conversation in the background as you type and receive AI responses.

### 12. 🧠 Local Extractive & Optional Gemini Compression
Compress long conversations locally using TF-IDF sentence scoring (100% offline default) or abstractive summarization via Gemini 2.5 Flash API.

### 13. 📊 Pre-Flight Token Estimator
Calculates token counts and compression percentage savings before sending context to another AI model.

### 14. 🔐 AES-GCM 256 Encryption & PBKDF2 Key Security
Encrypts user-configured API keys using PBKDF2 with **600,000 iterations** and a 16-byte per-installation crypto salt (`cc_crypto_salt`).

---

## 🖼️ Screenshots

### Extension Popup — Unified Multi-AI History
![Extension Popup](assets/Preview.png)

### Injected Control Pill & Export Panel
![Injected UI Panel](assets/InjectedUI.png)

---

## 🌐 Supported AI Platforms

| AI Platform | Domain Match | Target Input Element | Transfer Support |
| :--- | :--- | :--- | :--- |
| **Claude** | `*.claude.ai` | `div.ProseMirror`, `div[contenteditable]` | ✅ Full 1-Click |
| **ChatGPT** | `chatgpt.com`, `*.chatgpt.com` | `#prompt-textarea`, `textarea` | ✅ Full 1-Click |
| **Gemini** | `gemini.google.com` | `rich-textarea .ql-editor` | ✅ Full 1-Click |
| **DeepSeek** | `chat.deepseek.com`, `*.deepseek.com` | `#chat-input`, `textarea` | ✅ Full 1-Click |
| **Perplexity** | `perplexity.ai`, `*.perplexity.ai` | `textarea[placeholder*="Ask" i]` | ✅ Full 1-Click |
| **Grok** | `grok.com`, `*.grok.com`, `x.com` | `textarea`, `div[data-testid="tweetTextarea_0"]` | ✅ Full 1-Click |
| **Mistral** | `chat.mistral.ai`, `*.mistral.ai` | `textarea[placeholder*="Ask" i]` | ✅ Full 1-Click |
| **Kimi** | `kimi.ai`, `*.kimi.ai`, `kimi.moonshot.cn` | `div[contenteditable]`, `textarea` | ✅ Full 1-Click |
| **NotebookLM** | `notebooklm.google.com` | Source Modal Dialog Inputs | ✅ Automated Import |

---

## 🔄 How Capsule Works (Flow Diagram)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  Source AI Page (e.g. Gemini)                                               │
│  1. User clicks "Capsule" pill ──▶ Selects Target AI (e.g. Claude)          │
│  2. Scrapes conversation state & sets pending_context_inject in storage      │
│  3. Opens target URL: https://claude.ai/new                                  │
└───────────────────────┬──────────────────────────────────────────────────────┘
                        │
                        ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  Target AI Page (e.g. Claude)                                               │
│  4. Content script initializes & checks pending_context_inject               │
│                                                                              │
│  ┌─────────────────────────────────┴─────────────────────────────────┐        │
│  ▼                                                                   ▼        │
│  [Input Ready]                                       [Input Blocked/Login]   │
│  Auto-fills prompt box                               Shows Floating Banner    │
│  Dispatches input events                             Polls for 90s until login│
│  Shows "✓ Context injected!"                         Auto-fills on ready!     │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Architecture

```
Capsule Extension (Manifest V3)
├── background.js           # Service Worker: storage router, encryption & compression
├── content.js              # Claude Content Script & DOM Observer
├── injectors/
│   ├── chatgpt.js          # ChatGPT Injector & Scraper
│   ├── gemini.js           # Gemini Injector & Scraper
│   ├── deepseek.js         # DeepSeek Injector & Scraper
│   ├── perplexity.js       # Perplexity Injector & Scraper
│   ├── grok.js             # Grok Injector & Scraper
│   ├── mistral.js          # Mistral Injector & Scraper
│   ├── kimi.js             # Kimi Injector & Scraper
│   └── notebooklm.js       # NotebookLM Automation Pipeline
├── shared/
│   ├── api_hook.js         # MAIN world network proxy interceptor
│   ├── llm_client.js       # Encrypted Gemini API client
│   ├── nlp_compress.js     # Offline Local Extractive TF-IDF Compression Engine
│   └── token_estimator.js  # Pre-flight token estimator
└── popup/ & options/       # Extension UI interfaces
```

---

## 🔒 Security & Privacy

- **100% Local Storage:** All scraped conversation data remains exclusively inside your browser's local `chrome.storage.local`.
- **AES-GCM 256 Encryption:** API keys are encrypted using AES-GCM 256 with PBKDF2 (600,000 iterations) and an installation-unique 16-byte salt (`cc_crypto_salt`).
- **No Third-Party Analytics:** Capsule makes zero network calls to analytics, tracking, or telemetry servers.

---

## ⚡ Performance

- **Debounced DOM Observers:** MutationObservers wait for a 1.5s pause in streaming before capturing DOM updates to prevent CPU overhead.
- **Zero Background Memory Leaks:** Service worker automatically terminates when idle in compliance with Manifest V3 standards.

---

## 🔑 Permissions Explained

| Permission | Purpose |
| :--- | :--- |
| `storage` | Saves conversation histories and encrypted settings locally in Chrome. |
| `activeTab` | Accesses the active AI tab when you open the popup console. |
| `scripting` | Programmatically manages content scripts across supported tabs. |
| Host Permissions (`*://*.claude.ai/*`, `https://chatgpt.com/*`, etc.) | Injects the Capsule pill and handles prompt auto-filling on supported AI sites. |

---

## 📦 Installation

1. Clone or download this repository.
2. Open Google Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right toggle).
4. Click **Load unpacked** and select the `target/capsule-extension` (or `src/main/resources/extension`) directory.

---

## 🛠️ Build from Source

Prerequisites: **Java 17+**, **Apache Maven 3.8+**, **Node.js 18+**

```bash
# Clone the repository
git clone https://github.com/getnimishk/Capsule.git
cd Capsule

# Build production ZIP archive
mvn clean package -P release
```
The compiled package will be generated at `target/capsule-2.0.0.zip`.

---

## 💻 Development Guide

```bash
# Install dependencies
npm install

# Run Jest unit test suite
npm test
```

When editing content scripts or injectors, run the sync step before building Maven packages:
```powershell
Copy-Item "injectors/*" "src/main/resources/extension/injectors/" -Recurse -Force
Copy-Item "content.js" "src/main/resources/extension/" -Force
Copy-Item "manifest.json" "src/main/resources/extension/" -Force
```

---

## 📁 Project Structure

```
Capsule/
├── manifest.json                  # Manifest V3 Configuration
├── background.js                  # Background Service Worker
├── content.js                     # Claude Content Script
├── pom.xml                        # Maven Build Spec
├── package.json                   # Dependencies & Test Config
├── Readme.md                      # Documentation
├── LICENSE                        # MIT License
├── popup/                         # Popup UI (HTML, CSS, JS)
├── options/                       # Options UI (HTML, CSS, JS)
├── injectors/                     # Platform Injectors (ChatGPT, Gemini, DeepSeek, etc.)
├── shared/                        # Encryption, Local NLP Engine, & Interceptors
├── icons/                         # HiDPI PNG Icons (16, 32, 48, 128px)
└── tests/                         # Jest Test Suites
```

---

## 🚀 Roadmap

- [x] **v2.0:** Multi-AI 8-Platform Support, Local Offline NLP Extractive Compression Engine, Resilient Unauthenticated Floating Banner, PBKDF2 + AES-GCM 256 Security.
- [ ] **v2.1:** IndexedDB Migration (unlimited history), Local LLM Support (Ollama, LM Studio, Open WebUI).
- [ ] **v2.2:** WASM Local Vector RAG Search & Visual Context Diffs.
- [ ] **v3.0:** WebRTC Encrypted Peer-to-Peer Multi-Device Sync & Firefox/Safari Ports.

---

## ❓ FAQ

#### **Q: Is my conversation data uploaded to any server?**
**No.** 100% of your conversation history stays strictly on your local computer inside Chrome's `chrome.storage.local`.

#### **Q: How does local compression work without an API key?**
Capsule includes a 100% offline Local Extractive NLP Engine (`shared/nlp_compress.js`) that uses sentence TF-IDF scoring and verbatim code block extraction right inside your browser. No external API key or network request is needed.

#### **Q: What happens if I am not logged into the destination AI?**
Capsule holds your prompt context safely in storage and displays a floating top bar: `Capsule Context Ready [Inject Now] [Copy]`. Once you log in, Capsule auto-injects your prompt automatically!

#### **Q: How do I export my data?**
Click the Capsule icon in your Chrome toolbar → click **Export All JSON** (or click **Download** on any individual conversation card).

---

## 🤝 Contributing

Contributions are welcome!
1. Fork the Repository.
2. Create a Feature Branch (`git checkout -b feature/NewAIPlatform`).
3. Commit your changes (`git commit -m 'Add New AI Platform'`).
4. Push to the Branch (`git push origin feature/NewAIPlatform`).
5. Open a Pull Request.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for details.

**Author:** Nimish Kanungo  
**GitHub:** [@getnimishk](https://github.com/getnimishk)  
**Repository:** [https://github.com/getnimishk/Capsule](https://github.com/getnimishk/Capsule)
