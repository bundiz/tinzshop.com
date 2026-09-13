# Frontend Component Standard

The rules every component in Tinzshop follows.

React and Next.js App Router, decided by
[ADR-0001](adr/ADR-0001-backend-approach.md). Files live where
`04-tech-stack-and-structure.md` says they live.

## Server first

**Every component is a Server Component unless it needs to be otherwise
(D-030).** `"use client"` is added for one of exactly four reasons:

1. It uses state or an effect.
2. It handles a browser event.
3. It uses a browser-only API.
4. It uses a hook that requires one of the above.

Nothing else qualifies. "It felt easier" is not a reason, and neither is
"everything else in the folder has it".

**Push `"use client"` down, never up.** A product page is a Server Component
that fetches once and renders; only the variant picker inside it is a Client
Component (REQ-003). Marking the page instead sends the whole subtree to the
browser, including the price formatting and the catalogue data used to produce
it.

A Server Component may import a Client Component. The reverse only works by
passing it as `children`, which is usually the shape you actually wanted.

## The three tiers

Components live in exactly three places (D-033).

| Tier | Where | Knows about | Example |
| :--- | :--- | :--- | :--- |
| **1 — Primitive** | `src/components/ui/` | Nothing. No product, no order, no baht | `Button`, `Input`, `Dialog`, `Table` |
| **2 — Domain** | `src/components/domain/` | The domain, used by more than one route | `PriceDisplay`, `StockBadge`, `VariantPicker` |
| **3 — Route-owned** | Beside the route that uses it | Everything about that one screen | `CheckoutSummary` |

**Rule of second use.** A component is born in tier 3. It moves to tier 2 the
first time a *second* route genuinely needs it — not when someone anticipates
that it might. A component generalised for one caller acquires props that
exist for a use case that never arrives, and every later caller has to read
past them.

Movement is upward only. A tier-1 primitive that grows domain knowledge has
been misfiled; split it.

### No component library

Deliberate, and the one place this project takes on more work than it has to.

The admin needs an editable data grid with inline and multi-row editing
(REQ-037), the storefront needs a variant picker with no page reload
(REQ-003), and everything must work in Thai and English (REQ-007, REQ-033).
Thai text runs longer than English, wraps differently, and has no word spaces —
which is where a library's fixed-width table cells and truncation rules break
first. We would be overriding the library at exactly the points that matter,
which is more work than owning a small set of primitives.

If this is revisited, it is a `D-0NN` decision in `11-decisions.md`.

## Component contract

Every component file, in this order:

```tsx
// 1. Imports — external, then internal, then types
// 2. Props type — exported, named <Component>Props
// 3. The component — one default export, named
// 4. Local subcomponents, if any and only if unexported
```

### Props

| Rule | Why |
| :--- | :--- |
| Props are an explicit named type. Never inline, never `any` | The type is the component's contract and gets read far more often than the body |
| Required props first, optional after | The call site shows what matters |
| No boolean prop that flips more than one thing | `variant="danger"` beats `isDanger` plus `isBig` plus `isOutline` |
| Never spread unknown props onto a DOM element | `{...rest}` makes it impossible to know what a component renders |
| Pass values, not fetchers | A component that fetches cannot be rendered in a test or reused on another screen |
| Pass a `messageKey`, not a translated string, where the parent has no reason to know the language | See *Bilingual* |

### State

| Rule | Why |
| :--- | :--- |
| Server state is not client state | Data from the database is fetched in a Server Component. Copying it into `useState` creates a second version that goes stale |
| The URL holds anything a user should be able to share or return to | Category filter, page, search term, selected locale |
| `useState` is for genuinely local, genuinely transient state | Is this dropdown open |
| No global store | Nothing in this application has cross-route client state. A cart lives on the server, keyed by a cookie |
| No `useEffect` for fetching | If a Server Component can fetch it, it should |

### Money, dates and numbers

- **A price is only ever rendered by `PriceDisplay`.** It takes satang (D-010) and renders baht. No component formats money itself; that is how `฿1,995.00` and `1995 บาท` end up on the same page.
- Dates render through one formatter that knows the locale. Thai dates may need the Buddhist era — the source document itself is dated 2569 BE — and that decision belongs in one place.
- Never render a raw stock quantity on the storefront. `StockBadge` takes a status, not a number (REQ-006, D-024).

## Bilingual

**Thai and English, on the storefront and in the admin, from the same
mechanism (D-031, REQ-007, REQ-033).**

- The locale is a URL segment: `/th/…` and `/en/…`. It is shareable, crawlable, and never guessed from a browser header.
- **No user-facing string is written literally in a component (D-032).** Every one comes from a message key in `messages/th.json` or `messages/en.json`. This includes button labels, placeholders, `aria-label`, alt text, validation messages, empty-state text and error text.
- Message keys are dot paths mirroring the route: `shop.product.addToCart`, `admin.order.status.label`.
- Both catalogues carry every key. A missing Thai key is a build failure, not an English word appearing mid-sentence on a Thai page.
- **Never build a sentence by concatenating translated fragments.** Word order differs. Use one key with placeholders.
- Pluralisation goes through the library. Thai has no plural form and English does; a component must not encode either.

### Designing for Thai

Thai is the primary language of this shop, and it breaks layouts English does
not:

- Thai has **no spaces between words**, so a long string will not wrap at all unless the container allows it. Fixed-width cells and `text-overflow: ellipsis` fail differently than they do in English.
- Thai has **taller line boxes** — vowels and tone marks stack above and below. Tight `line-height` clips them.
- Thai text is often **shorter than English** for the same content, and sometimes much longer. Never size a container to the text of one language.

**Check every screen in both languages before opening the pull request.** It
is on the review checklist in `09-coding-guidelines.md`.

## Forms

**Every form validates with the same Zod schema the server uses (D-034).** One
definition, imported by both. Client and server cannot disagree about what is
valid, because there is nothing to disagree about.

- Client validation is for speed of feedback. **It is never the enforcement.** The server validates every submission regardless.
- Errors attach to their field, in the user's language, from a message key.
- The submit button disables while submitting and the form survives a failure with the user's input intact. Retyping an address because the server said no is the fastest way to lose an order.
- Every input has a real `<label>`. A placeholder is not a label — it disappears exactly when the user needs it.
- Mutations go through Server Actions (`06-api.md`), never a hand-written `fetch` to our own routes.

## Loading, empty and error

**Every screen that loads data handles four states, not one.** The happy path
is the state least likely to be wrong.

| State | Requirement |
| :--- | :--- |
| **Loading** | A skeleton matching the real layout. Not a spinner in a blank page — the shift when content arrives is the jarring part |
| **Empty** | Say what is missing and what to do about it. "No orders yet" plus a next step, never a blank panel |
| **Error** | The `messageKey` from the `Result` (`06-api.md`), plus a way to retry. Never a raw error, never a stack |
| **Loaded** | The content |

Empty and error states are written in the same pull request as the happy path.
They are not follow-up work; they are the states a user hits when something is
already going wrong.

## Responsive

**Mobile-first (D-035),** because REQ-009 requires every desktop function to
work on a phone — not a cut-down version of it.

- Base styles are the phone. Breakpoints add, never subtract.
- Tap targets are at least 44×44px.
- **The admin is included.** REQ-037's inline and bulk editing has to work on a phone. A wide data grid becomes stacked cards below the breakpoint; it does not become a horizontal scroll nobody can use.
- Test at 360px wide. That is a real phone, and it is where Thai text and a data table collide.

## Accessibility

Not a separate pass. Baseline, on every component:

- Semantic elements. A `<div>` with `onClick` is not a button and cannot be reached by keyboard.
- Every interactive element is keyboard-reachable, in a sensible order, with a visible focus ring. Never `outline: none` without a replacement.
- Every image has meaningful `alt`, from a message key. Decorative images get `alt=""`.
- Forms use real labels tied to their inputs.
- Colour is never the only signal. Stock status shows text as well as a colour (REQ-006), which also protects it against a red badge meaning "urgent" to one reader and "sold out" to another.
- A dialog traps focus, closes on `Escape`, and returns focus where it came from.

## Admin patterns

The back office carries the hardest requirements in this document.

### Product list (REQ-036)

Parents listed, expandable to variants. The expansion state is in the URL, so
a staff member editing a variant and going back does not lose their place.

### Inline and bulk editing (REQ-037)

- A cell becomes editable in place. `Escape` cancels, `Enter` commits, and the previous value is restored on failure.
- Selection is by checkbox with a select-all that selects **the filtered set**, not the current page, and says which it did.
- A bulk action states exactly what it will do to how many rows before it does it.
- Optimistic update, then reconcile with the server's answer. A failed write rolls the row back visibly and says why.

### Excel import (REQ-038)

The dry run is a first-class screen, not a checkbox. It shows what would be
created, what would be changed, and what failed with the row number and the
reason — before anything is written. See `05-database.md` for the transaction
that backs it.

## Undecided

| Area | Blocked on |
| :--- | :--- |
| Order status labels and their colours | Q-023 — a candidate set is proposed, not adopted |
| Which admin screens each of the six roles sees | Resolved in outline (D-062, D-063 — six fixed roles, owner edits permissions only); exact screen-to-permission mapping is phase 2 design work, not an open question |
| Whether product text is translated by staff or by us, and what shows when a translation is missing | Q-018 residual |
| Visual design, brand, typography | No design has been provided. This document is structure, not appearance |

**Resolved since the last revision:** there is no low-stock badge — the
storefront shows in stock / out of stock only (D-065, Q-019). `StockBadge`
takes exactly those two states.
