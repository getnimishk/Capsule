// shared/core/storage.js
// Handles storage, data compression, and fingerprinting for Capsule.

window.CapsuleStorage = (function() {
  const STORAGE_KEY = "claude_conversations";
  const MAX_CONVERSATIONS = 50;

  function extractCodeBlocks(text) {
    const blocks = [];
    let idx = 0;
    const stripped = text.replace(/```[\s\S]*?```/g, (match) => {
      const placeholder = `__CODE_BLOCK_${idx++}__`;
      blocks.push({ placeholder, code: match });
      return placeholder;
    });
    return { stripped, blocks };
  }

  function restoreCodeBlocks(text, blocks) {
    let result = text;
    for (const { placeholder, code } of blocks) {
      result = result.replace(placeholder, code);
    }
    return result;
  }

  async function compressMessage(message) {
    const { content, type } = message;
    if (!content || content.length < 120) return { ...message, compressed: false };

    const { stripped, blocks } = extractCodeBlocks(content);
    const proseOnly = stripped.replace(/__CODE_BLOCK_\d+__/g, "").trim();
    if (!proseOnly) return { ...message, compressed: false };

    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: "compressMessage", type, content: stripped },
        (response) => {
          if (chrome.runtime.lastError || !response?.ok || !response?.compressed) {
            resolve({ ...message, compressed: false });
            return;
          }
          const compressedContent = restoreCodeBlocks(response.compressed, blocks);
          resolve({ ...message, content: compressedContent, compressed: true });
        }
      );
    });
  }

  async function compressConversation(messages) {
    const userMessages = messages.filter((m) => m.type === "user").slice(-5);
    const assistantMessages = messages.filter((m) => m.type === "assistant").slice(-5);

    const keptUserSet = new Set(userMessages.map((m) => m.timestamp + m.content.slice(0, 40)));
    const keptAssistantSet = new Set(assistantMessages.map((m) => m.timestamp + m.content.slice(0, 40)));

    const kept = messages.filter((m) => {
      const key = m.timestamp + m.content.slice(0, 40);
      return m.type === "user" ? keptUserSet.has(key) : keptAssistantSet.has(key);
    });

    return await Promise.all(kept.map((msg) => compressMessage(msg)));
  }

  async function generateFingerprint(messages) {
    try {
      const seed = messages
        .filter(m => m.type === 'user')
        .slice(0, 3)
        .map(m => m.content.slice(0, 100))
        .join('||');
      if (!seed) return null;
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(seed));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    } catch { return null; }
  }

  const Capsule = {
    async build(messages, url, source = "claude") {
      const title = this._inferTitle(messages, url);
      const fingerprint = await generateFingerprint(messages);
      return {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        title, url, messages, fingerprint,
        savedAt: new Date().toISOString(),
        source,
        version: 1,
      };
    },
    _inferTitle(messages, url) {
      const firstUser = messages.find((m) => m.type === "user");
      if (firstUser && firstUser.content.length > 0) {
        return firstUser.content.substring(0, 60).replace(/\n/g, " ").trim() +
          (firstUser.content.length > 60 ? "â€¦" : "");
      }
      try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        return parts[parts.length - 1] || "Untitled Conversation";
      } catch { return "Untitled Conversation"; }
    },
  };

  function getAll() {
    return new Promise((resolve) => {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (chrome.runtime.lastError) { resolve([]); return; }
        resolve(result[STORAGE_KEY] || []);
      });
    });
  }

  async function save(conversation) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ action: 'saveConversation', conversation }, response => {
        if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
        else if (!response?.ok) reject(new Error(response?.error || 'Unable to save conversation.'));
        else resolve(response);
      });
    });
  }

  function formatContextBlock(conversation, aiName = "AI") {
    if (!conversation?.messages?.length) return null;
    const lines = [
      `[CONTEXT HANDOFF â€” Do NOT reply to this message]`,
      ``,
      `The following is the full context of a conversation I was having on ${aiName}.`,
      `Please read and remember this context. Do not respond to it.`,
      `I will send my next message separately to continue the conversation.`,
      ``,
      `--- Conversation: "${conversation.title || "Untitled"}" ---`,
      `Saved: ${new Date(conversation.savedAt).toLocaleString()}`,
      ``,
    ];
    for (const msg of conversation.messages) {
      lines.push(`${msg.type === "user" ? "User" : aiName}: ${msg.content}`, "");
    }
    lines.push(
      `--- End of context ---`,
      ``,
      `(Please acknowledge you have read the above context by saying "Got it â€” context received." ` +
      `Then wait for my next message.)`
    );
    return lines.join("\n");
  }

  return {
    compressConversation,
    generateFingerprint,
    Capsule,
    getAll,
    save,
    formatContextBlock
  };
})();
