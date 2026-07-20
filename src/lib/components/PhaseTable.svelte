<script lang="ts">
	import { PHASE_ROWS } from '$lib/game/mock-data';
	import ClassBadge from './ClassBadge.svelte';
</script>

<div class="phases">
	{#each PHASE_ROWS as [name, whiteCode, blackCode] (name)}
		<div class="row">
			<span class="name">{name}</span>
			<div class="badge-col"><ClassBadge classCode={whiteCode} size={22} /></div>
			<span></span>
			<div class="badge-col"><ClassBadge classCode={blackCode} size={22} /></div>
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
</style>
