## Task 8: Wire components to real `appState.evalPerPly`/`bestMoves` + minimal loading indicator

**Files:**
- Modify: `src/lib/game/review.ts`
- Modify: `src/lib/game/review.test.ts` (no new tests required — just confirm existing tests still pass unmodified per the Global Constraints backward-compatibility rule; add one new test for the optional-parameter override)
- Modify: `src/lib/components/GameReviewScreen.svelte`
- Modify: `src/lib/components/AnalysisTab.svelte`
- Modify: `src/lib/components/AnalysisTab.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`
- Modify: `src/lib/components/ReviewTab.test.ts`
- Modify: `src/lib/components/BottomBar.svelte`
- Modify: `src/lib/components/BottomBar.test.ts`
- Modify: `src/lib/components/ReviewPanel.svelte`

**Interfaces:**
- Consumes: `appState.evalPerPly`, `appState.bestMoves`, `appState.analysisStatus` (Task 7).
- Produces: `getReviewPly(ply, evalPerPly?, bestMoves?)` — extended signature, default values preserve current behavior exactly.

- [ ] **Step 1: Write the failing test for `getReviewPly`'s new optional parameters**

Add to `src/lib/game/review.test.ts` (inside the existing `describe('getReviewPly')` block, as a new `it`):

```ts
it('accepts explicit evalPerPly/bestMoves overrides instead of the static mock arrays', () => {
	const r = getReviewPly(1, [0, 99], {});
	expect(r.evalNum).toBe(99);
	expect(r.evalStr).toBe('+99.00');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: FAIL — `getReviewPly` only accepts one argument today (TypeScript error on extra args, or the extra args are silently ignored and the assertion fails against the mock value).

- [ ] **Step 3: Extend `getReviewPly`'s signature**

In `src/lib/game/review.ts`, change:

```ts
export function getReviewPly(ply: number): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMove = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;

	const evalNum = EVAL_PER_PLY[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (BEST_MOVES[ply] ?? null) : null;
```

to:

```ts
export function getReviewPly(
	ply: number,
	evalPerPly: number[] = EVAL_PER_PLY,
	bestMoves: Record<number, Move & { san: string }> = BEST_MOVES
): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMove = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;

	const evalNum = evalPerPly[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	// Engine best-move arrow: only surfaced when the played move was one of
	// the NOT_BEST classifications and real/mock data actually has an entry for it.
	const best =
		ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (bestMoves[ply] ?? null) : null;
```

(The function's remaining body is unchanged — `moveNo`/`coachMove`/`coachText`/the return statement stay exactly as they are today.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/game/review.test.ts`
Expected: all tests pass, including the new one. Every pre-existing `getReviewPly(N)` call in the test file keeps passing unmodified (defaults preserve behavior).

- [ ] **Step 5: Wire `GameReviewScreen.svelte` and `AnalysisTab.svelte` to pass real data through**

In `src/lib/components/GameReviewScreen.svelte`, change:

```ts
const data = $derived(getReviewPly(appState.ply));
```

to:

```ts
const data = $derived(getReviewPly(appState.ply, appState.evalPerPly, appState.bestMoves));
```

In `src/lib/components/AnalysisTab.svelte`, change the imports from:

```ts
import { getReviewPly } from '$lib/game/review';
```

to:

```ts
import { getReviewPly } from '$lib/game/review';
import { appState } from '$lib/stores/app-state.svelte';
```

and change:

```ts
const data = $derived(getReviewPly(ply));
```

to:

```ts
const data = $derived(getReviewPly(ply, appState.evalPerPly, appState.bestMoves));
```

Then add a minimal "Analyzing…" indicator just above the `coach-slot` div in the same file's markup:

```svelte
<div class="analysis-tab">
	{#if appState.analysisStatus === 'loading'}
		<div class="analyzing-note">Analyzing with Stockfish…</div>
	{/if}
	<div class="coach-slot">
```

and add its style, alongside the existing `.coach-slot`/`.actions` rules:

```css
	.analyzing-note {
		flex: none;
		padding: 10px 14px 0;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--color-text-tertiary);
	}
```

- [ ] **Step 6: Update `AnalysisTab.test.ts` for the new appState dependency**

`AnalysisTab.svelte` now reads `appState.analysisStatus`/`appState.evalPerPly`/`appState.bestMoves` directly. Add `import { appState } from '$lib/stores/app-state.svelte';` to `src/lib/components/AnalysisTab.test.ts` and add one new test, appended to the existing `describe('AnalysisTab')` block:

```ts
it('shows the analyzing note only while analysisStatus is loading', () => {
	appState.analysisStatus = 'loading';
	const { getByText, unmount } = render(AnalysisTab, {
		props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
	});
	expect(getByText('Analyzing with Stockfish…')).toBeTruthy();
	unmount();

	appState.analysisStatus = 'ready';
	const { queryByText } = render(AnalysisTab, {
		props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
	});
	expect(queryByText('Analyzing with Stockfish…')).toBeNull();
	appState.analysisStatus = 'idle'; // reset the singleton for later tests in this file
});
```

- [ ] **Step 7: Run `AnalysisTab` tests to verify they pass**

Run: `pnpm vitest run src/lib/components/AnalysisTab.test.ts`
Expected: all tests pass (existing 3 + 1 new).

- [ ] **Step 8: Add `evalPerPly` prop to `ReviewTab.svelte` and `BottomBar.svelte`**

In `src/lib/components/ReviewTab.svelte`, change:

```ts
import { EVAL_PER_PLY, CLASS_CODES } from '$lib/game/mock-data';
```
```ts
interface Props {
	ply: number;
}

let { ply }: Props = $props();
```
```svelte
<EvalGraph evalPerPly={EVAL_PER_PLY} classCodes={CLASS_CODES} {ply} height={66} />
```

to:

```ts
import { CLASS_CODES } from '$lib/game/mock-data';
```
```ts
interface Props {
	ply: number;
	evalPerPly: number[];
}

let { ply, evalPerPly }: Props = $props();
```
```svelte
<EvalGraph {evalPerPly} classCodes={CLASS_CODES} {ply} height={66} />
```

Apply the identical change to `src/lib/components/BottomBar.svelte` (same import line, same `Props` field addition, same `EvalGraph` prop change — its `height` prop stays `62`).

- [ ] **Step 9: Wire `ReviewPanel.svelte` to pass `appState.evalPerPly` through**

In `src/lib/components/ReviewPanel.svelte`, change:

```svelte
	{#if appState.tab === 'review'}
		<ReviewTab ply={appState.ply} />
```

to:

```svelte
	{#if appState.tab === 'review'}
		<ReviewTab ply={appState.ply} evalPerPly={appState.evalPerPly} />
```

and change:

```svelte
		<BottomBar
			ply={appState.ply}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(MAX_PLY)}
		/>
```

to:

```svelte
		<BottomBar
			ply={appState.ply}
			evalPerPly={appState.evalPerPly}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(MAX_PLY)}
		/>
```

- [ ] **Step 10: Update `ReviewTab.test.ts` and `BottomBar.test.ts` for the new required prop**

In `src/lib/components/ReviewTab.test.ts`, add `import { EVAL_PER_PLY } from '$lib/game/mock-data';` and change:

```ts
const { container, getByText } = render(ReviewTab, { props: { ply: 31 } });
```

to:

```ts
const { container, getByText } = render(ReviewTab, {
	props: { ply: 31, evalPerPly: EVAL_PER_PLY }
});
```

In `src/lib/components/BottomBar.test.ts`, add the same import and change:

```ts
const { container } = render(BottomBar, {
	props: { ply: 0, onFirst: () => {}, onPrev: () => {}, onNext: () => {}, onLast: () => {} }
});
```

to:

```ts
const { container } = render(BottomBar, {
	props: {
		ply: 0,
		evalPerPly: EVAL_PER_PLY,
		onFirst: () => {},
		onPrev: () => {},
		onNext: () => {},
		onLast: () => {}
	}
});
```

- [ ] **Step 11: Run the full test suite to verify everything passes together**

Run: `pnpm run test -- --run`
Expected: all test files pass (no regressions in `GameReviewScreen.test.ts`, `ReviewPanel.test.ts`, or any other component that transitively renders these).

- [ ] **Step 12: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts \
  src/lib/components/GameReviewScreen.svelte \
  src/lib/components/AnalysisTab.svelte src/lib/components/AnalysisTab.test.ts \
  src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts \
  src/lib/components/BottomBar.svelte src/lib/components/BottomBar.test.ts \
  src/lib/components/ReviewPanel.svelte
git commit -m "feat: wire the Game Review screen to real per-ply engine analysis"
```

---

