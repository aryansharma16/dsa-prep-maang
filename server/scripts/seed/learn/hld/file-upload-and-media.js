import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'One rule governs the whole design: **bytes must not pass through your application servers.** Everything else — presigned URLs, chunked uploads, event-driven processing — is machinery for keeping that true while still knowing what happened.',
    ),

    flow(['Request a URL', 'Upload direct to storage', 'Storage event', 'Process', 'Serve via CDN'], 'The shape'),

    h('Why not through the app'),
    diagram(
      `
   THROUGH THE APP                   DIRECT TO STORAGE

   client ──4 GB──▶ app server       client ──▶ app  "where?"
                        │                    ◀── presigned URL
                        ▼                    │
                       S3                    └──4 GB──▶ S3

   ✗ 4 GB through your bandwidth     ✓ app handled ~200 bytes
   ✗ buffered in memory or on disk   ✓ upload speed is S3's problem
   ✗ request timeouts on slow links  ✓ app instances stay small
   ✗ a slow uploader holds a worker  ✓ resumable, parallel, fast
     for ten minutes
   ✗ scaling the app tier to the
     size of your uploads
`,
      'The difference is total',
    ),

    h('Chunked and resumable uploads'),
    p(
      'A 4GB upload over a mobile connection **will** be interrupted. Multipart upload splits it into parts that are uploaded independently, retried individually, and assembled by the storage service.',
    ),
    diagram(
      `
   1. initiate            ──▶ uploadId
   2. split into parts        5 MB – 5 GB each, up to 10,000

      part 1 ──▶ S3  ✓ ETag-1
      part 2 ──▶ S3  ✗ retry ──▶ ✓ ETag-2   only this part
      part 3 ──▶ S3  ✓ ETag-3               is re-sent
      ...                                   (parallel, too)

   3. complete(uploadId, [ETags])  ──▶ one object

   ✓ resume after a disconnect
   ✓ parallel parts = faster on a fat link
   ✓ one bad part costs one part
   ✗ incomplete uploads occupy storage until aborted
     ──▶ a lifecycle rule to clean them up is MANDATORY
`,
      'Multipart, and the cleanup everyone forgets',
    ),
    warn(
      'Abandoned multipart uploads are **invisible and billable** — parts are stored but the object never appears in a listing. A lifecycle rule to abort incomplete uploads after a few days is a one-line config that prevents a slow, silent cost leak.',
    ),

    h('Securing the URL'),
    code(
      js(`
const url = await s3.getSignedUrl('putObject', {
  Bucket: 'user-media',
  // Server-chosen key. NEVER let the client name the object —
  // a client-supplied path can overwrite someone else's file.
  Key: \`u/\${user.id}/\${crypto.randomUUID()}\`,
  Expires: 900,
  ContentType: body.contentType,   // bound: cannot upload a script
  // Signing the length caps what the URL can be used for. Without
  // it, a 10 MB avatar URL uploads a 10 GB file.
  ContentLength: body.size,
});
`),
    ),
    table(
      ['Control', 'Prevents'],
      [
        ['**Server-generated key**', 'Overwriting another user\'s object'],
        ['**Short expiry**', 'A leaked URL being useful later'],
        ['**Signed content type**', 'Uploading HTML or a script to your domain'],
        ['**Signed content length**', 'An unbounded upload on a small quota'],
        ['**Quota checked before signing**', 'A user exceeding their allowance'],
        ['**A private bucket**', 'Anything being publicly readable by default'],
      ],
    ),

    h('Confirming and processing'),
    diagram(
      `
   DO NOT TRUST THE CLIENT

   client: "done!"  ──▶ ✗ it can lie, crash, or never come back

   INSTEAD

   S3 upload completes ──▶ S3 event ──▶ queue ──▶ workers
                                                    │
                            ┌───────────────────────┼─────────┐
                            ▼                       ▼         ▼
                      virus scan            thumbnails    metadata
                            │                       │         │
                            └───────────┬───────────┘         │
                                        ▼                     ▼
                                  mark READY  ◀───────────────┘
                                        │
                                        ▼
                                  visible to the user

   rows go in as PENDING at signing time and become READY here.
`,
      'The event is the source of truth',
    ),
    table(
      ['Stage', 'Why'],
      [
        ['**Validate**', 'The real content type, from magic bytes — not the extension'],
        ['**Scan**', 'User uploads are an attack vector'],
        ['**Transform**', 'Thumbnails, transcodes, compression'],
        ['**Strip metadata**', 'EXIF carries GPS coordinates — a genuine privacy leak'],
        ['**Deduplicate**', 'Key by content hash and identical files cost storage once'],
        ['**Mark ready**', 'Only now does it appear to the user'],
      ],
    ),
    tip(
      'Never trust the declared content type. A file named `.jpg` with `Content-Type: image/jpeg` can be anything at all — **check the magic bytes server-side**, and serve user content from a separate domain so a stored HTML file cannot run as your origin.',
    ),

    h('Serving'),
    table(
      ['Requirement', 'Approach'],
      [
        ['Public content', 'CDN with a long TTL; content-hash filenames'],
        ['Private content', '**Signed CDN URLs**, short expiry — not an app-server proxy'],
        ['Per-request authorisation', 'Signed cookie or edge function; still not through the app'],
        ['Different sizes', 'On-the-fly transform at the edge, cached per variant'],
        ['Cost control', 'Lifecycle to colder tiers; prune unused variants'],
      ],
    ),
    warn(
      'Proxying private downloads through your application to check permissions **reintroduces the original problem** — bytes back through your servers. Signed, short-lived CDN URLs give you authorisation without the traffic.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Accepting and serving large files without touching them'],
      ['Why it exists', 'A 4GB upload through an app server is a scaling ceiling'],
      ['Use when', 'Any user-uploaded media'],
      ['Trade-off', 'Direct upload is fast and cheap, and needs event-driven confirmation'],
      [
        '30-second answer',
        '"The client uploads straight to object storage with a presigned URL — server-chosen key, short expiry, and a signed content type and length so it cannot be abused. Large files use multipart so a dropped connection retries one part, with a lifecycle rule to clean up abandoned uploads. Completion comes from a storage event, never from the client, which triggers scanning, thumbnails and EXIF stripping before the row is marked ready. Serving is via CDN, with signed URLs for private content."',
      ],
    ]),
    asked([
      ['How does a presigned upload work?', 'The server signs a short-lived URL for one key, bound to a content type and size; the client uploads directly.'],
      ['How do you support resumable uploads?', 'Multipart — independent parts with their own retries, assembled by the storage service.'],
      ['How do you know the upload finished?', 'A storage event. The client can crash, lie, or simply not return.'],
      ['How do you serve private files?', 'Signed CDN URLs with a short expiry. Never proxy the bytes through your app.'],
      ['What security checks matter?', 'A server-chosen key, magic-byte type validation, virus scanning, EXIF stripping, and a separate domain for user content.'],
    ]),

    links(wiki('Object_storage', 'Object storage'), wiki('Exif', 'Exif')),
  ],
};
