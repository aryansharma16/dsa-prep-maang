import { Message } from '../../models/Message.js';

/**
 * The past turns worth replaying, trimmed to a budget.
 *
 * Budgeted in characters, not tokens, and that is a deliberate refusal rather
 * than an oversight. Counting tokens properly means a tokenizer — a native
 * dependency, per-provider, for a number that only has to be *conservative*.
 * `chars / 4` is the standard heuristic; being 20% wrong inside a 12k-character
 * budget against a 32k+ context window costs nothing. Someone will eventually
 * want to "fix" this by adding tiktoken. This paragraph is why they should not.
 */

/** ~3k tokens of history. Leaves the reply and the system prompt plenty of room. */
const CHAR_BUDGET = 12000;

/** Marks a reply the model never got to finish, so it does not treat it as complete. */
const INTERRUPTED = ' …[interrupted]';

export async function recentTurns(conversationId, maxMessages) {
  if (!conversationId) return [];

  /*
    Descending with a limit walks the {conversation, createdAt} index backwards
    and stops. Sorting ascending would read the whole thread before discarding
    all but the tail — fine at ten messages, wasteful at two hundred, and the
    retention setting decides which of those a thread gets to be.
  */
  const rows = await Message.find({ conversation: conversationId })
    .sort({ createdAt: -1 })
    .limit(maxMessages)
    .select('role content truncated')
    .lean();

  const turns = [];
  let chars = 0;

  for (const row of rows) {
    const content = row.truncated ? `${row.content}${INTERRUPTED}` : row.content;
    if (chars + content.length > CHAR_BUDGET && turns.length) break;
    chars += content.length;
    turns.push({ role: row.role, content });
  }

  turns.reverse();

  /*
    Trimming can leave the window starting on an assistant turn — a reply whose
    question fell off the back. Several OpenAI-compatible hosts handle that
    badly, and none of them handle it usefully: the model is being shown its own
    answer to a question nobody asked. Drop it.
  */
  while (turns.length && turns[0].role === 'assistant') turns.shift();

  return turns;
}

/**
 * A heuristic title, available immediately.
 *
 * The model writes a better one afterwards, but that takes a round trip, and a
 * sidebar that says "New chat" until it lands looks broken. This is the value
 * that ships with the first frame; the good one replaces it if it arrives.
 */
export function draftTitle(text) {
  const flat = String(text).replace(/\s+/g, ' ').trim();
  if (flat.length <= 60) return flat || 'New chat';
  return `${flat.slice(0, 57).trimEnd()}…`;
}

/** Model titles arrive quoted, prefixed and punctuated no matter what you ask for. */
export function cleanTitle(raw) {
  const text = String(raw || '')
    .split('\n')[0]
    .replace(/^["'`*\s]+|["'`*\s.]+$/g, '')
    .replace(/^(title|topic)\s*:\s*/i, '')
    .trim();
  if (!text || text.length > 80) return null;
  return text;
}
