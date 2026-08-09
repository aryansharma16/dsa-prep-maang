/**
 * What the signed-in user is allowed to do.
 *
 * The list comes from the server on `GET /auth/me`, so the permission matrix
 * lives in exactly one place — `server/src/config/roles.js` — instead of being
 * copied into JSX where the two would drift.
 *
 * All of this is for rendering. Hiding a button is a courtesy to the person
 * looking at it, never a security boundary: every admin route checks for
 * itself, and a hidden control is one fetch away for anyone who cares.
 */

export const can = (user, capability) => Boolean(user?.caps?.includes(capability));

export const ROLE_LABEL = {
  user: 'User',
  admin: 'Admin',
  dev_member: 'Dev member',
  super_admin: 'Super admin',
};

/** Roles the panel may assign. Super admin is pinned in the server's env. */
export const ASSIGNABLE_ROLES = ['user', 'dev_member', 'admin'];
