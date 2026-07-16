<script lang="ts">
	import { getReviewPly } from '$lib/game/review';
	import { appState } from '$lib/stores/app-state.svelte';
	import CoachCard from './CoachCard.svelte';
	import MoveList from './MoveList.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		ply: number;
		onSelectPly: (ply: number) => void;
		onNext: () => void;
	}

	let { ply, onSelectPly, onNext }: Props = $props();

	const data = $derived(getReviewPly(ply, appState.game!, appState.evalPerPly, appState.bestMoves));
</script>

<div class="analysis-tab">
	{#if appState.analysisStatus === 'loading'}
		<div class="analyzing-note">Analyzing with Stockfish…</div>
	{/if}
	<div class="coach-slot">
		<CoachCard
			classCode={data.classCode ?? 'book'}
			coachMove={data.coachMove}
			coachText={data.coachText}
			evalStr={data.evalStr}
			best={data.best}
		/>
	</div>

	<div class="actions">
		<button type="button" class="explain">
			<Icon
				d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0 0 12 3z"
				size={15}
				stroke="#C7CCDA"
				strokeWidth={2}
			/>
			Explain
		</button>
		<button type="button" class="next" onclick={onNext}>
			Next
			<Icon d="M5 12h13M12 5l7 7-7 7" size={15} stroke="#062018" strokeWidth={2.4} />
		</button>
	</div>

	<MoveList
		selectedPly={ply}
		{onSelectPly}
		sanList={appState.game!.sanList}
		isSample={appState.game!.isSample}
	/>
</div>

<style>
	.analysis-tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.coach-slot {
		flex: none;
		padding: 13px 14px 0;
	}
	.analyzing-note {
		flex: none;
		padding: 10px 14px 0;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-text-tertiary);
	}
	.actions {
		flex: none;
		display: flex;
		gap: 9px;
		padding: 12px 14px;
	}
	.explain,
	.next {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 10px;
		border-radius: 11px;
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		border: none;
	}
	.explain {
		background: #20222e;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary-alt);
		font-weight: 600;
	}
	.next {
		background: var(--gradient-cta-primary);
		color: var(--color-cta-primary-text);
		font-weight: 700;
	}
</style>
