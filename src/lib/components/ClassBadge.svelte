<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		classCode: ClassCode;
		size: 16 | 21 | 22;
	}

	let { classCode, size }: Props = $props();

	const cls = $derived(TOKENS.classification[classCode]);
	let failedIcon = $state('');
	const iconFailed = $derived(failedIcon === cls.icon);
	const fallbackFontSize = $derived(size === 16 ? 8.5 : size === 21 ? 10.5 : 11);
</script>

<span
	class="badge"
	class:with-shadow={size === 16}
	class:icon-failed={iconFailed}
	style={`width:${size}px;height:${size}px;--badge-color:${cls.color};--badge-font-size:${fallbackFontSize}px;`}
>
	<img
		class="classification-icon"
		class:hidden={iconFailed}
		src={cls.icon}
		alt={cls.name}
		onerror={() => (failedIcon = cls.icon)}
	/>
	<span class="glyph-fallback" class:visible={iconFailed} aria-hidden={!iconFailed}>{cls.glyph}</span>
</span>

<style>
	.badge {
		flex: none;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		position: relative;
	}
	.classification-icon {
		display: block;
		width: 100%;
		height: 100%;
	}
	.classification-icon.hidden {
		display: none;
	}
	.badge.icon-failed {
		border-radius: 50%;
		background: var(--badge-color);
		color: #fff;
		font-size: var(--badge-font-size);
		font-weight: 800;
		line-height: 1;
	}
	.badge.with-shadow {
		filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.35));
	}
	.glyph-fallback {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.glyph-fallback.visible {
		position: static;
		width: auto;
		height: auto;
		margin: 0;
		overflow: visible;
		clip: auto;
		white-space: normal;
	}
</style>
