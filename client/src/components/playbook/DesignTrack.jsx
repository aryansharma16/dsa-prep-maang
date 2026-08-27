import { SYSTEM_DESIGN } from '../../playbook/plan.js';
import { usePlaybook } from '../../store/PlaybookContext.jsx';
import { IconCheck } from '../ui/Icons.jsx';

/**
 * The system-design track — twelve weeks of it, weeks 13 to 24.
 *
 * Deliberately shorter than a syllabus written for someone who has never
 * shipped a backend. Three years of Node and React means most of the objects
 * here are already familiar; what is being learned is what they are called at
 * scale, what the numbers are, and how to walk somebody through one in
 * forty-five minutes.
 */
export function DesignTrack({ week }) {
  const { isDone, toggle, doneCount } = usePlaybook();

  return (
    <div className="pb-design">
      <p className="pb-lead">
        Starts in week 13, four hours a week, rising to eight in phase four. Until then it is not on
        the timetable at all — the first three months are ninety per cent algorithms, which is what
        you asked for and what the loop actually weights at your level.
      </p>

      {SYSTEM_DESIGN.map((block) => {
        const ids = block.items.map((i) => i.id);
        const done = doneCount(ids);
        const [from] = block.weeks.split('–').map((s) => Number(s.trim()));
        const state = week >= from ? (done === ids.length ? 'past' : 'now') : 'ahead';

        return (
          <section key={block.id} className={`pb-block ${state}`}>
            <header className="pb-block-head">
              <h2>{block.block}</h2>
              <span className="pb-block-weeks mono">weeks {block.weeks}</span>
              <span className="pb-block-count mono">
                {done}/{ids.length}
              </span>
            </header>

            <ul className="pb-sd-list">
              {block.items.map((item) => {
                const on = isDone(item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`pb-sd-item ${on ? 'on' : ''}`}
                      onClick={() => toggle(item.id)}
                      aria-pressed={on}
                    >
                      <span className="pb-box">{on && <IconCheck size={11} />}</span>
                      <span className="pb-sd-body">
                        <span className="pb-sd-title">{item.title}</span>
                        <span className="pb-sd-detail">{item.body}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
