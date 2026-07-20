import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

vi.mock('$lib/board/pieces', () => ({
	PIECE_SPRITES: {
		wN: 'test-white-knight.svg',
		bP: 'test-black-pawn.svg'
	}
}));

import BoardSquare from './BoardSquare.svelte';
import type { BoardSquareVM } from '$lib/board/build-squares';

function hexToRgbPrefix(hex6: string): string {
	const n = parseInt(hex6.slice(1), 16);
	// Match only the numeric triplet, not the "rgb(" vs "rgba(" function name,
	// since jsdom renders 3-channel colors as rgb() but colors with an alpha
	// suffix (e.g. the last-move overlay's `${color}52`) as rgba().
	return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

const baseSquare: BoardSquareVM = {
	id: 'e4',
	file: 4,
	rank: 4,
	isDark: false,
	piece: null,
	isLast: false,
	isBrilliant: false,
	hasBadge: false,
	badgeGlyph: '',
	badgeColor: '',
	badgeIcon: '',
	badgeLabel: '',
	rankLabel: '',
	fileLabel: ''
};

describe('BoardSquare', () => {
	it('sets data-sq to the square id and the light/dark class from isDark', () => {
		const { container } = render(BoardSquare, {
			props: { square: baseSquare, lastMoveColor: '#4ADEA0', showCoords: true }
		});
		const el = container.querySelector('[data-sq="e4"]')!;
		expect(el.classList.contains('light')).toBe(true);
		expect(el.classList.contains('dark')).toBe(false);
	});

	it('renders a piece span with the correct sprite background-image and white drop-shadow', () => {
		const { container } = render(BoardSquare, {
			props: {
				square: { ...baseSquare, piece: ['N', 'w'] },
				lastMoveColor: '#4ADEA0',
				showCoords: true
			}
		});
		const piece = container.querySelector('.piece') as HTMLElement;
		expect(piece.classList.contains('piece-white')).toBe(true);
		expect(piece.getAttribute('style')).toContain('test-white-knight.svg');
	});

	it('renders the black double drop-shadow class for a black piece', () => {
		const { container } = render(BoardSquare, {
			props: {
				square: { ...baseSquare, piece: ['P', 'b'] },
				lastMoveColor: '#4ADEA0',
				showCoords: true
			}
		});
		const piece = container.querySelector('.piece') as HTMLElement;
		expect(piece.classList.contains('piece-black')).toBe(true);
	});

	it('renders no piece span when the square is empty', () => {
		const { container } = render(BoardSquare, {
			props: { square: baseSquare, lastMoveColor: '#4ADEA0', showCoords: true }
		});
		expect(container.querySelector('.piece')).toBeNull();
	});

	it('renders the last-move overlay tinted with lastMoveColor only when isLast', () => {
		const { container: withLast } = render(BoardSquare, {
			props: { square: { ...baseSquare, isLast: true }, lastMoveColor: '#F97A45', showCoords: true }
		});
		const overlay = withLast.querySelector('.last-move-overlay') as HTMLElement;
		expect(overlay).not.toBeNull();
		expect(overlay.getAttribute('style')).toContain(hexToRgbPrefix('#F97A45'));

		const { container: withoutLast } = render(BoardSquare, {
			props: { square: baseSquare, lastMoveColor: '#F97A45', showCoords: true }
		});
		expect(withoutLast.querySelector('.last-move-overlay')).toBeNull();
	});

	it('renders the brilliant pulsing ring only when isBrilliant', () => {
		const { container } = render(BoardSquare, {
			props: {
				square: { ...baseSquare, isBrilliant: true },
				lastMoveColor: '#4ADEA0',
				showCoords: true
			}
		});
		expect(container.querySelector('.brilliant-ring')).not.toBeNull();
	});

	it('renders the official 36px classification icon when hasBadge', async () => {
		const { container } = render(BoardSquare, {
			props: {
				square: {
					...baseSquare,
					hasBadge: true,
					badgeGlyph: '★',
					badgeColor: '#96bc4b',
					badgeIcon: '/best.svg',
					badgeLabel: 'Best'
				},
				lastMoveColor: '#96bc4b',
				showCoords: true
			}
		});
		const icon = container.querySelector('.badge img') as HTMLImageElement;
		expect(icon).not.toBeNull();
		expect(icon.getAttribute('src')).toBe('/best.svg');
		expect(icon.getAttribute('alt')).toBe('Best');
		await fireEvent.error(icon);
		expect(container.querySelector('.badge-fallback')?.textContent).toBe('★');
	});

	it('renders rank/file labels only when non-empty and showCoords is true', () => {
		const { container, getByText } = render(BoardSquare, {
			props: {
				square: { ...baseSquare, rankLabel: '4', fileLabel: 'e' },
				lastMoveColor: '#4ADEA0',
				showCoords: true
			}
		});
		expect(getByText('4')).toBeTruthy();
		expect(getByText('e')).toBeTruthy();

		const { container: hidden } = render(BoardSquare, {
			props: {
				square: { ...baseSquare, rankLabel: '4', fileLabel: 'e' },
				lastMoveColor: '#4ADEA0',
				showCoords: false
			}
		});
		expect(hidden.querySelector('.rank-label')).toBeNull();
		expect(hidden.querySelector('.file-label')).toBeNull();
		expect(container.querySelectorAll('.rank-label, .file-label')).toHaveLength(2);
	});
});
