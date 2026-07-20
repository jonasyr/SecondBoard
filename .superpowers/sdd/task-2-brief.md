## Task 2: `app-state.svelte.ts` — wire real `classCodes` into the store

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: `classifyGame(evalPerPly: number[]): ClassCode[]` from Task 1.
- Produces: `AppState.classCodes: ClassCode[]` — consumed by Tasks 3-6.

- [ ] **Step 1: Write the failing tests**

Add to `src/lib/stores/app-state.test.ts`, inside the existing `describe('real analysis loading', ...)` block (after the `'goes loading -> ready and applies the real data once startReview resolves'` test):

```typescript
	it('populates classCodes from the real evalPerPly once analysis is ready', async () => {
		let resolveAnalysis!: (v: { evalPerPly: number[]; bestMoves: Record<number, never> }) => void;
		loadRealAnalysis.mockReturnValue(
			new Promise((resolve) => {
				resolveAnalysis = resolve;
			})
		);

		await startReview();
		expect(appState.classCodes).toEqual([]); // nothing computed yet while loading

		resolveAnalysis({ evalPerPly: [0, 1], bestMoves: {} });
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.classCodes).toEqual(['best']);
	});

	it('leaves classCodes empty (not fabricated) when loadRealAnalysis rejects', async () => {
		loadRealAnalysis.mockRejectedValue(new Error('engine offline'));

		await startReview();
		await Promise.resolve();
		await Promise.resolve();

		expect(appState.analysisStatus).toBe('error');
		expect(appState.classCodes).toEqual([]);
	});
```

Also add, inside the existing `describe('startReview (real PGN parsing)', ...)` block's first test (`'on successful parse: ...'`), right after the existing `expect(appState.evalPerPly).toEqual([0, 0, 0]);` line:

```typescript
		expect(appState.classCodes).toEqual([]); // reset on every fresh parse, before real analysis lands
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts`
Expected: FAIL — `appState.classCodes` is `undefined`, not `[]`/`['best']` (property doesn't exist on `AppState` yet).

- [ ] **Step 3: Add `classCodes` to `AppState`, `defaultState`, `startReview`, and `refreshRealAnalysis`**

In `src/lib/stores/app-state.svelte.ts`, add the import (extend the existing `$lib/game/classify` import):

```typescript
import { classifyGame } from '$lib/game/classify';
```

Modify the `AppState` interface — add after `bestMoves`:

```typescript
	bestMoves: Record<number, Move & { san: string }>;
	classCodes: ClassCode[];
```

(Add `import type { ClassCode } from '$lib/types';` to the top of the file alongside the existing `Screen`/`Tab` import.)

Modify `defaultState` — add after `bestMoves: { ...BEST_MOVES },`:

```typescript
	bestMoves: { ...BEST_MOVES },
	classCodes: [],
```

In `startReview`, reset `classCodes` alongside the existing `evalPerPly`/`bestMoves` reset (add right after `appState.bestMoves = {};`):

```typescript
			appState.evalPerPly = new Array(parsed.sanList.length + 1).fill(0);
			appState.bestMoves = {};
			appState.classCodes = [];
```

In `refreshRealAnalysis`, compute real classifications alongside the real `evalPerPly`/`bestMoves` (modify the `try` block):

```typescript
	try {
		const { evalPerPly, bestMoves } = await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.classCodes = classifyGame(evalPerPly);
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/stores/app-state.test.ts`
Expected: PASS — all green.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts
git commit -m "feat: populate appState.classCodes from real analysis"
```

---

