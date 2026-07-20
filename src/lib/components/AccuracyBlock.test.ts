import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AccuracyBlock from './AccuracyBlock.svelte';

const white = {
	name: 'Donald Byrne',
	initial: 'D',
	accuracy: '82.6',
	gameRating: '1860',
	isWinner: false
};
const black = {
	name: 'Robert Fischer',
	initial: 'R',
	accuracy: '89.1',
	gameRating: '2510',
	isWinner: true
};

describe('AccuracyBlock', () => {
	it('renders both players\' real names, accuracy, game rating, and the real result label', () => {
		const { getByText } = render(AccuracyBlock, {
			props: { white, black, resultLabel: '0–1' }
		});
		expect(getByText('Donald Byrne')).toBeTruthy();
		expect(getByText('Robert Fischer')).toBeTruthy();
		expect(getByText('82.6')).toBeTruthy();
		expect(getByText('89.1')).toBeTruthy();
		expect(getByText('1860')).toBeTruthy();
		expect(getByText('2510')).toBeTruthy();
		expect(getByText('0–1')).toBeTruthy();
	});

	it('renders "—" instead of a fabricated number when accuracy or gameRating is null', () => {
		const { getAllByText } = render(AccuracyBlock, {
			props: {
				white: { ...white, accuracy: null, gameRating: null },
				black: { ...black, accuracy: null, gameRating: null },
				resultLabel: '—'
			}
		});
		// white chip + black chip + white gameRating + black gameRating + result
		expect(getAllByText('—')).toHaveLength(5);
	});

	it('highlights the real winner\'s avatar/accuracy chip/game-rating chip, not always Black', () => {
		const { container } = render(AccuracyBlock, {
			props: { white: { ...white, isWinner: true }, black: { ...black, isWinner: false }, resultLabel: '1-0' }
		});
		const cols = container.querySelectorAll('.col');
		expect(cols[0].querySelector('.avatar')?.classList.contains('tinted')).toBe(true);
		expect(cols[1].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);

		const ratingChips = container.querySelectorAll('.rating-col .chip');
		expect(ratingChips[0].classList.contains('tinted')).toBe(true); // white's gameRating chip
		expect(ratingChips[1].classList.contains('tinted')).toBe(false); // black's gameRating chip
	});

	it('tints neither side\'s avatar/accuracy chip/game-rating chip on a draw', () => {
		const { container } = render(AccuracyBlock, {
			props: { white, black: { ...black, isWinner: false }, resultLabel: '½–½' }
		});
		const cols = container.querySelectorAll('.col');
		expect(cols[0].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
		expect(cols[1].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);

		const ratingChips = container.querySelectorAll('.rating-col .chip');
		expect(ratingChips[0].classList.contains('tinted')).toBe(false);
		expect(ratingChips[1].classList.contains('tinted')).toBe(false);
	});
});
