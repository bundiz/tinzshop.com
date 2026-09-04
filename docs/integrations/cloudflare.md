# Cloudflare

- **Status:** NOT RESEARCHED
- **Named in:** phase 1 of §11 as a research subject, and phase 8 as a deliverable
- **Blocks:** Phase 8

## What we need it for

The source names phase 8 as "Security, verify bot – CloudFlare", and lists
Cloudflare among the things phase 1 must get clear on. That is the entire
description. No specific capability is requested.

Cloudflare is named as a vendor, not as a requirement. There is no checkbox
item behind it, so no REQ has been written for it.

## What we do NOT know

- Which capabilities are actually wanted. "Security" and "bot verification" are broad, and the source does not narrow them. See Q-054.
- What problem is being solved — whether there has been abuse, scraping, fraudulent ordering, or whether this is precautionary. Nothing in the source says.
- Which plan, and what it costs. There is no budget recorded at all. See Q-006.
- Who would own the account. See Q-054.
- Who controls DNS for tinzshop.com, which most Cloudflare use requires. See Q-053.
- Whether any of it interacts with the hosting choice, which is undecided. See Q-008.

## Account or credential required

A Cloudflare account with control of the tinzshop.com DNS zone. Ownership is
undetermined and is not on the client's §12 information list.

## What it blocks

Phase 8. Note that phase 8 sits after go-live in the source's ordering, so
the site would launch in phase 7 without whatever this turns out to be.
