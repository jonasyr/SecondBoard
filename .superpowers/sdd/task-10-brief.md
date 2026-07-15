## Task 10: `MoveList.svelte`

**Files:**
- Create: `src/lib/components/MoveList.svelte`
- Test: `src/lib/components/MoveList.test.ts`

**Interfaces:**
- Consumes: `SAN_LIST`, `CLASS_CODES` from `$lib/game/mock-data`; `ClassBadge.svelte`; `TOKENS.review.moveTint`.
- Props:
  ```ts
  interface Props {
  	selectedPly: number;
  	onSelectPly: (ply: number) => void;
  }
  ```

Reference: markup lines 329-339 (grid `30px 1fr 1fr`, 16 rows); computed styles lines 1145-1167 (`moveRows()`); auto-scroll lines 822-830 (`_syncMoveScroll`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/MoveList.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MoveList from './MoveList.svelte';

describe('MoveList', () => {
	it('renders 16 rows with move-number gutter', () => {
		const { container } = render(MoveList, { props: { selectedPly: 0, onSelectPly: () => {} } });
		expect(container.querySelectorAll('.row')).toHaveLength(16);
		expect(container.textContent).toContain('1.');
		expect(container.textContent).toContain('16.');
	});

	it('marks the cell matching selectedPly as selected via data-sb-sel', () => {
		const { container } = render(MoveList, { props: { selectedPly: 31, onSelectPly: () => {} } });
		expect(container.querySelector('[data-sb-sel="1"]')).not.toBeNull();
	});

	it('calls onSelectPly with the clicked ply', () => {
		const onSelectPly = vi.fn();
		const { container } = render(MoveList, { props: { selectedPly: 0, onSelectPly } });
		const firstWhiteCell = container.querySelector('.cell') as HTMLElement;
		firstWhiteCell.click();
		expect(onSelectPly).toHaveBeenCalledWith(1);
	});

	it('renders no black cell in the final (odd-move-count) row', () => {
		const { container } = render(MoveList, { props: { selectedPly: 31, onSelectPly: () => {} } });
		const rows = container.querySelectorAll('.row');
		const lastRow = rows[rows.length - 1];
		expect(lastRow.querySelectorAll('.cell')).toHaveLength(1); // white only — SAN_LIST has 31 plies
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/MoveList.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/MoveList.svelte`**

```svelte
<script lang="ts">
	import { tick } from 'svelte';
	import { SAN_LIST, CLASS_CODES } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		selectedPly: number;
		onSelectPly: (ply: number) => void;
	}

	let { selectedPly, onSelectPly }: Props = $props();

	interface Row {
		num: string;
		wPly: number;
		bPly: number | null;
		striped: boolean;
	}

	const rows: Row[] = Array.from({ length: 16 }, (_, i) => {
		const wPly = 2 * i + 1;
		const bPly = 2 * i + 2;
		return {
			num: i + 1 + '.',
			wPly,
			bPly: bPly <= SAN_LIST.length ? bPly : null,
			striped: i % 2 === 1
		};
	});

	function cellStyle(sel: boolean, code: import('$lib/types').ClassCode): string {
		return sel
			? 'background:rgba(45,224,206,.14);color:#5EF0DE;font-weight:600;box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);'
			: `color:${TOKENS.review.moveTint[code]};`;
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

<div class="move-list sbscroll" bind:this={listEl} data-sb-movelist="1">
	{#each rows as row (row.wPly)}
		<div class="row" class:striped={row.striped}>
			<span class="num sbmono">{row.num}</span>
			<div
				class="cell"
				data-sb-sel={selectedPly === row.wPly ? '1' : '0'}
				style={cellStyle(selectedPly === row.wPly, CLASS_CODES[row.wPly - 1])}
				onclick={() => onSelectPly(row.wPly)}
			>
				<ClassBadge classCode={CLASS_CODES[row.wPly - 1]} size={16} />
				<span class="san sbmono">{SAN_LIST[row.wPly - 1]}</span>
			</div>
			{#if row.bPly !== null}
				<div
					class="cell"
					data-sb-sel={selectedPly === row.bPly ? '1' : '0'}
					style={cellStyle(selectedPly === row.bPly, CLASS_CODES[row.bPly - 1])}
					onclick={() => onSelectPly(row.bPly!)}
				>
					<ClassBadge classCode={CLASS_CODES[row.bPly - 1]} size={16} />
					<span class="san sbmono">{SAN_LIST[row.bPly - 1]}</span>
				</div>
			{:else}
				<div></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.move-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 2px 10px 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 30px 1fr 1fr;
		align-items: center;
		column-gap: 4px;
		padding: 1px 4px;
		border-radius: 8px;
	}
	.row.striped {
		background: rgba(255, 255, 255, 0.022);
	}
	.num {
		font-size: 11px;
		color: var(--color-text-muted-dark);
		text-align: right;
		padding-right: 2px;
	}
	.cell {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 7px;
		font-size: 12.5px;
		cursor: pointer;
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/MoveList.test.ts`
Expected: PASS (4/4). (`requestAnimationFrame` needs to exist in jsdom — Vitest's `jsdom` environment provides it; if the effect's async callback causes flakiness in the "calls onSelectPly" test, that test doesn't depend on the scroll effect and should be unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MoveList.svelte src/lib/components/MoveList.test.ts
git commit -m "feat: add MoveList component with auto-scroll"
```

---

