import { asyncHandler } from '../utils/asyncHandler.js';
import { moduleAccess } from '../services/settings.service.js';

/**
 * Which modules are switched on, for a visitor with no session.
 *
 * `/docs` is the one page mounted on both sides of the auth branch, and it
 * documents the modules — so it has to know which of them exist for the person
 * reading it. Signed in, that answer rides along with `GET /auth/me`. Signed
 * out there is no session to carry it, and without this the guide would either
 * describe a module nobody can open or hide one that is on for everybody.
 *
 * It is `moduleAccess(null)`, not a second implementation: no role means no
 * `module:preview`, so the answer is exactly the ordinary learner's — every key
 * except the hidden ones, and an empty `preview`. A module still being built is
 * therefore invisible here, which is the property that makes this safe to leave
 * public: it can only ever say what a signed-out visitor could already infer
 * from the sign-in page's own menu.
 */
export const getPublicModules = asyncHandler(async (_req, res) => {
  res.json(await moduleAccess(null));
});
