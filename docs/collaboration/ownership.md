# Ownership

Two developers work on this project in parallel, each assisted by an AI agent.
That means four actors editing one repository, two of which will happily
rewrite a file they were not asked to touch. These rules exist to stop that.

## Rule 1 — Ownership is by file and directory, never by feature

"I own checkout" is not ownership. Checkout touches products, stock, payment,
tax, email and the admin panel, and so does everything else. Two people who
both believe they own a feature will edit the same files and find out at merge
time.

Ownership is always a path: a directory, or a named file. If you cannot state
your ownership as a path, you do not have ownership yet — agree one first.

## Rule 2 — Shared files require agreement before either party edits

Some files are unavoidably shared. Nobody edits a shared file without telling
the other developer first and getting an answer. Not a notification — an
agreement.

Shared from day one:

- `CLAUDE.md`
- `docs/project/glossary.md`
- `docs/project/requirements.md`
- `docs/project/open-questions.md`
- `docs/project/scope-and-phases.md`
- `docs/decisions/**`
- `docs/integrations/**`
- `.gitignore`, `.env.example`
- Any dependency manifest or lockfile
- Any build, lint or CI configuration

Everything under `docs/collaboration/status/` is the exception: one file per
developer precisely so they never collide.

## Rule 3 — A contract change stops parallel work

A contract is anything the other side's code depends on: a shared type, a
function signature, an event shape, a database column, a route, a config key,
a glossary term. Changing one is not a normal edit.

When a contract changes:

1. Say so before making the change, not after.
2. Both developers stop starting new work that depends on it.
3. Agree the new shape and write it down — glossary entry, ADR, or plan.
4. Land the change and both sides update to it before parallel work resumes.

The cost of a five-minute conversation is always lower than two half-finished
implementations of different contracts.

## Rule 4 — Rules apply to the agents too

Your AI agent works under your ownership, not its own. If your agent edits a
file you do not own, that is your rule violation. Tell your agent what you own
at the start of a session. `CLAUDE.md` points every agent here for this reason.

## Rule 5 — Before creating a file, search for the concept

Two developers with two agents will produce two implementations of the same
idea under two names within a week. Before adding a file, grep the repository
for the concept, check `glossary.md` for its agreed name, and extend what
exists instead of starting a parallel version.

## Assignments

**TODO — to be filled in by the project owner.** Nothing is assigned yet.
Until this table is filled, treat every path as shared and ask first.

| Path | Owner | Notes |
| :--- | :--- | :--- |
| *(TODO)* | *(TODO)* | |
| *(TODO)* | *(TODO)* | |
| *(TODO)* | *(TODO)* | |

Shared paths — no single owner, Rule 2 applies:

| Path | Notes |
| :--- | :--- |
| `CLAUDE.md` | Agent instructions |
| `docs/project/**` | Requirements, glossary, questions, phases |
| `docs/decisions/**` | ADRs; Accepted ones are never edited |
| `docs/integrations/**` | External system research |
| `.gitignore`, `.env.example` | Repository hygiene |
