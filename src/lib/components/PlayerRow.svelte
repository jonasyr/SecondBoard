<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import { PIECE_SPRITES, type PieceSpriteKey } from '$lib/board/pieces';
	import type { PlayerRowData } from '$lib/game/review';
	import Icon from './Icon.svelte';

	interface Props {
		player: PlayerRowData;
		showNewGameButton?: boolean;
		onNewGame?: () => void;
	}

	let { player, showNewGameButton = false, onNewGame }: Props = $props();

	const avatarStyle = $derived(
		player.isWhite
			? `background:${TOKENS.review.avatarWhiteBg};border:1px solid ${TOKENS.review.avatarWhiteBorder};color:${TOKENS.review.avatarWhiteText};`
			: `background:${TOKENS.review.avatarBlackBg};border:1px solid ${TOKENS.review.avatarBlackBorder};color:${TOKENS.review.avatarBlackText};`
	);
	const clockStyle = $derived(
		player.clockActive
			? `background:${TOKENS.review.clockActiveBg};color:${TOKENS.review.clockActiveText};box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);`
			: `background:${TOKENS.review.clockInactiveBg};color:${TOKENS.review.clockInactiveText};`
	);
</script>

<div class="player-row">
	<div class="avatar" style={avatarStyle}>{player.initial}</div>
	<div class="info">
		<div class="name-row">
			<span class="name">{player.name}</span>
			<span class="rating sbmono">{player.rating}</span>
		</div>
		<div class="captured-row">
			{#each player.captured as piece, i (i)}
				<span
					class="captured-piece"
					style={`background-image:url(${PIECE_SPRITES[(piece.color + piece.type) as PieceSpriteKey]});filter:${TOKENS.review.capturedSpriteShadow};`}
				></span>
			{/each}
			{#if player.adv}
				<span class="adv sbmono">{player.adv}</span>
			{/if}
		</div>
	</div>
	<div class="spacer"></div>
	{#if showNewGameButton}
		<button type="button" class="new-game" onclick={onNewGame} title="Load a different PGN">
			<Icon d="M12 5v14M5 12h14" size={13} stroke="#4ADEA0" strokeWidth={2.2} />
			New PGN
		</button>
	{/if}
	<div class="clock sbmono" style={clockStyle}>{player.clock}</div>
</div>

<style>
	.player-row {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 0 2px;
		flex: none;
	}
	.avatar {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
	}
	.info {
		flex: none;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.name {
		font-size: 15.5px;
		font-weight: 600;
	}
	.rating {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.captured-row {
		display: flex;
		align-items: center;
		gap: 1px;
		margin-top: 4px;
		height: 20px;
	}
	.captured-piece {
		width: 18px;
		height: 18px;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}
	.adv {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-light-green-1);
		margin-left: 5px;
	}
	.spacer {
		flex: 1;
	}
	.new-game {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		margin-right: 10px;
		border-radius: var(--radius-control);
		background: #181a24;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #c7ccda;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.clock {
		font-size: 18px;
		font-weight: 600;
		padding: 5px 12px;
		border-radius: var(--radius-control);
	}
</style>
