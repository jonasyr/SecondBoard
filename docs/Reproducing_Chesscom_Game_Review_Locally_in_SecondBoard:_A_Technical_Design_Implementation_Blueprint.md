# Reproducing Chess.com Game Review Locally in SecondBoard: A Technical Design & Implementation Blueprint

> **Important scoping note on the repository:** The task requires inspecting the SecondBoard repo at `github.com/jonasyr/SecondBoard` before proposing architecture. I made repeated, good-faith attempts (direct fetch, GitHub REST API, raw.githubusercontent, and a dedicated inspection subagent). **The repository did not surface in any web search and every direct fetch was blocked** — it is most plausibly private, brand-new, or unindexed. The owner `jonasyr` is a verified GitHub user (Mainz, Germany) whose other public work (e.g. "gitray") is a TypeScript/React/Express pnpm monorepo, but the task explicitly describes a *native, multi-OS* app, which usually implies Rust+Tauri, C++/Qt, or .NET. **This report is therefore written stack-adaptively:** all math and decision logic are language-neutral, and the reference implementation is given in Rust (the strongest fit for "native, cross-platform, bundles Stockfish"), with explicit porting guidance. Confirm the actual stack from the repo's manifest before merging.

## TL;DR
- **Chess.com's Game Review is reproducible in spirit but not bit-for-bit.** Its move classifier is a *published* "Expected Points" model with exact win-probability-loss cutoffs (Best 0.00, Excellent ≤0.02, Good ≤0.05, Inaccuracy ≤0.10, Mistake ≤0.20, Blunder >0.20), but its accuracy score (CAPS2), rating-adaptive thresholds, Brilliant/Great/Miss heuristics, and game-rating estimator are proprietary and only approximable via the fully-open Lichess win%/accuracy formulas plus black-box calibration.
- **The strongest local design** uses Stockfish (bundled, UCI subprocess) with MultiPV≥2 and `UCI_ShowWDL`, converts evaluations to win probability with the Lichess logistic (or, better, uses WDL expected score), grades each move by win-probability lost, and aggregates with Lichess's volatility-weighted+harmonic hybrid (or a tunable power mean). An independent team, Backrank, reports this class of approach "agreed within 3 points three quarters of the time, with no systematic bias" against Chess.com.
- **Deliver in stages:** ship the deterministic core (exact EP cutoffs + Lichess accuracy) first — it needs no proprietary secrets — then add engine transport, then the fuzzy special classes, then the (lowest-fidelity) game-rating estimate.

## Key Findings

1. **Move classification is the best-documented piece and directly implementable.** Chess.com's official help page (last updated February 9, 2026) publishes "Classification V2 / the Expected Points Model" and an exact cutoff table in expected-points lost.
2. **Accuracy (CAPS2) is proprietary but closely approximable.** Chess.com states each move is graded best→blunder, "mostly averaged," with mate-distance smoothing and multi-blunder dampening, at rating-dependent engine depth. Lichess's fully-open formulas reproduce the behavior and feel.
3. **Brilliant = sound piece sacrifice** (not losing after it, not already completely winning without it, more lenient for lower-rated players); **Great = only-good-move or result-swinging move**; **Miss = failed to punish opponent's error**. These use rules beyond expected points and are the least deterministic to reproduce.
4. **WDL modeling is the more human-stable path** than raw centipawns, and is closest to Chess.com's own "expected points" primitive.
5. **Engine version and depth materially change results;** Stockfish's centipawn scale has drifted across releases, so reproducibility demands pinning version, depth, and normalization.
6. **Game-rating / "game Elo" is rating-anchored and unstable per game** — meaningful only over many games.

## Details

### 1. Executive summary: known vs. inferred vs. irreproducible

**Publicly known (high confidence):**
- The Expected Points move-classification cutoff table (verbatim from Chess.com support, dated Feb 9 2026).
- That accuracy is "CAPS2," is largely an average of per-move grades, applies mate-distance scoring and multi-blunder dampening, and uses rating-dependent engine depth (Chess.com support pages plus Chess.com's own statements published by saychess/Substack).
- That Brilliant = good piece sacrifice with side conditions; Great = swing/only-move; Miss = missed punish (Chess.com support).
- Lichess's exact, open-source win% and accuracy formulas and aggregation (Lichess accuracy page + lila source).
- Stockfish's UCI options, WDL output format, and centipawn-normalization semantics (official Stockfish docs/repo).

**Inferred / approximable (medium confidence):**
- Exact numeric thresholds for Brilliant/Great/Miss and how they scale with rating (Chess.com only says "more generous for newer players").
- The precise averaging/weighting inside CAPS2 (power-mean exponent, blunder-dampening curve).
- The game-rating regression (public linear/polynomial fits exist but are unofficial).

**Cannot be reproduced exactly (stated explicitly):**
- CAPS2's exact constants, Chess.com's private per-rating depth schedule, and its proprietary "patterns of strength" sequencing. Any claim of bit-exact equivalence would be false; the honest goal is a calibrated approximation with published error bars.

### 2. Evidence table

| # | Claimed Chess.com behavior | Source (type) | Confidence | Status | Implementation consequence |
|---|---|---|---|---|---|
| 1 | Expected Points model; cutoffs in EP lost — Chess.com's verbatim table: "Best 0.00 0.00; Excellent 0.00 0.02; Good 0.02 0.05; Inaccuracy 0.05 0.10; Mistake 0.10 0.20; Blunder 0.20 1.00" | Chess.com support (primary, official) | High | Current (Feb 9 2026) | Implement directly as a threshold table over EP loss |
| 2 | "1.00 is always winning, 0.00 is always losing, and 0.50 is even"; EP depends on rating + eval | Chess.com support (primary) | High | Current | Need a rating-anchored eval→win-probability map |
| 3 | Accuracy = CAPS2; moves graded best→blunder then "mostly averaged"; mate-distance scoring; multi-blunder dampening | Chess.com support + Chess.com reply to saychess | Medium-High | Current | Aggregate with dampened mean; special-case mate scores |
| 4 | Analysis depth varies by player rating/settings | Chess.com support + saychess | Medium | Current | Offer depth profiles; accept results are depth-sensitive |
| 5 | Brilliant = good piece sacrifice; not bad after; not already completely winning; more generous for low-rated | Chess.com support (primary) | High (definition), Low (thresholds) | Current | Sacrifice detector + eval guards; rating-scaled leniency |
| 6 | Great = swing-defining or only-good-move | Chess.com support (primary) | High (definition), Low (thresholds) | Current | Detect only-move via MultiPV gap; detect win%-band crossing |
| 7 | Miss = failed to capitalize on opponent's mistake | Chess.com support (primary) | High (definition), Low (thresholds) | Current | Rating-scaled winning/equal/losing bands |
| 8 | Book moves scored as "best" | Chess.com reply to saychess (secondary) | Medium | Current | Opening-book/ECO detection → force Best/Book |
| 9 | Older CAPS created 0–100 human band; CAPS2 makes most scores fall 50–95 | Chess.com support (primary) | High | Current (CAPS2) | Calibrate output distribution, not just raw formula |
| 10 | `Win% = 50 + 50·(2/(1+exp(−0.00368208·cp))−1)` | Lichess accuracy page + lila source (primary, open) | High | Current | Centipawn→win% conversion |
| 11 | Lichess move accuracy (exact lila constants, AccuracyPercent.scala): `103.1668100711649 * exp(-0.04354415386753951 * winDiff) - 3.166924740191411` (`+1` uncertainty bonus applied) | Lichess accuracy page + lila source (primary, open) | High | Current | Per-move accuracy |
| 12 | Game accuracy: "Take the average of the volatility weighted mean and the harmonic mean" of move accuracies over sliding windows | Lichess accuracy page (verbatim) + jk_182 blog | High | Current | Aggregation model |
| 13 | Independent reimplementation (Backrank): "across hundreds of games it agreed within 3 points three quarters of the time, with no systematic bias," validated on games from Hikaru Nakamura, GothamChess, Daniel Naroditsky, using a power mean | Backrank engineering blog, June 18 2026 (secondary) | Medium | Current | Power-mean aggregation is a validated approximation |
| 14 | "an advantage of '100 centipawns' means the engine has a 50% probability to win from this position in selfplay at fishtest LTC time control"; NNUE decoupled from material | Stockfish FAQ / WDL_model repo (primary) | High | Current | Pin version; WDL preferred over raw cp |
| 15 | NormalizeToPawnValue drift: "initially 348, shortly after 361, and now 394"; SF16.1 fit used `--NormalizeToPawnValue 356` at move-32 anchor; pre-norm eval for 50% win drifted 113cp (2020) → 167cp (July 2022) | Stockfish Discussion #4754 + WDL_model + commit (primary) | High | Historical/version-dependent | Pin engine + normalization for reproducibility |
| 16 | `UCI_ShowWDL` emits per-mille win/draw/loss summing to 1000 (e.g. `info ... wdl 500 400 100`) | Stockfish source src/uci.h + docs (primary) | High | Current | Parse WDL for expected-score model |
| 17 | Game rating depends on player's rating and move quality; unstable per game | Chess.com support + forum tests | Medium | Current | Rating estimate must take player rating as input |
| 18 | ~1 accuracy point ≈ ~100 rapid Elo; "(accuracy − 64) × 100" heuristic above 80% | Chess.com blog (hissha) (secondary) | Low-Medium | Current | Starting point for rating regression |

### 3. Mathematical model

**3.1 Centipawn → Win% (Lichess logistic).**
`WinPct(cp) = 50 + 50·(2/(1 + exp(−0.00368208·cp)) − 1)`, with cp clamped to ±1000.
Worked: cp=0 → 50.0%. cp=+100 → ≈59.1%. cp=+300 → ≈77%. cp=+1000 → ≈97.6%. The S-shape means a swing near 0.00 changes win% far more than the same swing at ±6 — the reason win% beats raw centipawns for grading.

**3.2 WDL → expected score (preferred primitive).**
With `wdl = (w,d,l)` per-mille from the side-to-move POV, `ExpScore = (w + 0.5·d)/1000 ∈ [0,1]`. This is the direct analog of Chess.com's "expected points" and is engine-version-stable (unlike centipawns, whose scale drifts — evidence row 15). Prefer this when `UCI_ShowWDL` is available.

**3.3 Mate handling.** Map `+mate → WinPct=100 / ExpScore=1.0`, `−mate → 0`. Preserve mate-distance ordering (mate-in-2 ranks above mate-in-5) to mirror Chess.com's stated "mate-distance scoring," which prevents a faster mate being flagged as a mistake versus a slower one.

**3.4 Per-move accuracy (Lichess exact constants).**
`Acc = 103.1668100711649·exp(−0.04354415386753951·(WinBefore − WinAfter)) − 3.166924740191411`, clamped to [0,100], with `(WinBefore − WinAfter) ≥ 0` from the mover's POV (lila applies a `+1` uncertainty bonus for imperfect analysis).
Worked: Δ=0 → ~100. Δ=2 → ≈91.4. Δ=9 → ≈66.6. Δ=20 → ≈40.1. Δ=40 → ≈14.9.

**3.5 Game accuracy — three candidate aggregators.**
- **(a) Lichess hybrid (recommended default, matches Chess.com feel):** divide the game into sliding windows; compute each window's volatility as the standard deviation of win%; take the average of the volatility-weighted mean and the harmonic mean of the per-move accuracies. This is Lichess's published method verbatim; it up-weights sharp phases and lets one blunder hurt appropriately.
- **(b) Power mean (Backrank-style, simplest well-calibrated):** `M_p = (mean(acc_i^p))^(1/p)`, dial `p` between arithmetic (p=1) and harmonic (p=−1), plus a per-move floor so one catastrophe cannot zero the game. Backrank reports this lands within 3 points of Chess.com three-quarters of the time with no systematic bias.
- **(c) Dampened arithmetic mean (closest to Chess.com's own words):** arithmetic mean with each *additional consecutive* blunder's penalty scaled down by a decay factor — matching Chess.com's stated "reducing the penalty for multiple blunders."

Recommendation: ship (a) as default (open, exact-to-Lichess, close-to-Chess.com), expose `p` from (b) as a tuning knob.

**3.6 Expected-points move classification (Chess.com V2 replica).** Grade by `EPloss = ExpScore_best − ExpScore_played` (both mover POV; best from MultiPV line 1) and apply the verbatim cutoff table (§2 row 1). Because Chess.com anchors EP to rating, optionally steepen the win-probability logistic for higher-rated players — the inferred mechanism behind rating-varying thresholds.

**3.7 Game-rating estimate.** Two stages: (i) baseline from accuracy — either the linear heuristic `R̂ = (Acc − 64)·100` (reasonable above ~80%) or a cubic `R̂ = 2.05 + 12.9·Acc − 0.256·Acc² + 0.00401·Acc³` (better low-end behavior, avoids negative ratings); (ii) blend toward the player's entered rating and adjust for the opponent gap, since Chess.com's estimate is demonstrably rating-anchored. Always label it "estimated, high-variance per game."

### 4. Classification specification (ordered decision tree + threshold table)

Evaluate in order; first match wins:
1. **Book** — move in opening book (Polyglot) or ECO tabiya → `Book` (scored as Best for accuracy).
2. **Forced/Only** — one legal move (or one move within a tiny MultiPV window) → `Forced` (no penalty) or route to Great check.
3. **Best** — played == engine PV move / EPloss==0 → candidate for Brilliant/Great upgrade.
4. **Brilliant (!!)** — best/near-best AND a *sound piece sacrifice* (net material given up per SEE / material delta over the continuation) AND ExpScore stays ≥ ~0.5 (not losing after) AND you were NOT already completely winning without it (best-alt win% < ~0.97) AND not a trivial recapture. "Piece" leniency scales down with rating.
5. **Great (!)** — best/near-best AND either the *only* move preserving the result (large MultiPV win% gap to the 2nd line) OR it crosses a decisive band (losing→equal or equal→winning).
6. **Miss** — opponent just erred handing you a winning/equal chance and your move fails to take it (drop from winning-band to equal/worse), even at moderate EPloss.
7. Otherwise apply the **Expected-Points cutoffs** (Best/Excellent/Good/Inaccuracy/Mistake/Blunder).

Overrides: Brilliant > Great > Best; Miss overrides Inaccuracy/Mistake/Blunder when the missed-win condition holds; Book overrides all.

| Label | Condition (EP loss unless noted) | Source of value |
|---|---|---|
| Best | 0.00 | Chess.com (exact) |
| Excellent | (0.00, 0.02] | Chess.com (exact) |
| Good | (0.02, 0.05] | Chess.com (exact) |
| Inaccuracy | (0.05, 0.10] | Chess.com (exact) |
| Mistake | (0.10, 0.20] | Chess.com (exact) |
| Blunder | (0.20, 1.00] | Chess.com (exact) |
| Brilliant | best/near-best + sacrifice + ExpScore≥~0.5 + best-alt <~0.97 | Definition Chess.com; numeric guards inferred |
| Great | only-move (MultiPV win% gap ≥ ~10) or decisive band cross | Definition Chess.com; numbers inferred |
| Miss | winning-band before → equal/worse after | Definition Chess.com; bands inferred |

**Three variants:** (a) *Chess.com-like* = tree above with rating-scaled bands; (b) *Simple deterministic* = pure EP-cutoff table + "sacrifice+best ⇒ Brilliant," no rating scaling; (c) *Configurable* = every constant in a `ClassificationConfig` with per-user overrides. Historical note: Chess.com previously used a depth-sensitivity definition of Brilliant ("sharp score increase as depth increases"); the current definition is the sacrifice-based one above.

### 5. Stockfish analysis specification

- **Version:** pin one release (Stockfish 17.x recommended as of mid-2026) and record it in output; never mix versions within a game.
- **UCI options:** `Threads` = min(cores−1, profile cap); `Hash` 128–1024 MB by profile; `MultiPV` = 2 (Standard) or 3 (Deep) to capture the best-vs-second gap for Great/only-move; `UCI_ShowWDL = true`; `SyzygyPath` if tablebases installed; `Ponder = false`; full strength (no `UCI_LimitStrength`).
- **Determinism:** `Threads=1` gives the most reproducible node counts; multi-thread is acceptable if depth-limited and version-pinned (document the minor nondeterminism it introduces).
- **Profiles:**
  - **Fast:** depth 12, MultiPV 1–2, Hash 128MB — sub-second/move.
  - **Standard:** depth 16–18, MultiPV 2, Hash 256MB — Chess.com-comparable.
  - **Deep:** depth 22+, MultiPV 3, Hash 512–1024MB — thorough.
- **Mate scores:** parse `score mate N`; map to ±(large base − |N|) internally and to win%=100/0 for classification.
- **WDL:** parse `wdl w d l` (per-mille, side-to-move POV) → ExpScore.
- **PV storage:** keep top-N PV first moves + evals per position for Great/Brilliant logic and UI arrows.
- **Caching:** key by FEN/Zobrist + engine version + depth + MultiPV; persist to SQLite to avoid re-analysis.
- **Syzygy/book:** probe TBs in ≤7-man endgames (treat as ground truth); Polyglot book for Book detection.
- **Cancellation/progress:** run on a background task; emit positions-done/total; cancel by cleanly terminating/queuing the engine process.
- **Hardware-adaptive:** detect cores/RAM at startup and pick a profile default.

### 6. SecondBoard architecture assessment
Because the repo was not inspectable (see top note), the assessment is conditional. The domain model in §8 is language-neutral; the reference code is Rust (best fit for a native, Stockfish-bundling, cross-platform app such as a Tauri project). **Adaptation rule:** (1) read the manifest (`Cargo.toml`/`package.json`/`.csproj`/`CMakeLists.txt`) to fix the language and build system; (2) locate existing engine-communication, PGN, and board-representation modules and reuse them; (3) place scoring/classification as a *pure, dependency-light* module fully isolated from the engine transport; (4) match the repo's existing naming and lint conventions. If the stack is TypeScript/Electron, the pure arithmetic ports verbatim; if C++/Qt or C#/.NET, translate the same interfaces.

### 7. Implementation plan (files, modules, interfaces, milestones)
Assuming Rust+Tauri (adapt paths otherwise), add under `src-tauri/src/analysis/`:
- `engine/mod.rs` — UCI process mgmt, spawn/kill, option config, async analyse, WDL/mate parsing, cancellation.
- `engine/uci.rs` — line parser (info/score/wdl/pv/bestmove).
- `model.rs` — domain types (§8).
- `winprob.rs` — cp→win%, WDL→ExpScore, mate mapping.
- `accuracy.rs` — per-move accuracy + game aggregation.
- `classify.rs` — ordered decision tree + sacrifice/only-move detection.
- `rating.rs` — game-rating estimate.
- `config.rs` — `EngineProfile`, `ClassificationConfig`, thresholds.
- `cache.rs` — SQLite cache keyed by FEN+version+depth+MultiPV.
- `pipeline.rs` — orchestrates PGN → per-position analysis → per-move classify → game accuracy → result; progress + cancellation.
- `tests/` — unit + golden fixtures.

**Interfaces** isolate concerns: `trait Engine { async fn analyse(&mut self, fen, limit, multipv) -> Vec<LineEval> }` (transport) is separate from `fn classify(ctx, cfg) -> Classification` (pure) and `fn game_accuracy(&[f64]) -> f64` (pure), so scoring is testable with fixture evals and no engine.

**Milestones:** M1 engine transport + WDL/mate parsing + tests; M2 pure win%/accuracy module + golden tests; M3 EP classifier (6 classes) + tests; M4 special classes (Brilliant/Great/Miss/Book/Forced); M5 pipeline + caching + cancellation + progress; M6 rating estimate + calibration harness; M7 validation vs. collected Chess.com data.

### 8. Code (core scoring + classification + tests, Rust reference)

```rust
// model.rs — strong types
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Centipawns(pub i32);
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct MateIn(pub i32);   // signed: + mover mates, - mover mated
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct WinProb(pub f64);  // 0..=100, mover POV
#[derive(Clone, Copy, Debug, PartialEq)]
pub struct ExpScore(pub f64); // 0..=1,  mover POV

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Eval { Cp(Centipawns), Mate(MateIn) }

#[derive(Clone, Debug)]
pub struct LineEval { pub eval: Eval, pub wdl: Option<(u32,u32,u32)>, pub pv: Vec<String> }

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Classification {
    Book, Brilliant, Great, Best, Excellent, Good,
    Inaccuracy, Miss, Mistake, Blunder, Forced,
}
```

```rust
// winprob.rs — conversions (pure, deterministic)
use crate::model::*;

pub const LICHESS_K: f64 = -0.00368208;
pub const MATE_WIN: f64 = 100.0;

pub fn cp_to_winprob(cp: i32) -> WinProb {
    let c = cp.clamp(-1000, 1000) as f64;
    WinProb(50.0 + 50.0 * (2.0 / (1.0 + (LICHESS_K * c).exp()) - 1.0))
}

pub fn eval_to_winprob(e: Eval) -> WinProb {
    match e {
        Eval::Cp(Centipawns(cp)) => cp_to_winprob(cp),
        Eval::Mate(MateIn(n))    => WinProb(if n >= 0 { MATE_WIN } else { 0.0 }),
    }
}

/// Prefer WDL expected score when available; else derive from win%.
pub fn expected_score(line: &LineEval) -> ExpScore {
    if let Some((w, d, _l)) = line.wdl {
        ExpScore((w as f64 + 0.5 * d as f64) / 1000.0)
    } else {
        ExpScore(eval_to_winprob(line.eval).0 / 100.0)
    }
}
```

```rust
// accuracy.rs — per-move + game aggregation (pure)
use crate::model::WinProb;

// Exact Lichess constants (lila AccuracyPercent.scala).
pub fn move_accuracy(win_before: WinProb, win_after: WinProb) -> f64 {
    let drop = (win_before.0 - win_after.0).max(0.0);
    (103.1668100711649 * (-0.04354415386753951 * drop).exp() - 3.166924740191411)
        .clamp(0.0, 100.0)
}

fn harmonic_mean(xs: &[f64]) -> f64 {
    let n = xs.len() as f64;
    let s: f64 = xs.iter().map(|x| 1.0 / x.max(1e-3)).sum();
    n / s
}

fn stdev(xs: &[f64]) -> f64 {
    if xs.len() < 2 { return 0.0; }
    let m = xs.iter().sum::<f64>() / xs.len() as f64;
    (xs.iter().map(|x| (x - m).powi(2)).sum::<f64>() / xs.len() as f64).sqrt()
}

/// Lichess-style hybrid: mean(volatility-weighted mean, harmonic mean).
pub fn game_accuracy(move_accs: &[f64], win_series_pov: &[f64], window: usize) -> f64 {
    if move_accs.is_empty() { return 100.0; }
    let mut weights = Vec::with_capacity(move_accs.len());
    for i in 0..move_accs.len() {
        let lo = i.saturating_sub(window / 2);
        let hi = (i + window / 2 + 1).min(win_series_pov.len());
        let w = stdev(&win_series_pov[lo..hi]).max(0.5); // floor avoids zero weight
        weights.push(w);
    }
    let wsum: f64 = weights.iter().sum();
    let weighted = move_accs.iter().zip(&weights).map(|(a, w)| a * w).sum::<f64>() / wsum;
    let harmonic = harmonic_mean(move_accs);
    (weighted + harmonic) / 2.0
}

/// Backrank-style power mean with per-move floor (tunable p, e.g. -0.5..-1).
pub fn game_accuracy_power(move_accs: &[f64], p: f64, floor: f64) -> f64 {
    if move_accs.is_empty() { return 100.0; }
    let n = move_accs.len() as f64;
    let s: f64 = move_accs.iter().map(|a| a.max(floor).powf(p)).sum();
    (s / n).powf(1.0 / p)
}
```

```rust
// classify.rs — ordered decision tree (pure)
use crate::model::*;
use crate::winprob::{eval_to_winprob, expected_score};

pub struct ClassificationConfig {
    pub excellent: f64, pub good: f64, pub inaccuracy: f64,
    pub mistake: f64, pub blunder: f64,
    pub brilliant_min_win: f64,     // win% must stay >= this (mover POV)
    pub brilliant_not_winning: f64, // best-alt win% must be below this
    pub great_onlymove_gap: f64,    // win% gap best vs 2nd line
    pub miss_win_before: f64, pub miss_win_after: f64,
}
impl Default for ClassificationConfig {
    fn default() -> Self {
        Self { excellent: 0.02, good: 0.05, inaccuracy: 0.10,
               mistake: 0.20, blunder: 1.00,
               brilliant_min_win: 50.0, brilliant_not_winning: 97.0,
               great_onlymove_gap: 10.0,
               miss_win_before: 80.0, miss_win_after: 55.0 }
    }
}

pub struct MoveContext<'a> {
    pub is_book: bool,
    pub legal_move_count: usize,
    pub played_is_best: bool,
    pub is_piece_sacrifice: bool,   // from SEE/material analysis of the played line
    pub best_line: &'a LineEval,    // best line AFTER-position, mover POV
    pub second_line: Option<&'a LineEval>,
    pub before_best: &'a LineEval,  // best line in the PRE-move position, mover POV
    pub played_line: &'a LineEval,  // eval AFTER the played move, mover POV
}

pub fn classify(ctx: &MoveContext, cfg: &ClassificationConfig) -> Classification {
    if ctx.is_book { return Classification::Book; }
    if ctx.legal_move_count == 1 { return Classification::Forced; }

    let ep_loss  = (expected_score(ctx.before_best).0 - expected_score(ctx.played_line).0).max(0.0);
    let win_after    = eval_to_winprob(ctx.played_line.eval).0;
    let win_best_alt = eval_to_winprob(ctx.best_line.eval).0;
    let win_before   = eval_to_winprob(ctx.before_best.eval).0;

    // Brilliant: best/near-best sound sacrifice, not losing, not already crushing.
    if (ctx.played_is_best || ep_loss <= cfg.excellent)
        && ctx.is_piece_sacrifice
        && win_after >= cfg.brilliant_min_win
        && win_best_alt < cfg.brilliant_not_winning {
        return Classification::Brilliant;
    }

    // Great: only good move (large gap to 2nd) or decisive band cross.
    if ctx.played_is_best {
        if let Some(second) = ctx.second_line {
            let gap = win_best_alt - eval_to_winprob(second.eval).0;
            if gap >= cfg.great_onlymove_gap { return Classification::Great; }
        }
    }

    // Miss: was winning before, dropped to equal/worse.
    if win_before >= cfg.miss_win_before && win_after < cfg.miss_win_after {
        return Classification::Miss;
    }

    // Expected-points cutoffs (Chess.com V2, exact).
    if ep_loss == 0.0            { Classification::Best }
    else if ep_loss <= cfg.excellent  { Classification::Excellent }
    else if ep_loss <= cfg.good       { Classification::Good }
    else if ep_loss <= cfg.inaccuracy { Classification::Inaccuracy }
    else if ep_loss <= cfg.mistake    { Classification::Mistake }
    else                              { Classification::Blunder }
}
```

```rust
// tests/scoring.rs — unit + golden
use crate::{winprob::*, accuracy::*, model::*};

#[test] fn winprob_equal_is_fifty() {
    assert!((cp_to_winprob(0).0 - 50.0).abs() < 1e-6);
}
#[test] fn winprob_monotonic() {
    assert!(cp_to_winprob(100).0 > cp_to_winprob(0).0);
    assert!(cp_to_winprob(-100).0 < cp_to_winprob(0).0);
}
#[test] fn best_move_scores_100() {
    assert!((move_accuracy(WinProb(60.0), WinProb(60.0)) - 100.0).abs() < 1.5);
}
#[test] fn blunder_scores_low() {
    assert!(move_accuracy(WinProb(70.0), WinProb(45.0)) < 45.0);
}
#[test] fn mate_maps_to_extremes() {
    assert_eq!(eval_to_winprob(Eval::Mate(MateIn(3))).0, 100.0);
    assert_eq!(eval_to_winprob(Eval::Mate(MateIn(-3))).0, 0.0);
}
#[test] fn perfect_game_is_100() {
    let accs = vec![100.0; 30];
    let wins = vec![55.0; 31];
    assert!((game_accuracy(&accs, &wins, 4) - 100.0).abs() < 1e-3);
}
```

**Safety:** the pipeline wraps PGN parsing in a `Result`, treats an engine crash mid-analysis as recoverable (restart engine, retry the position N times, else mark it "unanalyzed" and exclude it from accuracy), and never panics on unexpected UCI lines. Cross-platform: resolve the Stockfish binary path per-OS (bundled sidecar), quote paths with spaces, and use the platform's line-ending-agnostic reader.

### 9. Validation framework
- **Golden fixtures:** JSON files each with FEN/PGN, engine version+depth, expected top lines (cp/mate/WDL), expected per-move classification, expected move accuracy, expected game accuracy. Run scoring against fixtures with **no engine** (feed stored evals) for deterministic, CI-friendly tests.
- **Chess.com comparison harness (manual ground-truth collection).** CSV schema: `game_url, move_ply, fen, played_move, cc_classification, cc_move_accuracy(if shown), cc_game_accuracy_white, cc_game_accuracy_black, cc_estimated_rating`. (Chess.com does not expose per-move accuracy publicly, so at minimum collect game-level accuracy + move classifications.)
- **Error metrics:** classification agreement (confusion matrix over the 6 core + special classes); game-accuracy MAE and correlation vs. Chess.com; mean signed error (bias). Target: correlation ≥0.9 and MAE ≤3 accuracy points (the band Backrank reports).
- **Held-out validation:** fit free constants (`p`, floor, Brilliant guards, rating regression) on a training split, report metrics on a held-out split.
- **Fitting method:** grid or Nelder-Mead search over `{p, floor, great_gap, brilliant guards}` minimizing (classification disagreement + accuracy MAE) on training games.

### 10. Known limitations
- CAPS2's exact averaging, blunder-dampening curve, and per-rating depth schedule are proprietary; the aggregation here is a calibrated approximation, not a replica.
- Brilliant/Great/Miss thresholds and their rating scaling are inferred; expect edge-case divergence (e.g. promotions misflagged as Brilliant — a known bug in the freechess reimplementation).
- Engine version, depth, hardware, and MultiPV all shift results; exact parity with Chess.com's servers is impossible without their engine build and depth schedule.
- WDL depends on Stockfish's material-aware model and varies by version — pin it.
- Game-rating estimate is inherently high-variance per game and rating-anchored; treat as indicative.
- Tablebase/book coverage depends on user-installed files; without them, endgame/opening classification falls back to search.
- **The SecondBoard stack is unconfirmed**; all repo-specific paths/naming above are provisional until the manifest is read.

### 11. Recommended next steps (prioritized)
1. **Confirm the SecondBoard stack** (read its manifest and file tree) and place the pure scoring/classification module accordingly — highest priority; unblocks everything and de-risks the provisional Rust assumption.
2. **Ship the deterministic core** (win%/accuracy/EP-cutoff classifier) with golden tests — low risk, high value, uses Chess.com's *exact published* cutoffs and Lichess's *exact published* accuracy constants, so no proprietary secret is needed.
3. **Add engine transport** (UCI subprocess with WDL + MultiPV + caching + cancellation) — medium risk (process management, cross-platform paths/binaries).
4. **Add special classes** (Brilliant/Great/Miss/Book/Forced) with a sacrifice detector — higher risk; iterate against fixtures.
5. **Build the Chess.com comparison harness and calibrate** free constants on collected games — validates the approximation with real error bars.
6. **Add the game-rating estimate** last (lowest fidelity), clearly labeled indicative.

**Thresholds that change the plan:** if calibrated game-accuracy MAE stays >5 points or correlation <0.85, switch aggregation from the Lichess hybrid to a fitted power mean and re-anchor win% to a WDL expected-score model. If the Brilliant false-positive rate is high, tighten the sacrifice detector to require net material loss *confirmed by the search continuation* (not just an immediate capture), and require the position to be genuinely non-winning without the move.
