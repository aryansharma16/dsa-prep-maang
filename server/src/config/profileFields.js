import { z } from 'zod';

/**
 * The optional profile block, defined once.
 *
 * Three places need to agree on this list: the self-edit endpoint, the admin
 * edit endpoint, and the Mongoose schema. Defining it here means adding a field
 * is one edit rather than three that drift.
 */
export const profileSchema = z
  .object({
    // 400 was too tight — a normal "who I am and what I'm working on" runs
    // past it, and the field truncated mid-word with nothing to say it had.
    bio: z.string().max(1200),
    college: z.string().max(120),
    location: z.string().max(80),
    gradYear: z.number().int().min(1950).max(2100).nullable(),
    targetRole: z.string().max(80),
    github: z.string().max(200),
    linkedin: z.string().max(200),
    leetcode: z.string().max(200),
    website: z.string().max(200),
    targetCompanies: z.array(z.string().min(1).max(60)).max(15),
    phone: z.string().max(40),
    currentCompany: z.string().max(80),
    currentTitle: z.string().max(80),
    yearsExp: z.string().max(10),
    noticePeriod: z.string().max(40),
    pitches: z
      .array(
        z.object({
          key: z.string().regex(/^[a-z0-9-]{1,20}$/),
          label: z.string().min(1).max(40),
          headline: z.string().max(200),
          short: z.string().max(120),
          proofs: z.array(z.string().trim().min(1).max(300)).max(8),
        }),
      )
      .max(4),
  })
  .partial();

/**
 * Appearance: theme and accent colour.
 *
 * Not part of `profileSchema`, and so not reachable from the admin user-edit
 * endpoint that imports it — an admin correcting somebody's grad year has no
 * business changing the colour of their UI.
 *
 * `accent` is loose on purpose; see the note on `prefsSchema` in models/User.js.
 * The shape is all this needs to enforce, since an unknown id degrades to the
 * default in the client rather than breaking anything.
 */
export const prefsSchema = z
  .object({
    theme: z.enum(['dark', 'light']),
    accent: z.string().regex(/^[a-z]{2,12}$/, 'Not an accent name'),
    accentCustom: z
      .string()
      .regex(/^#[0-9a-f]{6}$/i, 'Not a #rrggbb colour')
      .or(z.literal('')),
  })
  .partial();

/**
 * What a user may change about themselves.
 *
 * Email is here because it is their account — but `assertEmailNotReserved`
 * still runs, so the pinned super-admin address can neither be claimed nor
 * moved off. Role and avatar are not: role is the panel's job, and the avatar
 * has its own upload route.
 */
export const selfUpdateSchema = z
  .object({
    name: z.string().min(1).max(60),
    email: z.string().email(),
    profile: profileSchema,
    prefs: prefsSchema,
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
