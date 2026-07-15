import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EvalGraph from './EvalGraph.svelte';
import type { ClassCode } from '$lib/types';

describe('EvalGraph', () => {
	it('renders an svg with viewBox 0 0 660 78 at the requested height', () => {
		const { container } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 66 }
		});
		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('viewBox')).toBe('0 0 660 78');
		expect(svg.getAttribute('height')).toBe('66');
	});

	it('uses an 8px radius at height 66 and 6px at height 62', () => {
		const { container: tall } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 66 }
		});
		// Svelte 5's style={...} binding sets element.style.cssText, and jsdom's
		// CSSStyleDeclaration always re-serializes with a space after the colon
		// (verified directly against jsdom, independent of this component), so
		// the attribute read back is "border-radius: 8px" rather than "border-radius:8px".
		expect(tall.querySelector('svg')!.getAttribute('style')).toContain('border-radius: 8px');

		const { container: short } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 62 }
		});
		expect(short.querySelector('svg')!.getAttribute('style')).toContain('border-radius: 6px');
	});

	it('renders one dot per notable classification and a current-ply marker circle', () => {
		const { container } = render(EvalGraph, {
			props: {
				evalPerPly: [0, 0.3, 0.2, 0.3],
				classCodes: ['book', 'brilliant', 'good'] as ClassCode[],
				ply: 2,
				height: 66
			}
		});
		const circles = container.querySelectorAll('circle');
		// 1 notable dot + 1 marker circle
		expect(circles).toHaveLength(2);
	});
});
