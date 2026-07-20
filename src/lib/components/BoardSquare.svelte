<script lang="ts">
	import type { BoardSquareVM } from '$lib/board/build-squares';
	import { PIECE_SPRITES, type PieceSpriteKey } from '$lib/board/pieces';

	interface Props {
		square: BoardSquareVM;
		lastMoveColor: string;
		showCoords: boolean;
	}

	let { square, lastMoveColor, showCoords }: Props = $props();

	const spriteKey = $derived(
		square.piece ? ((square.piece[1] + square.piece[0]) as PieceSpriteKey) : null
	);
	let failedBadgeIcon = $state('');
	const badgeIconFailed = $derived(failedBadgeIcon === square.badgeIcon);
</script>

<div class="square" class:dark={square.isDark} class:light={!square.isDark} data-sq={square.id}>
	{#if square.isLast}
		<div class="last-move-overlay" style={`background:${lastMoveColor}52;`}></div>
	{/if}
	{#if square.piece && spriteKey}
		<span
			class="piece"
			class:piece-white={square.piece[1] === 'w'}
			class:piece-black={square.piece[1] === 'b'}
			style={`background-image:url(${PIECE_SPRITES[spriteKey]});`}
		></span>
	{/if}
	{#if square.isBrilliant}
		<div class="brilliant-ring"></div>
	{/if}
	{#if showCoords && square.rankLabel}
		<span class="rank-label sbmono">{square.rankLabel}</span>
	{/if}
	{#if showCoords && square.fileLabel}
		<span class="file-label sbmono">{square.fileLabel}</span>
	{/if}
	{#if square.hasBadge}
		<div
			class="badge"
			class:fallback={badgeIconFailed}
			style={`--badge-color:${square.badgeColor};`}
		>
			{#if badgeIconFailed}
				<span class="badge-fallback" aria-hidden="true">{square.badgeGlyph}</span>
			{:else}
				<img
					src={square.badgeIcon}
					alt={square.badgeLabel}
					onerror={() => (failedBadgeIcon = square.badgeIcon)}
				/>
			{/if}
		</div>
	{/if}
</div>

<style>
	.square {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.square.light {
		background: var(--board-light-square);
	}
	.square.dark {
		background: var(--board-dark-square);
	}
	.last-move-overlay {
		position: absolute;
		inset: 0;
	}
	.piece {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		background-size: 90%;
		background-repeat: no-repeat;
		background-position: center;
	}
	.piece-white {
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4));
	}
	.piece-black {
		filter: drop-shadow(0 0 1.4px rgba(255, 255, 255, 0.45))
			drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
	}
	.brilliant-ring {
		position: absolute;
		inset: 5px;
		border-radius: 9px;
		border: 2px solid rgba(27, 173, 166, 0.9);
		animation: bpulse 2.4s ease-in-out infinite;
	}
	.rank-label {
		position: absolute;
		top: 3px;
		left: 5px;
		font-size: 11px;
		font-weight: 600;
	}
	.file-label {
		position: absolute;
		bottom: 3px;
		right: 5px;
		font-size: 11px;
		font-weight: 600;
	}
	.square.dark .rank-label,
	.square.dark .file-label {
		color: var(--board-coord-on-dark);
	}
	.square.light .rank-label,
	.square.light .file-label {
		color: var(--board-coord-on-light);
	}
	.badge {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 4;
		width: 36px;
		height: 36px;
	}
	.badge img {
		display: block;
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5));
	}
	.badge.fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 50%;
		background: var(--badge-color);
		color: #fff;
		font-size: 18px;
		font-weight: 800;
		line-height: 1;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.5));
	}
</style>
