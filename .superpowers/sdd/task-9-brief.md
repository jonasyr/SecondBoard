## Task 9: Final integration & verification sweep

**Files:** none created — this task runs the full verification suite and fixes anything it finds; any fix commits are additional to this task.

**Interfaces:** none new — this task only verifies Tasks 1-8 integrate cleanly.

- [ ] **Step 1: Full JS/TS test suite**

Run: `pnpm run test -- --run`
Expected: all test files pass, 0 failures.

- [ ] **Step 2: Type/lint checks**

Run: `pnpm run check`
Expected: 0 errors (the same pre-existing a11y warnings from prior iterations are fine; no new errors).

Run: `pnpm run lint`
Expected: 0 errors.

- [ ] **Step 3: Full Rust test suite**

Run: `cd src-tauri && cargo test 2>&1 | tail -40`
Expected: all tests pass (the real-Stockfish test in `engine.rs` should genuinely run, not skip, on this machine — confirm its output does not contain "skipping").

Run: `cd src-tauri && cargo check 2>&1 | tail -20`
Expected: 0 errors, 0 warnings.

- [ ] **Step 4: Frontend build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 5: Manual end-to-end smoke test with the dev server**

Run: `pnpm run tauri dev` (or `pnpm run dev` + open the app shell, whichever this repo's existing dev workflow uses — check `package.json` scripts first)

In the running app: navigate to the Game Review screen (paste-sample → Start Review). Confirm:
- The "Analyzing with Stockfish…" note appears briefly on the Analysis tab, then disappears.
- The eval bar/eval graph show plausible values (not all zero, not identical across every ply).
- Stepping through plies with the arrow keys updates the eval bar smoothly.
- No console errors from `analyze_fen` invocations (open devtools).

Record the outcome (pass/fail + any observations) in the ledger entry for this task — this is a manual check an automated reviewer cannot perform, same as prior iterations' native-build verification steps.

- [ ] **Step 6: Update the ledger**

Append to `.superpowers/sdd/progress.md`:

```
---
Iteration 5 (Rust analyze_fen + Stockfish UCI):
Task 1: complete (...)
...
Final verification sweep: complete (lint/check/test/build all pass; cargo test passes with a real Stockfish 18 binary exercised; manual dev-server smoke test confirmed real eval/best-move data renders on the Game Review screen).
```

(Fill in actual commit ranges per task as they land — this is a template, not literal ledger text to copy verbatim.)

- [ ] **Step 7: Commit any final fixes**

```bash
git add -A
git commit -m "chore: final verification sweep for iteration 5"
```

(Skip this step entirely if Steps 1-5 found nothing to fix.)
