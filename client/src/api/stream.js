import { AUTH_EXPIRED_EVENT, baseURL, refreshSession } from './http.js';

/**
 * Server-sent events, over fetch.
 *
 * This is the one request in the app that does not go through the axios
 * instance, for the one reason that matters: XHR gives you a string that grows,
 * not a stream you can read as it arrives. The cost is that everything http.js
 * provides for free has to be re-stated here — the same base URL, so cookies
 * stay first-party through the Vite proxy in dev and the Vercel rewrite in
 * prod, and the same refresh-once-on-401 behaviour, since no interceptor can
 * see this call.
 */

/** Frames are separated by a blank line. \r\n is legal and some proxies emit it. */
const FRAME_SEP = /\r?\n\r?\n/;

function parseFrame(frame) {
  let event = 'message';
  const data = [];

  for (const line of frame.split(/\r?\n/)) {
    // Blank, or a `:` heartbeat keeping an idle proxy from hanging up.
    if (!line || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    // Exactly one leading space belongs to the framing, not the value.
    const value = colon === -1 ? '' : line.slice(colon + 1).replace(/^ /, '');
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }

  return data.length ? { event, data: data.join('\n') } : null;
}

const post = (path, body, signal) =>
  fetch(`${baseURL}${path}`, {
    method: 'POST',
    // Cookie auth, same as the axios instance. No Authorization header exists.
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify(body),
    signal,
  });

async function open(path, body, signal) {
  let res = await post(path, body, signal);

  /*
    A 15-minute access token can expire between two messages, and this request
    is invisible to the interceptor that normally handles that. Do its job once,
    through refreshSession() so a refresh already in flight is shared rather
    than raced. A 401 *during* a stream cannot happen: the response was already
    authorised before the first byte.
  */
  if (res.status === 401) {
    const code = await res
      .clone()
      .json()
      .then((d) => d?.error?.code)
      .catch(() => null);

    if (code === 'TOKEN_EXPIRED' || code === 'NO_TOKEN') {
      try {
        await refreshSession();
      } catch {
        window.dispatchEvent(new CustomEvent(AUTH_EXPIRED_EVENT));
        throw new Error('Your session expired. Sign in again.');
      }
      res = await post(path, body, signal);
    }
  }

  if (!res.ok) {
    // Everything that fails before the first token is an ordinary HTTP error
    // with a real status — the server is built that way so this stays simple.
    const payload = await res.json().catch(() => null);
    const error = new Error(payload?.error?.message || `The assistant is unavailable (${res.status})`);
    error.code = payload?.error?.code;
    error.status = res.status;
    error.meta = payload?.error?.meta;
    throw error;
  }

  if (!res.body) throw new Error('This browser cannot stream responses.');
  return res;
}

/**
 * Opens the stream and calls `onEvent` per frame. Resolves when the server
 * closes it. Aborting the signal rejects with an AbortError, which the caller
 * is expected to treat as "the reader pressed stop", not as a failure.
 */
export async function streamChat(body, { signal, onEvent }) {
  const res = await open('/chat/stream', body, signal);
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      // stream:true holds back a multi-byte character split across two chunks
      // rather than decoding half of it into a replacement character.
      buffer += decoder.decode(value, { stream: true });

      let match;
      // No /g flag, so exec always scans from index 0 and there is no lastIndex
      // to reset between iterations.
      while ((match = FRAME_SEP.exec(buffer)) !== null) {
        const frame = buffer.slice(0, match.index);
        buffer = buffer.slice(match.index + match[0].length);
        const parsed = parseFrame(frame);
        if (parsed) onEvent(parsed);
      }
    }
  } finally {
    // An abort, a throw from onEvent, and a clean finish all land here.
    reader.cancel().catch(() => {});
  }
}
