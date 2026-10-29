# Local setup

How to install and run Tinzshop on your own machine: Docker PostgreSQL, `.env`, migrations, the dev server, and the scripts that load the data.

For what the project is and the rules for working on it, read [`CLAUDE.md`](../CLAUDE.md) and [`README.md`](README.md).

---

## 1. What you need

| Tool | Version | Check with |
| :--- | :--- | :--- |
| Node.js | 20.19+, 22.12+ or 24+ | `node -v` |
| npm | 10.8+ (comes with Node) | `npm -v` |
| Docker Desktop | any recent | `docker compose version` |
| Git | any | `git --version` |

- **Shopee:** to connect the Shopee sandbox shop you also need:
  - a Shopee Open Platform account with the **sandbox Test Partner** app (partner id and partner key)
  - a way to give your local server a public **HTTPS** address, for example `ngrok`
- **Optional:** a database viewer such as TablePlus or DBeaver.

## 2. Get the code and install

```bash
git clone https://github.com/bundiz/tinzshop.com.git
cd tinzshop.com
npm ci
```

`npm ci` installs the exact versions in `package-lock.json`. To **add or upgrade** a dependency, use `npx npm@11.21.0 install --save-exact <package>@<version>`, because npm 10.8 cannot resolve this tree for new installs. `npm ci` is fine on npm 10.8.

## 3. Create your `.env`

```bash
cp .env.example .env
```

Open `.env` and fill in these lines. Leave the other lines empty. **Never commit `.env`**; it is git-ignored.

| Variable | What to put |
| :--- | :--- |
| `APP_URL` | `http://localhost:3000`, or the port you run on (the job scripts call this address) |
| `DATABASE_URL` | keep the default `postgresql://postgres@127.0.0.1:5434/tinzshop` |
| `TEST_DATABASE_URL` | keep the default `postgresql://postgres@127.0.0.1:5434/tinzshop_test` |
| `JOB_SECRET` | output of `openssl rand -base64 32` |
| `CHANNEL_TOKEN_ENCRYPTION_KEY` | output of another `openssl rand -base64 32`. **Do not change it later**: stored Shopee tokens become unreadable, and you would have to authorize the shop again |
| `SHOPEE_PARTNER_ID` | the sandbox Test Partner id (Shopee console → your app). **No Shopee account?** See step 6 for placeholder values |
| `SHOPEE_PARTNER_KEY` | the sandbox Test Partner key. It is a secret; never paste it anywhere else |
| `SHOPEE_SHOP_ID` | the sandbox test shop's id (see step 6, path C2, if you don't know it yet) |
| `NEWS_IMPORT_SOURCE_URL` | `https://www.tinzshop.com`, the old site the news is imported from |

Leave `SHOPEE_API_BASE_URL` empty; it then uses the Shopee sandbox.

## 4. Start the database (Docker PostgreSQL)

```bash
npm run db:up        # PostgreSQL 17.11 on 127.0.0.1:5434, databases tinzshop + tinzshop_test
npm run db:deploy    # create all tables (applies every migration)
npm run db:generate  # generate the Prisma client into src/generated/ (git-ignored)
```

- The database listens on your own machine only (`127.0.0.1`), with no password.
- The data lives in the Docker volume `tinzshop-pgdata`.
- Stop it with `docker compose stop postgres`; your data is kept.

> **Start over with an empty database.** This permanently deletes all local data:
> ```bash
> docker compose down -v && npm run db:up && npm run db:deploy
> ```

## 5. Run the app

```bash
npm run dev                 # http://localhost:3000
npm run dev -- -p 3002      # if port 3000 is taken; then set APP_URL=http://localhost:3002
```

| Open | What it is |
| :--- | :--- |
| http://localhost:3000/th | home page (Thai); `/en` for English |
| http://localhost:3000/th/product | all products |
| http://localhost:3000/th/news | news |
| http://localhost:3000/api/docs | API docs (Swagger), development only |

The pages are empty until you feed data (step 6).

## 6. Feed the data

A fresh install has **empty tables**. The app never calls Shopee or the old site on its own; you pull data in with **job scripts**, each of which calls a job endpoint on your running dev server (step 5) with your `JOB_SECRET`.

**Which path you take depends on what you have:**

| You have… | Path | You get |
| :--- | :--- | :--- |
| only the code | **A** | all the news, but no products |
| a teammate who already has data | **B** (fastest) | everything they have: products, categories, news |
| your own Shopee Open Platform account | **C** | everything, synced live from your own sandbox shop |

### Without a Shopee account: placeholder values in `.env`

The app checks that the Shopee variables are filled in, even when you never call Shopee. If you have no Shopee account, put these **placeholders** in `.env`. Shopee features just won't work:

```
SHOPEE_PARTNER_ID=1
SHOPEE_PARTNER_KEY=not-used
SHOPEE_SHOP_ID=1
```

`JOB_SECRET`, `CHANNEL_TOKEN_ENCRYPTION_KEY` and `NEWS_IMPORT_SOURCE_URL` still need real values (step 3).

### Path A: only the code (news, no products)

The news comes from the old site's public website, so it needs no account at all.

```bash
npm run job:news-import      # about 20 minutes the first time
```

Then open http://localhost:3000/th/news. Products stay empty. For products, use path B or C.

### Path B: copy a teammate's database (no Shopee needed)

**The teammate** makes a copy of their local database. Use the database name from their `DATABASE_URL`; the default is `tinzshop`:

```bash
docker compose exec -T postgres pg_dump -U postgres -Fc tinzshop > tinzshop-dev.dump
```

**Send the file privately** (direct message or shared drive), **never through git**. It contains the old site's author names and encrypted Shopee tokens. `*.dump` files are git-ignored.

**You** load it into your own database:

> **Warning:** this replaces everything in your `tinzshop` database with the teammate's data.
> ```bash
> npm run db:up
> docker compose exec -T postgres pg_restore -U postgres --clean --if-exists --no-owner -d tinzshop < tinzshop-dev.dump
> npm run db:deploy && npm run db:generate   # in case your code has newer migrations
> ```

Restart `npm run dev`. Products, categories and news all appear.

- **Don't run `job:shopee-sync`.** The copied Shopee tokens are locked with the teammate's `CHANNEL_TOKEN_ENCRYPTION_KEY`, so the sync fails for you. That's expected.
- **For live Shopee data of your own**, do path C. Authorizing your own shop replaces the copied connection.

### Path C: your own Shopee sandbox (full sync)

**C1. Get Shopee credentials.**
1. Register at the Shopee Open Platform (open.shopee.com) and create an app.
2. Its console gives a **Test Partner id and key**, and a **sandbox test shop account** to log in with.
3. Put the id and key in `.env` (step 3).

**C2. Connect the sandbox shop to the app (once).** This stores encrypted Shopee tokens in the database, which the sync needs.
1. Give your server a public HTTPS address, for example `ngrok http 3000`. Note the domain it prints, such as `https://xxxx.ngrok-free.dev`.
2. In the Shopee console, open your Test Partner app and set the **Test Redirect URL Domain** to that domain. If they don't match, Shopee answers "redirect_uri domain not consistent".
3. Authorize with the redirect URL `https://<your-domain>/api/callbacks/shopee`, and log in with the **sandbox test shop account**. Your own Shopee account gets `error_perm`.
4. The browser shows `{"data":{"accountType":"shop","shopId":…,"connected":true}}`.

**Don't know the shop id yet?**
- After step 3, the browser's address bar contains `shop_id=…`. Put that number in `SHOPEE_SHOP_ID`, restart `npm run dev`, and authorize again; the code works only once.
- The callback refuses any other shop with a 403.

**C3. Put test products into your sandbox shop.** A new sandbox shop has **no products**. Either:
- **By hand:** in the Shopee console's **API Test Tool**, call `v2.product.add_item` (and `v2.product.init_tier_variation` for options).
- **With the helper** `scripts/shopee-sandbox/`, which needs its own token:
  1. Authorize once more, but with the redirect URL set to `https://<your-domain>/th` (any page that is not the callback).
  2. Copy `code` and `shop_id` from the address bar, and within 10 minutes run `npm run shopee:token -- <code> <shop_id>`.
  3. Run `npm run shopee:seed`. It creates a set of test items (games, a controller, an SSD with options), and it is safe to re-run. `npm run shopee:dump` shows what the shop holds.
  4. The helper's category id, carrier id and image id (constants at the top of `scripts/shopee-sandbox/seed.mjs`) were proven in the original sandbox on 2026-10-20. If `add_item` fails in yours, replace them with values from `v2.product.get_category`, `v2.logistics.get_channel_list` and `v2.media_space.upload_image` in the API Test Tool.

**C4. Pull everything into the app.**

```bash
npm run data:load
```

This runs, in order, and stops at the first failure:

| Script | Job | What it does |
| :--- | :--- | :--- |
| `npm run job:shopee-sync` | `POST /api/jobs/shopee-sync` | copies products, prices and stock from Shopee into the database |
| `npm run job:activate` | `POST /api/jobs/catalogue-activate` | **dev only:** turns on synced products, so they appear on the site |
| `npm run job:categorise` | `POST /api/jobs/catalogue-categorise` | **dev only:** sorts products into categories from their names |
| `npm run job:news-import` | `POST /api/jobs/news-import` | imports news and categories from the old site. The **first run takes about 20 minutes**; later runs skip unchanged posts |

Each script prints the job's JSON answer.

### Good to know (all paths)

- **Fresh prices and stock:** run `npm run job:shopee-sync` again whenever you want them. In production a scheduler will call it every 10 minutes; for now you run it by hand.
- **Full news re-import:** `npm run job:news-import:full` re-saves every post, for example after the HTML-cleaning rules change.
- **Overlapping runs:** a job that is already running answers `{"outcome":"skipped"}`. Wait for the first run to finish.
- **Repeat runs are safe:** every job can be run again.
  - Categorise only fills products that have no category yet, so a category someone set by hand is never overwritten.
  - Activate turns on **every** synced, listed product, including one someone switched off by hand. It is a development shortcut until the admin screens exist.

## 7. Tests and checks

```bash
npm run typecheck          # TypeScript
npm test                   # unit tests (no database)
npm run test:integration   # needs the database from step 4; uses tinzshop_test only
npm run build              # production build
```

The integration tests empty `tinzshop_test` between tests. They refuse to run against a database whose name does not end in `_test`.

## 8. When something goes wrong

| Problem | Fix |
| :--- | :--- |
| `port is already allocated` on `npm run db:up` | another container uses 5434. Stop it, or change the port in `compose.yaml` **and** both URLs in `.env` |
| `Another next dev server is already running` | one is already up; use it, or stop it (`kill <PID>` from the message) |
| Pages answer 500 with `Unknown field …` after you pull new code | the schema changed: run `npm run db:deploy && npm run db:generate`, then restart `npm run dev` |
| A job script says `Could not reach …` | the dev server isn't running, or `APP_URL` points at the wrong port |
| A job answers `401` | `JOB_SECRET` in `.env` differs from what the server loaded; restart `npm run dev` after editing `.env` |
| `news-import` answers `503 news_import.not_configured` | set `NEWS_IMPORT_SOURCE_URL` in `.env` and restart the server |
| `job:shopee-sync` answers `502 catalogue_sync.failed` | read the newest `sync_run` row's `error_code`; `channel_not_connected` means do step 6, path C2, first |
| Shopee callback: `redirect_uri domain not consistent` | the console's Test Redirect URL Domain must equal your tunnel's domain |

## 9. Where to read next

- [`09-coding-guidelines.md`](09-coding-guidelines.md): branches, pull requests, file ownership. Every change reaches `main` through a pull request.
- [`04-tech-stack-and-structure.md`](04-tech-stack-and-structure.md): where every file goes.
- [`06-api.md`](06-api.md) and [`openapi.yaml`](openapi.yaml): every endpoint, including the jobs above.
- [`14-integrations.md`](14-integrations.md): Shopee and the old WordPress site in detail.
