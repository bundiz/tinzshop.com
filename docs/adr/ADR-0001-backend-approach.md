# ADR-0001: Backend approach

- **Status:** Accepted
- **Date:** 2026-09-09

## Context

Tinzshop needs an online shop with a staff back office and a news section, as
described in `docs/reference/client-summary-th.md`. No technology has been
chosen: not a framework, not a database, not a hosting provider, and not an
e-commerce platform. The source itself treats this as an open item, noting
Medusa JS in connection with deciding the tech stack and listing it among the
phase 1 research subjects.

This ADR exists to frame that decision and to fix the criteria it will be
judged on **before** anyone starts arguing for a favourite. It does not make
the decision.

Two conditions apply to the whole decision:

- The requirements it must satisfy are **PROPOSED, not agreed**. Every checkbox in the source is unticked (Q-001). A stack chosen against unconfirmed requirements may be chosen against the wrong requirements.
- Several criteria below depend on unanswered questions. Those are named inline. The decision is not ready to accept while they are open.

## Options considered

Three options were weighed against the criteria below. Medusa JS appearing in
the source is not an endorsement — the source lists it as something to look
into, alongside Cloudflare, Shopee, BigSeller and K-Payment.

### Option A — Next.js + TypeScript + PostgreSQL + Prisma, commerce built in-house

Storefront, admin and API in one TypeScript codebase over a relational
database we control outright.

- **For:** criteria 2, 6, 7, 8 and 10 are the hard ones, and all five are things we would have to control directly under any option. A gap-free invoice sequence (criterion 8) is a Postgres sequence allocated inside the order transaction; permissions-as-data (criterion 6) is three tables; the Excel dry run (criterion 7) is a transaction that rolls back. One language and one type definition across storefront and admin suits two developers working with agents. Bilingual (criterion 4) is a first-class Next.js concern on both sides of the site.
- **Against:** cart, checkout, order state, payment capture and fulfilment are all ours to build. That is the bulk of phases 3 and 4, and none of it is novel work — it is work an adopted platform would have given us.

### Option B — Medusa JS v2 + Next.js storefront + PostgreSQL

The commerce framework the source names.

- **For:** products, variants, carts, orders, payment sessions and fulfilment ship as primitives. Criterion 1 is satisfied out of the box, and much of phases 3 and 4 becomes configuration rather than construction.
- **Against:** the requirements that decide this project are back-office requirements, and they land where Medusa is least accommodating. Its admin is not bilingual Thai (criterion 4, REQ-033). Owner-configurable role permissions (criterion 6, REQ-035) are not a Medusa concept. The Thai abbreviated tax invoice with a gap-free number (criterion 8) has no equivalent. Excel import with a dry run and inline multi-row editing (criterion 7) means replacing admin screens. Taken together we would keep Medusa's order model and rebuild its admin, which is the expensive half of both options.

### Option C — Laravel + Filament + PostgreSQL

- **For:** the strongest back-office story of the three. Filament generates admin screens, `spatie/laravel-permission` gives criterion 6 directly, Laravel Excel covers criterion 7, and PHP hosting in Thailand is cheap and universally available.
- **Against:** either the storefront is also PHP, giving up the component model REQ-003 and REQ-009 are easiest to satisfy in, or it is a separate JavaScript front end — which reintroduces the duplicated domain model that `../09-coding-guidelines.md` Rule 3 exists to prevent. A second language across a two-person team doubles the review surface.

## Criteria

Drawn from the requirements. Each names what it is testing and what would
disqualify an option.

### 1. Multi-variant catalogue with per-variant identity

REQ-004, REQ-005, REQ-006. A product carries one Parent SKU; each variant
carries its own ModelSKU with its own price and stock. Variants come from more
than one option type, such as colour × capacity.

Judge on: whether variants are first-class with their own codes, prices and
stock, and how much fights the model. **Depends on Q-013** (how many option
types) and **Q-014** (SKU format).

### 2. Concurrent stock safety

REQ-020. The shop must not oversell even when two customers order the last
unit simultaneously. Bank transfer is verified by hand, so there is a real
gap between order and payment confirmation.

Judge on: what the option guarantees under concurrent writes, and whether
stock reservation semantics are ours to define. **Depends on Q-024** (when
stock is deducted), which changes what is being asked of the system.

### 3. Split and deposit payments

REQ-048, REQ-018, REQ-016. Pre-orders may take a deposit and collect the
balance later. Refunds may be full or partial. Instalments may be in scope.

Judge on: whether an order can carry several payments over time at different
amounts, and whether partial refunds are representable. A model assuming one
payment per order is a serious problem. **Depends on Q-003** (instalments),
**Q-036** (refund mechanism) and **Q-041** (deposit terms).

### 4. Bilingual content

REQ-007, REQ-002. Thai and English across the storefront, admin, product data
and news, including search that works in both.

Judge on: whether translation is built in or bolted on, and how text search
behaves with Thai, which does not use spaces between words. **Depends on
Q-018** (who translates, and what happens when a translation is missing).

### 5. Staff-editable content pages

REQ-043, REQ-044, REQ-047. Eight content pages plus a news section with
categories, all editable by staff without a developer.

Judge on: whether content editing exists or must be built, and whether it
covers both the pages and the news.

### 6. Configurable permissions

REQ-034, REQ-035. Four staff roles, with the shop owner able to adjust each
role's permissions without a developer.

Judge on: whether roles and permissions are data rather than code. A fixed
role list compiled into the application fails this outright. **Depends on
Q-015** (four levels or six) and **Q-016** (what is adjustable).

### 7. Bulk data operations

REQ-037, REQ-038. Excel import and export covering multi-variant products,
with validation and a dry-run mode that shows the outcome without saving, plus
inline and multi-row editing in the admin list.

Judge on: whether bulk write paths can be validated and previewed without
committing, and whether the admin list can be edited in place.

### 8. Sequential document numbering

REQ-025, REQ-024, REQ-026. Tax invoice numbers must run gap-free even under
concurrent orders, PDFs generated automatically, retained 5 years.

Judge on: whether a gap-free sequence can be guaranteed under concurrency —
this is a harder constraint than a unique identifier and rules out anything
that only offers uniqueness. **Depends on Q-027** (number format).

### 9. External integration surface

Phases 4 and 5 need K-Payment, a carrier, and stock sync with Shopee or
BigSeller, including inbound callbacks and possibly a scheduled file import.

Judge on: how much the option constrains talking to systems it does not
already know about, and whether inbound webhooks and scheduled jobs are
straightforward. **Depends on Q-043** (API versus daily file).

### 10. Auditability

REQ-040. Every price, stock and order-status change recorded with who and
when.

Judge on: whether change history is available or must be built by hand across
every write path.

### 11. Operability

Phase 9 requires automatic daily database backups; phase 7 requires going live
and training staff.

Judge on: backup and restore story, and what running it in production actually
demands of a two-developer team. **Depends on Q-055** (retention and recovery
targets) and **Q-053** (who owns production).

## Decision

**Option A.** Tinzshop is built on Next.js (App Router) with TypeScript,
PostgreSQL and Prisma, as a single route-grouped application. Decided by the
project owner on 2026-09-09.

The reasoning in one line: the requirements that are hardest to satisfy are
back-office and Thai-regulatory requirements, not commerce primitives, and
every option would have left those to us — so the option that adds no
framework to fight is the cheaper one.

The concrete shape of the choice is recorded in
`../04-tech-stack-and-structure.md`, and its database and API consequences in
`../05-database.md` and `../06-api.md`.

**Explicitly not decided here:** hosting, the runtime it deploys onto, and the
backup mechanism phase 9 needs. Those are ADR-0002 and remain open.

## Consequences

**What this makes easy**

- One language and one set of types from the Postgres column to the React prop. A contract change is a compile error, not a runtime surprise between two codebases.
- The three hardest invariants are ours to enforce directly: gap-free invoice numbering, stock that cannot go negative under concurrency, and permissions stored as data. None depends on a framework's willingness.
- Thai and English on the storefront and in the admin are the same mechanism, satisfying REQ-007 and REQ-033 without a second system.
- Excel import with a dry run (REQ-038) is one transaction that either commits or rolls back.

**What this makes hard, and what we now live with**

- We own the commerce domain. Cart, checkout, order state machine, payment capture, refunds and fulfilment are all written by us. This is the largest single consequence and it lands in phases 3 and 4.
- We own correctness under concurrency. Postgres gives us the tools; nothing stops us from using them wrongly. `../05-database.md` records the specific locking rules, and they are not optional.
- Prisma does not express everything the schema needs. Partial indexes, check constraints, and the invoice sequence are written as raw SQL inside migrations.
- The decision was made against PROPOSED requirements. Every checkbox in the source is unticked (Q-001), so this stack was chosen against requirements that may still change. If the scope boundary moves far enough — Q-002 and Q-003 in particular — this ADR should be revisited rather than quietly stretched.

**Open questions this decision did not resolve, and does not claim to:**
Q-013, Q-014, Q-024, Q-027, Q-043 and Q-055 all still bind the design. The
stack choice makes them answerable; it does not answer them.
