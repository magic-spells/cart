# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Creates dist files (ESM, CJS, UMD, minified)
- **Development**: `npm run dev` or `npm run serve` - Runs Rollup in watch mode with dev server on port 3004
- **Linting**: `npm run lint` - Lints src/ and rollup.config.mjs with ESLint
- **Formatting**: `npm run format` - Formats code with Prettier

## Architecture

This is a web component library for Shopify shopping carts. It ships two independent entry points
in one package.

### Entry Points

- `src/cart-panel.js` → `@magic-spells/cart-panel` - registers `<cart-panel>` only
- `src/cart-item.js` → `@magic-spells/cart-panel/cart-item` - registers `<cart-item>`, `<cart-item-content>`, `<cart-item-processing>`

The panel never imports the item. Keep it that way: `src/cart-panel.js` must have no import of
`./cart-item.js`, or the item code lands back in the panel bundle.

### Core Components

- **CartPanel** (`<cart-panel>`) - Main component that manages cart data, AJAX requests, and rendering
- **CartItem** (`<cart-item>`) - Individual cart item with processing/destroying/appearing states
- **CartItemContent** (`<cart-item-content>`) - Content wrapper inside cart-item
- **CartItemProcessing** (`<cart-item-processing>`) - Processing overlay with loader

### Key Architecture Decisions

1. **Delegates modal to dialog-panel**: CartPanel finds its nearest `<dialog-panel>` ancestor and calls `show()`/`hide()` on it. No modal management code in cart-panel.

2. **Native dialog features**: Focus trap, escape key, backdrop click are all handled by `<dialog-panel>` which wraps native `<dialog>`.

3. **Cart data management**: CartPanel handles all Shopify AJAX (`/cart.json`, `/cart/change.json`) and cart item rendering with smart add/update/remove logic.

4. **Event-driven items**: CartItem emits `cart-item:remove` and `cart-item:quantity-change` events that bubble up to CartPanel.

5. **Opt-in cart-item**: CartPanel resolves the item constructor with `customElements.get('cart-item')` at render time. If nothing is registered it warns once on the render path (module-scoped flag in `src/cart-panel.js`), skips item rendering, and leaves count/subtotal/state rendering intact. It then waits on `customElements.whenDefined('cart-item')` and re-renders once the element shows up (guarded on the panel still being connected, having cart data, and not having rendered items already).

6. **Order-independent templates**: `setCartItemTemplate()` / `setCartItemProcessingTemplate()` buffer their calls in a module-scoped queue when `<cart-item>` is not registered yet, then replay them on `whenDefined`. The buffered templates are always flushed before the late-registration re-render. The render-path warn-once flag is separate from the template path so a setter call can never swallow the render warning. A registered element that lacks the static method warns once per method name.

### Usage Structure

```html
<dialog-panel id="cart-dialog">
  <dialog aria-labelledby="cart-title">
    <cart-panel manual>
      <div class="cart-header">
        <h2 id="cart-title">Shopping Cart</h2>
        <button aria-label="Close cart" data-action-hide-cart>&times;</button>
      </div>
      <div class="cart-body">
        <div data-cart-has-items>
          <div class="cart-items" data-content-cart-items></div>
        </div>
        <div data-cart-is-empty>
          <p>Your cart is empty</p>
        </div>
      </div>
      <div class="cart-footer">
        <span data-content-cart-count></span> items
        <span data-content-cart-subtotal></span>
        <button class="checkout-button">Checkout</button>
      </div>
    </cart-panel>
  </dialog>
</dialog-panel>
```

### Public API

**CartPanel Attributes:**
- `manual` - Skip auto-refresh on connect, require explicit `refreshCart()` call
- `state` - Reflected attribute: 'has-items' or 'empty'

**CartPanel Methods:**
- `show(triggerEl?, cartObj?)` - Find dialog-panel ancestor and open it
- `hide()` - Find dialog-panel ancestor and close it
- `getCart()` - Fetch from `/cart.json`
- `updateCartItem(key, quantity)` - POST to `/cart/change.json`
- `refreshCart(cartObj?)` - Update display with provided or fetched cart
- `setCartItemTemplate(name, fn)` - Set template for cart items
- `setCartItemProcessingTemplate(fn)` - Set processing overlay template
- `on(event, callback)` / `off(event, callback)` - Event subscription (chainable)

**CartPanel Events:**
- `cart-panel:show` - When show() is called (`{ triggerElement }`)
- `cart-panel:hide` - When hide() is called
- `cart-panel:refreshed` - After cart data refreshed (`{ cart }`)
- `cart-panel:updated` - After item quantity changed (`{ cart }`)
- `cart-panel:data-changed` - Any cart change (includes `calculated_count`, `calculated_subtotal`)

**CartItem Static Methods:**
- `CartItem.setTemplate(name, fn)` - Set template globally
- `CartItem.setProcessingTemplate(fn)` - Set processing overlay template
- `CartItem.createAnimated(itemData, cartData)` - Create with appearing animation

**CartItem Instance Methods:**
- `setState(state)` - Set 'ready'|'processing'|'destroying'|'appearing'
- `setData(itemData, cartData)` - Update item with new data
- `destroyYourself()` - Animate and remove from DOM

**CartItem States:**
- `ready` - Default interactive state
- `processing` - During AJAX calls (blur, scale, loader visible)
- `destroying` - Removal animation (height collapses)
- `appearing` - Entry animation (height expands)

**CartItem Events (bubbled):**
- `cart-item:remove` - Remove button clicked (`{ cartKey, element }`)
- `cart-item:quantity-change` - Quantity changed (`{ cartKey, quantity, element }`)

### Dependencies

- `@magic-spells/event-emitter` - Event system (bundled)
- `@magic-spells/dialog-panel` - Modal behavior (peer dependency)
- `@magic-spells/quantity-input` - Optional, for quantity controls in templates
- `@magic-spells/quantity-modifier` - Optional, for quantity controls in templates

CartItem listens for both `quantity-input:change` and `quantity-modifier:change` and syncs the
`value` of whichever element is present.

### Build System

Rollup builds the same four formats for each entry point via `productionBuilds()` in `rollup.config.mjs`:
- **ESM**: `dist/cart-panel.esm.js` / `dist/cart-item.esm.js`
- **CommonJS**: `dist/cart-panel.cjs.js` / `dist/cart-item.cjs.js`
- **UMD**: `dist/cart-panel.js` + `.min.js` (global `CartPanel`) / `dist/cart-item.js` + `.min.js`
  (global `MagicSpellsCartItem` - namespaced so the UMD exports object does not clobber the
  `window.CartItem` class global that `src/cart-item.js` sets for Shopify themes)
- **CSS**: `dist/cart-panel.css` and `dist/cart-item.css`, extracted separately from
  `src/cart-panel.css` and `src/cart-item.css`

`@magic-spells/event-emitter` stays external in ESM/CJS and is bundled into UMD. ESM and CJS are
never minified — they are inputs to a downstream bundler. The only minified JS this package ships is
`*.min.js`, which is UMD-derived.

**Watch mode never writes to `dist/`.** `rollup.config.mjs` exports *either* the production configs
(output `dist/`) *or* the watch configs (output `demo/`) — never both — so a `npm run dev` run cannot
touch a published artifact. This matters because the two ESM builds are legitimately different bytes:
the demo's copy bundles `@magic-spells/event-emitter` so a plain `<script type="module">` loads with
no import map, while the published copy leaves it external. When both wrote to `dist/` the result was
a race, and a dev-built `dist/cart-panel.esm.js` with the dependency inlined got committed twice.
A guard at the bottom of the config throws if any watch-mode output ever resolves outside `demo/`.

Watch mode writes `demo/{cart-panel,cart-item}.esm.js`, their sourcemaps, and their stylesheets
directly to their final location (no copy step) and serves `demo/` on port 3004.

### Line Item Properties

The cart-panel supports Shopify line item properties:

- `_hide_in_cart` - Hide item from display (still in actual cart)
- `_ignore_price_in_subtotal` - Exclude from subtotal calculation
- `_cart_template` - Use a specific template name for this item
- `_group_id` / `_group_role` - For bundle grouping

### HTML Selectors

**CartPanel selectors:**
- `[data-content-cart-items]` - Container where cart-item elements render
- `[data-cart-has-items]` - Section shown when cart has visible items
- `[data-cart-is-empty]` - Section shown when cart is empty
- `[data-action-hide-cart]` - Close buttons (click triggers hide())
- `[data-content-cart-count]` - Elements updated with visible item count
- `[data-content-cart-subtotal]` - Elements updated with formatted subtotal

**CartItem selectors (inside templates):**
- `[data-action-remove-item]` - Remove button (triggers cart-item:remove)
- `[data-cart-quantity]` - Quantity input field
- `[data-content-line-price]` - Line price display (auto-formatted)

### CSS Custom Properties

```css
cart-item {
  --cart-item-processing-duration: 250ms;
  --cart-item-destroying-duration: 600ms;
  --cart-item-appearing-duration: 400ms;
  --cart-item-shadow-color: rgba(0, 0, 0, 0.15);
  --cart-item-loader-color: #000;
  --cart-item-processing-scale: 0.98;
  --cart-item-destroying-scale: 0.85;
  --cart-item-processing-blur: 1px;
  --cart-item-destroying-blur: 10px;
}
```

### Template System

```javascript
const cartPanel = document.querySelector('cart-panel');

cartPanel.setCartItemTemplate('default', (itemData, cartData) => {
  return `
    <div class="cart-item">
      <img src="${itemData.image}" />
      <h4>${itemData.product_title}</h4>
      <quantity-input value="${itemData.quantity}" min="1"></quantity-input>
      <button data-action-remove-item>Remove</button>
      <span data-content-line-price></span>
    </div>
  `;
});

// Custom processing overlay
cartPanel.setCartItemProcessingTemplate(() => {
  return `<div class="custom-loader">Updating...</div>`;
});
```
