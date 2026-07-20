// shared/nlp_compress.js
// Local extractive summarisation engine — pure JS, zero external calls.
// Used by background.js as the DEFAULT compression pipeline.
// Gemini API is used ONLY when explicitly selected by the user in Settings.
//
// Algorithm:
//  1. Extract and preserve code blocks verbatim (never summarised)
//  2. Split prose into sentences
//  3. Score each sentence by TF-IDF within the message
//  4. Keep top-K sentences (preserving original order) to hit target ratio
//  5. Short messages (<120 chars) are returned as-is

// ── Code block preservation ──────────────────────────────────────────────────

function extractCodeBlocks(text) {
  const blocks = [];
  let idx = 0;
  const stripped = text.replace(/```[\s\S]*?```/g, (match) => {
    const placeholder = `__NLP_CODE_${idx++}__`;
    blocks.push({ placeholder, code: match });
    return placeholder;
  });
  // Also preserve inline code `...`
  const stripped2 = stripped.replace(/`[^`]+`/g, (match) => {
    const placeholder = `__NLP_INLINE_${idx++}__`;
    blocks.push({ placeholder, code: match });
    return placeholder;
  });
  return { stripped: stripped2, blocks };
}

function restoreCodeBlocks(text, blocks) {
  let result = text;
  for (const { placeholder, code } of blocks) {
    result = result.split(placeholder).join(code);
  }
  return result;
}

// ── Tokeniser ────────────────────────────────────────────────────────────────

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// ── Stop words (common English — ignored in TF-IDF scoring) ─────────────────

const STOP_WORDS = new Set([
  'the','and','for','are','but','not','you','all','can','had','her','was',
  'one','our','out','day','get','has','him','his','how','its','may','who',
  'did','got','let','put','too','use','way','also','been','come','does',
  'each','even','from','give','have','here','just','know','like','make',
  'more','much','need','only','other','over','said','same','see','some',
  'take','than','that','them','then','they','this','time','very','well',
  'were','what','when','will','with','your','there','their','would','should',
  'could','these','those','about','after','being','every','first','going',
  'great','might','often','right','still','think','which','while','where',
]);

// ── Sentence splitter ─────────────────────────────────────────────────────────

function splitSentences(text) {
  // Split on ., !, ? followed by whitespace and uppercase, or newlines
  return text
    .split(/(?<=[.!?])\s+(?=[A-Z])|(?<=\n)\s*(?=[A-Z•\-*\d])/g)
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

// ── TF calculation ────────────────────────────────────────────────────────────

function termFrequency(tokens) {
  const tf = {};
  for (const t of tokens) {
    if (!STOP_WORDS.has(t)) tf[t] = (tf[t] || 0) + 1;
  }
  // Normalize
  const max = Math.max(...Object.values(tf), 1);
  for (const t of Object.keys(tf)) tf[t] /= max;
  return tf;
}

// ── IDF calculation (within document) ────────────────────────────────────────

function inverseDocumentFrequency(sentences) {
  const idf = {};
  const N = sentences.length;
  for (const sent of sentences) {
    const seen = new Set(tokenize(sent).filter(t => !STOP_WORDS.has(t)));
    for (const t of seen) {
      idf[t] = (idf[t] || 0) + 1;
    }
  }
  for (const t of Object.keys(idf)) {
    idf[t] = Math.log((N + 1) / (idf[t] + 1)) + 1;
  }
  return idf;
}

// ── Score a sentence ──────────────────────────────────────────────────────────

function scoreSentence(sentence, tf, idf) {
  const tokens = tokenize(sentence).filter(t => !STOP_WORDS.has(t));
  if (!tokens.length) return 0;
  let score = 0;
  for (const t of tokens) {
    score += (tf[t] || 0) * (idf[t] || 1);
  }
  // Bonus for sentences with numbers (likely contain key data)
  if (/\d/.test(sentence)) score *= 1.1;
  // Penalty for very short sentences (likely transitions)
  if (sentence.split(/\s+/).length < 5) score *= 0.7;
  return score / tokens.length;
}

// ── Main extractive summariser ────────────────────────────────────────────────

/**
 * Extractively summarise text by keeping the most information-dense sentences.
 * @param {string} text - Raw prose text (no code blocks)
 * @param {number} ratio - Retention ratio 0.0–1.0 (default 0.4 = keep 40%)
 * @returns {string} Summarised text
 */
function extractiveSummarize(text, ratio = 0.4) {
  const sentences = splitSentences(text);
  if (sentences.length <= 2) return text; // Too short to compress

  const targetCount = Math.max(1, Math.ceil(sentences.length * ratio));
  if (targetCount >= sentences.length) return text;

  const idf = inverseDocumentFrequency(sentences);

  // Score each sentence
  const scored = sentences.map((sent, idx) => {
    const tokens = tokenize(sent);
    const tf = termFrequency(tokens);
    return {
      idx,
      sent,
      score: scoreSentence(sent, tf, idf),
    };
  });

  // Always keep first and last sentence (they carry topic/conclusion)
  const firstIdx = 0;
  const lastIdx = sentences.length - 1;

  // Sort by score descending, pick top targetCount (excluding forced first/last)
  const middle = scored.filter(s => s.idx !== firstIdx && s.idx !== lastIdx);
  middle.sort((a, b) => b.score - a.score);

  const targetMiddle = Math.max(0, targetCount - 2);
  const kept = new Set([
    firstIdx,
    lastIdx,
    ...middle.slice(0, targetMiddle).map(s => s.idx),
  ]);

  // Rebuild in original order
  return sentences
    .filter((_, i) => kept.has(i))
    .join(' ');
}

// ── Full message compressor with code-block preservation ──────────────────────

/**
 * Compress a single message using local NLP.
 * @param {{type: string, content: string}} message
 * @param {number} ratio - Retention ratio (default 0.4)
 * @returns {{content: string, compressed: boolean, originalLength: number, compressedLength: number}}
 */
function localCompressMessage(message, ratio = 0.4) {
  const { content, type } = message;

  // Skip very short messages
  if (!content || content.length < 120) {
    return { content, compressed: false, originalLength: content?.length || 0, compressedLength: content?.length || 0 };
  }

  const { stripped, blocks } = extractCodeBlocks(content);

  // If after removing code blocks there's not much prose left, skip
  const proseOnly = stripped.replace(/__NLP_CODE_\d+__|__NLP_INLINE_\d+__/g, '').trim();
  if (!proseOnly || proseOnly.length < 80) {
    return { content, compressed: false, originalLength: content.length, compressedLength: content.length };
  }

  // Compress the prose-only portion
  // User messages: higher retention (preserve intent more faithfully)
  const effectiveRatio = type === 'user' ? Math.min(ratio + 0.15, 0.8) : ratio;
  const compressedProse = extractiveSummarize(stripped, effectiveRatio);

  // Restore code blocks
  const restored = restoreCodeBlocks(compressedProse, blocks);

  // Only use compressed if it's meaningfully shorter
  if (restored.length >= content.length * 0.85) {
    return { content, compressed: false, originalLength: content.length, compressedLength: content.length };
  }

  return {
    content: restored,
    compressed: true,
    originalLength: content.length,
    compressedLength: restored.length,
  };
}

/**
 * Compress an array of messages (last 5 user + last 5 assistant, in order).
 * @param {Array} messages
 * @param {number} ratio
 * @returns {Array} Compressed messages with stats
 */
function localCompressConversation(messages, ratio = 0.4) {
  const userMessages    = messages.filter(m => m.type === 'user').slice(-5);
  const assistantMessages = messages.filter(m => m.type === 'assistant').slice(-5);

  const keptUserSet      = new Set(userMessages.map(m => m.timestamp + m.content.slice(0, 40)));
  const keptAssistantSet = new Set(assistantMessages.map(m => m.timestamp + m.content.slice(0, 40)));

  const kept = messages.filter(m => {
    const key = m.timestamp + m.content.slice(0, 40);
    return m.type === 'user' ? keptUserSet.has(key) : keptAssistantSet.has(key);
  });

  return kept.map(msg => {
    const result = localCompressMessage(msg, ratio);
    return { ...msg, content: result.content, compressed: result.compressed,
             originalLength: result.originalLength, compressedLength: result.compressedLength };
  });
}

// ── Handoff Context Extractor ─────────────────────────────────────────────────

/**
 * Extract structured handoff context from a conversation's messages.
 * Fully offline — uses the existing TF-IDF engine.
 *
 * Returns:
 *  {
 *    topic:       string   — top 3-5 keywords describing the conversation subject
 *    decisions:   string[] — sentences asserting conclusions (modal verbs)
 *    questions:   string[] — unresolved questions from the user
 *    techTerms:   string[] — top domain-specific technical terms
 *    lastSummary: string   — extractive summary of the last assistant message
 *    lastUserMsg: string   — verbatim last user message (≤300 chars)
 *    platform:    string   — source AI platform name
 *    msgCount:    number   — total message count
 *  }
 *
 * @param {Array<{type:string, content:string}>} messages
 * @param {string} [platform]
 * @returns {Object}
 */
function extractHandoffContext(messages, platform = 'AI') {
  const userMsgs      = messages.filter(m => m.type === 'user');
  const assistantMsgs = messages.filter(m => m.type === 'assistant');

  if (!messages.length) {
    return { topic: 'Unknown', decisions: [], questions: [], techTerms: [],
             lastSummary: '', lastUserMsg: '', platform, msgCount: 0 };
  }

  // ── 1. Topic: TF-IDF keywords across ALL user messages ──────────────────────
  const allUserText = userMsgs.map(m => m.content).join(' ');
  const topic = _extractTopKeywords(allUserText, 5).join(', ') || 'General Discussion';

  // ── 2. Decisions: sentences with strong modal/conclusive verbs ───────────────
  //    Scans both user and assistant messages for commitment language.
  const DECISION_PATTERN = /\b(should|must|will|shall|need to|have to|decided|agreed|use|always|never|avoid|prefer|recommend|ensure|let'?s)\b/i;
  const decisions = [];
  for (const msg of messages) {
    const sentences = splitSentences(msg.content);
    for (const s of sentences) {
      const clean = s.trim();
      if (clean.length < 20) continue;
      if (DECISION_PATTERN.test(clean) && !clean.endsWith('?')) {
        // Skip very generic filler sentences
        if (!/^(you |i |we |it |this |that |there |here )/i.test(clean) || clean.length > 60) {
          decisions.push(clean);
        }
      }
    }
  }
  // Deduplicate and cap at 8 most relevant decisions (prefer longer = more specific)
  const uniqueDecisions = [...new Set(decisions)]
    .sort((a, b) => b.length - a.length)
    .slice(0, 8);

  // ── 3. Open Questions: user sentences ending with "?" ────────────────────────
  const questions = [];
  for (const msg of userMsgs) {
    const sentences = splitSentences(msg.content);
    for (const s of sentences) {
      const clean = s.trim();
      if (clean.endsWith('?') && clean.length > 15) {
        questions.push(clean);
      }
    }
  }
  const uniqueQuestions = [...new Set(questions)].slice(0, 6);

  // ── 4. Technical Terms: high-IDF tokens that look like domain jargon ─────────
  //    Jargon heuristic: camelCase, ALL_CAPS, contains digits, or known tech suffixes
  const TECH_PATTERN = /^([A-Z]{2,}|[a-z]+[A-Z][a-z]+|[a-z]+[-_][a-z]+|\w+(?:js|api|sdk|db|ml|ai|io|rpc|sql|mq|ql)$|\w*\d+\w*)/;
  const techTokens   = tokenize(allUserText + ' ' + assistantMsgs.map(m => m.content).join(' '));
  const techFreq     = {};
  for (const t of techTokens) {
    if (!STOP_WORDS.has(t) && (TECH_PATTERN.test(t) || t.length > 7)) {
      techFreq[t] = (techFreq[t] || 0) + 1;
    }
  }
  const techTerms = Object.entries(techFreq)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([t]) => t);

  // ── 5. Last AI response summary ───────────────────────────────────────────────
  const lastAssistant = assistantMsgs[assistantMsgs.length - 1];
  let lastSummary = '';
  if (lastAssistant) {
    const { stripped } = extractCodeBlocks(lastAssistant.content);
    lastSummary = extractiveSummarize(stripped, 0.3).slice(0, 500).trim();
  }

  // ── 6. Last user message (verbatim, capped) ───────────────────────────────────
  const lastUserMsg = (userMsgs[userMsgs.length - 1]?.content || '').slice(0, 300).trim();

  return {
    topic,
    decisions:   uniqueDecisions,
    questions:   uniqueQuestions,
    techTerms,
    lastSummary,
    lastUserMsg,
    platform,
    msgCount:    messages.length,
  };
}

/**
 * Extract the top N most significant keywords from a text block using TF-IDF.
 * @param {string} text
 * @param {number} n
 * @returns {string[]}
 */
function _extractTopKeywords(text, n = 5) {
  if (!text || text.trim().length < 10) return [];
  const sentences = splitSentences(text);
  const allTokens = tokenize(text).filter(t => !STOP_WORDS.has(t) && t.length > 3);
  if (!allTokens.length) return [];

  const idf = inverseDocumentFrequency(sentences.length > 1 ? sentences : [text]);
  const tf  = termFrequency(allTokens);

  return Object.entries(tf)
    .map(([t, tfScore]) => ({ t, score: tfScore * (idf[t] || 1) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map(({ t }) => t);
}

// ── Export for background.js (importScripts) ──────────────────────────────────
if (typeof self !== 'undefined') {
  self.localCompressMessage      = localCompressMessage;
  self.localCompressConversation = localCompressConversation;
  self.extractHandoffContext     = extractHandoffContext;
}
