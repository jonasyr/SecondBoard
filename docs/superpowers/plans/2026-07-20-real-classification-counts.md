# Real Classification Counts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render real White/Black move-classification counts in the Review tab instead of fixed mock counts.

**Architecture:** A pure game-layer helper aggregates the existing `ClassCode[]` by mover and preserves the ten-row display order. `ReviewTab` derives these rows from its existing `classCodes` prop and passes them explicitly into the presentational `BreakdownTable` component.

**Tech Stack:** TypeScript 6, Svelte 5, Vitest 4, Testing Library Svelte

## Global Constraints

- Leave phase ratings and phase detection unchanged.
- Do not add Brilliant, Great, Book, or Miss heuristics.
- Show zero for absent or unsupported classifications and before analysis finishes.
- Preserve the current ten-row visual order.

---

### Task 1: Aggregate and render real classification counts

**Files:**
- Create: `src/lib/game/breakdown.ts`
- Create: `src/lib/game/breakdown.test.ts`
- Modify: `src/lib/components/BreakdownTable.svelte`
- Modify: `src/lib/components/BreakdownTable.test.ts`
- Modify: `src/lib/components/ReviewTab.svelte`

**Interfaces:**
- Consumes: `ClassCode[]`, where index 0 is White and mover color alternates by index.
- Produces: `getBreakdownRows(classCodes: ClassCode[]): BreakdownRow[]` and `BreakdownRow = [ClassCode, number, number]`.

- [ ] **Step 1: Write failing aggregation tests**

Add tests asserting `getBreakdownRows(['best', 'best', 'mistake', 'best'])` reports Best as `[best, 1, 2]`, Mistake as `[mistake, 1, 0]`, retains ten rows, and returns zero counts for Brilliant/Great/Book/Miss and for an empty input.

- [ ] **Step 2: Run aggregation tests to verify RED**

Run: `npm test -- --run src/lib/game/breakdown.test.ts`

Expected: FAIL because `./breakdown` does not exist.

- [ ] **Step 3: Implement the pure aggregation helper**

Create a fixed ordered `ClassCode[]`, initialize each row to zero, increment the White count for even indexes and Black count for odd indexes, then return rows in the fixed order.

- [ ] **Step 4: Run aggregation tests to verify GREEN**

Run: `npm test -- --run src/lib/game/breakdown.test.ts`

Expected: PASS.

- [ ] **Step 5: Write the failing component test**

Change `BreakdownTable.test.ts` to render the component with explicit rows containing distinctive values and assert those values render, proving it no longer reads mock counts.

- [ ] **Step 6: Run the component test to verify RED**

Run: `npm test -- --run src/lib/components/BreakdownTable.test.ts`

Expected: FAIL because `BreakdownTable` does not accept or render the supplied `rows` prop.

- [ ] **Step 7: Wire the helper into the Review tab**

Make `BreakdownTable` require a `rows: BreakdownRow[]` prop and iterate over it. In `ReviewTab`, derive `breakdownRows = getBreakdownRows(classCodes)` and render `<BreakdownTable rows={breakdownRows} />`.

- [ ] **Step 8: Verify focused and full project checks**

Run:

```bash
npm test -- --run src/lib/game/breakdown.test.ts src/lib/components/BreakdownTable.test.ts
npm test -- --run
npm run check
```

Expected: all tests pass and Svelte check reports zero errors.

