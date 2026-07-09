import js from '@eslint/js';

export default [
	js.configs.recommended,
	{
		ignores: ['node_modules/', '.svelte-kit/', 'build/', 'dist/']
	},
	{
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: {
				browser: 'readonly',
				es2021: true,
				node: true
			}
		},
		rules: {}
	}
];
