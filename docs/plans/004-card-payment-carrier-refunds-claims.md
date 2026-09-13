# 004 — Shipping tiers, simple label, return/claim contact

- **Status:** Blocked — 2026-09-13
- **Phase:** 4
- **Dates (proposed):** 2026-11-18 → 2026-12-08 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** REQ-013, REQ-014, REQ-028, REQ-030
- **Removed from this plan (2026-09-13 answers):** REQ-016 (K-Payment — moved to plan 003, D-072), REQ-018 (refunds — D-077, Q-036), REQ-029 (carrier integration — D-075, Q-034), REQ-012/REQ-031 (tracking downgraded to optional, D-075, Q-039)
- **Blocked by:** plan 003 complete; an example shipping label (Q-039 residual); weight-vs-dimensions as the long-term shipping-tier basis (Q-040 residual)
- **Depends on plan:** 003

## Goal

**This phase is far lighter than originally planned.** The 2026-09-13 answers
removed carrier integration, refunds, and a centralized return/warranty
engine entirely. What remains: configurable shipping-tier pricing, an
optional simple address label, and a staff-handled contact path for
cancellation, return, warranty and claim requests.

**Why this shrank:** K-Payment moved into plan 003 because bank transfer was
removed and K-Payment became the sole payment method from day one (Q-030).
Carrier integration was removed because shipping runs through BigSeller
(Q-034). Refunds are out of scope for this system entirely (Q-036). Return,
warranty and post-shipment cancellation are handled case by case, directly
between customer and shop — no policy engine (Q-035, Q-037).

## Prerequisites the client must supply

- [ ] An example shipping label, to finalize its exact layout (Q-039 residual)
- [ ] Whether weight or dimensions becomes the long-term shipping-tier classification basis (Q-040 residual) — not required to start; the tier is staff-assigned in the meantime

## Build checklist

Shipping

- [ ] `shipping_size_tier` on the product: small / medium / large, staff-assigned (REQ-028, D-067)
- [ ] Shop-owner-configurable price per tier, defaulting to small 50 THB / medium 100 THB / large free (REQ-030, D-079)
- [ ] Shipping cost applied at checkout from the tier, never from a computed weight/dimension function
- [ ] Optional: print a simple address label (name, address, phone) from order data — no carrier barcode, no carrier API (D-075, Q-039)
- [ ] Optional: a tracking-number field on the order, importable/exportable with BigSeller if the client supplies one — not a core feature (D-075, Q-039)

Customer service

- [ ] Cancellation request for an order not yet shipped (REQ-013); no cancellation path offered once shipped
- [ ] A contact form: customer submits details and a description of a return/warranty/claim issue, reaching a staff queue for manual follow-up — no automated eligibility check, no policy engine (REQ-014, D-076)
- [ ] Per-product distributor/warranty contact information displayed to the customer (D-078, Q-038) — placement on the product page or its Sale Page (REQ-055) is a phase 6 dependency; a stub location is acceptable here if phase 6 has not landed yet

## Manual test checklist

- [ ] Order one product from each shipping tier; the checkout total reflects the tier's configured price.
- [ ] Change a tier's configured price in the admin; it takes effect with no code change.
- [ ] Print a shipping label from an order and confirm it carries name, address and phone.
- [ ] Request cancellation of an unshipped order; confirm the UI does not offer this once shipped.
- [ ] Submit a return/warranty/claim contact request; confirm it reaches the staff queue with no automated decision attached.
- [ ] Confirm the distributor contact information shown for a product matches what was entered for it.
- [ ] Whole flow in Thai and in English, at 360px.

## Outcome

*Not started.*
