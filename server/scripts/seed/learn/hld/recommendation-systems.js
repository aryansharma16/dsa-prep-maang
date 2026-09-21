import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'You cannot score ten million items for every user on every request. So every recommender in production is **a funnel**: narrow cheaply, then rank expensively — and almost all of the narrowing happens offline.',
    ),

    h('The funnel'),
    diagram(
      `
   10,000,000 items
        │
        ▼  CANDIDATE GENERATION        offline, cheap, recall-focused
   ┌──────────────────────┐            several sources, unioned:
   │      ~1,000          │              ▸ collaborative filtering
   └──────────┬───────────┘              ▸ content similarity
              │                          ▸ trending / popular
              ▼  RANKING                 ▸ recently viewed
   ┌──────────────────────┐              ▸ followed creators
   │       ~100           │            online, model-scored,
   └──────────┬───────────┘            precision-focused
              │
              ▼  RE-RANKING             business rules and variety
   ┌──────────────────────┐              ▸ diversity
   │        ~20           │              ▸ freshness boost
   └──────────┬───────────┘              ▸ no two from one creator
              ▼                          ▸ sponsored slots
        what the user sees               ▸ already-seen filter

   each stage is ~10x more expensive per item and ~10x fewer items.
`,
      'Ten million to twenty, in three stages',
    ),
    table(
      ['Stage', 'Optimises for', 'Latency budget', 'Where it runs'],
      [
        ['**Candidate generation**', '**Recall** — do not miss a good item', 'Mostly precomputed', 'Offline + a lookup'],
        ['**Ranking**', '**Precision** — order them well', '~20–50 ms', 'Online'],
        ['**Re-ranking**', 'Diversity and business rules', '~5 ms', 'Online'],
      ],
    ),
    tip(
      'The stages optimise for **different things**, which is the insight. Candidate generation must not miss anything good and can afford false positives; ranking must order precisely and only sees a thousand items. Optimising both for the same metric is how recommenders get slow and worse.',
    ),

    h('Collaborative versus content-based'),
    table(
      ['', 'Collaborative', 'Content-based'],
      [
        ['Signal', '"People like you liked this"', '"This is similar to what you liked"'],
        ['Needs', '**Interaction data**', '**Item features**'],
        ['Strength', 'Surprising, genuinely useful discoveries', 'Works for brand-new items'],
        ['Weakness', '**Cold start** — new users and new items', 'A filter bubble; no serendipity'],
        ['Implementation', 'Matrix factorisation, two-tower embeddings', 'Item embeddings, metadata similarity'],
      ],
    ),
    p(
      'Every real system uses **both**, because each covers the other\'s failure. Collaborative filtering cannot recommend an item nobody has interacted with; content similarity can, and does it from the moment it is created.',
    ),

    h('Cold start'),
    diagram(
      `
   NEW USER                          NEW ITEM
   no history                        no interactions

   ▸ popular / trending              ▸ content features —
   ▸ location and device               the embedding exists
   ▸ onboarding preferences            from the moment it does
   ▸ their first few clicks,         ▸ explicit EXPLORATION —
     immediately                       deliberately show it to a
   ▸ similar-user cohort               small sample to get signal
                                     ▸ creator's previous
                                       performance as a prior

   without exploration, a new item with no interactions is
   never shown, so it never gets interactions. the system
   silently freezes its catalogue.
`,
      'Both directions, and the feedback trap',
    ),
    warn(
      'A recommender trained only on what it already shows **learns its own past behaviour.** Items never surfaced get no engagement, so they are never surfaced — and the catalogue quietly narrows. A share of traffic must be explicitly exploratory.',
    ),

    h('Exploration versus exploitation'),
    table(
      ['Approach', 'How'],
      [
        ['**Epsilon-greedy**', 'A fixed small share of slots are random or new'],
        ['**Thompson sampling / bandits**', 'Sample from uncertainty — principled and effective'],
        ['**A dedicated slot**', 'One position in the feed is always exploratory'],
        ['**Boost new items**', 'A decaying bonus for the first N impressions'],
      ],
    ),

    h('Offline and online'),
    flow(['Events', 'Feature store', 'Train', 'Candidates offline', 'Rank online'], 'The split'),
    table(
      ['Offline (hours)', 'Online (milliseconds)'],
      [
        ['Train models', 'Fetch precomputed candidates'],
        ['Compute embeddings', 'Fetch features from the online store'],
        ['Generate candidate sets per user', 'Score with the ranking model'],
        ['Build the ANN index', 'Apply rules and diversity'],
        ['Refresh aggregate features', 'Log impressions for tomorrow\'s training'],
      ],
    ),
    tip(
      'Logging **impressions**, not only clicks, is what makes training possible. Without knowing what was shown and not clicked, you have positives and no negatives — and a model trained on positives alone learns nothing useful.',
    ),

    h('What to optimise'),
    table(
      ['Metric', 'Optimising it alone produces'],
      [
        ['**Click-through rate**', 'Clickbait. It is the easiest metric to ruin a product with'],
        ['**Watch or dwell time**', 'Long, low-value content'],
        ['**Engagement**', 'Outrage, which engages extremely well'],
        ['**Conversion**', 'Better — but only recommends what already sells'],
        ['**Long-term retention**', '**The honest objective**, and the hardest to measure'],
        ['**A blend, with guardrails**', 'What production systems actually use'],
      ],
    ),
    warn(
      'Optimising a single engagement metric is the well-documented way to degrade a product while every dashboard improves. **Guardrail metrics** — diversity, creator spread, session satisfaction, complaint rate — exist to catch that, and they must be watched alongside the objective.',
    ),

    h('Evaluation'),
    table(
      ['Method', 'Measures', 'Limitation'],
      [
        ['Offline metrics (NDCG, recall@k)', 'Ranking quality on logged data', 'Only measures what was shown'],
        ['**A/B test**', '**Real behaviour**', 'Slow; needs traffic'],
        ['Interleaving', 'Two rankers in one session', 'Sensitive, and fast'],
        ['Long-term holdout', 'Retention effects', 'Expensive, and necessary'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'A funnel narrowing a catalogue to a handful of items'],
      ['The hard part', 'Cold start, and not optimising a metric into a worse product'],
      ['Use when', 'Feeds, product recommendations, content discovery'],
      ['Trade-off', 'Precision against discovery, and engagement against long-term value'],
      [
        '30-second answer',
        '"A three-stage funnel: candidate generation narrows millions to about a thousand using several precomputed sources and optimises for recall; ranking scores those with a model online and optimises for precision; re-ranking applies diversity and business rules. Collaborative filtering and content similarity cover each other\'s cold start, and a share of traffic must be exploratory or the catalogue freezes. And log impressions, not just clicks — otherwise you have no negatives to train on."',
      ],
    ]),
    asked([
      ['Design a recommendation system.', 'Candidate generation offline from several sources, online ranking with a model, then re-ranking for diversity and rules.'],
      ['How do you handle a new user?', 'Popularity, location, onboarding preferences, and their first few interactions immediately.'],
      ['How do you handle a new item?', 'Content features work from day one, plus deliberate exploration to gather interaction signal.'],
      ['Why not optimise click-through rate?', 'It produces clickbait. Blend objectives and watch guardrail metrics like diversity and complaints.'],
      ['Why log impressions?', 'Clicks alone give only positives. You need what was shown and not clicked as negatives.'],
    ]),

    links(
      wiki('Recommender_system', 'Recommender system'),
      wiki('Collaborative_filtering', 'Collaborative filtering'),
    ),
  ],
};
