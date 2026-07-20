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

