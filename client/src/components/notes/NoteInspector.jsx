import { useState } from 'react';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';
import { TagInput } from '../ui/TagInput.jsx';
import {
  IconCheck,
  IconClose,
  IconCopy,
  IconGlobe,
  IconImage,
  IconLink,
  IconLock,
} from '../ui/Icons.jsx';

/**
 * Who can read this note, and the link if anyone can.
 *
 * Three states rather than a switch, because "public" means two different
 * things to most people and the difference matters once a link exists: *anyone
 * with the link* and *listed for everyone*. A single toggle forces whoever
 * wanted the first to accept the second.
 *
 * The control shows the consequence rather than the setting — "Only you",
 * "Anyone with the link" — because "unlisted" is jargon for a choice that has
 * to be understood correctly the first time.
 */
const MODES = [
  {
    id: 'private',
    label: 'Only you',
    icon: IconLock,
    blurb: 'Nobody else can open it, link or not.',
  },
  {
    id: 'unlisted',
    label: 'Anyone with the link',
    icon: IconLink,
    blurb: 'Not listed anywhere. The link is the key.',
  },
  {
    id: 'public',
    label: 'Everyone',
    icon: IconGlobe,
    blurb: 'Listed in the public notes feed.',
  },
];

export function VisibilityPicker({ value, status, publicId, onChange, onPublish }) {
  const [open, setOpen] = useState(false);
  const { success } = useToast();

  const mode = MODES.find((m) => m.id === value) || MODES[0];
  const Icon = mode.icon;
  const shared = value !== 'private';
  const link = publicId ? `${window.location.origin}/n/${publicId}` : '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      success('Link copied');
    } catch {
      // Clipboard needs a secure context. The field below is selectable.
    }
  };

  return (
    <div className="nv">
      <button
        type="button"
        className={`nv-trigger ${shared ? 'shared' : ''}`}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <Icon size={12} />
        {mode.label}
      </button>

      {open && (
        <>
          {/* A click-catcher rather than a document listener: it closes on any
              outside press without racing the trigger's own onClick. */}
          <button
            type="button"
            className="nv-scrim"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="nv-menu">
            {MODES.map((option) => {
              const OptionIcon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`nv-option ${value === option.id ? 'on' : ''}`}
                  onClick={() => onChange(option.id)}
                >
                  <OptionIcon size={13} />
                  <span>
                    <strong>{option.label}</strong>
                    <span>{option.blurb}</span>
                  </span>
                  {value === option.id && <IconCheck size={12} />}
                </button>
              );
            })}

            {shared && (
              <div className="nv-share">
                {status !== 'published' ? (
                  /*
                    The server refuses to serve a draft to anyone but its author
                    whatever the visibility says, so a shared link on a draft is
                    a link that 404s. Saying so here, with the fix attached,
                    beats letting someone send it and find out.
                  */
                  <div className="nv-warn">
                    <p>Still a draft — the link will not open for anyone else yet.</p>
                    <button type="button" className="btn primary" onClick={onPublish}>
                      Publish it
                    </button>
                  </div>
                ) : link ? (
                  <div className="nv-link">
                    <input readOnly value={link} onFocus={(e) => e.target.select()} />
                    <button type="button" className="icon-btn" onClick={copy} title="Copy link">
                      <IconCopy size={12} />
                    </button>
                  </div>
                ) : (
                  <p className="hint">The link appears once the note has been saved.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The side rail: everything about the note that is not its content.
 *
 * Kept out of the canvas on purpose. Tags, a cover and a pattern link are things
 * you set once and then never look at again, and putting them above the title —
 * where every "new document" form puts them — means walking past six fields
 * before writing a word.
 */
export function NoteInspector({ meta, onChange, noteId, upload }) {
  const { groups } = useRoadmap();
  const [open, setOpen] = useState(true);

  const patterns = [
    { value: '', label: 'No pattern' },
    ...groups.map((g) => ({ value: g.slug, label: g.name })),
  ];

  if (!open) {
    return (
      <button type="button" className="ni-reopen" onClick={() => setOpen(true)}>
        Details
      </button>
    );
  }

  return (
    <aside className="ni">
      <div className="ni-head">
        <span>Details</span>
        <button
          type="button"
          className="icon-btn"
          onClick={() => setOpen(false)}
          aria-label="Hide details"
        >
          <IconClose size={12} />
        </button>
      </div>

      <div className="ni-body">
        <div className="field">
          <span>Cover</span>
          {meta.cover?.url ? (
            <div className="ni-cover">
              <img src={meta.cover.url} alt="" />
              <button
                type="button"
                className="nb-media-clear"
                onClick={() => onChange({ cover: null })}
                aria-label="Remove cover"
              >
                <IconClose size={11} />
              </button>
            </div>
          ) : (
            <label className="ni-cover-add">
              <IconImage size={14} />
              Add a cover
              <input
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload([file], (assets) => onChange({ cover: assets[0] || null }));
                }}
              />
            </label>
          )}
        </div>

        <div className="field">
          <span>Tags</span>
          <TagInput
            value={meta.tags}
            onChange={(tags) => onChange({ tags })}
            placeholder="aws, debugging…"
          />
        </div>

        <label className="field">
          <span>Folder</span>
          <input
            value={meta.category}
            placeholder="infra, react, interviews…"
            onChange={(e) => onChange({ category: e.target.value })}
          />
          <span className="field-hint">Groups notes in your library.</span>
        </label>

        <div className="field">
          <span>Related pattern</span>
          <Dropdown
            ariaLabel="Related pattern"
            value={meta.patternSlug}
            options={patterns}
            onChange={(patternSlug) => onChange({ patternSlug })}
            searchable
          />
          <span className="field-hint">Shows this note on that pattern’s page.</span>
        </div>

        <div className="field">
          <span>State</span>
          <div className="ni-states">
            <button
              type="button"
              className={`toggle-chip ${meta.status === 'draft' ? 'on' : ''}`}
              onClick={() => onChange({ status: 'draft' })}
            >
              Draft
            </button>
            <button
              type="button"
              className={`toggle-chip ${meta.status === 'published' ? 'on' : ''}`}
              onClick={() => onChange({ status: 'published' })}
            >
              Published
            </button>
          </div>
          <span className="field-hint">
            A draft is yours alone, whatever the sharing setting says.
          </span>
        </div>

        {noteId && <p className="hint dim">Saved automatically as you write.</p>}
      </div>
    </aside>
  );
}
