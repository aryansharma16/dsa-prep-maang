/**
 * The "Classic" and "Kit" outreach templates, used by Interview Helper →
 * Outreach Messages (pages/MessageBuilder.jsx). This used to back a separate
 * Outreach Templates page, which was merged into the builder.
 *
 * Written for this app. Each template is plain text with {placeholders}; the
 * page fills them from the details you type in, and leaves any you have not
 * filled as [Bracketed hints] so a gap is obvious before you send.
 */

/** The details a template can ask for, in the order the form shows them. */
export const FIELDS = [
  { key: 'recruiter', label: 'Recruiter first name', placeholder: 'Priya' },
  { key: 'company', label: 'Company', placeholder: 'Amazon' },
  { key: 'team', label: 'Team or role', placeholder: 'SDE II, Payments' },
  { key: 'you', label: 'Your name', placeholder: 'Aryan Sharma' },
  { key: 'headline', label: 'You in one line', placeholder: 'backend engineer, 3 years in Java and Spring' },
  {
    key: 'proof',
    label: 'Your strongest result',
    placeholder: 'cut checkout API latency 40% by moving pricing to a Redis cache',
    long: true,
  },
  { key: 'contact', label: 'Phone · LinkedIn', placeholder: '+91 98xxxxxx · linkedin.com/in/you' },
];

/** Shown where a field is still empty. */
export const HINTS = {
  recruiter: '[Recruiter name]',
  company: '[Company]',
  team: '[Team / role]',
  you: '[Your name]',
  headline: '[your role and years, e.g. backend engineer, 3 years in Java]',
  proof: '[one result with a number, straight from your resume]',
  contact: '[Phone · LinkedIn URL]',
};

export const TEMPLATES = [
  {
    id: 'email',
    label: 'Cold email',
    when: 'First message to a recruiter’s work email. The subject line decides whether it gets opened, so name the role.',
    subject: '{team} at {company} — {you}',
    body: `Hi {recruiter},

I'm {you}, a {headline}. I saw that you hire for {company}, and I wanted to write to you directly about {team} roles.

One thing I'd bring to the team: I {proof}.

My resume is attached. If there's a fit, I'd be glad to talk whenever suits you.

Thanks for reading,
{you}
{contact}`,
  },
  {
    id: 'linkedin',
    label: 'LinkedIn note',
    when: 'Goes with a connection request. LinkedIn allows about 300 characters, so the counter turns red past that.',
    limit: 300,
    body: `Hi {recruiter}, I'm a {headline} looking at {team} roles at {company}. I'd like to connect and share my resume if it's a fit. Thanks!`,
  },
  {
    id: 'followup',
    label: 'Follow-up',
    when: 'Once, about a week after your first message, as a reply on the same thread. If there is still no answer, move on.',
    subject: 'Re: {team} at {company} — {you}',
    body: `Hi {recruiter},

Bumping this in case it got buried. I'm still keen on {team} at {company} and happy to share more or jump on a short call.

Thanks,
{you}`,
  },
  {
    id: 'thanks',
    label: 'After a call',
    when: 'Same day as a screening call. Short, specific, and it puts the next step in writing.',
    subject: 'Thanks for today — {you}',
    body: `Hi {recruiter},

Thanks for the time today. I enjoyed hearing about {team}, and I'm even more interested after our chat.

To confirm the next step as I understood it: [next step and date]. Let me know if anything else would help from my side.

Best,
{you}`,
  },
];


/**
 * The resource kit's cold email, word for word as supplied by the account
 * owner. Slots are filled from your details; an empty slot shows the kit's
 * original bracket text (`hints`), so with nothing filled in it reads exactly
 * like the original.
 */
export const KIT_COLD_EMAIL = {
  id: 'kit-email',
  label: 'Cold email (kit)',
  when: 'The resource kit’s original cold email, unchanged. Your details fill the brackets.',
  subject: '{you} — Interested in {team} at {company}',
  body: `Hi {recruiter},

I'm {you}, a {headline}. I came across your profile and saw you recruit for {company}'s {teamOrg} — wanted to reach out directly rather than just applying cold.

{proofSentence}

I'd love to be considered for {roleAsk}. Resume is attached — happy to share more context on any part of it.

Thanks for your time,
{you}
{contact}`,
  hints: {
    you: '[Your Name]',
    recruiter: '[First Name]',
    company: '[Company]',
    team: '[Team / Role]',
    teamOrg: '[team / org]',
    roleAsk: '[specific role, e.g. "SDE II openings on your team"]',
    headline: '[current title — e.g. "backend engineer with 3 years in distributed systems"]',
    proofSentence: '[One or two sentences: your single strongest, quantified achievement relevant to this team.]',
    contact: '[Phone] · [LinkedIn URL]',
  },
};

/** The kit's LinkedIn connection note, word for word. */
export const KIT_LINKEDIN = {
  id: 'kit-linkedin',
  label: 'LinkedIn note (kit)',
  when: 'The resource kit’s original connection note, unchanged. Your one-line description fills the role, years and stack.',
  limit: 300,
  body: `Hi {recruiter} — I'm a {headline}, interested in {company}'s {teamName} team. Would love to connect and share my resume if there's a fit.`,
  hints: {
    recruiter: '[First Name]',
    headline: '[role] with [X] years in [stack]',
    company: '[Company]',
    teamName: '[team]',
  },
};

/** The kit's follow-up, word for word. */
export const KIT_FOLLOWUP = {
  id: 'kit-followup',
  label: 'Follow-up (kit)',
  when: 'The resource kit’s original follow-up, unchanged. Send it as a reply on the same thread.',
  subject: 'Re: {you} — Interested in {team} at {company}',
  body: `Hi {recruiter},

Just following up in case my note below got buried — still very interested in {company}'s {teamName} team, and happy to share more detail or jump on a quick call whenever works for you.

Thanks again for your time,
{you}`,
  hints: {
    you: '[Your Name]',
    recruiter: '[First Name]',
    company: '[Company]',
    team: '[Team / Role]',
    teamName: '[team]',
  },
};

// Shown on the page next to the matching templates.
TEMPLATES.splice(1, 0, KIT_COLD_EMAIL);
TEMPLATES.splice(3, 0, KIT_LINKEDIN);
TEMPLATES.splice(5, 0, KIT_FOLLOWUP);

export const TIPS = [
  { title: 'Keep it short', text: 'Under about 150 words. Recruiters read between meetings.' },
  { title: 'Name one role', text: '"Any opening" reads like a mass mail. Say which team or level.' },
  { title: 'One result, with a number', text: 'A single measurable line beats three vague ones. Take it from your resume.' },
  { title: 'Make the opener about them', text: 'Their name, their team or a specific posting, never a line that fits anyone.' },
  { title: 'Match your resume to the level', text: 'Check what your level needs on Resume Building first.', link: '/interview/resume' },
  { title: 'Follow up once', text: 'One nudge after 7–10 days is normal. After that, let it go.' },
];

/** Fill {placeholders}; empty ones become their [hint]. */
export const fill = (text, values, hints = {}) => {
  const proof = values.proof?.trim();
  const all = {
    ...values,
    teamOrg: values.team,
    roleAsk: values.team,
    teamName: values.team,
    proofSentence: proof ? `I ${proof.replace(/^I\s+/i, '').replace(/\.$/, '')}.` : '',
  };
  return text.replace(
    /\{(\w+)\}/g,
    (_, key) => all[key]?.trim() || hints[key] || HINTS[key] || `[${key}]`,
  );
};
