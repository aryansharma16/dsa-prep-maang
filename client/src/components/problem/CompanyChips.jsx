import { useState } from 'react';

// Fallback only — shown when no provider had a logo for the company.
const SHORT = {
  Google: 'GOOG',
  Amazon: 'AMZN',
  Microsoft: 'MSFT',
  Meta: 'META',
  Apple: 'AAPL',
  Netflix: 'NFLX',
  Adobe: 'ADBE',
  Bloomberg: 'BLMB',
  Salesforce: 'CRM',
  'Goldman Sachs': 'GS',
  LinkedIn: 'LNKD',
  Qualcomm: 'QCOM',
  Samsung: 'SMSG',
  Atlassian: 'ATLS',
  Flipkart: 'FLPK',
  Nvidia: 'NVDA',
  Oracle: 'ORCL',
  TikTok: 'TIKT',
  Cisco: 'CSCO',
  Uber: 'UBER',
};

const short = (name) => SHORT[name] || name.slice(0, 4).toUpperCase();

const slugify = (name) =>
  String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Same-origin /api, so this rides the Vite proxy in dev and the Vercel rewrite
// in prod exactly like every other call. The server caches the bytes in Mongo
// and serves them with a month-long max-age, so this is one request per company
// per browser, not one per row.
const logoSrc = (name) =>
  `${import.meta.env.VITE_API_URL || ''}/api/companies/${slugify(name)}/logo`;

function CompanyLogo({ company }) {
  const [failed, setFailed] = useState(false);
  const hot = company.freq >= 40;
  const title = `${company.name} — asked frequency ${company.freq}/100`;

  if (failed) {
    return (
      <span className={`co ${hot ? 'hot' : ''}`} title={title}>
        {short(company.name)}
      </span>
    );
  }

  return (
    <img
      className={`co-logo ${hot ? 'hot' : ''}`}
      src={logoSrc(company.name)}
      alt={company.name}
      title={title}
      width={18}
      height={18}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Top companies by ask-frequency. `hot` marks anything asked very often there. */
export function CompanyChips({ companies = [], max = 3 }) {
  if (!companies.length) return <span className="co-more">—</span>;

  const shown = companies.slice(0, max);
  const rest = companies.length - shown.length;

  return (
    <div className="cos">
      {shown.map((c) => (
        <CompanyLogo key={c.name} company={c} />
      ))}
      {rest > 0 && (
        <span className="co-more" title={companies.slice(max).map((c) => c.name).join(', ')}>
          +{rest}
        </span>
      )}
    </div>
  );
}
