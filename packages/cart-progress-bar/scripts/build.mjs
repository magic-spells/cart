import { build, createServer } from 'vite';
import { rm, mkdir } from 'node:fs/promises';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import liveReload from '@magic-spells/vite-plugin-live-reload';

const isDev = process.env.NODE_ENV === 'development';
const outDir = isDev ? 'demo/dist' : 'dist';
const entry = 'src/cart-progress-bar.js';

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

function sharedBuild(overrides = {}) {
	return {
		configFile: false,
		logLevel: isDev ? 'warn' : 'info',
		css: { transformer: 'lightningcss' },
		build: {
			outDir,
			emptyOutDir: false,
			// Dev only. The published tarball is `files: ["dist/"]`, and rolldown
			// inlines `sourcesContent` — which ships `src/` a second time inside the
			// maps. `false` rather than `'hidden'`: both artifacts carry a
			// `//# sourceMappingURL=` comment, so emitting the map and merely
			// withholding it from the tarball would 404 in devtools. The demo keeps
			// its maps — demo/dist is gitignored and never published.
			sourcemap: isDev,
			target: 'es2022',
			reportCompressedSize: !isDev,
			watch: isDev ? {} : null,
			...overrides.build,
		},
		...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'build')),
	};
}

// `src/cart-progress-bar.js` side-effect imports its own CSS, so Vite extracts
// one stylesheet per pass and `lib.cssFileName` names it. The CSS is never a
// separate build entry.
function esmConfig({ emitCss = false } = {}) {
	return sharedBuild({
		build: {
			lib: {
				entry,
				fileName: () => 'cart-progress-bar.esm.js',
				formats: ['es'],
				...(emitCss ? { cssFileName: 'cart-progress-bar' } : {}),
			},
			minify: false,
			cssMinify: emitCss ? false : undefined,
			rolldownOptions: {
				output: { exports: 'named' },
			},
		},
	});
}

// There is deliberately no CommonJS build and no unminified UMD. The package
// ships exactly two JS entry points: `cart-progress-bar.esm.js` for anything
// with a module graph, and `cart-progress-bar.min.js` for a plain `<script>`
// tag. `package.json` declares no `require` condition.
function umdMinConfig({ emitCss = false } = {}) {
	return sharedBuild({
		build: {
			lib: {
				entry,
				name: 'CartProgressBar',
				fileName: () => 'cart-progress-bar.min.js',
				formats: ['umd'],
				...(emitCss ? { cssFileName: 'cart-progress-bar.min' } : {}),
			},
			minify: 'terser',
			terserOptions: {
				// Custom-element class names must survive — they are what
				// `customElements.define` registers and what consumers subclass.
				// `keep_classnames` alone is not enough here; see
				// RESERVED_CLASS_NAMES above.
				mangle: { keep_classnames: true, keep_fnames: false, reserved: RESERVED_CLASS_NAMES },
			},
			cssMinify: emitCss ? 'lightningcss' : undefined,
			rolldownOptions: {
				output: { exports: 'named' },
			},
		},
	});
}

async function main() {
	if (!isDev) {
		await rm(outDir, { recursive: true, force: true });
		await mkdir(outDir, { recursive: true });
	} else if (!existsSync(outDir)) {
		await mkdir(outDir, { recursive: true });
	}

	// Both passes run in dev too: the demo loads `cart-progress-bar.min.css`,
	// which only the terser pass emits.
	const configs = [esmConfig({ emitCss: true }), umdMinConfig({ emitCss: true })];

	if (isDev) {
		// Watch builds never resolve, so they are fired in parallel, unawaited.
		for (const config of configs) {
			build(config).catch((error) => {
				console.error('build error:', error);
			});
		}

		const server = await createServer({
			configFile: false,
			root: 'demo',
			server: { port: 3001, open: true, strictPort: false, host: true },
			// Raw-serve JS as well as CSS: Vite's cached transform of files the
			// module graph doesn't own is never invalidated, so the externally
			// rebuilt bundles go stale behind it.
			plugins: [liveReload({ distDir: 'demo/dist', extensions: ['.css', '.js', '.mjs', '.map'] })],
		});
		await server.listen();
		server.printUrls();
	} else {
		// Sequential for prod — deterministic, and a smaller memory footprint.
		for (const config of configs) {
			await build(config);
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
