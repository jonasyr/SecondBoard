/**
 * ============================================================================
 * TEMPORARY — DEV/QA-ONLY FIXTURE. NOT PRODUCT CODE. DO NOT IMPORT ELSEWHERE.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/chess-mock.js
 * (the mock SAN->position engine) and reference/logic/data.js (the sample
 * Italian Game). LOGIC.md explicitly warns "THIS IS A MOCK... In the REAL
 * app you MUST NOT ship this — replace it with the Rust `pgn` module using
 * `shakmaty`". This file exists ONLY to feed a temporary visual-verification
 * harness in src/routes/+page.svelte so the Board component (Iteration 3)
 * can be pixel-compared against reference/screens/2-*.png and 3-*.png
 * before the real Game Review screen (Iteration 4) replaces this wiring
 * with real backend data. Delete this file once Iteration 4 lands.
 */
import type { ClassCode } from '$lib/types';
import type { Move, Piece, Position } from './types';

const FILES = 'abcdefgh';

function standardBoard(): Position {
	const board: Position = {};
	const back: Piece[0][] = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
	for (let f = 0; f < 8; f++) {
		board[FILES[f] + '1'] = [back[f], 'w'];
		board[FILES[f] + '2'] = ['P', 'w'];
		board[FILES[f] + '8'] = [back[f], 'b'];
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
	b[target] = [piece as Piece[0], color];
	if (from) delete b[from];
	return { from: from!, to: target };
}

function buildGame(sanList: string[]): { positions: Position[]; meta: Move[] } {
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

// Sample Italian Game, copied verbatim from reference/logic/data.js.
const SAN_LIST = [
	'e4',
	'e5',
	'Nf3',
	'Nc6',
	'Bc4',
	'Bc5',
	'c3',
	'Nf6',
	'd3',
	'd6',
	'O-O',
	'O-O',
	'Re1',
	'a6',
	'Bb3',
	'Ba7',
	'h3',
	'h6',
	'Nbd2',
	'Be6',
	'Bxe6',
	'fxe6',
	'Nf1',
	'Qe7',
	'Ng3',
	'Rad8',
	'd4',
	'exd4',
	'cxd4',
	'd5',
	'Ne5'
];

const CLASS_CODES: ClassCode[] = [
	'book',
	'book',
	'book',
	'book',
	'book',
	'book',
	'best',
	'good',
	'good',
	'good',
	'best',
	'best',
	'good',
	'inaccuracy',
	'best',
	'good',
	'good',
	'good',
	'best',
	'good',
	'good',
	'good',
	'excellent',
	'good',
	'best',
	'good',
	'great',
	'good',
	'best',
	'inaccuracy',
	'brilliant'
];

const EVAL_PER_PLY = [
	0, 0.3, 0.2, 0.3, 0.2, 0.3, 0.2, 0.35, 0.25, 0.3, 0.25, 0.3, 0.3, 0.35, 0.1, 0.4, 0.3, 0.35, 0.3,
	0.5, 0.4, 0.45, 0.3, 0.7, 0.55, 0.8, 0.7, 1.3, 1.05, 1.5, 1.0, 2.37
];

const BEST_MOVES: Record<number, Move & { san: string }> = {
	14: { from: 'c8', to: 'g4', san: 'Bg4' },
	30: { from: 'f6', to: 'g4', san: 'Ng4' }
};

const { positions, meta } = buildGame(SAN_LIST);

export const DEV_GAME = {
	positions,
	meta,
	classCodes: CLASS_CODES,
	evalPerPly: EVAL_PER_PLY,
	bestMoves: BEST_MOVES
};
