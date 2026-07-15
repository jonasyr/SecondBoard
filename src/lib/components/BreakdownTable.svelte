<script lang="ts">
	import { BREAKDOWN_ROWS } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import ClassBadge from './ClassBadge.svelte';
</script>

<div class="breakdown">
	{#each BREAKDOWN_ROWS as [code, white, black] (code)}
		<div class="row">
			<span class="name">{TOKENS.classification[code].name}</span>
			<span class="count sbmono" style={`color:${TOKENS.classification[code].color};`}>{white}</span>
			<div class="badge-col"><ClassBadge classCode={code} size={21} useDarkFg /></div>
			<span class="count sbmono" style={`color:${TOKENS.classification[code].color};`}>{black}</span>
		</div>
	{/each}
</div>

<style>
	.breakdown {
		margin-bottom: 14px;
	}
	.row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 2.5px 0;
	}
	.name {
		font-size: 12px;
		color: #c2c7d4;
	}
	.count {
		text-align: center;
		font-size: 13px;
		font-weight: 600;
	}
	.badge-col {
		display: flex;
		justify-content: center;
	}
</style>
