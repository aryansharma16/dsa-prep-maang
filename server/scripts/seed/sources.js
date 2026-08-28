import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const RAW_DIR = path.resolve(here, '../../data/raw');
export const DATA_DIR = path.resolve(here, '../../data');
export const CURATED_PATH = path.join(DATA_DIR, 'curated.json');

export const LEETCODE_ALL_URL = 'https://leetcode-api-pied.vercel.app/problems';
export const NEETCODE_URL =
  'https://raw.githubusercontent.com/neetcode-gh/leetcode/main/.problemSiteData.json';
export const STRIVER_SDE_URL =
  'https://raw.githubusercontent.com/Dannavv/Striver-Resources-Scraper/main/extracted_data/striever_sde_sheet.json';
export const COMPANY_BASE =
  'https://raw.githubusercontent.com/liquidslr/leetcode-company-wise-problems/main';

/**
 * The FAANG interview-questions repo, as three markdown files.
 *
 * Kept as raw markdown in data/raw rather than parsed at fetch time, for the
 * same reason every other source is: the curate step has to be re-runnable
 * offline against exactly the bytes the current list was built from. The parser
 * lives in parse-faang.js and runs during curation.
 *
 * `master` rather than `main` — the repo's default branch, which is what the
 * raw host serves. A wrong branch name here fails as a 404 on an optional
 * download, which is to say silently, so it is worth stating why.
 */
export const FAANG_BASE =
  'https://raw.githubusercontent.com/ombharatiya/FAANG-Coding-Interview-Questions/master';

export const FAANG_FILES = [
  'README.md',
  'FAANG-Recent-Questions.md',
  'TopLeetCodeProblems.md',
];

/** Where the sheet badge, the sheet filter and curate.js all agree to call it. */
export const FAANG_SHEET = 'faang-2026';

/**
 * Weighted because a Google tag should count for more than a Cisco tag when
 * ranking what to study first.
 */
export const TIER1_COMPANIES = ['Google', 'Amazon', 'Meta', 'Apple', 'Microsoft', 'Netflix'];

export const TIER2_COMPANIES = [
  'Adobe',
  'Uber',
  'Bloomberg',
  'Atlassian',
  'LinkedIn',
  'Nvidia',
  'TikTok',
  'Oracle',
  'Salesforce',
  'Samsung',
  'Goldman Sachs',
  'Flipkart',
  'Qualcomm',
  'Cisco',
];

export const ALL_COMPANIES = [...TIER1_COMPANIES, ...TIER2_COMPANIES];

export const companyWeight = (name) => (TIER1_COMPANIES.includes(name) ? 1.0 : 0.6);

export const slugFromUrl = (url) => {
  const match = String(url || '').match(/leetcode\.com\/problems\/([^/?#\s]+)/);
  return match ? match[1] : null;
};
