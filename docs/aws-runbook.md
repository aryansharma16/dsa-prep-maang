# AWS runbook

How to bring storage up on the instance, prove it works, and diagnose it when
it does not. The inventory of what exists — bucket, role, policy, instance —
is in [aws-infrastructure.md](./aws-infrastructure.md).

---

## First-time setup on the instance

Everything on the AWS side is already in place. The one step the deployment
pipeline cannot do for you is `server/.env`: it is gitignored, the workflow
only runs `git pull`, and so the file on the box is whatever was last
hand-edited there. **A box running new code against an old `.env` is the most
common way this fails**, and it fails as a 503 `STORAGE_DISABLED` rather than
anything mentioning credentials.

SSH in and add the two variables once:

```bash
ssh -i /path/to/dsa-backend-key.pem ubuntu@13.204.111.119
cd ~/dsa-prep-maang/server

# Check first — do not blindly append duplicates.
grep -E '^AWS_' .env || echo "not set"

# If missing:
printf '\nAWS_REGION=ap-south-1\nAWS_S3_BUCKET=maang-prep-580912381247-ap-south-1-an\nAWS_S3_PREFIX=maang-prep\n' >> .env

pm2 restart dsa-api --update-env
```

Do **not** add `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` or
`AWS_SESSION_TOKEN`. The credential chain checks environment variables before
the instance metadata service, so any of those would shadow
`MAANGPrepEC2S3Role` and replace an auto-rotating credential with a permanent
one sitting in a file.

---

## Verify

```bash
cd ~/dsa-prep-maang/server
npm run s3:probe               # config, identity, and a real round trip
npm run s3:probe -- --multipart  # also exercises the >5MB path (moves 6MB)
```

The probe
([scripts/s3/probe-storage.js](../server/scripts/s3/probe-storage.js)) writes a
real object, reads it back, signs a URL, fetches that URL and deletes the
object — so a policy gap shows up here exactly as it would in a user's request.
A healthy instance prints:

```
Configuration
  PASS   AWS_REGION — ap-south-1
  PASS   AWS_S3_BUCKET — maang-prep-580912381247-ap-south-1-an
  INFO   AWS_S3_PREFIX — maang-prep
  PASS   instance role — MAANGPrepEC2S3Role

Credentials
  PASS   resolved — ASIA…XXXX in 12ms
  PASS   type — short-lived STS credentials (instance role or SSO)

Round trip
  PASS   PutObject / HeadObject / signed URL / GET / DeleteObject

Bucket listing
  PASS   ListObjectsV2
```

The line that matters most is **`type`**. `ASIA` with a session token means the
instance role — the intended path. `AKIA` means a long-lived IAM user key was
found first and is shadowing the role; find and remove it.

The AWS CLI gives a second opinion if the probe is ambiguous:

```bash
aws sts get-caller-identity          # should show .../MAANGPrepEC2S3Role/i-0516334dee3b88a7b
aws s3 ls s3://maang-prep-580912381247-ap-south-1-an/maang-prep/
```

---

## Local development with SSO

A laptop has no instance role, and this project issues no IAM user keys — so
without this, every local upload fails with *"Could not load credentials from
any providers"* and attachments can only be tested on EC2.

IAM Identity Center fixes that with short-lived credentials from the same
provider chain production uses. Nothing permanent is written to disk, no IAM
user is created, and no application code changes.

**One-time, in the console** (Identity Center is a global service configured
from a single region — pick `ap-south-1`):

1. **IAM Identity Center → Enable.** If the account is not in an Organization
   it will offer to create one; accept.
2. **Permission sets → Create.** Custom permission set, and attach the same
   customer-managed policy the instance role uses — `MAANGPrepNodeAppS3Access`
   — so local development cannot reach anything production cannot. Set the
   session duration to 8 hours. Name it `MAANGPrepS3Dev`.
3. **Users → Add user.** Your email; accept the invitation from your inbox.
4. **AWS accounts → select account `580912381247` → Assign users.** Pick that
   user and the `MAANGPrepS3Dev` permission set.
5. Note the **AWS access portal URL** on the Identity Center dashboard — it
   looks like `https://d-xxxxxxxxxx.awsapps.com/start`.

**One-time, on the laptop.** The AWS CLI is not currently installed:

```bash
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscli.zip
unzip -q /tmp/awscli.zip -d /tmp && sudo /tmp/aws/install
aws --version

aws configure sso
#   SSO session name        : maang
#   SSO start URL           : <the access portal URL from step 5>
#   SSO region              : ap-south-1
#   SSO registration scopes : <press enter for the default>
#   ...browser opens, approve...
#   CLI default client Region : ap-south-1
#   CLI profile name          : maang-prep
```

Then add the profile to your **local** `server/.env` — not the one on EC2:

```bash
AWS_PROFILE=maang-prep
AWS_REGION=ap-south-1
AWS_S3_BUCKET=maang-prep-580912381247-ap-south-1-an
```

Verify, then restart the dev server so it picks up the new `.env`:

```bash
aws sts get-caller-identity --profile maang-prep
cd server && npm run s3:probe
```

The probe should report `type — short-lived STS credentials (instance role or
SSO)`. **Daily thereafter**, the session expires and uploads start failing
again; renew with:

```bash
aws sso login --profile maang-prep
```

That expiry is the point — it is what makes this safe to have on a laptop.

## Diagnosing a failed upload

Work down this table by the error the API actually returned — the codes
distinguish causes that otherwise look identical from the browser.

| Symptom | Cause | Fix |
|---|---|---|
| 503 `STORAGE_DISABLED` | `AWS_REGION` or `AWS_S3_BUCKET` missing from `server/.env` on the box | [First-time setup](#first-time-setup-on-the-instance) above |
| `Could not load credentials from any providers` | The chain found nothing. On EC2: role detached, or IMDS unreachable. On a laptop: expected — there is no local credential | Check the instance's IAM role is attached; run the probe |
| 502 `STORAGE_FORBIDDEN` / `AccessDenied` | Policy gap | Compare `MAANGPrepNodeAppS3Access` against [the policy in the inventory](./aws-infrastructure.md#iam-policy-maangprepnodeapps3access) |
| Small files upload, files over ~5MB fail | Missing multipart permissions | Add `s3:AbortMultipartUpload` and `s3:ListMultipartUploadParts` |
| Uploads work but listing fails | `s3:ListBucket` granted on `bucket/*` instead of the bucket ARN | Grant bucket actions on `arn:aws:s3:::<bucket>` with **no** `/*` |
| 400 `BAD_FILE_TYPE` on an iPhone photo | HEIC is rejected by the multer filter before it reaches S3 | See [the known issue](./aws-infrastructure.md#heic-is-accepted-by-s3-and-rejected-by-the-upload-filter) |
| 400 `FILE_TOO_LARGE` | Over the route's per-file cap (25MB for task attachments) | Expected; raise the route limit only with the [memory ceiling](./aws-infrastructure.md#memory-ceiling) in view |
| Process restarts mid-upload | OOM on a 1 GiB instance | See [memory ceiling](./aws-infrastructure.md#memory-ceiling) |
| 201 with empty `assets` and a populated `failed[]` | Not a transport error — every file failed individually. The reason is in `failed[].error` | Read that message and re-enter this table with it |

That last row is worth understanding, because it is how the original failure
presented. The bulk endpoint treats partial success as a normal outcome —
39 of 40 files landing should not fail the request — so `uploadMany` records
per-file errors and never throws, and the controller answers 201 regardless.
When *every* file fails, the response is a 201 that looks like success. Check
`failed[]` before concluding an upload worked.

### Reading the logs

```bash
pm2 logs dsa-api --lines 100
pm2 logs dsa-api --err --lines 100
pm2 describe dsa-api            # restarts, uptime, memory
pm2 restart dsa-api --update-env
```

A climbing restart count with no deploy points at OOM.

---

## Outstanding one-time tasks

Confirmed against the console on 10 August 2026. None is urgent; the first two
are minutes of work and prevent expensive outcomes.

- [ ] **Add `AWS_REGION` / `AWS_S3_BUCKET` to `server/.env` on the box.**
      Nothing works until this is done. See above.
- [ ] **Enable termination protection** on `i-0516334dee3b88a7b`. It is
      currently off, and `server/.env` — Mongo URI, both JWT secrets, every AI
      key — exists nowhere else. Actions → Instance settings → Change
      termination protection.
- [ ] **Back up `server/.env`** to a password manager. Same reason.
- [ ] **Add the lifecycle rule** for incomplete multipart uploads (below). The
      bucket currently has no lifecycle rules at all.
- [ ] **Verify certificate renewal** — `sudo certbot renew --dry-run`. Port 80
      is closed, which breaks the HTTP-01 challenge.

## Routine maintenance

**Add a lifecycle rule for incomplete multipart uploads.** The bucket has none
today. Failed uploads over 5MB leave parts that are invisible in the object
list and billed indefinitely. S3 Console → the bucket → Management → Lifecycle
rules → create a rule that deletes incomplete multipart uploads after 7 days.

**Watch for OOM restarts.** EC2 does not report guest memory to CloudWatch at
any monitoring level, so the 1 GiB ceiling is invisible from the console. PM2's
restart counter is the only signal you currently have:

```bash
pm2 describe dsa-api | grep -E 'restarts|memory'
```

A climbing count with no deploy in between means the process is being killed.

**Sweep orphaned objects.** Every failure path in the storage layer resolves
toward an orphan rather than a dangling reference — bytes without a Mongo row,
never a row pointing at bytes that are gone. That is the correct trade (an
orphan costs pennies, a broken link breaks a page), but it means orphans
accumulate and nothing removes them automatically.

**Probe after any policy change.** `npm run s3:probe -- --multipart` on the box
is the fastest confirmation that a policy edit did what was intended.

---

## Security follow-ups

Neither is urgent, both are real. Detail in
[the inventory](./aws-infrastructure.md#security-group-rules).

- **Port 22 is open to `0.0.0.0/0`** so GitHub Actions can deploy. Confirm
  password authentication is disabled; consider narrowing to
  [GitHub's Actions IP ranges](https://api.github.com/meta), or moving the
  deploy to AWS Systems Manager Session Manager, which needs no inbound rule.
- **Port 80 is closed**, so a Let's Encrypt HTTP-01 renewal will fail silently.
  Verify how the certificate renews before it next expires — `certbot renew
  --dry-run` on the box answers this in one command.
