import { invoke } from '@tauri-apps/api/core';

export interface AnalyzeFenResult {
	evalCp: number;
	isMate: boolean;
	bestMoveUci: string;
	pv: string[];
}

/** Invokes the Rust `analyze_fen` Tauri command (LOGIC.md §7 Phase-0 spike). */
export function analyzeFen(fen: string): Promise<AnalyzeFenResult> {
	return invoke<AnalyzeFenResult>('analyze_fen', { fen });
}
