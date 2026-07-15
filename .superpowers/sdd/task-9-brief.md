## Task 9: `CoachCard.svelte`

**Files:**
- Create: `src/lib/components/CoachCard.svelte`
- Test: `src/lib/components/CoachCard.test.ts`

**Interfaces:**
- Consumes: `TOKENS.classification`, `Icon.svelte`.
- Props:
  ```ts
  interface Props {
  	classCode: import('$lib/types').ClassCode | null; // null at ply 0 -> use 'book' per reference
  	coachMove: string;
  	coachText: string;
  	evalStr: string;
  	best: (import('$lib/board/types').Move & { san: string }) | null;
  }
  ```

Reference: markup lines 304-321; computed styles lines 1325-1330 (`coachBadge`, `coachTitleStyle`, `coachEvalChip`, `coachCardBg`). Note ply-0 fallback: `selCode = ply > 0 ? classCodes[ply-1] : 'book'` — replicate by having the **caller** (Task 12/17) pass `classCode ?? 'book'`, keeping this component simple (it always receives a non-null `ClassCode`). Adjust the prop type to non-nullable `ClassCode` and push the `?? 'book'` fallback to the call site.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/CoachCard.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import CoachCard from './CoachCard.svelte';

describe('CoachCard', () => {
	it('renders the move, title word, eval, and coach text', () => {
		const { getByText } = render(CoachCard, {
			props: {
				classCode: 'brilliant',
				coachMove: '16. Ne5',
				coachText: 'This move creates a strong threat...',
				evalStr: '+2.37',
				best: null
			}
		});
		expect(getByText('16. Ne5')).toBeTruthy();
		expect(getByText('is', { exact: false })).toBeTruthy();
		expect(getByText('+2.37')).toBeTruthy();
	});

	it('shows the "Best was" strip only when best is provided', () => {
		const { queryByText } = render(CoachCard, {
			props: {
				classCode: 'inaccuracy',
				coachMove: '15. d5',
				coachText: 'A small slip...',
				evalStr: '+1.05',
				best: { from: 'c8', to: 'g4', san: 'Bg4' }
			}
		});
		expect(queryByText('Bg4')).not.toBeNull();
		expect(queryByText('Best was')).not.toBeNull();

		const { queryByText: q2 } = render(CoachCard, {
			props: {
				classCode: 'best',
				coachMove: '16. Ne5',
				coachText: "Engine's top choice.",
				evalStr: '+2.37',
				best: null
			}
		});
		expect(q2('Best was')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/CoachCard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/CoachCard.svelte`**

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';
	import type { Move } from '$lib/board/types';
	import Icon from './Icon.svelte';

	interface Props {
		classCode: ClassCode;
		coachMove: string;
		coachText: string;
		evalStr: string;
		best: (Move & { san: string }) | null;
	}

	let { classCode, coachMove, coachText, evalStr, best }: Props = $props();

	const cls = $derived(TOKENS.classification[classCode]);
	const cardStyle = $derived(
		`background:radial-gradient(120% 130% at 12% 0%,${cls.color}1f,transparent 55%),${TOKENS.color.cardBg};border:1px solid ${cls.color}44;`
	);
	const badgeStyle = $derived(
		`background:${cls.color}22;color:${cls.color};`
	);
	const evalChipStyle = $derived(`background:${cls.color}1a;color:${cls.color};`);
</script>

<div class="coach-card" style={cardStyle}>
	<div class="row">
		<div class="badge" style={badgeStyle}>{cls.glyph}</div>
		<div class="body">
			<div class="title">
				<span class="move sbmono">{coachMove}</span>
				<span class="word" style={`color:${cls.color};`}>is {cls.word}</span>
				<span class="fill"></span>
				<span class="eval-chip" style={evalChipStyle}>{evalStr}</span>
			</div>
			<p class="text">{coachText}</p>
		</div>
	</div>
	{#if best}
		<div class="best-strip">
			<Icon d="M5 12h13M12 5l7 7-7 7" size={14} stroke="#4ADEA0" strokeWidth={2} />
			<span class="label">Best was</span>
			<span class="san sbmono">{best.san}</span>
		</div>
	{/if}
</div>

<style>
	.coach-card {
		border-radius: 13px;
		padding: 12px 14px;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.badge {
		width: 38px;
		height: 38px;
		flex: none;
		border-radius: var(--radius-inset, 10px);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 16px;
		letter-spacing: -1px;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
	}
	.move {
		color: var(--color-text-primary-alt);
	}
	.fill {
		flex: 1;
	}
	.eval-chip {
		font-size: 12px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 7px;
	}
	.text {
		margin: 5px 0 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-secondary-alt);
	}
	.best-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding: 7px 11px;
		border-radius: 9px;
		background: #0d0f16;
		border: 1px solid rgba(74, 222, 160, 0.25);
	}
	.label {
		font-size: 11.5px;
		color: var(--color-text-tertiary);
	}
	.san {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-accent-green);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/CoachCard.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/CoachCard.svelte src/lib/components/CoachCard.test.ts
git commit -m "feat: add CoachCard component"
```

---

