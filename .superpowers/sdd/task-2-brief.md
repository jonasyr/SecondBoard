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

