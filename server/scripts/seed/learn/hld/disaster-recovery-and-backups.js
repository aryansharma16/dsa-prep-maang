import { asked, diagram, flow, h, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two numbers decide everything else. **RTO is how long you may be down. RPO is how much data you may lose.** Every disaster recovery decision — architecture, cost, backup frequency — falls out of agreeing those two with the business.',
    ),

    h('RTO and RPO'),
    diagram(
      `
                         DISASTER
                            │
   ─────────────────────────┼─────────────────────────▶ time
       │                    │                    │
   last good state      failure at 14:00      back online
       13:00                                     15:00

       └──────── RPO ───────┘└──────── RTO ──────┘
        1 hour of data lost    1 hour of downtime

   RPO ──▶ how often you back up / replicate
   RTO ──▶ how fast you can restore or fail over

   they are INDEPENDENT. continuous replication gives a tiny
   RPO and says nothing about how fast you can serve traffic
   again.
`,
      'Two numbers, two different levers',
    ),
    table(
      ['Business says', 'RPO', 'RTO', 'Implies'],
      [
        ['"We cannot lose a single order"', '**~0**', 'Minutes', 'Synchronous replication, hot standby'],
        ['"A few minutes is fine"', 'Minutes', 'Under an hour', 'Continuous async replication, warm standby'],
        ['"A day of data, back within a day"', 'Hours', 'Hours', 'Nightly backups, restore on demand'],
        ['"Internal tool"', 'A day', 'Days', 'Backups, and a plan'],
      ],
    ),
    tip(
      'Ask for these numbers rather than assuming them. **"Zero RPO and zero RTO" is what everyone says until they see the price** — and the conversation where a team chooses five minutes of RPO over the cost of synchronous replication is the point of the exercise.',
    ),

    h('The four strategies'),
    table(
      ['Strategy', 'RTO', 'RPO', 'Cost', 'What runs'],
      [
        ['**Backup & restore**', 'Hours–days', 'Hours', '~5%', 'Nothing. Backups in another region'],
        ['**Pilot light**', '~1 hour', 'Minutes', '~10%', 'Data replicating; compute off'],
        ['**Warm standby**', 'Minutes', 'Seconds', '~30%', 'Everything, scaled down'],
        ['**Hot / multi-site**', 'Seconds', '~0', '~100%', 'Full capacity, serving or ready'],
      ],
    ),
    p(
      '**Pilot light is the underrated one.** Data replicates continuously so the RPO is small, and compute is defined but not running — so recovery is "scale up what already exists" rather than "build a region from scratch", at a tenth of the cost of a warm standby.',
    ),

    h('Backups that actually work'),
    table(
      ['Rule', 'Why'],
      [
        ['**3-2-1**', 'Three copies, two media, one off-site'],
        ['**Another region**', 'A backup in the region that burned down is not a backup'],
        ['**Immutable / write-once**', '**Ransomware encrypts backups first** if it can reach them'],
        ['**Separate credentials**', 'A compromised production account must not be able to delete them'],
        ['**Encrypted**', 'A backup is a full copy of your data, sitting somewhere'],
        ['**Point-in-time recovery**', 'Restore to 14:32, not to last midnight'],
        ['**Tested**', 'See below'],
      ],
    ),
    warn(
      '**An untested backup is not a backup.** The failure modes are mundane and universal: the job silently stopped months ago, the archive is corrupt, a table was excluded, the restore takes eleven hours, or nobody knows the procedure. All of them are discovered during the disaster.',
    ),

    h('Testing restores'),
    flow(['Restore to a scratch environment', 'Verify integrity', 'Time it', 'Fix what broke', 'Repeat'], 'On a schedule'),
    table(
      ['Test', 'Answers'],
      [
        ['Restore to a scratch environment', 'Does it work at all?'],
        ['Verify row counts and checksums', 'Is it complete?'],
        ['**Time the whole restore**', '**Is your RTO real, or aspirational?**'],
        ['Restore to a point in time', 'Does PITR actually work?'],
        ['Have someone unfamiliar do it', 'Is the runbook usable by whoever is on call?'],
      ],
    ),
    tip(
      'Timing the restore is the step that most often changes a plan. **A 2TB database restoring at 100MB/s takes about six hours** — so an RTO of one hour was never achievable by restore, and the answer must be a replica you promote instead.',
    ),

    h('What disaster actually means'),
    table(
      ['Scenario', 'Likelihood', 'Backups help?'],
      [
        ['Hardware failure', 'Common', 'Replication handles it'],
        ['Availability zone loss', 'Occasional', 'Multi-AZ handles it'],
        ['Region loss', 'Rare', '**Yes** — this is the classic case'],
        ['**Accidental deletion**', '**Common**', '**Yes — and PITR is what you need**'],
        ['**Bad migration corrupting data**', '**Common**', '**Yes — and it replicated instantly**'],
        ['Ransomware', 'Rare, catastrophic', 'Only if backups are immutable'],
        ['Provider account compromise', 'Rare', 'Only if backups are in a separate account'],
      ],
    ),
    warn(
      'The two **common** rows are not regional disasters — they are a human deleting the wrong thing and a migration corrupting data. Replication faithfully copies both to every replica within milliseconds, so **only a point-in-time backup can undo them.**',
    ),

    h('The plan'),
    table(
      ['Component', 'Must state'],
      [
        ['Agreed RTO and RPO', 'Per system, signed off by the business'],
        ['Who declares a disaster', 'One named role. Ambiguity costs the first hour'],
        ['The runbook', 'Step by step, usable at 3am by whoever is on call'],
        ['Dependency order', 'What comes back first — the database before the app'],
        ['Communications', 'Status page, customers, internal'],
        ['**Last tested**', 'A date. An untested plan is a document'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Surviving the loss of a region, a dataset, or a bad afternoon'],
      ['Why it matters', 'RTO and RPO drive architecture and cost'],
      ['Use when', 'Asked "what if the data centre burns down?" or about backups'],
      ['Trade-off', 'Lower RTO and RPO cost roughly an order of magnitude each step'],
      [
        '30-second answer',
        '"RTO is how long you may be down; RPO is how much data you may lose, and everything follows from agreeing those. Four strategies, from backup-and-restore at hours and 5% cost, through pilot light and warm standby, to hot multi-site at seconds and full cost. Backups must be in another region, immutable so ransomware cannot reach them, and under separate credentials — and restores must be timed, because a 2TB restore takes six hours and that is your real RTO."',
      ],
    ]),
    asked([
      ['What are RTO and RPO?', 'Tolerable downtime and tolerable data loss. They drive architecture and cost independently.'],
      ['What are the four DR strategies?', 'Backup and restore, pilot light, warm standby, and hot multi-site — hours to seconds, 5% to 100% cost.'],
      ['Why does replication not replace backups?', 'It faithfully replicates a bad delete or a corrupting migration. Only point-in-time recovery undoes those.'],
      ['What makes a backup trustworthy?', 'Another region, immutable, separately credentialed, encrypted, with PITR — and a recent tested restore.'],
      ['Why time the restore?', 'Because it is your actual RTO. A large database restoring for six hours makes a one-hour RTO fiction.'],
    ]),

    links(
      wiki('Disaster_recovery', 'Disaster recovery'),
      wiki('Point-in-time_recovery', 'Point-in-time recovery'),
    ),
  ],
};
