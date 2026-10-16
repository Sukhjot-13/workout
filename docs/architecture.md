# Architecture — Workout Tracker

Updated 2026-10-16. Personal Next.js App Router tracker with a three-day full-body routine. Plain JavaScript/JSX and CSS; optional MongoDB sync; localStorage is the immediate save target.

The existing API remains unauthenticated by the owner's prior decision for personal/private use. This change does not add an identity/role model. The existing access risk and unresolved lint-tool advisories are tracked in `docs/suggestions.md`.

## File inventory

### `app/page.js`

Client workout page: day/date and unit selection, local/cloud saving, resume navigation, history, export and on-demand form guides.
- `downloadFile` — creates a temporary Blob URL and downloads JSON/text.
- `ExportModal` — current/history scope and format dialog; nested `handleExport` renders/downloads the selected data; focus/Escape effect supports dismissal.
- `getLocalDateString` — browser-local calendar key after mount, avoiding server/client date hydration differences.
- `triggerHaptic` — optional vibration for completion and section controls.
- `describeMigration` — explains retained removed exercise data and historical identity updates.
- `findPreviousSession` — finds the newest earlier same-day-program session for previous values.
- `postSession` — validated API write; returns cloud/device status, throws on HTTP failures.
- `sessionSync.onStatus` — updates only the active session and distinguishes cloud-only saves after device-storage failure.
- `flushPendingSave`, `queueSessionSave`, `flushAllPendingSaves` — adapt the centralized serialized save queue to selection changes, debouncing and unload.
- `WorkoutPage` — root component. Nested `showToast` reports concise feedback; `checkStatus` polls cloud status; `fetchServerSession` loads/merges cloud data and rejects late responses after local edits; `saveSession` writes versioned snapshots/tombstones, queues cloud saving, and updates both history lists; `patchHistory` keeps actual entries and sorted identities; `updateItem` changes one exercise then saves outside the React updater; `checkAutoCollapse` collapses completed sections only if session/edit version is still current; `toggleSection` expands/collapses; `loadHistory` merges both storage sources with timeout/loading/fallback feedback; `toggleHistory` refreshes on opening; `jumpToFirstUnchecked` expands/scrolls to the first unfinished exercise below sticky controls and optionally focuses it.
- Effects: toast dismissal, sync callbacks, cloud status polling, browser date/unit/day hydration, selected-day persistence, unload flush, session loading, history loading, previous-session resolution and one-time resume scrolling. Auto scrolling is skipped after an edit during a pending cloud load and respects reduced motion. No image is mounted on the default page.

### `app/layout.js`

Root metadata and mobile viewport. `RootLayout` renders the HTML/body shell and children.

### `app/globals.css`

App theme, responsive cards, three-day tabs, compact sticky controls, entry rows, progress/history/export styling, individual guide images/dialogs, keyboard focus and reduced-motion rules. No functions.

### `app/api/session/route.js`

`errorResponse` returns fixed error codes. `GET` validates real date/day before querying and returns items/timestamp/version or device-only fallback. `POST` bounds/parses/validates JSON, sanitizes all stored values, and upserts or clears exactly one date/day session. Existing historical day4 keys stay API-compatible; day4 is not in the active program.

### `app/api/history/route.js`

`cleanupEmptySessions` memoizes a one-shot legacy-empty cleanup (bounded to 100 scanned records). `GET` reads up to 100 records in stable date/day order, migrates identities without losing removed data, and returns up to 60 nonempty cloud sessions; missing Mongo returns the device-only fallback.

### `app/api/status/route.js`

`GET` returns only configured/connected booleans, without driver details.

### `components/Modal.jsx`

`Modal` uses a native dialog for focus trapping, Escape/backdrop dismissal and focus restoration; its mount/cleanup effect records the invoking element, opens/closes the dialog, explicitly restores focus with preventScroll, and restores body scroll. Close/cancel/click callbacks call the provided close action.

### `components/ExerciseGuide.jsx`

`ExerciseGuide` mounts only when requested and displays one individual illustration plus prescription, movement/posture cues and applicable per-side notes. Image load/error callbacks show accessible feedback; instructions remain available on failure. Links to NASM/NASS are supplied for relevant checked references.

### `components/NumericInput.jsx`

`NumericInput` holds an in-progress decimal draft locally; change callback validates and reports normalized values, blur callback finishes the draft without destroying fractional typing. Max bounds and accessible labels come from the caller.

### `components/SetTracker.jsx`

`SetTracker` renders per-exercise set entry and previous values. `changeSet` atomically changes one set; `changeWeight` fills only empty or matching unfinished later weights; `changeCount` changes visible set count while retaining hidden values for undo. Button callbacks apply previous weight/reps in one update, step within bounds, and mark only the selected set complete. Timed work uses seconds; bodyweight work omits weight fields.

### `lib/program.js`

Program version 3, containing exactly the supplied days: day1 has 6 sections/23 items, day2 6/25, day3 8/28 (76 entries, 66 unique illustrated movements). Old routine/Day 4 is absent from active selection.
- `simple`, `sets`, `cardio` — build check-off, set and cardio entries; sets supports ranges, units and per-side/foot/direction suffixes.
- `hang`, `hipStretch`, `hamstringStretch` — shared finishing-entry builders.
- `canonicalKey` — explicit unambiguous legacy-name aliases; `decorateProgram` stamps stable day:id keys and applicable frozen historical positions.
- `hasLoggedValue`, `hasSessionData` — detect actually recorded values/completion rather than empty placeholders.
- `getProgramDay` — current day or null (never relabels a removed day).
- `getItemByLegacyKey` — resolves frozen old positions, never replacement array positions.
- `getArchivedItem` — recovers original exercise names/units/field labels for export.
- `migrateItems` — retains unknown/removed entries and key collisions; current keys win while original conflicting values remain exportable.

### `lib/legacy-items.json`

Frozen old per-day position → key/name/kind/unit/field-label metadata, including archived Day 4. Prevents historical logs being silently reassigned after reordering. Data only; no functions.

### `lib/exercise-guides.js`

`EXERCISE_GUIDES` maps 66 stable guide IDs to separate local image paths/dimensions, movement instructions, cues and optional reference links. `getExerciseGuide` returns an own-property entry or null. No combined atlas is referenced by the application.

### `lib/workout-input.js`

`isNumberDraft` permits bounded partial decimal input; `finishNumberDraft` normalizes it; `stepValue` clamps steppers to 0–10000; `applyPreviousSet` copies weight/reps atomically without copying completion or an irrelevant weight.

### `lib/workout-progress.js`

`getSetCount` clamps valid set counts to 1–20 and handles malformed/null values; `getItemProgress` counts visible completed sets or simple/cardio completion; `getDayProgress` sums totals/percent; `findFirstUnchecked` returns the earliest unfinished exercise/section or null. Used by UI, progress, collapse and resume navigation.

### `lib/session-sync.js`

`createSaveQueue` constructs an injected, testable queue. Nested `queue` debounces latest snapshots per session; `flush` serializes same-session writes, suppresses stale Saved statuses, handles sync/async failures and drains newer pending snapshots; `flushAll` independently flushes each session and forwards keepalive. Local snapshots remain the recovery mechanism if the browser cannot finish a cloud write on unload.

### `lib/session-cache.js`

`sessionKeyFor` builds date|day identity; `storage` safely locates localStorage; `readTimestamp` parses bounded numeric/ISO timestamps; `readSessionEntry` reads old bare maps or versioned envelopes and migrates identities; `buildSessionEntry` constructs schema-2 envelopes; `pickNewerSession` keeps local on ties and never erases it with an absent server copy; `mergeSessionHistory` reconciles both sources before filtering empty tombstones; `pruneSessionCache` retains the newest configured count (400 default); `readCache` tolerates unavailable/corrupt storage; `writeCache` saves/reports quota and pruning outcomes. Empty envelopes retain an explicit clear until the server deletion syncs.

### `lib/session-format.js`

`normalizeWeightUnit`, `normalizeRepsUnit` validate vocabularies; `repsUnitLabel`, `formatWeightValue`, `formatRepsValue` label numbers; `formatSessionAsText` prints migrated current data plus original removed exercise values and archived-day records, including completed cardio without notes; `getDefaultReps` provides numeric target suggestions with unit-specific fallback. Unit selection labels values and does not convert stored weights.

### `lib/mongodb.js`

`ensureIndexes` memoizes unique date/day and history sort indexes with a nonunique fallback for legacy duplicates; `getDatabase` lazily connects to workout_tracker and resets failed connection/index promises; `checkMongoStatus` returns configured/connected booleans and pings without exposing driver details.

### `lib/validate.js`

`isDateKey` validates real Gregorian ISO dates; `isDayKey` accepts supported/historical day strings; `isItemKey` accepts bounded slug or frozen positional formats. `fail` builds fixed-code rejection; `isPlainObject` and `isBoundedNumber` check primitive shapes/ranges; `coerceNumberInput` normalizes numeric input; `sanitizeSet`, `sanitizeItem`, `sanitizeItems` whitelist fields and enforce bounds; `validateSessionQuery`, `validateSessionPayload` validate request identity/items/version; `byteLength` measures UTF-8; `readJsonBody` returns 400/413-safe results with a 256 KB cap.

### `next.config.mjs`

Security configuration and CSP; async `headers` applies CSP, frame denial, nosniff, referrer and permissions headers. NODE_ENV controls development websocket/eval allowances. Images are local WebP; no third-party image host configuration.

### `vitest.config.mjs`

Single test runner configuration: root @ alias, Node default environment and tests/**/*.test.{js,jsx}; component/page tests select jsdom per file. The pre-transform plugin's `transform` compiles the Next JSX page with Oxc for integration tests.

### `eslint.config.mjs`

Flat Next core-web-vitals configuration, generated/dependency ignores and intentional effect-hydration exception. No custom functions.

### `jsconfig.json`

Root @ alias, allowJs/checkJs:false/noEmit, preserved JSX, and source/test inclusion. npm run typecheck provides parsing/project checks rather than full JavaScript type checking. No functions.

### `package.json`

Commands dev/build/start/lint/typecheck/test; Next/React/Mongo runtime and ESLint/TypeScript/Vitest/Testing Library/jsdom development dependencies. No functions.

### `package-lock.json`

Reproducible npm dependency graph; Next resolves to 16.4.2 after compatible security refresh. No functions.

### `.env.example`

Optional MONGODB_URI configuration example; no credential values committed. No functions.

### `.gitignore`

Ignores node_modules, build outputs, local environment files, generated Next declarations and OS metadata. No functions.

### `AGENTS.md`

Repository AI behavior, documentation, authorization and local-commit/push instructions. No functions.

### `CLAUDE.md`

Pointer to AGENTS.md. No functions.

### `README.md`

Run/test instructions, three-day workflow, images, storage/history behavior and documentation links. No functions.

### `docs/architecture.md`

This complete file/function inventory, storage/runtime notes, environment variables and verification record. No functions.

### `docs/suggestions.md`

Dated implemented improvements, accepted risks and outstanding vulnerability/improvement log. No functions.

### `docs/exercise-images.md`

Imagegen provenance, full prompt set, targeted visual corrections, source references and individual-crop workflow. No functions.

### `docs/exercise-image-sources.json`

Every individual image ID, approved source atlas and exact pixel crop rectangle. Data only; no functions.

### `tests/workout.test.js`

Original logic/validation/cache/export suite (56 tests), updated for the replacement routine. Test helpers params/makeRequest construct URL/body fixtures; test callbacks cover data detection, units, request bounds/injection, identity migration, cache selection and pruning.

### `tests/program-refresh.test.js`

Program order/dosage, all individual assets, frozen legacy keys/collisions, archived export, completed cardio, progress/resume, calendar and history reconciliation tests. Helpers allItems/item select explicit fixtures.

### `tests/workout-input.test.js`

Partial decimals, bounded entry/stepping and atomic previous values. No named helper functions; describe/it callbacks are test cases.

### `tests/session-sync.test.js`

Debounce, serialized writes, stale response suppression, per-session independence, keepalive and recovery tests. deferred controls promise resolution; afterEach restores timers/mocks.

### `tests/session-api.test.js`

Real session handlers with mocked Mongo: rejection before DB access, normalized version-3 writes, exact-session clearing, local-only fallback, cloud reads and fixed error responses. request builds POST fixtures; beforeEach/afterEach reset mocks.

### `tests/components.test.jsx`

Real DOM input/guide tests: fractional typing, safe weight carry-forward, independent completion, previous-value copy, undoing removal, timed/bodyweight rows, single image loading/error, dialog dismissal and focus restoration. Entry and GuideTrigger are the stateful harnesses; beforeEach shims native dialogs; afterEach cleans up.

### `tests/page.test.jsx`

Daily resume integration tests for `WorkoutPage`: saved-progress restoration, one-time scrolling, rapid day switching, interaction cancellation and manual Next focus. `advance` flushes React work with the test clock; setup provides an isolated local cache, device-only fetch and DOM geometry; cleanup restores globals and timers.

## Individual exercise images

Each file below contains only its own exercise illustration. All are locally served and loaded only when the guide opens. Raster assets contain no functions.

| File | Purpose | Functions |
|---|---|---|
| `public/exercise-guides/ankle-inversion-eversion.webp` | Band ankle inversion + eversion — start/movement/hold reference | None |
| `public/exercise-guides/ankle-rocks.webp` | Ankle rocks — start/movement/hold reference | None |
| `public/exercise-guides/back-extension.webp` | Back Extension — start/movement/hold reference | None |
| `public/exercise-guides/band-external-rotation.webp` | Band external rotation — start/movement/hold reference | None |
| `public/exercise-guides/band-pull-apart.webp` | Band pull-aparts — start/movement/hold reference | None |
| `public/exercise-guides/bike-elliptical.webp` | Bike / elliptical — start/movement/hold reference | None |
| `public/exercise-guides/bird-dog.webp` | Bird Dog — start/movement/hold reference | None |
| `public/exercise-guides/bodyweight-squat.webp` | Bodyweight squats — start/movement/hold reference | None |
| `public/exercise-guides/bulgarian.webp` | Bulgarian Split Squat — start/movement/hold reference | None |
| `public/exercise-guides/cable-lateral.webp` | Cable Lateral Raise — start/movement/hold reference | None |
| `public/exercise-guides/calf-stretch.webp` | Calf stretch — start/movement/hold reference | None |
| `public/exercise-guides/child-side-reach.webp` | Child’s Pose + side reach — start/movement/hold reference | None |
| `public/exercise-guides/db-shrug.webp` | DB Shrug — start/movement/hold reference | None |
| `public/exercise-guides/dead-bug.webp` | Dead Bug — start/movement/hold reference | None |
| `public/exercise-guides/dead-hang.webp` | Dead hang — start/movement/hold reference | None |
| `public/exercise-guides/doorway-stretch.webp` | Doorway chest stretch — start/movement/hold reference | None |
| `public/exercise-guides/elephant-walk.webp` | Elephant walks — start/movement/hold reference | None |
| `public/exercise-guides/external-rotation.webp` | Cable/Band External Rotation — start/movement/hold reference | None |
| `public/exercise-guides/face-pull.webp` | Face Pull — start/movement/hold reference | None |
| `public/exercise-guides/farmer.webp` | Farmer Carry — start/movement/hold reference | None |
| `public/exercise-guides/flat-db-press.webp` | Flat DB Press — start/movement/hold reference | None |
| `public/exercise-guides/glute-bridge.webp` | Glute bridges — start/movement/hold reference | None |
| `public/exercise-guides/hack-squat.webp` | Hack Squat — start/movement/hold reference | None |
| `public/exercise-guides/hammer-curl.webp` | Hammer Curl — start/movement/hold reference | None |
| `public/exercise-guides/hamstring-stretch.webp` | Hamstring stretch — start/movement/hold reference | None |
| `public/exercise-guides/high-low-fly.webp` | High-to-Low Cable Fly — start/movement/hold reference | None |
| `public/exercise-guides/hip-90-90.webp` | 90/90 hip rotations — start/movement/hold reference | None |
| `public/exercise-guides/hip-abduction.webp` | Hip Abduction Machine — start/movement/hold reference | None |
| `public/exercise-guides/hip-adduction.webp` | Hip Adduction Machine — start/movement/hold reference | None |
| `public/exercise-guides/hip-flexor-stretch.webp` | Hip-flexor stretch — start/movement/hold reference | None |
| `public/exercise-guides/hip-thrust.webp` | Hip Thrust — start/movement/hold reference | None |
| `public/exercise-guides/incline-curl.webp` | Incline DB Curl — start/movement/hold reference | None |
| `public/exercise-guides/incline-db-press.webp` | Incline DB Press — start/movement/hold reference | None |
| `public/exercise-guides/incline-walk.webp` | Incline treadmill walk — start/movement/hold reference | None |
| `public/exercise-guides/internal-rotation.webp` | Cable/Band Internal Rotation — start/movement/hold reference | None |
| `public/exercise-guides/knee-raise.webp` | Hanging Knee Raise — start/movement/hold reference | None |
| `public/exercise-guides/landmine-press.webp` | Landmine Press — start/movement/hold reference | None |
| `public/exercise-guides/leg-curl.webp` | Leg Curl — start/movement/hold reference | None |
| `public/exercise-guides/leg-press.webp` | Leg Press — start/movement/hold reference | None |
| `public/exercise-guides/light-face-pull.webp` | Light band face pull — start/movement/hold reference | None |
| `public/exercise-guides/neck-isometrics.webp` | Neck isometrics — start/movement/hold reference | None |
| `public/exercise-guides/neutral-pulldown.webp` | Neutral-Grip Lat Pulldown — start/movement/hold reference | None |
| `public/exercise-guides/one-arm-cable-row.webp` | One-Arm Cable Row — start/movement/hold reference | None |
| `public/exercise-guides/overhead-triceps.webp` | Overhead Cable Triceps Extension — start/movement/hold reference | None |
| `public/exercise-guides/pallof.webp` | Pallof Press — start/movement/hold reference | None |
| `public/exercise-guides/pronation.webp` | DB Pronation/Supination — start/movement/hold reference | None |
| `public/exercise-guides/psoas.webp` | Seated Psoas March — start/movement/hold reference | None |
| `public/exercise-guides/pulldown-assisted.webp` | Lat Pulldown / Assisted Pull-Up — start/movement/hold reference | None |
| `public/exercise-guides/push-up-plus.webp` | Push-up Plus — start/movement/hold reference | None |
| `public/exercise-guides/rdl.webp` | Romanian Deadlift — start/movement/hold reference | None |
| `public/exercise-guides/reverse-cable-fly.webp` | Reverse Cable Fly — start/movement/hold reference | None |
| `public/exercise-guides/reverse-lunge.webp` | Reverse lunge — start/movement/hold reference | None |
| `public/exercise-guides/rope-pushdown.webp` | Rope Triceps Pushdown — start/movement/hold reference | None |
| `public/exercise-guides/seated-calf.webp` | Seated Calf Raise — start/movement/hold reference | None |
| `public/exercise-guides/seated-row.webp` | Seated Cable Row — start/movement/hold reference | None |
| `public/exercise-guides/short-foot.webp` | Short-foot / arch hold — start/movement/hold reference | None |
| `public/exercise-guides/side-plank.webp` | Side Plank — start/movement/hold reference | None |
| `public/exercise-guides/standing-calf.webp` | Standing Calf Raise — start/movement/hold reference | None |
| `public/exercise-guides/suitcase.webp` | Suitcase Carry — start/movement/hold reference | None |
| `public/exercise-guides/supported-row.webp` | Chest-Supported Row — start/movement/hold reference | None |
| `public/exercise-guides/thoracic-extension.webp` | Thoracic extension — start/movement/hold reference | None |
| `public/exercise-guides/tibialis.webp` | Tibialis Raise — start/movement/hold reference | None |
| `public/exercise-guides/treadmill-rower.webp` | Treadmill / rower — start/movement/hold reference | None |
| `public/exercise-guides/wall-slides.webp` | Wall slides — start/movement/hold reference | None |
| `public/exercise-guides/wrist-curl.webp` | Wrist Curl — start/movement/hold reference | None |
| `public/exercise-guides/y-raise.webp` | Cable/Prone Y-Raise — start/movement/hold reference | None |

## Approved source artwork

Preserved for reproducible trimming via `docs/exercise-image-sources.json`; not loaded by the app. No functions.

- `docs/exercise-atlases/arms-and-control.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/core.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/finish.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/lower-accessories-v2.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/lower-strength-v2.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/mobility.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/pull.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/push.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/resilience.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/upper-accessories.webp` — original approved six-exercise source sheet.
- `docs/exercise-atlases/warm-up.webp` — original approved six-exercise source sheet.

## Storage and program compatibility

- Program version 3 replaces the four-day routine. Current keys are stable day:id identities; old positional keys resolve against frozen historical metadata, not the new exercise order. Unmapped/colliding entries remain exportable.
- Cache key: workout_tracker_local_cache, schema 2, newest 400 snapshots. Empty versioned entries preserve clears during sync. Cloud history returns at most 60 active records; the client merges locally available records before export/display.
- Preferences: workout_tracker_weight_unit and workout_tracker_selected_day. Date defaults to the browser's current day after hydration. A removed/unknown remembered day is ignored.
- Reads cannot overwrite edits made while they were loading. Same-session writes are serialized. Saved status belongs only to the latest revision of the active session. Device failure does not prevent attempting cloud save; failure and retry remain visible.
- Auto-resume lands once after session loading and a 300 ms interaction grace period, without repeatedly jumping while entering data. The nested cancelAutomaticResume listener records pointer/keyboard/wheel/touch activity and cancels pending automatic scroll timers/frames so navigation or typing is not interrupted. Next opens the first unfinished section on demand, with smooth scrolling unless reduced motion is preferred. Set controls wrap without splitting button labels on phones. Images are absent from the default DOM and mount only in an accessible native dialog.

## Environment Variables

| Variable | Required? | Purpose | Referenced in |
|---|---|---|---|
| MONGODB_URI | No | Optional MongoDB connection for workout_tracker cloud sync/history; absent or unreachable uses the device-only API fallback | lib/mongodb.js:getDatabase/checkMongoStatus; .env.example |
| NODE_ENV | Framework-provided | Production/development CSP differences | next.config.mjs:isDev |

No image-generation key is required at runtime. There are no Manager or auth environment variables on main. Local environment values are never committed.

## Verification

Single entry point: `npm test` (95 tests across seven suites). The Vitest `next-page-jsx` plugin's `transform` handles Next's JSX-in-page.js convention using Vite's built-in Oxc transform so page integration tests run alongside component/API/helper tests. Also run `npm run lint`, `npm run typecheck` and `npm run build`. `npm audit --omit=dev` reports zero runtime vulnerabilities after the compatible dependency refresh. Five high development-tool dependency audit entries remain in the lint chain; see docs/suggestions.md.

Browser verification uses an isolated localhost origin with MONGODB_URI explicitly unset; tests do not write the real database. Verified: no default images, individually cropped guide rendering/dismissal and keyboard focus return, decimal entry, independent set completion, saved state after reload, automatic first-unchecked resume below sticky controls, quick day switching, manual Next focus, mobile layout and actual text export. Synthetic test entries were cleared through the UI. All 66 image files were decoded and checked against their registry dimensions. The development watcher hit a host open-file limit; production build/runtime are used for browser checks.
