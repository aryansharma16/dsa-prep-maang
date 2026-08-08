/**
 * Warms the company logo cache in Mongo. Optional — the API fetches any missing
 * logo on first request anyway — but running it once after a seed means the
 * first person to open the roadmap does not wait on twenty cold lookups.
 *
 *   npm run seed:logos
 */
import { connectDb, disconnectDb } from '../../src/config/db.js';
import { CompanyLogo } from '../../src/models/CompanyLogo.js';
import { Problem } from '../../src/models/Problem.js';
import { companySlug, domainFor, ensureLogo } from '../../src/services/logo.service.js';

async function main() {
  await connectDb();

  // Every company actually tagged on a problem, not just the seed list — a
  // problem you added yourself can name a company the curation pass never saw.
  const names = await Problem.distinct('companies.name');
  const slugs = [...new Set(names.map(companySlug).filter(Boolean))].sort();

  console.log(`[seed:logos] ${slugs.length} companies tagged on problems`);

  let stored = 0;
  let missing = 0;
  for (const slug of slugs) {
    const logo = await ensureLogo(slug);
    if (logo) {
      stored += 1;
      console.log(`  ok   ${slug.padEnd(20)} ${logo.source} ${Math.round(logo.bytes / 102.4) / 10}KB`);
    } else {
      missing += 1;
      console.warn(`  --   ${slug.padEnd(20)} no logo at ${domainFor(slug)}`);
    }
  }

  const total = await CompanyLogo.aggregate([
    { $group: { _id: null, bytes: { $sum: '$bytes' } } },
  ]);

  console.log(
    `\n[seed:logos] ${stored} cached, ${missing} without a logo — ` +
      `${Math.round((total[0]?.bytes || 0) / 1024)}KB in the database`,
  );

  await disconnectDb();
}

main().catch(async (err) => {
  console.error('[seed:logos] failed:', err.message);
  await disconnectDb().catch(() => {});
  process.exit(1);
});
