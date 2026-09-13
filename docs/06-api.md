# API

How data gets in and out of Tinzshop.

Follows from [ADR-0001](adr/ADR-0001-backend-approach.md) and the entry
surfaces in `03-architecture.md`.

## Server Actions versus route handlers

**Server Actions for our own front end. Route handlers only for callers we do
not control (D-020).**

| | Server Action | Route handler |
| :--- | :--- | :--- |
| Caller | Our storefront or admin | K-Payment, a carrier, a scheduled job, a browser downloading a file |
| Auth | Session, then a domain permission check | Signature verification. **Never a session** |
| Input | Zod-parsed `FormData` or typed argument | Zod-parsed JSON or query |
| Output | A `Result` value | HTTP status and JSON |
| Lives in | `src/server/actions/` | `src/app/[locale]/api/` |

The split is not stylistic. A Server Action is type-checked end to end — the
argument the component passes is the argument the server receives, and a
change to one is a compile error in the other. That guarantee is exactly what
two developers working in parallel need, and it is exactly what is lost the
moment a hand-written `fetch` sits in between. So we only pay that cost where
there is no alternative: a caller outside our codebase.

**There is no public REST API.** Nothing in the source asks for one and no
third party is described as calling us. Building a general API surface nobody
requested is scope we would then have to secure, version and document forever.
If that changes, it is new scope and needs a `D-0NN` decision first.

## Route handler conventions

For the handful of endpoints that do exist.

### Paths

```
/api/webhooks/<system>            inbound, from an external system
/api/exports/<resource>           file download, staff, authenticated
/api/jobs/<name>                  scheduled work, secret-authenticated
```

Lowercase, `kebab-case`, plural resource nouns. No verbs in a path — the
method carries the verb.

### Methods and status codes

| Method | Use | Success |
| :--- | :--- | :--- |
| `GET` | Read. Never changes anything. Safe to retry, safe to prefetch | `200` |
| `POST` | Create, or an action that is not a plain create | `201` created, `200` otherwise |
| `PATCH` | Partial update | `200` |
| `DELETE` | Remove | `204` |

| Status | Means | Do not use it for |
| :--- | :--- | :--- |
| `400` | The request was malformed or failed validation | An authorization failure |
| `401` | No credential, or the credential is invalid | A valid credential lacking permission |
| `403` | Valid credential, insufficient permission | A missing record |
| `404` | No such resource — *or* the caller may not know it exists | Validation failure |
| `409` | The request conflicts with current state: stock ran out, the order already shipped | Anything a retry would fix |
| `422` | Well-formed but semantically impossible | Schema violations, which are `400` |
| `429` | Rate limited | — |
| `500` | We are broken. It is a bug, and it is ours | Anything the caller could have avoided |

**`409` is the one that matters here.** "The last unit was sold while you were
checking out" is not a server error and not a bad request. It is a conflict,
and the customer needs to be told which line failed and why, in their own
language.

## Validation

**Every external input is parsed by a Zod schema at the boundary, and
unparsed input never reaches domain code (D-021).**

The schema is defined once and used three times: by the route handler or
Server Action, by the form in the browser (`07-frontend-components.md`), and
as the input type of the domain function. Client and server therefore cannot
disagree about what is valid, because there is only one definition (D-034).

Parse, do not validate. The boundary returns a typed value or a failure; it
never hands a raw object onward with a boolean saying it looked fine.

Specific rules:

- Money arrives as an integer of satang, never a decimal string.
- Quantities are positive integers. Zero and negative are validation failures, not domain concerns.
- A `model_sku` is validated for shape only once Q-014 is answered. Until then it is a non-empty string and no format is assumed.
- Locale is `th` or `en` and nothing else.
- Uploaded files — payment slips, Excel imports — are checked for type and size at the boundary, before anything reads them.

## The result shape

**Every handler returns either a typed success or a typed failure. Thrown
exceptions are for bugs, not for expected outcomes (D-022).**

```ts
type Result<T> =
  | { ok: true;  data: T }
  | { ok: false; error: DomainError }

type DomainError = {
  code: string        // stable, machine-readable, never shown to a user
  message: string     // English, for developers and logs
  messageKey: string  // message catalogue key, for the user (D-032)
  details?: unknown   // field-level validation failures
}
```

"Out of stock" is not exceptional — it is one of the two things that can
happen when someone places an order. Modelling it as a thrown exception means
the type system stops telling anyone it is possible, and it gets forgotten in
exactly the code path that matters. Returning it makes handling it mandatory.

`throw` remains correct for what it is for: a broken invariant, a failed
connection, a bug. Those become `500`, get logged with a request id, and never
reach the user as prose.

### Error responses

```json
{
  "error": {
    "code": "stock.insufficient",
    "messageKey": "error.stock.insufficient",
    "details": { "variantId": "…", "requested": 2, "available": 1 }
  }
}
```

`code` is dotted, stable, and never changes once released — callers and logs
depend on it. The user-facing text comes from `messageKey` through the message
catalogue, so an error reads correctly in Thai and English (REQ-007).

**No error ever leaks a stack trace, a SQL fragment, a file path, or an
internal id the caller has no right to.** See `08-security-testing.md`.

## Authentication and authorization

| Caller | Authenticated by |
| :--- | :--- |
| Customer | Session cookie, `HttpOnly`, `Secure`, `SameSite=Lax` |
| Guest | No session. A cart is keyed by an opaque cookie value |
| Staff | Session cookie plus a second factor (REQ-032) |
| External system | Request signature. Never a session, never an API key in a query string |
| Scheduled job | A shared secret in a header, rotated independently |

**Authorization is checked in the domain layer, never only in the route
(D-041).** A route can hide a button; it cannot stop a request. The permission
check lives beside the business rule it protects, so every entry surface
inherits it. Reaching a page is never evidence of the right to act.

## Webhooks

**Signature-verified, idempotent by event id, acknowledged before processing
(D-023).** In that order:

1. **Verify the signature first**, before parsing the body and before touching the database. A request that fails verification is dropped with `401` and logged. If a provider offers no signature, that is a finding to record in `14-integrations.md`, not a rule to skip.
2. **Look up the event id.** Already processed? Return `200` and stop. Providers retry, and a retried payment applied twice is money.
3. **Persist the raw event before interpreting it.** When something goes wrong at 2am, the exact bytes the provider sent are the only reliable evidence.
4. **Return `200` quickly**, then do the work. A provider that does not get a prompt acknowledgement retries, and the retry arrives while the first is still running.
5. **Never trust the amounts in the payload as authoritative.** Match against our own order record and reject a mismatch loudly.

> Every webhook we might receive belongs to a system that is **NOT
> RESEARCHED** (`14-integrations.md`). K-Payment's signing scheme, event
> identity and retry behaviour are unknown (Q-033). The rules above are what
> any such integration requires; none of them is a claim about K-Payment.

## Pagination, filtering, sorting

For endpoints that list.

```
GET /api/exports/orders?limit=50&cursor=<opaque>&status=<value>&sort=-placed_at
```

- **Cursor pagination, not offset.** Rows are inserted while a staff member pages through an order list, and offset paging silently skips and repeats records when that happens.
- `limit` defaults to 50 and is capped at 200. The cap is enforced server-side.
- `sort` takes a field name, prefixed `-` for descending. Only an allowlist of fields is sortable — an unbounded sort is an unbounded index scan.
- Filters are named parameters, never a query language.

## What must never be returned

| Never | Why |
| :--- | :--- |
| Real stock quantity, on any public response (D-024) | REQ-006 requires status only, not numbers |
| Another customer's data, in any shape, including counts | — |
| Internal ids of records the caller cannot access | An id is a probe |
| Cost price, margin, or supplier detail | Not customer-facing under any requirement |
| Stack traces, SQL, file paths, environment values | `08-security-testing.md` |
| A payment credential, in full or in part | `08-security-testing.md` |

The check is on the response shape, not on the query. A domain object passed
straight to `JSON.stringify` will leak a field somebody adds next month.
**Every response is built from an explicit serializer** that names the fields
it emits.

## Versioning

Route handlers are unversioned today, because their only callers are systems
whose integrations we control.

The rule for when that changes: an endpoint with an outside consumer gets
`/api/v1/…` **before** its second consumer exists, not after. Retrofitting a
version onto a live endpoint means breaking whoever is already using it.

## Undecided

| Area | Blocked on |
| :--- | :--- |
| K-Payment webhook signature scheme and retry behaviour | Q-033 residual — credentials exist, sandbox testing not yet done |
| The scheduled stock export/import job's exact shape | Q-007, Q-011, Q-012, Q-014, Q-044 — BigSeller data-inspection dependency. The mechanism itself (daily file, not live API) is decided — D-081 |
| Order status values in any response | Q-023 — a candidate is proposed for review, not adopted |
| Accounting export format and fields | Q-050 |
| Shipping label output format | Q-039 residual — direction (self-printed label) is decided |

**Resolved since the last revision:** there is no refund endpoint (D-077,
Q-036), no bank-transfer slip upload endpoint (D-072, Q-030), and no carrier
webhook (D-075, Q-034) — none of these are built. Rate limiting sits behind
Cloudflare Free (D-087, Q-054), which is now decided rather than open.
