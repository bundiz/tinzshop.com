# 005 — Pre-order, dropship, Shopee stock sync

- **Status:** Blocked — 2026-09-13
- **Phase:** 5
- **Dates (proposed):** 2026-12-09 → 2027-01-12 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** REQ-021, REQ-022, REQ-048, REQ-049, REQ-050
- **Blocked by:** a Shopee Partner account and test shop, still unavailable (Q-042); Shopee data-extraction research (Q-045); the BigSeller data-inspection dependency for SKU mapping (Q-007, Q-014, Q-044)
- **Depends on plan:** 004

## Goal

Pre-order, products from distributors, and keeping stock in step with Shopee.

**Resolved since the last revision:** the sync mechanism is decided —
daily file export/import, not the paid realtime API (Q-043, D-081). Shopee is
authoritative when the two disagree (Q-046, D-082). Pre-order deposit and
balance timing are shop-owner-configurable (Q-041, D-080). Dropship requires a
staff supplier-availability gate before payment (Q-047, D-083).

**What still blocks this plan:** a Shopee account does not exist yet (Q-042),
and Parent SKU / ModelSKU mapping waits on the same BigSeller data-inspection
session that blocks plan 002.

## Unblock first

- [ ] Shopee Partner account and test shop — Q-042. Still not available; this plan cannot fully complete without it, though the pre-order and dropship halves do not depend on it.
- [ ] How to extract data from Shopee at all — Q-045, still a research item
- [ ] BigSeller data-inspection session (shared with plan 002) — resolves the Parent SKU / ModelSKU mapping needed for `channel_listing`
- [ ] Shopee and BigSeller documentation read and recorded in `../14-integrations.md`; statuses changed to RESEARCHED once the account/data above exist

## Build checklist

*Shape only. The detail depends on the answers above.*

- [ ] `StockChannel` interface declared by the domain; one adapter per channel, daily-file based (D-081)
- [ ] `channel_listing` mapping a variant to its listing on a channel (REQ-021)
- [ ] Staff pair a product to its Shopee listing in the admin, with no developer (REQ-022)
- [ ] Incoming stock change applied through the same locked transaction an order's payment confirmation uses (`../05-database.md`)
- [ ] Every channel-caused adjustment writes a `stock_movement` row naming the channel as its source
- [ ] Discrepancy detection and a reconciliation report — Shopee wins on conflict (D-082); the detection mechanism's exact shape waits on seeing real export formats (Q-045)
- [ ] Pre-order: `reservation_quota` against the release-date cap, held at order time — **no `stock_quantity` change until goods are received** (REQ-048, D-068)
- [ ] Shop-owner-configurable deposit percentage and balance-collection timing, per product (REQ-048, D-080)
- [ ] Staff action to record pre-order goods as received: runs the real locked stock deduction, updates status, prompts balance collection
- [ ] Pre-order status and release date on the customer's account page (REQ-049)
- [ ] Dropship: customer-facing "Contact staff / Check availability" action instead of immediate checkout (REQ-050, D-083)
- [ ] Staff action to authorize (customer may now pay) or cancel (contact customer) a dropship request, based on supplier confirmation
- [ ] Expected waiting time shown to the customer before they use the availability-check action (REQ-050)

## Manual test checklist

- [ ] Sell on the site; Shopee stock reflects it within the agreed window.
- [ ] Sell on Shopee; site stock reflects it within the agreed window.
- [ ] Staff pair a product to a listing without developer help.
- [ ] Force the two out of step deliberately; Shopee's value wins.
- [ ] A channel-caused stock change appears in `stock_movement` naming the channel.
- [ ] Place a pre-order with a configured deposit; confirm no `stock_quantity` change occurs at order time, only the reservation count.
- [ ] Record the pre-order's goods as received; confirm the real stock deduction happens then, and the balance becomes collectable.
- [ ] The reservation cap stops the next customer once reached.
- [ ] Pre-order status and release date are visible on the customer's account page.
- [ ] A dropship product shows "Contact staff / Check availability" instead of immediate checkout; staff authorize it and the customer can then pay.
- [ ] Staff decline a dropship availability check; confirm the customer is contacted and no payment is possible.
- [ ] Change a product from dropship to normally stocked; nothing about existing orders breaks.
- [ ] Both languages, at 360px.

## Outcome

*Not started.*
