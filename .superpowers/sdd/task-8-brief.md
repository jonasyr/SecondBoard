## Task 8: `PlayerRow.svelte`

**Files:**
- Create: `src/lib/components/PlayerRow.svelte`
- Test: `src/lib/components/PlayerRow.test.ts`

**Interfaces:**
- Consumes: `PlayerRowData` type from `$lib/game/review`; `PIECE_SPRITES` from `$lib/board/pieces`; `TOKENS.review` avatar/clock tokens.
- Props:
  ```ts
  interface Props {
  	player: import('$lib/game/review').PlayerRowData;
  	showNewGameButton?: boolean; // default false; only the top row in the reference has it
  	onNewGame?: () => void;
  }
  ```

Reference: markup lines 150-162 (top row incl. New PGN button) and 196-207 (bottom row, no button) — same internal structure otherwise. Avatar/clock/captured-piece styling: lines 1245-1254 (`clk`, `whiteP.avatarStyle`, `blackP.avatarStyle`) and `capturedInfo`'s `st()` helper (line 1038 of the earlier read) for the 18px captured-sprite style.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/PlayerRow.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
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

	it('omits the advantage span when adv is null', () => {
		const { container } = render(PlayerRow, { props: { player: { ...base, adv: null } } });
		expect(container.querySelector('.adv')).toBeNull();
	});

	it('only renders the New PGN button when showNewGameButton is true', () => {
		const { queryByText } = render(PlayerRow, { props: { player: base, showNewGameButton: true } });
		expect(queryByText('New PGN')).not.toBeNull();

		const { queryByText: queryByTextNoBtn } = render(PlayerRow, { props: { player: base } });
		expect(queryByTextNoBtn('New PGN')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/PlayerRow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/PlayerRow.svelte`**

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import { PIECE_SPRITES, type PieceSpriteKey } from '$lib/board/pieces';
	import type { PlayerRowData } from '$lib/game/review';
	import Icon from './Icon.svelte';

	interface Props {
		player: PlayerRowData;
		showNewGameButton?: boolean;
		onNewGame?: () => void;
	}

	let { player, showNewGameButton = false, onNewGame }: Props = $props();

	const avatarStyle = $derived(
		player.isWhite
			? `background:${TOKENS.review.avatarWhiteBg};border:1px solid ${TOKENS.review.avatarWhiteBorder};color:${TOKENS.review.avatarWhiteText};`
			: `background:${TOKENS.review.avatarBlackBg};border:1px solid ${TOKENS.review.avatarBlackBorder};color:${TOKENS.review.avatarBlackText};`
	);
	const clockStyle = $derived(
		player.clockActive
			? `background:${TOKENS.review.clockActiveBg};color:${TOKENS.review.clockActiveText};box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);`
			: `background:${TOKENS.review.clockInactiveBg};color:${TOKENS.review.clockInactiveText};`
	);
</script>

<div class="player-row">
	<div class="avatar" style={avatarStyle}>{player.initial}</div>
	<div class="info">
		<div class="name-row">
			<span class="name">{player.name}</span>
			<span class="rating sbmono">{player.rating}</span>
		</div>
		<div class="captured-row">
			{#each player.captured as piece, i (i)}
				<span
					class="captured-piece"
					style={`background-image:url(${PIECE_SPRITES[(piece.color + piece.type) as PieceSpriteKey]});filter:${TOKENS.review.capturedSpriteShadow};`}
				></span>
			{/each}
			{#if player.adv}
				<span class="adv sbmono">{player.adv}</span>
			{/if}
		</div>
	</div>
	<div class="spacer"></div>
	{#if showNewGameButton}
		<button type="button" class="new-game" onclick={onNewGame} title="Load a different PGN">
			<Icon d="M12 5v14M5 12h14" size={13} stroke="#4ADEA0" strokeWidth={2.2} />
			New PGN
		</button>
	{/if}
	<div class="clock sbmono" style={clockStyle}>{player.clock}</div>
</div>

<style>
	.player-row {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 0 2px;
		flex: none;
	}
	.avatar {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
	}
	.info {
		flex: none;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.name {
		font-size: 15.5px;
		font-weight: 600;
	}
	.rating {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.captured-row {
		display: flex;
		align-items: center;
		gap: 1px;
		margin-top: 4px;
		height: 20px;
	}
	.captured-piece {
		width: 18px;
		height: 18px;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}
	.adv {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-light-green-1);
		margin-left: 5px;
	}
	.spacer {
		flex: 1;
	}
	.new-game {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		margin-right: 10px;
		border-radius: var(--radius-control);
		background: var(--review-new-game-bg, #181a24);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #c7ccda;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.clock {
		font-size: 18px;
		font-weight: 600;
		padding: 5px 12px;
		border-radius: var(--radius-control);
	}
</style>
```

(`var(--review-new-game-bg, #181a24)` — no root CSS var exists for this yet since it's a one-off; the fallback literal `#181a24` matches `TOKENS.review.newGameBg` exactly. Simplify by just using the literal `background: #181a24;` in the `<style>` block directly instead of a fake CSS var — remove the `var(...)` wrapper.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/PlayerRow.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PlayerRow.svelte src/lib/components/PlayerRow.test.ts
git commit -m "feat: add PlayerRow component"
```

---

