<script lang="ts">
	import { appState, startReview } from '$lib/stores/app-state.svelte';
	import Icon from './Icon.svelte';

	const SAMPLE_PGN =
		'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';

	function pasteSample() {
		appState.pgnText = SAMPLE_PGN;
	}
</script>

<div class="onboarding">
	<div class="content">
		<div class="logo">
			<div class="cutout"></div>
			<div class="square teal"></div>
			<div class="square purple"></div>
		</div>
		<div class="heading">Review your chess game</div>
		<div class="subtitle">
			Paste a PGN to start a local game review. Every move is classified and analyzed on your
			machine — nothing leaves your device.
		</div>

		<div class="pgn-card">
			<div class="card-header">
				<span class="label">PGN</span>
				<span class="paste-sample" onclick={pasteSample}>
					<Icon
						d="M9 5h6M9 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"
						size={13}
						stroke="#4ADEA0"
						strokeWidth={2}
					/>
					Paste sample game
				</span>
			</div>
			<textarea
				class="sbmono sbscroll"
				bind:value={appState.pgnText}
				spellcheck="false"
				placeholder={'[Event "Live Rapid"]\n[White "Jonas"]\n[Black "DominikP"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 ...'}
			></textarea>
			<div class="actions">
				<button type="button" class="start" onclick={startReview}>
					Start Review
					<Icon d="M5 12h13M12 5l7 7-7 7" size={16} stroke="#062018" strokeWidth={2.4} />
				</button>
				<button type="button" class="upload">
					<Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={15} stroke="#8A90A0" strokeWidth={2} />
					Upload .pgn
				</button>
			</div>
		</div>

		<div class="footer">
			<span class="dot"></span>
			Local · Offline — analysis runs entirely on this device.
		</div>
	</div>
</div>

<style>
	.onboarding {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.content {
		width: 100%;
		max-width: 760px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.logo {
		width: 52px;
		height: 52px;
		border-radius: 15px;
		background: var(--gradient-logo);
		position: relative;
		box-shadow: 0 12px 30px rgba(59, 130, 246, 0.4);
		margin-bottom: 20px;
		overflow: hidden;
	}
	.cutout {
		position: absolute;
		inset: 9px;
		border-radius: 7px;
		background: var(--color-deep-inset-bg);
	}
	.square {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.square.teal {
		left: 14px;
		top: 14px;
		background: var(--color-accent-teal);
	}
	.square.purple {
		right: 12px;
		bottom: 12px;
		background: var(--color-accent-purple);
	}
	.heading {
		font-size: 30px;
		font-weight: 700;
		letter-spacing: -0.02em;
		text-align: center;
	}
	.subtitle {
		font-size: 15px;
		color: var(--color-text-tertiary);
		margin-top: 9px;
		text-align: center;
		max-width: 520px;
		line-height: 1.5;
	}
	.pgn-card {
		width: 100%;
		margin-top: 28px;
		background: var(--color-panel-bg);
		border: 1px solid var(--color-hairline-high);
		border-radius: var(--radius-card);
		padding: 16px 16px 14px;
	}
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}
	.label {
		font-size: 12px;
		color: var(--color-text-tertiary);
		font-weight: 500;
		letter-spacing: 0.02em;
	}
	.paste-sample {
		font-size: 11.5px;
		color: var(--color-accent-green);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
	}
	textarea {
		width: 100%;
		height: 190px;
		resize: none;
		background: var(--color-deep-inset-bg);
		border: 1px solid var(--color-hairline-high);
		border-radius: var(--radius-inset);
		padding: 13px 14px;
		color: #d7dbe6;
		font-size: 13px;
		line-height: 1.55;
		outline: none;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 13px;
	}
	.start {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 13px;
		border-radius: 12px;
		background: var(--gradient-cta-primary);
		color: var(--color-cta-primary-text);
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
		border: none;
		box-shadow: var(--shadow-cta-glow);
	}
	.upload {
		flex: none;
		padding: 13px 18px;
		border-radius: 12px;
		background: #1b1e2a;
		border: 1px solid var(--color-hairline-high);
		color: var(--color-text-secondary);
		font-weight: 500;
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.footer {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 16px;
		font-size: 11.5px;
		color: var(--color-text-muted-dark);
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-accent-green);
	}
</style>
