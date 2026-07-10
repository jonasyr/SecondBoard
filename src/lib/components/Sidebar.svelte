<script lang="ts">
	import { appState } from '$lib/stores/app-state.svelte';
	import Icon from './Icon.svelte';
	import { NAV_ITEMS } from './nav-items';
	import SidebarNavItem from './SidebarNavItem.svelte';
	import SidebarSyncCard from './SidebarSyncCard.svelte';
	import SidebarProfile from './SidebarProfile.svelte';

	function toggleCollapsed() {
		appState.sidebarCollapsed = !appState.sidebarCollapsed;
	}

	// README §6.1: chevrons point left (collapse) when expanded, right (expand) when collapsed.
	const collapseIcon = $derived(
		appState.sidebarCollapsed ? 'M13 5l7 7-7 7M5 5l7 7-7 7' : 'M11 5l-7 7 7 7M19 5l-7 7 7 7'
	);
</script>

<aside class="sidebar" class:collapsed={appState.sidebarCollapsed}>
	<div class="header" class:collapsed={appState.sidebarCollapsed}>
		<div class="logo">
			<div class="logo-cutout"></div>
			<div class="logo-square logo-square--teal"></div>
			<div class="logo-square logo-square--purple"></div>
		</div>
		{#if !appState.sidebarCollapsed}
			<div class="brand">
				<div class="brand-name">SecondBoard</div>
				<div class="brand-tagline">Chess Review Lab</div>
			</div>
		{/if}
		<button type="button" class="collapse-toggle" onclick={toggleCollapsed} title="Toggle sidebar">
			<Icon d={collapseIcon} size={16} stroke="#8A90A0" strokeWidth={2} />
		</button>
	</div>

	<nav class="nav-list">
		{#each NAV_ITEMS as item (item.id)}
			<SidebarNavItem
				label={item.label}
				icon={item.icon}
				active={appState.screen === item.id}
				collapsed={appState.sidebarCollapsed}
				onclick={() => (appState.screen = item.id)}
			/>
		{/each}
	</nav>

	<div class="spacer"></div>

	{#if !appState.sidebarCollapsed}
		<SidebarSyncCard />
	{/if}

	<SidebarProfile collapsed={appState.sidebarCollapsed} />
</aside>

<style>
	.sidebar {
		width: var(--layout-sidebar-width-expanded);
		flex: none;
		background: var(--color-sidebar-gradient);
		border-right: 1px solid var(--color-hairline-low);
		display: flex;
		flex-direction: column;
		padding: 18px 14px;
		transition: width 0.2s ease;
	}
	.sidebar.collapsed {
		width: var(--layout-sidebar-width-collapsed);
	}
	.header {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 4px 6px 18px;
	}
	.header.collapsed {
		flex-direction: column;
		gap: 12px;
		padding: 2px 0 16px;
	}
	.logo {
		width: 38px;
		height: 38px;
		flex: none;
		border-radius: 11px;
		background: var(--gradient-logo);
		position: relative;
		box-shadow: 0 6px 18px rgba(59, 130, 246, 0.35);
		overflow: hidden;
	}
	.logo-cutout {
		position: absolute;
		inset: 7px;
		border-radius: 5px;
		background: var(--color-deep-inset-bg);
	}
	.logo-square {
		position: absolute;
		width: 9px;
		height: 9px;
		border-radius: 2px;
	}
	.logo-square--teal {
		left: 11px;
		top: 11px;
		background: var(--color-accent-teal);
	}
	.logo-square--purple {
		right: 9px;
		bottom: 9px;
		background: var(--color-accent-purple);
	}
	.brand {
		flex: 1;
		min-width: 0;
	}
	.brand-name {
		font-size: 16px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.brand-tagline {
		font-size: 10.5px;
		color: var(--color-text-muted-dark);
		letter-spacing: 0.02em;
		margin-top: 1px;
	}
	.collapse-toggle {
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: 7px;
		background: var(--color-card-bg);
		border: 1px solid rgba(255, 255, 255, 0.06);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
	}
	.nav-list {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.spacer {
		flex: 1;
	}
</style>
