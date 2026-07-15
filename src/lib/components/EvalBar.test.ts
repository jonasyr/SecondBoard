import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EvalBar from './EvalBar.svelte';

describe('EvalBar', () => {
	it('renders the fill height from whitePct and grows from the bottom when White is at the bottom', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		const fill = container.querySelector('.fill') as HTMLElement;
		expect(fill.getAttribute('style')).toContain('height: 62.5%');
		expect(fill.getAttribute('style')).toContain('bottom: 0px');
	});

	it('grows from the top when flipped (White not at the bottom)', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: false }
		});
		const fill = container.querySelector('.fill') as HTMLElement;
		expect(fill.getAttribute('style')).toContain('top: 0px');
	});

	it('shows the absolute eval magnitude as the label, positive or negative eval', () => {
		const { container: pos } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		expect(pos.querySelector('.label')?.textContent).toBe('2.4');

		const { container: neg } = render(EvalBar, {
			props: { whitePct: 20, evalNum: -1.5, whiteAtBottom: true }
		});
		expect(neg.querySelector('.label')?.textContent).toBe('1.5');
	});
});
