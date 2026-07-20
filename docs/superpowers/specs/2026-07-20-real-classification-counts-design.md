# Real Move Classification Counts

## Goal

Replace the Review tab's fixed mock classification counts with counts derived from the real per-move classifications already produced after Stockfish analysis.

## Scope

- Count each entry in the existing `classCodes` array for White or Black.
- Treat array index 0 as White's first move, index 1 as Black's first move, and alternate thereafter.
- Keep the current ten-row visual order.
- Show zero for classifications the current classifier does not produce, including Brilliant, Great, Book, and Miss.
- Show zero counts before analysis has produced classifications.
- Leave phase ratings and phase detection unchanged.
- Do not add special classification heuristics.

## Design

Add a pure game-layer aggregation helper that returns the existing breakdown row shape. `ReviewTab` derives rows from its `classCodes` input and passes them explicitly to `BreakdownTable`. `BreakdownTable` renders the supplied rows and no longer imports mock counts.

Keeping aggregation outside the component makes mover attribution independently testable and avoids coupling the table to global application state.

## Testing

- Unit-test correct White/Black attribution across alternating plies.
- Unit-test zero values for absent and unsupported classifications.
- Component-test that `BreakdownTable` renders supplied values rather than mock data.
- Run the focused tests, then the project validation suite.

