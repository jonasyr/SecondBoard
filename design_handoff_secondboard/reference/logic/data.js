/*
 * data.js — DATA CONTRACT + MOCK CONTENT (RUNTIME-FREE EXTRACTION)
 * ----------------------------------------------------------------
 * Extracted from reference/SecondBoard.dc.html → class Component.
 *
 * CLS is a REAL, keep-it spec: the ten move classifications with their
 * exact names, coach words, colors, and glyphs. Reuse verbatim.
 *
 * Everything below CLS (sanList, classCodes, evalPerPly, bestMoves,
 * coachTextMap, and the screen-data builders) is MOCK CONTENT that stands
 * in for the Rust backend. It documents the exact shape each screen
 * expects. Replace the values with real query/analysis output
 * (see README §8 mapping table + OVERVIEW §9–16).
 */

// ============ MOVE CLASSIFICATION SYSTEM (KEEP — exact spec) ============
export const CLS = {
  brilliant:  { name: 'Brilliant',  word: 'brilliant',       color: '#2DE0CE', glyph: '!!' },
  great:      { name: 'Great',      word: 'a great move',    color: '#60A5FA', glyph: '!' },
  best:       { name: 'Best',       word: 'the best move',   color: '#4ADEA0', glyph: '\u2605' }, // ★
  excellent:  { name: 'Excellent',  word: 'excellent',       color: '#86E5A8', glyph: '\u2726' }, // ✦
  good:       { name: 'Good',       word: 'a good move',     color: '#8FB39B', glyph: '\u2713' }, // ✓
  book:       { name: 'Book',       word: 'a book move',     color: '#C99B6E', glyph: '\u25C8' }, // ◈
  inaccuracy: { name: 'Inaccuracy', word: 'an inaccuracy',   color: '#F5B14C', glyph: '?!' },
  mistake:    { name: 'Mistake',    word: 'a mistake',       color: '#F97A45', glyph: '?' },
  miss:       { name: 'Miss',       word: 'a miss',          color: '#C77DFF', glyph: '\u2715' }, // ✕
  blunder:    { name: 'Blunder',    word: 'a blunder',       color: '#F26B6B', glyph: '??' },
};

// Categories whose badge/table text should render DARK (#0B120F) for contrast
// (all others render white):
export const DARK_FG_CODES = ['brilliant', 'best', 'excellent', 'good', 'book', 'inaccuracy'];

// Categories where the played move was NOT the engine's best → draw the
// best-move arrow + "Best was …" strip:
export const NOT_BEST_CODES = ['inaccuracy', 'mistake', 'miss', 'blunder'];

// Coach-card body text (template-comment fallback per OVERVIEW §21.4).
export const coachTextMap = {
  brilliant: "This move creates a strong threat and keeps control of the center. The knight can't be captured without losing material.",
  great: "The strongest move on the board — precise and forcing.",
  best: "Engine's top choice. Nothing better in the position.",
  excellent: "Nearly perfect — it keeps your advantage fully intact.",
  good: "A solid, healthy move that maintains the balance.",
  book: "Still following well-known opening theory.",
  inaccuracy: "A small slip — there was a more accurate continuation here.",
  mistake: "This lets your opponent back into the game.",
  miss: "You overlooked a much stronger tactic in this position.",
  blunder: "A costly error — this swings the evaluation sharply.",
};

// ============ MOCK GAME (the reference review is this Italian Game) ======
// Real source: pgn + analysis + engine_analysis tables (OVERVIEW §9).
export const sanList = ['e4','e5','Nf3','Nc6','Bc4','Bc5','c3','Nf6','d3','d6','O-O','O-O','Re1','a6','Bb3','Ba7','h3','h6','Nbd2','Be6','Bxe6','fxe6','Nf1','Qe7','Ng3','Rad8','d4','exd4','cxd4','d5','Ne5'];

// classification per move (aligned to sanList; length = sanList.length):
export const classCodes = ['book','book','book','book','book','book','best','good','good','good','best','best','good','inaccuracy','best','good','good','good','best','good','good','good','excellent','good','best','good','great','good','best','inaccuracy','brilliant'];

// eval per ply from the mover's side (index 0 = start). Pawns, +White:
export const evalPerPly = [0,0.3,0.2,0.3,0.2,0.3,0.2,0.35,0.25,0.3,0.25,0.3,0.3,0.35,0.1,0.4,0.3,0.35,0.3,0.5,0.4,0.45,0.3,0.7,0.55,0.8,0.7,1.3,1.05,1.5,1.0,2.37];

// engine best move keyed by ply — only present where played move ≠ best:
export const bestMoves = {
  14: { from: 'c8', to: 'g4', san: 'Bg4' },
  30: { from: 'f6', to: 'g4', san: 'Ng4' },
};

// engine PV lines shown in analysis (eval + line, best flagged):
export const engineLines = [
  { eval: '+2.37', moves: '16.Ne5 Bxe5 17.dxe5 Nd7 18.f4', best: true },
  { eval: '+1.98', moves: '16.exd5 exd5 17.Nb3 Bb6 18.Bg5' },
  { eval: '+1.62', moves: '16.Qe2 dxe4 17.dxe4 Qe6 18.Rd1' },
];

// ============ SCREEN DATA (mock — replace with backend queries) =========

// Review tab: move-category breakdown [code, whiteCount, blackCount]:
export const breakdown = [
  ['brilliant',1,2],['great',2,5],['best',22,20],['excellent',13,12],['good',8,12],
  ['book',6,6],['inaccuracy',4,3],['mistake',3,2],['miss',2,1],['blunder',2,1],
];

// Review tab: per-phase best/worst badge [phaseName, whiteCode, blackCode]:
export const phases = [
  ['Opening','great','good'],['Middlegame','best','excellent'],['Endgame','inaccuracy','good'],
];

// Dashboard "Recent games":
export const recentGames = [
  { res: 'W', opp: 'DominikP',      meta: 'Rapid · 10+0 · 5 days ago',  acc: '87.3', win: true },
  { res: 'W', opp: 'ChessMaster89', meta: 'Rapid · 10+0 · 6 days ago',  acc: '92.1', win: true },
  { res: 'L', opp: 'TaktikTiger',   meta: 'Rapid · 15+10 · 1 week ago', acc: '85.4', win: false },
  { res: 'W', opp: 'NordicKnight',  meta: 'Rapid · 10+0 · 1 week ago',  acc: '90.6', win: true },
];

// Opening Explorer repertoire list:
export const openings = [
  { name: 'Italian Game',     wr: 61, games: 75, eval: '+0.42', sel: true, color: '#4ADEA0' },
  { name: 'Scotch Game',      wr: 58, games: 31, eval: '+0.28',            color: '#4ADEA0' },
  { name: "Queen's Gambit",   wr: 54, games: 44, eval: '+0.15',            color: '#8FE9C2' },
  { name: 'Sicilian · as White', wr: 48, games: 52, eval: '\u22120.06',   color: '#F5B14C' },
  { name: 'French Defense',   wr: 42, games: 29, eval: '\u22120.21',       color: '#F97A45' },
];

// Opening Explorer main-line tree [move, freqLabel, winrate, barPct, color]:
export const tree = [
  { move: '3. Bc4',  freq: '68% of games', wr: '63%', pct: 68, color: '#4ADEA0' },
  { move: '3...Bc5', freq: '54% of games', wr: '61%', pct: 54, color: '#4ADEA0' },
  { move: '4. c3',   freq: '47% of games', wr: '64%', pct: 47, color: '#4ADEA0' },
  { move: '4...Nf6', freq: '39% of games', wr: '58%', pct: 39, color: '#8FE9C2' },
];

// Insights skill radar [label, current(0-100), baseline(0-100)] — feed to view-math radar():
export const radarCats = [
  ['Opening',82,78],['Tactics',68,66],['Calc.',71,68],['Conv.',63,60],
  ['Defense',74,70],['Endgame',84,73],['Time',52,56],['Consist.',70,66],
];

// Insights weakness timeline:
export const timeline = [
  { month: 'January',  tag: 'Tactics weak',      note: 'Missed forks in the middlegame.', color: '#F97A45' },
  { month: 'February', tag: 'Opening improved',  note: 'Italian win rate up to 61%.',     color: '#4ADEA0' },
  { month: 'March',    tag: 'Time pressure',     note: 'Blunder rate spiked under 30s.',  color: '#F5B14C' },
  { month: 'April',    tag: 'Endgames sharper',  note: 'Conversion up 11% this window.',  color: '#4ADEA0' },
];

// Training categories [name, count, solvedLabel, color, selected]:
export const trainCategories = [
  { name: 'Knight Forks',            count: 14, solved: '8/14', color: '#A78BFA', sel: true },
  { name: 'Winning Positions Lost',  count: 9,  solved: '3/9',  color: '#F26B6B' },
  { name: 'Time-Pressure Blunders',  count: 22, solved: '5/22', color: '#F5B14C' },
  { name: 'Endgame Technique',       count: 7,  solved: '6/7',  color: '#4ADEA0' },
  { name: 'Opening Mistakes',        count: 18, solved: '9/18', color: '#60A5FA' },
];

// Training spaced-repetition strip states: s=solved(green) l=learning(amber) d=due(grey)
export const srsCells = ['s','s','s','s','s','s','s','s','l','l','l','l','d','d'];

// Dashboard trend chart — pre-scaled pixel Y values (see view-math chartPaths()):
export const trendRatingY = [150,144,148,138,132,136,124,118,122,110,104,100,92,88,80,76,70,66,58,54,46,40,44,34];
export const trendAccY    = [120,118,122,116,112,114,108,110,104,106,100,98,94,96,90,88,84,86,80,78,74,72,70,66];

// Explore/mini board — position after 1.e4 e5 2.Nf3 Nc6 3.Bc4 (piece map):
export const miniPos = {
  a8:['R','b'],b8:['N','b'],c8:['B','b'],d8:['Q','b'],e8:['K','b'],f8:['B','b'],g8:['N','b'],h8:['R','b'],
  a7:['P','b'],b7:['P','b'],c7:['P','b'],d7:['P','b'],f7:['P','b'],g7:['P','b'],h7:['P','b'],
  c6:['N','b'],e5:['P','b'],c4:['B','w'],e4:['P','w'],f3:['N','w'],
  a2:['P','w'],b2:['P','w'],c2:['P','w'],d2:['P','w'],f2:['P','w'],g2:['P','w'],h2:['P','w'],
  a1:['R','w'],b1:['N','w'],c1:['B','w'],d1:['Q','w'],e1:['K','w'],h1:['R','w'],
};

// Training puzzle board (Black to move, knight fork; hint squares g5,d4):
export const trainPos = {
  f8:['R','b'],g8:['K','b'],a7:['P','b'],b7:['P','b'],g7:['P','b'],h7:['P','b'],
  c6:['N','b'],e4:['Q','b'],f3:['N','w'],d3:['P','w'],
  a2:['P','w'],b2:['P','w'],f2:['P','w'],g2:['P','w'],h2:['P','w'],d1:['Q','w'],f1:['R','w'],g1:['K','w'],
};
export const trainHints = ['g5','d4'];

// Two players in the mock review:
export const players = {
  white: { name: 'Jonas',    rating: '1867', initial: 'J', clock: '4:12', accuracy: '82.6', gameRating: '1712' },
  black: { name: 'DominikP', rating: '2043', initial: 'D', clock: '3:47', accuracy: '89.1', gameRating: '1994' },
};
