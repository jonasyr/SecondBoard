## Task 3: `review.ts` — real classification in `getReviewPly`

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`

**Interfaces:**
- Consumes: `AppState.classCodes: ClassCode[]` shape (Task 2) passed in by callers as a new parameter.
- Produces: `getReviewPly(ply, game, evalPerPly, bestMoves, classCodes)` — 5th parameter, consumed by Tasks 4-5. `ReviewPly.classCode`/`coachText` semantics change: classification and coach text now depend on whether `classCodes` has an entry for this ply, not on `game.isSample`.

- [ ] **Step 1: Write the failing tests**

In `src/lib/game/review.test.ts`, replace the two tests that currently depend on the `isSample` gate — `'ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"'` and `'does not apply classification/coach text to a non-sample game'` — with:

```typescript
	it('ply 1 is classified from the real evalPerPly (Expected-Points cutoffs), independent of isSample', () => {
		const r = getReviewPly(1, sampleGame, undefined, undefined, ['excellent']);
		expect(r.classCode).toBe('excellent');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('applies real classification to a non-sample game too, given real classCodes', () => {
		const r = getReviewPly(1, notSampleGame, undefined, undefined, ['blunder']);
		expect(r.classCode).toBe('blunder');
		expect(r.coachText).toBe('A costly error — this swings the evaluation sharply.');
		expect(r.coachMove).toBe('1. d4'); // sanList is still real regardless of isSample
	});

	it('shows no classification/coach-classification text when classCodes has no entry yet for this ply (analysis not ready)', () => {
		const r = getReviewPly(1, sampleGame, undefined, undefined, []);
		expect(r.classCode).toBeNull();
		expect(r.best).toBeNull();
		expect(r.coachText).toBe(
			"Move classification isn't available yet — analysis for this move hasn't finished."
		);
	});
```

Also update the `'only exposes \`best\` when the played move is a NOT_BEST_CODE and bestMoves has an entry'` test to pass explicit `classCodes` instead of relying on the mock default (the mock `CLASS_CODES` default still exists for convenience, but this test should be explicit about what it's asserting):

```typescript
	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14, sampleGame).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy (from default mock CLASS_CODES)
		expect(getReviewPly(1, sampleGame).best).toBeNull(); // book, not a NOT_BEST code
	});
```

(Leave this one using the module's default `CLASS_CODES` mock — `CLASS_CODES[13]` is `'inaccuracy'` and `CLASS_CODES[0]` is `'book'` per `mock-data.ts`, so the assertions still hold unchanged; removing the `isSample` gate doesn't affect this test at all, since it never passed `isSample` in the first place — it only ever depended on `classCodes`, which here is still the default mock array.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getReviewPly` only accepts 4 params; the 5th argument (`classCodes`) is silently ignored, so `r.classCode` still resolves via the old `isSample` gate and doesn't match `'excellent'`/`'blunder'`, and the "not ready" test's coach text doesn't match the new copy.

- [ ] **Step 3: Update `getReviewPly` in `src/lib/game/review.ts`**

Replace the `UNCLASSIFIED_COACH_TEXT` constant:

```typescript
export const UNCLASSIFIED_COACH_TEXT =
	"Move classification isn't available yet — analysis for this move hasn't finished.";
```

Replace the `getReviewPly` function signature and its `classCode`/`coachText` derivation:

```typescript
export function getReviewPly(
	ply: number,
	game: GameData,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES,
	classCodes: ClassCode[] = CLASS_CODES
): ReviewPly {
	const position = game.positions[ply];
	const lastMove = ply > 0 ? game.moveMeta[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? (classCodes[ply - 1] ?? null) : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Retrospective "best was" text (CoachCard): only surfaced when the played
	// move was one of the NOT_BEST classifications and mock data has an entry.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;

	// Prospective board arrow: the engine's top suggestion computed FROM the
	// position currently on screen, for whichever move comes next -- always
	// shown when available, independent of classCode, for any loaded game.
	const nextBest = bestMoves[ply + 1] ?? null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + game.sanList[ply - 1] : 'Start';
	const coachText =
		ply === 0 ? INTRO_COACH_TEXT : classCode ? COACH_TEXT_MAP[classCode] : UNCLASSIFIED_COACH_TEXT;

	return {
		position,
		lastMove,
		classCode,
		best,
		nextBest,
		evalNum,
		evalStr,
		whitePct,
		coachMove,
		coachText
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/review.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts
git commit -m "feat: getReviewPly classifies from real classCodes, not the isSample mock gate"
```

---

