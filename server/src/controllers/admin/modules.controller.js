import { z } from 'zod';

import { MODULES, MODULE_KEYS, moduleLabel } from '../../config/modules.js';
import { Setting } from '../../models/Setting.js';
import { AUDIT, recordAudit } from '../../services/audit.service.js';
import { hiddenModules, invalidateSettings } from '../../services/settings.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

/**
 * Which side-menu modules have shipped.
 *
 * Read is `settings:read`, so an admin can see that Notes is missing on purpose
 * and is not broken — the question they would otherwise ask the super admin.
 * Write is `module:write`, which only the super admin holds.
 */

export const moduleSchema = z.object({
  key: z.enum(MODULE_KEYS),
  hidden: z.boolean(),
});

const withState = (hidden) =>
  MODULES.map((module) => ({ ...module, hidden: hidden.includes(module.key) }));

export const listModules = asyncHandler(async (_req, res) => {
  res.json({ modules: withState(await hiddenModules()) });
});

/**
 * One module at a time, named, with its new state stated outright.
 *
 * Not a "here is the whole hidden list" PATCH: two super admins on the panel at
 * once would each send a list built from what they loaded, and the second would
 * silently undo the first. Naming one module makes concurrent edits to different
 * modules compose, and makes the audit row say which one changed without
 * diffing two arrays.
 *
 * Idempotent — asking for the state it is already in is a no-op that still
 * answers with the current list, so a double-clicked toggle cannot produce a
 * duplicate key or a spurious audit row.
 */
export const setModuleHidden = asyncHandler(async (req, res) => {
  const { key, hidden } = req.body;
  const before = await hiddenModules();

  if (before.includes(key) === hidden) {
    res.json({ modules: withState(before) });
    return;
  }

  const next = hidden ? [...before, key] : before.filter((entry) => entry !== key);

  await Setting.findOneAndUpdate(
    { key: 'app' },
    {
      $set: {
        'modules.hidden': next,
        updatedBy: req.actor._id,
        updatedByEmail: req.actor.email,
      },
    },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true },
  );

  invalidateSettings();

  await recordAudit(req, {
    action: AUDIT.MODULE_VISIBILITY,
    targetType: 'module',
    targetId: key,
    targetLabel: moduleLabel(key),
    // Phrased as the audience rather than as a boolean, because "hidden: false
    // → true" reads backwards at a glance and this log exists to be skimmed.
    meta: {
      visibility: {
        from: hidden ? 'everyone' : 'super admin only',
        to: hidden ? 'super admin only' : 'everyone',
      },
    },
  });

  res.json({ modules: withState(next) });
});
