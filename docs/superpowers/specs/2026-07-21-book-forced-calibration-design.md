# Book + Forced Move Detection, and a Chess.com Calibration Harness — Design

## Goal

Close the two remaining special-class gaps documented throughout
`docs/references/calibration-log.md` (Book, Forced), and replace the current
manual/ad-hoc calibration process (2 games, hand-transcribed from
screenshots) with an automated harness that can grow to many games over
time, so future threshold tuning is data-driven instead of screenshot-driven.

Three phases, executed in this order (each independently shippable and
testable):

1. Book move detection (opening database lookup)
2. Forced move detection (only-legal-move detection)
3. Multi-game calibration harness (capture chess.com ground truth, diff
   against ours, tune thresholds)

## Global constraints

- No chess.com-internal data is guessed. Book uses a real, public, actively
  maintained opening database; Forced uses chess.com's own published
  definition ("only one legal move"), verified via chess.com's help forum
  this session.
- Every existing golden fixture (`classify.reference-game.test.ts`,
  `classify.kasparov-topalov.test.ts`) must continue to pass unmodified,
  the same discipline this branch has held since Iteration 10.
- No new runtime network dependency: the opening database is fetched once
  and checked into the repo as a frozen asset, matching the "frozen fixture"
  pattern already used for Stockfish analysis captures this session.
- `ClassCode`, `SpecialClassInputs`, and the `classifySpecial` override order
  are extended, never replaced — omitting the new optional inputs must
  reproduce today's behavior byte-for-byte (the same backward-compatibility
  discipline every prior special-class iteration has followed).

## Phase 1: Book move detection

### Data source

`lichess-org/chess-openings` (MIT-licensed, verified via direct fetch of
`a.tsv`): 5 files (`a.tsv`–`e.tsv`, ECO volumes A–E), 3627 rows, 3
tab-separated columns: `eco`, `name`, `pgn` (numbered SAN, e.g.
`"1. e4 e5 2. Nf3"`). This is the same dataset lichess's own site uses.

A one-time build step downloads all 5 files, strips move numbers from each
`pgn` cell into a plain SAN array, and writes a single checked-in JSON asset
(`src/lib/data/openings.json`: `Array<{ eco: string; name: string; sanMoves:
string[] }>`). No runtime fetch — this JSON ships in the repo like any other
static asset.

### Matching

A **trie** over all 3627 SAN sequences (not a flat exact-match set) is built
once at module load (`src/lib/game/book.ts`, module-level singleton). A
trie is required rather than a simple set because a prefix can be genuine
book theory even when that exact prefix isn't itself a named row — what
matters is whether the position sequence, walked ply by ply, still has *any*
continuation in the dataset ("some longer named line still starts this
way").

`findBookDepth(sanMoves: string[]): number` walks the game's actual SAN
moves through the trie one ply at a time, returning the count of plies
matched before the first mismatch (or before the trie runs out of
continuations). Depth `0` means move 1 itself isn't catalogued (shouldn't
happen for a real game opening with a legal first move).

### Classification integration

`classifyGame` gains an optional `bookPlyDepth?: number` parameter (or it's
folded into `SpecialClassInputs` — exact call-site wiring is a plan
decision). In `classifySpecial`'s override order, Book is checked **first**,
ahead of Brilliant/Great/Miss:

```
if (ply <= bookPlyDepth) return 'book';
// ...then existing Brilliant > Great > Miss checks
```

This matches real chess.com behavior: a move deep in known opening theory is
never flagged Brilliant, even if it superficially resembles a sacrifice
(confirmed by the existing Byrne–Fischer fixture, whose 3 real Brilliant
plies are all well outside its 6/6 Book count from move 1–3 per side).

### Testing

- Unit tests for `findBookDepth` against small synthetic opening sets
  (isolated trie-walk behavior: exact match, prefix-only match, immediate
  mismatch, empty game).
- The Byrne–Fischer reference game becomes the first real-world regression
  test: after this phase, `classify.reference-game.test.ts`'s Book count
  should read 6/6 (matching the chess.com screenshot already on file in
  `calibration-log.md`) while the existing Brilliant/Great assertions
  continue to pass unchanged.

## Phase 2: Forced move detection

### Data source

Legal move count per position, computed in Rust where the position already
exists. `pgn.rs` already walks the game ply-by-ply through
`shakmaty::Chess` positions (to build `board_to_position` for each ply); at
that same point, `pos.legal_moves().len()` gives the count of legal moves
available *before* the move actually played was applied.

### Plumbing

- `ParsedGame` (`pgn.rs`) gains `legal_move_counts: Vec<u32>`, one entry per
  move (same indexing as `moves`/`san_list`).
- TS `ParsedGame`-equivalent type (`src/lib/api/pgn.ts`) gains
  `legalMoveCounts: number[]`.
- `GameData`/`SpecialClassInputs` (`review.ts`, `classify.ts`) gain
  `legalMoveCounts?: number[]`, threaded the same way `bestMoves` already is.

### Classification integration

`'forced'` is added to the `ClassCode` union (`src/lib/types/index.ts`). A
new token entry is added to `tokens.ts`'s `classification` map, reusing the
already-bundled, currently-unused `forced.svg` icon
(`src/lib/assets/chesscom-analysis-icons/svg/forced.svg`) — no new asset
sourcing required. `DARK_FG_CODES` membership (light vs. dark badge text) is
decided by the same visual-contrast rule already applied to the other 10
codes.

In `classifySpecial`, Forced is checked **before Book**, at the very top:

```
if (special?.legalMoveCounts?.[ply - 1] === 1) return 'forced';
```

Rationale: "only one legal move existed" removes agency entirely — nothing
about opening theory, sacrifice value, or win% loss is a meaningful
override once this is true.

### Testing

- Rust unit test: a position with a single legal move (e.g. a king boxed
  into one escape square while in check) produces `legal_move_counts` of 1
  at that ply.
- TS unit test: `classifySpecial` returns `'forced'` when
  `legalMoveCounts[ply-1] === 1`, regardless of what Book/Brilliant/Great
  would otherwise compute.
- Existing golden fixtures re-verified: neither reference game is expected
  to contain a genuine only-legal-move position (this should be confirmed,
  not assumed, when the fixtures are re-run against real `legalMoveCounts`
  data pulled from the actual PGNs).

## Phase 3: Multi-game calibration harness

### Capture

**Reconnaissance complete (confirmed via a real user-captured HAR,
`docs/calibration/chess-review.har`, 85.3M, game id `170011037438`).**
chess.com's Game Review does **not** deliver classifications over any REST
`callback/analysis/...` endpoint — those return `data: null` plus a bare
auth token. The real data flows over a **WebSocket**:
`wss://analysis.chess.com/v1/legacy/game-analysis`. Chrome DevTools' HAR
export captures WS frames under the non-standard `_webSocketMessages` array
on the entry whose `request.url` is the `wss://` URL. The client sends one
`{"action":"gameAnalysis","game":{"pgn": "..."}}` frame; the server streams
`{"action":"progress","progress":<0..1>,"engineType":"torch-human",...}`
frames, then one large terminal frame `{"action":"analyzeGame","data":{...}}`
(680KB in the captured game), then `{"action":"done"}`.

**Confirmed real response schema** (`data` object of the `analyzeGame`
frame — field names verified directly from the capture, not invented):

- `data.analysisEngine`: `"torch-human"` — chess.com's Game Review runs a
  neural, human-like model, not a classical deep Stockfish search. This is
  a useful fact for interpreting calibration results: our own eval-based
  thresholds are being tuned against a differently-sourced ground truth,
  which is exactly why the diff/sweep approach (rather than assuming shared
  eval semantics) is the right one.
- `data.book`: `{ code: string, name: string, depth: number, moves: string
  (opaque/encoded — not usable as plain SAN), score: number, url: string }`
  — e.g. `{code: "D02", name: "London System", depth: 30, score: 0.15}`.
- `data.bookPly` / `data.ecoPly`: integer, the real book-cutoff ply (e.g.
  `5`) — direct ground truth for Phase 1's `findBookDepth`.
- `data.tallies.{white,black}`: per-color, per-class integer counts, e.g.
  `{best, blunder, book, brilliant, excellent, forced, good, greatFind,
  inaccuracy, miss, mistake, tricky, ...GP0/GP1/GP2 phase-split variants}`.
  This is chess.com's own aggregate ground truth — the diff engine can
  compare against these directly without recomputing counts from
  `positions[]`.
- `data.positions[]`: one entry per ply, **index 0 is the starting
  position** (no move played yet, `classificationName: null`); index *i*
  (i ≥ 1) describes the move played to reach that position. Confirmed
  fields actually present per entry:
  - `classificationName: string | null` — chess.com's real per-move label.
    **Confirmed label set from this capture**: `book`, `forced`, `best`,
    `excellent`, `good`, `inaccuracy`, `mistake`, `miss`, `blunder`,
    `greatFind` (note: **`"greatFind"`, not `"great"`** — the diff engine
    must map this to our `ClassCode`'s `'great'`). `brilliant` is a valid
    label (present in `tallies`, just `0` in this particular game — not yet
    directly observed on a `positions[]` entry).
  - `color: 'white' | 'black' | null`
  - `playedMove.moveLan: string` — the move actually played, in LAN
    (e.g. `"d2d4"`), for aligning against our own `moves`/`san_list`.
  - `bestMove.moveLan`, `bestMove.eval.cp`, `bestMove.eval.pv` — engine's
    preferred move/eval/PV at that position.
  - `difference: number` — the move's eval loss (exact sign/units TBD by
    the diff-engine implementer; cross-check numerically against a few
    known-blunder plies when wiring this up).
  - `caps2: number | null` — chess.com's per-move accuracy contribution.
  - `scenarios: { book: boolean, isKeyMoment?: boolean }`.

Given this, the capture step doesn't need `claude-in-chrome` DOM scraping at
all — it needs a network capture (HAR, via the user's authenticated browser
session) covering the WebSocket's full frame sequence for a given game URL,
then a parser that finds the `analysis.chess.com` WS entry, reads
`_webSocketMessages`, and JSON-parses the final `analyzeGame` frame's
`data` field. This is a plain data-processing script, not a browser
automation step — no DOM interaction is required once the network capture
exists.

Each captured game is written as a fixture, using the real field names
above (fields beyond what a given fixture-writer needs, like `arc`,
`gameSummary`, `reportCard`, `themes`, are intentionally omitted — they're
present in the raw capture but out of scope for classification calibration):

```
docs/references/calibration-games/<slug>.json
{
  "url": string,
  "gameId": string,
  "capturedAt": string,           // ISO date
  "pgn": string,
  "analysisEngine": string,       // e.g. "torch-human", informational
  "book": { "code": string, "name": string, "depth": number, "score": number },
  "bookPly": number,
  "tallies": {
    "white": Record<string, number>,
    "black": Record<string, number>
  },
  "positions": Array<{
    "ply": number,                // 0 = start position, no classification
    "color": "white" | "black" | null,
    "classificationName": string | null,   // raw chess.com label, incl. "greatFind"
    "playedMoveLan": string | null,
    "difference": number | null,
    "caps2": number | null
  }>
}
```

### Diff engine

A script (`scripts/calibrate.ts` or similar) reads every fixture under
`docs/references/calibration-games/`, runs our own `classifyGame` over each
game's PGN, and aligns move-by-move (by `ply`, cross-checked against
`playedMoveLan`) against each fixture's `positions[].classificationName`,
mapping chess.com's raw label to our `ClassCode` (`"greatFind"` → `'great'`,
all others 1:1). It produces:

- A per-class confusion matrix aggregated across all captured games (rows =
  our class, columns = chess.com's class, cell = count). `tallies` gives a
  cheap aggregate cross-check that the per-ply walk reproduces chess.com's
  own reported counts.
- A flat list of every individual mismatched ply (game, move number, SAN,
  our class, chess.com's class) for manual inspection of any specific
  disagreement.

This report is regenerated on every run — it replaces the current
hand-maintained prose in `calibration-log.md` as the primary calibration
artifact going forward (the existing 2-game manual log is kept as
historical record, not deleted).

### Tuning

The classifier's free constants (`BRILLIANT_MIN_WIN`,
`BRILLIANT_NOT_WINNING`, `BRILLIANT_MIN_SACRIFICE_VALUE`,
`BRILLIANT_CAUSAL_GAP`, `GREAT_ONLY_MOVE_GAP`, `GREAT_NOT_ALREADY_DECIDED`,
`MISS_WIN_BEFORE`, `MISS_WIN_AFTER`, and the EP-cutoff table) are a small,
fixed set of scalars — a brute-force grid sweep over the full fixture corpus
is tractable without any ML tooling. The sweep script re-runs the diff
engine once per candidate constant combination and reports the combination
maximizing exact-match rate (or per-class F1, whichever proves more
informative once real confusion-matrix data exists) across every captured
game simultaneously — replacing today's one-game-at-a-time, by-hand
adjustment with a search that can't overfit to a single game the way the
Kasparov-Topalov session's manual pass necessarily risked.

Game sourcing is open-ended by design: any URL fed to the capture step adds
one more data point. There's no fixed target count — the harness's value
scales with however many games accumulate over time (the user's own
reviewed games, chess.com's freely-viewable historical game library, or
both).

### Testing

- Diff engine: unit tests against small synthetic fixture pairs (exact
  match, single mismatch, multiple mismatches) verifying the confusion
  matrix and mismatch list are built correctly.
- Capture step: manually verified against one real captured game during the
  reconnaissance task; no automated test can cover live chess.com network
  behavior, so this is explicitly a manual-verification checkpoint, not a
  unit test target.

## Out of scope (explicitly deferred)

- MultiPV result caching, cancellation (separate, already-tracked blueprint
  items, unrelated to this work).
- Automatic threshold *application* without a human reviewing the sweep's
  recommendation first — the sweep reports a recommendation; a human still
  decides whether to adopt it, the same way every prior calibration change
  this session was reviewed before landing.
- Any chess.com phase-rating capture beyond whatever the reconnaissance
  task happens to find bundled in the same response as classifications
  (this phase is scoped to classification calibration, not a repeat of the
  Phase Rating research).
