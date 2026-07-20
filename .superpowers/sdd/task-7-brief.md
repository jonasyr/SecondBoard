## Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend test suite**

Run: `pnpm exec vitest run`
Expected: PASS, 0 failures.

- [ ] **Step 2: Run typecheck and lint**

Run: `pnpm check`
Run: `pnpm lint`
Expected: both clean. In particular, confirm no remaining unused-import lint errors for `CLASS_CODES` in `MoveList.svelte`, `ReviewTab.svelte`, or `BottomBar.svelte` — Task 4/6 removed all three imports.

- [ ] **Step 3: Confirm `mock-data.ts`'s `CLASS_CODES` export is still used**

Run: `grep -rn "CLASS_CODES" src/lib`
Expected: only remaining references are `mock-data.ts` (the export itself), `mock-data.test.ts` (its own unit test), and `review.ts` (the default-parameter fallback for `getReviewPly`'s `classCodes` argument, kept intentionally so existing callers that don't pass a 5th argument — e.g. any test still calling `getReviewPly(ply, game)` with only 2 args — keep working). If any other file still imports `CLASS_CODES` directly, that's a missed call site from Tasks 4-6 — fix it before proceeding.

- [ ] **Step 4: Launch the real app and visually confirm**

Run: `pnpm exec tauri dev`

Confirm, against the built-in sample game once analysis finishes:
1. The Analysis tab's move list shows a classification badge on every move (not just the ones the old mock happened to cover), and the badges' colors match the eval swings shown in the eval graph.
2. Paste a different, non-sample PGN via "New PGN" — confirm its move list also gets real classification badges once analysis completes (previously it showed none at all).
3. While analysis is still loading (briefly, right after pasting), confirm no misleading "all Best" badges flash before real analysis lands — the move list and eval graph should show no badges until `analysisStatus` reaches `'ready'`.

Report any visual mismatch as a follow-up fix — do not silently accept a mismatch.
