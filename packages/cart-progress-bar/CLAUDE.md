# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview
This is a web component library for e-commerce cart progress bars that show free shipping thresholds. The component is built as a vanilla JavaScript Custom Element with SCSS styling, distributed as ESM, CommonJS, and UMD modules.

## Build and Development Commands

### Core Development
- `npm run build` - Build all distribution files (ESM, CommonJS, UMD, minified)
- `npm run dev` or `npm run serve` - Start development server with auto-rebuild and live preview at http://localhost:3001
- `npm run lint` - Run ESLint on source files and config
- `npm run format` - Format code with Prettier

### Pre-publish
- `npm run prepublishOnly` - Automatically runs before publishing to npm (runs build)

## Architecture

### Core Components
- **CartProgressBar** (`src/cart-progress-bar.js`): Main web component class that manages progress calculation, message templating, and cart integration
- **ProgressBar** (`src/cart-progress-bar.js`): Helper component for the visual progress bar element
- **SCSS** (`src/cart-progress-bar.scss`): Styling with CSS custom properties for theming

### Web Component API
The component exposes a JavaScript API:
- `setPercent(percent)` - Set progress percentage directly
- `setCurrentAmount(amount)` - Update current cart amount
- `setThresholdAmount(amount)` - Set free shipping threshold
- `getProgress()` - Get current progress information
- `setMessages(aboveMessage, belowMessage)` - Update message templates

### Build System
Uses Rollup to generate multiple distribution formats:
- ESM: `dist/cart-progress-bar.esm.js` (includes CSS extraction)
- CommonJS: `dist/cart-progress-bar.cjs.js` (includes CSS extraction)
- UMD: `dist/cart-progress-bar.js` (includes CSS extraction)
- Minified UMD: `dist/cart-progress-bar.min.js` (includes minified CSS)
- CSS: `dist/cart-progress-bar.css` (from ESM/CommonJS/UMD builds) and `dist/cart-progress-bar.min.css` (from minified build)
- SCSS Source: `dist/cart-progress-bar.scss` (copy of source file)

### Cart Integration
The component automatically integrates with a parent `<cart-dialog>` component (from `@magic-spells/cart-panel`) by listening for `cart-dialog:data-changed` events to update progress when cart totals change. The cart-dialog component provides cart management functionality including Shopify API integration, and emits data change events that the progress bar automatically responds to.

**Smart Pricing Logic**: The progress bar uses `calculated_subtotal` when available, which properly excludes items with the `_ignore_price_in_subtotal` property (such as gifts with purchase). Falls back to `total_price` for backwards compatibility. This ensures that:
- Bundle items that are hidden (`_hide_in_cart`) but should count toward free shipping are included
- Gift items with `_ignore_price_in_subtotal` are excluded from the progress calculation

### Message Templating
Uses flexible placeholder formats in message templates. Users include currency symbols directly in their messages. Supports multiple placeholder formats:
- `{ amount }` - with spaces around amount
- `{amount}` - no spaces
- `[amount]` - square brackets (with or without spaces)

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
- `--cart-progress-bar-shadow`
- `--cart-progress-bar-transition-duration`
- `--cart-progress-section-bg`
- `--cart-progress-section-color`
- `--cart-progress-bar-bg`
- `--cart-progress-bar-fill-before`
- `--cart-progress-bar-fill-after`
- `--cart-progress-bar-fill-current` (dynamic, set by JavaScript)
- `--cart-progress-percent` (dynamic, set by JavaScript)

### Browser Support
Targets modern browsers with Custom Elements support. Uses browserslist config: "last 2 versions", "not dead", "not ie <= 11".