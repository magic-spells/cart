# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Build**: `npm run build` - Creates dist files (ESM, CJS, UMD, minified)
- **Development**: `npm run dev` or `npm run serve` - Runs Rollup in watch mode with dev server on port 3004
- **Linting**: `npm run lint` - Lints src/ and rollup.config.mjs with ESLint
- **Formatting**: `npm run format` - Formats code with Prettier

## Architecture

This is a web component library that creates an accessible shopping cart modal dialog. The main component is `CartDialog` which extends `HTMLElement` and manages cart state, API calls, and UI interactions.

### Core Components

- **CartDialog** (`cart-dialog`): Main modal component with focus management, scroll locking, and cart API integration
- **CartOverlay** (`cart-overlay`): Clickable backdrop overlay
- **CartPanel** (`cart-panel`): Content container that slides in from right
- **Cart Items**: Uses `@magic-spells/cart-item` dependency for individual cart items

### Key Features

- **API Integration**: Fetches from `/cart.json` and updates via `/cart/change.json`
- **Event System**: Uses `@magic-spells/event-emitter` for custom events like `cart-dialog:show`, `cart-dialog:hide`, `cart-dialog:updated`
- **Focus Management**: Uses `@magic-spells/focus-trap` for accessibility
- **Scroll Locking**: Prevents body scrolling when modal is open
- **State Management**: Handles processing states during cart operations
- **Item Filtering**: Supports hiding cart items with line item properties (excluded from display and calculations)
- **Template System**: Uses `@magic-spells/cart-item` with customizable templates for dynamic cart rendering

### Build System

Rollup configuration creates multiple builds:

- **ESM**: `dist/cart-panel.esm.js` (primary export)
- **CommonJS**: `dist/cart-panel.cjs.js`
- **UMD**: `dist/cart-panel.js` (unminified), `dist/cart-panel.min.js` (minified)
- **Styles**: `dist/cart-panel.css`, `dist/cart-panel.scss`

External dependencies (`@magic-spells/cart-item`, `@magic-spells/focus-trap`, `@magic-spells/event-emitter`) are not bundled in ESM/CJS builds but are included in UMD builds.

### Development Setup

The demo at `demo/index.html` provides a complete working example. Use `npm run dev` to start the development server which will automatically copy built files to the demo directory.

### Event System Architecture

The CartDialog uses a dual event system:

1. **Event Emitter**: Custom event emitter for cart-specific events with method chaining (`.on()`, `.off()`)
2. **DOM Events**: Standard DOM events for broader compatibility

Key events:

- `cart-dialog:show/hide/afterHide` - Modal state changes
- `cart-dialog:updated/refreshed/data-changed` - Cart data changes
- `cart-item:remove/quantity-change` - Item interactions (bubbled from cart-item components)

### Dependencies

- `@magic-spells/cart-item`: Cart item web component
- `@magic-spells/event-emitter`: Event system
- `@magic-spells/focus-trap`: Focus management for accessibility

The component follows web standards and can be used in any HTML page by importing the ESM build.

## Line Item Properties

The cart-panel component leverages Shopify's line item properties system to provide enhanced cart functionality. These properties are set when adding items to the cart and can be used to control cart behavior and display.

### Supported Line Item Properties

#### `_hide_in_cart`

Hides items from the cart display and excludes them from cart calculations (subtotal, item count, etc.). Hidden items remain in the actual Shopify cart but are not visible to customers.

**Use Cases:**

- Gift wrapping fees that should be invisible to customers
- Internal tracking items
- Conditional promotional items
- Hidden service charges

**Usage in Shopify:**

```liquid
<!-- Add to cart form with hidden item -->
<form action="/cart/add" method="post">
  <input type="hidden" name="id" value="12345">
  <input type="hidden" name="properties[_hide_in_cart]" value="true">
  <!-- Any truthy value works: "1", "yes", etc. -->
</form>
```

**JavaScript cart addition:**

```javascript
fetch('/cart/add.json', {
	method: 'POST',
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify({
		id: 12345,
		quantity: 1,
		properties: {
			_hide_in_cart: 'true',
		},
	}),
});
```

#### `_cart_template`

Specifies which template to use when rendering cart items dynamically. The cart-item component supports multiple templates for different item types or display styles.

**Default templates:**

- `default` - Standard cart item template
- Custom templates can be registered via `CartItem.setTemplate(name, templateFunction)`

**Usage in Shopify:**

```liquid
<!-- Specify template for special items -->
<form action="/cart/add" method="post">
  <input type="hidden" name="id" value="12345">
  <input type="hidden" name="properties[_cart_template]" value="subscription">
</form>
```

**JavaScript template setup:**

```javascript
import { CartItem } from '@magic-spells/cart-item';

// Register a custom template
CartItem.setTemplate('subscription', (itemData, cartData) => {
	return `
    <div class="subscription-item">
      <h4>${itemData.product_title}</h4>
      <div class="subscription-frequency">
        Delivers every ${itemData.properties.frequency}
      </div>
      <div class="price">$${(itemData.price / 100).toFixed(2)}</div>
    </div>
  `;
});

// Items with _cart_template: 'subscription' will use this template
```

### Implementation Details

The cart-panel processes these properties automatically:

1. **Filtering**: Items with `_hide_in_cart` are excluded from display and totals
2. **Template Selection**: The `_cart_template` property is passed to cart-item components for custom rendering
3. **Calculations**: Hidden items are excluded from visible cart calculations while remaining in the actual cart

**Example cart processing:**

```javascript
// Cart-panel automatically filters items
const visibleItems = cart.items.filter((item) => {
	const hidden = item.properties?._hide_in_cart;
	return !hidden; // Only show items that aren't hidden
});

// Template name is passed to cart-item for rendering
const templateName = item.properties?._cart_template || 'default';
```

This system provides powerful cart customization while maintaining compatibility with Shopify's standard cart functionality.
