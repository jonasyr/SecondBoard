import { invoke } from '@tauri-apps/api/core';

export interface ParsedGame {
	sanList: string[];
	positions: Array<Record<string, [string, string]>>;
	moves: Array<{ from: string; to: string }>;
}

/** Invokes the Rust `parse_pgn` Tauri command (LOGIC.md §7/§8; replaces the mock SAN engine). */
export function parsePgn(pgn: string): Promise<ParsedGame> {
	return invoke<ParsedGame>('parse_pgn', { pgn });
}
