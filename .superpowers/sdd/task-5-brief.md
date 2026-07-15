### Task 5: `diffMove()` — pure from/to detector for the slide animation

**Files:**
- Create: `src/lib/board/diff-move.ts`
- Create: `src/lib/board/diff-move.test.ts`

**Interfaces:**
- Consumes: `Position`, `Move` from `./types` (Task 2).
- Produces: `diffMove(prev, cur): Move | null` — consumed by Task 8 (`Board.svelte`).

Ported from the diff portion of the reference's `_animateMove()` (LOGIC.md §2.4 steps 1-2): "diff previous vs current position maps... pick the from/to pair carrying the same piece... fall back to `froms[0]/tos[0]`."

- [ ] **Step 1: Write the failing tests**

Create `src/lib/board/diff-move.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { diffMove } from './diff-move';
import type { Position } from './types';

describe('diffMove', () => {
	it('detects a simple pawn push', () => {
		const prev: Position = { e2: ['P', 'w'] };
		const cur: Position = { e4: ['P', 'w'] };
		expect(diffMove(prev, cur)).toEqual({ from: 'e2', to: 'e4' });
	});

	it('detects the moving piece robustly across a capture (extra square vacated by the captured piece)', () => {
		// White knight f3 captures a black pawn on e5.
		const prev: Position = { f3: ['N', 'w'], e5: ['P', 'b'] };
		const cur: Position = { e5: ['N', 'w'] };
		expect(diffMove(prev, cur)).toEqual({ from: 'f3', to: 'e5' });
	});

	it('picks the king (primary traveller) for castling by matching piece identity', () => {
		// White kingside castle: Ke1-g1, Rh1-f1.
		const prev: Position = { e1: ['K', 'w'], h1: ['R', 'w'] };
		const cur: Position = { g1: ['K', 'w'], f1: ['R', 'w'] };
		const result = diffMove(prev, cur);
		expect(result).not.toBeNull();
		expect(['e1', 'h1']).toContain(result!.from);
		expect(['g1', 'f1']).toContain(result!.to);
		// The matched pair must carry the same piece identity.
		expect(prev[result!.from]).toEqual(cur[result!.to]);
	});

	it('returns null when there is no change', () => {
		const pos: Position = { e4: ['P', 'w'] };
		expect(diffMove(pos, pos)).toBeNull();
	});

	it('returns null when either position has no vacated/occupied squares to pair', () => {
		expect(diffMove({}, {})).toBeNull();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- --run src/lib/board/diff-move.test.ts`
Expected: FAIL — `./diff-move` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/board/diff-move.ts`:

```ts
/**
 * Pure from/to detector for the piece-slide animation, ported from the diff
 * portion of the reference's _animateMove() (LOGIC.md §2.4 steps 1-2).
 * Diffs two position maps and returns the square pair whose piece identity
 * matches (robust across captures, castling, promotions), falling back to
 * the first vacated/occupied pair if no identity match is found.
 */
import type { Move, Piece, Position } from './types';

function pieceEquals(a?: Piece, b?: Piece): boolean {
	return !!a && !!b && a[0] === b[0] && a[1] === b[1];
}

export function diffMove(prev: Position, cur: Position): Move | null {
	const keys = new Set<string>([...Object.keys(prev), ...Object.keys(cur)]);
	const froms: string[] = [];
	const tos: string[] = [];

	for (const key of keys) {
		const before = prev[key];
		const after = cur[key];
		if (before && !pieceEquals(before, after)) froms.push(key);
		if (after && !pieceEquals(before, after)) tos.push(key);
	}

	for (const to of tos) {
		const from = froms.find((candidate) => pieceEquals(prev[candidate], cur[to]));
		if (from) return { from, to };
	}

	if (froms.length && tos.length) return { from: froms[0], to: tos[0] };
	return null;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- --run src/lib/board/diff-move.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/board/diff-move.ts src/lib/board/diff-move.test.ts
git commit -m "feat: add diffMove pure from/to detector for the slide animation"
```

---

