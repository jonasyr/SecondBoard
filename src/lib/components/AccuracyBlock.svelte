<script lang="ts">
	import { PLAYERS } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import type { AccuracySide } from '$lib/game/review';

	interface Props {
		white: AccuracySide;
		black: AccuracySide;
		resultLabel: string;
	}

	let { white, black, resultLabel }: Props = $props();
</script>

<div class="accuracy-grid">
	<div class="col">
		<span class="name">{white.name}</span>
		<div
			class="avatar"
			class:neutral={!white.isWinner}
			class:tinted={white.isWinner}
			style={`background:${TOKENS.review.avatarWhiteBg};`}
		>
			{white.initial}
		</div>
		<div class="chip sbmono" class:neutral={!white.isWinner} class:tinted={white.isWinner}>
			{white.accuracy ?? '—'}
		</div>
		<span class="label">ACCURACY</span>
	</div>
	<span class="result sbmono">{resultLabel}</span>
	<div class="col">
		<span class="name">{black.name}</span>
		<div
			class="avatar"
			class:neutral={!black.isWinner}
			class:tinted={black.isWinner}
			style={`background:${TOKENS.review.avatarBlackBg};`}
		>
			{black.initial}
		</div>
		<div class="chip sbmono" class:neutral={!black.isWinner} class:tinted={black.isWinner}>
			{black.accuracy ?? '—'}
		</div>
		<span class="label">ACCURACY</span>
	</div>
</div>

<div class="rating-row">
	<div>
		<div class="rating-title">Game Rating</div>
		<div class="rating-subtitle">Est. performance</div>
	</div>
	<div class="rating-col"><div class="chip neutral sbmono wide">{PLAYERS.white.gameRating}</div></div>
	<span></span>
	<div class="rating-col"><div class="chip tinted sbmono wide">{PLAYERS.black.gameRating}</div></div>
</div>

<style>
	.accuracy-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		column-gap: 10px;
		margin-bottom: 16px;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.name {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-text-primary-alt);
	}
	.avatar {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-inset);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 19px;
	}
	.avatar.neutral {
		color: var(--color-card-bg);
		border: 2px solid rgba(255, 255, 255, 0.12);
	}
	.avatar.tinted {
		color: var(--color-text-secondary);
		border: 2px solid var(--color-accent-green);
		box-shadow: 0 0 0 3px rgba(74, 222, 160, 0.16);
	}
	.chip {
		width: 100%;
		text-align: center;
		font-size: 16px;
		font-weight: 600;
		border-radius: 8px;
		padding: 5px 0;
	}
	.chip.neutral {
		color: var(--color-text-primary-alt);
		background: #181a24;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.chip.tinted {
		color: var(--color-light-green-1);
		background: rgba(74, 222, 160, 0.06);
		border: 1px solid rgba(74, 222, 160, 0.4);
	}
	.chip.wide {
		width: auto;
		min-width: 72px;
	}
	.label {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		letter-spacing: 0.03em;
	}
	.result {
		font-size: 12px;
		color: var(--color-text-tertiary);
	}
	.rating-row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 12px 0;
		border-top: 1px solid var(--color-hairline-high);
		border-bottom: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
	.rating-title {
		font-size: 12px;
		color: var(--color-text-tertiary);
		font-weight: 500;
	}
	.rating-subtitle {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		margin-top: 1px;
	}
	.rating-col {
		display: flex;
		justify-content: center;
	}
</style>
