import { describe, it, expect, vi, afterEach } from 'vitest';
import { animateSlide } from './animate-slide';

function makeBoard(): HTMLDivElement {
	const board = document.createElement('div');
	board.innerHTML = `
		<div data-sq="e2"><span class="piece" style="background-image:url(pawn.svg)"></span></div>
		<div data-sq="e4"><span class="piece" style="background-image:url(pawn.svg)"></span></div>
	`;
	document.body.appendChild(board);
	return board;
}

function mockRect(el: Element, rect: Partial<DOMRect>) {
	vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		width: 75,
		height: 75,
		x: 0,
		y: 0,
		toJSON: () => ({}),
		...rect
	} as DOMRect);
}

afterEach(() => {
	document.body.innerHTML = '';
	vi.restoreAllMocks();
	vi.useRealTimers();
});

describe('animateSlide', () => {
	it('clones the destination piece, hides the original, and positions the clone over the from-square', () => {
		const board = makeBoard();
		mockRect(board, { left: 0, top: 0 });
		mockRect(board.querySelector('[data-sq="e2"]')!, { left: 0, top: 300 });
		mockRect(board.querySelector('[data-sq="e4"]')!, { left: 0, top: 0 });

		animateSlide(board, 'e2', 'e4');

		const clone = board.querySelector('[data-sb-clone="1"]') as HTMLElement;
		expect(clone).not.toBeNull();
		expect(clone.style.position).toBe('absolute');
		expect(clone.style.left).toBe('0px');
		expect(clone.style.top).toBe('300px');

		const originalLanding = board.querySelector('[data-sq="e4"] .piece') as HTMLElement;
		expect(originalLanding.style.visibility).toBe('hidden');
	});

	it('transitions the clone transform to the from->to delta', () => {
		const board = makeBoard();
		mockRect(board, { left: 0, top: 0 });
		mockRect(board.querySelector('[data-sq="e2"]')!, { left: 0, top: 300 });
		mockRect(board.querySelector('[data-sq="e4"]')!, { left: 0, top: 0 });

		animateSlide(board, 'e2', 'e4');
		const clone = board.querySelector('[data-sb-clone="1"]') as HTMLElement;
		expect(clone.style.transform).toBe('translate(0px,-300px)');
		expect(clone.style.transition).toBe('transform .17s cubic-bezier(.33,.9,.35,1)');
	});

	it('removes the clone and restores visibility after the 300ms safety timeout', () => {
		vi.useFakeTimers();
		const board = makeBoard();
		mockRect(board, { left: 0, top: 0 });
		mockRect(board.querySelector('[data-sq="e2"]')!, { left: 0, top: 300 });
		mockRect(board.querySelector('[data-sq="e4"]')!, { left: 0, top: 0 });

		animateSlide(board, 'e2', 'e4');
		vi.advanceTimersByTime(300);

		expect(board.querySelector('[data-sb-clone="1"]')).toBeNull();
		const originalLanding = board.querySelector('[data-sq="e4"] .piece') as HTMLElement;
		expect(originalLanding.style.visibility).toBe('');
	});

	it('is a no-op when from and to are the same square', () => {
		const board = makeBoard();
		animateSlide(board, 'e4', 'e4');
		expect(board.querySelector('[data-sb-clone="1"]')).toBeNull();
	});

	it('clears any stale clone and visibility from a previous animation before starting', () => {
		const board = makeBoard();
		const stale = document.createElement('span');
		stale.setAttribute('data-sb-clone', '1');
		board.appendChild(stale);
		const landing = board.querySelector('[data-sq="e4"] .piece') as HTMLElement;
		landing.style.visibility = 'hidden';

		mockRect(board, { left: 0, top: 0 });
		mockRect(board.querySelector('[data-sq="e2"]')!, { left: 0, top: 300 });
		mockRect(board.querySelector('[data-sq="e4"]')!, { left: 0, top: 0 });

		animateSlide(board, 'e2', 'e4');

		expect(board.contains(stale)).toBe(false);
	});
});
