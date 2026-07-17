<script lang="ts">
	import { CLASS_CODES } from '$lib/game/mock-data';
	import EvalGraph from './EvalGraph.svelte';
	import NavControls from './NavControls.svelte';

	interface Props {
		ply: number;
		evalPerPly: number[];
		onFirst: () => void;
		onPrev: () => void;
		onNext: () => void;
		onLast: () => void;
		analyzing?: boolean;
	}

	let { ply, evalPerPly, onFirst, onPrev, onNext, onLast, analyzing = false }: Props = $props();
</script>

<div class="bottom-bar">
	<div class="graph-slot">
		<div class="graph-blur" class:analyzing>
			<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={62} />
		</div>
		{#if analyzing}
			<div class="analyzing-overlay"><span>Analyzing with Stockfish…</span></div>
		{/if}
	</div>
	<NavControls {onFirst} {onPrev} {onNext} {onLast} />
</div>

<style>
	.bottom-bar {
		flex: none;
		border-top: 1px solid var(--color-hairline-high);
		background: var(--color-bottom-bar-bg);
	}
	.graph-slot {
		position: relative;
		padding: 8px 12px 2px;
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
</style>
