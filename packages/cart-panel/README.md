# @magic-spells/cart-panel

A slide-out shopping cart web component. The panel owns the cart data, the Shopify AJAX and the item rendering; `@magic-spells/dialog-panel` owns the modal.

[**Live Demo**](https://magic-spells.github.io/cart/)

## Size & scope

**7.5 kB** min + gzip for the whole cart (6.5 kB JS, 1.0 kB CSS) — panel and item, one import.

Both halves are also published on their own subpaths, so a page that brings its own item element takes the panel alone at **4.8 kB** (4.7 kB JS, 0.1 kB CSS), and a page that only wants the item takes it at **3.5 kB** (2.5 kB JS, 1.0 kB CSS).

## Features

- **Complete cart management** - Handles cart data, AJAX requests, and item rendering
- **One import** - The root entry registers the panel and the item together; both are also on their own subpaths if you want only one
- **Swappable item element** - The panel resolves `<cart-item>` from the custom element registry at render time, so you can substitute your own
- **Two render modes** - JS templates by default, or let a Shopify section render the line items: the server renders content, JS renders behavior
- **Optimistic updates** - Opt in and quantity changes land on the click, not on the response, with coalescing and stale-response guards behind them
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
// Registers <cart-panel>, <cart-item>, <cart-item-content> and <cart-item-processing>
import '@magic-spells/cart-panel';
import '@magic-spells/cart-panel/css';
```

That is the whole install. The panel and the item are designed as a set, so the root import gives
you a working cart.

Or include directly in your HTML:

```html
<script src="https://unpkg.com/@magic-spells/cart-panel"></script>
<link rel="stylesheet" href="https://unpkg.com/@magic-spells/cart-panel/dist/index.css" />
```

The script build registers both elements on load. It also exposes `window.MagicSpellsCart` with the
bundle's exports, and `window.CartItem` — the `CartItem` class itself, for Shopify themes that
reference it directly.

### À la carte

Each half is also published on its own subpath, for a page that only needs one of them:

```javascript
// The panel alone - does NOT register <cart-item>
import '@magic-spells/cart-panel/panel';
import '@magic-spells/cart-panel/panel/css';

// The item alone
import '@magic-spells/cart-panel/cart-item';
import '@magic-spells/cart-panel/cart-item/css';
```

The subpath script builds expose `window.CartPanel` and `window.MagicSpellsCartItem` respectively.

This package is ESM only. There is no CommonJS build — the `.min.js` UMD bundles are for plain
`<script>` tags, and everything else resolves through the `import` condition.

### Entry Points

| Import path                                  | Registers                                                                     | Contents                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `@magic-spells/cart-panel`                   | `<cart-panel>`, `<cart-item>`, `<cart-item-content>`, `<cart-item-processing>` | `CartPanel`, `CartItem`, `CartItemContent`, `CartItemProcessing`  |
| `@magic-spells/cart-panel/css`               | -                                                                             | panel + cart item styles                                          |
| `@magic-spells/cart-panel/css/min`           | -                                                                             | panel + cart item styles (minified)                               |
| `@magic-spells/cart-panel/panel`             | `<cart-panel>`                                                                | `CartPanel`                                                       |
| `@magic-spells/cart-panel/panel/css`         | -                                                                             | `cart-panel` styles                                               |
| `@magic-spells/cart-panel/panel/css/min`     | -                                                                             | `cart-panel` styles (minified)                                    |
| `@magic-spells/cart-panel/cart-item`         | `<cart-item>`, `<cart-item-content>`, `<cart-item-processing>`                 | `CartItem`, `CartItemContent`, `CartItemProcessing`               |
| `@magic-spells/cart-panel/cart-item/css`     | -                                                                             | cart item styles                                                  |
| `@magic-spells/cart-panel/cart-item/css/min` | -                                                                             | cart item styles (minified)                                       |

`@magic-spells/cart-panel/css` is the two stylesheets concatenated, so it pairs with the root
import the same way `panel/css` pairs with `panel`.

### Swapping the item element

The panel module itself never imports the item. The root entry point composes the two, but the
panel's own code only ever resolves `<cart-item>` from the custom element registry at render time,
with `customElements.get('cart-item')`:

- **Registered** - the panel renders, updates, and animates items as usual.
- **Not registered** - the panel logs a single warning, skips item rendering, and everything
  else (cart count, subtotal, `has-items`/`empty` state, events) keeps working.

Import order does not matter. `setCartItemTemplate()` and `setCartItemProcessingTemplate()` buffer
their templates when `<cart-item>` is not registered yet and apply them as soon as it is, and the
panel watches for a late registration with `customElements.whenDefined('cart-item')` so it renders
the cart it already has without waiting for another `refreshCart()`.

That is what makes the item swappable. Take the panel on its own and register your own element:

```javascript
import '@magic-spells/cart-panel/panel';

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
- **Instance methods** - `setData(itemData, cartData)`, `setState(state)`, `destroyYourself()`. The
  `section` attribute additionally requires `setContent(html)`, and `section` plus `optimistic`
  requires `applyItemData(itemData, cartData)`, which the panel silently skips when it is missing.

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

All four come from `import '@magic-spells/cart-panel'`.

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

4. **Runtime cart-item lookup**: The CartPanel module never imports CartItem. It resolves the element from the custom element registry, so the item component is swappable and the panel can ship on its own subpath.

## Configuration

### CartPanel Attributes

| Attribute | Type    | Description                                            |
| --------- | ------- | ------------------------------------------------------ |
| `manual`  | Boolean | Skip auto-refresh on connect, require explicit refreshCart() |
| `section` | String  | Shopify section id that renders the line items. Absent, a JS template renders them — see [Render Modes](#render-modes) |
| `optimistic` | Boolean | Apply quantity changes and removals locally before the server answers — see [Optimistic Updates](#optimistic-updates) |
| `hide-count-when-empty` | Boolean | Hide every `[data-content-cart-count]` element on the page while the cart is empty |
| `state`   | String  | Reflected attribute: 'has-items' or 'empty'            |

`section`, `optimistic` and `hide-count-when-empty` are also reflected properties (`panel.section = 'API-cart-items'`, `panel.optimistic = true`), so they can be flipped at runtime. Changing `section` re-renders the item list from scratch.

### Required HTML Structure

| Selector                    | Description                              | Required |
| --------------------------- | ---------------------------------------- | -------- |
| `[data-content-cart-items]` | Container where cart-item elements render | Yes      |
| `[data-cart-has-items]`     | Section shown when cart has visible items | No       |
| `[data-cart-is-empty]`      | Section shown when cart is empty          | No       |
| `[data-action-hide-cart]`   | Close buttons (click triggers hide())     | No       |
| `[data-content-cart-count]` | Elements updated with visible item count  | No       |
| `[data-content-cart-subtotal]` | Elements updated with formatted subtotal | No       |

`[data-content-cart-count]` and `[data-content-cart-subtotal]` are written **document-wide**, not just inside the panel — put one on your site header's cart icon and it updates with everything else, including optimistic changes, which land the moment the click does. `hide-count-when-empty` hides those same elements at zero, so a header badge disappears instead of reading "0"; only the inline `display` the panel set is ever removed, so your own CSS is left alone.

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
cartPanel.getCartSection()             // Fetch /?sections=<id> in section mode, else null
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
| `cart-panel:error`     | `{ key, error }`                                    | An optimistic change the server refused. Server truth is already back on screen |

### CartItem Events (bubbled)

| Event                     | Detail                             | Description           |
| ------------------------- | ---------------------------------- | --------------------- |
| `cart-item:remove`        | `{ cartKey, element }`             | Remove button clicked |
| `cart-item:quantity-change` | `{ cartKey, quantity, element }` | Quantity changed, by a `change` event or by Enter |

**Committing a quantity.** A bare `[data-cart-quantity]` field commits through one path, whether the browser fires `change` (blur, stepper, spin buttons) or the shopper presses Enter: the value is clamped to the field's own `min`/`max`, the clamped value is written back into the field, and the event is emitted only if the quantity actually changed. A value that will not parse at all is not sent — the field is restored to the last known quantity instead.

Enter is handled at all because a field inside a `<form>` submits the page on it, and one outside a form commits nothing until it loses focus — both read as the cart ignoring you.

Fields inside `<quantity-input>` or `<quantity-modifier>` are left alone by both paths — those components own their commit logic and emit `quantity-input:change` / `quantity-modifier:change`, which the item listens for separately. Enter inside one still has its default prevented, so the form does not submit.

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

### CartItem Instance Methods

```javascript
const item = document.querySelector('cart-item');

item.setState('processing')       // 'ready' | 'processing' | 'destroying' | 'appearing'
item.setData(itemData, cartData?) // Redraw from cart JSON through the template
item.destroyYourself()            // Animate closed, then remove

// Section mode
item.setContent(html)             // Swap in server-rendered markup, keeping identity and focus
item.applyItemData(itemData)      // Move line price and quantity from JSON without redrawing
```

A replacement `<cart-item>` element needs `setContent(html)` to work with the `section` attribute; without it the panel warns once and leaves the line empty.

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

// Event emitter pattern (chainable) - .on() receives the raw payload, not a CustomEvent
cartPanel
  .on('cart-panel:show', ({ triggerElement }) => {
    console.log('Cart opened by:', triggerElement);
  })
  .on('cart-panel:data-changed', (cart) => {
    console.log('Cart updated:', cart);
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

## Render Modes

There are two ways to draw a line item, and the `section` attribute picks between them.

**JS template mode (default).** No `section` attribute. The panel renders line items from the template you registered above. Everything is client-side.

**Section mode.** `<cart-panel section="API-cart-items">`. Shopify renders the line items and the panel diffs the returned markup into place. The split is:

> **The server renders content, JS renders behavior.**

The cart JSON still drives everything except the line-item markup — count, subtotal, the `state` attribute, and every event. Progress bars and gift-with-purchase stay client-side and are never server-rendered; only the items come from the section.

### What it costs in requests

| Action | JS template mode | Section mode |
| ------ | ---------------- | ------------ |
| Quantity change / removal | POST `/cart/change.json` | POST `/cart/change.json` with `sections` in the body — the markup comes back in the same response |
| `refreshCart()` | GET `/cart.json` | GET `/cart.json` and `/?sections=<id>`, in parallel |

Section mode costs no extra round trip on a mutation, which is the whole reason the mode select is an attribute rather than a fork in your code.

### The section

Copy `shopify/API-cart-items.liquid` out of this package into your theme's `sections/` folder, then point the panel at its filename:

```html
<cart-panel section="API-cart-items">
```

The section is yours to restyle — the contract is only about structure:

```liquid
{%- for item in cart.items -%}
  {%- if item.properties._hide_in_cart -%}{%- continue -%}{%- endif -%}

  <cart-item key="{{ item.key }}">
    <cart-item-content>
      <!-- your markup -->
      <input type="number" value="{{ item.quantity }}" min="0" data-cart-quantity>
      <button type="button" data-action-remove-item>&times;</button>
      <span data-content-line-price>{{ item.final_line_price | money }}</span>
    </cart-item-content>
  </cart-item>
{%- endfor -%}
```

- One `<cart-item key="...">` per line, wrapping a `<cart-item-content>`.
- The same three selectors JS templates use: `[data-action-remove-item]`, `[data-cart-quantity]`, `[data-content-line-price]`. Event handling needs no changes at all.
- Skip `_hide_in_cart` lines, the way the panel does.
- Do **not** render `<cart-item-processing>` — the component injects the processing overlay itself in both modes, so the states behave identically.

### What the diff preserves

When new markup arrives, the panel matches it against what is on screen by key:

- **Existing key** — the live element keeps its identity: the element, its `state` attribute and any animation in progress all survive, and only its content is swapped. Focus and caret position inside a quantity field are restored afterwards, so a refresh cannot interrupt someone typing.
- **New key** — inserted in cart order with the `appearing` animation.
- **Missing key** — `destroyYourself()`, with the `destroying` animation.

Setting a JS template while `section` is present warns once and the template is ignored: two sources of truth for the same markup is a configuration error, and the section wins.

## Optimistic Updates

`<cart-panel optimistic>` turns quantity changes and removals into local edits that happen immediately, with the request sent behind them.

```html
<cart-panel optimistic>
```

- **Quantity change** — the item's quantity and line price are recalculated locally, along with `calculated_count` and `calculated_subtotal` (still honoring `_ignore_price_in_subtotal` and `_hide_in_cart`), and drawn at once. The item never enters the `processing` state.
- **Removal** — the line animates out immediately.
- **`cart-panel:data-changed` fires on the local update**, so progress bars and gift-with-purchase react to the click rather than to the network.
- **On success** the server's cart is reconciled in silently — including fresh item markup in section mode. A second `data-changed` fires only if the server disagreed with what is already on screen.
- **On failure** server truth is fetched and restored — a line removed optimistically animates back in — and `cart-panel:error` fires with `{ key, error }`.

```javascript
cartPanel.on('cart-panel:error', ({ key, error }) => {
  showToast(`Could not update that item`);
});
```

### Race safety

Fast fingers on a `+` button are the interesting case, and three rules cover it:

1. **Coalescing.** At most one request per line key is in flight. Newer values queue behind it, and only the latest is sent when it settles — six fast clicks send two requests, not six.
2. **Sequence ids.** Every queued value bumps a per-key counter, and a response is applied only if its counter is still current. A slow answer can never overwrite newer local state.
3. **Remove wins.** A removal marks its key, and quantity changes queued behind it are ignored until it settles. A late change response for a removed line cannot bring it back.

A response for one line also leaves other lines' in-flight quantities alone, so an answer about line A cannot flash line B's old number back onto the screen.

Without the attribute, none of this is engaged: the panel keeps the processing-state flow it has always had.

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
  --cart-item-loader-color: #000;

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

`--cart-item-destroying-duration` is read by JavaScript as well as CSS: the removal animation and
the failsafe that removes the element are both derived from it, so any value works — not just ones
shorter than the 600ms default.

## Line Item Properties

The cart-panel supports Shopify line item properties for enhanced functionality:

| Property                    | Purpose                                |
| --------------------------- | -------------------------------------- |
| `_hide_in_cart`             | Hide item from display (still in cart) |
| `_ignore_price_in_subtotal` | Exclude from subtotal calculation      |
| `_cart_template`            | Use specific template name for rendering |
| `_group_id`                 | Group items together (bundles) - convention only |
| `_group_role`               | Role within a group: "parent" or "child" - convention only |

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

These two are a naming convention for your own templates and Liquid, not something the library reads.
Nothing in cart-panel acts on them - hiding a child line still comes from `_hide_in_cart`, and the
parent's markup still comes from `_cart_template`.

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
  cartPanel.on('cart-panel:data-changed', (cart) => {
    document.querySelector('.header-cart-count').textContent =
      cart.calculated_count;
  });
</script>
```

## Migrating from 1.x / standalone `@magic-spells/cart-item`

Version 2.0 folds the standalone `@magic-spells/cart-item` package into this one.
`@magic-spells/cart-item` is no longer published separately.

**1. Your cart-panel imports do not change**

`import '@magic-spells/cart-panel'` still registers `<cart-panel>` and `<cart-item>`, and
`@magic-spells/cart-panel/css` still carries both stylesheets. `CartItem` is still a named export of
the root entry. If that is all your theme used, there is nothing to change.

**2. Drop the standalone cart-item package**

```diff
  import '@magic-spells/cart-panel';
  import '@magic-spells/cart-panel/css';
- import '@magic-spells/cart-item';
- import '@magic-spells/cart-item/css';
+ import '@magic-spells/quantity-modifier';
```

The item element now arrives with the panel, so the separate imports go away — swap the package
name for nothing at all. Then drop `@magic-spells/cart-item` from your `package.json`.

The one thing you may need to add back: the standalone package side-effect-imported
`@magic-spells/quantity-modifier`, which registered `<quantity-modifier>` for you. This one does
not, so import it yourself if your templates use it. Its named `QuantityModifier` re-export is gone
too - import it from `@magic-spells/quantity-modifier` directly.

**3. ESM only**

2.0 ships no CommonJS build. If you were pulling this package in with `require()`, switch to
`import`. Plain `<script>` tags are unaffected — use the UMD bundle at
`@magic-spells/cart-panel/dist/index.min.js`.

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
