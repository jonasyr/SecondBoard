<script lang="ts">
	import type { Screen } from '$lib/types';
	import { appState } from '$lib/stores/app-state.svelte';
	import OnboardingScreen from '$lib/components/OnboardingScreen.svelte';
	import GameReviewScreen from '$lib/components/GameReviewScreen.svelte';

	const SCREEN_LABELS: Record<Exclude<Screen, 'review'>, string> = {
		home: 'Dashboard',
		openings: 'Opening Explorer',
		insights: 'Insights & Weakness Timeline',
		training: 'Training',
		games: 'Games',
		sessions: 'Sessions',
		stats: 'Stats',
		settings: 'Settings'
	};
</script>

{#if appState.screen === 'review' && appState.gameLoaded}
	<GameReviewScreen />
{:else if appState.screen === 'review'}
	<OnboardingScreen />
{:else}
	<div class="screen-placeholder">
		{SCREEN_LABELS[appState.screen]} — scaffold OK
	</div>
{/if}

<style>
	.screen-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
</style>
