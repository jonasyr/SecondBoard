<script lang="ts">
	import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '$lib/api/window';
</script>

<div class="title-bar" data-tauri-drag-region>
	<div class="title" data-tauri-drag-region>SecondBoard — Local Chess Review Companion</div>
	<div class="right">
		<span class="version sbmono">v0.4.1</span>
		<div class="window-controls">
			<button
				type="button"
				class="win-btn"
				onclick={minimizeWindow}
				title="Minimize"
				aria-label="Minimize window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
			<button
				type="button"
				class="win-btn"
				onclick={toggleMaximizeWindow}
				title="Maximize"
				aria-label="Maximize window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
			<button
				type="button"
				class="win-btn close"
				onclick={closeWindow}
				title="Close"
				aria-label="Close window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1" />
					<line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	.title-bar {
		height: var(--layout-titlebar-height);
		flex: none;
		display: flex;
		align-items: center;
		padding: 0 0 0 14px;
		background: var(--color-titlebar-gradient);
		border-bottom: 1px solid var(--color-hairline-low);
		gap: 14px;
		/* Windows/webview drag-region shim per Tauri's window-customization guide. */
		app-region: drag;
	}
	.title {
		flex: 1;
		text-align: center;
		font-size: 12px;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		font-weight: 500;
	}
	.right {
		display: flex;
		align-items: center;
		align-self: stretch;
		gap: 12px;
		app-region: no-drag;
	}
	.version {
		font-size: 10.5px;
		color: var(--color-text-muted-dark);
	}
	.window-controls {
		display: flex;
		align-items: stretch;
		align-self: stretch;
	}
	.win-btn {
		width: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-tertiary);
		cursor: pointer;
	}
	.win-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary-alt);
	}
	.win-btn.close:hover {
		background: #e81123;
		color: #ffffff;
	}
</style>
