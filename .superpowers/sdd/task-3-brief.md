## Task 3: TS `api/engine.ts` — thread `wdl` into the frontend's `AnalyzeFenResult`

**Files:**
- Modify: `src/lib/api/engine.ts`
- Modify: `src/lib/api/engine.test.ts`

**Interfaces:**
- Produces: `AnalyzeFenResult.wdl: [number, number, number] | null` — consumed by Task 6.

- [ ] **Step 1: Write the failing test**

Modify `src/lib/api/engine.test.ts` — add `wdl` to the mocked `invoke` resolution and assert it round-trips:

```typescript
import { describe, it, expect, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { analyzeFen } from './engine';

describe('analyzeFen', () => {
	it('invokes the analyze_fen command with the given FEN and returns its result', async () => {
		invoke.mockResolvedValue({
			evalCp: 34,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: ['e2e4', 'e7e5'],
			wdl: [500, 400, 100]
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(invoke).toHaveBeenCalledWith('analyze_fen', {
			fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1'
		});
		expect(result.bestMoveUci).toBe('e2e4');
		expect(result.evalCp).toBe(34);
		expect(result.wdl).toEqual([500, 400, 100]);
	});

	it('passes through a null wdl when the engine did not report one', async () => {
		invoke.mockResolvedValue({
			evalCp: 34,
			isMate: false,
			bestMoveUci: 'e2e4',
			pv: [],
			wdl: null
		});

		const result = await analyzeFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w - - 0 1');

		expect(result.wdl).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/api/engine.test.ts`
Expected: FAIL — `result.wdl` is `undefined`, not `[500, 400, 100]`/`null` (TypeScript would also flag the missing interface field, though `vitest` alone will just fail the runtime assertion).

- [ ] **Step 3: Add `wdl` to `AnalyzeFenResult`**

In `src/lib/api/engine.ts`:

```typescript
import { invoke } from '@tauri-apps/api/core';

export interface AnalyzeFenResult {
	evalCp: number;
	isMate: boolean;
	bestMoveUci: string;
	pv: string[];
	wdl: [number, number, number] | null;
}

/** Invokes the Rust `analyze_fen` Tauri command (LOGIC.md §7 Phase-0 spike). */
export function analyzeFen(fen: string): Promise<AnalyzeFenResult> {
	return invoke<AnalyzeFenResult>('analyze_fen', { fen });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/api/engine.test.ts`
Expected: PASS — both tests green.

Run: `pnpm check`
Expected: no new TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/engine.ts src/lib/api/engine.test.ts
git commit -m "feat: thread the engine's WDL field into AnalyzeFenResult"
```

---

