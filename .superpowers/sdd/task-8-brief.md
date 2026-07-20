## Task 8: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full Rust test suite**

Run: `cd src-tauri && cargo test`
Expected: PASS, 0 failures (real-engine WDL tests self-skip with a message if Stockfish isn't on `PATH`, matching the existing pattern for other real-engine tests in this repo).

- [ ] **Step 2: Run the full frontend test suite**

Run: `pnpm exec vitest run` (or `rtk proxy pnpm exec vitest run` if the plain command truncates/garbles output on this machine)
Expected: PASS, 0 failures.

- [ ] **Step 3: Run typecheck, lint, and build**

Run: `pnpm check`
Run: `pnpm lint`
Run: `pnpm build`
Expected: all clean/succeed. In particular, confirm no unused-import lint errors from any file whose imports changed in this plan (`classify.ts`'s `winPercentFromEval` import was replaced with `winPercentForPly`, etc.).

- [ ] **Step 4: Launch the real app and visually confirm**

Run: `pnpm exec tauri dev`

Confirm, against the built-in sample game once analysis finishes:
1. The Review tab's Accuracy block still renders real, non-"—" numbers for both sides (WDL should make them at least as accurate as before, not break the display).
2. No regression in the move list / eval graph / coach card from the prior iteration's move-classification work — this iteration only changes the *input* to the same formulas, not their consumers.

Report any visual mismatch as a follow-up fix — do not silently accept a mismatch.
