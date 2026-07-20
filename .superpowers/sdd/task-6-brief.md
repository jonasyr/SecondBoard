### Task 6: Wire the special-class inputs through `app-state.svelte.ts`

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Test: `src/lib/stores/app-state.test.ts` (exists — read it first with `get_symbols_overview`/`find_symbol` to confirm its exact current assertions on `defaultState`/`startReview`/`refreshRealAnalysis` before editing, since adding two new `AppState` fields may touch an existing "matches the default state shape" style assertion there).

**Interfaces:**
- Consumes: `RealAnalysis.secondEvalPerPly/secondWdlPerPly` (Task 3), `classifyGame(evalPerPly, wdlPerPly?, special?)` (Task 5).
- Produces: `AppState.secondEvalPerPly: (number | null)[]`, `AppState.secondWdlPerPly: (Wdl | null)[]` (both default `[]`, reset in `startReview`, populated in `refreshRealAnalysis`).

- [ ] **Step 1: Add the two fields to `AppState` and `defaultState`**

Current code:
```typescript
export interface AppState {
	screen: Screen;
	ply: number;
	tab: Tab;
	flipped: boolean;
	sidebarCollapsed: boolean;
	gameLoaded: boolean;
	pgnText: string;
	showLines: boolean;
	selfAnalysis: boolean;
	evalPerPly: number[];
	bestMoves: Record<number, Move & { san: string }>;
	classCodes: ClassCode[];
	wdlPerPly: (Wdl | null)[];
	analysisStatus: 'idle' | 'loading' | 'ready' | 'error';
	game: GameData | null;
	parseError: string | null;
}
```
Add after `wdlPerPly: (Wdl | null)[];`:
```typescript
	secondEvalPerPly: (number | null)[];
	secondWdlPerPly: (Wdl | null)[];
```

Current `defaultState`:
```typescript
	classCodes: [],
	wdlPerPly: [],
	analysisStatus: 'idle',
```
Add after `wdlPerPly: [],`:
```typescript
	secondEvalPerPly: [],
	secondWdlPerPly: [],
```

- [ ] **Step 2: Reset the new fields in `startReview`**

Current code in `startReview`:
```typescript
		appState.classCodes = [];
		appState.wdlPerPly = [];
		appState.analysisStatus = 'idle';
```
Replace with:
```typescript
		appState.classCodes = [];
		appState.wdlPerPly = [];
		appState.secondEvalPerPly = [];
		appState.secondWdlPerPly = [];
		appState.analysisStatus = 'idle';
```

- [ ] **Step 3: Populate the new fields and pass `special` into `classifyGame` in `refreshRealAnalysis`**

Current code:
```typescript
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves, wdlPerPly } = await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.wdlPerPly = wdlPerPly;
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly);
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}
```
Replace with:
```typescript
async function refreshRealAnalysis(): Promise<void> {
	appState.analysisStatus = 'loading';
	try {
		const { evalPerPly, bestMoves, wdlPerPly, secondEvalPerPly, secondWdlPerPly } =
			await loadRealAnalysis(appState.game!.positions);
		appState.evalPerPly = evalPerPly;
		appState.bestMoves = bestMoves;
		appState.wdlPerPly = wdlPerPly;
		appState.secondEvalPerPly = secondEvalPerPly;
		appState.secondWdlPerPly = secondWdlPerPly;
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
			positions: appState.game!.positions,
			moveMeta: appState.game!.moveMeta,
			bestMoves,
			secondEvalPerPly,
			secondWdlPerPly
		});
		appState.analysisStatus = 'ready';
	} catch {
		appState.analysisStatus = 'error';
	}
}
```

- [ ] **Step 4: Run the full frontend suite to confirm nothing regressed**

Run: `rtk proxy pnpm exec vitest run`
Expected: PASS (every existing test file, since `AppState`'s new fields are purely additive and every changed call site still provides all required arguments).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts
git commit -m "feat(app-state): thread the engine's second PV line into classifyGame's special-class inputs"
```

---

