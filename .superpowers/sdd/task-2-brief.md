## Task 2: Mock game data + mock chess engine (replaces `dev-fixtures.ts`)

**Files:**
- Create: `src/lib/game/mock-engine.ts`
- Create: `src/lib/game/mock-data.ts`
- Test: `src/lib/game/mock-engine.test.ts`
- Test: `src/lib/game/mock-data.test.ts`
- Delete: `src/lib/board/dev-fixtures.ts`, `src/lib/board/dev-fixtures.test.ts`

**Interfaces:**
- Consumes: `Position`, `Move`, `Piece` from `$lib/board/types`; `ClassCode` from `$lib/types`.
- Produces:
  - `mock-engine.ts`: `buildGame(sanList: string[]): { positions: Position[]; meta: Move[] }` (same signature `src/lib/board/dev-fixtures.ts` had internally, now exported).
  - `mock-data.ts`: `SAN_LIST: string[]`, `CLASS_CODES: ClassCode[]`, `EVAL_PER_PLY: number[]`, `BEST_MOVES: Record<number, Move & { san: string }>`, `COACH_TEXT_MAP: Record<ClassCode, string>`, `BREAKDOWN_ROWS: Array<[ClassCode, number, number]>`, `PHASE_ROWS: Array<[string, ClassCode, ClassCode]>`, `PLAYERS: { white: PlayerInfo; black: PlayerInfo }` where
    ```ts
    export interface PlayerInfo {
    	name: string;
    	rating: string;
    	initial: string;
    	clock: string;
    	accuracy: string;
    	gameRating: string;
    }
    ```

This task is **mechanical transcription**: `src/lib/board/dev-fixtures.ts` already contains a byte-for-byte port of `chess-mock.js` (the engine half) and part of `data.js` (the game half). Read it first (it still exists on disk at task-start time) and split it into the two new files, then add the additional `data.js` fields (`coachTextMap`, `breakdown`, `phases`, `players`) that `dev-fixtures.ts` never needed.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/game/mock-engine.test.ts
import { describe, it, expect } from 'vitest';
import { buildGame } from './mock-engine';

describe('buildGame', () => {
	it('produces one more position than the move count, starting from the standard array', () => {
		const { positions, meta } = buildGame(['e4', 'e5', 'Nf3']);
		expect(positions).toHaveLength(4);
		expect(meta).toHaveLength(3);
		expect(positions[0].e2).toEqual(['P', 'w']);
		expect(positions[1].e4).toEqual(['P', 'w']);
		expect(positions[1].e2).toBeUndefined();
		expect(meta[0]).toEqual({ from: 'e2', to: 'e4' });
	});

	it('handles castling by moving both king and rook', () => {
		const { positions } = buildGame(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
		const final = positions[positions.length - 1];
		expect(final.g1).toEqual(['K', 'w']);
		expect(final.f1).toEqual(['R', 'w']);
		expect(final.e1).toBeUndefined();
		expect(final.h1).toBeUndefined();
	});
});
```

```ts
// src/lib/game/mock-data.test.ts
import { describe, it, expect } from 'vitest';
import {
	SAN_LIST,
	CLASS_CODES,
	EVAL_PER_PLY,
	BEST_MOVES,
	COACH_TEXT_MAP,
	BREAKDOWN_ROWS,
	PHASE_ROWS,
	PLAYERS
} from './mock-data';

describe('mock-data', () => {
	it('keeps classCodes/evalPerPly aligned in length with sanList', () => {
		expect(CLASS_CODES).toHaveLength(SAN_LIST.length);
		expect(EVAL_PER_PLY).toHaveLength(SAN_LIST.length + 1); // includes ply 0
	});

	it('has a coach text entry for every classification code', () => {
		for (const code of CLASS_CODES) {
			expect(COACH_TEXT_MAP[code]).toBeTruthy();
		}
	});

	it('has 10 breakdown rows and 3 phase rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
		expect(PHASE_ROWS).toHaveLength(3);
	});

	it('defines both players with a gameRating', () => {
		expect(PLAYERS.white.gameRating).toBe('1712');
		expect(PLAYERS.black.gameRating).toBe('1994');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/game/`
Expected: FAIL (modules don't exist).

- [ ] **Step 3: Create `src/lib/game/mock-engine.ts`**

Move the `standardBoard`/`clearPath`/`canReach`/`applySan`/`buildGame` functions verbatim from `src/lib/board/dev-fixtures.ts` (lines 20-139 of that file) into this new file, exporting `buildGame`. Keep the same banner style but update the scope note:

```ts
/**
 * ============================================================================
 * MOCK — SAN-to-position engine. NOT PRODUCT LOGIC LONG-TERM.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/chess-mock.js.
 * LOGIC.md explicitly warns this is a MOCK: "In the REAL app you MUST NOT
 * ship this — replace it with the Rust `pgn` module using `shakmaty`"
 * (README §3, §8; LOGIC.md header table). It feeds the Game Review screen's
 * mock data (Iteration 4, README §11 step 4) until the Rust backend + shakmaty
 * land (README §11 steps 5-6), at which point this file is deleted.
 */
import type { Move, Piece, Position } from '$lib/board/types';

const FILES = 'abcdefgh';

// [standardBoard, clearPath, canReach, applySan, buildGame — copied verbatim
//  from src/lib/board/dev-fixtures.ts's identical functions]
```

(The implementer copies the five functions' bodies unchanged — they are pure and already TypeScript-strict from Iteration 3; only the import path for `Move`/`Piece`/`Position` changes from `'./types'` to `'$lib/board/types'`.)

- [ ] **Step 4: Create `src/lib/game/mock-data.ts`**

```ts
/**
 * ============================================================================
 * MOCK CONTENT — the sample Italian Game shown by the Game Review screen.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/data.js.
 * sanList/classCodes/evalPerPly/bestMoves stand in for Rust pgn+analysis+
 * engine output (README §8 mapping table). coachTextMap/breakdown/phases/
 * players stand in for backend-computed screen content (same table). Replace
 * piece by piece as each real data source lands (README §11 steps 5-8);
 * CLS itself (name/word/color/glyph) is NOT mock — that already lives in
 * TOKENS.classification (src/lib/tokens.ts) and must not be redeclared here.
 */
import type { ClassCode } from '$lib/types';
import type { Move } from '$lib/board/types';
import { buildGame } from './mock-engine';

export const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];

export const CLASS_CODES: ClassCode[] = [
	'book', 'book', 'book', 'book', 'book', 'book', 'best', 'good', 'good', 'good',
	'best', 'best', 'good', 'inaccuracy', 'best', 'good', 'good', 'good', 'best',
	'good', 'good', 'good', 'excellent', 'good', 'best', 'good', 'great', 'good',
	'best', 'inaccuracy', 'brilliant'
];

export const EVAL_PER_PLY = [
	0, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.35, 0.25, 0.3, 0.25, 0.3, 0.3, 0.35, 0.1,
	0.4, 0.3, 0.35, 0.3, 0.5, 0.4, 0.45, 0.3, 0.7, 0.55, 0.8, 0.7, 1.3, 1.05, 1.5,
	1.0, 2.37
];

export const BEST_MOVES: Record<number, Move & { san: string }> = {
	14: { from: 'c8', to: 'g4', san: 'Bg4' },
	30: { from: 'f6', to: 'g4', san: 'Ng4' }
};

export const COACH_TEXT_MAP: Record<ClassCode, string> = {
	brilliant:
		"This move creates a strong threat and keeps control of the center. The knight can't be captured without losing material.",
	great: 'The strongest move on the board — precise and forcing.',
	best: "Engine's top choice. Nothing better in the position.",
	excellent: 'Nearly perfect — it keeps your advantage fully intact.',
	good: 'A solid, healthy move that maintains the balance.',
	book: 'Still following well-known opening theory.',
	inaccuracy: 'A small slip — there was a more accurate continuation here.',
	mistake: 'This lets your opponent back into the game.',
	miss: 'You overlooked a much stronger tactic in this position.',
	blunder: 'A costly error — this swings the evaluation sharply.'
};

export const BREAKDOWN_ROWS: Array<[ClassCode, number, number]> = [
	['brilliant', 1, 2],
	['great', 2, 5],
	['best', 22, 20],
	['excellent', 13, 12],
	['good', 8, 12],
	['book', 6, 6],
	['inaccuracy', 4, 3],
	['mistake', 3, 2],
	['miss', 2, 1],
	['blunder', 2, 1]
];

export const PHASE_ROWS: Array<[string, ClassCode, ClassCode]> = [
	['Opening', 'great', 'good'],
	['Middlegame', 'best', 'excellent'],
	['Endgame', 'inaccuracy', 'good']
];

export interface PlayerInfo {
	name: string;
	rating: string;
	initial: string;
	clock: string;
	accuracy: string;
	gameRating: string;
}

export const PLAYERS: { white: PlayerInfo; black: PlayerInfo } = {
	white: {
		name: 'Jonas',
		rating: '1867',
		initial: 'J',
		clock: '4:12',
		accuracy: '82.6',
		gameRating: '1712'
	},
	black: {
		name: 'DominikP',
		rating: '2043',
		initial: 'D',
		clock: '3:47',
		accuracy: '89.1',
		gameRating: '1994'
	}
};

const built = buildGame(SAN_LIST);
export const MOCK_POSITIONS = built.positions;
export const MOCK_MOVE_META = built.meta;
```

- [ ] **Step 5: Delete the Iteration-3 harness files**

```bash
git rm src/lib/board/dev-fixtures.ts src/lib/board/dev-fixtures.test.ts
```

- [ ] **Step 6: Run tests to verify they pass and nothing else references the deleted files**

Run: `npm run test -- --run`
Expected: `src/lib/game/*.test.ts` pass; no failures from a stale import of `$lib/board/dev-fixtures` (Task 19 rewires `+page.svelte`, which is the only other consumer — confirm with a repo-wide search before considering this task done: `grep -rn "dev-fixtures" src/`. If `+page.svelte` still imports it, that's expected until Task 19 — the app will fail to build/typecheck in the interim, which is acceptable mid-plan and resolved by Task 19).

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/mock-engine.ts src/lib/game/mock-data.ts src/lib/game/mock-engine.test.ts src/lib/game/mock-data.test.ts
git commit -m "feat: add mock game engine and Italian Game review data"
```

---

