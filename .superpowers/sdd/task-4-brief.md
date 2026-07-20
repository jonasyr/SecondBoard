## Task 4: `accuracy.ts` — `Wdl` type, `winPercentFromWdl`, and the `winPercentForPly` preference helper

**Files:**
- Modify: `src/lib/game/accuracy.ts`
- Modify: `src/lib/game/accuracy.test.ts`

**Interfaces:**
- Produces:
  - `Wdl = readonly [number, number, number]` (White-POV per-mille win/draw/loss) — consumed by Tasks 5, 6, 7.
  - `winPercentFromWdl(wdl: Wdl): number` — consumed internally and by Task 5.
  - `winPercentForPly(ply: number, evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): number` — consumed by Task 5 (`classifyGame`) and internally by `computeGameAccuracy`.
  - `computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy` — new optional 2nd parameter, consumed by Task 7 (`getAccuracySummary`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/accuracy.test.ts`, right after the existing `winPercentFromEval` describe block:

```typescript
describe('winPercentFromWdl', () => {
	it('matches the blueprint\'s own worked example: wdl 500 400 100 -> 70', () => {
		expect(winPercentFromWdl([500, 400, 100])).toBe(70);
	});

	it('is 100 for a certain win and 0 for a certain loss', () => {
		expect(winPercentFromWdl([1000, 0, 0])).toBe(100);
		expect(winPercentFromWdl([0, 0, 1000])).toBe(0);
	});

	it('is 50 for a certain draw', () => {
		expect(winPercentFromWdl([0, 1000, 0])).toBe(50);
	});
});

describe('winPercentForPly', () => {
	it('prefers the WDL-derived win% when a real entry is present for this ply', () => {
		const evalPerPly = [0, 1];
		const wdlPerPly: Array<[number, number, number] | null> = [[500, 400, 100], null];
		expect(winPercentForPly(0, evalPerPly, wdlPerPly)).toBe(70);
	});

	it('falls back to the eval sigmoid when wdlPerPly has no entry for this ply', () => {
		const evalPerPly = [0, 1];
		const wdlPerPly: Array<[number, number, number] | null> = [[500, 400, 100], null];
		expect(winPercentForPly(1, evalPerPly, wdlPerPly)).toBeCloseTo(winPercentFromEval(1), 9);
	});

	it('falls back to the eval sigmoid when wdlPerPly is omitted entirely', () => {
		const evalPerPly = [0, 1];
		expect(winPercentForPly(0, evalPerPly)).toBe(winPercentFromEval(0));
		expect(winPercentForPly(1, evalPerPly)).toBeCloseTo(winPercentFromEval(1), 9);
	});
});

describe('computeGameAccuracy with WDL', () => {
	it('produces the exact same result as before when wdlPerPly is omitted (no regression)', () => {
		// Locks in the pre-existing exact value from this file's own
		// "penalizes a mover..." test above -- passing no wdlPerPly must not
		// change a single digit of the output.
		const { white, black } = computeGameAccuracy([0, -3, -3.2, -8, -8.5]);
		expect(white).toBeCloseTo(37.3255159268525, 9);
		expect(black).toBe(100);
	});

	it('uses the WDL-derived win% for a ply that has one, changing the result vs. eval-only', () => {
		const evalPerPly = [0, -3];
		const withoutWdl = computeGameAccuracy(evalPerPly);
		// A wdl reporting White as far more lost than the eval sigmoid implies
		// (eval -3 pawns alone) should pull White's accuracy down further.
		const wdlPerPly: Array<[number, number, number] | null> = [[500, 400, 100], [0, 0, 1000]];
		const withWdl = computeGameAccuracy(evalPerPly, wdlPerPly);
		expect(withWdl.white).not.toBeCloseTo(withoutWdl.white!, 6);
		expect(withWdl.white!).toBeLessThan(withoutWdl.white!);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: FAIL — `winPercentFromWdl`/`winPercentForPly` are not exported (`Cannot find module` style errors from the named imports), and `computeGameAccuracy` ignores a 2nd argument entirely so the WDL-vs-no-WDL comparison test fails.

- [ ] **Step 3: Implement in `src/lib/game/accuracy.ts`**

Add the import line update at the top of the test file (already covered by Step 1's `describe` blocks referencing these names — the test file's existing `import { winPercentFromEval, computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';` line needs `winPercentFromWdl, winPercentForPly` added):

```typescript
import { winPercentFromEval, winPercentFromWdl, winPercentForPly, computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';
```

In `src/lib/game/accuracy.ts`, add right after `winPercentFromEval`'s definition:

```typescript
/** Win/draw/loss per-mille (`w + d + l = 1000`), always stored White-POV in
 * this codebase — exactly like `evalPerPly` is White-POV pawns — so every
 * consumer applies the same mover-POV flip (`mover === 'w' ? x : 100 - x`)
 * uniformly regardless of whether a given ply's win% came from WDL or the
 * eval sigmoid. Raw engine WDL is side-to-move POV; engine-analysis.ts's
 * `toWhitePovWdl` is the one place that converts. */
export type Wdl = readonly [w: number, d: number, l: number];

/** Stockfish's own WDL model, converted to a White-POV win percentage
 * (blueprint §3.2: `ExpScore = (w + 0.5*d)/1000`, expressed here on the
 * 0-100 scale to match `winPercentFromEval`'s scale exactly). */
export function winPercentFromWdl(wdl: Wdl): number {
	return (wdl[0] + 0.5 * wdl[1]) / 10;
}

/** The one place that decides "WDL if the engine reported it for this ply,
 * else the eval sigmoid" -- both `computeGameAccuracy` and `classify.ts`'s
 * `classifyGame` call this instead of `winPercentFromEval` directly, so a
 * future ply-level data source only needs to be taught to this function
 * once. `wdlPerPly` is optional and index-aligned with `evalPerPly`; when
 * omitted, or when this ply's entry is missing/null, behavior is identical
 * to calling `winPercentFromEval` directly (byte-for-byte, existing
 * behavior is fully preserved for engine builds/positions without WDL). */
export function winPercentForPly(
	ply: number,
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): number {
	const wdl = wdlPerPly?.[ply];
	return wdl ? winPercentFromWdl(wdl) : winPercentFromEval(evalPerPly[ply]);
}
```

Modify `computeGameAccuracy`'s signature and its `winPercents` derivation (the rest of the function body is unchanged):

```typescript
export function computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy {
	const plyCount = evalPerPly.length;
	if (plyCount < 2) return { white: null, black: null };

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const moveCount = plyCount - 1;
	const windowSize = Math.min(8, Math.max(2, Math.floor(moveCount / 10)));
	// ... (rest of function body unchanged from here)
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: PASS — all tests green, including the full pre-existing suite (confirming the no-`wdlPerPly` regression lock holds).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/accuracy.ts src/lib/game/accuracy.test.ts
git commit -m "feat: prefer WDL-derived win%% over the eval sigmoid when the engine reports it"
```

---

