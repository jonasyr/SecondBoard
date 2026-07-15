# Task 6 Report: animateSlide()

## Summary

Implemented `animateSlide(boardEl, fromSq, toSq)` in `src/lib/board/animate-slide.ts`, an imperative DOM
function that clones a landing piece sprite, positions the clone over the from-square, hides the real
piece, and transitions the clone's `transform` to the to-square delta, cleaning up on `transitionend` or a
300ms safety timeout. Ported verbatim from the task brief (based on the reference's `_animateMove()` steps
3-5, LOGIC.md §2.4).

## Files changed

- Created: `src/lib/board/animate-slide.ts`
- Created: `src/lib/board/animate-slide.test.ts`

No other files were modified.

## TDD evidence

**RED (Step 2):** Ran `npm run test -- --run src/lib/board/animate-slide.test.ts` before creating the
implementation file. Result: 1 failed suite — `Failed to resolve import "./animate-slide"` (module did not
exist), 0 tests collected. Confirms the test file was in place and failing for the expected reason.

**GREEN (Step 4):** After creating `animate-slide.ts` per the brief, reran the same command:
`Test Files 1 passed (1)`, `Tests 5 passed (5)`.

**Full suite:** `npm run test -- --run` → `Test Files 19 passed (19)`, `Tests 82 passed (82)`.

**Typecheck:** `npm run check` → `COMPLETED 413 FILES 0 ERRORS 3 WARNINGS` (the 3 warnings are pre-existing,
unrelated `app-region` CSS warnings in `TitleBar.svelte`).

## Test cases (5, all passing)

1. Clones the destination piece, hides the original, positions the clone over the from-square (absolute
   position, left/top set from the from-square's rect delta to the board).
2. Transitions the clone's `transform` to the from->to delta with the exact transition string
   `transform .17s cubic-bezier(.33,.9,.35,1)`.
3. Removes the clone and restores visibility after the 300ms safety timeout (`vi.useFakeTimers()` +
   `vi.advanceTimersByTime(300)`).
4. No-op when `fromSq === toSq` (no clone created).
5. Clears any stale `[data-sb-clone="1"]` element and any lingering `visibility: hidden` state from a
   previous animation before starting a new one.

## Self-review (per task checklist)

- **Cleanup of stale clones/visibility at the START of every call:** Yes. The function's first two
  statements (before the `fromSq === toSq` early-return) unconditionally remove all `[data-sb-clone="1"]`
  elements and reset `visibility` on every `.piece` under `[data-sq]`, regardless of whether this call will
  itself animate anything. This runs even on the no-op path, satisfying the "no-op" test's implicit
  expectation and the "clears stale clone" test explicitly.
- **`transitionend` listener is one-time and doesn't leak:** Yes. Registered with `{ once: true }`, so the
  browser (or jsdom, if it ever synthesizes the event) auto-removes it after first invocation. It only
  references `clone` and `landing`, both of which are eligible for GC once the clone is removed from the
  DOM and no other reference is retained.
- **300ms safety timeout handles double-cleanup safely:** Yes. `cleanup` calls `clone.remove()` and resets
  `landing.style.visibility = ''`. Both operations are idempotent — calling `.remove()` on an already-removed
  node is a no-op in the DOM spec, and resetting `visibility` to `''` when it's already `''` has no effect.
  So whichever of `transitionend`/`setTimeout` fires first, a hypothetical second invocation is harmless.
  There is no explicit guard flag, but none is needed given both operations are naturally idempotent.
- **No `any`, no scope creep:** Confirmed — no `any` used; used `HTMLElement`/`Element` typed
  `querySelector`/`querySelectorAll` generics throughout. No files beyond the two specified were created or
  modified. Implementation matches the brief exactly (no embellishment).

## Commit

```
03d923b feat: add animateSlide DOM clone/transition for the piece-slide animation
```

## Concerns

None. The `getBoundingClientRect` mocking pattern (via `vi.spyOn(el, 'getBoundingClientRect').mockReturnValue(...)`)
and `vi.useFakeTimers()` + `vi.advanceTimersByTime(300)` both worked exactly as written in the brief with no
adjustments needed — jsdom respects spied `getBoundingClientRect`, and fake timers correctly trigger the
`setTimeout`-based safety cleanup without needing to simulate a real `transitionend` event (jsdom doesn't
dispatch CSS transition events, so the tests intentionally exercise only the timeout path, which the brief's
test 3 does).

Note: this file previously contained a stale report from a different iteration's "Task 6" (SidebarNavItem
component); it has been overwritten with this iteration's animateSlide report.

## Fix: review finding — transitionend cleanup path not exercised

**Finding:** Test 3 only advances fake timers to trigger the `setTimeout` fallback. No test dispatched a
`transitionend` event on the clone to verify that pathway independently triggers cleanup, and no test
demonstrated that a subsequent timer expiry after `transitionend` already fired doesn't cause a
double-firing/double-cleanup error.

**Fix:** Added one new test to `src/lib/board/animate-slide.test.ts` (`removes the clone and restores
visibility when transitionend fires, and a later timer expiry does not double-fire or throw`):
1. Calls `animateSlide(board, 'e2', 'e4')`.
2. Dispatches `clone.dispatchEvent(new Event('transitionend'))` manually (jsdom does not synthesize real CSS
   transition events, but this works fine to trigger the listener registered via
   `clone.addEventListener('transitionend', cleanup, { once: true })`).
3. Asserts the clone is removed and the landing piece's `visibility` is restored to `''`.
4. Then advances fake timers by 300ms (`vi.advanceTimersByTime(300)`) and asserts this does not throw, and
   that DOM state remains correctly cleaned up (clone still absent, visibility still `''`) — demonstrating
   the idempotent double-fire safety.

No changes were made to `animate-slide.ts` — the implementation logic was already correct and idempotent;
this was a test-coverage-only fix.

**Verification:**

```
$ npm run test -- --run src/lib/board/animate-slide.test.ts

 RUN  v4.1.10 C:/Users/JW/Documents/Code/SecondBoard
 Test Files  1 passed (1)
      Tests  6 passed (6)
   Start at  12:55:05
   Duration  5.00s (transform 117ms, setup 0ms, import 160ms, tests 133ms, environment 4.09s)
```

All 6 tests pass (5 original + 1 new).

**Commit:** (see below)
