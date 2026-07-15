<script lang="ts">
	import { TOKENS, DARK_FG_CODES } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		classCode: ClassCode;
		size: 16 | 21 | 22;
		useDarkFg?: boolean;
	}

	let { classCode, size, useDarkFg = false }: Props = $props();

	const cls = $derived(TOKENS.classification[classCode]);
	const fg = $derived(useDarkFg && DARK_FG_CODES.includes(classCode) ? '#0B120F' : '#fff');
	const fontSize = $derived(size === 16 ? '8.5px' : size === 21 ? '10.5px' : '11px');
</script>

<span
	class="badge"
	class:with-shadow={size === 16}
	style={`width:${size}px;height:${size}px;font-size:${fontSize};background:${cls.color};color:${fg};`}
>{cls.glyph}</span>

<style>
	.badge {
		flex: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		letter-spacing: -0.5px;
	}
	.badge.with-shadow {
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
</style>
