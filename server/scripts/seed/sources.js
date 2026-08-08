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
