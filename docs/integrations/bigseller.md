# BigSeller

- **Status:** NOT RESEARCHED
- **Named in:** §4 discussion notes, and phase 1 of §11 as a research subject
- **Blocks:** Phase 5

## What we need it for

BigSeller appears only in the §4 discussion notes, not in a checkbox
requirement. The notes record it as a tool for managing stock, marked for
further study, with two alternative approaches discussed:

1. Update stock through BigSeller's API, noted as paid, covering both sales on the site and sales on other platforms.
2. Instead of the API, export stock daily from BigSeller or Shopee and import the file into the site, or edit it by hand. Noted explicitly as not realtime.

Because this is a discussion note rather than a requirement, BigSeller is not
committed scope. See `../project/requirements.md` §4.

## What we do NOT know

- Which of the two approaches will be used. Undecided in the source itself. See Q-043.
- Whether the shop already has a BigSeller account, and what the API costs. See Q-044. This cannot be weighed without a budget — see Q-006.
- What "รหัส BigSaler" (BigSeller codes) refers to, and how those codes map to Parent SKU / ModelSKU. See Q-044.
- Everything about the interface: no documentation has been read.
- Whether BigSeller sits between the site and Shopee, or alongside it.

## Account or credential required

A BigSeller account, and API credentials if the API route is chosen. Neither
is listed in the client's §12 information list, so it has not been formally
requested yet — that gap is Q-044.

## What it blocks

Phase 5, jointly with Shopee. The choice between the two approaches changes
the design fundamentally: one is a paid realtime integration, the other a
scheduled file job with a stale-data window.
