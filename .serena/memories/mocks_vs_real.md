# Mock vs. real data status (check before touching any "player/game stats" UI)

Real (from Rust backend, no mock involved):
- Board positions, SAN move list, last-move `{from,to}` — `pgn.rs` `parse_pgn` via shakmaty.
- Eval-per-ply (white-POV, pawns) and the prospective best-move arrow — `engine-analysis.ts` `loadRealAnalysis()` calling Stockfish `analyze_fen` once per position, fed into `appState.evalPerPly`/`appState.bestMoves` after PGN load (`analysisStatus`: idle→loading→ready/error).
- Player names/ratings — `White`/`Black`/`WhiteElo`/`BlackElo` PGN tags, parsed in `pgn.rs`, threaded through `GameData.whiteName` etc., falling back to mock `PLAYERS` only if a tag is absent/`"?"`.

Still mock (`src/lib/game/mock-data.ts`), gated by `game.isSample` per `mem:conventions`'s isSample-gate rule — do NOT wire these to non-sample games without also implementing the real computation, per LOGIC.md/OVERVIEW's explicit scope notes:
- Move classification (`CLASS_CODES`, brilliant/great/best/.../blunder) — full spec in `design_handoff_secondboard/SecondBoard_PROJECT_OVERVIEW.md` §11 (centipawn-loss phase 1, expected-points phase 2, Book/Miss/Great/Brilliant heuristics, reason codes). NOT implemented.
- Coach text per classification (`COACH_TEXT_MAP`).
- Retrospective "best move" annotations tied to a classification (`BEST_MOVES` record used by `getReviewPly`'s `best` field — distinct from the always-real `nextBest` prospective arrow).
- Breakdown table (brilliant/great/best/… counts per side), Phase table (opening/middlegame/endgame per-side badges).
- Player accuracy % and "Game Rating" (est. performance) shown in `AccuracyBlock.svelte` — formula spec in OVERVIEW §12 (win% sigmoid + expected-points-loss based, NOT simple avg-centipawn-loss). As of the pre-fix state, `AccuracyBlock.svelte` imports mock `PLAYERS.white/black.accuracy` directly and hardcodes the `0–1` result text/winner-tinted avatar — none of it reflects the loaded game's real result or engine output.
- PGN `Result` tag (`1-0`/`0-1`/`1/2-1/2`) is NOT currently extracted by `pgn.rs`/`ParsedGame`/`GameData` at all — needed to know the actual winner.
