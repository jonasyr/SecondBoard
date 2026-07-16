<script lang="ts">
	import { CLASS_CODES } from '$lib/game/mock-data';
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
</script>

<div class="review-tab sbscroll">
	{#if analyzing}
		<div class="analyzing-note">Analyzing with Stockfish…</div>
	{/if}
	<div class="graph-slot">
		<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={66} />
	</div>
	<AccuracyBlock />
	<div class="divider"></div>
	<BreakdownTable />
	<PhaseTable />
</div>

<style>
	.review-tab {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px 18px 18px;
	}
	.graph-slot {
		margin-bottom: 16px;
	}
	.analyzing-note {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-text-tertiary);
		margin-bottom: 8px;
	}
	.divider {
		border-top: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
</style>
