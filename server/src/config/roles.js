/**
 * Roles and what each one is allowed to do.
 *
 * The four roles are not a ladder, which is why this is a capability set per
 * role rather than a numeric rank. `dev_member` writes guides but must never
 * touch a password; `admin` sets passwords but is not "above" dev_member, and
 * neither can touch the curriculum. A rank comparison cannot express that
 * without lying about one of the three.
 *
 * `super_admin` is not granted here or anywhere else in the API — it is pinned
 * to one email address in the environment. See services/auth.service.js.
 */

export const ROLES = ['user', 'admin', 'dev_member', 'super_admin'];

/** The default for a fresh signup, and the only role a learner ever needs. */
export const DEFAULT_ROLE = 'user';

/**
 * Capabilities, in the order they appear in the permission matrix.
 *
 *   panel          open the admin panel at all
 *   content:read   see problems and patterns in the panel
 *   content:write  create, edit and delete problems and patterns
 *   guide:write    edit the long-form pattern guides
 *   user:read      see the user list and a user's details
 *   user:write     edit a user's name, email, avatar and profile fields
 *   user:create    create an account outright, with a password and a role
 *   user:password  set a password, and force sign-out everywhere
 *   user:role      assign roles
 *   user:delete    delete an account
 *
 * `user:create` is deliberately not a combination of the ones around it. Making
 * an account means choosing its role and its first password in one step, so
 * anyone holding it can mint themselves an `admin` and sign in as it — which is
 * `user:role` by another route. It belongs to whoever already has that.
 */
const CAPS = {
  user: [],

  dev_member: ['panel', 'content:read', 'guide:write', 'user:read', 'user:write'],

  admin: ['panel', 'content:read', 'guide:write', 'user:read', 'user:write', 'user:password'],

  super_admin: [
    'panel',
    'content:read',
    'content:write',
    'guide:write',
    'user:read',
    'user:write',
    'user:create',
    'user:password',
    'user:role',
    'user:delete',
  ],
};

export const can = (role, capability) => (CAPS[role] || []).includes(capability);

/**
 * Sent to the client on `GET /auth/me` so the UI can hide what it cannot do
 * without keeping a second copy of this matrix in JSX. It is a convenience for
 * rendering, never a security boundary — every route checks for itself.
 */
export const capsFor = (role) => [...(CAPS[role] || [])];

/** Roles that may be handed out through the API. Deliberately excludes super_admin. */
export const ASSIGNABLE_ROLES = ROLES.filter((role) => role !== 'super_admin');
