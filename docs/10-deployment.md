# Deployment

**Hosting is AWS** ([ADR-0004](adr/ADR-0004-aws-hosting-and-environments.md), which supersedes ADR-0002's
deferral). File storage is Amazon S3 in `ap-southeast-7` (D-274, *File
storage* below). Which AWS services run the application, the database, the
jobs and the backups is not decided yet (Q-063).

This document records **what the deployment must satisfy**. Every statement
here applies to whichever AWS services Q-063 picks. When it is answered, this
document gains the concrete procedure — it does not get rewritten.

## Provider independence

**Application code is written against runtime interfaces, never against a
provider's SDK (D-050).** This is what makes the deferral affordable rather
than merely postponed.

Concretely:

- File storage is reached through one interface in `src/server/adapters/`, not through a vendor client scattered across the codebase.
- Background work is queued through one interface. Whether that is a platform primitive, a worker process or a cron job is a deployment detail.
- Configuration comes from environment variables through the single Zod-validated config module (`04-tech-stack-and-structure.md`), never from a provider-specific runtime object.
- Nothing depends on a filesystem persisting between requests. Uploaded slips and generated PDFs go to storage, never to local disk.

Breaking any of these ties the domain code to one provider's SDK (D-050).

## Environments

Three, and only three:

| Environment | Purpose | Data |
| :--- | :--- | :--- |
| **Local** | Development | Seed data only. Never real customer data, never a real tax id or merchant id |
| **DEV** (`dev.tinzshop.com`) | Review, each payment stage's UAT, staff training, integration testing against provider sandboxes (D-190, D-194) | Anonymised or synthetic. Never a copy of production |
| **PROD** (`tinzshop.com`) | The live site: news and the maintenance notice from stage 1, the full shop from stage 4 (D-192) | Real |

**DEV never holds a copy of PROD.** Real customer names, addresses and phone
numbers fall under PDPA, and a test environment is by definition the less
carefully guarded one.

Every environment runs the same build artefact, configured differently. A
build that behaves differently in production is a build nobody tested.

## Release

The flow is fixed by D-191: feature branches merge into `develop` by pull
request, a merge into `develop` deploys to DEV automatically, and a merge into
`main`, made only after DEV passes, deploys to PROD automatically.

Requirements, whatever pipeline implements that flow:

1. **`main` is always deployable.** It is protected, and reached only by pull request (`09-coding-guidelines.md`).
2. **Nothing merges that has not passed** typecheck, lint, unit tests, integration tests against a real PostgreSQL, and a dependency vulnerability audit.
3. **One artefact promoted forward.** The thing tested on DEV is the thing that reaches production, not a rebuild of the same commit.
4. **Deployment is one command or one button**, and is repeatable by either developer. A release that only one person knows how to perform is a single point of failure with a name.
5. **Rollback is possible and has been rehearsed.** "We would just deploy the previous commit" is not a rollback plan until someone has done it.
6. **Zero-downtime for application releases.** The shop does not stop selling to ship a change.
7. **Every release is recorded** — what commit, when, by whom, and what changed.

## Database migrations

Migrations are forward-only and reviewed as SQL (`05-database.md`, D-015).

- **Never generated during deployment.** The migration that runs in production is the file that was reviewed in a pull request.
- Applied as a separate, observable step, not silently on application boot.
- Backward-compatible for one release: the old application version must keep working against the new schema, because during a zero-downtime release both are running.
- A destructive change is three releases — stop writing, stop reading, drop.
- **Backed up immediately before, and the backup verified as restorable** before the migration runs.

## Configuration and secrets

- Every variable the application reads is declared in `.env.example` with a placeholder and a comment naming who supplies it.
- Real values exist only in the deployment platform's secret store. **Never in the repository, never in a build log, never in an image, never in a message.**
- Rotatable without a code change and without a rebuild.
- Readable by as few people as possible, and it is recorded who those people are.
- The application validates its whole configuration at boot and refuses to start on a missing or malformed value. Failing at boot is a deploy that did not happen; failing lazily is a payment that did not work.
  - **Exception today (D-282):** the application has no start-up hook yet (each setting is read on first use, so `next build` needs no environment), and `MEDIA_PUBLIC_BASE_URL` fails soft instead: a malformed value is treated as unset on pages and refuses uploads, as described under *File storage*. When a start-up check is added with the hosting (Q-063), it should refuse a malformed media setting there too.

> Phase 4 introduces K-Payment merchant credentials (Q-033). Whatever is chosen
> must handle those without a developer ever seeing a production value.

## File storage

**Resolved (project owner, 2026-11-18; D-274 to D-276): Amazon S3 in
`ap-southeast-7`** (Asia Pacific (Thailand)), regional endpoint
`https://s3.ap-southeast-7.amazonaws.com`. This is the storage part of Q-063
only; what runs the application, the database and the jobs is still open.
Today the bucket holds the news images staff upload (plan 017, approved by
the owner and built on 2026-11-18; its manual checks are still to be run).

**One bucket per environment (D-275).** DEV and PROD never share a bucket,
for the same reason DEV never holds a copy of PROD. The application reaches a
bucket only through `src/server/adapters/s3/` (D-050) and finds it through
three settings, which every environment's configuration uses with exactly
these names (placeholders in `.env.example`):

| Variable | Holds |
| :--- | :--- |
| `MEDIA_S3_BUCKET` | The environment's bucket name (not a secret, but not committed either) |
| `MEDIA_S3_REGION` | `ap-southeast-7` |
| `MEDIA_PUBLIC_BASE_URL` | The address image keys are appended to: `https://<bucket>.s3.ap-southeast-7.amazonaws.com` today, a CloudFront address if one is put in front later (D-277). https only, with no query, fragment, user or password; one trailing `/` is removed. Unset or empty turns image uploads off in the editor and leaves uploaded images out of pages. **Malformed is treated as unset (D-282):** pages still draw, with uploaded body images left out and an uploaded cover not drawn (a news card falls back to the design's gradient), exactly as when it is unset; imported images, which carry their own URL, are unaffected; the server logs `Invalid server configuration, treated as unset` once per process, naming the variable and never its value |

Credentials are not settings: the AWS SDK finds them itself. On a developer's
machine that is `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` in `.env`,
the DEV IAM user's key. On AWS, once Q-063 picks the compute, it is an IAM
role and no key exists at all — the intended direction for PROD, not yet a
fact about hosting.

**Who can read what (D-276).** Readers fetch images straight from the bucket.
Only the `news/` prefix is public, through a bucket policy; nothing else in
the bucket is readable without credentials, nobody can list the bucket, and no
object carries an ACL.

### Setting up the DEV bucket

Done once, by the project owner, in the AWS console. `<dev-media-bucket>` is
a placeholder: the real name goes in `.env` only.

1. **Region.** Work in Asia Pacific (Thailand) `ap-southeast-7`. If the console lists the region as not enabled for the account, enable it first.
2. **Create the bucket.** General purpose, name `<dev-media-bucket>`, region `ap-southeast-7`.
   - *Object Ownership:* **ACLs disabled (bucket owner enforced).**
   - *Block Public Access:* keep **on** "Block public access … granted through new access control lists (ACLs)" and "… through any access control lists (ACLs)"; turn **off** "… through new public bucket or access point policies" and "… through any public bucket or access point policies". These two are the only relaxation, and only so the bucket policy in step 3 can take effect.
   - *Default encryption:* leave the default (S3-managed keys).
   - *Versioning:* leave off on DEV; for PROD this waits on Q-071.
3. **Bucket policy** (Permissions → Bucket policy): public read of `news/*` and nothing else.

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadNewsImages",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::<dev-media-bucket>/news/*"
       }
     ]
   }
   ```

4. **No CORS configuration.** Browsers only display the images (`<img>`, which needs no CORS); uploads go through the application's server, not from the browser to S3 (D-278). If D-278 changes to a browser upload, a CORS rule is added here then.
5. **The IAM user `tinzshop-dev`** (IAM → Users): no console access. Attach an **inline** policy, on this bucket only:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "ListMediaBucket",
         "Effect": "Allow",
         "Action": "s3:ListBucket",
         "Resource": "arn:aws:s3:::<dev-media-bucket>"
       },
       {
         "Sid": "ReadWriteMediaObjects",
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::<dev-media-bucket>/*"
       }
     ]
   }
   ```

   Plan 017's application code only writes (`s3:PutObject`); reading back, listing and deleting are there for checks by hand and for a later clean-up job (D-279).
6. **Access key.** Create one access key for `tinzshop-dev` and put it in `.env` as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`. It never goes into the repository, a chat, a screenshot or a log; if it ever does, deactivate it and make a new one.
7. **Settings.** In `.env`: `MEDIA_S3_BUCKET=<dev-media-bucket>`, `MEDIA_S3_REGION=ap-southeast-7`, `MEDIA_PUBLIC_BASE_URL=https://<dev-media-bucket>.s3.ap-southeast-7.amazonaws.com`. All three are read again on every upload and the base URL on every page, so a corrected value takes effect without a restart. With the base URL set, a missing or malformed bucket, region or base URL refuses the upload with "การตั้งค่าที่เก็บรูปไม่ถูกต้อง" (`admin.news.error.imageMisconfigured`) and logs `news.image_upload` with the outcome `misconfigured` and the variable's name, never its value (D-282).

### The PROD bucket

Its own bucket with the same steps 1 to 4. Instead of steps 5 and 6, the same
policy is attached to the IAM role of whatever runs the application, once
Q-063 decides it; until then there is no PROD bucket. Whether PROD's role is
narrowed to `s3:PutObject` on `news/*` only is Q-072. Its backup is Q-071, and
its monthly cost goes in the client's running-cost sheet (D-200).

## Backup

**Resolved (Q-055, D-088): a deliberately lightweight strategy**, chosen
because BigSeller already holds a secondary record of transaction data and the
100,000 THB total budget does not justify a deeper policy. This is recorded as
revisitable — it is a working decision for launch, not a permanent one.

- Automatic **daily** backup of the full database, requiring no human action.
- **30-day rolling retention.** Past that window, BigSeller's own transaction record is treated as the fallback rather than paying to keep a second copy indefinitely.
- Backups stored somewhere the loss of the primary system does not also destroy, and encrypted at rest.
- **One restore performed and timed before go-live**, and written down in `15-acceptance-criteria.md`'s phase 9 criteria. A backup nobody has restored is not a backup; it is a file.
- **No point-in-time recovery.** Daily granularity is accepted as sufficient given the budget and BigSeller's secondary record.

Documents under the five-year retention rule (REQ-026) are not only a database
concern: generated invoice PDFs are files, and the backup story has to cover
them too. There is no payment-slip file to worry about — bank transfer is
removed (D-072).

This is a project-side proposal, matching the client's instruction to "propose
a reasonable backup strategy" (Q-055) — it should be confirmed rather than
assumed, the same as the schedule in `02-scope-and-phases.md`.

## Observability

Minimum to run this without guessing:

| Need | Why |
| :--- | :--- |
| Application logs, retained and searchable | `08-security-testing.md` defines what may and may not be logged |
| Error tracking with alerting | A failed payment webhook that nobody notices is money |
| Uptime check on the storefront and the admin | — |
| Database health: connections, slow queries, disk | Overselling and lock contention appear here first |
| Backup success or failure, alerted on failure | A backup job that silently stopped is the classic failure |

> **No availability, performance or load target exists anywhere in the source.**
> Nothing here may be presented as an SLA. The list is what is needed to
> operate; the targets are a conversation with the client that has not
> happened.

## Cloudflare

**Resolved (Q-054, D-087): Cloudflare Free**, scoped to security and bot
protection (WAF managed rules, bot fight mode, DNS proxying). No paid tier
without a future justified need. Configuration still cannot be written until
DNS access exists — the domain owner is known (Q-053: the project owner's
father) but account access is not yet arranged.

Phase 8 is delivered in stage 4, before ordering opens (D-198). Whether
Cloudflare is still the tool now that hosting is AWS is Q-064.

## Going live

Phase 7. Not a checklist to write now — most of it depends on decisions not
yet made — but these must be true before the shop takes a real order:

- [ ] PROD running on AWS (ADR-0004), on the services Q-063 picks.
- [ ] The PROD media bucket set up as in *File storage*, reached through an IAM role rather than an access key (D-275), and the imported news images copied into it before the old site is shut down (D-127).
- [ ] Security (phase 8) and backup (phase 9) complete before the maintenance notice comes off (D-198).
- [ ] Domain and DNS controlled by a known party (Q-053).
- [ ] TLS valid and renewing automatically.
- [ ] Backups running, and **a restore performed and timed**.
- [ ] The registered tax identification number in place (Q-025) — invoices are not legally correct without it.
- [ ] Transactional email sending from an authenticated domain (Q-032).
- [ ] The first Top-level Admin set with the `account-role` job (D-235; it refuses once an unblocked Top-level Admin exists); other staff signed up like customers and given a role in the back office. No second factor is asked (D-232).
- [ ] Every secret in the platform's secret store, none in the repository.
- [ ] Error tracking and alerting live, with someone actually receiving the alerts.
- [ ] Rollback rehearsed.
- [ ] Staff trained from the one combined Thai-language manual (D-086, Q-051), and acceptance signed off per `15-acceptance-criteria.md` by the client's owner, stage by stage (D-194).

## Undecided

| Area | Blocked on |
| :--- | :--- |
| Which AWS services, region and monthly cost, apart from file storage | Q-063 — blocks stage 1 |
| Whether and how the PROD images are backed up | Q-071 |
| Whether Cloudflare stays in front of AWS | Q-064 |
| Specific mail-relay provider and sending domain | Q-032 residual |
| Actual DNS/hosting account access | Q-053 residual — ownership is known (the project owner's father), access is not yet arranged |

**Resolved since the last revision:** backup strategy (D-088, Q-055);
Cloudflare scope and plan (D-087, Q-054); there is no BigSeller connection and
stock comes from Shopee (D-201); total budget is 100,000 THB in four payment
stages (D-193, Q-062); hosting is AWS (ADR-0004); file storage is Amazon S3 in
`ap-southeast-7` (D-274 to D-276).
