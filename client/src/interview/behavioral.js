/**
 * Behavioral Prep content: themes, a question bank and Amazon's Leadership
 * Principles (names only, with a one-line summary written here).
 *
 * Written for this app. Questions are phrased the way they are commonly asked;
 * `themes` decide which of your stories are suggested for each, and `styles`
 * say where they come up most (Amazon LP rounds, Google "Googleyness and
 * leadership", Meta behavioural, or anywhere).
 */

export const THEMES = [
  { id: 'ownership', label: 'Ownership', hint: 'You took something end to end, beyond your brief.' },
  { id: 'conflict', label: 'Conflict', hint: 'You disagreed with someone and handled it well.' },
  { id: 'failure', label: 'Failure', hint: 'Something went wrong, partly because of you, and you learned.' },
  { id: 'ambiguity', label: 'Ambiguity', hint: 'Unclear requirements or no clear owner, and you made progress.' },
  { id: 'impact', label: 'Impact', hint: 'A measurable result you drove.' },
  { id: 'leadership', label: 'Leadership', hint: 'You influenced or guided others without being told to.' },
  { id: 'customer', label: 'Customer', hint: 'You put the user first, even at a cost.' },
  { id: 'deadline', label: 'Deadline', hint: 'Time pressure, trade-offs and what you cut.' },
  { id: 'learning', label: 'Learning', hint: 'You picked up something new fast.' },
  { id: 'innovation', label: 'Innovation', hint: 'A simpler or new way of doing something.' },
];

export const STYLES = [
  { id: 'amazon', label: 'Amazon LP' },
  { id: 'google', label: 'Google' },
  { id: 'meta', label: 'Meta' },
  { id: 'general', label: 'Any company' },
];

/** Amazon Leadership Principles: official names, summaries written here. */
export const LPS = [
  { id: 'customer-obsession', label: 'Customer Obsession', hint: 'Start from the customer and work backwards.' },
  { id: 'ownership', label: 'Ownership', hint: 'Act for the long term; never say "not my job".' },
  { id: 'invent-simplify', label: 'Invent and Simplify', hint: 'Find simpler, new ways of doing things.' },
  { id: 'are-right-a-lot', label: 'Are Right, A Lot', hint: 'Good judgement; seek views that challenge yours.' },
  { id: 'learn-be-curious', label: 'Learn and Be Curious', hint: 'Keep learning and improving.' },
  { id: 'hire-develop', label: 'Hire and Develop the Best', hint: 'Raise the bar and grow others.' },
  { id: 'highest-standards', label: 'Insist on the Highest Standards', hint: 'High bars; fix problems so they stay fixed.' },
  { id: 'think-big', label: 'Think Big', hint: 'Bold direction that inspires results.' },
  { id: 'bias-for-action', label: 'Bias for Action', hint: 'Speed matters; take calculated risks.' },
  { id: 'frugality', label: 'Frugality', hint: 'Do more with less.' },
  { id: 'earn-trust', label: 'Earn Trust', hint: 'Listen, be candid, admit mistakes.' },
  { id: 'dive-deep', label: 'Dive Deep', hint: 'Stay close to the details; audit often.' },
  { id: 'backbone', label: 'Have Backbone; Disagree and Commit', hint: 'Challenge respectfully, then commit fully.' },
  { id: 'deliver-results', label: 'Deliver Results', hint: 'Focus on key inputs and deliver on time.' },
  { id: 'best-employer', label: "Strive to be Earth's Best Employer", hint: 'Make the team a better place to work.' },
  { id: 'success-scale', label: 'Success and Scale Bring Broad Responsibility', hint: 'Consider the wider effects of your work.' },
];

/**
 * `guide` says what a strong answer does: `look` is what the interviewer is
 * really testing, `angle` how to frame your story for this question, `avoid`
 * the common way answers go wrong.
 */
const q = (id, text, themes, styles, lps = [], guide = {}) => ({ id, text, themes, styles, lps, guide });

export const QUESTIONS = [
  // Ownership
  q('own-beyond', 'Tell me about a time you took ownership of something that was not your responsibility.', ['ownership'], ['amazon', 'general'], ['ownership'], { look: 'Whether you act like an owner when nobody assigned it to you.', angle: 'Open with the gap you noticed and why it mattered to users or the business, then why you, not someone else, picked it up.', avoid: 'Making it sound like you were told to do it, or overstepping without telling your manager.' }),
  q('own-longterm', 'Describe a decision where you chose the long-term fix over a quick one.', ['ownership', 'impact'], ['amazon', 'google'], ['ownership', 'highest-standards'], { look: 'Judgement: can you weigh speed against doing it right.', angle: 'Name both options and the cost of each, then why the long-term fix was worth it here.', avoid: 'Pretending there was no trade-off, or skipping the short-term mitigation you shipped first.' }),
  q('own-end-to-end', 'Walk me through a project you owned end to end. What would you change now?', ['ownership', 'impact'], ['google', 'meta', 'general'], ['ownership', 'deliver-results'], { look: 'Scope and depth: design, build, ship, measure, operate.', angle: 'Walk the lifecycle briefly and spend most of the time on the hardest decision.', avoid: 'A feature list with no decisions in it; forgetting the \'what would you change\'.' }),
  q('own-gap', 'Tell me about a problem you noticed that nobody else was fixing.', ['ownership', 'customer'], ['amazon', 'meta'], ['ownership', 'customer-obsession'], { look: 'Initiative and customer awareness.', angle: 'Start from the symptom users felt, then how you found the cause and got it fixed.', avoid: 'Blaming the team that should have fixed it.' }),
  // Conflict
  q('conf-manager', 'Tell me about a time you disagreed with your manager.', ['conflict'], ['amazon', 'google', 'meta', 'general'], ['backbone'], { look: 'Respectful backbone: data over opinion, and how you handled the outcome.', angle: 'Say what you disagreed about, the evidence you brought, and how it ended, even if you lost.', avoid: 'A story where your manager was simply wrong and you were the hero.' }),
  q('conf-peer', 'Describe a conflict with a teammate. How did you resolve it?', ['conflict', 'leadership'], ['google', 'meta', 'general'], ['earn-trust'], { look: 'Collaboration under tension.', angle: 'Show you understood their side first, then how you found common ground.', avoid: 'Describing the other person as difficult without owning your part.' }),
  q('conf-commit', 'Tell me about a time you disagreed with a decision but committed to it anyway.', ['conflict'], ['amazon'], ['backbone'], { look: 'Disagree, then commit fully.', angle: 'State your view and evidence, the decision that went the other way, and how you made it succeed.', avoid: 'Committing half-heartedly, or \'I told you so\' at the end.' }),
  q('conf-difficult', 'Tell me about working with someone who was difficult to work with.', ['conflict'], ['meta', 'general'], ['earn-trust'], { look: 'Empathy and professionalism.', angle: 'Focus on the behaviour and the work, what you changed in how you worked with them, and the result.', avoid: 'Gossip or character judgements.' }),
  q('conf-feedback', 'Tell me about a time you received critical feedback. What did you do with it?', ['conflict', 'learning'], ['amazon', 'google', 'general'], ['earn-trust', 'learn-be-curious'], { look: 'Self-awareness and growth.', angle: 'Give the actual feedback, how it felt, what you changed, and evidence it stuck.', avoid: 'Picking feedback that is secretly a compliment.' }),
  // Failure
  q('fail-mistake', 'Tell me about a mistake you made. What happened next?', ['failure'], ['amazon', 'google', 'meta', 'general'], ['earn-trust'], { look: 'Honesty and learning, not perfection.', angle: 'Own it plainly in one sentence, then the fix, then the change you made so it cannot recur.', avoid: 'A fake failure, or blaming others.' }),
  q('fail-missed', 'Describe a time you missed a deadline or a goal.', ['failure', 'deadline'], ['amazon', 'general'], ['deliver-results'], { look: 'How you manage risk and communicate early.', angle: 'When you saw the slip, who you told and when, and what you cut or changed.', avoid: 'Discovering the miss on the deadline day.' }),
  q('fail-incident', 'Tell me about a production incident you caused or handled.', ['failure', 'ownership'], ['amazon', 'meta', 'general'], ['dive-deep', 'ownership'], { look: 'Calm under pressure and depth of root cause.', angle: 'Timeline: detect, mitigate, root cause, prevent. Numbers on impact and time to recover.', avoid: 'Stopping at the hotfix without the prevention step.' }),
  q('fail-wrong', 'Tell me about a time you were wrong about something technical.', ['failure', 'learning'], ['google', 'amazon'], ['are-right-a-lot'], { look: 'Intellectual honesty.', angle: 'What you believed, what evidence changed your mind, and how you changed course.', avoid: 'Being wrong about something trivial.' }),
  // Ambiguity
  q('amb-unclear', 'Tell me about a time requirements were unclear. How did you move forward?', ['ambiguity'], ['google', 'meta', 'general'], ['bias-for-action'], { look: 'Making progress without perfect information.', angle: 'How you narrowed it: who you asked, what assumptions you wrote down, the small step you shipped first.', avoid: 'Waiting for someone to clarify everything.' }),
  q('amb-no-data', 'Describe a decision you made without all the data you wanted.', ['ambiguity'], ['amazon', 'google'], ['bias-for-action', 'are-right-a-lot'], { look: 'Calculated risk and judgement.', angle: 'What you knew, what you did not, why waiting was costlier, and how you limited the downside.', avoid: 'A reckless decision that happened to work.' }),
  q('amb-change', 'Tell me about a time priorities changed suddenly in the middle of a project.', ['ambiguity', 'deadline'], ['meta', 'general'], ['deliver-results'], { look: 'Adaptability.', angle: 'What changed, how you re-planned, what you communicated, what you saved from the old plan.', avoid: 'Complaining about the change.' }),
  // Impact
  q('imp-proud', 'What is the project you are most proud of, and why?', ['impact', 'ownership'], ['google', 'meta', 'general'], ['deliver-results'], { look: 'What you value and the size of what you can do.', angle: 'Pick the project with the biggest measurable result where your role was clear.', avoid: 'A team achievement where your part is vague.' }),
  q('imp-metric', 'Tell me about a time you improved a key metric.', ['impact'], ['amazon', 'meta'], ['deliver-results', 'dive-deep'], { look: 'Data-driven delivery.', angle: 'Baseline, target, what you changed, the after-number, and how you measured it.', avoid: 'No before-number.' }),
  q('imp-scale', 'Describe the hardest technical problem you have solved.', ['impact', 'innovation'], ['google', 'meta', 'general'], ['dive-deep'], { look: 'Technical depth.', angle: 'Why it was hard, the options, the one you chose and why, and proof it worked.', avoid: 'Staying high-level; they will dig into details.' }),
  q('imp-big', 'Tell me about a time you proposed something bigger than what was asked.', ['impact', 'innovation'], ['amazon'], ['think-big'], { look: 'Ambition with judgement.', angle: 'The small ask, the bigger opportunity you saw, how you made the case, and the outcome.', avoid: 'Scope creep that nobody wanted.' }),
  // Leadership
  q('lead-influence', 'Tell me about a time you influenced a decision without authority.', ['leadership', 'conflict'], ['amazon', 'google', 'meta'], ['earn-trust', 'backbone'], { look: 'Influence through data and relationships.', angle: 'Who you needed to convince, what they cared about, the evidence you brought.', avoid: 'Using authority you did not have.' }),
  q('lead-mentor', 'Tell me about a time you helped a teammate grow.', ['leadership'], ['amazon', 'google', 'general'], ['hire-develop'], { look: 'Raising others.', angle: 'A specific person, what they struggled with, what you did over time, how they grew.', avoid: 'One code review presented as mentoring.' }),
  q('lead-team', 'Describe a time you led a team or a project through a hard stretch.', ['leadership', 'deadline'], ['meta', 'general'], ['deliver-results'], { look: 'Ownership of a group outcome.', angle: 'The hard stretch, how you kept people aligned and unblocked, and the result.', avoid: 'Only talking about your own tasks.' }),
  q('lead-standard', 'Tell me about a time you raised the quality bar for your team.', ['leadership', 'impact'], ['amazon'], ['highest-standards'], { look: 'High bars that stick.', angle: 'The quality problem, the standard or tool you introduced, and how it changed outcomes.', avoid: 'A rule nobody followed.' }),
  // Customer
  q('cust-first', 'Tell me about a time you went above and beyond for a user or customer.', ['customer'], ['amazon', 'general'], ['customer-obsession'], { look: 'Customer obsession.', angle: 'The user\'s problem in their words, what you did beyond the ask, and the effect on them.', avoid: 'A story with no real user in it.' }),
  q('cust-tradeoff', 'Describe a time you balanced what the customer wanted with what the business needed.', ['customer', 'ambiguity'], ['amazon', 'meta'], ['customer-obsession', 'are-right-a-lot'], { look: 'Balancing interests.', angle: 'Both sides\' needs, the options, how you chose, and how you explained it.', avoid: 'Pretending the customer always wins.' }),
  q('cust-feedback', 'Tell me about a time user feedback changed what you built.', ['customer', 'learning'], ['meta', 'google'], ['customer-obsession'], { look: 'Listening and iterating.', angle: 'The feedback, what you changed, and the measurable difference.', avoid: 'Feedback you ignored.' }),
  // Deadline
  q('dead-tight', 'Tell me about a time you delivered under a very tight deadline.', ['deadline', 'impact'], ['amazon', 'meta', 'general'], ['deliver-results', 'bias-for-action'], { look: 'Delivery under pressure.', angle: 'The deadline, how you planned, what you cut, how you protected quality.', avoid: 'Heroic all-nighters as the whole plan.' }),
  q('dead-cut', 'Describe a time you had to cut scope. How did you decide what to drop?', ['deadline', 'ambiguity'], ['google', 'meta'], ['deliver-results', 'frugality'], { look: 'Prioritisation.', angle: 'The full scope, how you ranked it (user impact, risk), what you cut and who agreed.', avoid: 'Cutting quality or tests silently.' }),
  q('dead-multi', 'How do you prioritise when everything is urgent? Give an example.', ['deadline'], ['general', 'meta'], ['deliver-results'], { look: 'Prioritisation framework.', angle: 'Your method (impact, urgency, dependencies) shown through one real week.', avoid: 'A generic answer with no example.' }),
  q('dead-frugal', 'Tell me about a time you achieved something with limited resources.', ['deadline', 'innovation'], ['amazon'], ['frugality'], { look: 'Resourcefulness.', angle: 'The constraint, the clever or simple approach, and what it saved.', avoid: 'Frugality that hurt quality.' }),
  // Learning
  q('learn-fast', 'Tell me about a time you had to learn something new quickly.', ['learning'], ['amazon', 'google', 'general'], ['learn-be-curious'], { look: 'Learning speed.', angle: 'What you had to learn, how you learned it (sources, experiments), and what you shipped with it.', avoid: 'Listing courses with no result.' }),
  q('learn-outside', 'What have you learned recently outside of work, and why?', ['learning'], ['google', 'general'], ['learn-be-curious'], { look: 'Curiosity.', angle: 'Something real, why it interests you, and one way it shows up in your work.', avoid: 'Naming something you cannot discuss in depth.' }),
  q('learn-deep', 'Tell me about a time you dug into the details to find the real cause of a problem.', ['learning', 'failure'], ['amazon'], ['dive-deep'], { look: 'Dive deep.', angle: 'The misleading symptom, the steps that led to the real cause, the fix.', avoid: 'Stopping at the first plausible cause.' }),
  // Innovation
  q('inno-simplify', 'Tell me about a time you simplified a complex process or system.', ['innovation'], ['amazon', 'google'], ['invent-simplify'], { look: 'Invent and simplify.', angle: 'The complexity and its cost, your simpler design, the measurable win.', avoid: 'Adding complexity and calling it innovation.' }),
  q('inno-risk', 'Describe a calculated risk you took. How did it turn out?', ['innovation', 'ambiguity'], ['amazon', 'meta'], ['bias-for-action'], { look: 'Calculated risk.', angle: 'The upside, the downside, how you limited it, what happened.', avoid: 'A gamble with no safety net.' }),
  q('inno-new', 'Tell me about an idea of yours that the team adopted.', ['innovation', 'leadership'], ['google', 'meta', 'general'], ['invent-simplify', 'think-big'], { look: 'Influence through ideas.', angle: 'The idea, how you prototyped or proved it, how the team adopted it.', avoid: 'An idea that was never used.' }),
  // Openers and closers
  q('open-intro', 'Tell me about yourself.', ['impact'], ['general', 'google', 'meta', 'amazon'], [], { look: 'Your story in 90 seconds.', angle: 'Present, past, future: what you do now with one result, how you got here, why this role next.', avoid: 'Reading your resume line by line.' }),
  q('open-why', 'Why this company, and why this role?', ['customer'], ['general', 'google', 'meta', 'amazon'], [], { look: 'Genuine, specific motivation.', angle: 'One thing about the product or engineering culture, one about the role, tied to your experience.', avoid: 'Salary, brand or generic praise.' }),
  q('open-leave', 'Why are you looking to leave your current role?', ['learning'], ['general'], [], { look: 'Positive framing.', angle: 'What you are moving towards (scale, scope, learning), not away from.', avoid: 'Criticising your current employer.' }),
];

export const RATINGS = [
  { id: 'nailed', label: 'Nailed it' },
  { id: 'ok', label: 'Okay' },
  { id: 'rough', label: 'Rough' },
];

/** The STAR shape, with what each part should cover. */
export const STAR = [
  { key: 'situation', label: 'Situation', hint: 'Context in 2 sentences: where, what system, why it mattered.' },
  { key: 'task', label: 'Task', hint: 'Your specific responsibility or goal.' },
  { key: 'action', label: 'Action', hint: 'What YOU did, step by step: the bulk of the answer. Say "I", not "we".' },
  { key: 'result', label: 'Result', hint: 'Outcome with numbers, and what changed afterwards.' },
  { key: 'learning', label: 'Learning', hint: 'What you took from it or would do differently.' },
];

/** Target speaking time for one answer, in seconds. */
export const TARGET_SECONDS = 150;

/* -------------------------------------------------------------------------- */
/* Sample answers                                                              */
/* -------------------------------------------------------------------------- */

/*
  A sample answer is your own story, re-shaped for the question: an opening
  that answers the question in one line, the STAR parts as you would say them,
  and a closing that ties back to what the question is testing. Nothing is
  invented; empty parts of the story show as [brackets] to fill.
*/
const OPENERS = {
  ownership: (t) => `The best example is my work on ${t}. Nobody would have blamed me for leaving parts of it, but I treated the whole outcome as mine.`,
  conflict: (t) => `A good example is from ${t}, where we didn't agree at first on how to do it.`,
  failure: (t) => `One I learned a lot from is ${t}. Part of what went wrong was on me, so I'll be direct about that.`,
  ambiguity: (t) => `A good example is ${t}: the requirements were not clear when I started, so I had to shape the problem first.`,
  impact: (t) => `The one I'm proudest of is ${t}, because the result was measurable.`,
  leadership: (t) => `A good example is ${t}, where I had to get others aligned without any formal authority.`,
  customer: (t) => `I'd pick ${t}, because it started from a problem users actually felt.`,
  deadline: (t) => `A good example is ${t}, which had a fixed date and more scope than time.`,
  learning: (t) => `A good example is ${t}, where I had to get good at something new quickly.`,
  innovation: (t) => `I'd pick ${t}, where the simple approach turned out to be the better one.`,
};

const CLOSERS = {
  failure: (l) => `What I changed afterwards: ${l}`,
  conflict: (l) => `Looking back, ${l}`,
  learning: (l) => `What stuck with me: ${l}`,
};

const fillPart = (text, hint) => (text && text.trim() ? text.trim() : `[${hint}]`);
const lower = (title) => title.charAt(0).toLowerCase() + title.slice(1);

/** Your story as a spoken answer to this question. */
export function sampleFromStory(question, story) {
  const theme = question.themes.find((t) => story.themes.includes(t)) || question.themes[0];
  // A question-specific opener when there is one; it claims nothing new.
  const custom = COACH[question.id]?.open;
  const open = custom
    ? custom.replace('{story}', lower(story.title))
    : (OPENERS[theme] || OPENERS.impact)(lower(story.title));
  const close = (CLOSERS[theme] || ((l) => `The main thing I took away: ${l}`))(
    fillPart(story.learning, 'what you learned or would do differently'),
  );
  return [
    open,
    `${fillPart(story.situation, 'situation: where, which system, why it mattered')} ${fillPart(story.task, 'your specific responsibility')}`,
    fillPart(story.action, 'what you did, step by step, in "I"'),
    fillPart(story.result, 'the result, with numbers'),
    close,
  ].join('\n\n');
}

/** The three openers are answered from your profile, not from a story. */
export function sampleFromProfile(question, { name, profile }) {
  const p = profile || {};
  const pitch = (p.pitches || [])[0] || {};
  const proof = (pitch.proofs || [])[0];
  const role = p.targetRole || '[the role you want]';
  const company = p.currentCompany || '[current company]';
  if (question.id === 'open-intro') {
    return [
      `I'm ${name || '[your name]'}, a ${pitch.headline || '[one line about you: role, years, what you build]'}.`,
      `Right now at ${company}, I ${proof || '[your strongest result, with a number]'}.`,
      `[How you got here, in two sentences: degree, first role, the move that shaped you.]`,
      `Now I'm looking for ${role} roles where I can [what you want next: more scale, harder problems, a specific domain], which is why this role stood out.`,
    ].join('\n\n');
  }
  if (question.id === 'open-why') {
    return [
      `Two reasons. First, the product: [one specific thing about what they build or how, that you genuinely care about].`,
      `Second, the role: it centres on [what the role does], which is the work I've been doing. For example, I ${proof || '[relevant result]'}.`,
      `So it's a place where what I've already done is useful on day one, and where I'd grow into [what you want to learn].`,
    ].join('\n\n');
  }
  return [
    `I've learned a lot at ${company}, and I'm proud of what I built there, for example I ${proof || '[relevant result]'}.`,
    `What I'm looking for now is [more scale / harder systems / a bigger engineering org], and that's hard to get where I am today.`,
    `This role offers exactly that, which is why I'm making the move now.`,
  ].join('\n\n');
}

/* -------------------------------------------------------------------------- */
/* Per-question coaching                                                       */
/* -------------------------------------------------------------------------- */

/*
  `open` is the first line of the sample answer: it answers the question in
  one sentence, with {story} for your story's title, and claims nothing your
  story does not already say. `fit` is what the story must actually contain to
  answer this question; the page shows it beside the sample so a story that
  only shares a theme is easy to spot.
*/
export const COACH = {
  'own-beyond': { open: 'A clear example is {story}: part of it was outside what I was asked to do, and I took it on.', fit: 'A part of the work nobody assigned to you, and why you picked it up.' },
  'own-longterm': { open: 'The decision I would point to is in {story}, where I chose the lasting fix over the quick one.', fit: 'Two options (quick vs lasting), what each would cost, and why you chose the lasting one.' },
  'own-end-to-end': { open: 'I owned {story} from design to production, so I can walk you through all of it.', fit: 'Design, build, launch and running it, plus one thing you would change now.' },
  'own-gap': { open: 'In {story}, I noticed a problem that was not on anyone’s list and fixed it.', fit: 'A problem you spotted yourself, how users felt it, and how you got it fixed.' },
  'conf-manager': { open: 'A time I disagreed with my manager was during {story}.', fit: 'A real disagreement with your manager: your view, your evidence, and how it ended.' },
  'conf-peer': { open: 'During {story}, a colleague and I disagreed on the approach.', fit: 'A disagreement with a peer, their side as well as yours, and how you resolved it.' },
  'conf-commit': { open: 'In {story}, the decision went against my view, and I committed to making it work.', fit: 'A decision you argued against, then fully supported.' },
  'conf-difficult': { open: 'The hardest working relationship I have handled was during {story}.', fit: 'A difficult working relationship, what you changed in how you worked, and the result.' },
  'conf-feedback': { open: 'The most useful critical feedback I have had came during {story}.', fit: 'The actual feedback, what you changed because of it, and proof the change stuck.' },
  'fail-mistake': { open: 'A mistake I made was in {story}, and I will be direct about my part in it.', fit: 'Something that went wrong partly because of you, the fix, and what you changed so it cannot recur.' },
  'fail-missed': { open: 'A goal I missed was in {story}.', fit: 'A deadline or goal you actually missed, when you raised it, and what you did next.' },
  'fail-incident': { open: 'The production issue I would talk about is from {story}.', fit: 'Detection, mitigation, root cause and prevention, with impact numbers.' },
  'fail-wrong': { open: 'I was wrong about something technical during {story}.', fit: 'What you believed, the evidence that changed your mind, and what you did next.' },
  'amb-unclear': { open: 'In {story}, the requirements were unclear when I started, so I had to shape the problem first.', fit: 'What was unclear, who you asked, the assumptions you wrote down, the first small step.' },
  'amb-no-data': { open: 'In {story}, I had to decide before I had all the data I wanted.', fit: 'What you knew and did not know, why waiting cost more, and how you limited the risk.' },
  'amb-change': { open: 'Priorities changed in the middle of {story}.', fit: 'What changed, how you re-planned, and what you saved from the old plan.' },
  'imp-proud': { open: 'The project I am proudest of is {story}.', fit: 'Your clearest measurable result where your own role is obvious.' },
  'imp-metric': { open: 'In {story}, I moved a number that mattered.', fit: 'The metric, its value before, what you changed, and its value after.' },
  'imp-scale': { open: 'The hardest technical problem I have solved is {story}.', fit: 'Why it was hard, the options, the one you chose, and proof it worked.' },
  'imp-big': { open: 'In {story}, I proposed something bigger than what was asked.', fit: 'The original ask, the bigger opportunity you saw, and how you made the case.' },
  'lead-influence': { open: 'In {story}, I had to get people aligned without having authority over them.', fit: 'Who you needed to convince, what they cared about, and what changed their mind.' },
  'lead-mentor': { open: 'In {story}, I helped a teammate grow.', fit: 'A specific person, what they struggled with, what you did over time, and how they grew.' },
  'lead-team': { open: 'I led {story} through a hard stretch.', fit: 'The hard stretch, how you kept people aligned and unblocked, and the outcome.' },
  'lead-standard': { open: 'In {story}, I raised the quality bar for the team.', fit: 'The quality problem, the standard or tool you introduced, and how outcomes changed.' },
  'cust-first': { open: 'In {story}, I went beyond the ask for the people using it.', fit: 'A real user problem, what you did beyond the brief, and the effect on users.' },
  'cust-tradeoff': { open: 'In {story}, I had to balance what users wanted with what the business needed.', fit: 'Both sides’ needs, the options, how you chose, and how you explained it.' },
  'cust-feedback': { open: 'User feedback changed what I built in {story}.', fit: 'The feedback, what you changed, and the measurable difference.' },
  'dead-tight': { open: 'The tightest deadline I have worked to was {story}.', fit: 'The deadline, how you planned, what you cut, and how you protected quality.' },
  'dead-cut': { open: 'In {story}, I had to cut scope to hit the date.', fit: 'The full scope, how you ranked it, what you cut, and who agreed.' },
  'dead-multi': { open: 'A week where everything was urgent was during {story}.', fit: 'Your way of prioritising, shown through one real week.' },
  'dead-frugal': { open: 'In {story}, I got the result with very limited resources.', fit: 'The constraint, the simple approach you took, and what it saved.' },
  'learn-fast': { open: 'In {story}, I had to learn something new quickly.', fit: 'What you had to learn, how you learned it, and what you shipped with it.' },
  'learn-outside': { open: 'Outside work, I have been learning through {story}.', fit: 'Something you learned by choice, why, and how it shows up in your work.' },
  'learn-deep': { open: 'In {story}, I dug into the details to find the real cause.', fit: 'The misleading symptom, the steps to the real cause, and the fix.' },
  'inno-simplify': { open: 'In {story}, I replaced something complex with something simpler.', fit: 'The complexity and its cost, your simpler design, and the measurable win.' },
  'inno-risk': { open: 'A calculated risk I took was in {story}.', fit: 'The upside, the downside, how you limited it, and how it turned out.' },
  'inno-new': { open: 'An idea of mine that the team adopted came out of {story}.', fit: 'The idea, how you proved it, and how the team adopted it.' },
};

/**
 * Stories for a question.
 *
 * `linked`: stories you have marked as answering this question. These are the
 * real answers.
 * `closest`: when nothing is linked, stories sharing the question's main theme,
 * as a hint only. Sharing a theme does not mean a story answers the question
 * ("helped a teammate grow" is Leadership, and so is a partner integration),
 * so the page labels these and asks you to confirm.
 */
export function suggestStories(question, stories) {
  const linked = stories.filter((s) => (s.questions || []).includes(question.id));
  if (linked.length) return { linked, closest: [] };
  const main = question.themes[0];
  const closest = stories
    .filter((s) => s.themes.includes(main))
    .map((s) => ({
      s,
      score:
        s.themes.filter((t) => t !== main && question.themes.includes(t)).length +
        s.lps.filter((l) => question.lps.includes(l)).length,
    }))
    .sort((a, b) => b.score - a.score || (a.s.practised || 0) - (b.s.practised || 0))
    .map((x) => x.s);
  return { linked: [], closest };
}
