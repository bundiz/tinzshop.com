# ADR-0002: Hosting and deployment target

- **Status:** Proposed
- **Date:** 2026-09-09

## Context

ADR-0001 chose Next.js, TypeScript, PostgreSQL and Prisma. It deliberately did
not choose where any of that runs.

Deferring is the project owner's decision, taken on 2026-09-09: hosting is
settled at phase 7, when the system is being taken live, rather than now.
Until then `../10-deployment.md` records what the deployment must satisfy without
naming a provider.

The deferral is affordable because the application code is written against
the runtime interfaces in `../04-tech-stack-and-structure.md`, not against a
provider. It stops being affordable at phase 7, and two things make it worse
if left longer:

- Phase 9 requires automatic daily database backups. Backup and restore are a
  property of where the database lives, so phase 9 cannot be planned until this
  is answered (Q-055).
- Phase 8 puts Cloudflare in front of the site. What Cloudflare can usefully do
  depends on what the origin is, and on who controls DNS for tinzshop.com
  (Q-053, Q-054).

## Options considered

*None have been evaluated. This section is deliberately empty of conclusions.*

The space is open and includes, without preference: a managed platform with a
managed Postgres provider; a single virtual server in Thailand running the
application and database under a container runtime; and a split where the
application is managed and the database is not. Each must be written up here
against the criteria below before a choice is made.

## Criteria

### 1. Latency to Thai customers

The shop sells and ships within Thailand only (REQ-008). Every customer is in
one country, which is unusually favourable to a single well-placed origin.

Judge on: round-trip time from Bangkok to the origin, and whether static and
cached responses are served closer than that.

### 2. Scheduled and long-running work

Phase 5 may need a nightly BigSeller or Shopee file import (Q-043). Phase 3
needs outbound email. Neither fits inside a request.

Judge on: whether background jobs and cron are first-class, or need a second
service. An option that only runs request-scoped code fails this.

### 3. Backup and restore

Phase 9 requires automatic daily backups. A backup nobody has restored is not
a backup.

Judge on: backup automation, retention, and how long a full restore takes and
who can perform it. **Depends on Q-055** (retention and recovery targets).

### 4. Cost predictability

No budget is recorded anywhere in the source (Q-006).

Judge on: whether monthly cost is knowable in advance. Usage-based pricing
against an unknown budget is a risk that has to be stated, not discovered.

### 5. Operational load on two people

Two developers build and then run this.

Judge on: patching, TLS renewal, monitoring, log retention and on-call. Every
hour here is an hour not spent on phases 2 to 6.

### 6. Secret handling

Phase 4 introduces K-Payment merchant credentials.

Judge on: how environment secrets are stored, who can read them, and whether
they can be rotated without a redeploy. See `../08-security-testing.md`.

### 7. Cloudflare and DNS compatibility

Judge on: whether the origin can sit behind Cloudflare without fighting it.
**Depends on Q-053** (who controls DNS) and **Q-054** (Cloudflare scope).

## Decision

*Empty. Deferred to phase 7 by the project owner. No decision has been made.*

## Consequences

*Empty. To be completed when the decision is made.*
