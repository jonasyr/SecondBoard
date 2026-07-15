### Task 8: `Board.svelte` — grid assembly, best-move arrow, slide animation

**Files:**
- Create: `src/lib/components/Board.svelte`
- Create: `src/lib/components/Board.test.ts`

**Interfaces:**
- Consumes: `buildBoardSquares` (Task 4), `BoardSquare` (Task 7), `arrowGeom` from `$lib/board/geometry` (Task 2), `diffMove` from `$lib/board/diff-move` (Task 5), `animateSlide` from `$lib/board/animate-slide` (Task 6), `TOKENS`, `NOT_BEST_CODES` from `$lib/tokens`, `ClassCode` from `$lib/types`, `Position`, `Move` from `$lib/board/types` (Task 2).
- Produces: `Board` component with props `{ position: Position; ply: number; flipped?: boolean; lastMove?: Move | null; classCode?: ClassCode | null; best?: (Move & { san: string }) | null; showCoords?: boolean }` — consumed by Task 9 (the temporary QA harness) and, in Iteration 4, the real Game Review screen.

Container sizing per the literal reference (item 9 of the extraction): `Board` renders a `100cqmin` square and **expects to be placed inside a `container-type:size` ancestor** by its consumer — this is documented as a consumption contract, not baked into `Board` itself, matching how the reference nests the board inside a flex container that establishes the query container.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/Board.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/svelte';
import { tick } from 'svelte';

const { animateSlide } = vi.hoisted(() => ({ animateSlide: vi.fn() }));
vi.mock('$lib/board/animate-slide', () => ({ animateSlide }));

import Board from './Board.svelte';
import type { Position } from '$lib/board/types';

const POS_0: Position = { e2: ['P', 'w'] };
const POS_1: Position = { e4: ['P', 'w'] };
const POS_FAR: Position = { e4: ['P', 'w'], d5: ['P', 'b'] };

beforeEach(() => {
	animateSlide.mockClear();
});

describe('Board', () => {
	it('renders exactly 64 squares', () => {
		const { container } = render(Board, { props: { position: {}, ply: 0 } });
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
	});

	it('renders unflipped by default (first square a8) and flips when flipped=true', () => {
		const { container: unflipped } = render(Board, { props: { position: {}, ply: 0 } });
		expect(unflipped.querySelectorAll('[data-sq]')[0].getAttribute('data-sq')).toBe('a8');

		const { container: flipped } = render(Board, { props: { position: {}, ply: 0, flipped: true } });
		expect(flipped.querySelectorAll('[data-sq]')[0].getAttribute('data-sq')).toBe('h1');
	});

	it('renders the classification badge on the last move\'s destination square', () => {
		const { container } = render(Board, {
			props: { position: POS_1, ply: 1, lastMove: { from: 'e2', to: 'e4' }, classCode: 'best' }
		});
		const dest = container.querySelector('[data-sq="e4"]')!;
		expect(dest.querySelector('.badge')).not.toBeNull();
	});

	it('renders the best-move arrow only when the classification is a NOT_BEST code and a best move is given', () => {
		const { container: withArrow } = render(Board, {
			props: {
				position: POS_1,
				ply: 1,
				lastMove: { from: 'e2', to: 'e4' },
				classCode: 'mistake',
				best: { from: 'g8', to: 'f6', san: 'Nf6' }
			}
		});
		expect(withArrow.querySelector('svg.arrow-overlay')).not.toBeNull();

		const { container: noArrowBestMove } = render(Board, {
			props: {
				position: POS_1,
				ply: 1,
				lastMove: { from: 'e2', to: 'e4' },
				classCode: 'best',
				best: null
			}
		});
		expect(noArrowBestMove.querySelector('svg.arrow-overlay')).toBeNull();

		const { container: noArrowGoodClass } = render(Board, {
			props: {
				position: POS_1,
				ply: 1,
				lastMove: { from: 'e2', to: 'e4' },
				classCode: 'excellent',
				best: { from: 'g8', to: 'f6', san: 'Nf6' }
			}
		});
		expect(noArrowGoodClass.querySelector('svg.arrow-overlay')).toBeNull();
	});

	it('triggers the slide animation on a single-step ply change with the same flip state', async () => {
		const { rerender } = render(Board, { props: { position: POS_0, ply: 0, flipped: false } });
		await rerender({ position: POS_1, ply: 1, flipped: false });
		await tick();
		expect(animateSlide).toHaveBeenCalledTimes(1);
		expect(animateSlide).toHaveBeenCalledWith(expect.anything(), 'e2', 'e4');
	});

	it('does not trigger the slide animation on a multi-step ply jump', async () => {
		const { rerender } = render(Board, { props: { position: POS_0, ply: 0, flipped: false } });
		await rerender({ position: POS_FAR, ply: 5, flipped: false });
		await tick();
		expect(animateSlide).not.toHaveBeenCalled();
	});

	it('does not trigger the slide animation when flipped changes alongside a single-step ply change', async () => {
		const { rerender } = render(Board, { props: { position: POS_0, ply: 0, flipped: false } });
		await rerender({ position: POS_1, ply: 1, flipped: true });
		await tick();
		expect(animateSlide).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- --run src/lib/components/Board.test.ts`
Expected: FAIL — `Board.svelte` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/Board.svelte`:

```svelte
<script lang="ts">
	import { buildBoardSquares } from '$lib/board/build-squares';
	import { arrowGeom } from '$lib/board/geometry';
	import { diffMove } from '$lib/board/diff-move';
	import { animateSlide } from '$lib/board/animate-slide';
	import type { Move, Position } from '$lib/board/types';
	import type { ClassCode } from '$lib/types';
	import { TOKENS, NOT_BEST_CODES } from '$lib/tokens';
	import BoardSquare from './BoardSquare.svelte';

	interface Props {
		position: Position;
		/** Current half-move index; drives single-step slide-animation detection. */
		ply: number;
		flipped?: boolean;
		lastMove?: Move | null;
		classCode?: ClassCode | null;
		best?: (Move & { san: string }) | null;
		showCoords?: boolean;
	}

	let {
		position,
		ply,
		flipped = false,
		lastMove = null,
		classCode = null,
		best = null,
		showCoords = true
	}: Props = $props();

	let boardEl: HTMLDivElement | undefined = $state();

	const highlightColor = $derived(
		classCode ? TOKENS.classification[classCode].color : TOKENS.color.accentGreen
	);

	const squares = $derived(
		buildBoardSquares(position, {
			flipped,
			lastSquares: lastMove ? [lastMove.from, lastMove.to] : null,
			brilliantSquare: classCode === 'brilliant' && lastMove ? lastMove.to : null,
			badge:
				lastMove && classCode
					? {
							square: lastMove.to,
							glyph: TOKENS.classification[classCode].glyph,
							color: TOKENS.classification[classCode].color
						}
					: null
		})
	);

	const showArrow = $derived(!!best && !!classCode && NOT_BEST_CODES.includes(classCode));
	const arrow = $derived(showArrow && best ? arrowGeom(best.from, best.to, 11, flipped) : null);

	// Single-step slide-animation trigger, ported from the reference's
	// componentDidUpdate guards (LOGIC.md §2.4): only animate when |Δply|===1
	// and the flip state hasn't changed between renders.
	let lastPly = ply;
	let lastPosition = position;
	let lastFlipped = flipped;

	$effect(() => {
		const curPly = ply;
		const curPosition = position;
		const curFlipped = flipped;

		if (Math.abs(curPly - lastPly) === 1 && curFlipped === lastFlipped && boardEl) {
			const move = diffMove(lastPosition, curPosition);
			if (move) animateSlide(boardEl, move.from, move.to);
		}

		lastPly = curPly;
		lastPosition = curPosition;
		lastFlipped = curFlipped;
	});
</script>

<div class="board-frame">
	<div class="board-grid" bind:this={boardEl} data-sb-board="1">
		{#each squares as square (square.id)}
			<BoardSquare {square} lastMoveColor={highlightColor} {showCoords} />
		{/each}
	</div>
	{#if arrow}
		<svg class="arrow-overlay" viewBox="0 0 600 600" preserveAspectRatio="none">
			<path
				d={arrow.shaft}
				fill="none"
				stroke="#4ADEA0"
				stroke-width="11"
				stroke-linecap="round"
				stroke-linejoin="round"
				opacity="0.82"
			/>
			<polygon points={arrow.head} fill="#4ADEA0" opacity="0.82" />
		</svg>
	{/if}
</div>

<style>
	/*
	 * Expects to be placed inside a `container-type: size` ancestor sized to
	 * the available board area — the literal reference nests the board in a
	 * flex container that establishes the query container (README §6.3).
	 */
	.board-frame {
		position: relative;
		width: 100cqmin;
		height: 100cqmin;
		border-radius: var(--radius-board);
		overflow: hidden;
		box-shadow: var(--shadow-board);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.board-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		grid-template-rows: repeat(8, 1fr);
		width: 100%;
		height: 100%;
	}
	.arrow-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- --run src/lib/components/Board.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Update the board module's barrel export**

Replace the full contents of `src/lib/board/index.ts` (currently the Iteration-1 placeholder `export {};`):

```ts
export * from './types';
export * from './geometry';
export * from './pieces';
export * from './build-squares';
export * from './diff-move';
export * from './animate-slide';
```

- [ ] **Step 6: Run the full test suite**

Run: `npm run test -- --run`
Expected: all tests pass, including all prior iterations' tests.

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/Board.svelte src/lib/components/Board.test.ts src/lib/board/index.ts
git commit -m "feat: add Board component with grid, best-move arrow, and slide animation"
```

---

