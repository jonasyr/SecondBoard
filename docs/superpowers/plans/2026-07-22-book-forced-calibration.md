# Book + Forced Move Detection, and a Chess.com Calibration Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Book and Forced move classification (closing the two remaining
gaps in `docs/references/calibration-log.md`), and build an automated
multi-game calibration harness that diffs SecondBoard's own classifications
against real chess.com Game Review data, replacing the current
screenshot-driven manual comparison.

**Architecture:** Book is a trie lookup over a frozen lichess `chess-openings`
dataset, checked in `classifySpecial` ahead of every eval-based special class.
Forced is a `shakmaty`-computed legal-move count, checked even earlier.
Calibration is a set of pure, unit-tested TS modules under
`src/lib/calibration/` (HAR extraction, label mapping, diff engine) driven by
thin Node CLI scripts under `scripts/calibration/` that do the I/O (reading a
HAR, spawning Stockfish, parsing PGNs with `chess.js`) the pure modules can't
do inside a browser/Vitest environment.

**Tech Stack:** SvelteKit 5 + TypeScript + Vitest (frontend), Rust +
`shakmaty` 0.28 (backend PGN parsing), Node + `vite-node` + `chess.js` (new
calibration-only devDependencies) for the offline calibration scripts.

## Global Constraints

- No chess.com-internal data is guessed. Book uses a real, public, actively
  maintained opening database (`lichess-org/chess-openings`); Forced uses
  chess.com's own published definition ("only one legal move"). Phase 3's
  fixture schema uses only field names verified directly from a real
  captured HAR (`docs/calibration/chess-review.har`) — see
  `docs/superpowers/specs/2026-07-21-book-forced-calibration-design.md`.
- Every existing golden fixture (`classify.reference-game.test.ts`,
  `classify.kasparov-topalov.test.ts`) must continue to pass. Where a task
  changes their expected values (Book detection changes what
  `classify.reference-game.test.ts` asserts), that change must be driven by
  real chess.com ground truth already on file in `calibration-log.md`, not
  invented.
- No new runtime network dependency in the shipped app: the opening database
  is fetched once and checked into the repo as a frozen asset
  (`src/lib/data/openings.json`). `chess.js` and the Stockfish-spawning
  calibration client are calibration-tooling-only — never imported by any
  file under `src/lib/components/`, `src/lib/stores/`, or any file reachable
  from the shipped Svelte app.
- `ClassCode`, `SpecialClassInputs`, and the `classifySpecial` override order
  are extended, never replaced — omitting every new optional field
  (`bookPlyDepth`, `legalMoveCounts`) must reproduce today's behavior
  byte-for-byte.
- Override order, once this plan is complete: **Forced > Book > Brilliant >
  Great > Miss > EP-cutoff table.**
- chess.com's raw per-move label for Great is `"greatFind"`, not `"great"` —
  every place that consumes a raw chess.com label (the diff engine) must map
  it; every place that produces our own `ClassCode` keeps using `'great'`.

---

## Phase 1: Book move detection

### Task 1: Fetch and freeze the lichess opening-book dataset

**Files:**
- Create: `scripts/calibration/fetch-openings.mjs`
- Create (generated, committed): `src/lib/data/openings.json`

**Interfaces:**
- Produces: `src/lib/data/openings.json` — a JSON array of `{ eco: string,
  name: string, sanMoves: string[] }`, consumed by Task 2's `book.ts`.

- [ ] **Step 1: Write the fetch/build script**

```js
// scripts/calibration/fetch-openings.mjs
// One-time build step: downloads the lichess-org/chess-openings TSV files
// (MIT-licensed, the same dataset lichess's own site uses) and writes a
// single frozen JSON asset. SecondBoard does not fetch this at runtime --
// re-run this script by hand only if the upstream dataset needs refreshing.
import { writeFileSync } from 'node:fs';

const FILES = ['a', 'b', 'c', 'd', 'e'];
const BASE_URL = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

function parseTsv(text) {
	const lines = text.trim().split('\n');
	const [header, ...rows] = lines;
	const columns = header.split('\t');
	return rows.map((line) => {
		const cells = line.split('\t');
		const row = Object.fromEntries(columns.map((col, i) => [col, cells[i]]));
		return {
			eco: row.eco,
			name: row.name,
			// The pgn column is numbered SAN, e.g. "1. e4 e5 2. Nf3" -- strip the
			// move-number tokens ("1.", "2.", ...), keep the SAN moves only.
			sanMoves: row.pgn.split(' ').filter((token) => !/^\d+\.+$/.test(token))
		};
	});
}

async function main() {
	const openings = [];
	for (const file of FILES) {
		const res = await fetch(`${BASE_URL}/${file}.tsv`);
		if (!res.ok) throw new Error(`failed to fetch ${file}.tsv: ${res.status}`);
		const text = await res.text();
		openings.push(...parseTsv(text));
	}
	writeFileSync(
		new URL('../../src/lib/data/openings.json', import.meta.url),
		JSON.stringify(openings)
	);
	console.log(`Wrote ${openings.length} openings to src/lib/data/openings.json`);
}

main();
```

- [ ] **Step 2: Run it**

Run: `mkdir -p src/lib/data && node scripts/calibration/fetch-openings.mjs`
Expected output: `Wrote <N> openings to src/lib/data/openings.json` where N is
in the low thousands (3627 at the time this plan was written — do not hardcode
this exact number anywhere else; the upstream dataset can grow).

- [ ] **Step 3: Sanity-check the generated file**

Run: `node -e "const d = require('./src/lib/data/openings.json'); console.log(d.length, JSON.stringify(d[0]))"`
Expected: prints a count in the thousands and a first entry with non-empty
`eco`, `name`, and a non-empty `sanMoves` array. If `sanMoves` for any sampled
entry contains a token still ending in `.` (an unstripped move number), fix
the regex in Step 1 and re-run.

- [ ] **Step 4: Commit**

```bash
git add scripts/calibration/fetch-openings.mjs src/lib/data/openings.json
git commit -m "feat(book): fetch and freeze the lichess chess-openings dataset"
```

### Task 2: Opening trie and `findBookDepth`

**Files:**
- Create: `src/lib/game/book.ts`
- Test: `src/lib/game/book.test.ts`

**Interfaces:**
- Consumes: `src/lib/data/openings.json` (Task 1).
- Produces: `export function findBookDepth(sanMoves: string[], trie?:
  TrieNode): number` and `export function buildOpeningTrie(openings:
  OpeningEntry[]): TrieNode` and `export interface OpeningEntry { eco:
  string; name: string; sanMoves: string[] }` — consumed by Task 4
  (`app-state.svelte.ts`) and Task 10 (`scripts/calibration/calibrate.ts`).

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/game/book.test.ts
import { describe, it, expect } from 'vitest';
import { buildOpeningTrie, findBookDepth } from './book';

const SYNTHETIC_OPENINGS = [
	{ eco: 'B00', name: 'Test Line A', sanMoves: ['e4', 'e5', 'Nf3', 'Nc6'] },
	{ eco: 'B01', name: 'Test Line B', sanMoves: ['e4', 'c5'] }
];

describe('findBookDepth', () => {
	it('matches a full known line exactly', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth(['e4', 'e5', 'Nf3', 'Nc6'], trie)).toBe(4);
	});

	it('matches only the shared prefix when the game diverges from every catalogued line', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth(['e4', 'e5', 'Nf3', 'Bc4'], trie)).toBe(3);
	});

	it('returns 0 when the very first move is not catalogued', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth(['d4', 'd5'], trie)).toBe(0);
	});

	it('returns 0 for an empty move list', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth([], trie)).toBe(0);
	});

	it('matches past a shorter catalogued line when a longer one shares the same prefix', () => {
		// Line B ends at "e4 c5", but a third, longer line shares that exact
		// prefix -- depth is measured by continuation existence in the whole
		// trie, not by whether the prefix is itself a full catalogued row.
		const trie = buildOpeningTrie([
			...SYNTHETIC_OPENINGS,
			{ eco: 'B02', name: 'Test Line C', sanMoves: ['e4', 'c5', 'Nf3'] }
		]);
		expect(findBookDepth(['e4', 'c5', 'Nf3'], trie)).toBe(3);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/lib/game/book.test.ts`
Expected: FAIL with "Cannot find module './book'" or similar.

- [ ] **Step 3: Implement `book.ts`**

```ts
// src/lib/game/book.ts
import openingsData from '$lib/data/openings.json';

export interface OpeningEntry {
	eco: string;
	name: string;
	sanMoves: string[];
}

interface TrieNode {
	children: Map<string, TrieNode>;
}

/**
 * Builds a trie over every opening's SAN move sequence. Depth is measured by
 * continuation existence in the WHOLE trie, not by whether a prefix is
 * itself a catalogued row's exact endpoint -- a game can be genuine book
 * theory past the point where any single named opening ends, as long as
 * some other row shares that continuation.
 */
export function buildOpeningTrie(openings: OpeningEntry[]): TrieNode {
	const root: TrieNode = { children: new Map() };
	for (const opening of openings) {
		let node = root;
		for (const san of opening.sanMoves) {
			let next = node.children.get(san);
			if (!next) {
				next = { children: new Map() };
				node.children.set(san, next);
			}
			node = next;
		}
	}
	return root;
}

let cachedTrie: TrieNode | null = null;
function defaultTrie(): TrieNode {
	if (!cachedTrie) cachedTrie = buildOpeningTrie(openingsData as OpeningEntry[]);
	return cachedTrie;
}

/**
 * Walks `sanMoves` through `trie` (the real lichess dataset by default) one
 * ply at a time, returning the count of plies matched before the first
 * mismatch or before the trie runs out of continuations.
 */
export function findBookDepth(sanMoves: string[], trie: TrieNode = defaultTrie()): number {
	let node = trie;
	let depth = 0;
	for (const san of sanMoves) {
		const next = node.children.get(san);
		if (!next) break;
		node = next;
		depth++;
	}
	return depth;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/book.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/book.ts src/lib/game/book.test.ts
git commit -m "feat(book): add opening trie and findBookDepth"
```

### Task 3: Give Book top override priority in `classifySpecial`

**Files:**
- Modify: `src/lib/game/classify.ts:65-77` (`SpecialClassInputs`), `:151-165`
  (`classifySpecial` header + entry)
- Test: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes: nothing new (this task only adds an optional field to an
  existing interface).
- Produces: `SpecialClassInputs.bookPlyDepth?: number` — consumed by Task 4
  (real call site) and Task 7 (Forced ordering).

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to `src/lib/game/classify.test.ts` (after the
existing `describe('classifyGame with special classes', ...)` block):

```ts
describe('classifySpecial book override', () => {
	it('classifies a move within book depth as book, ahead of a qualifying Brilliant', () => {
		// Same fixture as the "immediately-hanging near-best move" brilliant
		// test above -- without bookPlyDepth this would classify as brilliant.
		// bookPlyDepth=1 must win because Book is checked first.
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[600, 400, 0],
			[600, 400, 0]
		];
		const positions: Position[] = [
			{ e1: ['K', 'w'], d4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] },
			{ e1: ['K', 'w'], a4: ['N', 'w'], a8: ['Q', 'b'], e8: ['K', 'b'] }
		];
		const moveMeta: Move[] = [{ from: 'd4', to: 'a4' }];
		const bestMoves: Record<number, Move & { san: string }> = {
			1: { from: 'd4', to: 'a4', san: 'Na4' }
		};

		const codes = classifyGame(evalPerPly, wdlPerPly, {
			positions,
			moveMeta,
			bestMoves,
			bookPlyDepth: 1
		});

		expect(codes).toEqual(['book']);
	});

	it('does not classify a move past bookPlyDepth as book', () => {
		const codes = classifyGame([0, 0, 0], undefined, {
			positions: [{}, {}, {}],
			moveMeta: [
				{ from: 'a2', to: 'a3' },
				{ from: 'a7', to: 'a6' }
			],
			bestMoves: {},
			bookPlyDepth: 1
		});

		expect(codes[0]).toBe('book'); // ply 1: within depth
		expect(codes[1]).not.toBe('book'); // ply 2: past depth
	});

	it('omitting bookPlyDepth reproduces pre-Book behavior exactly', () => {
		const codes = classifyGame([0, 1, 0.5]);
		expect(codes).toEqual(['best', 'best']);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts -t "book override"`
Expected: FAIL — the first test returns `['brilliant']` instead of `['book']`
(TypeScript will also flag `bookPlyDepth` as an unknown property on
`SpecialClassInputs` until Step 3 lands).

- [ ] **Step 3: Implement the Book check**

In `src/lib/game/classify.ts`, add `bookPlyDepth?: number;` to
`SpecialClassInputs` (after the existing `secondWdlPerPly?: (Wdl | null)[];`
field, line 76):

```ts
	/** The engine's second-choice (MultiPV #2) win%-relevant data at the position
	 * BEFORE each ply, White-POV, same indexing as `evalPerPly`/`wdlPerPly`. */
	secondEvalPerPly?: (number | null)[];
	secondWdlPerPly?: (Wdl | null)[];
	/** Ply depth (1-indexed, same scale as `ply`) through which every move is
	 * still catalogued opening theory (`book.ts`'s `findBookDepth`). A ply
	 * `<= bookPlyDepth` is always Book, checked ahead of every other special
	 * class -- chess.com never marks a theory move Brilliant/Great/Miss even
	 * when it superficially resembles one. */
	bookPlyDepth?: number;
```

Change the `classifySpecial` function's leading comment (currently "Brilliant
> Great > Miss (blueprint §4 override order, Book/Forced out of scope this
iteration). Returns null...") to:

```ts
/** Book > Brilliant > Great > Miss (Forced is added ahead of Book in a later
 * task). Returns null when no special condition applies and no `special`
 * argument was supplied at all -- falls through to the deterministic
 * EP-cutoff table in either case. */
```

Add the Book check as the very first line of the function body, immediately
after `if (!special) return null;`:

```ts
	if (!special) return null;

	if (special.bookPlyDepth !== undefined && ply <= special.bookPlyDepth) return 'book';

	const playedMove = special.moveMeta[ply - 1];
```

Finally, update the module's header comment (lines 17-22), replacing:

```
 * Scope note: Brilliant/Great/Miss (this file's `classifySpecial`) run before
 * the deterministic cutoff table, per Chess.com's own override order
 * (Brilliant > Great > Miss > cutoffs). Book and Forced remain a later
 * iteration (opening-book/ECO lookup and a dedicated ClassCode are both out
 * of scope here) -- see docs/Reproducing_Chesscom_Game_Review_Locally_in_SecondBoard...
 * §4/§11 "Recommended next steps".
```

with:

```
 * Scope note: Book/Brilliant/Great/Miss (this file's `classifySpecial`) run
 * before the deterministic cutoff table, per Chess.com's own override order
 * (Forced > Book > Brilliant > Great > Miss > cutoffs; Forced is added in a
 * later task of the same iteration this comment describes). See
 * docs/superpowers/specs/2026-07-21-book-forced-calibration-design.md.
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts`
Expected: all tests pass (existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat(book): give Book top override priority in classifySpecial"
```

### Task 4: Wire real `bookPlyDepth` at the review call site + Byrne-Fischer regression

**Files:**
- Modify: `src/lib/stores/app-state.svelte.ts:119-140` (`refreshRealAnalysis`)
- Modify: `src/lib/game/classify.reference-game.test.ts`

**Interfaces:**
- Consumes: `findBookDepth` (Task 2), `SpecialClassInputs.bookPlyDepth`
  (Task 3).

- [ ] **Step 1: Write the failing regression test**

Add to `src/lib/game/classify.reference-game.test.ts` (after the existing
imports, add `import { findBookDepth } from './book';`; then append this new
`describe` block at the end of the file):

```ts
// The exact opening SAN played in Donald Byrne vs. Bobby Fischer, 1956
// ("The Game of the Century") -- public historical record, not derived from
// the fixture JSON above (which stores Move{from,to} pairs, not SAN).
// Chess.com's own Game Review marks this game's first 6 moves per side (12
// plies) as Book -- see docs/references/calibration-log.md, "Book 6 / 6".
const BYRNE_FISCHER_OPENING_SAN = [
	'Nf3',
	'Nf6',
	'c4',
	'g6',
	'Nc3',
	'Bg7',
	'd4',
	'O-O',
	'Bf4',
	'd5',
	'Qb3',
	'dxc4'
];

describe('Byrne vs. Fischer 1956 Book detection', () => {
	it("matches chess.com's real Book cutoff of at least 12 plies (6 moves per side)", () => {
		const depth = findBookDepth(BYRNE_FISCHER_OPENING_SAN);
		expect(depth).toBeGreaterThanOrEqual(12);
	});

	it('classifies plies 1-12 as book without disturbing the existing Brilliant/Great fixture', () => {
		const bookPlyDepth = findBookDepth(BYRNE_FISCHER_OPENING_SAN);
		const codes = classifyGame(fixture.evalPerPly, fixture.wdlPerPly, {
			positions: fixture.positions,
			moveMeta: fixture.moves,
			bestMoves: fixture.bestMoves,
			secondEvalPerPly: fixture.secondEvalPerPly,
			secondWdlPerPly: fixture.secondWdlPerPly,
			bookPlyDepth
		});

		for (let ply = 1; ply <= 12; ply++) {
			expect(codes[ply - 1]).toBe('book');
		}
		// The existing golden Brilliant/Great plies (indices 21, 29, 33, 37,
		// i.e. moves well past move 6) must survive Book's new top-priority check.
		expect(codes[21]).toBe('brilliant');
		expect(codes[37]).toBe('great');
	});
});
```

- [ ] **Step 2: Run tests to verify their current state**

Run: `pnpm exec vitest run src/lib/game/classify.reference-game.test.ts`
Expected: the first new test should already pass (it only calls
`findBookDepth` directly against the real dataset from Task 2). If it fails
(depth < 12), stop and investigate: print `findBookDepth` invoked one prefix
at a time (e.g. slice `BYRNE_FISCHER_OPENING_SAN` to length 1, 2, 3, ...) to
find exactly where the trie stops matching, and compare that SAN token
against `src/lib/data/openings.json` (e.g. `grep '"Nf3"' src/lib/data/openings.json`)
to see whether the dataset uses a different disambiguation/notation for that
exact move — fix the hardcoded SAN array above to match the dataset's real
notation rather than the assertion. The second test should currently fail
(nothing wires `bookPlyDepth` into the app yet, but this test calls
`classifyGame` directly with it, so it should already pass once Task 3
landed — if it doesn't, the codes list is not what's expected; investigate
before proceeding to Step 3, which only touches the app-state call site, not
this test's own direct `classifyGame` call).

- [ ] **Step 3: Wire `bookPlyDepth` into the real call site**

In `src/lib/stores/app-state.svelte.ts`, add the import:

```ts
import { findBookDepth } from '$lib/game/book';
```

In `refreshRealAnalysis()`, change:

```ts
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
			positions: appState.game!.positions,
			moveMeta: appState.game!.moveMeta,
			bestMoves,
			secondEvalPerPly,
			secondWdlPerPly
		});
```

to:

```ts
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
			positions: appState.game!.positions,
			moveMeta: appState.game!.moveMeta,
			bestMoves,
			secondEvalPerPly,
			secondWdlPerPly,
			bookPlyDepth: findBookDepth(appState.game!.sanList)
		});
```

- [ ] **Step 4: Run the full test suite and type check**

Run: `pnpm exec vitest run`
Expected: all tests pass.
Run: `pnpm check`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/app-state.svelte.ts src/lib/game/classify.reference-game.test.ts
git commit -m "feat(book): compute real bookPlyDepth at the review call site"
```

---

## Phase 2: Forced move detection

### Task 5: Rust `legal_move_counts`

**Files:**
- Modify: `src-tauri/src/pgn.rs:13-24` (`ParsedGame`), `:102-131`
  (`GameVisitor` + `new`), `:151-168` (`san`), `:170-184` (`end_game`)

**Interfaces:**
- Produces: `ParsedGame.legal_move_counts: Vec<u32>` (serializes as
  `legalMoveCounts` via the struct's existing `#[serde(rename_all =
  "camelCase")]`), same length/indexing as `moves`/`san_list` — consumed by
  Task 7 (`src/lib/api/pgn.ts`).

- [ ] **Step 1: Write the failing tests**

Add to the `#[cfg(test)] mod tests` block in `src-tauri/src/pgn.rs` (after the
existing `rejects_malformed_pgn_with_an_illegal_move` test):

```rust
    #[test]
    fn shakmaty_reports_exactly_one_legal_move_in_a_boxed_king_check() {
        // Black king on h8, boxed by its own intact g7/h7 pawns, in check
        // from a White knight on f7 (a knight check cannot be blocked, and no
        // black piece can capture the knight) -- exactly one legal reply
        // exists: Kg8. Hand-verified: knight-f7's attack set is
        // {d6,d8,e5,g5,h6,h8}, which does NOT include g8, so g8 is a safe,
        // empty flight square.
        let fen: shakmaty::fen::Fen = "7k/5Npp/8/8/8/8/8/K7 b - - 0 1".parse().unwrap();
        let pos: Chess = fen.into_position(shakmaty::CastlingMode::Standard).unwrap();
        assert_eq!(pos.legal_moves().len(), 1);
    }

    #[test]
    fn legal_move_counts_has_one_entry_per_move_and_never_reports_zero() {
        let game = parse_pgn(SAMPLE_PGN).expect("sample PGN should parse");
        assert_eq!(game.legal_move_counts.len(), game.moves.len());
        assert!(game.legal_move_counts.iter().all(|&count| count > 0));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test pgn::tests`
Expected: FAIL — `legal_move_counts` does not exist on `ParsedGame` (compile
error); the boxed-king test should compile and pass on its own (it only
exercises shakmaty's FEN parsing/legal-move counting directly, not
`ParsedGame`) — if it fails to compile because of the exact `Fen`/
`into_position` API shape, adjust the import path to match shakmaty 0.28's
actual API (verified against the installed crate: run `cargo doc --open -p
shakmaty` or check `~/.cargo/registry/src/*/shakmaty-0.28.0/src/fen.rs` if the
exact method name differs) — this is a mechanism-only test, so getting its
exact FEN-loading incantation right matters more than matching this plan's
guess verbatim.

- [ ] **Step 3: Implement `legal_move_counts`**

In `ParsedGame` (line 15-24), add the field after `pub moves: Vec<MoveDto>,`:

```rust
pub struct ParsedGame {
    pub san_list: Vec<String>,
    pub positions: Vec<HashMap<String, (String, String)>>,
    pub moves: Vec<MoveDto>,
    pub legal_move_counts: Vec<u32>,
    pub white_name: Option<String>,
    pub black_name: Option<String>,
    pub white_rating: Option<String>,
    pub black_rating: Option<String>,
    pub result: Option<String>,
}
```

In `GameVisitor` (line 102-113), add the field:

```rust
struct GameVisitor {
    pos: Chess,
    san_list: Vec<String>,
    positions: Vec<HashMap<String, (String, String)>>,
    moves: Vec<MoveDto>,
    legal_move_counts: Vec<u32>,
    error: Option<String>,
    white_name: Option<String>,
    black_name: Option<String>,
    white_rating: Option<String>,
    black_rating: Option<String>,
    result: Option<String>,
}
```

In `GameVisitor::new()` (line 115-131), initialize it:

```rust
    fn new() -> Self {
        let pos = Chess::default();
        GameVisitor {
            positions: vec![board_to_position(&pos)],
            pos,
            san_list: Vec::new(),
            moves: Vec::new(),
            legal_move_counts: Vec::new(),
            error: None,
            white_name: None,
            black_name: None,
            white_rating: None,
            black_rating: None,
            result: None,
        }
    }
```

In `Visitor::san()` (line 151-168), record the legal-move count of the
position BEFORE the move is applied — insert this line right before
`self.pos.play_unchecked(m);`:

```rust
        self.san_list.push(san_plus.to_string());
        self.moves.push(move_dto(&m));
        self.legal_move_counts.push(self.pos.legal_moves().len() as u32);
        // The installed shakmaty version (0.28.0) takes `play_unchecked` by
        // value, not by reference — verified against the compiler.
        self.pos.play_unchecked(m);
        self.positions.push(board_to_position(&self.pos));
```

In `end_game()` (line 170-184), include it in the returned struct:

```rust
        Ok(ParsedGame {
            san_list: std::mem::take(&mut self.san_list),
            positions: std::mem::take(&mut self.positions),
            moves: std::mem::take(&mut self.moves),
            legal_move_counts: std::mem::take(&mut self.legal_move_counts),
            white_name: self.white_name.take(),
            black_name: self.black_name.take(),
            white_rating: self.white_rating.take(),
            black_rating: self.black_rating.take(),
            result: self.result.take(),
        })
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test`
Expected: all tests pass, including the 2 new ones and every pre-existing one
in this file and `lib.rs`'s `parse_pgn_tests` module (which constructs
`ParsedGame` only through `parse_pgn`, so it does not need updating — it
never destructures `ParsedGame` by field list).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/pgn.rs
git commit -m "feat(forced): compute legal_move_counts per ply in the Rust pgn module"
```

### Task 6: Add the `forced` ClassCode and wire its visual representation

**Files:**
- Modify: `src/lib/types/index.ts:14-24`
- Modify: `src/lib/tokens.ts:96-107,145-152`
- Modify: `src/lib/assets/classification-icons.ts`
- Modify: `src/lib/game/mock-data.ts:41-53`
- Modify: `src/lib/game/breakdown.ts:5-16`
- Modify: `src/lib/game/breakdown.test.ts:8`

**Interfaces:**
- Produces: `ClassCode` includes `'forced'` — every `Record<ClassCode, ...>`
  site in the codebase must have a `forced` entry for `pnpm check` to pass.

- [ ] **Step 1: Add `'forced'` to the `ClassCode` union**

In `src/lib/types/index.ts`, change:

```ts
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

to:

```ts
export type ClassCode =
	| 'brilliant'
	| 'great'
	| 'best'
	| 'excellent'
	| 'good'
	| 'book'
	| 'forced'
	| 'inaccuracy'
	| 'mistake'
	| 'miss'
	| 'blunder';
```

- [ ] **Step 2: Run the type checker to see the resulting errors**

Run: `pnpm check`
Expected: FAIL with "Property 'forced' is missing in type" errors in
`src/lib/tokens.ts`, `src/lib/assets/classification-icons.ts`, and
`src/lib/game/mock-data.ts` (the three `satisfies Record<ClassCode, ...>`/
`: Record<ClassCode, ...>` sites).

- [ ] **Step 3: Fix `classification-icons.ts`**

`src/lib/assets/chesscom-analysis-icons/svg/forced.svg` already exists
(bundled, currently unused). Add the import and export entry:

```ts
import book from './chesscom-analysis-icons/svg/book.svg?url';
import forced from './chesscom-analysis-icons/svg/forced.svg?url';
```

```ts
export const CLASSIFICATION_ICONS = {
	brilliant,
	great: greatFind,
	best,
	excellent,
	good,
	book,
	forced,
	inaccuracy,
	mistake,
	miss: missedWin,
	blunder
} satisfies Record<ClassCode, string>;
```

- [ ] **Step 4: Fix `tokens.ts`**

In the `classification` map (line 96-107), add an entry after `book`:

```ts
		book: { name: 'Book', word: 'a book move', color: '#a88865', glyph: '◈', icon: CLASSIFICATION_ICONS.book },
		forced: { name: 'Forced', word: 'a forced move', color: '#7c94a8', glyph: '⇥', icon: CLASSIFICATION_ICONS.forced },
```

Note: unlike every other value in this file, `forced`'s color/glyph are NOT
copied from `design_handoff_secondboard/README.md` §4-5 (that document
predates this class). They're a reasonable neutral pick consistent with the
existing palette — flag this to the user if an exact chess.com-sourced value
becomes available later.

Add `'forced'` to `DARK_FG_CODES` (line 145-152), matching `book`'s
similarly-mid-toned color (both need dark badge text for contrast):

```ts
export const DARK_FG_CODES: ClassCode[] = [
	'brilliant',
	'best',
	'excellent',
	'good',
	'book',
	'forced',
	'inaccuracy'
];
```

- [ ] **Step 5: Fix `mock-data.ts`**

In `COACH_TEXT_MAP` (line 41-53), add an entry after `book`:

```ts
	book: 'Still following well-known opening theory.',
	forced: 'There was only one legal move in this position.',
```

- [ ] **Step 6: Add `'forced'` to the real breakdown computation**

In `src/lib/game/breakdown.ts`, change:

```ts
const BREAKDOWN_ORDER: ClassCode[] = [
	'brilliant',
	'great',
	'best',
	'excellent',
	'good',
	'book',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
];
```

to:

```ts
const BREAKDOWN_ORDER: ClassCode[] = [
	'brilliant',
	'great',
	'best',
	'excellent',
	'good',
	'book',
	'forced',
	'inaccuracy',
	'mistake',
	'miss',
	'blunder'
];
```

In `src/lib/game/breakdown.test.ts`, update the row-count assertion:

```ts
		expect(rows).toHaveLength(11);
```

- [ ] **Step 7: Run the type checker and full test suite**

Run: `pnpm check`
Expected: no errors.
Run: `pnpm exec vitest run`
Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/lib/types/index.ts src/lib/tokens.ts src/lib/assets/classification-icons.ts src/lib/game/mock-data.ts src/lib/game/breakdown.ts src/lib/game/breakdown.test.ts
git commit -m "feat(forced): add the forced ClassCode and wire its badge/icon/coach text"
```

### Task 7: Thread `legalMoveCounts` and give Forced top override priority

**Files:**
- Modify: `src/lib/api/pgn.ts`
- Modify: `src/lib/game/review.ts:22-32` (`GameData`)
- Modify: `src/lib/stores/app-state.svelte.ts` (`startReview`,
  `refreshRealAnalysis`)
- Modify: `src/lib/game/classify.ts` (`SpecialClassInputs`, `classifySpecial`)
- Test: `src/lib/game/classify.test.ts`

**Interfaces:**
- Consumes: `ParsedGame.legal_move_counts` (Task 5), `'forced'` ClassCode
  (Task 6).
- Produces: `SpecialClassInputs.legalMoveCounts?: number[]`.

- [ ] **Step 1: Write the failing tests**

Add this new `describe` block to `src/lib/game/classify.test.ts`:

```ts
describe('classifySpecial forced override', () => {
	it('classifies a move as forced when only one legal move existed, ahead of Book', () => {
		const codes = classifyGame([0, 0], undefined, {
			positions: [{}, {}],
			moveMeta: [{ from: 'e8', to: 'g8' }],
			bestMoves: {},
			bookPlyDepth: 5, // would otherwise classify ply 1 as book
			legalMoveCounts: [1]
		});

		expect(codes).toEqual(['forced']);
	});

	it('does not classify a move with more than one legal option as forced', () => {
		const codes = classifyGame([0, 1, 0.5], undefined, {
			positions: [{}, {}, {}],
			moveMeta: [
				{ from: 'a2', to: 'a3' },
				{ from: 'a7', to: 'a6' }
			],
			bestMoves: {},
			legalMoveCounts: [2, 3]
		});

		expect(codes).toEqual(['best', 'best']);
	});

	it('omitting legalMoveCounts reproduces existing behavior exactly', () => {
		const codes = classifyGame([0, 1, 0.5]);
		expect(codes).toEqual(['best', 'best']);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts -t "forced override"`
Expected: FAIL — `legalMoveCounts` is not a recognized field on
`SpecialClassInputs` yet, and the first test's codes would currently be
`['book']` rather than `['forced']`.

- [ ] **Step 3: Implement the Forced check in `classify.ts`**

Add `legalMoveCounts?: number[];` to `SpecialClassInputs`, right after the
`bookPlyDepth?: number;` field added in Task 3:

```ts
	bookPlyDepth?: number;
	/** Count of legal moves available in the position BEFORE ply `i` was
	 * played (same indexing as `moveMeta`; `legalMoveCounts[ply - 1]`). A
	 * count of exactly 1 is always Forced -- chess.com's own published
	 * definition ("only one legal move existed") -- checked ahead of every
	 * other special class, including Book. */
	legalMoveCounts?: number[];
```

In `classifySpecial`, add the Forced check as the very first line, ahead of
the Book check added in Task 3:

```ts
	if (!special) return null;

	if (special.legalMoveCounts?.[ply - 1] === 1) return 'forced';
	if (special.bookPlyDepth !== undefined && ply <= special.bookPlyDepth) return 'book';
```

Update the function's leading comment to:

```ts
/** Forced > Book > Brilliant > Great > Miss. Returns null when no special
 * condition applies and no `special` argument was supplied at all -- falls
 * through to the deterministic EP-cutoff table in either case. */
```

- [ ] **Step 4: Thread `legalMoveCounts` through the TS/Tauri boundary**

In `src/lib/api/pgn.ts`, add the field to `ParsedGame`:

```ts
export interface ParsedGame {
	sanList: string[];
	positions: Position[];
	moves: Move[];
	legalMoveCounts: number[];
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}
```

In `src/lib/game/review.ts`, add the field to `GameData`:

```ts
export interface GameData {
	sanList: string[];
	positions: Position[];
	moveMeta: Move[];
	legalMoveCounts: number[];
	isSample: boolean;
	whiteName: string | null;
	blackName: string | null;
	whiteRating: string | null;
	blackRating: string | null;
	result: string | null;
}
```

In `src/lib/stores/app-state.svelte.ts`'s `startReview()`, add the field when
constructing `appState.game`:

```ts
		appState.game = {
			sanList: parsed.sanList,
			positions: parsed.positions,
			moveMeta: parsed.moves,
			legalMoveCounts: parsed.legalMoveCounts,
			isSample: pgnToParse.trim() === SAMPLE_PGN.trim(),
			whiteName: parsed.whiteName,
			blackName: parsed.blackName,
			whiteRating: parsed.whiteRating,
			blackRating: parsed.blackRating,
			result: parsed.result ?? null
		};
```

In `refreshRealAnalysis()`, add `legalMoveCounts` to the `classifyGame` call:

```ts
		appState.classCodes = classifyGame(evalPerPly, wdlPerPly, {
			positions: appState.game!.positions,
			moveMeta: appState.game!.moveMeta,
			bestMoves,
			secondEvalPerPly,
			secondWdlPerPly,
			bookPlyDepth: findBookDepth(appState.game!.sanList),
			legalMoveCounts: appState.game!.legalMoveCounts
		});
```

- [ ] **Step 5: Run tests and type check**

Run: `pnpm exec vitest run`
Expected: all tests pass.
Run: `pnpm check`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/api/pgn.ts src/lib/game/review.ts src/lib/stores/app-state.svelte.ts src/lib/game/classify.ts src/lib/game/classify.test.ts
git commit -m "feat(forced): thread legalMoveCounts through and give Forced top override priority"
```

---

## Phase 3: Multi-game calibration harness

This phase's fixture schema is drawn from a real capture, verified this
iteration: chess.com's Game Review delivers per-move classification data over
a **WebSocket** (`wss://analysis.chess.com/v1/legacy/game-analysis`), not any
REST endpoint. Chrome DevTools' HAR export captures WebSocket frames under
the non-standard `_webSocketMessages` array on that entry. See
`docs/superpowers/specs/2026-07-21-book-forced-calibration-design.md`'s Phase
3 section for the full field inventory this schema is drawn from.

### Task 8: HAR extraction and the calibration fixture schema

**Files:**
- Create: `src/lib/calibration/types.ts`
- Create: `src/lib/calibration/har-extract.ts`
- Test: `src/lib/calibration/har-extract.test.ts`
- Create: `scripts/calibration/extract-fixture.ts` (thin CLI, not unit
  tested — see Task 8's Step 6 note)

**Interfaces:**
- Produces: `export interface CalibrationFixture { ... }` (Task 9/10 consume
  this), `export function extractGameAnalysis(har): ExtractedGameAnalysis |
  null`, `export function buildFixture(extracted, meta): CalibrationFixture`.

- [ ] **Step 1: Write the fixture types**

```ts
// src/lib/calibration/types.ts
export interface OpeningBookMatch {
	code: string;
	name: string;
	depth: number;
	score: number;
}

export interface CalibrationPosition {
	/** 0 = starting position (no move played yet, classificationName is null). */
	ply: number;
	color: 'white' | 'black' | null;
	/** chess.com's raw label, e.g. "book", "forced", "greatFind", "blunder". */
	classificationName: string | null;
	playedMoveLan: string | null;
	difference: number | null;
	caps2: number | null;
}

export interface CalibrationFixture {
	url: string;
	gameId: string;
	capturedAt: string;
	pgn: string;
	analysisEngine: string;
	book: OpeningBookMatch | null;
	bookPly: number | null;
	tallies: { white: Record<string, number>; black: Record<string, number> };
	positions: CalibrationPosition[];
}
```

- [ ] **Step 2: Write the failing tests**

```ts
// src/lib/calibration/har-extract.test.ts
import { describe, it, expect } from 'vitest';
import { extractGameAnalysis, buildFixture } from './har-extract';

function syntheticHar() {
	return {
		log: {
			entries: [
				{ request: { url: 'https://www.chess.com/callback/bucket' } },
				{
					request: { url: 'wss://analysis.chess.com/v1/legacy/game-analysis' },
					_webSocketMessages: [
						{
							type: 'send',
							data: JSON.stringify({ action: 'gameAnalysis', game: { pgn: '1. e4 e5' } })
						},
						{ type: 'receive', data: JSON.stringify({ action: 'progress', progress: 0.5 }) },
						{
							type: 'receive',
							data: JSON.stringify({
								action: 'analyzeGame',
								data: {
									analysisEngine: 'torch-human',
									book: { code: 'C20', name: 'Test Opening', depth: 2, score: 0.1 },
									bookPly: 2,
									tallies: { white: { best: 1 }, black: { best: 1 } },
									positions: [
										{
											color: null,
											classificationName: null,
											playedMove: null,
											difference: null,
											caps2: null
										},
										{
											color: 'white',
											classificationName: 'book',
											playedMove: { moveLan: 'e2e4' },
											difference: 0,
											caps2: 100
										}
									]
								}
							})
						},
						{ type: 'receive', data: JSON.stringify({ action: 'done' }) }
					]
				}
			]
		}
	};
}

describe('extractGameAnalysis', () => {
	it("finds the analysis WebSocket entry and returns its pgn + analyzeGame data", () => {
		const result = extractGameAnalysis(syntheticHar());
		expect(result?.pgn).toBe('1. e4 e5');
		expect(result?.data.analysisEngine).toBe('torch-human');
	});

	it('returns null when no analysis.chess.com entry exists', () => {
		const har = { log: { entries: [{ request: { url: 'https://www.chess.com/x' } }] } };
		expect(extractGameAnalysis(har)).toBeNull();
	});

	it('returns null when the analyzeGame frame never arrives (capture ended too early)', () => {
		const har = syntheticHar();
		har.log.entries[1]._webSocketMessages = har.log.entries[1]._webSocketMessages!.slice(0, 2);
		expect(extractGameAnalysis(har)).toBeNull();
	});
});

describe('buildFixture', () => {
	it('maps the raw analyzeGame data into the CalibrationFixture shape', () => {
		const extracted = extractGameAnalysis(syntheticHar())!;
		const fixture = buildFixture(extracted, {
			url: 'https://www.chess.com/game/live/1',
			gameId: '1',
			capturedAt: '2026-07-22T00:00:00.000Z'
		});

		expect(fixture.pgn).toBe('1. e4 e5');
		expect(fixture.bookPly).toBe(2);
		expect(fixture.positions).toHaveLength(2);
		expect(fixture.positions[1]).toEqual({
			ply: 1,
			color: 'white',
			classificationName: 'book',
			playedMoveLan: 'e2e4',
			difference: 0,
			caps2: 100
		});
	});
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/calibration/har-extract.test.ts`
Expected: FAIL with "Cannot find module './har-extract'".

- [ ] **Step 4: Implement `har-extract.ts`**

```ts
// src/lib/calibration/har-extract.ts
import type { CalibrationFixture, CalibrationPosition } from './types';

interface HarWebSocketMessage {
	type: 'send' | 'receive';
	data: string;
}
interface HarEntry {
	request: { url: string };
	_webSocketMessages?: HarWebSocketMessage[];
}
interface HarLog {
	log: { entries: HarEntry[] };
}

export interface ExtractedGameAnalysis {
	pgn: string;
	data: Record<string, unknown>;
}

/**
 * Locates chess.com's real game-analysis WebSocket entry
 * (`wss://analysis.chess.com/...`) in a captured HAR and returns the PGN
 * sent in the client's outgoing `gameAnalysis` frame together with the
 * parsed `data` object of the server's terminal `analyzeGame` frame. Returns
 * null when either piece is missing (e.g. a HAR captured before the Game
 * Review panel finished loading, so the `analyzeGame` frame never arrived).
 */
export function extractGameAnalysis(har: HarLog): ExtractedGameAnalysis | null {
	const wsEntry = har.log.entries.find((entry) =>
		entry.request.url.startsWith('wss://analysis.chess.com/')
	);
	if (!wsEntry?._webSocketMessages) return null;

	let pgn: string | null = null;
	let data: Record<string, unknown> | null = null;

	for (const message of wsEntry._webSocketMessages) {
		let parsed: Record<string, unknown>;
		try {
			parsed = JSON.parse(message.data);
		} catch {
			continue;
		}
		if (message.type === 'send' && parsed.action === 'gameAnalysis') {
			const game = parsed.game as Record<string, unknown> | undefined;
			if (typeof game?.pgn === 'string') pgn = game.pgn;
		}
		if (message.type === 'receive' && parsed.action === 'analyzeGame') {
			data = parsed.data as Record<string, unknown>;
		}
	}

	if (!pgn || !data) return null;
	return { pgn, data };
}

export interface FixtureMeta {
	url: string;
	gameId: string;
	capturedAt: string;
}

/**
 * Builds a `CalibrationFixture` from the raw `analyzeGame` data object,
 * keeping only the fields the diff engine needs.
 */
export function buildFixture(
	extracted: ExtractedGameAnalysis,
	meta: FixtureMeta
): CalibrationFixture {
	const rawPositions = extracted.data.positions as Array<Record<string, unknown>>;
	const positions: CalibrationPosition[] = rawPositions.map((pos, ply) => {
		const playedMove = pos.playedMove as Record<string, unknown> | null | undefined;
		return {
			ply,
			color: (pos.color as 'white' | 'black' | null) ?? null,
			classificationName: (pos.classificationName as string | null) ?? null,
			playedMoveLan: (playedMove?.moveLan as string | undefined) ?? null,
			difference: (pos.difference as number | null) ?? null,
			caps2: (pos.caps2 as number | null) ?? null
		};
	});

	return {
		url: meta.url,
		gameId: meta.gameId,
		capturedAt: meta.capturedAt,
		pgn: extracted.pgn,
		analysisEngine: (extracted.data.analysisEngine as string) ?? 'unknown',
		book: (extracted.data.book as CalibrationFixture['book']) ?? null,
		bookPly: (extracted.data.bookPly as number | undefined) ?? null,
		tallies: extracted.data.tallies as CalibrationFixture['tallies'],
		positions
	};
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/calibration/har-extract.test.ts`
Expected: 4 passed.

- [ ] **Step 6: Write the thin CLI wrapper**

This script is I/O glue (reads a real HAR file from disk, writes a fixture
file) — it is manually verified against one real captured game, not unit
tested, matching this codebase's existing convention for capture-adjacent
tooling (see the design spec's Phase 3 "Testing" section).

Add `vite-node` as a devDependency (needed so this script can resolve `$lib`
aliases exactly like the Vite/SvelteKit app does):

Run: `pnpm add -D vite-node`

```ts
// scripts/calibration/extract-fixture.ts
// Usage: pnpm exec vite-node scripts/calibration/extract-fixture.ts <har-file> <slug>
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extractGameAnalysis, buildFixture } from '../../src/lib/calibration/har-extract';

const [, , harPath, slug] = process.argv;
if (!harPath || !slug) {
	console.error('Usage: vite-node scripts/calibration/extract-fixture.ts <har-file> <slug>');
	process.exit(1);
}

const har = JSON.parse(readFileSync(harPath, 'utf-8'));
const extracted = extractGameAnalysis(har);
if (!extracted) {
	console.error(
		'No analyzeGame data found in this HAR -- was the Game Review panel left open long enough to fully load?'
	);
	process.exit(1);
}

const liveGameEntry = har.log.entries.find((e: { request: { url: string } }) =>
	e.request.url.includes('/game/live/')
);
const gameId = liveGameEntry
	? (new URL(liveGameEntry.request.url).pathname.split('/').pop() ?? 'unknown')
	: 'unknown';

const fixture = buildFixture(extracted, {
	url: `https://www.chess.com/game/live/${gameId}`,
	gameId,
	capturedAt: new Date().toISOString()
});

mkdirSync('docs/references/calibration-games', { recursive: true });
writeFileSync(`docs/references/calibration-games/${slug}.json`, JSON.stringify(fixture, null, 2));
console.log(`Wrote docs/references/calibration-games/${slug}.json (${fixture.positions.length} positions)`);
```

Run it against the real capture already on disk (do NOT commit
`docs/calibration/chess-review.har` itself — it contains an auth bearer
token; only the resulting fixture JSON, which contains no auth data, is
committed):

Run: `pnpm exec vite-node scripts/calibration/extract-fixture.ts docs/calibration/chess-review.har game-1`
Expected: `Wrote docs/references/calibration-games/game-1.json (112 positions)` (or
close to it — the exact count depends on the real captured game).

- [ ] **Step 7: Commit**

```bash
git add src/lib/calibration/types.ts src/lib/calibration/har-extract.ts src/lib/calibration/har-extract.test.ts scripts/calibration/extract-fixture.ts docs/references/calibration-games/game-1.json package.json pnpm-lock.yaml
git commit -m "feat(calibration): extract chess.com's real analyzeGame payload from a captured HAR"
```

### Task 9: Diff engine (confusion matrix + mismatch list)

**Files:**
- Create: `src/lib/calibration/diff-engine.ts`
- Test: `src/lib/calibration/diff-engine.test.ts`

**Interfaces:**
- Consumes: `ClassCode` (`$lib/types`).
- Produces: `mapChesscomLabel`, `diffClassifications`, `aggregateDiffResults`
  — consumed by Task 10's `calibrate.ts`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/calibration/diff-engine.test.ts
import { describe, it, expect } from 'vitest';
import { mapChesscomLabel, diffClassifications, aggregateDiffResults } from './diff-engine';

describe('mapChesscomLabel', () => {
	it('maps "greatFind" to our "great" ClassCode', () => {
		expect(mapChesscomLabel('greatFind')).toBe('great');
	});

	it('passes through identically-named labels unchanged', () => {
		expect(mapChesscomLabel('book')).toBe('book');
		expect(mapChesscomLabel('forced')).toBe('forced');
		expect(mapChesscomLabel('blunder')).toBe('blunder');
	});

	it('returns null for the starting position (null label) and unrecognized labels', () => {
		expect(mapChesscomLabel(null)).toBeNull();
		expect(mapChesscomLabel('tricky')).toBeNull();
	});
});

describe('diffClassifications', () => {
	it('counts exact matches and builds a confusion matrix', () => {
		const result = diffClassifications(
			'game-1',
			['best', 'book', 'blunder'],
			['best', 'book', 'mistake'],
			['e2e4', 'e7e5', 'd2d4']
		);

		expect(result.exactMatchRate).toBeCloseTo(2 / 3);
		expect(result.confusionMatrix.best.best).toBe(1);
		expect(result.confusionMatrix.book.book).toBe(1);
		expect(result.confusionMatrix.blunder.mistake).toBe(1);
	});

	it('records every mismatch with its game/ply/move context', () => {
		const result = diffClassifications('game-1', ['blunder'], ['mistake'], ['d2d4']);

		expect(result.mismatches).toEqual([
			{ gameSlug: 'game-1', ply: 1, moveLan: 'd2d4', ours: 'blunder', chesscom: 'mistake' }
		]);
	});

	it('skips plies where either side has no classification (e.g. an unmapped label)', () => {
		const result = diffClassifications('game-1', ['best', null], ['best', 'book'], ['e2e4', null]);

		expect(result.mismatches).toEqual([]);
		expect(result.exactMatchRate).toBe(1);
	});
});

describe('aggregateDiffResults', () => {
	it('merges confusion matrices and mismatch lists across multiple games', () => {
		const gameA = diffClassifications('game-a', ['best'], ['best'], ['e2e4']);
		const gameB = diffClassifications('game-b', ['blunder'], ['mistake'], ['d2d4']);

		const aggregate = aggregateDiffResults([gameA, gameB]);

		expect(aggregate.confusionMatrix.best.best).toBe(1);
		expect(aggregate.confusionMatrix.blunder.mistake).toBe(1);
		expect(aggregate.mismatches).toHaveLength(1);
		expect(aggregate.exactMatchRate).toBeCloseTo(0.5);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/calibration/diff-engine.test.ts`
Expected: FAIL with "Cannot find module './diff-engine'".

- [ ] **Step 3: Implement `diff-engine.ts`**

```ts
// src/lib/calibration/diff-engine.ts
import type { ClassCode } from '$lib/types';

const CHESSCOM_LABEL_TO_CLASS_CODE: Record<string, ClassCode> = {
	brilliant: 'brilliant',
	greatFind: 'great',
	best: 'best',
	excellent: 'excellent',
	good: 'good',
	book: 'book',
	forced: 'forced',
	inaccuracy: 'inaccuracy',
	mistake: 'mistake',
	miss: 'miss',
	blunder: 'blunder'
};

/**
 * Maps chess.com's raw `classificationName` string (from a captured fixture)
 * to this codebase's `ClassCode`. Returns null for a null label (the
 * starting position) or an unrecognized one (e.g. "tricky", which appears in
 * `tallies` but was never observed on a real `positions[]` entry in the
 * reconnaissance capture this schema is drawn from).
 */
export function mapChesscomLabel(label: string | null): ClassCode | null {
	if (label === null) return null;
	return CHESSCOM_LABEL_TO_CLASS_CODE[label] ?? null;
}

export interface Mismatch {
	gameSlug: string;
	ply: number;
	moveLan: string | null;
	ours: ClassCode;
	chesscom: ClassCode;
}

export type ConfusionMatrix = Record<string, Record<string, number>>;

export interface DiffResult {
	confusionMatrix: ConfusionMatrix;
	mismatches: Mismatch[];
	exactMatchRate: number;
}

/**
 * Aligns two per-ply `ClassCode` arrays (ours vs. chess.com's, both already
 * mapped to this codebase's `ClassCode`, both indexed by ply starting at ply
 * 1 -- i.e. `ours[0]`/`chesscom[0]` are ply 1) and produces a confusion
 * matrix plus a flat mismatch list. `null` entries (no classification on
 * either side, e.g. an unmapped chess.com label) are skipped entirely rather
 * than counted as either a match or a mismatch.
 */
export function diffClassifications(
	gameSlug: string,
	ours: (ClassCode | null)[],
	chesscom: (ClassCode | null)[],
	moveLans: (string | null)[]
): DiffResult {
	const confusionMatrix: ConfusionMatrix = {};
	const mismatches: Mismatch[] = [];
	let matches = 0;
	let total = 0;

	for (let i = 0; i < ours.length; i++) {
		const ourCode = ours[i];
		const theirCode = chesscom[i];
		if (ourCode === null || theirCode === null) continue;

		total++;
		confusionMatrix[ourCode] ??= {};
		confusionMatrix[ourCode][theirCode] = (confusionMatrix[ourCode][theirCode] ?? 0) + 1;

		if (ourCode === theirCode) {
			matches++;
		} else {
			mismatches.push({
				gameSlug,
				ply: i + 1,
				moveLan: moveLans[i] ?? null,
				ours: ourCode,
				chesscom: theirCode
			});
		}
	}

	return { confusionMatrix, mismatches, exactMatchRate: total === 0 ? 0 : matches / total };
}

/**
 * Merges multiple per-game `DiffResult`s into one aggregate report -- the
 * confusion matrix "aggregated across all captured games" the design spec
 * calls for.
 */
export function aggregateDiffResults(results: DiffResult[]): DiffResult {
	const confusionMatrix: ConfusionMatrix = {};
	const mismatches: Mismatch[] = [];
	let matches = 0;
	let total = 0;

	for (const result of results) {
		mismatches.push(...result.mismatches);
		for (const [ourCode, row] of Object.entries(result.confusionMatrix)) {
			confusionMatrix[ourCode] ??= {};
			for (const [theirCode, count] of Object.entries(row)) {
				confusionMatrix[ourCode][theirCode] = (confusionMatrix[ourCode][theirCode] ?? 0) + count;
				matches += ourCode === theirCode ? count : 0;
				total += count;
			}
		}
	}

	return { confusionMatrix, mismatches, exactMatchRate: total === 0 ? 0 : matches / total };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/calibration/diff-engine.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/lib/calibration/diff-engine.ts src/lib/calibration/diff-engine.test.ts
git commit -m "feat(calibration): add the confusion-matrix diff engine"
```

### Task 10: End-to-end `calibrate` CLI

**Files:**
- Create: `scripts/calibration/stockfish-client.ts`
- Create: `scripts/calibration/calibrate.ts`

**Interfaces:**
- Consumes: `findBookDepth` (Task 2), `classifyGame`/`DEFAULT_CLASSIFIER_CONFIG`
  (Task 11 — Task 10 calls `classifyGame` with its default config, since
  Task 11's config parameter defaults to today's constants either way; if
  tasks are executed in plan order, Task 11 lands after this one, and
  `classifyGame`'s 4th parameter simply doesn't exist yet, which is fine —
  omit it here and Task 11 only needs to ADD a parameter, not touch this
  file), `mapChesscomLabel`/`diffClassifications`/`aggregateDiffResults`
  (Task 9), `CalibrationFixture` (Task 8).
- Produces: the `pnpm exec vite-node scripts/calibration/calibrate.ts` report
  used manually today, and `computeFixtureInputs`/`classifyAndDiff` — reused
  by Task 11's `sweep.ts` to avoid re-running Stockfish per grid point.

This task adds `chess.js` (PGN parsing/legal-move counting in plain Node,
mirroring what `shakmaty` does for the shipped Rust backend) as a
calibration-only devDependency, and a minimal standalone Stockfish UCI client
(mirroring `src-tauri/src/engine.rs`'s own setup) so the calibration scripts
can analyze a fixture's PGN without going through Tauri IPC (which only
exists inside the running desktop app).

- [ ] **Step 1: Add `chess.js`**

Run: `pnpm add -D chess.js`

Note for the implementer: this plan targets chess.js's v1.x API
(`loadPgn`/`history()`/`board()`/`move()`/`moves()`/`turn()`/`fen()`, all
camelCase). If an older 0.x version installs, method names differ
(`load_pgn`, etc.) — check `node_modules/chess.js/package.json`'s `version`
field and adjust the method names below to match before proceeding.

- [ ] **Step 2: Write the standalone Stockfish UCI client**

```ts
// scripts/calibration/stockfish-client.ts
// Minimal UCI client mirroring src-tauri/src/engine.rs's own setup
// (UCI_ShowWDL, `go movetime`), for use ONLY by the calibration scripts --
// the shipped app still analyzes exclusively through the Rust/Tauri engine
// module; this is a standalone duplicate sufficient for offline batch
// analysis outside the Tauri runtime.
import { spawn } from 'node:child_process';

export interface UciEval {
	cp: number | null;
	mate: number | null;
	wdl: [number, number, number] | null;
}

export function analyzeFen(fen: string, movetimeMs = 500): Promise<UciEval> {
	return new Promise((resolve, reject) => {
		const proc = spawn('stockfish');
		let buffer = '';
		let lastEval: UciEval = { cp: null, mate: null, wdl: null };

		proc.stdout.on('data', (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				if (line.startsWith('info') && line.includes(' score ')) {
					const cpMatch = line.match(/score cp (-?\d+)/);
					const mateMatch = line.match(/score mate (-?\d+)/);
					const wdlMatch = line.match(/wdl (\d+) (\d+) (\d+)/);
					if (cpMatch) lastEval = { ...lastEval, cp: Number(cpMatch[1]), mate: null };
					if (mateMatch) lastEval = { ...lastEval, mate: Number(mateMatch[1]), cp: null };
					if (wdlMatch) {
						lastEval = {
							...lastEval,
							wdl: [Number(wdlMatch[1]), Number(wdlMatch[2]), Number(wdlMatch[3])]
						};
					}
				}
				if (line.startsWith('bestmove')) {
					proc.stdin.write('quit\n');
					resolve(lastEval);
				}
			}
		});
		proc.on('error', reject);
		proc.stdin.write('uci\n');
		proc.stdin.write('setoption name UCI_ShowWDL value true\n');
		proc.stdin.write('isready\n');
		proc.stdin.write(`position fen ${fen}\n`);
		proc.stdin.write(`go movetime ${movetimeMs}\n`);
	});
}
```

- [ ] **Step 3: Write the calibrate CLI**

```ts
// scripts/calibration/calibrate.ts
// Usage: pnpm exec vite-node scripts/calibration/calibrate.ts
import { readdirSync, readFileSync } from 'node:fs';
import { Chess } from 'chess.js';
import { classifyGame } from '../../src/lib/game/classify';
import { findBookDepth } from '../../src/lib/game/book';
import {
	diffClassifications,
	aggregateDiffResults,
	mapChesscomLabel,
	type DiffResult
} from '../../src/lib/calibration/diff-engine';
import { analyzeFen } from './stockfish-client';
import type { CalibrationFixture } from '../../src/lib/calibration/types';
import type { Position, Move } from '../../src/lib/board/types';

export interface FixtureInputs {
	positions: Position[];
	moveMeta: Move[];
	legalMoveCounts: number[];
	evalPerPly: number[];
	wdlPerPly: ([number, number, number] | null)[];
	bookPlyDepth: number;
}

function boardToPosition(chess: InstanceType<typeof Chess>): Position {
	const position: Position = {};
	for (const row of chess.board()) {
		for (const cell of row) {
			if (!cell) continue;
			position[cell.square] = [cell.type.toUpperCase() as Position[string][0], cell.color];
		}
	}
	return position;
}

/** The expensive, config-independent half of analyzing a fixture: parses its
 * PGN with chess.js and spawns Stockfish once per ply. Callers that only
 * need to try different classifier constants (Task 11's sweep) should
 * compute this ONCE per fixture and reuse it across every candidate config,
 * since none of it depends on classify.ts's tunable thresholds. */
export async function computeFixtureInputs(fixture: CalibrationFixture): Promise<FixtureInputs> {
	const parsed = new Chess();
	parsed.loadPgn(fixture.pgn);
	const sanHistory = parsed.history();

	const replay = new Chess();
	const positions: Position[] = [boardToPosition(replay)];
	const moveMeta: Move[] = [];
	const legalMoveCounts: number[] = [];
	const evalPerPly: number[] = [0];
	const wdlPerPly: ([number, number, number] | null)[] = [null];

	for (const san of sanHistory) {
		legalMoveCounts.push(replay.moves().length);
		const move = replay.move(san);
		moveMeta.push({ from: move.from, to: move.to });
		positions.push(boardToPosition(replay));

		const sideToMove = replay.turn(); // 'w' | 'b' -- who moves next from here
		const evalResult = await analyzeFen(replay.fen());
		// mate scores are approximated as a large centipawn value for this
		// offline tool only -- the shipped app's own mate handling
		// (src-tauri/src/lib.rs's AnalyzeFenResult.isMate) is unaffected.
		const cp = evalResult.mate !== null ? Math.sign(evalResult.mate) * 10000 : (evalResult.cp ?? 0);
		evalPerPly.push(sideToMove === 'w' ? cp / 100 : -(cp / 100));
		wdlPerPly.push(
			evalResult.wdl
				? sideToMove === 'w'
					? evalResult.wdl
					: [evalResult.wdl[2], evalResult.wdl[1], evalResult.wdl[0]]
				: null
		);
	}

	return {
		positions,
		moveMeta,
		legalMoveCounts,
		evalPerPly,
		wdlPerPly,
		bookPlyDepth: findBookDepth(sanHistory)
	};
}

/** The cheap, config-dependent half: classifies our own game and diffs it
 * against the fixture's chess.com ground truth. Pure given `inputs`. */
export function classifyAndDiff(fixture: CalibrationFixture, inputs: FixtureInputs): DiffResult {
	const ourCodes = classifyGame(inputs.evalPerPly, inputs.wdlPerPly, {
		positions: inputs.positions,
		moveMeta: inputs.moveMeta,
		bestMoves: {},
		bookPlyDepth: inputs.bookPlyDepth,
		legalMoveCounts: inputs.legalMoveCounts
	});

	const chesscomCodes = fixture.positions.slice(1).map((p) => mapChesscomLabel(p.classificationName));
	const moveLans = fixture.positions.slice(1).map((p) => p.playedMoveLan);

	return diffClassifications(fixture.gameId, ourCodes, chesscomCodes, moveLans);
}

async function main() {
	const dir = 'docs/references/calibration-games';
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
	const results: DiffResult[] = [];

	for (const file of files) {
		const fixture = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8')) as CalibrationFixture;
		console.log(`Analyzing ${file}...`);
		const inputs = await computeFixtureInputs(fixture);
		results.push(classifyAndDiff(fixture, inputs));
	}

	const aggregate = aggregateDiffResults(results);
	console.log(`\nExact match rate: ${(aggregate.exactMatchRate * 100).toFixed(1)}%`);
	console.log('Confusion matrix (rows = ours, columns = chess.com):');
	console.log(JSON.stringify(aggregate.confusionMatrix, null, 2));
	console.log(`\n${aggregate.mismatches.length} mismatched plies:`);
	for (const m of aggregate.mismatches) {
		console.log(`  ${m.gameSlug} ply ${m.ply} (${m.moveLan}): ours=${m.ours} chess.com=${m.chesscom}`);
	}
}

main();
```

- [ ] **Step 4: Run it against the real fixture from Task 8**

Run: `pnpm exec vite-node scripts/calibration/calibrate.ts`
Expected: prints an exact-match rate, a confusion matrix, and a mismatch
list. Requires `stockfish` on `PATH` (same requirement as the shipped app);
this run is slow (one Stockfish spawn per ply) and is a manual verification
step, not part of `pnpm test` — no automated test asserts on its output.

- [ ] **Step 5: Commit**

```bash
git add scripts/calibration/stockfish-client.ts scripts/calibration/calibrate.ts package.json pnpm-lock.yaml
git commit -m "feat(calibration): add the end-to-end calibrate CLI"
```

### Task 11: Make classifier constants tunable + a grid-sweep script

**Files:**
- Modify: `src/lib/game/classify.ts` (`ClassifierConfig`, `classifyGame`,
  `classifySpecial`)
- Test: `src/lib/game/classify.test.ts`
- Create: `scripts/calibration/sweep.ts`

**Interfaces:**
- Consumes: `computeFixtureInputs` (Task 10).
- Produces: `export interface ClassifierConfig { ... }`, `export const
  DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig`, `classifyGame`'s new 4th
  optional parameter `config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG`.

- [ ] **Step 1: Write the failing test**

Add to `src/lib/game/classify.test.ts`:

```ts
import { DEFAULT_CLASSIFIER_CONFIG } from './classify';

describe('classifyGame with an explicit ClassifierConfig', () => {
	it('omitting config reproduces the default-constant behavior exactly', () => {
		const withDefault = classifyGame([0, 1, 0.5]);
		const withExplicitDefault = classifyGame([0, 1, 0.5], undefined, undefined, DEFAULT_CLASSIFIER_CONFIG);
		expect(withExplicitDefault).toEqual(withDefault);
	});

	it('a stricter missWinAfter threshold changes what counts as a Miss', () => {
		// Mover's win% drops from 80 to 60 -- with the default missWinAfter (55)
		// this is NOT a miss (60 is not < 55); tightening the threshold to 65
		// makes the same drop qualify.
		const evalPerPly = [0, 0];
		const wdlPerPly: (import('./accuracy').Wdl | null)[] = [
			[800, 200, 0], // mover win% 80 before
			[600, 200, 200] // mover win% 60 after (arbitrary split preserving sum=1000)
		];
		const positions: Position[] = [{}, {}];
		const moveMeta: Move[] = [{ from: 'a2', to: 'a4' }];

		const defaultCodes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves: {} });
		expect(defaultCodes[0]).not.toBe('miss');

		const strictCodes = classifyGame(evalPerPly, wdlPerPly, { positions, moveMeta, bestMoves: {} }, {
			...DEFAULT_CLASSIFIER_CONFIG,
			missWinAfter: 65
		});
		expect(strictCodes[0]).toBe('miss');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/game/classify.test.ts -t "ClassifierConfig"`
Expected: FAIL — `classifyGame` does not accept a 4th parameter yet, and
`DEFAULT_CLASSIFIER_CONFIG` is not exported.

- [ ] **Step 3: Make the constants configurable**

In `src/lib/game/classify.ts`, replace the 8 module-level `const` declarations
(lines 49-56) with a config interface and default, keeping every value
identical:

```ts
export interface ClassifierConfig {
	brilliantMinWin: number;
	brilliantNotWinning: number;
	brilliantMinSacrificeValue: number;
	brilliantCausalGap: number;
	greatOnlyMoveGap: number;
	greatNotAlreadyDecided: number;
	missWinBefore: number;
	missWinAfter: number;
}

export const DEFAULT_CLASSIFIER_CONFIG: ClassifierConfig = {
	brilliantMinWin: 50,
	brilliantNotWinning: 80,
	brilliantMinSacrificeValue: 3,
	brilliantCausalGap: 25,
	greatOnlyMoveGap: 15,
	greatNotAlreadyDecided: 99,
	missWinBefore: 80,
	missWinAfter: 55
};
```

Change `classifyGame`'s signature to accept the 4th optional parameter and
thread it to `classifySpecial`:

```ts
export function classifyGame(
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[],
	special?: SpecialClassInputs,
	config: ClassifierConfig = DEFAULT_CLASSIFIER_CONFIG
): ClassCode[] {
	if (evalPerPly.length < 2) return [];

	const wdlScores = evalPerPly.map((_, ply) => winPercentForPly(ply, evalPerPly, wdlPerPly));
	const cpScores = evalPerPly.map(winPercentFromEval);
	const codes: ClassCode[] = [];

	for (let ply = 1; ply < evalPerPly.length; ply++) {
		const mover = sideToMoveForPly(ply - 1);
		const beforeWdlPov = mover === 'w' ? wdlScores[ply - 1] : 100 - wdlScores[ply - 1];
		const afterWdlPov = mover === 'w' ? wdlScores[ply] : 100 - wdlScores[ply];
		const beforeCpPov = mover === 'w' ? cpScores[ply - 1] : 100 - cpScores[ply - 1];
		const afterCpPov = mover === 'w' ? cpScores[ply] : 100 - cpScores[ply];
		const epLoss = beforeWdlPov - afterWdlPov;

		codes.push(
			classifySpecial(
				ply,
				mover,
				beforeWdlPov,
				afterWdlPov,
				beforeCpPov,
				afterCpPov,
				epLoss,
				special,
				config
			) ?? classifyMoveByEpLoss(epLoss)
		);
	}

	return codes;
}
```

Change `classifySpecial`'s signature to accept `config` and use it in place
of every former module constant reference:

```ts
function classifySpecial(
	ply: number,
	mover: 'w' | 'b',
	beforeWdlPov: number,
	afterWdlPov: number,
	beforeCpPov: number,
	afterCpPov: number,
	epLoss: number,
	special: SpecialClassInputs | undefined,
	config: ClassifierConfig
): ClassCode | null {
	if (!special) return null;

	if (special.legalMoveCounts?.[ply - 1] === 1) return 'forced';
	if (special.bookPlyDepth !== undefined && ply <= special.bookPlyDepth) return 'book';

	const playedMove = special.moveMeta[ply - 1];
	const suggested = special.bestMoves[ply];
	const playedIsBest = Boolean(
		playedMove && suggested && suggested.from === playedMove.from && suggested.to === playedMove.to
	);
	const nearBest = epLoss <= 2 || playedIsBest;

	const beforePosition = special.positions[ply - 1];
	const afterPosition = special.positions[ply];
	const opponent: 'w' | 'b' = mover === 'w' ? 'b' : 'w';

	const secondWhitePov = secondLineWinPercent(
		ply - 1,
		special.secondEvalPerPly,
		special.secondWdlPerPly
	);
	const secondMoverPov = secondWhitePov === null ? null : mover === 'w' ? secondWhitePov : 100 - secondWhitePov;
	const cpGap = secondMoverPov === null ? null : beforeCpPov - secondMoverPov;

	const qualifyingAfterTarget = Boolean(
		afterPosition && hasPositiveExchangeTarget(afterPosition, mover, config.brilliantMinSacrificeValue)
	);

	if (
		nearBest &&
		qualifyingAfterTarget &&
		afterCpPov >= config.brilliantMinWin &&
		beforeCpPov < config.brilliantNotWinning
	) {
		const movedGainBefore =
			playedMove && beforePosition ? staticExchangeGain(beforePosition, playedMove.from, opponent) : 0;
		const movedGainAfter =
			playedMove && afterPosition ? staticExchangeGain(afterPosition, playedMove.to, opponent) : 0;
		const sacrificeIsCausal =
			movedGainAfter - movedGainBefore >= config.brilliantMinSacrificeValue ||
			(playedIsBest && cpGap !== null && cpGap >= config.brilliantCausalGap);

		if (sacrificeIsCausal) return 'brilliant';
	}

	if (
		playedIsBest &&
		!qualifyingAfterTarget &&
		beforeCpPov < config.greatNotAlreadyDecided &&
		cpGap !== null &&
		cpGap >= config.greatOnlyMoveGap
	) {
		return 'great';
	}

	if (beforeWdlPov >= config.missWinBefore && afterWdlPov < config.missWinAfter) return 'miss';

	return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run`
Expected: all tests pass, including every pre-existing golden fixture
(`classify.reference-game.test.ts`, `classify.kasparov-topalov.test.ts`) —
since `DEFAULT_CLASSIFIER_CONFIG`'s values are copied 1:1 from the removed
constants, no existing behavior changes.

- [ ] **Step 5: Write the sweep script**

```ts
// scripts/calibration/sweep.ts
// Usage: pnpm exec vite-node scripts/calibration/sweep.ts
// Sweeps a small grid over the two constants this codebase's own header
// comments (classify.ts) flag as hand-tuned against only 2 reference games
// (brilliantCausalGap, greatOnlyMoveGap), re-running classification (cheap)
// against every captured fixture's PRE-COMPUTED engine inputs (expensive,
// computed once per fixture, not once per grid point) and reporting the
// combination with the best aggregate exact-match rate.
import { readdirSync, readFileSync } from 'node:fs';
import { DEFAULT_CLASSIFIER_CONFIG, classifyGame, type ClassifierConfig } from '../../src/lib/game/classify';
import { diffClassifications, aggregateDiffResults, mapChesscomLabel } from '../../src/lib/calibration/diff-engine';
import { computeFixtureInputs, type FixtureInputs } from './calibrate';
import type { CalibrationFixture } from '../../src/lib/calibration/types';

const BRILLIANT_CAUSAL_GAP_CANDIDATES = [15, 20, 25, 30];
const GREAT_ONLY_MOVE_GAP_CANDIDATES = [10, 15, 20];

function diffWithConfig(fixture: CalibrationFixture, inputs: FixtureInputs, config: ClassifierConfig) {
	const ourCodes = classifyGame(
		inputs.evalPerPly,
		inputs.wdlPerPly,
		{
			positions: inputs.positions,
			moveMeta: inputs.moveMeta,
			bestMoves: {},
			bookPlyDepth: inputs.bookPlyDepth,
			legalMoveCounts: inputs.legalMoveCounts
		},
		config
	);
	const chesscomCodes = fixture.positions.slice(1).map((p) => mapChesscomLabel(p.classificationName));
	const moveLans = fixture.positions.slice(1).map((p) => p.playedMoveLan);
	return diffClassifications(fixture.gameId, ourCodes, chesscomCodes, moveLans);
}

async function main() {
	const dir = 'docs/references/calibration-games';
	const files = readdirSync(dir).filter((f) => f.endsWith('.json'));

	const fixturesWithInputs: Array<{ fixture: CalibrationFixture; inputs: FixtureInputs }> = [];
	for (const file of files) {
		const fixture = JSON.parse(readFileSync(`${dir}/${file}`, 'utf-8')) as CalibrationFixture;
		console.log(`Computing engine inputs for ${file}...`);
		fixturesWithInputs.push({ fixture, inputs: await computeFixtureInputs(fixture) });
	}

	let best: { config: ClassifierConfig; exactMatchRate: number } | null = null;

	for (const brilliantCausalGap of BRILLIANT_CAUSAL_GAP_CANDIDATES) {
		for (const greatOnlyMoveGap of GREAT_ONLY_MOVE_GAP_CANDIDATES) {
			const config: ClassifierConfig = {
				...DEFAULT_CLASSIFIER_CONFIG,
				brilliantCausalGap,
				greatOnlyMoveGap
			};
			const results = fixturesWithInputs.map(({ fixture, inputs }) => diffWithConfig(fixture, inputs, config));
			const aggregate = aggregateDiffResults(results);
			console.log(
				`brilliantCausalGap=${brilliantCausalGap} greatOnlyMoveGap=${greatOnlyMoveGap} -> ${(aggregate.exactMatchRate * 100).toFixed(1)}%`
			);
			if (!best || aggregate.exactMatchRate > best.exactMatchRate) {
				best = { config, exactMatchRate: aggregate.exactMatchRate };
			}
		}
	}

	console.log('\nBest combination (a recommendation only -- a human reviews this before adopting it):');
	console.log(JSON.stringify(best, null, 2));
}

main();
```

- [ ] **Step 6: Run it**

Run: `pnpm exec vite-node scripts/calibration/sweep.ts`
Expected: prints one line per grid combination and a final recommended
config. This is a manual-verification tool, same as `calibrate.ts` — its
recommendation is not auto-applied; a human reviews it before editing
`DEFAULT_CLASSIFIER_CONFIG`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/game/classify.ts src/lib/game/classify.test.ts scripts/calibration/sweep.ts
git commit -m "feat(calibration): make classifier constants tunable and add a grid-sweep script"
```

---

## Self-Review Notes

- **Spec coverage:** Phase 1 (Tasks 1-4) covers the design spec's opening
  database, trie, `findBookDepth`, and `classifySpecial` integration
  end-to-end, plus the Byrne-Fischer real-world regression the spec calls
  for. Phase 2 (Tasks 5-7) covers `legal_move_counts` in Rust, the `forced`
  `ClassCode` and its full visual wiring, and `classifySpecial` integration.
  Phase 3 (Tasks 8-11) covers HAR extraction against the now-confirmed real
  schema, the diff engine/confusion matrix, the end-to-end calibrate CLI, and
  constant tunability + grid sweep.
- **Placeholder scan:** no TBD/"add appropriate"/"similar to Task N" patterns;
  every code block is complete. Task 5's boxed-king FEN test and Task 4's
  `findBookDepth(...).toBeGreaterThanOrEqual(12)` assertion are intentionally
  non-brittle (a soft bound / a hand-verified-but-not-yet-executed position)
  rather than a blind hardcoded equality, with an explicit implementer note
  on what to do if the real run diverges — consistent with this codebase's
  own existing convention (`pgn.rs`'s `rejects_a_pgn_with_no_movetext` test
  comment).
- **Type consistency:** `SpecialClassInputs.bookPlyDepth`/`legalMoveCounts`
  (Task 3/7), `ClassCode` `'forced'` (Task 6), `ParsedGame.legalMoveCounts`
  (Task 5/7), and `ClassifierConfig` (Task 11) are each defined once and
  reused with identical names/shapes across every later task that touches
  them.
