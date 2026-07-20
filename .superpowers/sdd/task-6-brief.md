## Task 6: `engine-analysis.ts` — produce `wdlPerPly` (White-POV) from real analysis

**Files:**
- Modify: `src/lib/game/engine-analysis.ts`
- Modify: `src/lib/game/engine-analysis.test.ts`

**Interfaces:**
- Consumes: `AnalyzeFenResult.wdl: [number, number, number] | null` (Task 3); `Wdl` type from `./accuracy` (Task 4).
- Produces: `RealAnalysis.wdlPerPly: (Wdl | null)[]` — consumed by Task 7 (`app-state.svelte.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/engine-analysis.test.ts`, at the end of the `describe('loadRealAnalysis', ...)` block:

```typescript
	it('produces one wdlPerPly entry per position, flipped to White POV', async () => {
		analyzeFen.mockImplementation(async (fen: string) => ({
			evalCp: 0,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: [600, 300, 100] // side-to-move POV, favorable for whoever is to move
		}));

		const { wdlPerPly } = await loadRealAnalysis(testPositions);

		expect(wdlPerPly).toHaveLength(testPositions.length);
		expect(wdlPerPly[0]).toEqual([600, 300, 100]); // ply 0: White to move, so no flip
		expect(wdlPerPly[1]).toEqual([100, 300, 600]); // ply 1: Black to move, so w/l swap to White POV
	});

	it('reports null wdlPerPly entries for positions where the engine did not report wdl', async () => {
		analyzeFen.mockResolvedValue({ evalCp: 0, isMate: false, bestMoveUci: 'e2e4', pv: [], wdl: null });

		const { wdlPerPly } = await loadRealAnalysis(testPositions);

		expect(wdlPerPly.every((w) => w === null)).toBe(true);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: FAIL — `wdlPerPly` is `undefined` on the returned object (property doesn't exist yet).

- [ ] **Step 3: Implement in `src/lib/game/engine-analysis.ts`**

Replace the top-of-file imports:

```typescript
import type { Move, Position, PieceColor } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { analyzeFen } from '$lib/api/engine';
import { positionToFen, sideToMoveForPly, fullmoveNumberForPly, moveToSan } from './notation';
```

Update `RealAnalysis`:

```typescript
export interface RealAnalysis {
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	wdlPerPly: (Wdl | null)[];
}
```

Add a new pure helper right after the existing `toWhitePovEval` function:

```typescript
/** Stockfish's WDL is relative to the side to move at the analyzed FEN, exactly
 * like its cp score -- flip win/loss (draw is symmetric) to White's POV so it
 * matches `evalPerPly`'s convention and can be indexed identically. */
function toWhitePovWdl(wdl: [number, number, number], sideToMove: PieceColor): Wdl {
	return sideToMove === 'w' ? wdl : [wdl[2], wdl[1], wdl[0]];
}
```

Modify `loadRealAnalysis`'s body to compute and return `wdlPerPly`:

```typescript
export async function loadRealAnalysis(positions: Position[]): Promise<RealAnalysis> {
	const results = await mapWithConcurrency(positions, ANALYSIS_CONCURRENCY, (position, ply) =>
		analyzeFen(positionToFen(position, sideToMoveForPly(ply), fullmoveNumberForPly(ply)))
	);

	const evalPerPly = results.map((r, ply) =>
		toWhitePovEval(r.evalCp, sideToMoveForPly(ply))
	);

	const wdlPerPly = results.map((r, ply) =>
		r.wdl ? toWhitePovWdl(r.wdl, sideToMoveForPly(ply)) : null
	);

	const bestMoves: Record<number, Move & { san: string }> = {};
	results.forEach((r, ply) => {
		if (ply === positions.length - 1 || r.bestMoveUci.length < 4) return;
		const from = r.bestMoveUci.slice(0, 2);
		const to = r.bestMoveUci.slice(2, 4);
		bestMoves[ply + 1] = { from, to, san: moveToSan(positions[ply], { from, to }) };
	});

	return { evalPerPly, bestMoves, wdlPerPly };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/engine-analysis.test.ts`
Expected: PASS — all tests green, including the full pre-existing suite (the existing mocked `analyzeFen` results in those tests never include a `wdl` field, so `r.wdl` is `undefined`, which is falsy — every pre-existing test's `wdlPerPly` comes back all-`null` automatically, with zero changes needed to those tests' bodies).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/engine-analysis.ts src/lib/game/engine-analysis.test.ts
git commit -m "feat: loadRealAnalysis produces White-POV wdlPerPly alongside evalPerPly"
```

---

