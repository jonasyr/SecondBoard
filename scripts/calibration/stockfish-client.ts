// scripts/calibration/stockfish-client.ts
// Minimal UCI client mirroring src-tauri/src/engine.rs's own setup
// (UCI_ShowWDL, `go movetime`), for use ONLY by the calibration scripts --
// the shipped app still analyzes exclusively through the Rust/Tauri engine
// module; this is a standalone duplicate sufficient for offline batch
// analysis outside the Tauri runtime.
import { spawn } from 'node:child_process';

export interface UciEval {
	cp: number | null;
	mate: number | null;
	wdl: [number, number, number] | null;
}

export function analyzeFen(fen: string, movetimeMs = 500): Promise<UciEval> {
	return new Promise((resolve, reject) => {
		const proc = spawn('stockfish');
		let buffer = '';
		let lastEval: UciEval = { cp: null, mate: null, wdl: null };

		proc.stdout.on('data', (chunk: Buffer) => {
			buffer += chunk.toString();
			const lines = buffer.split('\n');
			buffer = lines.pop() ?? '';
			for (const line of lines) {
				if (line.startsWith('info') && line.includes(' score ')) {
					const cpMatch = line.match(/score cp (-?\d+)/);
					const mateMatch = line.match(/score mate (-?\d+)/);
					const wdlMatch = line.match(/wdl (\d+) (\d+) (\d+)/);
					if (cpMatch) lastEval = { ...lastEval, cp: Number(cpMatch[1]), mate: null };
					if (mateMatch) lastEval = { ...lastEval, mate: Number(mateMatch[1]), cp: null };
					if (wdlMatch) {
						lastEval = {
							...lastEval,
							wdl: [Number(wdlMatch[1]), Number(wdlMatch[2]), Number(wdlMatch[3])]
						};
					}
				}
				if (line.startsWith('bestmove')) {
					proc.stdin.write('quit\n');
					resolve(lastEval);
				}
			}
		});
		proc.on('error', reject);
		proc.stdin.write('uci\n');
		proc.stdin.write('setoption name UCI_ShowWDL value true\n');
		proc.stdin.write('isready\n');
		proc.stdin.write(`position fen ${fen}\n`);
		proc.stdin.write(`go movetime ${movetimeMs}\n`);
	});
}
