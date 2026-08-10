/**
 * Prove that this box can actually talk to the bucket, and say which identity
 * it used to do it.
 *
 * This exists for the same reason ai/probe-providers.js does: everything
 * downstream is built on claims about something we do not control — that the
 * instance role is attached, that its policy covers the calls this app makes,
 * that the bucket is where the env says it is. Those claims are cheap to check
 * here and expensive to debug once they are under a multipart upload inside a
 * bulk endpoint that reports partial success and answers 201 either way.
 *
 * The round trip is real: it writes an object, reads it back, signs a URL,
 * fetches that URL and deletes the object. A probe that only resolved
 * credentials would pass on a box whose policy grants nothing.
 *
 * Run it on the EC2 instance after a deploy:
 *
 *   npm run s3:probe
 *   npm run s3:probe -- --multipart    # also exercise the >5MB path
 */

import { HeadObjectCommand, ListObjectsV2Command, S3Client } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { env } from '../../src/config/env.js';
import {
  deleteObject,
  headObject,
  keyFor,
  signedGetUrl,
  uploadObject,
} from '../../src/services/s3.service.js';

const WANT_MULTIPART = process.argv.includes('--multipart');

const ms = (start) => `${Math.round(Number(process.hrtime.bigint() - start) / 1e6)}ms`;

const pass = (label, detail) => console.log(`  ${'PASS'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);
const fail = (label, detail) => console.log(`  ${'FAIL'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);
const info = (label, detail) => console.log(`  ${'INFO'.padEnd(6)} ${label}${detail ? ` — ${detail}` : ''}`);

const problems = [];
const record = (label, error, hint) => {
  fail(label, error?.message || String(error));
  problems.push({ label, error, hint });
};

/* -------------------------------------------------------------------------- */
/* config                                                                      */
/* -------------------------------------------------------------------------- */

function checkConfig() {
  console.log('\nConfiguration');

  if (!env.s3.region) fail('AWS_REGION', 'not set');
  else pass('AWS_REGION', env.s3.region);

  if (!env.s3.bucket) fail('AWS_S3_BUCKET', 'not set');
  else pass('AWS_S3_BUCKET', env.s3.bucket);

  info('AWS_S3_PREFIX', env.s3.prefix);
  info('public base URL', env.s3.publicBaseUrl || 'unset (reads go through signed URLs)');

  if (!env.s3.configured) {
    // Worth being loud about: this is the failure that looks like a
    // credentials problem and is not. `.env` is gitignored and the deploy
    // pipeline only does `git pull`, so a box can run new code against an old
    // `.env` indefinitely.
    console.log(
      '\n  Storage reports itself unconfigured, so every upload endpoint will\n' +
        '  answer 503 STORAGE_DISABLED before a credential is ever requested.\n' +
        '  Add AWS_REGION and AWS_S3_BUCKET to server/.env on this box, then\n' +
        '  `pm2 restart dsa-api --update-env`.',
    );
    return false;
  }
  return true;
}

/* -------------------------------------------------------------------------- */
/* identity                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Which credentials the default chain resolved, and what that implies.
 *
 * The accessKeyId prefix is the tell, and it is the single most useful line
 * this probe prints. ASIA means short-lived STS credentials — the instance
 * role, which is the intended production path. AKIA means a long-lived IAM
 * user key found in the environment or ~/.aws/credentials, which on EC2 means
 * something is shadowing the role and should be removed.
 */
async function checkCredentials() {
  console.log('\nCredentials');

  // A bare client, built the same way the service builds its own: region only,
  // no `credentials` option, so this exercises the real default chain.
  const client = new S3Client({ region: env.s3.region });

  try {
    const started = process.hrtime.bigint();
    const creds = await client.config.credentials();
    const id = creds.accessKeyId || '';
    const temporary = Boolean(creds.sessionToken);

    pass('resolved', `${id.slice(0, 4)}…${id.slice(-4)} in ${ms(started)}`);

    if (id.startsWith('ASIA') && temporary) {
      pass('type', 'short-lived STS credentials (instance role or SSO)');
      if (creds.expiration) info('expires', new Date(creds.expiration).toISOString());
    } else if (id.startsWith('AKIA')) {
      fail('type', 'long-lived IAM user key — this shadows the instance role');
      problems.push({
        label: 'static keys present',
        hint:
          'Remove AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY from server/.env and the\n' +
          '      shell, and delete ~/.aws/credentials on this box. The chain checks\n' +
          '      those before IMDS, so the role is never reached while they exist.',
      });
    } else {
      info('type', temporary ? 'temporary credentials' : 'unrecognised key prefix');
    }
    return true;
  } catch (error) {
    record('resolved', error, 'no credential source on this host');
    return false;
  } finally {
    client.destroy();
  }
}

/**
 * The role name, straight from the instance metadata service.
 *
 * Best-effort and IMDSv2-first: a PUT for a token, then the role listing. Off
 * an EC2 instance this simply times out, which is not a failure — it is how a
 * laptop is expected to answer.
 */
async function checkInstanceRole() {
  const base = 'http://169.254.169.254';
  const signal = AbortSignal.timeout(1500);

  try {
    const tokenRes = await fetch(`${base}/latest/api/token`, {
      method: 'PUT',
      headers: { 'x-aws-ec2-metadata-token-ttl-seconds': '60' },
      signal,
    });
    if (!tokenRes.ok) {
      info('instance role', `IMDS answered ${tokenRes.status} to the token request`);
      return;
    }
    const token = await tokenRes.text();

    const roleRes = await fetch(`${base}/latest/meta-data/iam/security-credentials/`, {
      headers: { 'x-aws-ec2-metadata-token': token },
      signal: AbortSignal.timeout(1500),
    });
    if (!roleRes.ok) {
      info('instance role', 'IMDS reachable but no role attached');
      return;
    }
    const role = (await roleRes.text()).trim();
    pass('instance role', role || '(none)');
  } catch {
    info('instance role', 'IMDS not reachable — not an EC2 instance, or hop limit blocks it');
  }
}

/* -------------------------------------------------------------------------- */
/* round trip                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Write, read, sign, fetch, delete — through the service the app actually
 * uses, so a policy gap shows up here exactly as it would in a request.
 *
 * The key carries a random suffix and lives under a `_probe` folder so two
 * concurrent runs cannot collide and nothing lands where real assets are
 * listed. A PNG header is used because uploadObject sniffs the bytes and
 * refuses anything it cannot identify.
 */
async function checkRoundTrip() {
  console.log('\nRound trip');

  // Smallest valid PNG: signature, IHDR, one pixel, IEND.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );
  const key = keyFor('_probe', `probe-${process.pid}-${process.hrtime.bigint()}.png`);
  let uploaded = false;

  try {
    const started = process.hrtime.bigint();
    const asset = await uploadObject(png, { key, filename: 'probe.png' });
    uploaded = true;
    pass('PutObject', `${asset.bytes}B as ${asset.contentType} in ${ms(started)}`);
  } catch (error) {
    record('PutObject', error, 's3:PutObject on arn:aws:s3:::<bucket>/*');
    return;
  }

  try {
    const head = await headObject(key);
    pass('HeadObject', `${head.bytes}B, ${head.contentType}`);
  } catch (error) {
    record('HeadObject', error, 's3:GetObject on arn:aws:s3:::<bucket>/*');
  }

  try {
    const url = await signedGetUrl(key, { expiresIn: 60 });
    if (!url) throw new Error('signing returned null');
    pass('signed URL', 'generated');

    // Signing is local arithmetic — it succeeds even with credentials that
    // cannot read the object. Fetching is what proves the grant.
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (res.ok) pass('GET via signed URL', `${res.status}, ${res.headers.get('content-type')}`);
    else record('GET via signed URL', new Error(`${res.status} ${res.statusText}`), 's3:GetObject');
  } catch (error) {
    record('signed URL', error, 's3:GetObject on arn:aws:s3:::<bucket>/*');
  }

  if (uploaded) {
    // deleteObject swallows its own failures by design, so the delete is
    // confirmed by asking whether the object is still there.
    await deleteObject(key);
    try {
      await headObject(key);
      record(
        'DeleteObject',
        new Error('object still present after delete'),
        's3:DeleteObject on arn:aws:s3:::<bucket>/*',
      );
    } catch {
      pass('DeleteObject', 'object gone');
    }
  }
}

/**
 * ListBucket, which fails for a reason worth naming.
 *
 * s3:ListBucket is granted on the *bucket* ARN, not the object ARN. A policy
 * that lists only `arn:aws:s3:::bucket/*` passes every check above and denies
 * this one — which is why listObjects and deletePrefix break on a deployment
 * where uploads work fine.
 */
async function checkList() {
  console.log('\nBucket listing');
  const client = new S3Client({ region: env.s3.region });
  try {
    const result = await client.send(
      new ListObjectsV2Command({ Bucket: env.s3.bucket, Prefix: env.s3.prefix, MaxKeys: 5 }),
    );
    pass('ListObjectsV2', `${result.KeyCount ?? 0} key(s) under ${env.s3.prefix}/`);
  } catch (error) {
    record('ListObjectsV2', error, 's3:ListBucket on arn:aws:s3:::<bucket> (no /*)');
  } finally {
    client.destroy();
  }
}

/**
 * The multipart path, which needs permissions the single PUT does not.
 *
 * lib-storage switches to multipart above the part size, so every upload over
 * 5MB takes this path — a phone photo sits right on that line. A policy
 * missing AbortMultipartUpload passes every other check here and then fails
 * only on large files, which reads as an intermittent bug rather than a
 * permissions gap. Opt-in because it moves 6MB.
 */
async function checkMultipart() {
  console.log('\nMultipart (>5MB)');
  const client = new S3Client({ region: env.s3.region });
  const key = keyFor('_probe', `probe-multipart-${process.pid}.bin`);

  try {
    const started = process.hrtime.bigint();
    await new Upload({
      client,
      params: {
        Bucket: env.s3.bucket,
        Key: key,
        Body: Buffer.alloc(6 * 1024 * 1024, 0),
        ContentType: 'application/octet-stream',
        ServerSideEncryption: 'AES256',
      },
      partSize: 5 * 1024 * 1024,
      queueSize: 2,
    }).done();
    pass('multipart upload', `6MB in ${ms(started)}`);

    await client.send(new HeadObjectCommand({ Bucket: env.s3.bucket, Key: key }));
    pass('multipart object', 'readable');
  } catch (error) {
    record(
      'multipart upload',
      error,
      's3:PutObject, s3:AbortMultipartUpload and s3:ListMultipartUploadParts',
    );
  } finally {
    await deleteObject(key);
    client.destroy();
  }
}

/* -------------------------------------------------------------------------- */
/* run                                                                         */
/* -------------------------------------------------------------------------- */

console.log(`\nS3 storage probe — ${env.nodeEnv}`);

if (!checkConfig()) process.exit(1);

await checkInstanceRole();
const haveCredentials = await checkCredentials();

if (haveCredentials) {
  await checkRoundTrip();
  await checkList();
  if (WANT_MULTIPART) await checkMultipart();
  else console.log('\n  Skipping the >5MB multipart path — pass --multipart to include it.');
}

console.log('');

if (!problems.length) {
  console.log('All checks passed. Uploads on this box will work.\n');
  process.exit(0);
}

console.log(`${problems.length} check(s) failed:\n`);
for (const { label, hint } of problems) {
  console.log(`  ${label}`);
  if (hint) console.log(`      needs: ${hint}`);
}
console.log(
  '\nIf credentials resolved but calls were denied, the gap is in\n' +
    'MAANGPrepNodeAppS3Access, not in this application.\n',
);
process.exit(1);
