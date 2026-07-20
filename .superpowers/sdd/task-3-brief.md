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

