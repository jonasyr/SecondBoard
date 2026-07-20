### Task 3: Compute `secondEvalPerPly`/`secondWdlPerPly` in `engine-analysis.ts`

**Files:**
- Modify: `src/lib/game/engine-analysis.ts`
- Test: `src/lib/game/engine-analysis.test.ts`

**Interfaces:**
- Consumes: `AnalyzeFenResult.secondEvalCp/secondIsMate/secondWdl` (Task 2).
- Produces: `RealAnalysis.secondEvalPerPly: (number | null)[]`, `RealAnalysis.secondWdlPerPly: (Wdl | null)[]` — both White-POV, same per-ply indexing and flip convention as `evalPerPly`/`wdlPerPly`.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/engine-analysis.test.ts` (inside the existing `describe('loadRealAnalysis', ...)`, after the `'reports null wdlPerPly entries...'` test):
```typescript
	it('produces one secondEvalPerPly entry per position, normalized to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 50,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null,
			secondEvalCp: 20,
			secondIsMate: false,
			secondWdl: null
		}));

		const { secondEvalPerPly } = await loadRealAnalysis(testPositions);

		expect(secondEvalPerPly).toHaveLength(testPositions.length);
		expect(secondEvalPerPly[0]).toBeCloseTo(0.2); // ply 0: White to move, +20cp -> +0.20 White POV
		expect(secondEvalPerPly[1]).toBeCloseTo(-0.2); // ply 1: Black to move, +20cp for Black -> -0.20 White POV
	});

	it('reports a null secondEvalPerPly entry when the engine reported no second PV line', async () => {
		analyzeFen.mockResolvedValue({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null,
			secondEvalCp: null,
			secondIsMate: false,
			secondWdl: null
		});

		const { secondEvalPerPly } = await loadRealAnalysis(testPositions);

		expect(secondEvalPerPly.every((e) => e === null)).toBe(true);
	});

	it('produces one secondWdlPerPly entry per position, flipped to White POV', async () => {
		analyzeFen.mockImplementation(async () => ({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null,
			secondEvalCp: 0,
			secondIsMate: false,
			secondWdl: [600, 300, 100]
		}));

		const { secondWdlPerPly } = await loadRealAnalysis(testPositions);

		expect(secondWdlPerPly[0]).toEqual([600, 300, 100]); // ply 0: White to move, no flip
		expect(secondWdlPerPly[1]).toEqual([100, 300, 600]); // ply 1: Black to move, w/l swap
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: FAIL — `secondEvalPerPly`/`secondWdlPerPly` are `undefined` (not yet produced by `loadRealAnalysis`).

- [ ] **Step 3: Implement**

Current code in `src/lib/game/engine-analysis.ts`:
```typescript
export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
}
```
Replace with:
```typescript
export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
}
```

Current code:
```typescript
	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
```
Replace with:
```typescript
	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const secondEvalPerPly = results.map((r, ply) =>
		r.secondEvalCp === null ? null : toWhitePovEval(r.secondEvalCp, sideToMoveForPly(ply))
	);

	const secondWdlPerPly = results.map((r, ply) =>
		r.secondWdl ? toWhitePovWdl(r.secondWdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
```

And the final `return` statement:
```typescript
	return { evalPerPly, bestMoves, wdlPerPly };
```
becomes:
```typescript
	return { evalPerPly, bestMoves, wdlPerPly, secondEvalPerPly, secondWdlPerPly };
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: PASS (all tests in the file, existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine-analysis.ts src/lib/game/engine-analysis.test.ts
git commit -m "feat(engine-analysis): compute White-POV secondEvalPerPly/secondWdlPerPly from the engine's second PV line"
```

---

