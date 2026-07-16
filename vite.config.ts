import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Kit/compiler config (adapter, runes mode) lives in svelte.config.js so it's
// shared identically between this build entry point and vitest.config.ts.
export default defineConfig({
	plugins: [sveltekit()],
	// Tauri's devUrl (tauri.conf.json) is hardcoded to port 5173 — if it's taken,
	// Vite silently picks another port and Tauri loads the wrong dev server.
	// strictPort makes that failure loud instead of silent.
	server: {
		strictPort: true
	}
});
