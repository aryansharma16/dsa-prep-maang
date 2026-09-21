import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Object storage is a flat namespace of immutable blobs behind an HTTP API. It is **cheap, effectively infinite, and extremely durable**, and it is the correct home for every file your system handles — none of which belong in your database.',
    ),

    flow(['Client', 'Presigned URL', 'Object storage', 'Event', 'Processing'], 'Bytes never touch your servers'),

    h('Why not the database'),
    table(
      ['Putting blobs in the DB', 'Consequence'],
      [
        ['A 3MB photo in a row', 'Backups balloon; restores take hours'],
        ['Reads pull it through the connection', 'Pool exhaustion on a handful of downloads'],
        ['It sits in the buffer pool', 'Evicting the rows you actually query'],
        ['Replication carries every byte', 'Replica lag on a photo upload'],
        ['Cost', '**~50x** object storage, per GB'],
        ['No CDN in front of it', 'Every download is origin traffic'],
      ],
    ),
    warn(
      'Store the **key**, not the bytes. A `VARCHAR` column holding `uploads/2024/01/a3f9.jpg` costs 30 bytes and gives you CDN caching, lifecycle policies, presigned access and a backup that still finishes overnight.',
    ),

    h('Object versus block versus file'),
    table(
      ['', 'Object', 'Block', 'File'],
      [
        ['Unit', 'Whole object + metadata', 'Fixed-size blocks', 'Files in directories'],
        ['Access', 'HTTP `GET`/`PUT`', 'Attached as a disk', 'NFS/SMB mount'],
        ['Mutability', '**Immutable — replace the whole object**', 'Random read/write', 'Random read/write'],
        ['Scale', 'Effectively unlimited', 'Per-volume limits', 'Limited'],
        ['Cost', '**Lowest**', 'High', 'Medium'],
        ['Use for', 'Media, backups, logs, data lakes', 'Databases, boot disks', 'Shared workspaces, legacy apps'],
      ],
    ),
    p(
      'Immutability is the defining property and the source of most of the rest. You cannot append a line to an object — **you replace it** — which is why object storage is excellent for media and backups and wrong as a database\'s disk.',
    ),

    h('Presigned URLs'),
    diagram(
      `
   WITHOUT                           WITH

   client ──4 GB──▶ your server      client ──▶ your server
                       │                          │  "where do
                       ▼                          │   I put it?"
                     S3                           ◀── presigned URL
                                                  │   (signed, 15 min,
   ✗ bandwidth through your app                   │    this key only)
   ✗ memory or disk buffering                     ▼
   ✗ request timeouts on slow links         client ──4 GB──▶ S3
   ✗ your app scales with upload size
                                        ✓ your server handled ~200 bytes
                                        ✓ upload speed is S3's problem
`,
      'The only sane way to accept a large file',
    ),
    code(
      js(`
// The server's whole involvement in a 4GB upload.
app.post('/uploads', requireAuth, async (req, res) => {
  const key = \`uploads/\${req.user.id}/\${crypto.randomUUID()}\`;

  const url = await s3.getSignedUrl('putObject', {
    Bucket: 'media',
    Key: key,
    Expires: 900,                      // 15 minutes
    ContentType: req.body.contentType, // bind the type...
    ContentLength: req.body.size,      // ...and the size, so the
  });                                  // URL cannot be reused for
                                       // an arbitrary file
  // The row is created now and marked pending; an S3 event
  // confirms it later. Never trust the client to tell you the
  // upload finished.
  await db.uploads.create({ key, userId: req.user.id, status: 'pending' });
  res.json({ url, key });
});
`),
    ),
    tip(
      'Bind the presigned URL to the **content type and size**, and never trust the client\'s "I finished" call. The upload completion should come from a storage event, because the client can lie, crash, or simply never come back.',
    ),

    h('Storage classes'),
    table(
      ['Class', 'Retrieval', 'Relative cost', 'For'],
      [
        ['**Standard**', 'Immediate', '1x', 'Active content'],
        ['**Infrequent access**', 'Immediate, retrieval fee', '~0.5x', 'Backups, older media'],
        ['**Archive / Glacier**', 'Minutes to hours', '~0.1x', 'Compliance, long-term retention'],
        ['**Deep archive**', 'Hours', '~0.03x', 'Things you hope never to read'],
      ],
    ),
    p(
      '**Lifecycle policies** move objects between classes automatically — "standard for 30 days, infrequent for 90, archive after a year". For a media-heavy product this is usually the single largest cost reduction available, and it is a config file.',
    ),

    h('Consistency and durability'),
    table(
      ['Property', 'Reality'],
      [
        ['**Durability**', '~11 nines. Losing an object is not a scenario you design for'],
        ['**Availability**', '~99.9%. Losing *access* absolutely is'],
        ['**Read-after-write**', 'Strong on major providers now — a `GET` after a `PUT` returns the new object'],
        ['**List consistency**', 'Can lag. Do not drive logic off a listing'],
        ['**No transactions**', 'Two objects cannot be updated atomically'],
      ],
    ),
    warn(
      'Durability and availability are different numbers here and the gap matters: your objects are **almost certainly still there** during an outage, and you still cannot serve them. Multi-region replication is for availability, not for durability.',
    ),

    h('Patterns worth knowing'),
    table(
      ['Pattern', 'Detail'],
      [
        ['**CDN in front**', 'Almost always. Object storage egress is expensive and far away'],
        ['**Event-driven processing**', 'An upload emits an event; workers transcode, scan, thumbnail'],
        ['**Content-addressed keys**', 'Key = hash of the content, so identical files deduplicate for free'],
        ['**Date-partitioned prefixes**', '`2024/01/15/...` — makes lifecycle rules and listings tractable'],
        ['**Immutable, versioned objects**', 'Never overwrite; write a new key. Rollback is pointing at the old one'],
      ],
    ),

    h('Interview'),
    quick([
      ['What it is', 'Immutable blobs in a flat namespace behind an HTTP API'],
      ['Why it exists', 'Files are large, cheap to store and expensive to put anywhere else'],
      ['Use when', 'Any media, backup, log or archive — essentially always'],
      ['Trade-off', 'Cheap and infinitely scalable, but immutable and with no transactions'],
      [
        '30-second answer',
        '"Blobs go in object storage and the database stores the key — putting a 3MB photo in a row wrecks backups, replication and the buffer pool, and costs about fifty times more. Uploads use presigned URLs so gigabytes never traverse your servers, bound to a content type and size, with completion confirmed by a storage event rather than by the client. Lifecycle policies tier old objects down to archive, and a CDN sits in front because egress is the expensive part."',
      ],
    ]),
    asked([
      ['Why not store images in the database?', 'Backups, replication and the buffer pool all suffer, and it costs roughly fifty times more per GB.'],
      ['How does a presigned upload work?', 'The server signs a short-lived URL for one key; the client uploads directly to storage.'],
      ['How do you know the upload finished?', 'A storage event. The client can crash or lie.'],
      ['What is object storage bad at?', 'Anything needing partial updates or transactions. Objects are immutable — you replace them.'],
      ['How do you cut storage cost?', 'Lifecycle policies tiering to infrequent-access and archive, plus content-addressed keys for deduplication.'],
    ]),

    links(
      wiki('Object_storage', 'Object storage'),
      wiki('Amazon_S3', 'Amazon S3'),
    ),
  ],
};
