import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AccuracyBlock from './AccuracyBlock.svelte';

const white = { name: 'Donald Byrne', initial: 'D', accuracy: '82.6', isWinner: false };
const black = { name: 'Robert Fischer', initial: 'R', accuracy: '89.1', isWinner: true };

describe('AccuracyBlock', () => {
	it('renders both players\' real names, accuracy, and the real result label', () => {
		const { getByText } = render(AccuracyBlock, {
			props: { white, black, resultLabel: '0–1' }
		});
		expect(getByText('Donald Byrne')).toBeTruthy();
		expect(getByText('Robert Fischer')).toBeTruthy();
		expect(getByText('82.6')).toBeTruthy();
		expect(getByText('89.1')).toBeTruthy();
		expect(getByText('0–1')).toBeTruthy();
	});

	it('renders "—" instead of a fabricated number when accuracy is null', () => {
		const { getAllByText } = render(AccuracyBlock, {
			props: {
				white: { ...white, accuracy: null },
				black: { ...black, accuracy: null },
				resultLabel: '—'
			}
		});
		expect(getAllByText('—')).toHaveLength(3); // white chip + black chip + result
	});

	it('highlights the real winner\'s avatar/chip, not always Black', () => {
		const { container } = render(AccuracyBlock, {
			props: { white: { ...white, isWinner: true }, black: { ...black, isWinner: false }, resultLabel: '1-0' }
		});
		const cols = container.querySelectorAll('.col');
		expect(cols[0].querySelector('.avatar')?.classList.contains('tinted')).toBe(true);
		expect(cols[1].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
	});

	it('tints neither side on a draw', () => {
		const { container } = render(AccuracyBlock, {
			props: { white, black: { ...black, isWinner: false }, resultLabel: '½–½' }
		});
		const cols = container.querySelectorAll('.col');
		expect(cols[0].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
		expect(cols[1].querySelector('.avatar')?.classList.contains('tinted')).toBe(false);
	});
});
