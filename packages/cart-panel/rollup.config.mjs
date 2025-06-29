import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const dev = process.env.ROLLUP_WATCH;
const name = 'cart-panel';

// External dependencies that should not be bundled
const external = [
	'@magic-spells/cart-item',
	'@magic-spells/focus-trap',
	'@magic-spells/event-emitter',
];

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
		plugins: [
			resolve(),
			postcss({
				extract: true,
				minimize: false,
				includePaths: ['./node_modules'],
				use: [
					[
						'sass',
						{
							includePaths: ['node_modules'],
						},
					],
				],
				extensions: ['.css', '.scss'],
			}),
			copy({
				targets: [
					{
						src: 'src/cart-panel.scss',
						dest: 'dist',
					},
				],
			}),
		],
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
		plugins: [
			resolve(),
			postcss({
				extract: true,
				minimize: false,
				includePaths: ['./node_modules'],
				use: [
					[
						'sass',
						{
							includePaths: ['node_modules'],
						},
					],
				],
				extensions: ['.css', '.scss'],
			}),
		],
	},
	// UMD build (includes all dependencies for standalone use)
	{
		input: 'src/cart-panel.js',
		output: {
			file: `dist/${name}.js`,
			format: 'umd',
			name: 'CartDialog',
			sourcemap: true,
			exports: 'named',
		},
		plugins: [
			resolve(),
			postcss({
				extract: true,
				minimize: false,
				use: [
					[
						'sass',
						{
							includePaths: ['node_modules'],
						},
					],
				],
				extensions: ['.css', '.scss'],
			}),
		],
	},
	// Minified UMD for browsers
	{
		input: 'src/cart-panel.js',
		output: {
			file: `dist/${name}.min.js`,
			format: 'umd',
			name: 'CartDialog',
			sourcemap: false,
			exports: 'named',
		},
		plugins: [
			resolve(),
			postcss({
				extract: true,
				minimize: true,
				use: [
					[
						'sass',
						{
							includePaths: ['node_modules'],
						},
					],
				],
				extensions: ['.css', '.scss'],
			}),
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
						postcss({
							extract: true,
							minimize: false,
							includePaths: ['./node_modules'],
							use: [
								[
									'sass',
									{
										includePaths: ['node_modules'],
									},
								],
							],
							extensions: ['.css', '.scss'],
						}),
						serve({
							contentBase: ['dist', 'demo'],
							open: true,
							port: 3000,
						}),
						copy({
							targets: [
								{
									src: `dist/${name}.esm.js`,
									dest: 'demo',
								},
								{
									src: `dist/${name}.esm.js.map`,
									dest: 'demo',
								},
								{
									src: `dist/${name}.css`,
									dest: 'demo',
								},
								{
									src: `src/${name}.scss`,
									dest: 'dist',
								},
							],
							hook: 'writeBundle',
						}),
					],
				},
			]
		: []),
];
