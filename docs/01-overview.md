# Tinzshop — Project Overview

Source: `reference/client-summary-th.md`.

> The source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements spec.
> Every ☐ checkbox in it is UNCONFIRMED. Nothing described here is agreed yet.
> See Q-001.

## What Tinzshop is

Tinzshop is an online shop selling games, consoles and IT equipment. The system
described in the source is a single website containing three things: the
storefront customers buy from, a back office for shop staff, and a game news
section called "Blogs". It supports Thai and English, prices in Thai baht, and
selling and delivery within Thailand only.

The technology stack is **decided**: Next.js, TypeScript, PostgreSQL and
Prisma, with the commerce domain written in-house. Hosting is deliberately not
chosen yet. See
`adr/ADR-0001-backend-approach.md` and Q-008.

## Who uses it

**Six roles, confirmed** (Q-015, D-062): Blogger, Sale-manager, Admin,
Top-level Admin, Customer, and Guest. All six go through the same
authorization mechanism — Customer and Guest are not a special case. The shop
owner can edit permissions on these six only; there is no "create a role"
feature (Q-016, D-063).

### Customer-side roles

| Role | What the source says they can do |
| :--- | :--- |
| Signed-out visitor (Guest) | Can see only the products on the front page (§8). **This is now the confirmed rule** — there is no guest checkout (Q-022, D-061). |
| Customer | Places orders, follows order status, reads news (§8). Registers and signs in, views and filters order-status history, downloads the simplified tax invoice, requests cancellation of unshipped orders, contacts staff for a return/warranty/claim (§2). Every order requires an account. |

### Staff roles

| Role | Scope stated in the source |
| :--- | :--- |
| Blogger | Writes news only |
| Sale-manager | Products, stock, orders, finance |
| Admin | Oversees everything |
| Top-level Admin | Adds and removes staff, and configures the system |

The shop owner can adjust each role's permissions without a developer, editing
only — not creating new roles (§8, Q-016, D-063).

## Non-goals

Section 10 of the source lists what is excluded from this phase, and warns that
adding any of it affects timeline and budget. These rows are marked `✗`:

- **Point-of-sale (POS)** — no in-store selling system.
- **International sales and multiple currencies** — Thailand and Thai baht only.
- **Marketplace / other shops selling on the site** — single-seller only.
- **A mobile app** — the source states the responsive website covers mobile fully.
- **Wholesale pricing by customer group** — no per-group price tiers.
- **Cash on delivery (COD)** — not offered.

### The `+` marker means "in scope"

**Resolved (Q-002, D-089): `+` means "add to scope."** All four rows marked
`+` in §10 are confirmed in scope, not non-goals:

- Instalment payment via K-Payment — scheduled in phase 3 (REQ-016, D-089)
- Customer-written product reviews — scheduled in phase 6 (REQ-054, D-084)
- Loyalty points / gift cards — in scope, held in the post-launch backlog given the 100,000 THB budget (see `02-scope-and-phases.md#backlog-items-confirmed-in-scope-but-not-scheduled`)
- Wishlist, also shown in order history — in scope, same backlog

## Where to look next

| You want | Read |
| :--- | :--- |
| What the system must do, and in what order | `02-scope-and-phases.md` |
| What is unknown or contradictory | `13-open-questions.md` |
| How it is built | `03-architecture.md` |
| What to call things | `12-glossary.md` |
| What has been decided | `11-decisions.md` |
| External systems | `14-integrations.md` |
