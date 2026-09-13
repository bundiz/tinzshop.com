# 007 — Testing, staff training, go live

- **Status:** Blocked — 2026-09-13
- **Phase:** 7
- **Dates (proposed):** 2027-02-10 → 2027-03-02 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** none new. This plan verifies everything already built, against `../15-acceptance-criteria.md`.
- **Blocked by:** [ADR-0002](../adr/ADR-0002-hosting-and-deployment.md); a named client approver for sign-off (Q-052 residual); actual DNS/hosting account access (Q-053 residual)
- **Depends on plans:** 002, 003, 004, 005, 006

## Goal

System testing, staff training, and going live.

**Hosting must be decided in this phase.** ADR-0002 deferred it here
deliberately, and it cannot be deferred further — phase 9's backup requirement
is a property of where the database lives.

**Resolved since the last revision:** training is one combined Thai-language
manual (Q-051, D-086); acceptance criteria are drafted per phase in
`../15-acceptance-criteria.md` (Q-052); backup retention targets are decided
(Q-055, D-088); domain/DNS ownership is known — the project owner's father —
though account access is not yet arranged (Q-053).

## Unblock first

- [ ] **ADR-0002 decided**, with options evaluated against its stated criteria
- [ ] Actual DNS/hosting account access arranged with the domain owner (Q-053 residual)
- [ ] A named approver for phase sign-off (Q-052 residual) — absent one, `../15-acceptance-criteria.md` defaults to the project owner signing off directly

## Build checklist

- [ ] Production environment created on whatever ADR-0002 chose
- [ ] Staging environment, with anonymised or synthetic data only — **never a copy of production** (`../10-deployment.md`)
- [ ] One artefact built and promoted forward, not rebuilt per environment
- [ ] Every secret in the platform's secret store, none in the repository
- [ ] TLS valid and renewing automatically
- [ ] Migrations applied as an observable step, never on application boot
- [ ] Error tracking and alerting live, with someone actually receiving the alerts
- [ ] Uptime checks on the storefront and the admin
- [ ] Rollback procedure written and **rehearsed**
- [ ] Backups running, with a restore performed and timed
- [ ] Staff accounts created with the second factor enforced
- [ ] One combined Thai-language training manual, covering all six roles (D-086)

## Manual test checklist

Go-live conditions, from `../10-deployment.md`:

- [ ] Every earlier plan's manual checklist has been run and passed, and its result recorded in that plan.
- [ ] The registered tax identification number is in place (Q-025). **Invoices are not legally correct without it.**
- [ ] Transactional email sends from an authenticated domain and reaches an inbox, not a spam folder.
- [ ] A full restore from backup has been performed on staging and timed, and the time is written down.
- [ ] A rollback has been performed on staging.
- [ ] A deliberate error is captured by error tracking and reaches a person.
- [ ] No secret appears in any build log, image or repository file.
- [ ] Staff can perform every task they are responsible for, unaided, after training.
- [ ] The four invariants pass under concurrency on the production configuration: no overselling, gap-free invoice numbers, correct VAT, permission enforcement (`../08-security-testing.md`).
- [ ] Acceptance signed off per `../15-acceptance-criteria.md`, by a named approver where one exists (Q-052 residual).

## Outcome

*Not started.*
