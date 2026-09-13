# Coding Guidelines and Working Rules

How code is written here, who may write which file, and how a change reaches
`main`.

## Part 1 — Writing code

### Principles

1. **Write code that reads like the code around it.** Match the surrounding naming, comment density and idiom. A file where one function is written in a different style costs every future reader a moment working out whether the difference means something.
2. **Make the invalid unrepresentable.** A type that cannot express a negative quantity beats a check that catches one.
3. **Fail loudly and early.** A missing environment variable should stop the process at boot, not surface as `undefined` during a payment.
4. **Clarity over cleverness.** This codebase is read by two developers, two agents, and whoever maintains it afterwards.
5. **Delete rather than comment out.** Git remembers. Commented-out code is a question nobody can answer.

### Names

Conventions are in `04-tech-stack-and-structure.md`. The rule above them:

**Check `12-glossary.md` before naming anything** — a table, a field, a type, a
route, a variable, a file. If the concept is not there, add it there in the
same pull request rather than inventing a local name.

The database identifier is canonical. TypeScript adapts casing; it never
changes the words. `model_sku` becomes `modelSku`, never `variantCode`.

### TypeScript

| Rule | Why |
| :--- | :--- |
| `strict` on. Never disabled per file | — |
| **No `any`.** Use `unknown` and narrow it | `any` disables checking for everything downstream, silently |
| No `as` to escape a type error | A cast is a claim the compiler cannot verify. If it is genuinely needed, comment why |
| No non-null `!` on anything from outside the module | If it can be null, handle null |
| Return types are explicit on exported functions | The signature is the contract, and inference makes it change silently |
| Prefer `type` over `interface` unless declaration merging is wanted | One way to do it |
| Discriminated unions over optional-field soup | `Result<T>` in `06-api.md` is the pattern |
| `readonly` for anything not meant to be mutated | — |
| No enums. Use a union of string literals | Simpler at runtime, and serialises honestly |

### Functions and modules

- One export per file where it is the file's reason to exist. Helpers used only there stay unexported.
- A function does one thing. If its name needs "and", it is two functions.
- Four parameters is a smell; take an object.
- No default exports except React components and Next's own conventions. A named export cannot be silently renamed at the import site.
- No module-level mutable state. It is shared across requests on the server, which is a bug that only appears under load.

### Errors

Follow `06-api.md`. In short:

- **Expected outcomes are returned, not thrown.** Out of stock, permission denied, validation failed — all `Result` values.
- **`throw` is for bugs and genuine failures.** A broken invariant, a lost connection.
- Never swallow an error. `catch {}` with an empty body is forbidden; if it is genuinely ignorable, say why in a comment.
- Never catch, log, and rethrow the same error at every level. Handle it once, at the level that can do something about it.
- An error message says what failed and what the caller should do. "Error" is not a message.

### Imports and boundaries

The layering in `03-architecture.md` is enforced by lint, not by good
intentions. It fails the build when:

- `src/server/domain/` imports React, Next, or the Prisma client.
- `src/app/` imports Prisma directly instead of going through `src/server/data/`.
- `src/components/ui/` imports anything from `src/server/`.
- A vendor SDK is imported outside its `src/server/adapters/<system>/` directory.

Import ordering is Prettier's job. Absolute paths (`@/server/domain/...`) for
anything outside the current directory; relative only for siblings.

### Comments

Comment **why**, never **what**. The code says what it does.

Worth a comment: a non-obvious business rule and where it comes from; a
workaround and what it works around; a deliberate deviation from these
guidelines and its reason; anything a reader would otherwise be tempted to
"simplify" into a bug.

Not worth a comment: restating the line below it, a changelog (git has one), a
name (`// the user` above `const user`).

Reference requirements and questions where they clarify: `REQ-0NN`, `Q-0NN`,
`§n`. A comment saying `// VAT is 7% — REQ-023, and whether prices include it
is Q-010` is worth ten lines of prose.

### Async

- `await` everything, or handle the promise. A floating promise is an error that vanishes.
- Independent work runs in parallel — `Promise.all`, not a sequential chain of awaits.
- Never hold a database transaction open across a network call to an external system. See `05-database.md`.
- Every outbound call has a timeout. A provider that hangs must not hang us.

### Never do these

| Never | Instead |
| :--- | :--- |
| Read, print or copy `.env` | Edit `.env.example` |
| Commit a secret, credential or real account identifier | A placeholder |
| Store money as a float | Integer satang (D-010) |
| Change stock outside a locked transaction | `05-database.md` |
| Check permission only in the UI | The domain layer (D-041) |
| Write a user-facing string literally in a component | A message key (D-032) |
| Invent an order status | Q-023 is unresolved (D-018) |
| Edit `docs/reference/client-summary-th.md` | It is the client's document |
| Edit an Accepted ADR | Supersede it |
| Resolve an ambiguity in the source yourself | Record it in `13-open-questions.md` and leave it UNRESOLVED |

---

## Part 2 — Ownership

Two developers, each assisted by an agent. Four actors editing one repository,
two of which will happily rewrite a file they were not asked to touch. These
rules exist to stop that.

### Rule 1 — Ownership is a path, never a feature

"I own checkout" is not ownership (D-046). Checkout touches products, stock,
payment, tax, email and the admin panel, and so does everything else. Two
people who both believe they own a feature will edit the same files and find
out at merge time.

Ownership is always a path: a directory, or a named file. If you cannot state
your ownership as a path, you do not have ownership yet — agree one first.

The route groups in `04-tech-stack-and-structure.md` exist partly for this:
`(shop)` and `(admin)` are separate directories and can be separately owned.

### Rule 2 — Shared files need agreement before either party edits

Not a notification — an agreement.

Shared from day one:

- `CLAUDE.md`
- `docs/12-glossary.md`
- `docs/13-open-questions.md`
- `docs/02-scope-and-phases.md`
- `docs/11-decisions.md` and `docs/adr/**`
- `docs/14-integrations.md`
- `prisma/schema.prisma` and `prisma/migrations/**`
- `src/server/domain/**`
- `.gitignore`, `.env.example`
- Any dependency manifest or lockfile
- Any build, lint or CI configuration

`docs/status/` is the exception: one file per developer, precisely so they
never collide.

### Rule 3 — A contract change stops parallel work

A contract is anything the other side depends on: a shared type, a function
signature, a database column, a route, a config key, a message key, a glossary
term. Changing one is not a normal edit.

1. Say so before making the change, not after.
2. Both developers stop starting new work that depends on it.
3. Agree the new shape and write it down — a glossary entry, a `D-0NN` row, or a plan.
4. Land the change, and both sides update to it before parallel work resumes.

A five-minute conversation always costs less than two half-finished
implementations of different contracts.

### Rule 4 — The rules apply to the agents

Your agent works under your ownership, not its own. If your agent edits a file
you do not own, that is your rule violation. Tell your agent what you own at
the start of a session. `CLAUDE.md` points every agent here for this reason.

### Rule 5 — Before creating a file, search for the concept

Two developers with two agents will produce two implementations of the same
idea under two names within a week. Before adding a file: grep the repository
for the concept, check `12-glossary.md` for its agreed name, and extend what
exists.

This is the rule most often skipped and most expensive when it is.

### Assignments

**TODO — to be filled in by the project owner. Nothing is assigned yet.**
Until this table is filled, treat every path as shared and ask first.

| Path | Owner | Notes |
| :--- | :--- | :--- |
| *(TODO)* | *(TODO)* | |
| *(TODO)* | *(TODO)* | |

---

## Part 3 — Workflow

### Branches

Branch off `main`. Name it `<type>/<short-description>`, lowercase, hyphenated.

| Type | For |
| :--- | :--- |
| `feat/` | New functionality |
| `fix/` | Correcting broken behaviour |
| `docs/` | Documentation only |
| `chore/` | Tooling, dependencies, housekeeping |
| `refactor/` | Restructuring with no behaviour change |

Keep them short-lived. A long branch in a two-developer project with parallel
agents becomes a merge problem faster than it becomes a feature.

### Commits

Small and focused. Present tense, describing what the commit does. Reference
`REQ-0NN` or `Q-0NN` where it clarifies. **Never commit a secret, a `.env`
file, or a real credential.**

### Pull requests

**Every change reaches `main` through a pull request. Nobody commits to `main`
directly (D-045).** This holds for documentation and for one-line fixes.

A pull request states:

- What changed and why.
- Which requirements (`REQ-0NN`) it implements, if any.
- Which open questions (`Q-0NN`) it depends on. **A pull request that assumes an answer to an unresolved question does not merge (D-047)** — the answer gets recorded first, or the pull request waits.
- Whether it changes a shared file or a contract, per Part 2.
- The result of the plan's manual checklist, if a plan is involved.
- Any new `D-0NN` row added to `11-decisions.md`.

The pre-merge checklist is in `08-security-testing.md`.

**The other developer reviews. An agent's review does not substitute for it.**

### Plans

A plan is a written description of a piece of work before it is built. Plans
live in `docs/plans/`, numbered in the order they are opened: `001-…`,
`002-…`, and so on.

**There is no active or completed directory.** A plan's state is the checklist
inside it, because a directory says "done" while telling you nothing about
what was actually verified.

Every plan carries:

| Section | Content |
| :--- | :--- |
| **Status line** | Not started · In progress · Blocked · Complete, with the date |
| **Blocked by** | The `Q-0NN` questions and other plans that must resolve first |
| **Requirements** | The `REQ-0NN` items this plan delivers |
| **Build checklist** | What gets built, one checkable item each |
| **Manual test checklist** | The concrete things a person clicks through to confirm it behaves. Not unit tests — the checks a human performs |
| **Outcome** | Filled in as work happens, including what failed and what was done about it |

**A plan is complete only when every box is ticked, including every manual
test.** Not when the code is written, not when the pull request is approved,
not when it "should work". If part of the checklist cannot be run yet — it
depends on an unanswered question or a missing account — that box stays
unticked with the reason written beside it.

Recording an unrun check as passed is the one thing that makes this whole
system worthless.

### Status files

Each developer keeps their own file under `docs/status/` — separate files so
they never merge-conflict. Update yours when your work changes or you become
blocked. It is the first place the other developer looks before asking.
