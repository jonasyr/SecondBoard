## Task 6: `EvalBar.svelte`

**Files:**
- Create: `src/lib/components/EvalBar.svelte`
- Test: `src/lib/components/EvalBar.test.ts`

**Interfaces:**
- Consumes: nothing beyond props (pure presentational; the caller passes precomputed numbers so this component has no dependency on `$lib/game`).
- Props:
  ```ts
  interface Props {
  	whitePct: number; // 0-100, White's fill share
  	evalNum: number; // signed eval, for the label + label-position/color logic
  	whiteAtBottom: boolean; // !flipped
  }
  ```

Reference: markup lines 166-170, computed styles lines 1308-1310 (`evalBarLabelStyle`, `barFillStyle`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/EvalBar.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EvalBar from './EvalBar.svelte';

describe('EvalBar', () => {
	it('renders the fill height from whitePct and grows from the bottom when White is at the bottom', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		const fill = container.querySelector('.fill') as HTMLElement;
		expect(fill.getAttribute('style')).toContain('height: 62.5%');
		expect(fill.getAttribute('style')).toContain('bottom: 0px');
	});

	it('grows from the top when flipped (White not at the bottom)', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: false }
		});
		const fill = container.querySelector('.fill') as HTMLElement;
		expect(fill.getAttribute('style')).toContain('top: 0px');
	});

	it('shows the absolute eval magnitude as the label, positive or negative eval', () => {
		const { container: pos } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		expect(pos.querySelector('.label')?.textContent).toBe('2.4');

		const { container: neg } = render(EvalBar, {
			props: { whitePct: 20, evalNum: -1.5, whiteAtBottom: true }
		});
		expect(neg.querySelector('.label')?.textContent).toBe('1.5');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/EvalBar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/EvalBar.svelte`**

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';

	interface Props {
		whitePct: number;
		evalNum: number;
		whiteAtBottom: boolean;
	}

	let { whitePct, evalNum, whiteAtBottom }: Props = $props();

	const label = $derived((evalNum >= 0 ? evalNum : -evalNum).toFixed(1));
	// Reference: label sits opposite the fill's growth edge, colored for contrast against
	// whichever background (fill vs. track) it's drawn over there.
	const labelOnFilledEdge = $derived(whiteAtBottom === evalNum >= 0);
	const fillStyle = $derived(
		`position:absolute;left:0;right:0;${whiteAtBottom ? 'bottom:0;' : 'top:0;'}height:${whitePct.toFixed(1)}%;background:linear-gradient(${whiteAtBottom ? '180deg' : '0deg'},${TOKENS.board.evalWhiteFillFrom},${TOKENS.board.evalWhiteFillTo});transition:height .25s ease;`
	);
	const labelStyle = $derived(
		`position:absolute;left:0;right:0;${labelOnFilledEdge ? 'bottom:3px;color:#20222E;' : 'top:3px;color:#E3E6EE;'}text-align:center;font-size:9px;font-weight:700;`
	);
</script>

<div class="eval-bar">
	<div class="fill" style={fillStyle}></div>
	<div class="midline"></div>
	<div class="label sbmono" style={labelStyle}>{label}</div>
</div>

<style>
	.eval-bar {
		width: 20px;
		flex: none;
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		background: var(--board-eval-bar-track);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.midline {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: var(--board-eval-midline);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/EvalBar.test.ts`
Expected: PASS (3/3). (If the "bottom: 0px"/"top: 0px" assertions fail because jsdom's CSSOM normalizes `bottom:0;` to `bottom: 0px;` differently, adjust the assertion to match — jsdom quirks here are the same category the BoardSquare task hit in Iteration 3; use `getAttribute('style')` and match the normalized substring, not the literal input string.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EvalBar.svelte src/lib/components/EvalBar.test.ts
git commit -m "feat: add EvalBar component"
```

---

