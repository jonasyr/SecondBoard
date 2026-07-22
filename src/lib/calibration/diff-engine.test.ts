import { describe, it, expect } from 'vitest';
import { mapChesscomLabel, diffClassifications, aggregateDiffResults } from './diff-engine';

describe('mapChesscomLabel', () => {
	it('maps "greatFind" to our "great" ClassCode', () => {
		expect(mapChesscomLabel('greatFind')).toBe('great');
	});

	it('passes through identically-named labels unchanged', () => {
		expect(mapChesscomLabel('book')).toBe('book');
		expect(mapChesscomLabel('forced')).toBe('forced');
		expect(mapChesscomLabel('blunder')).toBe('blunder');
	});

	it('returns null for the starting position (null label) and unrecognized labels', () => {
		expect(mapChesscomLabel(null)).toBeNull();
		expect(mapChesscomLabel('tricky')).toBeNull();
	});
});

describe('diffClassifications', () => {
	it('counts exact matches and builds a confusion matrix', () => {
		const result = diffClassifications(
			'game-1',
			['best', 'book', 'blunder'],
			['best', 'book', 'mistake'],
			['e2e4', 'e7e5', 'd2d4']
		);

		expect(result.exactMatchRate).toBeCloseTo(2 / 3);
		expect(result.confusionMatrix.best.best).toBe(1);
		expect(result.confusionMatrix.book.book).toBe(1);
		expect(result.confusionMatrix.blunder.mistake).toBe(1);
	});

	it('records every mismatch with its game/ply/move context', () => {
		const result = diffClassifications('game-1', ['blunder'], ['mistake'], ['d2d4']);

		expect(result.mismatches).toEqual([
			{ gameSlug: 'game-1', ply: 1, moveLan: 'd2d4', ours: 'blunder', chesscom: 'mistake' }
		]);
	});

	it('skips plies where either side has no classification (e.g. an unmapped label)', () => {
		const result = diffClassifications('game-1', ['best', null], ['best', 'book'], ['e2e4', null]);

		expect(result.mismatches).toEqual([]);
		expect(result.exactMatchRate).toBe(1);
	});
});

describe('aggregateDiffResults', () => {
	it('merges confusion matrices and mismatch lists across multiple games', () => {
		const gameA = diffClassifications('game-a', ['best'], ['best'], ['e2e4']);
		const gameB = diffClassifications('game-b', ['blunder'], ['mistake'], ['d2d4']);

		const aggregate = aggregateDiffResults([gameA, gameB]);

		expect(aggregate.confusionMatrix.best.best).toBe(1);
		expect(aggregate.confusionMatrix.blunder.mistake).toBe(1);
		expect(aggregate.mismatches).toHaveLength(1);
		expect(aggregate.exactMatchRate).toBeCloseTo(0.5);
	});
});
