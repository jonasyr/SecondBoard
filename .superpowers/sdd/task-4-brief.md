## Task 4: `appState` screen/tab/ply transitions

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: `SAN_LIST` from `$lib/game/mock-data` (for the ply upper bound).
- Produces (new exports alongside the existing `appState`):
  ```ts
  export const MAX_PLY: number; // SAN_LIST.length
  export function goToPly(ply: number): void; // clamps to [0, MAX_PLY]
  export function stepPly(delta: number): void; // clamps to [0, MAX_PLY]
  export function startReview(): void; // gameLoaded=true, screen='review', ply=31, tab='analysis'
  export function newGame(): void; // gameLoaded=false, pgnText='', screen='review'
  export function handleReviewKeydown(e: KeyboardEvent): void; // ArrowLeft/ArrowRight, only when appState.screen==='review'; preventDefault
  ```

- [ ] **Step 1: Write the failing tests** (append to the existing `src/lib/stores/app-state.test.ts`, whose current contents you should read first to match its existing describe/it style and any `beforeEach` reset helper)

```ts
import { appState, MAX_PLY, goToPly, stepPly, startReview, newGame, handleReviewKeydown } from './app-state.svelte';

// ... inside existing describe block or a new one:
describe('screen/ply transitions', () => {
	beforeEach(() => {
		appState.screen = 'review';
		appState.ply = 31;
		appState.gameLoaded = true;
		appState.tab = 'analysis';
		appState.pgnText = 'x';
	});

	it('MAX_PLY matches the mock game length (31)', () => {
		expect(MAX_PLY).toBe(31);
	});

	it('goToPly clamps to [0, MAX_PLY]', () => {
		goToPly(-5);
		expect(appState.ply).toBe(0);
		goToPly(999);
		expect(appState.ply).toBe(31);
		goToPly(10);
		expect(appState.ply).toBe(10);
	});

	it('stepPly moves by delta and clamps', () => {
		appState.ply = 0;
		stepPly(-1);
		expect(appState.ply).toBe(0);
		stepPly(1);
		expect(appState.ply).toBe(1);
	});

	it('startReview resets to the default review state regardless of pgnText', () => {
		appState.gameLoaded = false;
		appState.ply = 0;
		appState.tab = 'details';
		startReview();
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(31);
		expect(appState.tab).toBe('analysis');
	});

	it('newGame resets to onboarding', () => {
		newGame();
		expect(appState.gameLoaded).toBe(false);
		expect(appState.pgnText).toBe('');
		expect(appState.screen).toBe('review');
	});

	it('handleReviewKeydown steps ply on ArrowLeft/ArrowRight only on the review screen', () => {
		appState.ply = 5;
		const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
		handleReviewKeydown(right);
		expect(appState.ply).toBe(6);
		expect(right.defaultPrevented).toBe(true);

		appState.screen = 'home';
		const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
		handleReviewKeydown(left);
		expect(appState.ply).toBe(6); // unchanged — guarded on screen
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/stores/app-state.test.ts`
Expected: FAIL (new exports don't exist).

- [ ] **Step 3: Implement the additions in `src/lib/stores/app-state.svelte.ts`**

Add near the bottom of the file (after the existing `appState` export):

```ts
import { SAN_LIST } from '$lib/game/mock-data';

export const MAX_PLY = SAN_LIST.length;

export function goToPly(ply: number): void {
	appState.ply = Math.max(0, Math.min(MAX_PLY, ply));
}

export function stepPly(delta: number): void {
	goToPly(appState.ply + delta);
}

/** Reference `startReview` handler: always loads the same mock game — pgnText is cosmetic (Global Constraints). */
export function startReview(): void {
	appState.gameLoaded = true;
	appState.screen = 'review';
	appState.ply = MAX_PLY;
	appState.tab = 'analysis';
}

export function newGame(): void {
	appState.gameLoaded = false;
	appState.pgnText = '';
	appState.screen = 'review';
}

/** LOGIC.md §1 keyboard rule: guarded on screen==='review' only (not gameLoaded). */
export function handleReviewKeydown(e: KeyboardEvent): void {
	if (appState.screen !== 'review') return;
	if (e.key === 'ArrowLeft') {
		e.preventDefault();
		stepPly(-1);
	} else if (e.key === 'ArrowRight') {
		e.preventDefault();
		stepPly(1);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/stores/app-state.test.ts`
Expected: PASS (all, including pre-existing tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts
git commit -m "feat: add screen/ply/tab transition helpers to appState"
```

---

