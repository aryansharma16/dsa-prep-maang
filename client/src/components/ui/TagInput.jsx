import { useRef, useState } from 'react';
import { IconClose } from './Icons.jsx';

/**
 * Chips input. Enter or comma commits; Backspace on an empty field removes the
 * last chip. Typing a value and submitting the form without pressing Enter would
 * otherwise silently drop it, so the pending text is committed on blur too.
 */
export function TagInput({ value = [], onChange, placeholder, suggestions = [], id }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const add = (raw) => {
    const next = raw.trim().replace(/,$/, '');
    if (!next) return;
    if (!value.some((v) => v.toLowerCase() === next.toLowerCase())) onChange([...value, next]);
    setDraft('');
  };

  const removeAt = (index) => onChange(value.filter((_, i) => i !== index));

  const onKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ',') {
      // Enter must not submit the surrounding form while composing a chip.
      event.preventDefault();
      add(draft);
    } else if (event.key === 'Backspace' && !draft && value.length) {
      removeAt(value.length - 1);
    }
  };

  const unused = suggestions.filter(
    (s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()),
  );

  return (
    <>
      <div className="taginput" onClick={() => inputRef.current?.focus()}>
        {value.map((tag, i) => (
          <span className="taginput-chip" key={tag}>
            {tag}
            <button
              type="button"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${tag}`}
              tabIndex={-1}
            >
              <IconClose size={9} />
            </button>
          </span>
        ))}
        <input
          id={id}
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => add(draft)}
          placeholder={value.length ? '' : placeholder}
        />
      </div>

      {unused.length > 0 && (
        <div className="taginput-suggest">
          {unused.slice(0, 6).map((s) => (
            <button type="button" key={s} onClick={() => add(s)}>
              + {s}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
