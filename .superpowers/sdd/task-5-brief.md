## Task 5: `review.ts` rewrite — `GameData`, real position/move consumption

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`
- Modify: `src/lib/components/GameReviewScreen.svelte`
- Modify: `src/lib/components/AnalysisTab.svelte`

**Interfaces:**
- Consumes: `AppState.game` (Task 4, may be `null` before any game loads — components only read it after `gameLoaded` is true, guaranteed non-null by then).
- Produces (used by Task 6 and already consumed by Task 4): 
  ```ts
  export interface GameData {
      sanList: string[];
      positions: Position[];
      moveMeta: Move[];
      isSample: boolean;
  }
  export const UNCLASSIFIED_COACH_TEXT: string;
  export function getReviewPly(ply: number, game: GameData, evalPerPly?: number[], bestMoves?: Record<number, Move & {san:string}>): ReviewPly;
  export function getPlayerRows(ply: number, flipped: boolean, game: GameData): {top: PlayerRowData; bottom: PlayerRowData};
  ```

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/game/review.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest';
import { getReviewPly, getPlayerRows, type GameData } from './review';

// moveMeta has 31 entries (index i = the move that produced ply i+1). Only
// plies 1, 2, and 31 are ever asserted on below, so every other entry is an
// inert placeholder — real values only where a test actually checks them.
const sampleMoveMeta = Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }));
sampleMoveMeta[0] = { from: 'e2', to: 'e4' }; // ply 1
sampleMoveMeta[1] = { from: 'e7', to: 'e5' }; // ply 2
sampleMoveMeta[30] = { from: 'f6', to: 'e5' }; // ply 31

const sampleGame: GameData = {
	sanList: [
		'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6',
		'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1', 'Qe7', 'Ng3', 'Rad8', 'd4',
		'exd4', 'cxd4', 'd5', 'Ne5'
	],
	positions: Array.from({ length: 32 }, () => ({})), // content unused by these tests
	moveMeta: sampleMoveMeta,
	isSample: true
};

const notSampleGame: GameData = {
	sanList: ['d4', 'd5'],
	positions: [{}, {}, {}],
	moveMeta: [
		{ from: 'd2', to: 'd4' },
		{ from: 'd7', to: 'd5' }
	],
	isSample: false
};

describe('getReviewPly', () => {
	it('ply 0 has no lastMove/classCode and the intro coach text', () => {
		const r = getReviewPly(0, sampleGame);
		expect(r.lastMove).toBeNull();
		expect(r.classCode).toBeNull();
		expect(r.coachMove).toBe('Start');
		expect(r.coachText).toBe(
			'The game begins. Step through with the arrows or arrow keys to see every move classified.'
		);
		expect(r.evalStr).toBe('+0.00');
	});

	it('ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"', () => {
		const r = getReviewPly(1, sampleGame);
		expect(r.classCode).toBe('book');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('a black ply renders "N... san" with the ellipsis separator', () => {
		const r = getReviewPly(2, sampleGame); // 1...e5
		expect(r.coachMove).toBe('1... e5');
	});

	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14, sampleGame).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy
		expect(getReviewPly(1, sampleGame).best).toBeNull(); // book, not a NOT_BEST code
	});

	it('computes whitePct via evalBarPct semantics (50 + clamp(ev/8*44))', () => {
		const r = getReviewPly(31, sampleGame); // eval 2.37
		expect(r.whitePct).toBeCloseTo(50 + Math.min(44, (2.37 / 8) * 44), 5);
	});

	it('accepts explicit evalPerPly/bestMoves overrides instead of the static mock arrays', () => {
		const r = getReviewPly(1, sampleGame, [0, 99], {});
		expect(r.evalNum).toBe(99);
		expect(r.evalStr).toBe('+99.00');
	});

	it('does not apply classification/coach text to a non-sample game', () => {
		const r = getReviewPly(1, notSampleGame);
		expect(r.classCode).toBeNull();
		expect(r.best).toBeNull();
		expect(r.coachText).toBe(
			"Move classification isn't available yet for pasted games — only the built-in sample game is fully analyzed in this preview."
		);
		expect(r.coachMove).toBe('1. d4'); // sanList is still real regardless of isSample
	});
});

describe('getPlayerRows', () => {
	it('unflipped: Black on top, White on bottom (whiteAtBottom)', () => {
		const { top, bottom } = getPlayerRows(31, false, sampleGame);
		expect(top.name).toBe('DominikP');
		expect(bottom.name).toBe('Jonas');
	});

	it('flipped: White on top, Black on bottom', () => {
		const { top, bottom } = getPlayerRows(31, true, sampleGame);
		expect(top.name).toBe('Jonas');
		expect(bottom.name).toBe('DominikP');
	});

	it('highlights the clock of the side to move (odd ply = Black to move)', () => {
		const { top, bottom } = getPlayerRows(1, false, sampleGame); // ply 1 -> Black to move next
		expect(top.name).toBe('DominikP');
		expect(top.clockActive).toBe(true);
		expect(bottom.clockActive).toBe(false);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getReviewPly`'s current signature doesn't accept a `game` argument yet; `GameData` isn't exported yet.

- [ ] **Step 3: Rewrite `review.ts`**

Replace `src/lib/game/review.ts` entirely with:

```ts
/**
 * Per-ply derivation for the Game Review screen — the equivalent of the
 * reference Component's renderVals() (SecondBoard.dc.html lines 1221-1262).
 * Positions/moves/SAN now come from the real Rust `pgn` module's parse of
 * whatever game is loaded (`GameData`, Iteration 6) instead of a hardcoded
 * mock array. Move classification/coach text/best-move suggestions remain
 * mocked (CLASS_CODES/COACH_TEXT_MAP/BEST_MOVES in ./mock-data) and are
 * applied ONLY when `game.isSample` is true — i.e. the loaded PGN is
 * byte-identical to the one known sample game those mocks describe. A
 * genuinely different real pasted game gets real positions/moves but no
 * (rather than misleading) classification (README §11 step 6 scope).
 */
import { capturedInfo, evalBarPct } from '$lib/board/geometry';
import type { Move, PieceColor, PieceType, Position } from '$lib/board/types';
import type { ClassCode } from '$lib/types';
import { NOT_BEST_CODES } from '$lib/tokens';
import { BEST_MOVES, COACH_TEXT_MAP, EVAL_PER_PLY, CLASS_CODES, PLAYERS } from './mock-data';

export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}

export interface ReviewPly {
	position: Position;
	lastMove: Move | null;
	classCode: ClassCode | null;
	best: (Move & { san: string }) | null;
	evalNum: number;
	evalStr: string;
	whitePct: number;
	coachMove: string;
	coachText: string;
}

const INTRO_COACH_TEXT =
	'The game begins. Step through with the arrows or arrow keys to see every move classified.';

export const UNCLASSIFIED_COACH_TEXT =
	"Move classification isn't available yet for pasted games — only the built-in sample game is fully analyzed in this preview.";

/**
 * Derives everything the Game Review screen needs to render a given ply:
 * the resulting position, the move that produced it, its classification,
 * the engine's suggested alternative (when the played move wasn't best),
 * the eval bar/number, and the coach card's move label + commentary.
 *
 * Mirrors the reference's renderVals() (lines 1221-1234, 1237-1239, 1325-1326).
 */
export function getReviewPly(
	ply: number,
	game: GameData,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES
): ReviewPly {
	const position = game.positions[ply];
	const lastMove = ply > 0 ? game.moveMeta[ply - 1] : null;
	const classCode: ClassCode | null =
		ply > 0 && game.isSample ? (CLASS_CODES[ply - 1] ?? null) : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;

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
		evalNum,
		evalStr,
		whitePct,
		coachMove,
		coachText
	};
}

export interface PlayerRowData {
	name: string;
	rating: string;
	initial: string;
	isWhite: boolean;
	clock: string;
	clockActive: boolean;
	captured: Array<{ color: PieceColor; type: PieceType }>;
	adv: string | null;
}

/**
 * Derives the two player-row descriptors (captured material, material
 * advantage chip, active clock) for a given ply, swapped top/bottom by the
 * `flipped` board orientation. Mirrors renderVals() lines 1244-1258. Player
 * name/rating/clock still come from the mocked `PLAYERS` (deliberately not
 * wired to real PGN tags this iteration — see the plan's Global Constraints).
 */
export function getPlayerRows(
	ply: number,
	flipped: boolean,
	game: GameData
): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = game.positions[ply];
	const cap = capturedInfo(position);
	const blackToMove = ply % 2 === 1;

	const white: PlayerRowData = {
		name: PLAYERS.white.name,
		rating: PLAYERS.white.rating,
		initial: PLAYERS.white.initial,
		isWhite: true,
		clock: PLAYERS.white.clock,
		clockActive: !blackToMove,
		captured: cap.whiteCap,
		adv: cap.adv > 0 ? '+' + cap.adv : null
	};
	const black: PlayerRowData = {
		name: PLAYERS.black.name,
		rating: PLAYERS.black.rating,
		initial: PLAYERS.black.initial,
		isWhite: false,
		clock: PLAYERS.black.clock,
		clockActive: blackToMove,
		captured: cap.blackCap,
		adv: cap.adv < 0 ? '+' + -cap.adv : null
	};

	const whiteAtBottom = !flipped;
	return whiteAtBottom ? { top: black, bottom: white } : { top: white, bottom: black };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: all tests pass.

- [ ] **Step 4b: Reconcile `app-state.svelte.ts`'s duplicate `GameData` definition**

Task 4 defined `GameData` locally inside `src/lib/stores/app-state.svelte.ts` because `review.ts` didn't have it yet at that point. Now that `review.ts` exports the real one, remove the local duplicate and import it instead. In `src/lib/stores/app-state.svelte.ts`, delete this block entirely:

```ts
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}
```

and change the import line:

```ts
import type { Move, Position } from '$lib/board/types';
```

to:

```ts
import type { GameData } from '$lib/game/review';
```

(`Move`/`Position` are no longer referenced directly in this file once the local `GameData` definition is gone — remove them from the import entirely rather than leaving an unused import. Double check: if `AppState`'s `bestMoves: Record<number, Move & { san: string }>` field still needs the `Move` type, keep `import type { Move } from '$lib/board/types';` alongside the new `GameData` import instead of removing it — check the file's actual remaining usages before deciding what to drop.)

Run: `pnpm vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts`
Expected: both still pass after the reconciliation (this is a pure refactor — same shape, different source module — so no test assertions should need to change).

- [ ] **Step 5: Update `GameReviewScreen.svelte` and `AnalysisTab.svelte` call sites**

In `src/lib/components/GameReviewScreen.svelte`, change:

```ts
	const data = $derived(getReviewPly(appState.ply, appState.evalPerPly, appState.bestMoves));
	const rows = $derived(getPlayerRows(appState.ply, appState.flipped));
```

to:

```ts
	const data = $derived(
		getReviewPly(appState.ply, appState.game!, appState.evalPerPly, appState.bestMoves)
	);
	const rows = $derived(getPlayerRows(appState.ply, appState.flipped, appState.game!));
```

(The non-null assertion is safe: `GameReviewScreen` only ever renders when `appState.gameLoaded` is true, which `startReview` — Task 4 — only sets after `appState.game` is successfully populated; see `src/routes/+page.svelte`'s existing `{#if appState.screen === 'review' && appState.gameLoaded}` guard.)

In `src/lib/components/AnalysisTab.svelte`, change:

```ts
	const data = $derived(getReviewPly(ply, appState.evalPerPly, appState.bestMoves));
```

to:

```ts
	const data = $derived(getReviewPly(ply, appState.game!, appState.evalPerPly, appState.bestMoves));
```

- [ ] **Step 6: Run the affected component tests**

Run: `pnpm vitest run src/lib/components/GameReviewScreen.test.ts src/lib/components/AnalysisTab.test.ts`
Expected: these will likely FAIL right now because their existing tests render the component WITHOUT first setting `appState.game` — this is expected and is fixed in the same step: open each test file and, in every `render(...)` call (or in a shared `beforeEach`), set `appState.game` to a valid `GameData` fixture (reuse a shape similar to `sampleGame` from Step 1 above, or a smaller one sufficient for that file's own assertions) before rendering. Add `import { appState } from '$lib/stores/app-state.svelte';` to each test file if not already imported. Do not skip this — get both files back to green before moving on.

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts \
  src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts \
  src/lib/components/GameReviewScreen.svelte src/lib/components/GameReviewScreen.test.ts \
  src/lib/components/AnalysisTab.svelte src/lib/components/AnalysisTab.test.ts
git commit -m "feat: wire review.ts to real per-game positions/moves via GameData"
```

---

