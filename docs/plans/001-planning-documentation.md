# 001 — Planning documentation

- **Status:** In progress — 2026-09-10
- **Phase:** 1
- **Requirements delivered:** none. This documentation is itself the deliverable.
- **Blocked by:** Q-001, Q-002, Q-003, Q-004, Q-005, Q-006, Q-007, Q-009

## Goal

Produce the planning documents §11 phase 1 asks for: the detail of the work,
the division of work, the scope, the working method, a clear project
structure, and — explicitly — identifying what is not yet known and making it
clear.

The source names five subjects to get clear on: Cloudflare, Shopee, BigSeller,
Medusa JS and K-Payment.

## Build checklist

- [x] Scope and phases, with every requirement folded in — `../02-scope-and-phases.md`
- [x] Open questions recorded and left unresolved — `../13-open-questions.md`
- [x] Glossary covering every domain term in Thai and English — `../12-glossary.md`
- [x] Project overview, including non-goals — `../01-overview.md`
- [x] Software architecture — `../03-architecture.md`
- [x] Tech stack and project structure — `../04-tech-stack-and-structure.md`
- [x] Database model and its rules — `../05-database.md`
- [x] API conventions — `../06-api.md`
- [x] Frontend component standard — `../07-frontend-components.md`
- [x] Security, testing and validation — `../08-security-testing.md`
- [x] Coding guidelines, ownership and workflow — `../09-coding-guidelines.md`
- [x] Deployment requirements — `../10-deployment.md`
- [x] Single decision register — `../11-decisions.md`
- [x] External systems consolidated — `../14-integrations.md`
- [x] Backend approach decided and recorded — `../adr/ADR-0001-backend-approach.md`
- [x] Hosting decision framed and deliberately deferred — `../adr/ADR-0002-hosting-and-deployment.md`
- [ ] Path ownership assigned between the two developers — `../09-coding-guidelines.md` Part 2
- [ ] Research: **Medusa JS** — done as part of ADR-0001, which evaluated and did not choose it
- [ ] Research: **K-Payment** — status NOT RESEARCHED, blocked by Q-033 (no merchant account)
- [ ] Research: **Shopee** — status NOT RESEARCHED, blocked by Q-042 (no partner account)
- [ ] Research: **BigSeller** — status NOT RESEARCHED, blocked by Q-043 and Q-044
- [ ] Research: **Cloudflare** — status NOT RESEARCHED, blocked by Q-054 (scope undefined)

## Manual test checklist

- [ ] Every internal link in `docs/` resolves. No link points at a file that was moved or removed.
- [ ] Every `REQ-0NN` referenced anywhere exists in `../02-scope-and-phases.md`.
- [ ] Every `Q-0NN` referenced anywhere exists in `../13-open-questions.md`.
- [ ] Every `D-0NN` and `ADR-000N` referenced anywhere exists in `../11-decisions.md`.
- [ ] No document describes any requirement as approved, agreed, confirmed, decided or finalized.
- [ ] No document states a fact about an external system that was not read from that vendor's documentation.
- [ ] Every name used in the technical documents appears in `../12-glossary.md`.
- [ ] No secret, credential or real account identifier appears anywhere in the repository.
- [ ] `../reference/client-summary-th.md` is unchanged from the client's original.
- [ ] The client has read the open questions and the phase list.

## Outcome

Documentation restructured on 2026-09-10 from the earlier nested layout into
this flat numbered set, and extended with the seven technical documents.
`docs/project/requirements.md` was folded into `../02-scope-and-phases.md` with
every `REQ-0NN` identifier preserved.

The backend approach was decided during this work (ADR-0001, Accepted) and
hosting was deliberately deferred to phase 7 (ADR-0002, Deferred).

**Not complete.** Ownership is unassigned, four of the five named research
subjects remain unresearched because each is blocked on an account or an
answer the client has not provided, and the manual checklist has not been run.
