import { Link } from 'react-router-dom';

/**
 * A label, a number, and a line of context.
 *
 * Shared because `.tile` on its own is a class whose correctness depends on the
 * caller reaching for `<div>` rather than `<span>` — a contract CSS cannot state,
 * and one of the three places that hand-rolled this markup got it wrong and
 * shipped a tile whose label and value ran together on one line. A component
 * cannot be misused that way.
 *
 * `tone="attention"` is for the one tile on a page that is a to-do rather than an
 * inventory. It washes the card in `--medium`, deliberately not `--accent`: the
 * accent is chosen by the reader and can be any hue including a gray, and it is
 * already carrying the active tab two rows above.
 */
export function Tile({ label, value, sub, tone, to }) {
  const className = `tile ${tone ? tone : ''}`.trim();

  const body = (
    <>
      <div className="k">{label}</div>
      <div className="v">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </>
  );

  if (to) {
    return (
      <Link className={className} to={to}>
        {body}
      </Link>
    );
  }

  return <div className={className}>{body}</div>;
}
