import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Icon from './Icon.svelte';

describe('Icon', () => {
	it('renders a path with the given d attribute', () => {
		const { container } = render(Icon, { props: { d: 'M1 2h3' } });
		const path = container.querySelector('path');
		expect(path?.getAttribute('d')).toBe('M1 2h3');
	});

	it('applies a given size and stroke color', () => {
		const { container } = render(Icon, { props: { d: 'M1 2h3', size: 24, stroke: '#4ADEA0' } });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('24');
		expect(svg?.getAttribute('height')).toBe('24');
		expect(svg?.getAttribute('stroke')).toBe('#4ADEA0');
	});

	it('defaults to 18px size, currentColor stroke, and 1.9 stroke-width per README §9', () => {
		const { container } = render(Icon, { props: { d: 'M1 2h3' } });
		const svg = container.querySelector('svg');
		expect(svg?.getAttribute('width')).toBe('18');
		expect(svg?.getAttribute('height')).toBe('18');
		expect(svg?.getAttribute('stroke')).toBe('currentColor');
		expect(svg?.getAttribute('stroke-width')).toBe('1.9');
	});
});
