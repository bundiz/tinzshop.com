# 009 — Database backup

- **Status:** Blocked — 2026-09-10
- **Phase:** 9
- **Requirements delivered:** none. **No requirement exists for this phase.**
- **Blocked by:** Q-055, and [ADR-0002](../adr/ADR-0002-hosting-and-deployment.md)
- **Depends on plan:** 007

## Goal

Automatic daily database backup.

No requirement has been written, because retention and recovery targets are
exactly what a backup requirement would state and the client has stated
neither. What any candidate must provide is in `../10-deployment.md`.

**Note the ordering.** This phase sits after go-live in the source, which means
the shop would take real orders with no backup in place. Worth raising with the
client alongside plan 008 — it is the same observation.

## Unblock first

- [ ] **How far back must a restore reach?** A corrupted import noticed a week later is the realistic case, not a disk failure noticed immediately — Q-055
- [ ] **How quickly must a restore complete?** — Q-055
- [ ] Whether point-in-time recovery is required — Q-055
- [ ] ADR-0002 decided — backup is a property of where the database lives
- [ ] Who is responsible for checking backups succeeded, and who performs a restore — Q-053

## Build checklist

From `../10-deployment.md`, once ADR-0002 is decided:

- [ ] Automatic daily backup of the full database, requiring no human action
- [ ] Backups stored where the loss of the primary system does not also destroy them
- [ ] Backups encrypted at rest
- [ ] Retention set to whatever Q-055 establishes — **not a guessed default**
- [ ] Point-in-time recovery, if Q-055 requires it
- [ ] Generated invoice PDFs and uploaded payment slips covered too — the five-year retention rule (REQ-026) is not only a database concern
- [ ] Alert on backup **failure**, and on a backup job that silently stopped running
- [ ] Restore procedure written down, in enough detail that the developer who did not write it can follow it

## Manual test checklist

- [ ] A backup runs automatically with no human action, and its success is visible.
- [ ] **A full restore is performed into a clean environment, and timed.** The time is written down here.
- [ ] The restored database contains orders, invoices and audit rows intact.
- [ ] Uploaded payment slips and generated invoice PDFs are restored too, not only the database.
- [ ] The restore meets whatever recovery time Q-055 established.
- [ ] Deliberately fail a backup job; the alert fires and reaches a person.
- [ ] Stop the backup job entirely; that is also detected, not merely the absence of a failure.
- [ ] The developer who did not write the procedure performs the restore by following it.

## Outcome

*Not started.*
