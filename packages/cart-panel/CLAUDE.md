# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Creates dist files (ESM, CJS, UMD, minified)
- **Development**: `npm run dev` or `npm run serve` - Runs Rollup in watch mode with dev server on port 3004
- **Linting**: `npm run lint` - Lints src/ and rollup.config.mjs with ESLint
- **Formatting**: `npm run format` - Formats code with Prettier

## Architecture

This is a web component library for Shopify shopping carts. It provides two main components:

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

### Usage Structure

```html
<dialog-panel id="cart-dialog">
  <dialog>
    <cart-panel>
      <div data-cart-has-items>
        <div data-content-cart-items></div>
      </div>
      <div data-cart-is-empty>Empty cart message</div>
      <button data-action-hide-cart>Close</button>
      <span data-content-cart-count></span>
      <span data-content-cart-subtotal></span>
    </cart-panel>
  </dialog>
</dialog-panel>
```

### Public API

**CartPanel Methods:**
- `show(triggerEl?)` - Find dialog-panel ancestor and open it
- `hide()` - Find dialog-panel ancestor and close it
- `getCart()` - Fetch from `/cart.json`
- `updateCartItem(key, quantity)` - POST to `/cart/change.json`
- `refreshCart(cartObj?)` - Update display with provided or fetched cart
- `setCartItemTemplate(name, fn)` - Set template for cart items
- `on(event, callback)` / `off(event, callback)` - Event subscription

**Events:**
- `cart-panel:show` - When show() is called
- `cart-panel:hide` - When hide() is called
- `cart-panel:refreshed` - After cart data refreshed
- `cart-panel:updated` - After item quantity changed
- `cart-panel:data-changed` - Any cart change (includes `calculated_count`, `calculated_subtotal`)

**CartItem States:**
- `ready` - Default interactive state
- `processing` - During AJAX calls (blur, scale, loader visible)
- `destroying` - Removal animation (height collapses)
- `appearing` - Entry animation (height expands)

### Dependencies

- `@magic-spells/event-emitter` - Event system (bundled)
- `@magic-spells/dialog-panel` - Modal behavior (peer dependency)
- `@magic-spells/quantity-input` - Optional, for quantity controls in templates

### Build System

Rollup creates multiple formats:
- **ESM**: `dist/cart-panel.esm.js`
- **CommonJS**: `dist/cart-panel.cjs.js`
- **UMD**: `dist/cart-panel.js` / `dist/cart-panel.min.js`
- **CSS**: `dist/cart-panel.css` (includes cart-item styles)

### Line Item Properties

The cart-panel supports Shopify line item properties:

- `_hide_in_cart` - Hide item from display (still in actual cart)
- `_ignore_price_in_subtotal` - Exclude from subtotal calculation
- `_cart_template` - Use a specific template name for this item
- `_group_id` / `_group_role` - For bundle grouping

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
```
