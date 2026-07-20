/**
 * ============================================================================
 * MOCK CONTENT — describes ONLY the built-in sample game (the Italian Game
 * shown by "Paste sample game"), applied by review.ts ONLY when the currently
 * loaded game is verified byte-identical to that sample PGN (`GameData.isSample`,
 * Iteration 6). A genuinely different real pasted/typed PGN gets real positions
 * and moves (src-tauri/src/pgn.rs via shakmaty) but none of this classification/
 * coach-text/breakdown/phase/player content, since none of it can honestly
 * apply to a game these arrays were never computed from.
 * ============================================================================
 * classCodes/evalPerPly/bestMoves/coachTextMap/breakdown/phases stand in for
 * Rust analysis+engine output (README §8 mapping table) — real move
 * classification is a later iteration (OVERVIEW §11's centipawn-loss/accuracy
 * formulas are not implemented yet). players stands in for backend-computed
 * screen content (same table) — real player names/ratings from PGN tags are
 * also a later iteration. CLS itself (name/word/color/glyph) is NOT mock —
 * that already lives in TOKENS.classification (src/lib/tokens.ts) and must
 * not be redeclared here.
 */
import type { ClassCode } from '$lib/types';
import type { Move } from '$lib/board/types';

export const CLASS_CODES: ClassCode[] = [
	'book', 'book', 'book', 'book', 'book', 'book', 'best', 'good', 'good', 'good',
	'best', 'best', 'good', 'inaccuracy', 'best', 'good', 'good', 'good', 'best',
	'good', 'good', 'good', 'excellent', 'good', 'best', 'good', 'great', 'good',
	'best', 'inaccuracy', 'brilliant'
];

export const EVAL_PER_PLY = [
	0, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.35, 0.25, 0.3, 0.25, 0.3, 0.3, 0.35, 0.1,
	0.4, 0.3, 0.35, 0.3, 0.5, 0.4, 0.45, 0.3, 0.7, 0.55, 0.8, 0.7, 1.3, 1.05, 1.5,
	1.0, 2.37
];

export const BEST_MOVES: Record<number, Move & { san: string }> = {
	14: { from: 'c8', to: 'g4', san: 'Bg4' },
	30: { from: 'f6', to: 'g4', san: 'Ng4' }
};

export const COACH_TEXT_MAP: Record<ClassCode, string> = {
	brilliant:
		"This move creates a strong threat and keeps control of the center. The knight can't be captured without losing material.",
	great: 'The strongest move on the board — precise and forcing.',
	best: "Engine's top choice. Nothing better in the position.",
	excellent: 'Nearly perfect — it keeps your advantage fully intact.',
	good: 'A solid, healthy move that maintains the balance.',
	book: 'Still following well-known opening theory.',
	inaccuracy: 'A small slip — there was a more accurate continuation here.',
	mistake: 'This lets your opponent back into the game.',
	miss: 'You overlooked a much stronger tactic in this position.',
	blunder: 'A costly error — this swings the evaluation sharply.'
};

export const BREAKDOWN_ROWS: Array<[ClassCode, number, number]> = [
	['brilliant', 1, 2],
	['great', 2, 5],
	['best', 22, 20],
	['excellent', 13, 12],
	['good', 8, 12],
	['book', 6, 6],
	['inaccuracy', 4, 3],
	['mistake', 3, 2],
	['miss', 2, 1],
	['blunder', 2, 1]
];

export interface PlayerInfo {
	name: string;
	rating: string;
	initial: string;
	clock: string;
	accuracy: string;
	gameRating: string;
}

export const PLAYERS: { white: PlayerInfo; black: PlayerInfo } = {
	white: {
		name: 'Jonas',
		rating: '1867',
		initial: 'J',
		clock: '4:12',
		accuracy: '82.6',
		gameRating: '1712'
	},
	black: {
		name: 'DominikP',
		rating: '2043',
		initial: 'D',
		clock: '3:47',
		accuracy: '89.1',
		gameRating: '1994'
	}
};
