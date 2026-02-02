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
