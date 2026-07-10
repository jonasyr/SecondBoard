import { describe, it, expect, vi } from 'vitest';

const { minimize, toggleMaximize, close } = vi.hoisted(() => ({
	minimize: vi.fn(),
	toggleMaximize: vi.fn(),
	close: vi.fn()
}));

vi.mock('@tauri-apps/api/window', () => ({
	getCurrentWindow: () => ({ minimize, toggleMaximize, close })
}));

import { minimizeWindow, toggleMaximizeWindow, closeWindow } from './window';

describe('window API wrappers', () => {
	it('minimizeWindow calls Window.minimize', () => {
		minimizeWindow();
		expect(minimize).toHaveBeenCalledOnce();
	});

	it('toggleMaximizeWindow calls Window.toggleMaximize', () => {
		toggleMaximizeWindow();
		expect(toggleMaximize).toHaveBeenCalledOnce();
	});

	it('closeWindow calls Window.close', () => {
		closeWindow();
		expect(close).toHaveBeenCalledOnce();
	});
});
