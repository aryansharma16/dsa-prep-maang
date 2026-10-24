/**
 * Import recruiter contacts into one account's MAANG Recruiter Directory.
 *
 *   node scripts/interview/import-recruiters.js --email you@example.com --file /path/to/recruiters.json
 *
 * The file is a JSON array of { name, title, seniority, company, location,
 * phone, email, linkedin }. It is read from wherever you keep it and never
 * committed: these are real people's phone numbers, so the data stays out of
 * the repo.
 *
 * Rows are imported as `private` to the account named by --email, so only that
 * account (and the super admin) sees them. Flags:
 *   --shared  visible to every user
 *   --locked  part of the main directory: nobody can edit or delete them in
 *             the app (re-run this script to change them)
 * The main directory was imported with --shared --locked.
 *
 * Safe to run twice. A contact is matched by email (or by name + company when
 * there is no email) and refreshed in place. Outreach status and notes live in
 * a separate collection and are never touched.
 */
import { readFile } from 'node:fs/promises';
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { Recruiter, RECRUITER_SENIORITY } from '../../src/models/Recruiter.js';
import { User } from '../../src/models/User.js';

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const clean = (v, max) => String(v ?? '').trim().slice(0, max);

async function main() {
  const email = arg('email');
  const file = arg('file');
  const shared = process.argv.includes('--shared');
  const locked = process.argv.includes('--locked');
  if (!email || !file) {
    console.error('Usage: --email <account email> --file <recruiters.json> [--shared] [--locked]');
    process.exit(1);
  }

  const rows = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(rows)) throw new Error('Expected a JSON array');

  await connectDb();
  const user = await User.findOne({ email: email.toLowerCase().trim() }).select('_id').lean();
  if (!user) throw new Error(`No account with email ${email}`);

  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const r of rows) {
    const doc = {
      name: clean(r.name, 120),
      title: clean(r.title, 160),
      seniority: RECRUITER_SENIORITY.includes(r.seniority) ? r.seniority : 'other',
      company: clean(r.company, 80),
      location: clean(r.location, 120),
      phone: clean(r.phone, 40),
      email: clean(r.email, 160).toLowerCase(),
      linkedin: clean(r.linkedin, 300).replace(/^http:\/\//, 'https://'),
      visibility: shared ? 'shared' : 'private',
      locked,
    };
    if (!doc.name || !doc.company) {
      skipped += 1;
      continue;
    }

    const match = doc.email
      ? { owner: user._id, email: doc.email }
      : { owner: user._id, name: doc.name, company: doc.company };

    const res = await Recruiter.updateOne(
      match,
      { $set: doc, $setOnInsert: { owner: user._id } },
      { upsert: true, runValidators: true },
    );
    if (res.upsertedCount) added += 1;
    else updated += 1;
  }

  console.log(`[recruiters] ${email}: ${added} added, ${updated} refreshed, ${skipped} skipped`);
}

main()
  .catch((err) => {
    console.error('[recruiters]', err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectDb());
