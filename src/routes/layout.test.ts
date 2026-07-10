import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

vi.mock('$lib/api/window', () => ({
	minimizeWindow: vi.fn(),
	toggleMaximizeWindow: vi.fn(),
	closeWindow: vi.fn()
}));

// Svelte 5 layouts receive `children` as a snippet prop (rendered via
// `{@render children()}`). `@testing-library/svelte` does not synthesize a
// default snippet when one isn't supplied, so tests must provide one
// explicitly via `createRawSnippet` to avoid an `invalid_snippet` error.
const emptyChildren = createRawSnippet(() => ({
	render: () => '<div></div>'
}));

describe('root layout', () => {
	it('renders an app-shell element covering the full viewport', () => {
		const { container } = render(Layout, { props: { children: emptyChildren } });
		const shell = container.querySelector('.app-shell');
		expect(shell).not.toBeNull();
	});

	it('renders the TitleBar and Sidebar chrome', () => {
		const { getByText, getByTitle } = render(Layout, { props: { children: emptyChildren } });
		expect(getByText('SecondBoard — Local Chess Review Companion')).toBeTruthy();
		expect(getByTitle('Home')).toBeTruthy();
	});

	it('renders the page content inside a scrollable main-content landmark', () => {
		const { container } = render(Layout, { props: { children: emptyChildren } });
		const main = container.querySelector('main.main-content');
		expect(main).not.toBeNull();
		expect(main?.querySelector('div')).not.toBeNull();
	});
});
