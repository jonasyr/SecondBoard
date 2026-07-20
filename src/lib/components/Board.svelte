<script lang="ts">
	import { buildBoardSquares } from '$lib/board/build-squares';
	import { arrowGeom } from '$lib/board/geometry';
	import { diffMove } from '$lib/board/diff-move';
	import { animateSlide } from '$lib/board/animate-slide';
	import type { Move, Position } from '$lib/board/types';
	import type { ClassCode } from '$lib/types';
	import { TOKENS } from '$lib/tokens';
	import BoardSquare from './BoardSquare.svelte';

	interface Props {
		position: Position;
		/** Current half-move index; drives single-step slide-animation detection. */
		ply: number;
		flipped?: boolean;
		lastMove?: Move | null;
		classCode?: ClassCode | null;
		/** Engine's top suggestion for the move about to be played from `position`. */
		nextBest?: (Move & { san: string }) | null;
		showCoords?: boolean;
	}

	let {
		position,
		ply,
		flipped = false,
		lastMove = null,
		classCode = null,
		nextBest = null,
		showCoords = true
	}: Props = $props();

	let boardEl: HTMLDivElement | undefined = $state();

	const highlightColor = $derived(
		classCode ? TOKENS.classification[classCode].color : TOKENS.color.accentGreen
	);

	const squares = $derived(
		buildBoardSquares(position, {
			flipped,
			lastSquares: lastMove ? [lastMove.from, lastMove.to] : null,
			brilliantSquare: classCode === 'brilliant' && lastMove ? lastMove.to : null,
			badge:
				lastMove && classCode
					? {
							square: lastMove.to,
							glyph: TOKENS.classification[classCode].glyph,
							color: TOKENS.classification[classCode].color,
							icon: TOKENS.classification[classCode].icon,
							label: TOKENS.classification[classCode].name
						}
					: null
		})
	);

	const arrow = $derived(nextBest ? arrowGeom(nextBest.from, nextBest.to, 11, flipped) : null);

	// Single-step slide-animation trigger, ported from the reference's
	// componentDidUpdate guards (LOGIC.md §2.4): only animate when |Δply|===1
	// and the flip state hasn't changed between renders.
	let lastPly = ply;
	let lastPosition = position;
	let lastFlipped = flipped;

	$effect(() => {
		const curPly = ply;
		const curPosition = position;
		const curFlipped = flipped;

		if (Math.abs(curPly - lastPly) === 1 && curFlipped === lastFlipped && boardEl) {
			const move = diffMove(lastPosition, curPosition);
			if (move) animateSlide(boardEl, move.from, move.to);
		}

		lastPly = curPly;
		lastPosition = curPosition;
		lastFlipped = curFlipped;
	});
</script>

<div class="board-frame">
	<div class="board-grid" bind:this={boardEl} data-sb-board="1">
		{#each squares as square (square.id)}
			<BoardSquare {square} lastMoveColor={highlightColor} {showCoords} />
		{/each}
	</div>
	{#if arrow}
		<svg class="arrow-overlay" viewBox="0 0 600 600" preserveAspectRatio="none">
			<path
				d={arrow.shaft}
				fill="none"
				stroke="#4ADEA0"
				stroke-width="11"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity="0.45"
			/>
			<polygon points={arrow.head} fill="#4ADEA0" opacity="0.45" />
		</svg>
	{/if}
</div>

<style>
	/*
	 * Expects to be placed inside a `container-type: size` ancestor sized to
	 * the available board area — the literal reference nests the board in a
	 * flex container that establishes the query container (README §6.3).
	 */
	.board-frame {
		position: relative;
		width: 100cqmin;
		height: 100cqmin;
		border-radius: var(--radius-board);
		overflow: hidden;
		box-shadow: var(--shadow-board);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.board-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows: repeat(8, 1fr);
		width: 100%;
		height: 100%;
	}
	.arrow-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
