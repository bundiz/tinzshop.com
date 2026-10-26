# 002 — Catalogue, stock, admin foundation, Excel import

- **Status:** Blocked — 2026-09-13
- **Phase:** 2
- **Dates (proposed):** 2026-09-16 → 2026-10-13 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** REQ-004, REQ-005, REQ-006, REQ-020, REQ-032, REQ-033, REQ-034, REQ-035, REQ-036, REQ-037, REQ-038, REQ-051
- **Removed from this plan (2026-09-13 answers):** REQ-040 (audit log — D-066, Q-020)
- **Blocked by:** the BigSeller data-inspection dependency (Q-007, Q-011, Q-012, Q-014, Q-044); Q-013 (the option-count cap — research done, client answer pending)
- **Depends on plan:** 001

## Goal

The product system, product options, stock, and Excel import — plus the staff
authentication and role model without which the admin panel cannot be used.

**Nothing in this plan may start while Q-013 and Q-014 are open.** The option
model and the SKU format are the shape of the catalogue, and building on a
guess means rebuilding. Each is now narrowed to a single concrete next step:
one BigSeller data-inspection session (for SKUs, stock and the Excel format),
and for Q-013 a client answer — the Shopee/Lazada research the client asked
for is done and recorded in `../13-open-questions.md`; only the number the
project should enforce is still outstanding.

**Most of the earlier blockers on this plan are now resolved** — six roles
(Q-015), owner-edits-only permissions (Q-016), email OTP (Q-017), no low-stock
tier (Q-019), no audit log (Q-020), and weight/dimensions no longer required
for shipping (Q-021, now handled by the shipping-tier model in plan 004). See
`../13-open-questions.md` for the full record.

## Prerequisites the client must supply

- [ ] BigSeller data-inspection session: real stock quantities, real SKU examples, and a sample Excel export — resolves Q-007, Q-011, Q-012, Q-014, Q-044 in one sitting
- [ ] Practical maximum option types per product, and the maximum variant combinations per product (Q-013) — the Shopee/Lazada research is done; both marketplaces cap at two and the client's answer rules out inheriting that, so the number is now a client decision. The model itself already supports any number

## Build checklist

Application scaffold

- [ ] Next.js application scaffolded per `../04-tech-stack-and-structure.md`, with the directory layout in place
- [ ] Import-boundary lint rule enforcing the layering in `../03-architecture.md`, failing the build when broken
- [ ] Zod-validated config module; application refuses to start on a missing variable
- [ ] `.env.example` complete, placeholders only
- [ ] PostgreSQL running locally, Prisma wired, first migration applied
- [ ] Locale routing and both message catalogues, with a build failure on a missing key
- [ ] CI running typecheck, lint, unit tests, integration tests and a dependency audit

Catalogue

- [ ] `product`, `variant`, `option_type`, `option_value`, `variant_option_value`, `category` per `../05-database.md`
- [ ] Per-locale product text (REQ-007)
- [ ] `parent_sku` unique on product; `model_sku` unique on variant (REQ-004)
- [ ] Variants from more than one option type (REQ-005)
- [ ] Public availability status derived in the domain, never the raw quantity (REQ-006, D-024)

Stock

- [ ] `stock_quantity` on the variant, with a `>= 0` check constraint
- [ ] `stock_movement` append-only, recording delta, reason, actor and source
- [ ] Deduction inside a transaction, `SELECT … FOR UPDATE`, locking in id order (REQ-020)

Staff access

- [ ] `staff`, `customer`, `role` (six system rows: blogger, sale_manager, admin, super_admin, customer, guest), `permission`, `role_permission` — permissions as rows (REQ-034, REQ-035, D-040, D-062)
- [ ] Staff sign-in with email OTP as the second factor (REQ-032, D-064)
- [ ] Single bilingual admin entry point (REQ-033)
- [ ] Permission checks in the domain layer, not the UI (D-041)
- [ ] Admin permission-editing UI covers the six existing roles only — no "create a role" screen (D-063, Q-016)

Admin screens

- [ ] Product list grouped by parent, expandable to variants, expansion state in the URL (REQ-036)
- [ ] Inline edit of price, stock and status (REQ-037)
- [ ] Multi-row bulk edit, stating what it will change and to how many rows (REQ-037)
- [ ] Excel export (REQ-038)
- [ ] Excel import with row-level validation and error reporting (REQ-038)
- [ ] Import dry run as a first-class screen, in a transaction that rolls back (REQ-038)

## Manual test checklist

- [ ] Create a product with two option types and four variants; each variant has its own code, price and stock.
- [ ] A variant with stock 0 shows out of stock on the storefront; **the real number appears nowhere in the page source or any network response.**
- [ ] Two people order the last unit at the same moment: exactly one succeeds, stock ends at 0, and it is never negative.
- [ ] Edit a price inline; the value persists and a `stock_movement` row records the change where stock is affected.
- [ ] Cancel an inline edit with `Escape`; the previous value returns.
- [ ] Bulk-change status on 20 selected products; the confirmation states the count before acting.
- [ ] Select-all with a filter applied selects the filtered set, and says so.
- [ ] Import a valid Excel file in dry-run mode: it reports what would change and **writes nothing** — verified by re-reading the database.
- [ ] Import a file with an error on row 5: the error names row 5 and the reason, and nothing is written.
- [ ] Import the corrected file for real; the changes appear and audit rows exist.
- [ ] Export, change one cell, re-import: only that cell changes.
- [ ] Sign in as each role; each sees only what its permissions allow.
- [ ] Call a Sale-manager action directly while signed in as a Blogger: it is refused by the server, not merely hidden.
- [ ] Change a role's permissions in the admin; the change takes effect with no code change (REQ-035).
- [ ] Staff sign-in without the second factor is refused.
- [ ] Every admin screen viewed in Thai and in English, at 360px wide, with a long Thai product name.

## Outcome

*Not started.*
