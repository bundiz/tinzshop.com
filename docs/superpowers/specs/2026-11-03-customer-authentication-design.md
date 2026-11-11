# Customer authentication with Amazon Cognito — design

- **Date:** 2026-11-03 · **Status:** approved by the project owner 2026-11-04
- **Authority:** the project owner's approval of this document is what unblocks plan 014 (the same way plans 010 to 013 were opened). On approval, ADR-0003 is written as Accepted, and the decisions get D-152 onward.
- **Requirement:** REQ-011, the register and sign-in part only. Order history and invoices stay open for the ordering plans. Staff sign-in (REQ-032, plan 002) is out of scope and comes next; this design keeps its shape in mind (§11).
- **Design file:** none for these pages. They follow the style of `design/` (header, buttons, form fields, colours). `design/index.html` already has the entry points: the header's "เข้าสู่ระบบ / บัญชีของฉัน" action and the welcome box's "เข้าสู่ระบบ" and "สมัครสมาชิก" buttons.

## 1. Intent

Customers must have an account to order: there is no guest checkout (D-061). This change lets a customer:
- register with an email and password
- or sign in with Google

Either way, one person has **one account**. Login is handled by **Amazon Cognito** rather than written in-house. The project owner chose this over the in-house design in `08-security-testing.md` §Authentication, after the trade-off in §3. Customer data stays in our PostgreSQL. Cognito holds only the identity: email, password and the Google link.

## 2. Owner decisions (2026-11-03)

- **O-1, provider:** customer login uses Amazon Cognito. Cognito's free tier covers 10,000 monthly active users with no end date, and Google sign-in counts within it. The shop expects far fewer (checked on aws.amazon.com/cognito/pricing on 2026-11-03).
- **O-2, hosting stays deferred:** the app's host is still chosen at phase 7 (ADR-0002). The app calls Cognito over the internet wherever it runs.
- **O-3, one account per email:** an email that arrives both through Google and through password registration is one account, with one order history.
- **O-4, email verification:** a password registration is confirmed with a 6-digit code sent by email before the account can sign in.
- **O-5, registration fields:** first name, last name, email, password and password again. These match what Google gives (given name, family name, email).
- **O-6, phone and address:** not asked at registration. They belong to the customer's profile, which is the next plan (§12).
- **O-7, tokens:** the access token lives **60 minutes** and is refreshed silently (the owner changed this from 15 minutes on 2026-11-11, D-176). The refresh token lives **7 days counted from sign-in**, after which the customer signs in again. Visiting does not extend it.
- **O-8, staff are separate:** staff sign in on their own page, against their own user pool and tables. They are not built here.
- **O-9, registering an email that already has an account** (2026-11-04): the page gives the same "check your email" answer as a new registration, so nobody can learn whether an email has an account. Behind the scenes the real owner is sent a password-reset code (§6.1).
- **O-10, signed-out visitors** (2026-11-04): REQ-053 / D-061 applies as written. A visitor who isn't signed in sees only the home page's products. The all-products page and product pages send them to sign-in first (§8).

## 3. Why Cognito (the trade-off as presented)

| | In-house (08 as written) | Cognito (chosen) |
| :--- | :--- | :--- |
| Password storage, reset, verification, Google token checks | we build and carry the risk | AWS carries it |
| Ties to AWS | none | login depends on AWS. The app's host stays open |
| Leaving later | easy | **password hashes cannot be exported**; leaving forces every customer to reset |
| Customer data | one database | identity in Cognito, everything else in PostgreSQL, linked by `cognito_sub` |
| Linking Google to an existing email | our code | a pre sign-up Lambda (§6.3) |
| Local development | Docker only | also needs a shared dev user pool (§10) |
| Cost at this shop's size | free | free (O-1); emails through SES cost a little |

## 4. Cognito setup

One **customer user pool**. Staff get a second pool in plan 002.

- **Region:** Asia Pacific (Thailand) `ap-southeast-7` if Cognito is offered there, else Singapore `ap-southeast-1` (verify, §13).
- **Feature tier:** Lite, unless verification finds a needed feature only in Essentials (§13). Both have the same 10,000-user free tier.
- **Sign-in identifier:** email, case-insensitive.
- **Required attributes: email only.** Required attributes cannot be changed after the pool is created, and some Google accounts have no family name. First and last name are enforced by our form, not by Cognito.
- **Self sign-up:** on. **Email verification:** a code, sent automatically on sign-up.
- **Prevent user existence errors:** on, so sign-in and password reset don't reveal whether an email is registered.
- **Password policy:** at least 8 characters, with at least one number, one lowercase letter, one uppercase letter and one special character. The owner chose this on 2026-11-11 (D-177), replacing my first call of "letters and numbers"; the policy is set once on the pool and stated on the register page.
- **Built-in lockout:** Cognito locks an account temporarily after repeated failed sign-ins. That covers 08's per-account limit. The per-source limit is ours (§7).
- **App client:** one confidential client with a client secret.
  - Auth flows: `USER_PASSWORD_AUTH` and refresh token.
  - OAuth: authorization code grant with PKCE, scopes `openid email profile`.
  - Identity providers: Cognito and Google.
  - Callback URLs: `http://localhost:3000/api/callbacks/cognito` and `http://localhost:3002/api/callbacks/cognito` for dev; the production URL is added at go-live.
  - Token validity: access 60 min, ID 60 min, refresh 7 days (D-176).
  - Refresh-token rotation: off (O-7).
- **Cognito domain** (a prefix domain) for the OAuth endpoints. Customers see it only for a moment during the Google redirect.
- **Google identity provider:** set up with the Google OAuth client id and secret. Those two values live **in Cognito, not in our `.env`**. Attribute mapping: `email`, `email_verified`, `given_name`, `family_name`.
- **Emails:** verification and reset codes.
  - **Development:** Cognito's built-in sender, limited to a few dozen emails a day.
  - **Production:** Amazon SES with a `tinzshop.com` sender. That needs DNS records, and who controls DNS is still open (Q-053).
  - **Template:** one bilingual message, Thai first and English below. This is my call; it avoids a message Lambda.
  - **This is a deliberate exception to D-074.** Login codes are sent by Cognito itself, not through our mail-relay adapter, because Cognito generates the codes. Order emails still use the mail relay. It gets its own D-row.
- **Lambda:** one pre sign-up trigger (§6.3). It is the only AWS code we write, and it lives in `infra/cognito/pre-sign-up/`. Until hosting and infrastructure-as-code are chosen (phase 7), the pool and the Lambda are set up by hand from a checklist in `14-integrations.md`.

**The app holds no AWS credentials** for this feature. Every call it makes is a public Cognito API, authorised by the client id and secret. Only the Lambda uses admin APIs, through its own IAM role.

## 5. Data model

Naming follows the existing tables: snake_case, singular, uuid ids.

**`customer`** is created on the customer's first successful sign-in, by either path.
- `id`
- `cognito_sub`, unique: the Cognito user's id. After linking (§6.3), Google sign-ins carry the same `sub`, so each person has exactly one.
- `email`, unique, stored lowercased. It is copied from Cognito at each sign-in, and Cognito stays its master.
- `first_name`
- `last_name`, nullable, because some Google accounts have none
- `created_at`, `updated_at`

The row is written by an **upsert on `cognito_sub`**, so two first sign-ins at once still make one row. If the email already belongs to a different `sub`, sign-in fails and is logged. Cognito keeps emails unique, so that would mean data has gone wrong, and it must never be silently overwritten.

Names are copied from Cognito **once**, when the row is created. After that our database is their master, and the profile plan edits them here. The other fields `05-database.md` lists for `customer` (phone, tax ids, PDPA deletion) come with the plans that use them.

**`customer_session`** is our own session. 08 requires sessions we can end at once.
- `id`
- `token_hash`, unique: SHA-256 of the random token in the cookie. The cookie value itself is never stored.
- `customer_id`, FK
- `refresh_token_sealed`, `access_token_sealed`: encrypted with `encryptSecret` (`src/lib/secret-box.ts`), using a new key `SESSION_TOKEN_ENCRYPTION_KEY`. It is separate from the Shopee key, so rotating one never logs out the other. The sealed tokens get the same protection as the Shopee tokens. A database leak alone gives nothing: the key is needed too. **Rotating this key** means deleting every session row, so every customer signs in once more. No key-id column.
- `access_token_expires_at`
- `expires_at`: sign-in time + 7 days, the same as the refresh token
- `created_at`

**`auth_rate_limit`** is the per-source counter (§7).
- `key`: for example `sign-in:{ip}`. It holds an IP address, which is personal data, so rows are deleted when their window ends.
- `window_start`, `count`
- primary key (`key`, `window_start`)

There is no password, reset-token or Google-account table: Cognito holds those. The `role` table (D-062) comes with plan 002. Until then, any signed-in person who has a `customer` row is a customer.

## 6. Flows

All forms are Server Actions, which carry CSRF protection (06). Every Cognito call goes through one adapter, `src/server/adapters/cognito/`, and nothing else builds a Cognito URL. That matches how Shopee is handled.

### 6.1 Register with email and password
1. `/{locale}/register` takes first name, last name, email, password and password again. Mismatched passwords are caught on the form.
2. `SignUp` sends the email and password, with `given_name` and `family_name` as attributes, and Cognito emails a 6-digit code.
3. `/{locale}/register/verify` takes the code (`ConfirmSignUp`) and has a "resend code" button (`ResendConfirmationCode`, rate-limited).
4. Once confirmed, the customer is signed in straight away, without retyping: the action signs in with the password it still holds for that request (§6.2, step 2 onward).

**The email already has an account (O-9, changed by Q-060 and D-179):** `SignUp` answers `UsernameExistsException`. The action then calls `ForgotPassword` for that email, throws away the typed password, and shows **the same verify page** a new registration gets. So:
- **The stranger** sees exactly what a new registrant sees, and learns nothing. Whatever code they type, `ConfirmSignUp` fails and the page says the code is wrong. A confirmed account (`already_confirmed`) is answered exactly like a wrong code (`code_mismatch`): the same message, the same state and the same cookies.
- **The real owner** gets a reset code by email; the bilingual template says what it is for. The verify page always shows the link "Got a password-reset email instead? Set a new password" (`/forgot-password?step=reset`). It opens the reset-code step for the email in the pending cookie, with the code and a new password. No new code is sent. `ConfirmForgotPassword` finishes it, every session of that account ends, and the customer signs in on the sign-in page. This costs the owner one extra click and one sign-in.
- **Neither person** can get a different answer before entering a valid code. The reset step also gives one answer (a wrong code) for a wrong code, an unconfirmed account and an unknown user.

**The email has an account that was never confirmed:** the code is resent and the page goes to verify. The password is still the one from the first attempt, which may have been somebody else's, so the verify step must not simply confirm it (Q-061, below).

**Who created the account (Q-061, D-186).** A stranger can register a victim's email with the stranger's own password and never confirm it. When the victim registers, `SignUp` says the user exists, `ForgotPassword` fails because the email is unverified, and the sign-up code is resent; confirming it would hand the victim an account whose password the stranger chose, which a later Google sign-in would then keep. This is the takeover the pre sign-up Lambda prevents for Google (D-168). So the sealed pending cookie carries `createdHere`:
- **true** only when this browser's `SignUp` succeeded (a new account), or a password sign-in proved the password and Cognito answered "not confirmed";
- **false** for every other way the cookie is set (register on a taken email, forgot password) and for an older cookie that has no such field. Resending a code does not touch the cookie.

After a **correct** code:
- `createdHere` true: sign-in, as before (`?confirmed=1`, with `returnTo`; R1, D-173).
- `createdHere` false: the service quietly calls `ForgotPassword` for that email (it works now, because the code just verified the email) and the page goes to the reset step, `/forgot-password?step=reset&setPassword=1`, which tells the customer to finish by setting their password with the new code just emailed. `ConfirmForgotPassword` replaces the password and ends every session, which removes whatever the stranger set. A failed `ForgotPassword` still goes to the reset step, whose "Send a new code" button asks again. `returnTo` stays in the pending cookie, so the reset still ends on the page the customer came from.

**Invariant:** every answer before a correct code is the same whoever created the account (D-160, D-179). The flag lives only inside the sealed cookie, written as 1 or 0 so the cookie is the same length either way; only a correct code, which proves the mailbox, can lead to the different redirect. Until the real owner finishes the reset, the account still has the password set at sign-up; the reset is what removes it.

### 6.2 Sign in with email and password
1. `/{locale}/sign-in`: `InitiateAuth` with `USER_PASSWORD_AUTH`.
2. On success, the server verifies the ID token with `aws-jwt-verify`, creates or updates the `customer` row by `sub`, creates a `customer_session`, sets the cookie, and redirects to the `returnTo` path. Only same-site paths are allowed, so the redirect can't send the customer elsewhere.
3. A wrong email or wrong password gives the same "email or password is incorrect" (08). An unconfirmed account goes to the verify page.
4. **Forgot password:** `/{locale}/forgot-password` asks for the email (`ForgotPassword`), then the code plus a new password (`ConfirmForgotPassword`). It always answers "if this email has an account, we sent a code".
   - A customer who joined with Google sets a password this way, if they want one.
   - A reset signs out every session that customer has (§6.5).

### 6.3 Sign in with Google, and account linking (O-3)
1. The "Sign in with Google" button calls `GET /api/auth/google?returnTo=…`. The route stores `state`, the PKCE verifier and `returnTo` in a short-lived HttpOnly cookie. It then redirects to Cognito's `/oauth2/authorize` with `identity_provider=Google`, so the customer goes straight to Google and never sees a Cognito page.
2. Google returns the customer to Cognito, and Cognito returns them to `GET /api/callbacks/cognito?code&state`. The route checks `state`, exchanges the code at `/oauth2/token` with the secret and the verifier, and continues as in §6.2 step 2.
3. **The pre sign-up Lambda** runs on a Google login's first visit to Cognito (`PreSignUp_ExternalProvider`). It makes **every account a normal Cognito user, with Google linked to it**:
   - **Google says the email isn't verified:** reject.
   - **A normal user with this email exists and is verified:** link Google to it (`AdminLinkProviderForUser`).
   - **A normal user exists but was never verified:** delete it, then continue as if none existed. Whoever registered that email never proved they own it, and Google just did. This stops someone from registering a stranger's email and taking over their account later.
   - **None exists:** create a normal user (`AdminCreateUser`), with the email marked verified, the names from Google, an unusable random password (`AdminSetUserPassword`, permanent) and no invite email. Then link Google to it.
   - **Known Cognito behaviour (verify, §13):** after linking inside this trigger, the first Google sign-in fails once, and a retry succeeds as the linked user. The callback retries the authorize step **once** when it sees that error, so the customer doesn't notice.
4. Because a normal user always exists, a later password registration with the same email is caught by Cognito's own duplicate check (§6.1). One email is one Cognito user, one `sub` and one `customer` row.

### 6.4 Every request: session and silent refresh
1. A shared server helper reads the cookie, hashes it, and loads `customer_session` together with its `customer`. There's no row, or `expires_at` has passed? Then the visitor is signed out and the cookie is cleared.
2. `access_token_expires_at` has passed? The helper refreshes (`InitiateAuth` with `REFRESH_TOKEN_AUTH`) and stores the new sealed access token and expiry.
   - **Refresh fails** (the user was disabled or deleted, signed out everywhere, or the 7 days ran out): delete the row, and the visitor is signed out.
   - **Two requests refresh at once:** that's harmless, because rotation is off and the refresh token doesn't change.
3. So a change made in Cognito reaches the site within 60 minutes, and a sign-out made on the site takes effect at once.

### 6.5 Sign out
- **Sign out (this device):** a Server Action deletes the session row, revokes the refresh token (`RevokeToken`) and clears the cookie.
- **Password reset:** deletes **all** of that customer's session rows. Profile actions such as changing the password or email come in the next plan and will do the same.

## 7. Security rules

From 08, as they apply with Cognito:

- **Cookie:** HttpOnly, Secure, `SameSite=Lax`, path `/`. The value is a random 32-byte token; only its hash is stored. Signing in always issues a new token.
- **Tokens never reach the browser's JavaScript.** They are sealed in `customer_session`.
- **Rate limits,** using `auth_rate_limit`, on sign-in, register, verify, resend and forgot password. Each action is limited twice:
  - **per source,** keyed by the client IP
  - **per account,** keyed by the SHA-256 of the lowercased email, never the email itself
  
  Cognito's lockout and code throttling sit on top of this. The limits are my call: 10 per 15 minutes for sign-in, and 5 per hour for the others.
- **Reading the client IP** depends on what sits in front of the app (Cloudflare, plan 008), so it is one config switch, `TRUSTED_PROXY_HEADER`. Until that is set, the app uses the **right-most** `X-Forwarded-For` entry, the one the nearest proxy adds, and never trusts the left-most one, which the client controls.
- **Logs:** sign-in successes and failures are logged with the customer id or a hashed email. Passwords, codes, tokens and session ids are never logged.
- **Customer sessions are longer than staff sessions** (08): 7 days here, with staff shorter in plan 002.
- **The Google `returnTo`** is checked to be a path on this site.

## 8. Pages and header

| Route | Content |
| :--- | :--- |
| `/{locale}/sign-in` | email, password, "ลืมรหัสผ่าน?" (forgot password), "Sign in with Google", link to register |
| `/{locale}/register` | the five fields, the password rule, "Sign in with Google", link to sign-in |
| `/{locale}/register/verify` | the 6-digit code, resend |
| `/{locale}/forgot-password` | email, then code + new password |

- **Look (owner, 2026-11-04):** the layout of a centred login card the owner supplied as an example, built **with Tailwind and the design's `@theme` tokens, with no component library** (07 *No component library* stands):
  - **Header:** a title and short description, with the link to the other page (register or sign-in) at the top right.
  - **Fields:** a label above each input. "ลืมรหัสผ่าน?" sits on the password label's row, aligned right.
  - **Buttons:** the primary button fills the card's width, and below it is the outline Google button with the Google mark.
  
  All four pages use the same card. Its parts start in the auth route folder and move to `src/components/ui/` only under 07's rule of second use.
- **Header:** signed out, "เข้าสู่ระบบ / บัญชีของฉัน" links to sign-in. Signed in, it shows the first name with a small menu holding "ออกจากระบบ" (sign out). This is my call; the design has no signed-in state.
- **Home page welcome box:** its two buttons link to sign-in and register.
- **Language:** all text comes from message keys in Thai and English (D-032). Cognito's error codes map to our own messages, and Cognito's English text is never shown.
- A signed-in customer who opens sign-in or register is redirected home.
- **Signed-out visitors (O-10):**
  - **They see:** the home page and its products, and the news pages (news is not products).
  - **Sent to sign-in first:** `/{locale}/product` (all products) and `/{locale}/product/{id}/detail`. Clicking a product on the home page takes them to sign-in, with `returnTo` set to that product, so they land on it after signing in. The check is on the server, in the page, not only a hidden link (D-041).

## 9. Configuration

New variables go in `.env.example` with placeholders, read through the Zod config module:
- `COGNITO_REGION`
- `COGNITO_USER_POOL_ID`
- `COGNITO_CLIENT_ID`
- `COGNITO_CLIENT_SECRET`
- `COGNITO_DOMAIN`
- `SESSION_TOKEN_ENCRYPTION_KEY`

New dependencies, as exact versions: `@aws-sdk/client-cognito-identity-provider` and `aws-jwt-verify`, both published by AWS. Adding them needs a D-row (04, *Deliberately not in the stack yet*).

## 10. Local development and tests

- **One shared dev user pool** ("tinzshop-dev") for the team. A new developer gets the six values from a teammate privately, never through git. Its callback is `http://localhost:3000/...`, so no tunnel is needed. `16-local-setup.md` gains a Cognito section.
- **Unit tests** fake the Cognito adapter behind an interface, the way the Shopee tests do. **Integration tests** run against the real `tinzshop_test` database with the fake adapter. **No test calls AWS.**
- **The Lambda** has its own unit tests with a faked AWS SDK, one for each case in §6.3. It is part of plan 014, together with its deploy checklist.
- **CI never needs a pool.** Only a person's manual check uses the dev pool.

## 11. How staff will fit (plan 002, not built here)

Staff get their own pool, with no self sign-up: an admin invites each person. That pool has the email code as a second factor (D-064), which probably needs the Essentials tier, and shorter tokens. Staff also get `staff` and `staff_session` tables, their own sign-in page in `(admin)`, and the existing `role`/`permission` rows (D-040, D-062). A customer session can never reach staff pages, because the two sides share no table or cookie.

## 12. Not in this change

- Staff sign-in (§11)
- The profile page: names, phone, addresses, changing email or password, sign out everywhere
- PDPA account deletion
- Orders
- Sign-in with LINE or Facebook. Google is the only social login asked for.

## 13. To verify in the dev pool before building

1. Is Cognito offered in `ap-southeast-7`?
2. Does the Lite tier cover everything in §4, including the Google provider, the pre sign-up trigger and the token lifetimes?
3. Does the first Google sign-in after linking fail once (§6.3 step 3), and with what error text?
4. Does `AdminSetUserPassword` (permanent) let a Google-created user later reset their password through `ForgotPassword`?
5. Does registering again with an unconfirmed email return `UsernameExistsException`, and does `ResendConfirmationCode` work for it?
6. Does `ConfirmSignUp` on an already-confirmed account fail with an error the action can tell apart from "wrong code" (O-9 flow)?

Any answer that contradicts this design comes back to the owner before the build continues.

## 14. Documentation this change touches

- **ADR-0003 "Customer authentication via Amazon Cognito"** (new).
- **ADR-0002:** a note under Context: "login already depends on AWS (ADR-0003)". It stays Proposed.
- **`08-security-testing.md` §Authentication:** the customer row now points to Cognito and ADR-0003. Staff are unchanged until plan 002.
- **`05-database.md`:** `customer`, `customer_session` and `auth_rate_limit`.
- **`14-integrations.md`:** a Cognito section with the setup checklist from §4.
- **`04-tech-stack-and-structure.md`:** the `adapters/cognito/` and `infra/cognito/` folders, and the dependencies.
- **`11-decisions.md`:** D-rows for O-1 to O-10 and the calls marked "my call". The O-10 row notes that plan 013's public product pages (D-142) now require sign-in.
- **`07-frontend-components.md`:** the sign-in redirect on product pages.
- **`12-glossary.md`:** customer session, Cognito user pool, account linking, refresh token.
- **`13-open-questions.md`:**
  - Google sign-in is the owner's request; the client source doesn't mention it.
  - A new UNRESOLVED question: who owns and pays for the AWS account at go-live, the client or us. It affects the handover, not this build. Until it is answered, the dev pool runs in the project owner's account.
- **`16-local-setup.md`:** the Cognito section.
- **Plan 014.**
