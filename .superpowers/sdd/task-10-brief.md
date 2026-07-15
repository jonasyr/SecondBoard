### Task 10: Final verification sweep

**Files:**
- Modify: `src/lib/components/README.md`
- Modify: `.superpowers/sdd/progress.md`

**Interfaces:**
- Consumes: everything from Tasks 1-9.
- Produces: nothing (verification + ledger update only).

- [ ] **Step 1: Update the components README**

Replace the full contents of `src/lib/components/README.md`:

```markdown
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
```

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: exits 0, clean output. Fix any reported issue before continuing.

- [ ] **Step 3: Run type-check**

Run: `npm run check`
Expected: exits 0, 0 errors. (This is the step that confirms the `?url` SVG imports in `pieces.ts` typecheck correctly under SvelteKit's generated `vite/client` ambient types.)

- [ ] **Step 4: Run the full test suite**

Run: `npm run test -- --run`
Expected: exits 0, all tests pass (Iterations 1-3 combined).

- [ ] **Step 5: Run format check**

Run: `npm run format`
Expected: exits 0. Review `git status`/`git diff` afterward — if Prettier reformatted anything unexpected, inspect before proceeding.

- [ ] **Step 6: Run the frontend build**

Run: `npm run build`
Expected: exits 0, produces the static `build/` output including the 12 hashed piece-sprite assets under `build/_app/immutable/assets/`.

- [ ] **Step 7: Run the native Tauri debug build**

Run (PowerShell, for correct PATH):

```powershell
npx tauri build --debug
```

Expected: exits 0 — confirms the new frontend assets (piece sprites, Board component) bundle correctly into the desktop shell.

- [ ] **Step 8: Update the SDD progress ledger**

In `.superpowers/sdd/progress.md`, append (after the existing Iteration 2 lines):

```
---
Iteration 3 (The Board component):
Task 1: complete (fixed bpulse keyframes drift to match literal two-layer reference spec)
Task 2: complete (board domain types + geometry math ported from view-math.js)
Task 3: complete (12 piece sprites bundled + PIECE_SPRITES registry)
Task 4: complete (buildBoardSquares pure square-list builder)
Task 5: complete (diffMove pure from/to detector)
Task 6: complete (animateSlide DOM clone/transition)
Task 7: complete (BoardSquare component)
Task 8: complete (Board component: grid, best-move arrow, slide animation)
Task 9: complete (temporary visual-verification harness with mock game data)
Task 10: complete (final verification sweep: lint/check/test/format/build/native-build all pass)
```

- [ ] **Step 9: Commit**

```bash
git add src/lib/components/README.md .superpowers/sdd/progress.md
git commit -m "chore: final verification sweep for iteration 3 board component"
```

---

## Self-Review Notes (spec coverage)

- **README §4.4 board colors, §5 badge spec, §6.3 board layout** — Tasks 4, 7, 8. ✅
- **README §9 piece sprites reused 1:1** — Task 3. ✅
- **LOGIC.md §2.2 rendering (grid, flip-aware coords, square parity, last-move overlay, brilliant ring)** — Tasks 4, 7. ✅
- **LOGIC.md §2.3 best-move arrow (`arrowGeom`, knight bend)** — Tasks 2, 8. ✅
- **LOGIC.md §2.4 piece-slide animation (diff, clone, transition, cleanup, single-step-only guard)** — Tasks 5, 6, 8. ✅
- **`psize` vestigial per literal extraction — not ported as a prop** — documented in Global Constraints and Task 4. ✅
- **Zero-deviation `bpulse` fix** — Task 1 (pre-existing Iteration 1 drift caught during spec review). ✅
- **"Do not ship chess-mock.js as product code"** — Task 9 isolates it in an explicitly-labeled temporary dev file with a warning banner, and Task 10's README update calls out its expected deletion in Iteration 4. ✅
- **Pixel verification against `reference/screens/2-*.png` / `3-*.png`** — Task 9 Step 9 (manual check via the temporary harness). ✅
- **EvalBar, captured-material row, coach card, move list, tabs** — explicitly out of scope; deferred to Iteration 4 (Game Review screen) per README §11 step 4 / LOGIC.md §8 step 4, not gaps.
