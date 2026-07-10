<div class="sync-card">
	<div class="sync-header">
		<span class="sync-label">Chess.com sync</span>
		<span class="sync-status"><span class="sync-dot"></span>Synced</span>
	</div>
	<div class="sync-progress-track">
		<div class="sync-progress-fill"></div>
	</div>
	<div class="sync-footer">
		<span>247 games indexed</span>
		<span class="sbmono">2m ago</span>
	</div>
</div>

<style>
	.sync-card {
		background: #12141d;
		border: 1px solid rgba(255, 255, 255, 0.06);
		border-radius: 13px;
		padding: 12px;
		margin-bottom: 12px;
	}
	.sync-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 9px;
	}
	.sync-label {
		font-size: 11px;
		color: var(--color-text-tertiary);
		font-weight: 500;
	}
	.sync-status {
		font-size: 10px;
		color: var(--color-accent-green);
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.sync-dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-accent-green);
	}
	.sync-progress-track {
		height: 5px;
		border-radius: 10px;
		background: #1e2130;
		overflow: hidden;
		margin-bottom: 7px;
	}
	.sync-progress-fill {
		width: 100%;
		height: 100%;
		background: linear-gradient(90deg, #2de0ce, #4adea0);
	}
	.sync-footer {
		display: flex;
		justify-content: space-between;
		font-size: 10px;
		color: var(--color-text-muted-dark);
	}
</style>
