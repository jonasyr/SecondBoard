# Iteration 4 — Game Review Screen (mock data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Onboarding (Paste PGN) screen and the primary Game Review screen — two-column board area + tabbed right panel (Analysis/Review/Details/Explore) + shared bottom eval-graph/nav bar — wired to the existing mock Italian Game data, replacing the temporary Iteration-3 Board harness. Pixel-identical to `design_handoff_secondboard/reference/screens/2-*.png` and `3-*.png`.

**Architecture:** Pure per-ply "review" data derivation (positions, classifications, captured material, coach text, move rows) lives in `src/lib/game/` as plain TypeScript, mirroring the `src/lib/board/` pattern from Iteration 3. Presentational Svelte components consume that data and `$lib/tokens`. `appState` (existing singleton) gains the screen/tab/ply transition functions the reference's `Component` class holds as methods. No Rust/Tauri backend work in this iteration — README §11 step 4 is explicit that the Game Review screen ships against mock data first; the engine/backend swap is steps 5-6.

**Tech Stack:** SvelteKit + Svelte 5 (runes), TypeScript strict, Vitest + `@testing-library/svelte`.

## Global Constraints

- **Fidelity is absolute.** Every value below (px, hex, gap, radius) is copied verbatim from `design_handoff_secondboard/reference/SecondBoard.dc.html` (markup lines 115-396, `Component` class lines 729-1335) and cross-checked against `README.md` §6.2/§6.3 and `LOGIC.md` §1-2, §4-5. Do not "clean up," round, or re-derive any value — if something looks wrong, re-open the reference file (this plan's Reference Value Tables below already extracted everything needed).
- **Mock data only.** `sanList`, `classCodes`, `evalPerPly`, `bestMoves`, `coachTextMap`, `breakdown`, `phases`, `players` all come from `design_handoff_secondboard/reference/logic/data.js` verbatim. They are explicitly MOCK CONTENT (README §8, LOGIC.md header table) to be replaced by real Rust `pgn`/`analysis`/`engine` output in later iterations. Every new file that carries this mock content MUST carry a banner comment saying so (matching the tone of the now-deleted `src/lib/board/dev-fixtures.ts`).
- **`pgnText` is cosmetic in this iteration.** The reference's own `startReview` handler ignores `this.state.pgnText` entirely and always loads the same hardcoded sample game — replicate that exactly. Do not parse the textarea contents. Do not wire "Upload .pgn" to a real file picker (no backend to hand it to yet); render it as an inert visual button, matching the reference (`onClick` is absent on that div in the source).
- **The Review tab's player labels are hardcoded, not flip-aware.** Lines 250-261 of the reference literally render the strings `"Jonas"` / `"DominikP"` and their fixed avatar/chip styles — unlike the board area's top/bottom rows, which swap on `flipped`. Reproduce this literal (arguably inconsistent) behavior; do not "fix" it into a flip-aware component. Likewise `engineLines`/`evalNow`/`showLinesTrack`/`showLinesKnob`/`coachBadgeSm` are computed by the reference's `renderVals()` but never referenced by any `{{ }}` hole in the Game Review markup — they are dead mock output. Do not port them; a reviewer must not flag their absence as a gap.
- **Reuse existing tokens; extend, don't redeclare.** `src/lib/tokens.ts` already has `TOKENS.classification` (CLS), `DARK_FG_CODES`, `NOT_BEST_CODES`. Task 1 extends `TOKENS` with the new colors/sizes this screen needs (avatar backgrounds, chip backgrounds, etc.) so no component hardcodes a hex literal that isn't either a `TOKENS` value or a one-off per-ply-computed color (e.g., a classification color come from `TOKENS.classification[code].color`, never repeated as a literal hex).
- **Do not touch `BoardSquare.svelte`'s existing 36px on-board badge.** It was implemented, tested, and reviewed in Iteration 3. The new `ClassBadge.svelte` component (Task 5) is for the *new* 16px/21px/22px badge usages only (move list, breakdown table, phase table).
- **Svelte 5 runes only** (`$state`, `$derived`, `$props`, `$effect`). TypeScript strict mode; no `any`.
- **Keyboard guard matches the reference exactly:** `ArrowLeft`/`ArrowRight` step `ply` only when `appState.screen === 'review'` — **not** additionally gated on `gameLoaded`. Clamp to `[0, sanList.length]` (`[0, 31]`).
- **Piece sprites:** reuse `PIECE_SPRITES` from `$lib/board/pieces` (already includes `?url&no-inline` imports) for the captured-material row; do not re-import the SVGs.
- File organization: many small files. Each new component gets its own `.svelte` + co-located `.test.ts`, following the `BoardSquare.svelte`/`Board.svelte` precedent (props via `$props()`, scoped `<style>`, `data-*` attributes for test hooks where useful).

## Reference Value Tables (copied verbatim — task steps cite these by name)

**Table A — Icon `d` paths** (all render via the existing `Icon.svelte`, which takes a single `d`; SVG allows multiple `M`-prefixed subpaths in one `d`, so multi-`<path>` reference icons are concatenated into one string with a space between subpaths — verified visually equivalent):
| Name | `d` | size | stroke | stroke-width |
|---|---|---|---|---|
| clipboard (paste sample) | `M9 5h6M9 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1` | 13 | `#4ADEA0` | 2 |
| arrow-right (Start Review) | `M5 12h13M12 5l7 7-7 7` | 16 | `#062018` | 2.4 |
| download (Upload .pgn) | `M12 3v12M7 10l5 5 5-5M5 21h14` | 15 | `#8A90A0` | 2 |
| plus (New PGN) | `M12 5v14M5 12h14` | 13 | `#4ADEA0` | 2.2 |
| sound | `M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14` | 15 | `#8A90A0` | 2 |
| flip-board | `M8 3L4 7l4 4 M4 7h11a5 5 0 0 1 5 5 M16 21l4-4-4-4 M20 17H9a5 5 0 0 1-5-5` | 15 | `#8A90A0` | 2 |
| tab: analysis | `M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4` | 15 | active `#4ADEA0` / inactive `#6B7180` | 2 |
| tab: review | `M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z` | 15 | active `#4ADEA0` / inactive `#6B7180` | 2 |
| tab: details | `M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01` | 15 | active `#4ADEA0` / inactive `#6B7180` | 2 |
| tab: explore | `M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 4-4 2 2-4z` | 15 | active `#4ADEA0` / inactive `#6B7180` | 2 |
| explain (Analysis tab) | `M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0 0 12 3z` | 15 | `#C7CCDA` | 2 |
| best-was arrow | `M5 12h13M12 5l7 7-7 7` | 14 | `#4ADEA0` | 2 |
| explore chevron | `M9 6l6 6-6 6` | 15 | `#4ADEA0` | 2 |
| nav: first | `M19 5v14M15 6l-7 6 7 6` | 16 | `#9298A8` | 2 |
| nav: prev | `M15 6l-6 6 6 6` | 16 | `#9298A8` | 2 |
| nav: next (small) | `M9 6l6 6-6 6` | 16 | `#9298A8` | 2 |
| nav: last | `M5 5v14M9 6l7 6-7 6` | 16 | `#9298A8` | 2 |

Two icons are **filled** (not stroke-based) and cannot go through `Icon.svelte` (which always renders `fill="none"`) — inline them as raw `<svg>`:
- Star badge (panel header, 23px circle): `<svg width="13" height="13" viewBox="0 0 24 24" fill="#062018" stroke="none"><path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z"/></svg>`
- Play triangle (bottom-bar big Next button): `<svg width="17" height="17" viewBox="0 0 24 24" fill="#062018" stroke="none"><path d="M7 5l12 7-12 7z"/></svg>`

**Table B — new TOKENS additions (Task 1 adds these to `TOKENS`, grouped under a new `TOKENS.review` key):**
```
avatarWhiteBg: '#EDEFF6', avatarWhiteBorder: 'rgba(255,255,255,.15)', avatarWhiteText: '#14161F',
avatarBlackBg: 'linear-gradient(135deg,#3B4252,#20222E)', avatarBlackBorder: 'rgba(255,255,255,.1)', avatarBlackText: '#C7CCDA',
clockActiveBg: 'rgba(45,224,206,.12)', clockActiveText: '#5EF0DE', clockInactiveBg: '#14161F', clockInactiveText: '#6B7180',
newGameBg: '#181A24', newGameBorder: 'rgba(255,255,255,.08)', newGameText: '#C7CCDA',
panelBg: '#101219' /* already TOKENS.color.panelBg, reuse it, do not re-add */,
evalGraphBg: '#20222E', evalGraphArea: '#EFF1F6', evalGraphMidline: '#2DE0CE', evalGraphLine: '#8A90A0',
chipNeutralBg: '#181A24', chipNeutralBorder: 'rgba(255,255,255,.1)', chipNeutralText: '#E3E6EE',
chipTintedBg: 'rgba(74,222,160,.06)', chipTintedBorder: 'rgba(74,222,160,.4)', chipTintedText: '#8FE9C2',
moveTint: { brilliant:'#5EF0DE', great:'#8FC0FF', best:'#C7CCDA', excellent:'#C7CCDA', good:'#C7CCDA', book:'#C7B79E', inaccuracy:'#F5B14C', mistake:'#F97A45', miss:'#C77DFF', blunder:'#F26B6B' },
capturedSpriteShadow: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.5))',
bottomBarBg: '#0C0E15' /* already TOKENS.color.bottomBarBg, reuse */,
navBtnBg: '#14161F', navBtnBorder: 'rgba(255,255,255,.07)', navBtnStroke: '#9298A8',
```
(Do not re-add anything already present in `TOKENS.color`/`TOKENS.classification` — the list above is genuinely new.)

---

## Task 1: Extend design tokens + port eval-graph math

**Files:**
- Modify: `src/lib/tokens.ts`
- Modify: `src/app.css` (no changes expected — tokens.ts already mirrors into CSS custom properties only for the root `:root` block; the new `TOKENS.review.*` values are consumed directly as JS style strings by components, not as CSS vars, matching how `TOKENS.classification` is already consumed in `Board.svelte`/`BoardSquare.svelte`. Skip if no CSS var is needed — confirm by grepping `app.css` for `--color-window-dot` pattern usage first.)
- Create: `src/lib/charts/eval-graph.ts`
- Test: `src/lib/charts/eval-graph.test.ts`

**Interfaces:**
- Produces: `TOKENS.review` object (see Table B above) — a `Record<string,string>`-shaped const, plus `TOKENS.review.moveTint: Record<ClassCode, string>`.
- Produces: `evalGraph(evalPerPly: number[], classCodes: ClassCode[], ply: number): EvalGraphResult` where
  ```ts
  export interface EvalGraphDot { cx: number; cy: number; color: string }
  export interface EvalGraphResult {
    evalLine: string;
    evalArea: string;
    evalDots: EvalGraphDot[];
    markerX: number;
    markerCX: number;
    markerCY: number;
  }
  ```

- [ ] **Step 1: Add `TOKENS.review` to `src/lib/tokens.ts`**

Add this block inside the `TOKENS` object (after `classification`, before the closing `} as const;`), importing nothing new:

```ts
	review: {
		avatarWhiteBg: '#EDEFF6',
		avatarWhiteBorder: 'rgba(255,255,255,.15)',
		avatarWhiteText: '#14161F',
		avatarBlackBg: 'linear-gradient(135deg,#3B4252,#20222E)',
		avatarBlackBorder: 'rgba(255,255,255,.1)',
		avatarBlackText: '#C7CCDA',
		clockActiveBg: 'rgba(45,224,206,.12)',
		clockActiveText: '#5EF0DE',
		clockInactiveBg: '#14161F',
		clockInactiveText: '#6B7180',
		newGameBg: '#181A24',
		newGameBorder: 'rgba(255,255,255,.08)',
		newGameText: '#C7CCDA',
		evalGraphBg: '#20222E',
		evalGraphArea: '#EFF1F6',
		evalGraphMidline: '#2DE0CE',
		evalGraphLine: '#8A90A0',
		chipNeutralBg: '#181A24',
		chipNeutralBorder: 'rgba(255,255,255,.1)',
		chipNeutralText: '#E3E6EE',
		chipTintedBg: 'rgba(74,222,160,.06)',
		chipTintedBorder: 'rgba(74,222,160,.4)',
		chipTintedText: '#8FE9C2',
		capturedSpriteShadow: 'drop-shadow(0 1px 1.5px rgba(0,0,0,.5))',
		navBtnBg: '#14161F',
		navBtnBorder: 'rgba(255,255,255,.07)',
		navBtnStroke: '#9298A8',
		moveTint: {
			brilliant: '#5EF0DE',
			great: '#8FC0FF',
			best: '#C7CCDA',
			excellent: '#C7CCDA',
			good: '#C7CCDA',
			book: '#C7B79E',
			inaccuracy: '#F5B14C',
			mistake: '#F97A45',
			miss: '#C77DFF',
			blunder: '#F26B6B'
		} satisfies Record<ClassCode, string>
	}
```

- [ ] **Step 2: Write the failing test for `evalGraph`**

```ts
// src/lib/charts/eval-graph.test.ts
import { describe, it, expect } from 'vitest';
import { evalGraph } from './eval-graph';
import type { ClassCode } from '$lib/types';

describe('evalGraph', () => {
	it('maps eval values to the 660x78 viewBox with a midline of 39', () => {
		const ev = [0, 0.3];
		const codes: ClassCode[] = ['best'];
		const result = evalGraph(ev, codes, 1);
		expect(result.evalLine).toBe('M0.0 39.0 L660.0 36.9');
		expect(result.evalArea).toBe('M0.0 39.0 L660.0 36.9 L660 78 L0 78 Z');
		expect(result.markerX).toBe(660);
		expect(result.markerCX).toBe(660);
		expect(result.markerCY).toBe(36.9);
	});

	it('clamps eval values to +/-5 before mapping to y', () => {
		const ev = [0, 12];
		const result = evalGraph(ev, ['best'], 1);
		expect(result.evalLine).toBe('M0.0 39.0 L660.0 5.0');
	});

	it('emits a dot only for notable classification codes, colored by TOKENS.classification', () => {
		const ev = [0, 0.3, 0.2, 0.3];
		const codes: ClassCode[] = ['book', 'brilliant', 'good'];
		const result = evalGraph(ev, codes, 0);
		expect(result.evalDots).toHaveLength(1);
		expect(result.evalDots[0]).toEqual({ cx: 220, cy: 36.9, color: '#2DE0CE' });
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- --run src/lib/charts/eval-graph.test.ts`
Expected: FAIL (module `./eval-graph` not found).

- [ ] **Step 4: Implement `src/lib/charts/eval-graph.ts`**

```ts
/**
 * Eval-graph geometry, ported verbatim from
 * design_handoff_secondboard/reference/logic/view-math.js's evalGraph()
 * (marked there as "NOT MOCKS — reusable as-is"; see LOGIC.md §3.1).
 * viewBox is always 0 0 660 78; the caller renders it at two different
 * SVG heights (66px in the Review tab, 62px in the shared bottom bar) —
 * that's purely a CSS/attribute concern on the <svg>, not this math.
 */
import { TOKENS } from '$lib/tokens';
import type { ClassCode } from '$lib/types';

export interface EvalGraphDot {
	cx: number;
	cy: number;
	color: string;
}

export interface EvalGraphResult {
	evalLine: string;
	evalArea: string;
	evalDots: EvalGraphDot[];
	markerX: number;
	markerCX: number;
	markerCY: number;
}

const NOTABLE_CODES = new Set<ClassCode>([
	'brilliant',
	'great',
	'excellent',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
]);

const W = 660;
const H = 78;
const MID = 39;

export function evalGraph(
	evalPerPly: number[],
	classCodes: ClassCode[],
	ply: number
): EvalGraphResult {
	const xOf = (i: number) => Number(((i / (evalPerPly.length - 1)) * W).toFixed(1));
	const yOf = (v: number) => Number((MID - (Math.max(-5, Math.min(5, v)) / 5) * 34).toFixed(1));

	const line = evalPerPly.map((v, i) => (i ? 'L' : 'M') + xOf(i) + ' ' + yOf(v)).join(' ');
	const area = line + ' L' + W + ' ' + H + ' L0 ' + H + ' Z';

	const dots: EvalGraphDot[] = [];
	for (let i = 1; i < evalPerPly.length; i++) {
		const code = classCodes[i - 1];
		if (NOTABLE_CODES.has(code)) {
			dots.push({ cx: xOf(i), cy: yOf(evalPerPly[i]), color: TOKENS.classification[code].color });
		}
	}

	return {
		evalLine: line,
		evalArea: area,
		evalDots: dots,
		markerX: xOf(ply),
		markerCX: xOf(ply),
		markerCY: yOf(evalPerPly[ply])
	};
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run src/lib/charts/eval-graph.test.ts`
Expected: PASS (3/3).

- [ ] **Step 6: Commit**

```bash
git add src/lib/tokens.ts src/lib/charts/eval-graph.ts src/lib/charts/eval-graph.test.ts
git commit -m "feat: add review-screen design tokens and eval-graph geometry"
```

---

## Task 2: Mock game data + mock chess engine (replaces `dev-fixtures.ts`)

**Files:**
- Create: `src/lib/game/mock-engine.ts`
- Create: `src/lib/game/mock-data.ts`
- Test: `src/lib/game/mock-engine.test.ts`
- Test: `src/lib/game/mock-data.test.ts`
- Delete: `src/lib/board/dev-fixtures.ts`, `src/lib/board/dev-fixtures.test.ts`

**Interfaces:**
- Consumes: `Position`, `Move`, `Piece` from `$lib/board/types`; `ClassCode` from `$lib/types`.
- Produces:
  - `mock-engine.ts`: `buildGame(sanList: string[]): { positions: Position[]; meta: Move[] }` (same signature `src/lib/board/dev-fixtures.ts` had internally, now exported).
  - `mock-data.ts`: `SAN_LIST: string[]`, `CLASS_CODES: ClassCode[]`, `EVAL_PER_PLY: number[]`, `BEST_MOVES: Record<number, Move & { san: string }>`, `COACH_TEXT_MAP: Record<ClassCode, string>`, `BREAKDOWN_ROWS: Array<[ClassCode, number, number]>`, `PHASE_ROWS: Array<[string, ClassCode, ClassCode]>`, `PLAYERS: { white: PlayerInfo; black: PlayerInfo }` where
    ```ts
    export interface PlayerInfo {
    	name: string;
    	rating: string;
    	initial: string;
    	clock: string;
    	accuracy: string;
    	gameRating: string;
    }
    ```

This task is **mechanical transcription**: `src/lib/board/dev-fixtures.ts` already contains a byte-for-byte port of `chess-mock.js` (the engine half) and part of `data.js` (the game half). Read it first (it still exists on disk at task-start time) and split it into the two new files, then add the additional `data.js` fields (`coachTextMap`, `breakdown`, `phases`, `players`) that `dev-fixtures.ts` never needed.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/game/mock-engine.test.ts
import { describe, it, expect } from 'vitest';
import { buildGame } from './mock-engine';

describe('buildGame', () => {
	it('produces one more position than the move count, starting from the standard array', () => {
		const { positions, meta } = buildGame(['e4', 'e5', 'Nf3']);
		expect(positions).toHaveLength(4);
		expect(meta).toHaveLength(3);
		expect(positions[0].e2).toEqual(['P', 'w']);
		expect(positions[1].e4).toEqual(['P', 'w']);
		expect(positions[1].e2).toBeUndefined();
		expect(meta[0]).toEqual({ from: 'e2', to: 'e4' });
	});

	it('handles castling by moving both king and rook', () => {
		const { positions } = buildGame(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'O-O']);
		const final = positions[positions.length - 1];
		expect(final.g1).toEqual(['K', 'w']);
		expect(final.f1).toEqual(['R', 'w']);
		expect(final.e1).toBeUndefined();
		expect(final.h1).toBeUndefined();
	});
});
```

```ts
// src/lib/game/mock-data.test.ts
import { describe, it, expect } from 'vitest';
import {
	SAN_LIST,
	CLASS_CODES,
	EVAL_PER_PLY,
	BEST_MOVES,
	COACH_TEXT_MAP,
	BREAKDOWN_ROWS,
	PHASE_ROWS,
	PLAYERS
} from './mock-data';

describe('mock-data', () => {
	it('keeps classCodes/evalPerPly aligned in length with sanList', () => {
		expect(CLASS_CODES).toHaveLength(SAN_LIST.length);
		expect(EVAL_PER_PLY).toHaveLength(SAN_LIST.length + 1); // includes ply 0
	});

	it('has a coach text entry for every classification code', () => {
		for (const code of CLASS_CODES) {
			expect(COACH_TEXT_MAP[code]).toBeTruthy();
		}
	});

	it('has 10 breakdown rows and 3 phase rows', () => {
		expect(BREAKDOWN_ROWS).toHaveLength(10);
		expect(PHASE_ROWS).toHaveLength(3);
	});

	it('defines both players with a gameRating', () => {
		expect(PLAYERS.white.gameRating).toBe('1712');
		expect(PLAYERS.black.gameRating).toBe('1994');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/game/`
Expected: FAIL (modules don't exist).

- [ ] **Step 3: Create `src/lib/game/mock-engine.ts`**

Move the `standardBoard`/`clearPath`/`canReach`/`applySan`/`buildGame` functions verbatim from `src/lib/board/dev-fixtures.ts` (lines 20-139 of that file) into this new file, exporting `buildGame`. Keep the same banner style but update the scope note:

```ts
/**
 * ============================================================================
 * MOCK — SAN-to-position engine. NOT PRODUCT LOGIC LONG-TERM.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/chess-mock.js.
 * LOGIC.md explicitly warns this is a MOCK: "In the REAL app you MUST NOT
 * ship this — replace it with the Rust `pgn` module using `shakmaty`"
 * (README §3, §8; LOGIC.md header table). It feeds the Game Review screen's
 * mock data (Iteration 4, README §11 step 4) until the Rust backend + shakmaty
 * land (README §11 steps 5-6), at which point this file is deleted.
 */
import type { Move, Piece, Position } from '$lib/board/types';

const FILES = 'abcdefgh';

// [standardBoard, clearPath, canReach, applySan, buildGame — copied verbatim
//  from src/lib/board/dev-fixtures.ts's identical functions]
```

(The implementer copies the five functions' bodies unchanged — they are pure and already TypeScript-strict from Iteration 3; only the import path for `Move`/`Piece`/`Position` changes from `'./types'` to `'$lib/board/types'`.)

- [ ] **Step 4: Create `src/lib/game/mock-data.ts`**

```ts
/**
 * ============================================================================
 * MOCK CONTENT — the sample Italian Game shown by the Game Review screen.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/data.js.
 * sanList/classCodes/evalPerPly/bestMoves stand in for Rust pgn+analysis+
 * engine output (README §8 mapping table). coachTextMap/breakdown/phases/
 * players stand in for backend-computed screen content (same table). Replace
 * piece by piece as each real data source lands (README §11 steps 5-8);
 * CLS itself (name/word/color/glyph) is NOT mock — that already lives in
 * TOKENS.classification (src/lib/tokens.ts) and must not be redeclared here.
 */
import type { ClassCode } from '$lib/types';
import type { Move } from '$lib/board/types';
import { buildGame } from './mock-engine';

export const SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];

export const CLASS_CODES: ClassCode[] = [
	'book', 'book', 'book', 'book', 'book', 'book', 'best', 'good', 'good', 'good',
	'best', 'best', 'good', 'inaccuracy', 'best', 'good', 'good', 'good', 'best',
	'good', 'good', 'good', 'excellent', 'good', 'best', 'good', 'great', 'good',
	'best', 'inaccuracy', 'brilliant'
];

export const EVAL_PER_PLY = [
	0, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.35, 0.25, 0.3, 0.25, 0.3, 0.3, 0.35, 0.1,
	0.4, 0.3, 0.35, 0.3, 0.5, 0.4, 0.45, 0.3, 0.7, 0.55, 0.8, 0.7, 1.3, 1.05, 1.5,
	1.0, 2.37
];

export const BEST_MOVES: Record<number, Move & { san: string }> = {
	14: { from: 'c8', to: 'g4', san: 'Bg4' },
	30: { from: 'f6', to: 'g4', san: 'Ng4' }
};

export const COACH_TEXT_MAP: Record<ClassCode, string> = {
	brilliant:
		"This move creates a strong threat and keeps control of the center. The knight can't be captured without losing material.",
	great: 'The strongest move on the board — precise and forcing.',
	best: "Engine's top choice. Nothing better in the position.",
	excellent: 'Nearly perfect — it keeps your advantage fully intact.',
	good: 'A solid, healthy move that maintains the balance.',
	book: 'Still following well-known opening theory.',
	inaccuracy: 'A small slip — there was a more accurate continuation here.',
	mistake: 'This lets your opponent back into the game.',
	miss: 'You overlooked a much stronger tactic in this position.',
	blunder: 'A costly error — this swings the evaluation sharply.'
};

export const BREAKDOWN_ROWS: Array<[ClassCode, number, number]> = [
	['brilliant', 1, 2],
	['great', 2, 5],
	['best', 22, 20],
	['excellent', 13, 12],
	['good', 8, 12],
	['book', 6, 6],
	['inaccuracy', 4, 3],
	['mistake', 3, 2],
	['miss', 2, 1],
	['blunder', 2, 1]
];

export const PHASE_ROWS: Array<[string, ClassCode, ClassCode]> = [
	['Opening', 'great', 'good'],
	['Middlegame', 'best', 'excellent'],
	['Endgame', 'inaccuracy', 'good']
];

export interface PlayerInfo {
	name: string;
	rating: string;
	initial: string;
	clock: string;
	accuracy: string;
	gameRating: string;
}

export const PLAYERS: { white: PlayerInfo; black: PlayerInfo } = {
	white: {
		name: 'Jonas',
		rating: '1867',
		initial: 'J',
		clock: '4:12',
		accuracy: '82.6',
		gameRating: '1712'
	},
	black: {
		name: 'DominikP',
		rating: '2043',
		initial: 'D',
		clock: '3:47',
		accuracy: '89.1',
		gameRating: '1994'
	}
};

const built = buildGame(SAN_LIST);
export const MOCK_POSITIONS = built.positions;
export const MOCK_MOVE_META = built.meta;
```

- [ ] **Step 5: Delete the Iteration-3 harness files**

```bash
git rm src/lib/board/dev-fixtures.ts src/lib/board/dev-fixtures.test.ts
```

- [ ] **Step 6: Run tests to verify they pass and nothing else references the deleted files**

Run: `npm run test -- --run`
Expected: `src/lib/game/*.test.ts` pass; no failures from a stale import of `$lib/board/dev-fixtures` (Task 19 rewires `+page.svelte`, which is the only other consumer — confirm with a repo-wide search before considering this task done: `grep -rn "dev-fixtures" src/`. If `+page.svelte` still imports it, that's expected until Task 19 — the app will fail to build/typecheck in the interim, which is acceptable mid-plan and resolved by Task 19).

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/mock-engine.ts src/lib/game/mock-data.ts src/lib/game/mock-engine.test.ts src/lib/game/mock-data.test.ts
git commit -m "feat: add mock game engine and Italian Game review data"
```

---

## Task 3: Game review per-ply derivation logic

**Files:**
- Create: `src/lib/game/review.ts`
- Test: `src/lib/game/review.test.ts`

**Interfaces:**
- Consumes: `MOCK_POSITIONS`, `MOCK_MOVE_META`, `CLASS_CODES`, `EVAL_PER_PLY`, `BEST_MOVES`, `PLAYERS` from `./mock-data`; `capturedInfo`, `evalBarPct` from `$lib/board/geometry`; `TOKENS`, `NOT_BEST_CODES` from `$lib/tokens`; `Position`, `Move` from `$lib/board/types`; `ClassCode` from `$lib/types`.
- Produces:
  ```ts
  export interface ReviewPly {
  	position: Position;
  	lastMove: Move | null;
  	classCode: ClassCode | null; // null only at ply 0
  	best: (Move & { san: string }) | null;
  	evalNum: number;
  	evalStr: string; // '+0.30' style, signed
  	whitePct: number; // 0-100
  	coachMove: string; // '16. Ne5' / '15... d5' / 'Start'
  	coachText: string;
  }

  export function getReviewPly(ply: number): ReviewPly;

  export interface PlayerRowData {
  	name: string;
  	rating: string;
  	initial: string;
  	isWhite: boolean;
  	clock: string;
  	clockActive: boolean;
  	captured: Array<{ color: 'w' | 'b'; type: 'P' | 'N' | 'B' | 'R' | 'Q' }>;
  	adv: string | null; // '+3' or null
  }

  export function getPlayerRows(
  	ply: number,
  	flipped: boolean
  ): { top: PlayerRowData; bottom: PlayerRowData };
  ```

This is the one task in this iteration requiring judgment (porting `renderVals()`'s per-ply branch logic, lines 1221-1262 of the reference, into idiomatic derived functions rather than one giant object literal).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/game/review.test.ts
import { describe, it, expect } from 'vitest';
import { getReviewPly, getPlayerRows } from './review';

describe('getReviewPly', () => {
	it('ply 0 has no lastMove/classCode and the intro coach text', () => {
		const r = getReviewPly(0);
		expect(r.lastMove).toBeNull();
		expect(r.classCode).toBeNull();
		expect(r.coachMove).toBe('Start');
		expect(r.coachText).toBe(
			'The game begins. Step through with the arrows or arrow keys to see every move classified.'
		);
		expect(r.evalStr).toBe('+0.00');
	});

	it('ply 1 (white move 1, "e4") is classified book with coachMove "1. e4"', () => {
		const r = getReviewPly(1);
		expect(r.classCode).toBe('book');
		expect(r.coachMove).toBe('1. e4');
		expect(r.lastMove).toEqual({ from: 'e2', to: 'e4' });
	});

	it('a black ply renders "N... san" with the ellipsis separator', () => {
		const r = getReviewPly(2); // 1...e5
		expect(r.coachMove).toBe('1... e5');
	});

	it('only exposes `best` when the played move is a NOT_BEST_CODE and bestMoves has an entry', () => {
		expect(getReviewPly(14).best).toEqual({ from: 'c8', to: 'g4', san: 'Bg4' }); // inaccuracy
		expect(getReviewPly(1).best).toBeNull(); // book, not a NOT_BEST code
	});

	it('computes whitePct via evalBarPct semantics (50 + clamp(ev/8*44))', () => {
		const r = getReviewPly(31); // eval 2.37
		expect(r.whitePct).toBeCloseTo(50 + Math.min(44, (2.37 / 8) * 44), 5);
	});
});

describe('getPlayerRows', () => {
	it('unflipped: Black on top, White on bottom (whiteAtBottom)', () => {
		const { top, bottom } = getPlayerRows(31, false);
		expect(top.name).toBe('DominikP');
		expect(bottom.name).toBe('Jonas');
	});

	it('flipped: White on top, Black on bottom', () => {
		const { top, bottom } = getPlayerRows(31, true);
		expect(top.name).toBe('Jonas');
		expect(bottom.name).toBe('DominikP');
	});

	it('highlights the clock of the side to move (odd ply = Black to move)', () => {
		const { top, bottom } = getPlayerRows(1, false); // ply 1 -> Black to move next
		expect(top.name).toBe('DominikP');
		expect(top.clockActive).toBe(true);
		expect(bottom.clockActive).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/game/review.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/lib/game/review.ts`**

```ts
/**
 * Per-ply derivation for the Game Review screen — the equivalent of the
 * reference Component's renderVals() (SecondBoard.dc.html lines 1221-1262),
 * ported to plain functions operating on the mock data in ./mock-data.
 * Feeds real Rust analysis/pgn output in later iterations without changing
 * callers (README §8; LOGIC.md §7).
 */
import { capturedInfo, evalBarPct } from '$lib/board/geometry';
import type { Move, Position } from '$lib/board/types';
import type { ClassCode } from '$lib/types';
import { NOT_BEST_CODES, TOKENS } from '$lib/tokens';
import {
	BEST_MOVES,
	COACH_TEXT_MAP,
	EVAL_PER_PLY,
	CLASS_CODES,
	MOCK_MOVE_META,
	MOCK_POSITIONS,
	PLAYERS,
	SAN_LIST
} from './mock-data';

export interface ReviewPly {
	position: Position;
	lastMove: Move | null;
	classCode: ClassCode | null;
	best: (Move & { san: string }) | null;
	evalNum: number;
	evalStr: string;
	whitePct: number;
	coachMove: string;
	coachText: string;
}

const INTRO_COACH_TEXT =
	'The game begins. Step through with the arrows or arrow keys to see every move classified.';

export function getReviewPly(ply: number): ReviewPly {
	const position = MOCK_POSITIONS[ply];
	const lastMeta = ply > 0 ? MOCK_MOVE_META[ply - 1] : null;
	const classCode: ClassCode | null = ply > 0 ? CLASS_CODES[ply - 1] : null;
	const evalNum = EVAL_PER_PLY[ply];
	const evalStr = (evalNum >= 0 ? '+' : '') + evalNum.toFixed(2);
	const whitePct = evalBarPct(evalNum);

	const best = ply > 0 && classCode && NOT_BEST_CODES.includes(classCode) ? (BEST_MOVES[ply] ?? null) : null;

	const moveNo = Math.ceil(ply / 2);
	const coachMove =
		ply > 0 ? moveNo + (ply % 2 === 1 ? '. ' : '... ') + SAN_LIST[ply - 1] : 'Start';
	const coachText = ply > 0 && classCode ? COACH_TEXT_MAP[classCode] : INTRO_COACH_TEXT;

	return {
		position,
		lastMove: lastMeta,
		classCode,
		best,
		evalNum,
		evalStr,
		whitePct,
		coachMove,
		coachText
	};
}

export interface PlayerRowData {
	name: string;
	rating: string;
	initial: string;
	isWhite: boolean;
	clock: string;
	clockActive: boolean;
	captured: Array<{ color: 'w' | 'b'; type: 'P' | 'N' | 'B' | 'R' | 'Q' }>;
	adv: string | null;
}

export function getPlayerRows(ply: number, flipped: boolean): { top: PlayerRowData; bottom: PlayerRowData } {
	const position = MOCK_POSITIONS[ply];
	const cap = capturedInfo(position);
	const blackToMove = ply % 2 === 1;

	const white: PlayerRowData = {
		name: PLAYERS.white.name,
		rating: PLAYERS.white.rating,
		initial: PLAYERS.white.initial,
		isWhite: true,
		clock: PLAYERS.white.clock,
		clockActive: !blackToMove,
		captured: cap.whiteCap,
		adv: cap.adv > 0 ? '+' + cap.adv : null
	};
	const black: PlayerRowData = {
		name: PLAYERS.black.name,
		rating: PLAYERS.black.rating,
		initial: PLAYERS.black.initial,
		isWhite: false,
		clock: PLAYERS.black.clock,
		clockActive: blackToMove,
		captured: cap.blackCap,
		adv: cap.adv < 0 ? '+' + -cap.adv : null
	};

	const whiteAtBottom = !flipped;
	return whiteAtBottom ? { top: black, bottom: white } : { top: white, bottom: black };
}
```

Note: `TOKENS` is imported but unused directly in this file's logic (classification colors are looked up by the *components* via `TOKENS.classification[classCode]`, not precomputed here) — remove the unused import if `tsc`/eslint flags it; keep `NOT_BEST_CODES`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/game/review.test.ts`
Expected: PASS (9/9).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/review.ts src/lib/game/review.test.ts
git commit -m "feat: add per-ply review data derivation"
```

---

## Task 4: `appState` screen/tab/ply transitions

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts`
- Modify: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: `SAN_LIST` from `$lib/game/mock-data` (for the ply upper bound).
- Produces (new exports alongside the existing `appState`):
  ```ts
  export const MAX_PLY: number; // SAN_LIST.length
  export function goToPly(ply: number): void; // clamps to [0, MAX_PLY]
  export function stepPly(delta: number): void; // clamps to [0, MAX_PLY]
  export function startReview(): void; // gameLoaded=true, screen='review', ply=31, tab='analysis'
  export function newGame(): void; // gameLoaded=false, pgnText='', screen='review'
  export function handleReviewKeydown(e: KeyboardEvent): void; // ArrowLeft/ArrowRight, only when appState.screen==='review'; preventDefault
  ```

- [ ] **Step 1: Write the failing tests** (append to the existing `src/lib/stores/app-state.test.ts`, whose current contents you should read first to match its existing describe/it style and any `beforeEach` reset helper)

```ts
import { appState, MAX_PLY, goToPly, stepPly, startReview, newGame, handleReviewKeydown } from './app-state.svelte';

// ... inside existing describe block or a new one:
describe('screen/ply transitions', () => {
	beforeEach(() => {
		appState.screen = 'review';
		appState.ply = 31;
		appState.gameLoaded = true;
		appState.tab = 'analysis';
		appState.pgnText = 'x';
	});

	it('MAX_PLY matches the mock game length (31)', () => {
		expect(MAX_PLY).toBe(31);
	});

	it('goToPly clamps to [0, MAX_PLY]', () => {
		goToPly(-5);
		expect(appState.ply).toBe(0);
		goToPly(999);
		expect(appState.ply).toBe(31);
		goToPly(10);
		expect(appState.ply).toBe(10);
	});

	it('stepPly moves by delta and clamps', () => {
		appState.ply = 0;
		stepPly(-1);
		expect(appState.ply).toBe(0);
		stepPly(1);
		expect(appState.ply).toBe(1);
	});

	it('startReview resets to the default review state regardless of pgnText', () => {
		appState.gameLoaded = false;
		appState.ply = 0;
		appState.tab = 'details';
		startReview();
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(31);
		expect(appState.tab).toBe('analysis');
	});

	it('newGame resets to onboarding', () => {
		newGame();
		expect(appState.gameLoaded).toBe(false);
		expect(appState.pgnText).toBe('');
		expect(appState.screen).toBe('review');
	});

	it('handleReviewKeydown steps ply on ArrowLeft/ArrowRight only on the review screen', () => {
		appState.ply = 5;
		const right = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
		handleReviewKeydown(right);
		expect(appState.ply).toBe(6);
		expect(right.defaultPrevented).toBe(true);

		appState.screen = 'home';
		const left = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true });
		handleReviewKeydown(left);
		expect(appState.ply).toBe(6); // unchanged — guarded on screen
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/stores/app-state.test.ts`
Expected: FAIL (new exports don't exist).

- [ ] **Step 3: Implement the additions in `src/lib/stores/app-state.svelte.ts`**

Add near the bottom of the file (after the existing `appState` export):

```ts
import { SAN_LIST } from '$lib/game/mock-data';

export const MAX_PLY = SAN_LIST.length;

export function goToPly(ply: number): void {
	appState.ply = Math.max(0, Math.min(MAX_PLY, ply));
}

export function stepPly(delta: number): void {
	goToPly(appState.ply + delta);
}

/** Reference `startReview` handler: always loads the same mock game — pgnText is cosmetic (Global Constraints). */
export function startReview(): void {
	appState.gameLoaded = true;
	appState.screen = 'review';
	appState.ply = MAX_PLY;
	appState.tab = 'analysis';
}

export function newGame(): void {
	appState.gameLoaded = false;
	appState.pgnText = '';
	appState.screen = 'review';
}

/** LOGIC.md §1 keyboard rule: guarded on screen==='review' only (not gameLoaded). */
export function handleReviewKeydown(e: KeyboardEvent): void {
	if (appState.screen !== 'review') return;
	if (e.key === 'ArrowLeft') {
		e.preventDefault();
		stepPly(-1);
	} else if (e.key === 'ArrowRight') {
		e.preventDefault();
		stepPly(1);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/stores/app-state.test.ts`
Expected: PASS (all, including pre-existing tests in the file).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/stores/app-state.test.ts
git commit -m "feat: add screen/ply/tab transition helpers to appState"
```

---

## Task 5: `ClassBadge.svelte`

**Files:**
- Create: `src/lib/components/ClassBadge.svelte`
- Test: `src/lib/components/ClassBadge.test.ts`

**Interfaces:**
- Consumes: `TOKENS.classification`, `TOKENS.review.moveTint`, `DARK_FG_CODES` from `$lib/tokens`; `ClassCode` from `$lib/types`.
- Produces: a component with props
  ```ts
  interface Props {
  	classCode: ClassCode;
  	size: 16 | 21 | 22;
  	useDarkFg?: boolean; // default false — only breakdown(21)/phase(22) badges pass true
  }
  ```

Per Global Constraints, this does **not** replace `BoardSquare.svelte`'s 36px badge.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/ClassBadge.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ClassBadge from './ClassBadge.svelte';

describe('ClassBadge', () => {
	it('renders the glyph and background color for the given classification', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'brilliant', size: 16 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.textContent).toBe('!!');
		expect(el.getAttribute('style')).toContain('45, 224, 206'); // #2DE0CE
	});

	it('sizes the badge in pixels via the size prop', () => {
		const { container } = render(ClassBadge, { props: { classCode: 'best', size: 21 } });
		const el = container.firstElementChild as HTMLElement;
		expect(el.getAttribute('style')).toContain('width: 21px');
		expect(el.getAttribute('style')).toContain('height: 21px');
	});

	it('uses dark foreground text only when useDarkFg is set and the code is in DARK_FG_CODES', () => {
		const { container: withDark } = render(ClassBadge, {
			props: { classCode: 'best', size: 21, useDarkFg: true }
		});
		expect((withDark.firstElementChild as HTMLElement).getAttribute('style')).toContain(
			'11, 18, 15'
		); // #0B120F

		const { container: withoutDark } = render(ClassBadge, {
			props: { classCode: 'best', size: 16, useDarkFg: false }
		});
		expect((withoutDark.firstElementChild as HTMLElement).getAttribute('style')).toContain(
			'255, 255, 255'
		);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/ClassBadge.test.ts`
Expected: FAIL (component doesn't exist).

- [ ] **Step 3: Implement `src/lib/components/ClassBadge.svelte`**

```svelte
<script lang="ts">
	import { TOKENS, DARK_FG_CODES } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		classCode: ClassCode;
		size: 16 | 21 | 22;
		useDarkFg?: boolean;
	}

	let { classCode, size, useDarkFg = false }: Props = $props();

	const cls = $derived(TOKENS.classification[classCode]);
	const fg = $derived(useDarkFg && DARK_FG_CODES.includes(classCode) ? '#0B120F' : '#fff');
	const fontSize = $derived(size === 16 ? '8.5px' : size === 21 ? '10.5px' : '11px');
</script>

<span
	class="badge"
	style={`width:${size}px;height:${size}px;font-size:${fontSize};background:${cls.color};color:${fg};`}
>{cls.glyph}</span>

<style>
	.badge {
		flex: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		letter-spacing: -0.5px;
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
</style>
```

Note: the reference's breakdown/phase badges (21px/22px) don't carry `text-shadow`/`box-shadow` (their `badgeStyle` strings only set width/height/radius/flex/display/align/justify/font-weight/font-size/letter-spacing/background/color — no shadow). Only the 16px move-list badge has `text-shadow:0 1px 1px rgba(0,0,0,.25)` + `box-shadow:0 1px 3px rgba(0,0,0,.35)`. Fix the component so shadows only apply when `size === 16`:

```svelte
<span
	class="badge"
	class:with-shadow={size === 16}
	style={`width:${size}px;height:${size}px;font-size:${fontSize};background:${cls.color};color:${fg};`}
>{cls.glyph}</span>

<style>
	.badge {
		flex: none;
		border-radius: 50%;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		letter-spacing: -0.5px;
	}
	.badge.with-shadow {
		text-shadow: 0 1px 1px rgba(0, 0, 0, 0.25);
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/ClassBadge.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ClassBadge.svelte src/lib/components/ClassBadge.test.ts
git commit -m "feat: add ClassBadge component for move-list/breakdown/phase badges"
```

---

## Task 6: `EvalBar.svelte`

**Files:**
- Create: `src/lib/components/EvalBar.svelte`
- Test: `src/lib/components/EvalBar.test.ts`

**Interfaces:**
- Consumes: nothing beyond props (pure presentational; the caller passes precomputed numbers so this component has no dependency on `$lib/game`).
- Props:
  ```ts
  interface Props {
  	whitePct: number; // 0-100, White's fill share
  	evalNum: number; // signed eval, for the label + label-position/color logic
  	whiteAtBottom: boolean; // !flipped
  }
  ```

Reference: markup lines 166-170, computed styles lines 1308-1310 (`evalBarLabelStyle`, `barFillStyle`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/EvalBar.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EvalBar from './EvalBar.svelte';

describe('EvalBar', () => {
	it('renders the fill height from whitePct and grows from the bottom when White is at the bottom', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		const fill = container.querySelector('.fill') as HTMLElement;
		expect(fill.getAttribute('style')).toContain('height: 62.5%');
		expect(fill.getAttribute('style')).toContain('bottom: 0px');
	});

	it('grows from the top when flipped (White not at the bottom)', () => {
		const { container } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: false }
		});
		const fill = container.querySelector('.fill') as HTMLElement;
		expect(fill.getAttribute('style')).toContain('top: 0px');
	});

	it('shows the absolute eval magnitude as the label, positive or negative eval', () => {
		const { container: pos } = render(EvalBar, {
			props: { whitePct: 62.5, evalNum: 2.37, whiteAtBottom: true }
		});
		expect(pos.querySelector('.label')?.textContent).toBe('2.4');

		const { container: neg } = render(EvalBar, {
			props: { whitePct: 20, evalNum: -1.5, whiteAtBottom: true }
		});
		expect(neg.querySelector('.label')?.textContent).toBe('1.5');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/EvalBar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/EvalBar.svelte`**

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';

	interface Props {
		whitePct: number;
		evalNum: number;
		whiteAtBottom: boolean;
	}

	let { whitePct, evalNum, whiteAtBottom }: Props = $props();

	const label = $derived((evalNum >= 0 ? evalNum : -evalNum).toFixed(1));
	// Reference: label sits opposite the fill's growth edge, colored for contrast against
	// whichever background (fill vs. track) it's drawn over there.
	const labelOnFilledEdge = $derived(whiteAtBottom === evalNum >= 0);
	const fillStyle = $derived(
		`position:absolute;left:0;right:0;${whiteAtBottom ? 'bottom:0;' : 'top:0;'}height:${whitePct.toFixed(1)}%;background:linear-gradient(${whiteAtBottom ? '180deg' : '0deg'},${TOKENS.board.evalWhiteFillFrom},${TOKENS.board.evalWhiteFillTo});transition:height .25s ease;`
	);
	const labelStyle = $derived(
		`position:absolute;left:0;right:0;${labelOnFilledEdge ? 'bottom:3px;color:#20222E;' : 'top:3px;color:#E3E6EE;'}text-align:center;font-size:9px;font-weight:700;`
	);
</script>

<div class="eval-bar">
	<div class="fill" style={fillStyle}></div>
	<div class="midline"></div>
	<div class="label sbmono" style={labelStyle}>{label}</div>
</div>

<style>
	.eval-bar {
		width: 20px;
		flex: none;
		position: relative;
		border-radius: 6px;
		overflow: hidden;
		background: var(--board-eval-bar-track);
		border: 1px solid rgba(255, 255, 255, 0.06);
	}
	.midline {
		position: absolute;
		left: 0;
		right: 0;
		top: 50%;
		height: 1px;
		background: var(--board-eval-midline);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/EvalBar.test.ts`
Expected: PASS (3/3). (If the "bottom: 0px"/"top: 0px" assertions fail because jsdom's CSSOM normalizes `bottom:0;` to `bottom: 0px;` differently, adjust the assertion to match — jsdom quirks here are the same category the BoardSquare task hit in Iteration 3; use `getAttribute('style')` and match the normalized substring, not the literal input string.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EvalBar.svelte src/lib/components/EvalBar.test.ts
git commit -m "feat: add EvalBar component"
```

---

## Task 7: `EvalGraph.svelte`

**Files:**
- Create: `src/lib/components/EvalGraph.svelte`
- Test: `src/lib/components/EvalGraph.test.ts`

**Interfaces:**
- Consumes: `evalGraph` from `$lib/charts/eval-graph`; `TOKENS.review` for colors.
- Props:
  ```ts
  interface Props {
  	evalPerPly: number[];
  	classCodes: import('$lib/types').ClassCode[];
  	ply: number;
  	height: number; // 66 (Review tab) or 62 (bottom bar) — viewBox stays 0 0 660 78
  }
  ```

Reference markup: lines 236-244 (Review tab) and 375-383 (bottom bar) — identical SVG content, only `height="66"` vs `height="62"` differs, plus a `border-radius` of 8px vs 6px on the `<svg>` itself (not the viewBox). Cross-check: line 236 has `border-radius:8px` in its `style`, line 375's wrapping `<div style="padding:8px 12px 2px;">` plus the svg itself doesn't repeat a radius in the excerpt — re ‑read the literal `<svg ... style="display:block;border-radius:6px;">` in that block (already captured in the read output above) confirms **6px** for the bottom-bar instance. Pass `borderRadius` as a second prop paired with `height`, or derive it inside the component as `height === 66 ? 8 : 6` (simpler — no separate caller-supplied prop needed since the two heights map 1:1 to the two radii in the reference).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/EvalGraph.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import EvalGraph from './EvalGraph.svelte';
import type { ClassCode } from '$lib/types';

describe('EvalGraph', () => {
	it('renders an svg with viewBox 0 0 660 78 at the requested height', () => {
		const { container } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 66 }
		});
		const svg = container.querySelector('svg')!;
		expect(svg.getAttribute('viewBox')).toBe('0 0 660 78');
		expect(svg.getAttribute('height')).toBe('66');
	});

	it('uses an 8px radius at height 66 and 6px at height 62', () => {
		const { container: tall } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 66 }
		});
		expect(tall.querySelector('svg')!.getAttribute('style')).toContain('border-radius:8px');

		const { container: short } = render(EvalGraph, {
			props: { evalPerPly: [0, 0.3], classCodes: ['best'] as ClassCode[], ply: 1, height: 62 }
		});
		expect(short.querySelector('svg')!.getAttribute('style')).toContain('border-radius:6px');
	});

	it('renders one dot per notable classification and a current-ply marker circle', () => {
		const { container } = render(EvalGraph, {
			props: {
				evalPerPly: [0, 0.3, 0.2, 0.3],
				classCodes: ['book', 'brilliant', 'good'] as ClassCode[],
				ply: 2,
				height: 66
			}
		});
		const circles = container.querySelectorAll('circle');
		// 1 notable dot + 1 marker circle
		expect(circles).toHaveLength(2);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/EvalGraph.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/EvalGraph.svelte`**

```svelte
<script lang="ts">
	import { evalGraph } from '$lib/charts/eval-graph';
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';

	interface Props {
		evalPerPly: number[];
		classCodes: ClassCode[];
		ply: number;
		height: 66 | 62;
	}

	let { evalPerPly, classCodes, ply, height }: Props = $props();

	const g = $derived(evalGraph(evalPerPly, classCodes, ply));
	const radius = $derived(height === 66 ? 8 : 6);
</script>

<svg
	width="100%"
	{height}
	viewBox="0 0 660 78"
	preserveAspectRatio="none"
	style={`display:block;border-radius:${radius}px;`}
>
	<rect x="0" y="0" width="660" height="78" fill={TOKENS.review.evalGraphBg} />
	<path d={g.evalArea} fill={TOKENS.review.evalGraphArea} />
	<line
		x1="0"
		y1="39"
		x2="660"
		y2="39"
		stroke={TOKENS.review.evalGraphMidline}
		stroke-width="1"
		stroke-dasharray="3 4"
		opacity="0.45"
	/>
	<path d={g.evalLine} fill="none" stroke={TOKENS.review.evalGraphLine} stroke-width="1" opacity="0.5" />
	<line
		x1={g.markerX}
		y1="0"
		x2={g.markerX}
		y2="78"
		stroke={TOKENS.review.evalGraphMidline}
		stroke-width="1.6"
		opacity="0.9"
	/>
	{#each g.evalDots as dot, i (i)}
		<circle cx={dot.cx} cy={dot.cy} r="3.6" fill={dot.color} stroke={TOKENS.review.evalGraphBg} stroke-width="1.4" />
	{/each}
	<circle
		cx={g.markerCX}
		cy={g.markerCY}
		r="4.5"
		fill={TOKENS.review.evalGraphMidline}
		stroke={TOKENS.color.deepInsetBg}
		stroke-width="2"
	/>
</svg>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/EvalGraph.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/EvalGraph.svelte src/lib/components/EvalGraph.test.ts
git commit -m "feat: add EvalGraph component"
```

---

## Task 8: `PlayerRow.svelte`

**Files:**
- Create: `src/lib/components/PlayerRow.svelte`
- Test: `src/lib/components/PlayerRow.test.ts`

**Interfaces:**
- Consumes: `PlayerRowData` type from `$lib/game/review`; `PIECE_SPRITES` from `$lib/board/pieces`; `TOKENS.review` avatar/clock tokens.
- Props:
  ```ts
  interface Props {
  	player: import('$lib/game/review').PlayerRowData;
  	showNewGameButton?: boolean; // default false; only the top row in the reference has it
  	onNewGame?: () => void;
  }
  ```

Reference: markup lines 150-162 (top row incl. New PGN button) and 196-207 (bottom row, no button) — same internal structure otherwise. Avatar/clock/captured-piece styling: lines 1245-1254 (`clk`, `whiteP.avatarStyle`, `blackP.avatarStyle`) and `capturedInfo`'s `st()` helper (line 1038 of the earlier read) for the 18px captured-sprite style.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/PlayerRow.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PlayerRow from './PlayerRow.svelte';
import type { PlayerRowData } from '$lib/game/review';

const base: PlayerRowData = {
	name: 'Jonas',
	rating: '1867',
	initial: 'J',
	isWhite: true,
	clock: '4:12',
	clockActive: true,
	captured: [{ color: 'b', type: 'Q' }],
	adv: '+3'
};

describe('PlayerRow', () => {
	it('renders name, rating, and clock', () => {
		const { getByText } = render(PlayerRow, { props: { player: base } });
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('1867')).toBeTruthy();
		expect(getByText('4:12')).toBeTruthy();
	});

	it('renders one captured-piece sprite per entry plus the material advantage', () => {
		const { container, getByText } = render(PlayerRow, { props: { player: base } });
		expect(container.querySelectorAll('.captured-piece')).toHaveLength(1);
		expect(getByText('+3')).toBeTruthy();
	});

	it('omits the advantage span when adv is null', () => {
		const { container } = render(PlayerRow, { props: { player: { ...base, adv: null } } });
		expect(container.querySelector('.adv')).toBeNull();
	});

	it('only renders the New PGN button when showNewGameButton is true', () => {
		const { queryByText } = render(PlayerRow, { props: { player: base, showNewGameButton: true } });
		expect(queryByText('New PGN')).not.toBeNull();

		const { queryByText: queryByTextNoBtn } = render(PlayerRow, { props: { player: base } });
		expect(queryByTextNoBtn('New PGN')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/PlayerRow.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/PlayerRow.svelte`**

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import { PIECE_SPRITES, type PieceSpriteKey } from '$lib/board/pieces';
	import type { PlayerRowData } from '$lib/game/review';
	import Icon from './Icon.svelte';

	interface Props {
		player: PlayerRowData;
		showNewGameButton?: boolean;
		onNewGame?: () => void;
	}

	let { player, showNewGameButton = false, onNewGame }: Props = $props();

	const avatarStyle = $derived(
		player.isWhite
			? `background:${TOKENS.review.avatarWhiteBg};border:1px solid ${TOKENS.review.avatarWhiteBorder};color:${TOKENS.review.avatarWhiteText};`
			: `background:${TOKENS.review.avatarBlackBg};border:1px solid ${TOKENS.review.avatarBlackBorder};color:${TOKENS.review.avatarBlackText};`
	);
	const clockStyle = $derived(
		player.clockActive
			? `background:${TOKENS.review.clockActiveBg};color:${TOKENS.review.clockActiveText};box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);`
			: `background:${TOKENS.review.clockInactiveBg};color:${TOKENS.review.clockInactiveText};`
	);
</script>

<div class="player-row">
	<div class="avatar" style={avatarStyle}>{player.initial}</div>
	<div class="info">
		<div class="name-row">
			<span class="name">{player.name}</span>
			<span class="rating sbmono">{player.rating}</span>
		</div>
		<div class="captured-row">
			{#each player.captured as piece, i (i)}
				<span
					class="captured-piece"
					style={`background-image:url(${PIECE_SPRITES[(piece.color + piece.type) as PieceSpriteKey]});filter:${TOKENS.review.capturedSpriteShadow};`}
				></span>
			{/each}
			{#if player.adv}
				<span class="adv sbmono">{player.adv}</span>
			{/if}
		</div>
	</div>
	<div class="spacer"></div>
	{#if showNewGameButton}
		<button type="button" class="new-game" onclick={onNewGame} title="Load a different PGN">
			<Icon d="M12 5v14M5 12h14" size={13} stroke="#4ADEA0" strokeWidth={2.2} />
			New PGN
		</button>
	{/if}
	<div class="clock sbmono" style={clockStyle}>{player.clock}</div>
</div>

<style>
	.player-row {
		display: flex;
		align-items: center;
		gap: 11px;
		padding: 0 2px;
		flex: none;
	}
	.avatar {
		width: 34px;
		height: 34px;
		flex: none;
		border-radius: 9px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 14px;
	}
	.info {
		flex: none;
	}
	.name-row {
		display: flex;
		align-items: center;
		gap: 7px;
	}
	.name {
		font-size: 15.5px;
		font-weight: 600;
	}
	.rating {
		font-size: 12px;
		color: var(--color-text-muted);
	}
	.captured-row {
		display: flex;
		align-items: center;
		gap: 1px;
		margin-top: 4px;
		height: 20px;
	}
	.captured-piece {
		width: 18px;
		height: 18px;
		background-size: contain;
		background-repeat: no-repeat;
		background-position: center;
	}
	.adv {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-light-green-1);
		margin-left: 5px;
	}
	.spacer {
		flex: 1;
	}
	.new-game {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 7px 12px;
		margin-right: 10px;
		border-radius: var(--radius-control);
		background: var(--review-new-game-bg, #181a24);
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: #c7ccda;
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}
	.clock {
		font-size: 18px;
		font-weight: 600;
		padding: 5px 12px;
		border-radius: var(--radius-control);
	}
</style>
```

(`var(--review-new-game-bg, #181a24)` — no root CSS var exists for this yet since it's a one-off; the fallback literal `#181a24` matches `TOKENS.review.newGameBg` exactly. Simplify by just using the literal `background: #181a24;` in the `<style>` block directly instead of a fake CSS var — remove the `var(...)` wrapper.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/PlayerRow.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/PlayerRow.svelte src/lib/components/PlayerRow.test.ts
git commit -m "feat: add PlayerRow component"
```

---

## Task 9: `CoachCard.svelte`

**Files:**
- Create: `src/lib/components/CoachCard.svelte`
- Test: `src/lib/components/CoachCard.test.ts`

**Interfaces:**
- Consumes: `TOKENS.classification`, `Icon.svelte`.
- Props:
  ```ts
  interface Props {
  	classCode: import('$lib/types').ClassCode | null; // null at ply 0 -> use 'book' per reference
  	coachMove: string;
  	coachText: string;
  	evalStr: string;
  	best: (import('$lib/board/types').Move & { san: string }) | null;
  }
  ```

Reference: markup lines 304-321; computed styles lines 1325-1330 (`coachBadge`, `coachTitleStyle`, `coachEvalChip`, `coachCardBg`). Note ply-0 fallback: `selCode = ply > 0 ? classCodes[ply-1] : 'book'` — replicate by having the **caller** (Task 12/17) pass `classCode ?? 'book'`, keeping this component simple (it always receives a non-null `ClassCode`). Adjust the prop type to non-nullable `ClassCode` and push the `?? 'book'` fallback to the call site.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/CoachCard.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import CoachCard from './CoachCard.svelte';

describe('CoachCard', () => {
	it('renders the move, title word, eval, and coach text', () => {
		const { getByText } = render(CoachCard, {
			props: {
				classCode: 'brilliant',
				coachMove: '16. Ne5',
				coachText: 'This move creates a strong threat...',
				evalStr: '+2.37',
				best: null
			}
		});
		expect(getByText('16. Ne5')).toBeTruthy();
		expect(getByText('is', { exact: false })).toBeTruthy();
		expect(getByText('+2.37')).toBeTruthy();
	});

	it('shows the "Best was" strip only when best is provided', () => {
		const { queryByText } = render(CoachCard, {
			props: {
				classCode: 'inaccuracy',
				coachMove: '15. d5',
				coachText: 'A small slip...',
				evalStr: '+1.05',
				best: { from: 'c8', to: 'g4', san: 'Bg4' }
			}
		});
		expect(queryByText('Bg4')).not.toBeNull();
		expect(queryByText('Best was')).not.toBeNull();

		const { queryByText: q2 } = render(CoachCard, {
			props: {
				classCode: 'best',
				coachMove: '16. Ne5',
				coachText: "Engine's top choice.",
				evalStr: '+2.37',
				best: null
			}
		});
		expect(q2('Best was')).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/CoachCard.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/CoachCard.svelte`**

```svelte
<script lang="ts">
	import { TOKENS } from '$lib/tokens';
	import type { ClassCode } from '$lib/types';
	import type { Move } from '$lib/board/types';
	import Icon from './Icon.svelte';

	interface Props {
		classCode: ClassCode;
		coachMove: string;
		coachText: string;
		evalStr: string;
		best: (Move & { san: string }) | null;
	}

	let { classCode, coachMove, coachText, evalStr, best }: Props = $props();

	const cls = $derived(TOKENS.classification[classCode]);
	const cardStyle = $derived(
		`background:radial-gradient(120% 130% at 12% 0%,${cls.color}1f,transparent 55%),${TOKENS.color.cardBg};border:1px solid ${cls.color}44;`
	);
	const badgeStyle = $derived(
		`background:${cls.color}22;color:${cls.color};`
	);
	const evalChipStyle = $derived(`background:${cls.color}1a;color:${cls.color};`);
</script>

<div class="coach-card" style={cardStyle}>
	<div class="row">
		<div class="badge" style={badgeStyle}>{cls.glyph}</div>
		<div class="body">
			<div class="title">
				<span class="move sbmono">{coachMove}</span>
				<span class="word" style={`color:${cls.color};`}>is {cls.word}</span>
				<span class="fill"></span>
				<span class="eval-chip" style={evalChipStyle}>{evalStr}</span>
			</div>
			<p class="text">{coachText}</p>
		</div>
	</div>
	{#if best}
		<div class="best-strip">
			<Icon d="M5 12h13M12 5l7 7-7 7" size={14} stroke="#4ADEA0" strokeWidth={2} />
			<span class="label">Best was</span>
			<span class="san sbmono">{best.san}</span>
		</div>
	{/if}
</div>

<style>
	.coach-card {
		border-radius: 13px;
		padding: 12px 14px;
	}
	.row {
		display: flex;
		align-items: flex-start;
		gap: 10px;
	}
	.badge {
		width: 38px;
		height: 38px;
		flex: none;
		border-radius: var(--radius-inset, 10px);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 16px;
		letter-spacing: -1px;
	}
	.body {
		flex: 1;
		min-width: 0;
	}
	.title {
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
	}
	.move {
		color: var(--color-text-primary-alt);
	}
	.fill {
		flex: 1;
	}
	.eval-chip {
		font-size: 12px;
		font-weight: 600;
		padding: 2px 8px;
		border-radius: 7px;
	}
	.text {
		margin: 5px 0 0;
		font-size: 12px;
		line-height: 1.45;
		color: var(--color-text-secondary-alt);
	}
	.best-strip {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 10px;
		padding: 7px 11px;
		border-radius: 9px;
		background: #0d0f16;
		border: 1px solid rgba(74, 222, 160, 0.25);
	}
	.label {
		font-size: 11.5px;
		color: var(--color-text-tertiary);
	}
	.san {
		font-size: 13px;
		font-weight: 600;
		color: var(--color-accent-green);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/CoachCard.test.ts`
Expected: PASS (2/2).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/CoachCard.svelte src/lib/components/CoachCard.test.ts
git commit -m "feat: add CoachCard component"
```

---

## Task 10: `MoveList.svelte`

**Files:**
- Create: `src/lib/components/MoveList.svelte`
- Test: `src/lib/components/MoveList.test.ts`

**Interfaces:**
- Consumes: `SAN_LIST`, `CLASS_CODES` from `$lib/game/mock-data`; `ClassBadge.svelte`; `TOKENS.review.moveTint`.
- Props:
  ```ts
  interface Props {
  	selectedPly: number;
  	onSelectPly: (ply: number) => void;
  }
  ```

Reference: markup lines 329-339 (grid `30px 1fr 1fr`, 16 rows); computed styles lines 1145-1167 (`moveRows()`); auto-scroll lines 822-830 (`_syncMoveScroll`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/MoveList.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import MoveList from './MoveList.svelte';

describe('MoveList', () => {
	it('renders 16 rows with move-number gutter', () => {
		const { container } = render(MoveList, { props: { selectedPly: 0, onSelectPly: () => {} } });
		expect(container.querySelectorAll('.row')).toHaveLength(16);
		expect(container.textContent).toContain('1.');
		expect(container.textContent).toContain('16.');
	});

	it('marks the cell matching selectedPly as selected via data-sb-sel', () => {
		const { container } = render(MoveList, { props: { selectedPly: 31, onSelectPly: () => {} } });
		expect(container.querySelector('[data-sb-sel="1"]')).not.toBeNull();
	});

	it('calls onSelectPly with the clicked ply', () => {
		const onSelectPly = vi.fn();
		const { container } = render(MoveList, { props: { selectedPly: 0, onSelectPly } });
		const firstWhiteCell = container.querySelector('.cell') as HTMLElement;
		firstWhiteCell.click();
		expect(onSelectPly).toHaveBeenCalledWith(1);
	});

	it('renders no black cell in the final (odd-move-count) row', () => {
		const { container } = render(MoveList, { props: { selectedPly: 31, onSelectPly: () => {} } });
		const rows = container.querySelectorAll('.row');
		const lastRow = rows[rows.length - 1];
		expect(lastRow.querySelectorAll('.cell')).toHaveLength(1); // white only — SAN_LIST has 31 plies
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/MoveList.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/MoveList.svelte`**

```svelte
<script lang="ts">
	import { tick } from 'svelte';
	import { SAN_LIST, CLASS_CODES } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import ClassBadge from './ClassBadge.svelte';

	interface Props {
		selectedPly: number;
		onSelectPly: (ply: number) => void;
	}

	let { selectedPly, onSelectPly }: Props = $props();

	interface Row {
		num: string;
		wPly: number;
		bPly: number | null;
		striped: boolean;
	}

	const rows: Row[] = Array.from({ length: 16 }, (_, i) => {
		const wPly = 2 * i + 1;
		const bPly = 2 * i + 2;
		return {
			num: i + 1 + '.',
			wPly,
			bPly: bPly <= SAN_LIST.length ? bPly : null,
			striped: i % 2 === 1
		};
	});

	function cellStyle(sel: boolean, code: import('$lib/types').ClassCode): string {
		return sel
			? 'background:rgba(45,224,206,.14);color:#5EF0DE;font-weight:600;box-shadow:inset 0 0 0 1px rgba(45,224,206,.3);'
			: `color:${TOKENS.review.moveTint[code]};`;
	}

	let listEl: HTMLDivElement | undefined = $state();

	// Reference _syncMoveScroll (SecondBoard.dc.html lines 822-830): manual
	// scrollTop adjustment, NOT scrollIntoView, run after each ply change.
	$effect(() => {
		void selectedPly;
		requestAnimationFrame(() => {
			const c = listEl;
			if (!c) return;
			const row = c.querySelector('[data-sb-sel="1"]');
			if (!row) return;
			const delta = row.getBoundingClientRect().top - c.getBoundingClientRect().top - 2;
			c.scrollTop += delta;
		});
	});
</script>

<div class="move-list sbscroll" bind:this={listEl} data-sb-movelist="1">
	{#each rows as row (row.wPly)}
		<div class="row" class:striped={row.striped}>
			<span class="num sbmono">{row.num}</span>
			<div
				class="cell"
				data-sb-sel={selectedPly === row.wPly ? '1' : '0'}
				style={cellStyle(selectedPly === row.wPly, CLASS_CODES[row.wPly - 1])}
				onclick={() => onSelectPly(row.wPly)}
			>
				<ClassBadge classCode={CLASS_CODES[row.wPly - 1]} size={16} />
				<span class="san sbmono">{SAN_LIST[row.wPly - 1]}</span>
			</div>
			{#if row.bPly !== null}
				<div
					class="cell"
					data-sb-sel={selectedPly === row.bPly ? '1' : '0'}
					style={cellStyle(selectedPly === row.bPly, CLASS_CODES[row.bPly - 1])}
					onclick={() => onSelectPly(row.bPly!)}
				>
					<ClassBadge classCode={CLASS_CODES[row.bPly - 1]} size={16} />
					<span class="san sbmono">{SAN_LIST[row.bPly - 1]}</span>
				</div>
			{:else}
				<div></div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.move-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 2px 10px 10px;
	}
	.row {
		display: grid;
		grid-template-columns: 30px 1fr 1fr;
		align-items: center;
		column-gap: 4px;
		padding: 1px 4px;
		border-radius: 8px;
	}
	.row.striped {
		background: rgba(255, 255, 255, 0.022);
	}
	.num {
		font-size: 11px;
		color: var(--color-text-muted-dark);
		text-align: right;
		padding-right: 2px;
	}
	.cell {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 5px 8px;
		border-radius: 7px;
		font-size: 12.5px;
		cursor: pointer;
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/MoveList.test.ts`
Expected: PASS (4/4). (`requestAnimationFrame` needs to exist in jsdom — Vitest's `jsdom` environment provides it; if the effect's async callback causes flakiness in the "calls onSelectPly" test, that test doesn't depend on the scroll effect and should be unaffected.)

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/MoveList.svelte src/lib/components/MoveList.test.ts
git commit -m "feat: add MoveList component with auto-scroll"
```

---

## Task 11: `BreakdownTable.svelte`, `PhaseTable.svelte`, `AccuracyBlock.svelte`

**Files:**
- Create: `src/lib/components/BreakdownTable.svelte`, `src/lib/components/PhaseTable.svelte`, `src/lib/components/AccuracyBlock.svelte`
- Test: `src/lib/components/BreakdownTable.test.ts`, `src/lib/components/PhaseTable.test.ts`, `src/lib/components/AccuracyBlock.test.ts`

**Interfaces:**
- `BreakdownTable`: no props — reads `BREAKDOWN_ROWS` from `$lib/game/mock-data` directly (static content, matching the reference's own hardcoded `breakdownRows()`). Uses `ClassBadge` (size 21, `useDarkFg`).
- `PhaseTable`: no props — reads `PHASE_ROWS`. Uses `ClassBadge` (size 22, `useDarkFg`).
- `AccuracyBlock`: no props — reads `PLAYERS` from `$lib/game/mock-data` (per Global Constraints, hardcoded Jonas/DominikP regardless of flip state) plus the static `"0–1"` result and the Game Rating row (`gameRating` field on each player).

Reference: markup lines 247-284 (players+accuracy grid, result, Game Rating); breakdown lines 266-276; phase lines 286-296; computed styles lines 1168-1184 (`breakdownRows`, `phaseRows`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/components/BreakdownTable.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BreakdownTable from './BreakdownTable.svelte';

describe('BreakdownTable', () => {
	it('renders 10 category rows with white/black counts', () => {
		const { container, getByText } = render(BreakdownTable);
		expect(container.querySelectorAll('.row')).toHaveLength(10);
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('22')).toBeTruthy(); // best/white
	});
});
```

```ts
// src/lib/components/PhaseTable.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PhaseTable from './PhaseTable.svelte';

describe('PhaseTable', () => {
	it('renders 3 phase rows with a badge per side', () => {
		const { container, getByText } = render(PhaseTable);
		expect(container.querySelectorAll('.row')).toHaveLength(3);
		expect(getByText('Opening')).toBeTruthy();
		expect(getByText('Middlegame')).toBeTruthy();
		expect(getByText('Endgame')).toBeTruthy();
	});
});
```

```ts
// src/lib/components/AccuracyBlock.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import AccuracyBlock from './AccuracyBlock.svelte';

describe('AccuracyBlock', () => {
	it('renders both players with their accuracy and game rating', () => {
		const { getByText } = render(AccuracyBlock);
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('DominikP')).toBeTruthy();
		expect(getByText('82.6')).toBeTruthy();
		expect(getByText('89.1')).toBeTruthy();
		expect(getByText('1712')).toBeTruthy();
		expect(getByText('1994')).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/components/BreakdownTable.test.ts src/lib/components/PhaseTable.test.ts src/lib/components/AccuracyBlock.test.ts`
Expected: FAIL (components don't exist).

- [ ] **Step 3: Implement `src/lib/components/BreakdownTable.svelte`**

```svelte
<script lang="ts">
	import { BREAKDOWN_ROWS } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
	import ClassBadge from './ClassBadge.svelte';
</script>

<div class="breakdown">
	{#each BREAKDOWN_ROWS as [code, white, black] (code)}
		<div class="row">
			<span class="name">{TOKENS.classification[code].name}</span>
			<span class="count sbmono" style={`color:${TOKENS.classification[code].color};`}>{white}</span>
			<div class="badge-col"><ClassBadge classCode={code} size={21} useDarkFg /></div>
			<span class="count sbmono" style={`color:${TOKENS.classification[code].color};`}>{black}</span>
		</div>
	{/each}
</div>

<style>
	.breakdown {
		margin-bottom: 14px;
	}
	.row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 2.5px 0;
	}
	.name {
		font-size: 12px;
		color: #c2c7d4;
	}
	.count {
		text-align: center;
		font-size: 13px;
		font-weight: 600;
	}
	.badge-col {
		display: flex;
		justify-content: center;
	}
</style>
```

- [ ] **Step 4: Implement `src/lib/components/PhaseTable.svelte`**

```svelte
<script lang="ts">
	import { PHASE_ROWS } from '$lib/game/mock-data';
	import ClassBadge from './ClassBadge.svelte';
</script>

<div class="phases">
	{#each PHASE_ROWS as [name, whiteCode, blackCode] (name)}
		<div class="row">
			<span class="name">{name}</span>
			<div class="badge-col"><ClassBadge classCode={whiteCode} size={22} useDarkFg /></div>
			<span></span>
			<div class="badge-col"><ClassBadge classCode={blackCode} size={22} useDarkFg /></div>
		</div>
	{/each}
</div>

<style>
	.row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 5px 0;
	}
	.name {
		font-size: 12.5px;
		color: var(--color-text-secondary-alt);
		font-weight: 500;
	}
	.badge-col {
		display: flex;
		justify-content: center;
	}
</style>
```

Note the reference's phase-table grid is `88px 1fr 36px 1fr` — same as breakdown — but its two badge columns sit in the *second* and *fourth* grid cells (matching `display:flex;justify-content:center` wrappers at those positions), not a dedicated 36px middle column like breakdown's glyph slot. Re-check against markup lines 288-295: `<div style="display:flex;justify-content:center;"><span>{{p.wBadge}}</span></div>` is the **second** column, then an empty `<span></span>` third column, then the **fourth** column mirrors it for black. The component above already matches this (badge-col in position 2 and 4, empty `<span>` in position 3) — no change needed, just confirming during implementation.

- [ ] **Step 5: Implement `src/lib/components/AccuracyBlock.svelte`**

```svelte
<script lang="ts">
	import { PLAYERS } from '$lib/game/mock-data';
	import { TOKENS } from '$lib/tokens';
</script>

<div class="accuracy-grid">
	<div class="col">
		<span class="name">{PLAYERS.white.name}</span>
		<div class="avatar neutral">{PLAYERS.white.initial}</div>
		<div class="chip neutral sbmono">{PLAYERS.white.accuracy}</div>
		<span class="label">ACCURACY</span>
	</div>
	<span class="result sbmono">0–1</span>
	<div class="col">
		<span class="name">{PLAYERS.black.name}</span>
		<div class="avatar tinted">{PLAYERS.black.initial}</div>
		<div class="chip tinted sbmono">{PLAYERS.black.accuracy}</div>
		<span class="label">ACCURACY</span>
	</div>
</div>

<div class="rating-row">
	<div>
		<div class="rating-title">Game Rating</div>
		<div class="rating-subtitle">Est. performance</div>
	</div>
	<div class="rating-col"><div class="chip neutral sbmono wide">{PLAYERS.white.gameRating}</div></div>
	<span></span>
	<div class="rating-col"><div class="chip tinted sbmono wide">{PLAYERS.black.gameRating}</div></div>
</div>

<style>
	.accuracy-grid {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		column-gap: 10px;
		margin-bottom: 16px;
	}
	.col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
	}
	.name {
		font-size: 12.5px;
		font-weight: 600;
		color: var(--color-text-primary-alt);
	}
	.avatar {
		width: 48px;
		height: 48px;
		border-radius: var(--radius-inset);
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 700;
		font-size: 19px;
	}
	.avatar.neutral {
		background: #edeff6;
		color: var(--color-card-bg);
		border: 2px solid rgba(255, 255, 255, 0.12);
	}
	.avatar.tinted {
		background: linear-gradient(135deg, #3b4252, #20222e);
		color: var(--color-text-secondary);
		border: 2px solid var(--color-accent-green);
		box-shadow: 0 0 0 3px rgba(74, 222, 160, 0.16);
	}
	.chip {
		width: 100%;
		text-align: center;
		font-size: 16px;
		font-weight: 600;
		border-radius: 8px;
		padding: 5px 0;
	}
	.chip.neutral {
		color: var(--color-text-primary-alt);
		background: #181a24;
		border: 1px solid rgba(255, 255, 255, 0.1);
	}
	.chip.tinted {
		color: var(--color-light-green-1);
		background: rgba(74, 222, 160, 0.06);
		border: 1px solid rgba(74, 222, 160, 0.4);
	}
	.chip.wide {
		width: auto;
		min-width: 72px;
	}
	.label {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		letter-spacing: 0.03em;
	}
	.result {
		font-size: 12px;
		color: var(--color-text-tertiary);
	}
	.rating-row {
		display: grid;
		grid-template-columns: 88px 1fr 36px 1fr;
		align-items: center;
		column-gap: 6px;
		padding: 12px 0;
		border-top: 1px solid var(--color-hairline-high);
		border-bottom: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
	.rating-title {
		font-size: 12px;
		color: var(--color-text-tertiary);
		font-weight: 500;
	}
	.rating-subtitle {
		font-size: 9.5px;
		color: var(--color-text-muted-dark);
		margin-top: 1px;
	}
	.rating-col {
		display: flex;
		justify-content: center;
	}
</style>
```

(`import { TOKENS } from '$lib/tokens';` is unused in this file if all values above are hardcoded literals or CSS vars — remove the import, or replace the two remaining hardcoded hexes not yet in `TOKENS.review` (`#3b4252`/`#20222e` avatar gradient stops, `#edeff6` chip bg) with `TOKENS.review.avatarBlackBg` / `avatarWhiteBg` equivalents by using inline `style` bindings instead of CSS classes for those two backgrounds, keeping the "reuse tokens" constraint. Prefer: bind `style={\`background:${TOKENS.review.avatarWhiteBg}\`}` etc. on `.avatar.neutral`/`.avatar.tinted` rather than hardcoding in `<style>`.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/components/BreakdownTable.test.ts src/lib/components/PhaseTable.test.ts src/lib/components/AccuracyBlock.test.ts`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/BreakdownTable.svelte src/lib/components/PhaseTable.svelte src/lib/components/AccuracyBlock.svelte src/lib/components/BreakdownTable.test.ts src/lib/components/PhaseTable.test.ts src/lib/components/AccuracyBlock.test.ts
git commit -m "feat: add Review-tab breakdown, phase, and accuracy components"
```

---

## Task 12: `AnalysisTab.svelte`

**Files:**
- Create: `src/lib/components/AnalysisTab.svelte`
- Test: `src/lib/components/AnalysisTab.test.ts`

**Interfaces:**
- Consumes: `CoachCard`, `MoveList`, `Icon`; `getReviewPly` from `$lib/game/review`.
- Props:
  ```ts
  interface Props {
  	ply: number;
  	onSelectPly: (ply: number) => void;
  	onNext: () => void;
  }
  ```

Reference: markup lines 301-341 (coach card + explain/next + move list).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/AnalysisTab.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import AnalysisTab from './AnalysisTab.svelte';

describe('AnalysisTab', () => {
	it('renders the coach card for the given ply and the move list', () => {
		const { getByText, container } = render(AnalysisTab, {
			props: { ply: 31, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(getByText('16. Ne5')).toBeTruthy();
		expect(container.querySelectorAll('.row')).toHaveLength(16);
	});

	it('calls onNext when the Next button is clicked', async () => {
		const onNext = vi.fn();
		const { getByText } = render(AnalysisTab, {
			props: { ply: 0, onSelectPly: () => {}, onNext }
		});
		await fireEvent.click(getByText('Next'));
		expect(onNext).toHaveBeenCalledOnce();
	});

	it('at ply 0 falls back to the book classification for the coach card', () => {
		const { container } = render(AnalysisTab, {
			props: { ply: 0, onSelectPly: () => {}, onNext: () => {} }
		});
		expect(container.textContent).toContain('Start');
		expect(container.textContent).toContain('a book move');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/AnalysisTab.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/AnalysisTab.svelte`**

```svelte
<script lang="ts">
	import { getReviewPly } from '$lib/game/review';
	import CoachCard from './CoachCard.svelte';
	import MoveList from './MoveList.svelte';
	import Icon from './Icon.svelte';

	interface Props {
		ply: number;
		onSelectPly: (ply: number) => void;
		onNext: () => void;
	}

	let { ply, onSelectPly, onNext }: Props = $props();

	const data = $derived(getReviewPly(ply));
</script>

<div class="analysis-tab">
	<div class="coach-slot">
		<CoachCard
			classCode={data.classCode ?? 'book'}
			coachMove={data.coachMove}
			coachText={data.coachText}
			evalStr={data.evalStr}
			best={data.best}
		/>
	</div>

	<div class="actions">
		<button type="button" class="explain">
			<Icon
				d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.5.5 1 1.2 1 2.5h6c0-1.3.5-2 1-2.5A6 6 0 0 0 12 3z"
				size={15}
				stroke="#C7CCDA"
				strokeWidth={2}
			/>
			Explain
		</button>
		<button type="button" class="next" onclick={onNext}>
			Next
			<Icon d="M5 12h13M12 5l7 7-7 7" size={15} stroke="#062018" strokeWidth={2.4} />
		</button>
	</div>

	<MoveList selectedPly={ply} {onSelectPly} />
</div>

<style>
	.analysis-tab {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}
	.coach-slot {
		flex: none;
		padding: 13px 14px 0;
	}
	.actions {
		flex: none;
		display: flex;
		gap: 9px;
		padding: 12px 14px;
	}
	.explain,
	.next {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 7px;
		padding: 10px;
		border-radius: 11px;
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		border: none;
	}
	.explain {
		background: #20222e;
		border: 1px solid rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary-alt);
		font-weight: 600;
	}
	.next {
		background: var(--gradient-cta-primary);
		color: var(--color-cta-primary-text);
		font-weight: 700;
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/AnalysisTab.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/AnalysisTab.svelte src/lib/components/AnalysisTab.test.ts
git commit -m "feat: add AnalysisTab component"
```

---

## Task 13: `ReviewTab.svelte`

**Files:**
- Create: `src/lib/components/ReviewTab.svelte`
- Test: `src/lib/components/ReviewTab.test.ts`

**Interfaces:**
- Consumes: `EvalGraph`, `AccuracyBlock`, `BreakdownTable`, `PhaseTable`; `EVAL_PER_PLY`, `CLASS_CODES` from `$lib/game/mock-data`.
- Props: `{ ply: number }`.

Reference: markup lines 231-298 (the whole `isReviewTab` block, scrollable).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/ReviewTab.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import ReviewTab from './ReviewTab.svelte';

describe('ReviewTab', () => {
	it('renders the eval graph, accuracy block, breakdown, and phase table together', () => {
		const { container, getByText } = render(ReviewTab, { props: { ply: 31 } });
		expect(container.querySelector('svg')).not.toBeNull();
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('Brilliant')).toBeTruthy();
		expect(getByText('Opening')).toBeTruthy();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/ReviewTab.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/ReviewTab.svelte`**

```svelte
<script lang="ts">
	import { EVAL_PER_PLY, CLASS_CODES } from '$lib/game/mock-data';
	import EvalGraph from './EvalGraph.svelte';
	import AccuracyBlock from './AccuracyBlock.svelte';
	import BreakdownTable from './BreakdownTable.svelte';
	import PhaseTable from './PhaseTable.svelte';

	interface Props {
		ply: number;
	}

	let { ply }: Props = $props();
</script>

<div class="review-tab sbscroll">
	<div class="graph-slot">
		<EvalGraph evalPerPly={EVAL_PER_PLY} classCodes={CLASS_CODES} {ply} height={66} />
	</div>
	<AccuracyBlock />
	<div class="divider"></div>
	<BreakdownTable />
	<PhaseTable />
</div>

<style>
	.review-tab {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		padding: 16px 18px 18px;
	}
	.graph-slot {
		margin-bottom: 16px;
	}
	.divider {
		border-top: 1px solid var(--color-hairline-high);
		margin-bottom: 12px;
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/ReviewTab.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ReviewTab.svelte src/lib/components/ReviewTab.test.ts
git commit -m "feat: add ReviewTab component"
```

---

## Task 14: `DetailsTab.svelte`, `ExploreTab.svelte`

**Files:**
- Create: `src/lib/components/DetailsTab.svelte`, `src/lib/components/ExploreTab.svelte`
- Test: `src/lib/components/DetailsTab.test.ts`, `src/lib/components/ExploreTab.test.ts`

**Interfaces:**
- `DetailsTab`: no props — fully static content (README §6.3 "Details tab" bullet; markup lines 344-357).
- `ExploreTab`: props `{ onOpenOpenings: () => void }` (markup lines 359-369).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/components/DetailsTab.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DetailsTab from './DetailsTab.svelte';

describe('DetailsTab', () => {
	it('renders the key-value details list', () => {
		const { getByText } = render(DetailsTab);
		expect(getByText('Event')).toBeTruthy();
		expect(getByText('Chess.com · Live Rapid')).toBeTruthy();
		expect(getByText('10 + 0')).toBeTruthy();
		expect(getByText('Italian Game · C50')).toBeTruthy();
		expect(getByText('Locally · 100%')).toBeTruthy();
	});
});
```

```ts
// src/lib/components/ExploreTab.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ExploreTab from './ExploreTab.svelte';

describe('ExploreTab', () => {
	it('renders the win-rate stat and calls onOpenOpenings when clicked', async () => {
		const onOpenOpenings = vi.fn();
		const { getByText } = render(ExploreTab, { props: { onOpenOpenings } });
		expect(getByText('61%')).toBeTruthy();
		await fireEvent.click(getByText('Open in Opening Explorer'));
		expect(onOpenOpenings).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/components/DetailsTab.test.ts src/lib/components/ExploreTab.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/DetailsTab.svelte`**

```svelte
<div class="details-tab sbscroll">
	<div class="heading">Game details</div>
	<div class="list">
		<div class="row"><span class="key">Event</span><span class="val">Chess.com · Live Rapid</span></div>
		<div class="row"><span class="key">Time control</span><span class="val sbmono">10 + 0</span></div>
		<div class="row"><span class="key">Date</span><span class="val sbmono">2024.05.14</span></div>
		<div class="row"><span class="key">Opening</span><span class="val">Italian Game · C50</span></div>
		<div class="row"><span class="key">Moves</span><span class="val sbmono">41</span></div>
		<div class="row last"><span class="key">Analyzed</span><span class="val analyzed">Locally · 100%</span></div>
	</div>
	<div class="note">Everything here was computed on your machine. No moves left your device.</div>
</div>

<style>
	.details-tab {
		flex: 1;
		overflow-y: auto;
		padding: 18px 20px;
	}
	.heading {
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 14px;
	}
	.list {
		display: flex;
		flex-direction: column;
	}
	.row {
		display: flex;
		justify-content: space-between;
		padding: 10px 2px;
		border-bottom: 1px solid var(--color-hairline-low);
	}
	.row.last {
		border-bottom: none;
	}
	.key {
		font-size: 12.5px;
		color: var(--color-text-tertiary);
	}
	.val {
		font-size: 12.5px;
		color: var(--color-text-primary-alt);
	}
	.val.analyzed {
		color: var(--color-accent-green);
	}
	.note {
		margin-top: 18px;
		padding: 13px 15px;
		border-radius: var(--radius-inset);
		background: var(--color-card-bg);
		border: 1px solid var(--color-hairline-low);
		font-size: 12px;
		color: var(--color-text-tertiary);
		line-height: 1.5;
	}
</style>
```

- [ ] **Step 4: Implement `src/lib/components/ExploreTab.svelte`**

```svelte
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onOpenOpenings: () => void;
	}

	let { onOpenOpenings }: Props = $props();
</script>

<div class="explore-tab sbscroll">
	<div class="heading">Explore this opening</div>
	<div class="subtitle">Italian Game · you've played this line 75 times.</div>
	<div class="card" onclick={onOpenOpenings}>
		<div class="stat sbmono">61%</div>
		<div class="stat-label">win rate in the Italian Game</div>
		<div class="link">
			Open in Opening Explorer
			<Icon d="M9 6l6 6-6 6" size={15} stroke="#4ADEA0" strokeWidth={2} />
		</div>
	</div>
</div>

<style>
	.explore-tab {
		flex: 1;
		overflow-y: auto;
		padding: 18px 20px;
	}
	.heading {
		font-size: 13px;
		font-weight: 600;
		margin-bottom: 6px;
	}
	.subtitle {
		font-size: 12px;
		color: var(--color-text-tertiary);
		margin-bottom: 16px;
	}
	.card {
		border-radius: 14px;
		padding: 18px;
		background: radial-gradient(120% 130% at 0% 0%, rgba(74, 222, 160, 0.12), transparent 55%),
			var(--color-card-bg);
		border: 1px solid rgba(74, 222, 160, 0.2);
		cursor: pointer;
	}
	.stat {
		font-size: 24px;
		font-weight: 600;
		color: var(--color-accent-green);
	}
	.stat-label {
		font-size: 11px;
		color: var(--color-text-tertiary);
		margin-bottom: 14px;
	}
	.link {
		display: flex;
		align-items: center;
		gap: 7px;
		font-size: 12.5px;
		color: var(--color-accent-green);
		font-weight: 600;
	}
</style>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/components/DetailsTab.test.ts src/lib/components/ExploreTab.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/DetailsTab.svelte src/lib/components/ExploreTab.svelte src/lib/components/DetailsTab.test.ts src/lib/components/ExploreTab.test.ts
git commit -m "feat: add DetailsTab and ExploreTab components"
```

---

## Task 15: `NavControls.svelte`, `BottomBar.svelte`

**Files:**
- Create: `src/lib/components/NavControls.svelte`, `src/lib/components/BottomBar.svelte`
- Test: `src/lib/components/NavControls.test.ts`, `src/lib/components/BottomBar.test.ts`

**Interfaces:**
- `NavControls` props: `{ onFirst: () => void; onPrev: () => void; onNext: () => void; onLast: () => void }` (markup lines 385-391).
- `BottomBar` props: `{ ply: number; onFirst; onPrev; onNext; onLast }` — composes `EvalGraph` (height 62) + `NavControls` (markup lines 372-393).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/components/NavControls.test.ts
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import NavControls from './NavControls.svelte';

describe('NavControls', () => {
	it('renders 5 buttons and wires each callback', async () => {
		const onFirst = vi.fn();
		const onPrev = vi.fn();
		const onNext = vi.fn();
		const onLast = vi.fn();
		const { container } = render(NavControls, { props: { onFirst, onPrev, onNext, onLast } });
		const buttons = container.querySelectorAll('button');
		expect(buttons).toHaveLength(5); // First, Prev, big-Next, Next, Last

		await fireEvent.click(buttons[0]);
		expect(onFirst).toHaveBeenCalledOnce();
		await fireEvent.click(buttons[1]);
		expect(onPrev).toHaveBeenCalledOnce();
		await fireEvent.click(buttons[2]); // big center Next
		expect(onNext).toHaveBeenCalledOnce();
		await fireEvent.click(buttons[3]); // small Next
		expect(onNext).toHaveBeenCalledTimes(2);
		await fireEvent.click(buttons[4]);
		expect(onLast).toHaveBeenCalledOnce();
	});
});
```

```ts
// src/lib/components/BottomBar.test.ts
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import BottomBar from './BottomBar.svelte';

describe('BottomBar', () => {
	it('renders the eval graph at height 62 and the nav controls', () => {
		const { container } = render(BottomBar, {
			props: { ply: 0, onFirst: () => {}, onPrev: () => {}, onNext: () => {}, onLast: () => {} }
		});
		expect(container.querySelector('svg')?.getAttribute('height')).toBe('62');
		expect(container.querySelectorAll('button')).toHaveLength(5);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- --run src/lib/components/NavControls.test.ts src/lib/components/BottomBar.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/NavControls.svelte`**

Per Table A, both "Next" buttons (small icon-button on the right and the big center play-triangle button) call `navNext` in the reference (line 388 `onClick="{{ navNext }}"` and line 389 also `onClick="{{ navNext }}"`) — replicate exactly: both wire to the same `onNext` prop.

```svelte
<script lang="ts">
	import Icon from './Icon.svelte';

	interface Props {
		onFirst: () => void;
		onPrev: () => void;
		onNext: () => void;
		onLast: () => void;
	}

	let { onFirst, onPrev, onNext, onLast }: Props = $props();
</script>

<div class="nav-controls">
	<button type="button" class="nav-btn" onclick={onFirst}>
		<Icon d="M19 5v14M15 6l-7 6 7 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
	<button type="button" class="nav-btn" onclick={onPrev}>
		<Icon d="M15 6l-6 6 6 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
	<button type="button" class="play-btn" onclick={onNext}>
		<svg width="17" height="17" viewBox="0 0 24 24" fill="#062018" stroke="none">
			<path d="M7 5l12 7-12 7z" />
		</svg>
	</button>
	<button type="button" class="nav-btn" onclick={onNext}>
		<Icon d="M9 6l6 6-6 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
	<button type="button" class="nav-btn" onclick={onLast}>
		<Icon d="M5 5v14M9 6l7 6-7 6" size={16} stroke="#9298A8" strokeWidth={2} />
	</button>
</div>

<style>
	.nav-controls {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 12px 11px;
	}
	.nav-btn {
		width: 52px;
		height: 38px;
		border-radius: 9px;
		background: #14161f;
		border: 1px solid rgba(255, 255, 255, 0.07);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.play-btn {
		width: 70px;
		height: 38px;
		border-radius: 9px;
		background: var(--gradient-cta-primary);
		border: none;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		box-shadow: 0 4px 14px rgba(74, 222, 160, 0.28);
	}
</style>
```

- [ ] **Step 4: Implement `src/lib/components/BottomBar.svelte`**

```svelte
<script lang="ts">
	import { EVAL_PER_PLY, CLASS_CODES } from '$lib/game/mock-data';
	import EvalGraph from './EvalGraph.svelte';
	import NavControls from './NavControls.svelte';

	interface Props {
		ply: number;
		onFirst: () => void;
		onPrev: () => void;
		onNext: () => void;
		onLast: () => void;
	}

	let { ply, onFirst, onPrev, onNext, onLast }: Props = $props();
</script>

<div class="bottom-bar">
	<div class="graph-slot">
		<EvalGraph evalPerPly={EVAL_PER_PLY} classCodes={CLASS_CODES} {ply} height={62} />
	</div>
	<NavControls {onFirst} {onPrev} {onNext} {onLast} />
</div>

<style>
	.bottom-bar {
		flex: none;
		border-top: 1px solid var(--color-hairline-high);
		background: var(--color-bottom-bar-bg);
	}
	.graph-slot {
		padding: 8px 12px 2px;
	}
</style>
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -- --run src/lib/components/NavControls.test.ts src/lib/components/BottomBar.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/NavControls.svelte src/lib/components/BottomBar.svelte src/lib/components/NavControls.test.ts src/lib/components/BottomBar.test.ts
git commit -m "feat: add NavControls and BottomBar components"
```

---

## Task 16: `ReviewPanel.svelte`

**Files:**
- Create: `src/lib/components/ReviewPanel.svelte`
- Test: `src/lib/components/ReviewPanel.test.ts`

**Interfaces:**
- Consumes: `AnalysisTab`, `ReviewTab`, `DetailsTab`, `ExploreTab`, `BottomBar`, `Icon`; `appState`, `goToPly`, `stepPly` from `$lib/stores/app-state.svelte`; `Tab` from `$lib/types`.
- Props: `{ onToggleFlip: () => void; onOpenOpenings: () => void }` (screen/ply/tab all read/written via `appState` directly — matches the existing `Sidebar.svelte` convention of mutating the singleton store inline rather than prop-drilling every field).

Reference: markup lines 210-394 (whole right panel: header, tabs, 4 tab bodies, shared bottom bar). Tab defs/styles: lines 1213-1219.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/ReviewPanel.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import ReviewPanel from './ReviewPanel.svelte';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.tab = 'analysis';
	appState.ply = 31;
	appState.flipped = false;
});

describe('ReviewPanel', () => {
	it('renders all 4 tab buttons and shows the Analysis tab by default', () => {
		const { getByText, container } = render(ReviewPanel, {
			props: { onToggleFlip: () => {}, onOpenOpenings: () => {} }
		});
		expect(getByText('Analysis')).toBeTruthy();
		expect(getByText('Review')).toBeTruthy();
		expect(getByText('Details')).toBeTruthy();
		expect(getByText('Explore')).toBeTruthy();
		expect(container.querySelectorAll('.row')).not.toHaveLength(0); // MoveList rows present
	});

	it('switches tabs on click and hides the bottom bar only on the Review tab', async () => {
		const { getByText, container } = render(ReviewPanel, {
			props: { onToggleFlip: () => {}, onOpenOpenings: () => {} }
		});
		expect(container.querySelector('.bottom-bar')).not.toBeNull();

		await fireEvent.click(getByText('Review'));
		expect(appState.tab).toBe('review');
		expect(container.querySelector('.bottom-bar')).toBeNull();

		await fireEvent.click(getByText('Details'));
		expect(appState.tab).toBe('details');
		expect(container.querySelector('.bottom-bar')).not.toBeNull();
	});

	it('calls onToggleFlip when the flip button is clicked', async () => {
		const onToggleFlip = vi.fn();
		const { container } = render(ReviewPanel, {
			props: { onToggleFlip, onOpenOpenings: () => {} }
		});
		await fireEvent.click(container.querySelector('.flip-btn')!);
		expect(onToggleFlip).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/ReviewPanel.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/ReviewPanel.svelte`**

```svelte
<script lang="ts">
	import { appState, goToPly, stepPly, MAX_PLY } from '$lib/stores/app-state.svelte';
	import Icon from './Icon.svelte';
	import AnalysisTab from './AnalysisTab.svelte';
	import ReviewTab from './ReviewTab.svelte';
	import DetailsTab from './DetailsTab.svelte';
	import ExploreTab from './ExploreTab.svelte';
	import BottomBar from './BottomBar.svelte';
	import type { Tab } from '$lib/types';

	interface Props {
		onToggleFlip: () => void;
		onOpenOpenings: () => void;
	}

	let { onToggleFlip, onOpenOpenings }: Props = $props();

	const TABS: Array<{ id: Tab; label: string; icon: string }> = [
		{ id: 'analysis', label: 'Analysis', icon: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4' },
		{
			id: 'review',
			label: 'Review',
			icon: 'M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z'
		},
		{ id: 'details', label: 'Details', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v5M12 8h.01' },
		{ id: 'explore', label: 'Explore', icon: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM15 9l-2 4-4 2 2-4z' }
	];
</script>

<div class="review-panel">
	<div class="header">
		<div class="star-badge">
			<svg width="13" height="13" viewBox="0 0 24 24" fill="#062018" stroke="none">
				<path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.8 5.7 21l2.3-7.1-6-4.5h7.6z" />
			</svg>
		</div>
		<span class="title">Game Review</span>
		<div class="fill"></div>
		<button type="button" class="icon-btn">
			<Icon
				d="M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"
				size={15}
				stroke="#8A90A0"
				strokeWidth={2}
			/>
		</button>
		<button type="button" class="icon-btn flip-btn" onclick={onToggleFlip} title="Flip board">
			<Icon
				d="M8 3L4 7l4 4 M4 7h11a5 5 0 0 1 5 5 M16 21l4-4-4-4 M20 17H9a5 5 0 0 1-5-5"
				size={15}
				stroke="#8A90A0"
				strokeWidth={2}
			/>
		</button>
	</div>

	<div class="tabs">
		{#each TABS as t (t.id)}
			<button
				type="button"
				class="tab"
				class:active={appState.tab === t.id}
				onclick={() => (appState.tab = t.id)}
			>
				<Icon d={t.icon} size={15} stroke={appState.tab === t.id ? '#4ADEA0' : '#6B7180'} strokeWidth={2} />
				<span>{t.label}</span>
			</button>
		{/each}
	</div>

	{#if appState.tab === 'review'}
		<ReviewTab ply={appState.ply} />
	{:else if appState.tab === 'analysis'}
		<AnalysisTab ply={appState.ply} onSelectPly={goToPly} onNext={() => stepPly(1)} />
	{:else if appState.tab === 'details'}
		<DetailsTab />
	{:else}
		<ExploreTab {onOpenOpenings} />
	{/if}

	{#if appState.tab !== 'review'}
		<BottomBar
			ply={appState.ply}
			onFirst={() => goToPly(0)}
			onPrev={() => stepPly(-1)}
			onNext={() => stepPly(1)}
			onLast={() => goToPly(MAX_PLY)}
		/>
	{/if}
</div>

<style>
	.review-panel {
		width: var(--layout-review-panel-width);
		flex: none;
		min-width: 0;
		display: flex;
		flex-direction: column;
		background: var(--color-panel-bg);
		border: 1px solid var(--color-hairline-low);
		border-radius: var(--radius-card);
		overflow: hidden;
	}
	.header {
		flex: none;
		display: flex;
		align-items: center;
		gap: 9px;
		padding: 13px 16px 12px;
		border-bottom: 1px solid var(--color-hairline-low);
	}
	.star-badge {
		width: 23px;
		height: 23px;
		border-radius: 50%;
		background: var(--color-accent-green);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.title {
		font-size: 15px;
		font-weight: 700;
		letter-spacing: -0.01em;
	}
	.fill {
		flex: 1;
	}
	.icon-btn {
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: var(--color-card-bg);
		border: 1px solid var(--color-hairline-low);
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}
	.tabs {
		display: flex;
		gap: 2px;
		padding: 6px;
		border-bottom: 1px solid var(--color-hairline-low);
		flex: none;
	}
	.tab {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 9px 6px;
		border-radius: 10px;
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
		border: none;
		background: none;
		color: var(--color-text-tertiary);
	}
	.tab.active {
		background: rgba(74, 222, 160, 0.1);
		color: var(--color-active-item-text);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/ReviewPanel.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/ReviewPanel.svelte src/lib/components/ReviewPanel.test.ts
git commit -m "feat: add ReviewPanel component"
```

---

## Task 17: `GameReviewScreen.svelte`

**Files:**
- Create: `src/lib/components/GameReviewScreen.svelte`
- Test: `src/lib/components/GameReviewScreen.test.ts`

**Interfaces:**
- Consumes: `Board` (Iteration 3), `PlayerRow`, `EvalBar`, `ReviewPanel`; `getReviewPly`, `getPlayerRows` from `$lib/game/review`; `appState`, `newGame`, `handleReviewKeydown` from `$lib/stores/app-state.svelte`.
- No props — reads everything from `appState` (matches `+layout.svelte`/`Sidebar.svelte` convention).

Reference: markup lines 144-208 (board area) + 210 (panel slot, filled by `ReviewPanel`).

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/GameReviewScreen.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import GameReviewScreen from './GameReviewScreen.svelte';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.screen = 'review';
	appState.gameLoaded = true;
	appState.ply = 31;
	appState.flipped = false;
	appState.tab = 'analysis';
});

describe('GameReviewScreen', () => {
	it('renders the board, both player rows, and the review panel', () => {
		const { container, getByText } = render(GameReviewScreen);
		expect(container.querySelectorAll('[data-sq]')).toHaveLength(64);
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('DominikP')).toBeTruthy();
		expect(getByText('Game Review')).toBeTruthy();
	});

	it('renders DominikP on top and Jonas on bottom when unflipped', () => {
		const { container } = render(GameReviewScreen);
		const rows = container.querySelectorAll('.player-row');
		expect(rows[0].textContent).toContain('DominikP');
		expect(rows[1].textContent).toContain('Jonas');
	});

	it('clicking New PGN resets to onboarding', async () => {
		const { getByText } = render(GameReviewScreen);
		await fireEvent.click(getByText('New PGN'));
		expect(appState.gameLoaded).toBe(false);
	});

	it('ArrowRight/ArrowLeft step the ply while the screen is review', async () => {
		render(GameReviewScreen);
		appState.ply = 5;
		await fireEvent.keyDown(window, { key: 'ArrowRight' });
		expect(appState.ply).toBe(6);
		await fireEvent.keyDown(window, { key: 'ArrowLeft' });
		expect(appState.ply).toBe(5);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/GameReviewScreen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/GameReviewScreen.svelte`**

```svelte
<script lang="ts">
	import { onMount } from 'svelte';
	import { appState, newGame, handleReviewKeydown } from '$lib/stores/app-state.svelte';
	import { getReviewPly, getPlayerRows } from '$lib/game/review';
	import Board from './Board.svelte';
	import PlayerRow from './PlayerRow.svelte';
	import EvalBar from './EvalBar.svelte';
	import ReviewPanel from './ReviewPanel.svelte';

	const data = $derived(getReviewPly(appState.ply));
	const rows = $derived(getPlayerRows(appState.ply, appState.flipped));

	onMount(() => {
		window.addEventListener('keydown', handleReviewKeydown);
		return () => window.removeEventListener('keydown', handleReviewKeydown);
	});
</script>

<div class="game-review">
	<div class="board-area">
		<PlayerRow player={rows.top} showNewGameButton onNewGame={newGame} />

		<div class="board-row">
			<EvalBar whitePct={data.whitePct} evalNum={data.evalNum} whiteAtBottom={!appState.flipped} />
			<div class="board-sizer">
				<Board
					position={data.position}
					ply={appState.ply}
					flipped={appState.flipped}
					lastMove={data.lastMove}
					classCode={data.classCode}
					best={data.best}
				/>
			</div>
		</div>

		<PlayerRow player={rows.bottom} />
	</div>

	<ReviewPanel
		onToggleFlip={() => (appState.flipped = !appState.flipped)}
		onOpenOpenings={() => (appState.screen = 'openings')}
	/>
</div>

<style>
	.game-review {
		padding: 12px 14px;
		display: flex;
		gap: 14px;
		align-items: stretch;
		height: 100%;
		overflow: hidden;
	}
	.board-area {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.board-row {
		flex: 1;
		min-height: 0;
		display: flex;
		gap: 9px;
		justify-content: center;
		align-items: stretch;
		padding: 8px 0;
	}
	.board-sizer {
		flex: 1;
		min-width: 0;
		min-height: 0;
		container-type: size;
		display: flex;
		align-items: center;
		justify-content: center;
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/GameReviewScreen.test.ts`
Expected: PASS (4/4).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/GameReviewScreen.svelte src/lib/components/GameReviewScreen.test.ts
git commit -m "feat: add GameReviewScreen component"
```

---

## Task 18: `OnboardingScreen.svelte`

**Files:**
- Create: `src/lib/components/OnboardingScreen.svelte`
- Test: `src/lib/components/OnboardingScreen.test.ts`

**Interfaces:**
- Consumes: `appState`, `startReview` from `$lib/stores/app-state.svelte`; `Icon`.
- No props.

Reference: markup lines 115-140. Sample-PGN string: `pasteSample` handler, line 1290 of the earlier read.

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/components/OnboardingScreen.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import OnboardingScreen from './OnboardingScreen.svelte';
import { appState } from '$lib/stores/app-state.svelte';

beforeEach(() => {
	appState.gameLoaded = false;
	appState.pgnText = '';
	appState.screen = 'review';
});

describe('OnboardingScreen', () => {
	it('renders the heading, textarea, and CTA buttons', () => {
		const { getByText, container } = render(OnboardingScreen);
		expect(getByText('Review your chess game')).toBeTruthy();
		expect(container.querySelector('textarea')).not.toBeNull();
		expect(getByText('Start Review')).toBeTruthy();
		expect(getByText('Upload .pgn')).toBeTruthy();
	});

	it('"Paste sample game" fills the textarea with the sample PGN', async () => {
		const { getByText, container } = render(OnboardingScreen);
		await fireEvent.click(getByText('Paste sample game'));
		const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
		expect(textarea.value).toContain('1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5');
		expect(appState.pgnText).toContain('[Event "Live Rapid"]');
	});

	it('"Start Review" loads the game regardless of textarea contents', async () => {
		const { getByText } = render(OnboardingScreen);
		await fireEvent.click(getByText('Start Review'));
		expect(appState.gameLoaded).toBe(true);
		expect(appState.screen).toBe('review');
		expect(appState.ply).toBe(31);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run src/lib/components/OnboardingScreen.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement `src/lib/components/OnboardingScreen.svelte`**

```svelte
<script lang="ts">
	import { appState, startReview } from '$lib/stores/app-state.svelte';
	import Icon from './Icon.svelte';

	const SAMPLE_PGN =
		'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';

	function pasteSample() {
		appState.pgnText = SAMPLE_PGN;
	}
</script>

<div class="onboarding">
	<div class="content">
		<div class="logo">
			<div class="cutout"></div>
			<div class="square teal"></div>
			<div class="square purple"></div>
		</div>
		<div class="heading">Review your chess game</div>
		<div class="subtitle">
			Paste a PGN to start a local game review. Every move is classified and analyzed on your
			machine — nothing leaves your device.
		</div>

		<div class="pgn-card">
			<div class="card-header">
				<span class="label">PGN</span>
				<span class="paste-sample" onclick={pasteSample}>
					<Icon
						d="M9 5h6M9 5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2M9 5V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"
						size={13}
						stroke="#4ADEA0"
						strokeWidth={2}
					/>
					Paste sample game
				</span>
			</div>
			<textarea
				class="sbmono sbscroll"
				bind:value={appState.pgnText}
				spellcheck="false"
				placeholder={'[Event "Live Rapid"]\n[White "Jonas"]\n[Black "DominikP"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 ...'}
			></textarea>
			<div class="actions">
				<button type="button" class="start" onclick={startReview}>
					Start Review
					<Icon d="M5 12h13M12 5l7 7-7 7" size={16} stroke="#062018" strokeWidth={2.4} />
				</button>
				<button type="button" class="upload">
					<Icon d="M12 3v12M7 10l5 5 5-5M5 21h14" size={15} stroke="#8A90A0" strokeWidth={2} />
					Upload .pgn
				</button>
			</div>
		</div>

		<div class="footer">
			<span class="dot"></span>
			Local · Offline — analysis runs entirely on this device.
		</div>
	</div>
</div>

<style>
	.onboarding {
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}
	.content {
		width: 100%;
		max-width: 760px;
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.logo {
		width: 52px;
		height: 52px;
		border-radius: 15px;
		background: var(--gradient-logo);
		position: relative;
		box-shadow: 0 12px 30px rgba(59, 130, 246, 0.4);
		margin-bottom: 20px;
		overflow: hidden;
	}
	.cutout {
		position: absolute;
		inset: 9px;
		border-radius: 7px;
		background: var(--color-deep-inset-bg);
	}
	.square {
		position: absolute;
		width: 12px;
		height: 12px;
		border-radius: 3px;
	}
	.square.teal {
		left: 14px;
		top: 14px;
		background: var(--color-accent-teal);
	}
	.square.purple {
		right: 12px;
		bottom: 12px;
		background: var(--color-accent-purple);
	}
	.heading {
		font-size: 30px;
		font-weight: 700;
		letter-spacing: -0.02em;
		text-align: center;
	}
	.subtitle {
		font-size: 15px;
		color: var(--color-text-tertiary);
		margin-top: 9px;
		text-align: center;
		max-width: 520px;
		line-height: 1.5;
	}
	.pgn-card {
		width: 100%;
		margin-top: 28px;
		background: var(--color-panel-bg);
		border: 1px solid var(--color-hairline-high);
		border-radius: var(--radius-card);
		padding: 16px 16px 14px;
	}
	.card-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 10px;
	}
	.label {
		font-size: 12px;
		color: var(--color-text-tertiary);
		font-weight: 500;
		letter-spacing: 0.02em;
	}
	.paste-sample {
		font-size: 11.5px;
		color: var(--color-accent-green);
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
	}
	textarea {
		width: 100%;
		height: 190px;
		resize: none;
		background: var(--color-deep-inset-bg);
		border: 1px solid var(--color-hairline-high);
		border-radius: var(--radius-inset);
		padding: 13px 14px;
		color: #d7dbe6;
		font-size: 13px;
		line-height: 1.55;
		outline: none;
	}
	.actions {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 13px;
	}
	.start {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 13px;
		border-radius: 12px;
		background: var(--gradient-cta-primary);
		color: var(--color-cta-primary-text);
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
		border: none;
		box-shadow: var(--shadow-cta-glow);
	}
	.upload {
		flex: none;
		padding: 13px 18px;
		border-radius: 12px;
		background: #1b1e2a;
		border: 1px solid var(--color-hairline-high);
		color: var(--color-text-secondary);
		font-weight: 500;
		font-size: 14px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.footer {
		display: flex;
		align-items: center;
		gap: 7px;
		margin-top: 16px;
		font-size: 11.5px;
		color: var(--color-text-muted-dark);
	}
	.dot {
		width: 5px;
		height: 5px;
		border-radius: 50%;
		background: var(--color-accent-green);
	}
</style>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run src/lib/components/OnboardingScreen.test.ts`
Expected: PASS (3/3).

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/OnboardingScreen.svelte src/lib/components/OnboardingScreen.test.ts
git commit -m "feat: add OnboardingScreen component"
```

---

## Task 19: Wire `+page.svelte`, remove the Iteration-3 harness, update docs

**Files:**
- Modify: `src/routes/+page.svelte`
- Modify: `src/routes/page.test.ts`
- Modify: `src/lib/components/README.md`
- Modify: `src/lib/charts/index.ts`
- Modify: `src/lib/board/index.ts` (only if `dev-fixtures` was ever re-exported there — confirm by reading the file; per Task 2's read, it was not, so likely no change needed)

**Interfaces:** none new — this task only rewires existing pieces.

- [ ] **Step 1: Read the current `src/routes/+page.svelte` and `src/routes/page.test.ts`**

(They were already read once this session — re-read at task start since a fresh implementer subagent has no prior context. Note the existing test "shows the Game Review placeholder once a game is loaded" — Iteration 3 already adapted this once; it must be adapted again now that the harness becomes the real screen.)

- [ ] **Step 2: Rewrite `src/routes/+page.svelte`**

```svelte
<script lang="ts">
	import type { Screen } from '$lib/types';
	import { appState } from '$lib/stores/app-state.svelte';
	import OnboardingScreen from '$lib/components/OnboardingScreen.svelte';
	import GameReviewScreen from '$lib/components/GameReviewScreen.svelte';

	const SCREEN_LABELS: Record<Exclude<Screen, 'review'>, string> = {
		home: 'Dashboard',
		openings: 'Opening Explorer',
		insights: 'Insights & Weakness Timeline',
		training: 'Training',
		games: 'Games',
		sessions: 'Sessions',
		stats: 'Stats',
		settings: 'Settings'
	};
</script>

{#if appState.screen === 'review' && appState.gameLoaded}
	<GameReviewScreen />
{:else if appState.screen === 'review'}
	<OnboardingScreen />
{:else}
	<div class="screen-placeholder">
		{SCREEN_LABELS[appState.screen]} — scaffold OK
	</div>
{/if}

<style>
	.screen-placeholder {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--color-text-muted);
		font-family: var(--font-mono);
	}
</style>
```

- [ ] **Step 3: Update `src/routes/page.test.ts`**

Read the existing test file first. Replace whatever assertion covered the old "Game Review — scaffold OK" placeholder text (from Iteration 3's harness) with an assertion appropriate to the new real screen — e.g., asserting the board renders (`container.querySelectorAll('[data-sq]')` has length 64) or that `getByText('Game Review')` (the ReviewPanel header) is present, when `appState.gameLoaded` is set. Keep every other existing test in the file intact; this task only touches the assertion(s) that depended on the now-removed placeholder path.

- [ ] **Step 4: Update `src/lib/components/README.md`**

Replace the "Landed (Iteration 3 — the Board component)" paragraph's forward-looking note about `dev-fixtures.ts` with a new paragraph for Iteration 4:

```markdown
**Landed (Iteration 4 — the Game Review screen):** `OnboardingScreen.svelte`, `GameReviewScreen.svelte`,
`ReviewPanel.svelte` (header, tabs, `AnalysisTab`/`ReviewTab`/`DetailsTab`/`ExploreTab`, `BottomBar`/`NavControls`),
`PlayerRow.svelte`, `EvalBar.svelte`, `EvalGraph.svelte`, `CoachCard.svelte`, `MoveList.svelte`,
`BreakdownTable.svelte`, `PhaseTable.svelte`, `AccuracyBlock.svelte`, and `ClassBadge.svelte` (the new
16px/21px/22px badge sizes — the board's own 36px destination badge stays inline in `BoardSquare.svelte`).
Supporting pure logic lives in `src/lib/game/` (`mock-engine.ts`, `mock-data.ts`, `review.ts`) and
`src/lib/charts/eval-graph.ts`. See `design_handoff_secondboard/README.md` §6.2/§6.3 and `LOGIC.md` §1-5.
`src/lib/game/mock-engine.ts` and `mock-data.ts` are explicitly MOCK data/logic (LOGIC.md header table) —
they stand in for the Rust `pgn`/`analysis`/`engine` modules until Iterations 5-8 replace them piece by
piece (README §11).
```

Remove the old sentence referencing `src/lib/board/dev-fixtures.ts` (that file no longer exists after Task 2).

- [ ] **Step 5: Update `src/lib/charts/index.ts`**

```ts
export * from './eval-graph';
// RatingTrend, SkillRadar land here in the Dashboard/Insights iterations (README §11 step 8).
```

- [ ] **Step 6: Run the full test suite and the build**

Run: `npm run test -- --run`
Expected: all tests pass, no failures from stale imports.

Run: `npm run check`
Expected: no TypeScript errors (confirms `dev-fixtures.ts` deletion didn't leave a dangling import anywhere, and every new file type-checks in strict mode).

Run: `npm run build`
Expected: production build succeeds (confirms the Vite `?url&no-inline` sprite imports and all new components bundle cleanly).

- [ ] **Step 7: Commit**

```bash
git add src/routes/+page.svelte src/routes/page.test.ts src/lib/components/README.md src/lib/charts/index.ts
git commit -m "feat: wire the Onboarding and Game Review screens into the root route"
```

---

## Self-Review Notes (already applied above)

- **Spec coverage:** README §6.2 (Onboarding), §6.3 (Game Review incl. all 4 tabs + shared bottom bar), LOGIC.md §1 (state/keyboard), §2.5 (captured material/eval bar), §3.1 (eval graph), §4 (move list/breakdown/phases/accuracy), §5 (coach card) are each covered by a task above. §2.1-2.4 (board core, arrow, slide animation) and §6.1 (chrome) were Iterations 2-3 and are reused, not rebuilt.
- **Explicitly out of scope, flagged so a reviewer doesn't treat it as a gap:** `engineLines`/PV list (dead mock data, never rendered — confirmed by grep against the reference), the `showLines`/`selfAnalysis` toggle switches (computed by the reference but never rendered in this screen), real PGN parsing/file upload, and the `home`/`openings`/`insights`/`training`/`games`/`sessions`/`stats`/`settings` screens (README §6 explicitly scopes those to later iterations or "out of scope for 1:1 recreation").
- **Type consistency check:** `ReviewPly`/`PlayerRowData` (Task 3) are consumed unchanged by `CoachCard`/`AnalysisTab` (Task 9/12) and `PlayerRow`/`GameReviewScreen` (Task 8/17); `ClassBadge`'s `size: 16 | 21 | 22` union matches every call site (`MoveList`→16, `BreakdownTable`/`PhaseTable`→21/22); `Tab`/`Screen` types are the pre-existing ones from `$lib/types`, not redeclared.
