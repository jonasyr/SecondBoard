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

