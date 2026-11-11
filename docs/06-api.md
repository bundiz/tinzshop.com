# API

How data gets in and out of Tinzshop.

Follows from [ADR-0001](adr/ADR-0001-backend-approach.md) and the entry
surfaces in `03-architecture.md`.

## API docs (OpenAPI)

`docs/openapi.yaml` describes every route handler in this document in OpenAPI 3.1. This document is the authority; the YAML restates it and changes in the same pull request as any endpoint, status or body (D-115). In development, `GET /api/docs` renders it with Swagger UI, served from the pinned `swagger-ui-dist` package (never a CDN), together with `/api/docs/openapi` (the YAML) and `/api/docs/assets/<file>` (two allow-listed files). All three answer `404` when `NODE_ENV` is `production`. Never type the real `JOB_SECRET` into a shared or hosted Swagger tool.

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
/api/callbacks/<system>           a browser redirected back by an external system
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
| Customer | Session cookie `tinzshop_session`, `HttpOnly`, `Secure`, `SameSite=Lax`; signed in through Cognito (ADR-0003, plan 014) |
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

## Callbacks

A callback is a `GET` the seller's **browser** makes when an external system
redirects it back to us, so it carries no signature we can verify and no
session. It carries a one-time credential in the query string, so every
response is `Cache-Control: no-store` and no response body ever repeats it.

### `GET /api/callbacks/shopee`

Shopee redirects here after the shop owner authorizes our partner app
(plan 010, Task 7). The handler exchanges the code for tokens and stores them
encrypted.

**Query parameters**

| Parameter | Rule |
| :--- | :--- |
| `code` | Required, non-empty. The one-time authorization code. |
| `shop_id` | A positive decimal integer within the safe integer range. Exactly one of `shop_id` and `main_account_id` is present. |
| `main_account_id` | As `shop_id`. |
| `state` | Optional, read as a string. |

**Responses** (all `Cache-Control: no-store`)

| Status | Body | When |
| :--- | :--- | :--- |
| `200` | `{ "data": { "accountType": "shop", "shopId": <number>, "connected": true } }` | The shop was connected. The code is never in the body. |
| `400` | `{ "error": { "code": "shopee.authorization.invalid_callback", "messageKey": "error.shopee.authorization.invalidCallback", "details": [{ "path", "message" }] } }` | The query failed validation. |
| `403` | `{ "error": { "code": "shopee.authorization.unexpected_shop", "messageKey": "error.shopee.authorization.unexpectedShop" } }` | `shop_id` is not the shop configured in `SHOPEE_SHOP_ID`. No token exchange is attempted (D-104). |
| `422` | `{ "error": { "code": "shopee.authorization.main_account_unsupported", "messageKey": "error.shopee.authorization.mainAccountUnsupported" } }` | A main account authorized instead of a shop. |
| `502` | `{ "error": { "code": "shopee.authorization.token_exchange_failed", "messageKey": "error.shopee.authorization.tokenExchangeFailed" } }` | Shopee refused or failed the code exchange. |

Any other exception is `500`. The shop allow-list exists because any shop
that authorizes our partner app can produce a valid code; without it, that
shop could replace ours and the sync would mirror its catalogue (D-104).

### `GET /api/auth/google` and `GET /api/callbacks/cognito` (plan 014)

Customer sign-in with Google (ADR-0003, D-154). Both are browser `GET`s that answer **302**, never a body, and every response is `Cache-Control: no-store`. They live outside the locale segment (fixed URLs); the locale travels in a query parameter and in the `tinzshop_oauth` cookie. Neither takes a signature or a session.

**`GET /api/auth/google?returnTo&locale`** starts the sign-in.

| Parameter | Rule |
| :--- | :--- |
| `returnTo` | A path on this site: it must start with `/` but not `//`, contain no `\` and no locale prefix; otherwise it becomes `/`. |
| `locale` | `th` or `en`. |

It sets the sealed, HttpOnly `tinzshop_oauth` cookie (10 minutes, path `/api`) holding the `state`, the PKCE verifier, `returnTo` and `locale`, then answers `302` to Cognito's authorize endpoint with `identity_provider=Google`, so the customer goes straight to Google.

**`GET /api/callbacks/cognito?code&state`** is where Cognito returns the customer. It checks `state` against the cookie, exchanges the code at Cognito's token endpoint with the client secret and the PKCE verifier, verifies the ID token, upserts the `customer` row by `sub`, starts a `customer_session`, sets `tinzshop_session`, clears `tinzshop_oauth` and answers `302`.

| Status | `Location` | When |
| :--- | :--- | :--- |
| `302` | `/{locale}{returnTo}` | Success; the session cookie is set. |
| `302` | Cognito's authorize endpoint | The first Google sign-in after account linking fails once inside Cognito; the callback retries the authorize step **once** (`retried` in the cookie). The exact error is confirmed in plan 014 Task 2. |
| `302` | `/{locale}/sign-in?error=google` | Any other failure: `state` mismatch (no token exchange is made), a refused or failed code exchange, an invalid ID token, or an email held by another `sub` (logged by hash only). |

The code and the tokens are never in a response body or a log.

### Customer auth Server Actions (plan 014)

The auth forms are Server Actions in `src/app/[locale]/(shop)/(auth)/actions.ts`, not HTTP endpoints, so they are not in `openapi.yaml`; they carry Next's CSRF protection. Each validates `FormData` with Zod, calls one controller in `src/server/controllers/auth/`, and returns `{ fieldErrors?, formError?: messageKey, redirectTo? }` for `useActionState`. A user-facing `formError` is a message key under `shop.auth.*` (D-032); Cognito's own text is never shown.

| Action | Does | Next step or error |
| :--- | :--- | :--- |
| `register` | Sign up (`given_name`, `family_name`). | Always `verify`, whether the email is new, already registered (a reset code is sent, D-160) or never confirmed (the code is resent). |
| `confirmRegistration` | Confirms the 6-digit code. | `sign_in` (R1, D-173). Any failure, including an already-confirmed account, is the same `auth.invalid_code` (Q-060, D-179). |
| `resendCode` | Resends the sign-up code. | Rate-limited. |
| `signIn` | Email and password, sets the session cookie. | `redirectTo` is the safe `returnTo`. An unconfirmed account goes to `verify`. |
| `requestPasswordReset` | Sends a reset code. | Always "if this email has an account, we sent a code". |
| `confirmPasswordReset` | Code plus new password for the email in the pending cookie (set by register or by the forgot-password form, so the verify page's link needs no new code); ends **all** of the customer's sessions. | Back to sign-in. A wrong code, an unconfirmed account, an unknown user and an unmapped Cognito refusal are all `auth.invalid_code`. |
| `signOut` | Deletes the session row, revokes the refresh token, clears the cookie. | Redirect home. |

**Error codes and message keys.** The service returns `Result<…>` (`{ ok: false, error: { code, message, messageKey, details? } }`); a `details.field` makes the controller put the key under `fieldErrors[field]`, otherwise it is the `formError`.

| Code | `messageKey` | When |
| :--- | :--- | :--- |
| `auth.rate_limited` | `shop.auth.error.rateLimited` | A limit in D-169 is exceeded; returned before Cognito is called. |
| `auth.invalid_credentials` | `shop.auth.error.invalidCredentials` | A wrong password or an unknown email. The same message for both (no enumeration). |
| `auth.invalid_code` | `shop.auth.error.codeInvalid` (field `code`) | A wrong code, or an unknown email. |
| `auth.code_expired` | `shop.auth.error.codeExpired` (field `code`) | The code has expired. |
| `auth.invalid_password` | `shop.auth.error.passwordPolicy` (field `password`) | The pool refused the password; the form checks the same five rules first (D-177). |
| `auth.account_conflict` | `shop.auth.error.accountConflict` | A correct sign-in whose email another account already holds. |
| `auth.unavailable` | `shop.auth.error.unavailable` | Cognito could not be reached. Never returned by `register` after a taken email, `resendCode` or `requestPasswordReset`, which always give their normal answer. |
| (validation) | `shop.auth.error.nameRequired`, `nameTooLong`, `emailInvalid`, `passwordMismatch` (field `passwordConfirm`), `passwordRequired`, `codeFormat` | Zod checks in the controller, before the service. |
| (controller) | none | The pending cookie is missing or over an hour old; the customer is sent back to the first step with `?expired=1` (a redirect carries no form state, so there is no `formError`). |

**Reasoning behind D-179 (Q-060).** `ConfirmSignUp` reports "already confirmed" before it checks the code, so using that answer to open a choose-a-password step would tell a stranger who typed any code that the email has an account. The verify step therefore answers a confirmed account exactly like a wrong code (same error, same state, same cookies). The owner of an existing account follows the standing link on the verify page to the reset-code step, `PASSWORD_RESET_CODE_PATH` = `/forgot-password?step=reset` (exported from the controller), which reads the email from `tinzshop_pending` and sends no code. The `choose_password` step and `completePasswordChoice` do not exist.

**Reasoning behind D-178.**
- **Pending cookie.** `tinzshop_pending` is sealed and carries the email with its issue time, so a tampered or stale one reads as absent. It stays after a correct verify or reset so the sign-in page can prefill the email (R1, D-173), and is cleared by a sign-in.
- **Reset purge.** After a reset the service finds the customer with `findCustomerByEmail` and deletes every session row. This needs no extra Cognito sign-in and cannot fail on Cognito being down. A person who never signed in on the site has no rows, so nothing is purged.
- **Follow-up steps are quiet.** After a taken email, `register` calls `ForgotPassword`; if that fails for any reason except a throttle, it calls `ResendConfirmationCode` (a never-confirmed account may answer `ForgotPassword` in several ways). `resendCode` falls back from resend to a reset on any failure, a throttle included. A failure is logged by code and email hash and never changes the answer, so no response tells an existing email from a new one. Only `CognitoError`s are mapped; any other error is a bug and propagates (D-022).
- **Sign-in resend.** A sign-in that finds an unconfirmed account sends the code again and goes to verify. That resend counts against the `resend` limit; when it is over, the customer still goes to verify but no code is sent.
- **Refused email.** If a correct sign-in belongs to a Cognito user whose email another customer holds, the just-issued refresh token is revoked before the refusal.

The controller's state also carries `notice?: messageKey` (`shop.auth.verify.resent`) and `step?: 'reset'` for pages that stay on one route. Redirect targets are locale-less (`/register/verify`, `/sign-in?confirmed=1`, `/sign-in?reset=1`); the action adds the locale from the `locale` form field.

The adapter reports Cognito failures as a `CognitoError` with one of `username_exists`, `code_mismatch`, `code_expired`, `already_confirmed`, `not_authorized`, `user_not_confirmed`, `invalid_password`, `limit_exceeded` or `unavailable`. These are internal: the controller maps each to a message key, and `username_exists` and `already_confirmed` never reach the screen as such (D-160).

## Scheduled jobs

**Secret-authenticated, safe to call on any schedule.** A job is a `POST` under `/api/jobs/<name>` with `Authorization: Bearer <JOB_SECRET>`. The secret is compared in constant time; a missing header, another scheme or a wrong value is `401` with no detail about which. Responses carry `Cache-Control: no-store`. The job secret is read per request, never at import, and any scheduler that can send a header can call it. Every job checks it through the one shared `isJobAuthorized` (`src/server/controllers/shared/job-auth.ts`).

| Endpoint | Method | Auth | Statuses |
| :--- | :--- | :--- | :--- |
| `/api/jobs/shopee-sync` | `POST` | `Bearer <JOB_SECRET>` | `200` the run summary, for `succeeded` or `skipped` (another run held the lock). `502` `{ error: { code: 'catalogue_sync.failed', runId } }` when the run failed; the cause is in that `sync_run` row, not in the response; a failed run may still have committed some item upserts (D-109). `401` unauthorized. An unexpected exception is `500` |
| `/api/jobs/news-import` | `POST` | `Bearer <JOB_SECRET>` | **Every environment** (plan 012, D-136). Imports every category and post from the old site (`NEWS_IMPORT_SOURCE_URL`) under its own advisory lock. `200` the summary `{ outcome: 'succeeded', categories, created, updated, unchanged, failed, failedPosts, removedEmbeds }`, or `{ outcome: 'skipped' }` when another import held the lock; `failed` counts posts that failed to map or save, and a run with failed posts still succeeds. `failedPosts` names each one as `{ sourceId, reason }`: `sourceId` is the old post id as a decimal string and `reason` is the client's fixed reason for a post that could not be read or mapped (`http_error`, `timeout`, `mapping_failed`, …) or `save_failed`. `removedEmbeds` counts only posts created or updated this run. `502` `{ error: { code: 'news_import.failed', reason, summary } }` when the run stopped (the category list, the author list or a page could not be read, or a write failed outside a single post); `reason` is a fixed code (`network_error`, `timeout`, `http_error`, `non_json_response`, `invalid_response`, `missing_total_pages` or `unexpected`), `summary` holds the counts so far, and the posts saved before the stop stay. `503` `{ error: { code: 'news_import.not_configured' } }` when `NEWS_IMPORT_SOURCE_URL` is unset. `?full=1` runs the **full re-import** (D-140): no post is skipped as unchanged, so every post is mapped, its image read, saved (counted `updated`) and re-linked; the response has the same shape. `400` `{ error: { code: 'news_import.invalid_full' } }` for any other `full` value (empty, `0`, `true`, repeated, …). Order: the secret (`401`), then `full` (`400`), then the source setting (`503`), then the run; the job reads only `JOB_SECRET` and `NEWS_IMPORT_SOURCE_URL`, so a missing Shopee setting never affects it. A run that stops, and each post that fails to save, is logged on the server: our own source error with its message (a fixed reason and an API path), any other error by its name and code only, never its message, which for a database error can contain the post's data. `401` unauthorized. An unexpected exception is `500` |
| `/api/jobs/catalogue-activate` | `POST` | `Bearer <JOB_SECRET>` | **Development only (D-117).** `404` when `NODE_ENV` is `production`, checked before auth. `200` `{ activated: n }`, the count of products newly set active (`channel_item.external_status = 'NORMAL'` and at least one active variant; never deactivates). `401` unauthorized. Used until plan 002's admin screens exist |
| `/api/jobs/catalogue-categorise` | `POST` | `Bearer <JOB_SECRET>` | **Development only (D-143).** `404` when `NODE_ENV` is `production`, checked before auth. `200` `{ categorised: n, skipped: m }`: `categorised` is the products newly given a category, `skipped` every other product (already categorised, or its name matched no platform). Seeds the category tree if missing. `401` unauthorized. See *Categorise job* below |

`shopee-sync` is called every 10 minutes (plan 010). Overlapping calls are safe: the second returns `skipped`.

`news-import` is not scheduled: it is run by hand, and once at go-live. It is safe to re-run: a post whose `source_modified_at` has not moved is counted `unchanged` and not written (except with `?full=1`, which writes every post again, D-140), and no row is ever deleted. Every run applies the excluded-category rule (D-139) to stored articles, unchanged ones included: links to an excluded category are removed and an imported article left only in excluded categories gets `deleted_at`. The response is unchanged. Its lock key differs from the catalogue sync's, so the two never block each other.

### Categorise job (plan 013)

`catalogue-categorise` is development only and is run by hand until admins can assign categories (plan 002). In one transaction it seeds the category tree if missing (existing rows and translations are left as they are), then reads each product's Thai name and, with `categoriseByName`, sets `primary_category_id` to the type and adds `product_category` rows for the type and its platform. It only touches a product with no `product_category` row and no `primary_category_id`, so re-running it changes nothing. The rules are in `categorise-by-name.ts` (D-143, [05](05-database.md#product-categories-plan-013)).

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
