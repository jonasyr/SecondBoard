# Calibration Capture Pipeline Design

**Goal:** Widen what we capture from chess.com's real Game Review payload, and
let a second contributor (on the same home LAN) feed captured games into a
persistent SQLite store automatically, with no manual per-game steps.

**Context:** SecondBoard already has a manual, one-off calibration pipeline:
Chrome DevTools HAR export -> `scripts/calibration/extract-fixture.ts` ->
a single JSON fixture (`docs/references/calibration-games/game-1.json`),
matched against our classifier via `src/lib/calibration/diff-engine.ts`.
That pipeline requires manually exporting an 85MB HAR file per game and only
captures a narrow slice of the real WebSocket payload
(`src/lib/calibration/types.ts`'s `CalibrationFixture`).

Inspecting the real captured `analyzeGame` payload directly showed it
contains far more than we store today: `CAPS` (accuracy, overall and
per-phase `gp0`/`gp1`/`gp2`), `gamePhases`/`gameStartPhase`/`gameEndPhase`
(phase-boundary plies), `reportCard` (per-side `effectiveElo` "Game Rating"
and per-category performance glyphs -- this is the exact Opening/
Middlegame/Endgame rating UI chess.com shows, which we want to copy), `E1`,
`prediction`, and richer per-position fields (`fen`, `bestMove`,
`suggestedMove`, `scenarios`, `analysisTypes`) that the current schema drops.

## Global Constraints

- The chess.com auth bearer token lives in HTTP headers, never in WebSocket
  message bodies -- verified against the real captured HAR. No component in
  this pipeline may ever store, log, or forward HTTP headers/cookies from
  the chess.com page; only the WS message body (`data` object of the
  `analyzeGame` action) is ever captured or transmitted.
- The ingest/export server is LAN-only. It must never be exposed to the
  public internet (no port-forwarding, no public DNS entry) in this design.
  Given that, a single shared-secret header is sufficient access control --
  no user accounts, no TLS requirement.
- The extension is for personal/family use only, installed via Chrome's
  "Load unpacked" developer mode -- no Chrome Web Store submission in scope.
- The full raw `analyzeGame` payload is always stored verbatim (as a JSON
  column) in addition to any derived/indexed columns, so nothing is
  permanently lost by under-deciding the schema up front -- derived tables
  can be dropped and rebuilt from the raw payload at any time.
- This spec covers capture, transport, and storage only. Migrating
  `scripts/calibration/calibrate.ts`/`sweep.ts`/`diff-engine.ts` from
  reading one hardcoded JSON fixture to iterating over every game in the
  SQLite store is explicitly out of scope for this spec/plan -- it is
  real, separate follow-up work once data is flowing.

## Architecture

Three components:

1. **Chrome extension** (installed on the second contributor's machine) --
   watches the chess.com Game Review page's WebSocket traffic and
   auto-forwards the terminal `analyzeGame` frame's data to the ingest
   server the moment a review finishes. No manual action required per game.
2. **Ingest/export server** (Node, Docker container, runs on the home LAN
   server) -- a small HTTP service with `POST /ingest` (validate + upsert
   into SQLite) and `GET /export` (read all games back out, for the dev
   machine to pull over the LAN, since the dev machine and the home server
   are separate boxes).
3. **SQLite store** -- one file, two tables (`games`, `positions`), living
   on the home server's Docker volume.

```
chess.com Game Review page
   |  (WebSocket frames, observed in-page)
   v
Chrome extension (content script + background worker)
   |  POST /ingest  (shared-secret header)
   v
Ingest server (Node + better-sqlite3, Docker, home LAN)
   |
   v
SQLite (games, positions)
   ^
   |  GET /export (shared-secret header, pulled over LAN)
   |
Dev machine (future: calibration scripts consume this)
```

## Components

### Chrome extension

Manifest V3, three files:

- **`content-script.js`** -- runs in the page's isolated world. Injects a
  small inline `<script>` tag into the page (page-context access is
  required to override `window.WebSocket`; an isolated-world content
  script cannot reach the page's own `WebSocket` global). The injected
  script wraps `WebSocket` so that for any connection whose URL matches
  `analysis.chess.com`, incoming message frames are parsed as JSON; when a
  frame's `action === "analyzeGame"`, its `data` object is
  `window.postMessage`d back out to the content script, which relays it to
  the background worker via `chrome.runtime.sendMessage`.
- **`background.js`** (service worker) -- receives the captured payload,
  attaches `submittedBy` (a fixed string configured once via the
  extension's options page, e.g. `"brother"`) and `capturedAt` (ISO
  timestamp), and POSTs the envelope to the configured ingest URL with the
  shared-secret header. The ingest URL and shared secret are the only two
  values configured once at install time (extension options page).
- **Retry queue**: if the POST fails (network error, server down, non-2xx),
  the envelope is appended to a capped queue (last 20 entries) in
  `chrome.storage.local`. The queue is flushed (oldest first) on every new
  successful capture and on every extension/browser startup, so a
  temporarily unreachable server does not lose data.
- **Frame-parsing logic** (which fields to check/require before treating a
  message as a valid `analyzeGame` frame) lives in a small, pure,
  independently testable module, mirroring the existing
  `src/lib/calibration/har-extract.ts` pattern -- pure parsing separated
  from the untestable `WebSocket`-patching glue.

### Ingest/export server

Node + `better-sqlite3`, single Docker container, SQLite file on a mounted
volume.

- **`POST /ingest`**: requires the shared-secret header (exact match against
  a server-side env var; reject with `401` otherwise). Validates the body
  loosely -- requires `gameId`, `positions` (array), `tallies` (object) to
  be present; does not enforce a strict schema on the rest, since the
  payload's own shape is the source of truth and future chess.com payload
  additions shouldn't require a server code change to accept. Upserts:
  - `games` row keyed on `gameId` (replace-on-conflict, so re-opening a
    review overwrites rather than duplicates).
  - `positions` rows: delete existing rows for that `gameId`, re-insert
    from the payload's `positions` array (simplest correct approach given
    upsert-by-game already means "this game's data may have changed").
  - Malformed body (missing required fields) -> `400`, logged, not stored.
- **`GET /export`**: requires the shared-secret header. Returns all `games`
  rows (each including its full `raw_json`) as a JSON array. Accepts an
  optional `?since=<ISO timestamp>` query param to filter by `capturedAt`
  for incremental pulls once the dataset grows.
- No web UI. No user accounts. No TLS (LAN-only, per Global Constraints).

### SQLite schema

```sql
CREATE TABLE games (
  game_id        TEXT PRIMARY KEY,
  url            TEXT NOT NULL,
  captured_at    TEXT NOT NULL,
  submitted_by   TEXT NOT NULL,
  analysis_engine TEXT,
  book_code      TEXT,
  book_ply       INTEGER,
  caps_white_all REAL,
  caps_black_all REAL,
  effective_elo_white INTEGER,
  effective_elo_black INTEGER,
  raw_json       TEXT NOT NULL
);

CREATE TABLE positions (
  game_id        TEXT NOT NULL REFERENCES games(game_id),
  ply            INTEGER NOT NULL,
  color          TEXT,
  classification_name TEXT,
  played_move_lan TEXT,
  difference     REAL,
  caps2          REAL,
  fen            TEXT,
  best_move      TEXT,
  raw_json       TEXT NOT NULL,
  PRIMARY KEY (game_id, ply)
);
```

`raw_json` on both tables holds the full corresponding object from the
payload (whole `data` object on `games`, the individual position object on
`positions`) -- the derived columns exist purely for convenient querying
and can be regenerated from `raw_json` at any time if we decide we want more
of them later.

## Data flow

Brother plays -> chess.com serves the Game Review -> extension observes the
WebSocket traffic in-page -> captures the `analyzeGame` frame -> background
worker POSTs it to the home server -> server upserts into SQLite -> later,
whenever calibration work happens, a script on the dev machine calls
`GET /export` over the LAN to read the accumulated games. Wiring the actual
`calibrate.ts`/`sweep.ts`/`diff-engine.ts` scripts to consume many games
from this store instead of the single `game-1.json` fixture is separate,
follow-up work (see Global Constraints).

## Error handling & security

- The extension never touches or forwards chess.com's auth cookie/bearer
  token -- verified structurally impossible, since it only observes WS
  message bodies, not HTTP headers.
- The shared-secret header is the sole access control, acceptable only
  because the server is never exposed outside the LAN.
- Malformed/incomplete `POST /ingest` bodies are rejected with `400` and
  logged, never partially stored.
- Upsert-by-`game_id` makes replaying/re-reviewing the same game safe
  (overwrite, not duplicate).
- The extension's capped local retry queue absorbs temporary server
  unavailability without losing captured data.

## Testing

- **Extension**: the pure frame-parsing/validation module gets unit tests
  (valid `analyzeGame` frame recognized and fields extracted; frames with a
  different `action` ignored; malformed JSON ignored) -- no test coverage
  attempted for the untestable `WebSocket`-patching/message-relay glue,
  which is verified manually against a real chess.com game instead.
- **Server**: unit tests for the upsert logic (new game inserted correctly;
  re-submitting the same `game_id` overwrites rather than duplicates;
  malformed body rejected with `400` and nothing written); an integration
  test that POSTs a sample payload to `/ingest` then confirms it comes back
  correctly via `/export`, against a real temporary SQLite file (not
  mocked).

## Out of scope (explicitly deferred)

- Migrating the calibration scripts (`calibrate.ts`, `sweep.ts`,
  `diff-engine.ts`) to read from the SQLite store instead of the single
  `game-1.json` fixture.
- Chrome Web Store distribution/signing.
- Any internet-facing exposure of the ingest/export server, or any
  authentication beyond the shared-secret header.
- Multi-user support beyond a fixed, small set of `submitted_by` values
  configured once per extension install.
