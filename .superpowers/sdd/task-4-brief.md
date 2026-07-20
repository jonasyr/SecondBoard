## Task 4: `review.ts` — `getAccuracySummary` (real data + mock-name fallback)

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`

**Interfaces:**
- Consumes: `GameData.result`/`whiteName`/`blackName` (Task 2); `computeGameAccuracy`/`resolveWinner` from `./accuracy` (Task 3); existing `PLAYERS` from `./mock-data`.
- Produces: `AccuracySummary` and `getAccuracySummary(game: GameData, evalPerPly: number[]): AccuracySummary` — consumed by Task 6 (`ReviewTab.svelte`).

- [ ] **Step 1: Write the failing test**

Add to `src/lib/game/review.test.ts` (new `describe` block at the end of the file, after the existing `getPlayerRows` block):

```typescript
describe('getAccuracySummary', () => {
	it('falls back to the mock PLAYERS names when the PGN has no name tags, and resolves the real winner', () => {
		const game: GameData = { ...sampleGame, result: '0-1' };
		const summary = getAccuracySummary(game, [0, 1, 0.5]);

		expect(summary.white.name).toBe('Jonas');
		expect(summary.black.name).toBe('DominikP');
		expect(summary.white.isWinner).toBe(false);
		expect(summary.black.isWinner).toBe(true);
		expect(summary.resultLabel).toBe('0–1');
	});

	it('uses real PGN names when present', () => {
		const game: GameData = {
			...notSampleGame,
			whiteName: 'Donald Byrne',
			blackName: 'Robert James Fischer',
			result: '1-0'
		};
		const summary = getAccuracySummary(game, [0, 1]);

		expect(summary.white.name).toBe('Donald Byrne');
		expect(summary.white.initial).toBe('D');
		expect(summary.black.name).toBe('Robert James Fischer');
		expect(summary.black.initial).toBe('R');
		expect(summary.white.isWinner).toBe(true);
		expect(summary.black.isWinner).toBe(false);
	});

	it('reports accuracy as null (not a fabricated number) when there is not enough eval data yet', () => {
		const game: GameData = { ...sampleGame, result: null };
		const summary = getAccuracySummary(game, [0]);

		expect(summary.white.accuracy).toBeNull();
		expect(summary.black.accuracy).toBeNull();
		expect(summary.resultLabel).toBe('—');
	});

	it('formats a draw result and marks neither side as the winner', () => {
		const game: GameData = { ...sampleGame, result: '1/2-1/2' };
		const summary = getAccuracySummary(game, [0, 0]);

		expect(summary.resultLabel).toBe('½–½');
		expect(summary.white.isWinner).toBe(false);
		expect(summary.black.isWinner).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getAccuracySummary is not a function` (not exported yet).

- [ ] **Step 3: Implement `getAccuracySummary` in `src/lib/game/review.ts`**

Add the import (extend the existing `./mock-data` import line and add the new `./accuracy` import) — modify line 17:

```typescript
import { BEST_MOVES, COACH_TEXT_MAP, EVAL_PER_PLY, CLASS_CODES, PLAYERS } from './mock-data';
import { computeGameAccuracy, resolveWinner } from './accuracy';
```

Append to the end of `src/lib/game/review.ts` (after `getPlayerRows`):

```typescript
export interface AccuracySide {
	name: string;
	initial: string;
	accuracy: string | null;
	isWinner: boolean;
}

export interface AccuracySummary {
	white: AccuracySide;
	black: AccuracySide;
	resultLabel: string;
}

function formatResultLabel(result: string | null): string {
	if (result === '1-0') return '1–0';
	if (result === '0-1') return '0–1';
	if (result === '1/2-1/2') return '½–½';
	return '—';
}

/**
 * Derives the Accuracy block's real winner + accuracy numbers (OVERVIEW §12
 * Accuracy System) from the loaded game's PGN Result tag and real Stockfish
 * evalPerPly. Player name/initial follow the same real-PGN-over-mock-PLAYERS
 * fallback as getPlayerRows. Accuracy is null (rendered as "—" by
 * AccuracyBlock) rather than a mock number when there isn't enough eval data
 * yet (analysis still loading, or a game with too few plies).
 */
export function getAccuracySummary(game: GameData, evalPerPly: number[]): AccuracySummary {
	const whiteName = game.whiteName ?? PLAYERS.white.name;
	const blackName = game.blackName ?? PLAYERS.black.name;
	const { white, black } = computeGameAccuracy(evalPerPly);
	const winner = resolveWinner(game.result);

	return {
		white: {
			name: whiteName,
			initial: whiteName.charAt(0).toUpperCase(),
			accuracy: white === null ? null : white.toFixed(1),
			isWinner: winner === 'white'
		},
		black: {
			name: blackName,
			initial: blackName.charAt(0).toUpperCase(),
			accuracy: black === null ? null : black.toFixed(1),
			isWinner: winner === 'black'
		},
		resultLabel: formatResultLabel(game.result)
	};
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts
git commit -m "feat: derive real winner/accuracy summary in getAccuracySummary"
```

---

