/**
 * Things to double-check before contacting a recruiter.
 *
 * The directory's data came from a contact list, not from the people
 * themselves, so some details are likely wrong or stale. These are heuristics
 * on the data alone; they flag what to verify (on LinkedIn, or by not calling),
 * they do not prove anything is wrong.
 *
 * Each check returns { level: 'warn' | 'info', field, text }.
 */

/** Work-email domains we expect for each company. Unknown companies are not checked. */
const COMPANY_DOMAINS = {
  Amazon: ['amazon.com', 'amazon.in'],
  Microsoft: ['microsoft.com'],
  Google: ['google.com'],
  Apple: ['apple.com'],
  Meta: ['meta.com', 'fb.com'],
  NVIDIA: ['nvidia.com'],
  JPMorganChase: ['jpmchase.com', 'jpmorgan.com', 'chase.com'],
  'UnitedHealth Group': ['uhg.com', 'optum.com', 'unitedhealthgroup.com'],
  Cencora: ['cencora.com'],
  'Cardinal Health': ['cardinalhealth.com'],
  Edifis: ['edifis.it', 'edifis.com'],
};

const SENIOR = new Set(['vp', 'director', 'head']);

/** +91 followed by a 10-digit number starting 6–9 is an Indian mobile. */
const isIndianMobile = (digits) => /^91[6-9]\d{9}$/.test(digits);

export function contactChecks(r) {
  const out = [];
  const phoneDigits = String(r.phone || '').replace(/[^0-9]/g, '');
  const raw = String(r.phone || '').trim();

  if (raw) {
    if (raw.startsWith('+') && !raw.startsWith('+91')) {
      const cc = raw.match(/^\+(\d{1,3})/)?.[1];
      out.push({
        level: 'warn',
        field: 'phone',
        text: `Phone is a +${cc} number for someone listed in India: likely an office switchboard or someone else's number. Don't call it.`,
      });
    } else if (!isIndianMobile(phoneDigits)) {
      out.push({
        level: 'warn',
        field: 'phone',
        text: 'Phone is not an Indian mobile number: probably an office landline. Reach out on LinkedIn or email instead.',
      });
    }
  }

  const email = String(r.email || '').toLowerCase();
  if (!email) {
    out.push({ level: 'warn', field: 'email', text: 'No email on file. Use LinkedIn.' });
  } else {
    const [local, domain] = email.split('@');
    const expected = COMPANY_DOMAINS[r.company];
    if (expected && !expected.includes(domain)) {
      out.push({
        level: 'warn',
        field: 'email',
        text: `Email is at ${domain}, not a ${r.company} address: it may belong to a different person or an agency.`,
      });
    }
    if (/^v-/.test(local)) {
      out.push({
        level: 'warn',
        field: 'email',
        text: 'A "v-" address is usually a vendor or contractor account: they may recruit for an agency, not the company directly.',
      });
    }
  }

  if (SENIOR.has(r.seniority)) {
    out.push({
      level: 'info',
      field: 'name',
      text: 'Senior talent leader: rarely replies to cold messages. A sourcer or TA specialist at your level is a better first contact.',
    });
  }

  return out;
}
