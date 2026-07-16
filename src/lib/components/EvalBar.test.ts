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

	it('shows the signed white-POV eval on one label and its negation on the other, for a positive eval', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		const labels = Array.from(container.querySelectorAll('.label')).map((el) => el.textContent);
		expect(labels).toEqual(['+2.4', '-2.4']);
	});

	it('shows the signed white-POV eval on one label and its negation on the other, for a negative eval', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 20, evalNum: -1.5, whiteAtBottom: true }
		});
		const labels = Array.from(container.querySelectorAll('.label')).map((el) => el.textContent);
		expect(labels).toEqual(['-1.5', '+1.5']);
	});

	it('renders no analyzing indicator by default', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 50, evalNum: 0, whiteAtBottom: true }
		});
		expect(container.querySelector('.analyzing-dot')).toBeNull();
	});

	it('renders an analyzing indicator when analyzing is true', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 50, evalNum: 0, whiteAtBottom: true, analyzing: true }
		});
		expect(container.querySelector('.analyzing-dot')).not.toBeNull();
	});
});
