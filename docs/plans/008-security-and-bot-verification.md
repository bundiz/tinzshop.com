# 008 — Security and bot verification (Cloudflare Free)

- **Status:** Blocked — 2026-09-13
- **Phase:** 8
- **Dates (proposed):** 2027-02-24 → 2027-03-02, run alongside the tail of phase 7 — see `../02-scope-and-phases.md#schedule-and-budget`
- **Requirements delivered:** none. **No requirement exists for this phase** — scope comes from D-087 instead.
- **Blocked by:** actual DNS access to tinzshop.com (Q-053 residual)

## Goal

**Resolved (Q-054, D-087): Cloudflare Free**, scoped to security and bot
protection — WAF managed rules, bot fight mode, DNS proxying. No paid tier
without a future justified need.

`02-scope-and-phases.md` now recommends running this phase alongside the tail
of phase 7 rather than strictly after go-live as the source's original
ordering implied, so the shop does not launch without it — confirm this
scheduling recommendation with the client alongside the rest of the schedule.

## Unblock first

- [ ] DNS access to tinzshop.com arranged with the domain owner (Q-053 residual — ownership is known, access is not yet arranged)

## Build checklist

- [ ] Cloudflare Free account created, DNS proxied through it
- [ ] WAF managed rules enabled
- [ ] Bot fight mode enabled
- [ ] No paid Cloudflare feature enabled without a new decision recorded in `../11-decisions.md`

What is already true regardless, from `../08-security-testing.md`, and delivered
in earlier phases rather than here:

- [x] Security headers, CSP without `unsafe-inline`, HSTS *(plan 002)*
- [x] Rate limiting on sign-in and password reset, per account and per source *(plan 002)*
- [x] Webhook signature verification *(plan 004)*
- [x] Authorization checked in the domain layer *(plan 002)*

Whatever Cloudflare turns out to be for is **in addition to** these, never
instead of them. A perimeter service is not a substitute for the application
being correct.

## Manual test checklist

- [ ] The storefront and admin remain reachable and functional with Cloudflare proxying DNS.
- [ ] Bot fight mode does not block a legitimate customer checkout — run the phase 3 end-to-end journey through it.
- [ ] No paid Cloudflare feature is active.

## Outcome

*Not started.*
