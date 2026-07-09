# SecondBoard — Ground Truth Project Overview

> **Working title:** SecondBoard  
> **Project type:** Local-first desktop companion app for Chess.com power users  
> **Primary platform targets:** Windows + Linux AppImage first, macOS later/experimental  
> **Core promise:** Import or sync Chess.com games, analyze them locally with Stockfish, review them in a chess.com-like experience, and build a long-term personal chess profile from the user's own games.

---

## 0. Document Purpose

This document is the single source of truth for building the project from zero to a polished product.

It defines:

- product vision
- positioning
- user experience
- technical architecture
- analysis pipeline
- data model
- move classification system
- insight system
- UI/UX direction
- roadmap
- release strategy
- update strategy
- future high-payoff features
- non-goals

Whenever implementation decisions are unclear, this document should be treated as the primary reference.

---

# 1. Product Vision

## 1.1 One-Sentence Vision

**SecondBoard is a local-first Chess.com companion app that turns a player's own games into deeply visual game reviews, long-term performance insights, and personalized training material.**

## 1.2 What the App Is

SecondBoard is not a chess server, not a new playing platform, and not a Stockfish GUI clone.

It is:

- a local game review app
- a Chess.com companion tool
- a personal performance dashboard
- a long-term weakness and strength tracker
- a training generator from the user's own mistakes
- a second-monitor experience for serious chess.com users

## 1.3 Core User Story

A user plays games on Chess.com.  
They open SecondBoard.  
The app syncs recent games, analyzes them locally, and shows:

- game reviews
- best moves
- move classifications
- eval graph
- accuracy
- blunders and missed wins
- long-term rating and accuracy trends
- opening weaknesses
- time-management issues
- personal training recommendations

The app becomes more useful the more the user uses it.

## 1.4 Core Product Philosophy

> Stockfish knows the position.  
> SecondBoard knows the player.

This is the key product distinction.

Chess engines answer:

> "What is the best move here?"

SecondBoard answers:

> "What keeps costing me rating?"

That second question is the real product.

---

# 2. Product Positioning

## 2.1 Primary Positioning

SecondBoard should be positioned as:

> A local-first Chess.com power-user companion for serious self-review and improvement.

It should feel like:

- Chess.com Game Review
- GitHub Insights
- Spotify Wrapped
- training diary
- local analytics tool
- personal chess lab

## 2.2 What It Should Not Become

Avoid becoming:

- a Chess.com replacement
- a Lichess clone
- a multiplayer chess server
- a random puzzle site
- a generic Stockfish GUI
- a full AI chatbot product
- a cloud-first SaaS platform

## 2.3 Brand/Legal Direction

The UI may be inspired by familiar chess review workflows, but the product must not copy:

- Chess.com branding
- logos
- names
- proprietary icons
- exact colors
- exact text
- proprietary classification visuals

The design goal is:

> Familiar workflow, original identity.

The app should feel natural next to Chess.com on a second monitor, but it must have its own visual language.

---

# 3. Target Users

## 3.1 Primary User

A Chess.com user who:

- plays regularly
- cares about rating improvement
- reviews games
- wants more control than Chess.com gives
- likes dashboards and statistics
- wants local analysis
- may use two monitors
- may be technical or semi-technical

## 3.2 Secondary Users

- club players
- students improving seriously
- streamers reviewing their games
- coaches reviewing public Chess.com profiles
- data nerds who want personal chess analytics
- Linux users underserved by polished desktop chess tools

## 3.3 Power-User Motivation

The user wants to know:

- Why am I losing?
- Which openings cost me rating?
- Do I blunder more in time trouble?
- Am I improving?
- Which mistakes repeat?
- What should I train next?
- Which games are worth reviewing?
- Where did the game actually turn?

---

# 4. Core Product Loop

The entire product should reinforce this loop:

```text
Play games on Chess.com
→ Sync/import games into SecondBoard
→ Analyze locally with Stockfish
→ Review critical moments
→ Update player profile
→ Generate insights and training
→ Improve play
→ Repeat
```

The product becomes more valuable with more analyzed games.

This is the core flywheel.

---

# 5. MVP Definition

## 5.1 MVP Must Prove

The MVP must prove one thing:

> A user can import a real game, analyze it locally, and get a beautiful, useful review.

## 5.2 MVP Features

MVP must include:

- Tauri desktop app
- Windows build
- Linux AppImage build
- PGN paste/import
- local Stockfish binary
- full game analysis
- move-by-move board navigation
- eval graph
- best move display
- engine line display
- basic move classification
- accuracy estimate
- local SQLite persistence
- settings for analysis depth/movetime
- polished chess-review screen

## 5.3 MVP Must Not Include

Do not include in MVP:

- local LLM comments
- ML weakness prediction
- full player dashboard
- full opening explorer
- auto-sync background service
- macOS notarized release
- opponent analysis
- Chess Wrapped
- training from mistakes
- live Chess.com integration beyond manual import

Those are later.

Do not commit the ancient developer sin of building a cathedral before proving the door opens.

---

# 6. Recommended Tech Stack

## 6.1 Desktop Framework

Use:

```text
Tauri v2
```

Reasons:

- native desktop app shell
- supports Windows, Linux, macOS
- lightweight compared to Electron
- Rust backend fits the project
- good system integration
- official updater plugin
- works with modern web frontends

Official Tauri positioning: Tauri supports building apps for Linux, macOS, Windows and more from a single codebase, with frontend code plus Rust application logic.

## 6.2 Frontend

Use:

```text
SvelteKit + Svelte 5
```

Reasons:

- excellent reactive UI
- less boilerplate than React
- good for dashboard-heavy apps
- great animation ergonomics
- fits Tauri well
- clean state management

Important:

Tauri does not support server-based SvelteKit output. SvelteKit must be configured for static output / SPA mode using the static adapter.

## 6.3 Backend

Use:

```text
Rust
```

Reasons:

- native performance
- strong process control for Stockfish
- good SQLite support
- safe concurrency
- same language as Tauri backend
- ideal for packaging standalone binaries

## 6.4 Database

Use:

```text
SQLite
```

Reasons:

- local-first
- no server required
- reliable
- portable
- enough for thousands or millions of moves
- easy backup/export

Possible Rust libraries:

- sqlx
- rusqlite
- sea-orm if ORM is desired

Recommendation:

Start with `sqlx` or `rusqlite`. Avoid overengineering with a heavy ORM too early.

## 6.5 Chess Logic

Options:

```text
shakmaty
cozy-chess
chess
```

Recommended starting point:

```text
shakmaty
```

Use for:

- FEN handling
- legal move parsing
- PGN handling, if suitable
- SAN/UCI conversions
- board state transitions

If PGN parsing becomes painful, implement a dedicated parser layer or use a specialized Rust PGN crate.

## 6.6 Engine

Use:

```text
Stockfish
```

Bundled per platform:

```text
stockfish-windows-x86_64.exe
stockfish-linux-x86_64
stockfish-macos-arm64
stockfish-macos-x86_64
```

Stockfish communicates via UCI, the standard text-based protocol used by GUIs and tools.

## 6.7 Charts

Use one of:

```text
ECharts
LayerChart
Chart.js
```

Recommendation:

Use ECharts if you want rich interactive eval graphs, heatmaps, timelines, tooltips, and dashboards.

## 6.8 Board UI

Options:

- custom SVG board
- chessboard-element
- react-chessboard only if using React
- custom Svelte component

Recommendation:

Build a custom Svelte board component eventually.

Reason:

The board is central to the product. You need:

- arrows
- highlights
- move animations
- custom themes
- brilliant/glow effects
- heatmaps
- best-move overlays
- board coordinates
- review effects
- custom piece sets

A custom board is more work, but gives the best long-term control.

For MVP, using an existing board library is acceptable if it does not block the desired UX.

## 6.9 Releases

Use:

```text
GitHub Actions
GitHub Releases
Tauri bundler
Tauri updater
```

Build targets:

- Windows NSIS installer first
- Windows MSI optional
- Linux AppImage first
- .deb/.rpm later
- AUR package later
- macOS unsigned experimental later
- macOS signed/notarized later if Apple Developer Account exists

## 6.10 Auto-Updater

Use:

```text
tauri-plugin-updater
```

The updater supports desktop platforms and uses signed update artifacts. Linux AppImage updater bundles are separate artifacts from the plain AppImage. Windows updater artifacts are generated from NSIS/MSI bundles.

Update flow:

```text
App starts
→ checks update endpoint
→ newer version exists
→ shows update dialog
→ downloads update
→ installs update
→ restarts app
```

---

# 7. Platform Strategy

## 7.1 Primary Platforms

Focus first on:

```text
Windows
Linux AppImage
```

Why:

- Windows is the main desktop user base
- Linux AppImage supports Arch users well
- avoids Linux distro packaging chaos early
- simpler than macOS signing/notarization

## 7.2 Linux Strategy

Primary:

```text
AppImage
```

Later:

```text
AUR package
.deb
.rpm
Flatpak
```

For Arch users:

- AppImage should work first
- AUR package can follow when project stabilizes
- avoid AUR as the first release method because updater behavior and GitHub Releases are easier with AppImage

## 7.3 macOS Strategy

macOS technically works with Tauri.

Without Apple Developer Account:

- provide experimental unsigned `.app` / `.dmg`
- users may need right-click → Open
- users may need to remove quarantine flag manually

Possible instruction:

```bash
xattr -dr com.apple.quarantine /Applications/SecondBoard.app
```

Long-term polished macOS requires:

- Apple Developer Account
- Developer ID signing
- notarization
- proper DMG distribution

macOS should not block the Windows/Linux MVP.

---

# 8. System Architecture

## 8.1 High-Level Architecture

```text
Frontend UI (SvelteKit)
  ↓ Tauri invoke commands
Rust Backend
  ↓
SQLite Database
  ↓
Stockfish Engine Process
  ↓
Analysis Results
```

## 8.2 Module Boundaries

```text
src/
  routes/
  lib/
    components/
    stores/
    api/
    charts/
    board/
    themes/
    types/

src-tauri/
  src/
    main.rs
    commands/
    engine/
    analysis/
    pgn/
    chesscom/
    db/
    insights/
    settings/
    updater/
```

## 8.3 Backend Modules

### `engine`

Responsible for:

- spawning Stockfish
- sending UCI commands
- reading output
- configuring threads/hash/MultiPV
- timeout handling
- crash handling
- engine version detection

### `analysis`

Responsible for:

- analysis jobs
- per-move analysis
- eval normalization
- move classification
- progress events
- result caching
- cancellation

### `pgn`

Responsible for:

- PGN parsing
- metadata extraction
- clock extraction
- move conversion
- FEN generation per ply

### `chesscom`

Responsible for:

- username lookup
- archive list fetch
- monthly game fetch
- PGN extraction
- incremental sync
- rate limiting
- error handling

### `db`

Responsible for:

- migrations
- inserts
- queries
- caching
- profile persistence
- analysis persistence

### `insights`

Responsible for:

- player metrics
- trend detection
- weakness scoring
- strength scoring
- feed generation
- training recommendations

### `settings`

Responsible for:

- engine path/settings
- theme settings
- board settings
- update preferences
- sync settings

### `updater`

Responsible for:

- checking GitHub/Tauri updater endpoint
- user prompt
- install and restart

---

# 9. Data Model

## 9.1 Core Tables

### players

Stores known players.

Fields:

```text
id
username
platform
display_name
avatar_url
country
joined_at
last_synced_at
created_at
updated_at
```

### games

Stores imported games.

Fields:

```text
id
platform
platform_game_id
url
white_player_id
black_player_id
white_username
black_username
white_rating
black_rating
result
termination
time_class
time_control
rated
eco
opening_name
pgn_raw
start_time
end_time
imported_at
analyzed_at
analysis_status
analysis_version
```

### moves

One row per ply.

Fields:

```text
id
game_id
ply
move_number
side
san
uci
lan
fen_before
fen_after
is_capture
is_check
is_checkmate
is_castle
is_promotion
promotion_piece
clock_before_ms
clock_after_ms
time_spent_ms
created_at
```

### engine_analysis

One row per analyzed move.

Fields:

```text
id
move_id
engine_name
engine_version
depth
seldepth
nodes
nps
multipv_json
eval_before_cp
eval_after_cp
best_move_uci
best_move_san
best_line_uci_json
best_line_san_json
played_line_eval_cp
mate_before
mate_after
analysis_mode
created_at
```

### move_classifications

Fields:

```text
id
move_id
classification
centipawn_loss
expected_points_loss
eval_swing_cp
is_book
is_only_move
is_great
is_brilliant
is_miss
is_blunder
is_mistake
is_inaccuracy
reason_code
reason_text_template
created_at
```

### move_features

Fields:

```text
id
move_id
phase
material_balance_cp
piece_count
pawn_count
major_piece_count
minor_piece_count
king_safety_score
mobility_score
is_time_pressure
is_low_time
is_increment_scramble
is_endgame
is_opening
is_middlegame
is_sacrifice
is_hanging_piece
is_tactical_miss
is_fork_related
is_pin_related
is_skewer_related
is_back_rank_related
created_at
```

### player_metric_snapshots

Stores aggregated metrics over time.

Fields:

```text
id
player_id
period_start
period_end
time_class
games_count
moves_count
rating_start
rating_end
rating_delta
accuracy_avg
centipawn_loss_avg
blunders_per_game
mistakes_per_game
inaccuracies_per_game
opening_score
tactics_score
endgame_score
conversion_score
defense_score
time_management_score
consistency_score
created_at
```

### insights

Stores generated insights.

Fields:

```text
id
player_id
type
severity
title
body
confidence
supporting_data_json
related_game_ids_json
related_move_ids_json
created_at
dismissed_at
```

### training_positions

Stores generated training tasks from real games.

Fields:

```text
id
player_id
source_game_id
source_move_id
fen
side_to_move
best_move_uci
best_move_san
theme
difficulty
reason
attempt_count
success_count
last_attempted_at
next_due_at
created_at
```

### app_settings

Fields:

```text
key
value_json
updated_at
```

---

# 10. Analysis Pipeline

## 10.1 Import Flow

```text
User imports PGN or syncs games
→ parse game metadata
→ store game
→ parse moves
→ generate FEN before/after each move
→ store moves
→ enqueue analysis job
```

## 10.2 Analysis Job Flow

```text
Load game
→ initialize Stockfish
→ configure engine options
→ for each move:
    analyze position before move
    determine best move and eval
    apply played move
    analyze resulting position
    compute loss
    classify move
    store results
    emit progress event to UI
→ aggregate game metrics
→ update player profile
→ generate insights
```

## 10.3 Engine Analysis Modes

### Fast Review

Use:

```text
movetime: 300-500 ms per move
MultiPV: 1
```

Purpose:

- quick post-game scan
- many games
- initial baseline

### Standard Review

Use:

```text
depth: 16-18
MultiPV: 2-3
```

Purpose:

- normal game review
- reliable move classifications

### Deep Review

Use:

```text
depth: 20-24
MultiPV: 3-5
```

Purpose:

- critical games
- slow but more accurate

### Custom

User can set:

```text
depth
movetime
threads
hash
MultiPV
```

## 10.4 Engine Settings Defaults

Suggested defaults:

```text
Threads: max(1, logical_cpu_count - 1)
Hash: 256 MB initial, configurable
MultiPV: 2 for standard review
Depth: 16 for standard review
```

Do not max out the user's hardware by default. Let the app feel fast and respectful. Apparently that has become a luxury feature.

## 10.5 Result Caching

Never reanalyze already analyzed positions unless:

- engine version changed
- analysis mode changed
- requested depth is higher
- user manually requests reanalysis
- classification algorithm version changed

Store:

```text
engine_version
analysis_mode
depth
classification_version
```

---

# 11. Move Classification System

## 11.1 Classification Goal

Move classification should mimic familiar review categories without copying exact proprietary rules.

It must be:

- understandable
- deterministic
- explainable
- consistent
- adjustable over time

## 11.2 Basic Categories

Use:

```text
Book
Best
Excellent
Good
Inaccuracy
Mistake
Blunder
Miss
Great
Brilliant
```

## 11.3 Phase 1: Centipawn Loss

For MVP:

```text
centipawn_loss = eval_best_after - eval_played_after
```

Normalize from the perspective of the player who moved.

Initial thresholds:

```text
Best:        0-10 cp
Excellent:  11-30 cp
Good:       31-70 cp
Inaccuracy: 71-150 cp
Mistake:    151-300 cp
Blunder:    >300 cp
```

These thresholds are only the initial system. They should be configurable internally and revisable.

## 11.4 Problem with Raw Centipawns

A loss from:

```text
+8.0 to +5.0
```

is not as important as:

```text
+0.2 to -2.8
```

Both may be 300 cp, but the practical impact is different.

Therefore, the long-term system should use expected points.

## 11.5 Phase 2: Expected Points

Convert eval to expected score.

Possible function:

```text
expected_score = 1 / (1 + exp(-k * eval_cp))
```

Tune `k` empirically.

Then:

```text
expected_points_loss = expected_score_best - expected_score_played
```

Classify by expected point loss.

Possible thresholds:

```text
Best:        0.00 - 0.01
Excellent:  0.01 - 0.03
Good:       0.03 - 0.07
Inaccuracy: 0.07 - 0.15
Mistake:    0.15 - 0.30
Blunder:    >0.30
```

This better matches human impact.

## 11.6 Book

A move is Book if:

- position appears in opening database
- played move is part of known line
- game is still in book phase

Book overrides normal classification unless the book line is clearly dubious and engine eval collapses.

## 11.7 Miss

A Miss means the player missed a strong opportunity.

Condition:

```text
best move significantly improves expected score
played move does not preserve that opportunity
but played move is not necessarily a catastrophic blunder
```

Example rule:

```text
if best_move_expected_gain >= 0.18
and played_move_expected_gain <= 0.04:
    Miss
```

## 11.8 Great

A Great move should represent a hard-to-find strong move.

Possible conditions:

```text
played move is best or near-best
and second-best move is much worse
and position was critical
```

Use MultiPV:

```text
best_eval - second_best_eval >= threshold
```

Also require:

```text
position tension high
or side was under pressure
or only move preserves advantage/equality
```

## 11.9 Brilliant

A Brilliant move should be rare.

Possible conditions:

```text
played move is best or near-best
and move involves a sacrifice
and engine confirms advantage/equality
and sacrifice is not a trivial recapture
and position is non-obvious
```

Detect sacrifice:

```text
material_after_played < material_before
and compensation exists according to engine eval
```

Avoid false positives:

- obvious forced recaptures
- forced mate in 1
- simple queen trade
- already winning moves with no real risk

## 11.10 Reason Codes

Every classification should have a reason code.

Examples:

```text
LOSS_OF_MATERIAL
MISSED_TACTIC
MISSED_MATE
ALLOWED_MATE
OPENING_BOOK
ONLY_MOVE
TIME_PRESSURE_BLUNDER
HANGING_PIECE
CONVERSION_FAILURE
DEFENSIVE_RESOURCE_FOUND
ENDGAME_MISTAKE
```

Reason codes allow:

- explanation templates
- insight aggregation
- training position generation
- weakness detection

---

# 12. Accuracy System

## 12.1 Game Accuracy

Initial simple formula:

```text
accuracy = max(0, 100 - average_centipawn_loss * factor)
```

Better formula:

```text
accuracy = 100 * exp(-average_expected_points_loss * scale)
```

Accuracy should be calculated separately for:

- white
- black
- whole game
- opening
- middlegame
- endgame
- time pressure

## 12.2 Accuracy Display

Do not overstate precision.

Show:

```text
Accuracy 87.4
```

But internally know this is an estimate based on engine settings.

## 12.3 Accuracy Confidence

Accuracy should have a confidence level depending on:

- analysis depth
- number of moves
- engine mode
- whether many mate scores occurred
- whether game was very short

---

# 13. Strengths and Weaknesses

## 13.1 Principle

Every strength/weakness must be backed by specific data.

Never say:

```text
You are bad at endgames.
```

Say:

```text
Endgames appear to be a weakness:
- 73 relevant endgame positions
- endgame accuracy: 68%
- overall accuracy: 82%
- 14 winning endgames not converted
Confidence: high
```

This is the product.

## 13.2 Skill Areas

Track at least:

```text
Opening
Tactics
Calculation
Conversion
Defense
Endgame
Time Management
Consistency
Risk Management
```

## 13.3 Time Management

Required data:

- clock before move
- clock after move
- time spent
- game time control
- increment
- move classification
- eval loss

Metrics:

```text
time_pressure_blunder_rate
low_time_accuracy
average_time_left_at_game_end
flag_loss_count
accuracy_drop_under_30s
mistakes_per_40_moves_in_time_pressure
```

Rules:

```text
time_pressure = remaining_time < 15% of starting time
or remaining_time < 30 seconds in blitz/rapid
```

Weakness condition example:

```text
if time_pressure_blunder_rate > normal_blunder_rate * 1.5
and relevant_time_pressure_moves >= 50:
    Time Management Weakness
```

## 13.4 Opening

Required data:

- ECO/opening name
- move number
- eval after move 8/10/12
- book exit move
- result
- color
- time class

Metrics:

```text
winrate_by_opening
avg_eval_after_move_10
book_exit_eval
opening_blunders_per_game
opening_accuracy
```

Weakness example:

```text
Sicilian as White:
- winrate below player's white baseline
- eval after move 10 below baseline
- high early mistake rate
```

## 13.5 Conversion

Conversion means turning winning positions into wins.

Rules:

```text
winning_position = eval >= +2.0 from player's perspective
conversion_success = game result is win
conversion_failure = draw/loss
```

Metrics:

```text
conversion_rate
advantage_loss_count
avg_max_eval_in_won_games
avg_max_eval_in_failed_games
```

Weakness example:

```text
if player reaches winning positions often
and conversion_rate is low:
    Conversion Weakness
```

## 13.6 Defense

Defense means saving worse positions.

Rules:

```text
lost_position = eval <= -2.0 from player's perspective
save = draw or win
```

Metrics:

```text
save_rate
defensive_accuracy
only_move_success_rate
recovery_after_blunder_rate
```

Strength example:

```text
if save_rate high compared to baseline:
    Defense Strength
```

## 13.7 Endgame

Define endgame using:

```text
queens off and material reduced
or piece_count <= threshold
or tablebase-eligible positions
```

Metrics:

```text
endgame_accuracy
rook_endgame_performance
pawn_endgame_performance
conversion_in_endgames
tablebase_mistakes_if_available
```

## 13.8 Tactics

Rule-based tactical tags:

```text
hanging piece
fork
pin
skewer
back rank
discovered attack
mate threat
overloaded defender
```

Start simple:

- hanging pieces
- missed mates
- missed winning captures
- allowed forks
- back-rank motifs

Do not try to detect every tactical theme in v1. That way lies madness, and not even the interesting kind.

## 13.9 Consistency

Metrics:

```text
accuracy_stddev
blunder_rate_variance
rating_session_volatility
tilt_losses
performance_after_loss
```

Weakness example:

```text
if accuracy drops heavily after losses:
    Tilt/Consistency issue
```

---

# 14. Insight Engine

## 14.1 Insight Feed

The app should not only show dashboards. It should generate an insight feed.

Examples:

```text
Improvement detected:
Your endgame accuracy increased by 9% over the last 30 days.

Weakness detected:
You make 2.4x more blunders under 30 seconds.

Opening leak:
Your average eval after move 10 in the French Defense is -0.7.

Milestone:
10 games without a blunder.
```

## 14.2 Insight Types

Use:

```text
IMPROVEMENT
REGRESSION
WEAKNESS
STRENGTH
MILESTONE
TRAINING_RECOMMENDATION
OPENING_LEAK
TIME_MANAGEMENT
SESSION_SUMMARY
```

## 14.3 Confidence

Every insight must include confidence.

Confidence factors:

- number of games
- number of relevant moves
- analysis depth
- consistency of pattern
- timeframe size

Display:

```text
Confidence: High
Based on 184 relevant moves
```

## 14.4 Supporting Data

Every insight should be clickable.

Clicking opens:

- related games
- related moves
- relevant chart
- explanation of calculation

No black-box nonsense. We are not building a horoscope with SVG icons.

---

# 15. Training System

## 15.1 Core Training Feature

Signature feature:

```text
Train from your own mistakes
```

The app turns the user's own critical positions into training exercises.

## 15.2 Training Position Generation

Generate from:

- blunders
- mistakes
- missed wins
- missed mates
- only moves
- conversion failures
- recurring tactical motifs

Fields:

```text
FEN
side to move
best move
theme
difficulty
source game
classification
explanation
```

## 15.3 Training Modes

### Retry Move

Show the exact position before the mistake.

Prompt:

```text
Find the best move you missed.
```

### Critical Moments

Show only high-impact positions.

### Opening Fix

Show positions from bad opening lines.

### Endgame Rescue

Show endgame positions where the player lost accuracy.

### Spaced Repetition

Track attempts and schedule repeats.

---

# 16. Dashboard Features

## 16.1 Home Dashboard

Must show:

- username/profile
- analyzed games count
- recent games
- current rating by time class
- accuracy trend
- blunders/game trend
- insight feed
- current training recommendation

## 16.2 Game Review Screen

Most important screen.

Layout:

```text
Left: board
Below board: move list / PGN line / eval graph
Right: review panel
Top: players, result, time class
```

Must include:

- board
- current move
- move classification
- best move
- engine line
- eval graph
- accuracy
- move category summary
- next/previous controls
- key moments filter

## 16.3 Games Screen

Features:

- list of games
- filters by time class
- filters by result
- filters by opening
- filters by classification count
- search opponent
- sort by date/rating/accuracy/blunders
- analysis status

## 16.4 Opening Explorer

Use only the user's games.

Features:

- openings by frequency
- winrate by opening
- avg eval after move 10
- blunders in opening
- move tree
- recommended lines to study
- personal repertoire view

This is not a global master database. It is:

```text
Your opening explorer
```

## 16.5 Insights Screen

Features:

- insight feed
- trend cards
- weakness timeline
- skill radar
- confidence display
- supporting evidence links

## 16.6 Training Screen

Features:

- training queue
- retry mistakes
- spaced repetition
- theme filters
- progress tracking

## 16.7 Sessions Screen

Features:

- session summaries
- tilt detection
- rating delta
- accuracy by session
- best/worst game
- streaks

## 16.8 Settings Screen

Settings:

- engine depth/movetime
- threads
- hash
- MultiPV
- theme
- board style
- piece style
- update settings
- sync settings
- privacy/local data
- export/import backup

---

# 17. Visual Design Direction

## 17.1 Overall Style

Dark-first, premium, clean.

Visual keywords:

```text
modern
calm
high contrast
soft depth
rounded cards
subtle gradients
chess.com-adjacent
not copied
power-user friendly
```

## 17.2 Layout Philosophy

- large cards
- clear hierarchy
- minimal clutter
- immediate insight per screen
- no dashboard noise
- each screen answers a real question in under 3 seconds

## 17.3 Theme System

Support:

```text
Dark
Light
System
Custom accent color
Board themes
Piece sets
```

Board themes:

- Green Classic
- Purple Night
- Walnut
- Slate
- Minimal Mono
- High Contrast

Piece sets:

- Classic
- Neo
- Staunton
- Minimal
- Rounded
- High Contrast

## 17.4 Move Classification Visuals

Each classification should have:

- color
- icon
- animation style
- tooltip explanation

Examples:

```text
Brilliant: star/glow, green-cyan accent
Great: blue exclamation
Best: green check/star
Excellent: green
Good: neutral
Inaccuracy: yellow/orange
Mistake: orange/red
Blunder: red
Book: book icon
Miss: purple/orange target
```

Do not copy chess.com icons exactly.

## 17.5 Review Effects

Brilliant:

- subtle board glow
- move badge slides in
- piece pulse
- short sparkle
- 300-600 ms

Blunder:

- eval graph drops
- subtle shake
- red pulse
- no aggressive horror UI

Great:

- blue flash
- "only move" emphasis

Book:

- calm book ribbon
- opening name appears

## 17.6 Board Interaction

Must support:

- move arrows
- best move arrow
- last move highlight
- selected square
- legal moves optional
- heatmap overlays
- tactical motif overlays
- coordinate labels
- flip board

## 17.7 Dashboard Design

Use cards like:

```text
Rating trend
Accuracy
Blunders/game
Current weakness
Current streak
Training focus
```

Each card must be clickable.

No fake metrics.

If there is not enough data, show:

```text
Not enough data yet
Analyze 25 more games to unlock this insight
```

---

# 18. Chess.com Integration

## 18.1 Supported Imports

MVP:

```text
PGN paste
PGN file
```

Phase 2:

```text
Chess.com username
monthly archives
recent games
```

Phase 3:

```text
Chess.com game link
incremental sync
```

## 18.2 Chess.com PubAPI

Chess.com PubAPI is read-only and provides public player/game data.

Useful concepts:

- player profile
- player game archives
- monthly archive URLs
- games include PGN
- monthly PGN endpoints are available

## 18.3 Sync Strategy

Initial sync options:

```text
Last 50 games
Last 100 games
Last 250 games
Last 12 months
All available games
Custom date range
```

Default recommendation:

```text
Last 250 games
```

## 18.4 Sync UX

Show estimate:

```text
250 games
Estimated analysis time: 1-4 hours depending on settings
Disk usage estimate
CPU usage warning
```

Let user choose analysis mode:

```text
Fast baseline
Standard
Deep
```

## 18.5 Incremental Sync

On app start:

```text
Check for new games if sync enabled
Fetch only new archive months / new games
Import but do not automatically deep-analyze unless setting enabled
```

Modes:

```text
Manual sync
Sync on startup
Sync every N hours while app open
```

Do not run hidden background processes in v1.

## 18.6 Game Link Import

Game link import is trickier.

Possible approach:

```text
User pastes game URL
Extract game ID
If username known:
    search recent/monthly archives for matching URL/ID
Else:
    ask for username or infer from PGN if accessible
```

Implement after username sync.

---

# 19. Baseline Analysis

## 19.1 Purpose

Baseline analysis builds the initial player profile.

Onboarding should encourage:

```text
Analyze my recent games
```

rather than only:

```text
Import one PGN
```

## 19.2 Baseline Options

Offer:

```text
Quick Start: 50 games
Recommended: 250 games
Deep Profile: 1000 games
Custom timeframe
```

## 19.3 Baseline Output

After baseline:

Show:

- profile overview
- rating history
- accuracy baseline
- common openings
- top weaknesses
- top strengths
- first training recommendations
- confidence levels

## 19.4 Baseline Analysis Mode

Use Fast or Standard Review.

Do not deep-analyze 1000 games by default. That is how laptops become space heaters with UI.

---

# 20. High-Payoff Features

## 20.1 Train From Your Own Mistakes

Highest-priority future feature.

Value:

- personal
- sticky
- unique
- turns analysis into improvement

## 20.2 Personal Opening Book

Build from user's games.

Value:

- shows real opening habits
- highlights opening leaks
- helps build repertoire

## 20.3 Weakness Timeline

Shows how skill areas improve/regress over time.

Value:

- emotional
- motivating
- makes long-term use rewarding

## 20.4 Chess Wrapped

Generate visual reports for:

- year
- month
- custom period
- semester
- rating climb

Value:

- shareable
- viral potential
- fun without being useless

## 20.5 Session Review

After a playing session:

- games played
- rating delta
- accuracy
- blunders
- best game
- worst game
- tilt warning
- training focus

Value:

- very practical
- encourages routine use

## 20.6 Streak Analysis

Track:

- games without blunder
- endgames without mistake
- sessions with positive rating
- training streak
- review streak

Value:

- motivational
- lightweight gamification

## 20.7 Heatmaps

Examples:

- squares where pieces are blundered
- squares where tactics occur
- openings causing worst eval drops
- move-number danger zones

Value:

- visually immediate
- memorable
- great dashboard material

## 20.8 Opponent Analysis

For public opponents:

- fetch games
- analyze profile
- show opening tendencies
- show weaknesses

Caution:

- expensive analysis
- should be opt-in
- probably later

## 20.9 Critical Position Collection

Automatically collect:

- biggest blunders
- missed wins
- best moves
- turning points
- opening exits
- endgame mistakes

Value:

- review efficiency
- direct learning

## 20.10 AI Search Over Own Games

Query:

```text
Why do I lose against the Caro-Kann?
```

Answer from structured data:

```text
You have 42 games.
Your avg eval after move 10 is -0.5.
Most losses occur after early c5 breaks.
Your common mistake is ...
```

This can be built without LLM first.

---

# 21. Optional LLM Layer

## 21.1 Do Not Use LLM for Truth

LLM must not decide:

- best moves
- classifications
- engine eval
- weaknesses
- tactical truth

Stockfish + deterministic metrics decide truth.

LLM may only explain already computed data.

## 21.2 Local LLM Comments

Optional feature:

```text
Download local explanation model
Generate natural language comments
```

Do not bundle model in base app.

Reason:

- large download size
- hardware variability
- complexity
- support burden

## 21.3 Model Pack Strategy

Core app:

```text
small download
Stockfish included
no LLM required
```

Optional:

```text
Local Explanation Pack
1-3 GB
```

## 21.4 Template Comments First

Start with deterministic templates:

```text
This move loses {loss} centipawns. Better was {best_move}, keeping the eval at {eval}.
```

More templates:

```text
This was a time-pressure mistake. You had {clock} remaining and the move allowed {best_move_for_opponent}.
```

```text
You missed a winning tactic here. {best_move} would have improved the position from {eval_before} to {eval_best}.
```

Templates are less magical, but also less likely to hallucinate a bishop into existence.

---

# 22. Machine Learning Layer

## 22.1 Do Not Use ML in MVP

ML is not needed for:

- blunder detection
- accuracy
- time-management issues
- opening leaks
- conversion rate
- defense rate
- endgame performance
- dashboards

Rules + Stockfish are enough.

## 22.2 Later ML Use Cases

ML may help with:

- clustering recurring mistake patterns
- predicting blunder-prone positions
- finding similar positions
- player style embeddings
- personalized difficulty prediction
- tactical theme classification

## 22.3 Data Requirements

Useful ML needs lots of data:

- thousands of games
- millions of moves
- diverse users
- labeled tactical motifs

Do not block core product on ML.

---

# 23. Roadmap

## Phase 0 — Design and Technical Spike

Goal:

```text
Prove the core UI and Stockfish integration.
```

Tasks:

- create Tauri + SvelteKit app
- build static Review screen with mock data
- build board component or integrate temporary board library
- spawn Stockfish from Rust
- analyze one FEN
- display eval and best move

Exit criteria:

```text
App launches
Review screen looks promising
Stockfish returns a best move
```

## Phase 1 — PGN Review MVP

Goal:

```text
Review a full imported PGN.
```

Tasks:

- PGN paste/import
- parse game
- navigate moves
- generate FEN per move
- analyze each move
- store results in memory
- show eval graph
- show best move
- basic move classification

Exit criteria:

```text
A full real game can be reviewed move by move.
```

## Phase 2 — Persistence and Product Feel

Goal:

```text
Make reviews reusable and polished.
```

Tasks:

- SQLite schema
- persistent games
- persistent analyses
- game list
- settings
- board themes
- piece themes
- better animations
- analysis progress UI
- cancel/retry analysis

Exit criteria:

```text
User can import, analyze, close app, reopen, and continue.
```

## Phase 3 — Windows/Linux Packaging

Goal:

```text
First real downloadable release.
```

Tasks:

- GitHub Actions
- Windows installer
- Linux AppImage
- bundle Stockfish per platform
- version metadata
- release notes

Exit criteria:

```text
v0.1.0 can be downloaded from GitHub Releases.
```

## Phase 4 — Chess.com Username Sync

Goal:

```text
Import public Chess.com games.
```

Tasks:

- username input
- fetch archives
- import recent games
- show recent games
- sync progress
- duplicate detection
- analysis queue

Exit criteria:

```text
User enters username and imports recent Chess.com games.
```

## Phase 5 — Baseline Player Profile

Goal:

```text
Analyze multiple games and produce first insights.
```

Tasks:

- baseline analysis wizard
- player metric snapshots
- accuracy trend
- blunders/game
- opening overview
- time-management metric
- conversion/defense metrics
- first insight feed

Exit criteria:

```text
After analyzing 50-250 games, app shows useful player overview.
```

## Phase 6 — Personal Training

Goal:

```text
Turn mistakes into exercises.
```

Tasks:

- generate training positions
- retry move mode
- spaced repetition basics
- training progress
- critical moments collection

Exit criteria:

```text
User can train from their own missed moves.
```

## Phase 7 — Polish and Differentiation

Goal:

```text
Make product feel premium.
```

Tasks:

- Chess Wrapped
- session review
- streaks
- heatmaps
- personal opening book
- weakness timeline
- exportable reports
- optional local AI comments

---

# 24. First Implementation Sprint

## Sprint Goal

Build a vertical slice:

```text
PGN in → Stockfish analysis → chess.com-like review screen
```

## Tasks

1. Create repo
2. Scaffold Tauri v2 + SvelteKit
3. Configure SvelteKit static adapter
4. Add Tailwind or design system
5. Build Review screen with mock data
6. Add board component
7. Add move list
8. Add eval graph
9. Add Rust command `analyze_fen`
10. Bundle or locate Stockfish
11. Parse Stockfish UCI output
12. Display best move and eval in UI
13. Add PGN paste input
14. Parse PGN and navigate moves
15. Analyze first N moves
16. Add progress indicator

## Sprint Exit Criteria

The app can:

- launch
- accept PGN text
- show game on board
- analyze moves locally
- show eval graph
- classify at least blunder/mistake/good/best

---

# 25. Quality Standards

## 25.1 Analysis Quality

- deterministic
- cached
- explainable
- depth/version tracked
- no hidden reanalysis surprises

## 25.2 UI Quality

- fast
- responsive
- polished
- keyboard navigable
- smooth animations
- no clutter
- visually satisfying move classifications

## 25.3 Data Quality

- every insight must link to evidence
- every aggregate must define timeframe
- every weakness must show confidence
- every stored analysis must include engine version/depth

## 25.4 Performance

- app startup under a few seconds
- no UI freeze during analysis
- analysis runs in background task
- progress streamed to UI
- user can cancel analysis
- CPU usage configurable

## 25.5 Privacy

- local-first
- no account required
- no cloud required
- Chess.com import only uses public API data
- user data stored locally
- export/delete local data options

---

# 26. Release Strategy

## 26.1 Versioning

Use semantic-ish versioning:

```text
0.1.0 first MVP
0.2.0 sync
0.3.0 dashboard
1.0.0 stable core review + sync + dashboard
```

## 26.2 GitHub Releases

Each release should include:

- Windows installer
- Linux AppImage
- checksums
- release notes
- known issues
- updater artifacts

## 26.3 Auto-Updater

Enable after release pipeline is stable.

Do not ship updater before release artifacts are reliable. Auto-updating broken apps is just distributed self-harm.

## 26.4 Release Channels

Eventually:

```text
stable
beta
nightly/dev
```

For early project:

```text
manual releases only
```

---

# 27. Naming Ideas

Possible names:

```text
SecondBoard
BlunderScope
ChessLab Desktop
ReviewMate
GameMirror
MoveLens
CheckScope
BoardMirror
```

Best current internal name:

```text
SecondBoard
```

Why:

- fits second-monitor idea
- not legally risky
- clear enough
- flexible beyond Game Review

---

# 28. Non-Goals

Do not build:

- online play
- matchmaking
- chess server
- user accounts
- cloud sync in early versions
- proprietary Chess.com scraping beyond public API
- chess engine from scratch
- full ML system early
- mandatory LLM
- social feed
- mobile app
- opening database rivaling ChessBase
- training platform before review works

---

# 29. Key Product Risks

## 29.1 Classification Quality

If classifications feel wrong, trust dies.

Mitigation:

- start conservative
- show engine evidence
- allow reanalysis
- indicate depth/confidence

## 29.2 UI Feels Like Cheap Clone

Mitigation:

- inspired layout, original design system
- high polish
- custom animations
- own icons
- own naming where needed

## 29.3 Analysis Too Slow

Mitigation:

- fast/standard/deep modes
- background queue
- incremental analysis
- caching
- analysis estimates

## 29.4 Chess.com Import Limitations

Mitigation:

- PGN import always supported
- username archive import first
- game link import later
- graceful errors

## 29.5 Scope Explosion

Mitigation:

- vertical slice first
- review screen first
- dashboard only after real data
- training only after classifications are solid

---

# 30. Definition of Done for v1.0

v1.0 should include:

- polished Review screen
- PGN import
- Chess.com username sync
- local Stockfish analysis
- persistent SQLite database
- move classifications
- eval graph
- best move/line
- accuracy
- recent games
- basic dashboard
- opening overview
- first weakness insights
- Windows installer
- Linux AppImage
- GitHub Releases
- stable update mechanism

v1.0 should feel like:

> This is already useful after every Chess.com session.

---

# 31. Final North Star

Every major feature should answer one of these questions:

```text
What happened in this game?
Where did I lose/win the game?
What mistake do I keep repeating?
Which opening is hurting me?
Am I improving?
What should I train next?
```

If a feature does not answer one of those, it is probably noise.

The goal is not to build the biggest chess app.

The goal is to build the app that makes a player think:

> "This thing actually knows how I play."

That is the product.
