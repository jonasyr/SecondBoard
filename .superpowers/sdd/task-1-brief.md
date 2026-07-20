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

