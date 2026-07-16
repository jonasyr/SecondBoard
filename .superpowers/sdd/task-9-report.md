## Task 9: Final integration & verification sweep — Report

Branch: `iteration-5/engine-analysis` (ahead of origin by 3 commits including this sweep's fix commit).

### Step 1: Full JS/TS test suite — `pnpm run test -- --run`

Result: **PASS**

```
 Test Files  46 passed (46)
      Tests  181 passed (181)
   Start at  00:56:07
   Duration  9.11s
```

(Ran twice: once before the lint fixes, once after, to confirm nothing regressed. Both runs: 46/46 files, 181/181 tests passed. The only console noise is the same set of pre-existing svelte a11y/state warnings emitted by vite-plugin-svelte during collection — not test failures.)

### Step 2: Type/lint checks

`pnpm run check` (svelte-check) — Result: **PASS, 0 errors**

```
COMPLETED 467 FILES 0 ERRORS 15 WARNINGS 6 FILES_WITH_PROBLEMS
```

All 15 warnings are pre-existing from prior iterations:
- `MoveList.svelte` (2x) — click handler without keyboard handler / ARIA role (a11y)
- `Board.svelte` (3x) — `state_referenced_locally` on `ply`, `position`, `flipped`
- `NavControls.svelte` (1x) — button missing explicit label
- `ExploreTab.svelte` (2x) — click handler without keyboard handler / ARIA role
- `OnboardingScreen.svelte` (2x) — click handler without keyboard handler / ARIA role
- `TitleBar.svelte` (3x) — unknown CSS property `app-region`

No new warnings introduced; count and file set identical before and after the lint fix commit.

`pnpm run lint` (ESLint) — **Initial run found 4 real errors, now fixed (0 errors).**

Initial output:
```
ESLint: 4 errors, 0 warnings in 3 files
  src/lib/components/MoveList.svelte (2 issues): no-unused-vars (2)
  src/lib/components/AnalysisTab.svelte (1 issues): no-unused-vars (1)
  src/lib/components/OnboardingScreen.svelte (1 issues): svelte/no-useless-mustaches (1)
```

Root-caused and fixed (see "Fixes made" below). Re-run after fix:
```
./node_modules/.bin/eslint .   → 0 errors, 0 warnings (no output)
```

### Step 3: Full Rust test suite

`cd src-tauri && cargo test` (raw output via `cargo test -- --nocapture`, unfiltered):

```
running 10 tests
test engine::parse_tests::ignores_non_info_lines ... ok
test engine::parse_tests::ignores_info_lines_with_no_score_or_pv ... ok
test engine::parse_tests::parses_bestmove_with_ponder ... ok
test engine::parse_tests::parses_bestmove_without_ponder ... ok
test engine::parse_tests::parses_cp_score_and_pv ... ok
test engine::analyze_tests::errors_when_the_engine_binary_does_not_exist ... ok
test engine::parse_tests::parses_mate_score ... ok
test engine::parse_tests::rejects_non_bestmove_lines ... ok
test engine::analyze_tests::analyzes_the_starting_position_with_a_real_stockfish ... ok
test analyze_fen_tests::analyze_fen_command_delegates_to_the_engine_module ... ok

test result: ok. 10 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 1.23s
```

Plus 0 tests in `main.rs` unit tests and 0 doc-tests (both expected/no-op).

**Real-Stockfish confirmation**: `analyzes_the_starting_position_with_a_real_stockfish` reported `... ok` with **no "skipping analyze_position test: stockfish not found on PATH" message** in the `--nocapture` output — confirming `stockfish_available()` returned `true` and the test body actually executed `analyze_position` against a real engine (not the early-return skip branch). Verified separately:
```
$ which stockfish
/usr/bin/stockfish
$ stockfish
Stockfish 18 by the Stockfish developers (see AUTHORS file)
```
So the test genuinely spawned Stockfish 18, sent UCI commands, and asserted a plausible startpos eval (`|eval_cp| < 150`) and a 4-character best-move UCI string.

`cd src-tauri && cargo check` — Result: **PASS, 0 errors, 0 warnings**
```
    Checking app v0.1.0 (/home/jonas/Documents/Code/SecondBoard/src-tauri)
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 0.43s
```

### Step 4: Frontend build

`pnpm run build` — Result: **PASS**
```
✓ built in 247ms
...
✓ built in 2.00s
Using @sveltejs/adapter-static
  Wrote site to "build"
  ✔ done
```

### Step 5: Manual end-to-end smoke test with the dev server

**SKIPPED.** This is a headless environment with no display server / GUI available, so `pnpm run tauri dev` cannot open and be interacted with as a native window, and no browser is available to click through the Game Review screen. This step (navigating to Game Review, confirming the "Analyzing with Stockfish…" transient note, plausible/varying eval bar values, smooth eval updates while stepping plies with arrow keys, and no console errors from `analyze_fen`) must be performed manually by a human with a real display before this branch is considered fully verified end-to-end.

### Fixes made

One commit, `7844497` — "fix: resolve lint errors found in iteration 5 verification sweep":

1. **`eslint.config.js`**: The `.svelte` file block only added `@typescript-eslint/no-explicit-any` on top of `eslint:recommended`'s base `no-unused-vars` rule, unlike the `.ts` block which fully replaces it with the TypeScript-aware rule set. The base rule doesn't understand TypeScript function-type syntax and was flagging parameter names inside `Props` interface function-type members (e.g. `onSelectPly: (ply: number) => void`) as "unused," even though `ply` was genuinely used inside the callback bodies. Reproduced this in isolation with a minimal `.svelte` file before fixing, confirming it's a config gap, not a real code issue. Fix: disable base `no-unused-vars` and enable `@typescript-eslint/no-unused-vars` for `.svelte` files, mirroring the `.ts`/`.svelte.ts` blocks.
2. **`MoveList.svelte`**: removed a genuinely unused `import { tick } from 'svelte'`.
3. **`OnboardingScreen.svelte`**: replaced a `placeholder={'...'}` mustache wrapping a plain string literal with a direct string attribute (entity-escaping the embedded quotes/newlines) to satisfy `svelte/no-useless-mustaches`.

All three were verified with a full `pnpm run lint` (0 errors/warnings), a full `pnpm run check` (0 errors, same 15 pre-existing warnings), and a full `pnpm run test -- --run` (181/181 still passing) after the fix, before committing.

Unrelated pre-existing uncommitted changes in the working tree (`.gitignore` sonarlint entry, `.superpowers/sdd/task-4-brief.md`, `.superpowers/sdd/task-4-report.md`, `.superpowers/sdd/task-5-brief.md`, `.vscode/settings.json`, `pnpm-lock.yaml`) were left untouched and NOT included in the fix commit — they predate this task and are out of scope.

### Self-review

- Every command above was actually executed and its real stdout/stderr inspected (not assumed) — including a second, unfiltered raw run via `cargo test -- --nocapture` (and `rtk proxy`) specifically to verify the real-Stockfish test line-by-line, since the default `rtk`-filtered summary only showed an aggregate pass count.
- The 4 ESLint errors were not rationalized away — they were root-caused (a config gap that caused a false positive on 3 of the 4, plus one genuinely unused import and one genuine style violation) and fixed at the source, then reverified with a clean full-repo lint run.
- The 15 svelte-check warnings and the vite-plugin-svelte a11y/state warnings surfaced during test runs are pre-existing from prior iterations (same files, same rule IDs, same counts before and after this task's changes) — confirmed not to be new.
- Step 5 (manual GUI dev-server smoke test) was not attempted at all, not attempted-and-declared-fine — it is explicitly out of reach in this headless sandbox (no display server, no way to launch or screenshot a native Tauri window or browser) and is flagged above as an outstanding manual verification item.

---

## Follow-up: Important finding fix — bound concurrent Stockfish process spawning

### What changed and why

`loadRealAnalysis()` in `src/lib/game/engine-analysis.ts` previously did `Promise.all(MOCK_POSITIONS.map(...))`, firing all 31 `analyzeFen` calls simultaneously. Each call spawns a distinct real Stockfish process (`src-tauri/src/engine.rs`'s `analyze_position`) configured with 256MB hash and `max(1, logical_cpus - 1)` threads. At peak this was ~31 × 256MB ≈ 8GB of hash allocation plus heavy thread contention — fine on the dev machine, but a real OOM/thrashing risk on more modest hardware (e.g. 8-core/16GB laptops). No existing test exercised this because all tests mock `analyzeFen` and never spawn real processes.

Fix is scoped entirely to `src/lib/game/engine-analysis.ts` — no changes to `src-tauri/src/engine.rs`, `notation.ts`, or `api/engine.ts`, and no change to the `RealAnalysis` shape or the mate-sign logic.

### The batching approach

Added a small order-preserving concurrency-limiter and used it in place of the bare `Promise.all`:

```ts
const ANALYSIS_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	for (let start = 0; start < items.length; start += limit) {
		const batch = items.slice(start, start + limit);
		const batchResults = await Promise.all(
			batch.map((item, offset) => fn(item, start + offset))
		);
		batchResults.forEach((result, offset) => {
			results[start + offset] = result;
		});
	}
	return results;
}

// in loadRealAnalysis():
const results = await mapWithConcurrency(MOCK_POSITIONS, ANALYSIS_CONCURRENCY, (position, ply) =>
	analyzeFen(positionToFen(position, sideToMoveForPly(ply), fullmoveNumberForPly(ply)))
);
```

Each batch of 4 positions is dispatched together and fully resolved (via `Promise.all` on just that batch) before the next batch starts, capping simultaneous Stockfish processes at 4 (~1GB hash, 4×(cores-1) threads) instead of 31. Results are written into a pre-sized array at their absolute index (`start + offset`), so ordering is independent of batch boundaries or which call in a batch resolves first.

### Test added

New test in `src/lib/game/engine-analysis.test.ts`: `'bounds concurrent analyzeFen calls to 4 in-flight at a time, preserving result order'`. It mocks `analyzeFen` to increment an `inFlight` counter on entry, yield two microtask turns (so same-batch calls genuinely overlap without relying on real timers/fake timers), then decrement and resolve with a result tagged by the FEN's fullmove-number field. After calling `loadRealAnalysis()`, it asserts:
- `maxInFlight <= 4` (the concurrency bound is respected)
- `maxInFlight > 1` (sanity check that calls do overlap within a batch, so the test isn't vacuously passing under fully-serial execution)
- every `evalPerPly[ply]` matches the fullmove-number/side-to-move-derived value expected for that specific ply — i.e., result `i` really came from calling `fn` on `MOCK_POSITIONS[i]`, not some other position via a reordering bug.

### Test results

Focused run — `pnpm vitest run src/lib/game/engine-analysis.test.ts`:
```
Test Files  1 passed (1)
     Tests  6 passed (6)
```
(5 pre-existing tests unmodified and passing, plus the 1 new concurrency test.)

Full suite — `pnpm run test -- --run`:
```
Test Files  46 passed (46)
     Tests  182 passed (182)
```
No regressions; the only console output is the same pre-existing svelte a11y/state-referenced-locally warnings noted earlier in this report (unrelated to this change).

### Ordering confirmation

Self-reviewed the batching logic directly: `results` is allocated up front as `new Array(items.length)`, and every write goes to `results[start + offset]` where `start` is the batch's absolute starting index and `offset` is the item's position within `batch.map(...)`'s own callback — so `offset` always matches the item's position in the slice regardless of resolution order (Array.prototype.map's callback offset is positional, not resolution-order-based). This guarantees `results[i]` corresponds to `MOCK_POSITIONS[i]` for every `i`, exactly preserving the invariant `loadRealAnalysis` depends on for `results[ply]` ↔ `MOCK_POSITIONS[ply]`. The new test's per-ply assertion loop over the full `evalPerPly` array independently confirms this holds for all 31 plies, not just a couple of samples.

### Commit

`3abe1e5` — "fix: bound concurrent Stockfish process spawning in loadRealAnalysis"
