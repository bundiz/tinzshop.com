# Architecture Decision Records

An ADR records one decision: why it was made, what else was considered, and
what it costs us. It exists so that a year from now nobody has to guess why
the project is shaped the way it is.

## Convention

One file per decision, named `ADR-000N-short-title.md`, numbered in the order
they are opened. Every ADR has these fields:

| Field | Content |
| :--- | :--- |
| **Status** | `Proposed` · `Accepted` · `Superseded by ADR-000N` |
| **Date** | The date the status last changed, as YYYY-MM-DD |
| **Context** | The forces at play: what we need, what constrains us, what we do not know |
| **Options considered** | Each option with its trade-offs. An option nobody seriously weighed does not belong here |
| **Decision** | What was chosen, and by whom. Empty while Status is `Proposed` |
| **Consequences** | What this makes easy, what it makes hard, and what we now have to live with — good and bad. Empty while Status is `Proposed` |

## Rules

1. **An Accepted ADR is never edited.** If the decision changes, write a new ADR and set the old one's status to `Superseded by ADR-000N`. The old record stays readable exactly as it was. This is the whole point: an edited history teaches nothing.
2. A `Proposed` ADR may be edited freely while it is still being argued.
3. Leave `Decision` and `Consequences` empty until the decision is actually made. An ADR that quietly fills them in while still marked Proposed reads as settled and misleads the next person.
4. Record the criteria before the choice. Criteria written after the fact tend to describe whatever was already picked.
5. Link the open questions the decision depends on. A decision that rests on an unanswered question is not ready to accept.

## Index

| ADR | Title | Status |
| :--- | :--- | :--- |
| [ADR-0001](ADR-0001-backend-approach.md) | Backend approach | Proposed |
