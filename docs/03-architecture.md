# Software Architecture

How Tinzshop is put together, and why it is put together that way.

Decided by [ADR-0001](adr/ADR-0001-backend-approach.md). The concrete file
layout is `04-tech-stack-and-structure.md`; this document is the shape above
it.

> Every requirement this design serves is PROPOSED, not agreed (Q-001).

## The one-paragraph version

Tinzshop is a single Next.js application containing three audiences —
storefront, admin back office, and news — over one PostgreSQL database. All
three reach the same domain layer, which is plain TypeScript that knows
nothing about HTTP or React. External systems talk to us through a thin
adapter each, so that not one of them is named inside domain code.

## System context

```
                  ┌───────────────────────────────────────┐
  Customer ──────▶ │                                       │
  Guest    ──────▶ │            Tinzshop                   │ ◀───── Staff
                  │   storefront · admin · news           │
                  │                                       │
                  └───────┬───────────────────────┬───────┘
                          │                       │
                   ┌──────▼──────┐         ┌───────────────────────┐
                   │ PostgreSQL  │         │  External adapters    │
                   │             │         ├───────────────────────┤
                   │ catalogue   │         │ K-Payment   (phase 3) │
                   │ orders      │         │ Shopee      (phase 5) │
                   │ stock       │         │ BigSeller   (phase 2, 5) │
                   │ content     │         │ Mail relay  (phase 3) │
                   └─────────────┘         │ Cloudflare  (phase 8) │
                                           └────────────────────────┘
```

Every external system is listed in `14-integrations.md`. Cloudflare's plan and
scope are decided (Free, security/bot); the rest remain NOT RESEARCHED. **No
carrier adapter exists** — shipping runs through BigSeller (D-075, Q-034).

## The server layers (D-101)

Server code written for plan 010 and after is layered **controller → service →
repository → database**, with external systems in adapters (O-9, [spec](superpowers/specs/2026-10-26-shopee-catalogue-mirror-database-design.md) §4):

| Layer | Folder | Holds | Must not |
| :--- | :--- | :--- | :--- |
| Controller | `src/server/controllers/` | Reads the request, validates it with Zod, calls one service, shapes the response. | Hold business rules. |
| Service | `src/server/services/` | Business rules. Framework-free (D-002). | Import React, Next or Prisma. |
| Repository | `src/server/repositories/` | The only place Prisma is imported. | Hold business rules. |
| Adapter | `src/server/adapters/` | One folder per external system (`shopee/`: HTTP, signing, tokens). | Be bypassed: nothing else builds a Shopee URL or signs a request. |

This maps onto the four layers below: controllers are part of **Route**,
services are the **Domain**, repositories and adapters are **Data & adapters**.
Route handlers for outside callers stay under `src/app/api/…` and are thin
files that call a controller.

## The four layers

Dependencies point in one direction only, downward. A layer may import from
the layer below it and never from the layer above.

| Layer | Holds | May import | Must never import |
| :--- | :--- | :--- | :--- |
| **Route** | Pages, layouts, Server Actions, route handlers. Anything that knows about HTTP or React. | Domain, UI | — |
| **UI** | Presentational components. Knows about props and rendering, not about the database. | Nothing but React and other UI | Domain, Prisma |
| **Domain** | Business rules. Order totals, VAT, stock deduction, invoice numbering, permission evaluation. Plain TypeScript functions over plain types. | Data, adapter *interfaces* | React, Next, `next/*`, `req`/`res`, any adapter implementation |
| **Data & adapters** | Prisma queries, and one adapter per external system implementing an interface the domain declares. | Prisma, vendor SDKs | Domain, UI, Route |

**Why the domain layer is framework-free (D-002).** The commerce logic is the
part of this system that is genuinely ours — VAT at 7%, gap-free invoice
numbers, stock that cannot go negative, permissions the owner can reconfigure.
It is also the part most likely to be wrong in a way nobody notices for
months. Keeping it free of React and Next means it can be tested by calling a
function with values and comparing the result, with no server running and no
database fixture. That is the only kind of test the four invariants below
deserve.

The rule is enforced, not merely stated: see `09-coding-guidelines.md` for the
import-boundary lint rule that fails the build when it is broken.

## Entry surfaces

Exactly three ways in (D-003), and all three converge on the same domain
functions:

| Surface | Used for | Auth |
| :--- | :--- | :--- |
| **Server Component** | Reading data to render a page. | Session resolved in the layout |
| **Server Action** | Every mutation initiated by our own front end — add to cart, place order, edit a product, import a spreadsheet. | Session, then a permission check in the domain |
| **Route handler** | Callers we do not control: payment webhooks, carrier callbacks, scheduled stock imports, file downloads. | Signature verification, never a session |

There is no fourth. If a new need seems to require one, it is a sign the
domain function it wants does not exist yet.

**Why no general-purpose public REST API.** Nothing in the source asks for
one. No third party is described as calling us; the integrations named all
run the other way, with us calling them or them calling one specific webhook.
Building a public API surface nobody requested is scope we would then have to
secure, version and document. `06-api.md` records what to do if that changes.

## The flows that matter

Three flows carry most of the risk in this system. Each is written out here
because getting one wrong is expensive and silent.

### Placing a normal order (phase 3)

**Decided (D-096, superseding D-068): website orders never change stock.**
Placing an order holds no stock, and neither does payment confirmation.

```
Server Action  →  domain: priceOrder()      pure, no I/O
               →  BEGIN TRANSACTION
                    insert order (status: pending_payment) + order lines
                  COMMIT
               →  redirect to K-Payment
```

Placing the order is a lightweight write with nothing to lock. Adding to the
cart and placing an order are still refused for an inactive variant, a variant
with no copied stock, or a quantity above the copied stock
(`stock.insufficient`, spec §5.6).

### A K-Payment webhook confirms payment (phase 3)

**Under D-096 this flow takes no stock lock and deducts no stock.** It
verifies, records payment and allocates the invoice number; the paid order
lines then appear in the admin list for a manual stock adjustment in BigSeller
(spec §5.5).

```
Route handler  →  verify signature                           reject if absent
               →  look up event id                           already seen? 200, stop
               →  persist raw event                          before interpreting it
               →  200 OK                                     acknowledge fast
               →  domain: applyPayment()
                    BEGIN TRANSACTION
                      record payment
                      nextval() on the invoice sequence        ← REQ-025
                      mark order paid
                    COMMIT
               →  queue: payment-confirmed email               ← REQ-041
```

Acknowledging before processing is deliberate. A payment provider that does
not get a prompt `200` retries, and a retry that arrives while the first is
still working is how an order gets paid twice. Idempotency by event id is the
protection; the fast acknowledgement stops us needing it as often.

**Accepted consequence of D-096 (owner, 2026-10-26):** between a website
payment and the next sync after staff update BigSeller, the site shows stock
that is no longer true. Two customers can pay for the last unit, and a Shopee
buyer can take it too. A paid order is never rejected on stock grounds — the
money has already moved; the line is flagged in the admin list and staff
handle it outside the system (refunds are out of scope, D-077).

**Not designed yet:** K-Payment is NOT RESEARCHED beyond having credentials
(Q-033 residual). Whether it signs callbacks, what identifies an event, and
its retry behaviour are unknown until sandbox testing happens. The shape
above is what any such integration needs, not a claim about K-Payment's
actual behaviour.

### Placing a pre-order (phase 5)

**Resolved (Q-024, D-068): a pre-order never deducts `stock_quantity` at
order time.** Only a reservation quota against the release-date cap is held.

```
Server Action  →  domain: priceOrder() (deposit or full, per D-080)
               →  BEGIN TRANSACTION
                    check reservation_quota not exceeded for this release
                    increment reservation count (not stock_quantity)
                    insert order (status: pending_payment)
                  COMMIT
               →  redirect to K-Payment for deposit or full amount
```

How pre-order lines join the manual stock list when goods are **received**
from the supplier is phase 5 work (spec §5.5); the order moves to `received`
(candidate status, Q-023) so the balance, if any, can be collected. The earlier
locked `stock_quantity` deduction no longer exists (D-096).

### Stock changing somewhere else (phase 5)

**Superseded for the catalogue (D-095): the site pulls the Shopee Open API
every 10 minutes.** The mechanism is BigSeller → Shopee → our pull; the site
pushes nothing to Shopee and storefront pages never call Shopee. The daily
file flow below (D-081) is what was planned before plan 010 and is kept for
history; see the spec, section 6, for the sync job. The paid realtime BigSeller
API remains a future option only.

```
Scheduled job  →  export today's stock/order changes to a file          REQ-020 output
               →  (external: file is imported into BigSeller)
               →  (external: BigSeller/Shopee export their own file)
               →  import that file
                    BEGIN TRANSACTION
                      SELECT ... FOR UPDATE on every affected variant
                      apply the incoming change, insert stock_movement
                    COMMIT
```

The site's stock table is authoritative for what the site sells; an incoming
change from the file import is applied through the same locked transaction the
payment-confirmation flow uses. **Shopee is authoritative when Shopee and site
stock disagree** (D-082, Q-046) — the reconciliation *rule* is decided; the
detection *mechanism* still waits on seeing real BigSeller/Shopee export
formats (Q-045, and the BigSeller data-inspection dependency behind Q-007,
Q-011, Q-012, Q-014, Q-044).

## The four invariants

Everything else in this system can be wrong and then fixed. These four cannot:
each one produces damage that is discovered late and cannot be undone by
correcting the code.

| # | Invariant | Why it is not recoverable | Enforced at |
| :--- | :--- | :--- | :--- |
| 1 | ~~Stock never goes negative and is never sold twice~~ — **withdrawn for website orders (D-096)**; the guarantee in REQ-020 no longer exists. What remains: a copied `stock_quantity` is never negative (`CHECK >= 0`) and an order that has been paid is never rejected | Oversold orders are handled by staff outside the system (D-077) | `CHECK` constraint on the mirrored stock; the manual stock list |
| 2 | Tax invoice numbers run gap-free (REQ-025) | A gap is a legal defect in a document already sent to a customer and filed with an accountant | Postgres sequence in the same transaction |
| 3 | VAT is computed exactly (REQ-023) | Wrong tax on issued invoices means reissuing documents and amending filings | Integer satang arithmetic in the domain, one function |
| 4 | A staff member cannot act beyond their role (REQ-034, REQ-035) | Data is already changed or exposed when it is noticed | Permission check in the domain layer, not the UI |

Invariants 2, 3 and 4 each carry an integration test written before the
implementation merges (D-044, `08-security-testing.md`); invariant 1's test is
withdrawn with it (D-096).

Invariant 3's input is now resolved (Q-010, D-060): every displayed price
already includes 7% VAT, and the single domain function extracts it rather
than adding it on top.

## What this architecture deliberately does not have

- **No microservices.** Two developers, one database, one deploy. Service boundaries would be cost with no benefit at this size.
- **No event bus.** The one place asynchrony is genuinely needed — email, and later the stock import — is a job queue, not a bus.
- **No caching layer.** Nothing in the source describes traffic. Adding a cache before there is a measured problem adds a second source of truth for stock, which is the one thing this system must never have.
- **No GraphQL, no public REST.** See *Entry surfaces*.
- **No CMS.** REQ-043 and REQ-047 need staff-editable pages and news, which is a table and an editor, not a second system.

Any of these may become right later. None is right on the evidence available
today, and adopting one now would be inventing a requirement.

## Where this is still undecided

| Area | Blocked on |
| :--- | :--- |
| Where any of it runs | [ADR-0002](adr/ADR-0002-hosting-and-deployment.md) — deferred to phase 7 |
| The order status set and its transitions | Q-023 — a candidate is proposed, not adopted |
| Parent SKU / ModelSKU format | Q-014 — stored as Shopee holds them (D-103); the format question itself is still open |
| Practical maximum option types enforced by the UI/import | Q-013 — the model already supports any number; the Shopee/Lazada research is done, the enforced limit now waits on the client |
| Shopee/BigSeller discrepancy-detection mechanism | Q-045 — the authority rule (Shopee wins) is decided; detection waits on real export formats |
