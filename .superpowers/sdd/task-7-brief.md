## Task 7: `EvalGraph.svelte`

**Files:**
- Create: `src/lib/components/EvalGraph.svelte`
- Test: `src/lib/components/EvalGraph.test.ts`

**Interfaces:**
- Consumes: `evalGraph` from `$lib/charts/eval-graph`; `TOKENS.review` for colors.
- Props:
  ```ts
  interface Props {
  	evalPerPly: number[];
  	classCodes: import('$lib/types').ClassCode[];
  	ply: number;
  	height: number; // 66 (Review tab) or 62 (bottom bar) — viewBox stays 0 0 660 78
  }
  ```

Reference markup: lines 236-244 (Review tab) and 375-383 (bottom bar) — identical SVG content, only `height="66"` vs `height="62"` differs, plus a `border-radius` of 8px vs 6px on the `<svg>` itself (not the viewBox). Cross-check: line 236 has `border-radius:8px` in its `style`, line 375's wrapping `<div style="padding:8px 12px 2px;">` plus the svg itself doesn't repeat a radius in the excerpt — re ‑read the literal `<svg ... style="display:block;border-radius:6px;">` in that block (already captured in the read output above) confirms **6px** for the bottom-bar instance. Pass `borderRadius` as a second prop paired with `height`, or derive it inside the component as `height === 66 ? 8 : 6` (simpler — no separate caller-supplied prop needed since the two heights map 1:1 to the two radii in the reference).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/EvalGraph.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EvalGraph from './EvalGraph.svelte';
import type { ClassCode } from '$lib/types';

describe('EvalGraph', () => {
	it('renders an svg with viewBox 0 0 660 78 at the requested height', () => {
		const { container } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 66 }
		});
		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('viewBox')).toBe('0 0 660 78');
		expect(svg.getAttribute('height')).toBe('66');
	});

	it('uses an 8px radius at height 66 and 6px at height 62', () => {
		const { container: tall } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 66 }
		});
		expect(tall.querySelector('svg')!.getAttribute('style')).toContain('border-radius:8px');

		const { container: short } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 62 }
		});
		expect(short.querySelector('svg')!.getAttribute('style')).toContain('border-radius:6px');
	});

	it('renders one dot per notable classification and a current-ply marker circle', () => {
		const { container } = render(EvalGraph, {
			props: {
				evalPerPly: [0, 0.3, 0.2, 0.3],
				classCodes: ['book', 'brilliant', 'good'] as ClassCode[],
				ply: 2,
				height: 66
			}
		});
		const circles = container.querySelectorAll('circle');
		// 1 notable dot + 1 marker circle
		expect(circles).toHaveLength(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/EvalGraph.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/EvalGraph.svelte`**

```svelte
<script lang="ts">
	import { evalGraph } from '$lib/charts/eval-graph';
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		evalPerPly: number[];
		classCodes: ClassCode[];
		ply: number;
		height: 66 | 62;
	}

	let { evalPerPly, classCodes, ply, height }: Props = $props();

	const g = $derived(evalGraph(evalPerPly, classCodes, ply));
	const radius = $derived(height === 66 ? 8 : 6);
</script>

<svg
	width="100%"
	{height}
	viewBox="0 0 660 78"
	preserveAspectRatio="none"
	style={`display:block;border-radius:${radius}px;`}
>
	<rect x="0" y="0" width="660" height="78" fill={TOKENS.review.evalGraphBg} />
	<path d={g.evalArea} fill={TOKENS.review.evalGraphArea} />
	<line
		x1="0"
		y1="39"
		x2="660"
		y2="39"
		stroke={TOKENS.review.evalGraphMidline}
		stroke-width="1"
		stroke-dasharray="3 4"
		opacity="0.45"
	/>
	<path d={g.evalLine} fill="none" stroke={TOKENS.review.evalGraphLine} stroke-width="1" opacity="0.5" />
	<line
		x1={g.markerX}
		y1="0"
		x2={g.markerX}
		y2="78"
		stroke={TOKENS.review.evalGraphMidline}
		stroke-width="1.6"
		opacity="0.9"
	/>
	{#each g.evalDots as dot, i (i)}
		<circle cx={dot.cx} cy={dot.cy} r="3.6" fill={dot.color} stroke={TOKENS.review.evalGraphBg} stroke-width="1.4" />
	{/each}
	<circle
		cx={g.markerCX}
		cy={g.markerCY}
		r="4.5"
		fill={TOKENS.review.evalGraphMidline}
		stroke={TOKENS.color.deepInsetBg}
		stroke-width="2"
	/>
</svg>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/EvalGraph.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EvalGraph.svelte src/lib/components/EvalGraph.test.ts
git commit -m "feat: add EvalGraph component"
```

---

