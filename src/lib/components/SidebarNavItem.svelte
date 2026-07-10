<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		label: string;
		icon: string;
		active: boolean;
		collapsed: boolean;
		onclick: () => void;
	}

	let { label, icon, active, collapsed, onclick }: Props = $props();
</script>

<button type="button" class="nav-item" class:active class:collapsed {onclick} title={label}>
	<Icon d={icon} size={18} stroke={active ? '#4ADEA0' : '#6B7180'} strokeWidth={1.9} />
	{#if !collapsed}
		<span class="label">{label}</span>
	{/if}
</button>

<style>
	.nav-item {
		display: flex;
		align-items: center;
		gap: var(--layout-nav-row-gap);
		padding: var(--layout-nav-row-padding);
		border-radius: 11px;
		font-size: 13px;
		font-weight: 500;
		cursor: pointer;
		border: none;
		background: none;
		color: #9298a8;
		width: 100%;
		text-align: left;
		font-family: inherit;
	}
	.nav-item.collapsed {
		justify-content: center;
		padding: 9px 0;
	}
	.nav-item.active {
		background: linear-gradient(135deg, rgba(74, 222, 160, 0.14), rgba(74, 222, 160, 0.04));
		color: var(--color-active-item-text);
		box-shadow: inset 0 0 0 1px rgba(74, 222, 160, 0.2);
	}
	.label {
		flex: 1;
	}
</style>
