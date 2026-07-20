# Task 7 Report: `TitleBar.svelte` — Native-Style Controls, Moved Top-Right

## Implementation Summary

Successfully completed TDD implementation following the exact specifications in `task-7-brief.md`:

1. **Replaced test file** with new test suite that validates:
   - "Local · Offline" pill is no longer rendered
   - Version string still renders
   - Window controls are positioned in `.right` after the version string (trailing-edge)
   - All three button click handlers work correctly

2. **Replaced component** with native-Windows-style window controls:
   - Moved `.window-controls` from first child (top-left) to last child inside `.right` (top-right)
   - Replaced decorative `.dot` buttons with proper `.win-btn` buttons
   - Removed entire `.status-pill` markup and all related styles
   - Updated button SVGs to be thin-line native-Windows glyphs (minimize, maximize, close)
   - Implemented native hover behavior (light gray on most, red #e81123 on close)
   - Changed `.title-bar` padding from `0 14px` to `0 0 0 14px` to let buttons reach true corner

## Test Results

### RED Phase (Initial Test Run)
Command: `pnpm exec vitest run src/lib/components/TitleBar.test.ts`

**Result:** 2 FAIL, 4 PASS
- ✗ "does not render the "Local · Offline" pill anymore" — FAILED (pill still rendered)
- ✗ "renders the window controls after the version string, at the trailing edge of the bar" — FAILED (controls not in correct position)
- ✓ All other tests passed (title text, version string renders, click handlers exist)

### GREEN Phase (After Implementation)
Command: `pnpm exec vitest run src/lib/components/TitleBar.test.ts`

**Result:** 6 PASS, 0 FAIL ✓
- ✓ renders the window title text
- ✓ does not render the "Local · Offline" pill anymore, but keeps the version string
- ✓ renders the window controls after the version string, at the trailing edge of the bar
- ✓ calls minimizeWindow when the minimize button is clicked
- ✓ calls toggleMaximizeWindow when the maximize button is clicked
- ✓ calls closeWindow when the close button is clicked

### Full Suite Verification
Command: `pnpm exec vitest run`

**Result:** SUCCESS (exit code 0) — All tests across the entire repo pass, no regressions introduced.

### Type Checking
Command: `pnpm check`

**Result:** 0 ERRORS (14 warnings are pre-existing Svelte compiler warnings unrelated to this change)
- Warnings about `app-region` property in TitleBar are pre-existing (Tauri-specific CSS, valid)
- No new warnings introduced by this change

### Linting
Command: `pnpm lint`

**Result:** ESLint: No issues found ✓ (clean)

## Self-Review Findings

✓ **Pill Removal:** "Local · Offline" pill (`<div class="status-pill">...</div>`) completely removed, along with all related CSS classes (`.status-pill`, `.status-dot`, `.status-text`)

✓ **Window Controls Position:** Window controls now positioned as last child inside `.right`, after the version string, at trailing-edge (top-right corner). Uses `align-self: stretch` to fill full title bar height.

✓ **Button Attributes:** All three buttons maintain their exact `title` attributes:
- "Minimize" → triggers `minimizeWindow`
- "Maximize" → triggers `toggleMaximizeWindow`
- "Close" → triggers `closeWindow`

✓ **Native Styling:** 
- Close button shows red background (#e81123) on hover
- Other buttons show light gray hover (rgba(255, 255, 255, 0.08))
- Buttons use thin-line SVG glyphs matching Windows convention
- 44px wide buttons with proper alignment

✓ **Padding:** `.title-bar` padding changed from `0 14px` to `0 0 0 14px`, allowing window controls to reach the true top-right corner while keeping the title centered via flexbox gaps

✓ **Test Output:** Pristine — all 6 tests pass, no flakes, no warnings
✓ **Lint Output:** Clean — no linting issues introduced
✓ **Svelte Check:** No new warnings introduced

## Files Changed

- `src/lib/components/TitleBar.svelte` (119 insertions/deletions)
  - Removed `.dot` buttons and styling
  - Removed `.status-pill` markup and styling
  - Added `.win-btn` buttons with SVG glyphs
  - Moved window-controls to `.right` container as last child
  - Updated CSS for native Windows appearance

- `src/lib/components/TitleBar.test.ts` (24 insertions/deletions)
  - Updated test assertions to verify pill removal
  - Added position/order test using `compareDocumentPosition`
  - Updated button click test descriptions

## Commit

**Commit SHA:** `16564fb`
**Message:** `fix(titlebar): native-style window controls at top-right, drop Local/Offline pill`

## Concerns

None. The implementation follows the brief exactly, all tests pass, linting is clean, and full suite verification shows no regressions.
