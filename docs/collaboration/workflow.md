# Workflow

How work moves through this repository.

## Branches

Branch off `main`. Name the branch `<type>/<short-description>`, lowercase,
words separated by hyphens.

| Type | Use for |
| :--- | :--- |
| `feat/` | New functionality |
| `fix/` | Correcting broken behaviour |
| `docs/` | Documentation only |
| `chore/` | Tooling, dependencies, repository housekeeping |
| `refactor/` | Restructuring with no behaviour change |

Examples: `feat/product-variant-list`, `docs/adr-0002-stock-sync`,
`fix/invoice-number-sequence`.

Keep branches short-lived. A long-running branch in a two-developer project
with parallel agents becomes a merge problem faster than it becomes a feature.

## Pull requests

**Every change reaches `main` through a pull request. Nobody commits to `main`
directly.** This holds for documentation and for one-line fixes.

A pull request states:

- What changed and why.
- Which requirements (`REQ-0NN`) it implements, if any.
- Which open questions (`Q-0NN`) it depends on. **A PR that assumes an answer to an unresolved question does not merge** — the answer gets recorded first, or the PR waits.
- Whether it changes a shared file or a contract, per `ownership.md`.
- The result of the manual test checklist, if a plan is involved.

The other developer reviews. An agent's review is not a substitute for the
other developer's.

## Plans

A plan is a written description of a piece of work before it is built. Plans
live in two directories and move in one direction only.

### `docs/plans/active/`

Work that is being done now, or is agreed and about to start. One file per
piece of work. A plan carries its own **manual test checklist**: the concrete
things a person clicks through to confirm the work actually behaves correctly.
Not unit tests — the checks a human performs.

### `docs/plans/completed/`

Work that is finished and verified.

### Moving a plan from active to completed

A plan moves **only after every item on its manual test checklist has been
performed and passed**. Not when the code is written. Not when the PR is
approved. Not when it "should work".

1. Run the manual test checklist.
2. Record the outcome in the plan, including anything that failed and what was done about it.
3. `git mv` the file from `plans/active/` to `plans/completed/` — move it, so history follows the file.
4. Land that move in the same PR as the work, or immediately after.

If part of the checklist cannot be run yet — it depends on an unanswered
question or a missing account — the plan stays in `active/` with that noted.
A plan sitting in `completed/` claims the work is verified. Do not make that
claim on its behalf.

## Completed plans are history, not intent

**Never read `docs/plans/completed/` to find out what the project should do
now.** A completed plan describes what was true when it was written, including
decisions later reversed and assumptions later disproved. Reading one as
current intent reintroduces reverted work.

Current intent lives in:

| Question | Source |
| :--- | :--- |
| What must the system do | `docs/project/requirements.md` |
| What is undecided | `docs/project/open-questions.md` |
| Why is it built this way | `docs/decisions/` |
| What is being worked on now | `docs/plans/active/` and `docs/collaboration/status/` |

Read `completed/` only when the task is explicitly about project history.

## Status files

Each developer keeps their own file under `docs/collaboration/status/` —
separate files so they never merge-conflict. Update yours when what you are
working on changes, or when you become blocked. It is the first place the
other developer looks before asking.

## Commits

Small and focused. Present tense, describing what the commit does. Reference
`REQ-0NN` or `Q-0NN` where it clarifies. Never commit a secret, a `.env` file,
or a real credential — see `CLAUDE.md`.
