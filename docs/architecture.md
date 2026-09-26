# Architecture — Workout Tracker

Small Next.js (App Router) personal workout tracker. Single-user, no auth/roles —
the AGENTS.md PermissionGate/role standard is N/A (no authentication, paid tiers,
or multi-user access to gate). Client works fully offline on `localStorage`;
MongoDB is an optional cloud-sync backend. Offline-first: every API route falls
back to local-only behavior when `MONGODB_URI` is unset or unreachable.

## File inventory

### `app/page.js` (~1452 lines, `"use client"`)
Main tracker UI. Purpose: day/date selection, set logging, progress, history,
export, debounced auto-save (localStorage + `POST /api/session`).
- `formatSessionAsText(session, program)` — renders a session as shareable text.
- `downloadFile(content, filename, mimeType)` — Blob download helper.
- `ExportModal({ onClose, currentSession, historyList, program })` — export dialog
  (This Session vs Full History × .txt vs .json); inner `handleExport()` builds
  content via `formatSessionAsText`/`JSON.stringify` and calls `downloadFile`.
- `getLocalDateString()` — local `YYYY-MM-DD` for date input/session keys.
- `getDefaultReps(target)` — midpoint of a `"8–12"` range (or single number) for
  ghost/rep placeholders.
- `triggerHaptic(type)` — `navigator.vibrate` wrapper (light/medium/success).
- `WorkoutPage()` (default export) — root component + handlers:
  - `checkStatus()` — polls `GET /api/status` (15 s interval) into `mongoStatus`.
  - `fetchServerSession()` (in load effect) — instant localStorage paint, then
    server merge; prunes cache when server has no active session.
  - `saveSession(newItems)` — immediate localStorage write + history-list patch,
    debounced (500 ms) `POST /api/session`; sets `syncStatus` synced/saving/local.
  - `updateItem(key, updater, sIdx)` — state update via `itemsRef` mirror (keeps
    side effects out of the setState updater; StrictMode-safe), then
    `saveSession` + `checkAutoCollapse`. `itemsRef` mirrors `items` so rapid
    successive updates never read stale state.
  - `checkAutoCollapse(sIdx, currentItems)` — collapses a section + success
    haptic when all its sets/items are done.
  - `toggleSection(sIdx)` — manual collapse toggle + light haptic.
  - `loadHistory()` — `GET /api/history` when Mongo connected, else rebuilds
    history from localStorage; feeds `historyList` + `allPastSessions`.
  - `previousSession` (useMemo) — latest prior same-day session for ghost
    (progressive-overload) values, Mongo first then localStorage.
  - `toggleHistory()` — lazy-loads history on open.
  - `totalSetsInDay` / `completedSetsInDay` / `progressPercent` — progress bar
    math honoring per-item `customSetCount`.

### `app/layout.js`
Root layout + metadata. Purpose: html shell, title/description, mobile viewport.
- `RootLayout({ children })` — renders `<html lang="en"><body>{children}</body></html>`.
- Exports `metadata` (title/description) and `viewport` (device-width, themeColor).

### `app/globals.css` (~1286 lines)
Whole-app stylesheet (no functions). Purpose: dark theme variables, layout,
header/progress, sections, set rows, history panel, export modal, responsive rules.

### `app/api/session/route.js`
Per-session read/write. Offline fallback: returns `{ source: "local-only" }` /
`{ success: false, mongoConnected: false }` when DB unavailable (client keeps
localStorage as source of truth).
- `GET(request)` — requires `?date=&day=` (400 if missing); returns stored
  `items` + `updatedAt` or empty items with `source: "local-only"`.
- `POST(request)` — requires `{ date, day }` (400 if missing); deletes the doc
  when `hasSessionData(items)` is false, else upserts `{ date, day, items,
  updatedAt }`.

### `app/api/history/route.js`
History feed. Offline fallback: `{ sessions: [], mongoConnected: false }`.
- `GET()` — last 100 sessions sorted by date desc; filters to sessions with
  data via `hasSessionData`, fire-and-forget deletes legacy empty docs, returns
  first 60 active sessions + `mongoConnected: true`.

### `app/api/status/route.js`
DB health probe.
- `GET()` — returns `checkMongoStatus()` (`configured`/`connected`/`message`).

### `lib/mongodb.js`
Mongo connection + status. Purpose: lazy singleton client, `workout_tracker` db.
- `getDatabase()` — returns `Db` or `null` when `MONGODB_URI` unset/blank or
  connect fails (resets `clientPromise` so later calls retry).
- `checkMongoStatus()` — `{ configured, connected, message }` via ping.

### `lib/program.js` (926 lines)
Workout program data + builders. Purpose: static 4-day program + emptiness check.
- `simple(name, prescription, note)` — `{ kind: "simple" }` check-off item builder.
- `info(name, note)` — `{ kind: "info" }` header/note builder.
- `sets(name, prescription, note, setCount, target, track)` — `{ kind: "sets" }`
  multi-set builder (`track`: `weightReps`/`reps`).
- `result(name, prescription, note, label1, label2)` — `{ kind: "result" }`
  two-field (e.g. cardio/time) builder.
- `hasSessionData(items)` — true if any item/set has done/values (drives save,
  delete-empty, history filtering, ghost lookup).
- `PROGRAM` (const, no functions) — `day1` Full Body A (10 sections), `day2`
  Full Body B (10), `day3` Full Body C (12), `day4` Optional conditioning (5).

### `a.html` (~50 KB, no functions)
Standalone static prototype of the tracker (predates the Next.js app). Purpose:
legacy reference only — not served by the app; drift risk if edited.

### `.env.example`
Example env file (tracked; `.gitignore` un-ignores it). No functions.
Declares `MONGODB_URI=mongodb://localhost:27017/workout_tracker`.

### `.gitignore`
Ignores `node_modules`, `.next`, `.env*` (except `!.env.example`), `.DS_Store`.

### `jsconfig.json`
Path alias config (no functions): `baseUrl: "."`, `@/*` → `./*` (used for
`@/lib/...` imports).

### `package.json` / `package-lock.json`
Manifest + lockfile (no functions). Deps: `next`, `react`, `react-dom`,
`mongodb`. Scripts: `dev`, `build`, `start`. No test runner configured.

### `AGENTS.md` / `CLAUDE.md`
Repo-local AI guidelines (`CLAUDE.md` is a one-line `@AGENTS.md` pointer).
Docs conventions used here: `docs/` folder, per-file purpose+functions,
separate Environment Variables section.

## Environment Variables

| Var | Required? | Purpose | Referenced in |
|---|---|---|---|
| `MONGODB_URI` | No — app works fully offline on localStorage without it | Mongo connection string (`workout_tracker` db); enables cloud sync + history | `lib/mongodb.js` (`getDatabase`, `checkMongoStatus`), `.env.example`, surfaced in `app/page.js` offline banner and `app/api/session/route.js` local-save message |

Verified via grep: `MONGODB_URI` is the only `process.env` var in the codebase.
No auth/permission env vars (no auth system).
