/**
 * The product's name in one place.
 *
 * It started as "DSA Prep", became "MAANG Prep", and outgrew both: patterns are
 * the first module rather than the whole thing, and naming yourself after five
 * companies dates you to whichever five they happen to be this year. Everything
 * user-facing reads from here so the next rename is one edit rather than a
 * search across pages, the sidebar and the document title.
 *
 * index.html is the one exception and cannot be fixed. Its title and favicon
 * are painted before any module has loaded — that is the whole point of them —
 * so they carry their own copy of the name and the brand colour.
 */
export const BRAND = {
  name: 'Ember',
  /** Two characters, because that is what the rounded mark has room for. */
  mark: 'EM',
  tagline: 'Interview preparation, pattern first',
};
