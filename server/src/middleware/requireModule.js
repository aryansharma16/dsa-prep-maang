import { can } from '../config/roles.js';
import { User } from '../models/User.js';
import { hiddenModules } from '../services/settings.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Locks the API behind a module that is still being built.
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
    const hidden = await hiddenModules();
    if (!hidden.includes(key)) return next();

    const gone = () => ApiError.notFound(`Route not found: ${req.method} ${req.originalUrl}`);

    // Defensive: every mount is currently below the auth gate, but a public
    // route guarded by this later would arrive with no caller at all, and the
    // right answer for a stranger is the same 404 everyone else gets.
    if (!req.userId) throw gone();

    const actor = await User.findById(req.userId).select('role');
    if (!can(actor?.role, 'module:preview')) throw gone();

    next();
  });
