# ADR-0003: Customer authentication via Amazon Cognito

- **Status:** Accepted
- **Date:** 2026-11-04

## Context

`../08-security-testing.md` §Authentication describes an in-house design for
customers: email and password, Argon2id hashing, reset tokens we store hashed,
and a server-side session we can revoke. Nothing of it was built. Customers
must have an account to order, because there is no guest checkout (D-061), so
registration and sign-in come before the ordering plans.

On 2026-11-03 the project owner asked for two things the in-house design did
not include: sign-in with Google, and one account per person whichever way they
arrive. The owner chose to hand login to Amazon Cognito rather than write it,
after the trade-off below was presented. The owner approved the design on
2026-11-04 (`../superpowers/specs/2026-11-03-customer-authentication-design.md`).

Conditions that apply:

- Hosting is deliberately not decided (ADR-0002, Proposed). Whatever is chosen
  here must work wherever the app is later hosted.
- Customer data other than identity stays in our PostgreSQL.
- Staff sign-in (REQ-032, plan 002) is out of scope. Staff get their own pool
  and tables, so a customer session can never reach staff pages (O-8).
- Google sign-in is the owner's request; the client source does not mention it
  (`../13-open-questions.md`).

## Options considered

### Option A: in-house, as `08` describes

- **For:** no dependency on AWS; leaving later is easy; one database; local
  development needs only Docker; free.
- **Against:** we build and carry the risk of password storage, reset,
  email verification and Google token checks. Linking Google to an existing
  email is our own code to get right.

### Option B: Amazon Cognito (customer user pool)

- **For:** AWS carries password storage, reset, verification and Google token
  checks. The free tier covers 10,000 monthly active users with no end date and
  Google sign-in counts within it; the shop expects far fewer (checked on
  aws.amazon.com/cognito/pricing on 2026-11-03).
- **Against:** login depends on AWS. **Password hashes cannot be exported**, so
  leaving Cognito later forces every customer to reset their password. Identity
  lives in Cognito and everything else in PostgreSQL, linked by `cognito_sub`.
  Linking Google to an existing email needs a pre sign-up Lambda. Local
  development also needs a shared dev user pool. Verification and reset emails
  through Amazon SES cost a little.

## Criteria

Written before the choice, from the owner's request and the project's rules.

1. One person is one account, whether they register with a password or sign in with Google.
2. We do not store or hash customer passwords ourselves.
3. A session we can end at once (08), with short-lived tokens refreshed silently.
4. No guest checkout is introduced (D-061).
5. The app stays host-independent (ADR-0002, D-050): no AWS credentials in the app.
6. The cost to leave later, and the cost to run, are known.

## Decision

Customer login uses **Amazon Cognito** (Option B), chosen by the project owner
on 2026-11-03 and approved on 2026-11-04. It was weighed against Option A on the
criteria above.

- One customer user pool. The app calls only Cognito's public APIs, authorised
  by a client id and secret, so it holds no AWS credentials.
- Our own session (`customer_session`, a hashed cookie token with the Cognito
  tokens sealed in the row) sits on top, so sign-out and password reset take
  effect at once.
- One pre sign-up Lambda links Google to an existing email. It is the only AWS
  code we write (`infra/cognito/pre-sign-up/`).
- Login codes are sent by Cognito itself. This is a deliberate exception to
  D-074, which keeps order email on the mail-relay adapter.

The reasoning for each detail lives in the design document and is indexed as
D-152 to D-175 in `../11-decisions.md`.

## Consequences

**Easier**
- No password storage, reset-token or Google token-verification code to write
  and defend.
- One account per email, with a verified email as the link between password and
  Google sign-in.

**Harder, and what we now live with**
- **Hash lock-in.** Password hashes cannot be exported from Cognito. Moving to
  another provider means every customer resets their password once.
- **An AWS dependency.** The shop's login depends on AWS being reachable from
  wherever the app runs (O-2). ADR-0002 gets a Context line saying so.
- **A Lambda to deploy.** Until hosting and infrastructure-as-code are chosen
  (phase 7), the pool and the Lambda are set up by hand from a checklist in
  `../14-integrations.md`.
- **A shared dev pool** for the team; tests never call AWS and CI never needs a
  pool.
- **The D-074 exception.** Two paths send email: Cognito for login codes, the
  mail relay for orders.
- **Production email** goes through Amazon SES with a `tinzshop.com` sender,
  which needs DNS records; who controls DNS is Q-053.
- **Who owns and pays for the AWS account at go-live is open (Q-059).** It
  affects the handover, not this build. Until answered, the dev pool runs in the
  project owner's account.
- **Several Cognito behaviours are checked in the dev pool before the build
  continues** (plan 014 Task 2). An answer that contradicts the design goes
  back to the owner.

Related: D-061, D-074, D-142 (product pages now require sign-in, D-161), Q-053,
Q-059.
