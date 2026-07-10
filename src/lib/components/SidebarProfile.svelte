<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		collapsed: boolean;
	}

	let { collapsed }: Props = $props();
</script>

<div class="profile" class:collapsed>
	<div class="avatar">J</div>
	{#if !collapsed}
		<div class="details">
			<div class="name">Jonas</div>
			<div class="rating">Rapid <span class="sbmono rating-value">1867</span></div>
		</div>
		<Icon d="M6 9l6 6 6-6" size={15} stroke="#565C6B" strokeWidth={2} />
	{/if}
</div>

<style>
	.profile {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 9px;
		border-radius: 12px;
		background: var(--color-panel-bg);
		border: 1px solid var(--color-hairline-low);
	}
	.profile.collapsed {
		justify-content: center;
		padding: 6px 0;
		background: none;
		border: none;
	}
	.avatar {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: 9px;
		background: linear-gradient(135deg, #3b82f6, #a78bfa);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
		color: #fff;
		box-shadow: 0 4px 12px rgba(99, 102, 241, 0.35);
	}
	.details {
		flex: 1;
		min-width: 0;
	}
	.name {
		font-size: 12.5px;
		font-weight: 600;
	}
	.rating {
		font-size: 10.5px;
		color: var(--color-text-muted-dark);
	}
	.rating-value {
		color: var(--color-light-green-1);
	}
</style>
