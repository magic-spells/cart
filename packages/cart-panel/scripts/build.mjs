import { build, createServer } from 'vite';
import { rm, mkdir, cp } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import liveReload from '@magic-spells/vite-plugin-live-reload';

const isDev = process.env.NODE_ENV === 'development';
const outDir = isDev ? 'demo/dist' : 'dist';

// Every class declared in src/, reserved so Terser cannot rename it.
//
// Rolldown rewrites `class Foo extends HTMLElement {}` into
// `var Foo = class extends HTMLElement {}` before Terser runs. That leaves an
// *anonymous* class expression, so Terser's `mangle.keep_classnames` has no
// class name to keep and mangles the variable to a single letter — the name is
// lost, and with it `constructor.name` and the devtools display. Reserving the
// identifier is what survives the rewrite: a reserved name is never renamed, so
// `var Foo = class` stays `var Foo = class` and JS name inference gives the
// class its name back.
//
// Scanned rather than hard-coded so a class added to src/ is covered without
// anyone remembering to update this list. Costs a handful of gzipped bytes.
const RESERVED_CLASS_NAMES = [
	...new Set(
		readdirSync('src')
			.filter((file) => file.endsWith('.js'))
			.flatMap((file) =>
				[
					...readFileSync(`src/${file}`, 'utf8').matchAll(
						/^\s*(?:export\s+)?class\s+([A-Za-z_$][\w$]*)/gm
					),
				].map((match) => match[1])
			)
	),
];

// Not bundled into the ESM builds: the consuming app's module graph resolves it,
// so a page with several @magic-spells components shares one emitter instance.
// The minified browser builds deliberately bundle it — a plain <script> tag has
// no resolver.
const EXTERNAL = ['@magic-spells/event-emitter'];

// Three entry points, each published as its own ESM bundle, minified browser
// bundle and stylesheet pair. The root entry composes the other two: src/index.js
// imports both, so the panel and the item are registered by a single
// `import '@magic-spells/cart-panel'`.
//
// Two of the three UMD globals are namespaced because the obvious names are
// already spoken for — `CartPanel` by the panel-only build's exports object, and
// `CartItem` by the class itself, which src/cart-item.js hangs on window for
// Shopify themes. A UMD exports object must not clobber either.
const ENTRIES = [
	{ fileName: 'index', globalName: 'MagicSpellsCart' },
	{ fileName: 'cart-panel', globalName: 'CartPanel' },
	{ fileName: 'cart-item', globalName: 'MagicSpellsCartItem' },
];

// The root entry alone is what the demo loads, and the two subpath entries are
// strict subsets of its module graph — a break in either source file still fails
// the dev build.
const ROOT_ENTRY = ENTRIES[0];

// Sibling packages the demo drives, copied out of their workspace dist/ so the
// flagship demo exercises the versions in this repo rather than whatever is on
// the CDN. Everything else the demo loads (dialog-panel, quantity-input,
// split-text) stays on pinned unpkg URLs — those are external packages.
const SIBLING_BUILDS = [
	'../cart-progress-bar/dist/cart-progress-bar.esm.js',
	'../cart-progress-bar/dist/cart-progress-bar.min.css',
	'../gift-with-purchase/dist/gift-with-purchase.esm.js',
	'../gift-with-purchase/dist/gift-with-purchase.min.css',
];

function sharedBuild(overrides = {}) {
	return {
		configFile: false,
		logLevel: isDev ? 'warn' : 'info',
		css: { transformer: 'lightningcss' },
		build: {
			outDir,
			// Six passes write into the same directory, one per entry point per
			// format. Emptying between them would delete the previous pass's work.
			emptyOutDir: false,
			// Dev only. The published tarball is `files: ["dist/", "src/"]`, and
			// rolldown inlines `sourcesContent` — shipping maps would put the whole
			// source tree in the tarball a second time. `false` rather than
			// `'hidden'`: the artifacts carry a `//# sourceMappingURL=` comment, so
			// emitting the map and merely withholding it from the tarball would 404
			// in devtools. The demo keeps its maps — demo/dist is gitignored and
			// never published.
			sourcemap: isDev,
			target: 'es2022',
			reportCompressedSize: !isDev,
			watch: isDev ? {} : null,
			...overrides.build,
		},
		...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'build')),
	};
}

// Each source module side-effect imports its own CSS, so Vite extracts one
// stylesheet per pass and `lib.cssFileName` names it. The CSS is never a separate
// build entry. The root entry's graph reaches both stylesheets, which is how
// `dist/index.css` ends up being the two concatenated — the same shape the
// exports map documents: `./css` is both, `./panel/css` and `./cart-item/css`
// are each half on its own.
//
// `external` is a parameter rather than a constant because the dev build needs
// the dependency bundled: the demo loads its bundle as a plain
// `<script type="module">` with no import map.
function esmConfig({ fileName, external = EXTERNAL }) {
	return sharedBuild({
		build: {
			lib: {
				entry: `src/${fileName}.js`,
				fileName: () => `${fileName}.esm.js`,
				formats: ['es'],
				cssFileName: fileName,
			},
			minify: false,
			cssMinify: false,
			rolldownOptions: {
				external,
				output: { exports: 'named' },
			},
		},
	});
}

// There is deliberately no CommonJS build and no unminified UMD. Each entry point
// ships exactly two JS artifacts: `<name>.esm.js` for anything with a module
// graph, and `<name>.min.js` for a plain `<script>` tag. `package.json` declares
// no `require` condition, so `require()` fails at resolution with a clear error
// instead of at runtime with a confusing one.
function umdMinConfig({ fileName, globalName }) {
	return sharedBuild({
		build: {
			lib: {
				entry: `src/${fileName}.js`,
				name: globalName,
				fileName: () => `${fileName}.min.js`,
				formats: ['umd'],
				cssFileName: `${fileName}.min`,
			},
			minify: 'terser',
			terserOptions: {
				// Custom-element class names must survive — they are what
				// `customElements.define` registers and what consumers subclass.
				// `keep_classnames` alone is not enough here; see
				// RESERVED_CLASS_NAMES above.
				mangle: { keep_classnames: true, keep_fnames: false, reserved: RESERVED_CLASS_NAMES },
			},
			cssMinify: 'lightningcss',
			rolldownOptions: {
				// Empty, not `EXTERNAL`: a <script> tag has no resolver, so the
				// browser build bundles its dependency.
				external: [],
				output: { exports: 'named' },
			},
		},
	});
}

// Copy the sibling workspace builds the demo drives into demo/dist/vendor/.
// demo/dist is gitignored, so nothing here is committed or published. Siblings
// are read from their committed dist/ — house policy publishes those — so this
// needs no build ordering between packages.
async function copySiblingBuilds() {
	const vendorDir = `${outDir}/vendor`;
	await mkdir(vendorDir, { recursive: true });

	for (const source of SIBLING_BUILDS) {
		if (!existsSync(source)) {
			throw new Error(
				`Missing sibling build: ${source}. Run \`npm run build\` at the repo root first.`
			);
		}
		await cp(source, `${vendorDir}/${source.split('/').pop()}`);
	}
}

async function main() {
	if (!isDev) {
		await rm(outDir, { recursive: true, force: true });
		await mkdir(outDir, { recursive: true });
	} else if (!existsSync(outDir)) {
		await mkdir(outDir, { recursive: true });
	}

	if (isDev) {
		await copySiblingBuilds();

		// The demo loads the root bundle and its stylesheet, and nothing else this
		// package builds. Watch builds never resolve, so they are fired unawaited.
		build(esmConfig({ ...ROOT_ENTRY, external: [] })).catch((error) => {
			console.error('build error:', error);
		});

		const server = await createServer({
			configFile: false,
			root: 'demo',
			server: { port: 3002, open: true, strictPort: false, host: true },
			// Raw-serve JS as well as CSS: Vite's cached transform of files the
			// module graph doesn't own is never invalidated, so the externally
			// rebuilt bundles go stale behind it.
			plugins: [liveReload({ distDir: 'demo/dist', extensions: ['.css', '.js', '.mjs', '.map'] })],
		});
		await server.listen();
		server.printUrls();
	} else {
		// Sequential for prod — deterministic, and a smaller memory footprint.
		for (const entry of ENTRIES) {
			await build(esmConfig(entry));
			await build(umdMinConfig(entry));
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
