import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from './nav-items';

describe('NAV_ITEMS', () => {
	it('has exactly 9 entries in the exact order of the dc.html nav array (README §6.1)', () => {
		expect(NAV_ITEMS).toHaveLength(9);
		expect(NAV_ITEMS.map((n) => n.id)).toEqual([
			'home',
			'review',
			'games',
			'openings',
			'insights',
			'training',
			'sessions',
			'stats',
			'settings'
		]);
	});

	it('matches the exact label and icon path for "home"', () => {
		expect(NAV_ITEMS[0]).toEqual({
			id: 'home',
			label: 'Home',
			icon: 'M3 11.5l9-8 9 8M5 10v10h5v-6h4v6h5V10'
		});
	});

	it('matches the exact label and icon path for "review"', () => {
		expect(NAV_ITEMS[1]).toEqual({
			id: 'review',
			label: 'Game Review',
			icon: 'M4 4h16v16H4zM4 9.5h16M9 4v16'
		});
	});

	it('matches the exact icon path for "settings" (the longest/most complex path)', () => {
		expect(NAV_ITEMS[8].icon).toBe(
			'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.9 7.9 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6H9l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.9 7.9 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z'
		);
	});
});
