import { describe, it, expect } from 'vitest';
import { render, cleanup } from '@testing-library/svelte';
import PlayerRow from './PlayerRow.svelte';
import type { PlayerRowData } from '$lib/game/review';

const base: PlayerRowData = {
	name: 'Jonas',
	rating: '1867',
	initial: 'J',
	isWhite: true,
	clock: '4:12',
	clockActive: true,
	captured: [{ color: 'b', type: 'Q' }],
	adv: '+3'
};

describe('PlayerRow', () => {
	it('renders name, rating, and clock', () => {
		const { getByText } = render(PlayerRow, { props: { player: base } });
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('1867')).toBeTruthy();
		expect(getByText('4:12')).toBeTruthy();
	});

	it('renders one captured-piece sprite per entry plus the material advantage', () => {
		const { container, getByText } = render(PlayerRow, { props: { player: base } });
		expect(container.querySelectorAll('.captured-piece')).toHaveLength(1);
		expect(getByText('+3')).toBeTruthy();
	});

	it('gives black captured pieces a light outline instead of the dark shadow used for white', () => {
		const mixed: PlayerRowData = {
			...base,
			captured: [
				{ color: 'w', type: 'P' },
				{ color: 'b', type: 'Q' }
			]
		};
		const { container } = render(PlayerRow, { props: { player: mixed } });
		const sprites = container.querySelectorAll('.captured-piece');
		expect(sprites[0].getAttribute('style')).toContain('rgba(0,0,0,.5)');
		expect(sprites[1].getAttribute('style')).toContain('rgba(255,255,255,.55)');
	});

	it('omits the advantage span when adv is null', () => {
		const { container } = render(PlayerRow, { props: { player: { ...base, adv: null } } });
		expect(container.querySelector('.adv')).toBeNull();
	});

	it('only renders the New PGN button when showNewGameButton is true', () => {
		const { queryByText } = render(PlayerRow, { props: { player: base, showNewGameButton: true } });
		expect(queryByText('New PGN')).not.toBeNull();
		cleanup();

		const { queryByText: queryByTextNoBtn } = render(PlayerRow, { props: { player: base } });
		expect(queryByTextNoBtn('New PGN')).toBeNull();
	});
});
