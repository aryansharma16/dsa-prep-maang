import {
  IconAlert,
  IconCode,
  IconDivider,
  IconFile,
  IconGallery,
  IconHeading,
  IconImage,
  IconLink,
  IconList,
  IconPlay,
  IconQuote,
  IconTable,
  IconText,
  IconToggle,
} from '../ui/Icons.jsx';

/**
 * The client twin of the zod union in `server/src/controllers/note.controller.js`.
 *
 * Same job `blockKinds.js` does for the admin guide editor, and deliberately a
 * separate file rather than an extension of it: guides and notes overlap on six
 * types and disagree on the rest, and the day one grows a type the other should
 * not inherit it by accident.
 *
 * Every entry knows six things — what to call it, what colour it wears, how to
 * make a blank one, how to describe one in a line, whether it is finished, and
 * exactly which fields the server will accept. That last one is what keeps a
 * block that was switched from `code` to `quote` mid-edit from carrying 40KB of
 * dead source into the request.
 */

let seq = 0;

/**
 * A client-only key.
 *
 * Blocks *do* carry a server `id`, unlike the guide editor's — but not until
 * they have been saved once, and a block being typed into needs a stable
 * identity from the moment it appears. An index key breaks on every reorder:
 * the caret jumps, the collapsed card changes, the open code tab moves.
 */
export const nextKey = () => `nb${(seq += 1)}`;

/**
 * The hue each type wears, as a token name resolved in app.css.
 *
 * Colour is doing real work here rather than decorating: fourteen types is past
 * the count anyone reads as a list, and the stripe down a block's left edge is
 * what lets you find the code block in a long note by glancing at the gutter.
 * It appears in exactly three places — the palette glyph, that stripe, and the
 * type badge — and never behind body text, where it would fight the reading.
 */
const HUE = {
  heading: 'violet',
  paragraph: 'slate',
  list: 'teal',
  dropdown: 'fuchsia',
  callout: 'amber',
  code: 'blue',
  quote: 'pink',
  links: 'sky',
  image: 'green',
  gallery: 'lime',
  file: 'orange',
  video: 'red',
  table: 'indigo',
  divider: 'slate',
};

const trimmed = (value) => String(value || '').trim();

/** Shared by every asset-carrying type: is there actually a file behind it. */
const needsAsset = (block) => (block.asset?.fileId ? '' : 'No file attached yet');

export const BLOCK_TYPES = [
  {
    type: 'heading',
    label: 'Heading',
    hint: 'A section title. Shows up in the contents rail.',
    group: 'Write',
    icon: IconHeading,
    keywords: 'title section h2 h3',
    fields: ['text', 'level'],
    blank: () => ({ text: '', level: 2 }),
    summary: (b) => b.text,
    validate: (b) => (trimmed(b.text) ? '' : 'A heading with no text renders as an empty anchor'),
  },
  {
    type: 'paragraph',
    label: 'Text',
    hint: 'Plain prose. **bold**, _italic_, `code` and [links](url) work inline.',
    group: 'Write',
    icon: IconText,
    keywords: 'paragraph prose body p',
    fields: ['text'],
    blank: () => ({ text: '' }),
    summary: (b) => b.text,
    validate: () => '',
  },
  {
    type: 'list',
    label: 'Points',
    hint: 'Bullets, numbers, a checklist or arrows. Tab indents.',
    group: 'Write',
    icon: IconList,
    keywords: 'bullets numbered checklist todo steps points ul ol',
    fields: ['items', 'variant'],
    blank: () => ({ variant: 'bullet', items: [{ text: '', checked: false, depth: 0 }] }),
    summary: (b) => b.items.map((i) => i.text).filter(Boolean).join(' · '),
    validate: (b) => (b.items.some((i) => trimmed(i.text)) ? '' : 'No points with any text'),
  },
  {
    type: 'callout',
    label: 'Callout',
    hint: 'The bit you want to survive skim-reading.',
    group: 'Write',
    icon: IconAlert,
    keywords: 'note tip warning danger success aside gotcha',
    fields: ['text', 'tone', 'title'],
    blank: () => ({ tone: 'note', title: '', text: '' }),
    summary: (b) => b.title || b.text,
    validate: (b) => (trimmed(b.text) ? '' : 'Empty callout'),
  },
  {
    type: 'quote',
    label: 'Quote',
    hint: 'Someone else’s words, or your own from a bad day.',
    group: 'Write',
    icon: IconQuote,
    keywords: 'blockquote cite',
    fields: ['text', 'cite'],
    blank: () => ({ text: '', cite: '' }),
    summary: (b) => b.text,
    validate: (b) => (trimmed(b.text) ? '' : 'Empty quote'),
  },

  {
    type: 'code',
    label: 'Code',
    hint: 'One snippet, or several languages as tabs.',
    group: 'Show',
    icon: IconCode,
    keywords: 'snippet source terminal shell stack trace error',
    fields: ['variants', 'caption'],
    blank: () => ({
      variants: [{ lang: 'javascript', label: '', filename: '', code: '', _k: nextKey() }],
      caption: '',
    }),
    summary: (b) => b.variants.map((v) => v.filename || v.label || v.lang).join(' · '),
    validate: (b) =>
      !b.variants.length
        ? 'A code block with no tabs renders as nothing'
        : b.variants.every((v) => trimmed(v.code))
          ? ''
          : 'One of the tabs is empty',
  },
  {
    type: 'image',
    label: 'Image',
    hint: 'A screenshot. Drag one straight onto the page.',
    group: 'Show',
    icon: IconImage,
    keywords: 'picture screenshot photo png jpg upload',
    fields: ['asset', 'caption', 'align', 'width'],
    blank: () => ({ asset: null, caption: '', align: 'center', width: 'full' }),
    summary: (b) => b.caption || b.asset?.name || '',
    validate: needsAsset,
  },
  {
    type: 'gallery',
    label: 'Gallery',
    hint: 'Several images in a row — before and after.',
    group: 'Show',
    icon: IconGallery,
    keywords: 'images grid screenshots multiple',
    fields: ['assets', 'caption', 'width'],
    blank: () => ({ assets: [], caption: '', width: 'full' }),
    summary: (b) => b.caption || `${b.assets?.length || 0} images`,
    validate: (b) => (b.assets?.length ? '' : 'No images added yet'),
  },
  {
    type: 'file',
    label: 'PDF / file',
    hint: 'A PDF to read inline or download.',
    group: 'Show',
    icon: IconFile,
    keywords: 'pdf document attachment download doc',
    fields: ['asset', 'title', 'caption'],
    blank: () => ({ asset: null, title: '', caption: '' }),
    summary: (b) => b.title || b.asset?.name || '',
    validate: needsAsset,
  },
  {
    type: 'video',
    label: 'Video',
    hint: 'A YouTube walkthrough. Paste the watch URL.',
    group: 'Show',
    icon: IconPlay,
    keywords: 'youtube embed walkthrough talk',
    fields: ['videoId', 'caption'],
    blank: () => ({ videoId: '', caption: '' }),
    summary: (b) => b.caption || b.videoId,
    validate: (b) =>
      !trimmed(b.videoId)
        ? 'No video yet'
        : /^[\w-]{11}$/.test(b.videoId)
          ? ''
          : 'That is not a YouTube link — paste the watch URL',
  },
  {
    type: 'links',
    label: 'Links',
    hint: 'The tabs you had open while solving it.',
    group: 'Show',
    icon: IconLink,
    keywords: 'bookmarks references sources urls reading',
    fields: ['links', 'variant'],
    blank: () => ({ variant: 'cards', links: [{ label: '', url: '', source: '', _k: nextKey() }] }),
    summary: (b) => b.links.map((l) => l.label).filter(Boolean).join(' · '),
    validate: (b) =>
      b.links.every((l) => trimmed(l.label) && trimmed(l.url))
        ? ''
        : 'A link is missing its label or URL',
  },

  {
    type: 'dropdown',
    label: 'Dropdown',
    hint: 'Collapsed by default — long output nobody needs on first read.',
    group: 'Structure',
    icon: IconToggle,
    keywords: 'toggle accordion collapse details spoiler expandable',
    fields: ['title', 'open', 'tone', 'children'],
    blank: () => ({ title: '', open: false, children: [] }),
    summary: (b) => b.title || `${b.children?.length || 0} blocks inside`,
    validate: (b) => (trimmed(b.title) ? '' : 'A dropdown needs a label to click'),
  },
  {
    type: 'table',
    label: 'Table',
    hint: 'Rows and columns. Good for comparisons.',
    group: 'Structure',
    icon: IconTable,
    keywords: 'grid rows columns comparison matrix',
    fields: ['columns', 'rows', 'caption'],
    blank: () => ({ columns: ['', ''], rows: [['', '']], caption: '' }),
    summary: (b) => `${b.columns.length} columns · ${b.rows.length} rows`,
    validate: (b) => {
      const bad = b.rows.findIndex((r) => r.length !== b.columns.length);
      return bad < 0
        ? ''
        : `Row ${bad + 1} has ${b.rows[bad].length} cells but there are ${b.columns.length} columns`;
    },
  },
  {
    type: 'divider',
    label: 'Divider',
    hint: 'A line. For when a heading would be too much.',
    group: 'Structure',
    icon: IconDivider,
    keywords: 'separator rule hr break line',
    fields: [],
    blank: () => ({}),
    summary: () => '',
    validate: () => '',
  },
];

export const TYPE = Object.fromEntries(BLOCK_TYPES.map((t) => [t.type, t]));

export const hueOf = (type) => HUE[type] || 'slate';

/** Everything a dropdown may hold — the server refuses one inside another. */
export const LEAF_TYPES = BLOCK_TYPES.filter((t) => t.type !== 'dropdown');

export const GROUPS = ['Write', 'Show', 'Structure'];

export const blankBlock = (type) => ({ type, _k: nextKey(), ...TYPE[type].blank() });

/** Stamps client keys onto a note loaded from the server, at every depth. */
export const withKeys = (block) => ({
  ...block,
  _k: nextKey(),
  ...(block.variants ? { variants: block.variants.map((v) => ({ ...v, _k: nextKey() })) } : {}),
  ...(block.links ? { links: block.links.map((l) => ({ ...l, _k: nextKey() })) } : {}),
  ...(block.items ? { items: block.items.map((i) => ({ ...i, _k: nextKey() })) } : {}),
  ...(block.children ? { children: block.children.map(withKeys) } : {}),
});

/**
 * An asset as the *server* wants it: an id and the dimensions the browser
 * measured, and nothing else.
 *
 * The block in memory carries a name, a URL, a size and a content type so it can
 * be rendered without a round trip — but sending those back would be pointless
 * at best. `resolveAssets` on the server rebuilds every one of them from the
 * File row precisely because a client is not allowed to assert them.
 */
const assetPayload = (asset) =>
  asset?.fileId
    ? {
        fileId: asset.fileId,
        ...(asset.width ? { width: asset.width } : {}),
        ...(asset.height ? { height: asset.height } : {}),
      }
    : null;

/**
 * Exactly what the server stores.
 *
 * Keeps only the fields this block's type owns, so switching a block's type
 * cannot smuggle the old one's fields into Mongo, and drops every `_k`. The
 * preview renders the draft rather than this — but `dirty` is computed from it,
 * which is what stops a cosmetic key change from lighting up "unsaved".
 */
export function toPayload(block) {
  const out = { type: block.type };
  if (block.id) out.id = block.id;

  for (const field of TYPE[block.type]?.fields || []) {
    switch (field) {
      case 'variants':
        out.variants = block.variants.map(({ _k, ...v }) => v);
        break;
      case 'links':
        out.links = block.links.map(({ _k, ...l }) => l);
        break;
      case 'items':
        out.items = block.items.map(({ _k, ...i }) => i);
        break;
      case 'children':
        out.children = (block.children || []).map(toPayload);
        break;
      case 'asset': {
        const asset = assetPayload(block.asset);
        if (asset) out.asset = asset;
        break;
      }
      case 'assets':
        out.assets = (block.assets || []).map(assetPayload).filter(Boolean);
        break;
      default:
        out[field] = block[field];
    }
  }
  return out;
}

/**
 * Drops blocks the server would reject outright rather than letting a whole
 * save fail on one empty image placeholder.
 *
 * The asset-carrying types are the case that matters: adding an Image block
 * creates it with no file, which is exactly what you want in the editor and
 * exactly what zod refuses. It is skipped on save and stays on the canvas, so
 * nothing is lost and the note still saves.
 */
export const isSendable = (block) => {
  if (block.type === 'image' || block.type === 'file') return Boolean(block.asset?.fileId);
  if (block.type === 'gallery') return Boolean(block.assets?.length);
  if (block.type === 'video') return /^[\w-]{11}$/.test(block.videoId || '');
  if (block.type === 'links') return block.links.every((l) => trimmed(l.label) && trimmed(l.url));
  if (block.type === 'heading') return Boolean(trimmed(block.text));
  if (block.type === 'code') return block.variants.length > 0;
  return true;
};

/** Mirrors the seeder's `link()` — nobody should type the hostname twice. */
export const deriveSource = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

/**
 * Any YouTube URL shape → the bare id the server stores.
 *
 * Kept in step with `youtubeId` in server/src/utils/links.js: the server
 * normalises again on save, and a block that fails this check is dropped there
 * rather than stored as a dead player.
 */
export const extractVideoId = (value) => {
  const raw = trimmed(value);
  if (/^[\w-]{11}$/.test(raw)) return raw;
  const match = raw.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/);
  return match ? match[1] : raw;
};

/** Moves an item, returning a new array. Same helper the guide editor uses. */
export const move = (list, from, to) => {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const humanBytes = (bytes = 0) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
