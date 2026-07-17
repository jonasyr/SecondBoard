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
