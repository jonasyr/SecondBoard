<script lang="ts">
	import '../app.css';
	import TitleBar from '$lib/components/TitleBar.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';

	let { children } = $props();
</script>

<div class="app-shell">
	<TitleBar />
	<div class="body-row">
		<Sidebar />
		<main class="main-content sbscroll">
			{@render children()}
		</main>
	</div>
</div>

<style>
	.app-shell {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--color-app-bg);
	}
	.body-row {
		flex: 1;
		display: flex;
		min-height: 0;
	}
	.main-content {
		flex: 1;
		min-width: 0;
		overflow-y: auto;
		overflow-x: hidden;
	}
</style>
