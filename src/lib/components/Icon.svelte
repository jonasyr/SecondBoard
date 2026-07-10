<script lang="ts">
	interface Props {
		d: string;
		size?: number;
		stroke?: string;
		strokeWidth?: number;
	}

	let { d, size = 18, stroke = 'currentColor', strokeWidth = 1.9 }: Props = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	{stroke}
	stroke-width={strokeWidth}
	stroke-linecap="round"
	stroke-linejoin="round"
>
	<path {d} />
</svg>
