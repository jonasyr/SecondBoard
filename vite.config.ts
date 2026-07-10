import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

// Kit/compiler config (adapter, runes mode) lives in svelte.config.js so it's
// shared identically between this build entry point and vitest.config.ts.
export default defineConfig({
	plugins: [sveltekit()]
});
