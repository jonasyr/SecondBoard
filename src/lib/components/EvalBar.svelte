<script lang="ts">
	import { TOKENS } from '$lib/tokens';

	interface Props {
		whitePct: number;
		evalNum: number;
		whiteAtBottom: boolean;
	}

	let { whitePct, evalNum, whiteAtBottom }: Props = $props();

	const label = $derived((evalNum >= 0 ? evalNum : -evalNum).toFixed(1));
	// Reference: label sits opposite the fill's growth edge, colored for contrast against
	// whichever background (fill vs. track) it's drawn over there.
	const labelOnFilledEdge = $derived(whiteAtBottom === evalNum >= 0);
	const fillStyle = $derived(
		`position:absolute;left:0;right:0;${whiteAtBottom ? 'bottom:0;' : 'top:0;'}height:${whitePct.toFixed(1)}%;background:linear-gradient(${whiteAtBottom ? '180deg' : '0deg'},${TOKENS.board.evalWhiteFillFrom},${TOKENS.board.evalWhiteFillTo});transition:height .25s ease;`
	);
	const labelStyle = $derived(
		`position:absolute;left:0;right:0;${labelOnFilledEdge ? 'bottom:3px;color:#20222E;' : 'top:3px;color:#E3E6EE;'}text-align:center;font-size:9px;font-weight:700;`
	);
</script>

<div class="eval-bar">
	<div class="fill" style={fillStyle}></div>
	<div class="midline"></div>
	<div class="label sbmono" style={labelStyle}>{label}</div>
</div>

<style>
	.eval-bar {
		width: 20px;
		flex: none;
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		background: var(--board-eval-bar-track);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.midline {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: var(--board-eval-midline);
	}
</style>
