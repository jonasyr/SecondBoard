# Iteration 12: Attack-Based Brilliant Detection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Brilliant detection for real: Iteration 11's material-diff-window approach only ever catches a sacrifice that is *actually captured* within one ply. Re-examining chess.com's real classification of the reference game (`docs/references/DonaldByrne_RJamesFischer/`) at higher zoom revealed that Fischer's 3 Brilliants are `11...Na4`, `15...Nxc3`, and `17...Be6` — and `11...Na4` is *never captured at all* (White correctly declines, playing `12.Qa3` instead of `12.Qxa4`). A real "sound sacrifice" is a piece left *attacked* (en prise) that's still fine for the mover whether or not the opponent actually takes it — this can only be detected by checking board attack relationships (an "is this square currently attacked" query), not by diffing material across subsequent board snapshots. This iteration replaces the material-diff-window mechanism with a real (simplified) attack-detection module, and separately loosens Great's over-corrected "not already decided" guard.

**Architecture:** New pure module `src/lib/game/attacks.ts` (attacker/defender counting via standard piece-movement geometry, no external chess library). `classify.ts`'s Brilliant check switches from `isMaterialSacrifice`'s before/after-window diff to a single-position "is the piece the mover just placed on this square currently hanging" check. `material.ts`'s now-unused `isMaterialSacrifice` is removed (superseded); `materialForColor`/`PIECE_VALUES` are kept and `PIECE_VALUES` becomes exported for reuse.

**Tech Stack:** SvelteKit 5 (runes) + TypeScript + Vitest.

## Global Constraints

- `attacks.ts` implements "is square S attacked by color C" via direct board geometry (knight-offset table, king-offset table, sliding-piece ray-walking for rook/bishop/queen blocked by the first piece encountered, pawn diagonal-capture offsets) — no full legal-move generation, no check/pin awareness, no SEE (Static Exchange Evaluation) ordering. This is an explicit, documented simplification (mirrors `material.ts`'s own "no-SEE" disclosure from Iteration 10): "hanging" is defined as `attacker count > defender count` on the target square, which does not account for piece values among the attackers/defenders themselves (e.g. a piece defended once by a queen against two pawn attackers is still flagged "hanging" under this count-only heuristic, even though the value math may actually favor the defender). Document this limitation in the module's header comment.
- Square/file/rank conventions match `src/lib/board/geometry.ts` exactly: `const FILES = 'abcdefgh'`, `FILES.indexOf(sq[0])` for file (0-7), `Number(sq[1])` for rank (1-8).
- No signature changes to `classifyGame`/`SpecialClassInputs` — this iteration only changes `classifySpecial`'s internal Brilliant-detection logic and `material.ts`'s exports.
- `BRILLIANT_MIN_SACRIFICE_VALUE = 3` (a named constant replacing the old hardcoded `-3` inside `isMaterialSacrifice`) — a piece must be worth at least a minor piece to count as a sacrifice, matching the value Iteration 10/11 already used.
- `GREAT_NOT_ALREADY_DECIDED` raised from `97` to `99` (a documented calibration adjustment — Iteration 11's `97` guard, combined with the raised gap threshold, drove Fischer's Great count from 5 (over-firing) all the way to 0 in the real app, apparently suppressing the one legitimate Great, `19...Ne2+`, which likely occurs in a position our engine already scores above 97). `GREAT_ONLY_MOVE_GAP` stays at `20` (unchanged this iteration).
- Every existing test in `classify.test.ts` and `material.test.ts` that exercised the now-removed `isMaterialSacrifice`/widened-window mechanism must be replaced with equivalent coverage of the new attack-based mechanism — do not just delete coverage.

---

### Task 1: Pure attack-detection module

**Files:**
- Create: `src/lib/game/attacks.ts`
- Test: `src/lib/game/attacks.test.ts`

**Interfaces:**
- Consumes: `Position`, `PieceColor`, `PieceType`, `Square` (from `$lib/board/types`).
- Produces: `countAttackers(position: Position, target: Square, byColor: PieceColor): number`, `isPieceHanging(position: Position, square: Square, ownerColor: PieceColor): boolean` — consumed by Task 3's `classify.ts`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/attacks.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { countAttackers, isPieceHanging } from './attacks';
import type { Position } from '$lib/board/types';

describe('countAttackers', () => {
	it('counts a knight attacking the target square', () => {
		const position: Position = { e1: ['K', 'w'], b5: ['N', 'b'], e8: ['K', 'b'] };
		// A knight on b5 attacks a3, c3, d4, d6, c7, a7 -- and d4 is one of those.
		expect(countAttackers(position, 'd4', 'b')).toBe(1);
	});

	it('does not count a knight that cannot reach the target square', () => {
		const position: Position = { e1: ['K', 'w'], b5: ['N', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd5', 'b')).toBe(0); // adjacent, not a knight move
	});

	it('counts a king attacking an adjacent square', () => {
		const position: Position = { e1: ['K', 'w'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd8', 'b')).toBe(1); // adjacent (one file over)
		expect(countAttackers(position, 'd6', 'b')).toBe(0); // two ranks away, not adjacent
	});

	it('counts a rook attacking along an open file, blocked by an intervening piece', () => {
		const openFile: Position = { e1: ['K', 'w'], a4: ['R', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(openFile, 'a1', 'b')).toBe(1); // clear file, a4 sees a1

		const blockedFile: Position = {
			e1: ['K', 'w'],
			a4: ['R', 'b'],
			a2: ['P', 'w'], // blocks the file between a1 and a4
			e8: ['K', 'b']
		};
		expect(countAttackers(blockedFile, 'a1', 'b')).toBe(0);
	});

	it('counts a bishop attacking along an open diagonal, blocked by an intervening piece', () => {
		const openDiagonal: Position = { e1: ['K', 'w'], a8: ['B', 'b'], h1: ['K', 'b'] };
		expect(countAttackers(openDiagonal, 'd5', 'b')).toBe(1);

		const blockedDiagonal: Position = {
			e1: ['K', 'w'],
			a8: ['B', 'b'],
			c6: ['P', 'w'], // blocks the a8-h1 diagonal between a8 and d5
			h1: ['K', 'b']
		};
		expect(countAttackers(blockedDiagonal, 'd5', 'b')).toBe(0);
	});

	it('counts a queen attacking both orthogonally and diagonally', () => {
		const position: Position = { e1: ['K', 'w'], d4: ['Q', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd8', 'b')).toBe(1); // orthogonal (file)
		expect(countAttackers(position, 'a1', 'b')).toBe(1); // diagonal
	});

	it('counts a white pawn attacking diagonally forward (toward higher ranks)', () => {
		const position: Position = { e1: ['K', 'w'], d4: ['P', 'w'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'e5', 'w')).toBe(1);
		expect(countAttackers(position, 'c5', 'w')).toBe(1);
		expect(countAttackers(position, 'd5', 'w')).toBe(0); // straight ahead, not a pawn CAPTURE square
		expect(countAttackers(position, 'e3', 'w')).toBe(0); // behind the pawn, not attacked
	});

	it('counts a black pawn attacking diagonally forward (toward lower ranks)', () => {
		const position: Position = { e1: ['K', 'w'], d5: ['P', 'b'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'e4', 'b')).toBe(1);
		expect(countAttackers(position, 'c4', 'b')).toBe(1);
		expect(countAttackers(position, 'd4', 'b')).toBe(0);
	});

	it('sums multiple simultaneous attackers of the same color', () => {
		const position: Position = {
			e1: ['K', 'w'],
			a4: ['R', 'b'], // attacks a1 along the open a-file (orthogonal)
			h8: ['B', 'b'], // attacks a1 along the open a1-h8 diagonal
			e8: ['K', 'b']
		};
		expect(countAttackers(position, 'a1', 'b')).toBe(2);
	});

	it('does not count a piece of the wrong color', () => {
		const position: Position = { e1: ['K', 'w'], b5: ['N', 'w'], e8: ['K', 'b'] };
		expect(countAttackers(position, 'd4', 'b')).toBe(0); // the knight is White, not Black
	});

	it('does not crash for targets near the edge of the board', () => {
		const position: Position = { e1: ['K', 'w'], b2: ['N', 'b'], e8: ['K', 'b'] };
		expect(() => countAttackers(position, 'a1', 'b')).not.toThrow();
		expect(countAttackers(position, 'a1', 'b')).toBe(0);
	});
});

describe('isPieceHanging', () => {
	it('is true when a piece has more attackers than defenders', () => {
		// A black queen on a8 attacks a4 along the open a-file; White's knight on a4 has no
		// defenders at all -- this mirrors the reference game's 11...Na4 (declined sacrifice,
		// never actually captured, yet still a genuine hanging piece by this count-only check).
		const position: Position = { e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(true);
	});

	it('is false when attackers and defenders are equal in count', () => {
		const position: Position = {
			e1: ['K', 'w'],
			a4: ['N', 'w'],
			a1: ['R', 'w'], // defends a4 along the file
			a8: ['Q', 'b'], // attacks a4 along the file
			e8: ['K', 'b']
		};
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false);
	});

	it('is false when there are no attackers at all', () => {
		const position: Position = { e1: ['K', 'w'], a4: ['N', 'w'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false);
	});

	it('is false when the square holds no piece', () => {
		const position: Position = { e1: ['K', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false);
	});

	it('is false when the square holds a piece of the wrong color for the given owner', () => {
		const position: Position = { e1: ['K', 'w'], a4: ['N', 'b'], a8: ['Q', 'b'], e8: ['K', 'b'] };
		expect(isPieceHanging(position, 'a4', 'w')).toBe(false); // the piece there is Black's, not White's
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/attacks.test.ts` (or plain `pnpm exec vitest run src/lib/game/attacks.test.ts` if `rtk` isn't available)
Expected: FAIL — `./attacks` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/game/attacks.ts`:
```typescript
/**
 * Pure, simplified attack-detection geometry used only as Brilliant's
 * "is this piece currently hanging" precondition (blueprint §4/§8's
 * `is_piece_sacrifice` guard). A real chess.com-style Brilliant is a piece
 * left ATTACKED (en prise) that's still fine for the mover whether or not the
 * opponent actually captures it -- e.g. the reference game's 11...Na4
 * (docs/references/DonaldByrne_RJamesFischer/), which is never captured at
 * all (White correctly declines). Detecting this requires an attack-square
 * query, not a diff of material across subsequent board snapshots (which can
 * only ever see a sacrifice the opponent actually accepts).
 *
 * Simplifications (explicitly out of scope, matching material.ts's own
 * no-SEE disclosure): no full legal-move generation (no check/pin awareness
 * -- a "pinned" attacker is still counted as an attacker here), no Static
 * Exchange Evaluation ordering or piece-value weighting among attackers/
 * defenders themselves. "Hanging" is defined purely as attacker COUNT
 * exceeding defender COUNT on the target square -- a piece defended once by
 * a queen against two pawn attackers is still flagged "hanging" under this
 * count-only heuristic, even though the value math may actually favor the
 * defender in a real exchange sequence.
 */
import type { Piece, PieceColor, Position, Square } from '$lib/board/types';

const FILES = 'abcdefgh';

function fileOf(sq: Square): number {
	return FILES.indexOf(sq[0]);
}

function rankOf(sq: Square): number {
	return Number(sq[1]);
}

function squareAt(file: number, rank: number): Square | null {
	if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
	return FILES[file] + rank;
}

const KNIGHT_OFFSETS: Array<[number, number]> = [
	[1, 2],
	[2, 1],
	[2, -1],
	[1, -2],
	[-1, -2],
	[-2, -1],
	[-2, 1],
	[-1, 2]
];

const KING_OFFSETS: Array<[number, number]> = [
	[1, 0],
	[1, 1],
	[0, 1],
	[-1, 1],
	[-1, 0],
	[-1, -1],
	[0, -1],
	[1, -1]
];

const ORTHOGONAL_DIRS: Array<[number, number]> = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];

const DIAGONAL_DIRS: Array<[number, number]> = [
	[1, 1],
	[1, -1],
	[-1, 1],
	[-1, -1]
];

function pieceAt(position: Position, file: number, rank: number): Piece | undefined {
	const sq = squareAt(file, rank);
	return sq ? position[sq] : undefined;
}

/**
 * Counts how many pieces of `byColor` currently attack `target` on this
 * board. Sliding pieces (rook/bishop/queen) are blocked by the first piece
 * encountered in each direction, exactly like real chess movement -- a piece
 * of the wrong type/color at that blocking square stops the ray entirely
 * (no attack from beyond it), matching how a blocked file/diagonal works.
 */
export function countAttackers(position: Position, target: Square, byColor: PieceColor): number {
	const tf = fileOf(target);
	const tr = rankOf(target);
	let count = 0;

	for (const [df, dr] of KNIGHT_OFFSETS) {
		const piece = pieceAt(position, tf + df, tr + dr);
		if (piece && piece[0] === 'N' && piece[1] === byColor) count++;
	}

	for (const [df, dr] of KING_OFFSETS) {
		const piece = pieceAt(position, tf + df, tr + dr);
		if (piece && piece[0] === 'K' && piece[1] === byColor) count++;
	}

	for (const [df, dr] of ORTHOGONAL_DIRS) {
		let f = tf + df;
		let r = tr + dr;
		while (true) {
			const piece = pieceAt(position, f, r);
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'R' || piece[0] === 'Q')) count++;
				break;
			}
			if (squareAt(f, r) === null) break;
			f += df;
			r += dr;
		}
	}

	for (const [df, dr] of DIAGONAL_DIRS) {
		let f = tf + df;
		let r = tr + dr;
		while (true) {
			const piece = pieceAt(position, f, r);
			if (piece) {
				if (piece[1] === byColor && (piece[0] === 'B' || piece[0] === 'Q')) count++;
				break;
			}
			if (squareAt(f, r) === null) break;
			f += df;
			r += dr;
		}
	}

	// A pawn of `byColor` attacks `target` if it sits diagonally "behind" it from the
	// capturing pawn's own point of view: a White pawn captures toward higher ranks, so an
	// attacking White pawn sits one rank BELOW target; a Black pawn captures toward lower
	// ranks, so an attacking Black pawn sits one rank ABOVE target.
	const pawnRankOffset = byColor === 'w' ? -1 : 1;
	for (const df of [-1, 1]) {
		const piece = pieceAt(position, tf + df, tr + pawnRankOffset);
		if (piece && piece[0] === 'P' && piece[1] === byColor) count++;
	}

	return count;
}

/**
 * True when the piece at `square` belongs to `ownerColor` and has strictly
 * more opposing attackers than same-color defenders on that square (see this
 * module's header comment for the count-only simplification).
 */
export function isPieceHanging(position: Position, square: Square, ownerColor: PieceColor): boolean {
	const piece = position[square];
	if (!piece || piece[1] !== ownerColor) return false;

	const opponent: PieceColor = ownerColor === 'w' ? 'b' : 'w';
	const attackers = countAttackers(position, square, opponent);
	if (attackers === 0) return false;

	const defenders = countAttackers(position, square, ownerColor);
	return attackers > defenders;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/attacks.test.ts`
Expected: PASS (all 16 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/attacks.ts src/lib/game/attacks.test.ts
git commit -m "feat(attacks): add a pure attacker/defender-count module for hanging-piece detection"
```

---

### Task 2: Export `PIECE_VALUES` and remove the now-superseded `isMaterialSacrifice`

**Files:**
- Modify: `src/lib/game/material.ts`
- Modify: `src/lib/game/material.test.ts`

**Interfaces:**
- Produces: `export const PIECE_VALUES: Record<PieceType, number>` (was previously module-private) — consumed by Task 3's `classify.ts`.
- Removes: `isMaterialSacrifice` (its only caller, `classify.ts`, is rewritten in Task 3 to use Task 1's `isPieceHanging` instead).

- [ ] **Step 1: Update `material.ts`**

Current code:
```typescript
/**
 * Pure, no-SEE material accounting used only as Brilliant's sacrifice
 * precondition (blueprint §4/§8's `is_piece_sacrifice` guard, simplified:
 * no search-continuation lookahead, just the raw material swing between two
 * given board snapshots).
 */
import type { Position, PieceColor, PieceType } from '$lib/board/types';

const PIECE_VALUES: Record<PieceType, number> = {
	P: 1,
	N: 3,
	B: 3,
	R: 5,
	Q: 9,
	K: 0
};

/** Sums standard piece values for one side on a board (king excluded, value 0). */
export function materialForColor(position: Position, color: PieceColor): number {
	return Object.values(position)
		.filter(([, pieceColor]) => pieceColor === color)
		.reduce((sum, [type]) => sum + PIECE_VALUES[type], 0);
}

/**
 * True when the mover's material lead over the opponent (their material
 * minus the opponent's) drops by at least a minor piece's worth (3 points)
 * between the two given board snapshots. An even or favorable trade
 * (capturing a piece of equal or greater value) does not count -- only a
 * net material loss counts as a sacrifice.
 *
 * This function only diffs the two positions it's given -- it has no notion
 * of "before/after a move" or "before/after a reply" itself. Choosing which
 * two snapshots to compare (the position immediately before/after the
 * mover's own move, vs. a wider window that also spans the opponent's next
 * reply, to catch a piece deliberately left en prise) is entirely the
 * caller's responsibility; see classify.ts's `classifySpecial` for how it
 * picks (and validates) that window.
 */
export function isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean {
	const opponent: PieceColor = mover === 'w' ? 'b' : 'w';
	const diffBefore = materialForColor(before, mover) - materialForColor(before, opponent);
	const diffAfter = materialForColor(after, mover) - materialForColor(after, opponent);
	return diffAfter - diffBefore <= -3;
}
```

Replace with:
```typescript
/**
 * Pure standard chess piece values, reused wherever a move's material
 * significance needs checking (currently: classify.ts's Brilliant guard,
 * which combines a piece-value floor with attacks.ts's hanging-piece check
 * rather than this module's own former material-diff approach -- see git
 * history for Iteration 10/11's now-superseded `isMaterialSacrifice`).
 */
import type { Position, PieceColor, PieceType } from '$lib/board/types';

export const PIECE_VALUES: Record<PieceType, number> = {
	P: 1,
	N: 3,
	B: 3,
	R: 5,
	Q: 9,
	K: 0
};

/** Sums standard piece values for one side on a board (king excluded, value 0). */
export function materialForColor(position: Position, color: PieceColor): number {
	return Object.values(position)
		.filter(([, pieceColor]) => pieceColor === color)
		.reduce((sum, [type]) => sum + PIECE_VALUES[type], 0);
}
```

- [ ] **Step 2: Update `material.test.ts`**

Remove the entire `describe('isMaterialSacrifice', ...)` block (all three `it` cases) and its now-unused `isMaterialSacrifice` import. Current top of file:
```typescript
import { describe, it, expect } from 'vitest';
import { materialForColor, isMaterialSacrifice } from './material';
import type { Position } from '$lib/board/types';
```
Replace with:
```typescript
import { describe, it, expect } from 'vitest';
import { materialForColor } from './material';
import type { Position } from '$lib/board/types';
```
Delete everything from `describe('isMaterialSacrifice', ...)` through its closing `});` at the end of the file (the `describe('materialForColor', ...)` block above it is unchanged and stays).

- [ ] **Step 3: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/material.test.ts`
Expected: PASS (2/2 — just the two `materialForColor` tests remain).

- [ ] **Step 4: Commit**

```bash
git add src/lib/game/material.ts src/lib/game/material.test.ts
git commit -m "refactor(material): export PIECE_VALUES, remove isMaterialSacrifice (superseded by attacks.ts)"
```

---

### Task 3: Rewire `classify.ts`'s Brilliant check to use attack-based hanging-piece detection

**Files:**
- Modify: `src/lib/game/classify.ts`
- Modify: `src/lib/game/classify.test.ts`
- Modify: `src/lib/game/classify.reference-game.test.ts`

**Interfaces:**
- Consumes: `countAttackers`/`isPieceHanging` (Task 1's `./attacks`), `PIECE_VALUES` (Task 2's `./material`).
- No changes to `classifyGame`'s or `SpecialClassInputs`'s public shape.

- [ ] **Step 1: Update `classify.ts`'s imports and Brilliant logic**

Current imports:
```typescript
import type { ClassCode } from '$lib/types';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
import { isMaterialSacrifice } from './material';
```
Replace with:
```typescript
import type { ClassCode } from '$lib/types';
import type { Move, Position } from '$lib/board/types';
import type { Wdl } from './accuracy';
import { winPercentForPly } from './accuracy';
import { sideToMoveForPly } from './notation';
import { isPieceHanging } from './attacks';
import { PIECE_VALUES } from './material';
```

Current constants:
```typescript
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 97;
const GREAT_ONLY_MOVE_GAP = 20;
const GREAT_NOT_ALREADY_DECIDED = 97;
const MISS_WIN_BEFORE = 80;
const MISS_WIN_AFTER = 55;
```
Replace with:
```typescript
const BRILLIANT_MIN_WIN = 50;
const BRILLIANT_NOT_WINNING = 97;
const BRILLIANT_MIN_SACRIFICE_VALUE = 3;
const GREAT_ONLY_MOVE_GAP = 20;
const GREAT_NOT_ALREADY_DECIDED = 97; // recalibrated in Task 4 of this same plan
const MISS_WIN_BEFORE = 80;
const MISS_WIN_AFTER = 55;
```
(Task 4 below changes `GREAT_NOT_ALREADY_DECIDED`'s value from `97` to `99` -- leave it at `97` for this task, Task 4 handles that specific edit separately with its own test.)

Current Brilliant block (everything from the `// Prefer the position AFTER...` comment through the closing `}` of the Brilliant `if`):
```typescript
	// Prefer the position AFTER the opponent's next reply when it's available: a piece
	// deliberately left en prise (the classic "offered" sacrifice -- e.g. this game's own
	// 17...Be6!!, only captured on White's following move) shows no material change at all
	// on the sacrificing move's own ply, so checking only positions[ply-1] vs positions[ply]
	// can never see it. Falls back to the same-ply comparison (today's pre-Task-1 behavior)
	// when the played move was the game's very last ply (positions[ply + 1] doesn't exist).
	const widenedWindow = special.positions[ply + 1];
	let materialAfter = widenedWindow ?? special.positions[ply];

	// The widened window is causally blind: it just diffs total material balance across the
	// two plies, so an UNRELATED capture elsewhere on the board (some other piece that was
	// already hanging for reasons that have nothing to do with this move) would inflate the
	// swing and wrongly look like a sacrifice caused by this move. Only trust the widened
	// window when the square this move landed on (`playedMove.to`) no longer holds a piece of
	// the mover's own color there -- i.e. the mover's own piece was actually captured (or is
	// otherwise gone) on the square it just moved to, tying the material loss to THIS move's
	// piece rather than some other exchange happening elsewhere. Otherwise, fall back to the
	// same-ply comparison so a real over-the-board immediate sacrifice still works exactly as
	// it did before this whole feature was added.
	if (widenedWindow && playedMove) {
		const pieceOnLandingSquare = widenedWindow[playedMove.to];
		const moverStillThere = pieceOnLandingSquare?.[1] === mover;
		if (moverStillThere) {
			materialAfter = special.positions[ply];
		}
	}

	if (
		nearBest &&
		special.positions[ply - 1] &&
		materialAfter &&
		isMaterialSacrifice(special.positions[ply - 1], materialAfter, mover) &&
		afterPov >= BRILLIANT_MIN_WIN &&
		beforePov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}
```
Replace with:
```typescript
	// A real sound sacrifice is a piece left ATTACKED that's still fine for the mover whether
	// or not the opponent actually takes it (e.g. the reference game's 11...Na4, never captured
	// at all -- White correctly declines). Checking the square the mover's own move landed on
	// for "is it currently hanging" (attackers.ts) catches this directly, unlike diffing
	// material across subsequent board snapshots, which can only ever see a sacrifice the
	// opponent actually accepts -- see docs/superpowers/plans/2026-07-20-iteration-12-attack-based-brilliant.md.
	const afterPosition = special.positions[ply];
	const playedPiece = playedMove && afterPosition ? afterPosition[playedMove.to] : undefined;
	const sacrificedValue = playedPiece ? PIECE_VALUES[playedPiece[0]] : 0;

	if (
		nearBest &&
		playedMove &&
		afterPosition &&
		sacrificedValue >= BRILLIANT_MIN_SACRIFICE_VALUE &&
		isPieceHanging(afterPosition, playedMove.to, mover) &&
		afterPov >= BRILLIANT_MIN_WIN &&
		beforePov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}
```

Also update this file's header doc comment: the line referencing Iteration 11's window-widening approach (if any remains from that iteration) is no longer accurate; leave the rest of the header as-is (the override-order/Book-Forced scope note is still correct) but do not reintroduce any mention of "widened window"/"opponent's next reply" in fresh prose -- the attack-based approach needs no lookahead at all.

- [ ] **Step 2: Replace the four now-obsolete Brilliant tests in `classify.test.ts`**

Read the current file first to get exact line ranges (it has grown across three iterations). Remove these four `it` blocks entirely (they test the now-removed material-diff-window mechanism):
- `'classifies a best/near-best sound piece sacrifice as brilliant'`
- `'classifies an offered sacrifice (material lost only after the opponent\'s next reply) as brilliant'`
- `'falls back to the same-ply material diff when the move played is the very last ply'`
- `'does NOT classify a quiet move as brilliant just because the opponent\'s next move captures something unrelated'`

Replace them with these three, in the same `describe('classifyGame with special classes', ...)` block, in the position the old four occupied:
```typescript
	it('classifies an immediately-hanging near-best move as brilliant (piece actually captured)', () => {
		// White's knight lands on a4, attacked by Black's queen on a8 along the open a-file,
		// with no White defender of a4 -- classic hanging piece, worth a minor piece (3).
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: mover (White) win% 80 before the sacrifice
			[600, 400, 0] // ply 1: still 80 right after -- the engine already credits the
			// follow-up tactics, matching this codebase's existing eval-at-ply convention
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }, // before: knight on d4
			{ e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] } // after: knight moved
			// to a4, hanging to the queen on a8 along the open a-file
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).toEqual(['brilliant']);
	});

	it('classifies a declined sacrifice (piece hanging but never actually captured) as brilliant', () => {
		// Mirrors the reference game's 11...Na4 exactly (docs/references/DonaldByrne_RJamesFischer/):
		// the knight is genuinely hanging (attacked, undefended) but the opponent's ACTUAL next
		// move (modeled here, though classifyGame never even looks at ply 2 for this ply's own
		// classification) does not capture it. The old material-diff-window approach could never
		// detect this since no capture ever occurs on the board; attack-based detection doesn't
		// need one.
		const evalPerPly = [0, 0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }, // knight hanging on a4
			{ e1: ['K', 'w'], a4: ['N', 'w'], d1: ['Q', 'b'], e8: ['K', 'b'] } // opponent declines the
			// knight, plays elsewhere instead (queen repositions to d1) -- the knight is still
			// sitting on a4, still hanging, simply never taken
		];
		const moveMeta: Move[] = [
			{ from: 'd4', to: 'a4' },
			{ from: 'a8', to: 'd1' } // the opponent's actual reply -- NOT a capture of a4
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant'); // codes[0] = classification of ply 1 (the Na4-pattern move)
	});

	it('does not classify a quiet, adequately-defended move as brilliant', () => {
		// The knight on a4 is attacked by the queen on a8, but also defended once by White's own
		// rook on a1 -- attackers (1) do not exceed defenders (1), so it is not "hanging".
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a1: ['R', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], a4: ['N', 'w'], a1: ['R', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes).not.toEqual(['brilliant']);
	});
```

- [ ] **Step 3: Run to verify the new/changed tests behave as expected**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL at this point is fine/expected only if Step 1 hasn't been applied yet -- apply Step 1's `classify.ts` change now if you haven't, then re-run.
Expected after Step 1 is applied: PASS (all tests, including the 3 new ones replacing the 4 removed ones).

- [ ] **Step 4: Replace `classify.reference-game.test.ts`'s fixture with the corrected Na4 pattern**

The existing file models the *wrong* move (`17...Be6`, which this plan's own investigation found is not actually the "declined/hanging" pattern -- `Be6` in the real game is a defensive developing move, not the sacrifice; the actual hanging-piece brilliancy is `11...Na4`). Replace the entire file's contents:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyGame } from './classify';
import type { Wdl } from './accuracy';
import type { Move, Position } from '$lib/board/types';

/**
 * Regression fixture for the corrected diagnosis recorded when comparing
 * SecondBoard's Game Review output against chess.com's real output for
 * docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn (Byrne vs.
 * Fischer, 1956, "The Game of the Century"): chess.com credits Fischer's
 * 11...Na4 as Brilliant. Na4 is never actually captured in the game (White
 * plays 12.Qa3 instead of 12.Qxa4) -- it is a genuinely "hanging" piece
 * (attacked, undefended) that's still fine for Fischer, which only an
 * attack-based check (attacks.ts's isPieceHanging) can detect. An earlier
 * version of this fixture modeled 17...Be6 under the assumption that Be6 was
 * an "offered, later captured" sacrifice; that assumption was wrong (Be6 is
 * a defensive/developing move, not the sacrifice), which is why this fixture
 * was rewritten to model Na4 instead once the real pattern was identified.
 *
 * Only the material/attack relationship needed to clear Brilliant's own
 * guards is modeled -- the exact squares/pieces elsewhere on the board are
 * simplified down to just the two kings plus the pieces directly involved,
 * since classifyGame's special-class logic only reads
 * positions/moveMeta/bestMoves, never SAN or full legality.
 */
describe('reference game regression: Byrne vs. Fischer 1956, move 11...Na4', () => {
	it('classifies the declined knight sacrifice as brilliant', () => {
		// ply 0: position before 11...Na4 (Black to move, per the PGN's 11.Bg5 Na4).
		// ply 1: position right after 11...Na4 -- the knight is hanging on a4 (attacked by
		// Black's own... no: attacked by WHATEVER piece attacks it; see the color-flip note
		// below) but genuinely never captured in the real game (White plays 12.Qa3 instead).
		//
		// Colors are flipped from the real game (this fixture has White playing the Na4-pattern
		// move, not Black): `classifyGame`'s ply-index convention means `codes[0]` (ply 1) is
		// always evaluated with `mover = sideToMoveForPly(0) === 'w'` in any isolated
		// array-based fixture like this one (ply 0 is always "White to move" by this codebase's
		// indexing), so the hanging piece must belong to White for this fixture's `mover` and
		// the sacrificed color to actually agree -- a test-harness detail, not a claim about
		// who sacrifices in the real game.
		const evalPerPly = [0, 0];
		const wdlPerPly: (Wdl | null)[] = [
			[600, 350, 50], // ply 0: mover (White) win% (600+175)/10 = 77.5 before the move
			[600, 350, 50] // ply 1: still 77.5 right after -- the engine already credits the
			// follow-up tactics, matching this codebase's existing eval-at-ply convention
		];
		const positions: Position[] = [
			{ f1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], g8: ['K', 'b'] }, // before: knight on d4
			{ f1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], g8: ['K', 'b'] } // after: knight moved
			// to a4, attacked by the queen on a8 along the open a-file, no White defender --
			// genuinely hanging, yet never captured in the real game's actual continuation
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }]; // pattern-mirrors 11...Na4
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' } // engine agrees the move is best, matching
			// chess.com's own analysis of the real 11...Na4 (see
			// docs/references/DonaldByrne_RJamesFischer/ChessComAnalysis1.png, row 11)
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant');
	});
});
```

- [ ] **Step 5: Run the full `classify` test suite**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts src/lib/game/classify.reference-game.test.ts`
Expected: PASS (all tests in both files).

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts src/lib/game/classify.reference-game.test.ts
git commit -m "fix(classify): detect Brilliant via attack-based hanging-piece check instead of material-diff windows"
```

---

### Task 4: Loosen Great's "not already decided" guard

**Files:**
- Modify: `src/lib/game/classify.ts`
- Test: `src/lib/game/classify.test.ts`

**Interfaces:** none changed -- a single constant value change plus one updated test.

**Root cause:** the real app run after Iteration 11 showed Fischer's Great count collapse from 5 (over-firing, the original bug) all the way to 0 -- not the expected ~1. The `beforePov < 97` guard, combined with the raised `20`-point gap threshold, apparently suppresses `19...Ne2+` (the one legitimate Great chess.com credits), which likely occurs in a position our engine already scores above 97 (Fischer's position is very strong for much of the game's second half after the earlier combination). Raising the threshold to `99` keeps the guard's purpose (exclude truly-decided, resignation-worthy positions) while allowing Great to fire in merely "clearly better" positions, which is closer to how chess.com's own Great appears to behave here.

- [ ] **Step 1: Update the existing "already decided" test's fixture to the new threshold**

Read the current test named `'does not classify an only-move gap as great when the position was already decisively won'` in `classify.test.ts` (added in Iteration 11). Its fixture uses `beforePov = 98` (via `wdlPerPly: [[970, 20, 10], ...]`, giving `(970+10)/10 = 98`). Under the new `99` threshold, `98 < 99` would make the guard NOT block it, breaking this test's intent. Update its `wdlPerPly` first entry so `beforePov` clears the NEW threshold instead:
```typescript
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[990, 5, 5], // ply 0: White win% (990+2.5)/10 = 99.25 -- decisively won even under the
			// raised (99) "already decided" threshold
			[990, 5, 5]
		];
```
(Replace only that one array literal in the existing test; leave the rest of the test -- `secondWdlPerPly`, `positions`, `moveMeta`, `bestMoves`, the assertion -- unchanged.)

- [ ] **Step 2: Add a new test locking in the loosened guard's intent**

Add this test to the same `describe('classifyGame with special classes', ...)` block, right after the updated test from Step 1:
```typescript
	it('classifies an only-move gap as great in a clearly-but-not-decisively winning position', () => {
		// beforePov = 98 -- clearly better for the mover, ABOVE Iteration 11's 97 threshold
		// (which would wrongly block this) but BELOW the raised 99 threshold (which correctly
		// allows it). This is exactly the gap Iteration 11's 97 threshold over-corrected: it
		// silently swallowed a real Great, matching the app's own reported under-firing after
		// that iteration -- this test must fail under the OLD 97 value and pass under the NEW
		// 99 value, not pass under both (a beforePov like 90 would pass under both and not
		// actually exercise this fix).
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[960, 40, 0], // ply 0: White win% (960+20)/10 = 98
			[960, 40, 0]
		];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[500, 400, 100], // ply 0's second PV line: White win% (500+200)/10 = 70 -> gap of 20
			null
		];
		const evalPerPly = [0, 0];
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

		expect(codes[0]).toBe('great');
	});
```

- [ ] **Step 3: Run to verify the new test fails, confirming the current 97 threshold blocks it**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL on the new test (`beforePov=98 >= 97`'s guard blocks it under the current threshold) -- the updated "already decided" test from Step 1 should already pass (99.25 clears 99 either way).

- [ ] **Step 4: Implement**

Current code:
```typescript
const GREAT_NOT_ALREADY_DECIDED = 97; // recalibrated in Task 4 of this same plan
```
Replace with:
```typescript
const GREAT_NOT_ALREADY_DECIDED = 99;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS (all tests, including both from this task).

- [ ] **Step 6: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "fix(classify): loosen Great's not-already-decided guard from 97 to 99"
```

---

### Task 5: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Frontend suite**

Run: `cd /home/jonas/Documents/Code/SecondBoard && rtk proxy pnpm exec vitest run`
Expected: PASS, all test files (no Rust changes this iteration).

- [ ] **Step 2: Type-check, lint, build**

Run:
```bash
pnpm check
pnpm lint
pnpm build
```
Expected: all three clean (no new type errors, no new lint violations, a successful production build).

- [ ] **Step 3: Manual GUI smoke test note**

Deferred to the user (headless sandbox, same as every prior iteration) — reload the exact reference PGN (`docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`) in the real app and confirm: (a) `11...Na4` now shows Brilliant; (b) `15...Nxc3` and `17...Be6` -- check whether either now also shows Brilliant (both remain approximation gaps if not: `Nxc3` may involve its own distinct tactical pattern, and `Be6` was never actually a hanging-piece move at all per this plan's corrected diagnosis, so it may legitimately continue to show as something other than Brilliant); (c) Fischer's Great count is no longer 0 -- ideally close to chess.com's 1 (`19...Ne2+`).

- [ ] **Step 4: Commit (only if Steps 1-2 required any fixes)**

```bash
git add -A
git commit -m "fix: address full-suite verification findings for attack-based Brilliant detection"
```
