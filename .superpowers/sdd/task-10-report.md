## Task 10 Report: `MoveList.svelte`

### What changed
- Created `src/lib/components/MoveList.test.ts` — the 4-test suite given verbatim in the brief.
- Created `src/lib/components/MoveList.svelte` — the component given verbatim in the brief (16-row move list grid, `ClassBadge` per cell, `cellStyle` using `TOKENS.review.moveTint`, and the `$effect` auto-scroll block using `requestAnimationFrame` + manual `scrollTop` adjustment, matching the reference `_syncMoveScroll`).

No other files were modified. `SAN_LIST`, `CLASS_CODES`, `ClassBadge.svelte`, and `$lib/tokens` were consumed as-is, per the brief.

### Test commands run

1. Before creating the component:
   `pnpm run test -- --run src/lib/components/MoveList.test.ts`
   → Failed as expected: `Failed to resolve import "./MoveList.svelte"` (component didn't exist yet).

2. After creating the component, ran the same command (`pnpm run test -- --run src/lib/components/MoveList.test.ts`) three times. Note: this project's `test` script invokes `vitest` in a way that the trailing `-- --run <path>` does not actually scope the run to a single file — it runs the whole suite. Result each of the 3 runs: `1 failed | 30 passed (31)` test files, `137 passed (137)` tests. The one failing suite is `src/routes/page.test.ts`, pre-existing and unrelated: `Failed to resolve import "$lib/board/dev-fixtures"` from `src/routes/+page.svelte` — this is the later-task incomplete migration mentioned in my instructions, not something introduced by this task.

3. To get an isolated, unambiguous signal on just the new test file, also ran:
   `pnpm exec vitest run src/lib/components/MoveList.test.ts`
   three times in a row. Every run: `Test Files 1 passed (1)`, `Tests 4 passed (4)`. No flakiness observed — the "calls onSelectPly with the clicked ply" test passed consistently and does not appear affected by the async `requestAnimationFrame` scroll effect.

### `pnpm run check`
Ran `pnpm run check`. Output: `COMPLETED 437 FILES 3 ERRORS 10 WARNINGS 5 FILES_WITH_PROBLEMS`.

The 3 errors are all pre-existing and unrelated to this task:
- `src/lib/game/review.ts:115` and `:125` — `PieceType`/piece-color type mismatch (unrelated file, later-task migration).
- `src/routes/+page.svelte:5` — `Cannot find module '$lib/board/dev-fixtures'` (same missing module noted above).

My new files (`MoveList.svelte`) contribute only warnings, no errors:
- `src/lib/components/MoveList.svelte:59` and `:69` — a11y warnings (`a11y_click_events_have_key_events`, `a11y_no_static_element_interactions`) because the clickable move cells are plain `<div>`s with `onclick` and no keyboard handler/ARIA role. This is inherent to the code given verbatim in the brief (lines 123-131 / 133-141 of the brief use `<div onclick=...>` for cells) — implemented exactly as specified rather than deviating with a `<button>`/role addition. Flagging this as a minor concern in case a follow-up task wants to add keyboard accessibility to the move cells.

### Concerns
- Minor: a11y warnings on the two clickable `<div class="cell">` elements (see above) — expected from the brief's exact markup, not a regression introduced independently.
- Minor: `pnpm run test -- --run <path>` does not scope to a single test file in this repo; used `pnpm exec vitest run <path>` for a clean, isolated signal instead. Noting for future tasks that also target a single test file.
- No flakiness found in either the async scroll effect or the click handler across repeated runs (3x isolated, 3x full-suite).

### Commit
`349015e` — "feat: add MoveList component with auto-scroll"
