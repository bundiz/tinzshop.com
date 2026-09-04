# Shipping carrier

- **Status:** NOT RESEARCHED
- **Named in:** §7
- **Blocks:** Phase 4

## What we need it for

The source requires connecting to at least one real carrier (REQ-029),
calculating shipping cost from destination and real weight (REQ-028), and
making delivery status visible to the customer once a tracking number is
recorded (REQ-031).

The §7 discussion notes say that being able to print a cover label carrying
name, address and phone from the order data would be enough.

## Candidates named in the source

Flash, Kerry, and Thailand Post. The source explicitly asks the client to say
which to start with, and none has been chosen — see Q-034.

## What we do NOT know

- Which carrier. Nothing further can be researched until this is answered. See Q-034.
- Whether a carrier API is needed at all, or whether a self-printed address label satisfies the requirement. These are very different amounts of work. See Q-039.
- Everything about any candidate's interface: no documentation has been read for any of the three.
- Whether rate calculation is done by the carrier or by our own rules, and where the rate table comes from.
- Whether product weights exist for the current catalogue. See Q-021.
- What free-shipping and other rules are needed on day one. See Q-040.
- Who pays return shipping on a return or claim. See Q-035.

## Account or credential required

An account with the chosen carrier, listed by the client as §12 item 6 and
required before phase 4. Not yet supplied, and the carrier is not chosen.

## What it blocks

Phase 4 shipping work. Also phase 2, indirectly: if weight is not captured
when products are created, the catalogue has to be revisited later.
