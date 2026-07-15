<script lang="ts">
	import { evalGraph } from '$lib/charts/eval-graph';
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		evalPerPly: number[];
		classCodes: ClassCode[];
		ply: number;
		height: 66 | 62;
	}

	let { evalPerPly, classCodes, ply, height }: Props = $props();

	const g = $derived(evalGraph(evalPerPly, classCodes, ply));
	const radius = $derived(height === 66 ? 8 : 6);
</script>

<svg
	width="100%"
	{height}
	viewBox="0 0 660 78"
	preserveAspectRatio="none"
	style={`display:block;border-radius:${radius}px;`}
>
	<rect x="0" y="0" width="660" height="78" fill={TOKENS.review.evalGraphBg} />
	<path d={g.evalArea} fill={TOKENS.review.evalGraphArea} />
	<line
		x1="0"
		y1="39"
		x2="660"
		y2="39"
		stroke={TOKENS.review.evalGraphMidline}
		stroke-width="1"
		stroke-dasharray="3 4"
		opacity="0.45"
	/>
	<path d={g.evalLine} fill="none" stroke={TOKENS.review.evalGraphLine} stroke-width="1" opacity="0.5" />
	<line
		x1={g.markerX}
		y1="0"
		x2={g.markerX}
		y2="78"
		stroke={TOKENS.review.evalGraphMidline}
		stroke-width="1.6"
		opacity="0.9"
	/>
	{#each g.evalDots as dot, i (i)}
		<circle cx={dot.cx} cy={dot.cy} r="3.6" fill={dot.color} stroke={TOKENS.review.evalGraphBg} stroke-width="1.4" />
	{/each}
	<circle
		cx={g.markerCX}
		cy={g.markerCY}
		r="4.5"
		fill={TOKENS.review.evalGraphMidline}
		stroke={TOKENS.color.deepInsetBg}
		stroke-width="2"
	/>
</svg>
