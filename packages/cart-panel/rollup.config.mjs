import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import copy from 'rollup-plugin-copy';
import postcss from 'rollup-plugin-postcss';

const dev = process.env.ROLLUP_WATCH;
const name = 'cart-panel';
const itemName = 'cart-item';

// External dependencies that should not be bundled in ESM/CJS
const external = ['@magic-spells/event-emitter'];

// CSS plugin config - one extracted stylesheet per entry point
const cssPlugin = (fileName) =>
	postcss({
		extract: `${fileName}.css`,
		minimize: false,
	});

// CSS plugin config (minimized)
const cssMinPlugin = (fileName) =>
	postcss({
		extract: `${fileName}.min.css`,
		minimize: true,
	});

// Shared terser config for minified UMD builds
const terserPlugin = terser({
	keep_classnames: true,
	format: {
		comments: false,
	},
});

/**
 * Build the four standard output formats for a single entry point
 * @param {Object} options
 * @param {string} options.fileName - Base file name used for the entry and its outputs
 * @param {string} options.globalName - UMD global name
 * @returns {Array} Rollup configs
 */
const buildsFor = ({ fileName, globalName }) => [
	// ESM build
	{
		input: `src/${fileName}.js`,
		external,
		output: {
			file: `dist/${fileName}.esm.js`,
			format: 'es',
			sourcemap: true,
		},
		plugins: [resolve(), cssPlugin(fileName)],
	},
	// CommonJS build
	{
		input: `src/${fileName}.js`,
		external,
		output: {
			file: `dist/${fileName}.cjs.js`,
			format: 'cjs',
			sourcemap: true,
			exports: 'named',
		},
		plugins: [resolve(), cssPlugin(fileName)],
	},
	// UMD build (bundles all dependencies for standalone use)
	{
		input: `src/${fileName}.js`,
		output: {
			file: `dist/${fileName}.js`,
			format: 'umd',
			name: globalName,
			sourcemap: true,
			exports: 'named',
		},
		plugins: [resolve(), cssPlugin(fileName)],
	},
	// Minified UMD for browsers
	{
		input: `src/${fileName}.js`,
		output: {
			file: `dist/${fileName}.min.js`,
			format: 'umd',
			name: globalName,
			sourcemap: false,
			exports: 'named',
		},
		plugins: [resolve(), cssMinPlugin(fileName), terserPlugin],
	},
];

/**
 * Copy an entry point's demo assets into demo/ after each rebuild
 * @param {string} fileName - Base file name of the entry point
 * @returns {Object} Rollup copy plugin instance
 */
const demoCopyPlugin = (fileName) =>
	copy({
		targets: [
			{ src: `dist/${fileName}.esm.js`, dest: 'demo' },
			{ src: `dist/${fileName}.esm.js.map`, dest: 'demo' },
			{ src: `dist/${fileName}.css`, dest: 'demo' },
		],
		hook: 'writeBundle',
	});

export default [
	...buildsFor({ fileName: name, globalName: 'CartPanel' }),
	// cart-item sets window.CartItem to the class itself, so the UMD wrapper uses a
	// namespaced global to avoid overwriting it with the exports object
	...buildsFor({ fileName: itemName, globalName: 'MagicSpellsCartItem' }),
	// Development builds - one per entry point so each watches its own source graph
	...(dev
		? [
				{
					input: `src/${name}.js`,
					output: {
						file: `dist/${name}.esm.js`,
						format: 'es',
						sourcemap: true,
					},
					plugins: [
						resolve(),
						cssPlugin(name),
						serve({
							contentBase: ['dist', 'demo'],
							open: true,
							port: 3004,
						}),
						demoCopyPlugin(name),
					],
				},
				{
					input: `src/${itemName}.js`,
					output: {
						file: `dist/${itemName}.esm.js`,
						format: 'es',
						sourcemap: true,
					},
					plugins: [resolve(), cssPlugin(itemName), demoCopyPlugin(itemName)],
				},
			]
		: []),
];
