/**
 * Element ids, minted in the browser.
 *
 * A shape needs an id the moment it is drawn — to be selected, connected to,
 * undone — long before any save reaches the server, so ids cannot come from
 * the database. 21 base-62 characters is ~125 bits: collisions are not a
 * practical concern, even across every board anyone will ever draw.
 *
 * `crypto.getRandomValues` rather than `crypto.randomUUID`, because the latter
 * only exists in a secure context and a phone opening the dev server over the
 * LAN at http://192.168.x.x is not one.
 */

const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function newId(length = 21) {
  const bytes = new Uint8Array(length);
  globalThis.crypto.getRandomValues(bytes);
  let id = '';
  // 62 * 4 = 248, so taking bytes below 248 keeps the distribution uniform.
  for (let i = 0; i < length; i += 1) {
    let byte = bytes[i];
    while (byte >= 248) {
      const extra = new Uint8Array(1);
      globalThis.crypto.getRandomValues(extra);
      byte = extra[0];
    }
    id += ALPHABET[byte % 62];
  }
  return id;
}

/** A 24-hex id the server accepts as an ObjectId, for idempotent creates. */
export function newObjectId() {
  const seconds = Math.floor(Date.now() / 1000).toString(16).padStart(8, '0');
  const bytes = new Uint8Array(8);
  globalThis.crypto.getRandomValues(bytes);
  return seconds + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}
