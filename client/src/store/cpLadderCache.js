/**
 * The loaded CP ladder, readable from outside its provider.
 *
 * `CPProvider` is mounted on the /cp route rather than around the app, because
 * the ladder is 800 rows and nothing else reads it — fetching it for someone who
 * never opens Pro Coder would be most of a megabyte spent on nothing.
 *
 * That leaves one consumer outside the tree: the chat problem picker. The dock
 * floats over every page from `AppShell`, so it sits *beside* the route element
 * and cannot call `useCP()`. It needs a title and an id to attach a problem, and
 * only while the ladder is on screen.
 *
 * So the provider publishes here and the picker reads. Deliberately not a
 * context and deliberately not reactive: the picker reads once, when it opens,
 * and by then the page behind it has finished loading. A module singleton for
 * cross-tree state is the same shape `chatStream.js` already uses, for the same
 * reason — the alternative is hoisting a provider to make one widget work.
 *
 * Cleared when the provider unmounts, so navigating away from /cp cannot leave
 * the picker offering problems from a page that is no longer open.
 */

let problems = [];

/** A minimal projection — the picker needs a label and an id, nothing else. */
export function publishCPLadder(list) {
  problems = (list || []).map((p) => ({
    _id: p._id,
    title: p.title,
    slug: p.slug,
    tier: p.tier,
    patternSlug: p.patternSlug,
    platform: p.platform,
    rating: p.codeforces?.rating || p.codechef?.difficultyRating || 0,
    code: p.codeforces
      ? `${p.codeforces.contestId}${p.codeforces.index}`
      : p.codechef?.code || '',
    topicTags: p.topicTags || [],
    status: p.progress?.status || 'todo',
  }));
}

export const clearCPLadder = () => {
  problems = [];
};

export const readCPLadder = () => problems;
