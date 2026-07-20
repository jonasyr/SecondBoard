## Task 5: `AccuracyBlock.svelte` — render real winner + accuracy

**Files:**
- Modify: `src/lib/components/AccuracyBlock.svelte`
- Modify: `src/lib/components/AccuracyBlock.test.ts`

**Interfaces:**
- Consumes: `AccuracySide`/`AccuracySummary` shape from Task 4 (`{ name, initial, accuracy, isWinner }` per side, `resultLabel: string`), passed in as props by Task 6.
- Produces: same visual chip/avatar/result layout, now data-driven; `Game Rating` row is intentionally left as-is (still reads mock `PLAYERS.white/black.gameRating` — out of scope per this plan's Global Constraints).

- [ ] **Step 1: Write the failing test**

Replace `src/lib/components/AccuracyBlock.test.ts` entirely:

```typescript
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/AccuracyBlock.test.ts`
Expected: FAIL — component still renders the hardcoded `PLAYERS`/`0–1` mock, none of the new props are read, `getByText('Donald Byrne')` etc. throw not-found.

- [ ] **Step 3: Rewrite `AccuracyBlock.svelte`**

```svelte
<script lang="ts">
	import { PLAYERS } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import type { AccuracySide } from '$lib/game/review';

	interface Props {
		white: AccuracySide;
		black: AccuracySide;
		resultLabel: string;
	}

	let { white, black, resultLabel }: Props = $props();
</script>

<div class="accuracy-grid">
	<div class="col">
		<span class="name">{white.name}</span>
		<div
			class="avatar"
			class:neutral={!white.isWinner}
			class:tinted={white.isWinner}
			style={`background:${TOKENS.review.avatarWhiteBg};`}
		>
			{white.initial}
		</div>
		<div class="chip sbmono" class:neutral={!white.isWinner} class:tinted={white.isWinner}>
			{white.accuracy ?? '—'}
		</div>
		<span class="label">ACCURACY</span>
	</div>
	<span class="result sbmono">{resultLabel}</span>
	<div class="col">
		<span class="name">{black.name}</span>
		<div
			class="avatar"
			class:neutral={!black.isWinner}
			class:tinted={black.isWinner}
			style={`background:${TOKENS.review.avatarBlackBg};`}
		>
			{black.initial}
		</div>
		<div class="chip sbmono" class:neutral={!black.isWinner} class:tinted={black.isWinner}>
			{black.accuracy ?? '—'}
		</div>
		<span class="label">ACCURACY</span>
	</div>
</div>

<div class="rating-row">
	<div>
		<div class="rating-title">Game Rating</div>
		<div class="rating-subtitle">Est. performance</div>
	</div>
	<div class="rating-col"><div class="chip neutral sbmono wide">{PLAYERS.white.gameRating}</div></div>
	<span></span>
	<div class="rating-col"><div class="chip tinted sbmono wide">{PLAYERS.black.gameRating}</div></div>
</div>

<style>
	.accuracy-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		column-gap: 10px;
		margin-bottom: 16px;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.name {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-text-primary-alt);
	}
	.avatar {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-inset);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 19px;
	}
	.avatar.neutral {
		color: var(--color-card-bg);
		border: 2px solid rgba(255, 255, 255, 0.12);
	}
	.avatar.tinted {
		color: var(--color-text-secondary);
		border: 2px solid var(--color-accent-green);
		box-shadow: 0 0 0 3px rgba(74, 222, 160, 0.16);
	}
	.chip {
		width: 100%;
		text-align: center;
		font-size: 16px;
		font-weight: 600;
		border-radius: 8px;
		padding: 5px 0;
	}
	.chip.neutral {
		color: var(--color-text-primary-alt);
		background: #181a24;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.chip.tinted {
		color: var(--color-light-green-1);
		background: rgba(74, 222, 160, 0.06);
		border: 1px solid rgba(74, 222, 160, 0.4);
	}
	.chip.wide {
		width: auto;
		min-width: 72px;
	}
	.label {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		letter-spacing: 0.03em;
	}
	.result {
		font-size: 12px;
		color: var(--color-text-tertiary);
	}
	.rating-row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 12px 0;
		border-top: 1px solid var(--color-hairline-high);
		border-bottom: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
	.rating-title {
		font-size: 12px;
		color: var(--color-text-tertiary);
		font-weight: 500;
	}
	.rating-subtitle {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		margin-top: 1px;
	}
	.rating-col {
		display: flex;
		justify-content: center;
	}
</style>
```

Note: the White avatar's background color never changes (it stays `TOKENS.review.avatarWhiteBg` regardless of who won) — only the `.tinted`/`.neutral` class (driven by `isWinner`) controls the border/glow ring, matching the original design's avatar-color-is-fixed-per-side visual. Keep `PLAYERS` imported only for the still-mock `gameRating` row.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/AccuracyBlock.test.ts`
Expected: PASS — all green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/AccuracyBlock.svelte src/lib/components/AccuracyBlock.test.ts
git commit -m "feat: wire AccuracyBlock to the real winner and accuracy summary"
```

---

