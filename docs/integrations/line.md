# LINE

- **Status:** NOT RESEARCHED
- **Named in:** §9
- **Blocks:** Phase 6

## What we need it for

The only mention in the source is in §9: the site displays the shop's phone
number, email, **LINE**, opening hours, address, and DBD mark (REQ-045).

As written, this is a contact detail to display, not a system to integrate
with. No LINE feature — login, messaging, notifications, LINE Pay, or a
chat widget — is requested anywhere in the source.

This file exists because LINE is a named external system and someone will
eventually ask whether more was intended. **Do not build any LINE integration
on the strength of this file.**

## What we do NOT know

- Whether displaying a LINE ID or link is all that is wanted, or whether the shop expects customers to contact them through LINE as a support channel with any system involvement.
- The shop's LINE account identifier, which has not been supplied.
- Whether any LINE capability was discussed verbally. Nothing in the source suggests it.

## Account or credential required

None for displaying a contact detail. The shop's LINE ID or link is needed as
content, which falls under the shop information the client must supply.

## What it blocks

Nothing beyond the shop information block on the content pages in phase 6, on
the current reading. If a real LINE integration is wanted, that is new scope
and needs a client answer first.
