/**
 * The shipped motivation corpus.
 *
 * Written by hand rather than generated, and deliberately so: a seed file that
 * calls a model produces different content on every run, which is exactly what
 * the idempotent upsert in motivations.js exists to prevent. `npm run ai:draft`
 * is the tool for growing this list; what lands in git is copy someone read.
 *
 * Two rules the whole file follows:
 *
 *   Nothing generic. Every line either names something specific about
 *   engineering and preparation, or it names a number from the reader's own
 *   progress through a {token}. "Work hard, dream big" is wallpaper by the
 *   second week; "Graphs is 3 of 28, and that gap is the whole difference"
 *   is not.
 *
 *   Nothing names the product. `client/src/brand.js` owns the name, and a
 *   string in here saying "MAANG Prep" would outlive the next rename.
 *
 * `key` is the seeder's identity for a row and must never be reused or
 * reordered — rewording a line keeps its key and updates that row, which is
 * why the numbers have gaps where lines were dropped.
 *
 * Tokens available, and which triggers can fill them, are in
 * src/config/motivationTriggers.js. A line asking for one its trigger cannot
 * fill is silently skipped at selection time, so they are not optional
 * decoration — they have to match.
 */

/** Shorthands, so the table below stays readable at a glance. */
const IN_APP = ['roadmap', 'stats', 'profile', 'revision'];
const WORK = ['roadmap', 'revision'];
const CAREER = ['stats', 'profile'];
const LOGIN = ['login'];

export const MOTIVATION_LINES = [
  /* ---------------------------------------------------------------------
     Condition-bound. These are the point of the feature: each one is true
     only in a particular situation, and says the thing that situation calls
     for. Specificity means they outrank everything in the generic pool.
     --------------------------------------------------------------------- */

  // --- a brand new account -------------------------------------------------
  { key: 'start-001', trigger: 'no_solves_ever', surfaces: IN_APP, category: 'grind',
    text: 'All {total} of them are unsolved right now. That is the only day this is true, so start.' },
  { key: 'start-002', trigger: 'no_solves_ever', surfaces: IN_APP, category: 'grind',
    text: 'Nobody starts ready. Open the first problem and be worse at this for an hour.' },
  { key: 'start-003', trigger: 'no_solves_ever', surfaces: IN_APP, category: 'grind',
    text: 'The first one is the hardest and the least important. Get it behind you.' },
  { key: 'start-004', trigger: 'no_solves_ever', surfaces: IN_APP, category: 'career',
    text: 'Four months of real preparation changes your options. It has to start on some ordinary day.' },

  // --- nothing solved today ------------------------------------------------
  { key: 'today-001', trigger: 'nothing_today', surfaces: WORK, category: 'grind',
    text: 'Nothing today yet. One problem is not a session, but it is not zero either.' },
  { key: 'today-002', trigger: 'nothing_today', surfaces: WORK, category: 'grind',
    text: 'Stop planning the week. Solve one, then decide whether you have another in you.' },
  { key: 'today-003', trigger: 'nothing_today', surfaces: IN_APP, category: 'grind',
    text: '{solved} solved so far, none of them today. The number only moves on days you open this.' },
  { key: 'today-004', trigger: 'nothing_today', surfaces: WORK, category: 'grind',
    text: '{remaining} left. None of them get easier while you decide which to start.' },
  { key: 'today-005', trigger: 'nothing_today', surfaces: CAREER, category: 'career',
    text: 'A career is built out of ordinary days executed anyway. Today is one of the ordinary ones.' },
  { key: 'today-006', trigger: 'nothing_today', surfaces: WORK, category: 'grind',
    text: 'You do not need to feel like it. You need to open one problem and read it twice.' },

  // --- first solve of the day ----------------------------------------------
  { key: 'first-001', trigger: 'first_of_day', surfaces: IN_APP, category: 'grind',
    text: 'One down today. The second one is always cheaper than the first — that is the whole trick.' },
  { key: 'first-002', trigger: 'first_of_day', surfaces: WORK, category: 'grind',
    text: 'The day is open now. {remaining} still ahead, and you are no longer deciding whether to start.' },
  { key: 'first-003', trigger: 'first_of_day', surfaces: IN_APP, category: 'grind',
    text: 'That is {solved} total. Momentum is just the second problem, and it is right there.' },

  // --- a good day ----------------------------------------------------------
  { key: 'strong-001', trigger: 'strong_day', threshold: 3, surfaces: IN_APP, category: 'grind',
    text: '{today} today. This is what the good weeks are made of, and they are mostly unremarkable.' },
  { key: 'strong-002', trigger: 'strong_day', threshold: 5, surfaces: IN_APP, category: 'grind',
    text: '{today} in one day. Stop before it stops being learning and starts being typing.' },
  { key: 'strong-003', trigger: 'strong_day', threshold: 5, surfaces: IN_APP, category: 'grind',
    text: '{today} today, {solved} in total. Tomorrow, two done well beats eight done fast.' },
  { key: 'strong-004', trigger: 'strong_day', threshold: 8, surfaces: IN_APP, category: 'grind',
    text: '{today} today. Write down what you learned or most of this evening evaporates by Friday.' },

  // --- solved a Hard today -------------------------------------------------
  { key: 'hard-001', trigger: 'hard_today', surfaces: IN_APP, category: 'grind',
    text: 'That one was supposed to be hard. You finished it anyway, which is the entire point.' },
  { key: 'hard-002', trigger: 'hard_today', surfaces: IN_APP, category: 'grind',
    text: 'A Hard today. Go back and explain the solution out loud — that is where it actually sticks.' },
  { key: 'hard-003', trigger: 'hard_today', surfaces: IN_APP, category: 'grind',
    text: 'Hards are where the ceiling moves. {solved} solved, and today one of them fought back.' },
  { key: 'hard-004', trigger: 'hard_today', surfaces: CAREER, category: 'career',
    text: 'Nobody sees the Hard you finished today. They see the one you solve in the interview.' },

  // --- streaks -------------------------------------------------------------
  { key: 'streak-003', trigger: 'streak_reached', threshold: 3, surfaces: IN_APP, category: 'grind',
    text: '{streak} days. Not impressive yet — but this is the stretch where most people quietly stop.' },
  { key: 'streak-007', trigger: 'streak_reached', threshold: 7, surfaces: IN_APP, category: 'grind',
    text: '{streak} days. The number is not the achievement; becoming someone who does not break it is.' },
  { key: 'streak-014', trigger: 'streak_reached', threshold: 14, surfaces: IN_APP, category: 'grind',
    text: '{streak} days straight. This stopped being motivation a while ago and became a habit.' },
  { key: 'streak-030', trigger: 'streak_reached', threshold: 30, surfaces: IN_APP, category: 'grind',
    text: '{streak} days. Whatever you were waiting to feel before starting, you clearly did not need it.' },
  { key: 'streak-060', trigger: 'streak_reached', threshold: 60, surfaces: IN_APP, category: 'career',
    text: '{streak} days. Consistency at this length is rarer than talent and worth considerably more.' },
  { key: 'streak-100', trigger: 'streak_reached', threshold: 100, surfaces: IN_APP, category: 'career',
    text: '{streak} days. Very few people reach this. Most of them are not the ones who felt ready.' },

  // --- come back -----------------------------------------------------------
  { key: 'lapse-001', trigger: 'lapsed', threshold: 3, surfaces: IN_APP, category: 'grind',
    text: '{days} days since the last one. Do not restart the plan — just solve something today.' },
  { key: 'lapse-002', trigger: 'lapsed', threshold: 7, surfaces: IN_APP, category: 'grind',
    text: '{days} days off. The {solved} you have solved did not expire. Pick an easy one and warm up.' },
  { key: 'lapse-003', trigger: 'lapsed', threshold: 14, surfaces: IN_APP, category: 'grind',
    text: '{days} days is a gap, not a failure. Rebuild with something you already know how to do.' },
  { key: 'lapse-004', trigger: 'lapsed', threshold: 30, surfaces: IN_APP, category: 'career',
    text: '{days} days away. What you learned is still in there; it needs one session to surface.' },

  // --- the weakest pattern -------------------------------------------------
  { key: 'weak-001', trigger: 'weak_pattern', surfaces: IN_APP, category: 'grind',
    text: '{pattern} is where you are thinnest: {patternSolved} of {patternTotal}. Good. Now you know what to attack.' },
  { key: 'weak-002', trigger: 'weak_pattern', surfaces: IN_APP, category: 'grind',
    text: 'You have {patternRemaining} left in {pattern}. Weak spots are only a problem while they stay hidden.' },
  { key: 'weak-003', trigger: 'weak_pattern', surfaces: WORK, category: 'grind',
    text: 'Everyone avoids one topic. Yours is {pattern}, at {patternSolved} of {patternTotal}. Interviewers do not avoid it.' },
  { key: 'weak-004', trigger: 'weak_pattern', surfaces: CAREER, category: 'career',
    text: 'Your average is fine. {pattern} at {patternSolved} of {patternTotal} is what an interview will actually find.' },
  { key: 'weak-005', trigger: 'weak_pattern', surfaces: WORK, category: 'grind',
    text: 'Spend the next session in {pattern}. {patternRemaining} unsolved there is the cheapest progress available.' },

  // --- revision ------------------------------------------------------------
  { key: 'rev-001', trigger: 'revision_due', threshold: 1, surfaces: ['revision'], category: 'grind',
    text: '{due} waiting. Re-solving something you already solved is where it moves into long-term memory.' },
  { key: 'rev-002', trigger: 'revision_due', threshold: 5, surfaces: ['revision'], category: 'grind',
    text: '{due} due. A solved problem you cannot re-derive in six weeks was never really solved.' },
  { key: 'rev-003', trigger: 'revision_due', threshold: 10, surfaces: ['revision'], category: 'grind',
    text: '{due} in the queue. Clear five now; a backlog this size stops feeling clearable at twenty.' },
  { key: 'rev-004', trigger: 'revision_due', threshold: 20, surfaces: ['revision'], category: 'grind',
    text: '{due} overdue for review. New problems are more fun and worth less than these right now.' },
  { key: 'rev-005', trigger: 'revision_due', threshold: 1, surfaces: ['roadmap'], category: 'grind',
    text: '{due} due for revision. Recall is the skill being tested, not first-time discovery.' },

  // --- started but unfinished ---------------------------------------------
  { key: 'stuck-001', trigger: 'attempted_stuck', threshold: 5, surfaces: WORK, category: 'grind',
    text: '{attempted} started and unfinished. Go back to one — the second attempt is where it clicks.' },
  { key: 'stuck-002', trigger: 'attempted_stuck', threshold: 10, surfaces: WORK, category: 'grind',
    text: '{attempted} half-finished. Abandoning hard problems is a habit, and it is one you can still drop.' },
  { key: 'stuck-003', trigger: 'attempted_stuck', threshold: 10, surfaces: CAREER, category: 'grind',
    text: 'Every "I cannot solve this" is a choice: quit, memorise, or understand. You have {attempted} open.' },

  // --- milestones ----------------------------------------------------------
  { key: 'mile-010', trigger: 'milestone_solved', threshold: 10, surfaces: IN_APP, category: 'grind',
    text: '{solved} solved. Small, and still more than almost everyone who bookmarked a roadmap.' },
  { key: 'mile-025', trigger: 'milestone_solved', threshold: 25, surfaces: IN_APP, category: 'grind',
    text: '{solved} down, {remaining} to go. You are past the part where it feels like nothing is happening.' },
  { key: 'mile-050', trigger: 'milestone_solved', threshold: 50, surfaces: IN_APP, category: 'grind',
    text: '{solved} solved. Start counting patterns you can recognise instead — that number matters more.' },
  { key: 'mile-100', trigger: 'milestone_solved', threshold: 100, surfaces: IN_APP, category: 'career',
    text: '{solved} problems. Somewhere in there you stopped memorising solutions and started seeing shapes.' },
  { key: 'mile-200', trigger: 'milestone_solved', threshold: 200, surfaces: IN_APP, category: 'career',
    text: '{solved} solved, {remaining} left. At this point the interview is a formality you still have to attend.' },
  { key: 'mile-300', trigger: 'milestone_solved', threshold: 300, surfaces: IN_APP, category: 'career',
    text: '{solved} solved. You are no longer preparing to start. You are preparing to compete.' },

  // --- percentage of the roadmap ------------------------------------------
  { key: 'pct-025', trigger: 'percent_reached', threshold: 25, surfaces: CAREER, category: 'grind',
    text: '{percent}% of the roadmap. A quarter is where the patterns start repeating and it gets faster.' },
  { key: 'pct-050', trigger: 'percent_reached', threshold: 50, surfaces: CAREER, category: 'grind',
    text: '{percent}% done, {remaining} left. What is left is mostly the topics you have been avoiding.' },
  { key: 'pct-075', trigger: 'percent_reached', threshold: 75, surfaces: CAREER, category: 'career',
    text: '{percent}% done. Whatever is left is not left by accident — go straight at it.' },
  { key: 'pct-090', trigger: 'percent_reached', threshold: 90, surfaces: CAREER, category: 'career',
    text: '{percent}%. Only {remaining} unsolved. Start doing timed mock rounds; the reading part is over.' },

  /* ---------------------------------------------------------------------
     Generic pool. No condition, so these only surface when nothing more
     specific is true — which, most days, is exactly what you want.
     --------------------------------------------------------------------- */

  // --- the work itself: roadmap and revision ------------------------------
  { key: 'grind-001', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Every problem you finish is one less standing between you and the offer.' },
  { key: 'grind-002', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'You do not need motivation to solve one problem. You need to solve today’s problem.' },
  { key: 'grind-003', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'The interview is temporary. The engineering ability you build doing this is not.' },
  { key: 'grind-004', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Do not memorise solutions. Train yourself to find them under time pressure.' },
  { key: 'grind-005', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'The problem that looks impossible today is usually the pattern you spot instantly in March.' },
  { key: 'grind-006', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Stop counting problems. Start counting the patterns you could explain to someone else.' },
  { key: 'grind-007', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'A hard problem is not wasted time if it permanently changes how you look at the next one.' },
  { key: 'grind-008', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'You are not revising for an exam. You are learning to think in a way that holds up live.' },
  { key: 'grind-009', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Every failed submission is information. Read the failing case before you touch the code.' },
  { key: 'grind-010', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'The goal is not to get good at this site. It is to become difficult to replace.' },
  { key: 'grind-011', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Trees, graphs and DP are not the destination. They are the gym.' },
  { key: 'grind-012', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Your interviewer will not ask how motivated you felt. They will ask you to solve something.' },
  { key: 'grind-013', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Consistency beats a heroic three-day sprint followed by a fortnight of nothing.' },
  { key: 'grind-014', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Do not skip the problems you cannot solve. Those are the ones doing the teaching.' },
  { key: 'grind-015', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Your brain gets stronger struggling with things it cannot immediately do. That is the mechanism.' },
  { key: 'grind-016', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'If you cannot explain your solution out loud, you do not understand it yet.' },
  { key: 'grind-017', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'The hardest part is not writing the code. It is thinking clearly before you write any.' },
  { key: 'grind-018', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Twenty minutes stuck is productive. Ninety minutes stuck is stubbornness — go read the editorial.' },
  { key: 'grind-019', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Solve it badly first. An ugly working solution beats an elegant one you never finish.' },
  { key: 'grind-020', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'State the brute force out loud before optimising. Interviewers want to see the path, not the trick.' },
  { key: 'grind-021', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Work the examples by hand. Half of all wrong answers start by misreading the question.' },
  { key: 'grind-022', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Two problems understood properly are worth ten copied from a solution tab.' },
  { key: 'grind-023', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'The pattern is the reusable part. The problem is just where you met it.' },
  { key: 'grind-024', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Someone else is preparing for the same interview. The only variable you control is today.' },
  { key: 'grind-025', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Write the recurrence before the loop. Most DP failures are decided before any code exists.' },
  { key: 'grind-026', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Say the invariant out loud. If you cannot, your two pointers are guesswork.' },
  { key: 'grind-027', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Off-by-one errors are not carelessness. They are what happens when you skip the boundary case.' },
  { key: 'grind-028', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Re-solving from memory is worth more than reading your old solution. Do it without scrolling.' },
  { key: 'grind-029', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'The gap between you and a strong engineer is mostly repetitions, done deliberately.' },
  { key: 'grind-030', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'One problem a day becomes several hundred before you notice it happening.' },
  { key: 'grind-031', trigger: 'always', surfaces: ['revision'], category: 'grind',
    text: 'Recall beats recognition. If you needed a hint, it goes back in the queue.' },
  { key: 'grind-032', trigger: 'always', surfaces: ['revision'], category: 'grind',
    text: 'The forgetting is not a bug in you. Spacing the review is the fix, and you are doing it.' },
  { key: 'grind-033', trigger: 'always', surfaces: ['revision'], category: 'grind',
    text: 'A problem is finished when you can rebuild it cold, not when the judge went green.' },
  { key: 'grind-034', trigger: 'always', surfaces: ['revision'], category: 'grind',
    text: 'Reviewing feels like standing still. It is the only reason anything stays.' },
  { key: 'grind-035', trigger: 'always', surfaces: WORK, category: 'grind',
    text: 'Rate your confidence honestly. Lying to the scheduler only means it lies back to you later.' },

  // --- what the work is actually for: stats and profile -------------------
  { key: 'career-001', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'Your career gets easier the moment your skills become difficult to replace.' },
  { key: 'career-002', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'The company you join matters. The engineer you become there matters more.' },
  { key: 'career-003', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'Every year should leave you with something you could not do the year before.' },
  { key: 'career-004', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'Your future self benefits from the boring session you nearly skipped.' },
  { key: 'career-005', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'Your resume gets you the interview. Your engineering gets you the offer.' },
  { key: 'career-006', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'The goal is not to look like a senior engineer. It is to think like one.' },
  { key: 'career-007', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'Do not spend your twenties only consuming technology. Build things with it.' },
  { key: 'career-008', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Compensation follows the value of the problems you can be trusted with.' },
  { key: 'career-009', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Do not chase the number. Chase the ability that makes the number an ordinary outcome.' },
  { key: 'career-010', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Salary is the scoreboard. Skill is the game, and only one of them is under your control.' },
  { key: 'career-011', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Better engineering is negotiating power. It is the only kind that survives a hiring freeze.' },
  { key: 'career-012', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Learn things that are expensive to replace, then let the market do its arithmetic.' },
  { key: 'career-013', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Your first big offer is not the destination. It is evidence the direction is right.' },
  { key: 'career-014', trigger: 'always', surfaces: CAREER, category: 'money',
    text: 'Aim to be the engineer companies compete over, not the one competing for every opening.' },
  { key: 'career-015', trigger: 'always', surfaces: CAREER, category: 'people',
    text: 'The biggest perk of a strong team is the people sitting next to you.' },
  { key: 'career-016', trigger: 'always', surfaces: CAREER, category: 'people',
    text: 'Work with engineers better than you and your definition of "good" quietly moves.' },
  { key: 'career-017', trigger: 'always', surfaces: CAREER, category: 'people',
    text: 'A serious code review teaches you more than another hour of tutorials.' },
  { key: 'career-018', trigger: 'always', surfaces: CAREER, category: 'people',
    text: 'You want colleagues who ask what happens at ten million users, before it is ten million.' },
  { key: 'career-019', trigger: 'always', surfaces: CAREER, category: 'people',
    text: 'Strong teams compress years of learning into months of being slightly out of your depth.' },
  { key: 'career-020', trigger: 'always', surfaces: CAREER, category: 'people',
    text: 'The best teammates change how you think, not just how you write code.' },
  { key: 'career-021', trigger: 'always', surfaces: CAREER, category: 'global',
    text: 'Learn skills that travel and geography stops being the thing that decides your options.' },
  { key: 'career-022', trigger: 'always', surfaces: CAREER, category: 'global',
    text: 'You do not have to be in the Bay Area to build the skills they hire for there.' },
  { key: 'career-023', trigger: 'always', surfaces: CAREER, category: 'global',
    text: 'Distributed teams care what you can build, far more than where you started.' },
  { key: 'career-024', trigger: 'always', surfaces: CAREER, category: 'global',
    text: 'Bengaluru, Seattle, London, Singapore — the problems rhyme. The skills move with you.' },
  { key: 'career-025', trigger: 'always', surfaces: CAREER, category: 'career',
    text: 'Progress is not linear and it is not supposed to feel like anything while it happens.' },

  // --- the technical horizon ----------------------------------------------
  { key: 'tech-001', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Arrays today. Distributed systems in a couple of years. Same habit of thinking, bigger blast radius.' },
  { key: 'tech-002', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Distributed systems are where simple code meets complicated reality.' },
  { key: 'tech-003', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'The best engineers do not only ask whether it works. They ask how it fails.' },
  { key: 'tech-004', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Backend work is not writing endpoints. It is designing something that survives a bad Tuesday.' },
  { key: 'tech-005', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Learn databases until you understand why indexes exist, not just how to add one.' },
  { key: 'tech-006', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Learn networking until you can say where the latency actually comes from.' },
  { key: 'tech-007', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Do not just learn Redis. Learn why a system needs a cache and what it costs you.' },
  { key: 'tech-008', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Do not just learn Kafka. Understand why anyone chose to make the system asynchronous.' },
  { key: 'tech-009', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Do not memorise system design diagrams. Learn the trade-off each box was chosen for.' },
  { key: 'tech-010', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'System design begins exactly where single-machine thinking runs out.' },
  { key: 'tech-011', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Scalability stops being a buzzword the first time real users depend on your answer.' },
  { key: 'tech-012', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Learn the fundamentals deeply enough that new frameworks become easy to read.' },
  { key: 'tech-013', trigger: 'always', surfaces: CAREER, category: 'tech',
    text: 'Seniority is not knowing every technology. It is knowing which one, and being able to say why.' },
  { key: 'tech-014', trigger: 'always', surfaces: CAREER, category: 'quant',
    text: 'Low-latency work teaches you that microseconds can be the entire product.' },
  { key: 'tech-015', trigger: 'always', surfaces: CAREER, category: 'quant',
    text: 'You need not go near trading to benefit from learning how high-performance systems are built.' },
  { key: 'tech-016', trigger: 'always', surfaces: CAREER, category: 'ai',
    text: 'AI is becoming part of the stack. Engineers who understand both halves are the scarce ones.' },
  { key: 'tech-017', trigger: 'always', surfaces: CAREER, category: 'ai',
    text: 'A model can generate code. Judgement still decides whether it belongs in production.' },
  { key: 'tech-018', trigger: 'always', surfaces: CAREER, category: 'ai',
    text: 'Today’s AI infrastructure problems are next year’s distributed systems interview questions.' },
  { key: 'tech-019', trigger: 'always', surfaces: CAREER, category: 'ai',
    text: 'You do not need to be a researcher. You need to build systems that make models useful.' },
  { key: 'tech-020', trigger: 'always', surfaces: CAREER, category: 'ai',
    text: 'The point is not to out-type a model. It is to out-think the problem it was pointed at.' },
  { key: 'tech-021', trigger: 'always', surfaces: CAREER, category: 'ai',
    text: 'AI will create engineering problems faster than it removes them. Both halves need fundamentals.' },

  // --- the sign-in page ----------------------------------------------------
  { key: 'login-001', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'The offer is decided in the interview. The interview is decided months earlier.' },
  { key: 'login-002', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'You do not need another motivational video. You need the problem in front of you.' },
  { key: 'login-003', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'The engineer you want to be is built one difficult problem at a time.' },
  { key: 'login-004', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'Do not wish for the interview. Become someone who can survive it.' },
  { key: 'login-005', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'Do not chase the company. Chase the capability that makes the company come looking.' },
  { key: 'login-006', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'Your competition is not the person who solved 500. It is the one who understood 200.' },
  { key: 'login-007', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'Nobody sees the hundreds you solved before the one you solve in the room.' },
  { key: 'login-008', trigger: 'always', surfaces: LOGIN, category: 'career',
    text: 'You do not need to change your life today. You need to win today.' },
  { key: 'login-009', trigger: 'always', surfaces: LOGIN, category: 'career',
    text: 'A strong career is ordinary days, executed anyway, for longer than most people manage.' },
  { key: 'login-010', trigger: 'always', surfaces: LOGIN, category: 'career',
    text: 'Four serious months can change your trajectory, but only if they are actually serious.' },
  { key: 'login-011', trigger: 'always', surfaces: LOGIN, category: 'career',
    text: 'Today’s two hours are the ones you will point at later.' },
  { key: 'login-012', trigger: 'always', surfaces: LOGIN, category: 'big-tech',
    text: 'Big tech does not need another person who can code. It needs people who can think at scale.' },
  { key: 'login-013', trigger: 'always', surfaces: LOGIN, category: 'big-tech',
    text: 'The point of a great company is not the logo. It is the problems behind it.' },
  { key: 'login-014', trigger: 'always', surfaces: LOGIN, category: 'big-tech',
    text: 'A strong team hands you problems most engineers never get to touch.' },
  { key: 'login-015', trigger: 'always', surfaces: LOGIN, category: 'big-tech',
    text: 'You are not preparing for a company name. You are raising your own ceiling.' },
  { key: 'login-016', trigger: 'always', surfaces: LOGIN, category: 'global',
    text: 'The laptop in front of you is the most portable career you will ever own.' },
  { key: 'login-017', trigger: 'always', surfaces: LOGIN, category: 'money',
    text: 'Skills that are hard to replace are the only reliable form of leverage.' },
  { key: 'login-018', trigger: 'always', surfaces: LOGIN, category: 'ai',
    text: 'Build with the models, then learn to build the systems that make them useful.' },
  { key: 'login-019', trigger: 'always', surfaces: LOGIN, category: 'elite',
    text: 'The bigger the system, the more your judgement is worth. That is the whole career.' },
  { key: 'login-020', trigger: 'always', surfaces: LOGIN, category: 'grind',
    text: 'Pick up where you left off. That sentence is the entire method.' },

  // --- a few that read well anywhere in the app ---------------------------
  { key: 'any-001', trigger: 'always', surfaces: IN_APP, category: 'grind',
    text: 'Progress is mostly invisible from the inside. That is why the numbers on this page exist.' },
  { key: 'any-002', trigger: 'always', surfaces: IN_APP, category: 'grind',
    text: 'The plan is not the work. Close this and open a problem.' },
  { key: 'any-003', trigger: 'always', surfaces: IN_APP, category: 'career',
    text: 'Nothing here is wasted. Even the problems you failed changed how you read the next one.' },
  { key: 'any-004', trigger: 'always', surfaces: IN_APP, category: 'elite',
    text: 'One day you will work on systems serving millions. Prepare like that is already the job.' },
  { key: 'any-005', trigger: 'always', surfaces: IN_APP, category: 'grind',
    text: 'Difficulty is the signal you are in the right place. Comfortable problems teach nothing.' },
];
