# Tinzshop — Agent Instructions

Tinzshop is an online shop for games, consoles and IT equipment: a storefront,
a staff back office, and a game news section in one bilingual Thai/English
site, priced in Thai baht, selling and shipping within Thailand only. The one
source for what it must do is `docs/reference/client-summary-th.md`.

## Current state

**Phase 1 — planning documentation. No application code exists, and none
should be written yet.**

**The technology stack is undecided.** No framework, database, hosting
provider or e-commerce platform has been chosen. Do not pick one, do not
assume one, and do not scaffold one. See
`docs/decisions/ADR-0001-backend-approach.md`.

**Nothing is agreed.** The source is a client sign-off summary whose every ☐
checkbox is unticked. Every requirement is PROPOSED. Never describe anything
as approved, agreed, confirmed, decided or finalized.

## Hard rules

1. **Never read or open `.env`.** Never print, echo, cat or copy its contents. `.env.example` holds placeholders only and is the file to edit if a variable needs documenting.
2. **Never commit a secret.** No key, password, token, credential or real account identifier goes into any file in this repository, including documentation and commit messages.
3. **Check `docs/project/glossary.md` before naming anything.** Table, field, type, route, variable, file. If the concept is not there, add it there in the same change rather than inventing a local name.
4. **Before creating a new file, search the repository for the concept first** and extend what already exists. Two developers with two agents will otherwise produce two implementations of the same idea under two names.
5. **Do not invent facts.** If the source does not say it, it is not true. Requirements, scope, dates, costs, business rules, API details and integration capabilities are all subject to this.
6. **Do not resolve ambiguity yourself.** Record it in `docs/project/open-questions.md` in the existing format and leave it UNRESOLVED. A contradiction in the source is a question, not a puzzle to solve.
7. **Treat inline Thai notes in the source as meeting notes, not requirements.** They belong under "Client discussion notes" and must never be promoted into scope or implementation instructions.
8. **Never edit `docs/reference/client-summary-th.md`.** It is the client's document.
9. **An Accepted ADR is never edited.** Supersede it with a new one.
10. **Respect file ownership.** Read `docs/collaboration/ownership.md` before editing. Shared files need agreement first.

## Where to look

| Task type | Read |
| :--- | :--- |
| **Any task** | `docs/project/glossary.md` and `docs/collaboration/ownership.md` |
| Understanding the project | `docs/project/overview.md`, then `docs/README.md` |
| What the system must do | `docs/project/requirements.md` |
| Something is unclear or contradictory | `docs/project/open-questions.md` |
| Planning, sequencing, what blocks what | `docs/project/scope-and-phases.md` |
| An external system (payment, Shopee, carriers, email) | `docs/integrations/README.md`, then that system's file |
| Why is it built this way | `docs/decisions/` |
| Choosing a stack or any architectural call | `docs/decisions/ADR-0001-backend-approach.md` and `docs/decisions/README.md` |
| Naming anything | `docs/project/glossary.md` |
| Branching, PRs, plan lifecycle | `docs/collaboration/workflow.md` |
| Who may edit which files | `docs/collaboration/ownership.md` |
| What someone is working on now | `docs/collaboration/status/` and `docs/plans/active/` |

**Do not read `docs/plans/completed/` unless the task is about project
history.** Those plans describe what was true when written, including reversed
decisions and disproved assumptions. Reading them as current intent
reintroduces reverted work. Current intent lives in `docs/project/` and
`docs/plans/active/`.

## Working notes

- Write documentation in English. Thai terms belong in the glossary alongside their English names.
- Reference requirements as `REQ-0NN`, questions as `Q-0NN`, source sections as `§n`.
- Do not create empty or placeholder files. A file with no real content reads as "this topic is settled and empty". If it cannot be filled accurately today, list it under Planned in `docs/README.md` with what blocks it.
- Every change reaches `main` through a pull request.
