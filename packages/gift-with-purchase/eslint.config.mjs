import js from '@eslint/js';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		files: ['src/**/*.js'],
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.es2022,
				customElements: 'readonly',
			},
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-console': 'warn',
			'prefer-const': 'error',
			'no-var': 'error',
		},
	},
	{
		files: ['*.mjs', 'rollup.config.mjs'],
		languageOptions: {
			globals: {
				...globals.node,
				...globals.es2022,
			},
			ecmaVersion: 2022,
			sourceType: 'module',
		},
		rules: {
			'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
			'no-console': 'warn',
			'prefer-const': 'error',
			'no-var': 'error',
		},
	},
];
