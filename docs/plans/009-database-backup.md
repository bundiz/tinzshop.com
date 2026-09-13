# 009 — Database backup

- **Status:** Blocked — 2026-09-13
- **Phase:** 9
- **Dates (proposed):** 2027-02-24 → 2027-03-02, run alongside the tail of phase 7 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** none. Scope comes from D-088 instead.
- **Blocked by:** [ADR-0002](../adr/ADR-0002-hosting-and-deployment.md) — backup is a property of where the database lives
- **Depends on plan:** 007

## Goal

**Resolved (Q-055, D-088): a deliberately lightweight backup strategy.** Full
policy is in `../10-deployment.md#backup`: automatic daily backup, 30-day
rolling retention, one restore performed and timed before go-live, no
point-in-time recovery. Chosen because BigSeller already holds a secondary
record of transaction data and the 100,000 THB total budget does not justify a
deeper policy — recorded as revisitable, not permanent.

`02-scope-and-phases.md` now recommends running this phase alongside the tail
of phase 7 rather than strictly after go-live as the source's original
ordering implied, so the shop does not take a real order with no backup in
place — confirm this scheduling recommendation with the client alongside the
rest of the schedule.

## Unblock first

- [ ] ADR-0002 decided — backup is a property of where the database lives

## Build checklist

From `../10-deployment.md#backup`, once ADR-0002 is decided:

- [ ] Automatic daily backup of the full database, requiring no human action
- [ ] Backups stored where the loss of the primary system does not also destroy them
- [ ] Backups encrypted at rest
- [ ] 30-day rolling retention (D-088) — not indefinite; BigSeller is the fallback beyond this window
- [ ] No point-in-time recovery (D-088) — daily granularity is accepted given the budget
- [ ] Generated invoice PDFs covered too — the five-year retention rule (REQ-026) is not only a database concern; there is no payment-slip file to worry about (D-072)
- [ ] Alert on backup **failure**, and on a backup job that silently stopped running
- [ ] Restore procedure written down, in enough detail that the developer who did not write it can follow it

## Manual test checklist

- [ ] A backup runs automatically with no human action, and its success is visible.
- [ ] **A full restore is performed into a clean environment, and timed.** The time is written down here, and again in `../15-acceptance-criteria.md`'s phase 9 criteria.
- [ ] The restored database contains orders and invoices intact.
- [ ] Generated invoice PDFs are restored too, not only the database.
- [ ] Deliberately fail a backup job; the alert fires and reaches a person.
- [ ] Stop the backup job entirely; that is also detected, not merely the absence of a failure.
- [ ] The developer who did not write the procedure performs the restore by following it.

## Outcome

*Not started.*
