<script lang="ts">
	import type { Screen } from '$lib/types';
	import { appState } from '$lib/stores/app-state.svelte';
	import Board from '$lib/components/Board.svelte';
	import { DEV_GAME } from '$lib/board/dev-fixtures';

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

	const screenLabel = $derived(
		appState.screen === 'review'
			? appState.gameLoaded
				? 'Game Review'
				: 'Onboarding · Paste PGN'
			: SCREEN_LABELS[appState.screen]
	);

	// TEMPORARY Board QA harness (Iteration 3) — lets the Board component be
	// pixel-compared against reference/screens/2-*.png and 3-*.png before
	// Iteration 4 replaces this with the real two-column Game Review layout
	// (avatars, eval bar, tabbed right panel). See board/dev-fixtures.ts.
	let harnessPly = $state(31);
	let harnessFlipped = $state(false);

	const harnessPosition = $derived(DEV_GAME.positions[harnessPly]);
	const harnessLastMove = $derived(harnessPly > 0 ? DEV_GAME.meta[harnessPly - 1] : null);
	const harnessClassCode = $derived(harnessPly > 0 ? DEV_GAME.classCodes[harnessPly - 1] : null);
	const harnessBest = $derived(DEV_GAME.bestMoves[harnessPly] ?? null);
</script>

{#if appState.screen === 'review' && appState.gameLoaded}
	<div class="board-harness">
		<div class="board-sizer">
			<Board
				position={harnessPosition}
				ply={harnessPly}
				flipped={harnessFlipped}
				lastMove={harnessLastMove}
				classCode={harnessClassCode}
				best={harnessBest}
			/>
		</div>
		<div class="board-harness-controls sbmono">
			<button type="button" onclick={() => (harnessPly = Math.max(0, harnessPly - 1))}>Prev</button>
			<span>ply {harnessPly}</span>
			<button type="button" onclick={() => (harnessPly = Math.min(31, harnessPly + 1))}>Next</button
			>
			<button type="button" onclick={() => (harnessFlipped = !harnessFlipped)}>Flip</button>
		</div>
	</div>
{:else}
	<div class="screen-placeholder">
		{screenLabel} — scaffold OK
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
	.board-harness {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 100%;
		gap: 16px;
	}
	.board-sizer {
		container-type: size;
		width: min(70vh, 70vw);
		height: min(70vh, 70vw);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.board-harness-controls {
		display: flex;
		align-items: center;
		gap: 10px;
		color: var(--color-text-muted);
	}
	.board-harness-controls button {
		padding: 6px 12px;
		border-radius: var(--radius-control);
		background: var(--color-card-bg);
		border: 1px solid var(--color-hairline-high);
		color: var(--color-text-secondary);
		cursor: pointer;
	}
</style>
