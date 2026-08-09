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
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Nothing to update');
