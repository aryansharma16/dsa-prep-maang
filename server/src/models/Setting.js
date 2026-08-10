import mongoose from 'mongoose';

import { MODULE_KEYS } from '../config/modules.js';
import { DEFAULT_ORDER, PROVIDER_IDS } from '../services/ai/registry.js';

/**
 * Site-wide settings a super admin can change without a redeploy.
 *
 * The first of its kind in this codebase, and it exists because chat retention
 * is a promise made to the people using the app — "your questions are deleted
 * after a day" — and a promise you have to redeploy to adjust is one nobody
 * adjusts. Everything else here is configuration that governs spend, which has
 * the same property: you want it in the hands of whoever is watching the bill,
 * at the moment they are watching it.
 *
 * Keyed rather than "whichever document happens to be the only one". A fixed
 * key makes the write a `findOneAndUpdate({key:'app'}, …, {upsert:true})` that
 * cannot race two rows into existence, and leaves room for a second namespace
 * later without a migration.
 */
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, default: 'app', unique: true, immutable: true },

    chat: {
      /** The kill switch. Answers 503 CHAT_DISABLED without touching any key. */
      enabled: { type: Boolean, default: true },

      /**
       * How long a conversation outlives its last message.
       *
       * Read at write time and stamped onto each document's `expiresAt`, which
       * is what makes it changeable at all — see the note on Conversation.
       * Capped at 30 days: past that this stops being a scratchpad and becomes
       * a record of what everyone asked, which is a different product with
       * different obligations.
       */
      retentionHours: { type: Number, default: 24, min: 1, max: 24 * 30 },

      /**
       * The provider chain, in order.
       *
       * One list, not an `enabled` set plus an `order` array. Two lists can
       * disagree about a provider, and every reconciliation rule you invent for
       * that is a bug waiting to be written. Membership means enabled;
       * position means priority.
       */
      providers: {
        type: [String],
        default: () => [...DEFAULT_ORDER],
        validate: {
          validator: (list) => list.every((id) => PROVIDER_IDS.includes(id)) && new Set(list).size === list.length,
          message: 'Unknown or duplicated provider',
        },
      },

      /** Messages one account may send in a UTC day. The spend gate. */
      dailyMessageCap: { type: Number, default: 40, min: 1, max: 1000 },

      /** How many past turns get replayed to the model. Cost grows with this. */
      maxHistoryMessages: { type: Number, default: 20, min: 2, max: 100 },

      /** Hard ceiling is in the zod schema; this is the policy inside it. */
      maxInputChars: { type: Number, default: 4000, min: 200, max: 4000 },
    },

    modules: {
      /**
       * Side-menu modules that are still being built.
       *
       * A list of what is *hidden* rather than a flag per module, so the
       * default is the empty array and a module added to config/modules.js
       * ships visible without a migration writing a row for it. The inverse —
       * storing what is shown — would make every new module invisible on every
       * deployment until someone remembered to go and enable it.
       *
       * Membership means "super admin only": the nav item disappears, the
       * client route stops existing, and `requireModule` answers 404 on the API
       * behind it. See config/modules.js for why the roadmap is not eligible.
       */
      hidden: {
        type: [String],
        default: () => [],
        validate: {
          validator: (list) =>
            list.every((key) => MODULE_KEYS.includes(key)) && new Set(list).size === list.length,
          message: 'Unknown or duplicated module',
        },
      },
    },

    // Denormalised alongside the id for the same reason AuditLog keeps
    // actorEmail: the panel should still say who changed this after the account
    // is gone.
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByEmail: { type: String, default: '' },
  },
  { timestamps: true },
);

export const Setting = mongoose.model('Setting', settingSchema);
