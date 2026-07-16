import { invoke } from '@tauri-apps/api/core';
import type { Move, Position } from '$lib/board/types';

export interface ParsedGame {
	sanList: string[];
	positions: Position[];
	moves: Move[];
}

/** Invokes the Rust `parse_pgn` Tauri command (LOGIC.md §7/§8; replaces the mock SAN engine). */
export function parsePgn(pgn: string): Promise<ParsedGame> {
	return invoke<ParsedGame>('parse_pgn', { pgn });
}
