# 017 — News image upload to Amazon S3 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

- **Status:** Approved by the project owner on 2026-11-18 with no changes to *My calls*; in progress.
- **Stage:** none of the UAT checks in `docs/15-acceptance-criteria.md` names images; it extends plan 016's editor (stage 1 checks 1.10 to 1.12). Whether a stage 1 check is added for images is the owner's call.
- **Requirements:** REQ-047 extended (staff add images to their news, D-237's "image upload is added as soon as file storage exists").
- **Depends on plans:** 012 (news tables, the body sanitiser, the article page), 016 (the back office, `requirePermission`, `news.manage`, the editor).
- **Blocked by:** nothing (approved 2026-11-18). Not blocked by Q-063: its storage part is answered (D-274). Q-071 (backing up the images) blocks nothing here, because this plan deletes nothing (D-279).
- **Owner decisions:** of 2026-11-18, recorded as D-274 to D-276 (below).
- **Branch:** `feat/win/news-image-upload`, cut from `feat/win/staff-back-office` (plan 016).

**Goal:** Staff with `news.manage` upload a picture into an article's body (with required alt text) and set, replace or remove an article's cover image; the files are stored in Amazon S3 in `ap-southeast-7` and readers load them from a plain public URL.

**Architecture:**
- **One storage port, one adapter (D-050).** `MediaStorage` (types only) in `src/server/services/media/media-storage.ts`; `createS3MediaStorage` in `src/server/adapters/s3/media-storage.ts` is the only file that imports `@aws-sdk/client-s3`. The composition root wires it. Unit tests use a fake.
- **Keys are stored, URLs are built (D-277).** A body image is stored as `<img data-media-key="news/…" alt="…">` with no `src`; a cover is `news_article.featured_image_key`. The URL is `MEDIA_PUBLIC_BASE_URL` + `/` + key, built on the server when a page is drawn, so moving to CloudFront later is a configuration change and no stored article changes.
- **Upload through a Server Action (D-278).** The browser sends the file to `uploadNewsImageAction`; the server checks permission, rate, size and content, then writes to S3. The browser never talks to S3 except to show an image, so the bucket needs no CORS rule.
- **Nothing is deleted (D-279).** Removing an image from an article, replacing a cover, or trashing an article leaves the object in the bucket.

**Tech stack:** as plan 016, plus `@aws-sdk/client-s3` (Task 2, D-280). No image library: no resizing and no re-encoding in this plan.

## Owner decisions (2026-11-18)

1. **File storage is Amazon S3 in `ap-southeast-7`** (Asia Pacific (Thailand)), regional endpoint `https://s3.ap-southeast-7.amazonaws.com` (D-274). This answers the storage part of Q-063; what runs the application, the database, the jobs and the backups is still open.
2. **One bucket per environment (D-275).** DEV has its own bucket, reached from a developer's machine with the IAM user `tinzshop-dev`, whose access key the owner keeps in `.env` and never in the repository, with an inline least-privilege policy on that bucket only. PROD gets its own bucket and, once hosting is chosen, an IAM role instead of a key (the intended direction; hosting itself is still Q-063). Set-up steps: `docs/10-deployment.md#file-storage`.
3. **Images are public through a bucket policy on the `news/` prefix only (D-276).** Public read of `news/*`; everything else in the bucket is private; "Block public access" is relaxed only as far as that bucket policy needs (the two ACL settings stay on); no object ACLs. An image's URL is plain and permanent: `https://{bucket}.s3.ap-southeast-7.amazonaws.com/news/…`. CloudFront may be put in front later; D-277 is how that stays possible without changing stored articles.

## My calls (Proposed; the owner confirms or changes them at review)

These are the planner's defaults, recorded as decisions D-277 to D-280. **The owner approved them unchanged on 2026-11-18**, and Task 1 turned them Accepted.

1. **Scope.** (a) An image button in the editor's toolbar that uploads a picture into the body, with alt text required; (b) the cover image in the Publishing panel: upload, replace, remove. Product images are out: Shopee is their master (D-094). Copying the imported articles' old-site images into S3 (D-127) is out: it is its own plan, now possible because storage exists.
2. **Types and size (D-278).** JPEG, PNG, WebP and GIF, recognised by their first bytes (magic numbers), never by the file name or the browser's declared type; GIF is in because game news uses short animated clips. SVG is refused (it can carry script), and so are HEIC, AVIF and everything else. At most **5 MB** per file. The stored `Content-Type` is the detected type.
3. **Server Action, not a presigned PUT (D-278).** Reasons. *Security:* the server sees every byte before anything is stored, so the type and size checks are real; with a presigned PUT the object would land in the public `news/` prefix before any check, or would need a private landing prefix, a second "confirm" call that reads it back, and a copy. *Simplicity:* one call, no bucket CORS rule, no second code path. *Cost:* negligible at this volume (a few staff, a few images an article); the file passes through the server once. The price: `serverActions.bodySizeLimit` goes from `4mb` to **`6mb`** (5 MB file plus form overhead), and that limit is global, so every Server Action, the public sign-in ones included, accepts a body 2 MB larger than today. **Risk tied to Q-063:** if the compute Q-063 picks caps request bodies below about 6 MB (some serverless set-ups do), the upload moves to a presigned PUT into a private prefix with a server-side check and copy; that is a follow-up, not built here.
4. **Location data (D-278).** A phone's JPEG can carry the place it was taken in its Exif block. The server removes the Exif and XMP blocks (APP1 segments) from a JPEG before storing it and writes back a minimal Exif block holding only the orientation tag, if the photo had one, so the photo is not shown sideways. Other segments (the colour profile included) are kept. PNG, WebP and GIF are stored byte for byte (their metadata chunks are a follow-up). No re-encoding.
5. **Object keys (D-278).** `news/{yyyy}/{mm}/{uuid}.{ext}`: year and month of the upload in UTC, a random v4 uuid, and `jpg`, `png`, `webp` or `gif` from the detected type. Written with `Content-Type` and `Cache-Control: public, max-age=31536000, immutable` (a key is never reused, so a cached copy is never stale).
6. **Stored keys, built URLs (D-277).** Body: `<img data-media-key="{key}" alt="{alt}">`, no `src`. Cover: the new column `news_article.featured_image_key`; setting it clears `featured_image_url`, and a CHECK keeps at most one of the two set. Read services build the URL from `MEDIA_PUBLIC_BASE_URL`; when that is unset, a keyed image is left out of the page rather than drawn broken. Rejected alternative: storing absolute URLs, which ties every article to one host and needs a data migration (a text replace over every body) to move to CloudFront.
7. **The cover of an imported article (D-278).** Staff may replace or remove it too. This changes `05-database.md`'s rule that a staff save never writes an imported article's featured image; `source_id` and `source_url` are still never written. Safe because the import skips a staff-edited article (D-236).
8. **Alt text.** Required for an uploaded body image, up to 300 characters, written in Thai like the rest of the article (D-260). The save refuses a body whose keyed image has an empty alt (`admin.news.error.imageAlt`). An imported `<img>` without alt is left as it is. The cover has no alt field: it is drawn beside the title (`alt=""`), as today.
9. **Sanitiser.** `img` keeps `alt`, and either a valid `data-media-key` (exactly the key pattern of call 5; any `src` on the same element is then dropped) or, as today, an absolute `http`/`https` `src` (imported posts, D-135). Nothing else. The brief's "allow `src` only from the configured media base URL" is not taken: today's sanitiser keeps any absolute `http`/`https` image (imported posts point at the old site and other hosts), and uploaded images carry no `src` at all, so there is nothing to restrict. Tightening external `src` hosts is a follow-up.
10. **Deleting (D-279).** Never, in this plan. An object can be referenced from several places at once (a trashed article that may be restored, an undo in an open editor, an unsaved draft, a live preview, a body copied into another article), and S3 cannot tell which; a wrong delete breaks a published page with no way back. Uploads that are never saved also stay. Orphan clean-up is a follow-up (a job that lists `news/` and removes keys no article references, older than a margin).
11. **Permission, limits, logs.** Only `news.manage` can upload (`requirePermission`, as every back-office action). At most **60 uploads per account per hour**, counted with the existing `hitRateLimit` under the key `media_upload:account:{accountId}` (`admin.news.error.imageRateLimited`). Logs carry the account id, the key, the byte size, the detected type and an outcome code; never the file name, the bytes, the alt text or a credential.
12. **Paste and drop of image files stay off** (as D-237): a pasted file would skip the alt dialog. A follow-up.
13. **Credentials.** The SDK's default chain: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` on a developer's machine (the `tinzshop-dev` user), an IAM role on AWS later. The config module never reads them. App settings: `MEDIA_S3_BUCKET`, `MEDIA_S3_REGION`, `MEDIA_PUBLIC_BASE_URL` (glossary, *Media storage*). **The owner's `.env` must use exactly these five names.**

## Global Constraints

- Every rule in `CLAUDE.md` applies; above all: never read `.env`; no secret, real bucket name, account id, access key or ARN in any file or commit (documentation uses `<dev-media-bucket>`); check `docs/12-glossary.md` before naming; every decision gets a row plus its reasoning; documentation in the same change.
- Decision numbers: D-274 to D-280 are this plan's (D-202 to D-209 stay reserved by open PR #39). New questions start at **Q-072**.
- `src/server/adapters/s3/` is the only importer of `@aws-sdk/client-s3`; no service, controller or page names S3 (D-050).
- Every write of `news_article_translation.body_html` still passes through `sanitizeArticleHtml`; every write of `featured_image_key` matches the key pattern (service check and database CHECK).
- No stored article holds a URL to the bucket: an uploaded image is a key, in the body and in the cover column.
- The upload validates by content on the server even though the browser checks size and type first (the browser check is for a friendly message only).
- Back office Thai only (D-259): message keys under `admin.news.*` in both message files, Thai first.

## Review Focus

1. **A file that is not what it says** — an SVG, an HTML page or a script renamed `.jpg`, a file whose first bytes are a PNG signature followed by HTML, a 0-byte file, a 5 MB + 1 byte file: refused, nothing written, and the stored `Content-Type` is never the browser's. Test: Task 3, Task 4.
2. **A crafted body** — `<img data-media-key="../secret.txt">`, `data-media-key="news/x" onerror=…`, a key outside `news/`, a key with a query string, `src="javascript:…"` beside a valid key: the sanitiser keeps only a valid key and `alt`, and the render step only ever sees keys that passed. Test: Task 6.
3. **An upload without the permission** — signed out, a Customer, a blocked account, a role without `news.manage`: refused before the file is read; the rate limit counts only permitted calls. Test: Task 4.
4. **The base URL** — `MEDIA_PUBLIC_BASE_URL` with a quote, a query, a fragment, `http://` or a trailing slash: refused or normalised at start-up, so the URL written into a page can never break out of the attribute. Test: Task 2.
5. **Location data** — a JPEG with GPS in its Exif: the stored bytes have no GPS and no XMP, and keep the orientation. Test: Task 3; manual check with a real phone photo.
6. **The editor round trip** — a body with uploaded images loads unlocked and saves byte for byte; saving never writes a `src` for a keyed image. Test: Task 7.

---

### Task 1: Docs, decisions and names (on approval)

**Files:**
- Modify: `docs/11-decisions.md`, `docs/05-database.md`, `docs/06-api.md`, `docs/07-frontend-components.md`, `docs/08-security-testing.md`, `docs/12-glossary.md`, `CLAUDE.md`

- [x] **Step 1: Decisions.** D-277 to D-279 from Proposed to Accepted with the owner's changes, if any, and the date of approval; D-280 stays open for Task 2's version. D-237's status gains "image upload delivered by plan 017 (D-278)".
- [x] **Step 2: Owning documents.** `05-database.md` *News*: `featured_image_key`, the CHECK, the rule change of call 7, and `data-media-key` in the body invariant. `06-api.md` *Back-office Server Actions*: `uploadNewsImageAction` and the save's `featuredImage` field with their error keys. `07-frontend-components.md`: the image dialog and the cover panel. `08-security-testing.md` *File uploads*: the news image rules (calls 2 to 4, 10, 11).
- [x] **Step 3: Glossary and CLAUDE.md.** The *Media storage* rows lose "(plan 017, planned)" once their names are built; `CLAUDE.md` adds plan 017 to the code list and the "unblocked" sentence, on the owner's approval.
- [x] **Step 4: Commit** `docs: accept plan 017's decisions and record the news image names`

### Task 2: Media config and the S3 adapter

**Files:**
- Modify: `package.json`, `package-lock.json`, `src/server/config.ts` (+ its test), `src/server/composition-root.ts`, `docs/04-tech-stack-and-structure.md`, `docs/11-decisions.md` (D-280)
- Create: `src/server/services/media/media-storage.ts` (types only), `src/server/adapters/s3/media-storage.ts` (+ `.test.ts`)

**Interfaces:**
- Produces: `MediaConfig = { bucket: string; region: string; publicBaseUrl: string }` from `parseMediaConfig(env)` / `getMediaConfig()` (lazy and cached, like `getAuthConfig`): `MEDIA_S3_BUCKET` (S3 bucket-name rules: 3 to 63 characters, lower case, digits, `.` and `-`), `MEDIA_S3_REGION` (a region code such as `ap-southeast-7`), `MEDIA_PUBLIC_BASE_URL` (`https` only; no query, fragment, user or password; one trailing `/` removed). `getMediaPublicBaseUrl(): string | null` reads only the last one, for pages, and returns null when it is unset.
- Produces: `MediaStorage = { putObject(input: { key: string; body: Uint8Array; contentType: string; cacheControl: string }): Promise<void> }` and `MediaStorageError` (code `media.storage_failed`, no SDK message, no key material).
- Produces: `createS3MediaStorage({ bucket, region }): MediaStorage`, an `S3Client` with the region only (credentials from the SDK's default chain), sending `PutObjectCommand` with `Bucket`, `Key`, `Body`, `ContentType`, `CacheControl`; no `ACL` (the bucket has ACLs disabled, D-276).

- [x] **Step 1: Install** `@aws-sdk/client-s3` as an exact version at least 14 days old on the day of install (`npm view @aws-sdk/client-s3 time`). On 2026-11-18 that is 3.1161.0 (published 2026-10-30). From 2026-11-23 on, 3.1165.0 (2026-11-09) qualifies and is preferred, because it is the version of `@aws-sdk/client-cognito-identity-provider` already installed, so the two share their core packages. Record the version in D-280 and in `04-tech-stack-and-structure.md`, as D-172 did.
- [x] **Step 2: Write the failing tests.** Config: each variable missing, a bad bucket name, `http://`, a quote, a query and a fragment refused (the error names the variable, never the value); a trailing slash removed. Adapter (with the SDK client's `send` replaced): the command carries exactly the five fields and no `ACL`; an SDK failure becomes `MediaStorageError` whose message holds neither the bucket nor the SDK's text.
- [x] **Step 3: Run** `npm test` on those files — expect FAIL. **Step 4: Implement.** **Step 5: Run** — PASS; `npm run typecheck`.
- [x] **Step 6: Commit** `feat: add the media config and the S3 storage adapter`

### Task 3: Checking an image and making its key

**Files:**
- Create: `src/server/services/media/news-image-service.ts` (+ `.test.ts`), `src/server/services/media/jpeg-metadata.ts` (+ `.test.ts`), test fixtures in `src/server/services/media/__fixtures__/` (small generated images; no real photo with a real location), as the adapters keep theirs
- Modify: `src/server/adapters/wordpress/sanitize.ts` (the key pattern, so the sanitiser and the editor share it; browser-safe like `PRODUCT_ID_PATTERN`)

**Interfaces:**
- Produces (`sanitize.ts`): `NEWS_MEDIA_KEY_PATTERN` (`news/` + four digits + `/` + month `01` to `12` + `/` + a lower-case v4 uuid + `.jpg|.png|.webp|.gif`, anchored) and `isNewsMediaKey(value: string): boolean`.
- Produces (`news-image-service.ts`): `NEWS_IMAGE_MAX_BYTES = 5 * 1024 * 1024`; `detectImageType(bytes: Uint8Array): 'jpeg' | 'png' | 'webp' | 'gif' | null` (JPEG `FF D8 FF`; PNG's 8-byte signature; `GIF87a` / `GIF89a`; `RIFF` + 4 bytes + `WEBP`); `newsImageKey(type, now: Date, uuid: string): string`; `prepareNewsImage(bytes, now, uuid) → Result<{ key; body; contentType; cacheControl }>` with the errors `media.empty`, `media.too_large`, `media.unsupported_type`, `media.invalid_image`.
- Produces (`jpeg-metadata.ts`): `stripJpegMetadata(bytes: Uint8Array): Uint8Array | null` — walks the segments from SOI up to SOS, drops every APP1 segment (Exif and XMP), and, when the dropped Exif held an orientation tag (0x0112) with a value from 1 to 8, inserts a minimal Exif APP1 in the same byte order holding that one tag; returns null for a malformed JPEG (a segment running past the end, no SOS).

- [x] **Step 1: Write the failing tests:** each type detected from its bytes and the file name never consulted; an SVG, HTML, a PDF, a text file and a PNG signature cut short refused; 0 bytes `media.empty`; `NEWS_IMAGE_MAX_BYTES + 1` `media.too_large`; key shape for each type and month 01 and 12 (UTC at a Bangkok month boundary); `isNewsMediaKey` accepts what `newsImageKey` makes and refuses `../`, upper-case, a query, another prefix, another extension and a v1 uuid; JPEG: GPS and XMP gone, orientation 6 kept, ICC (APP2) kept byte for byte, a JPEG with no APP1 returned unchanged, a malformed one `media.invalid_image`; PNG, WebP and GIF bodies returned unchanged; `contentType` from the detected type and `cacheControl` exactly `public, max-age=31536000, immutable`.
- [x] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** — PASS. **Commit** `feat: check news images by content and strip a JPEG's location data`

### Task 4: The upload action

**Files:**
- Create: `src/server/controllers/news/news-image-controller.ts` (+ `.test.ts`)
- Modify: `src/app/[locale]/(admin)/admin/news/actions.ts` (+ `news-actions.test.ts`), `src/server/composition-root.ts`, `next.config.ts`, `messages/th.json`, `messages/en.json` (`admin-guard.test.ts` already covers every `actions.ts`)

**Interfaces:**
- Consumes: Task 2's storage and config, Task 3's `prepareNewsImage`, plan 014's `hitRateLimit`, plan 016's `requirePermission`.
- Produces: `uploadNewsImageAction(formData)` with the field `file` (a `File`), returning `{ status: 'uploaded'; key: string; url: string } | { status: 'error'; errorKey: string }`. Order: permission (`news.manage`) → media configured (else `admin.news.error.imageUnavailable`) → rate limit (60 an hour, `admin.news.error.imageRateLimited`) → `file.size` checked before reading the bytes → `prepareNewsImage` → `putObject` → log. Error keys: `imageTooLarge`, `imageType`, `imageInvalid`, `imageUploadFailed`, `imageUnavailable`, `imageRateLimited`, `forbidden`, all under `admin.news.error.*`.
- `next.config.ts`: `serverActions.bodySizeLimit` `'4mb'` → `'6mb'`, with a comment naming D-278.

- [x] **Step 1: Write the failing tests:** refused without `news.manage` and for a signed-out visitor, with the storage never called; the 61st upload in an hour refused; a too-large `File` refused without its bytes read; each content error mapped to its key; a storage failure mapped to `imageUploadFailed`; success returns the key and the URL built from the base URL; the log line holds the account id, key, size, type and outcome and not the file name (the test uses a file name with an email address in it) nor the bytes.
- [x] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, typecheck — PASS. **Commit** `feat: upload news images to file storage from the back office`

### Task 5: The cover image column

**Files:**
- Modify: `prisma/schema.prisma`, `src/server/services/news/news-admin-service.ts` (+ test), `src/server/controllers/news/news-admin-controller.ts` (+ test), `src/server/repositories/news/news-admin-repository.ts`, `src/server/services/news/news-read-service.ts` (+ test), `src/server/repositories/news/news-repository.ts`
- Create: `prisma/migrations/<timestamp>_news_featured_image_key/migration.sql`
- Test: `tests/integration/news/news-admin-repository.test.ts`, `tests/integration/news/news-read.test.ts`

**Interfaces:**
- Produces: `news_article.featured_image_key text NULL`, `CHECK (featured_image_key ~ '<the key pattern>')` and `CHECK (featured_image_key IS NULL OR featured_image_url IS NULL)`; Prisma `featuredImageKey`.
- Produces: `ArticleInput.featuredImage: { kind: 'unchanged' } | { kind: 'none' } | { kind: 'media'; key: string }`, posted as the form field `featuredImage` = `unchanged`, `none` or `media:{key}` (anything else `news.invalid`, field `featuredImage`). `media` sets the key and clears the URL; `none` clears both; `unchanged` writes neither. Allowed on imported articles too (call 7).
- Produces: every read that returns `featuredImageUrl` (cards, detail, the admin article) returns the built URL when a key is set, else the stored URL; the admin article also returns `featuredImageKey`. The read service takes the base URL as a dependency (framework-free, D-002).

- [x] **Step 1: Write the failing tests:** unit — the three `featuredImage` kinds; a bad key refused; an imported article's cover replaced and removed; the read prefers the key and leaves a keyed cover out when the base URL is null. Integration — the CHECKs refuse a bad key and both columns set; a save of each kind; the news list and article reads build the URL.
- [x] **Step 2: Run** — FAIL. **Step 3: Write the migration** (adds the column and the two CHECKs; no backfill) and mirror it in the schema; `npm run db:generate`. **Step 4: Implement.** **Step 5: Run** unit, integration, typecheck — PASS. **Commit** `feat: store an uploaded cover image as a key`

### Task 6: Keyed images in the body, from save to page

**Files:**
- Modify: `src/server/adapters/wordpress/sanitize.ts` (+ test), `src/server/services/news/news-admin-service.ts` (+ test), `src/server/services/news/news-read-service.ts` (+ test), the live preview's builder (`buildArticlePreview`)
- Create: `src/server/services/media/media-url.ts` (+ `.test.ts`)

**Interfaces:**
- Produces (sanitiser): `img` keeps `alt` and either a `data-media-key` that passes `isNewsMediaKey` (the `src` on that element is then dropped) or an absolute `http`/`https` `src` as today; an `img` with neither is dropped as today. The import's output is unchanged (no imported body has `data-media-key`).
- Produces (`media-url.ts`): `mediaPublicUrl(baseUrl: string, key: string): string`; `resolveMediaKeys(html: string, baseUrl: string | null): string` — on already-sanitised HTML, each `<img … data-media-key="K" …>` gets `src="{base}/{K}"` and loses `data-media-key`; with a null base, such an `img` is removed.
- Produces (save rule): an `img` with `data-media-key` and an empty or missing `alt` refuses the save (`news.invalid`, field `body`, `admin.news.error.imageAlt`); alt over 300 characters likewise.
- The article page, the news cards and the live preview get bodies already resolved from their services; `ArticleBody` itself does not change. The editor gets the stored body, unresolved.

- [ ] **Step 1: Write the failing tests:** sanitiser — a valid key kept with `alt`; `../`, a query, another prefix, an upper-case uuid dropped (and the image with it when it has no valid `src`); `src` dropped beside a valid key; `onerror` and every other attribute stripped; the two real fixture posts unchanged. `resolveMediaKeys` — one and several images, an image inside a figure and a link, a null base. Save — a keyed image without alt refused; an imported image without alt accepted. Read — the article page's body has the built `src` and no `data-media-key`.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** unit, integration, typecheck — PASS. **Commit** `feat: keep uploaded images as keys in article bodies and build their URLs on read`

### Task 7: The editor's image button and the cover panel

**Files:**
- Modify: `src/app/[locale]/(admin)/admin/news/_components/editor-extensions.ts`, `RichTextEditor.tsx` (+ `.dom.test.tsx`, `.roundtrip.dom.test.tsx`), `body-roundtrip.ts`, `ArticleEditor.tsx` (+ `.dom.test.tsx`), `news/new/page.tsx`, `news/[id]/page.tsx`, `src/components/ui/Icon.tsx` (an `image` icon if missing), `messages/th.json`, `messages/en.json`
- Create: `src/app/[locale]/(admin)/admin/news/_components/ImageDialog.tsx`, `CoverImagePanel.tsx`

**Interfaces:**
- Consumes: `uploadNewsImageAction` (Task 4); the pages pass `mediaPublicBaseUrl` (from `getMediaPublicBaseUrl()`) to the editor.
- Image nodes: the inline `Image` and `FigureImage` gain `mediaKey` (parsed from `data-media-key`; rendered as `data-media-key` plus a display `src` built from the base URL, which the save's sanitiser then drops, call 9); a parse rule for `img[data-media-key]`, which has no `src`. `normaliseBody` and the lock guard count `data-media-key`, so a stored body with uploaded images is not locked.
- Toolbar: a 38px icon button "รูปภาพ" after the YouTube button (D-257 sizes). It opens `ImageDialog` (the shared modal behaviour): a file chooser (`accept="image/jpeg,image/png,image/webp,image/gif"`), a local preview, the alt field "คำอธิบายรูป" (required, 300 characters, with the hint that it is read aloud to people who cannot see the picture), and แทรกรูป / ยกเลิก. The browser checks size and type first for a quick message; แทรกรูป uploads, shows "กำลังอัปโหลด…", and on success inserts the picture as its own paragraph after the current top-level block (as a card is, R16). With a picture selected, the button opens the dialog to edit its alt only. Paste and drop of files stay off (call 12).
- `CoverImagePanel` in the Publishing panel, replacing the read-only featured image: "รูปหน้าปก" with the image, or an empty box; "อัปโหลดรูปหน้าปก" (uploads at once and shows it), "เปลี่ยนรูป", "ลบรูป"; the hidden field `featuredImage` (`unchanged` until staff act). The change is saved with the article; the panel says so ("บันทึกพร้อมบทความ").
- When media is not configured (no base URL), the button and the panel's upload are disabled with "ยังไม่ได้ตั้งค่าที่เก็บรูป".

- [ ] **Step 1: Write the failing jsdom tests:** the button opens the dialog; แทรกรูป disabled without a file or alt; a too-large or wrong-type file shows its message without calling the action; a successful upload inserts `<img data-media-key alt>` after the current block and the form posts it with no `src`; an action error shows its message and inserts nothing; alt editing of a selected picture; a stored body with a keyed image round-trips unlocked and byte for byte; an imported `<img src>` still round-trips; the cover panel's three actions set `featuredImage` to `media:{key}`, `none`, and back; an imported article's cover can be removed; both controls disabled without a base URL; a press on the image button never submits the article form.
- [ ] **Step 2: Run** — FAIL. **Step 3: Implement.** **Step 4: Run** `npm test`, typecheck — PASS. **Commit** `feat: add the image button and the cover image panel to the news editor`

### Task 8: Whole-branch check and the manual checklist

- [ ] **Step 1:** `npm run typecheck`, `npm test`, `npm run test:integration`; `npm run build` only when no dev server is running (it caused a reload loop beside one); record the counts in *Outcome*. `npm audit --omit=dev`.
- [ ] **Step 2:** Walk the pre-merge checklist in `docs/08-security-testing.md` for the new action, the sanitiser change and the adapter.
- [ ] **Step 3:** Confirm `docs/05`, `06`, `07`, `08`, `10`, `12` and `.env.example` match what was built; update this plan's *Status* and *Outcome*.
- [ ] **Step 4: Commit** `docs: record plan 017's outcome`

## Manual test checklist

Run by a person against the DEV bucket, after the set-up in `docs/10-deployment.md#file-storage`. Never tick a box for a check nobody performed.

- [ ] The DEV bucket is set up as in `10-deployment.md`: ACLs disabled, the two ACL "Block public access" settings on and the two policy ones off, the `news/*` bucket policy, the `tinzshop-dev` inline policy, the five variables in `.env`.
- [ ] Public and private: an uploaded image's URL opens in a private browser window; an object uploaded by hand through the console at the bucket's top level (not under `news/`) answers Access Denied at its URL; the bucket's own URL does not list its contents.
- [ ] Body image: upload a JPEG into an article with Thai alt text, save, publish: the article page shows it; the page source has a `src` on the bucket's address and no `data-media-key`; a screen reader reads the alt.
- [ ] The image's response headers: `Content-Type` matches the file's real type and `Cache-Control` is `public, max-age=31536000, immutable`.
- [ ] Refusals: a file over 5 MB, an SVG, a PDF renamed `.jpg`, and an empty alt each show their message and insert nothing; a PNG renamed `.jpg` is stored as a PNG.
- [ ] Location data: a photo taken on a phone with location on, uploaded, then downloaded from its URL and checked with an Exif reader (for example `exiftool`): no GPS fields, and the photo is upright on the page.
- [ ] A GIF and a WebP upload and show; an animated GIF still moves.
- [ ] Alt editing: select an uploaded picture, press the image button, change its alt, save: the page has the new alt.
- [ ] Cover image: upload a cover on a new article, save: the news list card and the article page show it; replace it; remove it (the card falls back to the design's gradient). Replace and remove the cover of an imported article too.
- [ ] Live preview shows an uploaded body image and cover before the article is saved.
- [ ] Trash an article with an uploaded image, then open the image's URL: it still loads; restore the article: the image is still on it.
- [ ] Without `news.manage` (untick it for Blogger in the grid): the editor is not reachable and a replayed upload request is refused.
- [ ] Change of address: set `MEDIA_PUBLIC_BASE_URL` to the bucket's path-style address (`https://s3.ap-southeast-7.amazonaws.com/<dev-media-bucket>`), restart: every uploaded image and cover still shows, now from that address, with no article saved again.
- [ ] Logs of the uploads above hold no file name, no image bytes and no access key.
- [ ] The image dialog and the cover panel at 360px and at 1024px: usable, nothing overflows.

## Outcome

Not started.

## Follow-ups (not in this plan)

- Copy the imported articles' old-site images into the bucket before the old site shuts down (D-127, ADR-0004): its own plan.
- Orphan clean-up of objects no article references (D-279).
- Backing up the PROD images (Q-071).
- Resizing and re-encoding (smaller pages, width and height for layout, metadata of PNG and WebP): `sharp` is already in the dependency tree as Next's optional package, but it is a native binary whose fit with the hosting Q-063 picks is unknown.
- Paste and drop of image files into the editor, with the alt dialog.
- Restricting external `<img src>` hosts in bodies (call 9).
- A Content-Security-Policy `img-src` must name the media base URL when phase 8 adds a CSP (`08-security-testing.md`).
- A presigned upload, if Q-063's compute cannot take a 6 MB request (call 3).
- The PROD bucket and its IAM role, once Q-063 picks the compute (D-275).

## Not in this plan

Product images (Shopee is master, D-094); payment slips (none, D-072); invoice PDFs; any other AWS service (Q-063); CloudFront; image resizing; deleting objects. The PROD maintenance mode, pencilled as "plan 017" in plan 016 and its spec, takes the next free number when it is planned.
