# ADR-0004: AWS hosting, two environments, and automatic deployment

- **Status:** Accepted
- **Date:** 2026-11-14
- **Supersedes:** [ADR-0002](ADR-0002-hosting-and-deployment.md), which deferred the hosting decision to phase 7
- **Decided by:** the project owner, 2026-11-14

## Context

ADR-0002 deferred hosting to phase 7. Two things changed that deferral.

1. **The client wants the old website shut down early.** The old site costs
   money every month, and new game news is waiting to be published but cannot
   be published on the old site. The client wants `tinzshop.com` to serve
   the new news section before the end of 2026. A site that is live in
   December cannot wait for a hosting decision in February.
2. **AWS is already in use.** Customer login (plan 014, on its own branch)
   runs on Amazon Cognito and sends email through Amazon SES. Running the
   application somewhere else would split the system across two providers.

## Decision

1. **The application and its database run on AWS.** Which AWS services run
   the application, the database, the scheduled jobs and the backups is
   **not decided here** (Q-063). This ADR does not name an AWS service.
2. **There are two hosted environments.**

   | Environment | Address | Purpose |
   | :--- | :--- | :--- |
   | **PROD** | `tinzshop.com` | The live site. From payment stage 1 it shows the news section and a maintenance notice saying the shop is being rebuilt, cannot take orders yet, and points customers to the shop's other sales channels (REQ-057). Ordering opens at payment stage 4. |
   | **DEV** | `dev.tinzshop.com` | Development and testing. The client runs each payment stage's UAT checklist here before signing off (D-194). |

3. **Branches and deployment flow.**
   1. A developer branches off `develop` with a `<type>/<short-description>` branch.
   2. The branch merges into `develop` by pull request.
   3. A merge into `develop` deploys to **DEV** automatically.
   4. When DEV has been tested and passes, `develop` merges into `main` by pull request.
   5. A merge into `main` deploys to **PROD** automatically.

   `main` stays protected and is reached only by pull request. `develop` is
   protected the same way.

## Options considered

The project owner chose AWS directly. The criteria in ADR-0002 were **not**
scored option by option in writing before the choice. Not doing that is part
of this decision, not something left out by accident. The two reasons in
*Context* decided it: the early launch date and the Cognito dependency that
already exists.

## Consequences

- `10-deployment.md` keeps its requirements (one artefact promoted forward,
  rehearsed rollback, migrations as a separate reviewed step, secrets only in
  the platform's secret store). They now apply to AWS. Its three environments
  become Local, DEV and PROD, where DEV takes the role that document gave to
  staging.
- D-050 (code written against runtime interfaces, not a provider SDK) still
  stands. Choosing a provider does not make it acceptable to scatter AWS
  calls through the domain code.
- The running cost of AWS is the client's, outside the 100,000 THB budget
  (D-200). Who owns the AWS account at handover is a separate question, filed
  on plan 014's branch as Q-059.
- PROD is public from stage 1, while security (phase 8) and database backup
  (phase 9) land in stage 4, before ordering opens (D-198). Until then PROD
  holds news articles and staff accounts, but no customer or order data.
- Q-053 (DNS access for `tinzshop.com`) now blocks stage 1, not phase 7.
  Neither environment can get its address until DNS can be changed.
- Imported news images still point at the old site (D-127). They must be
  copied to file storage on AWS before the old site is shut down, which now
  follows stage 1 rather than phase 7. Where they are stored is part of Q-063.
- Whether Cloudflare still sits in front of the site now that hosting is AWS
  is open (Q-064). D-087 stands until that is answered.
