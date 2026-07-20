## Task 5: `GameReviewScreen.svelte` — real classification for the board arrow/highlight

**Files:**
- Modify: `src/lib/components/GameReviewScreen.svelte`
- Test: `src/lib/components/GameReviewScreen.test.ts` (check existing coverage; add if missing)

**Interfaces:**
- Consumes: `appState.classCodes: ClassCode[]` (Task 2); `getReviewPly`'s new 5th parameter (Task 3).

- [ ] **Step 1: Check the existing test file for classification coverage**

Run: `pnpm exec vitest run src/lib/components/GameReviewScreen.test.ts` (before any change) to confirm the current baseline passes. Read the file's fixtures; if it already sets `appState.classCodes` or asserts on `data.classCode`/`Board`'s `classCode` prop, note the exact assertion so Step 3 doesn't break it. If it does not reference classification at all (the most likely case, since the board-arrow `classCode` prop was previously always `null` for non-sample games and this file's fixtures use a non-sample-shaped game), no test changes are needed for this task — the existing tests remain valid black-box assertions that don't inspect `classCode` at all.

- [ ] **Step 2: Update `GameReviewScreen.svelte` to pass real `classCodes` through**

Modify the `data` derivation in `src/lib/components/GameReviewScreen.svelte`:

```typescript
	const data = $derived(
		getReviewPly(appState.ply, appState.game!, appState.evalPerPly, appState.bestMoves, appState.classCodes)
	);
```

(No other changes — `data.classCode` already flows into `<Board classCode={data.classCode} ... />` unchanged.)

- [ ] **Step 3: Run tests to verify nothing broke**

Run: `pnpm exec vitest run src/lib/components/GameReviewScreen.test.ts`
Expected: PASS — unchanged (this task only widens what `data.classCode` can be; it does not change any currently-asserted behavior).

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/GameReviewScreen.svelte
git commit -m "feat: GameReviewScreen's board arrow uses real classCodes"
```

---

