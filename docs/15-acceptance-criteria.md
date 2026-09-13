# Acceptance Criteria and Sign-off

What must pass before each phase in `02-scope-and-phases.md` is considered
complete, and who confirms it.

> **This document is a proposal from the project side**, drafted in answer to
> Q-052 ("Please design the acceptance criteria and sign-off process for
> me"). It has not been confirmed by the client. The one piece it cannot
> supply itself is a **named approver** — see *Sign-off process* below.

## How to read this

Each phase carries three kinds of criteria:

- **Requirements delivered** — the `REQ-0NN` items from `02-scope-and-phases.md` that must work, cross-referenced to the plan that builds them.
- **Invariant checks** — for any phase touching the four invariants in `03-architecture.md` (no overselling, gap-free invoice numbers, correct VAT, permission enforcement), the specific integration test that must pass, per D-044.
- **Manual walkthrough** — the concrete, human-performed checks from the phase's plan in `docs/plans/`, per `09-coding-guidelines.md`'s rule that a plan is complete only when every box is ticked, including every manual test.

A phase is accepted only when all three are true, not when the code merges.
**Never tick a box for a check nobody performed** — this rule from
`09-coding-guidelines.md` applies here exactly as it does in a plan.

## Sign-off process

1. The developers mark a phase's plan (`docs/plans/00N-*.md`) complete — every build checklist item and every manual test box ticked, with the outcome recorded.
2. The developers demonstrate the phase against the criteria below, live, to the client's named approver.
3. The approver either accepts the phase, or lists specific defects against specific criteria — not a general "looks off."
4. Acceptance is recorded as a dated line in the phase's plan outcome section, naming who approved it.

**What is missing to run this today:** a named approver from the client. The
source names no individual, and the 2026-09-13 answers did not supply one —
this is Q-052's residual item in `13-open-questions.md`. Until someone is
named, "sign-off" defaults to the project owner (this conversation's user)
demonstrating each phase and confirming acceptance themselves — workable for
now, but worth replacing with an actual named approver before phase 3, when
real money starts moving.

---

## Phase 1 — Planning documentation

**Requirements delivered:** none — documentation is the deliverable.

**Criteria:**

- [ ] Every document listed in `docs/README.md` exists and contains no placeholder or empty-file content.
- [ ] Every `REQ-0NN` referenced anywhere resolves to an entry in `02-scope-and-phases.md`.
- [ ] Every `Q-0NN` referenced anywhere resolves to an entry in `13-open-questions.md`, with a status of RESOLVED, PARTIALLY RESOLVED, or UNRESOLVED — never silently dropped.
- [ ] No document describes a requirement as approved, agreed, confirmed, decided or finalized beyond what `13-open-questions.md` actually records.
- [ ] `reference/client-summary-th.md` is byte-for-byte unchanged from the client's original.
- [ ] The client (or named approver) has read `13-open-questions.md` and `02-scope-and-phases.md#schedule-and-budget`, and has either confirmed the proposed schedule/budget or given a specific correction.

**Manual walkthrough:** the plan 001 checklist in `docs/plans/001-planning-documentation.md`.

---

## Phase 2 — Products, variants, stock, Excel import

**Requirements delivered:** REQ-004, 005, 006, 020, 032, 033, 034, 035, 036, 037, 038, 051.

**Criteria:**

- [ ] The BigSeller data-inspection session has happened, and Parent SKU/ModelSKU format, real stock quantities, and the Excel column layout are recorded as decisions, not assumptions.
- [ ] A product with two or more option types can be created, each variant carrying its own code, price and stock (REQ-005).
- [ ] The public storefront never exposes a real stock number, in the page or in any network response (REQ-006, D-024).
- [ ] All six roles exist as rows, permissions are editable by the owner without a code change, and no "create a role" control exists anywhere in the admin (REQ-034, REQ-035, D-062, D-063).
- [ ] Staff sign-in requires email OTP; sign-in without it is refused (REQ-032, D-064).
- [ ] Excel import dry-run writes nothing to the database; a corrected re-import writes exactly the intended changes (REQ-038).

**Invariant check:** no-overselling integration test — N concurrent stock-changing writes (admin edit, Excel import, and later payment confirmation) against a stock of 1 resolve to exactly one success and a final quantity that is never negative (D-044).

**Manual walkthrough:** the plan 002 checklist in `docs/plans/002-catalogue-stock-and-admin-foundation.md`.

---

## Phase 3 — Storefront, ordering, K-Payment, simplified tax invoice

**Requirements delivered:** REQ-001, 002, 003, 011, 016, 019, 023, 024, 025, 026, 041, 042, 052, 053.

**Criteria:**

- [ ] K-Payment sandbox testing has actually been performed — card payment, at least one instalment plan, and PromptPay QR each complete a real sandbox transaction and the callback updates the order (REQ-016).
- [ ] Stock is deducted only after the K-Payment webhook confirms payment, never at order placement (REQ-020, D-068) — demonstrated by placing an order and confirming stock is unchanged until payment lands.
- [ ] A signed-out visitor reaches only front-page products; no path to checkout exists without an account (REQ-053, D-061).
- [ ] Every order total matches product price × quantity + shipping, with VAT correctly extracted from the VAT-inclusive price, not added on top (REQ-023, D-060).
- [ ] A simplified tax invoice PDF is generated automatically and downloadable from order history, with a gap-free invoice number even under concurrent orders (REQ-024, REQ-025).
- [ ] A customer can view and filter their own order-status history by date range and status (REQ-042, D-073).

**Invariant checks (all four now apply):**

- No overselling — concurrent payment confirmations for the same last unit resolve to exactly one paid order.
- Gap-free invoice numbers — concurrent and failed/rolled-back orders produce an unbroken sequence.
- VAT correctness — table-driven test over mixed carts and rounding boundaries; lines always sum to the total.
- Permission enforcement — every protected action attempted as every one of the six roles; only the permitted combinations succeed.

**Manual walkthrough:** the plan 003 checklist (browse → variant → cart → checkout → K-Payment → paid → invoice downloaded), run in Thai and in English, at 360px.

---

## Phase 4 — Shipping tiers, simple label, return/claim contact

**Requirements delivered:** REQ-013, 014, 028, 030.

**Criteria:**

- [ ] A product assigned each shipping size tier (small/medium/large) charges the corresponding configurable amount at checkout, and the owner can change the amounts without a code change (REQ-030, D-079).
- [ ] A customer can request cancellation of an order that has not yet shipped (REQ-013); the UI does not offer this after shipment.
- [ ] A customer can submit a return/warranty/claim contact request with a description; it reaches a staff queue, with no automated approval or denial (REQ-014, D-076).
- [ ] A simple address label (name, address, phone) can be printed from an order's data (REQ-031, D-075).

**Manual walkthrough:** the plan 004 checklist, including one order per shipping tier.

---

## Phase 5 — Pre-order, dropship, Shopee stock sync

**Requirements delivered:** REQ-021, 022, 048, 049, 050.

**Criteria:**

- [ ] A pre-order with a configured deposit percentage and balance timing can be placed; no stock is deducted at order time, only a reservation count against the release-date cap (REQ-048, D-068, D-080).
- [ ] Recording a pre-order's goods as "received" performs the real stock deduction under the same locking rules as a normal order, and prompts balance collection if applicable.
- [ ] A dropship product shows "Contact staff / Check availability" instead of immediate checkout; staff can authorize or cancel the request, and only an authorized request reaches payment (REQ-050, D-083).
- [ ] Staff can pair a site product with a Shopee listing without a developer (REQ-022).
- [ ] The daily BigSeller file sync runs, and a deliberately introduced Shopee/site stock mismatch resolves in Shopee's favour (REQ-021, D-081, D-082).

**Manual walkthrough:** the plan 005 checklist. **This phase's sign-off may need to wait on Shopee access (Q-042)** — if a Shopee test account still does not exist when phase 4 finishes, flag this explicitly to the client rather than accepting the phase with the sync criteria unverified.

---

## Phase 6 — News, content pages, product reviews, Sale Page, reports

**Requirements delivered:** REQ-027, 039, 043, 044, 045, 046, 047, 054, 055.

**Criteria:**

- [ ] Existing content has been migrated into the new system before the new content types (product reviews, Sale Page) are built on top of it, per the phase goal in `02-scope-and-phases.md`.
- [ ] Staff can publish a news article and edit every required content page (about us, privacy policy, terms, cancellation, warranty/returns, FAQ, how-to-use, warranty registration form) without a developer (REQ-043, REQ-044).
- [ ] A customer can submit a product review, distinct from staff news (REQ-054, D-084).
- [ ] A product's Sale Page renders as a distinct page from both its normal product page and any news article (REQ-055, D-085).
- [ ] A customer can view, correct, and delete their own personal data, with the PDPA/retention exception correctly applied — a deletion request does not remove fields on a document still inside the five-year window (REQ-046, D-070).
- [ ] The monthly sales export produces a file (exact columns pending Q-050, but the mechanism itself must work end to end).

**Manual walkthrough:** the plan 006 checklist, in Thai and English.

---

## Phase 7 — Testing, staff training, go live

**Requirements delivered:** none new — this phase verifies everything above.

**Criteria:**

- [ ] Every criterion in phases 2 through 6 above has been demonstrated and accepted.
- [ ] The one combined Thai-language training manual exists and covers all six roles (REQ-051, D-086).
- [ ] The registered tax ID is in place (Q-025) — without it, invoices are not legally correct.
- [ ] Every go-live item in `10-deployment.md#going-live` is checked, including a **performed and timed** backup restore.
- [ ] A named approver (or, absent one, the project owner) has signed off phases 2 through 6 individually before go-live is attempted as a whole.

**Manual walkthrough:** the plan 007 checklist, plus every end-to-end journey in `08-security-testing.md`.

---

## Phase 8 — Security and bot verification (Cloudflare)

**Requirements delivered:** none written — Cloudflare Free scope only (D-087).

**Criteria:**

- [ ] Cloudflare Free is active on tinzshop.com's DNS, with WAF managed rules and bot fight mode enabled.
- [ ] No paid Cloudflare feature is enabled without a specific justification recorded as a new decision.
- [ ] This phase is demonstrably complete **before** phase 7's go-live checklist is signed off, per the recommended re-ordering in `02-scope-and-phases.md`.

**Manual walkthrough:** the plan 008 checklist.

---

## Phase 9 — Database backup

**Requirements delivered:** none written — strategy in `10-deployment.md#backup` (D-088).

**Criteria:**

- [ ] Automatic daily backup is running with no human action required.
- [ ] 30-day rolling retention is configured and verified.
- [ ] **A restore has actually been performed and timed**, and the result is written into this phase's plan outcome. This is the one criterion across all nine phases most likely to be skipped under time pressure — it is also the one that matters most if it is skipped.
- [ ] This phase is demonstrably complete **before** phase 7's go-live checklist is signed off, per the recommended re-ordering in `02-scope-and-phases.md`.

**Manual walkthrough:** the plan 009 checklist.
