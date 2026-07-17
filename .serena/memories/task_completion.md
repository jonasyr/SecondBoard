# Task completion checklist

Before considering a frontend change done:
1. `pnpm exec vitest run` (or targeted file) — all tests green, including new/updated tests for the change.
2. `pnpm check` — svelte-check/tsc clean.
3. `pnpm lint` — no new ESLint errors.
4. If Rust (`src-tauri/`) touched: `cargo test` and `cargo check` inside `src-tauri/`.
5. If behavior is visually/interactively verifiable and the `run`/`verify` skill is available, actually drive the app (`pnpm exec tauri dev`) rather than only trusting unit tests for UI changes — this project has caught real regressions (see commit `927b47c fix: real PGN player names/ratings, move-highlight, eval bar and captured-piece visibility`) that unit tests alone missed.
6. Follow the repo's SDD ledger habit if working inside an iteration: task brief → implementation → task report under `.superpowers/sdd/`, per `mem:core`.
