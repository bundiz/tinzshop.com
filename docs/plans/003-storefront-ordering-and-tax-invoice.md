# 003 — Storefront, ordering, K-Payment, simplified tax invoice

- **Status:** Blocked — 2026-09-13
- **Phase:** 3
- **Dates (proposed):** 2026-10-14 → 2026-11-17 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** REQ-001, REQ-002, REQ-003, REQ-011, REQ-016, REQ-019, REQ-023, REQ-024, REQ-025, REQ-026, REQ-041, REQ-042, REQ-052, REQ-053
- **Removed from this plan (2026-09-13 answers):** REQ-010 (guest checkout — D-061, Q-022), REQ-015 (bank transfer with slip — D-072, Q-030)
- **Blocked by:** plan 002 complete; K-Payment sandbox testing (Q-033 residual); an example invoice, to finalize exact fields (Q-027 residual); a mail-relay provider and DNS access (Q-032 residual)
- **Depends on plan:** 002

## Goal

The point where the shop can actually start selling: storefront, ordering,
**K-Payment as the sole payment method**, and the simplified tax invoice.

**This plan absorbed K-Payment from the old plan 004.** Bank transfer — the
original phase-3 payment method — is removed entirely (Q-030). Since K-Payment
is now the only payment method and its merchant/test credentials already
exist (Q-033), it moves into this phase rather than waiting for phase 4.

**Two structural changes from the original design, both resolved:**

1. **Stock is deducted at payment confirmation, not at order placement**
   (Q-024, D-068). Placing an order is a lightweight write; the locked
   stock-deduction transaction now lives in the K-Payment webhook handler. See
   `../03-architecture.md`'s revised order-flow diagrams.
2. **There is no guest checkout.** Every order requires a customer account
   (Q-022, D-061).

## Prerequisites the client must supply

- [ ] Registered tax identification number (Q-025) — **still pending.** Invoices are not legally correct without it, but this does not block building the mechanism.
- [ ] An example invoice, to finalize the simplified invoice's exact fields (Q-027 residual)
- [ ] Specific mail-relay provider and DNS access for sender authentication (Q-032 residual)

## Unblock first

- [ ] K-Payment sandbox testing actually performed — card, at least one instalment plan, and PromptPay QR each completing a real sandbox transaction (Q-033 residual)
- [ ] `../14-integrations.md`'s K-Payment section updated from NOT RESEARCHED to RESEARCHED once that testing happens, with signing scheme, event identity, and retry behaviour recorded

## Build checklist

Storefront

- [ ] Category browse (REQ-001)
- [ ] Search working in Thai and in English (REQ-002) — Thai has no word spaces; verify the tokenisation
- [ ] Product page with variant selection updating price and availability with no page reload (REQ-003)
- [ ] Front-page product visibility for signed-out visitors, and nothing beyond it — no guest browsing of categories or search (REQ-053, D-061)

Customer accounts

- [ ] Register, sign in, order history, simplified tax invoice download (REQ-011)
- [ ] Order-status history view, filterable by date range and by status (REQ-042, D-073) — **not** a notification on/off toggle

Cart and order

- [ ] Cart, server-side, keyed to a signed-in customer only (no guest cart, D-061)
- [ ] Order placement as a lightweight transaction: insert order (`pending_payment`) and lines only — **no stock lock, no deduction, no invoice number allocated here** (D-068)
- [ ] `order_line` storing its own `unit_price_satang`
- [ ] Redirect to K-Payment after order placement

Payment

- [ ] K-Payment adapter: card, instalments (REQ-019, confirmed in scope), PromptPay QR (all reached through K-Payment — no standalone PromptPay, D-071)
- [ ] K-Payment webhook: signature verified, idempotent by event id, raw event persisted, acknowledged before processing (D-023, `../06-api.md`)
- [ ] Payload amount matched against our own order record; a mismatch rejected loudly
- [ ] On confirmed payment: lock stock, check sufficiency, deduct, allocate invoice number, mark order paid — all in one transaction (`../03-architecture.md`)
- [ ] Insufficient-stock-at-payment failure path: the order the customer already paid for cannot be fulfilled — define what the customer is told and what happens to their payment. **This is new design surface introduced by deferring the stock check to payment time — resolve it explicitly, do not leave it implicit.**

Tax

- [ ] VAT extracted from the VAT-inclusive displayed price in one domain function, integer satang throughout (REQ-023, D-060)
- [ ] Invoice number from a PostgreSQL sequence, allocated inside the payment-confirmation transaction (REQ-025, D-013)
- [ ] Simplified tax invoice PDF generated automatically and downloadable from order history (REQ-024) — exact fields pending an example invoice (Q-027 residual)
- [ ] Documents retained and retrievable for 5 years (REQ-026)
- [ ] `customer.tax_id` / `customer.company_tax_id` fields exist, collected only if a customer separately requests a full invoice (D-019, D-069) — this website never generates that document itself

Email

- [ ] Email at each order step (REQ-041) — steps follow whatever the eventual order-status set turns out to be; build against the candidate in `../13-open-questions.md` Q-023, not a guess of your own
- [ ] Sent via the mail-relay adapter (D-074); specific provider TBD (Q-032 residual)

## Manual test checklist

- [ ] Search a product by its Thai name and by its English name; both return it.
- [ ] Select each variant on a product page; price and availability change with no page reload.
- [ ] A signed-out visitor can reach only front-page products; no path to checkout exists.
- [ ] Place an order and confirm no stock change occurs until payment is confirmed.
- [ ] Complete a K-Payment sandbox card payment end to end; stock deducts, invoice generates, confirmation email sends.
- [ ] Complete a sandbox instalment payment and a sandbox PromptPay QR payment.
- [ ] The invoice PDF downloads from order history, and its total matches the order exactly.
- [ ] Place 20 orders and confirm their payments concurrently: **the invoice numbers form an unbroken run with no gap and no duplicate.**
- [ ] Two customers pay for the last unit at nearly the same moment: exactly one payment results in a fulfilled order; confirm what the other customer is told matches the resolved failure path above.
- [ ] Order a cart of several lines with awkward prices; the lines sum to the total to the satang.
- [ ] View and filter order-status history by date range and by status.
- [ ] Attempt to read another customer's order by changing the id in the URL: refused.
- [ ] Whole flow completed in Thai and in English, on a 360px phone.
- [ ] The invoice renders correctly with a Thai name and a Thai address.

## Outcome

*Not started.*
