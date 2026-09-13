# Decisions

Every decision on this project, one sentence each. This is the whole register —
if a decision is not on this page it has not been made.

Read this file to find out *what* was decided. Follow the link to find out
*why*.

> Decisions here are ours — engineering choices about how to build. They are
> not client sign-off. Every requirement in `02-scope-and-phases.md` is still
> PROPOSED (Q-001), and a decision made against a proposed requirement can be
> undone by the client changing it.

## Status vocabulary

| Status | Meaning |
| :--- | :--- |
| **Accepted** | Decided. Build to it. Change it only by superseding the record. |
| **Proposed** | Framed, criteria fixed, not yet chosen. Do not build to it. |
| **Deferred** | Deliberately not decided yet, with a stated point at which it must be. |
| **Blocked** | Cannot be decided until a named open question is answered. |

---

## Architecture

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| ADR-0001 | Tinzshop is built on Next.js (App Router), TypeScript, PostgreSQL and Prisma, with the commerce domain written in-house rather than adopted from a platform. | Accepted | [ADR-0001](adr/ADR-0001-backend-approach.md) |
| D-001 | Storefront, admin and API live in one route-grouped application, not a monorepo and not separate repositories. | Accepted | [04](04-tech-stack-and-structure.md#repository-shape) |
| D-002 | Domain logic lives in a framework-free layer that never imports React, Next or Prisma client types directly. | Accepted | [03](03-architecture.md#the-four-layers) |
| D-003 | Every request enters through one of exactly three entry surfaces — Server Component, Server Action, or route handler — and all three converge on the same domain functions. | Accepted | [03](03-architecture.md#entry-surfaces) |

## Data

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-010 | Money is stored as an integer number of satang and never as a float. | Accepted | [05](05-database.md#money) |
| D-011 | Stock is held on the variant and never on the product, because the source gives each ModelSKU its own quantity (REQ-005). | Accepted | [05](05-database.md#stock) |
| D-012 | Any write that changes stock takes a row-level lock on the variant inside a transaction, so the shop cannot oversell (REQ-020). | Accepted | [05](05-database.md#concurrency-rules) |
| D-013 | Tax invoice numbers are drawn from a PostgreSQL sequence inside the order transaction, which is the only mechanism that gives a gap-free run under concurrency (REQ-025). | Accepted | [05](05-database.md#invoice-numbering) |
| D-014 | Database identifiers are `snake_case` and must match a term already in `12-glossary.md`. | Accepted | [05](05-database.md#naming) |
| D-015 | Migrations are forward-only, committed as reviewable SQL, and never generated automatically during deployment. | Accepted | [05](05-database.md#migrations) |
| D-016 | Every change to a price, a stock level or an order status writes an append-only audit row naming the actor and the time (REQ-040). | Removed — see D-066 | [05](05-database.md#audit) |
| D-017 | Records covered by the five-year retention rule are soft-deleted; hard deletion is reserved for erasing personal fields under PDPA. | Accepted — see D-070 | [05](05-database.md#deletion-and-retention) |
| D-018 | The order status set is not defined and no code may assume one until the client supplies it. A candidate set has been proposed for review — `13-open-questions.md` Q-023 — but is not adopted. | Blocked — Q-023 | [12](12-glossary.md) |
| D-019 | The customer record can optionally hold a personal tax ID / national ID and a 10-digit company tax ID, collected only when a customer requests a full tax invoice from the separate invoicing system (REQ-026, Q-027). | Accepted | [05](05-database.md#orders-and-payments) |

## API

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-020 | Mutations from our own front end are Server Actions; REST route handlers exist only for callers we do not control — webhooks, exports and scheduled jobs. | Accepted | [06](06-api.md#server-actions-versus-route-handlers) |
| D-021 | Every external input is parsed by a Zod schema at the boundary, and unparsed input never reaches domain code. | Accepted | [06](06-api.md#validation) |
| D-022 | Every handler returns either a typed success value or a typed failure; thrown exceptions are for bugs, not for expected outcomes. | Accepted | [06](06-api.md#the-result-shape) |
| D-023 | Inbound webhooks are signature-verified, idempotent by event id, and acknowledged before their work is processed. | Accepted | [06](06-api.md#webhooks) |
| D-024 | Public API responses never include a real stock quantity, only the availability status (REQ-006). | Accepted | [06](06-api.md#what-must-never-be-returned) |

## Frontend

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-030 | Components are Server Components by default; `"use client"` is added only where interaction genuinely requires it. | Accepted | [07](07-frontend-components.md#server-first) |
| D-031 | Thai and English come from message catalogues selected by a locale segment in the URL, applied identically to the storefront and the admin (REQ-007, REQ-033). | Accepted | [07](07-frontend-components.md#bilingual) |
| D-032 | No user-facing string is ever written literally in a component; every one comes from a message key. | Accepted | [07](07-frontend-components.md#bilingual) |
| D-033 | Components are grouped as primitives, domain components and route-owned components, and a component is promoted upward only on its second real use. | Accepted | [07](07-frontend-components.md#the-three-tiers) |
| D-034 | Every form validates with the same Zod schema the server uses, so client and server can never disagree about what is valid. | Accepted | [07](07-frontend-components.md#forms) |
| D-035 | Layout is mobile-first, because the source requires every desktop function to work on a phone (REQ-009). | Accepted | [07](07-frontend-components.md#responsive) |

## Security, testing and process

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-040 | Role permissions are stored as rows and evaluated at request time, so the shop owner can change them without a developer (REQ-035). | Accepted | [08](08-security-testing.md#authorization) |
| D-041 | Authorization is checked in the domain layer, never only in the UI, and never inferred from which page the user reached. | Accepted | [08](08-security-testing.md#authorization) |
| D-042 | No secret is committed in any form, and no document, script or agent reads `.env`. | Accepted | [08](08-security-testing.md#secrets) |
| D-043 | Testing has three layers: domain unit tests, integration tests against a real PostgreSQL, and a manual checklist inside each plan. | Accepted | [08](08-security-testing.md#the-three-layers) |
| D-044 | The four invariants — no overselling, gap-free invoice numbers, correct VAT, and permission enforcement — carry integration tests before the code that implements them is merged. | Accepted | [08](08-security-testing.md#the-four-invariants) |
| D-045 | Every change reaches `main` through a pull request reviewed by the other developer; an agent review does not substitute. | Accepted | [09](09-coding-guidelines.md#pull-requests) |
| D-046 | Ownership is a path, never a feature. | Accepted | [09](09-coding-guidelines.md#ownership) |
| D-047 | A pull request that assumes an answer to an unresolved question does not merge. | Accepted | [09](09-coding-guidelines.md#pull-requests) |

## Deployment

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| ADR-0002 | Where the application and database run is deliberately not chosen yet, and must be chosen at phase 7. | Deferred | [ADR-0002](adr/ADR-0002-hosting-and-deployment.md) |
| D-050 | Application code is written against runtime interfaces rather than any provider's SDK, which is what makes ADR-0002 affordable to defer. | Accepted | [10](10-deployment.md#provider-independence) |
| D-051 | Backup retention and recovery targets cannot be set until the client states them. | Blocked — Q-055 | [10](10-deployment.md#backup) |
| D-052 | What Cloudflare is actually for is undefined and no configuration may be written until it is. | Blocked — Q-054 | [10](10-deployment.md#cloudflare) |

## Business and scope

Decisions recorded from the client's 2026-09-13 answers to `13-open-questions.md`.
These are business-policy calls, not technical design, but they carry the same
force: build to them, and change them only by recording a new answer in
`13-open-questions.md`.

| ID | Decision | Status | Detail |
| :--- | :--- | :--- | :--- |
| D-060 | All displayed prices already include 7% VAT; the totals function extracts it rather than adding it on top. | Accepted | [13](13-open-questions.md#q-010-vat-contradiction-between-sections-6-and-12) |
| D-061 | A signed-out visitor sees only front-page products; there is no guest checkout, and every order belongs to a registered customer. | Accepted | [13](13-open-questions.md#q-022-guest-checkout-contradicts-guest-browsing-restriction) |
| D-062 | Six roles form the authorization model: Blogger, Sale-manager, Admin, Top-level Admin, Customer, Guest. Customer and Guest are rows in `role`, not a special case. | Accepted | [13](13-open-questions.md#q-015-4-permission-levels-but-six-roles-are-listed) |
| D-063 | The owner may edit permissions on the six existing roles only; the system offers no "create a role" screen. | Accepted | [13](13-open-questions.md#q-016-which-permissions-are-owner-configurable) |
| D-064 | Staff two-factor authentication is email OTP only; no SMS/phone OTP. | Accepted | [13](13-open-questions.md#q-017-staff-two-factor--email-or-phone) |
| D-065 | Low-stock status and the near-out-of-stock dashboard list are removed; public stock status is in stock / out of stock only. | Accepted | [13](13-open-questions.md#q-019-low-stock-threshold-is-not-defined) |
| D-066 | Audit logging of price, stock and order-status changes is removed from scope. | Accepted | [13](13-open-questions.md#q-020-audit-log-scope-and-retention) |
| D-067 | Product weight/dimension capture is not required for phase 2; shipping size is a staff-assigned configurable category, not a computed function of a measured value. | Accepted | [13](13-open-questions.md#q-021-product-weight-and-dimension-data) |
| D-068 | Stock is deducted only when K-Payment confirms payment for a normal order; for a pre-order, a reservation quota is held at order time and the real stock deduction happens only when staff record the goods as received from the supplier. | Accepted | [13](13-open-questions.md#q-024-when-is-stock-deducted) |
| D-069 | The website generates only a simplified (abbreviated) tax invoice; a full tax invoice, when a customer needs one, is generated by a separate system from customer data (including an optional personal or company tax ID) that we provide to it. | Accepted | [13](13-open-questions.md#q-026-abbreviated-tax-invoice-or-full-tax-invoice) |
| D-070 | A PDPA deletion request erases personal fields not covered by the five-year retention rule; fields on a retained tax/accounting document are kept as an accepted legal exception. Supersedes the Blocked status of D-017. | Accepted | [13](13-open-questions.md#q-028-pdpa-deletion-versus-5-year-document-retention) |
| D-071 | PromptPay is never offered standalone; it exists only as the QR option inside the K-Payment flow. | Accepted | [13](13-open-questions.md#q-029-is-promptpay-in-the-first-phase) |
| D-072 | The bank-transfer-with-slip payment workflow is removed. K-Payment (card, instalments, PromptPay QR) is the sole payment method, and its integration moves into phase 3 rather than phase 4 because bank transfer no longer exists as an interim method. | Accepted | [13](13-open-questions.md#q-030-bank-transfer-slip-verification-workflow) |
| D-073 | There is no transactional-email opt-out. Instead, a customer can view and filter their own order-status history by date range and status. | Accepted | [13](13-open-questions.md#q-031-which-notification-emails-can-customers-switch-off) |
| D-074 | Transactional email is sent through a mail-relay service via the existing adapter interface; the specific provider and sending domain are a configuration detail finalized later. | Accepted | [13](13-open-questions.md#q-032-transactional-email-sending-domain-and-provider) |
| D-075 | No direct shipping-carrier integration is built. Shipping/fulfilment runs through BigSeller; the site optionally supports printing a simple self-printed address label from order data, and a carrier tracking number is not a core requirement. | Accepted | [13](13-open-questions.md#q-034-first-shipping-carrier-not-selected) |
| D-076 | Return, warranty, and post-shipment cancellation are handled case by case, directly between customer and shop (or through the relevant marketplace's own support). No centralized return/warranty/cancellation policy engine is built. | Accepted | [13](13-open-questions.md#q-035-return-and-warranty-period-and-who-pays-return-shipping) |
| D-077 | Refund payout is out of scope for this system. | Accepted | [13](13-open-questions.md#q-036-how-are-refunds-actually-paid-out) |
| D-078 | Warranty claims are routed to the product's distributor/representative; the system displays contact information and does not manage a claim workflow. | Accepted | [13](13-open-questions.md#q-038-warranty-claim-workflow) |
| D-079 | Shipping cost uses three shop-owner-configurable size tiers: small (candidate 50 THB), medium (candidate 100 THB), large (free). The long-term classification basis — weight or dimensions — is still open. | Accepted (tiers) / Blocked — Q-040 (measurement basis) | [13](13-open-questions.md#q-040-shipping-rule-parameters) |
| D-080 | Pre-order deposit percentage and balance-collection timing are shop-owner-configurable values, never hard-coded. | Accepted | [13](13-open-questions.md#q-041-pre-order-deposit-percentage-and-balance-due-date) |
| D-081 | Stock sync with BigSeller uses daily file export/import as the primary mechanism; the paid realtime API is a future option, not a phase-1 dependency. | Accepted | [13](13-open-questions.md#q-043-bigseller-live-api-versus-daily-file-import--undecided) |
| D-082 | Shopee is the authoritative source of truth when Shopee stock and site stock disagree. | Accepted | [13](13-open-questions.md#q-046-stock-discrepancy-detection-and-reconciliation) |
| D-083 | A dropship order requires a staff-run "Contact staff / Check availability" gate confirming supplier stock before the customer is allowed to pay. | Accepted | [13](13-open-questions.md#q-047-dropship-supplier-confirmation-before-payment) |
| D-084 | Staff-written blog/news and customer-submitted product reviews are two separate features; customer product reviews (previously ambiguous under the `+` marker) are confirmed in scope. | Accepted | [13](13-open-questions.md#q-048-product-review-means-two-different-things) |
| D-085 | A per-product "Sale Page" is a distinct content type, separate from the product page and from news articles. | Accepted | [13](13-open-questions.md#q-049-relationship-between-a-products-sale-page-and-news-articles) |
| D-086 | Staff training is one combined Thai-language manual covering all six roles, not role-specific versions. | Accepted | [13](13-open-questions.md#q-051-staff-training-scope) |
| D-087 | Cloudflare Free plan is used, scoped to security and bot protection; no paid Cloudflare tier without a future justified need. | Accepted | [13](13-open-questions.md#q-054-cloudflare-scope-and-account-ownership) |
| D-088 | Database backup is deliberately lightweight: automatic daily full backup, 30-day rolling retention, one timed restore rehearsed before go-live, no point-in-time recovery. Revisitable. | Accepted | [10](10-deployment.md#backup) |
| D-089 | The `+` marker in source §10 means "add to scope." Instalments and customer product reviews are scheduled; loyalty points/gift cards and a wishlist are confirmed in scope but placed in a post-launch backlog given the 100,000 THB budget. | Accepted | [02](02-scope-and-phases.md#backlog-items-confirmed-in-scope-but-not-scheduled) |
| D-090 | Total project budget is 100,000 THB (phases 2–9). A proposed schedule runs phase 1 from 2026-09-01 and phases 2–9 from 2026-09-16 through 2027-03-09, subject to revision as BigSeller and Shopee research lands. | Accepted (as a working plan; not a client-confirmed deadline) | [02](02-scope-and-phases.md#schedule-and-budget) |

---

## How a decision gets recorded

**A one-liner here is not enough on its own.** Every row above points at the
document that carries the reasoning. Add both, in the same pull request, or
neither.

Two kinds of record exist:

- **`D-0NN` — a design decision.** The reasoning lives in the technical
  document that owns the topic. Use this when the decision is a consequence of
  something already decided, or is small enough that a section explains it.
- **`ADR-000N` — an architecture decision record**, in `adr/`. Use this when
  the decision is genuinely open, has real alternatives worth writing down, and
  will be expensive to reverse.

### ADR fields

| Field | Content |
| :--- | :--- |
| **Status** | `Proposed` · `Accepted` · `Deferred` · `Superseded by ADR-000N` |
| **Date** | The date the status last changed, as YYYY-MM-DD |
| **Context** | The forces at play: what we need, what constrains us, what we do not know |
| **Options considered** | Each option with its trade-offs. An option nobody seriously weighed does not belong here |
| **Criteria** | What the choice is judged on, written *before* the choice |
| **Decision** | What was chosen, and by whom. Empty while Status is not `Accepted` |
| **Consequences** | What this makes easy, what it makes hard, and what we now live with — good and bad |

### Rules

1. **An Accepted ADR is never edited.** If the decision changes, write a new ADR and set the old one's status to `Superseded by ADR-000N`. The old record stays readable exactly as it was. An edited history teaches nothing.
2. A `Proposed` ADR may be edited freely while it is still being argued.
3. Leave `Decision` and `Consequences` empty until the decision is actually made. An ADR that quietly fills them in while still marked Proposed reads as settled and misleads the next person.
4. Record the criteria before the choice. Criteria written afterwards tend to describe whatever was already picked.
5. Link the open questions the decision depends on. A decision resting on an unanswered question is not ready to accept — mark it `Blocked` and name the question.
