/**
 * Pure board-geometry math, ported verbatim from
 * design_handoff_secondboard/reference/logic/view-math.js (marked there as
 * "NOT MOCKS — reusable as-is"). Only the board-relevant functions are
 * ported here; evalGraph/radar/chartPaths land with the charts that use
 * them in later iterations.
 */
import type { Piece, PieceColor, PieceType, Position, Square } from './types';

const FILES = 'abcdefgh';

export interface Point {
	x: number;
	y: number;
}

/** Maps a square to its pixel center in the 600x600 board viewBox (75 units/square). */
export function center(sq: Square, flipped: boolean): Point {
	const f = FILES.indexOf(sq[0]);
	const r = Number(sq[1]);
	const col = flipped ? 7 - f : f;
	const rowTop = flipped ? r - 1 : 8 - r;
	return { x: col * 75 + 37.5, y: rowTop * 75 + 37.5 };
}

export interface ArrowGeometry {
	shaft: string;
	head: string;
}

/**
 * Best-move arrow geometry. w = shaft width (Board.svelte always passes 11,
 * matching the reference's stroke-width). Knight moves bend at a right
 * angle; everything else is a straight shaft with a shortened tail/head so
 * the polygon arrowhead doesn't overlap the piece sprites.
 */
export function arrowGeom(fromSq: Square, toSq: Square, w: number, flipped: boolean): ArrowGeometry {
	const a = center(fromSq, flipped);
	const b = center(toSq, flipped);
	const df = FILES.indexOf(toSq[0]) - FILES.indexOf(fromSq[0]);
	const dr = Number(toSq[1]) - Number(fromSq[1]);
	const knight = (Math.abs(df) === 1 && Math.abs(dr) === 2) || (Math.abs(df) === 2 && Math.abs(dr) === 1);
	const P = (x: number, y: number) => x.toFixed(1) + ' ' + y.toFixed(1);
	const headLen = w * 1.7;
	const headHalf = w * 1.25;

	if (knight) {
		const bend = Math.abs(dr) > Math.abs(df) ? { x: a.x, y: b.y } : { x: b.x, y: a.y };
		const lx = b.x - bend.x;
		const ly = b.y - bend.y;
		const ll = Math.hypot(lx, ly);
		const ux = lx / ll;
		const uy = ly / ll;
		const pxp = -uy;
		const pyp = ux;
		const se = { x: b.x - ux * headLen, y: b.y - uy * headLen };
		return {
			shaft: 'M' + P(a.x, a.y) + ' L' + P(bend.x, bend.y) + ' L' + P(se.x, se.y),
			head:
				P(b.x, b.y) +
				' ' +
				P(se.x + pxp * headHalf, se.y + pyp * headHalf) +
				' ' +
				P(se.x - pxp * headHalf, se.y - pyp * headHalf)
		};
	}

	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const L = Math.hypot(dx, dy);
	const ux = dx / L;
	const uy = dy / L;
	const pxp = -uy;
	const pyp = ux;
	const se = { x: b.x - ux * headLen, y: b.y - uy * headLen };
	const st = { x: a.x + ux * (w * 0.2), y: a.y + uy * (w * 0.2) };
	return {
		shaft: 'M' + P(st.x, st.y) + ' L' + P(se.x, se.y),
		head:
			P(b.x, b.y) +
			' ' +
			P(se.x + pxp * headHalf, se.y + pyp * headHalf) +
			' ' +
			P(se.x - pxp * headHalf, se.y - pyp * headHalf)
	};
}

export interface CapturedInfo {
	whiteCap: Array<{ color: PieceColor; type: PieceType }>;
	blackCap: Array<{ color: PieceColor; type: PieceType }>;
	/** Net material advantage in points; positive = White is up. */
	adv: number;
}

const START_EACH: Record<Exclude<PieceType, 'K'>, number> = { P: 8, N: 2, B: 2, R: 2, Q: 1 };
const PIECE_VALUE: Record<Exclude<PieceType, 'K'>, number> = { P: 1, N: 3, B: 3, R: 5, Q: 9 };
const CAPTURE_ORDER: Array<Exclude<PieceType, 'K'>> = ['Q', 'R', 'B', 'N', 'P'];

/** Diffs a position against the full starting army to derive captured material. */
export function capturedInfo(pos: Position): CapturedInfo {
	const cnt: Record<PieceColor, Partial<Record<PieceType, number>>> = { w: {}, b: {} };
	for (const sq in pos) {
		const p: Piece = pos[sq];
		cnt[p[1]][p[0]] = (cnt[p[1]][p[0]] ?? 0) + 1;
	}
	const whiteCap: CapturedInfo['whiteCap'] = [];
	const blackCap: CapturedInfo['blackCap'] = [];
	for (const t of CAPTURE_ORDER) {
		for (let i = 0; i < START_EACH[t] - (cnt.b[t] ?? 0); i++) whiteCap.push({ color: 'b', type: t });
		for (let i = 0; i < START_EACH[t] - (cnt.w[t] ?? 0); i++) blackCap.push({ color: 'w', type: t });
	}
	let wMat = 0;
	let bMat = 0;
	for (const t of CAPTURE_ORDER) {
		wMat += (cnt.w[t] ?? 0) * PIECE_VALUE[t];
		bMat += (cnt.b[t] ?? 0) * PIECE_VALUE[t];
	}
	return { whiteCap, blackCap, adv: wMat - bMat };
}

/** White's fill fraction (0-100) of the eval bar, clamped to ±44 around 50. */
export function evalBarPct(evNum: number): number {
	return 50 + Math.max(-44, Math.min(44, (evNum / 8) * 44));
}
