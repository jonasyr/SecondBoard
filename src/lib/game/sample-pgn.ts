/** The one built-in sample game (Italian Game) — the only PGN with matching
 * mock classification/coach-text/breakdown data in mock-data.ts. Shared
 * between OnboardingScreen.svelte (the "Paste sample game" button) and
 * app-state.svelte.ts (to detect isSample via exact-text comparison). */
export const SAMPLE_PGN =
	'[Event "Live Rapid"]\n[Site "Chess.com"]\n[White "Jonas"]\n[Black "DominikP"]\n[Result "0-1"]\n[WhiteElo "1867"]\n[BlackElo "2043"]\n[TimeControl "600"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d3 d6 6. O-O O-O\n7. Re1 a6 8. Bb3 Ba7 9. h3 h6 10. Nbd2 Be6 11. Bxe6 fxe6\n12. Nf1 Qe7 13. Ng3 Rad8 14. d4 exd4 15. cxd4 d5 16. Ne5';
