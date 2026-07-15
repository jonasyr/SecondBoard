# Task 3 Report: Game review per-ply derivation logic

## What was implemented

- `src/lib/game/review.ts` — `getReviewPly(ply)` and `getPlayerRows(ply, flipped)`, plus the
  `ReviewPly` / `PlayerRowData` interfaces, exactly as specified in the brief's interface section.
- `src/lib/game/review.test.ts` — the 8 tests from the brief's Step 1 (brief's prose said
  "PASS (9/9)" but only 8 `it` blocks actually exist in the brief's own test listing; no test
  was added or removed beyond what the brief specified).

## Ground-truth verification against `renderVals()` (SecondBoard.dc.html lines 1221-1330)

Read the reference directly (lines 1221-1262 plus 1300-1330, since `coachMove`/`coachText` are
actually assembled a bit further down at lines 1231 and 1325-1326, not fully within the
1221-1262 window cited by the brief). Cross-checked every piece of logic the brief's pseudocode
proposed:

- **Eval formula / whitePct**: reference line 1234:
  `50 + Math.max(-44, Math.min(44, evNum / 8 * 44))` — matches `evalBarPct` in
  `src/lib/board/geometry.ts` (already ported in Iteration 3) and matches the brief. No change.
- **Coach move numbering**: reference line 1231:
  `selMoveNo + (ply % 2 === 1 ? '. ' : '... ') + selSan`, with `'Start'` at ply 0. Matches brief
  verbatim.
- **`best` move gating**: reference lines 1238-1239: `notBest = {inaccuracy,mistake,miss,blunder}`;
  `best = (ply>0 && notBest[selCode]) ? bestMoves[ply] : null`. Matches `NOT_BEST_CODES.includes(classCode)`
  gate in the brief (`NOT_BEST_CODES` in `src/lib/tokens.ts` already contains exactly those 4 codes).
- **`coachText`**: reference line 1326: `ply > 0 ? this.coachTextMap[selCode] : 'The game begins...'`.
  Matches `COACH_TEXT_MAP[classCode]` / intro-text branch in the brief.
- **Player rows**: reference lines 1244-1258 (`whiteP`/`blackP`/`whiteAtBottom` swap, `clockActive`
  via `blackToMove`, `adv` sign split between the two sides). Matches the brief's
  `getPlayerRows` verbatim.

### One discrepancy found and resolved (documented in code, not silently patched)

At ply 0 the reference internally sets `selCode = 'book'` (line 1227) rather than a null/undefined
value — but this is purely so its `selCls = this.CLS[selCode]` lookup (glyph/color/word used for
the board-square badge, which is *out of scope* for this module's `ReviewPly` interface) doesn't
throw at ply 0. Every actual *use* of `selCode` in the reference that's observable through this
port's output is already gated behind `ply > 0` (`coachText`, `best`), so `'book'` at ply 0 is
never surfaced anywhere the UI actually reads it. The brief's own `ReviewPly` interface comment
("`classCode: ClassCode | null; // null only at ply 0`") and its own test
(`expect(r.classCode).toBeNull()`) both call for `null`, consistent with the reference's actual
observable behavior. Kept `classCode: null` at ply 0 and added a comment in `review.ts` explaining
this isn't a mechanical mismatch with the reference's internal `'book'` placeholder — it's a
narrowing of an internal implementation detail that was never externally visible.

Also verified `capturedInfo`/`evalBarPct` (`src/lib/board/geometry.ts`) and `NOT_BEST_CODES`/`TOKENS`
(`src/lib/tokens.ts`) both exist with the signatures the brief assumes — no changes were needed
in either file. Removed the unused `TOKENS` import per the brief's own note (classification colors
are looked up by components via `TOKENS.classification[classCode]`, not precomputed in this module).

## TDD evidence

- RED: wrote `review.test.ts` first, against a module (`./review`) that did not yet exist.
- GREEN: `npx vitest run src/lib/game/review.test.ts` → `PASS (8) FAIL (0)`.
- Full suite: `npx vitest run` → `Tests 112 passed (112)`; `Test Files 1 failed | 24 passed (25)`.
  The one failing test *file* is `src/routes/page.test.ts`, pre-existing and unrelated to this
  task: it fails at Vite import-analysis time because `src/routes/+page.svelte` imports
  `$lib/board/dev-fixtures`, a module that doesn't exist on disk. This traces back to commit
  `25a50f9` ("feat: add temporary Board visual-verification harness with mock game data"),
  already on this branch before Task 3 started, and is outside this task's scope
  (`src/lib/game/review.ts` + its test only, per the task's "Code Organization" restriction).
  `npx tsc --noEmit` → "No errors found" (project-wide).

## Files changed

- Created: `src/lib/game/review.ts`
- Created: `src/lib/game/review.test.ts`
- Commit: `cb0f94e` "feat: add per-ply review data derivation"

## Self-review findings

- Confirmed `MOCK_MOVE_META` entries (`src/lib/game/mock-engine.ts` `buildGame()`) are `Move`
  (`{from,to}`), matching `ReviewPly.lastMove`'s type exactly.
- Confirmed `$lib/types` resolves to `src/lib/types/index.ts` (a directory, not a flat file) and
  `ClassCode` is defined there — matches the import in `review.ts` and in `eval-graph.test.ts`
  (Task 1's precedent for the same alias).
- No mutation: both `getReviewPly` and `getPlayerRows` are pure and return new objects; neither
  writes into `MOCK_POSITIONS`, `CLASS_CODES`, or any other shared mock-data array.
- File size: 139 lines, well under the 800-line ceiling; both exported functions are small and
  single-purpose.

## Concerns

None blocking. The one pre-existing, out-of-scope test failure (`src/routes/page.test.ts` /
missing `$lib/board/dev-fixtures`) is flagged above for visibility but was not touched, per the
task's explicit scope restriction to `src/lib/game/review.ts` + test only.
