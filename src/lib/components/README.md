# components

Shared UI components live here, one component + its co-located test per file.

**Landed (Iteration 2 — persistent chrome):** `Icon.svelte`, `TitleBar.svelte`, `Sidebar.svelte`,
`SidebarNavItem.svelte`, `SidebarSyncCard.svelte`, `SidebarProfile.svelte`, and `nav-items.ts`.
See `design_handoff_secondboard/README.md` §6.1.

**Landed (Iteration 3 — the Board component):** `Board.svelte` (grid, best-move arrow, slide
animation) and `BoardSquare.svelte` (single square: background, last-move tint, brilliant ring,
coordinate labels, piece, classification badge). Supporting pure logic lives in `src/lib/board/`
(`types.ts`, `geometry.ts`, `pieces.ts`, `build-squares.ts`, `diff-move.ts`, `animate-slide.ts`).
See `design_handoff_secondboard/README.md` §4.4/§5/§6.3 and `LOGIC.md` §2.

**Landed (Iteration 4 — the Game Review screen):** `OnboardingScreen.svelte`, `GameReviewScreen.svelte`,
`ReviewPanel.svelte` (header, tabs, `AnalysisTab`/`ReviewTab`/`DetailsTab`/`ExploreTab`, `BottomBar`/`NavControls`),
`PlayerRow.svelte`, `EvalBar.svelte`, `EvalGraph.svelte`, `CoachCard.svelte`, `MoveList.svelte`,
`BreakdownTable.svelte`, `PhaseTable.svelte`, `AccuracyBlock.svelte`, and `ClassBadge.svelte` (the new
16px/21px/22px badge sizes — the board's own 36px destination badge stays inline in `BoardSquare.svelte`).
Supporting pure logic lives in `src/lib/game/` (`mock-engine.ts`, `mock-data.ts`, `review.ts`) and
`src/lib/charts/eval-graph.ts`. See `design_handoff_secondboard/README.md` §6.2/§6.3 and `LOGIC.md` §1-5.
`src/lib/game/mock-engine.ts` and `mock-data.ts` are explicitly MOCK data/logic (LOGIC.md header table) —
they stand in for the Rust `pgn`/`analysis`/`engine` modules until Iterations 5-8 replace them piece by
piece (README §11).

**Still to come:** EvalBar, StatCard, CoachCard, MoveList, Toggle, and the rest of the §6
component inventory — each lands in the iteration that builds its screen (see README §11's
build order).
