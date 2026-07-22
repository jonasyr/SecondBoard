# Special-class calibration log

Tracks SecondBoard's Game Review output against chess.com's real Game Review
for each reference game under `docs/references/`, so future recalibration
iterations have a stable baseline instead of re-deriving it from screenshots
each time. Screenshots referenced below live alongside each game's PGN
(`ChessComAnalysis*.png` / `SecondBoardAnalysis*.png`).

## Game 1: Byrne vs. Fischer, 1956 ("Game of the Century")

PGN: `docs/references/DonaldByrne_RJamesFischer/ReferenceGame.pgn`

Status as of commit `a72c3c4` (value-aware special classification, Task 3/4):
**Brilliant and Great counts and move attribution now match chess.com
exactly.** Fischer: 3 Brilliant (`11...Na4`, `15...Nxc3`, `17...Be6`), 1
Great (`19...Ne2+`). Byrne: 0/0. This is the golden fixture locked in by
`src/lib/game/classify.reference-game.test.ts`.

| Category   | chess.com (Byrne / Fischer) | SecondBoard (Byrne / Fischer) | Match? |
|------------|------------------------------|--------------------------------|--------|
| Brilliant  | 0 / 3                        | 0 / 3                          | ✅ exact |
| Great      | 0 / 1                        | 0 / 1                          | ✅ exact |
| Book       | 6 / 6                        | 0 / 0                          | ❌ Book/opening-book detection is not implemented yet (explicitly out of scope, see `classify.ts` header comment) — those plies fall through to Best/Excellent/etc. instead |
| Best       | 11 / 21                      | 27 / 29                        | ❌ inflated, absorbs the missing Book plies above |
| Excellent  | 8 / 6                        | 9 / 3                          | ~ minor deviation |
| Good       | 1 / 0                        | 2 / 1                          | ~ minor deviation |
| Inaccuracy | 3 / 4                        | 1 / 4                          | ~ minor deviation (Byrne side) |
| Mistake    | 4 / 0                        | 1 / 0                          | ~ minor deviation (Byrne side) |
| Miss       | 0 / 0                        | 0 / 0                          | ✅ exact |
| Blunder    | 1 / 0                        | 1 / 0                          | ✅ exact |
| Accuracy   | 81.3 / 95.5                  | 82.8 / 94.4                    | ~ close |
| Game Rating| 2150 / 3000                  | 1880 / 3039                    | ~ known separate metric, not yet chess.com-calibrated |

Takeaway: remaining deviations here are fully explained by the missing Book
class (a later iteration per the blueprint's own scope notes) reallocating
those plies into the ordinary EP-cutoff bands, which cascades into Best's
inflated count on both sides. No further Brilliant/Great work needed on
this game.

## Game 2: Kasparov vs. Topalov, Wijk aan Zee 1999

PGN: `docs/references/Kasparov/Game.pgn`

Used specifically to check whether the Byrne–Fischer fix
(`docs/superpowers/plans/2026-07-20-value-aware-special-classification.md`)
overfit to that one game. It did. The first pass below (`SecondBoard (live
GUI, pre-fix)`) is from a real `pnpm exec tauri dev` session, screenshotted
by the user; it necessarily reflects one particular ~1-second-per-move
Stockfish run and can differ slightly move-to-move from any other run of
the same engine settings (search is time-bounded, not depth-bounded, so it
is not perfectly deterministic). To get a *reproducible* basis for
calibration, a frozen fixture was captured the same way as Game 1's
(`src/lib/game/fixtures/kasparov-topalov-analysis.json`, one deterministic
Stockfish pass recorded once) and is what `SecondBoard (frozen fixture,
post-fix)` below and `classify.kasparov-topalov.test.ts` are checked
against.

Status: **partially calibrated.** Applied one targeted, non-game-specific
fix this session (see `classify.ts`'s `sacrificeIsCausal` comment):
`BRILLIANT_CAUSAL_GAP` raised `20` -> `25`, and the SEE-based causal-sacrifice
check now requires the exposure increase to be at least
`BRILLIANT_MIN_SACRIFICE_VALUE` (a minor piece, `3`) rather than any nonzero
delta. This does not chase full parity — see "Remaining known gaps" below.

### Move-by-move Brilliant/Great attribution (frozen fixture, post-fix)

| Move            | chess.com | SecondBoard (frozen fixture, post-fix) | Verdict |
|-----------------|-----------|------------------------------------------|---------|
| 9. Qxh6         | —         | Great                                     | ❌ false positive |
| 20...Ka7        | —         | Great                                     | ❌ false positive |
| 21. Rhe1        | Great     | —                                          | ❌ false negative |
| 21...d4         | Great     | —                                          | ❌ false negative |
| 22...Nbxd5      | —         | —                                          | ✅ fixed this session (was false-positive Brilliant) |
| 23...Qd6        | Great     | Great                                      | ✅ match |
| 25. Re7+        | Brilliant | Brilliant                                  | ✅ match |
| 25...Kb6        | Great     | Great                                      | ✅ match |
| 26. Qxd4+       | —         | Brilliant                                  | ❌ false positive |
| 26...Kxa5       | —         | —                                          | (matches: no label either side) |
| 27. b4+         | Great     | —                                          | ✅ fixed this session (was false-positive Brilliant; still not the correct Great, see gaps) |
| 27...Ka4        | —         | Great                                      | ❌ false positive |
| 28. Qc3         | Brilliant | Miss                                       | ❌ inverted |
| 29. Ra7         | Great     | —                                          | ❌ false negative |
| 29...Bb7        | Great     | —                                          | ❌ false negative |
| 30. Rxb7        | Brilliant | Brilliant                                  | ✅ match |
| 31. Qxf6        | —         | Great                                      | ❌ false positive |
| 32. Qxa6+       | Great     | —                                          | ❌ false negative |
| 33. c3+         | Great     | —                                          | ❌ false negative |
| 33...Kxc3       | —         | Great                                      | ❌ false positive |
| 34. Qa1+        | Great     | Great                                      | ✅ match |
| 35. Qb2+        | Great     | Great                                      | ✅ match |
| 35...Kd1        | —         | Great                                      | ❌ false positive |
| 36. Bf1         | Brilliant | Brilliant                                  | ✅ match |
| 37. Rd7         | Brilliant | Brilliant                                  | ✅ match |
| 38. Bxc4        | —         | Brilliant                                  | ❌ false positive |

Before/after this session's fix: Brilliant false positives dropped from 4 to
2 (22...Nbxd5 and 27.b4+ no longer misfire); Great is unchanged (the false
positive/negative set for Great does not respond to the fixes applied here
— see below). 8 of chess.com's 16 special-move plies now match exactly
(Re7+, Kb6, Qd6, Rxb7, Qa1+, Qb2+, Bf1, Rd7).

### Remaining known gaps (not actioned — documented heuristic limits)

1. **Brilliant false positives (26.Qxd4+, 38.Bxc4)**: both qualify only
   through the CP-gap fallback (`playedIsBest` + a large best-vs-second gap),
   not through genuine SEE exposure. Their gaps (29.3 and 61.8 points) sit on
   both sides of Game 1's real Be6 brilliancy (28.1 points) — no single
   threshold separates them without either breaking the Fischer golden
   fixture or leaving these two uncaught. This is a hard ceiling of a
   CP-gap-only signal, not a tuning oversight: distinguishing "a declined
   sacrifice" from "a crushing move in an already-overwhelming position"
   needs information (e.g. genuine move-tree/motif detection) this heuristic
   doesn't have.
2. **Great's false positive/negative rate is high and does not correlate
   well with the CP gap at all**: several of chess.com's real Great moves in
   this game have a *near-zero* best-vs-second CP gap (e.g. 27.b4+ at 0.09,
   32.Qxa6+ at 5.6, 21.Rhe1 at 5.9) while several false positives have large
   gaps (e.g. 9.Qxh6 at 41.2). Raising or lowering `GREAT_ONLY_MOVE_GAP`
   cannot fix this — the signal itself is weak for this game. Chess.com's
   real "only good move" detection evidently isn't reducible to a two-line
   (MultiPV=2) CP-gap comparison; closing this gap would need a materially
   different signal (e.g. comparing against more than one alternative, or a
   dedicated forced-sequence/motif detector), which is out of scope here.
3. **28.Qc3 inverted** (chess.com's Brilliant scored as our Miss) and the
   **Book gap** (6/6 on chess.com vs. 0/0 here, same as Game 1) remain
   unactioned for the same reasons as Game 1.

Do not add game-specific (PGN/move-text) exceptions to production code to
force a match on this or any other game — any further fix must generalize
the way this session's `sacrificeIsCausal`/`BRILLIANT_CAUSAL_GAP` change
did (verified to hold the Fischer golden fixture exactly, see
`classify.reference-game.test.ts`, while measurably improving this game;
regression-locked for this game in `classify.kasparov-topalov.test.ts`).

## Phase Rating divergence: Byrne vs. Fischer Endgame

Real chess.com behavior for this game's Endgame phase (both sides): the
icon area shows a dash, with tooltip "This phase of the game could not be
graded due to a lack of relevant moves." SecondBoard's real, lichess-`Divider`-based
detection finds a genuine, substantial endgame here instead: `majorsAndMinors`
plateaus at exactly 6 (never below) from ply 59 through mate at ply 82 — 24
plies (12 moves per side), not a tiny/degenerate sample. Both sides then
score `best`/100 for that phase.

Investigated (2026-07-21) whether this is a "too few moves" issue our own
implementation should guard against generically — it is not. lichess's own
source (`AccuracyPercent.scala`, `phaseAccuracies`, fetched this session)
has no minimum-move-count gate either; it grades a phase as soon as its
move slice is non-empty. The most likely explanation is that chess.com's
own (undisclosed) endgame material threshold is stricter than lichess's
`<=6` — this game's material never drops below 6, so if chess.com's real
cutoff sits lower (e.g. requiring a true bare-bones king+pawn-ish endgame),
their endgame would never trigger for this specific game at all, producing
exactly this "insufficient/no relevant moves" state. This cannot be
confirmed without more chess.com reference games showing where their real
threshold sits, and per this log's own standing rule, no unverified number
was guessed to force a match. Recorded here as a known, honest gap — same
category as the Book gap above, not an implementation defect.

Also confirmed (same investigation): lichess's `phaseAccuracies` differs
from SecondBoard's `getPhaseRows` composition in one confirmed way — each
phase's accuracy is computed from a synthetic dead-even (`Cp.initial`)
"before" baseline rather than the real eval carried over from the previous
phase's boundary. `getPhaseRows`'s doc comment documents this precisely and
explains why it was NOT ported (reproducing it exactly would require
confirming lichess's internal `Info.ply`/mover-color bucketing semantics at
a phase boundary, which could not be verified from the fetched source
without risking a subtly wrong reimplementation). `getPhaseRows` keeps the
simpler, already-verified real-eval-carried-forward composition instead,
documented as SecondBoard's own choice, not a lichess port.

Separately, `getPhaseRows` now also applies a Brilliant/Great badge
override (any Brilliant move by a side in a phase forces that phase's
badge to `brilliant`, regardless of computed accuracy; Great does the same
at lower priority) — this measurably improves the Middlegame row for this
exact game: Fischer's two Middlegame brilliancies (`11...Na4`, `15...Nxc3`)
now correctly show a `brilliant` badge instead of the accuracy-tier badge
alone. This override is SecondBoard's own design choice (built from data
this codebase already computes via `classifyGame`), not a confirmed
chess.com or lichess port.
