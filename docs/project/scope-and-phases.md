# Scope and Phases

Source: §11 of `docs/reference/client-summary-th.md`, with prerequisites drawn
from §12 and from `open-questions.md`.

> The source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements spec.
> The phase list below is PROPOSED and unconfirmed. See Q-001.

## Schedule status

The source's delivery table has a date only for phase 1 — `02/09`, with no year
stated. The document header is dated 22 August 2569 BE (2026 CE). Phases 2
through 9 have no dates at all, and the cost column is blank for every phase.

There is therefore **no delivery schedule and no budget** recorded anywhere.
See Q-004, Q-005 and Q-006.

**Client discussion notes** *(from the §11 table — not commitments)*

- Noted against phase 1: update on progress with Win every Wednesday at 21:00, and update with the father every two weeks, around the weekend.
- Noted against phase 2: gather how things are really used on Shopee, what its limitations are, and whether they can be adapted onto the site. Also noted as an open problem: an order slipping through without stock being updated, leaving the two out of step — how to check for that.
- Noted separately from the table: register one mailbox, `tech@tinzshop.com`, for Claude Code Enterprise. The address is written inconsistently in the source — see Q-009.

---

## Phase 1 — Planning documentation

- **Stated date:** 02/09 (year not stated; see Q-005)
- **Deliverables (from the source):** planning documents covering the detail of the work, division of work, scope, and working method, written to a shared format; a clear project structure; and identifying what is not yet known or not yet clear and making it clear. The source names Cloudflare, Shopee, BigSeller, Medusa JS and K-Payment as the subjects to get clear on.
- **Prerequisites:** none stated.
- **Blocked by:** Q-001 (nothing signed off), Q-002/Q-003 (scope boundary unknown), Q-004/Q-005/Q-006 (no dates, no budget), Q-007 (contract not provided), Q-009 (mailbox).
- **Note:** this documentation scaffold is part of this phase's deliverable.

## Phase 2 — Products, variants, stock, Excel import

- **Stated date:** none
- **Deliverables (from the source):** the product system, product options, stock, and Excel file import.
- **Prerequisites named by the client (§12):** real stock quantities per code (item 1), whether displayed prices include VAT (item 3), the shop's current Excel file format (item 4), and the maximum number of option types per product (item 10).
- **Blocked by:** Q-008 (no stack chosen), Q-010 (VAT contradiction), Q-011, Q-012, Q-013, Q-014 (SKU format unknown), Q-015/Q-016 (role model), Q-017, Q-018, Q-019, Q-020, Q-021.

## Phase 3 — Storefront, ordering, bank transfer, tax invoice

- **Stated date:** none
- **Deliverables (from the source):** the storefront, ordering, payment by bank transfer, and the tax invoice — described in the source as the point where the shop **can actually start selling**.
- **Prerequisites named by the client (§12):** the registered tax identification number (item 2).
- **Blocked by:** phase 2 complete; Q-022 (guest checkout contradiction), Q-023 (order statuses undefined), Q-024 (when stock is deducted), Q-025, Q-026, Q-027, Q-028, Q-029, Q-030, Q-031, Q-032.

## Phase 4 — Card payment, real carrier, refunds and claims

- **Stated date:** none
- **Deliverables (from the source):** credit card payment, connection to a real carrier, refunds, and product claims.
- **Prerequisites named by the client (§12):** K-Payment merchant account and test data (item 5), the choice of first carrier and its account (item 6), and the return/warranty period plus who pays return shipping (item 7).
- **Blocked by:** phase 3 complete; Q-003 (instalments in or out), Q-033, Q-034, Q-035, Q-036, Q-037, Q-038, Q-039, Q-040.

## Phase 5 — Pre-order, dropship, Shopee stock sync

- **Stated date:** none
- **Deliverables (from the source):** pre-order, products from distributors, and Shopee stock linking.
- **Prerequisites named by the client (§12):** pre-order deposit percentage and balance due date (item 8), and a Shopee Partner account plus test shop (item 9).
- **Blocked by:** phase 4 complete; Q-041, Q-042, Q-043 (API vs daily file undecided), Q-044, Q-045, Q-046, Q-047.
- **Note:** §5 states these features come after the main features are finished.

## Phase 6 — News, content pages, sales reports

- **Stated date:** none
- **Deliverables (from the source):** news, the various content pages, and sales reports.
- **Prerequisites:** none stated.
- **Blocked by:** Q-018 (bilingual content), Q-048, Q-049, Q-050.

## Phase 7 — Testing, staff training, go live

- **Stated date:** none
- **Deliverables (from the source):** system testing, staff training, and going live.
- **Prerequisites:** none stated.
- **Blocked by:** all earlier phases; Q-051, Q-052, Q-053.

## Phase 8 — Security and bot verification (Cloudflare)

- **Stated date:** none
- **Deliverables (from the source):** security, bot verification, Cloudflare.
- **Prerequisites:** none stated.
- **Blocked by:** Q-054 (scope and account ownership undefined), Q-053 (DNS control).

## Phase 9 — Database backup

- **Stated date:** none
- **Deliverables (from the source):** automatic daily database backup.
- **Prerequisites:** none stated.
- **Blocked by:** Q-008 (database not chosen), Q-055 (retention and recovery targets undefined).

---

## Cross-phase observation

Phases 8 and 9 — security and backups — are placed after go-live in the source.
Both are recorded here in the order the source gives them. Whether that ordering
is intended is itself unconfirmed and falls under Q-001.
