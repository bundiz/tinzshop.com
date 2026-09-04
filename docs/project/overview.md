# Tinzshop — Project Overview

Source: `docs/reference/client-summary-th.md`.

> The source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements spec.
> Every ☐ checkbox in it is UNCONFIRMED. Nothing described here is agreed yet.
> See Q-001.

## What Tinzshop is

Tinzshop is an online shop selling games, consoles and IT equipment. The system
described in the source is a single website containing three things: the
storefront customers buy from, a back office for shop staff, and a game news
section called "Blogs". It supports Thai and English, prices in Thai baht, and
selling and delivery within Thailand only.

The technology stack is **not chosen**. No framework, database, hosting
provider or e-commerce platform has been selected. See
`docs/decisions/ADR-0001-backend-approach.md` and Q-008.

## Who uses it

### Customer-side roles

| Role | What the source says they can do |
| :--- | :--- |
| Signed-out visitor | Can see only the products on the front page (§8). This contradicts the statement that customers can order without registering (§2) — see Q-022. |
| Customer | Places orders, follows order status, reads news (§8). Registers and signs in, views order history, downloads tax invoices, tracks parcels, requests cancellation of unshipped orders, files warranty claims (§2). |

### Staff roles

The source states there are 4 permission levels "as agreed", then lists these.
The referenced agreement was not provided, and the count does not match the
list — see Q-015 and Q-007.

| Role | Scope stated in the source |
| :--- | :--- |
| Blogger | Writes news only |
| Sale-manager | Products, stock, orders, finance |
| Admin | Oversees everything |
| Top-level Admin | Adds and removes staff, and configures the system |

The shop owner is meant to be able to adjust each role's permissions without a
developer (§8) — see Q-016.

## Non-goals

Section 10 of the source lists what is excluded from this phase, and warns that
adding any of it affects timeline and budget. These rows are marked `✗`:

- **Point-of-sale (POS)** — no in-store selling system.
- **International sales and multiple currencies** — Thailand and Thai baht only.
- **Marketplace / other shops selling on the site** — single-seller only.
- **A mobile app** — the source states the responsive website covers mobile fully.
- **Wholesale pricing by customer group** — no per-group price tiers.
- **Cash on delivery (COD)** — not offered.

### Not classifiable as either scope or non-goal

Four further rows sit in the same section but are marked `+` rather than `✗`,
and the source never defines what `+` means. They are therefore **not** listed
as non-goals, and they are **not** requirements either:

- Loyalty points / gift cards
- Instalment payment via K-Payment — which also appears as in scope in §3
- Customer-written product reviews, switchable on and off
- Wishlist, also shown in order history

See Q-002 and Q-003. Until the client defines `+`, the scope boundary of this
project is not known.

## Where to look next

| You want | Read |
| :--- | :--- |
| What the system must do | `requirements.md` |
| What is unknown or contradictory | `open-questions.md` |
| Delivery order and blockers | `scope-and-phases.md` |
| What to call things | `glossary.md` |
| External systems | `../integrations/README.md` |
