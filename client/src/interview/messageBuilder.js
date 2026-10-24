/**
 * Message Builder templates: pick a platform and a purpose, get a message.
 *
 * Written for this app, aimed at MAANG-tier hiring in India. Every message
 * follows the same shape, because it is what gets a reply from someone busy:
 *   1. who you are, in one line
 *   2. exactly what you want (one role, one ask)
 *   3. one or two results with numbers, not a skills list
 *   4. an easy yes: make the next step cost them almost nothing
 *
 * Templates use {placeholders}. The builder fills them from your profile and
 * the form; anything empty shows as a [hint] so a gap is obvious before you send.
 *
 * "Pro" templates are the ones written here. "Classic" ones come from the
 * Outreach Templates page, so you can pick either.
 */
import {
  KIT_COLD_EMAIL,
  KIT_FOLLOWUP,
  KIT_LINKEDIN,
  TEMPLATES as CLASSIC,
} from './outreachTemplates.js';

export const PLATFORMS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'email', label: 'Email' },
  { id: 'call', label: 'Call' },
];

/** LinkedIn has two shapes; the others have one. */
export const LINKEDIN_MODES = [
  { id: 'note', label: 'Connection note', hint: '300 characters max' },
  { id: 'chat', label: 'Message / InMail', hint: 'After you are connected, or InMail' },
];

/** platform (+ LinkedIn mode) → which format of a template to use. */
export const formatFor = (platform, linkedinMode) =>
  platform === 'linkedin' ? linkedinMode : platform === 'whatsapp' ? 'chat' : platform;

export const LIMITS = { note: 300 };

export const TYPES = [
  { id: 'referral', label: 'Ask for a referral', who: 'An engineer or employee at the company' },
  { id: 'opening', label: 'Ask about openings', who: 'A recruiter' },
  { id: 'applied', label: 'After applying', who: 'The recruiter for that role' },
  { id: 'followup', label: 'Follow-up (no reply)', who: 'Someone who has not answered yet' },
  { id: 'thanks', label: 'Thank you after interview', who: 'Interviewer or recruiter' },
  { id: 'reply', label: 'Reply to a recruiter', who: 'A recruiter who messaged you first' },
];

/** Which "about them" fields each purpose needs. */
export const TYPE_FIELDS = {
  referral: ['to', 'company', 'role', 'team', 'jobRef', 'mutual'],
  opening: ['to', 'company', 'role', 'team', 'source'],
  applied: ['to', 'company', 'role', 'team', 'jobRef', 'appliedOn'],
  followup: ['to', 'company', 'role', 'team', 'update'],
  thanks: ['to', 'company', 'role', 'round', 'topic'],
  reply: ['to', 'company', 'role', 'team', 'slots'],
};

/** Every field a template can use, with its form label and empty-state hint. */
export const FIELD_META = {
  to: { label: 'Their first name', placeholder: 'Priya', hint: '[Name]' },
  company: { label: 'Target company', placeholder: 'Google', hint: '[Company]' },
  role: { label: 'Role / job title', placeholder: 'Software Engineer II', hint: '[Role]' },
  team: { label: 'Team / org (optional)', placeholder: 'Payments', hint: '' },
  jobRef: { label: 'Job ID or link', placeholder: 'Job ID 123456', hint: '[Job ID / link]' },
  mutual: { label: 'How you know them', placeholder: 'we were both at LPU', hint: '[how you know them]' },
  source: { label: 'Where you found them', placeholder: 'your post about hiring in Bengaluru', hint: '[where you found them]' },
  appliedOn: { label: 'Applied on', placeholder: '20 Oct', hint: '[date]' },
  update: { label: 'Anything new since', placeholder: 'I cleared the online assessment', hint: '' },
  round: { label: 'Interview round', placeholder: 'system design round', hint: '[round]' },
  topic: { label: 'Something you discussed', placeholder: 'how you shard the ledger service', hint: '[topic]' },
  slots: { label: 'When you are free', placeholder: 'Tue–Thu after 6 pm', hint: '[days / times]' },

  me: { label: 'Your name', hint: '[Your name]' },
  myTitle: { label: 'Current title', placeholder: 'Software Engineer', hint: '[your title]' },
  myCompany: { label: 'Current company', placeholder: "Masters' Union", hint: '[your company]' },
  years: { label: 'Years of experience', placeholder: '3.5+', hint: '[X]' },
  notice: { label: 'Notice period', placeholder: '30 days', hint: '[notice period]' },
  phone: { label: 'Phone', hint: '[phone]' },
  email: { label: 'Email', hint: '[email]' },
  linkedin: { label: 'LinkedIn URL', hint: '[LinkedIn]' },
  portfolio: { label: 'GitHub / portfolio', hint: '[portfolio]' },
  stack: { label: 'Your stack', placeholder: 'Node.js, TypeScript and AWS', hint: '[stack]' },

  headline: { label: 'Headline', hint: '[one line about you]' },
  short: { label: 'Short pitch', hint: '[short pitch]' },
  proof1: { label: 'Proof point 1', hint: '[a result with a number]' },
  proof2: { label: 'Proof point 2', hint: '[another result with a number]' },

  // Built from the fields above in derive().
  roleLine: { hint: '[Role]' },
  contactLine: { hint: '[phone · LinkedIn]' },
  // Optional sentences: vanish when their field is empty.
  mutualSentence: { hint: '' },
  updateSentence: { hint: '' },
};

/* -------------------------------------------------------------------------- */
/* Pro templates: TEMPLATES[type][format] = { subject?, body }                 */
/* -------------------------------------------------------------------------- */

export const PRO = {
  referral: {
    note: {
      body: `Hi {to}, I'm {me}, {short} at {myCompany}. I'm applying for {roleLine} at {company} and would really value a referral if my profile fits. Happy to send my resume and the job ID so it takes you two minutes.`,
    },
    chat: {
      body: `Hi {to}, I'm {me}, {myTitle} at {myCompany} ({mutualLine}).

I'm applying for {roleLine} at {company} ({jobRef}), and I think my background lines up well:
• I {proof1}
• I {proof2}

Would you be comfortable referring me? I'll send my resume plus a 3-line summary you can paste straight into the referral form.

No worries at all if it's not possible. Thanks either way!
{me}`,
    },
    email: {
      subject: `Referral request: {role} at {company} ({jobRef})`,
      body: `Hi {to},

I'm {me}, a {headline}. {mutualSentence}I'm applying for {roleLine} at {company} and would be grateful for a referral.

Why I think I'm a strong fit:
• I {proof1}.
• I {proof2}.

To make it quick, here is what the referral form usually asks for:
• Role: {role} ({jobRef})
• Resume: attached
• LinkedIn: {linkedin}

If you'd prefer a 10-minute chat first, I'm happy to. And if it isn't something you can do, no problem at all.

Thanks,
{me}
{phone} · {linkedin}`,
    },
    call: {
      body: `OPEN (10 sec)
"Hi {to}, this is {me}. {mutualSentence}Do you have two minutes?"

WHO YOU ARE
"I'm {myTitle} at {myCompany}, {short}."

WHY YOU'RE CALLING
"I'm applying for {roleLine} at {company}, and I'd really value a referral."

ONE PROOF POINT
"Most relevant: I {proof1}."

THE ASK
"Would you be open to referring me? I can WhatsApp you my resume and the job ID right after this call."

IF THEY'RE BUSY OR UNSURE
"Totally fine. Could I send you a short message with the details, and you decide then?"

CLOSE
"Thank you, I'll send it within the hour."`,
    },
  },

  opening: {
    note: {
      body: `Hi {to}, I'm {me}, {short} at {myCompany}. I'm keen on {roleLine} roles at {company} and would love to be considered. Could I share my resume?`,
    },
    chat: {
      body: `Hi {to}, I'm {me}, {myTitle} at {myCompany} with {years} years of experience. I came across {sourceLine}.

I'm interested in {roleLine} openings at {company}. A quick snapshot:
• I {proof1}
• I {proof2}

Could I share my resume, or is there a specific role you'd point me to?

Thanks,
{me} · {linkedin}`,
    },
    email: {
      subject: `{role} at {company}: {me}, {years} yrs`,
      body: `Hi {to},

I'm {me}, a {headline}. I found you through {sourceLine}, and I'd like to be considered for {roleLine} roles at {company}.

Two things I've built that are relevant:
• I {proof1}.
• I {proof2}.

Resume attached. Notice period: {notice}. If there's a fit, I'd be glad to speak at a time that suits you.

Best regards,
{me}
{phone} · {linkedin}`,
    },
    call: {
      body: `OPEN
"Hi {to}, this is {me}. I found your details through {sourceLine}. Is this a good time for two minutes?"

WHO YOU ARE
"I'm {myTitle} at {myCompany}, {years} years, {short}."

WHY YOU'RE CALLING
"I'm interested in {roleLine} openings at {company}."

ONE PROOF POINT
"For example, I {proof1}."

THEY WILL ASK, HAVE IT READY
• Notice period: {notice}
• Current and expected CTC: know your numbers, let them share the band first
• Location: open to relocation?

THE ASK
"Could I email you my resume? What's the best address?"

CLOSE
"Thanks, sending it today. Is it okay if I follow up next week?"`,
    },
  },

  applied: {
    note: {
      body: `Hi {to}, I applied for {roleLine} at {company} ({jobRef}). I'm {short}, and I'd be grateful if my application got a look. Happy to share anything that helps.`,
    },
    chat: {
      body: `Hi {to}, I applied for {roleLine} at {company} on {appliedOn} ({jobRef}), and wanted to put a face to the application.

In one line: I'm a {headline}. The most relevant thing I've done: I {proof1}.

Could you take a look, or point me to the right recruiter for this role? Thank you!
{me}`,
    },
    email: {
      subject: `Application for {role} ({jobRef}): {me}`,
      body: `Hi {to},

I applied for {roleLine} at {company} on {appliedOn} ({jobRef}) and wanted to put a face to the application.

In short, I'm a {headline}. The most relevant results:
• I {proof1}.
• I {proof2}.

If it helps, I'm happy to do a quick call or go deeper on any of this. Thanks for your time.

Best,
{me}
{phone} · {linkedin}`,
    },
    call: {
      body: `OPEN
"Hi {to}, this is {me}. I applied for {roleLine} at {company} on {appliedOn}. Do you have a minute?"

WHY YOU'RE CALLING
"I wanted to check the application reached the right person, and share one line of context."

ONE PROOF POINT
"I'm {short}. Most relevant: I {proof1}."

THE ASK
"Is there anything else you need from me, or someone better to speak to about this role?"

CLOSE
"Thank you. I'll keep an eye on email."`,
    },
  },

  followup: {
    note: {
      body: `Hi {to}, following up on my note about {roleLine} at {company}. Still very interested, and happy to share my resume or jump on a 10-minute call.`,
    },
    chat: {
      body: `Hi {to}, bumping my earlier message in case it got buried. Still keen on {roleLine} at {company}.{updateSentence}

Happy to share anything that helps, or if someone else is better to talk to, a pointer would be great. Thanks!`,
    },
    email: {
      subject: `Re: {role} at {company}: {me}`,
      body: `Hi {to},

Following up on my note from last week about {roleLine} at {company}. I know inboxes get busy, so in one line: I {proof1}.{updateSentence}

If now isn't the right time, or there's someone better to speak to, a pointer would be much appreciated.

Thanks,
{me}`,
    },
    call: {
      body: `ONLY CALL IF YOU ALREADY SPOKE OR THEY GAVE YOU THEIR NUMBER

OPEN
"Hi {to}, this is {me}. I wrote to you last week about {roleLine} at {company}. Is now a bad time?"

UPDATE
"{updateOrProof}"

THE ASK
"Is the role still open, and is there anything you need from me?"

CLOSE
"Thanks, I'll wait to hear from you."`,
    },
  },

  thanks: {
    note: {
      body: `Hi {to}, thank you for the {round} today. I enjoyed discussing {topic}, and I'm even more excited about {roleLine} at {company}.`,
    },
    chat: {
      body: `Hi {to}, thank you for your time in today's {round}. I really enjoyed the discussion on {topic}.

One thought I had afterwards: [a better approach or a detail you'd add].

Looking forward to the next steps!
{me}`,
    },
    email: {
      subject: `Thank you: {round}, {role}`,
      body: `Hi {to},

Thank you for your time in today's {round}. I enjoyed the discussion on {topic}, and it made me more excited about {roleLine} at {company}.

A follow-up thought: [the improvement you'd make, or the trade-off you'd now choose differently, in one or two lines]. That kind of problem is close to what I do day to day, since I {proof1}.

Looking forward to the next steps.

Best,
{me}`,
    },
    call: {
      body: `USE ONLY IF THE RECRUITER ASKED YOU TO CALL

OPEN
"Hi {to}, it's {me}. Just calling to say thanks for setting up today's {round}."

ONE LINE
"I enjoyed the discussion on {topic}."

THE ASK
"What are the next steps, and roughly when should I expect to hear back?"

CLOSE
"Thanks, I'll keep my calendar flexible this week."`,
    },
  },

  reply: {
    note: {
      body: `Thanks for reaching out, {to}! I'm interested in {roleLine} at {company}. Happy to talk this week: {phone}.`,
    },
    chat: {
      body: `Hi {to}, thanks for reaching out. I'm interested in {roleLine} at {company}.

Quick summary: {years} years as {myTitle} at {myCompany}. Most relevant: I {proof1}.

Notice period: {notice}. I'm free {slots}, or you can reach me on {phone}.

Could you share the JD and which team it's for?
{me}`,
    },
    email: {
      subject: `Re: {role} at {company}`,
      body: `Hi {to},

Thank you for reaching out. I'm interested in {roleLine} at {company}.

A quick summary so you have it in one place:
• {years} years as {myTitle} at {myCompany}
• I {proof1}
• I {proof2}
• Notice period: {notice}

I'm free {slots} for a call. My resume is attached. Could you share the JD, the team and the level this is for?

Best,
{me}
{phone} · {linkedin}`,
    },
    call: {
      body: `THEY CALLED YOU: STAY SHORT, ASK GOOD QUESTIONS

CONFIRM
"Thanks for calling. Could you tell me a bit about the role and the team?"

YOUR 20-SECOND PITCH
"I'm {myTitle} at {myCompany}, {years} years, {short}. Most relevant: I {proof1}."

ASK THEM
• Which team and level is this for?
• What does the interview process look like, and how many rounds?
• What's the budget band for this level?

THEY WILL ASK
• Notice period: {notice}
• Current / expected CTC: try to get their band first

CLOSE
"Could you email me the JD? I'll reply with my resume today."`,
    },
  },
};

/* -------------------------------------------------------------------------- */
/* Classic templates from Outreach Templates, mapped onto this grid            */
/* -------------------------------------------------------------------------- */

const classicById = Object.fromEntries(CLASSIC.map((t) => [t.id, t]));

// Their placeholders are named differently; map them onto this builder's.
const CLASSIC_RENAMES = {
  recruiter: 'to',
  you: 'me',
  team: 'roleLine',
  proof: 'proof1',
  headline: 'headline',
  contact: 'contactLine',
};
const renameClassic = (text) =>
  text.replace(/\{(\w+)\}/g, (m, key) => (CLASSIC_RENAMES[key] ? `{${CLASSIC_RENAMES[key]}}` : m));

const asClassic = (id) => {
  const t = classicById[id];
  return t && { subject: t.subject && renameClassic(t.subject), body: renameClassic(t.body) };
};

const CLASSIC_MAP = {
  opening: { email: asClassic('email'), note: asClassic('linkedin'), chat: asClassic('linkedin') },
  followup: { email: asClassic('followup'), chat: asClassic('followup') },
  thanks: { email: asClassic('thanks'), chat: asClassic('thanks') },
};

// The kit's originals, word for word, with their slots renamed to this
// builder's fields. Empty slots show the kit's own bracket text.
const KIT_RENAMES = {
  you: 'me',
  recruiter: 'to',
  team: 'roleLine',
  contact: 'contactLine',
  headline: 'kitHeadline',
  proofSentence: 'kitProof',
};
const kitText = (text) =>
  text.replace(/\{(\w+)\}/g, (m, key) => (KIT_RENAMES[key] ? `{${KIT_RENAMES[key]}}` : m));
const asKit = (t) => ({
  subject: t.subject && kitText(t.subject),
  body: kitText(t.body),
  hints: Object.fromEntries(Object.entries(t.hints).map(([k, v]) => [KIT_RENAMES[k] || k, v])),
});
// The cold email keeps its own headline wording; the note asks for role, years, stack.
const kitEmail = { ...asKit(KIT_COLD_EMAIL), body: asKit(KIT_COLD_EMAIL).body.replace('{kitHeadline}', '{headline}') };
kitEmail.hints.headline = KIT_COLD_EMAIL.hints.headline;
const kitNote = asKit(KIT_LINKEDIN);
const kitFollow = asKit(KIT_FOLLOWUP);

const KIT = {
  opening: { email: kitEmail, note: kitNote, chat: kitNote },
  followup: { email: kitFollow, chat: kitFollow },
};

/** The templates you can choose between for this purpose and format. */
export const choicesFor = (type, format) => {
  const out = [];
  if (PRO[type]?.[format]) out.push({ id: 'pro', label: 'Pro', template: PRO[type][format] });
  if (CLASSIC_MAP[type]?.[format]) out.push({ id: 'classic', label: 'Classic', template: CLASSIC_MAP[type][format] });
  if (KIT[type]?.[format]) out.push({ id: 'kit', label: 'Kit (original)', template: KIT[type][format] });
  return out;
};

/* -------------------------------------------------------------------------- */
/* Filling                                                                     */
/* -------------------------------------------------------------------------- */

const has = (v) => Boolean(v && String(v).trim());

/** Values the templates use that are built from other values. */
export const derive = (v) => ({
  ...v,
  roleLine: has(v.role) ? (has(v.team) ? `${v.role.trim()} (${v.team.trim()})` : v.role.trim()) : '',
  mutualLine: has(v.mutual) ? v.mutual.trim() : 'we haven’t met yet',
  mutualSentence: has(v.mutual) ? `We ${v.mutual.trim().replace(/^we\s+/i, '')}, so I hope you don't mind me reaching out. ` : '',
  sourceLine: has(v.source) ? v.source.trim() : 'your profile',
  updateSentence: has(v.update) ? ` Since then, ${v.update.trim().replace(/\.$/, '')}.` : '',
  updateOrProof: has(v.update) ? `Since we spoke, ${v.update.trim()}.` : `Quick reminder of fit: I ${v.proof1 || '[a result with a number]'}.`,
  contactLine: [v.phone, v.linkedin].filter(has).join(' · '),
  // For the kit email: its team/org and role-ask slots both come from the role.
  teamOrg: has(v.team) ? v.team.trim() : '',
  teamName: has(v.team) ? v.team.trim() : '',
  // The kit note's "[role] with [X] years in [stack]", from your title, years and stack.
  kitHeadline:
    has(v.myTitle) && has(v.years) && has(v.stack)
      ? `${v.myTitle.trim().toLowerCase()} with ${v.years.trim()} years in ${v.stack.trim()}`
      : '',
  roleAsk: has(v.role) ? (has(v.team) ? `${v.role.trim()} openings on your ${v.team.trim()} team` : `${v.role.trim()} openings`) : '',
  kitProof: has(v.proof1) ? `I ${String(v.proof1).trim().replace(/\.$/, '')}.` : '',
});

/** Fill {placeholders}; empty ones become their [hint] (or vanish, if they have none). */
export const fill = (text, values, hints = {}) =>
  text.replace(/\{(\w+)\}/g, (_, key) => {
    const value = values[key];
    if (!has(value) && hints[key] !== undefined) return hints[key];
    // Whole optional sentences carry their own spacing; everything else is trimmed.
    if (has(value)) return key.endsWith('Sentence') ? String(value) : String(value).trim();
    const hint = FIELD_META[key]?.hint;
    return hint === undefined ? `[${key}]` : hint;
  });
