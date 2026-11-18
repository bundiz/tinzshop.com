# Security, Testing and Validation

Three subjects in one document because they are one subject: how we know the
system does what it should, and only that.

## Part 1 — Security

### What this application actually holds

Worth stating plainly, because it decides where effort goes:

| Asset | Why an attacker wants it | Requirement |
| :--- | :--- | :--- |
| Customer personal data — name, address, phone, email, and optionally a tax/national ID | Directly saleable; a PDPA breach is a legal event in Thailand | PDPA (REQ-046 self-service removed, D-197) |
| Staff accounts | Full access to prices, stock and orders | REQ-032, REQ-034 |
| Tax documents | Legally retained for five years, and legally defective if altered | REQ-024, REQ-026 |
| Stock and price data | Changing either is direct financial damage and may go unnoticed | REQ-020, REQ-037 |
| K-Payment merchant credentials | Money | Phase 3 |

**Removed since the last revision:** payment slips no longer exist as an
asset — bank transfer is removed and K-Payment is the sole payment method
(D-072, Q-030). There is no in-system refund capability to protect (D-077,
Q-036).

Notably **not** held: card numbers. Payment happens on Kasikorn's side and a
callback returns (`14-integrations.md`). **Nothing in this system ever stores
or logs a card number, CVV or expiry, in any form, including a truncated one.**
If any design ever appears to require it, that design is wrong.

### Secrets

**Absolute rules. No exception, no "just for testing" (D-042):**

1. **Never read, print, echo, copy or open `.env`** — not a person, not a script, not an agent. `.env.example` is the file to edit when a variable needs documenting.
2. **No secret is committed in any form**, in any file, including documentation, test fixtures, seed data and commit messages.
3. **No real account identifier goes in the repository.** Not a merchant id, not a bank account number, not the shop's tax id, not a real customer's email. `.env.example` holds placeholders that are obviously placeholders.
4. **A leaked secret is rotated, not deleted.** `git rm` does not remove it from history. Rotate first, then clean up.
5. Secrets are read once at startup through the Zod-validated config module (`04-tech-stack-and-structure.md`), so a missing one fails loudly at boot rather than as `undefined` during a payment.

Every pull request is checked for secrets before it merges. It is on the
checklist.

### Authentication

| Who | How |
| :--- | :--- |
| Customer | Email and password, or Google, through Amazon Cognito ([ADR-0003](adr/ADR-0003-customer-authentication.md)). Cognito stores and hashes the password; we never do. Our own revocable session sits on top (`customer_session`, plan 014) |
| Staff | Email and password with Argon2id hashing — never MD5, SHA-1, or a bare SHA-256 — with no second factor at sign-in (D-232). Staff are customer accounts with a staff role (D-229, D-240), so they sign in through the customer pool and pages; the rate limits (D-169) and blocking (D-234) apply |
| Guest | No account. An opaque cart cookie carrying no personal data |

Session cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, with a server-side
session that can be revoked. A session that only exists in a signed cookie
cannot be ended when a staff member leaves.

Rules that follow:

- Password reset tokens are single-use, short-lived, and stored hashed.
- Sign-in failures say "email or password is incorrect" and nothing more. Distinguishing the two enumerates accounts.
- Rate-limit sign-in and password reset per account **and** per source. Per-source alone lets a distributed attempt through; per-account alone lets one source lock every account out.
- Sessions rotate on privilege change. Signing in must issue a new session identifier.
- Staff sessions expire sooner than customer sessions.

> **Changed (D-232, 2026-11-14): no second factor at sign-in.** Q-017's email-OTP answer (D-064) was superseded at the client's request; a staff account is protected by its password or Google account, the sign-in rate limits (D-169) and blocking (D-234). No SMS provider is needed.

**Customers with Cognito (plan 014, D-152 to D-177).** The rules above apply as follows: Cognito carries reset codes (single-use, short-lived) and its built-in lockout covers the per-account limit; the per-source limit and the per-email counter are ours (`auth_rate_limit`, D-169). Sessions are 7 days from sign-in. The Cognito access and ID tokens live 60 minutes and are refreshed silently (D-176, which replaced 15 minutes on 2026-11-11): the tokens never reach the browser and signing out deletes our session row at once, so the longer lifetime only means fewer refresh calls; its cost is that disabling a user in Cognito reaches the site within an hour rather than 15 minutes. The cookie value is a random token of which only the SHA-256 is stored. Register, resend and forgot password never reveal whether an email has an account (D-160) by what they answer. **Accepted timing difference (D-188):** register is not constant in time. A new email costs one Cognito call (`SignUp`); an email that already has an account costs one or two more (`ForgotPassword`, then `ResendConfirmationCode` for a never-confirmed one), so someone timing the answer could guess. This is accepted because the register limit (5 per hour per client IP and per email, D-169) makes probing many emails this way slow, and padding every answer to the slowest path would make every registration slower. Registering someone else's email and leaving it unconfirmed cannot keep that account once the real owner finishes the reset: after the real owner's correct code, an account not created in that browser must set a new password with a second code (Q-061, D-186). Until that reset is finished the original password still works (spec §6.1). Passwords, codes, tokens, cookie values and raw emails are never logged.

### Authorization

**Checked in the domain layer, never only in the UI (D-041).**

A hidden button is not access control. Every domain function that reads or
changes protected data takes the actor and checks the permission itself, so
every entry surface in `03-architecture.md` inherits the check. Reaching a
page is never evidence of the right to act.

Permissions are rows, not code (D-040, REQ-035, `05-database.md`).

Three failures to test for specifically:

| Failure | The test |
| :--- | :--- |
| Horizontal — one customer reads another's order by changing an id in the URL | Every record fetch is scoped by owner, not merely by id |
| Vertical — a Blogger reaches a Sale-manager action by calling it directly | Every action is exercised as every role in the integration suite |
| Enumeration — an id reveals a record exists even when access is denied | Return `404`, not `403`, where existence itself is not the caller's business |

> **Resolved (Q-015, Q-016, D-062, D-063).** Six roles: Blogger, Sale-manager,
> Admin, Top-level Admin, Customer, Guest. The owner may edit permissions on
> these six only — there is no "create a role" capability.

### Injection and output

| Risk | What protects us | What still needs care |
| :--- | :--- | :--- |
| SQL injection | Prisma parameterises | Raw SQL — the invoice sequence, the reporting queries. Parameterise them by hand; never build SQL by string concatenation |
| XSS | React escapes by default | `dangerouslySetInnerHTML`. Staff-written content pages and news (REQ-044, REQ-047) are rich text, and staff-authored is not the same as trusted. Sanitise on the way in, with an allowlist |
| CSRF | Server Actions carry protection | Route handlers do not. Webhooks use signatures instead, never cookies |
| Open redirect | — | Never redirect to a URL from a query parameter without an allowlist |
| SSRF | — | Adapters call fixed, configured hosts. Never a URL supplied in a request |

Security headers: a Content-Security-Policy without `unsafe-inline`, HSTS,
`X-Content-Type-Options: nosniff`, and a restrictive `Referrer-Policy`.

### File uploads

**There is no payment-slip upload.** Bank transfer is removed; K-Payment is
the sole payment method (D-072, Q-030). The upload paths are news images (plan 017)
and the Excel import below:

**News images (plan 017; D-276 to D-279)** — staff-supplied pictures
stored in a bucket whose `news/` prefix is public, sent through the Server Action `uploadNewsImageAction`:

- Checked on the server by content (first bytes: JPEG `FF D8 FF`, PNG's 8-byte signature, `GIF87a`/`GIF89a`, `RIFF`…`WEBP`), never by name or declared type; JPEG, PNG, WebP and GIF only; SVG (it can carry script), HEIC, AVIF and everything else refused. At most 5 MB (`NEWS_IMAGE_MAX_BYTES`); the declared size is checked before any byte is read, and `serverActions.bodySizeLimit` is `6mb` for the file plus form overhead, a limit that applies to every Server Action (D-278). The stored `Content-Type` is the detected one, never the browser's.
- Location data: a JPEG's APP1 segments (Exif and XMP) are removed before storing it, and a minimal Exif holding only the orientation tag is written back when the photo had one; other segments, the colour profile included, are kept. PNG, WebP and GIF are stored byte for byte (their metadata is a follow-up). No re-encoding. A JPEG whose segments do not parse is refused.
- Only `news.manage` can upload (`requirePermission` in the action, then the controller's own check), refused before the file is read; at most 60 uploads per account per hour (`hitRateLimit`, key `media_upload:account:{accountId}`), counted only for permitted calls. Logs carry the account id, the key, the byte size, the detected type and an outcome code; never the file name, the bytes, the alt text or a credential.
- Keys are `news/{yyyy}/{mm}/{uuid}.{ext}` from the server's clock, a random uuid and the detected type, so a name from the browser never reaches a key. Written with `Cache-Control: public, max-age=31536000, immutable` and no ACL (ACLs are disabled on the bucket, D-276).
- Articles store keys, not URLs (D-277), and the sanitiser keeps `data-media-key` only when it matches the key pattern exactly (`isNewsMediaKey`), dropping any `src` beside it; the page builds the URL from `MEDIA_PUBLIC_BASE_URL`, which the config refuses unless it is `https` with no query, fragment, user or password, so a built URL cannot break out of its attribute.
- Nothing is deleted from the bucket (D-279); orphan clean-up is a later job.

**Excel import (REQ-038)** — staff-supplied spreadsheets:

- Parse with limits: maximum rows, maximum cell length, maximum file size.
- A formula in a cell is data, never something to evaluate.
- The dry run runs in a transaction that rolls back (`05-database.md`), so a malformed file cannot half-import.
- Import runs under the importing staff member's permissions. A spreadsheet must not be a way to change what its uploader could not change by hand.

### Personal data and PDPA

PDPA still applies, but the site has no self-service for viewing, correcting or
deleting one's own data: REQ-046 is removed and staff handle those requests
(D-197).

- Collect only what an order needs. A field nobody uses is a field that can leak.
- Personal fields are separable from an order's financial content (`05-database.md`), which is what makes erasure conceivable at all.
- **Never log personal data.** No addresses, no phone numbers, no email bodies, no slip images in logs.
- Emails go only to the address on the account.

> **Resolved (Q-028, D-070).** A deletion request erases personal fields not
> covered by the five-year retention rule; fields on a retained tax/accounting
> document are kept as an accepted legal exception.

### Logging

Log enough to investigate, never enough to leak.

| Always log | Never log |
| :--- | :--- |
| Authentication attempts, success and failure | Passwords, tokens, session ids |
| Every permission denial | Personal data of any kind |
| Every stock movement, with actor and source | Card data, in any form |
| Every webhook received, with its raw body | Secrets, environment values |
| | Full request bodies containing personal data |

Every log line carries a request id. Errors returned to a user carry that id
and nothing else — no stack, no SQL, no file path.

### Dependencies

- Exact versions, lockfile committed.
- A vulnerability audit runs in CI and blocks the merge on a high severity finding.
- A new dependency needs a reason in the pull request. A package pulled in for one function is a package we now maintain, and it is the supply chain the whole application inherits.

---

## Part 2 — Testing

### The three layers

Three layers, each answering a question the others cannot (D-043).

| Layer | Tool | Runs against | Answers |
| :--- | :--- | :--- | :--- |
| **Domain unit** | Vitest | Nothing. Pure functions | Is the business rule right? |
| **Integration** | Vitest | A real PostgreSQL | Do the rule, the schema and the constraints agree? |
| **Manual checklist** | A person | The running application | Does it actually work for the person using it? |

Component tests render with `react-dom/server` under Node. A test that needs a real DOM (focus, element identity across a re-render, effects) opts in per file with `// @vitest-environment jsdom` (dev dependency `jsdom`, D-150) and is named `*.dom.test.tsx`; there is no global DOM environment, so every other test stays on Node.

**Why a real PostgreSQL and not an in-memory substitute.** The rules that
matter most here are database behaviours: row locking under concurrency,
sequence semantics, check constraints. A substitute that does not implement
them tests nothing about the thing most likely to be wrong.

**Why a manual checklist survives at all.** `09-coding-guidelines.md` requires
one per plan. Nothing automated tells you that a Thai product name overflows
its cell on a 360px phone, or that the staff member cannot find the refund
button. Both are real defects and neither has a unit test.

### The four invariants

The four invariants in `03-architecture.md` carry integration tests written
**before** the implementation merges (D-044). **Invariant 1 (no overselling) is
withdrawn for website orders by D-096**, so three invariants now carry tests; the
withdrawn row stays visible below. Not after, not "when there's
time". Each produces damage that is discovered late and cannot be undone by
correcting the code.

| Invariant | The test that proves it |
| :--- | :--- |
| ~~No overselling (REQ-020)~~ — **withdrawn, D-096** | ~~N concurrent orders against a stock of 1. Exactly one succeeds; the rest fail with a conflict; the final quantity is 0 and never negative~~ Not required: website orders never change stock. What stays testable is the `CHECK (stock_quantity >= 0)` constraint on the mirrored copy |
| Gap-free invoice numbers (REQ-025) | N concurrent orders, plus orders that fail and roll back. The issued numbers form an unbroken run |
| VAT correctness (REQ-023) | Table-driven, over mixed carts, odd amounts and rounding boundaries. Lines always sum to the total |
| Permission enforcement (REQ-034, REQ-035) | Every protected action attempted as every role. Only the permitted combinations succeed |

The invoice-number test must be genuinely concurrent — parallel transactions against a
real database (the withdrawn overselling test was the other). A sequential test passes on code that oversells, which makes it
worse than no test, because it makes someone confident.

### What is worth testing

| Test | Do not test |
| :--- | :--- |
| Business rules, especially arithmetic | That React renders |
| Every boundary: zero, one, maximum, empty, negative | That Prisma runs a query |
| Every failure path — out of stock, expired, denied, malformed | Implementation detail. A test that breaks on a rename tests the name |
| Every state transition, including illegal ones | Getters and setters |
| Every input validator, with the input it should reject | Third-party libraries |

Aim coverage at the domain layer. **Coverage of a route file is close to
meaningless** — the route is four lines that parse, authorize and delegate.
Coverage of `src/server/domain/` is the number worth watching.

### Test data

- Generated per test, never shared between tests. A test that depends on another test's leftovers fails in a different order.
- **Never real customer data. Never a real tax id, bank account, merchant id or credential** — including in fixtures and `prisma/seed.ts`.
- Thai text in every fixture that renders text. An English-only fixture will not catch the layout defects that matter here.
- Money fixtures use awkward numbers. `100.00` passes on arithmetic that `133.33` fails.

### End-to-end

Playwright, and few of them. They are slow and they break for reasons that
have nothing to do with the change under review. Reserve them for journeys
where a break means the shop cannot trade:

1. Browse → variant → cart → checkout → order placed → K-Payment confirms → stock deducted → email sent.
2. Staff sign-in like a customer, with a staff role (no second factor, D-232).
3. Excel import dry run, then real import.
4. Dropship: customer requests availability check → staff authorizes → customer pays.

Each runs in Thai and in English.

### Before a pull request merges

- [ ] `typecheck`, `lint`, `format` pass.
- [ ] Unit and integration tests pass.
- [ ] New behaviour has a test; a fixed bug has a test that fails without the fix.
- [ ] If it touches an invariant, its integration test exists and is genuinely concurrent.
- [ ] Every new input is validated at the boundary with Zod.
- [ ] Every new protected action checks permission in the domain layer.
- [ ] No secret, credential or real account identifier anywhere in the diff.
- [ ] No personal data in any new log line.
- [ ] Every new user-facing string is a message key, present in both `th.json` and `en.json`.
- [ ] Every screen touched has been viewed in Thai and in English, at 360px.
- [ ] Loading, empty and error states exist for anything that loads.
- [ ] The plan's manual checklist has been run, and the result recorded in the plan.
- [ ] The documentation records the change (D-092), or the pull request says why none was needed.

## Undecided

| Area | Blocked on |
| :--- | :--- |
| K-Payment's actual security requirements (signing, retry, error behaviour) | Q-033 residual — credentials exist, sandbox testing not yet done |
| A named approver for phase sign-off | Q-052 residual — criteria are drafted in `15-acceptance-criteria.md` |
| Backup restore testing | AWS services (Q-063, [ADR-0004](adr/ADR-0004-aws-hosting-and-environments.md)) — strategy proposed in `10-deployment.md#backup` (D-088), restore must still be performed and timed |

**Resolved since the last revision:** staff second factor was email OTP only
(D-064, Q-017; superseded by D-232, no second factor); PDPA erasure versus retention (D-070, Q-028); there is no
audit log to scope (D-066, Q-020); Cloudflare's role is Free-plan
security/bot protection (D-087, Q-054).
