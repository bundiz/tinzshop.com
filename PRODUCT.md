# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Shoppers in Thailand** (Thai first, English second) who already know Tinzshop, often from its marketplace shop. They come to see the products and read the game news. A signed-out visitor sees the front page only; buying needs an account (D-061).
- **Shop staff:** the owner plus a small team. A Blogger writes news, a Sale-manager handles products, stock, orders and money, an Admin oversees everything, and a Top-level Admin sets roles and blocks accounts. They work in the back office **mostly on a laptop or desktop**, and only now and then on a phone (owner, 2026-11-17).

## Product Purpose

tinzshop.com makes Tinzshop look like an established, professional shop. It does not have to pull buyers away from the big marketplaces. Its core job is to let people see the products and read the news in one trustworthy place (owner, 2026-11-17). It sells games, consoles and IT equipment, priced in Thai baht, delivered within Thailand only.

Success: a visitor who finds Tinzshop elsewhere lands here and comes away sure that it is a real, well-run shop.

## Positioning

- **A trusted local shop:** a known team that people can contact for help, warranty and claims, not an anonymous seller.
- **Game news and the shop together:** news articles can carry live product cards and link to related products, and product pages show related news.

## Operating Context

- **Catalogue source:** Shopee is the master for the catalogue (D-094). The site mirrors it, and options and SKUs are kept as Shopee holds them.
- **Stock:** website orders never change stock. Staff adjust stock in BigSeller by hand from an admin list (D-096).
- **Payment:** K-Payment is the only payment method (bank transfer and standalone PromptPay are removed).
- **News:** articles were imported from the old WordPress site and are now written in the back office's editor. Staff edits win over the import (D-129, plan 016).
- **Accounts:** staff sign up like customers, and the Top-level Admin then sets their role (plan 016).

## Capabilities and Constraints

- One bilingual Thai/English Next.js site, with three parts: the storefront, the back office and the news. The full stack is in `docs/adr/ADR-0001-backend-approach.md` and `docs/04-tech-stack-and-structure.md`.
- **Requirements:** the one source is `docs/reference/client-summary-th.md`, with confirmed requirements in `docs/02-scope-and-phases.md`.
- **Names:** come from `docs/12-glossary.md`.
- **Out of scope:** in-store point of sale, international sales or other currencies, a marketplace for other sellers, a mobile app, wholesale pricing, and cash on delivery.
- **Images:** no image upload until file storage is chosen (Q-063).
- **Undecided:**
  - order statuses (Q-023);
  - which AWS services run the site (Q-063).

## Brand Commitments

- **Binding brand:** the owner's redesign in `tinzshop-redesign/`, including its blue and yellow palette, logo and page layouts, plus the back-office mockups in `tinzshop-redesign/admin/`. Refinements may change details such as control sizes and spacing, but not its colours, logo or layouts (owner, 2026-11-17).
- **Language:** Thai is the primary copy and English the second.
- **No component library:** the one exception is the date grid, built on react-day-picker (D-256).

## Evidence on Hand

- **Catalogue:** the real product catalogue, mirrored from Shopee.
- **News:** the real articles imported from the old WordPress site.
- **Brand:** the logo and the redesign mockups in `tinzshop-redesign/`.
- **Not on hand, so never invent them:** customer reviews and testimonials, sales figures, press coverage, and awards.

## Product Principles

1. **Look professional through restraint.** The site's job is credibility, so it should feel like a well-run shop: calm, precise and consistent. Loud, generic or template-like elements work against that.
2. **Products and news first.** Every page helps someone see a product or read the news, and the two link to each other.
3. **Thai first, and it must read naturally.** Thai text is longer and has no spaces between words, so layouts are designed for Thai, not adapted from English.
4. **The back office is a desktop work tool.** It should be compact and scannable for a small team at a desk, and still usable on a phone.
5. **Never invent facts.** No claims, numbers or features that the source documents do not state.

## Accessibility & Inclusion

- The project's accessibility rules are in `docs/07-frontend-components.md` (Accessibility) and `docs/08-security-testing.md`. They cover a visible focus ring, labelled controls, and screens that work at 360px wide in both languages.
- Below `sm` (phones), every link and control outside running text is at least 44px tall (D-221).
