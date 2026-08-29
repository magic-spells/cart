# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a web component library for e-commerce cart progress bars that show free shipping thresholds. The component is built as a vanilla JavaScript Custom Element with plain CSS styling, distributed as an ESM bundle plus a minified UMD bundle. **ESM only — there is deliberately no CommonJS build and no `require` condition, and there is no Sass anywhere; the source authors plain `.css`.**

## Build and Development Commands

### Core Development
- `npm run build` - Production build to `dist/` (unminified ESM, minified UMD, plain CSS, minified CSS)
- `npm run dev` - Watch build into `demo/dist/` plus a Vite dev server for `demo/` at http://localhost:3001 with live reload
- `npm run lint` - Run ESLint on source files and the build script
- `npm run format` - Format code with Prettier

### Pre-publish
- `npm run prepublishOnly` - Automatically runs before publishing to npm (runs build)

## Architecture

### Core Components
- **CartProgressBar** (`src/cart-progress-bar.js`): Main web component class that manages progress calculation, message templating, and cart integration
- **ProgressBar** (`src/cart-progress-bar.js`): Helper component for the visual progress bar element
- **CSS** (`src/cart-progress-bar.css`): Styling with CSS custom properties for theming

### Web Component API
The component exposes a JavaScript API:
- `setPercent(percent)` - Set progress percentage directly
- `setCurrentAmount(amount)` - Update current cart amount
- `setThresholdAmount(amount)` - Set free shipping threshold
- `getProgress()` - Get current progress information
- `setMessages(aboveMessage, belowMessage)` - Update message templates

### Build System
`scripts/build.mjs` is the entire build configuration — programmatic Vite 8 (Rolldown) with `configFile: false`, Lightning CSS as the CSS transformer, and Terser on the minified pass. **There is no `vite.config.js` and no `rollup.config.mjs`; do not add one.**

Two passes, each a Vite library build over the single entry `src/cart-progress-bar.js`. That entry side-effect imports `./cart-progress-bar.css`, so Vite extracts one stylesheet per pass and `lib.cssFileName` names it — the CSS is never a separate build entry. `dist/` contains exactly four files:

- `dist/cart-progress-bar.esm.js` — unminified ESM
- `dist/cart-progress-bar.min.js` — minified UMD, global `CartProgressBar`
- `dist/cart-progress-bar.css` — plain stylesheet (ESM pass, `cssFileName: 'cart-progress-bar'`)
- `dist/cart-progress-bar.min.css` — Lightning-CSS-minified stylesheet (Terser pass, `cssFileName: 'cart-progress-bar.min'`)

Details that are load-bearing:

- **`sourcemap: isDev`.** The published tarball is `files: ["dist/"]` and Rolldown inlines `sourcesContent`, so shipped maps would carry `src/` a second time. `false` rather than `'hidden'` — a withheld map that the artifact still points at 404s in devtools. `demo/dist` keeps its maps; it is gitignored and never published.
- **`outDir` is `demo/dist` in dev, `dist` in prod, and dev output must never land in `dist/`.** Every config sets `emptyOutDir: false`; the script itself does the one `rm` + `mkdir` of `dist/`, prod only.
- **Prod builds run sequentially** (`await build(cfg)` in a loop) for determinism. **Dev builds are fired in parallel, unawaited**, because `watch: {}` never resolves.
- **Dev runs BOTH passes**, unlike some sibling packages: the demo loads `cart-progress-bar.min.css`, which only the Terser pass emits.
- The dev server uses `@magic-spells/vite-plugin-live-reload` in its object form, raw-serving `.js`/`.mjs`/`.map` as well as `.css` — Vite's cached transform of files the module graph doesn't own is never invalidated, so externally rebuilt bundles go stale behind it.
- **Class names are preserved in `.min.js` by `mangle.reserved`, not by `keep_classnames`.** Rolldown rewrites `class CartProgressBar extends HTMLElement {}` into `var CartProgressBar = class extends HTMLElement {}` before Terser runs, so `mangle.keep_classnames: true` has no named class to keep and the binding used to mangle down to `r`. `RESERVED_CLASS_NAMES` at the top of the script scans `src/*.js` for class declarations and passes them as Terser's `mangle.reserved`; a reserved identifier is never renamed, so the `var` survives and named evaluation gives the class its name back. Do not remove it — `constructor.name` and the devtools display depend on it. (`rolldownOptions.output.keepNames` looks like the obvious fix and does nothing: Vite calls `rolldown(inputOptions)` before `bundle.write(outputOptions)`, so rolldown reads `outputOptions.keepNames` when there are no output options yet.)

### Cart Integration
The component integrates with a parent element by listening for data-change events. By default it uses `closest('cart-panel')` and listens for `'cart-panel:data-changed'`, but both are configurable via attributes:
- `listen-selector`: CSS selector for `closest()` to find the target element (default: `'cart-panel'`)
- `listen-event`: event name to listen for on that element (default: `'cart-panel:data-changed'`)

**Smart Pricing Logic**: The progress bar uses `calculated_subtotal` when available, which properly excludes items with the `_ignore_price_in_subtotal` property (such as gifts with purchase). Falls back to `total_price` for backwards compatibility. This ensures that:
- Bundle items that are hidden (`_hide_in_cart`) but should count toward free shipping are included
- Gift items with `_ignore_price_in_subtotal` are excluded from the progress calculation

### Message Templating
Uses `[amount]` placeholders in message templates (with or without spaces, e.g. `[ amount ]`). Users include currency symbols directly in their messages.

Shows different messages based on completion status:
- `message-below`: Shown when cart total is below threshold (e.g., "Add ${ amount } more for free shipping!")
- `message-above`: Shown when cart total meets/exceeds threshold (e.g., "🎉 FREE shipping unlocked!")

Amount formatting: Uses `toFixed(2).replace('.00', '')` to keep amounts compact (e.g., "15" instead of "15.00", but "15.50" stays "15.50").

## Development Notes

### Testing
There are no automated tests configured. The demo at `demo/index.html` serves as manual testing and showcases all features.

### Styling
Uses CSS custom properties for theming:
- `--cart-progress-bar-height`
- `--cart-progress-bar-border-radius`
- `--cart-progress-bar-transition-duration`
- `--cart-progress-bar-bg`
- `--cart-progress-bar-fill-before`
- `--cart-progress-bar-fill-after`
- `--cart-progress-bar-fill-current` (dynamic, set by JavaScript)
- `--cart-progress-percent` (dynamic, set by JavaScript)

### Browser Support
Targets modern browsers with Custom Elements support. Uses browserslist config: "last 2 versions", "not dead", "not ie <= 11".