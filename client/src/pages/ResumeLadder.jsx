import { useMemo, useRef, useState } from 'react';
import {
  FORMAT_RULES,
  LEVELS,
  PROMPT_RULES,
  buildRewritePrompt,
  levelForYears,
} from '../interview/resumeLadder.js';

/**
 * Interview Helper → Resume Building.
 *
 * Laid out as four numbered steps read top to bottom: find your level, see what
 * a resume at that level must show, rewrite it with AI, check the format. Each
 * step spans the full width and splits into two balanced columns inside, so
 * no column is left with a gap beside a taller neighbour.
 *
 * The chosen level is remembered per browser; storage can throw, so both
 * directions are guarded.
 */
const LEVEL_KEY = 'resume-ladder-level';

const readLevel = () => {
  try {
    const id = localStorage.getItem(LEVEL_KEY);
    return LEVELS.some((l) => l.id === id) ? id : LEVELS[0].id;
  } catch {
    return LEVELS[0].id;
  }
};

const hueStyle = (l) => ({ '--rl-hue': `var(--h-${l.hue})` });

function Step({ n, title, sub, aside, children, style }) {
  return (
    <section className="panel rl-step" style={style}>
      <div className="panel-body">
        <header className="rl-step-head">
          <span className="rl-step-num">{n}</span>
          <div className="rl-step-title">
            <h2>{title}</h2>
            {sub && <p>{sub}</p>}
          </div>
          {aside && <div className="rl-step-aside">{aside}</div>}
        </header>
        {children}
      </div>
    </section>
  );
}

export function ResumeLadder() {
  const [levelId, setLevelId] = useState(readLevel);
  const level = LEVELS.find((l) => l.id === levelId);

  const [years, setYears] = useState('');
  const [copyStatus, setCopyStatus] = useState('');
  const promptRef = useRef(null);
  const prompt = useMemo(() => buildRewritePrompt(level), [level]);

  const pick = (id) => {
    setLevelId(id);
    setCopyStatus('');
    try {
      localStorage.setItem(LEVEL_KEY, id);
    } catch {
      // Remembering the level is a nicety; nothing breaks without it.
    }
  };

  const matchYears = (e) => {
    e.preventDefault();
    const n = parseFloat(years);
    if (!Number.isNaN(n) && n >= 0) pick(levelForYears(n));
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopyStatus('Copied');
    } catch {
      // Clipboard can be blocked; leave the text selected for Ctrl+C.
      promptRef.current?.select();
      setCopyStatus('Selected. Press Ctrl+C');
    }
  };

  return (
    <div className="rl">
      <div className="page-head">
        <h1>Resume Building</h1>
        <p>Find your level, see what your resume has to prove there, then rewrite it to that bar.</p>
      </div>

      <Step
        n={1}
        title="Find your level"
        sub="Pick the level you are applying for."
        aside={
          <form className="rl-years" onSubmit={matchYears}>
            <label htmlFor="rl-years">Or enter years of experience</label>
            <input
              id="rl-years"
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              placeholder="e.g. 3"
              value={years}
              onChange={(e) => setYears(e.target.value)}
            />
            <button type="submit" className="btn">
              Match
            </button>
          </form>
        }
      >
        <div className="rl-levels" role="tablist" aria-label="Level">
          {LEVELS.map((l) => (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={l.id === levelId}
              className={`rl-level-card ${l.id === levelId ? 'active' : ''}`}
              style={hueStyle(l)}
              onClick={() => pick(l.id)}
            >
              <span className="rl-level-name">{l.name}</span>
              <span className="rl-level-years">{l.years}</span>
              <span className="rl-level-scope">{l.scope}</span>
            </button>
          ))}
        </div>
      </Step>

      <Step
        n={2}
        title={`What a ${level.name} resume must show`}
        sub={`${level.years} experience · Scope: ${level.scope}`}
        style={hueStyle(level)}
      >
        <div className="rl-cols">
          <div>
            <p className="rl-signal">
              <span className="rl-label">Main signal</span>
              {level.signal}
            </p>
            <ul className="rl-checks">
              {level.mustShow.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
          <div className="rl-side">
            <div>
              <span className="rl-label">Example bullet</span>
              <blockquote className="rl-example">{level.example}</blockquote>
            </div>
            <div className="rl-bar">
              <span className="rl-label">The bar</span>
              <p>{level.bar}</p>
            </div>
          </div>
        </div>
      </Step>

      <Step
        n={3}
        title="Rewrite it with AI"
        sub={`A prompt tuned to ${level.name}. Copy it, paste it into Claude or ChatGPT, and put your resume under it.`}
        style={hueStyle(level)}
      >
        <div className="rl-cols rl-cols-prompt">
          <div className="rl-howto">
            <span className="rl-label">How to use it</span>
            <ol className="rl-steps">
              <li>Press <b>Copy prompt</b>.</li>
              <li>Paste it into a new Claude or ChatGPT chat.</li>
              <li>Optional: paste the job description where the prompt says to.</li>
              <li>Paste your resume text at the bottom and send.</li>
              <li>Replace every <code>[placeholder]</code> with a real number.</li>
            </ol>

            <span className="rl-label">What the prompt makes sure of</span>
            <ul className="rl-checks compact">
              {PROMPT_RULES.map((r) => (
                <li key={r.label}>
                  <b>{r.label}.</b> {r.rule}
                </li>
              ))}
            </ul>
          </div>

          <div className="rl-prompt">
            <div className="rl-prompt-bar">
              <span>Prompt · {level.name}</span>
              <div className="rl-prompt-actions">
                {copyStatus && <span className="rl-copy-status">{copyStatus}</span>}
                <button type="button" className="btn primary" onClick={copyPrompt}>
                  Copy prompt
                </button>
              </div>
            </div>
            <textarea ref={promptRef} className="rl-prompt-text" readOnly spellCheck={false} value={prompt} />
          </div>
        </div>
      </Step>

      <Step n={4} title="Check the format" sub="These hold at every level.">
        <dl className="rl-rules">
          {FORMAT_RULES.map((r) => (
            <div key={r.label} className="rl-rule">
              <dt>{r.label}</dt>
              <dd>{r.rule}</dd>
            </div>
          ))}
        </dl>
        <p className="rl-note">
          Levels and titles vary between companies. Use this to calibrate, not as a guarantee. The prompt
          only fixes the wording; the results in your bullets still have to be real.
        </p>
      </Step>
    </div>
  );
}
