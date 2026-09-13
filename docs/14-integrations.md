# External Systems

Every external system named in `reference/client-summary-th.md`, in one file.

> **NOT RESEARCHED is the correct status for every system below.** It means
> nobody has read the vendor's documentation yet. Do not write API details,
> endpoints, pricing, rate limits or capabilities here from memory — look them
> up, then record what you actually found, cite where it came from, and change
> the status.

| Status | Meaning |
| :--- | :--- |
| **NOT RESEARCHED** | Named in the source. Nobody has looked at the vendor's documentation. |
| **RESEARCHED** | Documentation read; capabilities, limits and costs recorded with sources. Still not chosen. |
| **DECIDED** | An ADR in `adr/` records the choice. |

| System | Status | Needed for | Blocks |
| :--- | :--- | :--- | :--- |
| [K-Payment](#k-payment-kasikorn-bank) | NOT RESEARCHED — credentials in hand, sandbox testing next | Card payment, instalments, PromptPay QR — the **sole** payment method | Phase 3 |
| [BigSeller](#bigseller) | NOT RESEARCHED — account exists, data inspection pending | Stock management, daily file sync, shipping/fulfilment, labels | Phase 2 (SKU/Excel), Phase 5 (sync) |
| [Shopee](#shopee) | NOT RESEARCHED — no account yet | Two-way stock sync (Shopee authoritative on conflict), product pairing | Phase 5 |
| [Mail relay](#transactional-email) | NOT RESEARCHED — category decided, provider not chosen | Automatic email at every order step | Phase 3 |
| [Cloudflare](#cloudflare) | DECIDED — Free plan, security/bot scope only | Security, bot verification | Phase 8 |
| [LINE](#line) | NOT RESEARCHED | Displaying the shop's LINE contact | Phase 6 |

**Removed from this list, per the 2026-09-13 answers:**

| Was | Removed by |
| :--- | :--- |
| Shipping carrier (direct integration with Flash / Kerry / Thailand Post) | Q-034, D-075 — shipping is handled entirely through BigSeller |
| PromptPay, standalone | Q-029, D-071 — PromptPay exists only as a QR option inside K-Payment |
| Bank transfer / payment-slip verification | Q-030, D-072 — K-Payment is the sole payment method |

**How these are built.** Each system gets one adapter directory under
`src/server/adapters/<system>/`, implementing an interface the domain declares
(`04-tech-stack-and-structure.md`). No vendor name appears anywhere else in the
codebase. That is what lets phases 2 and 3 proceed while every system on this
page is still unresearched.

### Rules for this file

1. Record only what the source says we need the system for.
2. Record what we do not know as an explicit list, not as silence.
3. **Never write a credential here.** Name what credential is needed and who must supply it.
4. When research is done, change the status in the table and in the section in the same commit, and cite where each fact came from.

---

## K-Payment (Kasikorn Bank)

- **Status:** NOT RESEARCHED — merchant/test credentials already supplied, sandbox testing is the next step · **Named in:** §3, and phase 1 of §11 as a research subject · **Blocks:** Phase 3

### What we need it for

**K-Payment is the sole payment method for this project** (Q-030, D-072 — bank
transfer and standalone PromptPay are both removed). Customers pay by credit
or debit card, by card in instalments, or via PromptPay QR, all reached
through K-Payment, and the system updates payment status automatically from
its callback with no staff action (REQ-016). The §3 discussion notes describe
the customer being linked out to Kasikorn for this. The notes record that this
method carries a fee.

Instalments are confirmed in scope (Q-003, D-089). Refunds are explicitly out
of scope for this system regardless of payment method (Q-036, D-077) — nothing
here needs to push money back out through K-Payment.

### What we do NOT know

- Everything about the interface. No endpoints, no data formats, no callback mechanism, no signing scheme, no error or retry behaviour — the credentials exist, but nobody has exercised them against the sandbox yet.
- Fees and settlement timing.

### Credential required

A K-Payment merchant account and test credentials — §12 item 5. **Already
supplied** (Q-033). Placeholder variable names exist in `.env.example`; they
are guesses until the real interface is read and will change. **Never commit
real values.**

### What it blocks

Phase 3 in full, since it is now the only payment method and phase 3 is where
the shop starts selling. The immediate next step is sandbox testing, not
further research — see `13-open-questions.md`'s residual items. The webhook
rules in `06-api.md` describe what any such integration needs; none of them is
a claim about K-Payment's actual behaviour until that testing happens.

---

## Shopee

- **Status:** NOT RESEARCHED · **Named in:** §4, and phases 1 and 5 of §11 · **Blocks:** Phase 5

### What we need it for

Stock linked with Shopee so a sale on either channel adjusts the other
automatically (REQ-021), and staff able to pair a site product with its Shopee
listing themselves, without a developer (REQ-022).

The source also records an open note to find out how to pull data out of
Shopee, and a phase 2 note asking what Shopee's real-world limitations are and
whether they can be reflected on the site.

### What we do NOT know

- How to get data out of Shopee at all — the source itself raises this as unanswered. See Q-045.
- How a discrepancy between Shopee and site stock is detected, given the daily-file sync (Q-043, D-081). **Shopee is now decided as authoritative when the two disagree** (Q-046, D-082) — what remains open is the mechanism, not the rule.
- How Shopee identifies a listing and how that maps to Parent SKU / ModelSKU, which is itself undefined. See Q-014.
- Whether Shopee's own constraints make any part of REQ-021 impossible.
- Any onboarding, approval or review process for partner access.

### Credential required

A Shopee Partner account and a test shop — §12 item 9, required before phase 5.
Not yet supplied (Q-042).

### What it blocks

Phase 5 stock sync. Also feeds the phase 2 stock model, since a product's
identity has to be mappable to a Shopee listing.

---

## BigSeller

- **Status:** NOT RESEARCHED — account exists, daily-file approach decided, data inspection pending · **Named in:** §4 discussion notes, and phase 1 of §11 · **Blocks:** Phase 2 (catalogue/Excel), Phase 5 (sync)

### What we need it for

The shop already has a BigSeller account (Q-044). It is used for:

1. **Stock sync, decided as daily file export/import** (Q-043, D-081) — not the paid realtime API, which is a future option only if order volume justifies it later.
2. **Shipping and fulfilment** — BigSeller handles all shipping operations; there is no direct carrier integration (Q-034, D-075).
3. **The source of the catalogue's identity rules** — Parent SKU / ModelSKU format (REQ-004, Q-007, Q-014), real stock quantities (Q-011), and the Excel import/export column layout (Q-012, REQ-038) all wait on actually inspecting the account's real data, not on further discussion.

### What we do NOT know

- Everything about the interface and export format — no documentation has been read, and BigSeller has limitations on API access for smaller retailers (Q-044), which is consistent with the daily-file approach being primary.
- How SKU codes are generated, by whom, and how they map to Parent SKU / ModelSKU. This is the single most-blocking research task left in the project — see `13-open-questions.md`'s residual items table.
- Whether BigSeller sits between the site and Shopee, or alongside it.

### Credential required

Account access for a data-inspection session: real product, stock and SKU
examples, plus a sample Excel export. Not yet arranged.

### What it blocks

Phase 2's catalogue model and Excel import cannot be finalized, and phase 5's
sync cannot be built, until this one inspection happens.

---

## Transactional email (mail relay)

- **Status:** NOT RESEARCHED — category decided, provider not chosen · **Named in:** §8 (no provider named) · **Blocks:** Phase 3

### What we need it for

Email sent automatically at every step of an order — the exact step set
depends on the order-status candidate in Q-023 (REQ-041) — and a customer able
to view and filter their own order-status history (REQ-042; this replaced the
earlier "notification opt-out" reading — Q-031, D-073). Staff two-factor is
email OTP (REQ-032, Q-017, D-064), which also runs through this integration.

**The category of solution is decided: a mail-relay service** (Q-032, D-074),
reached through the adapter interface so no vendor name appears in domain
code. The specific provider is not chosen.

### What we do NOT know

- The specific mail-relay provider. Direction is set; the vendor is not (Q-032 residual).
- What the sender address and sender domain should be. The source asks for one mailbox for team tooling, written inconsistently as `tech@tinzshop.com` and `tech@tinzshopl.com` — deprioritized, not blocking (Q-009).
- Who controls DNS for tinzshop.com, which is required to configure sender authentication — the domain owner is known (Q-053) but account access is not yet arranged.
- Whether email must be sent in Thai, English, or the language the customer chose. See Q-018 residual.

### Credential required

A sending account with whichever mail-relay provider is chosen, plus DNS
records on tinzshop.com for sender authentication. Neither the specific
provider nor DNS access has been established yet.

### What it blocks

Phase 3. Order confirmation email is part of the phase where the shop starts
selling for real, and it cannot be delivered reliably without a provider and an
authenticated sender domain.

---

## Cloudflare

- **Status:** DECIDED — Free plan, security/bot scope · **Named in:** phase 1 of §11 as a research subject, and phase 8 as a deliverable · **Blocks:** Phase 8

### What we need it for

**Cloudflare Free**, scoped to basic security and bot protection — WAF managed
rules, bot fight mode, DNS proxying — and no paid tier unless a future
requirement justifies one (Q-054, D-087). No configuration has been written
yet; the plan/scope decision removes the ambiguity that previously blocked
even starting.

### What we do NOT know

- The specific rule configuration — still to be built once DNS access exists.
- Who controls DNS for tinzshop.com. The domain owner is known (Q-053) but account access is not yet arranged.
- How it interacts with hosting, which is deferred — see [ADR-0002](adr/ADR-0002-hosting-and-deployment.md).

### Credential required

A Cloudflare account (Free tier) with control of the tinzshop.com DNS zone,
via the domain owner (Q-053).

### What it blocks

Phase 8 configuration work. `02-scope-and-phases.md` now recommends running
phase 8 alongside the tail of phase 7 rather than strictly after go-live, as
the source's ordering originally implied.

---

## LINE

- **Status:** NOT RESEARCHED · **Named in:** §9 · **Blocks:** Phase 6

### What we need it for

The only mention in the source is §9: the site displays the shop's phone
number, email, **LINE**, opening hours, address, and DBD mark (REQ-045).

As written this is a contact detail to display, not a system to integrate with.
No LINE feature — login, messaging, notifications, LINE Pay, or a chat widget —
is requested anywhere in the source.

This section exists because LINE is a named external system and someone will
eventually ask whether more was intended. **Do not build any LINE integration
on the strength of it.**

### What we do NOT know

- Whether displaying a LINE ID or link is all that is wanted, or whether the shop expects customers to contact them through LINE as a support channel with any system involvement.
- The shop's LINE account identifier, which has not been supplied.
- Whether any LINE capability was discussed verbally. Nothing in the source suggests it.

### Credential required

None for displaying a contact detail. The shop's LINE ID or link is needed as
content, which falls under the shop information the client must supply.

### What it blocks

Nothing beyond the shop information block in phase 6. **If a real LINE
integration is wanted, that is new scope and needs a client answer first.**

---

## Named in the source but not external systems

| Named | Why it is not here |
| :--- | :--- |
| Medusa JS | Named in §4 and phase 1 as an item for the technology decision, not a third-party service. Evaluated and not chosen in [ADR-0001](adr/ADR-0001-backend-approach.md). |
| Excel | A file format the shop already uses, not a hosted system. REQ-038; the shop's current file layout is Q-012. |
| DBD mark | A registration mark to display (§9). An asset to obtain from the client, not an integration. |
