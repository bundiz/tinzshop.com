# K-Payment (Kasikorn Bank)

- **Status:** NOT RESEARCHED
- **Named in:** §3, and phase 1 of §11 as a research subject
- **Blocks:** Phase 4

## What we need it for

The source states that customers pay by credit or debit card through K-Payment
and the system updates payment status automatically with no staff action
(REQ-016). The §3 discussion notes describe the customer being linked out to
Kasikorn, where they can use a PromptPay QR, pay by card immediately, or pay by
card in instalments, and a callback returning to update the status to paid. The
notes record that this method carries a fee, unlike bank transfer.

Refunds, full and partial, are required (REQ-018), but the source never says
whether card refunds go back through K-Payment. See Q-036.

## What we do NOT know

- Everything about the interface: no documentation has been read. No endpoints, no data formats, no callback mechanism, no error behaviour.
- Whether instalments are in scope at all — the source both includes and excludes them. See Q-003.
- Whether PromptPay is reached only through K-Payment or also standalone. See Q-029.
- Whether refunds can be issued through it, and whether partial refunds are supported. See Q-036.
- Fees, settlement timing, and any onboarding or approval process for the shop.
- What the test environment looks like and how long access takes to obtain.

## Account or credential required

A K-Payment merchant account and test credentials, listed by the client as
§12 item 5 and required before phase 4. Not yet supplied — see Q-033.

Placeholder variable names exist in `.env.example`; they are guesses and will
change once the interface is known. Never commit real values.

## What it blocks

Phase 4 in full: card payment cannot be built, tested, or estimated. Q-003
must also be answered before the scope of this integration is even known.
