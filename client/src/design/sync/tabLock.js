/**
 * One editing tab per board, per browser.
 *
 * Two tabs editing the same board would each save over the other's changes a
 * second later. Rather than merge, the newest tab to open a board takes it: it
 * announces itself on a BroadcastChannel, and any other tab on that board
 * flushes its saves and turns read-only, with a banner offering to take it back.
 * The editing tab relays what it commits, so read-only tabs stay live — which
 * is also a dress rehearsal for real multiplayer.
 *
 * Without BroadcastChannel (old Safari) there is no lock, and the server's
 * per-element last-writer-wins is what remains.
 */

export function createTabLock({ boardId, tabId, onLost, onRemoteCommit }) {
  if (typeof BroadcastChannel === 'undefined') {
    return { claim() {}, relay() {}, dispose() {}, get holding() {
      return true;
    } };
  }
  const channel = new BroadcastChannel(`sd-board:${boardId}`);
  let holding = false;

  channel.onmessage = (event) => {
    const message = event.data || {};
    if (message.tab === tabId) return;
    if (message.type === 'claim' && holding) {
      holding = false;
      onLost?.();
    } else if (message.type === 'ops' && !holding) {
      onRemoteCommit?.(message.records);
    }
  };

  return {
    claim() {
      holding = true;
      channel.postMessage({ type: 'claim', tab: tabId });
    },
    /** Tells read-only tabs what changed: `[[id, record | null], …]`. */
    relay(records) {
      if (holding && records.length) channel.postMessage({ type: 'ops', tab: tabId, records });
    },
    get holding() {
      return holding;
    },
    dispose() {
      channel.close();
    },
  };
}
