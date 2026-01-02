import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const dev = process.env.ROLLUP_WATCH;
const name = 'cart-panel';

// External dependencies that should not be bundled in ESM/CJS
const external = ['@magic-spells/event-emitter'];

// CSS plugin config
const cssPlugin = postcss({
	extract: true,
	minimize: false,
});

// CSS plugin config (minimized)
const cssMinPlugin = postcss({
	extract: true,
	minimize: true,
});

export default [
	// ESM build
	{
		input: 'src/cart-panel.js',
		external,
		output: {
			file: `dist/${name}.esm.js`,
			format: 'es',
			sourcemap: true,
		},
		plugins: [resolve(), cssPlugin],
	},
	// CommonJS build
	{
		input: 'src/cart-panel.js',
		external,
		output: {
			file: `dist/${name}.cjs.js`,
			format: 'cjs',
			sourcemap: true,
			exports: 'named',
		},
		plugins: [resolve(), cssPlugin],
	},
	// UMD build (bundles all dependencies for standalone use)
	{
		input: 'src/cart-panel.js',
		output: {
			file: `dist/${name}.js`,
			format: 'umd',
			name: 'CartPanel',
			sourcemap: true,
			exports: 'named',
		},
		plugins: [resolve(), cssPlugin],
	},
	// Minified UMD for browsers
	{
		input: 'src/cart-panel.js',
		output: {
			file: `dist/${name}.min.js`,
			format: 'umd',
			name: 'CartPanel',
			sourcemap: false,
			exports: 'named',
		},
		plugins: [
			resolve(),
			cssMinPlugin,
			terser({
				keep_classnames: true,
				format: {
					comments: false,
				},
			}),
		],
	},
	// Development build
	...(dev
		? [
				{
					input: 'src/cart-panel.js',
					output: {
						file: `dist/${name}.esm.js`,
						format: 'es',
						sourcemap: true,
					},
					plugins: [
						resolve(),
						cssPlugin,
						serve({
							contentBase: ['dist', 'demo'],
							open: true,
							port: 3004,
						}),
						copy({
							targets: [
								{ src: `dist/${name}.esm.js`, dest: 'demo' },
								{ src: `dist/${name}.esm.js.map`, dest: 'demo' },
								{ src: `dist/${name}.css`, dest: 'demo' },
							],
							hook: 'writeBundle',
						}),
					],
				},
			]
		: []),
];
