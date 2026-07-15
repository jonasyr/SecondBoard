## Task 7: `EvalGraph.svelte` — Report

**Status:** DONE_WITH_CONCERNS (one test assertion adjusted; see below)

### Files changed
- Created `src/lib/components/EvalGraph.test.ts` (test-first, per brief)
- Created `src/lib/components/EvalGraph.svelte` (component, verbatim from brief)

Commit: `52dc696` — "feat: add EvalGraph component"

### Pre-work verification
Confirmed `$lib/charts/eval-graph.ts` exports `evalGraph(evalPerPly, classCodes, ply): EvalGraphResult` returning `{ evalLine, evalArea, evalDots, markerX, markerCX, markerCY }`, with `evalDots` built by iterating `i = 1..evalPerPly.length-1` and testing `classCodes[i-1]` against a `NOTABLE_CODES` set (`brilliant, great, excellent, inaccuracy, mistake, miss, blunder`). Confirmed `TOKENS.review.evalGraphBg/Area/Midline/Line` and `TOKENS.color.deepInsetBg` exist in `src/lib/tokens.ts` with the expected string values. No changes made to either file.

### Test commands run

1. **Before implementation (expect FAIL):**
   ```
   pnpm run test -- --run src/lib/components/EvalGraph.test.ts
   ```
   Result: `Failed to resolve import "./EvalGraph.svelte" — Does the file exist?` — confirmed failing as expected (component didn't exist yet).

2. **After implementation:**
   ```
   pnpm run test -- --run src/lib/components/EvalGraph.test.ts
   ```
   Result: `Test Files 1 failed | 27 passed (28)`, `Tests 127 passed (127)`. The one failed *suite* is `src/routes/page.test.ts`, failing on `Failed to resolve import "$lib/board/dev-fixtures"` — a pre-existing, unrelated transform error from a later/incomplete task migration (not touched by this task). All 127 individual tests, including the 3 in `EvalGraph.test.ts`, passed.

   Targeted confirmation:
   ```
   pnpm exec vitest run src/lib/components/EvalGraph.test.ts
   ```
   Result: `PASS (3) FAIL (0)`.

3. **Type check:**
   ```
   pnpm run check
   ```
   Result: `COMPLETED 431 FILES 3 ERRORS 6 WARNINGS 4 FILES_WITH_PROBLEMS`. All 3 errors are pre-existing and unrelated to this task:
   - `src/lib/game/review.ts:115,125` — `PieceType`/color literal mismatch (unrelated file, later-task migration).
   - `src/routes/+page.svelte:5` — `Cannot find module '$lib/board/dev-fixtures'` (unrelated, same missing-fixture issue as the test failure above).
   No errors or warnings originate from `EvalGraph.svelte` or `EvalGraph.test.ts`.

### Concern: adjusted one assertion in the brief's test (test 2, radius check)

The brief's Step 1 test code (verbatim) asserted:
```ts
expect(tall.querySelector('svg')!.getAttribute('style')).toContain('border-radius:8px');
```
i.e. no space after the colon. Running this against the verbatim component (which sets `style={`display:block;border-radius:${radius}px;`}`) failed:
```
AssertionError: expected 'display: block; border-radius: 8px;' to contain 'border-radius:8px'
Expected: "border-radius:8px"
Received: "display: block; border-radius: 8px;"
```

**Root cause traced (not a component bug):** Svelte 5 compiles a dynamic `style={expr}` binding on a plain DOM element to `$.set_style`, whose implementation (`node_modules/svelte/src/internal/client/dom/elements/style.js:41`) does `dom.style.cssText = next_style_attr` rather than `dom.setAttribute('style', next_style_attr)`. jsdom's `CSSStyleDeclaration` always re-serializes `cssText` with a space after each colon and semicolon-space between declarations. I verified this directly against jsdom in isolation (bypassing Svelte entirely):
```js
el.setAttribute('style', 'border-radius:8px;');  // -> "border-radius:8px;" (unchanged)
el.style.cssText = 'border-radius:8px;';          // -> "border-radius: 8px;" (reformatted)
```
So any Svelte component using `style={...}` on a raw element will, in this jsdom test environment, read back with `": "` spacing — independent of what string literal is written in the component. This is an environment/framework serialization detail, not a logic defect in the brief's component code.

**Fix applied:** rather than changing the component's rendering (which the task explicitly warns against doing to force a pass, in the context of test 3's dot count — the same principle applies here), I adjusted the two `toContain` calls in test 2 to expect `'border-radius: 8px'` / `'border-radius: 6px'` (with the space jsdom actually produces), and added a comment explaining why. The assertion's *intent* — verifying the correct radius per height — is unchanged; only the literal matched substring was corrected to match verified real behavior.

### Concern: test 3 fixture — verified correct as given, no change needed

Traced `evalGraph`'s dot logic against the brief's fixture in test 3:
- `evalPerPly = [0, 0.3, 0.2, 0.3]` (length 4), `classCodes = ['book', 'brilliant', 'good']`, `ply = 2`.
- Loop `i = 1..3`, testing `classCodes[i-1]`:
  - `i=1` → `classCodes[0] = 'book'` → not notable
  - `i=2` → `classCodes[1] = 'brilliant'` → notable → 1 dot
  - `i=3` → `classCodes[2] = 'good'` → not notable
- Result: exactly 1 notable dot + 1 marker circle = 2 `<circle>` elements, matching the brief's expected `toHaveLength(2)`. No fixture adjustment was needed; test passed as written.

### Summary
- No changes to `eval-graph.ts` or `tokens.ts`.
- `EvalGraph.svelte` implemented exactly per brief.
- One test assertion (radius style string) corrected from `'border-radius:8px'`/`'border-radius:6px'` to `'border-radius: 8px'`/`'border-radius: 6px'` to match verified jsdom/Svelte serialization behavior — not a change in test intent or component logic.
- All 3 EvalGraph tests pass; `pnpm run check` shows no new errors, only 3 pre-existing unrelated errors from a later-task's incomplete migration.
