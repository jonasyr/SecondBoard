import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';
import globals from 'globals';

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
				...globals.browser,
				...globals.node
			}
		}
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				projectService: {
					allowDefaultProject: ['vitest.config.ts']
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'error'
		}
	},
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser,
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte']
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			'@typescript-eslint/no-explicit-any': 'error'
		}
	},
	{
		files: ['**/*.svelte.ts'],
		languageOptions: {
			parser: svelteParser,
			parserOptions: {
				parser: tsParser,
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.svelte.ts']
			}
		},
		plugins: {
			'@typescript-eslint': tsPlugin
		},
		rules: {
			...tsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'error'
		}
	}
];
