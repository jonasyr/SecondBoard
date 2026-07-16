<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, newGame, handleReviewKeydown } from '$lib/stores/app-state.svelte';
	import { getReviewPly, getPlayerRows } from '$lib/game/review';
	import Board from './Board.svelte';
	import PlayerRow from './PlayerRow.svelte';
	import EvalBar from './EvalBar.svelte';
	import ReviewPanel from './ReviewPanel.svelte';

	const data = $derived(getReviewPly(appState.ply, appState.evalPerPly, appState.bestMoves));
	const rows = $derived(getPlayerRows(appState.ply, appState.flipped));

	onMount(() => {
		window.addEventListener('keydown', handleReviewKeydown);
		return () => window.removeEventListener('keydown', handleReviewKeydown);
	});
</script>

<div class="game-review">
	<div class="board-area">
		<PlayerRow player={rows.top} showNewGameButton onNewGame={newGame} />

		<div class="board-row">
			<EvalBar whitePct={data.whitePct} evalNum={data.evalNum} whiteAtBottom={!appState.flipped} />
			<div class="board-sizer">
				<Board
					position={data.position}
					ply={appState.ply}
					flipped={appState.flipped}
					lastMove={data.lastMove}
					classCode={data.classCode}
					best={data.best}
				/>
			</div>
		</div>

		<PlayerRow player={rows.bottom} />
	</div>

	<ReviewPanel
		onToggleFlip={() => (appState.flipped = !appState.flipped)}
		onOpenOpenings={() => (appState.screen = 'openings')}
	/>
</div>

<style>
	.game-review {
		padding: 12px 14px;
		display: flex;
		gap: 14px;
		align-items: stretch;
		height: 100%;
		overflow: hidden;
	}
	.board-area {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.board-row {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: 9px;
		justify-content: center;
		align-items: stretch;
		padding: 8px 0;
	}
	.board-sizer {
		flex: 1;
		min-width: 0;
		min-height: 0;
		container-type: size;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
