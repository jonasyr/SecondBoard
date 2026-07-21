### Task 2: Per-phase accuracy and badge-ready rows

**Files:**
- Modify: `src/lib/game/accuracy.ts`
- Modify: `src/lib/game/accuracy.test.ts`
- Modify: `src/lib/game/phase.ts`
- Modify: `src/lib/game/phase.test.ts`

**Interfaces:**
- Consumes: `dividePhases`/`PhaseDivision` from Task 1 (same file). `computeGameAccuracy(evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): GameAccuracy` and `Wdl` from `./accuracy` (existing, `GameAccuracy = { white: number | null; black: number | null }`).
- Produces: `computeGameAccuracy`'s new optional 3rd parameter `startPly = 0` (additive, backward compatible). `export type PhaseBadgeCode = 'best' | 'good' | 'inaccuracy'` and `export interface PhaseRow { name: 'Opening' | 'Middlegame' | 'Endgame'; white: { code: PhaseBadgeCode; accuracy: number } | null; black: { code: PhaseBadgeCode; accuracy: number } | null }` and `export function getPhaseRows(positions: Position[], evalPerPly: number[], wdlPerPly?: (Wdl | null)[]): PhaseRow[]` (always returns exactly 3 rows, in Opening/Middlegame/Endgame order; `white`/`black` are `null` when that side has fewer than 2 analyzed plies in that phase, matching `computeGameAccuracy`'s own null-for-insufficient-data behavior -- never a fabricated number). Task 3 renders this directly.

**Why `computeGameAccuracy` needs a new parameter:** `computeGameAccuracy`'s per-move loop calls `sideToMoveForPly(ply)` where `ply` is the LOOP index (0-based from the start of whatever array it's given). `sideToMoveForPly(ply)` is `ply % 2 === 0 ? 'w' : 'b'` -- a GLOBAL parity function. If Task 2's `getPhaseRows` simply sliced `evalPerPly`/`wdlPerPly` to a phase's `[start, end)` range and called `computeGameAccuracy` on the slice directly, every mover color inside that slice would be silently WRONG whenever `start` is odd (i.e. whenever a phase happens to begin on Black's move) -- White's moves would be attributed to Black and vice versa for that entire phase. Adding an optional `startPly` parameter (defaulting to `0`, so every existing call site is completely unaffected) lets the internal loop compute `sideToMoveForPly(startPly + ply)` instead, fixing this without touching any other behavior.

- [ ] **Step 1: Write the failing test for `computeGameAccuracy`'s new parameter**

Add to `src/lib/game/accuracy.test.ts` (find the `describe('computeGameAccuracy', ...)` block and add this test inside it; if you're not sure of the exact existing block name, run `grep -n "describe(" src/lib/game/accuracy.test.ts` first to confirm):

```typescript
	it('attributes movers correctly when startPly shifts an odd-indexed slice (Black moves first in the slice)', () => {
		// Move index `m` (0-indexed from the game's own start, White=even,
		// Black=odd per sideToMoveForPly) goes FROM evalPerPly[m] TO
		// evalPerPly[m+1]. A slice that starts at global ply 1 represents move
		// index 1 (Black's 1st move, since sideToMoveForPly(1) === 'b').
		// Full-game evalPerPly: ply0(start)=0, ply1=5 (White up a bit after its
		// own 1st move), ply2=-5 (White-POV eval swings hugely in Black's
		// favor after Black's 1st move).
		const evalPerPly = [0, 5, -5];
		const slice = evalPerPly.slice(1, 3); // [5, -5] -- just Black's move, ply1->ply2

		const withoutStartPly = computeGameAccuracy(slice); // WRONG: treats local index 0 as White's move
		const withStartPly = computeGameAccuracy(slice, undefined, 1); // correct: local index 0 is global ply1, Black to move

		// Without startPly, the single move in this slice is misattributed to
		// White: White-POV win% drops from ~86.3 (eval +5) to ~13.7 (eval -5),
		// a big self-inflicted loss -- some real (non-null) low accuracy, with
		// Black getting no data (null, zero moves attributed to it).
		// With startPly=1, the mover is correctly Black, and the SAME eval
		// swing (+5 -> -5) IMPROVES Black's own win% (13.7 -> 86.3), so
		// Black's accuracy must be exactly 100 (moveAccuracyFromWinPercents
		// returns 100 whenever afterPov >= beforePov) and White gets no data.
		expect(withoutStartPly.white).not.toBeNull();
		expect(withoutStartPly.black).toBeNull();
		expect(withStartPly.white).toBeNull();
		expect(withStartPly.black).toBe(100);
	});

	it('defaults startPly to 0, reproducing existing behavior byte-for-byte when omitted', () => {
		const evalPerPly = [0, 1, 0.5];
		const withDefault = computeGameAccuracy(evalPerPly);
		const withExplicitZero = computeGameAccuracy(evalPerPly, undefined, 0);
		expect(withDefault).toEqual(withExplicitZero);
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: FAIL on the first new test (`withStartPly.black` is not `100` -- the 3rd argument is silently ignored since the parameter doesn't exist yet, so both calls behave identically and the "attributes movers correctly" assertions for the with-startPly case fail).

- [ ] **Step 3: Add the `startPly` parameter**

In `src/lib/game/accuracy.ts`, modify `computeGameAccuracy`'s signature and its per-move loop (the function currently reads, per this session's inspection -- confirm exact current line numbers with `grep -n "export function computeGameAccuracy" -A 3 src/lib/game/accuracy.ts` before editing):

```typescript
export function computeGameAccuracy(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	startPly = 0
): GameAccuracy {
```

And inside the function body, change:

```typescript
	for (let ply = 0; ply < moveCount; ply++) {
		const mover = sideToMoveForPly(ply);
```

to:

```typescript
	for (let ply = 0; ply < moveCount; ply++) {
		const mover = sideToMoveForPly(startPly + ply);
```

Also update the function's doc comment (immediately above it) to mention the new parameter -- append this sentence to the existing comment block: `` `startPly` (default 0) shifts the mover-color attribution for callers passing a SLICE of a larger game's evalPerPly/wdlPerPly (e.g. one phase's ply range) rather than the whole game from ply 0 -- see phase.ts's `getPhaseRows` for the motivating caller. ``

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/accuracy.test.ts`
Expected: PASS, full file (confirm the count via the test output; every pre-existing test must still pass unmodified).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/accuracy.ts src/lib/game/accuracy.test.ts
git commit -m "feat(accuracy): add optional startPly param for correct mover attribution on ply-range slices"
```

- [ ] **Step 6: Write the failing tests for `getPhaseRows`**

Add to `src/lib/game/phase.test.ts` (new `describe` block, new imports at the top -- add `Wdl` and `computeGameAccuracy` are NOT needed as imports here since the test only calls `getPhaseRows`; just add `getPhaseRows` to the existing `import { dividePhases } from './phase';` line, making it `import { dividePhases, getPhaseRows } from './phase';`):

```typescript
describe('getPhaseRows', () => {
	it('always returns exactly 3 rows in Opening/Middlegame/Endgame order', () => {
		const rows = getPhaseRows([STARTING_POSITION, STARTING_POSITION], [0, 0]);
		expect(rows.map((r) => r.name)).toEqual(['Opening', 'Middlegame', 'Endgame']);
	});

	it('returns null for both sides of a phase with fewer than 2 analyzed plies', () => {
		// A 2-position (1-ply) game never leaves the opening (dividePhases
		// returns middlePly: null), so Middlegame and Endgame each get a
		// zero-length slice -- no data, not a fabricated badge.
		const rows = getPhaseRows([STARTING_POSITION, STARTING_POSITION], [0, 0.2]);
		const middlegame = rows.find((r) => r.name === 'Middlegame')!;
		const endgame = rows.find((r) => r.name === 'Endgame')!;
		expect(middlegame.white).toBeNull();
		expect(middlegame.black).toBeNull();
		expect(endgame.white).toBeNull();
		expect(endgame.black).toBeNull();
	});

	it('assigns the "best" badge code for high accuracy and "inaccuracy" for low accuracy', () => {
		// Opening-only game (dividePhases never leaves the opening for a
		// repeated starting position, 4 plies = 2 White + 1 Black move).
		// evalPerPly: ply0=0, ply1=0 (White's move: 0->0, perfect, "best"),
		// ply2=9 (Black's move: 0->9, White-POV eval swinging hugely AGAINST
		// Black is a catastrophic self-inflicted drop in Black's own win% --
		// "inaccuracy"), ply3=9 (White's 2nd move: 9->9, unchanged, "best",
		// averaged with White's 1st move -> still "best" overall).
		const positions = [STARTING_POSITION, STARTING_POSITION, STARTING_POSITION, STARTING_POSITION];
		const evalPerPly = [0, 0, 9, 9];
		const rows = getPhaseRows(positions, evalPerPly);
		const opening = rows.find((r) => r.name === 'Opening')!;
		expect(opening.white?.code).toBe('best');
		expect(opening.black?.code).toBe('inaccuracy');
	});

	it('includes the exact accuracy value alongside the badge code (for the UI tooltip)', () => {
		const positions = [STARTING_POSITION, STARTING_POSITION];
		const evalPerPly = [0, 0];
		const rows = getPhaseRows(positions, evalPerPly);
		const opening = rows.find((r) => r.name === 'Opening')!;
		expect(opening.white?.accuracy).toBe(100);
	});
});
```

- [ ] **Step 7: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/phase.test.ts`
Expected: FAIL with "getPhaseRows is not a function" (or a TypeScript resolution error, since it doesn't exist yet).

- [ ] **Step 8: Implement `getPhaseRows`**

Append to `src/lib/game/phase.ts` (add these imports to the top of the file, alongside the existing `import type { Piece, PieceColor, Position, Square } from '$lib/board/types';` line -- add a new line: `import { computeGameAccuracy, type Wdl } from './accuracy';`):

```typescript
/**
 * Which of the 3 existing chess.com-style classification badges to show for
 * a phase's accuracy. Reuses the existing `best`/`good`/`inaccuracy`
 * ClassCode/TOKENS.classification entries (green star / green check / amber
 * "?!") rather than inventing new icons. chess.com's own real thresholds for
 * its Opening/Middlegame/Endgame phase icons are NOT publicly documented
 * anywhere (confirmed via chess.com's own support articles and forum threads
 * -- a chess.com moderator, asked directly, replied "I'm not seeing anything
 * documented. I'm asking about it") -- these thresholds are SecondBoard's own
 * design choice, not a chess.com or lichess port.
 */
export type PhaseBadgeCode = 'best' | 'good' | 'inaccuracy';

const PHASE_BEST_THRESHOLD = 90;
const PHASE_GOOD_THRESHOLD = 75;

function phaseBadgeCode(accuracy: number): PhaseBadgeCode {
	if (accuracy >= PHASE_BEST_THRESHOLD) return 'best';
	if (accuracy >= PHASE_GOOD_THRESHOLD) return 'good';
	return 'inaccuracy';
}

export interface PhaseRow {
	name: 'Opening' | 'Middlegame' | 'Endgame';
	white: { code: PhaseBadgeCode; accuracy: number } | null;
	black: { code: PhaseBadgeCode; accuracy: number } | null;
}

/**
 * Real per-phase, per-side accuracy and badge rows, replacing mock-data.ts's
 * PHASE_ROWS. Phase boundaries come from `dividePhases` (Task 1, a lichess
 * `Divider` port); each phase's accuracy reuses this codebase's existing
 * lichess-ported `computeGameAccuracy`, applied only to that phase's ply
 * range (via `startPly` so mover-color attribution stays correct across the
 * slice boundary -- see accuracy.ts). This composition -- computing accuracy
 * separately per phase bucket -- is SecondBoard's own design choice; lichess
 * itself only exposes a similar per-phase breakdown in its separate,
 * account-gated "Insights" feature, whose exact source could not be
 * confirmed this session.
 */
export function getPhaseRows(
	positions: Position[],
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): PhaseRow[] {
	const division = dividePhases(positions);
	const openingEnd = division.middlePly ?? division.totalPlies;
	const middleEnd = division.endPly ?? division.totalPlies;

	const ranges: Array<[PhaseRow['name'], number, number]> = [
		['Opening', 0, openingEnd],
		['Middlegame', openingEnd, middleEnd],
		['Endgame', middleEnd, division.totalPlies]
	];

	return ranges.map(([name, start, end]) => {
		const { white, black } = computeGameAccuracy(
			evalPerPly.slice(start, end),
			wdlPerPly?.slice(start, end),
			start
		);
		return {
			name,
			white: white === null ? null : { code: phaseBadgeCode(white), accuracy: white },
			black: black === null ? null : { code: phaseBadgeCode(black), accuracy: black }
		};
	});
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/phase.test.ts`
Expected: PASS, all tests (Task 1's 8 plus Task 2's 4 = 12).

- [ ] **Step 10: Commit**

```bash
git add src/lib/game/phase.ts src/lib/game/phase.test.ts
git commit -m "feat(phase): compute real per-phase accuracy and badge rows"
```

---

