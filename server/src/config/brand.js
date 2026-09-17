/**
 * The product's name, for the few places the server says it out loud.
 *
 * A second copy of `client/src/brand.js`, which is the source of truth — the
 * client renders the name everywhere and this is only ever read by outgoing
 * mail. It is copied rather than imported because the two halves of this repo
 * are separate packages with separate builds, and a shared module between them
 * would be a build step to buy one string.
 *
 * Renaming therefore means editing both. That is the whole cost, it is written
 * down here, and the alternative — an email that greets people as the old name
 * for a year — is worse.
 */
export const BRAND_NAME = 'Ember';
