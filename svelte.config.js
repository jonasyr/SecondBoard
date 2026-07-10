import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},

	kit: {
		// Static adapter: SSR is disabled (see src/routes/+layout.ts) and the app is
		// packaged as a Tauri desktop shell, so it needs a fully static SPA build
		// (an index.html fallback, no Node/edge runtime) rather than adapter-auto's
		// deploy-target detection.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: 'index.html',
			precompress: false,
			strict: true
		})
	}
};

export default config;
