# Tinzshop Documentation

Start here. Everything in this folder derives from one source:
`reference/client-summary-th.md`.

> **That source is a CLIENT SIGN-OFF SUMMARY, not an approved requirements
> spec. Every ☐ checkbox in it is UNCONFIRMED. Nothing in this project is
> agreed yet.** See Q-001 in `13-open-questions.md`.

The technology stack **is** decided — Next.js, TypeScript, PostgreSQL and
Prisma ([ADR-0001](adr/ADR-0001-backend-approach.md)). Hosting deliberately is
not ([ADR-0002](adr/ADR-0002-hosting-and-deployment.md)).

## Read in this order

| # | File | What it is |
| :--- | :--- | :--- |
| | [01-overview.md](01-overview.md) | What Tinzshop is, who uses it, what is explicitly excluded |
| | [02-scope-and-phases.md](02-scope-and-phases.md) | **The scope document.** Requirements REQ-001…REQ-055, the confirmed phase schedule, and the 100,000 THB budget |
| 0 | [03-architecture.md](03-architecture.md) | The layers, the flows that carry the risk, the four invariants |
| 1 | [04-tech-stack-and-structure.md](04-tech-stack-and-structure.md) | What it is built with, and where every file goes |
| 2 | [05-database.md](05-database.md) | The model, the concurrency rules, invoice numbering, migrations |
| 3 | [06-api.md](06-api.md) | Server Actions versus route handlers, validation, errors, webhooks |
| 4 | [07-frontend-components.md](07-frontend-components.md) | Component tiers, bilingual rules, forms, responsive, accessibility |
| 5 | [08-security-testing.md](08-security-testing.md) | Security, testing and validation, and the pre-merge checklist |
| 6 | [09-coding-guidelines.md](09-coding-guidelines.md) | Code rules, file ownership, branches, pull requests, plans |
| 8 | [10-deployment.md](10-deployment.md) | What deployment must satisfy, including the proposed backup strategy. No hosting provider named — see ADR-0002 |
| 7 | [11-decisions.md](11-decisions.md) | **Every decision, one sentence each.** The register |
| | [12-glossary.md](12-glossary.md) | English / Thai / definition / identifier for every domain term |
| | [13-open-questions.md](13-open-questions.md) | 55 questions (Q-001…Q-055) — 37 resolved, 5 partially resolved, 13 still open. See its residual-items table for what's left to chase |
| | [14-integrations.md](14-integrations.md) | Every external system — K-Payment, BigSeller, Shopee, mail relay, Cloudflare |
| | [15-acceptance-criteria.md](15-acceptance-criteria.md) | What must pass before each phase is considered complete, and who signs off |

## Folders

| Folder | What is in it |
| :--- | :--- |
| [adr/](adr/) | Full architecture decision records. Summarised in `11-decisions.md` |
| [plans/](plans/) | One numbered plan per phase, each carrying its own checklists. `001`, `002`, … |
| [status/](status/) | One file per developer: what they are working on now |
| [reference/](reference/) | The client's original Thai document. **Never edit it** |

## Conventions

| Marker | Means |
| :--- | :--- |
| `REQ-0NN` | A requirement in `02-scope-and-phases.md`. **All are PROPOSED** |
| `Q-0NN` | An open question in `13-open-questions.md` |
| `D-0NN` | A design decision in `11-decisions.md` |
| `ADR-000N` | An architecture decision record in `adr/` |
| `§n` | A section of the Thai source document |
| **Client discussion notes** | Loose Thai notes from the source. Meeting notes, never requirements |

## The rules that matter most

1. **Never read or open `.env`.** Edit `.env.example` instead.
2. **Never commit a secret**, credential or real account identifier — including in documentation and commit messages.
3. **Check `12-glossary.md` before naming anything.** If the concept is missing, add it there in the same change.
4. **Before creating a file, search for the concept first** and extend what exists.
5. **Do not invent facts.** If the source does not say it, it is not true.
6. **Do not resolve an ambiguity yourself.** Record it in `13-open-questions.md` and leave it UNRESOLVED.
7. **Never edit `reference/client-summary-th.md`.** It is the client's document.
8. **An Accepted ADR is never edited.** Supersede it.

## What is deliberately not written

Not written because writing it today would mean inventing a fact. **Do not
create these as empty files.**

| Missing | Blocked on |
| :--- | :--- |
| The order status model and its transitions | Q-023 — a candidate is proposed for client review in `13-open-questions.md`, but not adopted |
| Non-functional requirements | The source states no performance, availability or load target at all |
| Vendor interface detail for K-Payment, BigSeller, Shopee | All three are NOT RESEARCHED — credentials/accounts exist for K-Payment and BigSeller, but nobody has exercised either yet; Shopee has neither an account nor research |
| `reference/contract-th.md` | Q-007 — no longer expected to appear; Parent SKU/ModelSKU format and the role model are now resolved separately (BigSeller data inspection, and Q-015/Q-016) |
| The exact simplified tax invoice fields, and the export shape for the separate full-invoice system | Q-027 — waits on an example invoice |
| The exact shipping-label layout | Q-039 — waits on an example label |
| The accounting export's columns | Q-050 — pending review |

**Resolved since the last revision** (previously listed here): the permissions
matrix — six roles, owner edits only, no new-role creation (Q-015, Q-016); and
the stock-sync approach — daily file, decided (Q-043, D-081).
