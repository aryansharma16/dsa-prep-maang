import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'A model is a small part of a machine learning system. **The pipeline around it — features, training, deployment, monitoring — is where the engineering is**, and training-serving skew is the bug it exists to prevent.',
    ),

    h('Training-serving skew'),
    diagram(
      `
   THE BUG

   TRAINING (offline, Python, a warehouse)
     avg_order_value = SUM(orders.total) / COUNT(*)
                       over the last 30 days

   SERVING (online, TypeScript, a microservice)
     avgOrderValue = totalSpent / orderCount
                     ...over ALL TIME, because that is what
                        the service already had

   same NAME. different NUMBER. the model was trained on one
   distribution and is served another.

   ──▶ quality drops, no error is raised, offline metrics
       still look fine, and nobody knows why production
       underperforms the notebook.
`,
      'Two definitions of one feature',
    ),
    warn(
      'This is **the** classic production ML bug, and its defining property is that it is silent. Nothing throws, the eval set still scores well, and the only symptom is that the model works worse in production than it did in testing.',
    ),

    h('What a feature store does'),
    diagram(
      `
                  ONE DEFINITION
                        │
          ┌─────────────┴─────────────┐
          ▼                           ▼
   ┌──────────────┐            ┌──────────────┐
   │  OFFLINE     │            │   ONLINE     │
   │  store       │            │   store      │
   │              │            │              │
   │ warehouse    │            │ Redis / KV   │
   │ full history │            │ latest value │
   │ point-in-time│            │ < 10 ms      │
   │ correctness  │            │              │
   └──────┬───────┘            └──────┬───────┘
          ▼                           ▼
      TRAINING                     SERVING

   ✓ one definition, so no skew by construction
   ✓ features are reusable across teams and models
   ✓ point-in-time correctness for training sets
   ✗ real infrastructure to run — not free
`,
      'One definition, two stores',
    ),
    table(
      ['Provides', 'Why it matters'],
      [
        ['**One feature definition**', 'Removes skew by construction'],
        ['**Point-in-time correctness**', 'Prevents leakage — see below'],
        ['**Low-latency online serving**', 'Ranking needs features in under 10ms'],
        ['**Reuse**', 'Teams stop rebuilding `user_30d_spend` five times'],
        ['**Lineage**', 'Which model used which version of which feature'],
      ],
    ),

    h('Point-in-time correctness'),
    diagram(
      `
   training a churn model on an event from 1 March

   WRONG — leakage                   RIGHT — as-of join

   join today's feature values       join the values AS THEY WERE
   ──▶ includes behaviour from       on 1 March
       AFTER 1 March                 ──▶ exactly what the model
   ──▶ the model "predicts" churn        will have at serving time
       using the churn itself
   ──▶ 0.99 offline, useless live

   this is the second silent killer. an unreasonably good
   offline metric is usually leakage, not a breakthrough.
`,
      'Why the store keeps history',
    ),
    tip(
      '**An offline score that looks too good is almost always leakage.** A model that suddenly jumps to near-perfect accuracy has usually been given a feature that encodes the answer — and point-in-time joins are the systematic defence.',
    ),

    h('The pipeline'),
    flow(['Events', 'Features', 'Train', 'Evaluate', 'Register', 'Deploy', 'Monitor'], 'And back to the start'),
    table(
      ['Stage', 'Must be'],
      [
        ['**Ingestion**', 'Reliable and replayable — the source of everything'],
        ['**Feature computation**', 'The same code offline and online'],
        ['**Training**', 'Reproducible: pinned data version, code version, seed'],
        ['**Evaluation**', 'Against a held-out set, plus guardrail slices'],
        ['**Registry**', 'Versioned, with the metrics and data lineage attached'],
        ['**Deployment**', 'Shadow, then canary — never a straight swap'],
        ['**Monitoring**', 'Drift and quality, not just latency and errors'],
      ],
    ),
    tip(
      '**Reproducibility is the property that matters most and is skipped most.** "Which data and which code produced the model currently serving?" must be answerable, or you cannot debug a regression and you cannot roll forward with confidence.',
    ),

    h('Monitoring a model'),
    table(
      ['Monitor', 'Detects', 'Signal'],
      [
        ['**Feature drift**', 'Input distribution changed', 'Statistical distance from the training distribution'],
        ['**Prediction drift**', 'Output distribution changed', 'Score distribution shifting'],
        ['**Concept drift**', '**The relationship changed**', 'Accuracy falls with stable inputs'],
        ['**Data quality**', 'Nulls, out-of-range, a schema change upstream', 'Validation rules on the feature pipeline'],
        ['**Ground truth**', 'Actual outcomes', 'Delayed — sometimes by weeks'],
      ],
    ),
    warn(
      'Ground truth usually **arrives late.** You learn whether a fraud prediction was right when a chargeback lands weeks later — so drift detection on inputs is often your only timely signal that something has changed.',
    ),
    code(
      js(`
// Feature validation at serving time. A model given a null where
// it trained on a number produces a confident wrong answer, and
// the null is far easier to detect than the wrong answer.
function validate(features, schema) {
  for (const [name, spec] of Object.entries(schema)) {
    const value = features[name];

    if (value == null && !spec.nullable) {
      metrics.increment('features.missing', { name });
      // A documented default beats an implicit zero, which the
      // model will interpret as a real and meaningful value.
      features[name] = spec.default;
    } else if (spec.range && (value < spec.range[0] || value > spec.range[1])) {
      metrics.increment('features.out_of_range', { name });
      features[name] = clamp(value, spec.range);
    }
  }
  return features;
}
`),
    ),

    h('Do you need a feature store?'),
    table(
      ['Situation', 'Answer'],
      [
        ['One model, features computed in one place', '**No.** It is infrastructure you do not need'],
        ['Several models sharing features', 'Probably'],
        ['Separate teams for training and serving', '**Yes** — this is where skew appears'],
        ['Real-time features with strict latency', 'Yes — you need the online store'],
        ['Batch-only predictions', 'No — a warehouse and a key-value store suffice'],
      ],
    ),
    p(
      'A feature store is **a solution to organisational and consistency problems**, not a requirement for doing ML. One team with one model computing features in one function has already solved skew, without the infrastructure.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Shared feature definitions served to both training and inference'],
      ['Why it exists', 'Training-serving skew is silent and common'],
      ['Use when', 'Several models or teams share features, or online features are needed'],
      ['Trade-off', 'Consistency and reuse, for real infrastructure to operate'],
      [
        '30-second answer',
        '"Training-serving skew is when a feature is computed one way in the training pipeline and another way in the serving code — same name, different number, no error, and the model quietly underperforms. A feature store fixes it by construction: one definition, an offline store with full history for training and an online store for low-latency serving. It also gives point-in-time joins, which prevent leakage. Then monitor feature and concept drift, because ground truth usually arrives weeks late."',
      ],
    ]),
    asked([
      ['What is training-serving skew?', 'The same feature computed differently offline and online. It is silent — no error, just worse predictions.'],
      ['How does a feature store prevent it?', 'One definition materialised into both an offline store for training and an online store for serving.'],
      ['What is point-in-time correctness?', 'Joining feature values as they were at the event time, so training cannot see the future.'],
      ['How do you monitor a model in production?', 'Feature drift, prediction drift and concept drift — ground truth is usually too delayed to rely on.'],
      ['Do you always need a feature store?', 'No. One team with one model computing features in one place has already solved the problem.'],
    ]),

    links(wiki('MLOps', 'MLOps'), wiki('Concept_drift', 'Concept drift')),
  ],
};
