## Task 7: `TitleBar.svelte` — native-looking controls, moved top-right; remove the "Local · Offline" pill

**Files:**
- Modify: `src/lib/components/TitleBar.svelte`
- Modify: `src/lib/components/TitleBar.test.ts`

**Interfaces:**
- Consumes: `minimizeWindow`/`toggleMaximizeWindow`/`closeWindow` from `$lib/api/window` (unchanged, already real — `src/lib/api/window.ts`).
- Produces: same title bar, restyled; no new props/exports.

- [ ] **Step 1: Update the failing test**

Replace `src/lib/components/TitleBar.test.ts` entirely:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import TitleBar from './TitleBar.svelte';

const { minimizeWindow, toggleMaximizeWindow, closeWindow } = vi.hoisted(() => ({
	minimizeWindow: vi.fn(),
	toggleMaximizeWindow: vi.fn(),
	closeWindow: vi.fn()
}));

vi.mock('$lib/api/window', () => ({ minimizeWindow, toggleMaximizeWindow, closeWindow }));

describe('TitleBar', () => {
	it('renders the window title text', () => {
		const { getByText } = render(TitleBar);
		expect(getByText('SecondBoard — Local Chess Review Companion')).toBeTruthy();
	});

	it('does not render the "Local · Offline" pill anymore, but keeps the version string', () => {
		const { queryByText, getByText } = render(TitleBar);
		expect(queryByText('Local · Offline')).toBeNull();
		expect(getByText('v0.4.1')).toBeTruthy();
	});

	it('renders the window controls after the version string, at the trailing edge of the bar', () => {
		const { getByTitle, getByText, container } = render(TitleBar);
		const right = container.querySelector('.right')!;
		const version = getByText('v0.4.1');
		const controls = getByTitle('Close').closest('.window-controls')!;
		expect(right.contains(version)).toBe(true);
		expect(right.contains(controls)).toBe(true);
		// version must precede the controls (controls are the trailing/right-most element).
		const position = version.compareDocumentPosition(controls);
		expect(position & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('calls minimizeWindow when the minimize button is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Minimize'));
		expect(minimizeWindow).toHaveBeenCalledOnce();
	});

	it('calls toggleMaximizeWindow when the maximize button is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Maximize'));
		expect(toggleMaximizeWindow).toHaveBeenCalledOnce();
	});

	it('calls closeWindow when the close button is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Close'));
		expect(closeWindow).toHaveBeenCalledOnce();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm exec vitest run src/lib/components/TitleBar.test.ts`
Expected: FAIL — `'Local · Offline'` is still rendered (`queryByText` finds it, so `toBeNull()` fails), and `.window-controls` is still at the top-left before the title, so the trailing-position assertion fails too.

- [ ] **Step 3: Rewrite `TitleBar.svelte`**

```svelte
<script lang="ts">
	import { minimizeWindow, toggleMaximizeWindow, closeWindow } from '$lib/api/window';
</script>

<div class="title-bar" data-tauri-drag-region>
	<div class="title" data-tauri-drag-region>SecondBoard — Local Chess Review Companion</div>
	<div class="right">
		<span class="version sbmono">v0.4.1</span>
		<div class="window-controls">
			<button
				type="button"
				class="win-btn"
				onclick={minimizeWindow}
				title="Minimize"
				aria-label="Minimize window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<line x1="0" y1="5" x2="10" y2="5" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
			<button
				type="button"
				class="win-btn"
				onclick={toggleMaximizeWindow}
				title="Maximize"
				aria-label="Maximize window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
			<button
				type="button"
				class="win-btn close"
				onclick={closeWindow}
				title="Close"
				aria-label="Close window"
			>
				<svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
					<line x1="0" y1="0" x2="10" y2="10" stroke="currentColor" stroke-width="1" />
					<line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1" />
				</svg>
			</button>
		</div>
	</div>
</div>

<style>
	.title-bar {
		height: var(--layout-titlebar-height);
		flex: none;
		display: flex;
		align-items: center;
		padding: 0 0 0 14px;
		background: var(--color-titlebar-gradient);
		border-bottom: 1px solid var(--color-hairline-low);
		gap: 14px;
		/* Windows/webview drag-region shim per Tauri's window-customization guide. */
		app-region: drag;
	}
	.title {
		flex: 1;
		text-align: center;
		font-size: 12px;
		letter-spacing: 0.04em;
		color: var(--color-text-muted);
		font-weight: 500;
	}
	.right {
		display: flex;
		align-items: center;
		align-self: stretch;
		gap: 12px;
		app-region: no-drag;
	}
	.version {
		font-size: 10.5px;
		color: var(--color-text-muted-dark);
	}
	.window-controls {
		display: flex;
		align-items: stretch;
		align-self: stretch;
	}
	.win-btn {
		width: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		border: none;
		background: transparent;
		color: var(--color-text-tertiary);
		cursor: pointer;
	}
	.win-btn:hover {
		background: rgba(255, 255, 255, 0.08);
		color: var(--color-text-primary-alt);
	}
	.win-btn.close:hover {
		background: #e81123;
		color: #ffffff;
	}
</style>
```

Key changes from the original:
- The three decorative `.dot` buttons (left-aligned, colored circles) are replaced with `.win-btn` buttons (right-aligned inside `.window-controls`, full title-bar height via `align-self: stretch`, thin single-line minimize/maximize/close glyphs) — matching native Windows caption-button conventions (rectangular hit target, hover fill, red hover on close) instead of macOS-style dots.
- `.window-controls` moved from being the title bar's first child to the last child inside `.right`, after the version string, so it sits flush at the top-right corner.
- `.status-pill`/`.status-dot`/`.status-text` styles and the `<div class="status-pill">...Local · Offline...</div>` markup are deleted entirely.
- `.title-bar`'s `padding` changed from `0 14px` to `0 0 0 14px` (no right padding) so `.win-btn`'s own right-edge hit area reaches the true corner, matching native caption buttons — `.title`/`.right`'s `gap: 14px` on the flex row still keeps the title and version visually inset from the left edge.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm exec vitest run src/lib/components/TitleBar.test.ts`
Expected: PASS — all green.

Run full suite: `pnpm exec vitest run`
Expected: PASS across the repo (this component isn't imported with props by anything else, so no ripple).

Run: `pnpm check` and `pnpm lint`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/TitleBar.svelte src/lib/components/TitleBar.test.ts
git commit -m "fix(titlebar): native-style window controls at top-right, drop Local/Offline pill"
```

---

