## Task 7: `app-state.svelte.ts` + `review.ts` + `ReviewTab.svelte`/`ReviewPanel.svelte` — thread `wdlPerPly` end-to-end

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`
- Modify: `src/lib/components/ReviewPanel.svelte`

**Interfaces:**
- Consumes: `RealAnalysis.wdlPerPly` (Task 6); `classifyGame(evalPerPly, wdlPerPly?)` (Task 5); `computeGameAccuracy(evalPerPly, wdlPerPly?)` (Task 4); `Wdl` type (Task 4).
- Produces: `AppState.wdlPerPly: (Wdl | null)[]`; `getAccuracySummary(game, evalPerPly, wdlPerPly?)` — 3rd parameter.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/app-state.test.ts`, inside the existing `describe('real analysis loading', ...)` block, right after the `'populates classCodes from the real evalPerPly once analysis is ready'` test:

```typescript
	it('populates wdlPerPly from real analysis once it is ready, and resets it to [] on a fresh parse', async () => {
		let resolveAnalysis!: (v: {
			evalPerPly: number[];
			bestMoves: Record<number, never>;
			wdlPerPly: Array<[number, number, number] | null>;
		}) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		await startReview();
		expect(appState.wdlPerPly).toEqual([]);

		resolveAnalysis({ evalPerPly: [0, 1], bestMoves: {}, wdlPerPly: [[500, 400, 100], null] });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.wdlPerPly).toEqual([[500, 400, 100], null]);
	});
```

Add to `src/lib/game/review.test.ts`, at the end of the `describe('getAccuracySummary', ...)` block:

```typescript
	it('accepts an optional wdlPerPly and passes it through to computeGameAccuracy without changing the no-wdl result', () => {
		const game: GameData = { ...sampleGame, result: '0-1' };
		const withoutWdl = getAccuracySummary(game, [0, -3]);
		const withWdl = getAccuracySummary(game, [0, -3], [
			[500, 400, 100],
			[0, 0, 1000]
		]);
		expect(withWdl.white.accuracy).not.toBe(withoutWdl.white.accuracy);
	});
```

Add to `src/lib/components/ReviewTab.test.ts`, add a `wdlPerPly: []` prop to every existing `render(ReviewTab, { props: { ... } })` call in the file (there are 5), then add a new test at the end of the `describe('ReviewTab', ...)` block:

```typescript
	it('gates wdlPerPly on analysisStatus === ready, same as evalPerPly, so no fabricated accuracy uses stale wdl', () => {
		appState.analysisStatus = 'loading';
		const { container } = render(ReviewTab, {
			props: { ply: 1, evalPerPly: new Array(2).fill(0), classCodes: [], wdlPerPly: [[500, 400, 100], null] }
		});
		const chips = container.querySelectorAll('.accuracy-grid .chip.sbmono');
		expect(chips.length).toBe(2);
		chips.forEach((chip) => expect(chip.textContent?.trim()).toBe('—'));
		appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
	});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.test.ts`
Expected: FAIL — `appState.wdlPerPly` is `undefined`; `getAccuracySummary` ignores a 3rd argument; `ReviewTab`'s `Props` doesn't declare `wdlPerPly` yet so passing it does nothing and the gating test can't pass.

- [ ] **Step 3: Wire `wdlPerPly` into `app-state.svelte.ts`**

Modify the top-of-file imports:

```typescript
import type { Move } from '$lib/board/types';
import type { Screen, Tab, ClassCode } from '$lib/types';
import type { Wdl } from '$lib/game/accuracy';
import { EVAL_PER_PLY, BEST_MOVES } from '$lib/game/mock-data';
import { loadRealAnalysis } from '$lib/game/engine-analysis';
import { parsePgn } from '$lib/api/pgn';
import { classifyGame } from '$lib/game/classify';
import { SAMPLE_PGN } from '$lib/game/sample-pgn';
import type { GameData } from '$lib/game/review';
```

Modify `AppState` — add after `classCodes`:

```typescript
	bestMoves: Record<number, Move & { san: string }>;
	classCodes: ClassCode[];
	wdlPerPly: (Wdl | null)[];
```

Modify `defaultState` — add after `classCodes: [],`:

```typescript
	bestMoves: { ...BEST_MOVES },
	classCodes: [],
	wdlPerPly: [],
```

In `startReview`, reset `wdlPerPly` alongside `classCodes`:

```typescript
			appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
			appState.bestMoves = {};
			appState.classCodes = [];
			appState.wdlPerPly = [];
```

In `refreshRealAnalysis`, populate `wdlPerPly` and pass it into `classifyGame`:

```typescript
	try {
		const { evalPerPly, bestMoves, wdlPerPly } = await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.wdlPerPly = wdlPerPly;
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly);
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
```

- [ ] **Step 4: Wire `wdlPerPly` into `getAccuracySummary` (`review.ts`)**

Modify the `./accuracy` import line:

```typescript
import { computeGameAccuracy, resolveWinner, estimatePerformanceRating } from './accuracy';
import type { Wdl } from './accuracy';
```

Modify `getAccuracySummary`'s signature and its `computeGameAccuracy` call:

```typescript
export function getAccuracySummary(
	game: GameData,
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): AccuracySummary {
	const whiteName = game.whiteName ?? PLAYERS.white.name;
	const blackName = game.blackName ?? PLAYERS.black.name;
	const { white, black } = computeGameAccuracy(evalPerPly, wdlPerPly);
	const winner = resolveWinner(game.result);
	// ... (rest of function body unchanged from here)
```

- [ ] **Step 5: Wire `wdlPerPly` into `ReviewTab.svelte` and `ReviewPanel.svelte`**

Modify `src/lib/components/ReviewTab.svelte`'s `<script>` block:

```svelte
<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import { getAccuracySummary } from '$lib/game/review';
	import type { ClassCode } from '$lib/types';
	import type { Wdl } from '$lib/game/accuracy';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		wdlPerPly: (Wdl | null)[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, wdlPerPly, analyzing = false }: Props = $props();

	// Only feed the real evalPerPly/wdlPerPly in once analysis has actually
	// finished; otherwise (idle/loading/error) pass empty arrays so
	// computeGameAccuracy's own length<2 guard returns null/null, rendering
	// "—" instead of a fabricated number from the seeded all-zero placeholder
	// evalPerPly that startReview() writes before real analysis completes.
	const accuracy = $derived(
		getAccuracySummary(
			appState.game!,
			appState.analysisStatus === 'ready' ? evalPerPly : [],
			appState.analysisStatus === 'ready' ? wdlPerPly : []
		)
	);
</script>
```

(The rest of `ReviewTab.svelte` — the template and `<style>` block — is unchanged.)

Modify the `<ReviewTab ... />` call in `src/lib/components/ReviewPanel.svelte`:

```svelte
	<ReviewTab
		ply={appState.ply}
		evalPerPly={appState.evalPerPly}
		classCodes={appState.classCodes}
		wdlPerPly={appState.wdlPerPly}
		analyzing={appState.analysisStatus === 'loading'}
	/>
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.test.ts`
Expected: PASS — all tests green.

Run full suite: `pnpm exec vitest run` (or `rtk proxy pnpm exec vitest run` if the plain command truncates on this machine)
Expected: PASS across the repo.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts src/lib/game/review.ts src/lib/game/review.test.ts src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts src/lib/components/ReviewPanel.svelte
git commit -m "feat: thread real wdlPerPly through appState into accuracy and classification"
```

---

