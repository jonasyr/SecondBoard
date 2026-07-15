import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ClassBadge from './ClassBadge.svelte';

describe('ClassBadge', () => {
	it('renders the glyph and background color for the given classification', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'brilliant', size: 16 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.textContent).toBe('!!');
		expect(el.getAttribute('style')).toContain('45, 224, 206'); // #2DE0CE
	});

	it('sizes the badge in pixels via the size prop', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'best', size: 21 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute('style')).toContain('width: 21px');
		expect(el.getAttribute('style')).toContain('height: 21px');
	});

	it('uses dark foreground text only when useDarkFg is set and the code is in DARK_FG_CODES', () => {
		const { container: withDark } = render(ClassBadge, {
			props: { classCode: 'best', size: 21, useDarkFg: true }
		});
		expect((withDark.firstElementChild as HTMLElement).getAttribute('style')).toContain(
			'11, 18, 15'
		); // #0B120F

		const { container: withoutDark } = render(ClassBadge, {
			props: { classCode: 'best', size: 16, useDarkFg: false }
		});
		expect((withoutDark.firstElementChild as HTMLElement).getAttribute('style')).toContain(
			'255, 255, 255'
		);
	});
});
