# Architecture — Workout Tracker

Small Next.js (App Router) personal workout tracker. Client works fully offline on
`localStorage`; MongoDB is an optional cloud-sync backend. Offline-first: every API
route falls back to local-only behaviour when `MONGODB_URI` is unset or
unreachable.

**The API is unauthenticated.** `/api/session`, `/api/history` and `/api/status`
have no login, no session cookie and no user model, so anyone who can reach the
deployment can read, overwrite or delete any session in the database by date. The
owner has explicitly accepted this for now (single-user personal app, expected to
run on localhost or a private tunnel). **It must be gated before any public
deploy.** Tracked under `## 🔴 Vulnerabilities` in `docs/suggestions.md`.

## File inventory

### `app/page.js` (1712 lines, `"use client"`)
Main tracker UI. Purpose: day/date selection, set logging, progress, history,
export, debounced auto-save (localStorage + `POST /api/session`).
- `downloadFile(content, filename, mimeType)` — Blob download helper.
- `ExportModal({ onClose, currentSession, historyList, program, weightUnit })` — export
  dialog; focuses itself on mount and closes on Escape; `handleExport()` builds
  content via `formatSessionAsText` (from `@/lib/session-format`, passed
  `{ weightUnit }`) or `JSON.stringify` and calls `downloadFile`.
- `getLocalDateString()` — browser-local `YYYY-MM-DD` for the date input and session keys.
- `triggerHaptic(type)` — `navigator.vibrate` wrapper (light/medium/success).
- `describeMigration(migrated)` — user-facing text for a program-version re-key or
  for logged data that no longer maps to a current exercise.
- `findPreviousSession(allPastSessions, selectedDay, selectedDate)` — most recent prior
  same-day session, Mongo list first then the local cache. Called from an effect, never
  during render.
- `saveQueue` / `syncCallbacks` / `setSyncStatusSafe` / `setMongoConnectedSafe` /
  `postSession` / `flushPendingSave` / `queueSessionSave` / `flushAllPendingSaves` —
  module-level debounced sync queue holding **one pending-save record per
  `${date}|${day}`**, so switching day/date (or unloading) flushes the outgoing session
  instead of discarding it. Deliberately outside React so timers and unload handlers can
  reach it without reading a ref from render scope.
- `WorkoutPage()` (default export) — root component + handlers:
  - `checkStatus()` — polls `GET /api/status` (15 s interval) into `mongoStatus`.
  - load effect (on `selectedDate`/`selectedDay`) — sets `saveQueue.activeKey`, flushes the
    previous session's pending save, paints from the local cache, then merges with the
    server using `pickNewerSession` (server copy wins only when strictly newer) and
    surfaces a migration warning via `setMigrationWarning`.
  - `showToast(message, tone)` + auto-dismiss effect — quota / cache-prune / write-failure notices.
  - `saveSession(newItems)` — immediate `writeCache` (envelope with `schema`,
    `programVersion`, `items`, `updatedAt`), history-list patch, then `queueSessionSave`.
    Sets `syncStatus` `saving` / `error` (`error` when the local write itself failed).
  - `updateItem(key, updater, sIdx)` — state update from the latest committed `items`,
    then `saveSession` + `checkAutoCollapse` outside the updater (StrictMode-safe).
  - `checkAutoCollapse(sIdx, currentItems)` — collapses a section + success haptic when all
    its sets/items are done; keys by `item.key`.
  - `toggleSection(sIdx)` — manual collapse toggle + light haptic.
  - `loadHistory()` — `GET /api/history` when Mongo connected, else rebuilds from the local
    cache. Runs **once on mount** (and on history-panel open), not on every date/day change.
  - previous-session effect — resolves `previousSession` into state (starts `null` so SSR
    and the first client render agree).
  - `totalSetsInDay` / `completedSetsInDay` / `progressPercent` — progress math honouring
    per-item `customSetCount`; `completedSetsInDay` counts only set indices `1..count` and
    `progressPercent` is clamped to 0–100.
  - `syncIndicatorClass` / `syncIndicatorText` — renders `Saving...` / `✓ Saved` /
    `Saved on this device only` / `Couldn't save — data is only on this device`.
  - Weight-unit `<select>` — persists `kg` / `lb` to `localStorage`; the value flows into the
    weight placeholder, the ghost chip and the text export.
  - Item identity is `item.key` (`${dayId}:${slug}`), never a positional index.

### `app/layout.js` (27 lines)
Root layout + metadata. Purpose: html shell, title/description, mobile viewport, and
(2026-09-28) the optional `<ManagerProvider />`.
- `RootLayout({ children })` — renders `<html lang="en"><body><ManagerProvider />{children}</body></html>`.
  `ManagerProvider` renders `null`; it starts the Manager browser logger and injects the
  analytics `<script>` only when `managerClientConfig.enabled`.
- Exports `metadata` (title/description) and `viewport` (device-width, themeColor).

### `app/globals.css` (1308 lines, no functions)
Whole-app stylesheet. Purpose: dark theme variables, layout, header/progress, sections,
set rows, history panel, export modal, responsive rules. Includes the
`.sync-indicator.local` / `.sync-indicator.error` states and the button reset +
`:focus-visible` ring for `.section-header`.

### `app/api/session/route.js` (101 lines)
Per-session read/write, fully validated. Offline fallback: `{ source: "local-only" }` /
`{ success: false, mongoConnected: false }` when the DB is unavailable (the client keeps
localStorage as the source of truth).
- `errorResponse(code, status, extra)` — fixed-code error body helper; never returns a raw
  driver/parser message.
- `GET(request)` — validates `?date=&day=` via `validateSessionQuery` **before any DB call**
  (400 `INVALID_DATE` / `INVALID_DAY`); returns stored `items`, `updatedAt`,
  `programVersion`.
- `POST(request)` — `readJsonBody` (400 `INVALID_JSON` / 413 `PAYLOAD_TOO_LARGE`) then
  `validateSessionPayload` (400 `INVALID_ITEMS` / `INVALID_PROGRAM_VERSION`); the filter is
  built only from the validated strings. Deletes the doc when `hasSessionData(items)` is
  false, else upserts `{ date, day, items, updatedAt, programVersion }`.
- **2026-09-28 (Manager, optional).** Every rejection and both 500 paths now also emit
  through the facade in `lib/manager/index.js`, next to the response they already return:
  a rejected `?date=`/`?day=` → `managerLog("warn", "session_query_rejected", { code, method: "GET" })`,
  a rejected body → `session_body_rejected`, a rejected payload → `session_payload_rejected`,
  and the two `catch` blocks → `logServerError("session_read_failed" | "session_write_failed")`.
  No behavioural change: with no `MANAGER_*` env vars the facade is a no-op.

### `app/api/history/route.js` (73 lines)
History feed. Offline fallback: `{ sessions: [], mongoConnected: false }`.
- `ACTIVE_FILTER` — hard-coded `{ items: { $exists: true } }`; never derived from client input.
- `cleanupEmptySessions(db)` — one-shot per process (memoised `cleanupPromise`) removal of
  legacy empty documents, so it is not paid on every history request.
- `GET()` — `find(ACTIVE_FILTER)` sorted `{ date: -1, day: 1 }` (stable for same-day ties),
  limit 100; each session is passed through `migrateItems` so history is keyed by current
  slugs; returns the first 60 active sessions with `unmappedItems` flagged.
- **2026-09-28 (Manager, optional).** The `catch` also calls
  `logServerError("history_read_failed", err)`.

### `app/api/status/route.js` (6 lines)
DB health probe.
- `GET()` — returns only `{ configured, connected }` booleans; no `MONGODB_URI` presence
  detail and no driver message.

### `lib/mongodb.js` (71 lines)
Mongo connection + indexes + status. Purpose: lazy singleton client, `workout_tracker` db.
- `ensureIndexes(db)` — memoised `createIndex({ date: 1, day: 1 }, { unique: true })` and
  `{ date: -1, day: 1 }`; falls back to the non-unique index if a pre-existing duplicate
  blocks the unique one.
- `getDatabase()` — returns `Db` or `null` when `MONGODB_URI` is unset/blank or connect fails
  (resets `clientPromise`/`indexesPromise` so later calls retry); awaits `ensureIndexes`.
- `checkMongoStatus()` — `{ configured, connected }` only; logs the reason server-side.
- **2026-09-28 (Manager, optional).** A failed `client.connect()` also calls
  `logServerError("mongodb_connect_failed", err)`, so an unreachable database reaches the
  central log viewer with the real driver error instead of only a console line.

### `lib/validate.js` (254 lines, no React)
Shared request/payload validation. Every value the server stores is whitelist-constructed
here so a raw client value can never reach a Mongo filter as an operator object.
Exports: `MAX_BODY_BYTES`, `MAX_ITEMS`, `MAX_SETS_PER_ITEM`, `MAX_SET_COUNT`, `MAX_WEIGHT`,
`MAX_REPS`, `MAX_VALUE_LENGTH`, `MAX_PROGRAM_VERSION`, `ERROR_CODES`, `isDateKey`,
`isDayKey`, `isItemKey`, `coerceNumberInput`, `sanitizeItems`, `validateSessionQuery`,
`validateSessionPayload`, `byteLength`, `readJsonBody`.
- `isDateKey(v)` / `isDayKey(v)` — `/^\d{4}-\d{2}-\d{2}$/` and `/^day[1-4]$/`, string-only.
- `isItemKey(v)` — legacy `/^\d+:\d+$/` or current `/^day[1-4]:[a-z0-9][a-z0-9-]*$/`.
- `coerceNumberInput(value, { min, max })` — `{ present, value }` / `{ present: false }` /
  `{ present: false, invalid: true }`; blank text means "absent", non-numeric text, negatives
  and out-of-range values are `invalid`. Also used by the client input handlers so garbage
  never reaches storage.
- `sanitizeItems(raw)` — builds a fresh object; rejects operator keys, non-object payloads,
  unknown fields, `NaN`/`Infinity`/negative/out-of-range weight (0–1000) or reps (0–10000),
  `customSetCount` outside 1–20, set keys outside `1..20`, and `value1`/`value2` over 500 chars.
- `validateSessionQuery` / `validateSessionPayload` — fixed failure codes.
- `readJsonBody(request)` — rejects an oversize `content-length` before reading, then reads
  text, re-checks the real byte length, and returns `PAYLOAD_TOO_LARGE` / `INVALID_JSON`
  instead of letting a `SyntaxError` become a 500 that echoes the request.

### `lib/program.js` (1102 lines)
Workout program data + builders + item identity + positional-key migration.
- `simple(name, prescription, note)` — `{ kind: "simple" }` check-off item builder.
- `sets(name, prescription, note, setCount, target, track, unit)` — `{ kind: "sets" }`
  multi-set builder. `unit` is `"reps" | "sec" | "m"` and is set explicitly on all 78 set
  items, so a timed hold is never labelled "reps" and a sled push is never labelled "reps".
- `result(name, prescription, note, label1, label2)` — `{ kind: "result" }` two-field builder.
- `hasLoggedValue(v)` — numeric-aware "is this field filled in" check.
- `hasSessionData(items)` — true if any item/set has done/values (drives save, delete-empty,
  history filtering, ghost lookup). Treats numeric `0` as not-logged.
- `PROGRAM` (const, no functions) — `day1` Full Body A (10 sections / 28 items), `day2`
  Full Body B (10 / 29), `day3` Full Body C (12 / 38), `day4` Optional conditioning (5 / 23).
- `PROGRAM_VERSION` — bumped when the logged-item shape changes; currently `2`.
- `slugify(name)` — name → stable id.
- `decorateProgram()` — stamps `item.id`, `item.key` (`${dayId}:${slug}`) and
  `item.legacyKey` (`${sIdx}:${iIdx}`) onto every item; disambiguates duplicate names.
- `getProgramDay(dayId)` / `getItemByLegacyKey(dayId, sIdx, iIdx)` — lookups.
- `migrateItems(rawItems, dayId)` — reads current-slug **or** legacy positional payloads and
  returns `{ items, rekeyed, unmapped }`. `unmapped` data is kept verbatim (never dropped) so
  the UI can warn instead of silently mis-attributing or discarding.

### `lib/session-format.js` (105 lines)
Pure session-formatting helpers (no React, no DOM — unit-tested).
- `REPS_UNITS`, `WEIGHT_UNITS` — allowed unit vocabularies.
- `normalizeWeightUnit(value)` / `normalizeRepsUnit(value)` — clamp to the vocabularies.
- `repsUnitLabel(unit)`, `formatWeightValue(weight, weightUnit)`, `formatRepsValue(reps, unit)`.
- `formatSessionAsText(session, program, options)` — renders a session as shareable text;
  reads `items[item.key] ?? items[item.legacyKey]` and uses each item's `unit`.
- `getDefaultReps(target, unit)` — midpoint of a `"8–12"`-style range (or single number);
  falls back per unit (`reps` → 10, `sec` → 30, `m` → 20) when the target has no number.

### `lib/session-cache.js` (143 lines)
Local session cache + local/server merge rules.
- `SESSION_CACHE_KEY`, `CACHE_SCHEMA_VERSION` (`2`), `MAX_CACHED_SESSIONS` (`400`).
- `sessionKeyFor(date, day)`, `readTimestamp(value)`.
- `readSessionEntry(entry, dayId)` — reads the envelope **or** the original bare item map and
  returns `{ items, updatedAt, programVersion, rekeyed, unmapped }`.
- `buildSessionEntry(items, updatedAt, programVersion)` — the versioned envelope.
- `pickNewerSession(localEntry, serverEntry)` — server copy wins only when strictly newer;
  an exact tie keeps local, and a missing server copy never erases local data.
- `pruneSessionCache(cached, max)` — keeps the newest `max` entries, returns `{ cache, pruned }`.
- `readCache()` / `writeCache(sessionKey, entry, max)` — localStorage plumbing.
  `writeCache` returns `{ ok, pruned, quotaExceeded }` instead of throwing, and retries once
  after pruning, so a `QuotaExceededError` surfaces as a real error state.

### `tests/workout.test.js` (553 lines, 56 tests)
Vitest suite; single runner `npm test`. Covers `hasSessionData`, `getDefaultReps`,
`formatSessionAsText`, the `unit` handling, the item-key/slug identity and migration, and
every new validator: date/day/item-key rejection (including `{"$ne":null}`), query and payload
injection, item shape and numeric bounds, oversize/malformed JSON bodies, and the
cache merge/prune rules.

### `tests/manager-integration.test.js` (added 2026-09-28, 14 tests)
Vitest suite for the Manager facade, picked up by the single runner `npm test`. The facade reads
its environment at module load, so every case re-imports it after `vi.resetModules()`. Covers:
disabled-when-unconfigured no-ops across every entry point; server enablement; the analytics key
alone never enabling logs; whitespace-only values treated as unconfigured; **the server block
never enabling the client half**; the client half enabling itself from `NEXT_PUBLIC_*` alone; the
tracker tag's shape; the tracker omitted without a client analytics key; a **static-access guard**
that reads `lib/manager/index.js` and fails if any `NEXT_PUBLIC_*` value stops being a literal
`process.env.X` member expression (bracket notation fails too) or if the client block starts
indexing `process.env`; `managerLog` never throwing at any level; info riding the 250ms window
while `error` leading-edge flushes with the 100ms floor; unknown levels falling back to `info`;
`getManagerDroppedCount`; `globalThis` instance sharing; and the real SDK surface.

### `lib/manager/` (added 2026-09-28) — Manager integration (OPTIONAL)

Centralized logging + analytics. **Entirely optional**: with no `MANAGER_*` variables the whole
thing is a set of no-ops, so local dev, CI and previews are unaffected. This app has no logging
layer of its own, so the facade is the single entry point — the API routes and `lib/mongodb.js`
call `logServerEvent`/`logServerError`/`managerLog` directly, next to the `console.error` they
already emitted.

| File | Purpose | Exports |
|---|---|---|
| `lib/manager/logger.js` | The vendored `@manager/logger` SDK: one file, zero dependencies. Refreshed with `curl -H "x-manager-key: …" "…/api/sdk/logger?format=js"`. Do not hand-edit. This repo is plain JavaScript, hence the `?format=js` build of the SDK (the TypeScript repos vendor `?format=ts`). | `initLogger`, `traceIdFromHeaders`, `shutdownLoggers`, `fingerprint`, `LOG_SDK_VERSION`, `LOG_SDK_PATH`, `TRACE_HEADER` |
| `lib/manager/index.js` | The integration facade. Reads the server `MANAGER_*` block into `managerConfig` and — separately, and this is the point — the `NEXT_PUBLIC_MANAGER_*` block into `managerClientConfig` using **static** `process.env.NEXT_PUBLIC_*` member expressions, because Next.js strips non-public env from the client bundle. Exposes a no-op logger when unconfigured, creates the real logger lazily on first use and caches it on `globalThis`, batches routine levels on a 250ms window and leading-edge-flushes `error`/`fatal`. Never throws. Imports the SDK as `"./logger.js"` so plain Node can load the facade outside the bundler (no bundler needed anywhere in this repo). | `managerConfig`, `managerClientConfig`, `startManagerLogger`, `getManagerLogger`, `managerLog`, `getManagerDroppedCount`, `logServerEvent`, `logServerError`, `managerTrackerScript` |
| `lib/manager/ManagerProvider.jsx` | `'use client'` component mounted in `app/layout.js`. Starts the browser logger and injects the analytics `<script>` once, guarded against double injection. Gated on `managerClientConfig.enabled`, **not** `managerConfig.enabled`. | `ManagerProvider` (default) |
| `scripts/check-manager-integration.mjs` | `npm run manager:check` — live check against a running Manager: the server key, client key and analytics key are each accepted on the right endpoint, each wrong key kind is refused, and this app's own rejection paths are exercised (`GET /api/session?date=nope` → 400, `POST /api/session` with a malformed body → 400, `GET /api/status` → 200). | — |
| `scripts/measure-log-delivery.mjs` | `node scripts/measure-log-delivery.mjs [count]` — fires N entries at the facade, counts the ingest requests that actually land, reports latency, entries/request and SDK drops. | — |

**Delivery profile.** Routine levels ride the SDK's own 250ms `flushIntervalMs` window, so a burst
of N lines becomes one HTTP request rather than N. `error`/`fatal` skip the window via
`scheduleUrgentFlush` (leading edge): flush now if `URGENT_FLUSH_MIN_GAP_MS` (100ms) has passed,
otherwise arm a single trailing flush — a burst of 50 errors costs ~2 requests, not 50. Measured
with `node scripts/measure-log-delivery.mjs 200`: **201/200 entries delivered, 0 dropped, 11
requests, 18.3 entries/request at 214 logs/s**. (Flushing per entry instead measures ~96/200
delivered with 105 dropped across 20 requests — one HTTP request per line.)

**Design points.**
- The logger is created on first use, not at boot: Next.js compiles startup hooks and route
  handlers into separate module graphs, so a boot-created instance is not the object a request sees.
- `captureProcessErrors` is intentionally **off** — Next.js owns process error handling, and extra
  process listeners stop log delivery entirely.
- No bundler is required. The TypeScript reference repos need a `module.registerHooks` resolve
  hook (or esbuild) in the measure script because their facade is TypeScript; here the facade is
  plain ESM with an explicit `"./logger.js"` import, so Node imports it directly.

### `vitest.config.mjs` (17 lines)
Vitest config: `@` → repo root alias (so `lib/*` modules resolve their `@/lib/...` imports),
`environment: "node"`, `include: ["tests/**/*.test.js"]`.

### `next.config.mjs` (41 lines)
Security headers on every route via `headers()`: `Content-Security-Policy` (no
`'unsafe-eval'` in production, `'unsafe-inline'` for styles **and** for Next's bootstrap
scripts, `ws:` connect only in dev), `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`.
- **2026-09-28:** `connect-src` gains `NEXT_PUBLIC_MANAGER_ENDPOINT` **when it is set**, because
  the Manager browser logger and the analytics tracker both need to reach that origin and
  `connect-src 'self'` alone would block them silently. Unset, the assembled policy is
  **byte-identical** to the previous one (asserted in verification below), so the integration
  stays a true no-op when it is not configured. No `script-src` change is needed — the tracker
  tag is inserted by script and `script-src` already allows `'self'` + the inline bootstrap.

### `eslint.config.mjs` (24 lines)
Flat config from `eslint-config-next/core-web-vitals`, with `globalIgnores` for `.next`,
`out`, `build`, `node_modules`, `next-env.d.ts`. `react-hooks/set-state-in-effect` is off
because post-mount hydration (date, weight unit, previous-session ghost, status) is
deliberate here — the alternative is reading browser-only APIs during render, which breaks
SSR. Run via `npm run lint`.

### `.env.example`
Example env file (tracked; `.gitignore` un-ignores it). No functions.
Declares `MONGODB_URI=mongodb://localhost:27017/workout_tracker`, plus (2026-09-28) the optional
Manager block: `MANAGER_ENDPOINT`, `MANAGER_APP_ID`, `MANAGER_LOG_KEY`, `MANAGER_ANALYTICS_KEY`,
`MANAGER_LOG_SOURCE` and the four `NEXT_PUBLIC_MANAGER_*` values. Every key line is blank — no
credential value is ever committed.

### `.gitignore`
Ignores `node_modules`, `.next`, `.env*` (except `!.env.example`), `.DS_Store`.

### `jsconfig.json`
Path alias config **and** the TypeScript project used by `npm run typecheck`
(`tsc -p jsconfig.json`): `baseUrl: "."`, `@/*` → `./*` (used for `@/lib/...` imports),
plus `allowJs: true` / `checkJs: false` / `noEmit` / `skipLibCheck`.

### `package.json` / `package-lock.json`
Manifest + lockfile. Deps: `next`, `react`, `react-dom`, `mongodb`. DevDeps: `vitest`,
`eslint`, `eslint-config-next`, `typescript`. Scripts: `dev`, `build`, `start`, `lint`
(`eslint .`), `typecheck` (`tsc -p jsconfig.json`), `test` (`vitest run`).

### `AGENTS.md` / `CLAUDE.md`
Repo-local AI guidelines (`CLAUDE.md` is a one-line `@AGENTS.md` pointer).
Docs conventions used here: `docs/` folder, per-file purpose+functions, separate
Environment Variables section.

### `a.html`
Deleted (`git rm a.html`). It was a 1621-line dead duplicate of the program and UI using a
different `STORAGE_KEY`, with no API sync, no history/export and an `info` item kind the
React app cannot render.

## Environment Variables

| Var | Required? | Purpose | Referenced in |
|---|---|---|---|
| `MONGODB_URI` | No — app works fully offline on localStorage without it | Mongo connection string (`workout_tracker` db); enables cloud sync + history | `lib/mongodb.js` (`getDatabase`, `checkMongoStatus`, `ensureIndexes`), `.env.example`, surfaced in `app/page.js` offline banner and `app/api/session/route.js` local-save message |

### Manager (centralized logging + analytics) — OPTIONAL, all nine default to unset

Nothing in this group is required. With all of them unset the integration is a set of no-ops, so
local dev, CI and previews behave exactly as before. The full annotated block is in
`.env.example`; `.env.local` carries the real values and is git-ignored.

**Server half** — read only by Node-side code (route handlers, `lib/mongodb.js`).
`MANAGER_ENDPOINT` is the base URL of the **Manager** deployment, *not* this app's own port (a
local Manager is `http://127.0.0.1:3300`); pointing it at the app's own port makes every log POST
fail silently.

| Var | Required? | Purpose | Referenced in |
|---|---|---|---|
| `MANAGER_ENDPOINT` | Optional | Base URL of the **Manager** deployment. Endpoint + app id + log key must all be present before the integration enables itself. | `lib/manager/index.js` → `managerConfig` |
| `MANAGER_APP_ID` | Optional | Project slug in Manager (`workout`). | `lib/manager/index.js` → `managerConfig` |
| `MANAGER_LOG_KEY` | Optional | Project log key — `mlk_…` for the server. Verified absent from the built client bundle. | `lib/manager/index.js` → `managerConfig` |
| `MANAGER_ANALYTICS_KEY` | Optional | Analytics key (`mak_…`). Without it logs still work but no analytics tag is injected. | `lib/manager/index.js` → `managerConfig.analyticsKey` |
| `MANAGER_LOG_SOURCE` | Optional | `server` (default) or `client`. Inferred when omitted. | `lib/manager/index.js` → `SOURCE` |

**Client half** — required for *any* browser logging or analytics, because Next.js inlines only a
literal `process.env.NEXT_PUBLIC_FOO` member expression into the client bundle. `process.env` is an
empty object in browser code and a dynamic `process.env[name]` lookup is not inlined either, so a
`'use client'` module reading `MANAGER_*` is silently dead. Every value below is written out
statically in `lib/manager/index.js` and guarded by a test that reads the facade source.

| Var | Required? | Purpose | Referenced in |
|---|---|---|---|
| `NEXT_PUBLIC_MANAGER_ENDPOINT` | Optional (needed for browser half) | Same value as `MANAGER_ENDPOINT`. Also read by `next.config.mjs` to extend the CSP's `connect-src` — but only when set. | `lib/manager/index.js` → `CLIENT_ENDPOINT`; `next.config.mjs` → `managerOrigin` |
| `NEXT_PUBLIC_MANAGER_APP_ID` | Optional (needed for browser half) | Same value as `MANAGER_APP_ID`. | `lib/manager/index.js` → `CLIENT_APP_ID` |
| `NEXT_PUBLIC_MANAGER_CLIENT_KEY` | Optional (needed for browser logs) | The project's **client** key (`mck_…`), not the server key: Manager derives each entry's `source` from the key kind. | `lib/manager/index.js` → `CLIENT_LOG_KEY` |
| `NEXT_PUBLIC_MANAGER_ANALYTICS_KEY` | Optional (needed for analytics) | `mak_…` analytics key. | `lib/manager/index.js` → `CLIENT_ANALYTICS_KEY` |

Verified against the production bundle: the four `NEXT_PUBLIC_*` values appear as string literals in
`.next/static/chunks/0derzykp13j8r.js`, `MANAGER_LOG_KEY` appears nowhere in `.next/static`, and the
server `env()` helper survives as a dead dynamic index (`env("MANAGER_ENDPOINT")`) the browser can
never resolve — harmless, because `ManagerProvider` gates on `managerClientConfig.enabled` and never
reads `managerConfig`.

No auth/permission env vars (no auth system).

## Verification

`npm run lint` (0 errors, 0 warnings) · `npm test` (70 tests: 56 existing + 14 Manager) ·
`npm run typecheck` · `npm run build` · `npm run manager:check` (9 checks) ·
`node scripts/measure-log-delivery.mjs 200` — all from the repo root.

Manager integration verified end to end against a running Manager on :3603:
- `GET /api/session?date=nope&day=day1` → 400, lands as `level=warn source=server keyPrefix=mlk_SAA`
  with `code=INVALID_DATE`, ~1s after the request.
- `POST /api/session` with `{not json` → 400, lands as `level=warn … code=INVALID_JSON`.
- With `MONGODB_URI` pointed at a closed port, `GET /api/history` lands as
  `level=error … message=mongodb_connect_failed` carrying the real
  `MongoServerSelectionError: connect ECONNREFUSED` — delivered through the leading-edge flush.
- CSP asserted byte-identical when Manager is unset:
  `prodUnset === preChangePolicy` → `true`.
