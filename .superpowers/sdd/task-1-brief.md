## Task 1: `src/lib/game/classify.ts` — pure EP-cutoff classifier

**Files:**
- Create: `src/lib/game/classify.ts`
- Test: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes: `winPercentFromEval(evalPawns: number): number` from `./accuracy` (already exists, White-POV win% 0–100); `sideToMoveForPly(ply: number): PieceColor` from `./notation` (already exists, `'w'` for even ply, `'b'` for odd); `ClassCode` type from `$lib/types`.
- Produces:
  - `classifyMoveByEpLoss(epLossPoints: number): ClassCode` — pure cutoff-table lookup.
  - `classifyGame(evalPerPly: number[]): ClassCode[]` — one entry per move (index `i` = classification of ply `i + 1`), consumed by Task 2.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/classify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyMoveByEpLoss, classifyGame } from './classify';

describe('classifyMoveByEpLoss', () => {
	it('classifies exactly 0 loss as best', () => {
		expect(classifyMoveByEpLoss(0)).toBe('best');
	});

	it('classifies the upper edge of each band using Chess.com\'s exact published cutoffs', () => {
		expect(classifyMoveByEpLoss(2)).toBe('excellent');
		expect(classifyMoveByEpLoss(5)).toBe('good');
		expect(classifyMoveByEpLoss(10)).toBe('inaccuracy');
		expect(classifyMoveByEpLoss(20)).toBe('mistake');
	});

	it('classifies just above each cutoff as the next-worse band', () => {
		expect(classifyMoveByEpLoss(0.01)).toBe('excellent');
		expect(classifyMoveByEpLoss(2.01)).toBe('good');
		expect(classifyMoveByEpLoss(5.01)).toBe('inaccuracy');
		expect(classifyMoveByEpLoss(10.01)).toBe('mistake');
		expect(classifyMoveByEpLoss(20.01)).toBe('blunder');
	});

	it('classifies a large loss as blunder', () => {
		expect(classifyMoveByEpLoss(100)).toBe('blunder');
	});

	it('treats a negative loss (win% improved) the same as zero loss: best', () => {
		expect(classifyMoveByEpLoss(-5)).toBe('best');
	});
});

describe('classifyGame', () => {
	it('returns one classification per move, best when the mover\'s win% never worsens', () => {
		// ply0 (start, eval 0) -> ply1 White moves to +1.0 (better for White) ->
		// ply2 Black moves to +0.5 (better for Black, relative to +1.0).
		const codes = classifyGame([0, 1, 0.5]);
		expect(codes).toEqual(['best', 'best']);
	});

	it('classifies a real blunder: White drops from dead-even to badly losing', () => {
		// White's own win% swing from evalPerPly[0]=0 to evalPerPly[1]=-8 is far
		// more than 20 points, so ply 1 (White's move) is a blunder.
		const codes = classifyGame([0, -8]);
		expect(codes).toEqual(['blunder']);
	});

	it('returns an empty array for fewer than 2 eval samples', () => {
		expect(classifyGame([0])).toEqual([]);
		expect(classifyGame([])).toEqual([]);
	});

	it('attributes each ply\'s classification to the correct mover (White odd ply positions, Black even)', () => {
		// ply1 White: 0 -> 1 (improves, best). ply2 Black: 1 -> -1 (Black's own
		// POV win% at eval -1 is much better for Black than at eval 1, so also
		// best for Black). ply3 White: -1 -> -9 (a big drop in White's own win%
		// -> blunder for White).
		const codes = classifyGame([0, 1, -1, -9]);
		expect(codes[0]).toBe('best'); // White's move 1
		expect(codes[1]).toBe('best'); // Black's move 1
		expect(codes[2]).toBe('blunder'); // White's move 2
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL — `Cannot find module './classify'`.

- [ ] **Step 3: Implement `src/lib/game/classify.ts`**

```typescript
/**
 * Real per-move classification, replacing the fully-mocked CLASS_CODES
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §11) with
 * Chess.com's own published "Expected Points" cutoff table (Chess.com
 * support article, "How Are Moves Classified?"): a move's classification is
 * driven purely by how much win probability the mover lost by playing it,
 * relative to not losing any ground at all. Chess.com expresses this as
 * "expected points" on a 0-1 scale (Best 0.00 / Excellent <=0.02 / Good
 * <=0.05 / Inaccuracy <=0.10 / Mistake <=0.20 / Blunder >0.20); this module
 * uses win% on the 0-100 scale instead (identical up to a factor of 100),
 * since that's the scale `winPercentFromEval` (accuracy.ts, itself an exact
 * port of lichess's sigmoid) already produces — reusing it keeps the eval
 * math consistent between accuracy and classification instead of
 * introducing a second, slightly different win-probability model.
 *
 * Scope note: this is the deterministic "core" classifier only (the 6
 * cutoff-table classes). Book/Brilliant/Great/Miss/Forced are Chess.com's
 * fuzzier, rating-scaled special cases (piece-sacrifice detection,
 * only-move detection, opening-book lookup) and are intentionally a later
 * iteration — see docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard...
 * §4/§11 "Recommended next steps".
 */
import type { ClassCode } from '$lib/types';
import { winPercentFromEval } from './accuracy';
import { sideToMoveForPly } from './notation';

/** Chess.com's own published Expected-Points cutoff table (support article,
 * verbatim), expressed in win% points (0-100) lost by the mover rather than
 * the 0-1 "expected points" scale the article uses — see this file's header
 * comment for why the two scales are equivalent here. A move that doesn't
 * worsen the mover's own win% at all (loss <= 0) is always Best. */
export function classifyMoveByEpLoss(epLossPoints: number): ClassCode {
	const loss = Math.max(0, epLossPoints);
	if (loss === 0) return 'best';
	if (loss <= 2) return 'excellent';
	if (loss <= 5) return 'good';
	if (loss <= 10) return 'inaccuracy';
	if (loss <= 20) return 'mistake';
	return 'blunder';
}

/**
 * Classifies every move of a game from its White-POV evalPerPly (one entry
 * per ply including the starting position, exactly the shape
 * engine-analysis.ts's loadRealAnalysis() produces). Returns one
 * classification per move: index `i` is the classification of ply `i + 1`
 * (the same indexing the mocked CLASS_CODES array already used, so callers
 * can swap one for the other without reshaping anything). Returns an empty
 * array when there isn't enough eval data yet (fewer than 2 samples) rather
 * than fabricating classifications from incomplete data.
 */
export function classifyGame(evalPerPly: number[]): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map(winPercentFromEval);
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat: add real Expected-Points move classifier (classify.ts)"
```

---

