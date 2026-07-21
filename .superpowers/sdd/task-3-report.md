# Task 3 Report: Wire real phase accuracy into UI, remove mock

## Status: Complete

Branch: `feat/special-move-classes`
Commit: `9bfbef7` — "feat(phase): wire real phase accuracy into PhaseTable, remove mocked PHASE_ROWS"

## Steps followed (TDD)

1. **Failing test written** — replaced `src/lib/components/PhaseTable.test.ts` with the brief's
   3-test spec (props-based rendering, dash placeholder for missing phase data, exact-accuracy
   tooltip). Confirmed 2 of 3 tests failed against the old mock-driven component (no-`rows`-prop
   version), as expected.
2. **Implementation** — rewrote `src/lib/components/PhaseTable.svelte` verbatim from the brief:
   now takes `Props = { rows: PhaseRow[] }`, renders a `ClassBadge` per side with a `title="..."`
   tooltip (`"{Side}: {accuracy.toFixed(1)}% accuracy in the {phaseName}"`), or a `—` placeholder
   span when a side's phase entry is `null`.
3. **Verified pass** — after fixing one test-data/expectation mismatch (see "Deviation from brief"
   below), all 3 `PhaseTable.test.ts` tests pass.
4. **Wired into `ReviewTab.svelte`** — added `import { getPhaseRows } from '$lib/game/phase';`,
   added a `phaseRows` derived value immediately after `breakdownRows`, following the exact same
   `analysisStatus === 'ready' ? real : []` gating idiom already used by `accuracy`:
   ```ts
   const phaseRows = $derived(
       getPhaseRows(
           appState.game!.positions,
           appState.analysisStatus === 'ready' ? evalPerPly : [],
           appState.analysisStatus === 'ready' ? wdlPerPly : []
       )
   );
   ```
   Changed `<PhaseTable />` to `<PhaseTable rows={phaseRows} />`.
5. **Removed the mock** — deleted the `PHASE_ROWS` export from `src/lib/game/mock-data.ts`.
   `ClassCode` import was left in place (still used by `CLASS_CODES`, `COACH_TEXT_MAP`, and
   `BREAKDOWN_ROWS` in the same file, confirmed via grep). Updated
   `src/lib/game/mock-data.test.ts`: dropped `PHASE_ROWS` from the import list and collapsed the
   combined "10 breakdown rows and 3 phase rows" test into "has 10 breakdown rows" only.
6. **Full suite run** — `rtk proxy pnpm exec vitest run` (used `proxy` to bypass a stale RTK
   output-truncation issue on this large a11y-warning-heavy run; unrelated to the task).
   Result: **54 test files passed (54), 333 tests passed (333)**. `ReviewTab.test.ts` needed no
   changes — it doesn't assert anything about `PhaseTable`'s internals.
7. **Commit** — staged exactly the 5 files named in the brief and committed with the brief's
   exact message. Confirmed via `git status --short` that unrelated pre-existing working-tree
   changes (modified `task-1/2-brief/report.md` files, an untracked doc) were not swept in.

## Deviation from brief (and why)

The brief's Step 1 test "shows a dash placeholder instead of a badge for a phase with no accuracy
data" supplies a fixture with **two** phase rows (`Middlegame` and `Endgame`) each having
`white: null, black: null` — i.e. 4 null sides total — but asserts
`expect(getAllByText('—')).toHaveLength(2)`. Copying both the fixture and the component verbatim
from the brief (as instructed) produces 4 rendered `—` placeholders, not 2 — the test fails
permanently regardless of implementation correctness, which contradicts the TDD "implementation
makes the test pass" step.

Since the fixture data and the (verbatim, brief-specified) component implementation are mutually
consistent with each other and with the rest of the spec, I judged the assertion count to be the
one error in the brief and corrected it from `toHaveLength(2)` to `toHaveLength(4)` in
`src/lib/components/PhaseTable.test.ts`. Everything else in the brief (component code, `ReviewTab`
wiring, mock removal) was copied/applied exactly as specified.

## Files touched

- `src/lib/components/PhaseTable.svelte` — rewritten per brief (props-based, tooltip, dash
  placeholder).
- `src/lib/components/PhaseTable.test.ts` — replaced per brief, with the single `toHaveLength(2)`
  → `toHaveLength(4)` fix noted above.
- `src/lib/components/ReviewTab.svelte` — added `getPhaseRows` import, `phaseRows` derived value,
  `<PhaseTable rows={phaseRows} />`.
- `src/lib/game/mock-data.ts` — removed `PHASE_ROWS` export; `ClassCode` import retained (still
  used elsewhere in the file).
- `src/lib/game/mock-data.test.ts` — removed `PHASE_ROWS` import and merged its assertion into the
  breakdown-rows test per brief.

## Test result

`rtk proxy pnpm exec vitest run`: **Test Files 54 passed (54); Tests 333 passed (333)**.

## Concerns

- The test-data/assertion mismatch in the brief (see above) — flagging in case Task 3's brief is
  reused or referenced elsewhere; the fix applied is minimal and preserves the test's original
  intent (verify dash placeholders render for phases with no side data).
- A stale/unrelated `task-3-report.md` (about a "golden-fixture regression test" for Byrne-Fischer
  Be6 classification) previously existed at this path from a different task numbering context; it
  has been overwritten with this report per the assignment's explicit instruction to write here.
- No other concerns; svelte-check/lint a11y warnings observed during the vitest run (Board.svelte,
  MoveList.svelte, OnboardingScreen.svelte, ExploreTab.svelte, NavControls.svelte) are pre-existing
  and unrelated to this task's files.
