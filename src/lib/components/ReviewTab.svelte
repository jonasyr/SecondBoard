<script lang="ts">
	import { EVAL_PER_PLY, CLASS_CODES } from '$lib/game/mock-data';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
	}

	let { ply }: Props = $props();
</script>

<div class="review-tab sbscroll">
	<div class="graph-slot">
		<EvalGraph evalPerPly={EVAL_PER_PLY} classCodes={CLASS_CODES} {ply} height={66} />
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
	.divider {
		border-top: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
</style>
