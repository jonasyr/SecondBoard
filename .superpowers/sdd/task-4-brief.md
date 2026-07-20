### Task 4: Pure material-sacrifice detector

**Files:**
- Create: `src/lib/game/material.ts`
- Test: `src/lib/game/material.test.ts`

**Interfaces:**
- Consumes: `Position`, `PieceColor`, `PieceType` (from `$lib/board/types`).
- Produces: `materialForColor(position: Position, color: PieceColor): number`, `isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean` — consumed by Task 5's `classify.ts`.

This is a simplified, no-SEE, no-lookahead sacrifice check (Global Constraints): it measures whether the mover's own move dropped their material lead over the opponent by at least a minor piece's worth (3 points), comparing the position immediately before the move to the position immediately after it (before the opponent has a chance to reply).

- [ ] **Step 1: Write the failing tests**

Create `src/lib/game/material.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { materialForColor, isMaterialSacrifice } from './material';
import type { Position } from '$lib/board/types';

describe('materialForColor', () => {
	it('sums standard piece values for one side, ignoring the king', () => {
		const position: Position = {
			e1: ['K', 'w'],
			d1: ['Q', 'w'],
			a1: ['R', 'w'],
			h1: ['R', 'w'],
			c1: ['B', 'w'],
			b1: ['N', 'w'],
			a2: ['P', 'w'],
			e8: ['K', 'b']
		};
		// Q(9) + R(5) + R(5) + B(3) + N(3) + P(1) = 26; king contributes 0.
		expect(materialForColor(position, 'w')).toBe(26);
		expect(materialForColor(position, 'b')).toBe(0);
	});

	it('returns 0 for a side with no pieces on the board', () => {
		const position: Position = { e1: ['K', 'w'] };
		expect(materialForColor(position, 'b')).toBe(0);
	});
});

describe('isMaterialSacrifice', () => {
	it('is true when the mover gives up a piece worth 3+ points net, relative to the opponent', () => {
		// White has a knight on e5 that simply vanishes (given away) -- no
		// White capture compensates, and Black's material is unchanged.
		const before: Position = {
			e1: ['K', 'w'],
			e5: ['N', 'w'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(true);
	});

	it('is false for an even trade (capturing a piece of equal value)', () => {
		// White's bishop captures Black's bishop: White's own material is
		// unchanged, Black's material drops by 3 -- the DIFFERENTIAL (mover
		// minus opponent) goes up, not down, so this is not a sacrifice.
		const before: Position = {
			e1: ['K', 'w'],
			c4: ['B', 'w'],
			f7: ['B', 'b'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			f7: ['B', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(false);
	});

	it('is false for a small material swing under the 3-point sacrifice threshold', () => {
		// White's pawn captures Black's pawn: only a 1-point swing.
		const before: Position = {
			e1: ['K', 'w'],
			d4: ['P', 'w'],
			e5: ['P', 'b'],
			e8: ['K', 'b']
		};
		const after: Position = {
			e1: ['K', 'w'],
			e5: ['P', 'w'],
			e8: ['K', 'b']
		};
		expect(isMaterialSacrifice(before, after, 'w')).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/material.test.ts`
Expected: FAIL — `./material` does not exist yet.

- [ ] **Step 3: Implement**

Create `src/lib/game/material.ts`:
```typescript
/**
 * Pure, no-SEE material accounting used only as Brilliant's sacrifice
 * precondition (blueprint §4/§8's `is_piece_sacrifice` guard, simplified:
 * no search-continuation lookahead, just the raw material swing the mover's
 * own move caused, measured immediately before the opponent gets to reply).
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
 * True when the mover's own move dropped their material lead over the
 * opponent (their material minus the opponent's) by at least a minor
 * piece's worth (3 points), comparing the position immediately before the
 * move to the position immediately after it. An even or favorable trade
 * (capturing a piece of equal or greater value) does not count -- only a
 * move that gives up material net counts as a sacrifice.
 */
export function isMaterialSacrifice(before: Position, after: Position, mover: PieceColor): boolean {
	const opponent: PieceColor = mover === 'w' ? 'b' : 'w';
	const diffBefore = materialForColor(before, mover) - materialForColor(before, opponent);
	const diffAfter = materialForColor(after, mover) - materialForColor(after, opponent);
	return diffAfter - diffBefore <= -3;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/material.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/material.ts src/lib/game/material.test.ts
git commit -m "feat(material): add a pure material-sacrifice detector for Brilliant classification"
```

---

