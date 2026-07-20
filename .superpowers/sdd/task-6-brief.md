## Task 6: `ReviewPanel.svelte` + `ReviewTab.svelte` + `BottomBar.svelte` — real classification on the eval graph

**Files:**
- Modify: `src/lib/components/ReviewPanel.svelte`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`
- Modify: `src/lib/components/BottomBar.svelte`
- Modify: `src/lib/components/BottomBar.test.ts`

**Interfaces:**
- Consumes: `appState.classCodes: ClassCode[]` (Task 2).
- Produces: `ReviewTab`'s and `BottomBar`'s `Props` gain a `classCodes: ClassCode[]` field, passed down from `ReviewPanel.svelte`.

- [ ] **Step 1: Check the existing `ReviewTab`/`BottomBar` tests for `CLASS_CODES`-dependent assertions**

Read `src/lib/components/ReviewTab.test.ts` and `src/lib/components/BottomBar.test.ts`. Neither currently asserts on evaluation-dot colors/positions (those are covered by `eval-graph.test.ts`'s unit tests, already passing pure-function tests unaffected by this task), so no test assertions need to change — only the render call's props, to supply the now-required `classCodes` prop instead of relying on the component's own `CLASS_CODES` import.

- [ ] **Step 2: Update `ReviewTab.test.ts`'s render calls**

In `src/lib/components/ReviewTab.test.ts`, add `classCodes: []` to every `render(ReviewTab, { props: { ... } })` call's props object (there are 4 such calls in the file, one per `it` block).

- [ ] **Step 3: Update `BottomBar.test.ts`'s render calls**

Read `src/lib/components/BottomBar.test.ts` and add `classCodes: []` to every `render(BottomBar, { props: { ... } })` call's props object, the same way.

- [ ] **Step 4: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.test.ts`
Expected: FAIL — both components' `Props` interfaces don't declare `classCodes` yet, so passing it does nothing useful yet and (depending on strict prop checking) Svelte may warn about an unknown prop; more importantly the components still import the mock `CLASS_CODES` directly, so this step's purpose is to lock in the target prop shape before Step 5 removes the mock import (at which point omitting the prop in a test would genuinely break the eval graph). Confirm the file still compiles/runs at this point — this is a preparatory step, not a strict red/green boundary, so "FAIL" here may simply mean "unchanged" if Svelte allows the extra prop silently; either way, do not skip ahead until Step 5's import removal is in place, because that is what makes `classCodes` mandatory.

- [ ] **Step 5: Update `ReviewTab.svelte`**

Replace the `<script>` block:

```svelte
<script lang="ts">
	import { getAccuracySummary } from '$lib/game/review';
	import type { ClassCode } from '$lib/types';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, analyzing = false }: Props = $props();
</script>
```

Note: `appState` is no longer imported directly here — check whether it's still used elsewhere in the file (the `accuracy` derivation reads `appState.game!`/`appState.analysisStatus`). Keep that import; only the `CLASS_CODES` import from `$lib/game/mock-data` is removed. The full corrected script block, preserving the existing `accuracy` derivation:

```svelte
<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import { getAccuracySummary } from '$lib/game/review';
	import type { ClassCode } from '$lib/types';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, analyzing = false }: Props = $props();

	// Only feed the real evalPerPly in once analysis has actually finished;
	// otherwise (idle/loading/error) pass an empty array so
	// computeGameAccuracy's own length<2 guard returns null/null, rendering
	// "—" instead of a fabricated 100.0 from the seeded all-zero placeholder
	// evalPerPly that startReview() writes before analysis completes.
	const accuracy = $derived(
		getAccuracySummary(appState.game!, appState.analysisStatus === 'ready' ? evalPerPly : [])
	);
</script>
```

Update the `<EvalGraph ... />` call:

```svelte
			<EvalGraph {evalPerPly} {classCodes} {ply} height={66} />
```

- [ ] **Step 6: Update `BottomBar.svelte`**

Replace the `<script>` block:

```svelte
<script lang="ts">
	import type { ClassCode } from '$lib/types';
	import EvalGraph from './EvalGraph.svelte';
	import NavControls from './NavControls.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		classCodes: ClassCode[];
		onFirst: () => void;
		onPrev: () => void;
		onNext: () => void;
		onLast: () => void;
		analyzing?: boolean;
	}

	let { ply, evalPerPly, classCodes, onFirst, onPrev, onNext, onLast, analyzing = false }: Props = $props();
</script>
```

Update the `<EvalGraph ... />` call:

```svelte
			<EvalGraph {evalPerPly} {classCodes} {ply} height={62} />
```

- [ ] **Step 7: Update `ReviewPanel.svelte` to pass `appState.classCodes` down**

Modify the `<ReviewTab ... />` call in `src/lib/components/ReviewPanel.svelte`:

```svelte
	<ReviewTab
		ply={appState.ply}
		evalPerPly={appState.evalPerPly}
		classCodes={appState.classCodes}
		analyzing={appState.analysisStatus === 'loading'}
	/>
```

Modify the `<BottomBar ... />` call:

```svelte
		<BottomBar
			ply={appState.ply}
			evalPerPly={appState.evalPerPly}
			classCodes={appState.classCodes}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(getMaxPly())}
			analyzing={appState.analysisStatus === 'loading'}
		/>
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.test.ts`
Expected: PASS — all green.

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/ReviewPanel.svelte src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts src/lib/components/BottomBar.svelte src/lib/components/BottomBar.test.ts
git commit -m "feat: eval graph (ReviewTab/BottomBar) renders real per-move classification"
```

---

