# Tinzshop Documentation

Start here. Everything in this folder derives from one source:
`reference/client-summary-th.md`.

> **That source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements
> spec. Every ☐ checkbox in it is UNCONFIRMED. Nothing in this project is
> agreed yet.** See Q-001 in `project/open-questions.md`.

The technology stack is undecided. No document here chooses one, and none
should until `decisions/ADR-0001-backend-approach.md` is accepted.

## Written

| File | What it is |
| :--- | :--- |
| [project/overview.md](project/overview.md) | What Tinzshop is, who uses it, and what is explicitly excluded |
| [project/requirements.md](project/requirements.md) | 53 numbered requirements (REQ-001…REQ-053), all PROPOSED, grouped by area, with client discussion notes kept separate |
| [project/scope-and-phases.md](project/scope-and-phases.md) | The nine delivery phases, their deliverables, and what blocks each |
| [project/open-questions.md](project/open-questions.md) | 55 unresolved questions (Q-001…Q-055), sorted by the phase they block |
| [project/glossary.md](project/glossary.md) | English / Thai / definition / code identifier for every domain term |
| [integrations/README.md](integrations/README.md) | Every external system with its research status and what it blocks |
| [integrations/k-payment.md](integrations/k-payment.md) | Kasikorn card and QR payment — NOT RESEARCHED |
| [integrations/shopee.md](integrations/shopee.md) | Marketplace stock sync — NOT RESEARCHED |
| [integrations/bigseller.md](integrations/bigseller.md) | Cross-channel stock management — NOT RESEARCHED |
| [integrations/shipping-carriers.md](integrations/shipping-carriers.md) | Flash / Kerry / Thailand Post, none chosen — NOT RESEARCHED |
| [integrations/promptpay.md](integrations/promptpay.md) | Instant transfer, scope unclear — NOT RESEARCHED |
| [integrations/transactional-email.md](integrations/transactional-email.md) | Order emails, no provider named — NOT RESEARCHED |
| [integrations/cloudflare.md](integrations/cloudflare.md) | Security and bot verification, scope undefined — NOT RESEARCHED |
| [integrations/line.md](integrations/line.md) | Contact detail only; no integration requested — NOT RESEARCHED |
| [decisions/README.md](decisions/README.md) | The ADR convention and its rules |
| [decisions/ADR-0001-backend-approach.md](decisions/ADR-0001-backend-approach.md) | Frames the stack decision and its criteria; decides nothing |
| [collaboration/ownership.md](collaboration/ownership.md) | Who may edit what, and the rules for shared files and contracts |
| [collaboration/workflow.md](collaboration/workflow.md) | Branches, PRs, and how plans move from active to completed |
| [collaboration/status/agent-a.md](collaboration/status/agent-a.md) | Developer A's working status |
| [collaboration/status/agent-b.md](collaboration/status/agent-b.md) | Developer B's working status |
| [reference/client-summary-th.md](reference/client-summary-th.md) | The client's original Thai document. The only source. Never edit it. |

## Planned

Not written, because writing them today would mean inventing facts. Each is
listed with what unblocks it. **Do not create these as empty files.**

| File | Blocked on |
| :--- | :--- |
| `project/order-lifecycle.md` | Q-023 — the source never enumerates order statuses or their transitions |
| `project/permissions-matrix.md` | Q-015 and Q-016 — "4 levels" contradicts six listed roles, and it is unknown which permissions are configurable |
| `project/data-model.md` | Q-008 (no stack), plus Q-013, Q-014 and Q-023 — variant depth, SKU format and statuses are all undefined |
| `project/non-functional-requirements.md` | The source states no performance, availability or load targets at all. Needs a client conversation before anything can be written |
| `decisions/ADR-0002-stock-sync-approach.md` | Q-043 — BigSeller live API versus daily file import is undecided, and Q-006 (no budget) prevents weighing the paid option |
| `decisions/ADR-0003-hosting-and-deployment.md` | Q-008 — depends on the backend decision in ADR-0001, and Q-053 (production ownership) |
| `collaboration/testing.md` | Q-008 — test tooling cannot be described before a stack exists. Manual test checklists live in individual plans meanwhile |
| `integrations/sms-otp.md` | Q-017 — only needed if staff OTP goes by phone rather than email. No SMS provider is named anywhere in the source |
| `reference/contract-th.md` | Q-007 — the contract defining the Parent SKU / ModelSKU scheme and the agreed permission levels has not been provided |
| `plans/active/*` | Ownership assignments in `collaboration/ownership.md` are still TODO, and Q-001 means no scope is agreed to plan against |

## Conventions

- `REQ-0NN` — a requirement in `project/requirements.md`. All are PROPOSED.
- `Q-0NN` — an open question in `project/open-questions.md`.
- `ADR-000N` — a decision record in `decisions/`.
- `§n` — a section of the Thai source document.
- **Client discussion notes** — loose Thai notes from the source. Meeting notes, never requirements.
