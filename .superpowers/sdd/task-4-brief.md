## Task 4: `appState` — real PGN loading, `game` field, `getMaxPly`

**Files:**
- Create: `src/lib/game/sample-pgn.ts`
- Modify: `src/lib/components/OnboardingScreen.svelte`
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`
- Modify: `src/lib/components/ReviewPanel.svelte`

**Interfaces:**
- Consumes: `parsePgn` from `$lib/api/pgn` (Task 3).
- Produces (used by Task 5 and by components): a `GameData` interface DEFINED IN THIS TASK, locally inside `app-state.svelte.ts` (shape: `{ sanList: string[]; positions: Position[]; moveMeta: Move[]; isSample: boolean }`) — Task 5 moves this definition into `review.ts` and updates this file's import accordingly (`review.ts` doesn't exist with this shape yet at this point in the plan, so defining it here first and relocating it in Task 5 avoids a forward reference). Also produces: `AppState.game: GameData | null`, `AppState.parseError: string | null`, `export function getMaxPly(): number`.

- [ ] **Step 1: Extract the sample PGN into a shared file**

Create `src/lib/game/sample-pgn.ts`:

```ts
/** The one built-in sample game (Italian Game) — the only PGN with matching
 * mock classification/coach-text/breakdown data in mock-data.ts. Shared
 * between OnboardingScreen.svelte (the "Paste sample game" button) and
 * app-state.svelte.ts (to detect isSample via exact-text comparison). */
export const SAMPLE_PGN =
	'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';
```

In `src/lib/components/OnboardingScreen.svelte`, replace:

```ts
	const SAMPLE_PGN =
		'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';
```

with:

```ts
	import { SAMPLE_PGN } from '$lib/game/sample-pgn';
```

(add this alongside the existing `import { appState, startReview } from ...` line at the top of the `<script>` block; remove the old local `const SAMPLE_PGN = ...` entirely).

- [ ] **Step 2: Write the failing tests for `appState`'s new fields/behavior**

Replace the top of `src/lib/stores/app-state.test.ts` (its imports) with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadRealAnalysis } = vi.hoisted(() => ({ loadRealAnalysis: vi.fn() }));
vi.mock('$lib/game/engine-analysis', () => ({ loadRealAnalysis }));

const { parsePgn } = vi.hoisted(() => ({ parsePgn: vi.fn() }));
vi.mock('$lib/api/pgn', () => ({ parsePgn }));

import { createAppState } from './app-state.svelte';
import {
	appState,
	getMaxPly,
	goToPly,
	stepPly,
	startReview,
	newGame,
	handleReviewKeydown
} from './app-state.svelte';
```

Then replace the existing test:
```ts
it('MAX_PLY matches the mock game length (31)', () => {
	expect(MAX_PLY).toBe(31);
});
```
with (this now needs a loaded game, since `getMaxPly()` reads `appState.game`):
```ts
it('getMaxPly returns 0 before any game is loaded, and the real length after startReview', async () => {
	expect(getMaxPly()).toBe(0);

	parsePgn.mockResolvedValue({
		sanList: Array.from({ length: 31 }, (_, i) => `move${i}`),
		positions: Array.from({ length: 32 }, () => ({})),
		moves: Array.from({ length: 31 }, () => ({ from: 'a1', to: 'a1' }))
	});
	loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });

	await startReview();

	expect(getMaxPly()).toBe(31);
});
```

Every OTHER pre-existing test in the `beforeEach`-scoped `describe('screen/ply transitions', ...)` block that calls `goToPly`/`stepPly` directly (not `startReview`) is unaffected by this change (they set `appState.ply` manually in their own `beforeEach` and don't depend on `getMaxPly()`'s return value being any particular number for their own assertions) — EXCEPT `goToPly(999)` clamping to "MAX_PLY" — update that one assertion:

```ts
it('goToPly clamps to [0, MAX_PLY]', () => {
	goToPly(-5);
	expect(appState.ply).toBe(0);
	goToPly(999);
	expect(appState.ply).toBe(getMaxPly());
	goToPly(10);
	expect(appState.ply).toBe(10);
});
```

Add two new tests to the `describe('screen/ply transitions', ...)` block (or a new `describe` block) covering the new async success/error paths of `startReview`:

```ts
describe('startReview (real PGN parsing)', () => {
	beforeEach(() => {
		parsePgn.mockReset();
		loadRealAnalysis.mockReset();
		loadRealAnalysis.mockResolvedValue({ evalPerPly: [], bestMoves: {} });
	});

	it('on successful parse: populates game, resets parseError, and loads the review screen', async () => {
		appState.pgnText = '1. e4 e5';
		appState.parseError = 'stale error from a previous attempt';
		parsePgn.mockResolvedValue({
			sanList: ['e4', 'e5'],
			positions: [{}, {}, {}],
			moves: [
				{ from: 'e2', to: 'e4' },
				{ from: 'e7', to: 'e5' }
			]
		});

		await startReview();

		expect(parsePgn).toHaveBeenCalledWith('1. e4 e5');
		expect(appState.parseError).toBeNull();
		expect(appState.game?.sanList).toEqual(['e4', 'e5']);
		expect(appState.game?.isSample).toBe(false);
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(2);
		expect(appState.evalPerPly).toEqual([0, 0, 0]);
	});

	it('falls back to the sample PGN when pgnText is blank, and flags isSample true', async () => {
		appState.pgnText = '   ';
		parsePgn.mockResolvedValue({
			sanList: ['e4'],
			positions: [{}, {}],
			moves: [{ from: 'e2', to: 'e4' }]
		});

		await startReview();

		const { SAMPLE_PGN } = await import('$lib/game/sample-pgn');
		expect(parsePgn).toHaveBeenCalledWith(SAMPLE_PGN);
		expect(appState.game?.isSample).toBe(true);
	});

	it('on parse failure: sets parseError and does not load the review screen', async () => {
		appState.pgnText = 'not a real pgn';
		appState.gameLoaded = false;
		parsePgn.mockRejectedValue(new Error('illegal move'));

		await startReview();

		expect(appState.parseError).toBe('illegal move');
		expect(appState.gameLoaded).toBe(false);
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `appState.game`/`appState.parseError`/`getMaxPly` don't exist yet; `MAX_PLY` import breaks other tests too (expected, being replaced in this same task).

- [ ] **Step 4: Implement the `appState` changes**

In `src/lib/stores/app-state.svelte.ts`, change the imports at the top from:

```ts
import type { Move } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST, EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
```

to:

```ts
import type { Move, Position } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
import { parsePgn } from '$lib/api/pgn';
import { SAMPLE_PGN } from '$lib/game/sample-pgn';
```

Define `GameData` locally in this file for now (Task 5 will move this exact definition into `review.ts`, since that's where it conceptually belongs once that file is rewritten, and will update this file's import to pull it from there instead — this file doesn't have a `review.ts` with this shape to import from yet at this point in the plan):

```ts
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	isSample: boolean;
}
```

Update the `AppState` interface, adding two fields:

```ts
export interface AppState {
	screen: Screen;
	ply: number;
	tab: Tab;
	flipped: boolean;
	sidebarCollapsed: boolean;
	gameLoaded: boolean;
	pgnText: string;
	showLines: boolean;
	selfAnalysis: boolean;
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
	game: GameData | null;
	parseError: string | null;
}
```

Update `defaultState`, adding the two fields and removing the now-unused `evalPerPly`/`bestMoves` mock-array seeding (there is no game loaded yet at app start, so these seed as empty until a game is parsed):

```ts
const defaultState: AppState = {
	screen: 'review',
	ply: 31,
	tab: 'analysis',
	flipped: false,
	sidebarCollapsed: false,
	gameLoaded: false,
	pgnText: '',
	showLines: true,
	selfAnalysis: false,
	evalPerPly: [...EVAL_PER_PLY],
	bestMoves: { ...BEST_MOVES },
	analysisStatus: 'idle',
	game: null,
	parseError: null
};
```

(Note: `EVAL_PER_PLY`/`BEST_MOVES` are still imported and still used here for the default/idle-state seed shown before any `startReview()` call — this is harmless since `screen` defaults to `'review'` but `gameLoaded` defaults to `false`, so the Onboarding screen shows, not the board; keeping this seed avoids an unrelated behavior change to `createAppState()`'s existing snapshot test.)

Replace the module-level `export const MAX_PLY = SAN_LIST.length;` with:

```ts
export function getMaxPly(): number {
	return appState.game ? appState.game.sanList.length : 0;
}
```

Update `goToPly`:

```ts
export function goToPly(ply: number): void {
	appState.ply = Math.max(0, Math.min(getMaxPly(), ply));
}
```

Replace `startReview` (previously synchronous) with:

```ts
/** Parses the pasted/typed PGN (or the built-in sample if blank) via the real
 * Rust pgn module, replacing the mock SAN engine (LOGIC.md §7/§8). */
export async function startReview(): Promise<void> {
	const pgnToParse = appState.pgnText.trim() || SAMPLE_PGN;
	try {
		const parsed = await parsePgn(pgnToParse);
		appState.game = {
			sanList: parsed.sanList,
			positions: parsed.positions,
			moveMeta: parsed.moves,
			isSample: pgnToParse.trim() === SAMPLE_PGN.trim()
		};
		appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
		appState.bestMoves = {};
		appState.analysisStatus = 'idle';
		appState.parseError = null;
		appState.gameLoaded = true;
		appState.screen = 'review';
		appState.ply = parsed.sanList.length;
		appState.tab = 'analysis';
		void refreshRealAnalysis();
	} catch (err) {
		appState.parseError = err instanceof Error ? err.message : 'Failed to parse PGN.';
	}
}
```

`refreshRealAnalysis` (from Iteration 5) is unchanged.

- [ ] **Step 5: Update `ReviewPanel.svelte`'s `MAX_PLY` call site**

In `src/lib/components/ReviewPanel.svelte`, change:

```ts
	import { appState, goToPly, stepPly, MAX_PLY } from '$lib/stores/app-state.svelte';
```

to:

```ts
	import { appState, goToPly, stepPly, getMaxPly } from '$lib/stores/app-state.svelte';
```

and change:

```svelte
			onLast={() => goToPly(MAX_PLY)}
```

to:

```svelte
			onLast={() => goToPly(getMaxPly())}
```

- [ ] **Step 6: Add the onboarding error banner**

In `src/lib/components/OnboardingScreen.svelte`, add a conditional error message inside the `.pgn-card` div, just above the `<textarea>`:

```svelte
			{#if appState.parseError}
				<div class="parse-error">{appState.parseError}</div>
			{/if}
```

Add its style, alongside the existing `.card-header`/`textarea` rules:

```css
	.parse-error {
		margin-bottom: 10px;
		padding: 10px 12px;
		border-radius: var(--radius-inset);
		background: rgba(242, 107, 107, 0.08);
		border: 1px solid rgba(242, 107, 107, 0.3);
		color: var(--color-blunder);
		font-size: 12px;
		line-height: 1.4;
	}
```

(Check `src/lib/tokens.ts`/`src/app.css` first for the exact existing CSS custom property name for the "blunder"/red classification color — reuse whatever already exists there, e.g. `--color-blunder` or `--color-red`, rather than introducing a new hardcoded `#F26B6B`. If no such CSS variable currently exists, use the raw `rgba(242, 107, 107, 1)` value matching `TOKENS.classification.blunder.color` from `src/lib/tokens.ts` exactly, since that's the design system's own red — do not invent a new color.)

- [ ] **Step 7: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: all tests pass (existing tests + new ones).

Run: `pnpm run test -- --run`
Expected: other test files will still fail at this point (Tasks 5/6 haven't updated `review.ts`/`review.test.ts`/`mock-data.ts` yet, and `GameReviewScreen.svelte`/`AnalysisTab.svelte` still call the old `getReviewPly` signature) — this is expected; only confirm `app-state.test.ts` and `api/pgn.test.ts` pass cleanly at this point. Do not attempt to fix unrelated failing files in this task.

- [ ] **Step 8: Commit**

```bash
git add src/lib/game/sample-pgn.ts src/lib/components/OnboardingScreen.svelte \
  src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts \
  src/lib/components/ReviewPanel.svelte
git commit -m "feat: wire startReview to real PGN parsing via the Rust pgn module"
```

---

