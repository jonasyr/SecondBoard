# Chess.com Classification Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the supplied official-replica Chess.com SVGs and colors for every move classification and its associated highlights.

**Architecture:** Move the source asset collection into `$lib/assets`, expose the ten runtime SVG URLs through one typed mapping, and attach each URL and exact SVG fill to the central classification token. Existing classification consumers continue reading the central token, while reusable and board-square badges switch from drawn text circles to the supplied SVG images.

**Tech Stack:** Svelte 5, TypeScript 6, Vite SVG URL imports, Vitest 4, Testing Library Svelte

## Global Constraints

- Do not change classification calculations.
- Do not implement phase ratings or special-classification detection.
- Do not redesign Review layout, spacing, typography, or unrelated controls.
- Preserve the unrelated working-tree modification in `Board.svelte` except for narrowly required icon/highlight integration edits.
- Use the exact `icon-background` fill from each supplied SVG.

---

### Task 1: Asset mapping, official palette, and reusable badges

**Files:**
- Move: `docs/ChessComAnalysisIcons` → `src/lib/assets/chesscom-analysis-icons`
- Create: `src/lib/assets/classification-icons.ts`
- Modify: `src/lib/tokens.ts`
- Modify: `src/lib/tokens.test.ts`
- Modify: `src/lib/components/ClassBadge.svelte`
- Modify: `src/lib/components/ClassBadge.test.ts`

**Interfaces:**
- Produces: `CLASSIFICATION_ICONS: Record<ClassCode, string>`.
- Extends: `TOKENS.classification[code]` with `icon: string` while retaining `name`, `word`, `color`, and `glyph`.

- [ ] **Step 1: Move the supplied asset collection**

Run `mv docs/ChessComAnalysisIcons src/lib/assets/chesscom-analysis-icons`. Verify all ten required SVG files exist under `src/lib/assets/chesscom-analysis-icons/svg/`.

- [ ] **Step 2: Write failing token and reusable badge tests**

Update `tokens.test.ts` to assert all ten exact colors and mappings such as `great.icon` containing `great_find.svg` and `miss.icon` containing `missed_win.svg`. Update `ClassBadge.test.ts` to expect an `<img class="classification-icon">` whose `src` contains the mapped filename and whose `alt` is the classification name.

- [ ] **Step 3: Verify RED**

Run:

```bash
npm test -- --run src/lib/tokens.test.ts src/lib/components/ClassBadge.test.ts
```

Expected: FAIL because token icons do not exist and `ClassBadge` still renders glyph text.

- [ ] **Step 4: Add the typed SVG map and official token values**

Create `classification-icons.ts` with `?url` imports for `brilliant`, `great_find`, `best`, `excellent`, `good`, `book`, `inaccuracy`, `mistake`, `missed_win`, and `blunder`, then export the `ClassCode` record. Update `TOKENS.classification` to use the exact palette from the spec and corresponding mapped URL. Remove the duplicate `TOKENS.review.moveTint` record; MoveList will consume classification colors directly in Task 2.

- [ ] **Step 5: Render the official image in ClassBadge**

Keep the sized outer span for layout and add:

```svelte
<img class="classification-icon" src={cls.icon} alt={cls.name} />
<span class="glyph-fallback" aria-hidden="true">{cls.glyph}</span>
```

Hide `.glyph-fallback` visually when the image loads normally and size the image to `100%` of the badge.

- [ ] **Step 6: Verify GREEN**

Run the two focused test files and expect all tests to pass.

---

### Task 2: Board badges and classification-colored move highlighting

**Files:**
- Modify: `src/lib/board/build-squares.ts`
- Modify: `src/lib/board/build-squares.test.ts`
- Modify: `src/lib/components/Board.svelte`
- Modify: `src/lib/components/BoardSquare.svelte`
- Modify: `src/lib/components/BoardSquare.test.ts`
- Modify: `src/lib/components/MoveList.svelte`
- Modify: `src/lib/components/MoveList.test.ts`
- Modify: `src/lib/charts/eval-graph.test.ts`

**Interfaces:**
- Extends `BuildBoardSquaresOptions.badge` with `icon: string`.
- Extends `BoardSquareVM` with `badgeIcon: string`.
- `MoveList.cellStyle(sel, code)` reads `TOKENS.classification[code].color` for classified selected and unselected moves.

- [ ] **Step 1: Write failing board and move-highlight tests**

Update board-square construction/render tests to pass `icon: '/best.svg'`, expect `badgeIcon`, and expect an image with that source. Add a MoveList test selecting a `mistake` move and expect `#e58f2a` in its inline background, foreground, and inset outline; retain the existing unclassified teal fallback assertion. Update the eval-graph Brilliant expectation to `#1bada6`.

- [ ] **Step 2: Verify RED**

Run:

```bash
npm test -- --run src/lib/board/build-squares.test.ts src/lib/components/BoardSquare.test.ts src/lib/components/MoveList.test.ts src/lib/charts/eval-graph.test.ts
```

Expected: FAIL because board badges do not carry icon URLs and classified selected moves still use fixed teal.

- [ ] **Step 3: Thread and render the board icon**

Add `badgeIcon` to the board view model, pass `TOKENS.classification[classCode].icon` from `Board.svelte`, and render `<img src={square.badgeIcon} alt={square.badgeGlyph} />` inside the existing positioned board badge. Remove the synthetic circle background, inset ring, and text-only styling while preserving position, size, z-index, and shadow.

- [ ] **Step 4: Use official classification colors for move-list styling**

For a classified move, return styles based on `TOKENS.classification[code].color`; selected cells use `${color}24` for background and `${color}4d` for the inset outline. If the selected move has no classification, retain the existing teal fallback. Unselected classified moves use the same official color as foreground.

- [ ] **Step 5: Verify focused tests and full validation**

Run:

```bash
npm test -- --run src/lib/tokens.test.ts src/lib/components/ClassBadge.test.ts src/lib/board/build-squares.test.ts src/lib/components/BoardSquare.test.ts src/lib/components/MoveList.test.ts src/lib/charts/eval-graph.test.ts
npm test -- --run
npm run check
```

Expected: all tests pass and Svelte check reports zero errors. Existing unrelated warnings may remain.
