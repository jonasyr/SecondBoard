import { describe, it, expect } from 'vitest';
import { buildOpeningTrie, findBookDepth } from './book';

const SYNTHETIC_OPENINGS = [
	{ eco: 'B00', name: 'Test Line A', sanMoves: ['e4', 'e5', 'Nf3', 'Nc6'] },
	{ eco: 'B01', name: 'Test Line B', sanMoves: ['e4', 'c5'] }
];

describe('findBookDepth', () => {
	it('matches a full known line exactly', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth(['e4', 'e5', 'Nf3', 'Nc6'], trie)).toBe(4);
	});

	it('matches only the shared prefix when the game diverges from every catalogued line', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth(['e4', 'e5', 'Nf3', 'Bc4'], trie)).toBe(3);
	});

	it('returns 0 when the very first move is not catalogued', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth(['d4', 'd5'], trie)).toBe(0);
	});

	it('returns 0 for an empty move list', () => {
		const trie = buildOpeningTrie(SYNTHETIC_OPENINGS);
		expect(findBookDepth([], trie)).toBe(0);
	});

	it('matches past a shorter catalogued line when a longer one shares the same prefix', () => {
		// Line B ends at "e4 c5", but a third, longer line shares that exact
		// prefix -- depth is measured by continuation existence in the whole
		// trie, not by whether the prefix is itself a full catalogued row.
		const trie = buildOpeningTrie([
			...SYNTHETIC_OPENINGS,
			{ eco: 'B02', name: 'Test Line C', sanMoves: ['e4', 'c5', 'Nf3'] }
		]);
		expect(findBookDepth(['e4', 'c5', 'Nf3'], trie)).toBe(3);
	});
});
