# Value-Aware Special Classification Design

**Date:** 2026-07-20

## Problem

SecondBoard still reports zero Brilliant and zero Great moves for Robert James Fischer in the Byrne–Fischer 1956 reference game, while the checked-in Chess.com screenshots identify:

- `11...Na4`, `15...Nxc3`, and `17...Be6` as Brilliant;
- `19...Ne2+` as Great.

The Iteration 12 implementation fails for two independent reasons.

First, special-class gates reuse WDL expected scores. With the same local Stockfish settings used by the app, the mover scores immediately before the four target moves are `99`, `99.75`, `99.9`, and `100`. The Brilliant `< 97` and Great `< 99` guards therefore reject every reference move. These WDL values are useful for accuracy and ordinary move-loss classification, but they saturate too aggressively for the special-class calibration thresholds.

Second, the sacrifice model checks only whether the piece that just moved has more attackers than defenders. This happens to model `Na4` and `Nxc3`, but it cannot model `Be6`. After `17...Be6`, the bishop on `e6` has one attacker and one defender. The materially exposed asset is Fischer's queen on `b6`: White's bishop can capture the queen and Black's pawn can recapture the bishop, but Black still loses queen-for-bishop value. Counting attackers and defenders cannot represent that exchange.

## Acceptance Criteria

Production logic must remain game-independent. No move names, player names, reference-game ply numbers, or fixture-specific exceptions may appear in production classification code.

For the complete deterministic Byrne–Fischer golden fixture:

- Fischer receives exactly 3 Brilliant moves: `11...Na4`, `15...Nxc3`, and `17...Be6`.
- Fischer receives exactly 1 Great move: `19...Ne2+`.
- Byrne receives 0 Brilliant and 0 Great moves.
- No additional moves in the game receive Brilliant or Great.

The implementation should generalize to other games as well as the available local data and intentionally simplified chess model allow.

## Architecture

### Two score tracks

`classifyGame` will maintain two distinct score tracks:

1. WDL expected score remains unchanged for accuracy-compatible expected-point loss, ordinary move classes, near-best tolerance, and Miss.
2. Centipawn sigmoid score is used by Brilliant and Great calibration only.

This separation preserves the existing accuracy behavior while preventing WDL saturation from suppressing special classes.

The existing `winPercentFromEval(evalPawns)` function is the single centipawn-to-percentage conversion. No second sigmoid formula is introduced.

### Value-aware static exchange evaluation

`src/lib/game/attacks.ts` will evolve from count-only attack geometry into a pure, simplified static-exchange module.

It will expose attacker locations, not only counts. For a target square and side to capture, static exchange evaluation recursively:

1. enumerates geometrically available attackers;
2. simulates each capture on a cloned position;
3. alternates the capturing side;
4. subtracts the opponent's best continuation;
5. allows either side to stop the exchange by returning at least zero.

Because every simulated capture removes one piece, recursion terminates naturally. Recomputing attackers after every capture handles newly opened sliding-piece x-rays.

The exchange evaluator uses standard material values `P=1`, `N=3`, `B=3`, `R=5`, `Q=9`. Kings use a deliberately high internal exchange value and king targets are excluded. The module does not perform full legal-move generation, pin detection, check validation, or king-safety validation. These remain explicit limitations.

A post-move position satisfies Brilliant's sacrifice precondition when at least one mover-owned non-pawn piece worth 3 or more gives the opponent a strictly positive static-exchange gain. The scan covers every mover-owned valuable piece, not just the moved piece. This is required for moves such as `Be6`, where the move knowingly leaves a different piece materially en prise.

### Classification order and gates

The existing override order remains:

1. Brilliant
2. Great
3. Miss
4. ordinary expected-point cutoff

Brilliant requires all of the following:

- the move is Stockfish's best move or its WDL expected-point loss is at most 2 percentage points;
- the post-move position contains a mover-owned piece worth at least 3 with positive opponent SEE gain;
- the mover's centipawn-derived score after the move is at least 50;
- the mover's centipawn-derived score before the move is below 97.

Great requires all of the following:

- the played move matches Stockfish's best move;
- the mover's centipawn-derived pre-move score is below 99;
- the centipawn-derived gap between the best line and second line is at least 20 percentage points.

When second-line centipawn data is unavailable, second-line WDL remains a compatibility fallback. When both are present, centipawn data takes precedence.

Miss continues to use WDL expected scores. No Miss threshold changes are part of this correction.

## Data Flow

`loadRealAnalysis` already provides primary centipawn evaluations, primary WDL, second-line centipawn evaluations, second-line WDL, and best moves. No new engine process or Tauri command is required.

`classifyGame` will:

1. compute the existing WDL-aware score array with `winPercentForPly`;
2. compute a centipawn-only score array with `winPercentFromEval`;
3. convert both tracks to mover POV at each ply;
4. use WDL scores for expected-point loss and Miss;
5. use centipawn scores for Brilliant and Great;
6. pass the post-move position to the pure SEE-based sacrifice predicate.

Public `classifyGame` and `SpecialClassInputs` signatures remain unchanged. The correction is internal to classification and attack/material analysis.

## Deterministic Reference Fixture

A checked-in test-only fixture will freeze one complete real analysis pass for `docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`. It contains:

- all parsed positions and moves;
- primary centipawn evaluations and WDL triples;
- second-line centipawn evaluations and WDL triples;
- Stockfish best moves.

The fixture is evidence, not production configuration. Runtime code must not import it.

The golden test classifies the entire game and asserts both exact counts and exact target move indices. This prevents a change that makes the four targets pass while introducing extra Brilliant or Great labels elsewhere.

Focused Black-ply tests will also isolate the four target positions. In particular, the `Be6` test must assert that the bishop on `e6` is not itself the profitable target and that the queen on `b6` is.

## Testing

### Static exchange tests

- An undefended equal-value piece produces positive gain.
- A queen attacked by a bishop and defended by a pawn produces a gain of `+6`.
- An equal-value capture followed by an equal-value recapture produces `0`.
- Blocked rays stay blocked.
- Removing a blocker during an exchange reveals the expected x-ray attacker.
- Empty squares, wrong-color targets, and king targets return no sacrifice.
- Pawns do not satisfy the Brilliant minimum-piece-value scan.
- Evaluation never mutates the input position.

### Classifier tests

- Real Black-ply `Na4`, `Nxc3`, and `Be6` fixtures classify as Brilliant.
- Real Black-ply `Ne2+` fixture classifies as Great.
- WDL saturation does not control Brilliant/Great thresholds when centipawn data exists.
- Second-line centipawn data takes precedence over contradictory WDL data.
- WDL fallback still works when second-line centipawn data is absent.
- Brilliant continues to override Great.
- Existing Miss and ordinary-class tests remain unchanged and pass.

### Full verification

- Full Vitest suite.
- `pnpm check` with zero errors; existing unrelated warnings may remain.
- `pnpm lint`.
- `pnpm build`.
- Rust test suite, because the golden data originates at the Rust parsing/engine boundary even though the production correction is TypeScript-only.
- Manual GUI confirmation using the exact reference PGN after automated acceptance passes.

## Performance and Failure Behavior

SEE runs only during in-memory classification and does not spawn engines or perform I/O. It first filters to attacked mover-owned pieces worth at least 3, so most board pieces never enter recursive exchange analysis. Real positions have few attackers on any one square, keeping the recursion small.

Missing move metadata, missing positions, or an empty target set simply make the Brilliant sacrifice predicate false. Missing second-line centipawn data uses WDL fallback; if neither second-line representation exists, Great is false. Existing app-level analysis error handling is unchanged.

## Explicit Non-Goals

- Reproducing Chess.com's proprietary classifier exactly for every possible position.
- Full legal-move generation in TypeScript.
- Pin, check, or king-safety-aware SEE.
- Extra Stockfish searches per sacrifice candidate.
- Game-specific exceptions or label lookup tables.
- Changes to accuracy, game rating, engine strength, or ordinary-class thresholds.
