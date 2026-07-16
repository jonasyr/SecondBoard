<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';
	import type { Move } from '$lib/board/types';
	import Icon from './Icon.svelte';

	interface Props {
		classCode: ClassCode | null;
		coachMove: string;
		coachText: string;
		evalStr: string;
		best: (Move & { san: string }) | null;
	}

	let { classCode, coachMove, coachText, evalStr, best }: Props = $props();

	const cls = $derived(classCode ? TOKENS.classification[classCode] : null);
	const cardStyle = $derived(
		cls
			? `background:radial-gradient(120% 130% at 12% 0%,${cls.color}1f,transparent 55%),${TOKENS.color.cardBg};border:1px solid ${cls.color}44;`
			: `background:${TOKENS.color.cardBg};border:1px solid ${TOKENS.color.hairlineHigh};`
	);
	const badgeStyle = $derived(
		cls
			? `background:${cls.color}22;color:${cls.color};`
			: `background:${TOKENS.color.insetBg};color:${TOKENS.color.textTertiary};`
	);
	const evalChipStyle = $derived(
		cls
			? `background:${cls.color}1a;color:${cls.color};`
			: `background:${TOKENS.color.insetBg};color:${TOKENS.color.textTertiary};`
	);
</script>

<div class="coach-card" style={cardStyle}>
	<div class="row">
		{#if cls}
			<div class="badge" style={badgeStyle}>{cls.glyph}</div>
		{/if}
		<div class="body">
			<div class="title">
				<span class="move sbmono">{coachMove}</span>
				{#if cls}
					<span class="word" style={`color:${cls.color};`}>is {cls.word}</span>
				{/if}
				<span class="fill"></span>
				<span class="eval-chip" style={evalChipStyle}>{evalStr}</span>
			</div>
			<p class="text">{coachText}</p>
		</div>
	</div>
	{#if best}
		<div class="best-strip">
			<Icon d="M5 12h13M12 5l7 7-7 7" size={14} stroke="#4ADEA0" strokeWidth={2} />
			<span class="label">Best was</span>
			<span class="san sbmono">{best.san}</span>
		</div>
	{/if}
</div>

<style>
	.coach-card {
		border-radius: 13px;
		padding: 12px 14px;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.badge {
		width: 38px;
		height: 38px;
		flex: none;
		border-radius: var(--radius-inset, 10px);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 16px;
		letter-spacing: -1px;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
	}
	.move {
		color: var(--color-text-primary-alt);
	}
	.fill {
		flex: 1;
	}
	.eval-chip {
		font-size: 12px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 7px;
	}
	.text {
		margin: 5px 0 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-secondary-alt);
	}
	.best-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding: 7px 11px;
		border-radius: 9px;
		background: #0d0f16;
		border: 1px solid rgba(74, 222, 160, 0.25);
	}
	.label {
		font-size: 11.5px;
		color: var(--color-text-tertiary);
	}
	.san {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-accent-green);
	}
</style>
