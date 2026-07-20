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

<div class="review-tab sbscroll">
	<div class="graph-slot">
		<div class="graph-blur" class:analyzing>
			<EvalGraph {evalPerPly} {classCodes} {ply} height={66} />
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

<style>
	.review-tab {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px 18px 18px;
	}
	.graph-slot {
		position: relative;
		margin-bottom: 16px;
	}
	.graph-blur.analyzing {
		filter: blur(2px);
		opacity: 0.55;
	}
	.analyzing-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.analyzing-overlay span {
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-text-secondary);
		background: var(--color-card-bg);
		border: 1px solid var(--color-hairline-high);
		padding: 5px 10px;
		border-radius: 999px;
	}
	.divider {
		border-top: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
</style>
