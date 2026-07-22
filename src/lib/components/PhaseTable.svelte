<script lang="ts">
	import type { PhaseRow } from '$lib/game/phase';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		rows: PhaseRow[];
	}

	let { rows }: Props = $props();

	function tooltip(side: 'White' | 'Black', phaseName: string, accuracy: number): string {
		return `${side}: ${accuracy.toFixed(1)}% accuracy in the ${phaseName}`;
	}
</script>

<div class="phases">
	{#each rows as row (row.name)}
		<div class="row">
			<span class="name">{row.name}</span>
			<div class="badge-col">
				{#if row.white}
					<span title={tooltip('White', row.name, row.white.accuracy)}>
						<ClassBadge classCode={row.white.code} size={22} />
					</span>
				{:else}
					<span class="empty">—</span>
				{/if}
			</div>
			<span></span>
			<div class="badge-col">
				{#if row.black}
					<span title={tooltip('Black', row.name, row.black.accuracy)}>
						<ClassBadge classCode={row.black.code} size={22} />
					</span>
				{:else}
					<span class="empty">—</span>
				{/if}
			</div>
		</div>
	{/each}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 5px 0;
	}
	.name {
		font-size: 12.5px;
		color: var(--color-text-secondary-alt);
		font-weight: 500;
	}
	.badge-col {
		display: flex;
		justify-content: center;
	}
	.empty {
		color: var(--color-text-tertiary);
		font-size: 13px;
	}
</style>
