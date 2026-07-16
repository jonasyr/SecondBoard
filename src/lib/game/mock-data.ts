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
import type { Move, Position } from '$lib/board/types';

// Sample Italian Game — the hardcoded game that "Paste sample game" loads
const SAMPLE_SAN_LIST = [
	'e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O',
	'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Be6', 'Bxe6', 'fxe6', 'Nf1',
	'Qe7', 'Ng3', 'Rad8', 'd4', 'exd4', 'cxd4', 'd5', 'Ne5'
];

// Internal helper to build positions and moves from SAN
function buildGame(sanList: string[]): { positions: Position[]; meta: Move[] } {
	const FILES = 'abcdefgh';

	function standardBoard(): Position {
		const board: Position = {};
		const back: string[] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
		for (let f = 0; f < 8; f++) {
			board[FILES[f] + '1'] = [back[f] as any, 'w'];
			board[FILES[f] + '2'] = ['P', 'w'];
			board[FILES[f] + '8'] = [back[f] as any, 'b'];
			board[FILES[f] + '7'] = ['P', 'b'];
		}
		return board;
	}

	function clearPath(b: Position, f: number, r: number, tf: number, tr: number): boolean {
		const sf = Math.sign(tf - f);
		const sr = Math.sign(tr - r);
		let cf = f + sf;
		let cr = r + sr;
		while (cf !== tf || cr !== tr) {
			if (b[FILES[cf] + cr]) return false;
			cf += sf;
			cr += sr;
		}
		return true;
	}

	function canReach(
		b: Position,
		piece: string,
		f: number,
		r: number,
		tf: number,
		tr: number
	): boolean {
		const df = tf - f;
		const dr = tr - r;
		const af = Math.abs(df);
		const ar = Math.abs(dr);
		if (piece === 'N') return (af === 1 && ar === 2) || (af === 2 && ar === 1);
		if (piece === 'K') return af <= 1 && ar <= 1;
		if (piece === 'B') return af === ar && df !== 0 && clearPath(b, f, r, tf, tr);
		if (piece === 'R') return (df === 0 || dr === 0) && clearPath(b, f, r, tf, tr);
		if (piece === 'Q') return (af === ar || df === 0 || dr === 0) && clearPath(b, f, r, tf, tr);
		return false;
	}

	function applySan(b: Position, sanRaw: string, color: 'w' | 'b'): Move {
		let san = sanRaw.replace(/[+#!?]/g, '');
		const rank = color === 'w' ? '1' : '8';
		if (san === 'O-O') {
			b['g' + rank] = b['e' + rank];
			delete b['e' + rank];
			b['f' + rank] = b['h' + rank];
			delete b['h' + rank];
			return { from: 'e' + rank, to: 'g' + rank };
		}
		if (san === 'O-O-O') {
			b['c' + rank] = b['e' + rank];
			delete b['e' + rank];
			b['d' + rank] = b['a' + rank];
			delete b['a' + rank];
			return { from: 'e' + rank, to: 'c' + rank };
		}
		let piece = 'P';
		if ('KQRBN'.indexOf(san[0]) >= 0) {
			piece = san[0];
			san = san.slice(1);
		}
		const capture = san.indexOf('x') >= 0;
		san = san.replace('x', '');
		const target = san.slice(-2);
		san = san.slice(0, -2);
		const tf = FILES.indexOf(target[0]);
		const tr = Number(target[1]);
		let disF: number | null = null;
		let disR: number | null = null;
		for (const ch of san) {
			if (ch >= 'a' && ch <= 'h') disF = FILES.indexOf(ch);
			else if (ch >= '1' && ch <= '8') disR = Number(ch);
		}
		let from: string | null = null;
		if (piece === 'P') {
			if (capture) from = FILES[disF!] + (color === 'w' ? tr - 1 : tr + 1);
			else {
				const one = color === 'w' ? tr - 1 : tr + 1;
				const oneSq = b[FILES[tf] + one];
				if (oneSq && oneSq[0] === 'P') from = FILES[tf] + one;
				else from = FILES[tf] + (color === 'w' ? tr - 2 : tr + 2);
			}
		} else {
			for (const sq in b) {
				const p = b[sq];
				if (p[0] !== piece || p[1] !== color) continue;
				const f = FILES.indexOf(sq[0]);
				const r = Number(sq[1]);
				if (!canReach(b, piece, f, r, tf, tr)) continue;
				if (disF != null && f !== disF) continue;
				if (disR != null && r !== disR) continue;
				from = sq;
				break;
			}
		}
		delete b[target];
		b[target] = [piece as any, color];
		if (from) delete b[from];
		return { from: from!, to: target };
	}

	const b = standardBoard();
	const positions: Position[] = [{ ...b }];
	const meta: Move[] = [];
	let color: 'w' | 'b' = 'w';
	for (const san of sanList) {
		const m = applySan(b, san, color);
		positions.push({ ...b });
		meta.push(m);
		color = color === 'w' ? 'b' : 'w';
	}
	return { positions, meta };
}

const sampleGame = buildGame(SAMPLE_SAN_LIST);

// Sample game data — re-exported for test setup
export const SAMPLE_SAN_LIST_EXPORT = SAMPLE_SAN_LIST;
export const SAMPLE_POSITIONS = sampleGame.positions;
export const SAMPLE_MOVE_META = sampleGame.meta;

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

export const PHASE_ROWS: Array<[string, ClassCode, ClassCode]> = [
	['Opening', 'great', 'good'],
	['Middlegame', 'best', 'excellent'],
	['Endgame', 'inaccuracy', 'good']
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

