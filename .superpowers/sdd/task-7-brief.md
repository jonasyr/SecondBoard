### Task 7: `BoardSquare.svelte`

**Files:**
- Create: `src/lib/components/BoardSquare.svelte`
- Create: `src/lib/components/BoardSquare.test.ts`

**Interfaces:**
- Consumes: `BoardSquareVM` from `$lib/board/build-squares` (Task 4), `PIECE_SPRITES` from `$lib/board/pieces` (Task 3).
- Produces: `BoardSquare` component with props `{ square: BoardSquareVM; lastMoveColor: string; showCoords: boolean }` — consumed by Task 8 (`Board.svelte`).

Exact values from README §4.4/§5/§6.3 and the literal extraction: square colors via existing CSS vars `--board-light-square`/`--board-dark-square`; last-move overlay `background: <color>52` (≈32% alpha); piece span 100%×100% of cell, `background-size:90%`, white `drop-shadow(0 2px 2px rgba(0,0,0,.4))`, black double drop-shadow; badge 36px circle top:4px/right:4px, `font-weight:900;font-size:19px`, `box-shadow:0 3px 9px rgba(0,0,0,.5), inset 0 0 0 2px rgba(255,255,255,.22)`; brilliant ring `inset:5px;border-radius:9px;border:2px solid rgba(45,224,206,.9);animation:bpulse 2.4s ease-in-out infinite`; coordinate labels 11px/600, positioned `top:3px;left:5px` (rank) / `bottom:3px;right:5px` (file), colored via `--board-coord-on-dark`/`--board-coord-on-light`.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/components/BoardSquare.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BoardSquare from './BoardSquare.svelte';
import type { BoardSquareVM } from '$lib/board/build-squares';

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
		expect(piece.style.backgroundImage).toContain('white_knight');
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
		expect(overlay.style.background).toContain('#F97A45');

		const { container: withoutLast } = render(BoardSquare, {
			props: { square: baseSquare, lastMoveColor: '#F97A45', showCoords: true }
		});
		expect(withoutLast.querySelector('.last-move-overlay')).toBeNull();
	});

	it('renders the brilliant pulsing ring only when isBrilliant', () => {
		const { container } = render(BoardSquare, {
			props: { square: { ...baseSquare, isBrilliant: true }, lastMoveColor: '#4ADEA0', showCoords: true }
		});
		expect(container.querySelector('.brilliant-ring')).not.toBeNull();
	});

	it('renders the 36px classification badge with its glyph and color when hasBadge', () => {
		const { container } = render(BoardSquare, {
			props: {
				square: { ...baseSquare, hasBadge: true, badgeGlyph: '★', badgeColor: '#4ADEA0' },
				lastMoveColor: '#4ADEA0',
				showCoords: true
			}
		});
		const badge = container.querySelector('.badge') as HTMLElement;
		expect(badge.textContent).toBe('★');
		expect(badge.style.background).toContain('#4ADEA0');
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- --run src/lib/components/BoardSquare.test.ts`
Expected: FAIL — `BoardSquare.svelte` does not exist.

- [ ] **Step 3: Write the implementation**

Create `src/lib/components/BoardSquare.svelte`:

```svelte
<script lang="ts">
	import type { BoardSquareVM } from '$lib/board/build-squares';
	import { PIECE_SPRITES, type PieceSpriteKey } from '$lib/board/pieces';

	interface Props {
		square: BoardSquareVM;
		lastMoveColor: string;
		showCoords: boolean;
	}

	let { square, lastMoveColor, showCoords }: Props = $props();

	const spriteKey = $derived(square.piece ? ((square.piece[1] + square.piece[0]) as PieceSpriteKey) : null);
</script>

<div class="square" class:dark={square.isDark} class:light={!square.isDark} data-sq={square.id}>
	{#if square.isLast}
		<div class="last-move-overlay" style={`background:${lastMoveColor}52;`}></div>
	{/if}
	{#if square.piece && spriteKey}
		<span
			class="piece"
			class:piece-white={square.piece[1] === 'w'}
			class:piece-black={square.piece[1] === 'b'}
			style={`background-image:url(${PIECE_SPRITES[spriteKey]});`}
		></span>
	{/if}
	{#if square.isBrilliant}
		<div class="brilliant-ring"></div>
	{/if}
	{#if showCoords && square.rankLabel}
		<span class="rank-label sbmono">{square.rankLabel}</span>
	{/if}
	{#if showCoords && square.fileLabel}
		<span class="file-label sbmono">{square.fileLabel}</span>
	{/if}
	{#if square.hasBadge}
		<div class="badge" style={`background:${square.badgeColor};`}>{square.badgeGlyph}</div>
	{/if}
</div>

<style>
	.square {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.square.light {
		background: var(--board-light-square);
	}
	.square.dark {
		background: var(--board-dark-square);
	}
	.last-move-overlay {
		position: absolute;
		inset: 0;
	}
	.piece {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
		background-size: 90%;
		background-repeat: no-repeat;
		background-position: center;
	}
	.piece-white {
		filter: drop-shadow(0 2px 2px rgba(0, 0, 0, 0.4));
	}
	.piece-black {
		filter:
			drop-shadow(0 0 1.4px rgba(255, 255, 255, 0.45)) drop-shadow(0 2px 2px rgba(0, 0, 0, 0.5));
	}
	.brilliant-ring {
		position: absolute;
		inset: 5px;
		border-radius: 9px;
		border: 2px solid rgba(45, 224, 206, 0.9);
		animation: bpulse 2.4s ease-in-out infinite;
	}
	.rank-label {
		position: absolute;
		top: 3px;
		left: 5px;
		font-size: 11px;
		font-weight: 600;
	}
	.file-label {
		position: absolute;
		bottom: 3px;
		right: 5px;
		font-size: 11px;
		font-weight: 600;
	}
	.square.dark .rank-label,
	.square.dark .file-label {
		color: var(--board-coord-on-dark);
	}
	.square.light .rank-label,
	.square.light .file-label {
		color: var(--board-coord-on-light);
	}
	.badge {
		position: absolute;
		top: 4px;
		right: 4px;
		z-index: 4;
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 900;
		font-size: 19px;
		line-height: 1;
		letter-spacing: 1.5px;
		text-indent: 1.5px;
		color: #fff;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.3);
		box-shadow:
			0 3px 9px rgba(0, 0, 0, 0.5),
			inset 0 0 0 2px rgba(255, 255, 255, 0.22);
	}
</style>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- --run src/lib/components/BoardSquare.test.ts`
Expected: PASS (8 tests — the last test file has 2 `expect` cases in one `it`, counted as 8 `it` blocks).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/BoardSquare.svelte src/lib/components/BoardSquare.test.ts
git commit -m "feat: add BoardSquare component"
```

---

