# PromptPay

- **Status:** NOT RESEARCHED
- **Named in:** §3
- **Blocks:** Phase 3

## What we need it for

PromptPay is listed as a payment method in §3, with the source explicitly
asking the client to state whether it is wanted in the first phase
("หากต้องการในเฟสแรก กรุณาระบุ"). It is recorded as REQ-017.

The §3 discussion notes separately describe a PromptPay QR being offered
inside the K-Payment flow after the customer is linked out to Kasikorn. It is
not clear whether these are the same thing.

## What we do NOT know

- Whether PromptPay is in scope at all, and whether it means a standalone method or only the QR option inside K-Payment. See Q-029.
- If standalone: how a payment would be confirmed. The source describes staff verifying bank transfer slips by hand, but says nothing about how a PromptPay payment is matched to an order.
- Whether it carries a fee. The notes contrast bank transfer as free with K-Payment as fee-bearing, but do not place PromptPay on either side.
- Everything about any provider interface: no documentation has been read.

## Account or credential required

Unknown, because the delivery route is unknown. If PromptPay is reached only
through K-Payment, the K-Payment merchant account covers it (Q-033). If it is
standalone, a separate arrangement is needed and has not been identified.

## What it blocks

Phase 3, if it is in the first phase. This is one of the questions the source
asks the client directly and is still unanswered.
