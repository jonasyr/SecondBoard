# components

Shared UI components live here, one component + its co-located test per file.

**Landed (Iteration 2 — persistent chrome):** `Icon.svelte`, `TitleBar.svelte`, `Sidebar.svelte`,
`SidebarNavItem.svelte`, `SidebarSyncCard.svelte`, `SidebarProfile.svelte`, and `nav-items.ts`.
See `design_handoff_secondboard/README.md` §6.1.

**Landed (Iteration 3 — the Board component):** `Board.svelte` (grid, best-move arrow, slide
animation) and `BoardSquare.svelte` (single square: background, last-move tint, brilliant ring,
coordinate labels, piece, classification badge). Supporting pure logic lives in `src/lib/board/`
(`types.ts`, `geometry.ts`, `pieces.ts`, `build-squares.ts`, `diff-move.ts`, `animate-slide.ts`).
See `design_handoff_secondboard/README.md` §4.4/§5/§6.3 and `LOGIC.md` §2. `src/lib/board/dev-fixtures.ts`
is a **temporary** mock-data harness for visual QA only — it is expected to be deleted once
Iteration 4 wires the real Game Review screen to real backend data.

**Still to come:** EvalBar, StatCard, CoachCard, MoveList, Toggle, and the rest of the §6
component inventory — each lands in the iteration that builds its screen (see README §11's
build order).
