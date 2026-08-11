import { useSyncExternalStore } from 'react';

/**
 * Whether the feedback popup is open, and which tab it opened on.
 *
 * Module scope rather than a context, for the reason chatStream.js is: three
 * unrelated places drive this — the bubble in the shell, the button in the
 * topbar, and anything inside the routed page that wants to say "tell us about
 * it" — and a provider wrapping the whole signed-in tree would re-render every
 * page to carry one boolean between them. A context is the answer when there is
 * state worth sharing; here there is a boolean and a string.
 *
 * `snapshot` returns the same object between notifications on purpose.
 * useSyncExternalStore compares by identity, so a freshly built object on every
 * call is an infinite render loop with a warning attached — which is why the two
 * mutators below return early rather than emitting a no-op.
 */
function createModalStore() {
  let state = { open: false, tab: 'send' };
  const listeners = new Set();
  const emit = () => listeners.forEach((fn) => fn());

  return {
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    snapshot: () => state,

    open(tab = 'send') {
      state = { open: true, tab };
      emit();
    },

    close() {
      if (!state.open) return;
      state = { ...state, open: false };
      emit();
    },

    setTab(tab) {
      if (state.tab === tab) return;
      state = { ...state, tab };
      emit();
    },
  };
}

export const feedbackModal = createModalStore();

export const useFeedbackModal = () =>
  useSyncExternalStore(feedbackModal.subscribe, feedbackModal.snapshot);
