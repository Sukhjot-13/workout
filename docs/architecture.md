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

### `app/layout.js` (20 lines)
Root layout + metadata. Purpose: html shell, title/description, mobile viewport.
- `RootLayout({ children })` — renders `<html lang="en"><body>{children}</body></html>`.
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

### `app/api/history/route.js` (73 lines)
History feed. Offline fallback: `{ sessions: [], mongoConnected: false }`.
- `ACTIVE_FILTER` — hard-coded `{ items: { $exists: true } }`; never derived from client input.
- `cleanupEmptySessions(db)` — one-shot per process (memoised `cleanupPromise`) removal of
  legacy empty documents, so it is not paid on every history request.
- `GET()` — `find(ACTIVE_FILTER)` sorted `{ date: -1, day: 1 }` (stable for same-day ties),
  limit 100; each session is passed through `migrateItems` so history is keyed by current
  slugs; returns the first 60 active sessions with `unmappedItems` flagged.

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

### `vitest.config.mjs` (17 lines)
Vitest config: `@` → repo root alias (so `lib/*` modules resolve their `@/lib/...` imports),
`environment: "node"`, `include: ["tests/**/*.test.js"]`.

### `next.config.mjs` (41 lines)
Security headers on every route via `headers()`: `Content-Security-Policy` (no
`'unsafe-eval'` in production, `'unsafe-inline'` for styles **and** for Next's bootstrap
scripts, `ws:` connect only in dev), `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`,
`Permissions-Policy: camera=(), microphone=(), geolocation=()`.

### `eslint.config.mjs` (24 lines)
Flat config from `eslint-config-next/core-web-vitals`, with `globalIgnores` for `.next`,
`out`, `build`, `node_modules`, `next-env.d.ts`. `react-hooks/set-state-in-effect` is off
because post-mount hydration (date, weight unit, previous-session ghost, status) is
deliberate here — the alternative is reading browser-only APIs during render, which breaks
SSR. Run via `npm run lint`.

### `.env.example`
Example env file (tracked; `.gitignore` un-ignores it). No functions.
Declares `MONGODB_URI=mongodb://localhost:27017/workout_tracker`.

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

Verified via grep: `MONGODB_URI` is the only `process.env` var in the codebase.
No auth/permission env vars (no auth system).

## Verification

`npm run lint` (0 errors, 0 warnings) · `npm test` (56 tests) · `npm run typecheck` ·
`npm run build` — all from the repo root.
