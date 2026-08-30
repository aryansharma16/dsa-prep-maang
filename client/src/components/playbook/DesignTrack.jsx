import { usePlaybook } from '../../store/PlaybookContext.jsx';
import { IconCheck } from '../ui/Icons.jsx';

/**
 * Both design tracks — high-level from week 13, low-level from week 14.
 *
 * They are one tab rather than two because they are one family of round and
 * they trade against each other for the same evening: what the loop actually
 * asks is "can you design something", and whether the something is a whiteboard
 * or a runnable parking lot is a detail of the company, not of the skill.
 *
 * Both are deliberately shorter than a syllabus written for someone who has
 * never shipped a backend. Three years of Node and React means most of the
 * objects here are already familiar; what is being learned is what they are
 * called at scale, what the numbers are, and how to walk somebody through one
 * inside forty-five minutes.
 */
/**
 * `state` is per block, not per track, and that is the whole point of the
 * dating: the track tells you the design work has started, the block tells you
 * which four topics are this fortnight's. Parsed from the block's own week
 * range so the schedule stays authored in one place.
 */
function Block({ block, week }) {
  const { isDone, toggle, doneCount } = usePlaybook();
  const ids = block.items.map((i) => i.id);
  const done = doneCount(ids);
  const [from, to] = block.weeks.split('–').map((s) => Number(s.trim()));
  const state = week > to ? 'past' : week >= from ? 'now' : 'ahead';

  return (
    <section className={`pb-block ${state}`}>
      <header className="pb-block-head">
        <h3>{block.block}</h3>
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
}

export function DesignTrack({ doc, week }) {
  const { doneCount } = usePlaybook();

  return (
    <div className="pb-design">
      <p className="pb-lead">{doc.COPY.designLead}</p>

      {doc.DESIGN_TRACKS.map((track) => {
        const ids = track.blocks.flatMap((b) => b.items.map((i) => i.id));
        const done = doneCount(ids);
        const [from] = track.weeks.split('–').map((s) => Number(s.trim()));

        return (
          <section
            key={track.id}
            className={`pb-track ${week >= from ? 'now' : 'ahead'}`}
            data-track={track.id}
          >
            <header className="pb-track-head">
              <div>
                <span className="pb-eyebrow mono">WEEKS {track.weeks}</span>
                <h2>{track.name}</h2>
              </div>
              <span className="pb-track-count mono">
                {done}/{ids.length}
              </span>
            </header>

            <p className="pb-track-lead">{track.lead}</p>

            {track.blocks.map((block) => (
              <Block key={block.id} block={block} week={week} />
            ))}
          </section>
        );
      })}
    </div>
  );
}
