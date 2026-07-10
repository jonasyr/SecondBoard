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

	it('renders the "Local · Offline" pill and version string', () => {
		const { getByText } = render(TitleBar);
		expect(getByText('Local · Offline')).toBeTruthy();
		expect(getByText('v0.4.1')).toBeTruthy();
	});

	it('calls minimizeWindow when the minimize dot is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Minimize'));
		expect(minimizeWindow).toHaveBeenCalledOnce();
	});

	it('calls toggleMaximizeWindow when the maximize dot is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Maximize'));
		expect(toggleMaximizeWindow).toHaveBeenCalledOnce();
	});

	it('calls closeWindow when the close dot is clicked', async () => {
		const { getByTitle } = render(TitleBar);
		await fireEvent.click(getByTitle('Close'));
		expect(closeWindow).toHaveBeenCalledOnce();
	});
});
