# Shopee

- **Status:** NOT RESEARCHED
- **Named in:** §4, and phase 1 and phase 5 of §11
- **Blocks:** Phase 5

## What we need it for

The source requires stock to be linked with Shopee so that a sale on either
channel adjusts the other automatically (REQ-021), and requires staff to be
able to pair a site product with its Shopee listing themselves in the admin
panel without a developer (REQ-022).

The source also records an open note to find out how to pull data out of
Shopee, and a phase 2 note asking what Shopee's real-world limitations are and
whether they can be reflected on the site.

## What we do NOT know

- How to get data out of Shopee at all — the source itself raises this as unanswered. See Q-045.
- Whether the sync runs through Shopee directly or through BigSeller. See Q-043.
- Which system is authoritative when the two disagree, and how a mismatch is detected and repaired. The source raises this as an open problem. See Q-046.
- How Shopee identifies a listing and how that maps to Parent SKU / ModelSKU, which is itself undefined. See Q-014.
- Whether Shopee's own constraints make any part of the requirement impossible.
- Any onboarding, approval or review process for partner access.

## Account or credential required

A Shopee Partner account and a test shop, listed by the client as §12 item 9
and required before phase 5. Not yet supplied — see Q-042.

## What it blocks

Phase 5 stock sync. Also feeds the phase 2 stock model, since a product's
identity has to be mappable to a Shopee listing.
