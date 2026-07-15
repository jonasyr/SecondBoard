<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onFirst: () => void;
		onPrev: () => void;
		onNext: () => void;
		onLast: () => void;
	}

	let { onFirst, onPrev, onNext, onLast }: Props = $props();
</script>

<div class="nav-controls">
	<button type="button" class="nav-btn" onclick={onFirst}>
		<Icon d="M19 5v14M15 6l-7 6 7 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
	<button type="button" class="nav-btn" onclick={onPrev}>
		<Icon d="M15 6l-6 6 6 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
	<button type="button" class="play-btn" onclick={onNext}>
		<svg width="17" height="17" viewBox="0 0 24 24" fill="#062018" stroke="none">
			<path d="M7 5l12 7-12 7z" />
		</svg>
	</button>
	<button type="button" class="nav-btn" onclick={onNext}>
		<Icon d="M9 6l6 6-6 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
	<button type="button" class="nav-btn" onclick={onLast}>
		<Icon d="M5 5v14M9 6l7 6-7 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
</div>

<style>
	.nav-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 12px 11px;
	}
	.nav-btn {
		width: 52px;
		height: 38px;
		border-radius: 9px;
		background: #14161f;
		border: 1px solid rgba(255, 255, 255, 0.07);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.play-btn {
		width: 70px;
		height: 38px;
		border-radius: 9px;
		background: var(--gradient-cta-primary);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(74, 222, 160, 0.28);
	}
</style>
