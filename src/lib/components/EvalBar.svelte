<script lang="ts">
	import { TOKENS } from '$lib/tokens';

	interface Props {
		whitePct: number;
		evalNum: number;
		whiteAtBottom: boolean;
		analyzing?: boolean;
	}

	let { whitePct, evalNum, whiteAtBottom, analyzing = false }: Props = $props();

	// Signed white-POV value on the white edge, its negation (black's own POV) on the black
	// edge -- so both sides always read their own advantage/disadvantage directly, not just
	// whichever side currently has the edge.
	const whiteLabel = $derived((evalNum >= 0 ? '+' : '') + evalNum.toFixed(1));
	const blackLabel = $derived((evalNum <= 0 ? '+' : '-') + Math.abs(evalNum).toFixed(1));
	const fillStyle = $derived(
		`position:absolute;left:0;right:0;${whiteAtBottom ? 'bottom:0;' : 'top:0;'}height:${whitePct.toFixed(1)}%;background:linear-gradient(${whiteAtBottom ? '180deg' : '0deg'},${TOKENS.board.evalWhiteFillFrom},${TOKENS.board.evalWhiteFillTo});transition:height .25s ease;`
	);
	// Each label is colored for contrast against whichever background (fill vs. track) sits
	// behind its own edge, which flips depending on whitePct and board orientation.
	const whiteOnFilledEdge = $derived(whiteAtBottom);
	const blackOnFilledEdge = $derived(!whiteAtBottom);
	const whiteLabelStyle = $derived(
		`position:absolute;left:0;right:0;${whiteAtBottom ? 'bottom:3px;' : 'top:3px;'}color:${whiteOnFilledEdge ? '#20222E' : '#E3E6EE'};text-align:center;font-size:9px;font-weight:700;`
	);
	const blackLabelStyle = $derived(
		`position:absolute;left:0;right:0;${whiteAtBottom ? 'top:3px;' : 'bottom:3px;'}color:${blackOnFilledEdge ? '#20222E' : '#E3E6EE'};text-align:center;font-size:9px;font-weight:700;`
	);
</script>

<div class="eval-bar">
	<div class="fill" style={fillStyle}></div>
	<div class="midline"></div>
	<div class="label sbmono" style={whiteLabelStyle}>{whiteLabel}</div>
	<div class="label sbmono" style={blackLabelStyle}>{blackLabel}</div>
	{#if analyzing}
		<div class="analyzing-spinner" title="Analyzing with Stockfish…"></div>
	{/if}
</div>

<style>
	.eval-bar {
		width: 28px;
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
	.analyzing-spinner {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 13px;
		height: 13px;
		margin: -6.5px 0 0 -6.5px;
		border-radius: 50%;
		border: 2px solid rgba(255, 255, 255, 0.25);
		border-top-color: #e3e6ee;
		animation: eval-bar-spin 0.7s linear infinite;
	}
	@keyframes eval-bar-spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
