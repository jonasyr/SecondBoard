# Iteration 1: Scaffold — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a maintainable, scalable Tauri v2 + SvelteKit (Svelte 5) project skeleton — offline-capable fonts, typed design tokens matching the SecondBoard UI spec exactly, global CSS, and a bare app shell — as the foundation every later UI iteration builds on.

**Architecture:** SvelteKit with `@sveltejs/adapter-static` in SPA mode (SSR disabled) as the frontend, TypeScript in strict mode throughout, a typed `tokens.ts` module as the single source of truth for design values (mirrored into CSS custom properties for use in `<style>` blocks), and a `src-tauri/` Rust shell scaffolded via `tauri init` (no custom commands yet — that starts in a later iteration once the UI is pixel-verified, per `design_handoff_secondboard/README.md` §11). ESLint + Prettier + Vitest are wired in from the start so every later iteration has lint/format/test guardrails instead of retrofitting them.

**Tech Stack:** SvelteKit 2.x + Svelte 5 (runes), TypeScript (strict), `@sveltejs/adapter-static`, Tauri v2, `@fontsource/geist-sans` + `@fontsource/geist-mono` (self-hosted fonts), Vitest, ESLint, Prettier.

## Global Constraints

- **Offline-first:** no runtime network calls for fonts or assets — everything self-hosted (`design_handoff_secondboard/README.md` §25.5, §4.1).
- **SPA mode only:** Tauri cannot serve SvelteKit SSR output — `adapter-static` with SSR disabled globally (`export const ssr = false` in root `+layout.ts`) is mandatory (README §3, OVERVIEW §6.2).
- **TypeScript strict mode** everywhere; no `any` in new code.
- **Exact design tokens** — every color/radius/spacing value below is copied verbatim from `design_handoff_secondboard/README.md` §4. Do not approximate or "round" a hex value.
- **Module layout is fixed** per `SecondBoard_PROJECT_OVERVIEW.md` §8.2 / README §3: `src/lib/{components,stores,api,board,charts,types}`. Later iterations populate these folders — this iteration only creates them with a real file in each (no empty dirs, since git doesn't track empty directories).
- **No backend logic yet.** `src-tauri` gets the default Tauri v2 scaffold only — no `#[tauri::command]`s, no Stockfish, no SQLite. That starts per README §11 step 5 onward, after the UI is pixel-verified against `reference/screens/*.png`.
- **Environment note:** this machine has Node v24.13.1 / npm 11.8.0 and Rust 1.97.0 (`cargo`/`rustc` both present) installed at `C:\Users\JW\.cargo\bin`. That directory is **not** on the PATH inside the Bash (Git Bash) tool's shell — `cargo`/`rustc`/`tauri` commands run there will fail with "command not found" even though the toolchain exists. When running any `cargo`- or `tauri`-CLI command, either use the PowerShell tool (which has the correct PATH) or prefix the Bash command with `export PATH="$PATH:/c/Users/JW/.cargo/bin"`. `npm`/`npx`/`vitest`/`eslint` commands work fine in either shell.
- **Commit after every task.** Conventional commit prefixes (`feat:`, `chore:`, `test:`).

---

## File Structure

```
SecondBoard/                        (repo root — SvelteKit project root)
  src/
    routes/
      +layout.svelte                 # app shell: fixed viewport, bg, flex column
      +layout.ts                     # export const ssr = false
      +page.svelte                   # placeholder root page (proves shell renders)
    lib/
      tokens.ts                      # typed design-token constants (source of truth)
      tokens.test.ts                 # vitest: exact token values
      components/.gitkeep-equivalent → components/README.md (placeholder, see Task 2)
      stores/app-state.ts            # placeholder Svelte 5 rune store (screen/tab/ply etc. stub)
      api/index.ts                   # placeholder Tauri invoke wrapper module
      board/index.ts                 # placeholder board module barrel
      charts/index.ts                # placeholder charts module barrel
      types/index.ts                 # shared TS types (Screen, Tab, ClassCode, etc.)
    app.css                          # CSS custom properties, reset, .sbmono, .sbscroll, keyframes
    app.html                         # SvelteKit HTML shell
  static/
    (fonts served via @fontsource, no manual static font files needed)
  svelte.config.js                   # adapter-static config
  vite.config.ts
  tsconfig.json                      # strict mode
  eslint.config.js
  .prettierrc
  package.json
  src-tauri/                          # created by `tauri init` in Task 7
    tauri.conf.json
    Cargo.toml
    src/main.rs
    src/lib.rs
```

---

### Task 1: Scaffold SvelteKit project with tooling

**Files:**
- Create: entire SvelteKit project at repo root (`package.json`, `svelte.config.js`, `vite.config.ts`, `tsconfig.json`, `src/routes/+page.svelte`, `src/app.html`, eslint/prettier/vitest config files — all generated by the CLI below)

**Interfaces:**
- Produces: a working `npm run dev`, `npm run build`, `npm run check`, `npm run lint`, `npm run test` script set that every later task/iteration relies on.

- [ ] **Step 1: Scaffold via the Svelte CLI**

Run from the repo root (`C:\Users\JW\Documents\Code\SecondBoard`):

```bash
npx sv create . --template minimal --types ts --add eslint prettier vitest --install npm
```

This scaffolds directly into the current directory (README.md/LICENSE/.gitignore already there are left untouched by `sv create`; it will not overwrite them). If the CLI refuses to run in a non-empty directory, pass `--no-dir-check`.

- [ ] **Step 2: Verify the dev server boots**

Run: `npm run dev -- --open=false &` then curl it, or simply:

```bash
npm run build
```

Expected: build completes with exit code 0 and prints a `build/` (or `.svelte-kit/output`) summary. No adapter is configured yet, so this uses the default adapter — that's fine for this step, it only proves the scaffold itself is sound.

- [ ] **Step 3: Verify lint/test scripts exist and run clean**

Run:
```bash
npm run lint
npm run test -- --run
```

Expected: both exit 0 (Vitest reports "no test files found" is acceptable at this point — no tests exist yet).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: scaffold SvelteKit project with eslint, prettier, vitest"
```

---

### Task 2: Create the fixed `src/lib` module layout

**Files:**
- Create: `src/lib/types/index.ts`
- Create: `src/lib/stores/app-state.ts`
- Create: `src/lib/api/index.ts`
- Create: `src/lib/board/index.ts`
- Create: `src/lib/charts/index.ts`
- Create: `src/lib/components/README.md`
- Test: `src/lib/stores/app-state.test.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: `Screen`, `Tab` types (from `src/lib/types/index.ts`) and an `AppState` rune store (`src/lib/stores/app-state.ts`, exporting `appState` — a `$state` object) that iteration 2 (chrome/nav) will extend with real transition logic. This task only establishes the exact shape from `LOGIC.md` §1, defaulted per spec.

This task exists to lock in the module boundaries from `SecondBoard_PROJECT_OVERVIEW.md` §8.2 now, so every later iteration has an obvious, consistent place to add code instead of improvising a structure mid-project.

- [ ] **Step 1: Write the types module**

`src/lib/types/index.ts`:

```typescript
export type Screen =
	| 'home'
	| 'review'
	| 'openings'
	| 'insights'
	| 'training'
	| 'games'
	| 'sessions'
	| 'stats'
	| 'settings';

export type Tab = 'analysis' | 'review' | 'details' | 'explore';

export type ClassCode =
	| 'brilliant'
	| 'great'
	| 'best'
	| 'excellent'
	| 'good'
	| 'book'
	| 'inaccuracy'
	| 'mistake'
	| 'miss'
	| 'blunder';
```

- [ ] **Step 2: Write the failing test for the app-state store**

`src/lib/stores/app-state.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { createAppState } from './app-state';

describe('createAppState', () => {
	it('returns the exact default state from LOGIC.md §1', () => {
		const state = createAppState();
		expect(state.screen).toBe('review');
		expect(state.ply).toBe(31);
		expect(state.tab).toBe('analysis');
		expect(state.flipped).toBe(false);
		expect(state.sidebarCollapsed).toBe(false);
		expect(state.gameLoaded).toBe(false);
		expect(state.pgnText).toBe('');
		expect(state.showLines).toBe(true);
		expect(state.selfAnalysis).toBe(false);
	});
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- --run app-state`
Expected: FAIL — `Cannot find module './app-state'` or `createAppState is not exported`.

- [ ] **Step 4: Implement the store**

`src/lib/stores/app-state.ts`:

```typescript
import type { Screen, Tab } from '$lib/types';

export interface AppState {
	screen: Screen;
	ply: number;
	tab: Tab;
	flipped: boolean;
	sidebarCollapsed: boolean;
	gameLoaded: boolean;
	pgnText: string;
	showLines: boolean;
	selfAnalysis: boolean;
}

export function createAppState(): AppState {
	return $state({
		screen: 'review',
		ply: 31,
		tab: 'analysis',
		flipped: false,
		sidebarCollapsed: false,
		gameLoaded: false,
		pgnText: '',
		showLines: true,
		selfAnalysis: false
	});
}

export const appState = createAppState();
```

Note: `$state` in a plain `.ts` file requires the file to be treated as a Svelte rune module — SvelteKit/Vite handles `.svelte.ts` files for this, not plain `.ts`. Rename the file to `src/lib/stores/app-state.svelte.ts` (and the test import path accordingly) before running the test. This is a required correction to the scaffold above — do it now: create `app-state.svelte.ts` with the content shown, delete the plain `.ts` stub, and update the test file's import to `'./app-state.svelte'`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- --run app-state`
Expected: PASS (1 test).

- [ ] **Step 6: Create the remaining placeholder module barrels**

`src/lib/api/index.ts`:
```typescript
// Tauri invoke wrappers land here starting the iteration that wires the Rust backend
// (design_handoff_secondboard/README.md §11, step 5+). Empty on purpose for now.
export {};
```

`src/lib/board/index.ts`:
```typescript
// <Board> component, piece sprites, arrow/slide-animation logic land here in Iteration 3
// (design_handoff_secondboard/README.md §6.3, LOGIC.md §2). Empty on purpose for now.
export {};
```

`src/lib/charts/index.ts`:
```typescript
// EvalGraph, RatingTrend, SkillRadar components land here (design_handoff_secondboard/LOGIC.md §3).
// The pure geometry math they'll call already exists as reference in
// design_handoff_secondboard/reference/logic/view-math.js — port it when this module is built.
export {};
```

`src/lib/components/README.md`:
```markdown
# components

Shared UI components (Sidebar, TitleBar, StatCard, CoachCard, MoveList, Toggle, ...) land here
starting Iteration 2. See `design_handoff_secondboard/README.md` §6 for the full component
inventory per screen.
```

- [ ] **Step 7: Commit**

```bash
git add src/lib
git commit -m "feat: establish src/lib module layout (types, app-state store, module barrels)"
```

---

### Task 3: Typed design tokens (`src/lib/tokens.ts`)

**Files:**
- Create: `src/lib/tokens.ts`
- Test: `src/lib/tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `TOKENS` — a single frozen, typed object that Task 5 (`app.css`) mirrors into CSS custom properties, and that any TS/Svelte code needing a raw value (e.g. computing a gradient string dynamically) imports directly. This is the single source of truth — CSS variables and this object must never drift; if a value changes, it changes here first.

- [ ] **Step 1: Write the failing test**

`src/lib/tokens.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { TOKENS } from './tokens';

describe('TOKENS', () => {
	it('matches the exact color spec from README §4.2', () => {
		expect(TOKENS.color.appBg).toBe('#07080C');
		expect(TOKENS.color.cardBg).toBe('#14161F');
		expect(TOKENS.color.panelBg).toBe('#101219');
		expect(TOKENS.color.insetBg).toBe('#0F1119');
		expect(TOKENS.color.deepInsetBg).toBe('#0B0C12');
		expect(TOKENS.color.bottomBarBg).toBe('#0C0E15');
		expect(TOKENS.color.textPrimary).toBe('#F3F4F8');
		expect(TOKENS.color.textPrimaryAlt).toBe('#E3E6EE');
		expect(TOKENS.color.textTertiary).toBe('#8A90A0');
		expect(TOKENS.color.textMuted).toBe('#6B7180');
		expect(TOKENS.color.textMutedDark).toBe('#565C6B');
	});

	it('matches the exact accent spec from README §4.3', () => {
		expect(TOKENS.color.accentGreen).toBe('#4ADEA0');
		expect(TOKENS.color.accentTeal).toBe('#2DE0CE');
		expect(TOKENS.color.accentBlue).toBe('#60A5FA');
		expect(TOKENS.color.accentPurple).toBe('#A78BFA');
		expect(TOKENS.color.accentAmber).toBe('#F5B14C');
		expect(TOKENS.color.accentOrange).toBe('#F97A45');
		expect(TOKENS.color.accentRed).toBe('#F26B6B');
	});

	it('matches the exact board color spec from README §4.4', () => {
		expect(TOKENS.board.lightSquare).toBe('#5B5473');
		expect(TOKENS.board.darkSquare).toBe('#37344A');
		expect(TOKENS.board.evalBarTrack).toBe('#26232E');
	});

	it('matches the exact classification color spec from README §5', () => {
		expect(TOKENS.classification.brilliant.color).toBe('#2DE0CE');
		expect(TOKENS.classification.brilliant.glyph).toBe('!!');
		expect(TOKENS.classification.best.color).toBe('#4ADEA0');
		expect(TOKENS.classification.best.glyph).toBe('★');
		expect(TOKENS.classification.blunder.color).toBe('#F26B6B');
		expect(TOKENS.classification.blunder.glyph).toBe('??');
		expect(Object.keys(TOKENS.classification)).toHaveLength(10);
	});

	it('matches the exact spacing/radius spec from README §4.5', () => {
		expect(TOKENS.layout.sidebarWidthExpanded).toBe('236px');
		expect(TOKENS.layout.sidebarWidthCollapsed).toBe('70px');
		expect(TOKENS.layout.reviewPanelWidth).toBe('404px');
		expect(TOKENS.layout.titleBarHeight).toBe('38px');
		expect(TOKENS.radius.card).toBe('16px');
		expect(TOKENS.radius.board).toBe('12px');
		expect(TOKENS.radius.pill).toBe('20px');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run tokens`
Expected: FAIL — `Cannot find module './tokens'`.

- [ ] **Step 3: Implement `src/lib/tokens.ts`**

```typescript
import type { ClassCode } from './types';

/**
 * Single source of truth for the SecondBoard design system.
 * Every value here is copied verbatim from design_handoff_secondboard/README.md §4-5.
 * Do NOT approximate — if a value looks wrong, re-check the README/reference before changing it.
 * app.css mirrors this object into CSS custom properties; keep them in sync.
 */
export const TOKENS = {
	color: {
		appBg: '#07080C',
		sidebarGradient: 'linear-gradient(180deg,#0D0F17,#0A0B12)',
		titleBarGradient: 'linear-gradient(180deg,#111420,#0C0E16)',
		cardBg: '#14161F',
		panelBg: '#101219',
		insetBg: '#0F1119',
		deepInsetBg: '#0B0C12',
		bottomBarBg: '#0C0E15',
		textPrimary: '#F3F4F8',
		textPrimaryAlt: '#E3E6EE',
		textSecondary: '#C7CCDA',
		textSecondaryAlt: '#B8BDCC',
		textSecondaryAlt2: '#9298A8',
		textSecondaryAlt3: '#9AA0B0',
		textTertiary: '#8A90A0',
		textMuted: '#6B7180',
		textMutedDark: '#565C6B',
		hairlineLow: 'rgba(255,255,255,.05)',
		hairlineHigh: 'rgba(255,255,255,.08)',
		accentGreen: '#4ADEA0',
		accentTeal: '#2DE0CE',
		lightGreen1: '#8FE9C2',
		lightGreen2: '#86E5A8',
		lightGreen3: '#5EF0DE',
		linkHoverGreen: '#74ECBC',
		accentBlue: '#60A5FA',
		accentBlueAlt: '#3B82F6',
		accentIndigo: '#6366F1',
		accentPurple: '#A78BFA',
		accentPurpleAlt: '#8B5CF6',
		missPurple: '#C77DFF',
		accentAmber: '#F5B14C',
		accentOrange: '#F97A45',
		accentRed: '#F26B6B',
		ctaPrimaryGradient: 'linear-gradient(135deg,#4ADEA0,#2DE0CE)',
		ctaPrimaryText: '#062018',
		ctaBlueGradient: 'linear-gradient(135deg,#3B82F6,#6366F1)',
		ctaPurpleGradient: 'linear-gradient(135deg,#A78BFA,#8B5CF6)',
		logoGradient: 'linear-gradient(140deg,#2DE0CE,#3B82F6 55%,#A78BFA)'
	},
	board: {
		lightSquare: '#5B5473',
		darkSquare: '#37344A',
		lastMoveAlphaHex: '52',
		evalBarTrack: '#26232E',
		evalWhiteFillFrom: '#F4F5FA',
		evalWhiteFillTo: '#DDE1EC',
		evalMidline: 'rgba(45,224,206,.5)',
		coordOnDark: 'rgba(255,255,255,.30)',
		coordOnLight: 'rgba(20,20,30,.34)'
	},
	radius: {
		card: '16px',
		inset: '12px',
		control: '10px',
		pill: '20px',
		chip: '9px',
		board: '12px'
	},
	shadow: {
		board: '0 20px 60px rgba(0,0,0,.5)',
		ctaGlow: '0 8px 22px rgba(74,222,160,.3)'
	},
	layout: {
		sidebarWidthExpanded: '236px',
		sidebarWidthCollapsed: '70px',
		reviewPanelWidth: '404px',
		titleBarHeight: '38px',
		navRowPadding: '9px 11px',
		navRowGap: '11px'
	},
	scrollbar: {
		size: '9px',
		thumb: '#262A38',
		thumbHover: '#363B4E',
		radius: '20px'
	},
	font: {
		sans: "'Geist', -apple-system, system-ui, sans-serif",
		mono: "'Geist Mono', ui-monospace, monospace"
	},
	classification: {
		brilliant: { name: 'Brilliant', word: 'brilliant', color: '#2DE0CE', glyph: '!!' },
		great: { name: 'Great', word: 'a great move', color: '#60A5FA', glyph: '!' },
		best: { name: 'Best', word: 'the best move', color: '#4ADEA0', glyph: '★' },
		excellent: { name: 'Excellent', word: 'excellent', color: '#86E5A8', glyph: '✦' },
		good: { name: 'Good', word: 'a good move', color: '#8FB39B', glyph: '✓' },
		book: { name: 'Book', word: 'a book move', color: '#C99B6E', glyph: '◈' },
		inaccuracy: { name: 'Inaccuracy', word: 'an inaccuracy', color: '#F5B14C', glyph: '?!' },
		mistake: { name: 'Mistake', word: 'a mistake', color: '#F97A45', glyph: '?' },
		miss: { name: 'Miss', word: 'a miss', color: '#C77DFF', glyph: '✕' },
		blunder: { name: 'Blunder', word: 'a blunder', color: '#F26B6B', glyph: '??' }
	} satisfies Record<ClassCode, { name: string; word: string; color: string; glyph: string }>
} as const;

export const DARK_FG_CODES: ClassCode[] = [
	'brilliant',
	'best',
	'excellent',
	'good',
	'book',
	'inaccuracy'
];

export const NOT_BEST_CODES: ClassCode[] = ['inaccuracy', 'mistake', 'miss', 'blunder'];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run tokens`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/tokens.ts src/lib/tokens.test.ts
git commit -m "feat: add typed design tokens matching README §4-5 exactly"
```

---

### Task 4: Self-hosted fonts

**Files:**
- Modify: `package.json` (new dependencies)
- Modify: `src/app.css` (created fully in Task 5 — this task only adds the `@fontsource` imports at the top)

**Interfaces:**
- Consumes: nothing.
- Produces: `Geist` and `Geist Mono` available as CSS `font-family` names at every weight the spec requires, with zero runtime network requests.

- [ ] **Step 1: Install the self-hosted font packages**

```bash
npm install @fontsource/geist-sans @fontsource/geist-mono
```

- [ ] **Step 2: Verify the packages ship the required weights**

Run:
```bash
npm ls @fontsource/geist-sans @fontsource/geist-mono
node -e "const fs=require('fs'); ['300','400','500','600','700','800'].forEach(w => console.log(w, fs.existsSync('node_modules/@fontsource/geist-sans/'+w+'.css')))"
node -e "const fs=require('fs'); ['400','500','600'].forEach(w => console.log(w, fs.existsSync('node_modules/@fontsource/geist-mono/'+w+'.css')))"
```

Expected: both `npm ls` calls resolve without `UNMET DEPENDENCY`, and every weight check above prints `true`. If any Geist Sans weight is missing (Fontsource sometimes ships a reduced default weight set), install the specific per-weight import — Fontsource packages export one CSS file per weight (e.g. `@fontsource/geist-sans/300.css`) so importing exactly the weights we need is already the correct pattern; if `false` appears for a weight, check `node_modules/@fontsource/geist-sans/` directory listing for the actual available weight filenames and use those instead — Geist's variable range is 100–900, so all of 300/400/500/600/700/800 are expected to exist.

- [ ] **Step 3: Note the import statements needed (consumed by Task 5)**

Task 5's `app.css` must start with these imports (one line per weight, per Fontsource's per-weight CSS split):

```css
@import '@fontsource/geist-sans/300.css';
@import '@fontsource/geist-sans/400.css';
@import '@fontsource/geist-sans/500.css';
@import '@fontsource/geist-sans/600.css';
@import '@fontsource/geist-sans/700.css';
@import '@fontsource/geist-sans/800.css';
@import '@fontsource/geist-mono/400.css';
@import '@fontsource/geist-mono/500.css';
@import '@fontsource/geist-mono/600.css';
```

Do not write these into a file yet — Task 5 owns `app.css` in full so the file is created once, coherently.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add self-hosted Geist and Geist Mono fonts via @fontsource"
```

---

### Task 5: Global CSS — tokens as custom properties, reset, utility classes, keyframes

**Files:**
- Create: `src/app.css`
- Test: `src/app.css.test.ts` (a Node-side string-content test — no browser needed)

**Interfaces:**
- Consumes: `TOKENS` from Task 3 (values must match 1:1 — this file is the CSS mirror of that object).
- Produces: `:root` CSS custom properties every later component/iteration uses (e.g. `var(--color-app-bg)`), plus the `.sbmono` and `.sbscroll` utility classes and the `bpulse`/`softfloat` keyframes referenced throughout `README.md` §4 and §5.

- [ ] **Step 1: Write the failing test**

`src/app.css.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = () => readFileSync(new URL('./app.css', import.meta.url), 'utf-8');

describe('app.css', () => {
	it('imports every required font weight', () => {
		const content = css();
		expect(content).toContain("@import '@fontsource/geist-sans/300.css'");
		expect(content).toContain("@import '@fontsource/geist-sans/800.css'");
		expect(content).toContain("@import '@fontsource/geist-mono/400.css'");
		expect(content).toContain("@import '@fontsource/geist-mono/600.css'");
	});

	it('defines the exact color custom properties from TOKENS', () => {
		const content = css();
		expect(content).toContain('--color-app-bg: #07080C');
		expect(content).toContain('--color-accent-green: #4ADEA0');
		expect(content).toContain('--color-accent-teal: #2DE0CE');
		expect(content).toContain('--board-light-square: #5B5473');
		expect(content).toContain('--board-dark-square: #37344A');
	});

	it('defines the .sbmono and .sbscroll utility classes', () => {
		const content = css();
		expect(content).toContain('.sbmono');
		expect(content).toContain("font-feature-settings: 'tnum' 1");
		expect(content).toContain('.sbscroll');
	});

	it('defines the bpulse and softfloat keyframes', () => {
		const content = css();
		expect(content).toContain('@keyframes bpulse');
		expect(content).toContain('@keyframes softfloat');
	});

	it('applies box-sizing: border-box globally and antialiased body text', () => {
		const content = css();
		expect(content).toContain('box-sizing: border-box');
		expect(content).toContain('-webkit-font-smoothing: antialiased');
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- --run app.css`
Expected: FAIL — `ENOENT: no such file or directory, open '.../src/app.css'`.

- [ ] **Step 3: Implement `src/app.css`**

```css
@import '@fontsource/geist-sans/300.css';
@import '@fontsource/geist-sans/400.css';
@import '@fontsource/geist-sans/500.css';
@import '@fontsource/geist-sans/600.css';
@import '@fontsource/geist-sans/700.css';
@import '@fontsource/geist-sans/800.css';
@import '@fontsource/geist-mono/400.css';
@import '@fontsource/geist-mono/500.css';
@import '@fontsource/geist-mono/600.css';

/*
 * Design tokens mirrored from src/lib/tokens.ts (TOKENS object).
 * These MUST stay in sync — if you change a value here, change it there too, and vice versa.
 * Source: design_handoff_secondboard/README.md §4-5.
 */
:root {
	/* Surfaces */
	--color-app-bg: #07080C;
	--color-sidebar-gradient: linear-gradient(180deg, #0D0F17, #0A0B12);
	--color-titlebar-gradient: linear-gradient(180deg, #111420, #0C0E16);
	--color-card-bg: #14161F;
	--color-panel-bg: #101219;
	--color-inset-bg: #0F1119;
	--color-deep-inset-bg: #0B0C12;
	--color-bottom-bar-bg: #0C0E15;

	/* Text */
	--color-text-primary: #F3F4F8;
	--color-text-primary-alt: #E3E6EE;
	--color-text-secondary: #C7CCDA;
	--color-text-secondary-alt: #B8BDCC;
	--color-text-secondary-alt2: #9298A8;
	--color-text-secondary-alt3: #9AA0B0;
	--color-text-tertiary: #8A90A0;
	--color-text-muted: #6B7180;
	--color-text-muted-dark: #565C6B;

	/* Hairlines */
	--color-hairline-low: rgba(255, 255, 255, .05);
	--color-hairline-high: rgba(255, 255, 255, .08);

	/* Accents */
	--color-accent-green: #4ADEA0;
	--color-accent-teal: #2DE0CE;
	--color-light-green-1: #8FE9C2;
	--color-light-green-2: #86E5A8;
	--color-light-green-3: #5EF0DE;
	--color-link-hover-green: #74ECBC;
	--color-accent-blue: #60A5FA;
	--color-accent-blue-alt: #3B82F6;
	--color-accent-indigo: #6366F1;
	--color-accent-purple: #A78BFA;
	--color-accent-purple-alt: #8B5CF6;
	--color-miss-purple: #C77DFF;
	--color-accent-amber: #F5B14C;
	--color-accent-orange: #F97A45;
	--color-accent-red: #F26B6B;

	/* Gradients */
	--gradient-cta-primary: linear-gradient(135deg, #4ADEA0, #2DE0CE);
	--color-cta-primary-text: #062018;
	--gradient-cta-blue: linear-gradient(135deg, #3B82F6, #6366F1);
	--gradient-cta-purple: linear-gradient(135deg, #A78BFA, #8B5CF6);
	--gradient-logo: linear-gradient(140deg, #2DE0CE, #3B82F6 55%, #A78BFA);

	/* Board */
	--board-light-square: #5B5473;
	--board-dark-square: #37344A;
	--board-last-move-alpha-hex: 52;
	--board-eval-bar-track: #26232E;
	--board-eval-white-fill-from: #F4F5FA;
	--board-eval-white-fill-to: #DDE1EC;
	--board-eval-midline: rgba(45, 224, 206, .5);
	--board-coord-on-dark: rgba(255, 255, 255, .30);
	--board-coord-on-light: rgba(20, 20, 30, .34);

	/* Radii */
	--radius-card: 16px;
	--radius-inset: 12px;
	--radius-control: 10px;
	--radius-pill: 20px;
	--radius-chip: 9px;
	--radius-board: 12px;

	/* Shadows */
	--shadow-board: 0 20px 60px rgba(0, 0, 0, .5);
	--shadow-cta-glow: 0 8px 22px rgba(74, 222, 160, .3);

	/* Layout */
	--layout-sidebar-width-expanded: 236px;
	--layout-sidebar-width-collapsed: 70px;
	--layout-review-panel-width: 404px;
	--layout-titlebar-height: 38px;

	/* Scrollbar */
	--scrollbar-size: 9px;
	--scrollbar-thumb: #262A38;
	--scrollbar-thumb-hover: #363B4E;
	--scrollbar-radius: 20px;

	/* Fonts */
	--font-sans: 'Geist', -apple-system, system-ui, sans-serif;
	--font-mono: 'Geist Mono', ui-monospace, monospace;
}

* {
	box-sizing: border-box;
}

html,
body {
	height: 100%;
	margin: 0;
}

body {
	font-family: var(--font-sans);
	background: var(--color-app-bg);
	color: var(--color-text-primary);
	-webkit-font-smoothing: antialiased;
}

.sbmono {
	font-family: var(--font-mono);
	font-feature-settings: 'tnum' 1;
}

/* Scrollbar utility — apply to any scrollable container per README §4.5 */
.sbscroll {
	scrollbar-width: thin;
	scrollbar-color: var(--scrollbar-thumb) transparent;
}

.sbscroll::-webkit-scrollbar {
	width: var(--scrollbar-size);
	height: var(--scrollbar-size);
}

.sbscroll::-webkit-scrollbar-thumb {
	background: var(--scrollbar-thumb);
	border-radius: var(--scrollbar-radius);
	border: 2px solid transparent;
	background-clip: padding-box;
}

.sbscroll::-webkit-scrollbar-thumb:hover {
	background: var(--scrollbar-thumb-hover);
	background-clip: padding-box;
}

/* Brilliant-move square ring pulse — README §4.6 */
@keyframes bpulse {
	0%,
	100% {
		box-shadow: 0 0 0 0 rgba(45, 224, 206, 0.55);
	}
	50% {
		box-shadow: 0 0 0 6px rgba(45, 224, 206, 0);
	}
}

/* Gentle floating emphasis — README §4.6 */
@keyframes softfloat {
	0% {
		transform: translateY(0);
	}
	50% {
		transform: translateY(-3px);
	}
	100% {
		transform: translateY(0);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- --run app.css`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/app.css src/app.css.test.ts
git commit -m "feat: add global CSS custom properties, reset, and utility classes"
```

---

### Task 6: Root layout — the app shell

**Files:**
- Create: `src/routes/+layout.ts`
- Modify: `src/routes/+layout.svelte`
- Modify: `src/routes/+page.svelte`
- Test: `src/routes/layout.test.ts` (component test via `@testing-library/svelte`)

**Interfaces:**
- Consumes: `src/app.css` (Task 5), `TOKENS` (Task 3, indirectly via CSS vars).
- Produces: the root shell markup/class every screen (built in iterations 2+) mounts inside — a `<div class="app-shell">` covering `100vw × 100vh`, `display:flex; flex-direction:column; overflow:hidden`, background `var(--color-app-bg)`, per README §6 intro. This iteration renders only a placeholder inside it.

- [ ] **Step 1: Install the Svelte component-testing dependency**

```bash
npm install --save-dev @testing-library/svelte jsdom
```

- [ ] **Step 2: Configure Vitest for jsdom + Svelte component tests**

Check `vite.config.ts` (created by `sv create` with an `--add vitest` test block already). Ensure it includes a browser-like environment for `*.svelte` component tests. If `sv create --add vitest` scaffolded a single `test` config, extend it with a `workspace`/`environmentMatchGlobs` entry, or — simplest and sufficient for this project size — set the whole suite to `environment: 'jsdom'` since we have no server-only tests yet:

```typescript
// vite.config.ts — inside defineConfig({ test: { ... } })
test: {
	environment: 'jsdom',
	include: ['src/**/*.{test,spec}.{js,ts}']
}
```

- [ ] **Step 3: Write the failing test**

`src/routes/layout.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import Layout from './+layout.svelte';

describe('root layout', () => {
	it('renders an app-shell element covering the full viewport', () => {
		const { container } = render(Layout);
		const shell = container.querySelector('.app-shell');
		expect(shell).not.toBeNull();
	});
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npm run test -- --run layout`
Expected: FAIL (no `.app-shell` element yet — the scaffolded default `+layout.svelte` just renders `<slot />`/`{@render children()}`).

- [ ] **Step 5: Implement `src/routes/+layout.ts`**

```typescript
export const ssr = false;
```

- [ ] **Step 6: Implement `src/routes/+layout.svelte`**

Svelte 5 syntax (runes, `{@render children()}` instead of `<slot />`):

```svelte
<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<div class="app-shell">
	{@render children()}
</div>

<style>
	.app-shell {
		width: 100vw;
		height: 100vh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--color-app-bg);
	}
</style>
```

- [ ] **Step 7: Replace the placeholder root page**

`src/routes/+page.svelte`:

```svelte
<main style="flex:1; display:flex; align-items:center; justify-content:center; color:var(--color-text-muted); font-family:var(--font-mono);">
	SecondBoard — scaffold OK
</main>
```

This is intentionally a bare placeholder — Iteration 2 replaces it with the TitleBar/Sidebar chrome and real screen switching.

- [ ] **Step 8: Run test to verify it passes**

Run: `npm run test -- --run layout`
Expected: PASS (1 test).

- [ ] **Step 9: Manual visual check**

Run: `npm run dev`, open the printed local URL in a browser. Expected: a full-viewport `#07080C` background with the centered mono-font placeholder text, no scrollbars, no default browser margin.

- [ ] **Step 10: Commit**

```bash
git add src/routes package.json package-lock.json vite.config.ts
git commit -m "feat: add root app-shell layout with full-viewport dark background"
```

---

### Task 7: Tauri v2 scaffold

**Files:**
- Create: `src-tauri/` (generated by `tauri init`)
- Modify: `src-tauri/tauri.conf.json`
- Modify: `.gitignore` (add `src-tauri/target`)

**Interfaces:**
- Consumes: `npm run dev` (port 5173) and `npm run build` (outputs to `build/`) from Task 1/6.
- Produces: a `src-tauri/` Rust workspace ready for `#[tauri::command]`s in later iterations — but not implemented in this iteration.

- [ ] **Step 1: Check for the Rust toolchain**

Run (Bash tool — note the explicit PATH export, since Git Bash does not pick up `C:\Users\JW\.cargo\bin` by default):
```bash
export PATH="$PATH:/c/Users/JW/.cargo/bin" && cargo --version && rustc --version
```

Expected: `cargo 1.97.0 (...)` and `rustc 1.97.0 (...)` — the toolchain is installed on this machine. Every subsequent `cargo`/`tauri` command in this task needs that same PATH export prefix when run via the Bash tool (or run them via the PowerShell tool instead, where the PATH is already correct).

- [ ] **Step 2: Install the Tauri CLI**

```bash
npm install --save-dev @tauri-apps/cli @tauri-apps/api
```

- [ ] **Step 3: Scaffold `src-tauri`**

```bash
export PATH="$PATH:/c/Users/JW/.cargo/bin" && npx tauri init
```

When prompted, answer:
- App name: `SecondBoard`
- Window title: `SecondBoard — Local Chess Review Companion` (matches the title bar text in README §6.1)
- Web assets location: `../build`
- Dev server URL: `http://localhost:5173`
- Dev command: `npm run dev`
- Build command: `npm run build`

- [ ] **Step 4: Set `tauri.conf.json` build block explicitly**

`src-tauri/tauri.conf.json` — ensure the `build` key matches exactly:

```json
{
	"build": {
		"beforeDevCommand": "npm run dev",
		"beforeBuildCommand": "npm run build",
		"devUrl": "http://localhost:5173",
		"frontendDist": "../build"
	}
}
```

(Merge this into the generated file's existing `build` key — don't duplicate the whole file here; only this key needs to match.)

- [ ] **Step 5: Verify the native shell builds and launches**

Run (allow this several minutes for the first Rust compile):
```bash
export PATH="$PATH:/c/Users/JW/.cargo/bin" && npx tauri build --debug
```

Expected: exit 0, producing a debug binary under `src-tauri/target/debug/`. A full interactive `npx tauri dev` window-open check is a good manual sanity check too, but `tauri build --debug` alone is sufficient automated proof that the Rust side compiles and links against the SvelteKit static output.

- [ ] **Step 6: Add `src-tauri/target` to `.gitignore` and commit**

Append to `.gitignore` (only if not already present):
```
src-tauri/target
```

```bash
git add -A
git commit -m "chore: scaffold Tauri v2 shell (src-tauri config, no backend commands yet)"
```

---

### Task 8: Final verification sweep

**Files:** none created — this task only runs checks across everything built in Tasks 1-7.

**Interfaces:** none — terminal task.

- [ ] **Step 1: Full lint pass**

Run: `npm run lint`
Expected: exit 0, no errors.

- [ ] **Step 2: Full type-check pass**

Run: `npm run check`
Expected: exit 0, no TypeScript errors (strict mode).

- [ ] **Step 3: Full test suite**

Run: `npm run test -- --run`
Expected: all tests from Tasks 2, 3, 5, 6 pass — at least 12 tests total, 0 failures.

- [ ] **Step 4: Full production build**

Run: `npm run build`
Expected: exit 0, `build/` directory produced with `index.html` + `_app/` assets, no SSR-related warnings (SSR is disabled).

- [ ] **Step 5: Commit any residual formatting fixes**

```bash
npm run format
git add -A
git commit -m "chore: final formatting pass for iteration 1 scaffold" --allow-empty
```

(`--allow-empty` only matters if `npm run format` made no changes — remove that flag if there's an actual diff to commit.)

---

## Self-Review Notes

- **Spec coverage:** offline fonts (Task 4), exact tokens (Task 3/5), SPA/adapter-static (Task 1/6), fixed shell (Task 6), module layout (Task 2), Tauri v2 shell (Task 7) — all README §3/§4/§6-intro and OVERVIEW §6/§8 requirements for "scaffold" are covered. Custom title-bar decorations (`decorations:false`) and the real TitleBar/Sidebar are intentionally deferred to Iteration 2 (README §6.1) — not a gap, a scope boundary.
- **Maintainability/scalability, per explicit user request:** TypeScript strict mode, ESLint + Prettier wired in from Task 1 (not retrofitted), Vitest test coverage on every non-trivial file this iteration adds, a single-source-of-truth token object mirrored (not duplicated ad hoc) into CSS, and the exact `src/lib` module boundaries from OVERVIEW §8.2 created upfront so iterations 2-11 have an obvious, consistent home for every new component/store/chart instead of accreting structure ad hoc.
- **No placeholders left unresolved:** the Rust toolchain (cargo/rustc 1.97.0) is installed at `C:\Users\JW\.cargo\bin`, just not on the Bash tool's default PATH — every task involving `cargo`/`tauri` CLI commands is fully automatable via the PATH export shown in Task 7, no manual human step required.
