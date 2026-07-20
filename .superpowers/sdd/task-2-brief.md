## Task 2: TS API + store — thread `result` through to `GameData`

**Files:**
- Modify: `src/lib/api/pgn.ts`
- Modify: `src/lib/game/review.ts` (only the `GameData` interface, lines 19-28)
- Modify: `src/lib/stores/app-state.svelte.ts` (only the `startReview` object literal, lines 77-86)
- Modify: `src/lib/game/review.test.ts` (fixture objects, add `result: null` to `sampleGame`/`notSampleGame`)
- Test: `src/lib/stores/app-state.test.ts` (add one new test)

**Interfaces:**
- Consumes: `pgn::ParsedGame.result: Option<String>` from Task 1 (deserializes as `string | null` via Tauri's `invoke`).
- Produces: `GameData.result: string | null` — consumed by Task 4's `getAccuracySummary`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/stores/app-state.test.ts`, in the same `describe` block as the other `startReview` tests (follow the existing pattern at the file's PGN-parsing tests, using the same `parsePgn.mockResolvedValue`/`loadRealAnalysis.mockResolvedValue` setup already used there):

```typescript
	it('threads the parsed Result tag into game.result', async () => {
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }],
			result: '1-0'
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(appState.game!.result).toBe('1-0');
	});

	it('defaults game.result to null when the PGN has no Result tag', async () => {
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

		await startReview();

		expect(appState.game!.result).toBeNull();
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `appState.game!.result` is `undefined`, not `'1-0'`/`null` (property doesn't exist yet on the assigned object; TypeScript would also fail `pnpm check` at this point, which is expected mid-task).

- [ ] **Step 3: Add `result` to `ParsedGame`, `GameData`, and the `startReview` assignment**

In `src/lib/api/pgn.ts`, modify `ParsedGame`:

```typescript
export interface ParsedGame {
	sanList: string[];
	positions: Position[];
	moves: Move[];
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}
```

In `src/lib/game/review.ts`, modify `GameData`:

```typescript
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}
```

In `src/lib/stores/app-state.svelte.ts`, modify the object literal inside `startReview`:

```typescript
		appState.game = {
			sanList: parsed.sanList,
			positions: parsed.positions,
			moveMeta: parsed.moves,
			isSample: pgnToParse.trim() === SAMPLE_PGN.trim(),
			whiteName: parsed.whiteName,
			blackName: parsed.blackName,
			whiteRating: parsed.whiteRating,
			blackRating: parsed.blackRating,
			result: parsed.result ?? null
		};
```

- [ ] **Step 4: Fix now-broken `GameData` fixtures**

In `src/lib/game/review.test.ts`, add `result: null` to both `sampleGame` (after `blackRating: null,` around line 24) and `notSampleGame` (after `blackRating: null,` around line 38), and to the `realGame` spread-fixture inside the `'uses real PGN White/Black/*Elo tags...'` test — since it uses `...notSampleGame`, it inherits `result: null` automatically and needs no direct edit.

Also check `src/lib/components/AnalysisTab.test.ts`'s `appState.game = {...}` fixture (lines 21-30) and add `result: null` after `blackRating: null,`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/AnalysisTab.test.ts`
Expected: PASS — all green.

Run: `pnpm check`
Expected: no new TypeScript errors (the `ParsedGame`/`GameData` shapes now agree end-to-end).

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/pgn.ts src/lib/game/review.ts src/lib/stores/app-state.svelte.ts src/lib/game/review.test.ts src/lib/stores/app-state.test.ts src/lib/components/AnalysisTab.test.ts
git commit -m "feat: thread the PGN Result tag into GameData.result"
```

---

