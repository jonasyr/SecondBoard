## Task 3: `src/lib/game/accuracy.ts` — win%, per-move accuracy, game accuracy, winner

**Files:**
- Create: `src/lib/game/accuracy.ts`
- Test: `src/lib/game/accuracy.test.ts`

**Interfaces:**
- Consumes: `PieceColor` from `$lib/board/types`; `sideToMoveForPly` from `./notation` (`sideToMoveForPly(ply: number): PieceColor`, returns `'w'` for even `ply`, `'b'` for odd — `src/lib/game/notation.ts:40-42`).
- Produces:
  - `winPercentFromEval(evalPawns: number): number` — White's win% (0-100).
  - `computeGameAccuracy(evalPerPly: number[]): { white: number | null; black: number | null }` — consumed by Task 4.
  - `resolveWinner(result: string | null): 'white' | 'black' | 'draw' | null` — consumed by Task 4.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/accuracy.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { winPercentFromEval, computeGameAccuracy, resolveWinner } from './accuracy';

describe('winPercentFromEval', () => {
	it('is exactly 50 at a dead-even eval', () => {
		expect(winPercentFromEval(0)).toBe(50);
	});

	it('is symmetric: White POV win% for +N and -N sum to 100', () => {
		expect(winPercentFromEval(1) + winPercentFromEval(-1)).toBeCloseTo(100, 9);
		expect(winPercentFromEval(5) + winPercentFromEval(-5)).toBeCloseTo(100, 9);
	});

	it('is monotonically increasing in eval', () => {
		expect(winPercentFromEval(1)).toBeGreaterThan(winPercentFromEval(0));
		expect(winPercentFromEval(5)).toBeGreaterThan(winPercentFromEval(1));
	});

	it('saturates towards 100 for a large mate-magnitude eval (does not overflow to NaN)', () => {
		expect(winPercentFromEval(1000)).toBeCloseTo(100, 5);
		expect(Number.isNaN(winPercentFromEval(-1000))).toBe(false);
		expect(winPercentFromEval(-1000)).toBeCloseTo(0, 5);
	});

	it('matches the exact spec value at +1 pawn', () => {
		expect(winPercentFromEval(1)).toBeCloseTo(59.102589719161294, 9);
	});
});

describe('computeGameAccuracy', () => {
	it('returns null for both sides when there are fewer than 2 eval samples', () => {
		expect(computeGameAccuracy([0])).toEqual({ white: null, black: null });
		expect(computeGameAccuracy([])).toEqual({ white: null, black: null });
	});

	it('gives ~perfect accuracy to both sides when the eval never worsens for the mover', () => {
		// ply0 (start, eval 0) -> ply1 white moves to +1.0 (good for White) ->
		// ply2 black moves to +0.5 (good for Black, since it's an improvement
		// for Black relative to +1.0).
		const { white, black } = computeGameAccuracy([0, 1, 0.5]);
		expect(white).toBeCloseTo(99.9999, 4);
		expect(black).toBeCloseTo(99.9999, 4);
	});

	it('penalizes a mover whose eval swings against them, and averages across that side\'s moves', () => {
		// White plays two moves that each worsen White's eval (0 -> -3, -3.2 -> -8);
		// Black plays two moves that each slightly improve Black's eval (-3 -> -3.2, -8 -> -8.5).
		const { white, black } = computeGameAccuracy([0, -3, -3.2, -8, -8.5]);
		expect(white).toBeCloseTo(37.126083891942, 6);
		expect(black).toBeCloseTo(99.9999, 4);
	});
});

describe('resolveWinner', () => {
	it('resolves the standard PGN Result tags', () => {
		expect(resolveWinner('1-0')).toBe('white');
		expect(resolveWinner('0-1')).toBe('black');
		expect(resolveWinner('1/2-1/2')).toBe('draw');
	});

	it('returns null for a missing or unrecognized result', () => {
		expect(resolveWinner(null)).toBeNull();
		expect(resolveWinner('*')).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: FAIL — `Cannot find module './accuracy'`.

- [ ] **Step 3: Implement `src/lib/game/accuracy.ts`**

```typescript
/**
 * Real per-side game accuracy and winner, replacing the mocked
 * PLAYERS.white/black.accuracy fixture and hardcoded "0–1" result
 * (design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md §12 "Accuracy
 * System"). This is the standard public win%-sigmoid approximation used by
 * lichess/chess.com-style accuracy estimators, NOT chess.com's undisclosed
 * exact algorithm (which additionally volatility-weights the average rather
 * than taking a simple mean) — treat the output as a close estimate, not a
 * byte-for-byte match.
 */
import type { PieceColor } from '$lib/board/types';
import { sideToMoveForPly } from './notation';

/** OVERVIEW §11.5's expected_score sigmoid, tuned with the constant commonly
 * used by public lichess/chess.com accuracy-estimate implementations.
 * `evalPawns` is White-POV, as produced by engine-analysis.ts's evalPerPly. */
export function winPercentFromEval(evalPawns: number): number {
	const cp = evalPawns * 100;
	return 100 / (1 + Math.exp(-0.00368208 * cp));
}

/** Converts one move's win%-loss (from the mover's own POV) into a 0-100
 * per-move accuracy score. A move that doesn't worsen the mover's win% at
 * all (loss <= 0) scores ~100; accuracy decays smoothly as the loss grows. */
function moveAccuracy(winPercentLoss: number): number {
	const loss = Math.max(0, winPercentLoss);
	const acc = 103.1668 * Math.exp(-0.04354 * loss) - 3.1669;
	return Math.min(100, Math.max(0, acc));
}

export interface GameAccuracy {
	white: number | null;
	black: number | null;
}

/**
 * Derives per-side game accuracy from the real Stockfish evalPerPly
 * (White-POV pawns, one entry per ply including the starting position) that
 * engine-analysis.ts's loadRealAnalysis() produces. Each ply transition's
 * mover is scored by how much their own win% dropped from before their move
 * to after it; a side's game accuracy is the mean of its own moves' scores.
 * Returns null for a side (or both) when there isn't enough data yet (e.g.
 * analysis hasn't completed) rather than a misleading number.
 */
export function computeGameAccuracy(evalPerPly: number[]): GameAccuracy {
	if (evalPerPly.length < 2) return { white: null, black: null };

	const whiteScores: number[] = [];
	const blackScores: number[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover: PieceColor = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercentFromEval(evalPerPly[ply - 1]);
		const afterWhitePov = winPercentFromEval(evalPerPly[ply]);
		const moverBefore = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const moverAfter = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const score = moveAccuracy(moverBefore - moverAfter);
		(mover === 'w' ? whiteScores : blackScores).push(score);
	}

	const mean = (xs: number[]): number | null =>
		xs.length ? xs.reduce((sum, x) => sum + x, 0) / xs.length : null;

	return { white: mean(whiteScores), black: mean(blackScores) };
}

export type Winner = 'white' | 'black' | 'draw' | null;

/** Resolves the PGN `Result` tag (`'1-0'` / `'0-1'` / `'1/2-1/2'`) into a
 * winner. Any other value (missing tag, `'*'` = ongoing/unknown) is null. */
export function resolveWinner(result: string | null): Winner {
	if (result === '1-0') return 'white';
	if (result === '0-1') return 'black';
	if (result === '1/2-1/2') return 'draw';
	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/accuracy.ts src/lib/game/accuracy.test.ts
git commit -m "feat: add real win%-based game accuracy and winner resolution"
```

---

