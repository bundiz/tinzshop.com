# External Systems

Every external system named in `docs/reference/client-summary-th.md`.

> The source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements spec.
> No integration below has been agreed, researched or decided.

**NOT RESEARCHED is the correct status for every row today.** It means nobody
has read the vendor's documentation yet. Do not write API details, endpoints,
pricing, rate limits or capabilities into these files from memory — look them
up, then record what you actually found and change the status.

| Status | Meaning |
| :--- | :--- |
| NOT RESEARCHED | Named in the source. Nobody has looked at the vendor's documentation. |
| RESEARCHED | Documentation read and capabilities, limits and costs recorded with sources. Still not chosen. |
| DECIDED | An accepted ADR in `../decisions/` records the choice. |

| System | Status | Needed for | Blocks | File |
| :--- | :--- | :--- | :--- | :--- |
| K-Payment (Kasikorn Bank) | NOT RESEARCHED | Card payment, PromptPay QR, possibly instalments | Phase 4 | [k-payment.md](k-payment.md) |
| Shopee | NOT RESEARCHED | Two-way stock sync, product pairing | Phase 5 | [shopee.md](shopee.md) |
| BigSeller | NOT RESEARCHED | Stock management across channels | Phase 5 | [bigseller.md](bigseller.md) |
| Shipping carrier (Flash / Kerry / Thailand Post) | NOT RESEARCHED | Shipping cost, tracking, labels | Phase 4 | [shipping-carriers.md](shipping-carriers.md) |
| PromptPay | NOT RESEARCHED | Bank-transfer-free instant payment | Phase 3 | [promptpay.md](promptpay.md) |
| Transactional email | NOT RESEARCHED | Automatic email at every order step | Phase 3 | [transactional-email.md](transactional-email.md) |
| Cloudflare | NOT RESEARCHED | Security, bot verification | Phase 8 | [cloudflare.md](cloudflare.md) |
| LINE | NOT RESEARCHED | Displaying the shop's LINE contact | Phase 6 | [line.md](line.md) |

## Named in the source but not external systems

| Named | Why it is not here |
| :--- | :--- |
| Medusa JS | Named in §4 and phase 1 as an item for the technology decision, not a third-party service to integrate with. Tracked in [../decisions/ADR-0001-backend-approach.md](../decisions/ADR-0001-backend-approach.md) and Q-008. |
| Excel | A file format the shop already uses, not a hosted system. Requirement REQ-038; the shop's current file layout is Q-012. |
| DBD mark | A registration mark to display on the site (§9). An asset to obtain from the client, not an integration. |

## Rules for these files

1. Record only what the source says we need the system for.
2. Record what we do not know as an explicit list, not as silence.
3. Never write a credential into these files. Name what credential is needed and who must supply it.
4. When research is done, change the status here and in the system's own file in the same commit, and cite where each fact came from.
