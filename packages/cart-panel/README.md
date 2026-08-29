# @magic-spells/cart-panel

A slide-out shopping cart web component. The panel owns the cart data, the Shopify AJAX and the item rendering; `@magic-spells/dialog-panel` owns the modal.

[**Live Demo**](https://magic-spells.github.io/cart-panel/demo/)

## Size & scope

**2.8 kB** min + gzip for the panel (2.7 kB JS, 0.1 kB CSS) · **2.8 kB** for the opt-in cart item (1.8 kB JS, 1.0 kB CSS). Two entry points, so a page that brings its own item element pays for the panel only.

## Features

- **Complete cart management** - Handles cart data, AJAX requests, and item rendering
- **Opt-in cart-item** - `<cart-item>` ships in the same package on its own subpath export, so you only pay for it if you use it
- **Delegates modal to dialog-panel** - Works with `@magic-spells/dialog-panel` for accessible modal behavior
- **Real-time sync** - Automatic cart updates via `/cart.json` and `/cart/change.json` APIs
- **Event-driven architecture** - Rich event system with custom event emitter
- **Smooth animations** - CSS transitions for processing, appearing, and destroying states
- **Highly customizable** - CSS custom properties and template system
- **Framework agnostic** - Pure Web Components work with any framework
- **Shopify-ready** - Built specifically for Shopify cart integrations

## Installation

```bash
npm install @magic-spells/cart-panel
```

```javascript
// The panel only - does NOT register <cart-item>
import '@magic-spells/cart-panel';
import '@magic-spells/cart-panel/css';

// Opt in to the built-in cart item component
import '@magic-spells/cart-panel/cart-item';
import '@magic-spells/cart-panel/cart-item/css';
```

Or include directly in your HTML:

```html
<script src="https://unpkg.com/@magic-spells/cart-panel"></script>
<link rel="stylesheet" href="https://unpkg.com/@magic-spells/cart-panel/dist/cart-panel.css" />

<!-- opt in to cart-item -->
<script src="https://unpkg.com/@magic-spells/cart-panel/dist/cart-item.min.js"></script>
<link rel="stylesheet" href="https://unpkg.com/@magic-spells/cart-panel/dist/cart-item.css" />
```

The script builds register their elements on load. They also expose globals: `window.CartPanel` and
`window.MagicSpellsCartItem` hold each build's exports, and `window.CartItem` is the `CartItem`
class itself for Shopify themes that reference it directly.

### Entry Points

| Import path                             | Registers                                                  | Contents                 |
| --------------------------------------- | ---------------------------------------------------------- | ------------------------ |
| `@magic-spells/cart-panel`              | `<cart-panel>`                                             | `CartPanel`              |
| `@magic-spells/cart-panel/css`          | -                                                          | `cart-panel` styles      |
| `@magic-spells/cart-panel/css/min`      | -                                                          | `cart-panel` styles (minified) |
| `@magic-spells/cart-panel/cart-item`    | `<cart-item>`, `<cart-item-content>`, `<cart-item-processing>` | `CartItem`, `CartItemContent`, `CartItemProcessing` |
| `@magic-spells/cart-panel/cart-item/css` | -                                                          | cart item styles         |
| `@magic-spells/cart-panel/cart-item/css/min` | -                                                      | cart item styles (minified) |

### Opt-in cart items

`cart-panel` does not bundle or register `<cart-item>`. At render time it looks the element up
with `customElements.get('cart-item')`:

- **Registered** - the panel renders, updates, and animates items as usual.
- **Not registered** - the panel logs a single warning, skips item rendering, and everything
  else (cart count, subtotal, `has-items`/`empty` state, events) keeps working.

Import order does not matter. `setCartItemTemplate()` and `setCartItemProcessingTemplate()` buffer
their templates when `<cart-item>` is not registered yet and apply them as soon as it is, and the
panel watches for a late registration with `customElements.whenDefined('cart-item')` so it renders
the cart it already has without waiting for another `refreshCart()`.

That means you can drop in your own item element instead of the built-in one:

```javascript
import '@magic-spells/cart-panel';

customElements.define('cart-item', MyCartItem);
```

A replacement element has to satisfy the contract the panel calls into:

- **Constructor** - `new El(itemData, cartData)`, since the panel constructs items directly.
- **`key` attribute** - the element must set `key` to `item.key || item.id`. The panel diffs the
  rendered items by that attribute, so an element that never sets it is destroyed and recreated on
  every refresh.
- **Static methods** - `setTemplate(name, fn)`, `setProcessingTemplate(fn)`,
  `createAnimated(itemData, cartData)`. A missing static template method logs a warning and the
  template is ignored.
- **Instance methods** - `setData(itemData, cartData)`, `setState(state)`, `destroyYourself()`.

## Usage

The cart-panel component delegates modal behavior to a `<dialog-panel>` ancestor. It finds its nearest `<dialog-panel>` and calls `show()`/`hide()` on it.

```html
<!-- Cart with dialog-panel wrapper -->
<dialog-panel id="cart-dialog">
  <dialog aria-labelledby="cart-title">
    <cart-panel manual>
      <div class="cart-header">
        <h2 id="cart-title">Shopping Cart</h2>
        <button aria-label="Close cart" class="close-button" data-action-hide-cart>
          &times;
        </button>
      </div>
      <div class="cart-body">
        <!-- Cart has items section -->
        <div data-cart-has-items>
          <div class="cart-items" data-content-cart-items>
            <!-- Cart items rendered dynamically -->
          </div>
        </div>

        <!-- Cart is empty section -->
        <div data-cart-is-empty>
          <div class="empty-cart">
            <p>Your cart is empty</p>
            <p>Add some items to get started!</p>
          </div>
        </div>
      </div>
      <div class="cart-footer">
        <div class="cart-total">
          Subtotal: <span data-content-cart-subtotal>$0.00</span>
        </div>
        <button class="checkout-button">Proceed to Checkout</button>
      </div>
    </cart-panel>
  </dialog>
</dialog-panel>

<!-- Trigger button -->
<button onclick="document.querySelector('cart-panel').show()">
  Open Cart
</button>
```

## How It Works

The cart panel architecture consists of:

- **cart-panel**: Main component managing cart data, AJAX requests, and rendering (`@magic-spells/cart-panel`)
- **cart-item**: Individual cart item with state management and animations (`@magic-spells/cart-panel/cart-item`)
- **cart-item-content**: Content wrapper inside cart-item
- **cart-item-processing**: Processing overlay with loader

The component automatically handles:

- Fetching cart data from `/cart.json` on show
- Updating cart items via `/cart/change.json` API calls
- Smart rendering with add/update/remove animations
- Filtering out cart items with `_hide_in_cart` property from display and calculations
- Emitting events for cart updates and state changes

### Key Architecture Decisions

1. **Delegates modal to dialog-panel**: CartPanel finds its nearest `<dialog-panel>` ancestor and calls `show()`/`hide()` on it. No modal management code in cart-panel.

2. **Native dialog features**: Focus trap, escape key, backdrop click are all handled by `<dialog-panel>` which wraps native `<dialog>`.

3. **Event-driven items**: CartItem emits `cart-item:remove` and `cart-item:quantity-change` events that bubble up to CartPanel.

4. **Runtime cart-item lookup**: CartPanel never imports CartItem. It resolves the element from the custom element registry, so the item component is opt-in and swappable.

## Configuration

### CartPanel Attributes

| Attribute | Type    | Description                                            |
| --------- | ------- | ------------------------------------------------------ |
| `manual`  | Boolean | Skip auto-refresh on connect, require explicit refreshCart() |
| `state`   | String  | Reflected attribute: 'has-items' or 'empty'            |

### Required HTML Structure

| Selector                    | Description                              | Required |
| --------------------------- | ---------------------------------------- | -------- |
| `[data-content-cart-items]` | Container where cart-item elements render | Yes      |
| `[data-cart-has-items]`     | Section shown when cart has visible items | No       |
| `[data-cart-is-empty]`      | Section shown when cart is empty          | No       |
| `[data-action-hide-cart]`   | Close buttons (click triggers hide())     | No       |
| `[data-content-cart-count]` | Elements updated with visible item count  | No       |
| `[data-content-cart-subtotal]` | Elements updated with formatted subtotal | No       |

### CartItem Child Elements

| Selector                    | Description                                    |
| --------------------------- | ---------------------------------------------- |
| `[data-action-remove-item]` | Remove button (triggers cart-item:remove)      |
| `[data-cart-quantity]`      | Quantity input field                           |
| `[data-content-line-price]` | Line price display (auto-formatted)            |

## JavaScript API

### CartPanel Methods

```javascript
const cartPanel = document.querySelector('cart-panel');

// Dialog Control
cartPanel.show(triggerEl?, cartObj?)  // Open modal and refresh cart
cartPanel.hide()                       // Close modal

// Cart Data
cartPanel.getCart()                    // Fetch from /cart.json
cartPanel.updateCartItem(key, quantity) // POST to /cart/change.json
cartPanel.refreshCart(cartObj?)        // Update display with cart data

// Templates
cartPanel.setCartItemTemplate(name, fn)       // Set template function
cartPanel.setCartItemProcessingTemplate(fn)   // Set processing overlay template

// Event Subscription (chainable)
cartPanel.on(eventName, callback)      // Add event listener
cartPanel.off(eventName, callback)     // Remove event listener
```

### CartPanel Events

| Event                  | Detail                                              | Description              |
| ---------------------- | --------------------------------------------------- | ------------------------ |
| `cart-panel:show`      | `{ triggerElement }`                                | When show() called       |
| `cart-panel:hide`      | `{}`                                                | When hide() called       |
| `cart-panel:refreshed` | `{ cart }`                                          | After cart data refreshed |
| `cart-panel:updated`   | `{ cart }`                                          | After item quantity/remove |
| `cart-panel:data-changed` | `{ calculated_count, calculated_subtotal, ... }` | Any cart change          |

### CartItem Events (bubbled)

| Event                     | Detail                             | Description           |
| ------------------------- | ---------------------------------- | --------------------- |
| `cart-item:remove`        | `{ cartKey, element }`             | Remove button clicked |
| `cart-item:quantity-change` | `{ cartKey, quantity, element }` | Quantity changed      |

### CartItem States

| State        | Description                                    |
| ------------ | ---------------------------------------------- |
| `ready`      | Interactive state, content visible             |
| `processing` | During AJAX calls, blur/scale effects, loader visible |
| `destroying` | Removal animation (height collapses)           |
| `appearing`  | Entry animation (height expands from 0)        |

### CartItem Static Methods

```javascript
import { CartItem } from '@magic-spells/cart-panel';

// Set template globally
CartItem.setTemplate(name, templateFn)

// Set processing overlay template
CartItem.setProcessingTemplate(templateFn)

// Create with animation
CartItem.createAnimated(itemData, cartData)
```

### Programmatic Control

```javascript
const cartPanel = document.querySelector('cart-panel');

// Open/close cart
cartPanel.show();
cartPanel.hide();

// Cart data operations
const cartData = await cartPanel.getCart();
const updatedCart = await cartPanel.updateCartItem('item-key', 2);
await cartPanel.refreshCart();

// Event emitter pattern (chainable)
cartPanel
  .on('cart-panel:show', (e) => {
    console.log('Cart opened by:', e.detail.triggerElement);
  })
  .on('cart-panel:data-changed', (e) => {
    console.log('Cart updated:', e.detail);
    // Update header cart count, etc.
  });

// Traditional event listeners also work
cartPanel.addEventListener('cart-item:remove', (e) => {
  console.log('Remove requested:', e.detail.cartKey);
});
```

## Template System

Set up custom templates to control how cart items render:

```javascript
const cartPanel = document.querySelector('cart-panel');

// Default template
cartPanel.setCartItemTemplate('default', (itemData, cartData) => {
  return `
    <div class="cart-item">
      <img src="${itemData.image}" alt="${itemData.product_title}" />
      <div class="cart-item-info">
        <h4>${itemData.product_title}</h4>
        <div class="variant">${itemData.variant_title || ''}</div>
      </div>
      <quantity-input value="${itemData.quantity}" min="1"></quantity-input>
      <button data-action-remove-item>Remove</button>
      <span data-content-line-price></span>
    </div>
  `;
});

// Custom template for subscriptions
cartPanel.setCartItemTemplate('subscription', (itemData, cartData) => {
  return `
    <div class="subscription-item">
      <div class="recurring-badge">Subscription</div>
      <h4>${itemData.product_title}</h4>
      <div class="price">$${(itemData.price / 100).toFixed(2)}/month</div>
    </div>
  `;
});

// Custom processing overlay
cartPanel.setCartItemProcessingTemplate(() => {
  return `<div class="custom-loader">Updating...</div>`;
});
```

## Customization

### CSS Custom Properties

Defaults come from `@magic-spells/cart-panel/cart-item/css`. Override them anywhere in your own CSS:

```css
cart-item {
  /* Animation durations */
  --cart-item-processing-duration: 250ms;
  --cart-item-destroying-duration: 600ms;
  --cart-item-appearing-duration: 400ms;

  /* Colors */
  --cart-item-shadow-color: rgba(0, 0, 0, 0.15);
  --cart-item-shadow-color-strong: rgba(0, 0, 0, 0.5);
  --cart-item-destroying-bg: rgba(0, 0, 0, 0.1);

  /* Scale transforms */
  --cart-item-processing-scale: 0.98;
  --cart-item-destroying-scale: 0.85;
  --cart-item-appearing-scale: 0.9;

  /* Blur effects */
  --cart-item-processing-blur: 1px;
  --cart-item-destroying-blur: 10px;
  --cart-item-appearing-blur: 2px;

  /* Opacity and filters */
  --cart-item-destroying-opacity: 0.2;
  --cart-item-appearing-opacity: 0.5;
  --cart-item-destroying-brightness: 0.6;
  --cart-item-destroying-saturate: 0.3;
}
```

## Line Item Properties

The cart-panel supports Shopify line item properties for enhanced functionality:

| Property                    | Purpose                                |
| --------------------------- | -------------------------------------- |
| `_hide_in_cart`             | Hide item from display (still in cart) |
| `_ignore_price_in_subtotal` | Exclude from subtotal calculation      |
| `_cart_template`            | Use specific template name for rendering |
| `_group_id`                 | Group items together (bundles)         |
| `_group_role`               | Role within a group: "parent" or "child" |

### Hidden Items (`_hide_in_cart`)

```javascript
// Item hidden from display but stays in actual cart
{
  "key": "item-123",
  "properties": {
    "_hide_in_cart": "true"
  }
}
```

### Custom Templates (`_cart_template`)

```javascript
// Use subscription template for this item
{
  "key": "subscription-item",
  "properties": {
    "_cart_template": "subscription"
  }
}
```

### Bundle Grouping (`_group_id` / `_group_role`)

```javascript
// Bundle: Parent shows, children hidden
{
  "items": [
    {
      "key": "bundle-parent",
      "properties": {
        "_group_id": "Q6RT1B48",
        "_group_role": "parent",
        "_cart_template": "bundle"
      }
    },
    {
      "key": "bundle-child-1",
      "properties": {
        "_group_id": "Q6RT1B48",
        "_group_role": "child",
        "_hide_in_cart": "true"
      }
    }
  ]
}
```

### Subtotal Exclusion (`_ignore_price_in_subtotal`)

```javascript
// Gift item excluded from subtotal calculation
{
  "key": "gift-item",
  "properties": {
    "_ignore_price_in_subtotal": "true"
  }
}
```

## Shopify Integration

```html
<!-- Cart with dialog-panel wrapper -->
<dialog-panel id="cart-dialog">
  <dialog aria-labelledby="cart-title">
    <cart-panel>
      <div class="cart-header">
        <h2 id="cart-title">Your Cart</h2>
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
      <footer class="cart-footer">
        <div class="cart-summary">
          <span data-content-cart-count></span> items |
          <span data-content-cart-subtotal></span>
        </div>
        <a href="/checkout" class="checkout-button">Checkout</a>
      </footer>
    </cart-panel>
  </dialog>
</dialog-panel>

<script>
  const cartPanel = document.querySelector('cart-panel');

  // Update header cart count on changes
  cartPanel.on('cart-panel:data-changed', (e) => {
    document.querySelector('.header-cart-count').textContent =
      e.detail.calculated_count;
  });
</script>
```

## Migrating from 1.x / standalone `@magic-spells/cart-item`

Version 2.0 folds the standalone `@magic-spells/cart-item` package into this one as an opt-in
subpath export. `@magic-spells/cart-item` is no longer published separately.

**1. Change your cart-item imports**

```diff
- import '@magic-spells/cart-item';
- import '@magic-spells/cart-item/css';
+ import '@magic-spells/cart-panel/cart-item';
+ import '@magic-spells/cart-panel/cart-item/css';
+ import '@magic-spells/quantity-modifier';
```

The standalone package side-effect-imported `@magic-spells/quantity-modifier`, which registered
`<quantity-modifier>` for you. This one does not, so import it yourself if your templates use it.
Its named `QuantityModifier` re-export is gone too - import it from `@magic-spells/quantity-modifier`
directly.

Then drop `@magic-spells/cart-item` from your `package.json`.

**2. Importing cart-panel no longer registers cart-item**

In 1.x, `import '@magic-spells/cart-panel'` registered `<cart-item>` and `dist/cart-panel.css`
carried the cart item styles. Both are now separate. If you use the built-in item component, add
the opt-in imports:

```javascript
import '@magic-spells/cart-panel';
import '@magic-spells/cart-panel/css';
import '@magic-spells/cart-panel/cart-item'; // new in 2.0
import '@magic-spells/cart-panel/cart-item/css'; // new in 2.0
```

Skip it and cart items silently stop rendering, with one console warning telling you what to import.

**3. `CartItem` is no longer re-exported from the panel entry**

```diff
- import { CartPanel, CartItem } from '@magic-spells/cart-panel';
+ import { CartPanel } from '@magic-spells/cart-panel';
+ import { CartItem } from '@magic-spells/cart-panel/cart-item';
```

**4. SCSS source is no longer shipped**

The standalone package exported `@magic-spells/cart-item/scss`. This package ships plain CSS only.
Every SCSS variable had a matching CSS custom property, so override those instead:

```css
cart-item {
  --cart-item-destroying-duration: 400ms;
}
```

**5. Quantity components**

`<cart-item>` now listens for both `quantity-input:change` and `quantity-modifier:change`, and syncs
either element's `value` after an update. `@magic-spells/quantity-modifier` is no longer a hard
dependency - import whichever quantity component your template uses.

## Dependencies

- `@magic-spells/event-emitter` - Event system (bundled)
- `@magic-spells/dialog-panel` - Modal behavior (peer dependency, optional)
- `@magic-spells/quantity-input` - Quantity controls (optional, for templates)
- `@magic-spells/quantity-modifier` - Quantity controls (optional, for templates)

## Browser Support

- Chrome 54+
- Firefox 63+
- Safari 10.1+
- Edge 79+

All modern browsers with Web Components support.

## License

MIT © Cory Schulz

---

<p align="center">
  Made by <a href="https://github.com/coryschulz">Cory Schulz</a>
</p>
