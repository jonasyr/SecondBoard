## Task 1: Extend design tokens + port eval-graph math

**Files:**
- Modify: `src/lib/tokens.ts`
- Modify: `src/app.css` (no changes expected — tokens.ts already mirrors into CSS custom properties only for the root `:root` block; the new `TOKENS.review.*` values are consumed directly as JS style strings by components, not as CSS vars, matching how `TOKENS.classification` is already consumed in `Board.svelte`/`BoardSquare.svelte`. Skip if no CSS var is needed — confirm by grepping `app.css` for `--color-window-dot` pattern usage first.)
- Create: `src/lib/charts/eval-graph.ts`
- Test: `src/lib/charts/eval-graph.test.ts`

**Interfaces:**
- Produces: `TOKENS.review` object (see Table B above) — a `Record<string,string>`-shaped const, plus `TOKENS.review.moveTint: Record<ClassCode, string>`.
- Produces: `evalGraph(evalPerPly: number[], classCodes: ClassCode[], ply: number): EvalGraphResult` where
  ```ts
  export interface EvalGraphDot { cx: number; cy: number; color: string }
  export interface EvalGraphResult {
    evalLine: string;
    evalArea: string;
    evalDots: EvalGraphDot[];
    markerX: number;
    markerCX: number;
    markerCY: number;
  }
  ```

- [ ] **Step 1: Add `TOKENS.review` to `src/lib/tokens.ts`**

Add this block inside the `TOKENS` object (after `classification`, before the closing `} as const;`), importing nothing new:

```ts
	review: {
		avatarWhiteBg: '#EDEFF6',
		avatarWhiteBorder: 'rgba(255,255,255,.15)',
		avatarWhiteText: '#14161F',
		avatarBlackBg: 'linear-gradient(135deg,#3B4252,#20222E)',
		avatarBlackBorder: 'rgba(255,255,255,.1)',
		avatarBlackText: '#C7CCDA',
		clockActiveBg: 'rgba(45,224,206,.12)',
		clockActiveText: '#5EF0DE',
		clockInactiveBg: '#14161F',
		clockInactiveText: '#6B7180',
		newGameBg: '#181A24',
		newGameBorder: 'rgba(255,255,255,.08)',
		newGameText: '#C7CCDA',
		evalGraphBg: '#20222E',
		evalGraphArea: '#EFF1F6',
		evalGraphMidline: '#2DE0CE',
		evalGraphLine: '#8A90A0',
		chipNeutralBg: '#181A24',
		chipNeutralBorder: 'rgba(255,255,255,.1)',
		chipNeutralText: '#E3E6EE',
		chipTintedBg: 'rgba(74,222,160,.06)',
		chipTintedBorder: 'rgba(74,222,160,.4)',
		chipTintedText: '#8FE9C2',
		capturedSpriteShadow: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.5))',
		navBtnBg: '#14161F',
		navBtnBorder: 'rgba(255,255,255,.07)',
		navBtnStroke: '#9298A8',
		moveTint: {
			brilliant: '#5EF0DE',
			great: '#8FC0FF',
			best: '#C7CCDA',
			excellent: '#C7CCDA',
			good: '#C7CCDA',
			book: '#C7B79E',
			inaccuracy: '#F5B14C',
			mistake: '#F97A45',
			miss: '#C77DFF',
			blunder: '#F26B6B'
		} satisfies Record<ClassCode, string>
	}
```

- [ ] **Step 2: Write the failing test for `evalGraph`**

```ts
// src/lib/charts/eval-graph.test.ts
import { describe, it, expect } from 'vitest';
import { evalGraph } from './eval-graph';
import type { ClassCode } from '$lib/types';

describe('evalGraph', () => {
	it('maps eval values to the 660x78 viewBox with a midline of 39', () => {
		const ev = [0, 0.3];
		const codes: ClassCode[] = ['best'];
		const result = evalGraph(ev, codes, 1);
		expect(result.evalLine).toBe('M0.0 39.0 L660.0 36.9');
		expect(result.evalArea).toBe('M0.0 39.0 L660.0 36.9 L660 78 L0 78 Z');
		expect(result.markerX).toBe(660);
		expect(result.markerCX).toBe(660);
		expect(result.markerCY).toBe(36.9);
	});

	it('clamps eval values to +/-5 before mapping to y', () => {
		const ev = [0, 12];
		const result = evalGraph(ev, ['best'], 1);
		expect(result.evalLine).toBe('M0.0 39.0 L660.0 5.0');
	});

	it('emits a dot only for notable classification codes, colored by TOKENS.classification', () => {
		const ev = [0, 0.3, 0.2, 0.3];
		const codes: ClassCode[] = ['book', 'brilliant', 'good'];
		const result = evalGraph(ev, codes, 0);
		expect(result.evalDots).toHaveLength(1);
		expect(result.evalDots[0]).toEqual({ cx: 220, cy: 36.9, color: '#2DE0CE' });
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- --run src/lib/charts/eval-graph.test.ts`
Expected: FAIL (module `./eval-graph` not found).

- [ ] **Step 4: Implement `src/lib/charts/eval-graph.ts`**

```ts
/**
 * Eval-graph geometry, ported verbatim from
 * design_handoff_secondboard/reference/logic/view-math.js's evalGraph()
 * (marked there as "NOT MOCKS — reusable as-is"; see LOGIC.md §3.1).
 * viewBox is always 0 0 660 78; the caller renders it at two different
 * SVG heights (66px in the Review tab, 62px in the shared bottom bar) —
 * that's purely a CSS/attribute concern on the <svg>, not this math.
 */
import { TOKENS } from '$lib/tokens';
import type { ClassCode } from '$lib/types';

export interface EvalGraphDot {
	cx: number;
	cy: number;
	color: string;
}

export interface EvalGraphResult {
	evalLine: string;
	evalArea: string;
	evalDots: EvalGraphDot[];
	markerX: number;
	markerCX: number;
	markerCY: number;
}

const NOTABLE_CODES = new Set<ClassCode>([
	'brilliant',
	'great',
	'excellent',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
]);

const W = 660;
const H = 78;
const MID = 39;

export function evalGraph(
	evalPerPly: number[],
	classCodes: ClassCode[],
	ply: number
): EvalGraphResult {
	const xOf = (i: number) => Number(((i / (evalPerPly.length - 1)) * W).toFixed(1));
	const yOf = (v: number) => Number((MID - (Math.max(-5, Math.min(5, v)) / 5) * 34).toFixed(1));

	const line = evalPerPly.map((v, i) => (i ? 'L' : 'M') + xOf(i) + ' ' + yOf(v)).join(' ');
	const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';

	const dots: EvalGraphDot[] = [];
	for (let i = 1; i < evalPerPly.length; i++) {
		const code = classCodes[i - 1];
		if (NOTABLE_CODES.has(code)) {
			dots.push({ cx: xOf(i), cy: yOf(evalPerPly[i]), color: TOKENS.classification[code].color });
		}
	}

	return {
		evalLine: line,
		evalArea: area,
		evalDots: dots,
		markerX: xOf(ply),
		markerCX: xOf(ply),
		markerCY: yOf(evalPerPly[ply])
	};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run src/lib/charts/eval-graph.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokens.ts src/lib/charts/eval-graph.ts src/lib/charts/eval-graph.test.ts
git commit -m "feat: add review-screen design tokens and eval-graph geometry"
```

---

