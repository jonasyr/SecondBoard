## Task 7: `appState` — real analysis fields + `startReview` wiring

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: `loadRealAnalysis`, `RealAnalysis` from `$lib/game/engine-analysis` (Task 6); `EVAL_PER_PLY`, `BEST_MOVES` from `$lib/game/mock-data` (existing); `Move` from `$lib/board/types` (existing).
- Produces (used by Task 8): `AppState` interface gains `evalPerPly: number[]`, `bestMoves: Record<number, Move & { san: string }>`, `analysisStatus: 'idle' | 'loading' | 'ready' | 'error'`. `startReview()` now also triggers the async real-analysis load (fire-and-forget from the caller's perspective — it awaits internally and updates `appState` in place).

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/app-state.test.ts`, near the top (after the existing imports), replacing the existing import block with:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';

const { loadRealAnalysis } = vi.hoisted(() => ({ loadRealAnalysis: vi.fn() }));
vi.mock('$lib/game/engine-analysis', () => ({ loadRealAnalysis }));

import { createAppState } from './app-state.svelte';
import {
	appState,
	MAX_PLY,
	goToPly,
	stepPly,
	startReview,
	newGame,
	handleReviewKeydown
} from './app-state.svelte';
```

Then append a new `describe` block at the end of the file:

```ts
describe('real analysis loading', () => {
	beforeEach(() => {
		loadRealAnalysis.mockReset();
	});

	it('starts in the idle status by default', () => {
		const state = createAppState();
		expect(state.analysisStatus).toBe('idle');
		expect(state.evalPerPly.length).toBeGreaterThan(0);
	});

	it('goes loading -> ready and applies the real data on startReview success', async () => {
		let resolveAnalysis!: (v: { evalPerPly: number[]; bestMoves: Record<number, never> }) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		startReview();
		expect(appState.analysisStatus).toBe('loading');

		resolveAnalysis({ evalPerPly: [0, 0.3], bestMoves: {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('ready');
		expect(appState.evalPerPly).toEqual([0, 0.3]);
	});

	it('goes loading -> error when loadRealAnalysis rejects', async () => {
		loadRealAnalysis.mockRejectedValue(new Error('engine offline'));

		startReview();
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('error');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `state.analysisStatus` is `undefined`, `startReview` doesn't touch `analysisStatus`.

- [ ] **Step 3: Implement the `appState` changes**

In `src/lib/stores/app-state.svelte.ts`, change the imports at the top from:

```ts
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST } from '$lib/game/mock-data';
```

to:

```ts
import type { Move } from '$lib/board/types';
import type { Screen, Tab } from '$lib/types';
import { SAN_LIST, EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
```

Update the `AppState` interface, adding three fields:

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
}
```

Update `defaultState`, adding the three fields (seeded from the mock arrays so nothing changes visually before real analysis resolves):

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
	analysisStatus: 'idle'
};
```

Update `startReview` and add `refreshRealAnalysis`:

```ts
/** Reference `startReview` handler: always loads the same mock game — pgnText is cosmetic (Global Constraints). */
export function startReview(): void {
	appState.gameLoaded = true;
	appState.screen = 'review';
	appState.ply = MAX_PLY;
	appState.tab = 'analysis';
	void refreshRealAnalysis();
}

/** Fires the Phase-0 engine spike (LOGIC.md §7): replaces the seeded mock
 * evalPerPly/bestMoves with real Stockfish output once analysis completes. */
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves } = await loadRealAnalysis();
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/stores/app-state.test.ts`
Expected: all tests pass (existing tests + 3 new ones).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts
git commit -m "feat: wire startReview to load real per-ply engine analysis"
```

---

