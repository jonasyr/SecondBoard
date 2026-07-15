### Task 9: Temporary visual-verification harness

**Files:**
- Create: `src/lib/board/dev-fixtures.ts`
- Create: `src/lib/board/dev-fixtures.test.ts`
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page.test.ts`

**Interfaces:**
- Consumes: `Board` (Task 8), `Position`, `Move` from `$lib/board/types` (Task 2), `ClassCode` from `$lib/types`, `appState` from `$lib/stores/app-state.svelte`.
- Produces: `DEV_GAME` (positions/meta arrays) — consumed only by this task's harness in `+page.svelte`. **This entire file is temporary** and is expected to be deleted in Iteration 4 once the real Game Review screen wires real backend data (per the Global Constraints' warning about shipping the mock SAN engine).

Per README §11 step 3's exit bar ("Verify each screen against `reference/SecondBoard.dc.html` at every step — 1:1, zero visual deviation") and LOGIC.md §8 step 4 ("pixel-verify against `reference/screens/2-*.png` and `3-*.png`"), the Board component needs to be visually checked against the reference screenshots before Iteration 4 builds the full Game Review screen around it. This task ports the reference's tiny mock SAN engine (`reference/logic/chess-mock.js`'s `standardBoard`/`applySan`/`buildGame`) and the sample game data (`reference/logic/data.js`'s `sanList`/`classCodes`/`bestMoves`) **verbatim, but only into this explicitly-temporary dev file** — never into product code.

- [ ] **Step 1: Write the failing test**

Create `src/lib/board/dev-fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { DEV_GAME } from './dev-fixtures';

describe('DEV_GAME (temporary mock fixture, Iteration 3 visual QA only)', () => {
	it('has 32 positions (ply 0 through 31) for the 31-half-move sample game', () => {
		expect(DEV_GAME.positions).toHaveLength(32);
	});

	it('has the standard starting position at ply 0', () => {
		expect(DEV_GAME.positions[0].e2).toEqual(['P', 'w']);
		expect(DEV_GAME.positions[0].e7).toEqual(['P', 'b']);
		expect(Object.keys(DEV_GAME.positions[0])).toHaveLength(32);
	});

	it('reflects 1.e4 after ply 1 (pawn moved from e2 to e4)', () => {
		expect(DEV_GAME.positions[1].e4).toEqual(['P', 'w']);
		expect(DEV_GAME.positions[1].e2).toBeUndefined();
	});

	it('has 31 move-meta entries aligned to the 31 plies', () => {
		expect(DEV_GAME.meta).toHaveLength(31);
		expect(DEV_GAME.meta[0]).toEqual({ from: 'e2', to: 'e4' });
	});

	it('has a classification code and eval per ply, aligned to the sample data', () => {
		expect(DEV_GAME.classCodes).toHaveLength(31);
		expect(DEV_GAME.classCodes[30]).toBe('brilliant'); // ply 31's move (16.Ne5)
		expect(DEV_GAME.evalPerPly).toHaveLength(32);
	});

	it('exposes the two best-move entries where the played move was not best', () => {
		expect(DEV_GAME.bestMoves[14]).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' });
		expect(DEV_GAME.bestMoves[30]).toEqual({ from: 'f6', to: 'g4', san: 'Ng4' });
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- --run src/lib/board/dev-fixtures.test.ts`
Expected: FAIL — `./dev-fixtures` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/board/dev-fixtures.ts`:

```ts
/**
 * ============================================================================
 * TEMPORARY — DEV/QA-ONLY FIXTURE. NOT PRODUCT CODE. DO NOT IMPORT ELSEWHERE.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/chess-mock.js
 * (the mock SAN->position engine) and reference/logic/data.js (the sample
 * Italian Game). LOGIC.md explicitly warns "THIS IS A MOCK... In the REAL
 * app you MUST NOT ship this — replace it with the Rust `pgn` module using
 * `shakmaty`". This file exists ONLY to feed a temporary visual-verification
 * harness in src/routes/+page.svelte so the Board component (Iteration 3)
 * can be pixel-compared against reference/screens/2-*.png and 3-*.png
 * before the real Game Review screen (Iteration 4) replaces this wiring
 * with real backend data. Delete this file once Iteration 4 lands.
 */
import type { ClassCode } from '$lib/types';
import type { Move, Piece, Position } from './types';

const FILES = 'abcdefgh';

function standardBoard(): Position {
	const board: Position = {};
	const back: Piece[0][] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
	for (let f = 0; f < 8; f++) {
		board[FILES[f] + '1'] = [back[f], 'w'];
		board[FILES[f] + '2'] = ['P', 'w'];
		board[FILES[f] + '8'] = [back[f], 'b'];
		board[FILES[f] + '7'] = ['P', 'b'];
	}
	return board;
}

function clearPath(b: Position, f: number, r: number, tf: number, tr: number): boolean {
	const sf = Math.sign(tf - f);
	const sr = Math.sign(tr - r);
	let cf = f + sf;
	let cr = r + sr;
	while (cf !== tf || cr !== tr) {
		if (b[FILES[cf] + cr]) return false;
		cf += sf;
		cr += sr;
	}
	return true;
}

function canReach(b: Position, piece: string, f: number, r: number, tf: number, tr: number): boolean {
	const df = tf - f;
	const dr = tr - r;
	const af = Math.abs(df);
	const ar = Math.abs(dr);
	if (piece === 'N') return (af === 1 && ar === 2) || (af === 2 && ar === 1);
	if (piece === 'K') return af <= 1 && ar <= 1;
	if (piece === 'B') return af === ar && df !== 0 && clearPath(b, f, r, tf, tr);
	if (piece === 'R') return (df === 0 || dr === 0) && clearPath(b, f, r, tf, tr);
	if (piece === 'Q') return (af === ar || df === 0 || dr === 0) && clearPath(b, f, r, tf, tr);
	return false;
}

function applySan(b: Position, sanRaw: string, color: 'w' | 'b'): Move {
	let san = sanRaw.replace(/[+#!?]/g, '');
	const rank = color === 'w' ? '1' : '8';
	if (san === 'O-O') {
		b['g' + rank] = b['e' + rank];
		delete b['e' + rank];
		b['f' + rank] = b['h' + rank];
		delete b['h' + rank];
		return { from: 'e' + rank, to: 'g' + rank };
	}
	if (san === 'O-O-O') {
		b['c' + rank] = b['e' + rank];
		delete b['e' + rank];
		b['d' + rank] = b['a' + rank];
		delete b['a' + rank];
		return { from: 'e' + rank, to: 'c' + rank };
	}
	let piece = 'P';
	if ('KQRBN'.indexOf(san[0]) >= 0) {
		piece = san[0];
		san = san.slice(1);
	}
	const capture = san.indexOf('x') >= 0;
	san = san.replace('x', '');
	const target = san.slice(-2);
	san = san.slice(0, -2);
	const tf = FILES.indexOf(target[0]);
	const tr = Number(target[1]);
	let disF: number | null = null;
	let disR: number | null = null;
	for (const ch of san) {
		if (ch >= 'a' && ch <= 'h') disF = FILES.indexOf(ch);
		else if (ch >= '1' && ch <= '8') disR = Number(ch);
	}
	let from: string | null = null;
	if (piece === 'P') {
		if (capture) from = FILES[disF!] + (color === 'w' ? tr - 1 : tr + 1);
		else {
			const one = color === 'w' ? tr - 1 : tr + 1;
			const oneSq = b[FILES[tf] + one];
			if (oneSq && oneSq[0] === 'P') from = FILES[tf] + one;
			else from = FILES[tf] + (color === 'w' ? tr - 2 : tr + 2);
		}
	} else {
		for (const sq in b) {
			const p = b[sq];
			if (p[0] !== piece || p[1] !== color) continue;
			const f = FILES.indexOf(sq[0]);
			const r = Number(sq[1]);
			if (!canReach(b, piece, f, r, tf, tr)) continue;
			if (disF != null && f !== disF) continue;
			if (disR != null && r !== disR) continue;
			from = sq;
			break;
		}
	}
	delete b[target];
	b[target] = [piece as Piece[0], color];
	if (from) delete b[from];
	return { from: from!, to: target };
}

function buildGame(sanList: string[]): { positions: Position[]; meta: Move[] } {
	const b = standardBoard();
	const positions: Position[] = [{ ...b }];
	const meta: Move[] = [];
	let color: 'w' | 'b' = 'w';
	for (const san of sanList) {
		const m = applySan(b, san, color);
		positions.push({ ...b });
		meta.push(m);
		color = color === 'w' ? 'b' : 'w';
	}
	return { positions, meta };
}

// Sample Italian Game, copied verbatim from reference/logic/data.js.
const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6',
	'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1', 'Qe7', 'Ng3', 'Rad8', 'd4',
	'exd4', 'cxd4', 'd5', 'Ne5'
];

const CLASS_CODES: ClassCode[] = [
	'book', 'book', 'book', 'book', 'book', 'book', 'best', 'good', 'good', 'good', 'best', 'best',
	'good', 'inaccuracy', 'best', 'good', 'good', 'good', 'best', 'good', 'good', 'good', 'excellent',
	'good', 'best', 'good', 'great', 'good', 'best', 'inaccuracy', 'brilliant'
];

const EVAL_PER_PLY = [
	0, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.35, 0.25, 0.3, 0.25, 0.3, 0.3, 0.35, 0.1, 0.4, 0.3, 0.35, 0.3,
	0.5, 0.4, 0.45, 0.3, 0.7, 0.55, 0.8, 0.7, 1.3, 1.05, 1.5, 1.0, 2.37
];

const BEST_MOVES: Record<number, Move & { san: string }> = {
	14: { from: 'c8', to: 'g4', san: 'Bg4' },
	30: { from: 'f6', to: 'g4', san: 'Ng4' }
};

const { positions, meta } = buildGame(SAN_LIST);

export const DEV_GAME = {
	positions,
	meta,
	classCodes: CLASS_CODES,
	evalPerPly: EVAL_PER_PLY,
	bestMoves: BEST_MOVES
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- --run src/lib/board/dev-fixtures.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Write the failing page test**

In `src/routes/page.test.ts`, add (adjust the existing `beforeEach` if one already resets `appState`; keep only one `beforeEach`):

```ts
	it('renders the temporary Board QA harness (64 squares) when a game is loaded on the review screen', () => {
		appState.gameLoaded = true;
		appState.screen = 'review';
		const { container } = render(Page);
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
	});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npm run test -- --run src/routes/page.test.ts`
Expected: FAIL — the placeholder page renders no `[data-sq]` elements yet.

- [ ] **Step 7: Wire the harness into `+page.svelte`**

Replace the full contents of `src/routes/+page.svelte`:

```svelte
<script lang="ts">
	import type { Screen } from '$lib/types';
	import { appState } from '$lib/stores/app-state.svelte';
	import Board from '$lib/components/Board.svelte';
	import { DEV_GAME } from '$lib/board/dev-fixtures';

	const SCREEN_LABELS: Record<Exclude<Screen, 'review'>, string> = {
		home: 'Dashboard',
		openings: 'Opening Explorer',
		insights: 'Insights & Weakness Timeline',
		training: 'Training',
		games: 'Games',
		sessions: 'Sessions',
		stats: 'Stats',
		settings: 'Settings'
	};

	const screenLabel = $derived(
		appState.screen === 'review'
			? appState.gameLoaded
				? 'Game Review'
				: 'Onboarding · Paste PGN'
			: SCREEN_LABELS[appState.screen]
	);

	// TEMPORARY Board QA harness (Iteration 3) — lets the Board component be
	// pixel-compared against reference/screens/2-*.png and 3-*.png before
	// Iteration 4 replaces this with the real two-column Game Review layout
	// (avatars, eval bar, tabbed right panel). See board/dev-fixtures.ts.
	let harnessPly = $state(31);
	let harnessFlipped = $state(false);

	const harnessPosition = $derived(DEV_GAME.positions[harnessPly]);
	const harnessLastMove = $derived(harnessPly > 0 ? DEV_GAME.meta[harnessPly - 1] : null);
	const harnessClassCode = $derived(harnessPly > 0 ? DEV_GAME.classCodes[harnessPly - 1] : null);
	const harnessBest = $derived(DEV_GAME.bestMoves[harnessPly] ?? null);
</script>

{#if appState.screen === 'review' && appState.gameLoaded}
	<div class="board-harness">
		<div class="board-sizer">
			<Board
				position={harnessPosition}
				ply={harnessPly}
				flipped={harnessFlipped}
				lastMove={harnessLastMove}
				classCode={harnessClassCode}
				best={harnessBest}
			/>
		</div>
		<div class="board-harness-controls sbmono">
			<button type="button" onclick={() => (harnessPly = Math.max(0, harnessPly - 1))}>Prev</button>
			<span>ply {harnessPly}</span>
			<button type="button" onclick={() => (harnessPly = Math.min(31, harnessPly + 1))}>Next</button>
			<button type="button" onclick={() => (harnessFlipped = !harnessFlipped)}>Flip</button>
		</div>
	</div>
{:else}
	<div class="screen-placeholder">
		{screenLabel} — scaffold OK
	</div>
{/if}

<style>
	.screen-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
	.board-harness {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 16px;
	}
	.board-sizer {
		container-type: size;
		width: min(70vh, 70vw);
		height: min(70vh, 70vw);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.board-harness-controls {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-muted);
	}
	.board-harness-controls button {
		padding: 6px 12px;
		border-radius: var(--radius-control);
		background: var(--color-card-bg);
		border: 1px solid var(--color-hairline-high);
		color: var(--color-text-secondary);
		cursor: pointer;
	}
</style>
```

- [ ] **Step 8: Run the page tests to verify they pass**

Run: `npm run test -- --run src/routes/page.test.ts`
Expected: PASS (all page tests, including the new one).

- [ ] **Step 9: Manually pixel-verify against the reference screenshots**

Run: `npm run dev`

Navigate to the Game Review screen (nav item "Game Review" — this sets `appState.screen='review'`; the harness only appears once `appState.gameLoaded` is true, so temporarily set it via the browser devtools console: none needed — instead, for this manual check only, temporarily edit `src/lib/stores/app-state.svelte.ts`'s `defaultState.gameLoaded` to `true`, refresh, and revert the edit afterward (do not commit the reverted-back state as a change — `git diff` should show no changes to that file when you're done)).

Confirm, at ply 31 (default), against `design_handoff_secondboard/reference/screens/2-game-review-analysis-tab.png`:
- Board square colors, radius, and shadow match.
- The destination square (e5) shows the teal `brilliant` badge (`!!` glyph) and the pulsing ring.
- Coordinate labels appear on the left file and bottom rank, correctly colored per square shade.
- Clicking "Prev" to ply 30 shows the best-move arrow (bent, since `f6-g4` is a knight move) in teal, since ply 30's move is classified `inaccuracy`.
- Clicking "Prev"/"Next" one step at a time animates the moved piece sliding; clicking "Flip" reverses board orientation and does not animate.

Revert the temporary `gameLoaded` default edit in `src/lib/stores/app-state.svelte.ts` before committing this task (`git diff src/lib/stores/app-state.svelte.ts` must be empty).

- [ ] **Step 10: Commit**

```bash
git add src/lib/board/dev-fixtures.ts src/lib/board/dev-fixtures.test.ts src/routes/+page.svelte src/routes/page.test.ts
git commit -m "feat: add temporary Board visual-verification harness with mock game data"
```

---

