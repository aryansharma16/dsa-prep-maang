/**
 * Offer negotiation scripts for Interview Helper → Offer Negotiation.
 *
 * Written for this app, for tech offers in India (CTC, joining bonus, notice
 * buyout, RSUs). Each scenario is one moment in a negotiation; the page fills
 * the {placeholders} from the form and leaves empty ones as [hints].
 */

export const FIELDS = {
  recruiter: { label: 'Recruiter first name', placeholder: 'Priya', hint: '[Recruiter]' },
  company: { label: 'Company', placeholder: 'Google', hint: '[Company]' },
  role: { label: 'Role / level', placeholder: 'SDE II', hint: '[Role]' },
  me: { label: 'Your name', hint: '[Your name]' },
  offer: { label: 'Their offer (total)', placeholder: '₹38L CTC', hint: '[their offer]' },
  ask: { label: 'What you are asking for', placeholder: '₹45L CTC', hint: '[your number]' },
  deadline: { label: 'Their deadline', placeholder: 'Friday', hint: '[deadline]' },
  newDate: { label: 'Date you need', placeholder: 'next Wednesday', hint: '[date]' },
  other: { label: 'Other company', placeholder: 'Microsoft', hint: '[other company]' },
  otherOffer: { label: 'Their offer', placeholder: '₹44L CTC (₹32L base)', hint: '[exact numbers]' },
  market: { label: 'Market data source', placeholder: 'levels.fyi for SDE II, Bengaluru', hint: '[source]' },
  reason: { label: 'Your strongest reason', placeholder: 'the role owns payments, which I have run in production', hint: '[one concrete reason]' },
  notice: { label: 'Notice period', placeholder: '90 days', hint: '[notice period]' },
  final: { label: 'Agreed numbers', placeholder: '₹42L fixed, ₹5L joining bonus, RSUs as offered', hint: '[agreed numbers]' },
  joinDate: { label: 'Joining date', placeholder: '6 January', hint: '[joining date]' },
};

export const SCENARIOS = [
  {
    id: 'time',
    label: 'Ask for more time',
    when: 'The moment an offer arrives with a short deadline. Buying time costs nothing and is almost always granted.',
    fields: ['recruiter', 'company', 'role', 'deadline', 'newDate', 'me'],
    subject: 'Offer for {role}: timeline',
    body: `Hi {recruiter},

Thank you for the offer for {role}. I'm genuinely excited about {company}, and I want to give it the attention it deserves.

I'm wrapping up a couple of processes I committed to before this one, and I'd like to make one clear decision rather than a rushed one. Would it be possible to move the deadline from {deadline} to {newDate}?

I'll keep you posted before then if anything changes.

Thanks,
{me}`,
  },
  {
    id: 'competing',
    label: 'I have a competing offer',
    when: 'Your strongest position. Only use it if the other offer is real and you quote it exactly; companies may ask to see it.',
    fields: ['recruiter', 'company', 'role', 'offer', 'other', 'otherOffer', 'ask', 'me'],
    subject: 'Offer for {role}: one question before I sign',
    body: `Hi {recruiter},

I want to be upfront with you. I've received an offer from {other} at {otherOffer}, while the {company} offer is {offer}.

{company} is my first choice, and the team and the work are what I want. If you can bring the package to {ask}, I'm ready to accept and stop all other conversations.

I'm flexible on how we get there: base, joining bonus or RSUs. Is that something you could take to the team?

Thanks for championing me through this,
{me}`,
  },
  {
    id: 'market',
    label: 'No competing offer',
    when: 'When you have no other offer but do have a fair reason: market data, the role’s scope, or a strong loop.',
    fields: ['recruiter', 'company', 'role', 'offer', 'market', 'reason', 'ask', 'me'],
    subject: 'Offer for {role}: compensation',
    body: `Hi {recruiter},

Thank you again for the offer. I'm excited about joining {company} as {role}.

Before I sign, I wanted to raise one thing. Based on {market}, {offer} sits at the lower end of the range for this level. Given that {reason}, I was hoping we could get closer to {ask}.

If that's possible, I'm ready to sign this week.

Thanks for looking into it,
{me}`,
  },
  {
    id: 'components',
    label: 'Joining bonus / notice buyout',
    when: 'When base is capped by the band. One-time money is often easier to approve, and a long notice period is a real cost to you.',
    fields: ['recruiter', 'company', 'role', 'offer', 'notice', 'ask', 'me'],
    subject: 'Offer for {role}: joining bonus',
    body: `Hi {recruiter},

Thanks for confirming the band for {role}. I understand the base has limited room.

Two things would close the gap for me:
• a joining bonus, which would also cover what I give up by leaving mid-cycle (variable pay and unvested benefits)
• a buyout of my {notice} notice period, so I can join sooner

Together, something that brings the first-year value to around {ask} would let me sign straight away. Would either work on your side?

Thanks,
{me}`,
  },
  {
    id: 'call',
    label: 'On a call',
    when: 'Talking points for a live negotiation call. Keep it short, warm and specific, and stop talking after the ask.',
    fields: ['recruiter', 'company', 'role', 'offer', 'ask', 'reason'],
    script: true,
    body: `OPEN WARM
"Thanks for making time, {recruiter}. I'm really excited about {company}, and I want to find a way to say yes today."

STATE THE GAP, ONCE
"The offer is {offer}. To accept, I'd need to be at {ask}."

ONE REASON
"Mainly because {reason}."

THEN STOP TALKING
Let them answer first. Silence is not a problem to fix.

IF THEY SAY THE BAND IS FIXED
"I understand. Is there flexibility on the joining bonus, RSUs or a notice buyout instead?"

IF THEY ASK FOR YOUR CURRENT CTC
"I'd rather focus on what this role is worth. What's the range for this level?"

IF THEY NEED TO CHECK
"Of course. When do you think you'll hear back? I'll keep my decision open until then."

CLOSE
"Thank you, {recruiter}. Could you send the revised numbers over email so I can review them properly?"`,
  },
  {
    id: 'confirm',
    label: 'Confirm in writing',
    when: 'After a verbal yes. Nothing is final until the revised offer letter shows it; do not resign before then.',
    fields: ['recruiter', 'company', 'role', 'final', 'joinDate', 'me'],
    subject: 'Confirming the updated offer for {role}',
    body: `Hi {recruiter},

Thank you for working on this, and for the call today. To make sure we're aligned, this is what I understood:

• {final}
• Joining date: {joinDate}

Could you share the revised offer letter with these numbers? I'll sign as soon as it arrives.

Really looking forward to joining {company}.

Best,
{me}`,
  },
  {
    id: 'decline',
    label: 'Decline, keep the door open',
    when: 'When you take another offer. A short, warm no keeps the relationship for the next time.',
    fields: ['recruiter', 'company', 'role', 'me'],
    subject: 'Offer for {role}',
    body: `Hi {recruiter},

Thank you for the offer and for everything you did during the process. After a lot of thought, I've decided to accept another role that fits where I am right now.

It was a hard call. I enjoyed meeting the team, and I'd love to stay in touch and revisit {company} in the future.

Thanks again,
{me}`,
  },
];

export const PRINCIPLES = [
  { title: 'Know your walk-away number', text: 'Decide it before any call. Deciding live, under pressure, usually ends lower.' },
  { title: 'Let them name a range first', text: 'If asked for your expectation or current CTC, ask for the band for the level instead.' },
  { title: 'One ask, whole package', text: 'Raise base, bonus and RSUs together. Coming back three times reads as indecisive.' },
  { title: 'Never invent an offer', text: 'A made-up or inflated number can be checked, and you can lose the offer over it.' },
  { title: 'Grateful, not apologetic', text: 'Sound excited about the role while you ask. Over-explaining weakens the ask.' },
  { title: 'Read the whole CTC', text: 'Separate fixed pay from variable, joining bonus and RSUs, and check the vesting schedule.' },
  { title: 'Get it in writing', text: 'Do not resign until the revised offer letter shows the agreed numbers.' },
];

/** Fill {placeholders}; empty ones become their [hint]. */
export const fill = (text, values) =>
  text.replace(/\{(\w+)\}/g, (_, key) => values[key]?.trim() || FIELDS[key]?.hint || `[${key}]`);
