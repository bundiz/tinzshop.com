# Tinzshop

Online shop for games, consoles and IT equipment: storefront, staff back office and game news, in Thai and English. This file is how to **run it on your own machine**.

For what the project is and the rules for working on it, read [`CLAUDE.md`](CLAUDE.md) and [`docs/README.md`](docs/README.md).

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
| `SHOPEE_PARTNER_ID` | the sandbox Test Partner id (Shopee console → your app) |
| `SHOPEE_PARTNER_KEY` | the sandbox Test Partner key. It is a secret; never paste it anywhere else |
| `SHOPEE_SHOP_ID` | the sandbox test shop's id (see step 6a if you don't know it yet) |
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

The pages are empty until you load data (step 6).

## 6. Load the data

The app never calls Shopee or the old site on its own. You pull the data in with **job scripts**. Each one calls a job endpoint on your running dev server (step 5 must be running), with your `JOB_SECRET`.

### 6a. Connect the Shopee sandbox shop (once)

This stores encrypted Shopee tokens in the database, which the sync needs.

1. Give your server a public HTTPS address, for example `ngrok http 3000`. Note the domain it prints, such as `https://xxxx.ngrok-free.dev`.
2. In the Shopee console, open your Test Partner app and set the **Test Redirect URL Domain** to that domain. If they don't match, Shopee answers "redirect_uri domain not consistent".
3. Authorize with the redirect URL `https://<your-domain>/api/callbacks/shopee`, and log in with the **sandbox test shop account**. Your own Shopee account gets `error_perm`.
4. The browser shows `{"data":{"accountType":"shop","shopId":…,"connected":true}}`.

**Don't know the shop id yet?**
- After step 3, the browser's address bar contains `shop_id=…`. Put that number in `SHOPEE_SHOP_ID` and authorize again; the code works only once.
- The callback refuses any other shop with a 403.

### 6b. Pull everything

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

- **Shopee sync:** run `npm run job:shopee-sync` again whenever you want fresh prices and stock. In production a scheduler will call it every 10 minutes; for now you run it by hand.
- **Full news re-import:** `npm run job:news-import:full` re-saves every post, for example after the HTML-cleaning rules change.
- **Overlapping runs:** a job that is already running answers `{"outcome":"skipped"}`. Wait for the first run to finish.

### 6c. Optional: put test products into the Shopee sandbox

`scripts/shopee-sandbox/` is a throwaway helper for the sandbox only. `npm run shopee:token -- <code> <shop_id>`, `npm run shopee:seed` and `npm run shopee:dump` create and read sandbox test items. It keeps its own tokens in `.shopee-sandbox/`, which is git-ignored.

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
| `job:shopee-sync` answers `502 catalogue_sync.failed` | read the newest `sync_run` row's `error_code`; `channel_not_connected` means do step 6a first |
| Shopee callback: `redirect_uri domain not consistent` | the console's Test Redirect URL Domain must equal your tunnel's domain |

## 9. Where to read next

- [`docs/09-coding-guidelines.md`](docs/09-coding-guidelines.md): branches, pull requests, file ownership. Every change reaches `main` through a pull request.
- [`docs/04-tech-stack-and-structure.md`](docs/04-tech-stack-and-structure.md): where every file goes.
- [`docs/06-api.md`](docs/06-api.md) and [`docs/openapi.yaml`](docs/openapi.yaml): every endpoint, including the jobs above.
- [`docs/14-integrations.md`](docs/14-integrations.md): Shopee and the old WordPress site in detail.
