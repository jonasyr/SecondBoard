### Task 5: Extend `classifyGame` with Brilliant/Great/Miss

**Files:**
- Modify: `src/lib/game/classify.ts`
- Test: `src/lib/game/classify.test.ts` (read this file first with `get_symbols_overview`/`find_symbol` to confirm its exact current test structure and imports before adding to it — it is not reproduced here since it wasn't read during planning; do not guess its existing contents, only append new `describe` blocks that import the same way the file's existing tests do)

**Interfaces:**
- Consumes: `Wdl`, `winPercentForPly` (`./accuracy`); `sideToMoveForPly` (`./notation`); `materialForColor`/`isMaterialSacrifice` (`./material`, Task 4); `Move`, `Position` (`$lib/board/types`); `Move & { san: string }` shape for `bestMoves` (matches `RealAnalysis.bestMoves`, Task 3, and `AppState.bestMoves`).
- Produces: `export interface SpecialClassInputs`; `classifyGame(evalPerPly, wdlPerPly?, special?)` — the `special` param is consumed by Task 6's `app-state.svelte.ts`.

- [ ] **Step 1: Write the failing tests**

First, read the current `src/lib/game/classify.test.ts` in full (via `get_symbols_overview` then `find_symbol` with `include_body=true` on its top-level `describe` blocks) to see its exact existing imports and helper fixtures, so the new tests below match its conventions rather than introducing a second, inconsistent style. Then add a new `describe('classifyGame with special classes', ...)` block whose tests construct minimal `Position`/`Move` fixtures directly (do not invent fixtures that duplicate ones already defined in the file — reuse them if suitable):

```typescript
describe('classifyGame with special classes', () => {
	// 3 plies: ply0 (before any move) -> ply1 (after White's move) -> ply2 (after Black's move).
	// evalPerPly / wdlPerPly are White-POV win% inputs; the fixture positions/moves below are
	// only wired up to exercise the Brilliant/Great/Miss branches, not to represent a legal game.

	it('classifies a best/near-best sound piece sacrifice as brilliant', () => {
		const evalPerPly = [0, 0]; // win% 50 before and after (via the sigmoid) is not what
		// matters here -- use wdlPerPly to pin exact mover-POV win% values instead.
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: White win% 80 (mover POV, White to move)
			[600, 400, 0] // ply 1: White win% 80 after the move (stays >= 50, well under 97)
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e5: ['N', 'w'], e8: ['K', 'b'] }, // before: White has a knight on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after: the knight is gone -- a sacrifice
		];
		const moveMeta: Move[] = [{ from: 'e5', to: 'd7' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd7', san: 'Nd7' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['brilliant']);
	});

	it('classifies an only-move (large MultiPV gap) best move as great', () => {
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[550, 400, 50], // ply 0: White win% (550+200)/10 = 75 (mover POV)
			[550, 400, 50] // ply 1: unchanged -- no sacrifice/miss condition applies
		];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[350, 400, 250], // ply 0's second PV line: White win% (350+200)/10 = 55 -> gap of 20 >= 10
			null
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e1', to: 'e2', san: 'Ke2' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, {
			positions,
			moveMeta,
			bestMoves,
			secondWdlPerPly
		});

		expect(codes).toEqual(['great']);
	});

	it('classifies a failure to punish a winning position as miss', () => {
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[850, 100, 50], // ply 0: White win% (850+50)/10 = 90 (mover POV, above the 80 miss-before threshold)
			[300, 400, 300] // ply 1: White win% (300+200)/10 = 50 (below the 55 miss-after threshold)
		];
		const evalPerPly = [0, 0];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'e1', to: 'e2' }];
		const bestMoves: Record<number, Move & { san: string }> = {}; // played move need not be "best" for Miss

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['miss']);
	});

	it('falls back to the EP-cutoff table when no special condition matches', () => {
		const evalPerPly = [0, -0.6]; // a small eval drop, no WDL provided
		const codes = classifyGame(evalPerPly);
		// No `special` argument at all -- must reproduce today's exact (pre-Task-5) behavior.
		expect(codes).toHaveLength(1);
		expect(['best', 'excellent', 'good', 'inaccuracy', 'mistake', 'blunder']).toContain(codes[0]);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL — `classifyGame` doesn't yet accept a third `special` argument (TypeScript type error) and none of Brilliant/Great/Miss are produced.

- [ ] **Step 3: Implement**

Current code in `src/lib/game/classify.ts`:
```typescript
import type { ClassCode } from '$lib/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
```
Replace with:
```typescript
import type { ClassCode } from '$lib/types';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
import { isMaterialSacrifice } from './material';

/** blueprint §8's `ClassificationConfig` defaults, expressed on this codebase's
 * 0-100 win%-points scale (the blueprint's own numbers are on a 0-1 scale). */
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 97;
const GREAT_ONLY_MOVE_GAP = 10;
const MISS_WIN_BEFORE = 80;
const MISS_WIN_AFTER = 55;

/**
 * Optional real-game inputs that unlock the Brilliant/Great/Miss special
 * classes (blueprint §4/§8). Omitting this parameter entirely from
 * `classifyGame` reproduces its pre-existing (EP-cutoff-only) behavior
 * byte-for-byte -- every field here is used only to ADD classifications on
 * top of the deterministic cutoff table, never to change it.
 */
export interface SpecialClassInputs {
	/** One board position per ply (same shape/indexing as `GameData.positions`). */
	positions: Position[];
	/** The move actually played to reach ply `i + 1` (same shape as `GameData.moveMeta`). */
	moveMeta: Move[];
	/** The engine's suggested move FROM the position at ply `i - 1` TO reach ply `i`
	 * (same indexing as `RealAnalysis.bestMoves`/`AppState.bestMoves`). */
	bestMoves: Record<number, Move & { san: string }>;
	/** The engine's second-choice (MultiPV #2) win%-relevant data at the position
	 * BEFORE each ply, White-POV, same indexing as `evalPerPly`/`wdlPerPly`. */
	secondEvalPerPly?: (number | null)[];
	secondWdlPerPly?: (Wdl | null)[];
}

function secondLineWinPercent(
	ply: number,
	secondEvalPerPly?: (number | null)[],
	secondWdlPerPly?: (Wdl | null)[]
): number | null {
	const wdl = secondWdlPerPly?.[ply];
	if (wdl) return (wdl[0] + 0.5 * wdl[1]) / 10;
	const evalPawns = secondEvalPerPly?.[ply];
	if (evalPawns === null || evalPawns === undefined) return null;
	return 100 / (1 + Math.exp(-0.00368208 * (evalPawns * 100)));
}
```

Replace `classifyGame`'s body. Current code:
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
Replace with:
```typescript
export function classifyGame(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	special?: SpecialClassInputs
): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const winPercents = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWhitePov = winPercents[ply - 1];
		const afterWhitePov = winPercents[ply];
		const beforePov = mover === 'w' ? beforeWhitePov : 100 - beforeWhitePov;
		const afterPov = mover === 'w' ? afterWhitePov : 100 - afterWhitePov;
		const epLoss = beforePov - afterPov;

		codes.push(classifySpecial(ply, mover, beforePov, afterPov, epLoss, special) ?? classifyMoveByEpLoss(epLoss));
	}

	return codes;
}

/** Brilliant > Great > Miss (blueprint §4 override order, Book/Forced out of
 * scope this iteration). Returns null when no special condition applies and
 * no `special` argument was supplied at all -- falls through to the
 * deterministic EP-cutoff table in either case. */
function classifySpecial(
	ply: number,
	mover: 'w' | 'b',
	beforePov: number,
	afterPov: number,
	epLoss: number,
	special?: SpecialClassInputs
): ClassCode | null {
	if (!special) return null;

	const playedMove = special.moveMeta[ply - 1];
	const suggested = special.bestMoves[ply];
	const playedIsBest = Boolean(
		playedMove && suggested && suggested.from === playedMove.from && suggested.to === playedMove.to
	);
	const nearBest = epLoss <= 2 || playedIsBest;

	if (
		nearBest &&
		special.positions[ply - 1] &&
		special.positions[ply] &&
		isMaterialSacrifice(special.positions[ply - 1], special.positions[ply], mover) &&
		afterPov >= BRILLIANT_MIN_WIN &&
		beforePov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}

	if (playedIsBest) {
		const secondPov = secondLineWinPercent(ply - 1, special.secondEvalPerPly, special.secondWdlPerPly);
		if (secondPov !== null) {
			const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
			if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
				return 'great';
			}
		}
	}

	if (beforePov >= MISS_WIN_BEFORE && afterPov < MISS_WIN_AFTER) {
		return 'miss';
	}

	return null;
}
```

Update the module's header doc comment (the block that currently ends with "Book/Brilliant/Great/Miss/Forced are Chess.com's fuzzier, rating-scaled special cases... are intentionally a later iteration") to read:
```
 * Scope note: Brilliant/Great/Miss (this file's `classifySpecial`) run before
 * the deterministic cutoff table, per Chess.com's own override order
 * (Brilliant > Great > Miss > cutoffs). Book and Forced remain a later
 * iteration (opening-book/ECO lookup and a dedicated ClassCode are both out
 * of scope here) -- see docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard...
 * §4/§11 "Recommended next steps".
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS (all existing tests + the 4 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat(classify): add Brilliant/Great/Miss special-class detection ahead of the EP-cutoff table"
```

---

