import { build, createServer } from 'vite';
import { rm, mkdir, cp } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import liveReload from '@magic-spells/vite-plugin-live-reload';

// Three modes, two output shapes.
//
//   dev   `npm run dev`        — build the demo bundle, watch it, serve demo/.
//   demo  `npm run build:demo` — the same demo bundle, built once, then exit.
//   prod  `npm run build`      — the published dist/.
//
// `dev` and `demo` are one build with the watcher and the dev server switched
// off, not two builds that happen to agree. GitHub Pages serves this repo's
// demo straight off the branch with no build step, so `demo/dist` is committed;
// sharing the config is what stops the committed bundle from drifting away from
// the one a developer sees locally.
//
// Everything below branches on `isDemo` (which output, built which way) or
// `isWatch` (whether this process stays alive), never on the mode name.
const MODE =
	process.env.DEMO_BUILD === '1'
		? 'demo'
		: process.env.NODE_ENV === 'development'
			? 'dev'
			: 'prod';

const isDemo = MODE !== 'prod';
const isWatch = MODE === 'dev';

const outDir = isDemo ? 'demo/dist' : 'dist';

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
		// Quiet under the watcher, which reprints on every keystroke. A one-shot
		// build says what it wrote.
		logLevel: isWatch ? 'warn' : 'info',
		css: { transformer: 'lightningcss' },
		build: {
			outDir,
			// Six passes write into the same directory, one per entry point per
			// format. Emptying between them would delete the previous pass's work.
			emptyOutDir: false,
			// Demo output only. The published tarball is `files: ["dist/", "src/"]`,
			// and rolldown inlines `sourcesContent` — shipping maps would put the
			// whole source tree in the tarball a second time. `false` rather than
			// `'hidden'`: the artifacts carry a `//# sourceMappingURL=` comment, so
			// emitting the map and merely withholding it from the tarball would 404
			// in devtools. The demo keeps its maps: demo/dist is committed but never
			// published, and the map is what makes the live demo debuggable.
			sourcemap: isDemo,
			target: 'es2022',
			reportCompressedSize: !isDemo,
			watch: isWatch ? {} : null,
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
// Siblings are read from their committed dist/ — house policy commits those — so
// this needs no build ordering between packages, and `npm run build:demo` is
// reproducible from a fresh checkout without building anything else first.
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
	// A one-shot build starts from an empty directory, so its output is a
	// function of the sources and nothing else. That matters twice over for the
	// demo build, whose result is committed: a file that stopped being emitted
	// must stop being served too. Watch mode keeps the directory and rewrites in
	// place — wiping it would break the page open in the browser.
	if (!isWatch) {
		await rm(outDir, { recursive: true, force: true });
		await mkdir(outDir, { recursive: true });
	} else if (!existsSync(outDir)) {
		await mkdir(outDir, { recursive: true });
	}

	if (!isDemo) {
		// Sequential for prod — deterministic, and a smaller memory footprint.
		for (const entry of ENTRIES) {
			await build(esmConfig(entry));
			await build(umdMinConfig(entry));
		}
		return;
	}

	await copySiblingBuilds();

	// The demo loads the root bundle and its stylesheet, and nothing else this
	// package builds.
	const demoBuild = esmConfig({ ...ROOT_ENTRY, external: [] });

	if (!isWatch) {
		await build(demoBuild);
		return;
	}

	// In watch mode `build()` resolves to the rolldown watcher as soon as it is
	// set up, before anything is on disk. Hold the server (and the browser it
	// opens) until the first bundle is written: the demo's inline module script
	// imports dist/index.esm.js, so Vite pre-transforms it on every request for
	// `/`, and a request that lands mid-write parses a truncated file and logs
	// a bogus "invalid JS syntax" error at 1:0. ERROR unblocks too, so a broken
	// first build still brings the server up and the next rebuild fixes it.
	const watcher = await build(demoBuild);
	await new Promise((resolve) => {
		watcher.on('event', (event) => {
			if (event.code === 'END' || event.code === 'ERROR') resolve();
		});
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
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
