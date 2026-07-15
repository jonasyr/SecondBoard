<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onOpenOpenings: () => void;
	}

	let { onOpenOpenings }: Props = $props();
</script>

<div class="explore-tab sbscroll">
	<div class="heading">Explore this opening</div>
	<div class="subtitle">Italian Game · you've played this line 75 times.</div>
	<div class="card" onclick={onOpenOpenings}>
		<div class="stat sbmono">61%</div>
		<div class="stat-label">win rate in the Italian Game</div>
		<div class="link">
			Open in Opening Explorer
			<Icon d="M9 6l6 6-6 6" size={15} stroke="#4ADEA0" strokeWidth={2} />
		</div>
	</div>
</div>

<style>
	.explore-tab {
		flex: 1;
		overflow-y: auto;
		padding: 18px 20px;
	}
	.heading {
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.subtitle {
		font-size: 12px;
		color: var(--color-text-tertiary);
		margin-bottom: 16px;
	}
	.card {
		border-radius: 14px;
		padding: 18px;
		background: radial-gradient(120% 130% at 0% 0%, rgba(74, 222, 160, 0.12), transparent 55%),
			var(--color-card-bg);
		border: 1px solid rgba(74, 222, 160, 0.2);
		cursor: pointer;
	}
	.stat {
		font-size: 24px;
		font-weight: 600;
		color: var(--color-accent-green);
	}
	.stat-label {
		font-size: 11px;
		color: var(--color-text-tertiary);
		margin-bottom: 14px;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 12.5px;
		color: var(--color-accent-green);
		font-weight: 600;
	}
</style>
