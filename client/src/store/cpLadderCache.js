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

/**
 * A minimal projection — enough to label a row, sort it, and tell two problems
 * with the same title apart.
 *
 * Every field the picker renders has to be published here, and the ones that
 * can be absent have to be published as their empty value rather than left off.
 * That is not a style point: `difficulty` used to be missing from this list
 * while the picker indexed straight into it, so opening the attach sheet on /cp
 * threw during render and took the whole panel down with it. A row that renders
 * blank is a bug; a row that cannot render at all is a broken feature.
 *
 * `tierLabel` is resolved here rather than in the picker because the tier
 * metadata is the provider's, and shipping the slug alone would make the
 * picker's group headings read `newbie` where the ladder behind it says
 * `Foundations`.
 */
export function publishCPLadder(list, tiers) {
  const labels = new Map((tiers || []).map((t) => [t.slug, t.label]));

  problems = (list || []).map((p) => ({
    _id: p._id,
    title: p.title,
    slug: p.slug,
    tier: p.tier,
    tierLabel: labels.get(p.tier) || p.tier,
    patternSlug: p.patternSlug,
    platform: p.platform,
    /**
     * The platform's own label — '1400' on Codeforces, 'Easy' on CodeChef, and
     * an empty string on plenty of rows. Always a string, never undefined.
     */
    difficulty: p.difficulty || '',
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
