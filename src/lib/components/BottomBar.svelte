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
	}

	let { ply, evalPerPly, onFirst, onPrev, onNext, onLast }: Props = $props();
</script>

<div class="bottom-bar">
	<div class="graph-slot">
		<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={62} />
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
		padding: 8px 12px 2px;
	}
</style>
