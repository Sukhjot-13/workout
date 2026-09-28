# Lean Athletic Workout Tracker

A personal workout tracker: a 4-day program with progressive overload, session
history, and automatic cloud sync to MongoDB when `MONGODB_URI` is set. Without
it the tracker works fully offline on `localStorage`.

Built with Next.js 16 (App Router), React and Tailwind CSS. The project is
**plain JavaScript** — `jsconfig.json` with `allowJs` and `checkJs: false` — and
`npm run typecheck` runs `tsc -p jsconfig.json` as a syntax/scope check.

## Commands

```bash
npm run dev           # dev server
npm run build         # production build
npm start             # serve the production build
npm run lint          # eslint
npm run typecheck     # tsc -p jsconfig.json
npm test              # vitest (single runner for the whole suite)
npm run manager:check # live check of the Manager integration (below)
```

## Configuration

`MONGODB_URI` is optional — without it the app works fully offline on
`localStorage` and the API routes return their `mongoConnected: false` fallbacks.
See `.env.example` and `docs/architecture.md`.

## Manager integration (optional)

This app can send its server logs and page analytics to **Manager**, a personal
project control center. With no `MANAGER_*` variables set nothing changes: the
integration is a set of no-ops, so local development, CI and previews are
unaffected.

### What gets wired up

- **Server logs from the API routes and the database helper.** This app has no
  logging layer of its own, so `lib/manager/index.js` is the single entry point.
  `/api/session` logs its rejected reads/writes and both of its 500 paths,
  `/api/history` logs its 500 path, and `lib/mongodb.js` logs a failed
  `client.connect()`. Each call sits next to the `console.error` or response the
  route already produced — no behavioural change.
- **Unhandled crashes, console warnings/errors and failed fetches in the
  browser** are captured by the SDK.
- **Analytics**: one script tag is injected client-side, tracking pageviews
  (SPA navigations included), click targets, referrers and UTM params.

### Configuration

| Variable | Required for | Value |
|---|---|---|
| `MANAGER_ENDPOINT` | logs + analytics | base URL of the **Manager** deployment — not this app's own port |
| `MANAGER_APP_ID` | logs + analytics | project slug in Manager (`workout`) |
| `MANAGER_LOG_KEY` | logs | `mlk_…` (server) |
| `MANAGER_ANALYTICS_KEY` | analytics | `mak_…` |
| `MANAGER_LOG_SOURCE` | optional | `server` (default) or `client` |
| `NEXT_PUBLIC_MANAGER_ENDPOINT` | browser logs + analytics | same value as `MANAGER_ENDPOINT` |
| `NEXT_PUBLIC_MANAGER_APP_ID` | browser logs + analytics | same value as `MANAGER_APP_ID` |
| `NEXT_PUBLIC_MANAGER_CLIENT_KEY` | browser logs | `mck_…` client key |
| `NEXT_PUBLIC_MANAGER_ANALYTICS_KEY` | analytics | `mak_…` |

**The `NEXT_PUBLIC_` block is required for any browser logging or analytics,
not optional.** Next.js only inlines a *literal* `process.env.NEXT_PUBLIC_FOO`
member expression into the client bundle; `process.env` in browser code is an
empty object and a dynamic `process.env[name]` lookup is not inlined either. A
`'use client'` module reading `MANAGER_ENDPOINT` therefore always resolves to
undefined, and the browser logger and the analytics tag are silently never
started — while every test still passes. Use the project's **client** key
(`mck_…`) there: Manager derives each entry's `source` from the key kind, so
browser entries must carry the client key rather than the server key.

`MANAGER_ENDPOINT` is Manager's own base URL (`http://127.0.0.1:3300` for a
local Manager). It is easy to get backwards and point it at this app's dev port,
which makes every log POST fail silently.

Set the values in `.env.local` locally and in the Vercel project settings for
deployments. `.env.example` has the full annotated block; `.env.local` is
git-ignored and must never be committed.

### Content Security Policy

`next.config.mjs` extends the CSP's `connect-src` with
`NEXT_PUBLIC_MANAGER_ENDPOINT` — the browser logger and the analytics tracker
both need to reach that origin, and `connect-src 'self'` alone would block them
silently. The origin is added **only when the variable is set**, so with no
Manager configuration the assembled policy is byte-identical to the previous one
and the integration stays a true no-op. `script-src` needs no change: the
tracker tag is inserted by script, and `script-src` already allows `'self'` plus
the inline bootstrap Next emits.

### Refresh the vendored SDK

`lib/manager/logger.js` is the whole SDK in one file (zero dependencies). This
repo is plain JavaScript, so it vendors the `?format=js` build:

```bash
curl -fsSL -H "x-manager-key: $MANAGER_LOG_KEY" \
  "http://127.0.0.1:3300/api/sdk/logger?format=js" -o lib/manager/logger.js
```

The key is read from the `x-manager-key` header, never from a URL. Commit the
refreshed file so everyone gets the same version.

### Verify it works

```bash
npm run manager:check
# needs MANAGER_ENDPOINT, MANAGER_LOG_KEY, MANAGER_ANALYTICS_KEY
# and APP_ORIGIN pointing at a running `next start`
```

It posts one log with the server key, one with the client key and one event
with the analytics key; asserts that each wrong key kind is refused; then hits
this app's own rejection paths (`GET /api/session?date=nope` → 400 and
`POST /api/session` with a malformed body → 400) plus a success path. Anything
the app logs shows up under *Project → Logs* in Manager within a second or two.

The static-access guarantee is enforced by a test, not just by convention —
`tests/manager-integration.test.js` reads `lib/manager/index.js` and fails if
any `NEXT_PUBLIC_*` value stops being a literal member expression (bracket
notation fails too) or if the client block ever starts indexing `process.env`.
To see the real bundled values, build and grep `.next/static`.

### Delivery tuning

Server logs do **not** flush on every write. The facade sets the SDK's
`flushIntervalMs` to 250ms, so a burst of N log lines becomes one HTTP request
instead of N. The window is deliberately short: serverless runtimes can freeze
timers after a response is sent, which would strand anything still batched.

`error` and `fatal` skip the window with a leading-edge flush — sent
immediately, but no more than once per 100ms, with a trailing flush so a burst
of 50 errors costs ~2 requests rather than 50.

```bash
node scripts/measure-log-delivery.mjs 200
```

Current shape: **201/200 entries delivered, 0 dropped, 11 requests, 18.3
entries/request** at ~214 logs/s. (Flushing per entry instead measures ~96/200
delivered with 105 dropped across 20 requests — one HTTP request per line.)

No bundler is needed for that script: the facade is plain ESM and imports the
SDK with an explicit `"./logger.js"` specifier, so Node imports it directly.

## Known blocker (Manager-side, not fixable from this repo)

The browser analytics tracker cannot currently be loaded cross-origin from
Manager: Manager sends `Cross-Origin-Resource-Policy: same-origin` on every
route, including `/t.js`, and that is precisely the header a browser uses to
refuse a cross-origin `<script src>`. The tag is injected into the DOM
correctly, but the script never executes, so no pageview is sent. Server-side
log delivery is unaffected. A causal reproduction is in `docs/suggestions.md`.

## Documentation

`docs/architecture.md` (file + function inventory, env vars) ·
`docs/suggestions.md` (change log) · `CLAUDE.md` (repo guidance)
