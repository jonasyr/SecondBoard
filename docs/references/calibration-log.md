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

Status: **not yet calibrated.** Used specifically to check whether the
Byrne–Fischer fix (`docs/superpowers/plans/2026-07-20-value-aware-special-classification.md`)
overfit to that one game. It did — Brilliant/Great counts and move
attribution both diverge here.

| Category   | chess.com (Kasparov / Topalov) | SecondBoard (Kasparov / Topalov) | Match? |
|------------|----------------------------------|-------------------------------------|--------|
| Brilliant  | 5 / 0                            | 6 / 1                               | ❌ 1 extra each side |
| Great      | 7 / 4                            | 4 / 6                               | ❌ under by 3 (Kasparov), over by 2 (Topalov) |
| Book       | 6 / 6                            | 0 / 0                               | ❌ same known Book gap as Game 1 |
| Best       | 15 / 20                          | 16 / 15                             | ~ |
| Excellent  | 5 / 3                            | 6 / 12                              | ❌ |
| Good       | 5 / 7                            | 7 / 4                               | ❌ |
| Inaccuracy | 1 / 0                            | 3 / 2                               | ❌ |
| Mistake    | 0 / 1                            | 1 / 2                               | ~ |
| Miss       | 0 / 0                            | 1 / 0                               | ❌ 1 extra false Miss (Kasparov) |
| Blunder    | 0 / 1                            | 0 / 1                               | ✅ exact |
| Accuracy   | 98.2 / 92.2                      | 87.6 / 83.5                         | ❌ notably lower on both sides |
| Game Rating| 3050 / 2750                      | 2359 / 1948                         | ❌ notably lower on both sides |

### Move-by-move Brilliant/Great attribution

| Move            | chess.com        | SecondBoard      | Verdict |
|-----------------|-------------------|-------------------|---------|
| 9. Qxh6         | —                 | Great             | ❌ false positive |
| 20. Ka7         | —                 | Great             | ❌ false positive |
| 21. Rhe1 & d4   | Great             | —                 | ❌ false negative (two plies) |
| 22. Nbxd5       | —                 | Brilliant         | ❌ false positive |
| 23. Qd6         | Great             | Great             | ✅ match |
| 25. Re7+        | Brilliant         | Brilliant         | ✅ match |
| 25...Kb6        | Great             | Great             | ✅ match |
| 26. Kxa5        | —                 | Great             | ❌ false positive |
| 27. b4+         | Great             | Brilliant         | ❌ over-classified |
| 27...Ka4        | —                 | Great             | ❌ false positive |
| 28. Qc3         | Brilliant         | Miss              | ❌ inverted (chess.com's Brilliant scored as our Miss) |
| 29. Ra7         | Great             | —                 | ❌ false negative |
| 29...Bb7        | Great             | —                 | ❌ false negative |
| 30. Rxb7        | Brilliant         | Brilliant         | ✅ match |
| 31. Qxf6        | —                 | Great             | ❌ false positive |
| 32. Qxa6+       | Great             | —                 | ❌ false negative |
| 33. c3+         | Great             | —                 | ❌ false negative (SecondBoard has 33. Kxc3 Great instead — different ply/side) |
| 34. Qa1+        | Great             | Great             | ✅ match |
| 35. Qb2+        | Great             | Great             | ✅ match |
| 36. Bf1         | Brilliant         | Brilliant         | ✅ match |
| 37. Rd7         | Brilliant         | Brilliant         | ✅ match |
| 38. Bxc4        | —                 | Brilliant         | ❌ false positive |

Takeaway: 8 of chess.com's 13 special-move plies match exactly (Re7+/Kb6,
Qd6, Rxb7, Qa1+, Qb2+, Bf1, Rd7). The remaining mismatches cluster around
two failure modes worth investigating in a follow-up iteration:

1. **False positives on ordinary strong moves** (9.Qxh6, 20.Ka7, 22.Nbxd5,
   26.Kxa5, 27...Ka4, 31.Qxf6, 38.Bxc4) — the current heuristic (moved-piece
   SEE exposure increased, or best-move + CP gap) appears to over-trigger
   on moves that create *some* exchange target without it being the kind of
   deep, only-good-try sacrifice chess.com credits.
2. **28.Qc3 inverted** (chess.com's Brilliant scored as our Miss) and
   **21.Rhe1/29.Ra7+Bb7/32.Qxa6+/33.c3+ missed entirely** — these look like
   genuine "only move preserves the advantage" patterns that either don't
   expose a hanging piece (so Brilliant's exchange-target gate never fires)
   or don't clear the current CP-gap thresholds tuned against Game 1.

Not yet actioned — recorded here as the baseline for the next calibration
iteration. Do not add game-specific (PGN/move-text) exceptions to
production code to force a match; any fix must generalize the same way
Task 3's `sacrificeIsCausal` gate did for Game 1.
