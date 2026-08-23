/**
 * How far along a task is.
 *
 * Derived on read and never stored, for one reason worth stating plainly: half
 * of what it counts does not live on the task. A linked question is finished
 * when it is solved on the roadmap, and the roadmap is already in memory — so
 * ticking a problem off on another page moves the ring here with no write, no
 * refetch and nothing to keep in step.
 *
 * A stored percentage would be a copy of that answer taken at the moment
 * somebody happened to open this page, and it would be wrong by the time they
 * came back.
 */

/**
 * A lookup from problem id to "is it solved", built once from the roadmap.
 *
 * A Set of ids rather than a map to progress objects: solved is the only fact
 * the board asks about, and building the narrow thing keeps a board of forty
 * cards from walking 429 problems forty times.
 */
export function solvedIndex(groups = []) {
  const solved = new Set();
  for (const group of groups) {
    for (const problem of group.problems || []) {
      if (problem.progress?.status === 'solved') solved.add(String(problem._id));
    }
  }
  return solved;
}

/** Everything the roadmap currently knows about one linked question. */
export function questionState(question, solved) {
  return {
    ...question,
    solved: solved.has(String(question.problemId)),
  };
}

/**
 * Counted progress: subtasks and linked questions together.
 *
 * They are summed rather than weighted or shown separately because they are the
 * same promise — "this is a thing I said I would finish" — and a card with two
 * rings on it is a card nobody reads. The drawer breaks the two out; the card
 * shows the one number.
 *
 * `total: 0` is a real answer and the caller is expected to draw nothing for
 * it. A task with no checklist is not 0% done, it is a task with nothing to
 * count, and a permanent empty ring reads as failure.
 */
export function taskProgress(task, solved, statusKind) {
  const subtasks = task.subtasks || [];
  const questions = task.questions || [];

  const total = subtasks.length + questions.length;
  const done =
    subtasks.filter((subtask) => subtask.done).length +
    questions.filter((question) => solved.has(String(question.problemId))).length;

  /*
    A finished task reads 100% whatever the count says.

    Otherwise a card dragged to Done with one question still open would sit
    there at 66% — which is not a useful correction, it is the board arguing
    with the person who just told it the work was over. The counts are still
    shown underneath, so nothing is hidden.
  */
  if (statusKind === 'done') return { done: total, total, percent: 100, complete: true };

  return {
    done,
    total,
    percent: total ? Math.round((done / total) * 100) : 0,
    complete: total > 0 && done === total,
  };
}
