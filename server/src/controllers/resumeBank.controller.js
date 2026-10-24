import { z } from 'zod';
import { RESUME_KINDS, Resume, publicResume } from '../models/Resume.js';
import { ownedResume, storeLink, storeUpload } from '../services/resume.service.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Interview Helper → Resume Building → Resume bank.
 *
 * The same CV library Applications uses (one `resumes` collection, deduped by
 * file hash), reachable from Interview Helper and with a few more fields: what
 * the resume is for (general / company / role), the target company and role,
 * notes, and which earlier resume it is a newer version of. Listing, opening
 * and deleting reuse the Applications handlers; only upload/link/update differ.
 */

const objectId = z.string().regex(/^[a-f0-9]{24}$/, 'Bad id');

const metaFields = {
  label: z.string().trim().min(1).max(80).optional(),
  kind: z.enum(RESUME_KINDS).optional(),
  company: z.string().trim().max(80).optional(),
  role: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(300).optional(),
  // Upload this as a newer version of that resume.
  versionOf: objectId.nullable().optional(),
};

export const bankLinkSchema = z.object({ url: z.string().trim().min(1).max(2000), ...metaFields }).strict();
export const bankUpdateSchema = z
  .object(metaFields)
  .strict()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update');

/** Turn validated fields into what is stored, resolving `versionOf` to a family root. */
async function applyMeta(resume, userId, body) {
  for (const key of ['label', 'kind', 'company', 'role', 'notes']) {
    if (body[key] !== undefined) resume[key] = body[key];
  }
  if (body.versionOf !== undefined) {
    if (body.versionOf === null) {
      resume.family = null;
    } else {
      if (String(body.versionOf) === String(resume._id)) throw ApiError.badRequest('A resume cannot be a version of itself');
      const parent = await ownedResume(body.versionOf, userId);
      resume.family = parent.family || parent._id;
      // A new version inherits what the line is for unless you said otherwise.
      if (body.kind === undefined) resume.kind = parent.kind;
      if (body.company === undefined && !resume.company) resume.company = parent.company;
      if (body.role === undefined && !resume.role) resume.role = parent.role;
    }
  }
  await resume.save();
  return resume;
}

/** Multipart fields arrive as strings; validate them the same way as JSON. */
const multipartMeta = (raw = {}) => {
  const pick = {};
  for (const key of ['label', 'kind', 'company', 'role', 'notes', 'versionOf']) {
    if (typeof raw[key] === 'string' && raw[key] !== '') pick[key] = raw[key];
  }
  const parsed = z.object(metaFields).safeParse(pick);
  if (!parsed.success) throw ApiError.badRequest(parsed.error.issues.map((i) => i.message).join('; '), 'VALIDATION');
  return parsed.data;
};

export const uploadToBank = asyncHandler(async (req, res) => {
  const meta = multipartMeta(req.body);
  const { resume, existed } = await storeUpload(req.userId, req.file, { label: meta.label || '' });
  const doc = await Resume.findById(resume._id);
  await applyMeta(doc, req.userId, meta);
  res.status(existed ? 200 : 201).json({ resume: publicResume(doc), existed });
});

export const linkToBank = asyncHandler(async (req, res) => {
  const { url, ...meta } = req.body;
  const { resume, existed } = await storeLink(req.userId, url, { label: meta.label || '' });
  const doc = await Resume.findById(resume._id);
  await applyMeta(doc, req.userId, meta);
  res.status(existed ? 200 : 201).json({ resume: publicResume(doc), existed });
});

export const updateInBank = asyncHandler(async (req, res) => {
  const resume = await ownedResume(req.params.resumeId, req.userId);
  await applyMeta(resume, req.userId, req.body);
  res.json({ resume: publicResume(resume) });
});
