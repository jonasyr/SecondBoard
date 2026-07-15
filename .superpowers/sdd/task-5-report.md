## Task 5 Report: `ClassBadge.svelte`

**Status:** DONE

**Commit:** `2643e3bd4e349244e9862da260cbaa82cce545ba` — "feat: add ClassBadge component for move-list/breakdown/phase badges"

### What was changed

- Created `src/lib/components/ClassBadge.test.ts` — verbatim from the brief's Step 1, 3 test cases: glyph/background color rendering, pixel sizing via `size` prop, and dark-foreground logic gated by `useDarkFg` + `DARK_FG_CODES`.
- Created `src/lib/components/ClassBadge.svelte` — implemented using the brief's **final corrected** version (Step 3's second code block): `class:with-shadow={size === 16}` on the `<span>`, with `text-shadow`/`box-shadow` moved into a `.badge.with-shadow` CSS rule (not applied unconditionally to `.badge`). This matches the reference behavior where only the 16px move-list badge carries shadows; 21px/22px breakdown/phase badges do not.

### Commands run and results

1. **Test written, then run to confirm failure (pre-implementation):**
   `pnpm run test -- --run src/lib/components/ClassBadge.test.ts`
   Result: FAILED as expected — `Failed to resolve import "./ClassBadge.svelte"` (component did not yet exist). The suite also showed the pre-existing, unrelated `src/routes/page.test.ts` failure (`$lib/board/dev-fixtures` missing module, from a later task's incomplete migration).

2. **Component implemented, test run again:**
   `pnpm run test -- --run src/lib/components/ClassBadge.test.ts`
   Result: `ClassBadge.test.ts` now passes; overall run shows `Test Files 1 failed | 25 passed (26)`, `Tests 121 passed (121)` — the one failing file is still the pre-existing `page.test.ts` (unrelated, not in scope).

3. **Isolated confirmation:**
   `pnpm exec vitest run src/lib/components/ClassBadge.test.ts`
   Result: `Test Files 1 passed (1)`, `Tests 3 passed (3)` — clean 3/3 pass with no other suites involved.

4. **Type check:**
   `pnpm run check`
   Result: `COMPLETED 427 FILES 3 ERRORS 6 WARNINGS 4 FILES_WITH_PROBLEMS`. All 3 errors are pre-existing and unrelated to this task:
   - `src/lib/game/review.ts:115` and `:125` — `PieceType` union mismatch (`"K"` not assignable), from the game-review data layer (later/other task).
   - `src/routes/+page.svelte:5:27` — `Cannot find module '$lib/board/dev-fixtures'`, the known missing-fixture issue called out in the assignment.
   No errors or warnings reference `ClassBadge.svelte` or `ClassBadge.test.ts`.

### Concerns

None. The component was implemented exactly per the brief's final corrected code, tests pass 3/3 in isolation, and `pnpm run check` introduces no new errors attributable to these two files.
