# Task 3 Report — `review.ts` real classification in `getReviewPly`

## What was implemented

- `src/lib/game/review.ts`:
  - `UNCLASSIFIED_COACH_TEXT` changed from the `isSample`-flavored copy
    (`"...only the built-in sample game is fully analyzed in this preview."`)
    to `"Move classification isn't available yet — analysis for this move hasn't finished."`
  - `getReviewPly` gained a 5th parameter, `classCodes: ClassCode[] = CLASS_CODES`
    (defaulting to the existing mock `CLASS_CODES` export for backward compatibility
    with the two call sites not yet updated — `AnalysisTab.svelte` and
    `GameReviewScreen.svelte`, both scoped to Tasks 4-5 per the brief).
  - `classCode` derivation changed from
    `ply > 0 && game.isSample ? (CLASS_CODES[ply - 1] ?? null) : null`
    to `ply > 0 ? (classCodes[ply - 1] ?? null) : null` — classification is now
    driven purely by whether the passed-in `classCodes` array has an entry for
    that ply, independent of `game.isSample`.
  - Updated the file-level doc comment (lines 1-9) to describe the new
    classCodes-driven behavior instead of the removed `isSample` gate
    (this wasn't in the brief's exact diff but was directly falsified by the
    code change, so I corrected it to avoid leaving stale/misleading docs;
    behavior-wise this is a no-op).

- `src/lib/game/review.test.ts`:
  - Replaced `'ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"'`
    and `'does not apply classification/coach text to a non-sample game'` with the
    three tests specified in the brief (real classCodes on sampleGame, real
    classCodes on notSampleGame, and the "not ready yet" empty-array case).
  - Updated the `'only exposes \`best\`...'` test's inline comment per the brief
    (no behavioral change — it never depended on `isSample`).

## Test commands and output

```
pnpm exec vitest run src/lib/game/review.test.ts
```

**Before implementation (after writing new tests, confirming red):**
```
PASS (17) FAIL (3)
1. getReviewPly ply 1 is classified from the real evalPerPly (Expected-Points cutoffs), independent of isSample
   AssertionError: expected 'book' to be 'excellent'
2. getReviewPly applies real classification to a non-sample game too, given real classCodes
   AssertionError: expected null to be 'blunder'
3. getReviewPly shows no classification/coach-classification text when classCodes has no entry yet for this ply (analysis not ready)
   AssertionError: expected 'book' to be null
```
Matches the brief's predicted failure mode exactly (5th arg silently ignored,
old `isSample` gate still in control).

**After implementation:**
```
PASS (20) FAIL (0)
```
All 20 tests in the file pass (17 previously-passing + 3 new/rewritten).

## Commit

- `842fc31` — `feat: getReviewPly classifies from real classCodes, not the isSample mock gate`
  - Files: `src/lib/game/review.ts`, `src/lib/game/review.test.ts` only.
  - Verified via `git status` after commit that only these two files were staged
    and committed — the working tree had several pre-existing unrelated modified
    files (`.superpowers/sdd/progress.md`, `task-1/2-brief.md`, `task-1/2-report.md`,
    `task-3-brief.md`) and two untracked docs files present before I started; none
    of those were touched or included in this commit.

## Self-review

- Followed TDD as instructed: wrote the exact tests from the brief first, ran
  them to confirm the predicted red state, then applied the exact
  implementation diff from the brief, then confirmed green.
- The implementation diff matches the brief's "Replace..." blocks verbatim
  (constant text, function signature, and classCode derivation).
- The only deviation from the brief's literal text is the file-level doc
  comment update at the top of `review.ts` (not in the brief's diff). I judged
  leaving it as-is would be actively misleading (it explicitly claimed
  classification is "applied ONLY when `game.isSample` is true," which the new
  code contradicts), so I corrected it. This is a comment-only change with zero
  behavioral effect and doesn't touch any code path the tests exercise.
- Nothing questionable found: `AnalysisTab.svelte` and `GameReviewScreen.svelte`
  still call `getReviewPly` with only 4 args, so they'll keep getting the mock
  `CLASS_CODES` default until Tasks 4-5 wire in `appState.classCodes` — this is
  explicitly the brief's stated scope boundary ("5th parameter, consumed by
  Tasks 4-5"), not an oversight.
- Note: this report file previously contained a stale report for a different,
  earlier "Task 3" (accuracy.ts work, commit cb5ccea) — that content has been
  fully replaced here since it described unrelated prior work, not this task.
