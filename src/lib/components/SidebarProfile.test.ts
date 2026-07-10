import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import SidebarProfile from './SidebarProfile.svelte';

describe('SidebarProfile', () => {
	it('renders the name and rating when expanded', () => {
		const { getByText } = render(SidebarProfile, { props: { collapsed: false } });
		expect(getByText('Jonas')).toBeTruthy();
		expect(getByText('1867')).toBeTruthy();
	});

	it('hides the name and rating when collapsed', () => {
		const { queryByText } = render(SidebarProfile, { props: { collapsed: true } });
		expect(queryByText('Jonas')).toBeNull();
	});

	it('always renders the avatar initial', () => {
		const { getByText } = render(SidebarProfile, { props: { collapsed: true } });
		expect(getByText('J')).toBeTruthy();
	});
});
