import { useEffect, useRef, useState } from 'react';

const TIMES = [15, 30, 45, 60];
const OUTCOMES = [
  ['solved', 'Solved'],
  ['solved-with-help', 'With help'],
  ['stuck', 'Stuck'],
];

/** Two taps and it's logged. Never required — the row works fine without it. */
export function AttemptPopover({ onSubmit, onClose }) {
  const [minutes, setMinutes] = useState(30);
  const [outcome, setOutcome] = useState('solved');
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  return (
    <div className="pop" ref={ref}>
      <h4>Time spent</h4>
      <div className="chips">
        {TIMES.map((t) => (
          <button
            key={t}
            className={`chip ${minutes === t ? 'on' : ''}`}
            onClick={() => setMinutes(t)}
          >
            {t}m
          </button>
        ))}
      </div>

      <h4>Outcome</h4>
      <div className="chips">
        {OUTCOMES.map(([value, label]) => (
          <button
            key={value}
            className={`chip ${outcome === value ? 'on' : ''}`}
            onClick={() => setOutcome(value)}
          >
            {label}
          </button>
        ))}
      </div>

      <button
        className="btn primary"
        style={{ width: '100%', height: 27 }}
        onClick={() => {
          onSubmit({ minutes, outcome });
          onClose();
        }}
      >
        Log attempt
      </button>
    </div>
  );
}
