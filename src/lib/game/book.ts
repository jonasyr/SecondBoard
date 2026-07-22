import openingsData from '$lib/data/openings.json';

export interface OpeningEntry {
	eco: string;
	name: string;
	sanMoves: string[];
}

interface TrieNode {
	children: Map<string, TrieNode>;
}

/**
 * Builds a trie over every opening's SAN move sequence. Depth is measured by
 * continuation existence in the WHOLE trie, not by whether a prefix is
 * itself a catalogued row's exact endpoint -- a game can be genuine book
 * theory past the point where any single named opening ends, as long as
 * some other row shares that continuation.
 */
export function buildOpeningTrie(openings: OpeningEntry[]): TrieNode {
	const root: TrieNode = { children: new Map() };
	for (const opening of openings) {
		let node = root;
		for (const san of opening.sanMoves) {
			let next = node.children.get(san);
			if (!next) {
				next = { children: new Map() };
				node.children.set(san, next);
			}
			node = next;
		}
	}
	return root;
}

let cachedTrie: TrieNode | null = null;
function defaultTrie(): TrieNode {
	if (!cachedTrie) cachedTrie = buildOpeningTrie(openingsData as OpeningEntry[]);
	return cachedTrie;
}

/**
 * Walks `sanMoves` through `trie` (the real lichess dataset by default) one
 * ply at a time, returning the count of plies matched before the first
 * mismatch or before the trie runs out of continuations.
 */
export function findBookDepth(sanMoves: string[], trie: TrieNode = defaultTrie()): number {
	let node = trie;
	let depth = 0;
	for (const san of sanMoves) {
		const next = node.children.get(san);
		if (!next) break;
		node = next;
		depth++;
	}
	return depth;
}
