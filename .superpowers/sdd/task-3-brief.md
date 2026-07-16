## Task 3: TS `api/pgn.ts` — `parsePgn` invoke wrapper

**Files:**
- Modify: `src/lib/api/index.ts` (add the re-export)
- Create: `src/lib/api/pgn.ts`
- Test: `src/lib/api/pgn.test.ts`

**Interfaces:**
- Consumes: `invoke` from `@tauri-apps/api/core` (already a dependency, already used by `api/engine.ts` in Iteration 5).
- Produces (used by Task 4): 
  ```ts
  export interface ParsedGame {
      sanList: string[];
      positions: Array<Record<string, [string, string]>>;
      moves: Array<{ from: string; to: string }>;
  }
  export function parsePgn(pgn: string): Promise<ParsedGame>;
  ```

- [ ] **Step 1: Write the failing test**

Create `src/lib/api/pgn.test.ts` (mirrors `src/lib/api/engine.test.ts`'s mocking convention exactly):

```ts
import { describe, it, expect, vi } from 'vitest';

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock('@tauri-apps/api/core', () => ({ invoke }));

import { parsePgn } from './pgn';

describe('parsePgn', () => {
	it('invokes the parse_pgn command with the given PGN text and returns its result', async () => {
		invoke.mockResolvedValue({
			sanList: ['e4', 'e5'],
			positions: [{ e2: ['P', 'w'] }, { e4: ['P', 'w'] }],
			moves: [{ from: 'e2', to: 'e4' }]
		});

		const result = await parsePgn('1. e4 e5');

		expect(invoke).toHaveBeenCalledWith('parse_pgn', { pgn: '1. e4 e5' });
		expect(result.sanList).toEqual(['e4', 'e5']);
		expect(result.moves).toEqual([{ from: 'e2', to: 'e4' }]);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run src/lib/api/pgn.test.ts`
Expected: FAIL — cannot resolve `./pgn`.

- [ ] **Step 3: Implement `api/pgn.ts`**

Create `src/lib/api/pgn.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';

export interface ParsedGame {
	sanList: string[];
	positions: Array<Record<string, [string, string]>>;
	moves: Array<{ from: string; to: string }>;
}

/** Invokes the Rust `parse_pgn` Tauri command (LOGIC.md §7/§8; replaces the mock SAN engine). */
export function parsePgn(pgn: string): Promise<ParsedGame> {
	return invoke<ParsedGame>('parse_pgn', { pgn });
}
```

Update `src/lib/api/index.ts` to add the re-export (check the file's current contents first — it should already re-export `window` and `engine`; only add what's missing):

```ts
export * from './pgn';
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm vitest run src/lib/api/pgn.test.ts`
Expected: 1 test passes.

- [ ] **Step 5: Commit**

```bash
git add src/lib/api/pgn.ts src/lib/api/pgn.test.ts src/lib/api/index.ts
git commit -m "feat: add parsePgn Tauri invoke wrapper"
```

---

