# Cart Panel Web Component

A professional, highly-customizable shopping cart component built with Web Components. Features smooth animations, real-time cart synchronization, and seamless integration with Shopify and other e-commerce platforms.

[**Live Demo**](https://magic-spells.github.io/cart-panel/demo/)

## Features

- **Complete cart management** - Handles cart data, AJAX requests, and item rendering
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
// Import the component (includes cart-item automatically)
import '@magic-spells/cart-panel';

// Import styles (includes cart-item styles automatically)
import '@magic-spells/cart-panel/css';
```

Or include directly in your HTML:

```html
<script src="https://unpkg.com/@magic-spells/cart-panel"></script>
<link rel="stylesheet" href="https://unpkg.com/@magic-spells/cart-panel/dist/cart-panel.css" />
```

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

- **cart-panel**: Main component managing cart data, AJAX requests, and rendering
- **cart-item**: Individual cart item with state management and animations
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

## Dependencies

- `@magic-spells/event-emitter` - Event system (bundled)
- `@magic-spells/dialog-panel` - Modal behavior (peer dependency, optional)
- `@magic-spells/quantity-input` - Quantity controls (optional, for templates)

## Browser Support

- Chrome 54+
- Firefox 63+
- Safari 10.1+
- Edge 79+

All modern browsers with Web Components support.

## License

MIT
