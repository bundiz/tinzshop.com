# Transactional email

- **Status:** NOT RESEARCHED
- **Named in:** §8 (no provider named)
- **Blocks:** Phase 3

## What we need it for

The source requires the system to send email automatically at every step of an
order — order received, payment confirmed, shipped, cancelled, refunded
(REQ-041) — and requires customers to be able to switch notifications on and
off for themselves (REQ-042).

Staff two-step verification may also be delivered by email (REQ-032), depending
on Q-017.

## What we do NOT know

- No sending provider is named anywhere in the source. The choice is entirely open.
- What the sender address and sender domain should be. The source asks for one mailbox for team tooling, written inconsistently as `tech@tinzshop.com` and `tech@tinzshopl.com` — see Q-009.
- Who controls DNS for tinzshop.com, which is required to configure sender authentication. See Q-053.
- Which emails a customer may switch off. Letting a customer disable payment or shipping confirmations creates disputes, and the source does not separate transactional from optional mail. See Q-031.
- Whether email must be sent in Thai, English, or the language the customer chose. See Q-018.
- Whether phone OTP is also needed, which would add an SMS provider that appears nowhere in the source. See Q-017.

## Account or credential required

A sending account with whichever provider is chosen, plus DNS records on
tinzshop.com for sender authentication. Neither the provider nor DNS control
has been established.

## What it blocks

Phase 3. Order confirmation email is part of the phase where the shop starts
selling for real, and it cannot be delivered reliably without a provider and
an authenticated sender domain.
