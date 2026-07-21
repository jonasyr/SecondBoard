### Task 3: Wire into the UI, remove the mock

**Files:**
- Modify: `src/lib/components/PhaseTable.svelte`
- Modify: `src/lib/components/PhaseTable.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/game/mock-data.ts`
- Modify: `src/lib/game/mock-data.test.ts`

**Interfaces:**
- Consumes: `PhaseRow`, `getPhaseRows` from `$lib/game/phase` (Task 2). `ClassBadge` (existing, `Props = { classCode: ClassCode; size: 16 | 21 | 22 }`).
- Produces: `PhaseTable.svelte`'s new `Props = { rows: PhaseRow[] }` (breaking change to this one component's props, matching the established `BreakdownTable`/`MoveList` precedent of earlier iterations -- its only caller, `ReviewTab.svelte`, is updated in this same task).

- [ ] **Step 1: Write the failing test for the new `PhaseTable` props**

Replace the full contents of `src/lib/components/PhaseTable.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import type { PhaseRow } from '$lib/game/phase';
import PhaseTable from './PhaseTable.svelte';

describe('PhaseTable', () => {
	it('renders 3 phase rows with a badge per side when accuracy data is present', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 98.2 }, black: { code: 'good', accuracy: 81.4 } },
			{ name: 'Middlegame', white: { code: 'good', accuracy: 79.9 }, black: { code: 'inaccuracy', accuracy: 62.1 } },
			{ name: 'Endgame', white: { code: 'best', accuracy: 95.0 }, black: { code: 'best', accuracy: 91.3 } }
		];
		const { container, getByText } = render(PhaseTable, { props: { rows } });

		expect(container.querySelectorAll('.row')).toHaveLength(3);
		expect(getByText('Opening')).toBeTruthy();
		expect(getByText('Middlegame')).toBeTruthy();
		expect(getByText('Endgame')).toBeTruthy();
	});

	it('shows a dash placeholder instead of a badge for a phase with no accuracy data', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 100 }, black: { code: 'best', accuracy: 100 } },
			{ name: 'Middlegame', white: null, black: null },
			{ name: 'Endgame', white: null, black: null }
		];
		const { getAllByText } = render(PhaseTable, { props: { rows } });
		expect(getAllByText('—')).toHaveLength(2);
	});

	it('sets an exact-accuracy tooltip on each present badge', () => {
		const rows: PhaseRow[] = [
			{ name: 'Opening', white: { code: 'best', accuracy: 98.25 }, black: null },
			{ name: 'Middlegame', white: null, black: null },
			{ name: 'Endgame', white: null, black: null }
		];
		const { container } = render(PhaseTable, { props: { rows } });
		const tooltip = container.querySelector('[title*="98.3"]');
		expect(tooltip).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/PhaseTable.test.ts`
Expected: FAIL (the old `PhaseTable.svelte` takes no `rows` prop and imports `PHASE_ROWS` from mock-data.ts, so `getByText('Opening')` etc. still incidentally pass but the dash/tooltip tests fail -- confirm at least the last two tests fail).

- [ ] **Step 3: Rewrite `PhaseTable.svelte`**

Replace the full contents of `src/lib/components/PhaseTable.svelte`:

```svelte
<script lang="ts">
	import type { PhaseRow } from '$lib/game/phase';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		rows: PhaseRow[];
	}

	let { rows }: Props = $props();

	function tooltip(side: 'White' | 'Black', phaseName: string, accuracy: number): string {
		return `${side}: ${accuracy.toFixed(1)}% accuracy in the ${phaseName}`;
	}
</script>

<div class="phases">
	{#each rows as row (row.name)}
		<div class="row">
			<span class="name">{row.name}</span>
			<div class="badge-col">
				{#if row.white}
					<span title={tooltip('White', row.name, row.white.accuracy)}>
						<ClassBadge classCode={row.white.code} size={22} />
					</span>
				{:else}
					<span class="empty">—</span>
				{/if}
			</div>
			<span></span>
			<div class="badge-col">
				{#if row.black}
					<span title={tooltip('Black', row.name, row.black.accuracy)}>
						<ClassBadge classCode={row.black.code} size={22} />
					</span>
				{:else}
					<span class="empty">—</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 5px 0;
	}
	.name {
		font-size: 12.5px;
		color: var(--color-text-secondary-alt);
		font-weight: 500;
	}
	.badge-col {
		display: flex;
		justify-content: center;
	}
	.empty {
		color: var(--color-text-tertiary);
		font-size: 13px;
	}
</style>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/PhaseTable.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Wire real data into `ReviewTab.svelte`**

In `src/lib/components/ReviewTab.svelte`, add `getPhaseRows` to the imports (change `import { getAccuracySummary } from '$lib/game/review';` to add a second import line right after it: `import { getPhaseRows } from '$lib/game/phase';`), add a derived value right after the existing `breakdownRows` derived value:

```typescript
	const breakdownRows = $derived(getBreakdownRows(classCodes));
	const phaseRows = $derived(
		getPhaseRows(
			appState.game!.positions,
			appState.analysisStatus === 'ready' ? evalPerPly : [],
			appState.analysisStatus === 'ready' ? wdlPerPly : []
		)
	);
```

and change the `<PhaseTable />` line to:

```svelte
	<PhaseTable rows={phaseRows} />
```

- [ ] **Step 6: Remove the superseded mock**

In `src/lib/game/mock-data.ts`, delete the `PHASE_ROWS` export entirely:

```typescript
export const PHASE_ROWS: Array<[string, ClassCode, ClassCode]> = [
	['Opening', 'great', 'good'],
	['Middlegame', 'best', 'excellent'],
	['Endgame', 'inaccuracy', 'good']
];
```

(Check with `grep -n "ClassCode" src/lib/game/mock-data.ts` afterward -- if `ClassCode` is still imported and still used elsewhere in the file, e.g. by `CLASS_CODES`/`COACH_TEXT_MAP`/`BREAKDOWN_ROWS`, leave the import; it will still be needed.)

In `src/lib/game/mock-data.test.ts`, remove `PHASE_ROWS` from the import list (change the import block to drop the `PHASE_ROWS,` line) and change the test:

```typescript
	it('has 10 breakdown rows and 3 phase rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
		expect(PHASE_ROWS).toHaveLength(3);
	});
```

to:

```typescript
	it('has 10 breakdown rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
	});
```

- [ ] **Step 7: Run the full frontend test suite**

Run: `pnpm exec vitest run`
Expected: all tests PASS, including `src/lib/components/ReviewTab.test.ts` (check it still passes -- if it directly asserted anything about `PhaseTable`'s old no-props rendering, update that assertion minimally to account for the new real data path; if it doesn't touch `PhaseTable` at all, no change needed).

- [ ] **Step 8: Commit**

```bash
git add src/lib/components/PhaseTable.svelte src/lib/components/PhaseTable.test.ts src/lib/components/ReviewTab.svelte src/lib/game/mock-data.ts src/lib/game/mock-data.test.ts
git commit -m "feat(phase): wire real phase accuracy into PhaseTable, remove mocked PHASE_ROWS"
```

---

