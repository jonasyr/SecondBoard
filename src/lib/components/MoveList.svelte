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
