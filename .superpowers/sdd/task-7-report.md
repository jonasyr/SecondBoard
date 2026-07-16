# Task 7 Report: Final integration & verification sweep (Iteration 6)

Scope per `task-7-brief.md`: run the full verification suite across Tasks 1-6 of
Iteration 6 (PGN parsing via shakmaty + move navigation), fix anything it finds,
update the ledger, and note the documented headless-sandbox limitation for the
manual GUI smoke test.

## Step 1: Full JS/TS test suite

Command: `pnpm run test -- --run`

First run (before any fix): **1 failed | 45 passed (46 files)**, **185 passed | 1
failed (186 tests)**. The single failure was the pre-flagged regression in
`src/lib/components/OnboardingScreen.test.ts` ("Start Review" loads the game
regardless of textarea contents), tracked forward explicitly in Task 4's and
Task 5's ledger entries as "Task 7's final sweep" work.

Root cause: `startReview()` (in `app-state.svelte.ts`) became `async` back in
Task 4 and now calls the real `parsePgn()`, which invokes the Tauri `parse_pgn`
command via `@tauri-apps/api/core`'s `invoke`. `OnboardingScreen.test.ts` renders
the real component and clicks "Start Review" without mocking `$lib/api/pgn`, so
in the jsdom test environment (no `__TAURI_INTERNALS__`) the real `invoke` call
rejects, `startReview()`'s catch block sets `parseError` instead of
`gameLoaded = true`, and the assertion `expect(appState.gameLoaded).toBe(true)`
failed.

Fix (test-only, no production code touched): mirrored the existing
`vi.hoisted` + `vi.mock('$lib/api/pgn', ...)` / `vi.mock('$lib/game/engine-analysis', ...)`
pattern already used in `src/lib/stores/app-state.test.ts`. Added mocks for
`parsePgn` (resolves a 31-ply fixture matching the pre-existing MAX_PLY=31
convention used across the other test files) and `loadRealAnalysis` (resolves
an empty analysis) to `OnboardingScreen.test.ts`'s `beforeEach`, so the
component's real async `startReview()` flow resolves deterministically instead
of hitting a real (and, in this headless/no-Tauri-context sandbox, always-
rejecting) `invoke`.

File changed: `src/lib/components/OnboardingScreen.test.ts`

Re-run after fix: **46/46 test files passed, 186/186 tests passed.** (One
interim run showed `GameReviewScreen.test.ts` timing out at 5000ms under
machine load while a background Stockfish install was also downloading/
extracting concurrently — reran clean immediately after; not a real bug, a
resource-contention flake in this sandbox.)

## Step 2: Type/lint checks

- `pnpm run check`: **0 errors, 15 warnings, 6 files with problems** — all 15
  warnings are the same pre-existing a11y (`MoveList.svelte`, `Board.svelte`
  state-referenced-locally, `NavControls.svelte`, `ExploreTab.svelte`,
  `OnboardingScreen.svelte`, `TitleBar.svelte` `app-region`) warnings called
  out as acceptable in the brief. No new errors or warnings introduced.
- `pnpm run lint`: **0 errors** (ESLint exit code 0).

## Step 3: Full Rust test suite

Command: `cd src-tauri && cargo test`

Initial run (this sandbox's stock PATH had no `stockfish` binary): **20 passed,
0 failed**, but `engine::analyze_tests::analyzes_the_starting_position_with_a_real_stockfish`
printed `skipping analyze_position test: stockfish not found on PATH` and
returned early without exercising the real engine — the whole suite finished
in a suspicious 0.02s. This violates the brief's explicit requirement that the
real-Stockfish test "still runs for real, not skipped."

Fix (environment, not code): installed Stockfish via `winget install
Stockfish.Stockfish` (18.0, resolves via the existing winget/choco tooling
already present in this sandbox — network access confirmed available). The
installed binary is named `stockfish-windows-x86-64-avx2.exe`; the Rust test
hardcodes `Command::new("stockfish")`, which on Windows requires an exact
`stockfish.exe` on `PATH`. Copied the installed exe to `stockfish.exe` in the
same already-PATH'd winget package directory
(`%LOCALAPPDATA%\Microsoft\WinGet\Packages\Stockfish.Stockfish_...\stockfish\`)
so `Command::new("stockfish")` resolves without any source change. This is a
one-time local-machine setup step, not a repo change — nothing under
`src-tauri/` was modified for this.

Re-run with the refreshed PATH: **20 passed, 0 failed, 0 ignored**, suite
duration **5.53s** (vs 0.02s before) — the `skipping` line is gone and
`analyzes_the_starting_position_with_a_real_stockfish` genuinely spawned and
queried a real Stockfish 18 process. Full pass list includes Task 1's 8 `pgn`
module tests (`starting_position_is_the_standard_setup`,
`after_ply_1_white_pawn_is_on_e4_not_e2`,
`white_kingside_castle_moves_both_king_and_rook_and_reports_king_squares`,
`black_queenside_castle_also_computes_the_correct_king_destination`,
`parses_the_full_sample_game_san_list`, `final_position_matches_the_last_move_ne5`,
`rejects_a_pgn_with_no_movetext`, `rejects_malformed_pgn_with_an_illegal_move`),
Task 2's 2 `parse_pgn_tests` command tests, and Iteration 5's 10 `engine`/
`analyze_fen_tests` tests (7 UCI line-parsing tests, 2 `analyze_tests`
including the real-engine one, 1 `analyze_fen_command_delegates_to_the_engine_module`).

`cargo check`: **0 warnings, 0 errors**, finished in 46.36s.

## Step 4: Frontend build

Command: `pnpm run build` — **succeeded** (`✓ built in 16.34s`, `adapter-static`
wrote the site to `build`, no errors).

## Step 5: Manual end-to-end smoke test (documented limitation)

Not run, as directed. This is a headless sandbox with no display server — a
native Tauri window cannot be opened here (same limitation documented in
Iteration 5's Task 9 sweep). `pnpm tauri dev` was **not** attempted. A human
with a real display must verify before merging:

1. The sample game ("Paste sample game" -> "Start Review") still looks and
   behaves pixel-identical to before this iteration (classification badges,
   coach text, breakdown/phase tables all present, since `isSample` is `true`
   for it).
2. Pasting a **different** valid PGN and clicking "Start Review" shows the
   real moves/positions with no classification badges and the
   `UNCLASSIFIED_COACH_TEXT` message, and move navigation (arrow keys,
   First/Prev/Next/Last) works across its real move count.
3. Typing garbage text and clicking "Start Review" shows the new parse-error
   banner and stays on the onboarding screen.

## Summary of bugs found and fixed

1. **Real bug (test-only), root cause fixed**: `OnboardingScreen.test.ts` was
   exercising `startReview()`'s real async `parsePgn`/`invoke` path with no
   Tauri context, causing a deterministic failure. Fixed by mocking
   `$lib/api/pgn` and `$lib/game/engine-analysis`, consistent with the existing
   pattern in `app-state.test.ts`. No production code changed — this was purely
   a test needing to catch up with Task 4's async `startReview()` change, as
   flagged in advance by Task 4's own ledger entry.
2. **Environment gap (not a code bug)**: this sandbox had no `stockfish` binary
   on `PATH`, so the Iteration-5 real-engine Rust test was silently
   short-circuiting via its own `stockfish_available()` guard instead of
   genuinely failing — a false "pass" that would have hidden a real engine
   regression. Installed Stockfish 18 via winget and placed a `stockfish.exe`
   shim on `PATH` so the test now genuinely spawns and queries the real
   engine. No source change.

## Ledger line appended

Appended to `.superpowers/sdd/progress.md` under the Iteration 6 section:

```
Final verification sweep: complete (JS/TS suite 46/46 files, 186/186 tests pass after fixing OnboardingScreen.test.ts's pre-flagged async-startReview mock gap (Task 4/5 tracked-forward item; test-only fix, mirrors app-state.test.ts's existing parsePgn/loadRealAnalysis mock pattern); pnpm run check 0 errors/15 pre-existing warnings; pnpm run lint 0 errors; cargo test 20/20 pass including Task 1's 8 pgn-module tests and Iteration 5's real-Stockfish integration test -- the latter was silently short-circuiting in this sandbox for lack of a stockfish binary on PATH (a genuine environment gap, not a code bug) until Stockfish 18 was installed via winget and PATH-linked, after which the suite took 5.53s instead of 0.02s, confirming the real engine was genuinely exercised; cargo check 0 warnings; pnpm run build succeeds; manual GUI PGN-paste smoke test (Step 5) could not be run in this headless sandbox -- flagged for the user to verify with a real display before merging).
```

## Commit(s)

This report, the ledger update, the `OnboardingScreen.test.ts` fix, and two
pre-existing uncommitted documentation updates from Task 6's session
(`task-6-report.md`'s SAN_LIST fix write-up and this task's own
`task-7-brief.md`, both already reflecting real, previously-landed work but
never committed) were all committed together. See the final assistant reply
for the exact commit hash.
