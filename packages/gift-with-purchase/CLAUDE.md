# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Builds the published `dist/` (ESM, minified UMD, CSS, minified CSS) via `scripts/build.mjs` (Vite JS API, no `vite.config.js`)
- **Development**: `npm run dev` - Builds to `demo/dist/` in watch mode and serves `demo/` on port 3000
- **Lint**: `npm run lint` - Lints JavaScript files using ESLint
- **Format**: `npm run format` - Formats code using Prettier
- **Pre-publish**: `npm run prepublishOnly` - Automatically runs build before publishing

## Project Architecture

This is a **Web Components library** that provides a gift-with-purchase component for e-commerce sites, particularly Shopify stores.

### Core Architecture

- **Single Web Component**: `GiftWithPurchase` extends `HTMLElement` using native Custom Elements API
- **No Framework Dependencies**: Pure JavaScript implementation with plain CSS for styling
- **Shopify Integration**: Built-in Cart API integration (`/cart/add.js`, `/cart/change.js`, `/cart.js`)
- **Event-Driven**: Uses CustomEvents for cart interactions and parent component communication

### Key Files

- `src/gift-with-purchase.js` - Main component class with private fields pattern (#threshold, #currentAmount, etc.)
- `src/gift-with-purchase.css` - Flat CSS with the `--gwp-*` custom property API
- `scripts/build.mjs` - Build script (ESM + minified UMD, prod to `dist/`, dev to `demo/dist/`)
- `demo/index.html` - Demo page served during development; loads `dist/*` relative to `demo/`

### Component Features

- **Threshold Management**: Automatically adds/removes gifts based on cart amount vs threshold using `calculated_subtotal`
- **Cart Panel Integration**: Listens for `cart-panel:data-changed` events from parent cart-panel component and uses accurate pricing logic
- **State Management**: Five states - `inactive` (below threshold), `active` (threshold met), `added` (gift in cart), `ended` (promo ended), `disabled` (product unavailable)
- **Message Injection**: Looks for user-provided elements with `data-content-gwp-message` to inject threshold messages
- **Template Syntax**: Uses `[amount]` placeholder in `message-below` attribute for remaining threshold amount
  - Square brackets avoid conflicts with Liquid (`{{ }}`) and JS template literals
  - Example: `message-below="Add [amount] more!"` → "Add $30 more!"
- **Currency Formatting**: Supports Shopify-style `money-format` attribute (e.g., `${{amount}}`, `€{{amount}}`) for proper currency display
- **Multi-Currency**: Automatically converts threshold and `[amount]` using `Shopify.currency.rate`
  - Set threshold in base currency; component converts to customer's selected currency
- **Disabled States**: `promo-ended` and `product-available` attributes control visibility and auto-remove the gift when disabled. Removal is scoped to this component's own `variant-id` (`#getGiftLines()` matches `_gwp_item` **and** `variant_id`), so a multi-tier page disabling one tier never clears another tier's gift
- **Smart Line Item Properties**: Adds multiple properties to gift line items:
  - `_gwp_item: "true"` - identifies the item as a gift with purchase
  - `_hide_in_cart: "true"` - hides the gift from cart display (handled by cart-panel)
  - `_ignore_price_in_subtotal: "true"` - excludes gift price from subtotal calculations

### Build System

- **Vite (Rolldown) via JS API**: `scripts/build.mjs` is the config — `configFile: false`, no `vite.config.js`
- **Lightning CSS**: Transforms and minifies the stylesheet; CSS is extracted, never injected
- **Terser**: Minifies the UMD bundle. `keep_classnames` alone does not save the class name — Rolldown turns `class GiftWithPurchase extends HTMLElement {}` into `var GiftWithPurchase = class ...` first, leaving nothing named for Terser to keep. `RESERVED_CLASS_NAMES` (scanned out of `src/*.js` at the top of the build script) passes the names as `mangle.reserved`, which is what actually preserves them. `rolldownOptions.output.keepNames` is a dead end — Vite calls `rolldown(inputOptions)` before `bundle.write(outputOptions)`, so rolldown reads it before it exists.
- **Sourcemaps**: Dev only — `dist/` ships no `.map` files
- **Development Server**: Serves `demo/` on port 3000 with `@magic-spells/vite-plugin-live-reload` watching `demo/dist/`

### Package Distribution

- **Module Entry**: `dist/gift-with-purchase.esm.js` (ES Modules) — the only JS entry for bundlers
- **UMD Bundle**: `dist/gift-with-purchase.min.js` (browser global `GiftWithPurchase`)
- **Styles**: `dist/gift-with-purchase.css` (`./css`) and `dist/gift-with-purchase.min.css` (`./css/min`)
- **ESM only**: No CommonJS build and no `require` condition — `require()` fails at resolution
- **Files Published**: `dist/` only (see package.json files array)

### Cart Integration & Pricing Logic

The component integrates seamlessly with `@magic-spells/cart-panel`:
- **Smart Pricing**: Uses `calculated_subtotal` from cart-panel events, which properly handles item exclusions
- **Threshold Calculation**: Only includes items that should count toward the gift threshold (excludes gifts with purchase, bundle hidden items, etc.)
- **Gift Exclusion**: Gifts added by this component are automatically excluded from future threshold calculations via `_ignore_price_in_subtotal`
- **Requires cart-panel**: The component requires `calculated_subtotal` in cart events; it will not process events without this field

### Mutation Safety Invariants

Cart snapshots arrive by event and go stale the moment this component mutates the cart, so:

- **`#isMutating`** is set before every fetch (`add`, `remove`, `trim`) and cleared in `finally`. Any `#updateState()` or debounced snapshot arriving while it is set is dropped and recorded in **`#missedUpdate`**.
- **`#discardStaleCart()`** runs in that same `finally`: it kills a pending debounce (a timer armed mid-mutation holds a pre-mutation cart) and, if anything was missed, asks the panel to re-fetch — or re-derives locally when there is no panel.
- **Never act on a snapshot captured before a mutation.** `#removeGiftFromCart(cart)` takes a cart only when it is fresh; setters, attribute changes and disable transitions pass `null` and go through **`#fetchCart()`** for live truth.
- **The gift adds on state, not on an edge.** `#updateState()` adds whenever `isActive && !isAdded`, so a missed rising edge still converges.
- **A doubled gift line self-heals.** `#checkGiftInCart()` trims any gift line with `quantity > 1` back to 1, because the line is `_hide_in_cart` and a duplicate would otherwise ride to checkout unseen.
- Removal is always scoped by `variant-id`; there is deliberately no "remove every gift" path.

### Styling Architecture

- **CSS Custom Properties**: `--gwp-*` properties declared on the `gift-with-purchase` element itself, so they stay overridable per instance
- **State Attribute**: `state="inactive|active|added|ended|disabled"` for CSS styling hooks (e.g., `gift-with-purchase[state="active"]`)
- **Flat selectors**: No nesting, no `@layer`, no preprocessor — every rule is a full longhand selector