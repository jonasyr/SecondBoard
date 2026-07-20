# Chess.com Classification Icons and Colors

## Goal

Use the supplied Chess.com analysis SVG replicas and their exact embedded colors for move-classification symbols and highlights throughout Game Review.

## Asset location

Move `docs/ChessComAnalysisIcons` to `src/lib/assets/chesscom-analysis-icons`. Runtime code imports the SVG files through Vite URL imports, so only referenced icons are bundled while the complete source collection remains organized outside documentation.

## Classification mapping

| Classification | SVG | Color |
| --- | --- | --- |
| Brilliant | `brilliant.svg` | `#1bada6` |
| Great | `great_find.svg` | `#1bada6` |
| Best | `best.svg` | `#96bc4b` |
| Excellent | `excellent.svg` | `#96bc4b` |
| Good | `good.svg` | `#96af8b` |
| Book | `book.svg` | `#a88865` |
| Inaccuracy | `inaccuracy.svg` | `#f7c045` |
| Mistake | `mistake.svg` | `#e58f2a` |
| Miss | `missed_win.svg` | `#dbac16` |
| Blunder | `blunder.svg` | `#ca3431` |

The colors come directly from each SVG's `icon-background` fill.

## Rendering

- Add an icon URL to each central classification token while retaining the existing glyph as accessible fallback text.
- `ClassBadge` renders the mapped SVG at all current badge sizes.
- The larger destination-square badge renders the same mapped SVG.
- Existing consumers of classification colors automatically receive the official palette: Review counts, evaluation dots, board last-move overlays, brilliant ring accents, and coach-card accents.
- Selected move-list cells use their move's classification color for background, foreground, and inset outline instead of fixed teal.
- Unclassified selected moves retain the existing neutral accent fallback.

## Scope boundaries

- Do not change classification calculations.
- Do not implement phase ratings or special-classification detection.
- Do not redesign Review layout, spacing, typography, or unrelated controls.
- Preserve the unrelated working-tree modification in `Board.svelte` except for narrowly required icon/highlight integration edits.

## Testing

- Assert the central token mapping contains the official colors and matching icon URLs.
- Assert `ClassBadge` renders the official SVG rather than a text-only circle.
- Assert the destination-square badge receives and renders its official icon.
- Assert selected move-list styling derives from the move classification color.
- Run focused tests, the full Vitest suite, and `svelte-check`.

