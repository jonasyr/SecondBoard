# Move Classification (Chess.com Expected-Points Cutoffs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fully-mocked per-move classification (`CLASS_CODES`, currently shown only for the built-in sample game) with a real classifier derived from the engine's own `evalPerPly`, using Chess.com's exact-published Expected-Points cutoff table, so every loaded game — sample or pasted — gets an honest Best/Excellent/Good/Inaccuracy/Mistake/Blunder label on every move.

**Architecture:** A new pure module, `src/lib/game/classify.ts`, computes each move's win%-loss (mover's own point of view, reusing `winPercentFromEval` — the exact same lichess sigmoid `accuracy.ts` already uses) and maps it through Chess.com's own published cutoff table (0.00 / ≤0.02 / ≤0.05 / ≤0.10 / ≤0.20 / >0.20, expressed as win-percentage points 0–100 rather than the 0–1 "expected points" scale the source documents use — the two scales are identical up to a factor of 100, since `winPercentFromEval` already returns a 0–100 win probability that plays the same role as Chess.com's "expected points"). The result is threaded through `appState` (a new `classCodes: ClassCode[]` field, populated only once real analysis finishes — mirroring the existing "don't show fake numbers from the zero-seeded placeholder eval array" pattern already used by `ReviewTab.svelte`'s accuracy calculation) and consumed everywhere the mock `CLASS_CODES` import used to be read directly: `review.ts`'s `getReviewPly`, `MoveList.svelte`, `ReviewTab.svelte`, and `BottomBar.svelte`.

**Tech Stack:** SvelteKit 5 (runes), TypeScript, Vitest + @testing-library/svelte. No Rust/Tauri changes — `evalPerPly` (White-POV pawns) already carries everything this classifier needs.

## Global Constraints

- Chess.com's exact published Expected-Points cutoff table (win%-loss from the mover's own POV, 0–100 scale): Best `= 0`, Excellent `(0, 2]`, Good `(2, 5]`, Inaccuracy `(5, 10]`, Mistake `(10, 20]`, Blunder `(20, 100]`.
- Reuse `winPercentFromEval` from `src/lib/game/accuracy.ts` verbatim — do not re-derive or re-tune the sigmoid constant.
- Out of scope for this iteration (do not implement): Book/Brilliant/Great/Miss/Forced special classes, opening-book detection, MultiPV/WDL engine changes, `BreakdownTable`/`PhaseTable` aggregate stats (leave these reading mock data), and the game-rating regression (already shipped in a prior iteration).
- Every new/changed `.ts`/`.svelte` file gets its test file updated in the same task (TDD: write/adjust the failing test first, then implement). Do not move to the next task with red tests.
- Run `pnpm exec vitest run <file>` after every task; run the full suite (`pnpm exec vitest run`) plus `pnpm check` and `pnpm lint` in the final verification task.
- Follow this repo's established real-data-over-mock-fallback pattern and code-comment style (see `src/lib/game/accuracy.ts`, `src/lib/game/review.ts`).

---

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

## Task 2: `app-state.svelte.ts` — wire real `classCodes` into the store

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: `classifyGame(evalPerPly: number[]): ClassCode[]` from Task 1.
- Produces: `AppState.classCodes: ClassCode[]` — consumed by Tasks 3-6.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/app-state.test.ts`, inside the existing `describe('real analysis loading', ...)` block (after the `'goes loading -> ready and applies the real data once startReview resolves'` test):

```typescript
	it('populates classCodes from the real evalPerPly once analysis is ready', async () => {
		let resolveAnalysis!: (v: { evalPerPly: number[]; bestMoves: Record<number, never> }) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		await startReview();
		expect(appState.classCodes).toEqual([]); // nothing computed yet while loading

		resolveAnalysis({ evalPerPly: [0, 1], bestMoves: {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.classCodes).toEqual(['best']);
	});

	it('leaves classCodes empty (not fabricated) when loadRealAnalysis rejects', async () => {
		loadRealAnalysis.mockRejectedValue(new Error('engine offline'));

		await startReview();
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('error');
		expect(appState.classCodes).toEqual([]);
	});
```

Also add, inside the existing `describe('startReview (real PGN parsing)', ...)` block's first test (`'on successful parse: ...'`), right after the existing `expect(appState.evalPerPly).toEqual([0, 0, 0]);` line:

```typescript
		expect(appState.classCodes).toEqual([]); // reset on every fresh parse, before real analysis lands
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `appState.classCodes` is `undefined`, not `[]`/`['best']` (property doesn't exist on `AppState` yet).

- [ ] **Step 3: Add `classCodes` to `AppState`, `defaultState`, `startReview`, and `refreshRealAnalysis`**

In `src/lib/stores/app-state.svelte.ts`, add the import (extend the existing `$lib/game/classify` import):

```typescript
import { classifyGame } from '$lib/game/classify';
```

Modify the `AppState` interface — add after `bestMoves`:

```typescript
	bestMoves: Record<number, Move & { san: string }>;
	classCodes: ClassCode[];
```

(Add `import type { ClassCode } from '$lib/types';` to the top of the file alongside the existing `Screen`/`Tab` import.)

Modify `defaultState` — add after `bestMoves: { ...BEST_MOVES },`:

```typescript
	bestMoves: { ...BEST_MOVES },
	classCodes: [],
```

In `startReview`, reset `classCodes` alongside the existing `evalPerPly`/`bestMoves` reset (add right after `appState.bestMoves = {};`):

```typescript
			appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
			appState.bestMoves = {};
			appState.classCodes = [];
```

In `refreshRealAnalysis`, compute real classifications alongside the real `evalPerPly`/`bestMoves` (modify the `try` block):

```typescript
	try {
		const { evalPerPly, bestMoves } = await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.classCodes = classifyGame(evalPerPly);
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts`
Expected: PASS — all green.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts
git commit -m "feat: populate appState.classCodes from real analysis"
```

---

## Task 3: `review.ts` — real classification in `getReviewPly`

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`

**Interfaces:**
- Consumes: `AppState.classCodes: ClassCode[]` shape (Task 2) passed in by callers as a new parameter.
- Produces: `getReviewPly(ply, game, evalPerPly, bestMoves, classCodes)` — 5th parameter, consumed by Tasks 4-5. `ReviewPly.classCode`/`coachText` semantics change: classification and coach text now depend on whether `classCodes` has an entry for this ply, not on `game.isSample`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/game/review.test.ts`, replace the two tests that currently depend on the `isSample` gate — `'ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"'` and `'does not apply classification/coach text to a non-sample game'` — with:

```typescript
	it('ply 1 is classified from the real evalPerPly (Expected-Points cutoffs), independent of isSample', () => {
		const r = getReviewPly(1, sampleGame, undefined, undefined, ['excellent']);
		expect(r.classCode).toBe('excellent');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('applies real classification to a non-sample game too, given real classCodes', () => {
		const r = getReviewPly(1, notSampleGame, undefined, undefined, ['blunder']);
		expect(r.classCode).toBe('blunder');
		expect(r.coachText).toBe('A costly error — this swings the evaluation sharply.');
		expect(r.coachMove).toBe('1. d4'); // sanList is still real regardless of isSample
	});

	it('shows no classification/coach-classification text when classCodes has no entry yet for this ply (analysis not ready)', () => {
		const r = getReviewPly(1, sampleGame, undefined, undefined, []);
		expect(r.classCode).toBeNull();
		expect(r.best).toBeNull();
		expect(r.coachText).toBe(
			"Move classification isn't available yet — analysis for this move hasn't finished."
		);
	});
```

Also update the `'only exposes \`best\` when the played move is a NOT_BEST_CODE and bestMoves has an entry'` test to pass explicit `classCodes` instead of relying on the mock default (the mock `CLASS_CODES` default still exists for convenience, but this test should be explicit about what it's asserting):

```typescript
	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14, sampleGame).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy (from default mock CLASS_CODES)
		expect(getReviewPly(1, sampleGame).best).toBeNull(); // book, not a NOT_BEST code
	});
```

(Leave this one using the module's default `CLASS_CODES` mock — `CLASS_CODES[13]` is `'inaccuracy'` and `CLASS_CODES[0]` is `'book'` per `mock-data.ts`, so the assertions still hold unchanged; removing the `isSample` gate doesn't affect this test at all, since it never passed `isSample` in the first place — it only ever depended on `classCodes`, which here is still the default mock array.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getReviewPly` only accepts 4 params; the 5th argument (`classCodes`) is silently ignored, so `r.classCode` still resolves via the old `isSample` gate and doesn't match `'excellent'`/`'blunder'`, and the "not ready" test's coach text doesn't match the new copy.

- [ ] **Step 3: Update `getReviewPly` in `src/lib/game/review.ts`**

Replace the `UNCLASSIFIED_COACH_TEXT` constant:

```typescript
export const UNCLASSIFIED_COACH_TEXT =
	"Move classification isn't available yet — analysis for this move hasn't finished.";
```

Replace the `getReviewPly` function signature and its `classCode`/`coachText` derivation:

```typescript
export function getReviewPly(
	ply: number,
	game: GameData,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES,
	classCodes: ClassCode[] = CLASS_CODES
): ReviewPly {
	const position = game.positions[ply];
	const lastMove = ply > 0 ? game.moveMeta[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? (classCodes[ply - 1] ?? null) : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Retrospective "best was" text (CoachCard): only surfaced when the played
	// move was one of the NOT_BEST classifications and mock data has an entry.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;

	// Prospective board arrow: the engine's top suggestion computed FROM the
	// position currently on screen, for whichever move comes next -- always
	// shown when available, independent of classCode, for any loaded game.
	const nextBest = bestMoves[ply + 1] ?? null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + game.sanList[ply - 1] : 'Start';
	const coachText =
		ply === 0 ? INTRO_COACH_TEXT : classCode ? COACH_TEXT_MAP[classCode] : UNCLASSIFIED_COACH_TEXT;

	return {
		position,
		lastMove,
		classCode,
		best,
		nextBest,
		evalNum,
		evalStr,
		whitePct,
		coachMove,
		coachText
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts
git commit -m "feat: getReviewPly classifies from real classCodes, not the isSample mock gate"
```

---

## Task 4: `AnalysisTab.svelte` + `MoveList.svelte` — real classification in the move list and coach card

**Files:**
- Modify: `src/lib/components/AnalysisTab.svelte`
- Modify: `src/lib/components/MoveList.svelte`
- Modify: `src/lib/components/MoveList.test.ts`
- Modify: `src/lib/components/AnalysisTab.test.ts`

**Interfaces:**
- Consumes: `appState.classCodes: ClassCode[]` (Task 2); `getReviewPly`'s new 5th parameter (Task 3).
- Produces: `MoveList`'s `Props` drops `isSample: boolean`, adds `classCodes: ClassCode[]` — no other component depends on `MoveList`'s prop shape.

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/components/MoveList.test.ts` entirely:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MoveList from './MoveList.svelte';
import type { ClassCode } from '$lib/types';

// Italian Game move list (31 plies), matching this repo's other sample-game fixtures.
const sanList = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];
const classCodes: ClassCode[] = Array(31).fill('best');

describe('MoveList', () => {
	it('renders 16 rows with move-number gutter', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList, classCodes }
		});
		expect(container.querySelectorAll('.row')).toHaveLength(16);
		expect(container.textContent).toContain('1.');
		expect(container.textContent).toContain('16.');
	});

	it('marks the cell matching selectedPly as selected via data-sb-sel', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 31, onSelectPly: () => {}, sanList, classCodes }
		});
		expect(container.querySelector('[data-sb-sel="1"]')).not.toBeNull();
	});

	it('calls onSelectPly with the clicked ply', () => {
		const onSelectPly = vi.fn();
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly, sanList, classCodes }
		});
		const firstWhiteCell = container.querySelector('.cell') as HTMLElement;
		firstWhiteCell.click();
		expect(onSelectPly).toHaveBeenCalledWith(1);
	});

	it('renders no black cell in the final (odd-move-count) row', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 31, onSelectPly: () => {}, sanList, classCodes }
		});
		const rows = container.querySelectorAll('.row');
		const lastRow = rows[rows.length - 1];
		expect(lastRow.querySelectorAll('.cell')).toHaveLength(1); // white only — sanList has 31 plies
	});

	it('does not show a classification badge for a ply with no classCodes entry (analysis not ready)', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: [] }
		});
		expect(container.querySelectorAll('.badge')).toHaveLength(0);
	});

	it('shows a classification badge for every ply that has a real classCodes entry', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: ['excellent', 'blunder'] }
		});
		expect(container.querySelectorAll('.badge')).toHaveLength(2);
	});

	it('still highlights the selected cell when classCodes is empty', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 1, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: [] }
		});
		const selected = container.querySelector('[data-sb-sel="1"]') as HTMLElement;
		expect(selected).not.toBeNull();
		expect(selected.getAttribute('style')).toContain('background: rgba(45, 224, 206, 0.14)');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/MoveList.test.ts`
Expected: FAIL — `MoveList` still requires `isSample`, not `classCodes`; badge visibility is still gated on `isSample`, so the "no classCodes entry" / "real classCodes entry" tests don't match.

- [ ] **Step 3: Rewrite `MoveList.svelte`'s script block and template**

Replace the `<script>` block in `src/lib/components/MoveList.svelte`:

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		selectedPly: number;
		onSelectPly: (ply: number) => void;
		sanList: string[];
		classCodes: ClassCode[];
	}

	let { selectedPly, onSelectPly, sanList, classCodes }: Props = $props();

	interface Row {
		num: string;
		wPly: number;
		bPly: number | null;
		striped: boolean;
	}

	const rows: Row[] = $derived(
		Array.from({ length: Math.ceil(sanList.length / 2) }, (_, i) => {
			const wPly = 2 * i + 1;
			const bPly = 2 * i + 2;
			return {
				num: i + 1 + '.',
				wPly,
				bPly: bPly <= sanList.length ? bPly : null,
				striped: i % 2 === 1
			};
		})
	);

	function cellStyle(sel: boolean, code: ClassCode | null): string {
		if (sel) {
			return 'background:rgba(45,224,206,.14);color:#5EF0DE;font-weight:600;box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);';
		}
		return code ? `color:${TOKENS.review.moveTint[code]};` : '';
	}

	let listEl: HTMLDivElement | undefined = $state();

	// Reference _syncMoveScroll (SecondBoard.dc.html lines 822-830): manual
	// scrollTop adjustment, NOT scrollIntoView, run after each ply change.
	$effect(() => {
		void selectedPly;
		requestAnimationFrame(() => {
			const c = listEl;
			if (!c) return;
			const row = c.querySelector('[data-sb-sel="1"]');
			if (!row) return;
			const delta = row.getBoundingClientRect().top - c.getBoundingClientRect().top - 2;
			c.scrollTop += delta;
		});
	});
</script>
```

Replace the template body (everything inside `<div class="move-list" ...>`):

```svelte
<div class="move-list sbscroll" bind:this={listEl} data-sb-movelist="1">
	{#each rows as row (row.wPly)}
		<div class="row" class:striped={row.striped}>
			<span class="num sbmono">{row.num}</span>
			<div
				class="cell"
				data-sb-sel={selectedPly === row.wPly ? '1' : '0'}
				style={cellStyle(selectedPly === row.wPly, classCodes[row.wPly - 1] ?? null)}
				onclick={() => onSelectPly(row.wPly)}
			>
				{#if classCodes[row.wPly - 1]}
					<ClassBadge classCode={classCodes[row.wPly - 1]} size={16} />
				{/if}
				<span class="san sbmono">{sanList[row.wPly - 1]}</span>
			</div>
			{#if row.bPly !== null}
				<div
					class="cell"
					data-sb-sel={selectedPly === row.bPly ? '1' : '0'}
					style={cellStyle(selectedPly === row.bPly, classCodes[row.bPly - 1] ?? null)}
					onclick={() => onSelectPly(row.bPly!)}
				>
					{#if classCodes[row.bPly - 1]}
						<ClassBadge classCode={classCodes[row.bPly - 1]} size={16} />
					{/if}
					<span class="san sbmono">{sanList[row.bPly - 1]}</span>
				</div>
			{:else}
				<div></div>
			{/if}
		</div>
	{/each}
</div>
```

(The `<style>` block is unchanged.)

- [ ] **Step 4: Run `MoveList` tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/MoveList.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Update `AnalysisTab.svelte` to pass real `classCodes` through**

Update the failing caller test first — in `src/lib/components/AnalysisTab.test.ts`, no test code needs to change (it doesn't assert on badges), but running the suite now will fail on the `MoveList` prop-shape mismatch. Confirm by running:

Run: `pnpm exec vitest run src/lib/components/AnalysisTab.test.ts`
Expected: FAIL — Svelte warns/throws that `MoveList` no longer accepts `isSample` as a valid prop (or, depending on strictness, simply passes it through unused while `classCodes` is `undefined`), and `getReviewPly`'s classification no longer resolves the same way.

Modify `src/lib/components/AnalysisTab.svelte`:

```svelte
<script lang="ts">
	import { getReviewPly } from '$lib/game/review';
	import { appState } from '$lib/stores/app-state.svelte';
	import CoachCard from './CoachCard.svelte';
	import MoveList from './MoveList.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		ply: number;
		onSelectPly: (ply: number) => void;
		onNext: () => void;
	}

	let { ply, onSelectPly, onNext }: Props = $props();

	const data = $derived(
		getReviewPly(ply, appState.game!, appState.evalPerPly, appState.bestMoves, appState.classCodes)
	);
</script>
```

Replace the `<MoveList ... />` call:

```svelte
	<MoveList
		selectedPly={ply}
		{onSelectPly}
		sanList={appState.game!.sanList}
		classCodes={appState.classCodes}
	/>
```

(Everything else in the file — the `coach-slot`/`actions` markup and the `<style>` block — is unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/AnalysisTab.test.ts src/lib/components/MoveList.test.ts`
Expected: PASS — all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AnalysisTab.svelte src/lib/components/MoveList.svelte src/lib/components/MoveList.test.ts
git commit -m "feat: MoveList and AnalysisTab render real per-move classification"
```

---

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

## Task 6: `ReviewPanel.svelte` + `ReviewTab.svelte` + `BottomBar.svelte` — real classification on the eval graph

**Files:**
- Modify: `src/lib/components/ReviewPanel.svelte`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`
- Modify: `src/lib/components/BottomBar.svelte`
- Modify: `src/lib/components/BottomBar.test.ts`

**Interfaces:**
- Consumes: `appState.classCodes: ClassCode[]` (Task 2).
- Produces: `ReviewTab`'s and `BottomBar`'s `Props` gain a `classCodes: ClassCode[]` field, passed down from `ReviewPanel.svelte`.

- [ ] **Step 1: Check the existing `ReviewTab`/`BottomBar` tests for `CLASS_CODES`-dependent assertions**

Read `src/lib/components/ReviewTab.test.ts` and `src/lib/components/BottomBar.test.ts`. Neither currently asserts on evaluation-dot colors/positions (those are covered by `eval-graph.test.ts`'s unit tests, already passing pure-function tests unaffected by this task), so no test assertions need to change — only the render call's props, to supply the now-required `classCodes` prop instead of relying on the component's own `CLASS_CODES` import.

- [ ] **Step 2: Update `ReviewTab.test.ts`'s render calls**

In `src/lib/components/ReviewTab.test.ts`, add `classCodes: []` to every `render(ReviewTab, { props: { ... } })` call's props object (there are 4 such calls in the file, one per `it` block).

- [ ] **Step 3: Update `BottomBar.test.ts`'s render calls**

Read `src/lib/components/BottomBar.test.ts` and add `classCodes: []` to every `render(BottomBar, { props: { ... } })` call's props object, the same way.

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.test.ts`
Expected: FAIL — both components' `Props` interfaces don't declare `classCodes` yet, so passing it does nothing useful yet and (depending on strict prop checking) Svelte may warn about an unknown prop; more importantly the components still import the mock `CLASS_CODES` directly, so this step's purpose is to lock in the target prop shape before Step 5 removes the mock import (at which point omitting the prop in a test would genuinely break the eval graph). Confirm the file still compiles/runs at this point — this is a preparatory step, not a strict red/green boundary, so "FAIL" here may simply mean "unchanged" if Svelte allows the extra prop silently; either way, do not skip ahead until Step 5's import removal is in place, because that is what makes `classCodes` mandatory.

- [ ] **Step 5: Update `ReviewTab.svelte`**

Replace the `<script>` block:

```svelte
<script lang="ts">
	import { getAccuracySummary } from '$lib/game/review';
	import type { ClassCode } from '$lib/types';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, analyzing = false }: Props = $props();
</script>
```

Note: `appState` is no longer imported directly here — check whether it's still used elsewhere in the file (the `accuracy` derivation reads `appState.game!`/`appState.analysisStatus`). Keep that import; only the `CLASS_CODES` import from `$lib/game/mock-data` is removed. The full corrected script block, preserving the existing `accuracy` derivation:

```svelte
<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import { getAccuracySummary } from '$lib/game/review';
	import type { ClassCode } from '$lib/types';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, analyzing = false }: Props = $props();

	// Only feed the real evalPerPly in once analysis has actually finished;
	// otherwise (idle/loading/error) pass an empty array so
	// computeGameAccuracy's own length<2 guard returns null/null, rendering
	// "—" instead of a fabricated 100.0 from the seeded all-zero placeholder
	// evalPerPly that startReview() writes before analysis completes.
	const accuracy = $derived(
		getAccuracySummary(appState.game!, appState.analysisStatus === 'ready' ? evalPerPly : [])
	);
</script>
```

Update the `<EvalGraph ... />` call:

```svelte
			<EvalGraph {evalPerPly} {classCodes} {ply} height={66} />
```

- [ ] **Step 6: Update `BottomBar.svelte`**

Replace the `<script>` block:

```svelte
<script lang="ts">
	import type { ClassCode } from '$lib/types';
	import EvalGraph from './EvalGraph.svelte';
	import NavControls from './NavControls.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		onFirst: () => void;
		onPrev: () => void;
		onNext: () => void;
		onLast: () => void;
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, onFirst, onPrev, onNext, onLast, analyzing = false }: Props = $props();
</script>
```

Update the `<EvalGraph ... />` call:

```svelte
			<EvalGraph {evalPerPly} {classCodes} {ply} height={62} />
```

- [ ] **Step 7: Update `ReviewPanel.svelte` to pass `appState.classCodes` down**

Modify the `<ReviewTab ... />` call in `src/lib/components/ReviewPanel.svelte`:

```svelte
	<ReviewTab
		ply={appState.ply}
		evalPerPly={appState.evalPerPly}
		classCodes={appState.classCodes}
		analyzing={appState.analysisStatus === 'loading'}
	/>
```

Modify the `<BottomBar ... />` call:

```svelte
		<BottomBar
			ply={appState.ply}
			evalPerPly={appState.evalPerPly}
			classCodes={appState.classCodes}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(getMaxPly())}
			analyzing={appState.analysisStatus === 'loading'}
		/>
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.test.ts`
Expected: PASS — all green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/ReviewPanel.svelte src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.svelte src/lib/components/BottomBar.test.ts
git commit -m "feat: eval graph (ReviewTab/BottomBar) renders real per-move classification"
```

---

## Task 7: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Run the full frontend test suite**

Run: `pnpm exec vitest run`
Expected: PASS, 0 failures.

- [ ] **Step 2: Run typecheck and lint**

Run: `pnpm check`
Run: `pnpm lint`
Expected: both clean. In particular, confirm no remaining unused-import lint errors for `CLASS_CODES` in `MoveList.svelte`, `ReviewTab.svelte`, or `BottomBar.svelte` — Task 4/6 removed all three imports.

- [ ] **Step 3: Confirm `mock-data.ts`'s `CLASS_CODES` export is still used**

Run: `grep -rn "CLASS_CODES" src/lib`
Expected: only remaining references are `mock-data.ts` (the export itself), `mock-data.test.ts` (its own unit test), and `review.ts` (the default-parameter fallback for `getReviewPly`'s `classCodes` argument, kept intentionally so existing callers that don't pass a 5th argument — e.g. any test still calling `getReviewPly(ply, game)` with only 2 args — keep working). If any other file still imports `CLASS_CODES` directly, that's a missed call site from Tasks 4-6 — fix it before proceeding.

- [ ] **Step 4: Launch the real app and visually confirm**

Run: `pnpm exec tauri dev`

Confirm, against the built-in sample game once analysis finishes:
1. The Analysis tab's move list shows a classification badge on every move (not just the ones the old mock happened to cover), and the badges' colors match the eval swings shown in the eval graph.
2. Paste a different, non-sample PGN via "New PGN" — confirm its move list also gets real classification badges once analysis completes (previously it showed none at all).
3. While analysis is still loading (briefly, right after pasting), confirm no misleading "all Best" badges flash before real analysis lands — the move list and eval graph should show no badges until `analysisStatus` reaches `'ready'`.

Report any visual mismatch as a follow-up fix — do not silently accept a mismatch.
