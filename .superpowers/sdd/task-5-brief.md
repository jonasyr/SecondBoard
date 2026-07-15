## Task 5: `ClassBadge.svelte`

**Files:**
- Create: `src/lib/components/ClassBadge.svelte`
- Test: `src/lib/components/ClassBadge.test.ts`

**Interfaces:**
- Consumes: `TOKENS.classification`, `TOKENS.review.moveTint`, `DARK_FG_CODES` from `$lib/tokens`; `ClassCode` from `$lib/types`.
- Produces: a component with props
  ```ts
  interface Props {
  	classCode: ClassCode;
  	size: 16 | 21 | 22;
  	useDarkFg?: boolean; // default false — only breakdown(21)/phase(22) badges pass true
  }
  ```

Per Global Constraints, this does **not** replace `BoardSquare.svelte`'s 36px badge.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/ClassBadge.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ClassBadge from './ClassBadge.svelte';

describe('ClassBadge', () => {
	it('renders the glyph and background color for the given classification', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'brilliant', size: 16 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.textContent).toBe('!!');
		expect(el.getAttribute('style')).toContain('45, 224, 206'); // #2DE0CE
	});

	it('sizes the badge in pixels via the size prop', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'best', size: 21 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute('style')).toContain('width: 21px');
		expect(el.getAttribute('style')).toContain('height: 21px');
	});

	it('uses dark foreground text only when useDarkFg is set and the code is in DARK_FG_CODES', () => {
		const { container: withDark } = render(ClassBadge, {
			props: { classCode: 'best', size: 21, useDarkFg: true }
		});
		expect((withDark.firstElementChild as HTMLElement).getAttribute('style')).toContain(
			'11, 18, 15'
		); // #0B120F

		const { container: withoutDark } = render(ClassBadge, {
			props: { classCode: 'best', size: 16, useDarkFg: false }
		});
		expect((withoutDark.firstElementChild as HTMLElement).getAttribute('style')).toContain(
			'255, 255, 255'
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/ClassBadge.test.ts`
Expected: FAIL (component doesn't exist).

- [ ] **Step 3: Implement `src/lib/components/ClassBadge.svelte`**

```svelte
<script lang="ts">
	import { TOKENS, DARK_FG_CODES } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		classCode: ClassCode;
		size: 16 | 21 | 22;
		useDarkFg?: boolean;
	}

	let { classCode, size, useDarkFg = false }: Props = $props();

	const cls = $derived(TOKENS.classification[classCode]);
	const fg = $derived(useDarkFg && DARK_FG_CODES.includes(classCode) ? '#0B120F' : '#fff');
	const fontSize = $derived(size === 16 ? '8.5px' : size === 21 ? '10.5px' : '11px');
</script>

<span
	class="badge"
	style={`width:${size}px;height:${size}px;font-size:${fontSize};background:${cls.color};color:${fg};`}
>{cls.glyph}</span>

<style>
	.badge {
		flex: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		letter-spacing: -0.5px;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
</style>
```

Note: the reference's breakdown/phase badges (21px/22px) don't carry `text-shadow`/`box-shadow` (their `badgeStyle` strings only set width/height/radius/flex/display/align/justify/font-weight/font-size/letter-spacing/background/color — no shadow). Only the 16px move-list badge has `text-shadow:0 1px 1px rgba(0,0,0,.25)` + `box-shadow:0 1px 3px rgba(0,0,0,.35)`. Fix the component so shadows only apply when `size === 16`:

```svelte
<span
	class="badge"
	class:with-shadow={size === 16}
	style={`width:${size}px;height:${size}px;font-size:${fontSize};background:${cls.color};color:${fg};`}
>{cls.glyph}</span>

<style>
	.badge {
		flex: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		letter-spacing: -0.5px;
	}
	.badge.with-shadow {
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/ClassBadge.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ClassBadge.svelte src/lib/components/ClassBadge.test.ts
git commit -m "feat: add ClassBadge component for move-list/breakdown/phase badges"
```

---

