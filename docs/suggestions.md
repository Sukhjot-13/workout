# Suggestions — Workout Tracker

## 🔴 Vulnerabilities

- (2026-09-28) **Manager-side, blocks browser analytics — reported, not fixable here.** The Manager deployment sends `Cross-Origin-Resource-Policy: same-origin` on **every** route, including the analytics tracker at `/t.js`. CORP `same-origin` is exactly what a browser uses to refuse a cross-origin `<script src>` load, so the injected tracker tag never executes from any app on a different origin: the tag is present in the DOM but `window.__mgrLoaded` stays `false` and no pageview is ever sent. Confirmed causally — two byte-identical copies of `t.js` served from two local ports, differing only in that header: the CORP copy raised `onerror`, the other loaded and booted (`__mgrLoaded=true`, POST accepted). A second, independent Manager behaviour compounds it: `isBot()` in `Manager/lib/visitor.ts` matches `/headless/i`, so headless-Chrome pageviews are accepted by the endpoint and then dropped as `{"accepted":0,"bots":1}`. With a normal Chrome UA and a CORP-free tracker, a real headless pageview **does** land (pageviews 1 → 2, `topPages` gains the page). Fix belongs in Manager: exempt `/t.js` from CORP (it already sends `Access-Control-Allow-Origin: *` and the tracker is public by design) and decide deliberately whether `headless` should stay in the bot pattern. Nothing in this repo can work around either; server-side log delivery is unaffected.

- (2026-09-28) **NoSQL operator injection on `/api/session` — FIXED.** `date` and `day`
  were taken straight from the query string and the JSON body and used as raw Mongo
  filters, so `{"date":{"$ne":null},"day":"day1","items":{}}` turned `deleteOne` into
  "delete an arbitrary day1 session", and a non-empty `items` turned the `upsert` into an
  overwrite of every matching document. Fixed by validating both the query params and the
  body with `isDateKey` / `isDayKey` before any DB call and building the filter only from
  the validated strings (`lib/validate.js`, `app/api/session/route.js`).
- (2026-09-28) **Unbounded, unvalidated persisted workout data — FIXED.** `items` was
  stored verbatim (any shape, any depth, any number of keys) with weight/reps as free text.
  `sanitizeItems` now whitelist-constructs the payload, bounds weight/reps/set count/set
  index/string length, rejects `NaN`/negative/absurd values, and the body is capped at
  256 KB with a `413`.
- (2026-09-28) **Error leakage / 500-instead-of-400 — FIXED.** A malformed body made
  `request.json()` throw a `SyntaxError` whose message reflected part of the request back to
  the caller as a 500, and every catch returned `err.message`, including the driver's
  `MongoServerSelectionError` (deployment topology). `readJsonBody` now returns
  `400 {code:"INVALID_JSON"}`; all API errors return a fixed `code`; `/api/status` is reduced
  to two booleans.
- (2026-09-28) **ACCEPTED RISK — the API is unauthenticated and must be gated before any
  public deploy.** The owner explicitly decided to skip auth for this app, so
  `/api/session`, `/api/history` and `/api/status` still have no login, session cookie or
  user model. Anyone who can reach the deployment can read, overwrite or delete any session
  by date. This is acceptable while the app runs on localhost or a private tunnel. It is
  **not** acceptable on a public hostname: put it behind an auth proxy (e.g. Cloudflare
  Access, Tailscale, or a reverse-proxy basic-auth) or add real auth before exposing it.
  Note also that validation prevents operator injection and malformed data, but it is not
  authorization — it does not stop a legitimate-shaped request for someone else's session.
- (2026-09-28) **`GET /api/history` returns every stored session to any caller.** Same
  accepted risk as above; there is no per-user scoping, so even after the validation fixes
  the endpoint is a full data dump for whoever can reach it.

## 🟢 Improvements

- (2026-09-28) Silent data loss on date/day switch — FIXED. The single shared 500 ms debounce
  ref was cleared by the next `saveSession` regardless of which session it owned, so editing
  session A and switching day inside 500 ms discarded A's POST; and on reload the server copy
  overwrote the newer local copy while "✓ Saved" was on screen. Now there is one pending-save
  record per `${date}|${day}`, flushed on day/date change and on `beforeunload`/`pagehide`,
  and the load path merges by `updatedAt` so only a strictly newer server copy wins.
- (2026-09-28) "✓ Saved" shown when the save failed — FIXED. Added a distinct
  `syncStatus === "error"` state ("Couldn't save — data is only on this device"), an
  "Saved on this device only" state for a failed cloud sync, a `QuotaExceededError` toast,
  and cache pruning to the newest 400 days.
- (2026-09-28) Hydration mismatches — FIXED. `useState(getLocalDateString())` ran during SSR
  (host/UTC date) so east-of-UTC users hydrated into yesterday's session; `previousSession`
  was a `useMemo` that read `localStorage` during render. The date is now initialised to a
  stable `""` and set in an effect, and the previous session is state hydrated in an effect.
- (2026-09-28) "38 reps" for a 38-second hold — FIXED. `formatSessionAsText` always emitted
  `reps`, and `getDefaultReps("30–45 sec")` auto-filled `38` into timed holds and metre
  targets. Every `sets()` target now carries an explicit `unit` (`reps`/`sec`/`m`), used by the
  formatter, the default, the column header, the stepper labels and the ghost chip. The
  hardcoded `kg` is now a persisted preference that flows into the placeholder, the ghost
  chip and the text export.
- (2026-09-28) Positional item identity — FIXED. Items were keyed `${sIdx}:${iIdx}` with no
  program version, so inserting or reordering one item in `PROGRAM` silently re-attached every
  logged set to a different exercise. Items are now keyed by a stable slug
  (`${dayId}:${exerciseId}`) with `programVersion` stored alongside `items`; old positional
  payloads are migrated on load, unmappable data is kept (never dropped) and surfaced as a
  clear warning, and the legacy key shape is still read so nothing is lost.
- (2026-09-28) No DB indexes / unstable history ordering — FIXED. Added
  `createIndex({date: 1, day: 1}, {unique: true})` and `{date: -1, day: 1}` (with a
  non-unique fallback if a pre-existing duplicate blocks the unique one), sorted history by
  `{date: -1, day: 1}` so same-day ordering is stable, moved the empty-session cleanup to a
  one-shot per process instead of every request, made the client load history once on mount
  rather than on every date/day change, bounded `completedSetsInDay` to set indices
  `1..count` (a stale payload could push `progressPercent` past 100 and render a bar wider
  than its track), and keyed history rows by `${h.date}|${h.day}` instead of the array index.
- (2026-09-28) Accessibility gaps — FIXED. Weight, reps and both cardio fields are announced
  only by `placeholder`; added `aria-label` to each. The section collapse header was a
  `<div role="button">` with no `tabIndex` and no key handler; it is now a real
  `<button type="button">` with `aria-expanded`/`aria-controls`, a button style reset and a
  `:focus-visible` ring. The export dialog now receives focus on open and closes on Escape.
  The day tabs got `id`/`aria-controls`/`tabIndex` and the content region is a real
  `role="tabpanel"`. The progress bar got `role="progressbar"` with `aria-valuenow`/
  `valuemin`/`valuemax`/`valuetext`.
- (2026-09-28) No lint setup at all — FIXED. Added `eslint` + `eslint-config-next` (matching
  the installed Next 16), a flat `eslint.config.mjs` mirroring the sibling repos, and
  `"lint": "eslint ."`. `npm run lint` passes with 0 errors. The lint run surfaced a real
  problem — refs read from render-scope helpers — which is why the debounced save queue now
  lives in a module-level `saveQueue` rather than in component refs.
- (2026-09-28) No security headers — FIXED. Added `next.config.mjs` with a CSP (no
  `'unsafe-eval'` in production, `'unsafe-inline'` for styles), `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`
  (plus `Permissions-Policy`).
- (2026-09-28) Nothing type-checked — FIXED. Installed `typescript` and pointed
  `npm run typecheck` at the existing `jsconfig.json` with `allowJs: true` / `checkJs: false`
  (see the "TypeScript vs jsconfig" decision in the audit report). `jsconfig.json` was kept
  rather than deleted because Next resolves the `@/*` path alias from it.
- (2026-09-28) Dead `info()` builder — FIXED. `lib/program.js` had an unused `info()` builder
  and `kind: "info"` had no renderer in `app/page.js`; `info()` is deleted rather than given
  a render branch, because nothing in the program used it.
- (2026-09-28) `docs/architecture.md` was factually wrong — FIXED. It claimed "No test runner
  configured" (there is `"test": "vitest run"`), gave `app/page.js` as "~1400 lines" (1382
  then, 1712 now), and claimed `a.html` had "no functions" (it has 15). The auth section now
  states plainly that the API is unauthenticated and must be gated before any public deploy.

## 🟡 New Features

- (2026-09-28) **SHIPPED — optional Manager integration (centralized logging + analytics).** `lib/manager/{index.js,logger.js,ManagerProvider.jsx}`, `scripts/{check-manager-integration,measure-log-delivery}.mjs` (`npm run manager:check`), 14 new vitest cases in `tests/manager-integration.test.js`, `.env.example` block, and a `connect-src` extension in `next.config.mjs` that is applied **only** when `NEXT_PUBLIC_MANAGER_ENDPOINT` is set (verified byte-identical to the previous policy when it is not). Server logs now come from every rejection and 500 path in `/api/session` and `/api/history` plus a failed `client.connect()` in `lib/mongodb.js`; the browser SDK captures console/crash/fetch failures; a client-side tracker tag reports pageviews. A no-op without env vars, so local dev, CI and previews are untouched. Delivery profile 201/200 delivered, 0 dropped, 11 requests, 18.3 entries/request at 214 logs/s. The browser half deliberately reads a separate `NEXT_PUBLIC_MANAGER_*` block through static `process.env.NEXT_PUBLIC_*` member expressions — a `'use client'` module cannot see `MANAGER_*` at all and would fail silently while the tests still passed. A test reads the facade source so that cannot regress. This repo vendors the SDK as `?format=js` (plain JavaScript, `jsconfig` with `checkJs: false`) rather than the TypeScript build, and the facade imports it as `"./logger.js"`, so the measure script needs no bundler at all.

- (2026-09-28) Consider an explicit "export includes unmapped exercises" flow: logged data for
  an exercise removed from the program is kept in storage and flagged, but the only way to see
  it is the raw JSON export.
- (2026-09-28) Consider a data-integrity check that compares the cache against Mongo on load
  and offers a merge preview, rather than relying purely on `updatedAt` (a clock skew between
  devices could pick the wrong winner).
- (2026-09-28) Consider a "backup reminder" that surfaces after N days without an export, since
  the local cache prunes to 400 sessions and an unreached Mongo means that is the only copy.

## Resolved

- (2026-09-26) No tests or test runner: added a vitest suite (`npm test`) with a single
  entry-point. Since grown to 56 tests.
- (2026-09-26) `a.html` (~50 KB) dead static prototype: **deleted** with `git rm a.html` on
  2026-09-28 rather than archived, because it shared no data with the app (different
  `STORAGE_KEY`), had no API sync, and diverged.
- (2026-09-26) `GET /api/history` fired `deleteMany` without awaiting: now awaited, and the
  cleanup moved to a one-shot per-process step.
