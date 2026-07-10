import { getCurrentWindow } from '@tauri-apps/api/window';

/** Minimizes the app window. Wired to the title bar's leftmost dot (README §6.1). */
export function minimizeWindow(): void {
	getCurrentWindow().minimize();
}

/** Toggles the app window between maximized and restored. Wired to the title bar's middle dot. */
export function toggleMaximizeWindow(): void {
	getCurrentWindow().toggleMaximize();
}

/** Closes the app window. Wired to the title bar's rightmost dot. */
export function closeWindow(): void {
	getCurrentWindow().close();
}
