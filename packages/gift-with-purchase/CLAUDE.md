# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Builds all distribution files (ESM, CJS, UMD) using Rollup
- **Development**: `npm run dev` or `npm run serve` - Starts development server with hot reload on port 3000
- **Lint**: `npm run lint` - Lints JavaScript files using ESLint
- **Format**: `npm run format` - Formats code using Prettier
- **Pre-publish**: `npm run prepublishOnly` - Automatically runs build before publishing

## Project Architecture

This is a **Web Components library** that provides a gift-with-purchase component for e-commerce sites, particularly Shopify stores.

### Core Architecture

- **Single Web Component**: `GiftWithPurchase` extends `HTMLElement` using native Custom Elements API
- **No Framework Dependencies**: Pure JavaScript implementation with SCSS for styling
- **Shopify Integration**: Built-in Cart API integration (`/cart/add.js`, `/cart/change.js`, `/cart.js`)
- **Event-Driven**: Uses CustomEvents for cart interactions and parent component communication

### Key Files

- `src/gift-with-purchase.js` - Main component class with private fields pattern (#threshold, #currentAmount, etc.)
- `src/gift-with-purchase.scss` - Comprehensive SCSS with CSS custom properties and responsive design
- `rollup.config.mjs` - Multi-target build configuration (ESM, CJS, UMD, demo)
- `demo/index.html` - Demo page served during development

### Component Features

- **Threshold Management**: Automatically adds/removes gifts based on cart amount vs threshold using `calculated_subtotal`
- **Cart Panel Integration**: Listens for `cart-panel:data-changed` events from parent cart-panel component and uses accurate pricing logic
- **State Management**: Three states - inactive (below threshold), active (threshold met), added (gift in cart)
- **Message Injection**: Looks for user-provided elements with `data-content-gwp-message` to inject threshold messages
- **Template Syntax**: Uses `[amount]` placeholder in `message-below` attribute for remaining threshold amount (uses brackets to avoid Liquid/JS template conflicts)
- **Currency Formatting**: Supports Shopify-style `money-format` attribute (e.g., `${{amount}}`, `€{{amount}}`) for proper currency display
- **Multi-Currency**: Automatically converts threshold using `Shopify.currency.rate` for stores with multiple currencies enabled
- **Smart Line Item Properties**: Adds multiple properties to gift line items:
  - `_gwp_item: "true"` - identifies the item as a gift with purchase
  - `_hide_in_cart: "true"` - hides the gift from cart display (handled by cart-panel)
  - `_ignore_price_in_subtotal: "true"` - excludes gift price from subtotal calculations

### Build System

- **Rollup**: Creates multiple distribution formats with source maps
- **PostCSS + Sass**: Processes SCSS to CSS with extraction and minification
- **Development Server**: Auto-opens browser and serves demo on file changes
- **Copy Plugin**: Copies source SCSS to dist for external consumption

### Package Distribution

- **Main Entry**: `dist/gift-with-purchase.cjs.js` (CommonJS)
- **Module Entry**: `dist/gift-with-purchase.esm.js` (ES Modules) 
- **UMD Bundle**: `dist/gift-with-purchase.min.js` (Browser global)
- **Styles**: Both regular and minified CSS, plus source SCSS
- **Exports**: Configured for modern import patterns with CSS imports
- **Files Published**: Both `src/` and `dist/` directories (see package.json files array)

### Cart Integration & Pricing Logic

The component integrates seamlessly with `@magic-spells/cart-panel`:
- **Smart Pricing**: Uses `calculated_subtotal` from cart-panel events, which properly handles item exclusions
- **Threshold Calculation**: Only includes items that should count toward the gift threshold (excludes gifts with purchase, bundle hidden items, etc.)
- **Gift Exclusion**: Gifts added by this component are automatically excluded from future threshold calculations via `_ignore_price_in_subtotal`
- **Requires cart-panel**: The component requires `calculated_subtotal` in cart events; it will not process events without this field

### Styling Architecture

- **CSS Custom Properties**: Extensive theming support with fallback SCSS variables
- **State Attribute**: `state="inactive|active|added|ended|disabled"` for CSS styling hooks (e.g., `gift-with-purchase[state="active"]`)
- **Responsive Design**: Mobile-first with configurable breakpoints
- **Accessibility**: High contrast, reduced motion, and dark mode support
- **Print Styles**: Optimized for printed output