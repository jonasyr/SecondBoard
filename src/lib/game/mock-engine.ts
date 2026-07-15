/**
 * ============================================================================
 * MOCK — SAN-to-position engine. NOT PRODUCT LOGIC LONG-TERM.
 * ============================================================================
 * Ported verbatim from design_handoff_secondboard/reference/logic/chess-mock.js.
 * LOGIC.md explicitly warns this is a MOCK: "In the REAL app you MUST NOT
 * ship this — replace it with the Rust `pgn` module using `shakmaty`"
 * (README §3, §8; LOGIC.md header table). It feeds the Game Review screen's
 * mock data (Iteration 4, README §11 step 4) until the Rust backend + shakmaty
 * land (README §11 steps 5-6), at which point this file is deleted.
 */
import type { Move, Piece, Position } from '$lib/board/types';

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

export function buildGame(sanList: string[]): { positions: Position[]; meta: Move[] } {
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
