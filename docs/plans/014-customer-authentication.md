# 014 — Customer authentication with Amazon Cognito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** In progress — approved design 2026-11-04; Task 1 (docs and names) done 2026-11-10
- **Phase:** 3 (storefront), an early slice on the project owner's request of 2026-11-03
- **Requirements touched:**
  - REQ-011, the register and sign-in part. Order history and invoices stay open.
  - REQ-053 / D-061: signed-out visitors see only the home page's products.
  - REQ-007 (Thai and English) and REQ-009 (mobile-first).
- **Depends on plans:** 011 (header, home page), 013 (product pages)
- **Spec:** [`docs/superpowers/specs/2026-11-03-customer-authentication-design.md`](../superpowers/specs/2026-11-03-customer-authentication-design.md). Section references below (§n) are to the spec. Read it first.
- **Design:** no file. A centred card in the `design/` theme (spec §8).
- **Branch:** `feat/win/customer-auth`, from `main`

**Goal:**
- A customer registers with email and password (confirmed by a 6-digit code), or signs in with Google.
- One email is one account.
- Sessions are ours: a 15-minute access token refreshed silently, and 7 days from sign-in.
- Product pages require sign-in.

**Architecture:**
- **Adapter:** one Cognito adapter (`src/server/adapters/cognito/`) is the only code that calls Cognito.
- **Services:** framework-free auth services in `src/server/services/auth/` hold the flows, the session rules and the rate limits.
- **Repositories:** they store `customer`, `customer_session` and `auth_rate_limit`.
- **Pages and actions:** Server Actions and two route handlers are thin wrappers over controllers in `src/server/controllers/auth/`.
- **Lambda:** one pre sign-up Lambda in `infra/cognito/pre-sign-up/` does the account linking (§6.3).

**Tech stack:**
- Next.js 16 App Router (Server Actions, `cookies()`), Prisma 7, Zod, next-intl and Tailwind 4.
- New: `@aws-sdk/client-cognito-identity-provider` and `aws-jwt-verify`.

## Global Constraints

- **Layers (D-101, D-116):**
  - Services import nothing from `next`, `react`, `@prisma/*` or the AWS SDK; they get the adapter and repositories as dependencies.
  - Only `src/server/adapters/cognito/` imports the AWS SDK or builds a Cognito URL.
  - Only repositories import Prisma.
- **No AWS credentials in the app.** It uses public Cognito APIs with `COGNITO_CLIENT_ID` and `COGNITO_CLIENT_SECRET` only (§4).
- **Secret hash.** Every call that has the client secret sends `SECRET_HASH = base64(HMAC-SHA256(clientSecret, username + clientId))`. The username is the email for sign-up, sign-in and reset, and the `sub` for refresh.
- **Token lifetimes are pool settings, not code:** access 15 min, ID 15 min, refresh 7 days, rotation off (O-7). The code reads `exp` from the tokens and never hard-codes 15 minutes.
- **Cookies:**
  - `tinzshop_session`: HttpOnly, Secure, `SameSite=Lax`, path `/`, `maxAge` until `expires_at`. The value is 32 random bytes in base64url; only its SHA-256 is stored.
  - `tinzshop_oauth` (Google state): sealed, HttpOnly, 10 minutes, path `/api`.
  - `tinzshop_pending` (the email between register and verify): sealed, HttpOnly, 1 hour, path `/`.
  
  Sealed means `encryptSecret` with `SESSION_TOKEN_ENCRYPTION_KEY`.
- **No enumeration (08, O-9).** Sign-in failures say `shop.auth.error.invalidCredentials` only. Register always continues to the verify page. Forgot password always says "if this email has an account, we sent a code".
- **Rate limits (§7):** sign-in 10 per 15 min; register, verify, resend and forgot password 5 per hour. Each is applied twice, keyed `{action}:ip:{ip}` and `{action}:email:{sha256(lowercased email)}`.
- **Never logged:** passwords, codes, tokens, cookie values or a raw email. Log the customer id or the email hash.
- **Text:** every string is a message key in `messages/th.json` and `messages/en.json` under `shop.auth.*` (D-032). Cognito's own text is never shown.
- **`returnTo`:** it must start with `/` but not `//`, contain no `\`, and must not contain a locale prefix. Otherwise it becomes `/`.
- **Signed-out pages never read Cognito config.** With no cookie, the session read must not call `getAuthConfig()`. So a missing Cognito setting never breaks the home page or news.

## Review Focus

1. **Two tabs, one refresh.** Two requests arrive with an expired access token at the same moment. Both succeed and the session stays valid; neither request deletes it. Pinned in Task 4.
2. **Cognito unreachable during a refresh.** The session row is **kept** and the visitor is treated as signed out for that request only. Only a definite rejection (`not_authorized`) deletes the row. Pinned in Task 4.
3. **The same email in mixed case** (`Somchai@Gmail.com` vs `somchai@gmail.com`). It is one customer, one rate-limit key, and one upsert. Pinned in Tasks 3 and 5.
4. **A hostile `returnTo`:** `//evil.com`, `/\evil.com`, `https://evil.com`, `/th/product`. Each lands on a safe same-site path. Pinned in Task 4.
5. **A signed-in customer whose session expired mid-browse** opens a product page. They are sent to sign-in with `returnTo`, and land back on that product. Pinned in Task 9.

## Plan rulings (where the spec left mechanics open)

- **R1, after verifying the code.** The spec (§6.1 step 4) signs in "with the password it still holds for that request". But the code is entered in a later request, and keeping a password between requests is not acceptable. So:
  - **Ordinary verify:** it redirects to sign-in, with the email filled in and the message `shop.auth.verify.confirmed`.
  - **O-9 reset path:** the customer types a new password in that same request, so they are signed in directly.
  - If check 7 in Task 2 shows Cognito can sign in from the confirmation itself, Task 7 uses that instead. Cost if wrong: one extra password entry.
- **R2, Server Components cannot set cookies.** The session read never writes the cookie. A dead session is treated as signed out and its cookie is cleared by the next Server Action or route handler. Cost: none to the visitor.
- **R3, module name.** `auth` is the module folder in every layer. The planned `access/` folder (04) stays for permission evaluation.

---

### Task 1: Docs, decisions and names

- [x] **ADR-0003** "Customer authentication via Amazon Cognito", status Accepted (2026-11-04). It records:
  - Context: 08's in-house design.
  - Options: in-house versus Cognito (§3).
  - Decision and consequences: hash lock-in, AWS dependency, Lambda, the D-074 exception.
  
  **ADR-0002** gets one Context line: "Customer login depends on AWS Cognito (ADR-0003)". It stays Proposed.
- [x] **D-rows from D-152:**
  - O-1 to O-10
  - the "my call" items in §4 to §8: Lite tier, email-only required attribute, password policy, bilingual template, names copied once, the session key, deleting an unverified account on Google sign-in, the rate limits, the header menu
  - the D-074 exception
  - the two dependencies
  - rulings R1 to R3
  
  The O-10 row says that plan 013's product pages (D-142) now require sign-in.
- [x] **Owning docs:**
  - **`08` §Authentication:** the customer row points to ADR-0003. Staff are unchanged.
  - **`05`:** the three tables.
  - **`06`:** `GET /api/auth/google`, `GET /api/callbacks/cognito`, and the auth Server Actions with their error codes. Also add them to `docs/openapi.yaml`.
  - **`07`:** the auth card, the signed-in header, the product-page redirect.
  - **`14`:** a Cognito section with the pool setup checklist (§4), copied as steps.
  - **`04`:** `adapters/cognito/`, `auth/` modules, `infra/cognito/`; the dependencies, removed from *Deliberately not in the stack yet*.
  - **`02`:** a phase 3 note naming plan 014.
- [x] **`13-open-questions.md`:**
  - Google sign-in recorded as the owner's request (no source).
  - A new UNRESOLVED question, Q-059: who owns and pays for the AWS account at go-live.
- [x] **Glossary:**
  - customer session
  - user pool
  - account linking
  - access, ID and refresh token
  - pre sign-up trigger
  - `auth_rate_limit`
  - the three cookies
  - every route in this plan
  - the `CognitoIdentity` interface
- [x] **`CLAUDE.md`:** allow plan 014 alongside 010 to 013.
- [x] **Commit:** `docs: record customer authentication with Cognito as plan 014`

### Task 2: Verify Cognito in the dev pool (with the owner)

The owner creates the dev pool from the `14` checklist, with a Google client. Then a person runs each check and writes the answer here. **Tasks 3 to 5 may start in parallel. Tasks 6 to 8 wait for this one.** An answer that contradicts the spec goes back to the owner (§13).

- [ ] 1. Cognito is offered in `ap-southeast-7`: ______ (otherwise `ap-southeast-1`)
- [ ] 2. The Lite tier allows the Google provider, the pre sign-up trigger and 15 min / 7 day tokens: ______
- [ ] 3. The first Google sign-in after the trigger links the user fails once. Error text in the callback: ______
- [ ] 4. A user made by `AdminCreateUser` + `AdminSetUserPassword` (permanent) can use `ForgotPassword`: ______
- [ ] 5. Registering again with an unconfirmed email gives `UsernameExistsException`, and `ResendConfirmationCode` works: ______
- [ ] 6. `ConfirmSignUp` with a reset code on a confirmed account gives an error distinct from `CodeMismatchException`: ______
- [ ] 7. Cognito can sign in straight from `ConfirmSignUp` on this tier (ruling R1): ______
- [ ] **Commit** the answers: `docs: record the Cognito dev pool checks for plan 014`

### Task 3: Tables and repositories

**Files:**
- `prisma/schema.prisma`, plus a migration `customer_authentication`
- `src/server/repositories/auth/customer-repository.ts`
- `src/server/repositories/auth/customer-session-repository.ts`
- `src/server/repositories/auth/auth-rate-limit-repository.ts`
- tests in `tests/integration/auth/`

**Produces:**
- `upsertCustomerBySub(input: { sub: string; email: string; firstName: string; lastName: string | null }): Promise<{ ok: true; customer: CustomerRecord } | { ok: false; reason: 'email_taken' }>`. Names are written on create only; email is updated on every call.
- `insertCustomerSession(row: NewCustomerSession): Promise<void>`
- `findCustomerSession(tokenHash: string): Promise<(CustomerSessionRecord & { customer: CustomerRecord }) | null>`
- `updateSessionAccessToken(id: string, sealed: string, expiresAt: Date): Promise<void>`
- `deleteCustomerSession(tokenHash: string): Promise<void>`
- `deleteCustomerSessions(customerId: string): Promise<void>`
- `hitRateLimit(key: string, windowStart: Date, sweepBefore: Date): Promise<number>`. It increments with `INSERT … ON CONFLICT DO UPDATE … RETURNING count` and deletes rows with `window_start < sweepBefore`, in one transaction.
- `CustomerRecord = { id; cognitoSub; email; firstName; lastName }`

- [x] **Failing integration tests:**
  - `upsert creates once and keeps names on a second sign-in`
  - `two upserts for one sub at once make one row`
  - `upsert refuses an email held by another sub`
  - `email is stored lowercased` (Review Focus 3; the migration adds `CHECK (email = lower(email))`)
  - `session lookup returns the customer and deleting all sessions for a customer leaves others`
  - `hitRateLimit counts within a window and sweeps ended windows`
- [x] **Implement:**
  - **Models:** `Customer` (`customer`), `CustomerSession` (`customer_session`, FK on delete cascade, index on `customer_id`) and `AuthRateLimit` (`auth_rate_limit`, PK `key, window_start`), with the fields of §5 in snake_case.
  - **Migration:** forward-only, with its SQL reviewed (D-015).
  - **Repository functions:** as above.
- [x] **Commit:** `feat: add customer, session and rate-limit tables`

### Task 4: Config, Cognito adapter and the session service

**Files:**
- `src/server/config.ts` (`AuthConfig`, `parseAuthConfig`, `getAuthConfig`)
- `.env.example`
- `src/server/adapters/cognito/client.ts`, `errors.ts`, `secret-hash.ts`
- `src/server/services/auth/customer-session-service.ts`, `client-ip.ts`, `return-to.ts`
- tests beside each file

**Produces:**
- **`AuthConfig`:** `{ region; userPoolId; clientId; clientSecret; domain; sessionTokenEncryptionKey: Buffer; trustedProxyHeader: 'x-forwarded-for' | 'cf-connecting-ip' }`. `TRUSTED_PROXY_HEADER` is optional and defaults to `x-forwarded-for`. The key is 32 bytes, base64. All other values are required.
- **`CognitoIdentity` interface**, implemented by `createCognitoIdentity(config)`:
  - `signUp({ email, password, firstName, lastName })`
  - `confirmSignUp({ email, code })`
  - `resendConfirmationCode({ email })`
  - `signInWithPassword({ email, password }) → CognitoTokens`
  - `refresh({ sub, refreshToken }) → { accessToken; idToken; accessExpiresAt }`
  - `forgotPassword({ email })`
  - `confirmForgotPassword({ email, code, newPassword })`
  - `revokeRefreshToken(refreshToken)`
  - `googleAuthorizeUrl({ state, codeChallenge, redirectUri }) → string`
  - `exchangeCode({ code, codeVerifier, redirectUri }) → CognitoTokens`
  - `verifyIdToken(idToken) → { sub; email; givenName: string | null; familyName: string | null }`
- **`CognitoTokens`:** `{ accessToken; idToken; refreshToken; accessExpiresAt: Date }`.
- **Errors:** every failure throws `CognitoError` with a `code` from `'username_exists' | 'code_mismatch' | 'code_expired' | 'already_confirmed' | 'not_authorized' | 'user_not_confirmed' | 'invalid_password' | 'limit_exceeded' | 'unavailable'`. A network failure or 5xx is `unavailable`.
- **Session service:**
  - `startCustomerSession(deps, { customerId, tokens, now }) → { token: string; expiresAt: Date }`, where `expiresAt = now + 7 days`
  - `readCustomerSession(deps, token: string | undefined, now) → CurrentCustomer | null`
  - `endCustomerSession(deps, token)`
  - `endAllCustomerSessions(deps, customerId)`
  - `CurrentCustomer = { id; firstName; email }`
- **Helpers:** `resolveClientIp(headers: Headers, trusted)` and `safeReturnTo(value: string | null) → string`.

- [x] **Failing unit tests:**
  - **Config:** `parseAuthConfig` rejects a short key and an empty client secret, and the error never contains values.
  - **Adapter** (fake SDK `send`, like the Shopee tests):
    - each Cognito exception maps to its code, and a thrown network error maps to `unavailable`
    - `SECRET_HASH` matches a known vector
    - `googleAuthorizeUrl` carries `identity_provider=Google`, `code_challenge_method=S256` and the scopes `openid email profile`
  - **Session service** (fake repositories and fake adapter):
    - `no cookie never reads auth config`
    - `valid session within access lifetime does not refresh`
    - `expired access token refreshes and stores the new expiry`
    - `two concurrent refreshes both succeed` (Review Focus 1)
    - `refresh rejected deletes the session`
    - `refresh unavailable keeps the session and returns null` (Review Focus 2)
    - `past expires_at deletes the session without calling Cognito`
  - **`safeReturnTo`:** the Review Focus 4 table. **`resolveClientIp`:** takes the right-most `X-Forwarded-For` entry, and `cf-connecting-ip` when it is configured.
- [x] **Implement** to pass. Install the dependencies as exact versions: `npx npm@11.21.0 install --save-exact @aws-sdk/client-cognito-identity-provider@<latest> aws-jwt-verify@<latest>`, recording the versions in the D-row. Add the 6 + 1 variables to `.env.example` as placeholders, with a comment on each.
- [x] **Commit:** `feat: add the Cognito adapter and customer sessions`

### Task 5: Rate limits

**Files:** `src/server/services/auth/rate-limit-service.ts` and its test.

**Produces:** `checkAuthRateLimit(deps, action: 'sign_in' | 'register' | 'verify' | 'resend' | 'forgot_password', { ip, email, now }) → { ok: true } | { ok: false; error: { code: 'auth.rate_limited', messageKey: 'shop.auth.error.rateLimited' } }`. It keys both the IP and the hashed, lowercased email.

- [x] **Failing tests:**
  - `11th sign-in in 15 minutes from one ip is refused`
  - `6th forgot-password for one email from many ips is refused`
  - `email case does not split the counter` (Review Focus 3)
  - `the raw email never appears in a key`
- [x] **Implement** to pass.
- [x] **Commit:** `feat: rate-limit customer sign-in, registration and reset`

### Task 6: Pre sign-up Lambda (account linking)

**Files:**
- `infra/cognito/pre-sign-up/index.mjs`, `index.test.mjs`, `README.md` (the deploy steps and the IAM role's permissions: `ListUsers`, `AdminLinkProviderForUser`, `AdminCreateUser`, `AdminSetUserPassword`, `AdminDeleteUser`, limited to the one pool)
- `vitest.config.ts` (add `infra/**/*.test.mjs` to `include`)

**Produces:** `createPreSignUpHandler({ cognito })`, plus `export const handler` built with the runtime's SDK client. Plain ESM JavaScript with JSDoc types, so the Lambda needs no build step.

- [ ] **Failing tests,** one for each §6.3 case, on a `PreSignUp_ExternalProvider` event:
  - `rejects a Google email that is not verified`
  - `links to an existing verified user`
  - `deletes an unverified user, then creates and links`
  - `creates a confirmed user with Google names and an unusable random password, then links`
  - `passes ordinary sign-ups through unchanged`
  - `matches the email case-insensitively`
- [ ] **Implement** to pass. The random password is 32 bytes from `crypto.randomBytes` and is never logged.
- [ ] **Commit:** `feat: add the Cognito pre sign-up trigger that links Google to one account`

### Task 7: Customer auth service and Server Actions

**Files:**
- `src/server/services/auth/customer-auth-service.ts`
- `src/server/controllers/auth/customer-auth-controller.ts`
- `src/app/[locale]/(shop)/(auth)/actions.ts` (`'use server'`, thin)
- tests beside the service and the controller

**Produces:** these service functions, each returning `Result<…>` (06):
- `register`, which always returns `{ next: 'verify' }`:
  - **O-9:** on `username_exists` it calls `forgotPassword`.
  - **Never-confirmed account:** if `forgotPassword` answers `user_not_confirmed`, it calls `resendConfirmationCode` instead (§6.1).
- `confirmRegistration`, which returns `{ next: 'sign_in' }`, or `{ next: 'choose_password' }` on `already_confirmed`
- `completePasswordChoice` (`confirmForgotPassword`, then sign-in and end all other sessions)
- `resendCode`
- `signIn`
- `requestPasswordReset`
- `confirmPasswordReset` (also ends all sessions)
- `signOut`

The controller validates `FormData` with Zod: names 1 to 100 characters after trimming, an email, a password matching the pool policy, the two passwords equal, and a code of 6 digits. It returns `{ fieldErrors?, formError?: messageKey, redirectTo? }` for `useActionState`.

- [ ] **Failing tests:**
  - `register with a taken email shows the same verify step and starts a reset` (O-9)
  - `register with a never-confirmed email resends the sign-up code`
  - `verify with a reset code on a confirmed account asks for a new password`
  - `wrong password and unknown email give the same error`
  - `unconfirmed sign-in goes to verify`
  - `forgot password answers the same for unknown emails`
  - `password reset ends every session of that customer`
  - `sign-in upserts the customer by sub with lowercased email`
  - `mismatched passwords are a field error and never reach Cognito`
  - `rate-limited action returns rateLimited before calling Cognito`
- [ ] **Implement** to pass. The actions set and clear the cookies (session and pending).
- [ ] **Commit:** `feat: add customer registration, verification, sign-in and reset`

### Task 8: Google sign-in routes

**Files:**
- `src/app/api/auth/google/route.ts`
- `src/app/api/callbacks/cognito/route.ts`
- `src/server/controllers/auth/google-sign-in-controller.ts` and its test

**Produces:**
- **`GET /api/auth/google?returnTo&locale`:** sets `tinzshop_oauth` (`{ state, codeVerifier, returnTo, locale, retried: false }`) and answers 302 to `googleAuthorizeUrl`.
- **`GET /api/callbacks/cognito`:**
  1. checks `state` against the cookie
  2. on the Task 2 check 3 error with `retried: false`, sets `retried: true` and redirects to authorize once more
  3. exchanges the code and verifies the ID token
  4. upserts the customer and starts the session
  5. clears `tinzshop_oauth` and answers 302 to `/{locale}{safeReturnTo}`
  
  Any failure answers 302 to `/{locale}/sign-in?error=google`. Every response has `Cache-Control: no-store`.

- [ ] **Failing tests:**
  - `state mismatch is refused without a token exchange`
  - `the linking error retries once, then shows the error`
  - `success sets the session cookie and redirects to returnTo`
  - `a missing last name from Google is accepted`
  - `an email held by another sub fails and logs the hash only`
- [ ] **Implement** to pass.
- [ ] **Commit:** `feat: add sign-in with Google through Cognito`

### Task 9: Pages, header and product gating

**Files:**
- **Pages** in `src/app/[locale]/(shop)/(auth)/`: `sign-in/page.tsx`, `register/page.tsx`, `register/verify/page.tsx`, `forgot-password/page.tsx`
- **Shared parts** in `_components/`: `AuthCard.tsx`, `AuthField.tsx`, `GoogleButton.tsx`, `AuthForm.tsx` (client, `useActionState`)
- `messages/*.json`
- `SiteHeader.tsx`, with a client `AccountMenu.tsx`
- the home page and both product pages

**Interfaces:**
- **Consumes:** the Task 7 actions, `readCustomerSession` (through the composition root as `getCurrentCustomerReader()`) and `safeReturnTo`.
- **Produces:** `SiteHeaderProps.customer?: { firstName: string } | null`.

- [ ] **Failing tests:**
  - **Render tests:** each page shows its fields, the other page's link at the top right, and the "ลืมรหัสผ่าน?" link on the password label row. The verify page switches to a new-password field on `choose_password`.
  - **Header:** the signed-out header links to sign-in; the signed-in header shows the first name and the "ออกจากระบบ" form.
  - **Gating:**
    - `signed-out /product redirects to sign-in with returnTo`
    - `signed-out product detail redirects with that product as returnTo` (Review Focus 5)
    - `signed-in customer opening sign-in goes home`
  - **News:** `news pages stay public`.
  - **Messages:** the message key parity test passes for th and en.
- [ ] **Build:**
  - **Card** (§8): centred, `max-w-sm`, with the design's `@theme` tokens. The title and description sit at the top, with the other page's link at the top right. Labels sit above the inputs. The primary button is full width, and the outline Google button below it carries the Google mark. Mobile is checked at 360px, with controls at least 44px tall (07).
  - **Gating:** `/product` and `/product/{id}/detail` call `redirect()` to `/{locale}/sign-in?returnTo=…` when there is no customer (D-041, on the server).
  - **Home page:** the welcome box's buttons link to sign-in and register.
- [ ] **Commit:** `feat: add the sign-in and register pages and require sign-in for products`

### Task 10: Local setup and the manual checks

- [ ] **`16-local-setup.md`:**
  - a Cognito step: get the 6 values from a teammate privately; add the dev callback ports 3000 and 3002
  - a note that product pages now need a signed-in dev account
- [ ] **`14`:** the Lambda deploy steps link to `infra/cognito/pre-sign-up/README.md`.
- [ ] **Commit:** `docs: add Cognito to the local setup guide`

---

## Manual test checklist

These are run by a person against the dev pool. Never tick a box for a check nobody performed.

- [ ] Register with a new email: the code arrives (bilingual), verifying works, and you can sign in. The header shows the first name.
- [ ] Register again with that same email: the page looks identical, and a reset code arrives. Entering it asks for a new password, then you're signed in.
- [ ] Sign in with Google using that same email: it's the same account (one `customer` row), with no visible error, even on the first link.
- [ ] Sign in with Google with a new Gmail: an account is created without a last name.
- [ ] Wrong password and unknown email show the same message. Repeating it 11 times in 15 minutes shows the rate-limit message.
- [ ] Forgot password works, and an earlier signed-in browser is signed out afterwards.
- [ ] Wait more than 15 minutes, then click around: there's no sign-in prompt, and `customer_session.access_token_expires_at` moved forward.
- [ ] Sign out: the cookie is gone, and the back button doesn't show a signed-in page.
- [ ] Signed out, open `/th/product` and a product: you're sent to sign-in, then back to that product. News stays open.
- [ ] At 360px wide, all four pages fit with no sideways scroll.

## Not in this plan

- Staff sign-in (plan 002)
- The profile page: names, phone, addresses, change email or password, sign out everywhere
- PDPA deletion
- Orders and checkout
- LINE or Facebook sign-in
- Infrastructure-as-code for the pool (phase 7)
