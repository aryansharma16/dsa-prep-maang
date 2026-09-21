import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'One pipeline, several channels, and a rule that decides everything: **a notification is a message the user did not ask for right now**, so the hard problems are not delivery — they are preference, deduplication and not being annoying.',
    ),

    flow(['Trigger event', 'Preferences', 'Template', 'Channel router', 'Provider', 'Delivery status'], 'The pipeline'),

    h('The architecture'),
    diagram(
      `
   events ──▶ ┌──────────────┐
              │ notification │  1. should this user get it at all?
              │   service    │  2. which channels?
              └──────┬───────┘  3. render the template
                     │          4. dedupe / rate limit
          ┌──────────┼──────────┬──────────┐
          ▼          ▼          ▼          ▼
       ┌─────┐   ┌──────┐   ┌─────┐   ┌────────┐
       │ push│   │ email│   │ SMS │   │in-app  │
       └──┬──┘   └───┬──┘   └──┬──┘   └───┬────┘
          ▼          ▼         ▼          ▼
       APNs/FCM   SendGrid  Twilio    your own DB
          │          │         │          │
          └──────────┴────┬────┴──────────┘
                          ▼
                 delivery status / bounces
                 ──▶ feeds back into preferences
                     (a bounced address stops being used)
`,
      'One service, several providers',
    ),
    table(
      ['Channel', 'Latency', 'Cost', 'Reliability', 'Use for'],
      [
        ['**In-app**', 'Instant', 'Free', 'Only when they are looking', 'Everything — it is the default record'],
        ['**Push**', 'Seconds', 'Free', 'Silently dropped if the token is stale', 'Timely, actionable'],
        ['**Email**', 'Seconds to minutes', 'Cheap', 'Spam folders, bounces', 'Receipts, digests, anything with detail'],
        ['**SMS**', 'Seconds', '**Expensive**', 'High — it always arrives', 'OTP, critical alerts only'],
        ['**WhatsApp / RCS**', 'Seconds', 'Medium', 'High', 'Transactional, where templates are approved'],
      ],
    ),

    h('Preferences'),
    p(
      'The centre of the design, not a settings page. A notification must pass **several independent checks** before it is sent, and each one is a reason it can legitimately be dropped.',
    ),
    table(
      ['Check', 'Example'],
      [
        ['**Per category**', '"Order updates yes, marketing no"'],
        ['**Per channel**', '"Push yes, email no"'],
        ['**Quiet hours**', 'Not between 22:00 and 08:00, in **their** timezone'],
        ['**Frequency cap**', 'At most 3 marketing messages a week'],
        ['**Global unsubscribe**', 'Legally binding — and must be honoured immediately'],
        ['**Channel health**', 'A bounced address or dead push token is not retried forever'],
      ],
    ),
    warn(
      'Quiet hours and frequency caps must be enforced **in the pipeline, not in each producer.** Otherwise the new feature that sends notifications is the one that wakes people at 3am, and nobody finds out until the reviews arrive.',
    ),

    h('Deduplication'),
    diagram(
      `
   the same notification arrives three times because
     ▸ the queue delivered at-least-once
     ▸ two services both reacted to one event
     ▸ a retry after a timeout that actually succeeded

   DEDUPE KEY = hash(user, category, entity, time bucket)

     user 42 + "order_shipped" + order 991 + hour 14
        │
        ▼
   SETNX dedupe:<key> 1 EX 3600
        │
        ├── acquired ──▶ send
        └── existed  ──▶ DROP silently

   and the digest version: instead of 40 separate "someone
   liked your post", buffer for N minutes and send one
   "40 people liked your post".
`,
      'Idempotency, with a human-facing twist',
    ),
    tip(
      'Digesting is deduplication that the user actually notices. **Buffer low-value notifications for a few minutes and collapse them into one** — it is fewer sends, less cost, and a dramatically better product than forty separate pushes.',
    ),

    h('Fan-out'),
    table(
      ['Shape', 'Approach'],
      [
        ['One user', 'Direct — a single job'],
        ['A few thousand', 'Enqueue one job per user; workers drain it'],
        ['**Millions (a broadcast)**', 'A job per **batch**, and rate-limit to the provider\'s ceiling'],
        ['Time-zone aware', 'Schedule per user\'s local time — a broadcast becomes 24 staggered waves'],
      ],
    ),
    warn(
      'A broadcast to ten million users is a **self-inflicted traffic spike**: everyone who taps the notification arrives at your servers in the same thirty seconds. Stagger the send, and size the read path for the resulting wave — not for the send itself.',
    ),

    h('Delivery is not guaranteed'),
    table(
      ['Channel', 'Fails silently when', 'Handling'],
      [
        ['Push', 'The token is stale, or the app was uninstalled', 'Process the provider\'s feedback and prune tokens'],
        ['Email', 'Bounced, or in spam', 'Track bounces; stop sending to hard bounces'],
        ['SMS', 'Bad number, carrier blocked', 'Status callbacks; fall back to another channel'],
      ],
    ),
    tip(
      'Design for **channel fallback**: try push, and if there is no delivery confirmation within a few minutes, fall back to email. Critical notifications should never depend on a single channel that can fail without telling you.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'One pipeline delivering messages across push, email, SMS and in-app'],
      ['The hard part', 'Preferences, deduplication and not annoying people'],
      ['Use when', 'Any product that tells users something happened'],
      ['Trade-off', 'Digesting reduces noise and cost, at the price of immediacy'],
      [
        '30-second answer',
        '"Events go into one notification service that checks preferences — category, channel, quiet hours in the user\'s timezone, frequency caps — then renders a template and routes to per-channel providers. Deduplicate on a key of user, category and entity, because queues deliver at-least-once and two services often react to the same event. Digest low-value notifications into one. And a broadcast is a traffic spike, because everyone taps it at once."',
      ],
    ]),
    asked([
      ['How do you design a notification system for millions of users?', 'One pipeline with preference checks, templating, per-channel providers, and batched fan-out that is rate-limited and staggered.'],
      ['How do you avoid sending the same push five times?', 'A dedupe key of user, category, entity and time bucket, set with SETNX and a TTL.'],
      ['Where do quiet hours belong?', 'In the pipeline, not in each producer — otherwise one new feature wakes everyone at 3am.'],
      ['What happens when you broadcast to ten million users?', 'They all tap it at once. Stagger the send and size the read path for the wave.'],
      ['How do you handle a failed delivery?', 'Track provider status, prune dead tokens and hard bounces, and fall back to another channel.'],
    ]),

    links(wiki('Push_technology', 'Push technology'), wiki('Bounce_message', 'Bounce message')),
  ],
};
