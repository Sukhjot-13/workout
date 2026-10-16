# Workout Tracker

A personal, offline-first tracker for a three-day full-body program. Next.js App Router, React, plain JavaScript and CSS. MongoDB cloud sync is optional.

- Full Body A: squat, upper chest, back, arms, calves and core.
- Full Body B: unilateral strength, glutes, shoulders, hamstrings and posture.
- Full Body C: chest/back detail, arms, grip, core and a short resilience block.

The tracker resumes at the first unfinished exercise when a session opens. **Next ↓** stays in the sticky controls. Enter weights/reps and check each set; **Use last** applies the previous session's values. Timed holds use seconds. For per-side work, complete both sides before checking off a set.

Each exercise has an individual illustration and written cues behind **Form guide**. Images stay hidden and unloaded until opened. The 66 images were generated with the built-in imagegen tool, visually checked and trimmed from approved sheets; prompts and provenance are in [docs/exercise-images.md](docs/exercise-images.md).

## Run and verify

```sh
npm install
npm run dev
npm test
npm run lint
npm run typecheck
npm run build
npm start
```

`npm test` runs all pure logic, DOM component and API regression suites. Tests mock MongoDB and do not change real workout data. This is a JavaScript project; typecheck provides parsing/project checks with `checkJs: false`.

## Saving and history

Entries save immediately in this browser. Set `MONGODB_URI` in `.env.local` to enable the optional `workout_tracker` database sync. The UI distinguishes device-only, syncing, cloud and failure states. Export regularly to keep a backup; local history is capped at 400 snapshots.

The new program is version 3. The old fourth day is removed from workout selection. Historical logs remain intact: original positional identities are frozen, removed exercises are included in exports, and removed days download as archived sessions. Weights are recorded in the selected unit; changing the unit does not convert existing numbers.

This personal app retains its existing unauthenticated API model. The accepted access risk and outstanding development-tool audit findings are recorded in [docs/suggestions.md](docs/suggestions.md).

The complete file/function and environment-variable inventory is [docs/architecture.md](docs/architecture.md).
