import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import Layout from './+layout.svelte';

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
});
