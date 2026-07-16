## Task 7: Final integration & verification sweep

**Files:** none created — this task runs the full verification suite and fixes anything it finds; any fix commits are additional to this task.

**Interfaces:** none new — this task only verifies Tasks 1-6 integrate cleanly.

- [ ] **Step 1: Full JS/TS test suite**

Run: `pnpm run test -- --run`
Expected: all test files pass, 0 failures.

- [ ] **Step 2: Type/lint checks**

Run: `pnpm run check`
Expected: 0 errors (pre-existing a11y/state-reference warnings from prior iterations are fine; no new errors).

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 3: Full Rust test suite**

Run: `cd src-tauri && cargo test 2>&1 | tail -60`
Expected: all tests pass (Task 1's `pgn` module tests + Task 2's command tests + all of Iteration 5's `engine`/`analyze_fen` tests, including the real-Stockfish test — confirm it still runs for real, not skipped).

Run: `cd src-tauri && cargo check 2>&1 | tail -20`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Frontend build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual end-to-end smoke test (documented limitation)**

This is a headless sandbox with no display server — a native Tauri window cannot be opened here (same limitation as Iteration 5). Do NOT attempt `pnpm tauri dev`. Instead, record in the ledger that a human with a real display should verify, before merging:
- The sample game ("Paste sample game" → "Start Review") still looks and behaves pixel-identical to before this iteration (classification badges, coach text, breakdown/phase tables all present, since `isSample` is true for it).
- Pasting a DIFFERENT valid PGN (any real game) and clicking "Start Review" shows the real moves/positions with no classification badges and the `UNCLASSIFIED_COACH_TEXT` message, and move navigation (arrow keys, First/Prev/Next/Last) works across its real move count.
- Typing garbage text and clicking "Start Review" shows the new parse-error banner and stays on the onboarding screen.

- [ ] **Step 6: Update the ledger**

Append to `.superpowers/sdd/progress.md`:

```
---
Iteration 6 (PGN parse via shakmaty + move navigation):
Task 1: complete (...)
...
Final verification sweep: complete (lint/check/test/build all pass; cargo test passes including the real-Stockfish test from Iteration 5 and the new pgn module's regression tests against the known sample game; manual GUI PGN-paste smoke test could not be run in this headless sandbox — flagged for the user to verify with a real display).
```

(Fill in actual commit ranges per task as they land — this is a template, not literal ledger text to copy verbatim.)

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification sweep for iteration 6"
```

(Skip this step entirely if Steps 1-4 found nothing to fix.)
