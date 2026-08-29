import { resolve as resolvePath } from 'node:path';
import resolve from '@rollup/plugin-node-resolve';
import terser from '@rollup/plugin-terser';
import serve from 'rollup-plugin-serve';
import postcss from 'rollup-plugin-postcss';

const dev = !!process.env.ROLLUP_WATCH;

// The single source of truth for where this run is allowed to write.
//
// Watch mode targets `demo/` and production targets `dist/`, and the two config
// sets are mutually exclusive (see the export at the bottom) — a watch run never
// even constructs a config whose output lands in `dist/`. That separation is the
// point: the demo's ESM must *bundle* @magic-spells/event-emitter so a plain
// `<script type="module">` can load it with no import map, while the published
// ESM must leave it *external* so an app's module graph supplies one shared copy.
// The two builds are legitimately different bytes, so the old shared-`dist/`
// arrangement could only ever be a race — whichever config wrote last won, and a
// dev-built `dist/cart-panel.esm.js` with the dependency inlined got committed
// twice. Writing them to different directories makes that class of bug
// unrepresentable rather than merely unlikely.
const OUT_DIR = dev ? 'demo' : 'dist';

// Not bundled into ESM/CJS: the consuming app's module graph resolves it, so a
// page with several @magic-spells components shares one emitter instance. The
// UMD and minified-UMD builds deliberately omit this and bundle it, because a
// plain <script> tag has no resolver.
const external = ['@magic-spells/event-emitter'];

const out = (file) => resolvePath(OUT_DIR, file);

// One extracted stylesheet per entry point. The path is absolute so extraction
// is unambiguous across rollup-plugin-postcss versions, which have disagreed
// about whether a relative `extract` is relative to cwd or to the output dir.
const cssPlugin = (fileName) =>
	postcss({
		extract: out(`${fileName}.css`),
		minimize: false,
	});

const cssMinPlugin = (fileName) =>
	postcss({
		extract: out(`${fileName}.min.css`),
		minimize: true,
	});

// Minification applies to the browser-facing UMD bundle and to CSS only. ESM and
// CJS outputs are never minified — they are inputs to somebody else's bundler,
// which will do a better job with readable source and intact names.
const terserPlugin = terser({
	keep_classnames: true,
	format: {
		comments: false,
	},
});

/**
 * The four published outputs for one entry point, all into `dist/`.
 * @param {Object} options
 * @param {string} options.fileName - Base file name used for the entry and its outputs
 * @param {string} options.globalName - UMD global name
 * @returns {Array} Rollup configs
 */
const productionBuilds = ({ fileName, globalName }) => [
	// ESM — dependency left external, not minified
	{
		input: `src/${fileName}.js`,
		external,
		output: {
			file: out(`${fileName}.esm.js`),
			format: 'es',
			sourcemap: true,
		},
		plugins: [resolve(), cssPlugin(fileName)],
	},
	// CommonJS — dependency left external, not minified
	{
		input: `src/${fileName}.js`,
		external,
		output: {
			file: out(`${fileName}.cjs.js`),
			format: 'cjs',
			sourcemap: true,
			exports: 'named',
		},
		plugins: [resolve(), cssPlugin(fileName)],
	},
	// UMD — bundles dependencies for standalone <script> use
	{
		input: `src/${fileName}.js`,
		output: {
			file: out(`${fileName}.js`),
			format: 'umd',
			name: globalName,
			sourcemap: true,
			exports: 'named',
		},
		plugins: [resolve(), cssPlugin(fileName)],
	},
	// Minified UMD for browsers — the only minified JS this package ships
	{
		input: `src/${fileName}.js`,
		output: {
			file: out(`${fileName}.min.js`),
			format: 'umd',
			name: globalName,
			sourcemap: false,
			exports: 'named',
		},
		plugins: [resolve(), cssMinPlugin(fileName), terserPlugin],
	},
];

/**
 * The watch-mode output for one entry point: a single unminified ESM bundle plus
 * its stylesheet, written straight into `demo/` where index.html already loads
 * them from. Dependencies are bundled so the demo needs no import map, and there
 * is no copy step — the build writes to its final location.
 * @param {Object} options
 * @param {string} options.fileName - Base file name used for the entry and its outputs
 * @param {boolean} [options.withServer] - Attach the dev server to this config
 * @returns {Object} Rollup config
 */
const developmentBuild = ({ fileName, withServer = false }) => ({
	input: `src/${fileName}.js`,
	output: {
		file: out(`${fileName}.esm.js`),
		format: 'es',
		sourcemap: true,
	},
	plugins: [
		resolve(),
		cssPlugin(fileName),
		...(withServer
			? [
					serve({
						contentBase: ['demo'],
						open: true,
						port: 3004,
					}),
				]
			: []),
	],
});

const entries = [
	{ fileName: 'cart-panel', globalName: 'CartPanel' },
	// cart-item sets window.CartItem to the class itself, so the UMD wrapper uses a
	// namespaced global to avoid overwriting it with the exports object
	{ fileName: 'cart-item', globalName: 'MagicSpellsCartItem' },
];

const configs = dev
	? entries.map((entry, index) => developmentBuild({ ...entry, withServer: index === 0 }))
	: entries.flatMap(productionBuilds);

// Belt and braces. The mutually exclusive config sets above already guarantee
// this, but an assertion here means any future edit that reintroduces a
// dist-writing dev config fails loudly at config load instead of silently
// corrupting a published artifact.
if (dev) {
	const leaked = configs.filter((config) => !config.output.file.startsWith(resolvePath('demo')));
	if (leaked.length > 0) {
		throw new Error(
			`Watch mode must only write to demo/. Offending outputs: ${leaked
				.map((config) => config.output.file)
				.join(', ')}`
		);
	}
}

export default configs;
