/**
 * The client twin of `server/scripts/seed/guides/blocks.js`.
 *
 * That file calls itself "the one place a block's shape is spelled out"; this
 * is the same list for the editor, so the two stay legible side by side. Every
 * entry knows how to make a blank block of its type, how to summarise one in a
 * line, and how to tell you it is broken before you save it.
 */

let seq = 0;
/**
 * A client-only key.
 *
 * Blocks are plain objects with no id, so an index key breaks the moment you
 * reorder or delete: the cursor position, which card is collapsed and which
 * code tab is open all jump to the wrong block. This never leaves the browser
 * — `toPayload` strips it.
 */
export const nextKey = () => `b${(seq += 1)}`;

export const BLOCK_KINDS = [
  {
    type: 'heading',
    label: 'Heading',
    fields: ['text'],
    blank: () => ({ text: '' }),
    summary: (b) => b.text,
    validate: (b) => (b.text.trim() ? '' : 'A heading with no text renders as an empty anchor'),
  },
  {
    type: 'paragraph',
    label: 'Paragraph',
    fields: ['text'],
    blank: () => ({ text: '' }),
    summary: (b) => b.text,
    validate: (b) => (b.text.trim() ? '' : 'Empty paragraph'),
  },
  {
    type: 'bullets',
    label: 'Bullets',
    fields: ['items'],
    blank: () => ({ items: [''] }),
    summary: (b) => b.items.filter(Boolean).join(' · '),
    validate: (b) => (b.items.some((i) => i.trim()) ? '' : 'No bullets with any text'),
  },
  {
    type: 'code',
    label: 'Code',
    fields: ['variants'],
    // Java first — the seed files set that order and the reader shows the first
    // variant before anyone touches a tab.
    blank: () => ({ variants: [{ lang: 'java', label: 'Java', code: '', _k: nextKey() }] }),
    summary: (b) => b.variants.map((v) => v.label || v.lang).join(' · '),
    validate: (b) =>
      b.variants.length === 0
        ? 'A code block with no variants renders as nothing'
        : b.variants.every((v) => v.code.trim())
          ? ''
          : 'One of the variants is empty',
  },
  {
    type: 'callout',
    label: 'Callout',
    fields: ['text', 'tone'],
    blank: () => ({ text: '', tone: 'note' }),
    summary: (b) => b.text,
    validate: (b) => (b.text.trim() ? '' : 'Empty callout'),
  },
  {
    type: 'table',
    label: 'Table',
    /*
      `caption` and `variant` are listed here for a reason worth stating: this
      array is what `toPayload` copies, and *only* what it copies. They were
      missing, so a table carrying either one lost it in the browser before the
      request was even sent — and the matching gap in the server's zod would
      have stripped whatever survived. Both halves had to be fixed together;
      either alone fixes nothing.

      A sample table and a result grid are the two halves of every SQL topic in
      Learn, and `caption` is the name the FROM clause below the grid uses.
    */
    fields: ['columns', 'rows', 'caption', 'variant'],
    blank: () => ({ columns: ['', ''], rows: [['', '']], caption: '', variant: '' }),
    summary: (b) =>
      [b.caption, `${b.columns.length} columns · ${b.rows.length} rows`].filter(Boolean).join(' — '),
    validate: (b) => {
      const bad = b.rows.findIndex((r) => r.length !== b.columns.length);
      return bad < 0
        ? ''
        : `Row ${bad + 1} has ${b.rows[bad].length} cells but there are ${b.columns.length} columns`;
    },
  },
  {
    type: 'image',
    label: 'Image',
    fields: ['url', 'text'],
    blank: () => ({ url: '', text: '' }),
    summary: (b) => b.text || b.url,
    validate: (b) => (b.url.trim() ? '' : 'No image URL'),
  },
  {
    type: 'video',
    label: 'Video',
    fields: ['videoId', 'text'],
    blank: () => ({ videoId: '', text: '' }),
    summary: (b) => b.text || b.videoId,
    validate: (b) =>
      /^[\w-]{6,20}$/.test(b.videoId)
        ? ''
        : 'That is not a YouTube id — paste the watch URL and it will be extracted',
  },
  {
    type: 'links',
    label: 'Links',
    fields: ['links'],
    blank: () => ({ links: [{ label: '', url: '', source: '', _k: nextKey() }] }),
    summary: (b) => b.links.map((l) => l.label).filter(Boolean).join(' · '),
    validate: (b) =>
      b.links.every((l) => l.label.trim() && l.url.trim()) ? '' : 'A link is missing its label or URL',
  },
];

export const KIND = Object.fromEntries(BLOCK_KINDS.map((k) => [k.type, k]));

export const blankBlock = (type) => ({ type, _k: nextKey(), ...KIND[type].blank() });

/** Stamps keys onto a guide loaded from the server, blocks and nested rows alike. */
export const withKeys = (block) => ({
  ...block,
  _k: nextKey(),
  ...(block.variants ? { variants: block.variants.map((v) => ({ ...v, _k: nextKey() })) } : {}),
  ...(block.links ? { links: block.links.map((l) => ({ ...l, _k: nextKey() })) } : {}),
});

/**
 * Exactly what the server stores.
 *
 * Strips `_k`, and keeps only the fields this block's type owns — so a block
 * whose type was switched mid-edit does not carry its previous type's fields
 * into Mongo. The live preview renders this rather than the draft, which makes
 * the preview a guarantee about what will be saved rather than an approximation.
 */
export const toPayload = (block) => {
  const out = { type: block.type };
  for (const field of KIND[block.type].fields) {
    if (field === 'variants') {
      out.variants = block.variants.map(({ _k, ...v }) => v);
    } else if (field === 'links') {
      out.links = block.links.map(({ _k, ...l }) => l);
    } else {
      out[field] = block[field];
    }
  }
  return out;
};

/** Mirrors `link()` in the seeder — nobody should have to type the hostname twice. */
export const deriveSource = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Pulls the id out of any YouTube URL shape, or passes a bare id through.
 *
 * Without this the first video block anyone adds is a dead iframe: the reader
 * interpolates this value straight into the embed src, so a full watch URL
 * produces `youtube-nocookie.com/embed/https://...` and fails silently.
 */
export const extractVideoId = (value) => {
  const trimmed = String(value || '').trim();
  if (/^[\w-]{6,20}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{6,20})/);
  return match ? match[1] : trimmed;
};

/** Moves an item, returning a new array. Same helper ColumnsModal uses. */
export const move = (list, from, to) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};
