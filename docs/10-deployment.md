# Deployment

**Hosting is AWS** ([ADR-0004](adr/ADR-0004-aws-hosting-and-environments.md), which supersedes ADR-0002's
deferral). Which AWS services run the application, the database, the jobs and
the backups is not decided yet (Q-063).

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

> Phase 4 introduces K-Payment merchant credentials (Q-033). Whatever is chosen
> must handle those without a developer ever seeing a production value.

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
- [ ] Security (phase 8) and backup (phase 9) complete before the maintenance notice comes off (D-198).
- [ ] Domain and DNS controlled by a known party (Q-053).
- [ ] TLS valid and renewing automatically.
- [ ] Backups running, and **a restore performed and timed**.
- [ ] The registered tax identification number in place (Q-025) — invoices are not legally correct without it.
- [ ] Transactional email sending from an authenticated domain (Q-032).
- [ ] The first Top-level Admin set with the `account-role` job (D-235); other staff signed up like customers and given a role in the back office. No second factor is asked (D-232).
- [ ] Every secret in the platform's secret store, none in the repository.
- [ ] Error tracking and alerting live, with someone actually receiving the alerts.
- [ ] Rollback rehearsed.
- [ ] Staff trained from the one combined Thai-language manual (D-086, Q-051), and acceptance signed off per `15-acceptance-criteria.md` by the client's owner, stage by stage (D-194).

## Undecided

| Area | Blocked on |
| :--- | :--- |
| Which AWS services, region and monthly cost | Q-063 — blocks stage 1 |
| Whether Cloudflare stays in front of AWS | Q-064 |
| Specific mail-relay provider and sending domain | Q-032 residual |
| Actual DNS/hosting account access | Q-053 residual — ownership is known (the project owner's father), access is not yet arranged |

**Resolved since the last revision:** backup strategy (D-088, Q-055);
Cloudflare scope and plan (D-087, Q-054); there is no BigSeller connection and
stock comes from Shopee (D-201); total budget is 100,000 THB in four payment
stages (D-193, Q-062); hosting is AWS (ADR-0004).
