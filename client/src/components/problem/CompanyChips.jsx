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

/** Top companies by ask-frequency. `hot` marks anything asked very often there. */
export function CompanyChips({ companies = [], max = 3 }) {
  if (!companies.length) return <span className="co-more">—</span>;

  const shown = companies.slice(0, max);
  const rest = companies.length - shown.length;

  return (
    <div className="cos">
      {shown.map((c) => (
        <span
          key={c.name}
          className={`co ${c.freq >= 40 ? 'hot' : ''}`}
          title={`${c.name} — asked frequency ${c.freq}/100`}
        >
          {short(c.name)}
        </span>
      ))}
      {rest > 0 && (
        <span className="co-more" title={companies.slice(max).map((c) => c.name).join(', ')}>
          +{rest}
        </span>
      )}
    </div>
  );
}
