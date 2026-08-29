import js from '@eslint/js';
import globals from 'globals';

export default [
	js.configs.recommended,
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.es2024,
				...globals.node,
			},
			ecmaVersion: 2024,
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
