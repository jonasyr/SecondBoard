import type { ClassCode } from '$lib/types';

const CHESSCOM_LABEL_TO_CLASS_CODE: Record<string, ClassCode> = {
	brilliant: 'brilliant',
	greatFind: 'great',
	best: 'best',
	excellent: 'excellent',
	good: 'good',
	book: 'book',
	forced: 'forced',
	inaccuracy: 'inaccuracy',
	mistake: 'mistake',
	miss: 'miss',
	blunder: 'blunder'
};

/**
 * Maps chess.com's raw `classificationName` string (from a captured fixture)
 * to this codebase's `ClassCode`. Returns null for a null label (the
 * starting position) or an unrecognized one (e.g. "tricky", which appears in
 * `tallies` but was never observed on a real `positions[]` entry in the
 * reconnaissance capture this schema is drawn from).
 */
export function mapChesscomLabel(label: string | null): ClassCode | null {
	if (label === null) return null;
	return CHESSCOM_LABEL_TO_CLASS_CODE[label] ?? null;
}

export interface Mismatch {
	gameSlug: string;
	ply: number;
	moveLan: string | null;
	ours: ClassCode;
	chesscom: ClassCode;
}

export type ConfusionMatrix = Record<string, Record<string, number>>;

export interface DiffResult {
	confusionMatrix: ConfusionMatrix;
	mismatches: Mismatch[];
	exactMatchRate: number;
}

/**
 * Aligns two per-ply `ClassCode` arrays (ours vs. chess.com's, both already
 * mapped to this codebase's `ClassCode`, both indexed by ply starting at ply
 * 1 -- i.e. `ours[0]`/`chesscom[0]` are ply 1) and produces a confusion
 * matrix plus a flat mismatch list. `null` entries (no classification on
 * either side, e.g. an unmapped chess.com label) are skipped entirely rather
 * than counted as either a match or a mismatch.
 */
export function diffClassifications(
	gameSlug: string,
	ours: (ClassCode | null)[],
	chesscom: (ClassCode | null)[],
	moveLans: (string | null)[]
): DiffResult {
	const confusionMatrix: ConfusionMatrix = {};
	const mismatches: Mismatch[] = [];
	let matches = 0;
	let total = 0;

	for (let i = 0; i < ours.length; i++) {
		const ourCode = ours[i];
		const theirCode = chesscom[i];
		if (ourCode === null || theirCode === null) continue;

		total++;
		confusionMatrix[ourCode] ??= {};
		confusionMatrix[ourCode][theirCode] = (confusionMatrix[ourCode][theirCode] ?? 0) + 1;

		if (ourCode === theirCode) {
			matches++;
		} else {
			mismatches.push({
				gameSlug,
				ply: i + 1,
				moveLan: moveLans[i] ?? null,
				ours: ourCode,
				chesscom: theirCode
			});
		}
	}

	return { confusionMatrix, mismatches, exactMatchRate: total === 0 ? 0 : matches / total };
}

/**
 * Merges multiple per-game `DiffResult`s into one aggregate report -- the
 * confusion matrix "aggregated across all captured games" the design spec
 * calls for.
 */
export function aggregateDiffResults(results: DiffResult[]): DiffResult {
	const confusionMatrix: ConfusionMatrix = {};
	const mismatches: Mismatch[] = [];
	let matches = 0;
	let total = 0;

	for (const result of results) {
		mismatches.push(...result.mismatches);
		for (const [ourCode, row] of Object.entries(result.confusionMatrix)) {
			confusionMatrix[ourCode] ??= {};
			for (const [theirCode, count] of Object.entries(row)) {
				confusionMatrix[ourCode][theirCode] = (confusionMatrix[ourCode][theirCode] ?? 0) + count;
				matches += ourCode === theirCode ? count : 0;
				total += count;
			}
		}
	}

	return { confusionMatrix, mismatches, exactMatchRate: total === 0 ? 0 : matches / total };
}
