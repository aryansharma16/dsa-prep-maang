import { OWNER_MODULE_CAP, OWNER_MODULE_KEYS } from '../config/modules.js';
import { can } from '../config/roles.js';
import { User } from '../models/User.js';
import { hiddenModules } from '../services/settings.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Locks the API behind a module this account may not reach.
 *
 * Two reasons a module can be out of reach, and one middleware answers both
 * because callers ask the same question either way — "is this mine to open":
 *
 *   *hidden* — still being built, listed in the settings row a super admin
 *     edits in the panel, reachable by anyone holding `module:preview`.
 *   *owner*  — belongs to the account that owns the site, marked in
 *     config/modules.js, reachable only with the `playbook` capability. Not a
 *     setting, so no panel toggle can widen it.
 *
 * Everything below about 404s applies to both.
 *
 * This is the half of "hidden" that matters. The client not drawing a nav item
 * is a courtesy; anyone can read the bundle, keep a bookmark, or call the API
 * directly, so an unfinished module has to stop answering as well as stop being
 * linked. Mounted next to the router it protects in routes/index.js.
 *
 * **404, not 403.** A 403 says "this exists and you may not have it", which is
 * the one thing an unreleased feature should not announce — and the message is
 * copied from the notFound middleware verbatim so the two are indistinguishable
 * on the wire. The admin panel takes the same line with `/admin`.
 *
 * The account read only happens while a module is actually hidden. In the steady
 * state — nothing hidden, which is every deployment that has never used this —
 * the check is a cached settings lookup and no query at all, so putting it in
 * front of the chat and tasks routers costs those routes nothing. When a module
 * *is* hidden it is by definition reachable by one person, and one indexed read
 * on their requests is a fine price for not trusting a fifteen-minute-old role
 * claim in a token.
 */
export const requireModule = (key) =>
  asyncHandler(async (req, _res, next) => {
    const owner = OWNER_MODULE_KEYS.includes(key);
    // An owner module is always gated, so its check must not depend on the
    // settings row at all — a database hiccup degrades `hiddenModules()` to
    // "nothing hidden", which is the right failure for an unfinished feature
    // and would be the wrong one for somebody's private page.
    const hidden = owner ? [] : await hiddenModules();
    if (!owner && !hidden.includes(key)) return next();

    const gone = () => ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`);

    // Defensive: every mount is currently below the auth gate, but a public
    // route guarded by this later would arrive with no caller at all, and the
    // right answer for a stranger is the same 404 everyone else gets.
    if (!req.userId) throw gone();

    const actor = await User.findById(req.userId).select('role');
    if (!can(actor?.role, owner ? OWNER_MODULE_CAP : 'module:preview')) throw gone();

    next();
  });
