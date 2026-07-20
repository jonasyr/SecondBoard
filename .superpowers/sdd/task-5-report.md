# Task 5 Report: `AccuracyBlock.svelte` — render real winner + accuracy

## Status: DONE

## What Was Implemented

Converted `AccuracyBlock.svelte` from a hardcoded mock-driven component to a props-driven component that renders real accuracy data and dynamically highlights the real winner.

### Changes Made

**Files Modified:**
1. `src/lib/components/AccuracyBlock.test.ts` - Replaced with new test suite
2. `src/lib/components/AccuracyBlock.svelte` - Rewrote to accept and render props

### Key Changes

1. **Props Introduction**
   - Added `AccuracySide` type import from `$lib/game/review`
   - Defined `Props` interface with `white`, `black`, and `resultLabel`
   - Used Svelte 5 `$props()` rune to destructure props

2. **Dynamic Rendering**
   - Replaced hardcoded `PLAYERS.white.name/initial/accuracy` with `white.name/initial/accuracy`
   - Replaced hardcoded `PLAYERS.black.name/initial/accuracy` with `black.name/initial/accuracy`
   - Replaced hardcoded `0–1` result with dynamic `{resultLabel}`

3. **Dynamic Tinting (Winner Highlighting)**
   - White avatar: `class:tinted={white.isWinner}` / `class:neutral={!white.isWinner}`
   - Black avatar: `class:tinted={black.isWinner}` / `class:neutral={!black.isWinner}`
   - Same applied to accuracy chips
   - Winner gets green border/glow ring; loser/draw gets neutral border

4. **Null Safety**
   - Used nullish coalescing: `{white.accuracy ?? '—'}` and `{black.accuracy ?? '—'}`
   - Displays em-dash when accuracy is null instead of showing a fabricated number

5. **Preserved Scope**
   - Kept Game Rating row exactly as-is (still uses mock `PLAYERS.white/black.gameRating`)
   - Kept all CSS unchanged (same class names and styles)
   - PLAYERS import retained only for the intentionally-mocked Game Rating row

## Test Results

### RED State (Before)
```
PASS (0) FAIL (4)

1. AccuracyBlock renders both players' real names, accuracy, and the real result label
   TestingLibraryElementError: Unable to find an element with the text: Donald Byrne
   
2. AccuracyBlock renders "—" instead of a fabricated number when accuracy is null
   TestingLibraryElementError: Unable to find an element with the text: Robert Fischer
   
3. AccuracyBlock highlights the real winner's avatar/chip, not always Black
   AssertionError: expected false to be true
   
4. AccuracyBlock tints neither side on a draw
   AssertionError: expected true to be false
```

**Expected failures confirmed:** All 4 tests failed as expected because component still rendered hardcoded PLAYERS mock data.

### GREEN State (After)
```
PASS (4) FAIL (0)
```

**All tests passing:**
1. ✅ Renders both players' real names, accuracy, and the real result label
2. ✅ Renders "—" instead of a fabricated number when accuracy is null
3. ✅ Highlights the real winner's avatar/chip, not always Black
4. ✅ Tints neither side on a draw

## Self-Review Findings

✅ **Winner highlighting works correctly:**
- When `isWinner: true`, the `.tinted` class is applied (green border + glow)
- When `isWinner: false`, the `.neutral` class is applied (light border)
- This is dynamic based on props, not hardcoded to Black

✅ **Draw handling:**
- When both players have `isWinner: false`, both get `.neutral` class
- Neither side is tinted on a draw (test confirms: '½–½' case with both false)

✅ **Null accuracy handling:**
- `white.accuracy ?? '—'` and `black.accuracy ?? '—'` properly render em-dash
- Test verifies this: when accuracy is null, 3x '—' appear (2 chips + result)

✅ **PLAYERS import usage:**
- Only used for the Game Rating row (still hardcoded as per plan)
- Name, initial, accuracy all come from props
- No mock data used for the accuracy section

✅ **Test output pristine:**
- All 4 tests pass
- Component correctly responds to all prop variations

✅ **CSS unchanged:**
- Style block is identical to original
- Only the `<script>` and template markup changed
- `class:tinted`/`class:neutral` directives properly control styling

## Commit Information

**SHA:** `6f6bcc2`
**Message:** `feat: wire AccuracyBlock to the real winner and accuracy summary`

**Files committed:**
- `src/lib/components/AccuracyBlock.svelte`
- `src/lib/components/AccuracyBlock.test.ts`

## Concerns: None

The implementation matches the brief exactly. All tests pass. Component is ready for Task 6 (ReviewTab integration).
