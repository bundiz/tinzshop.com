# Deployment

**No hosting provider has been chosen.** That is deliberate:
[ADR-0002](adr/ADR-0002-hosting-and-deployment.md) defers the decision to
phase 7 by the project owner's choice.

This document therefore records **what the deployment must satisfy**, not
where it runs. Every statement here is a requirement any candidate must meet,
and together they are the criteria ADR-0002 will be judged against.

> Nothing here may be read as naming a provider. When ADR-0002 is decided, this
> document gains the concrete procedure — it does not get rewritten.

## Provider independence

**Application code is written against runtime interfaces, never against a
provider's SDK (D-050).** This is what makes the deferral affordable rather
than merely postponed.

Concretely:

- File storage is reached through one interface in `src/server/adapters/`, not through a vendor client scattered across the codebase.
- Background work is queued through one interface. Whether that is a platform primitive, a worker process or a cron job is a deployment detail.
- Configuration comes from environment variables through the single Zod-validated config module (`04-tech-stack-and-structure.md`), never from a provider-specific runtime object.
- Nothing depends on a filesystem persisting between requests. Uploaded slips and generated PDFs go to storage, never to local disk.

Breaking any of these turns ADR-0002 from a decision into a migration.

## Environments

Three, and only three:

| Environment | Purpose | Data |
| :--- | :--- | :--- |
| **Local** | Development | Seed data only. Never real customer data, never a real tax id or merchant id |
| **Staging** | Review, staff training (phase 7), integration testing against provider sandboxes | Anonymised or synthetic. Never a copy of production |
| **Production** | The live shop | Real |

**Staging never holds a copy of production.** Real customer names, addresses,
phone numbers and payment slips fall under PDPA (REQ-046), and a staging
environment is by definition the less carefully guarded one.

Every environment runs the same build artefact, configured differently. A
build that behaves differently in production is a build nobody tested.

## Release

Requirements, whatever pipeline eventually implements them:

1. **`main` is always deployable.** It is protected, and reached only by pull request (`09-coding-guidelines.md`).
2. **Nothing merges that has not passed** typecheck, lint, unit tests, integration tests against a real PostgreSQL, and a dependency vulnerability audit.
3. **One artefact promoted forward.** The thing tested on staging is the thing that reaches production, not a rebuild of the same commit.
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

`02-scope-and-phases.md` now recommends running phase 8 alongside the tail of
phase 7 rather than strictly after go-live, so the site does not launch
without Cloudflare in place — a scheduling recommendation, not yet confirmed
by the client.

## Going live

Phase 7. Not a checklist to write now — most of it depends on decisions not
yet made — but these must be true before the shop takes a real order:

- [ ] ADR-0002 decided, and production actually running on it.
- [ ] Domain and DNS controlled by a known party (Q-053).
- [ ] TLS valid and renewing automatically.
- [ ] Backups running, and **a restore performed and timed**.
- [ ] The registered tax identification number in place (Q-025) — invoices are not legally correct without it.
- [ ] Transactional email sending from an authenticated domain (Q-032).
- [ ] Staff accounts created with the second factor enforced (REQ-032).
- [ ] Every secret in the platform's secret store, none in the repository.
- [ ] Error tracking and alerting live, with someone actually receiving the alerts.
- [ ] Rollback rehearsed.
- [ ] Staff trained from the one combined Thai-language manual (D-086, Q-051), and acceptance signed off per `15-acceptance-criteria.md` by a named approver (Q-052 residual — nobody has been named yet).

## Undecided

| Area | Blocked on |
| :--- | :--- |
| Hosting, runtime, region | [ADR-0002](adr/ADR-0002-hosting-and-deployment.md) — phase 7 |
| Specific mail-relay provider and sending domain | Q-032 residual |
| Actual DNS/hosting account access | Q-053 residual — ownership is known (the project owner's father), access is not yet arranged |

**Resolved since the last revision:** backup strategy (D-088, Q-055);
Cloudflare scope and plan (D-087, Q-054); stock-import mechanism is a daily
file, not a live API (D-081, Q-043); total budget is 100,000 THB (D-090,
Q-006).
