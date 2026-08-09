/**
 * The text of the reply currently arriving.
 *
 * Module scope, and not React state, for two reasons that both bite otherwise.
 *
 * Re-rendering: a fast provider delivers dozens of chunks a second. Pushing
 * each into `setMessages` would re-render every bubble in the thread and
 * re-parse every markdown block in it, forty times a second, to append four
 * characters to the last one. Here only the tail bubble subscribes.
 *
 * Lifetime: the dock unmounts when you expand it into the full page, mid-reply.
 * A buffer living inside that component would go with it. This one does not,
 * which is what makes the handoff seamless — same argument as the module-scope
 * caches in useGuide.js.
 */
function createStreamStore() {
  let text = '';
  let pending = '';
  let frame = 0;
  const listeners = new Set();

  const flush = () => {
    frame = 0;
    if (!pending) return;
    text += pending;
    pending = '';
    listeners.forEach((fn) => fn());
  };

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    /**
     * The snapshot useSyncExternalStore compares. Flushed text only — it has to
     * return an identical value between notifications or React re-renders in a
     * loop and warns about it.
     */
    snapshot: () => text,

    /** Everything, including what has not been painted yet, for the final commit. */
    get: () => text + pending,

    /** Coalesced to one animation frame: there is no point re-parsing markdown
     *  more often than the screen actually updates. */
    push(chunk) {
      pending += chunk;
      if (!frame) frame = requestAnimationFrame(flush);
    },

    reset() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      text = '';
      pending = '';
      listeners.forEach((fn) => fn());
    },
  };
}

export const chatStream = createStreamStore();
