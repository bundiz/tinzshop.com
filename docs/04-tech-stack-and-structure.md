# Tech Stack and Project Structure

What Tinzshop is built with, and where every file goes.

Decided by [ADR-0001](adr/ADR-0001-backend-approach.md) on 2026-09-09. Read
`03-architecture.md` first — this document is the concrete form of the shape
described there.

## The stack

| Concern | Choice | Why this one |
| :--- | :--- | :--- |
| Language | **TypeScript**, `strict` | One language from the database column to the React prop. A contract change between storefront and admin becomes a compile error rather than a runtime surprise — which is the whole point when two developers work in parallel with agents. |
| Framework | **Next.js**, App Router | Server Components let the storefront render product data without shipping the query to the browser, and Server Actions give mutations without a hand-written API surface nobody asked for. Route groups give the storefront/admin/news separation without three deployments. |
| UI | **React** | Comes with Next. REQ-003 needs price and availability to change on variant selection with no page reload, which is a component-state problem. |
| Database | **PostgreSQL** | Chosen for three specific guarantees the requirements need and not every database has: sequences that give gap-free numbering under concurrency (REQ-025), `SELECT … FOR UPDATE` row locks so stock cannot be oversold (REQ-020), and real transactional DDL so a failed migration does not leave a half-migrated schema. |
| ORM | **Prisma** | Generates types from the schema, so the domain layer's types and the database cannot drift apart. Its migration files are plain SQL we can read and edit, which matters because several constraints here cannot be expressed in the Prisma schema language. |
| Validation | **Zod** | One schema validates the HTTP boundary, the form, and the domain input — so client and server can never disagree about what is valid (D-021, D-034). |
| Styling | **Tailwind CSS** | Mobile-first by construction, which REQ-009 requires. No separate stylesheet to keep in step with a component. |
| i18n | **next-intl** | Locale segment in the URL, message catalogues per language, applied identically to storefront and admin (REQ-007, REQ-033). |
| Tests | **Vitest** + **Playwright** | Vitest for domain and integration, Playwright for the handful of end-to-end journeys. See `08-security-testing.md`. |
| Lint / format | **ESLint** + **Prettier** | Including the import-boundary rule that enforces the layering in `03-architecture.md`. |

**Versions are pinned exactly, never by range.** The version actually chosen
is recorded in `package.json` at scaffold time and that file is the authority;
this table names the choice, not the number.

### Deliberately not in the stack yet

| Not chosen | Why not | When |
| :--- | :--- | :--- |
| Hosting and runtime | [ADR-0002](adr/ADR-0002-hosting-and-deployment.md) — deferred by the project owner | Phase 7 |
| Job queue / scheduler | Depends on where it runs, and on Q-043 | Phase 5 |
| Specific mail-relay provider | Category decided (D-074); vendor and sending domain not chosen (Q-032 residual) | Phase 3 |
| File / image storage | Product images and payment slips both need it; nothing in the source describes volume or retention | Phase 2 |
| Error tracking, metrics | No availability or performance target exists in the source at all | Phase 7 |
| Component library | Deliberate — see `07-frontend-components.md` | — |

Adding anything to the left column requires a `D-0NN` row in
`11-decisions.md` in the same pull request.

## Repository shape

**One application, separated by route groups (D-001).** Not a monorepo, not
separate repositories.

The reason is `09-coding-guidelines.md`'s ownership rules. Two developers with
two agents will produce two implementations of the same idea under two names
within a week. A monorepo makes that easier, not harder: two `packages/` each
grow their own `formatMoney`. One application with one domain layer means
there is exactly one place a business rule can live, and the import-boundary
lint rule proves it.

Route groups still give clean file-level ownership, because `(shop)` and
`(admin)` are separate directories — which is exactly the form of ownership
`09-coding-guidelines.md` Rule 1 demands.

```
tinzshop.com/
├── docs/                         ← this documentation
├── prisma/
│   ├── schema.prisma             ← the single schema
│   ├── migrations/               ← forward-only, reviewed as SQL (D-015)
│   └── seed.ts                   ← development data only, never real customer data
├── messages/
│   ├── th.json                   ← Thai catalogue
│   └── en.json                   ← English catalogue
├── public/
├── src/
│   ├── app/
│   │   └── [locale]/             ← every route is under a locale segment (D-031)
│   │       ├── (shop)/           ← storefront — customers and guests
│   │       ├── (admin)/          ← back office — staff only
│   │       ├── (news)/           ← game news (REQ-047)
│   │       └── api/              ← route handlers: webhooks, exports, callbacks only
│   ├── components/
│   │   ├── ui/                   ← tier 1: primitives, no domain knowledge
│   │   └── domain/               ← tier 2: shared domain components
│   ├── server/
│   │   ├── domain/               ← business rules. Framework-free (D-002)
│   │   │   ├── catalog/
│   │   │   ├── cart/
│   │   │   ├── order/
│   │   │   ├── payment/
│   │   │   ├── stock/
│   │   │   ├── tax/
│   │   │   └── access/           ← permission evaluation (REQ-035)
│   │   ├── data/                 ← Prisma queries. The only place Prisma is imported
│   │   ├── adapters/             ← one directory per external system
│   │   │   ├── kpayment/         ← sole payment method (D-072); credentials in hand
│   │   │   ├── shopee/
│   │   │   ├── bigseller/        ← daily file export/import (D-081); also fulfilment/labels
│   │   │   └── mail-relay/       ← transactional email (D-074); provider TBD
│   │   │                         ← no carrier/ — no direct carrier integration (D-075)
│   │   └── actions/              ← Server Actions. Thin: parse, authorize, call domain
│   └── lib/                      ← genuinely generic helpers. No domain knowledge
├── tests/
│   ├── integration/              ← runs against a real PostgreSQL
│   └── e2e/                      ← Playwright journeys
├── .env.example                  ← placeholders only. Never real values
└── CLAUDE.md
```

### The rules this layout encodes

1. **`src/server/domain/` imports nothing from `src/app/`, `src/components/`, or Prisma.** It takes plain values and returns plain values. This is what makes the four invariants in `03-architecture.md` testable without a running server.
2. **Prisma is imported in `src/server/data/` and nowhere else.** A page that queries the database directly is a page that will get a business rule wrong in a way no test catches.
3. **`src/server/adapters/<system>/` is the only place a vendor name appears.** The domain declares an interface — `PaymentGateway`, `Carrier`, `StockChannel` — and the adapter implements it. Since every external system in `14-integrations.md` is NOT RESEARCHED, this is what lets phase 2 and 3 proceed before phase 4 and 5 know what they are talking to.
4. **`src/server/actions/` files are thin by rule.** Parse input with Zod, resolve the actor, call one domain function, return its result. Logic in an action is logic that cannot be unit-tested.
5. **`src/lib/` holds nothing that knows what a product is.** If a helper mentions an order, a SKU or a baht, it belongs in the domain.

### Where a new file goes

| You are adding | It goes in |
| :--- | :--- |
| A business rule, calculation, or state transition | `src/server/domain/<area>/` |
| A database query | `src/server/data/` |
| A call to K-Payment, Shopee, a carrier, or an email provider | `src/server/adapters/<system>/` |
| A mutation the storefront or admin triggers | `src/server/actions/` |
| An endpoint an outside system calls | `src/app/[locale]/api/` |
| A button, input, or other domain-free component | `src/components/ui/` |
| A component that renders a product, order or variant | `src/components/domain/` |
| A component only one route uses | Beside that route, not in `components/` |

**Before creating any file, search the repository for the concept first.** This
is `09-coding-guidelines.md` Rule 5 and it is the rule most likely to be
skipped and most expensive when it is.

## Naming

Names come from `12-glossary.md`. If the concept is not there, add it there in
the same pull request rather than inventing a local name.

| Thing | Convention | Example |
| :--- | :--- | :--- |
| Directory | `kebab-case` | `src/server/domain/order/` |
| React component file | `PascalCase.tsx` | `VariantPicker.tsx` |
| Everything else `.ts` | `kebab-case.ts` | `price-order.ts` |
| Type / interface | `PascalCase`, no `I` prefix | `OrderLine` |
| Function / variable | `camelCase` | `deductStock` |
| Constant | `SCREAMING_SNAKE_CASE` | `VAT_RATE_BASIS_POINTS` |
| Database table and column | `snake_case`, singular table | `order_line`, `model_sku` |
| Route segment | `kebab-case` | `/th/order-history` |
| Message key | dot path mirroring the route | `shop.product.addToCart` |
| Environment variable | `SCREAMING_SNAKE_CASE`, prefixed by system | `KPAYMENT_MERCHANT_ID` |

The database identifier is the canonical one. TypeScript adapts the casing to
`camelCase`; **it never changes the words.** `model_sku` is `modelSku`, never
`variantCode`.

## Environment variables

Every variable the application reads is declared in `.env.example` with a
placeholder value and a comment saying what it is and who supplies it.

Three rules, and they are absolute:

1. **Never read, print, copy or open `.env`.** Not by a person, a script, or an agent. `.env.example` is the file to edit when a variable needs documenting.
2. **A new variable is added to `.env.example` in the same pull request that reads it.** A variable the code needs and the example file does not name is a broken checkout for the other developer.
3. **`.env.example` contains placeholders only.** Never a real key, merchant id, account number, or endpoint that identifies a real account — see `08-security-testing.md`.

Variables are read once at startup through a single Zod-validated config
module, so a missing variable fails immediately and loudly rather than as
`undefined` somewhere in phase 4.

## Tooling

| Command | Does | Must pass before |
| :--- | :--- | :--- |
| `typecheck` | TypeScript, no emit | Every commit |
| `lint` | ESLint, including the import-boundary rule | Every commit |
| `format` | Prettier | Every commit |
| `test` | Vitest — domain and integration | Every pull request |
| `test:e2e` | Playwright | Every pull request touching a route |
| `db:migrate` | Applies migrations locally | — |

The import-boundary rule is not advisory. It fails the build when
`src/server/domain/` imports React, Next, or Prisma, and when `src/app/`
imports Prisma directly. It exists because the layering in
`03-architecture.md` is worth exactly as much as its enforcement.
