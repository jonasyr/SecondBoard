# Task 9 Report: Temporary visual-verification harness

## Summary

Implemented per brief with one necessary adaptation to the existing `page.test.ts` (documented below). All required files created/modified; no other files touched.

## Files changed

- Created: `src/lib/board/dev-fixtures.ts` — verbatim port of `chess-mock.js` + `data.js` (Italian Game sample), with the mandated "TEMPORARY — DEV/QA-ONLY FIXTURE" warning banner as the file's leading comment, matching the brief verbatim.
- Created: `src/lib/board/dev-fixtures.test.ts` — the brief's 6 structural tests (positions length/shape, meta, classCodes, evalPerPly, bestMoves).
- Modified: `src/routes/+page.svelte` — replaced wholesale per brief Step 7 (screen-switcher placeholder + new `{#if appState.screen === 'review' && appState.gameLoaded}` branch rendering `<Board>` + Prev/Next/Flip controls sourced from `DEV_GAME`).
- Modified: `src/routes/page.test.ts` — added the brief's new harness test, plus one adaptation (see below).

## TDD evidence

**dev-fixtures.ts**
- RED: `npm run test -- --run src/lib/board/dev-fixtures.test.ts` failed with "Failed to resolve import './dev-fixtures'" (file didn't exist yet).
- GREEN: after writing the implementation, same command → `Test Files 1 passed (1)`, `Tests 6 passed (6)`.

**+page.svelte harness wiring**
- RED (new test only): before wiring, `npm run test -- --run src/routes/page.test.ts` failed the new "renders the temporary Board QA harness (64 squares)..." test with `expected [] to have a length of 64 but got +0` (placeholder had no `[data-sq]` elements).
- After wiring +page.svelte (brief Step 7), re-ran the same command: the new test passed, but this **also broke a pre-existing test** — see adaptation below.
- GREEN (final): `npm run test -- --run src/routes/page.test.ts` → `Test Files 1 passed (1)`, `Tests 5 passed (5)`.

## Adaptation: pre-existing test conflict (not in brief)

The existing test `'shows the Game Review placeholder once a game is loaded'` set `appState.gameLoaded = true` (leaving `appState.screen` at its default value `'review'`, per `defaultState` in `app-state.svelte.ts`) and asserted the placeholder text `'Game Review — scaffold OK'` was present.

Once the harness is wired, that exact combination (`screen==='review' && gameLoaded===true`) is precisely the condition that now renders `<Board>` instead of the placeholder — so that placeholder text becomes unreachable dead code for this state, and the old test failed with a `getByText` "unable to find an element" error (confirmed by running the suite after Step 7, before adapting).

This is the intentional, expected consequence of the harness superseding the placeholder for that specific state — exactly the scenario the task instructions anticipated ("adapt the brief's addition to fit cleanly ... this is a normal adaptation, not a blocker"). I updated the test in place to assert the new correct behavior:

```ts
it('renders the Board QA harness instead of a placeholder once a game is loaded on review', () => {
	appState.gameLoaded = true;
	const { queryByText, container } = render(Page);
	expect(queryByText('Game Review — scaffold OK')).toBeNull();
	expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
});
```

This is layered with, not duplicative of, the brief's own new test (which explicitly sets both `screen` and `gameLoaded`) — the adapted test also covers the "leave `screen` at its default `review` value" path, which the brief's added test doesn't exercise.

## Test results

- `npm run test -- --run src/lib/board/dev-fixtures.test.ts` → 6/6 passed.
- `npm run test -- --run src/routes/page.test.ts` → 5/5 passed.
- Full suite `npm run test -- --run` → **105/105 tests passed across 22 files**, no regressions.
- `npx svelte-check --tsconfig ./tsconfig.json` → 0 errors, 6 warnings (all pre-existing, in `Board.svelte`/`TitleBar.svelte`, unrelated to this task's changes).

## Self-review checklist

- [x] `dev-fixtures.ts` has the prominent "TEMPORARY — DEV/QA-ONLY FIXTURE. NOT PRODUCT CODE. DO NOT IMPORT ELSEWHERE." banner, verbatim from the brief.
- [x] `buildGame`/`applySan`/`canReach`/`clearPath`/`standardBoard` reproduce the reference engine's behavior for the 31-move sample game — verified by all 6 dev-fixtures tests (starting position, e4 opening ply, move meta, classCodes[30]==='brilliant', bestMoves[14] and [30]).
- [x] `+page.svelte` still shows the placeholder text for all other screens/states — verified by the `home` and `openings` tests (unchanged, still passing) and by the onboarding-default test (`gameLoaded=false` on `review`).
- [x] `src/lib/stores/app-state.svelte.ts` completely untouched — confirmed via `git diff --stat src/lib/stores/app-state.svelte.ts` (empty output) and `git status --short` (file not listed).
- [x] No `any` used anywhere in `dev-fixtures.ts`. No scope creep — `+page.svelte`'s harness is just `<Board>` + Prev/Next/Flip controls, not a full Game Review layout (no avatars, eval bar, or tabbed panel — those are explicitly deferred to Iteration 4 per the brief's own comment in the file).

## What I could and could NOT verify (visual/pixel fidelity)

**Could verify (structural/automated):**
- The harness renders exactly 64 `[data-sq]` squares (automated test).
- `dev-fixtures.ts`'s move-application logic produces the correct board state at every ply of the 31-move sample game, matching the reference engine's documented behavior for this specific game (automated test, including the brilliant-move classification at ply 31 and both best-move-arrow entries).
- The dev server (`npm run dev`) boots without errors (`VITE ... ready`) and serves the root route with `HTTP 200` under the default state (`gameLoaded=false`, so it serves the Onboarding placeholder, not the harness — consistent with `app-state.svelte.ts` being untouched).
- `svelte-check` reports 0 type errors on the full project after these changes.

**Could NOT verify (requires a human with a browser):**
- I cannot render a browser or capture screenshots in this environment, so I did **not** perform the pixel-comparison against `design_handoff_secondboard/reference/screens/2-game-review-analysis-tab.png` and `3-game-review-review-tab.png` described in brief Step 9 (square colors/radius/shadow match, the teal `brilliant` badge with pulsing ring on e5 at ply 31, coordinate label colors per square shade, the bent best-move arrow at ply 30, slide-animation on Prev/Next vs. no animation on Flip).
- I explicitly did **not** claim any visual/pixel match — this must be performed by a human running `npm run dev`, temporarily flipping `gameLoaded`'s default in `app-state.svelte.ts` (and reverting it afterward, which I did not need to do since I never made that edit), and eyeballing the rendered harness against the two reference screenshots.

## Concerns

- None blocking. The one adaptation (updating a pre-existing test whose asserted state became unreachable) is a natural, intentional consequence of wiring the harness and is documented above.
- The visual pixel-verification (brief Step 9) remains outstanding and requires a human with a browser — flagged clearly above and in my final report.
