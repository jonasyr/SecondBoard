export interface OpeningBookMatch {
	code: string;
	name: string;
	depth: number;
	score: number;
}

export interface CalibrationPosition {
	/** 0 = starting position (no move played yet, classificationName is null). */
	ply: number;
	color: 'white' | 'black' | null;
	/** chess.com's raw label, e.g. "book", "forced", "greatFind", "blunder". */
	classificationName: string | null;
	playedMoveLan: string | null;
	difference: number | null;
	caps2: number | null;
}

export interface CalibrationFixture {
	url: string;
	gameId: string;
	capturedAt: string;
	pgn: string;
	analysisEngine: string;
	book: OpeningBookMatch | null;
	bookPly: number | null;
	tallies: { white: Record<string, number>; black: Record<string, number> };
	positions: CalibrationPosition[];
}
