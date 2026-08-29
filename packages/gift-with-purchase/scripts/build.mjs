import { build, createServer } from 'vite';
import { rm, mkdir } from 'node:fs/promises';
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

function sharedBuild(overrides = {}) {
	return {
		configFile: false,
		logLevel: isDev ? 'warn' : 'info',
		css: { transformer: 'lightningcss' },
		build: {
			outDir,
			emptyOutDir: false,
			// Dev only. The published tarball is `files: ["dist/"]`, and rolldown
			// inlines `sourcesContent`, so shipping maps would ship `src/` twice
			// over. `false` rather than `'hidden'`: both artifacts carry a
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

function esmConfig({ emitCss = false } = {}) {
	return sharedBuild({
		build: {
			lib: {
				entry: 'src/gift-with-purchase.js',
				fileName: () => 'gift-with-purchase.esm.js',
				formats: ['es'],
				...(emitCss ? { cssFileName: 'gift-with-purchase' } : {}),
			},
			minify: false,
			cssMinify: emitCss ? false : undefined,
			rolldownOptions: {
				output: { exports: 'named' },
			},
		},
	});
}

// There is deliberately no CommonJS build, and no unminified UMD. The package
// ships exactly two JS entry points: `gift-with-purchase.esm.js` for anything
// with a module graph, and `gift-with-purchase.min.js` for a plain `<script>`
// tag. CommonJS is not supported — `package.json` has no `require` condition,
// so `require()` fails at resolution with a clear error instead of at runtime
// with a confusing one.
function umdMinConfig({ emitCss = false } = {}) {
	return sharedBuild({
		build: {
			lib: {
				entry: 'src/gift-with-purchase.js',
				name: 'GiftWithPurchase',
				fileName: () => 'gift-with-purchase.min.js',
				formats: ['umd'],
				...(emitCss ? { cssFileName: 'gift-with-purchase.min' } : {}),
			},
			minify: 'terser',
			terserOptions: {
				// custom-element class names are the public API — never mangle them.
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
		// Clean prod output before building
		await rm(outDir, { recursive: true, force: true });
		await mkdir(outDir, { recursive: true });
	} else if (!existsSync(outDir)) {
		await mkdir(outDir, { recursive: true });
	}

	// The demo loads `gift-with-purchase.esm.js` and `gift-with-purchase.min.css`,
	// so dev needs both configs: the ESM bundle and the minified CSS the UMD pass
	// emits alongside it.
	const configs = [esmConfig({ emitCss: true }), umdMinConfig({ emitCss: true })];

	if (isDev) {
		// Fire all builds in parallel — `watch: {}` never resolves, so awaiting
		// the first would block the rest and the dev server behind it.
		for (const config of configs) {
			build(config).catch((error) => {
				console.error('build error:', error);
			});
		}

		// Dev server serving demo/
		const server = await createServer({
			configFile: false,
			root: 'demo',
			server: { port: 3000, open: true, strictPort: false, host: true },
			// raw-serve JS as well as CSS: Vite's cached transform of files the
			// module graph doesn't own is never invalidated, so the externally
			// rebuilt bundles go stale behind it (the plugin README, quirk #2)
			plugins: [liveReload({ distDir: 'demo/dist', extensions: ['.css', '.js', '.mjs', '.map'] })],
		});
		await server.listen();
		server.printUrls();
	} else {
		// Sequential builds for prod (deterministic + smaller memory footprint)
		for (const config of configs) {
			await build(config);
		}
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
