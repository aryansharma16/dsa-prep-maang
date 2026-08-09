/**
 * One OpenAI-compatible transport, three providers.
 *
 * Cerebras, DeepSeek and xAI speak the same wire protocol, so what actually
 * differs between them is a host, a key and a list of model ids — data, not
 * code. Writing three copies of this would mean three copies of the frame
 * parser below, and that parser has exactly one hard bug in it: a `data: {...}`
 * line arriving split across two TCP reads. Three copies is three chances to
 * get that wrong and three places to fix it.
 *
 * Native fetch rather than the `openai` package, matching leetcode.service.js.
 * The SDK would add a client per provider, its own retry and timeout policy
 * fighting the AbortController this codebase uses everywhere, and you would
 * still have to know what `choices[0].delta.content` means to do anything.
 */

/** Frames are separated by a blank line. \r\n is legal and some proxies emit it. */
const FRAME_SEP = /\r?\n\r?\n/;

/**
 * Read one `data:` payload out of an SSE frame.
 *
 * Lines beginning with `:` are comments — every one of these providers uses
 * them as keep-alives. A frame may carry several `data:` lines, which the spec
 * says to join with newlines; none of these providers does that today, but
 * honouring it costs one `join` and means a provider that starts to will not
 * silently truncate.
 */
function frameData(frame) {
  const parts = [];
  for (const line of frame.split(/\r?\n/)) {
    if (!line || line.startsWith(':')) continue;
    if (!line.startsWith('data:')) continue;
    // Exactly one leading space belongs to the framing, not to the value.
    parts.push(line.slice(5).replace(/^ /, ''));
  }
  return parts.length ? parts.join('\n') : null;
}

/**
 * A failed request is not a stream.
 *
 * Reading `res.body` on a 4xx gives you a JSON error document parsed one chunk
 * at a time as though it were tokens. The status has to be checked first, and
 * the body has to come back attached to the thrown error — the registry
 * classifies a 429 by whether the text says "per day", which it cannot do if
 * the text was thrown away here.
 */
async function assertOk(res, providerId) {
  if (res.ok) return;
  const body = await res.text().catch(() => '');
  const error = new Error(`${providerId} responded ${res.status}`);
  error.status = res.status;
  error.body = body.slice(0, 1000);
  error.retryAfter = res.headers.get('retry-after');
  throw error;
}

function buildBody({ messages, system, model, temperature, maxTokens, stream, supportsUsage }) {
  return JSON.stringify({
    model,
    messages: system ? [{ role: 'system', content: system }, ...messages] : messages,
    stream,
    temperature,
    max_tokens: maxTokens,
    // Only when the provider is known to accept it: xAI's support is unverified
    // and an unknown field is a 400 on some hosts. A flag beats a try/catch.
    ...(stream && supportsUsage ? { stream_options: { include_usage: true } } : {}),
  });
}

const headersFor = (apiKey) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${apiKey}`,
  Accept: 'text/event-stream',
});

/**
 * Stream a completion.
 *
 * An async generator rather than a callback or something that writes to `res`.
 * That is load-bearing: it lets the caller pull the first token and decide
 * whether to commit HTTP headers, which is the whole mechanism behind
 * failing over to another provider invisibly. A provider that wrote to the
 * response directly would make pre-first-token failover impossible.
 *
 * Yields `{type:'delta', text}` then exactly one `{type:'done', finish, usage}`.
 */
export async function* streamOpenAiCompatible(config, params) {
  const { id, baseUrl, apiKey, supportsUsage = true } = config;
  const { messages, system, model, temperature = 0.3, maxTokens = 700, signal } = params;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: buildBody({ messages, system, model, temperature, maxTokens, stream: true, supportsUsage }),
    signal,
  });

  await assertOk(res, id);
  if (!res.body) throw new Error(`${id} returned no body`);

  const decoder = new TextDecoder();
  let buffer = '';
  let finish = 'stop';
  let usage = null;

  for await (const chunk of res.body) {
    // `stream: true` holds back a multi-byte character split across two reads
    // rather than decoding half of it into a replacement character.
    buffer += decoder.decode(chunk, { stream: true });

    let match;
    while ((match = FRAME_SEP.exec(buffer)) !== null) {
      const frame = buffer.slice(0, match.index);
      buffer = buffer.slice(match.index + match[0].length);

      const data = frameData(frame);
      if (data === null) continue;
      if (data === '[DONE]') {
        yield { type: 'done', finish, usage };
        return;
      }

      let payload;
      try {
        payload = JSON.parse(data);
      } catch {
        // A frame we cannot parse is one lost token, not a dead stream. The
        // alternative — throwing — would discard everything already delivered.
        continue;
      }

      // The usage-only final chunk carries an empty `choices` array. Indexing
      // into it without this check is a TypeError at the very end of an
      // otherwise perfect response.
      if (payload.usage) {
        usage = { in: payload.usage.prompt_tokens ?? 0, out: payload.usage.completion_tokens ?? 0 };
      }
      const choice = payload.choices?.[0];
      if (!choice) continue;
      if (choice.finish_reason) finish = choice.finish_reason;

      /*
        `delta.reasoning_content` is GLM's and DeepSeek's chain of thought. It
        is deliberately dropped rather than forwarded: this assistant exists to
        give short answers, and streaming a model's deliberation to someone who
        asked what a hash map is delivers the opposite of that. Only real
        content is a token as far as the rest of the app is concerned.
      */
      const text = choice.delta?.content;
      if (typeof text === 'string' && text.length) yield { type: 'delta', text };
    }
  }

  // The stream ended without a [DONE] frame. Every provider sends one, but the
  // socket closing cleanly is still a complete answer — do not throw here.
  yield { type: 'done', finish, usage };
}

/** One-shot, no streaming. Used for auto-titling, where there is nobody watching. */
export async function completeOpenAiCompatible(config, params) {
  const { id, baseUrl, apiKey } = config;
  const { messages, system, model, temperature = 0.3, maxTokens = 64, signal } = params;

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: headersFor(apiKey),
    body: buildBody({ messages, system, model, temperature, maxTokens, stream: false }),
    signal,
  });

  await assertOk(res, id);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? '';
}
