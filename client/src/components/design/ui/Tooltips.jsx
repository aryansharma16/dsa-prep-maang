import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * Tooltips for the design workspace: quick, readable, and saying what a thing
 * is — the browser's own `title` bubble takes a second and a half to appear and
 * cannot show a shortcut or a second line.
 *
 * `TooltipLayer` (mounted once by the workspace) turns every `title` attribute
 * into one of these, so components keep writing plain `title="Undo (⌘Z)"`. While
 * the pointer is on an element its `title` is moved aside — that is what stops
 * the native bubble — and put back when the pointer leaves; a title React
 * changes meanwhile is picked up rather than lost.
 *
 * `useTip` is the same bubble for things that are not elements: a column row on
 * the canvas, a word in the DBML text.
 *
 * The first tip waits a moment; moving on to the next thing shows its tip at
 * once, as Figma does.
 */

const DELAY = 420;
const WARM_DELAY = 60;
const WARM_FOR = 600;
let visible = 0;
let lastHiddenAt = 0;

const tipDelay = () => (visible > 0 || performance.now() - lastHiddenAt < WARM_FOR ? WARM_DELAY : DELAY);

const KEY_WORDS = /\b(Ctrl|Alt|Shift|Space|Enter|Esc|Del|Tab|Cmd|Option)\b/g;

/**
 * "Undo (⌘Z)" → { title: 'Undo', kbd: '⌘Z' }; "PostgreSQL — when to use it" →
 * { title: 'PostgreSQL', body: 'when to use it' }. A body over several lines (DBML)
 * is shown as written, in monospace.
 */
export function parseTitle(text) {
  const raw = String(text ?? '').trim();
  const dash = raw.indexOf(' — ');
  const newline = raw.indexOf('\n');
  if (newline >= 0 && (dash < 0 || dash > newline)) return { title: null, body: raw, mono: true };
  let title = dash > 0 ? raw.slice(0, dash) : raw;
  const body = dash > 0 ? raw.slice(dash + 3) : null;
  let kbd = null;
  const shortcut = title.match(/^(.*\S)\s+\(([^()]{1,16})\)$/);
  if (shortcut && !/[a-z]{2,}/.test(shortcut[2].replace(KEY_WORDS, ''))) {
    title = shortcut[1];
    kbd = shortcut[2];
  }
  return { title, kbd, body, mono: Boolean(body?.includes('\n')) };
}

/**
 * The bubble. `rect` is what it points at (client coordinates); it sits below,
 * or above when there is no room below. `tip` is `{ title, meta, kbd, body, alert, mono }`;
 * `body` may be a list of lines.
 */
export function TipBubble({ rect, tip }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const gap = 8;
    const edge = 8;
    let top = rect.top + rect.height + gap;
    if (top + height > window.innerHeight - edge) top = Math.max(edge, rect.top - height - gap);
    const left = Math.min(window.innerWidth - width - edge, Math.max(edge, rect.left + rect.width / 2 - width / 2));
    setPos({ left, top });
  }, [rect.left, rect.top, rect.width, rect.height, tip]);

  useEffect(() => {
    visible += 1;
    return () => {
      visible -= 1;
      lastHiddenAt = performance.now();
    };
  }, []);

  const lines = Array.isArray(tip.body) ? tip.body.filter(Boolean) : tip.body ? [tip.body] : [];
  return createPortal(
    <div ref={ref} className={`sd-tip ${tip.mono ? 'mono' : ''}`} role="tooltip" style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}>
      {(tip.title || tip.kbd || tip.meta) && (
        <div className="sd-tip-head">
          {tip.title && <span className="sd-tip-title">{tip.title}</span>}
          {tip.meta && <span className="sd-tip-meta">{tip.meta}</span>}
          {tip.kbd && <kbd className="sd-tip-kbd">{tip.kbd}</kbd>}
        </div>
      )}
      {lines.map((line, i) => (
        // eslint-disable-next-line react/no-array-index-key -- lines have no identity
        <div key={i} className="sd-tip-body">
          {line}
        </div>
      ))}
      {tip.alert && <div className={`sd-tip-alert ${tip.alertTone || 'error'}`}>{tip.alert}</div>}
    </div>,
    document.body,
  );
}

/**
 * A tip for something that is not an element. `schedule(key, compute)` when the
 * pointer is over thing `key` (the same key again does nothing), `schedule(null)`
 * when it is over nothing; `compute()` runs when the delay is up and returns
 * `{ rect, tip }` or null. Render `element`.
 */
export function useTip() {
  const [shown, setShown] = useState(null);
  const timer = useRef(0);
  const keyRef = useRef(null);

  const hide = useCallback(() => {
    clearTimeout(timer.current);
    keyRef.current = null;
    setShown(null);
  }, []);

  const schedule = useCallback(
    (key, compute) => {
      if (key === keyRef.current) return;
      clearTimeout(timer.current);
      keyRef.current = key;
      const delay = tipDelay();
      setShown(null);
      if (key == null) return;
      timer.current = setTimeout(() => {
        if (keyRef.current !== key) return;
        setShown(compute() || null);
      }, delay);
    },
    [],
  );

  useEffect(() => () => clearTimeout(timer.current), []);

  return { schedule, hide, element: shown ? <TipBubble rect={shown.rect} tip={shown.tip} /> : null };
}

/** Every `[title]` in the workspace shows its tip this way. Mount once. */
export function TooltipLayer() {
  const { schedule, hide, element } = useTip();

  useEffect(() => {
    let current = null; // { el, text, observer }

    const release = () => {
      if (!current) return;
      const { el, text, observer } = current;
      observer.disconnect();
      if (el.isConnected && !el.hasAttribute('title')) el.setAttribute('title', text);
      current = null;
    };

    const take = (el) => {
      const text = el.getAttribute('title');
      el.removeAttribute('title');
      const entry = { el, text, observer: null };
      // React may set a new title while it is moved aside (Lock → Unlock): keep that one instead.
      entry.observer = new MutationObserver(() => {
        const next = el.getAttribute('title');
        if (next == null) return;
        entry.text = next;
        el.removeAttribute('title');
      });
      entry.observer.observe(el, { attributes: true, attributeFilter: ['title'] });
      current = entry;
      schedule(el, () => (current?.el === el && el.isConnected && current.text.trim() ? { rect: el.getBoundingClientRect(), tip: parseTitle(current.text) } : null));
    };

    const onOver = (event) => {
      if (event.pointerType === 'touch') return;
      const target = event.target instanceof Element ? event.target : null;
      const found = target?.closest('[title]') || null;
      if (current) {
        const inner = found && found !== current.el && current.el.contains(found);
        if (!inner && current.el.contains(target)) return;
        release();
        schedule(null);
      }
      if (found && found.getAttribute('title').trim()) take(found);
    };
    const onOut = (event) => {
      if (event.relatedTarget) return; // pointerover on the next element handles it
      release();
      hide();
    };
    // A press or a key is the start of doing something: the tip is in the way. It comes back on the next thing hovered.
    const onPress = () => hide();
    const onBlur = () => {
      release();
      hide();
    };

    document.addEventListener('pointerover', onOver);
    document.addEventListener('pointerout', onOut);
    document.addEventListener('pointerdown', onPress, true);
    document.addEventListener('keydown', onPress, true);
    document.addEventListener('wheel', onPress, { capture: true, passive: true });
    document.addEventListener('scroll', onPress, true);
    window.addEventListener('blur', onBlur);
    return () => {
      release();
      document.removeEventListener('pointerover', onOver);
      document.removeEventListener('pointerout', onOut);
      document.removeEventListener('pointerdown', onPress, true);
      document.removeEventListener('keydown', onPress, true);
      document.removeEventListener('wheel', onPress, { capture: true });
      document.removeEventListener('scroll', onPress, true);
      window.removeEventListener('blur', onBlur);
    };
  }, [schedule, hide]);

  return element;
}
