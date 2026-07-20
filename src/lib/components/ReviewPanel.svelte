<script lang="ts">
	import { appState, goToPly, stepPly, getMaxPly } from '$lib/stores/app-state.svelte';
	import Icon from './Icon.svelte';
	import AnalysisTab from './AnalysisTab.svelte';
	import ReviewTab from './ReviewTab.svelte';
	import DetailsTab from './DetailsTab.svelte';
	import ExploreTab from './ExploreTab.svelte';
	import BottomBar from './BottomBar.svelte';
	import type { Tab } from '$lib/types';

	interface Props {
		onToggleFlip: () => void;
		onOpenOpenings: () => void;
	}

	let { onToggleFlip, onOpenOpenings }: Props = $props();

	const TABS: Array<{ id: Tab; label: string; icon: string }> = [
		{ id: 'analysis', label: 'Analysis', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4' },
		{
			id: 'review',
			label: 'Review',
			icon: 'M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z'
		},
		{ id: 'details', label: 'Details', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01' },
		{ id: 'explore', label: 'Explore', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 4-4 2 2-4z' }
	];
</script>

<div class="review-panel">
	<div class="header">
		<div class="star-badge">
			<svg width="13" height="13" viewBox="0 0 24 24" fill="#062018" stroke="none">
				<path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z" />
			</svg>
		</div>
		<span class="title">Game Review</span>
		<div class="fill"></div>
		<button type="button" class="icon-btn">
			<Icon
				d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"
				size={15}
				stroke="#8A90A0"
				strokeWidth={2}
			/>
		</button>
		<button type="button" class="icon-btn flip-btn" onclick={onToggleFlip} title="Flip board">
			<Icon
				d="M8 3L4 7l4 4 M4 7h11a5 5 0 0 1 5 5 M16 21l4-4-4-4 M20 17H9a5 5 0 0 1-5-5"
				size={15}
				stroke="#8A90A0"
				strokeWidth={2}
			/>
		</button>
	</div>

	<div class="tabs">
		{#each TABS as t (t.id)}
			<button
				type="button"
				class="tab"
				class:active={appState.tab === t.id}
				onclick={() => (appState.tab = t.id)}
			>
				<Icon d={t.icon} size={15} stroke={appState.tab === t.id ? '#4ADEA0' : '#6B7180'} strokeWidth={2} />
				<span>{t.label}</span>
			</button>
		{/each}
	</div>

	{#if appState.tab === 'review'}
		<ReviewTab
			ply={appState.ply}
			evalPerPly={appState.evalPerPly}
			classCodes={appState.classCodes}
			wdlPerPly={appState.wdlPerPly}
			analyzing={appState.analysisStatus === 'loading'}
		/>
	{:else if appState.tab === 'analysis'}
		<AnalysisTab ply={appState.ply} onSelectPly={goToPly} onNext={() => stepPly(1)} />
	{:else if appState.tab === 'details'}
		<DetailsTab />
	{:else}
		<ExploreTab {onOpenOpenings} />
	{/if}

	{#if appState.tab !== 'review'}
		<BottomBar
			ply={appState.ply}
			evalPerPly={appState.evalPerPly}
			classCodes={appState.classCodes}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(getMaxPly())}
			analyzing={appState.analysisStatus === 'loading'}
		/>
	{/if}
</div>

<style>
	.review-panel {
		width: var(--layout-review-panel-width);
		flex: none;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--color-panel-bg);
		border: 1px solid var(--color-hairline-low);
		border-radius: var(--radius-card);
		overflow: hidden;
	}
	.header {
		flex: none;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 13px 16px 12px;
		border-bottom: 1px solid var(--color-hairline-low);
	}
	.star-badge {
		width: 23px;
		height: 23px;
		border-radius: 50%;
		background: var(--color-accent-green);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.title {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.fill {
		flex: 1;
	}
	.icon-btn {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: var(--color-card-bg);
		border: 1px solid var(--color-hairline-low);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.tabs {
		display: flex;
		gap: 2px;
		padding: 6px;
		border-bottom: 1px solid var(--color-hairline-low);
		flex: none;
	}
	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 6px;
		border-radius: 10px;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		background: none;
		color: var(--color-text-tertiary);
	}
	.tab.active {
		background: rgba(74, 222, 160, 0.1);
		color: var(--color-active-item-text);
	}
</style>
