## Task 4: `AnalysisTab.svelte` + `MoveList.svelte` — real classification in the move list and coach card

**Files:**
- Modify: `src/lib/components/AnalysisTab.svelte`
- Modify: `src/lib/components/MoveList.svelte`
- Modify: `src/lib/components/MoveList.test.ts`
- Modify: `src/lib/components/AnalysisTab.test.ts`

**Interfaces:**
- Consumes: `appState.classCodes: ClassCode[]` (Task 2); `getReviewPly`'s new 5th parameter (Task 3).
- Produces: `MoveList`'s `Props` drops `isSample: boolean`, adds `classCodes: ClassCode[]` — no other component depends on `MoveList`'s prop shape.

- [ ] **Step 1: Write the failing tests**

Replace `src/lib/components/MoveList.test.ts` entirely:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MoveList from './MoveList.svelte';
import type { ClassCode } from '$lib/types';

// Italian Game move list (31 plies), matching this repo's other sample-game fixtures.
const sanList = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];
const classCodes: ClassCode[] = Array(31).fill('best');

describe('MoveList', () => {
	it('renders 16 rows with move-number gutter', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList, classCodes }
		});
		expect(container.querySelectorAll('.row')).toHaveLength(16);
		expect(container.textContent).toContain('1.');
		expect(container.textContent).toContain('16.');
	});

	it('marks the cell matching selectedPly as selected via data-sb-sel', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 31, onSelectPly: () => {}, sanList, classCodes }
		});
		expect(container.querySelector('[data-sb-sel="1"]')).not.toBeNull();
	});

	it('calls onSelectPly with the clicked ply', () => {
		const onSelectPly = vi.fn();
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly, sanList, classCodes }
		});
		const firstWhiteCell = container.querySelector('.cell') as HTMLElement;
		firstWhiteCell.click();
		expect(onSelectPly).toHaveBeenCalledWith(1);
	});

	it('renders no black cell in the final (odd-move-count) row', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 31, onSelectPly: () => {}, sanList, classCodes }
		});
		const rows = container.querySelectorAll('.row');
		const lastRow = rows[rows.length - 1];
		expect(lastRow.querySelectorAll('.cell')).toHaveLength(1); // white only — sanList has 31 plies
	});

	it('does not show a classification badge for a ply with no classCodes entry (analysis not ready)', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: [] }
		});
		expect(container.querySelectorAll('.badge')).toHaveLength(0);
	});

	it('shows a classification badge for every ply that has a real classCodes entry', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 0, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: ['excellent', 'blunder'] }
		});
		expect(container.querySelectorAll('.badge')).toHaveLength(2);
	});

	it('still highlights the selected cell when classCodes is empty', () => {
		const { container } = render(MoveList, {
			props: { selectedPly: 1, onSelectPly: () => {}, sanList: ['e4', 'e5'], classCodes: [] }
		});
		const selected = container.querySelector('[data-sb-sel="1"]') as HTMLElement;
		expect(selected).not.toBeNull();
		expect(selected.getAttribute('style')).toContain('background: rgba(45, 224, 206, 0.14)');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/MoveList.test.ts`
Expected: FAIL — `MoveList` still requires `isSample`, not `classCodes`; badge visibility is still gated on `isSample`, so the "no classCodes entry" / "real classCodes entry" tests don't match.

- [ ] **Step 3: Rewrite `MoveList.svelte`'s script block and template**

Replace the `<script>` block in `src/lib/components/MoveList.svelte`:

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		selectedPly: number;
		onSelectPly: (ply: number) => void;
		sanList: string[];
		classCodes: ClassCode[];
	}

	let { selectedPly, onSelectPly, sanList, classCodes }: Props = $props();

	interface Row {
		num: string;
		wPly: number;
		bPly: number | null;
		striped: boolean;
	}

	const rows: Row[] = $derived(
		Array.from({ length: Math.ceil(sanList.length / 2) }, (_, i) => {
			const wPly = 2 * i + 1;
			const bPly = 2 * i + 2;
			return {
				num: i + 1 + '.',
				wPly,
				bPly: bPly <= sanList.length ? bPly : null,
				striped: i % 2 === 1
			};
		})
	);

	function cellStyle(sel: boolean, code: ClassCode | null): string {
		if (sel) {
			return 'background:rgba(45,224,206,.14);color:#5EF0DE;font-weight:600;box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);';
		}
		return code ? `color:${TOKENS.review.moveTint[code]};` : '';
	}

	let listEl: HTMLDivElement | undefined = $state();

	// Reference _syncMoveScroll (SecondBoard.dc.html lines 822-830): manual
	// scrollTop adjustment, NOT scrollIntoView, run after each ply change.
	$effect(() => {
		void selectedPly;
		requestAnimationFrame(() => {
			const c = listEl;
			if (!c) return;
			const row = c.querySelector('[data-sb-sel="1"]');
			if (!row) return;
			const delta = row.getBoundingClientRect().top - c.getBoundingClientRect().top - 2;
			c.scrollTop += delta;
		});
	});
</script>
```

Replace the template body (everything inside `<div class="move-list" ...>`):

```svelte
<div class="move-list sbscroll" bind:this={listEl} data-sb-movelist="1">
	{#each rows as row (row.wPly)}
		<div class="row" class:striped={row.striped}>
			<span class="num sbmono">{row.num}</span>
			<div
				class="cell"
				data-sb-sel={selectedPly === row.wPly ? '1' : '0'}
				style={cellStyle(selectedPly === row.wPly, classCodes[row.wPly - 1] ?? null)}
				onclick={() => onSelectPly(row.wPly)}
			>
				{#if classCodes[row.wPly - 1]}
					<ClassBadge classCode={classCodes[row.wPly - 1]} size={16} />
				{/if}
				<span class="san sbmono">{sanList[row.wPly - 1]}</span>
			</div>
			{#if row.bPly !== null}
				<div
					class="cell"
					data-sb-sel={selectedPly === row.bPly ? '1' : '0'}
					style={cellStyle(selectedPly === row.bPly, classCodes[row.bPly - 1] ?? null)}
					onclick={() => onSelectPly(row.bPly!)}
				>
					{#if classCodes[row.bPly - 1]}
						<ClassBadge classCode={classCodes[row.bPly - 1]} size={16} />
					{/if}
					<span class="san sbmono">{sanList[row.bPly - 1]}</span>
				</div>
			{:else}
				<div></div>
			{/if}
		</div>
	{/each}
</div>
```

(The `<style>` block is unchanged.)

- [ ] **Step 4: Run `MoveList` tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/MoveList.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Update `AnalysisTab.svelte` to pass real `classCodes` through**

Update the failing caller test first — in `src/lib/components/AnalysisTab.test.ts`, no test code needs to change (it doesn't assert on badges), but running the suite now will fail on the `MoveList` prop-shape mismatch. Confirm by running:

Run: `pnpm exec vitest run src/lib/components/AnalysisTab.test.ts`
Expected: FAIL — Svelte warns/throws that `MoveList` no longer accepts `isSample` as a valid prop (or, depending on strictness, simply passes it through unused while `classCodes` is `undefined`), and `getReviewPly`'s classification no longer resolves the same way.

Modify `src/lib/components/AnalysisTab.svelte`:

```svelte
<script lang="ts">
	import { getReviewPly } from '$lib/game/review';
	import { appState } from '$lib/stores/app-state.svelte';
	import CoachCard from './CoachCard.svelte';
	import MoveList from './MoveList.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		ply: number;
		onSelectPly: (ply: number) => void;
		onNext: () => void;
	}

	let { ply, onSelectPly, onNext }: Props = $props();

	const data = $derived(
		getReviewPly(ply, appState.game!, appState.evalPerPly, appState.bestMoves, appState.classCodes)
	);
</script>
```

Replace the `<MoveList ... />` call:

```svelte
	<MoveList
		selectedPly={ply}
		{onSelectPly}
		sanList={appState.game!.sanList}
		classCodes={appState.classCodes}
	/>
```

(Everything else in the file — the `coach-slot`/`actions` markup and the `<style>` block — is unchanged.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/AnalysisTab.test.ts src/lib/components/MoveList.test.ts`
Expected: PASS — all green.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/AnalysisTab.svelte src/lib/components/MoveList.svelte src/lib/components/MoveList.test.ts
git commit -m "feat: MoveList and AnalysisTab render real per-move classification"
```

---

