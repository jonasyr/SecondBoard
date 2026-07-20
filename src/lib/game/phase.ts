/**
 * Real game-phase (opening/middlegame/endgame) boundary detection, replacing
 * mock-data.ts's fully-mocked PHASE_ROWS. Faithfully ported from lichess's
 * open-source `Divider` (Scala): https://github.com/lichess-org/scalachess/blob/master/core/src/main/scala/Divider.scala
 * (fetched and verified 2026-07-21). Confirmed by lichess founder Thibault,
 * on the lichess feedback forum, as the actual algorithm lichess uses to
 * answer "how does lichess determine the phase of a game."
 *
 * This module operates on this codebase's `Position` shape (square -> piece)
 * instead of scalachess's bitboards, but is otherwise a line-for-line port:
 * same thresholds, same back-rank check, same hand-tuned "mixedness" scoring
 * table (copied verbatim, including its literal duplication of the (3,0) and
 * (4,0) score-table cases -- not a bug we should "fix", since fixing it would
 * make this no longer match lichess's actual behavior).
 */
import type { Piece, Position, Square } from '$lib/board/types';
import { computeGameAccuracy, type Wdl } from './accuracy';

const FILES = 'abcdefgh';

function fileOf(square: Square): number {
	return FILES.indexOf(square[0]);
}

function rankOf(square: Square): number {
	return Number(square[1]);
}

/** `Divider.majorsAndMinors`: every piece except kings and pawns, both colors combined. */
function majorsAndMinors(position: Position): number {
	let count = 0;
	for (const [type] of Object.values(position)) {
		if (type !== 'K' && type !== 'P') count++;
	}
	return count;
}

/** `Divider.backrankSparse`: true once either side has fewer than 4 pieces
 * left on its own home rank (any piece type, not just the original back-rank
 * ones -- this is "how many pieces currently occupy that rank", a proxy for
 * "pieces have developed/castled off the back rank"). */
function backrankSparse(position: Position): boolean {
	let whiteOnRank1 = 0;
	let blackOnRank8 = 0;
	for (const [square, piece] of Object.entries(position) as Array<[Square, Piece]>) {
		const rank = rankOf(square);
		if (rank === 1 && piece[1] === 'w') whiteOnRank1++;
		if (rank === 8 && piece[1] === 'b') blackOnRank8++;
	}
	return whiteOnRank1 < 4 || blackOnRank8 < 4;
}

/** `Divider.score`: hand-tuned lookup table for one 2x2 board region's
 * "mixedness" contribution, given how many white/black pieces (of any type)
 * occupy it and the region's row position (`y`, 1-7). Copied verbatim from
 * the Scala source's `@switch` match -- see this file's header comment. */
function regionScore(y: number, white: number, black: number): number {
	if (white === 0 && black === 0) return 0;
	if (white === 1 && black === 0) return 1 + (8 - y);
	if (white === 2 && black === 0) return y > 2 ? 2 + (y - 2) : 0;
	if (white === 3 && black === 0) return y > 1 ? 3 + (y - 1) : 0;
	if (white === 4 && black === 0) return y > 1 ? 3 + (y - 1) : 0;
	if (white === 0 && black === 1) return 1 + y;
	if (white === 1 && black === 1) return 5 + Math.abs(4 - y);
	if (white === 2 && black === 1) return 4 + (y - 1);
	if (white === 3 && black === 1) return 5 + (y - 1);
	if (white === 0 && black === 2) return y < 6 ? 2 + (6 - y) : 0;
	if (white === 1 && black === 2) return 4 + (7 - y);
	if (white === 2 && black === 2) return 7;
	if (white === 0 && black === 3) return y < 7 ? 3 + (7 - y) : 0;
	if (white === 1 && black === 3) return 5 + (7 - y);
	if (white === 0 && black === 4) return y < 7 ? 3 + (7 - y) : 0;
	return 0;
}

/** `Divider.mixedness`: sum of `regionScore` over all 49 overlapping 2x2
 * regions of the board (a 7x7 grid of region top-left corners, files/ranks
 * offset 0-6). Higher values mean white and black pieces are interleaved
 * together rather than clustered on their own halves -- a proxy for an
 * active middlegame. */
function mixedness(position: Position): number {
	const entries = Object.entries(position) as Array<[Square, Piece]>;
	let total = 0;
	for (let yOffset = 0; yOffset <= 6; yOffset++) {
		for (let xOffset = 0; xOffset <= 6; xOffset++) {
			let white = 0;
			let black = 0;
			for (const [square, piece] of entries) {
				const file = fileOf(square);
				const rank = rankOf(square);
				if (file >= xOffset && file <= xOffset + 1 && rank >= yOffset + 1 && rank <= yOffset + 2) {
					if (piece[1] === 'w') white++;
					else black++;
				}
			}
			total += regionScore(yOffset + 1, white, black);
		}
	}
	return total;
}

const MAJORS_MINORS_MIDGAME = 10;
const MAJORS_MINORS_ENDGAME = 6;
const MIXEDNESS_MIDGAME = 150;

export interface PhaseDivision {
	/** Ply index (into the same `positions[]` array passed in) where the
	 * middlegame begins, or `null` if the game never left the opening. */
	middlePly: number | null;
	/** Ply index where the endgame begins, or `null` if the game never
	 * reaches the endgame material threshold (or never reached a midgame). */
	endPly: number | null;
	totalPlies: number;
}

/**
 * Finds a game's opening/middlegame/endgame ply boundaries. `positions[0]`
 * is the starting position; `positions.length - 1` is the last ply reached.
 * Faithful port of `Divider.apply` -- see this file's header comment.
 */
export function dividePhases(positions: Position[]): PhaseDivision {
	let midGame: number | null = null;
	for (let ply = 0; ply < positions.length; ply++) {
		const position = positions[ply];
		if (
			majorsAndMinors(position) <= MAJORS_MINORS_MIDGAME ||
			backrankSparse(position) ||
			mixedness(position) > MIXEDNESS_MIDGAME
		) {
			midGame = ply;
			break;
		}
	}

	let endGame: number | null = null;
	if (midGame !== null) {
		for (let ply = 0; ply < positions.length; ply++) {
			if (majorsAndMinors(positions[ply]) <= MAJORS_MINORS_ENDGAME) {
				endGame = ply;
				break;
			}
		}
	}

	const middlePly = midGame !== null && (endGame === null || midGame < endGame) ? midGame : null;

	return { middlePly, endPly: endGame, totalPlies: positions.length };
}

/**
 * Which of the 3 existing chess.com-style classification badges to show for
 * a phase's accuracy. Reuses the existing `best`/`good`/`inaccuracy`
 * ClassCode/TOKENS.classification entries (green star / green check / amber
 * "?!") rather than inventing new icons. chess.com's own real thresholds for
 * its Opening/Middlegame/Endgame phase icons are NOT publicly documented
 * anywhere (confirmed via chess.com's own support articles and forum threads
 * -- a chess.com moderator, asked directly, replied "I'm not seeing anything
 * documented. I'm asking about it") -- these thresholds are SecondBoard's own
 * design choice, not a chess.com or lichess port.
 */
export type PhaseBadgeCode = 'best' | 'good' | 'inaccuracy';

const PHASE_BEST_THRESHOLD = 90;
const PHASE_GOOD_THRESHOLD = 75;

function phaseBadgeCode(accuracy: number): PhaseBadgeCode {
	if (accuracy >= PHASE_BEST_THRESHOLD) return 'best';
	if (accuracy >= PHASE_GOOD_THRESHOLD) return 'good';
	return 'inaccuracy';
}

export interface PhaseRow {
	name: 'Opening' | 'Middlegame' | 'Endgame';
	white: { code: PhaseBadgeCode; accuracy: number } | null;
	black: { code: PhaseBadgeCode; accuracy: number } | null;
}

/**
 * Real per-phase, per-side accuracy and badge rows, replacing mock-data.ts's
 * PHASE_ROWS. Phase boundaries come from `dividePhases` (Task 1, a lichess
 * `Divider` port); each phase's accuracy reuses this codebase's existing
 * lichess-ported `computeGameAccuracy`, applied only to that phase's ply
 * range (via `startPly` so mover-color attribution stays correct across the
 * slice boundary -- see accuracy.ts). This composition -- computing accuracy
 * separately per phase bucket -- is SecondBoard's own design choice; lichess
 * itself only exposes a similar per-phase breakdown in its separate,
 * account-gated "Insights" feature, whose exact source could not be
 * confirmed this session.
 */
export function getPhaseRows(
	positions: Position[],
	evalPerPly: number[],
	wdlPerPly?: (Wdl | null)[]
): PhaseRow[] {
	const division = dividePhases(positions);
	const openingEnd = division.middlePly ?? division.totalPlies;
	const middleEnd = division.endPly ?? division.totalPlies;

	const ranges: Array<[PhaseRow['name'], number, number]> = [
		['Opening', 0, openingEnd],
		['Middlegame', openingEnd, middleEnd],
		['Endgame', middleEnd, division.totalPlies]
	];

	return ranges.map(([name, start, end]) => {
		const { white, black } = computeGameAccuracy(
			evalPerPly.slice(start, end),
			wdlPerPly?.slice(start, end),
			start
		);
		return {
			name,
			white: white === null ? null : { code: phaseBadgeCode(white), accuracy: white },
			black: black === null ? null : { code: phaseBadgeCode(black), accuracy: black }
		};
	});
}
