## Task 5: `classify.ts` — same WDL preference for move classification

**Files:**
- Modify: `src/lib/game/classify.ts`
- Modify: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes: `Wdl`, `winPercentForPly` from `./accuracy` (Task 4).
- Produces: `classifyGame(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): ClassCode[]` — new optional 2nd parameter, consumed by Task 7 (`app-state.svelte.ts`).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/game/classify.test.ts`, at the end of the `describe('classifyGame', ...)` block:

```typescript
	it('produces the exact same classifications as before when wdlPerPly is omitted (no regression)', () => {
		expect(classifyGame([0, 1, 0.5])).toEqual(['best', 'best']);
		expect(classifyGame([0, -8])).toEqual(['blunder']);
	});

	it('uses the WDL-derived win% for a ply that has one, changing the classification vs. eval-only', () => {
		// eval swing alone (0 -> -0.3) would classify as a small loss (good/excellent);
		// a wdl showing White going from a clear edge to lost changes the verdict.
		const evalPerPly = [0, -0.3];
		const withoutWdl = classifyGame(evalPerPly);
		const wdlPerPly: Array<[number, number, number] | null> = [[600, 300, 100], [0, 0, 1000]];
		const withWdl = classifyGame(evalPerPly, wdlPerPly);
		expect(withoutWdl[0]).not.toBe('blunder');
		expect(withWdl[0]).toBe('blunder');
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL — `classifyGame` ignores a 2nd argument entirely, so the WDL-vs-no-WDL comparison test fails (both come out identical).

- [ ] **Step 3: Implement in `src/lib/game/classify.ts`**

Replace the import line:

```typescript
import type { ClassCode } from '$lib/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
```

Replace `classifyGame`'s signature and body:

```typescript
export function classifyGame(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercents[ply - 1];
		const afterWhitePov = winPercents[ply];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		codes.push(classifyMoveByEpLoss(beforePov - afterPov));
	}

	return codes;
}
```

Also update this file's header doc comment (currently says `import { winPercentFromEval } from './accuracy'` in its prose) — replace the phrase "since that's the scale `winPercentFromEval` (accuracy.ts, itself an exact port of lichess's sigmoid) already produces — reusing it keeps the eval math consistent" with "since that's the scale `winPercentForPly` (accuracy.ts) already produces, whether from the eval sigmoid or Stockfish's own WDL model — reusing it keeps the win-probability math consistent" so the comment doesn't go stale.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS — all tests green, including the full pre-existing suite (confirming the no-`wdlPerPly` regression lock holds).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat: classifyGame prefers WDL-derived win%% over the eval sigmoid when available"
```

---

