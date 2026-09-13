# Tinzshop — Agent Instructions

Tinzshop is an online shop for games, consoles and IT equipment: a storefront,
a staff back office, and a game news section in one bilingual Thai/English
site, priced in Thai baht, selling and shipping within Thailand only. The one
source for what it must do is `docs/reference/client-summary-th.md`.

## Current state

**Phase 1 — planning documentation. No application code exists yet.**

**The stack is decided.** Next.js (App Router), TypeScript, PostgreSQL and
Prisma, as one route-grouped application, with the commerce domain written
in-house — `docs/adr/ADR-0001-backend-approach.md`, Accepted. Build to it; do
not re-litigate it, and do not introduce a second framework, ORM or database.

**Hosting is deliberately not decided** and is deferred to phase 7 —
`docs/adr/ADR-0002-hosting-and-deployment.md`. Never write provider-specific
code or name a host as chosen.

**The client has confirmed the requirements (Q-001, 2026-09-13).** Every
`REQ-0NN` in `docs/02-scope-and-phases.md` not individually marked REMOVED is
CONFIRMED, not PROPOSED. 55 open questions have been answered or narrowed —
see `docs/13-open-questions.md` for the full record: 37 RESOLVED, 5 PARTIALLY
RESOLVED, 13 still genuinely UNRESOLVED (most waiting on a BigSeller
data-inspection session or a Shopee account). Total budget is 100,000 THB and
a proposed schedule exists — `docs/02-scope-and-phases.md#schedule-and-budget`
— but it is a project-side proposal pending client confirmation, not itself a
client commitment. Only *our own* engineering decisions in
`docs/11-decisions.md` are Accepted in the strict ADR sense; treat both that
register and the RESOLVED rows in `docs/13-open-questions.md` as build-to.

**Implementation has not started and is still blocked.** Plan 002 cannot begin
while Q-013 (the practical option-type cap, pending Shopee/Lazada research)
and Q-014 (SKU format, pending a BigSeller data-inspection session) are open —
they are the shape of the catalogue. Do not scaffold the application to get
ahead of them. K-Payment is now the **sole** payment method (bank transfer and
standalone PromptPay are removed) and stock is deducted at payment
confirmation, not at order placement — see D-068, D-072.

## Hard rules

1. **Never read or open `.env`.** Never print, echo, cat or copy its contents. `.env.example` holds placeholders only and is the file to edit if a variable needs documenting.
2. **Never commit a secret.** No key, password, token, credential or real account identifier goes into any file in this repository, including documentation and commit messages.
3. **Check `docs/12-glossary.md` before naming anything.** Table, field, type, route, variable, file. If the concept is not there, add it there in the same change rather than inventing a local name.
4. **Before creating a new file, search the repository for the concept first** and extend what already exists. Two developers with two agents will otherwise produce two implementations of the same idea under two names.
5. **Do not invent facts.** If the source does not say it, it is not true. Requirements, scope, dates, costs, business rules, API details and integration capabilities are all subject to this.
6. **Do not resolve ambiguity yourself.** Record it in `docs/13-open-questions.md` in the existing format and leave it UNRESOLVED. A contradiction in the source is a question, not a puzzle to solve.
7. **Treat inline Thai notes in the source as meeting notes, not requirements.** They belong under "Client discussion notes" and must never be promoted into scope or implementation instructions.
8. **Never edit `docs/reference/client-summary-th.md`.** It is the client's document.
9. **An Accepted ADR is never edited.** Supersede it with a new one.
10. **Respect file ownership.** Read `docs/09-coding-guidelines.md` Part 2 before editing. Shared files need agreement first.
11. **Every decision gets a one-line row in `docs/11-decisions.md`** plus its reasoning in the document that owns the topic — both, in the same change, or neither.
12. **Never assume an order status.** The set is not defined (Q-023).

## Where to look

| Task type | Read |
| :--- | :--- |
| **Any task** | `docs/12-glossary.md` and `docs/09-coding-guidelines.md` |
| Understanding the project | `docs/01-overview.md`, then `docs/README.md` |
| What the system must do, and in what order | `docs/02-scope-and-phases.md` |
| Something is unclear or contradictory | `docs/13-open-questions.md` |
| How the system is put together | `docs/03-architecture.md` |
| Where a file goes, or what to name it | `docs/04-tech-stack-and-structure.md` |
| Schema, migrations, concurrency, invoice numbers | `docs/05-database.md` |
| Endpoints, validation, errors, webhooks | `docs/06-api.md` |
| Writing a component, a form, or anything bilingual | `docs/07-frontend-components.md` |
| Security, tests, or the pre-merge checklist | `docs/08-security-testing.md` |
| Code style, branches, PRs, plans | `docs/09-coding-guidelines.md` |
| Anything about running it in production | `docs/10-deployment.md` |
| What has been decided, and why | `docs/11-decisions.md`, then `docs/adr/` |
| An external system (payment, Shopee, BigSeller, mail relay) | `docs/14-integrations.md` |
| What must pass before a phase is done, and who signs off | `docs/15-acceptance-criteria.md` |
| What is being worked on now | `docs/plans/` and `docs/status/` |

## Working notes

- Write documentation in English. Thai terms belong in the glossary alongside their English names.
- Reference requirements as `REQ-0NN`, questions as `Q-0NN`, decisions as `D-0NN`, source sections as `§n`.
- Do not create empty or placeholder files. A file with no real content reads as "this topic is settled and empty". If it cannot be filled accurately today, list it under *What is deliberately not written* in `docs/README.md` with what blocks it.
- Plans live flat in `docs/plans/`, numbered `001`, `002`, … There is no active or completed directory: a plan's state is the checklist inside it. **Never tick a manual test box for a check nobody performed.**
- Every change reaches `main` through a pull request.
