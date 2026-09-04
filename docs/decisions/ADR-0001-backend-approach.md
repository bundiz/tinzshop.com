# ADR-0001: Backend approach

- **Status:** Proposed
- **Date:** 2026-09-05

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

*None have been evaluated. This section is deliberately empty of conclusions.*

The space of options is open. It includes, without preference or ordering:
building on a general-purpose web framework; adopting an existing e-commerce
platform or framework, of which Medusa JS is the one the source happens to
name; a hosted or SaaS commerce backend; or some combination. Medusa JS
appearing in the source is not an endorsement — the source lists it as
something to look into, alongside Cloudflare, Shopee, BigSeller and K-Payment.

Each option must be written up here with its trade-offs against the criteria
below before any choice is made.

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

*Empty. No decision has been made.*

## Consequences

*Empty. To be completed when the decision is made.*
