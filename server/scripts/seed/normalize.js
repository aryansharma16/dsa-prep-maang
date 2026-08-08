/**
 * The Striver scrape was written out as CP437 instead of UTF-8, so "Kruskal's"
 * arrives as "KruskalΓÇÖs" — the three CP437 glyphs for bytes E2 80 99. Mapping
 * each glyph back to its byte and re-decoding as UTF-8 repairs every such
 * sequence, not just the apostrophes we happen to have seen.
 */
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅ' +
  'ÉæÆôöòûùÿÖÜ¢£¥₧ƒ' +
  'áíóúñÑªº¿⌐¬½¼¡«»' +
  '░▒▓│┤╡╢╖╕╣║╗╝╜╛┐' +
  '└┴┬├─┼╞╟╚╔╩╦╠═╬╧' +
  '╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀' +
  'αßΓπΣσµτΦΘΩδ∞φε∩' +
  '≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

const BYTE_OF = new Map([...CP437_HIGH].map((ch, i) => [ch, 0x80 + i]));

// A mojibake run is 2-3 of these glyphs in a row; ASCII passes through untouched.
const RUN = new RegExp(`[${CP437_HIGH.replace(/[\\\]^-]/g, '\\$&')}]{2,}`, 'g');

export function fixEncoding(text) {
  if (typeof text !== 'string' || !RUN.test(text)) return text;
  RUN.lastIndex = 0;

  return text.replace(RUN, (run) => {
    const bytes = [];
    for (const ch of run) {
      const byte = BYTE_OF.get(ch);
      if (byte === undefined) return run;
      bytes.push(byte);
    }
    const decoded = Buffer.from(bytes).toString('utf8');
    // If it did not round-trip to something sane, leave the original alone.
    return decoded.includes('�') ? run : decoded;
  });
}

/** Collapse whitespace and repair encoding — every title goes through this. */
export function cleanTitle(text) {
  return fixEncoding(String(text || ''))
    .replace(/\s+/g, ' ')
    .trim();
}
