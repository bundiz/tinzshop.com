# 006 — News, content pages, product reviews, Sale Page, reports

- **Status:** Blocked — 2026-09-13
- **Phase:** 6
- **Dates (proposed):** 2027-01-13 → 2027-02-09 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** REQ-027, REQ-039, REQ-043, REQ-044, REQ-045, REQ-046, REQ-047, REQ-054, REQ-055
- **Blocked by:** accounting export format, pending review (Q-050); translation ownership, a residual detail (Q-018 residual)
- **Depends on plan:** 003 (reports need orders); the content pages, reviews and Sale Page depend only on plan 002

## Goal

News, content pages, customer product reviews, per-product Sale Pages, and
sales reports.

**Migrate existing content into the new system before building the new
content types on top of it** — an explicit instruction from the 2026-09-13
answers, specific to this phase.

**Resolved since the last revision:** staff news and customer product reviews
are two separate features, both confirmed in scope (Q-048, D-084, REQ-054);
the Sale Page is a distinct content type from both the product page and a
news article (Q-049, D-085, REQ-055); low stock is removed so the dashboard
has no near-out-of-stock list to build (Q-019, D-065); PDPA deletion carries
an accepted retention exception (Q-028, D-070); the order-status candidate in
Q-023 gives the dashboard something concrete to count against, even though it
is not yet adopted.

## Unblock first

- [ ] Accounting export format and fields — Q-050, still pending review
- [ ] Who produces the Thai and English content, and what shows when a translation is missing — Q-018 residual, not a hard blocker
- [ ] The shop's real contact details, opening hours, address, LINE ID and DBD mark, supplied by the client
- [ ] Existing content inventoried and a migration plan agreed before new content types are built

## Build checklist

Content

- [ ] `content_page` with per-locale rows, staff-editable (REQ-043, REQ-044)
- [ ] All eight pages: about us, privacy policy, terms of service, order cancellation, warranty and returns, FAQ, how to use, warranty registration
- [ ] Warranty registration page with a submittable form (REQ-043)
- [ ] Rich text sanitised on the way in with an allowlist — staff-authored is not trusted (`../08-security-testing.md`)
- [ ] Shop information block: phone, email, LINE, opening hours, address, DBD mark (REQ-045)

News

- [ ] `news_article` and `news_category`, per-locale, staff-editable (REQ-047)
- [ ] Categories: announcements, and products (Nintendo, PlayStation) — **no "product reviews" category** (REQ-047, D-084)
- [ ] Blogger role can write news and nothing else (REQ-051)

Product reviews and Sale Page

- [ ] `product_review`: customer-written, tied to a product and a customer, distinct from `news_article` (REQ-054, D-084)
- [ ] Basic moderation (e.g. staff can hide a review) — not specified in the source, a phase 6 design detail
- [ ] `sale_page`: one per product, a distinct content type from the product page and from news (REQ-055, D-085)
- [ ] Distributor/warranty contact information placed on the Sale Page (D-078, Q-038)

PDPA

- [ ] Customer can view their own personal data (REQ-046)
- [ ] Customer can correct their own personal data (REQ-046)
- [ ] Customer can delete their own personal data — personal fields not covered by the 5-year retention rule are erased; fields on a retained document are kept as an accepted exception (REQ-046, D-070)

Reporting

- [ ] Sales totals by day, week and month (REQ-039)
- [ ] Order counts by status, against the candidate set in `../13-open-questions.md` Q-023 (REQ-039)
- [ ] Monthly sales export with a daily per-SKU unit summary (REQ-027) — exact columns pending Q-050

## Manual test checklist

- [ ] A staff member edits every content page in both languages with no developer involvement.
- [ ] Paste rich text containing a `<script>` tag into a page: it is stripped, and nothing executes when the page renders.
- [ ] A Blogger can publish news and **cannot** reach products, stock, orders or finance.
- [ ] News categories filter correctly, in both languages.
- [ ] The shop information block shows every item REQ-045 lists.
- [ ] A customer views, corrects and deletes their own data; a document still inside the 5-year window keeps its fields, disclosed as an exception.
- [ ] A customer submits a product review; it appears distinct from staff news, and staff can moderate it.
- [ ] A product's Sale Page renders as a distinct page from its normal product page and from any news article about it.
- [ ] Dashboard totals match the underlying orders for a chosen day, week and month.
- [ ] The monthly export opens in the accounting team's tool and its numbers match the dashboard.
- [ ] Every page in Thai and in English, at 360px, with a long Thai heading.
- [ ] A page with no English translation behaves as Q-018 was answered — not as a blank page.

## Outcome

*Not started.*
