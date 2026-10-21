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

**Resolved (Q-024, D-068): stock is deducted at payment confirmation, not at
order placement.** Placing an order no longer holds any stock at all.

```
Server Action  →  domain: priceOrder()      pure, no I/O
               →  BEGIN TRANSACTION
                    insert order (status: pending_payment) + order lines
                  COMMIT
               →  redirect to K-Payment
```

Placing the order is a lightweight write with nothing to lock, because there
is nothing yet to protect from overselling.

### A K-Payment webhook confirms payment (phase 3)

**This is now where stock is deducted for every normal order.**

```
Route handler  →  verify signature                           reject if absent
               →  look up event id                           already seen? 200, stop
               →  persist raw event                          before interpreting it
               →  200 OK                                     acknowledge fast
               →  domain: applyPayment()
                    BEGIN TRANSACTION
                      SELECT ... FOR UPDATE on every variant in the order
                      check each has enough stock              ← REQ-020
                      deduct stock, insert stock_movement
                      nextval() on the invoice sequence        ← REQ-025
                      mark order paid
                    COMMIT
               →  queue: payment-confirmed email               ← REQ-041
```

Acknowledging before processing is deliberate. A payment provider that does
not get a prompt `200` retries, and a retry that arrives while the first is
still working is how an order gets paid twice. Idempotency by event id is the
protection; the fast acknowledgement stops us needing it as often. The row
locks are taken in a **deterministic order** — variants sorted by id — so two
concurrent payment confirmations cannot deadlock by grabbing them in opposite
orders.

**New failure mode this flow introduces:** since stock is not held at order
placement, two customers can place orders for the last unit before either
pays. The first payment webhook to arrive wins the stock; the second
customer's payment succeeds at K-Payment but `applyPayment()` finds
insufficient stock — that path (and what it tells a customer whose money has
already moved) is new design surface, not yet resolved.

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

When staff later record the goods as **received** from the supplier, that
action runs the same locked `stock_quantity` deduction the normal-order flow
uses, once per pre-order line, and updates the order to `received` (candidate
status, Q-023) so the balance, if any, can be collected.

### Stock changing somewhere else (phase 5)

**Resolved (Q-043, D-081): daily file export/import, not a live API.** The
paid realtime BigSeller API is a future option only, not built now.

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
| 1 | Stock never goes negative and is never sold twice (REQ-020) | The customer has already been charged for goods that do not exist | Row lock inside the order transaction |
| 2 | Tax invoice numbers run gap-free (REQ-025) | A gap is a legal defect in a document already sent to a customer and filed with an accountant | Postgres sequence in the same transaction |
| 3 | VAT is computed exactly (REQ-023) | Wrong tax on issued invoices means reissuing documents and amending filings | Integer satang arithmetic in the domain, one function |
| 4 | A staff member cannot act beyond their role (REQ-034, REQ-035) | Data is already changed or exposed when it is noticed | Permission check in the domain layer, not the UI |

Each carries an integration test written before the implementation merges
(D-044, `08-security-testing.md`).

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
| Parent SKU / ModelSKU format | Q-007, Q-014, Q-044 — the BigSeller data-inspection dependency |
| Practical maximum option types enforced by the UI/import | Q-013 — the model already supports any number; the Shopee/Lazada research is done, the enforced limit now waits on the client |
| Shopee/BigSeller discrepancy-detection mechanism | Q-045 — the authority rule (Shopee wins) is decided; detection waits on real export formats |
