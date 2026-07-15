## Task 3: Game review per-ply derivation logic

**Files:**
- Create: `src/lib/game/review.ts`
- Test: `src/lib/game/review.test.ts`

**Interfaces:**
- Consumes: `MOCK_POSITIONS`, `MOCK_MOVE_META`, `CLASS_CODES`, `EVAL_PER_PLY`, `BEST_MOVES`, `PLAYERS` from `./mock-data`; `capturedInfo`, `evalBarPct` from `$lib/board/geometry`; `TOKENS`, `NOT_BEST_CODES` from `$lib/tokens`; `Position`, `Move` from `$lib/board/types`; `ClassCode` from `$lib/types`.
- Produces:
  ```ts
  export interface ReviewPly {
  	position: Position;
  	lastMove: Move | null;
  	classCode: ClassCode | null; // null only at ply 0
  	best: (Move & { san: string }) | null;
  	evalNum: number;
  	evalStr: string; // '+0.30' style, signed
  	whitePct: number; // 0-100
  	coachMove: string; // '16. Ne5' / '15... d5' / 'Start'
  	coachText: string;
  }

  export function getReviewPly(ply: number): ReviewPly;

  export interface PlayerRowData {
  	name: string;
  	rating: string;
  	initial: string;
  	isWhite: boolean;
  	clock: string;
  	clockActive: boolean;
  	captured: Array<{ color: 'w' | 'b'; type: 'P' | 'N' | 'B' | 'R' | 'Q' }>;
  	adv: string | null; // '+3' or null
  }

  export function getPlayerRows(
  	ply: number,
  	flipped: boolean
  ): { top: PlayerRowData; bottom: PlayerRowData };
  ```

This is the one task in this iteration requiring judgment (porting `renderVals()`'s per-ply branch logic, lines 1221-1262 of the reference, into idiomatic derived functions rather than one giant object literal).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/game/review.test.ts
import { describe, it, expect } from 'vitest';
import { getReviewPly, getPlayerRows } from './review';

describe('getReviewPly', () => {
	it('ply 0 has no lastMove/classCode and the intro coach text', () => {
		const r = getReviewPly(0);
		expect(r.lastMove).toBeNull();
		expect(r.classCode).toBeNull();
		expect(r.coachMove).toBe('Start');
		expect(r.coachText).toBe(
			'The game begins. Step through with the arrows or arrow keys to see every move classified.'
		);
		expect(r.evalStr).toBe('+0.00');
	});

	it('ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"', () => {
		const r = getReviewPly(1);
		expect(r.classCode).toBe('book');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('a black ply renders "N... san" with the ellipsis separator', () => {
		const r = getReviewPly(2); // 1...e5
		expect(r.coachMove).toBe('1... e5');
	});

	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy
		expect(getReviewPly(1).best).toBeNull(); // book, not a NOT_BEST code
	});

	it('computes whitePct via evalBarPct semantics (50 + clamp(ev/8*44))', () => {
		const r = getReviewPly(31); // eval 2.37
		expect(r.whitePct).toBeCloseTo(50 + Math.min(44, (2.37 / 8) * 44), 5);
	});
});

describe('getPlayerRows', () => {
	it('unflipped: Black on top, White on bottom (whiteAtBottom)', () => {
		const { top, bottom } = getPlayerRows(31, false);
		expect(top.name).toBe('DominikP');
		expect(bottom.name).toBe('Jonas');
	});

	it('flipped: White on top, Black on bottom', () => {
		const { top, bottom } = getPlayerRows(31, true);
		expect(top.name).toBe('Jonas');
		expect(bottom.name).toBe('DominikP');
	});

	it('highlights the clock of the side to move (odd ply = Black to move)', () => {
		const { top, bottom } = getPlayerRows(1, false); // ply 1 -> Black to move next
		expect(top.name).toBe('DominikP');
		expect(top.clockActive).toBe(true);
		expect(bottom.clockActive).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/game/review.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/game/review.ts`**

```ts
/**
 * Per-ply derivation for the Game Review screen — the equivalent of the
 * reference Component's renderVals() (SecondBoard.dc.html lines 1221-1262),
 * ported to plain functions operating on the mock data in ./mock-data.
 * Feeds real Rust analysis/pgn output in later iterations without changing
 * callers (README §8; LOGIC.md §7).
 */
import { capturedInfo, evalBarPct } from '$lib/board/geometry';
import type { Move, Position } from '$lib/board/types';
import type { ClassCode } from '$lib/types';
import { NOT_BEST_CODES, TOKENS } from '$lib/tokens';
import {
	BEST_MOVES,
	COACH_TEXT_MAP,
	EVAL_PER_PLY,
	CLASS_CODES,
	MOCK_MOVE_META,
	MOCK_POSITIONS,
	PLAYERS,
	SAN_LIST
} from './mock-data';

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

export function getReviewPly(ply: number): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMeta = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;
	const evalNum = EVAL_PER_PLY[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	const best = ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (BEST_MOVES[ply] ?? null) : null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + SAN_LIST[ply - 1] : 'Start';
	const coachText = ply > 0 && classCode ? COACH_TEXT_MAP[classCode] : INTRO_COACH_TEXT;

	return {
		position,
		lastMove: lastMeta,
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
	captured: Array<{ color: 'w' | 'b'; type: 'P' | 'N' | 'B' | 'R' | 'Q' }>;
	adv: string | null;
}

export function getPlayerRows(ply: number, flipped: boolean): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = MOCK_POSITIONS[ply];
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

Note: `TOKENS` is imported but unused directly in this file's logic (classification colors are looked up by the *components* via `TOKENS.classification[classCode]`, not precomputed here) — remove the unused import if `tsc`/eslint flags it; keep `NOT_BEST_CODES`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/game/review.test.ts`
Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts
git commit -m "feat: add per-ply review data derivation"
```

---

