import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import ClassBadge from './ClassBadge.svelte';

describe('ClassBadge', () => {
	it('renders the official classification SVG with an accessible name', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'brilliant', size: 16 } });
		const icon = container.querySelector('.classification-icon') as HTMLImageElement;
		expect(icon).not.toBeNull();
		expect(icon.getAttribute('src')).toContain("id='Brilliant'");
		expect(icon.getAttribute('alt')).toBe('Brilliant');
	});

	it('sizes the badge in pixels via the size prop', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'best', size: 21 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute('style')).toContain('width: 21px');
		expect(el.getAttribute('style')).toContain('height: 21px');
	});

	it('uses the mapped Chess.com aliases for Great and Miss', () => {
		const { container: great } = render(ClassBadge, { props: { classCode: 'great', size: 21 } });
		expect(great.querySelector('img')?.getAttribute('src')).toContain("id='great_find'");

		const { container: miss } = render(ClassBadge, { props: { classCode: 'miss', size: 22 } });
		expect(miss.querySelector('img')?.getAttribute('src')).toContain("id='missed_win'");
	});

	it('reveals the glyph fallback when the SVG cannot load', async () => {
		const { container } = render(ClassBadge, { props: { classCode: 'brilliant', size: 16 } });
		const icon = container.querySelector('.classification-icon') as HTMLImageElement;

		await fireEvent.error(icon);

		expect(icon.classList.contains('hidden')).toBe(true);
		const fallback = container.querySelector('.glyph-fallback') as HTMLElement;
		expect(fallback.classList.contains('visible')).toBe(true);
		expect(fallback.getAttribute('aria-hidden')).toBe('false');
		expect(fallback.textContent).toBe('!!');
	});
});
