## Task 6: `ReviewTab.svelte` — wire the real summary in

**Files:**
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`

**Interfaces:**
- Consumes: `appState` (`$lib/stores/app-state.svelte`, already has `game: GameData | null` per `mem:core`); `getAccuracySummary` from `$lib/game/review` (Task 4).

- [ ] **Step 1: Update the failing test**

Replace `src/lib/components/ReviewTab.test.ts` entirely (adds an `appState.game` fixture, following the exact pattern already used in `src/lib/components/AnalysisTab.test.ts:20-31`):

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import ReviewTab from './ReviewTab.svelte';
import { EVAL_PER_PLY } from '$lib/game/mock-data';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.game = {
		sanList: ['e4'],
		positions: [{}, {}],
		moveMeta: [{ from: 'e2', to: 'e4' }],
		isSample: true,
		whiteName: null,
		blackName: null,
		whiteRating: null,
		blackRating: null,
		result: '0-1'
	};
});

describe('ReviewTab', () => {
	it('renders the eval graph, accuracy block, breakdown, and phase table together', () => {
		const { container, getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(container.querySelector('svg')).not.toBeNull();
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('Opening')).toBeTruthy();
	});

	it('shows the real winner (from game.result) in the accuracy block, not a hardcoded one', () => {
		const { getByText } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(getByText('0–1')).toBeTruthy();
	});

	it('shows no analyzing overlay by default', () => {
		const { queryByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY }
		});
		expect(queryByText('Analyzing with Stockfish…')).toBeNull();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(false);
	});

	it('shows a centered analyzing overlay over the blurred graph when analyzing is true', () => {
		const { getByText, container } = render(ReviewTab, {
			props: { ply: 31, evalPerPly: EVAL_PER_PLY, analyzing: true }
		});
		expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
		expect(container.querySelector('.graph-blur')?.classList.contains('analyzing')).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Expected: FAIL — `AccuracyBlock` (as of Task 5) now requires `white`/`black`/`resultLabel` props that `ReviewTab.svelte` doesn't pass yet; Svelte will throw/warn on missing required props and `getByText('0–1')` won't be found.

- [ ] **Step 3: Wire `getAccuracySummary` into `ReviewTab.svelte`**

```svelte
<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import { CLASS_CODES } from '$lib/game/mock-data';
	import { getAccuracySummary } from '$lib/game/review';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, analyzing = false }: Props = $props();

	const accuracy = $derived(getAccuracySummary(appState.game!, evalPerPly));
</script>

<div class="review-tab sbscroll">
	<div class="graph-slot">
		<div class="graph-blur" class:analyzing>
			<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={66} />
		</div>
		{#if analyzing}
			<div class="analyzing-overlay"><span>Analyzing with Stockfish…</span></div>
		{/if}
	</div>
	<AccuracyBlock white={accuracy.white} black={accuracy.black} resultLabel={accuracy.resultLabel} />
	<div class="divider"></div>
	<BreakdownTable />
	<PhaseTable />
</div>
```

(The `<style>` block is unchanged — leave it exactly as it is in the current file.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts`
Expected: PASS — all green.

Run full suite to confirm nothing else broke: `pnpm exec vitest run`
Expected: PASS across the repo.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts
git commit -m "feat: render the real accuracy/winner summary in ReviewTab"
```

---

