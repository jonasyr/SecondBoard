## Task 6: Delete the mock SAN engine; trim `mock-data.ts`

**Files:**
- Delete: `src/lib/game/mock-engine.ts`
- Delete: `src/lib/game/mock-engine.test.ts`
- Modify: `src/lib/game/mock-data.ts`
- Modify: `src/lib/game/mock-data.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `mock-data.ts` no longer exports `SAN_LIST`, `MOCK_POSITIONS`, `MOCK_MOVE_META` (any remaining import of these anywhere in `src/` is now a compile error to be fixed as part of this task — there should be none left after Tasks 4/5).

- [ ] **Step 1: Confirm no remaining references before deleting**

Run: `grep -rln "mock-engine\|MOCK_POSITIONS\|MOCK_MOVE_META\|SAN_LIST" src/ --include="*.ts" --include="*.svelte"`
Expected: only `src/lib/game/mock-data.ts` and `src/lib/game/mock-data.test.ts` (about to be edited in this task) and `src/lib/game/mock-engine.ts`/`mock-engine.test.ts` (about to be deleted) should appear. If any OTHER file still references these, stop and report — it means an earlier task's call-site sweep was incomplete; do not silently patch around it without understanding why.

- [ ] **Step 2: Delete the mock engine**

```bash
rm src/lib/game/mock-engine.ts src/lib/game/mock-engine.test.ts
```

- [ ] **Step 3: Write the failing test for the trimmed `mock-data.ts`**

Replace `src/lib/game/mock-data.test.ts` entirely with:

```ts
import { describe, it, expect } from 'vitest';
import {
	CLASS_CODES,
	EVAL_PER_PLY,
	BEST_MOVES,
	COACH_TEXT_MAP,
	BREAKDOWN_ROWS,
	PHASE_ROWS,
	PLAYERS
} from './mock-data';

describe('mock-data', () => {
	it('CLASS_CODES/EVAL_PER_PLY have the sample game\'s known fixed lengths (31 plies)', () => {
		expect(CLASS_CODES).toHaveLength(31);
		expect(EVAL_PER_PLY).toHaveLength(32); // includes ply 0
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

	it('has bestMoves entries matching the reference (ply 14 and 30)', () => {
		expect(BEST_MOVES[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
		expect(BEST_MOVES[30]).toEqual({ from: 'f6', to: 'g4', san: 'Ng4' });
	});
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `pnpm vitest run src/lib/game/mock-data.test.ts`
Expected: FAIL — `mock-data.ts` still imports the deleted `mock-engine.ts` and still exports `SAN_LIST`/`MOCK_POSITIONS`/`MOCK_MOVE_META`, but that's fine as a starting point; the real failure to fix is the deleted-file import breaking the whole module. Proceed to Step 5.

- [ ] **Step 5: Trim `mock-data.ts`**

In `src/lib/game/mock-data.ts`, remove the import of `buildGame` and the `SAN_LIST`/`MOCK_POSITIONS`/`MOCK_MOVE_META` exports. Change:

```ts
import type { ClassCode } from '$lib/types';
import type { Move } from '$lib/board/types';
import { buildGame } from './mock-engine';
```

to:

```ts
import type { ClassCode } from '$lib/types';
```

(The `Move` type import and `buildGame` import are both dropped — nothing in this trimmed file needs them anymore.)

Remove these lines from the bottom of the file:

```ts
const built = buildGame(SAN_LIST);
export const MOCK_POSITIONS = built.positions;
export const MOCK_MOVE_META = built.meta;
```

Remove the `SAN_LIST` export itself (the array literal near the top of the file):

```ts
export const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];
```

Update the file's banner doc comment (at the very top of the file) to reflect the new scope. Replace it with:

```ts
/**
 * ============================================================================
 * MOCK CONTENT — describes ONLY the built-in sample game (the Italian Game
 * shown by "Paste sample game"), applied by review.ts ONLY when the currently
 * loaded game is verified byte-identical to that sample PGN (`GameData.isSample`,
 * Iteration 6). A genuinely different real pasted/typed PGN gets real positions
 * and moves (src-tauri/src/pgn.rs via shakmaty) but none of this classification/
 * coach-text/breakdown/phase/player content, since none of it can honestly
 * apply to a game these arrays were never computed from.
 * ============================================================================
 * classCodes/evalPerPly/bestMoves/coachTextMap/breakdown/phases stand in for
 * Rust analysis+engine output (README §8 mapping table) — real move
 * classification is a later iteration (OVERVIEW §11's centipawn-loss/accuracy
 * formulas are not implemented yet). players stands in for backend-computed
 * screen content (same table) — real player names/ratings from PGN tags are
 * also a later iteration. CLS itself (name/word/color/glyph) is NOT mock —
 * that already lives in TOKENS.classification (src/lib/tokens.ts) and must
 * not be redeclared here.
 */
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/mock-data.test.ts`
Expected: all 5 tests pass.

- [ ] **Step 7: Run the FULL test suite to confirm no dangling references anywhere**

Run: `pnpm run test -- --run`
Expected: all test files pass — this confirms Tasks 4/5's call-site sweeps were complete and nothing still imports the deleted `mock-engine.ts` or the removed `mock-data.ts` exports.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: delete the mock SAN engine and trim mock-data.ts to sample-game-only content"
```

---

