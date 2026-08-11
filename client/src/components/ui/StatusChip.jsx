/**
 * One piece of state, as a dot and a word.
 *
 * The word is the message; the dot is only how you find the interesting row in a
 * column of six. Status colour alone is never the answer — it fails for anyone
 * who cannot separate the two greens, and it fails in a screenshot pasted into a
 * chat by someone asking what is wrong.
 *
 * Uses the reserved status tokens and nothing else. These four never carry a
 * series or a category; if a chart ever needs a fifth colour it does not come
 * from here.
 */
export function StatusChip({ state = 'off', children }) {
  return (
    <span className={`chip ${state}`}>
      <i aria-hidden="true" />
      {children}
    </span>
  );
}
