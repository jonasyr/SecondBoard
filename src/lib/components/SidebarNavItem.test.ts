import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import SidebarNavItem from './SidebarNavItem.svelte';

describe('SidebarNavItem', () => {
	it('renders the label when not collapsed', () => {
		const { getByText } = render(SidebarNavItem, {
			props: { label: 'Home', icon: 'M0 0', active: false, collapsed: false, onclick: () => {} }
		});
		expect(getByText('Home')).toBeTruthy();
	});

	it('hides the label when collapsed', () => {
		const { queryByText } = render(SidebarNavItem, {
			props: { label: 'Home', icon: 'M0 0', active: false, collapsed: true, onclick: () => {} }
		});
		expect(queryByText('Home')).toBeNull();
	});

	it('calls onclick when clicked', async () => {
		const onclick = vi.fn();
		const { getByTitle } = render(SidebarNavItem, {
			props: { label: 'Home', icon: 'M0 0', active: false, collapsed: false, onclick }
		});
		await fireEvent.click(getByTitle('Home'));
		expect(onclick).toHaveBeenCalledOnce();
	});

	it('applies the active class and accent stroke when active', () => {
		const { getByTitle, container } = render(SidebarNavItem, {
			props: { label: 'Home', icon: 'M0 0', active: true, collapsed: false, onclick: () => {} }
		});
		expect(getByTitle('Home').classList.contains('active')).toBe(true);
		expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('#4ADEA0');
	});

	it('uses the muted stroke when inactive', () => {
		const { container } = render(SidebarNavItem, {
			props: { label: 'Home', icon: 'M0 0', active: false, collapsed: false, onclick: () => {} }
		});
		expect(container.querySelector('svg')?.getAttribute('stroke')).toBe('#6B7180');
	});
});
