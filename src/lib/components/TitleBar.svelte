<script lang="ts">
	import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '$lib/api/window';
</script>

<div class="title-bar" data-tauri-drag-region>
	<div class="window-controls">
		<button type="button" class="dot" onclick={minimizeWindow} title="Minimize" aria-label="Minimize window"
		></button>
		<button
			type="button"
			class="dot"
			onclick={toggleMaximizeWindow}
			title="Maximize"
			aria-label="Maximize window"
		></button>
		<button type="button" class="dot" onclick={closeWindow} title="Close" aria-label="Close window"
		></button>
	</div>
	<div class="title" data-tauri-drag-region>SecondBoard — Local Chess Review Companion</div>
	<div class="right">
		<div class="status-pill">
			<span class="status-dot"></span>
			<span class="status-text">Local · Offline</span>
		</div>
		<span class="version sbmono">v0.4.1</span>
	</div>
</div>

<style>
	.title-bar {
		height: var(--layout-titlebar-height);
		flex: none;
		display: flex;
		align-items: center;
		padding: 0 14px;
		background: var(--color-titlebar-gradient);
		border-bottom: 1px solid var(--color-hairline-low);
		gap: 14px;
		/* Windows/webview drag-region shim per Tauri's window-customization guide. */
		app-region: drag;
	}
	.window-controls {
		display: flex;
		gap: 8px;
		align-items: center;
		app-region: no-drag;
	}
	.dot {
		width: 11px;
		height: 11px;
		border-radius: 50%;
		background: var(--color-window-dot);
		border: none;
		padding: 0;
		cursor: pointer;
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
		gap: 12px;
		app-region: no-drag;
	}
	.status-pill {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px 9px;
		border-radius: var(--radius-pill);
		background: rgba(74, 222, 160, 0.1);
		border: 1px solid rgba(74, 222, 160, 0.22);
	}
	.status-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--color-accent-green);
		box-shadow: 0 0 8px var(--color-accent-green);
	}
	.status-text {
		font-size: 10.5px;
		color: var(--color-light-green-1);
		font-weight: 500;
		letter-spacing: 0.02em;
	}
	.version {
		font-size: 10.5px;
		color: var(--color-text-muted-dark);
	}
</style>
