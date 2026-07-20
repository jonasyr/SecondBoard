# Iteration 11: Brilliant/Great Calibration Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two concrete, diagnosed problems in Iteration 10's Brilliant/Great detection (`src/lib/game/classify.ts`), found by comparing SecondBoard's Game Review output against chess.com's real output for the reference game in `docs/references/DonaldByrne_RJamesFischer/` (the famous "Game of the Century," Byrne vs. Fischer 1956): (1) Brilliant never fires because the sacrifice detector only looks at the mover's own single ply, missing the far more common "offered sacrifice" pattern (the game's own `17...Be6!!` — the most famous move in the game — is misclassified as Great instead of Brilliant); (2) Great over-fires (5 vs. chess.com's 1 for Fischer) because the "only move" gap check is too lenient given MultiPV#2's noisier, shallower search.

**Architecture:** Both fixes are confined to `src/lib/game/classify.ts`'s `classifySpecial` function — no other file changes. The reference game's PGN becomes a golden fixture (a new dedicated test file) that locks in the fix's real-world effect, in addition to updated/added unit tests in the existing `classify.test.ts`.

**Tech Stack:** SvelteKit 5 (runes) + TypeScript + Vitest.

## Global Constraints

- Both fixes are calibration/bug-fix changes to existing logic, not new features — no new `ClassCode` variants, no new files besides the one new golden-fixture test file, no changes to any other consumer of `classifyGame`'s output.
- Every existing test in `classify.test.ts` must still pass after these changes (the existing Great test's fixture already uses a gap of exactly 20 points and a `beforePov` of 75, so it must remain green under the new threshold/guard — verify this explicitly, don't just assume it).
- The material-sacrifice window widening must gracefully fall back to the pre-existing single-ply comparison when a `ply + 1` position isn't available (the played move is the game's very last move) — do not throw or skip classification for that edge case.
- Threshold changes: `GREAT_ONLY_MOVE_GAP` raised from `10` to `20`; add a `GREAT_NOT_ALREADY_DECIDED` guard of `97` (mirroring `BRILLIANT_NOT_WINNING`) so Great doesn't fire in already-decisively-winning positions. Use these exact numbers.

---

### Task 1: Widen Brilliant's material-sacrifice detection window

**Files:**
- Modify: `src/lib/game/classify.ts`
- Test: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes: `isMaterialSacrifice` (`./material`, unchanged signature `(before: Position, after: Position, mover: PieceColor) => boolean`).
- No signature changes to any exported function — `classifyGame`'s and `SpecialClassInputs`'s shapes are unchanged; this task only changes which position `classifySpecial` passes as the "after" board to `isMaterialSacrifice`.

**Root cause:** `classifySpecial` currently calls `isMaterialSacrifice(special.positions[ply - 1], special.positions[ply], mover)` — comparing the board immediately before the mover's move to the board immediately after it. A move that itself captures nothing and loses nothing (e.g. a bishop retreat/repositioning square that simply hangs a piece for the opponent to take *next* move) shows a material diff of exactly 0 at this point, so `isMaterialSacrifice` always returns `false` for this extremely common "offered sacrifice" pattern — which is what nearly every real chess brilliancy actually looks like, including this game's own `17...Be6!!` (Byrne only captures the offered material on his very next move, `18.Bxb6`).

**Fix:** when `positions[ply + 1]` exists (the position after the opponent's very next reply), pass that as the "after" board instead of `positions[ply]`, so a piece deliberately left en prise that the opponent then captures is correctly measured as a material sacrifice. Fall back to `positions[ply]` (today's behavior) when `ply + 1` is out of bounds (the played move was the game's last move) or when `positions[ply + 1]` is missing for any other reason.

- [ ] **Step 1: Write the failing tests**

Read the current `src/lib/game/classify.test.ts` in full first (it already has a `describe('classifyGame with special classes', ...)` block from Iteration 10 — see `git log -p -- src/lib/game/classify.test.ts` or just read the file directly) to match its existing fixture conventions. Add these two tests inside that same `describe` block, after the existing `'classifies a best/near-best sound piece sacrifice as brilliant'` test:

```typescript
	it('classifies an offered sacrifice (material lost only after the opponent\'s next reply) as brilliant', () => {
		// Mirrors the PATTERN of the reference game's 17...Be6!! (a piece offered that
		// captures/loses nothing on its own move, only taken on the opponent's very next
		// reply) -- docs/references/DonaldByrne_RJamesFischer/. Colors are flipped from the
		// real game (White offers here, not Black): `classifyGame`'s ply-index convention
		// means `codes[0]` (ply 1) is always evaluated with `mover = sideToMoveForPly(0) ===
		// 'w'` in any isolated array-based fixture like this one (ply 0 is always "White to
		// move" by this codebase's indexing), so the sacrificed piece must belong to White
		// for this fixture's `mover` and the sacrificed color to actually agree -- this is a
		// test-harness detail, not a claim about who sacrifices in the real game.
		const evalPerPly = [0, 0, 0]; // 3 plies: before the offer, after the offer, after the reply captures it
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0], // ply 0: mover (White) win% 80 before the offered move
			[600, 400, 0], // ply 1: still 80 right after offering the piece (engine already
			// credits the follow-up tactics, per this codebase's existing convention)
			[600, 400, 0] // ply 2: irrelevant to this test's own assertion, included only for
			// array-length parity with positions/moveMeta below
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e8: ['K', 'b'], e5: ['B', 'w'] }, // before: White's bishop still on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'], d6: ['B', 'w'] }, // after White's own move: bishop moved
			// to d6, nothing captured -- material diff vs. "before" is 0 at this point
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after Black's NEXT reply captures the bishop on d6
		];
		const moveMeta: Move[] = [
			{ from: 'e5', to: 'd6' }, // White's offered move (ply 1)
			{ from: 'e8', to: 'd6' } // Black's reply that captures it (ply 2) -- moveMeta content
			// for ply 2 doesn't affect this test (only ply 1 is classified as White's move here)
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd6', san: 'Bd6' } // played move IS the engine's suggestion
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant'); // codes[0] = classification of ply 1 (White's offered move)
	});

	it('falls back to the same-ply material diff when the move played is the very last ply', () => {
		// No positions[ply + 1] exists at all -- must not throw, and must fall back to
		// comparing positions[ply - 1] directly against positions[ply] (today's pre-Task-1
		// behavior), still correctly detecting an IMMEDIATE (same-move) sacrifice.
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], e5: ['N', 'w'], e8: ['K', 'b'] }, // before: White has a knight on e5
			{ e1: ['K', 'w'], e8: ['K', 'b'] } // after (the LAST ply of the game): the knight is
			// simply given away in this same move, no positions[2] exists at all
		];
		const moveMeta: Move[] = [{ from: 'e5', to: 'd7' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd7', san: 'Nd7' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant');
	});
```

- [ ] **Step 2: Run to verify the new tests fail**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts` (or plain `pnpm exec vitest run src/lib/game/classify.test.ts` if `rtk` isn't available)
Expected: the first new test FAILS (`codes[0]` is not `'brilliant'` under today's same-ply-only comparison — `Be6` currently falls through to the Great check instead); the second new test PASSES already (it's a regression-lock for the pre-existing fallback behavior, not a new behavior) — that's fine, it's here to prove the fallback stays correct after Step 3's change, not to itself demonstrate a bug.

- [ ] **Step 3: Implement**

Current code in `src/lib/game/classify.ts`:
```typescript
	if (
		nearBest &&
		special.positions[ply - 1] &&
		special.positions[ply] &&
		isMaterialSacrifice(special.positions[ply - 1], special.positions[ply], mover) &&
		afterPov >= BRILLIANT_MIN_WIN &&
		beforePov < BRILLIANT_NOT_WINNING
	) {
		return 'brilliant';
	}
```
Replace with:
```typescript
	// Prefer the position AFTER the opponent's next reply when it's available: a piece
	// deliberately left en prise (the classic "offered" sacrifice -- e.g. this game's own
	// 17...Be6!!, only captured on White's following move) shows no material change at all
	// on the sacrificing move's own ply, so checking only positions[ply-1] vs positions[ply]
	// can never see it. Falls back to the same-ply comparison (today's pre-Task-1 behavior)
	// when the played move was the game's very last ply (positions[ply + 1] doesn't exist).
	const materialAfter = special.positions[ply + 1] ?? special.positions[ply];

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS (all existing tests + the 2 new ones). Pay particular attention to the pre-existing `'classifies a best/near-best sound piece sacrifice as brilliant'` test (a 2-ply fixture, `positions[ply+1]` is out of bounds there too) — it must still pass via the same fallback path.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "fix(classify): widen Brilliant's sacrifice check to see material given up on the opponent's next reply"
```

---

### Task 2: Recalibrate Great's only-move threshold

**Files:**
- Modify: `src/lib/game/classify.ts`
- Test: `src/lib/game/classify.test.ts`

**Interfaces:** none changed — constant value changes and one added guard condition inside `classifySpecial`.

**Root cause:** `GREAT_ONLY_MOVE_GAP = 10` (win%-points) is too lenient given that `MultiPV=2` splits Stockfish's ~1s movetime across two lines — PV2 (the second-best line) gets much less effective search than PV1, so it comes out systematically noisier and worse than its "true" strength, inflating the gap on plenty of merely-clearly-correct-but-unremarkable moves. There's also no guard against firing in an already-decisively-won-or-lost position, where "only move" isn't a noteworthy finding.

**Fix:** raise the gap threshold to `20`, and add a `beforePov < GREAT_NOT_ALREADY_DECIDED` (`97`) guard mirroring Brilliant's own "not already crushing" condition.

- [ ] **Step 1: Write the failing test**

Add to `classify.test.ts`'s `describe('classifyGame with special classes', ...)` block, after the existing `'classifies an only-move (large MultiPV gap) best move as great'` test:

```typescript
	it('does not classify an only-move gap as great when the position was already decisively won', () => {
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[970, 20, 10], // ply 0: White win% (970+10)/10 = 98 -- already decisively winning
			[970, 20, 10] // ply 1: unchanged
		];
		const secondWdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[500, 400, 100], // ply 0's second PV line: White win% (500+200)/10 = 70 -> gap of 28,
			// which WOULD clear the (now-raised) 20-point bar on its own
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

		expect(codes[0]).not.toBe('great');
	});
```

- [ ] **Step 2: Run to verify it fails**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: FAIL — under today's code (no "already decided" guard), this gap of 28 clears the old 10-point bar and `codes[0]` comes out `'great'`.

- [ ] **Step 3: Implement**

Current code:
```typescript
const GREAT_ONLY_MOVE_GAP = 10;
```
Replace with:
```typescript
const GREAT_ONLY_MOVE_GAP = 20;
const GREAT_NOT_ALREADY_DECIDED = 97;
```

Current code in `classifySpecial`:
```typescript
	if (playedIsBest) {
		const secondPov = secondLineWinPercent(ply - 1, special.secondEvalPerPly, special.secondWdlPerPly);
		if (secondPov !== null) {
			const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
			if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
				return 'great';
			}
		}
	}
```
Replace with:
```typescript
	if (playedIsBest && beforePov < GREAT_NOT_ALREADY_DECIDED) {
		const secondPov = secondLineWinPercent(ply - 1, special.secondEvalPerPly, special.secondWdlPerPly);
		if (secondPov !== null) {
			const secondMoverPov = mover === 'w' ? secondPov : 100 - secondPov;
			if (beforePov - secondMoverPov >= GREAT_ONLY_MOVE_GAP) {
				return 'great';
			}
		}
	}
```

- [ ] **Step 4: Run tests to verify they pass, including the pre-existing Great test**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: PASS (all existing tests + the new one). Specifically confirm the pre-existing `'classifies an only-move (large MultiPV gap) best move as great'` test still passes: its fixture has `beforePov = 75` (well under the new 97 guard) and a gap of exactly `20` (`75 - 55`), which still clears the raised `>= 20` bar exactly.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "fix(classify): raise Great's only-move gap threshold and add a not-already-decided guard"
```

---

### Task 3: Golden-fixture regression test using the reference game

**Files:**
- Create: `src/lib/game/classify.reference-game.test.ts`

**Interfaces:**
- Consumes: `classifyGame` (`./classify`, unchanged signature after Tasks 1-2).

This task doesn't fix anything further — it locks in Tasks 1-2's real-world effect against the actual reference game (`docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`, the "Game of the Century," Byrne vs. Fischer 1956), using hand-built evalPerPly/wdlPerPly/positions/moveMeta/bestMoves fixtures for the specific moves this plan's diagnosis was based on, so a future change can't silently regress this exact, real, already-diagnosed case.

- [ ] **Step 1: Write the fixture and assertions**

Create `src/lib/game/classify.reference-game.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { classifyGame } from './classify';
import type { Wdl } from './accuracy';
import type { Move, Position } from '$lib/board/types';

/**
 * Regression fixture for the diagnosis recorded when comparing SecondBoard's
 * Game Review output against chess.com's real output for
 * docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn (Byrne vs.
 * Fischer, 1956, "The Game of the Century"): chess.com credits Fischer's
 * 17...Be6!! as Brilliant; before this plan's Task 1 fix, SecondBoard's
 * same-ply-only material-sacrifice check misclassified it as Great instead,
 * because Be6 itself captures/loses nothing -- White only captures the
 * offered bishop on the very next move (18.Bxb6). This test isolates just
 * that one real position (not the full 41-move game) as a minimal,
 * hand-built fixture so a future regression in the sacrifice-window logic
 * is caught immediately, without needing the full real engine pipeline.
 *
 * Only the material relationship (a bishop offered on one move, captured on
 * the opponent's very next move) and the win%s needed to clear Brilliant's
 * own guards are modeled -- the exact squares/pieces elsewhere on the board
 * are simplified down to just the two kings, since classifyGame's special-
 * class logic only reads positions/moveMeta/bestMoves, never SAN or full
 * legality. Colors are flipped from the real game (this fixture has White
 * offering the piece, not Black): `classifyGame`'s ply-index convention
 * means `codes[0]` (ply 1) is always evaluated with `mover =
 * sideToMoveForPly(0) === 'w'` in any isolated array-based fixture like this
 * one (ply 0 is always "White to move" by this codebase's indexing), so the
 * offered piece must belong to White for this fixture's `mover` and the
 * sacrificed color to actually agree -- a test-harness detail, not a claim
 * about who sacrifices in the real game.
 */
describe('reference game regression: Byrne vs. Fischer 1956, move 17...Be6 pattern', () => {
	it('classifies an offered bishop sacrifice (the 17...Be6 pattern) as brilliant, not great', () => {
		// ply 0: position before the offer (per the PGN's 17.Kf1 Be6 -- pattern only, see
		// the color-flip note above).
		// ply 1: position right after the offering move (nothing captured yet).
		// ply 2: position right after the opponent's reply captures the offered bishop
		// (mirroring 18.Bxb6's role: punishing/accepting the offer one ply later).
		const evalPerPly = [0, 0, 0];
		const wdlPerPly: (Wdl | null)[] = [
			[600, 350, 50], // ply 0: mover (White) win% (600+175)/10 = 77.5 before offering the bishop
			[600, 350, 50], // ply 1: still 77.5 right after -- the engine already credits the
			// follow-up combination, matching this codebase's existing eval-at-ply convention
			[600, 350, 50] // ply 2: irrelevant to ply 1's own classification, included only for
			// array-length parity with positions/moveMeta below
		];
		const positions: Position[] = [
			{ f1: ['K', 'w'], g8: ['K', 'b'], e5: ['B', 'w'] }, // before the offer: bishop still on e5
			{ f1: ['K', 'w'], g8: ['K', 'b'], d6: ['B', 'w'] }, // after the offering move: bishop
			// moved, nothing captured -- material diff vs. "before" is exactly 0 at this ply
			{ f1: ['K', 'w'], g8: ['K', 'b'] } // after the opponent's reply captured the bishop
		];
		const moveMeta: Move[] = [
			{ from: 'e5', to: 'd6' }, // the offering move (pattern-mirrors 17...Be6)
			{ from: 'g8', to: 'd6' } // the reply that captures it (pattern-mirrors 18.Bxb6) --
			// moveMeta content for ply 2 doesn't affect this test (only ply 1 is classified
			// here); classifyGame reads only positions[ply+1]'s resulting board for ply 1
		];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'e5', to: 'd6', san: 'Bd6' } // engine agrees the offer is best, matching
			// chess.com's own "Best" star on the real 17...Be6 (see
			// docs/references/DonaldByrne_RJamesFischer/ChessComAnalysis1.png, row 17)
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves });

		expect(codes[0]).toBe('brilliant');
	});
});
```

- [ ] **Step 2: Run to verify it passes (Tasks 1-2 already implemented by this point)**

Run: `rtk proxy pnpm exec vitest run src/lib/game/classify.reference-game.test.ts`
Expected: PASS. If this fails, Task 1's fix has a gap — stop and re-examine Task 1 rather than adjusting this fixture to match wrong behavior.

- [ ] **Step 3: Commit**

```bash
git add src/lib/game/classify.reference-game.test.ts
git commit -m "test(classify): lock in the Byrne-Fischer Be6 brilliancy as a golden-fixture regression"
```

---

### Task 4: Full verification pass

**Files:** none (verification only).

- [ ] **Step 1: Frontend suite**

Run: `cd /home/jonas/Documents/Code/SecondBoard && rtk proxy pnpm exec vitest run`
Expected: PASS, all test files (no Rust changes this iteration, so `cargo test` isn't needed).

- [ ] **Step 2: Type-check, lint, build**

Run:
```bash
pnpm check
pnpm lint
pnpm build
```
Expected: all three clean (no new type errors, no new lint violations, a successful production build).

- [ ] **Step 3: Manual GUI smoke test note**

Deferred to the user (headless sandbox, same as every prior iteration) — reload the exact reference PGN (`docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`) in the real app and confirm: (a) `17...Be6` now shows the Brilliant badge/icon instead of Great; (b) Fischer's total Great count has dropped meaningfully from 5 (still won't exactly match chess.com's 1 — that remains an approximation — but should no longer be wildly over-firing).

- [ ] **Step 4: Commit (only if Steps 1-2 required any fixes)**

```bash
git add -A
git commit -m "fix: address full-suite verification findings for Brilliant/Great calibration"
```
