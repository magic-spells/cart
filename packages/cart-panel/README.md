# Cart Panel Web Component

A professional, highly-customizable modal shopping cart dialog built with Web Components. Features accessible modal interactions, smooth slide-in animations, real-time cart synchronization, and seamless integration with Shopify and other e-commerce platforms.

[**Live Demo**](https://magic-spells.github.io/cart-panel/demo/)

## Features

- 🛒 **Complete cart modal** - Slide-in panel with overlay and focus management
- ♿ **Accessibility-first** - ARIA attributes, focus trapping, and keyboard navigation
- 🔄 **Real-time sync** - Automatic cart updates via `/cart.json` and `/cart/change.json` APIs
- 📡 **Event-driven architecture** - Rich event system with custom event emitter
- 🎬 **Smooth animations** - CSS transitions with customizable timing and effects
- 🔒 **Body scroll locking** - Prevents background scrolling when modal is open
- 🎛️ **Highly customizable** - CSS custom properties and SCSS variables
- 📱 **Framework agnostic** - Pure Web Components work with any framework
- 🛒 **Shopify-ready** - Built specifically for Shopify cart integrations

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

```html
<!-- Trigger button -->
<button aria-haspopup="dialog" aria-controls="my-cart" aria-expanded="false">
	Open Cart (3 items)
</button>

<!-- Cart modal dialog -->
<cart-dialog id="my-cart" aria-labelledby="cart-title">
	<cart-panel>
		<div class="cart-header">
			<h2 id="cart-title">Shopping Cart</h2>
			<button data-action="hide-cart" aria-label="Close cart">&times;</button>
		</div>

		<div class="cart-body">
			<!-- Cart items using @magic-spells/cart-item -->
			<cart-item data-key="shopify-line-item-123">
				<cart-item-content>
					<div class="product-info">
						<img src="product.jpg" alt="Product" />
						<div>
							<h4>Awesome T-Shirt</h4>
							<div class="price">$29.99</div>
						</div>
					</div>
					<div class="quantity-controls">
						<input type="number" data-cart-quantity value="1" min="1" />
						<button data-action="remove">Remove</button>
					</div>
				</cart-item-content>
				<cart-item-processing>
					<div>Processing...</div>
				</cart-item-processing>
			</cart-item>
		</div>

		<div class="cart-footer">
			<div class="cart-total">Total: $29.99</div>
			<button class="checkout-btn">Checkout</button>
		</div>
	</cart-panel>
</cart-dialog>
```

## How It Works

The cart panel component creates a complete modal cart experience with three main elements:

- **cart-dialog**: Main container managing modal state, focus trapping, and scroll locking
- **cart-overlay**: Clickable backdrop that closes the modal when clicked
- **cart-panel**: Sliding content area that contains the actual cart items and controls

The component automatically handles:

- Opening when trigger buttons with `aria-controls` are clicked
- Closing via close buttons, escape key, or overlay clicks
- Fetching cart data from `/cart.json` on show
- Updating cart items via `/cart/change.json` API calls
- Managing cart item states and animations through integrated `@magic-spells/cart-item`
- Emitting events for cart updates and state changes

## Configuration

### Cart Dialog Attributes

| Attribute         | Description                                     | Required    |
| ----------------- | ----------------------------------------------- | ----------- |
| `id`              | Unique identifier referenced by trigger buttons | Yes         |
| `aria-labelledby` | References the cart title element               | Recommended |
| `aria-modal`      | Set to "true" for proper modal semantics        | Recommended |

### Required HTML Structure

| Element          | Description                                  | Required |
| ---------------- | -------------------------------------------- | -------- |
| `<cart-dialog>`  | Main modal container                         | Yes      |
| `<cart-panel>`   | Sliding content area                         | Yes      |
| `<cart-overlay>` | Background overlay (auto-created if missing) | No       |

### Interactive Elements

| Selector                    | Description                         | Event Triggered             |
| --------------------------- | ----------------------------------- | --------------------------- |
| `[aria-controls="cart-id"]` | Trigger buttons to open cart        | Opens modal                 |
| `[data-action="hide-cart"]` | Close buttons inside modal          | Closes modal                |
| `[data-action="remove"]`    | Remove item buttons (via cart-item) | `cart-item:remove`          |
| `[data-cart-quantity]`      | Quantity inputs (via cart-item)     | `cart-item:quantity-change` |

Example:

```html
<!-- Minimal cart modal -->
<cart-dialog id="simple-cart">
	<cart-panel>
		<h2>Cart</h2>
		<button data-action="hide-cart">Close</button>
		<!-- Cart content here -->
	</cart-panel>
</cart-dialog>

<!-- Complete cart with all features -->
<cart-dialog id="full-cart" aria-modal="true" aria-labelledby="cart-heading">
	<cart-overlay></cart-overlay>
	<cart-panel>
		<header class="cart-header">
			<h2 id="cart-heading">Shopping Cart</h2>
			<button data-action="hide-cart" aria-label="Close cart">×</button>
		</header>
		<div class="cart-content">
			<!-- Cart items will be rendered here -->
		</div>
		<footer class="cart-footer">
			<button class="checkout-btn">Checkout</button>
		</footer>
	</cart-panel>
</cart-dialog>
```

## Customization

### Styling

The component provides complete styling control through CSS custom properties and SCSS variables. Customize the modal appearance to match your design:

```css
/* Customize modal positioning and sizing */
cart-dialog {
	--cart-panel-width: min(500px, 95vw);
	--cart-panel-z-index: 9999;
	--cart-overlay-z-index: 9998;
}

/* Customize overlay appearance */
cart-overlay {
	--cart-overlay-background: rgba(0, 0, 0, 0.3);
	--cart-overlay-backdrop-filter: blur(8px);
}

/* Customize panel styling */
cart-panel {
	--cart-panel-background: #ffffff;
	--cart-panel-shadow: -10px 0 30px rgba(0, 0, 0, 0.2);
	--cart-panel-border-radius: 12px 0 0 12px;
}

/* Customize animations */
cart-dialog {
	--cart-transition-duration: 400ms;
	--cart-transition-timing: cubic-bezier(0.25, 0.8, 0.25, 1);
}

/* Style your cart content layout */
cart-panel {
	display: flex;
	flex-direction: column;
}

.cart-header {
	padding: 1.5rem;
	border-bottom: 1px solid #eee;
	background: #f8f9fa;
}

.cart-content {
	flex: 1;
	overflow-y: auto;
	padding: 1rem;
}

.cart-footer {
	padding: 1.5rem;
	border-top: 1px solid #eee;
	background: #f8f9fa;
}
```

### CSS Variables & SCSS Variables

The component supports both CSS custom properties and SCSS variables for maximum flexibility:

| CSS Variable                     | SCSS Variable                   | Description                  | Default                      |
| -------------------------------- | ------------------------------- | ---------------------------- | ---------------------------- |
| `--cart-dialog-z-index`          | `$cart-dialog-z-index`          | Base z-index for modal       | 1000                         |
| `--cart-overlay-z-index`         | `$cart-overlay-z-index`         | Overlay layer z-index        | 1000                         |
| `--cart-panel-z-index`           | `$cart-panel-z-index`           | Panel layer z-index          | 1001                         |
| `--cart-panel-width`             | `$cart-panel-width`             | Width of the sliding panel   | min(400px, 90vw)             |
| `--cart-overlay-background`      | `$cart-overlay-background`      | Overlay background color     | rgba(0, 0, 0, 0.15)          |
| `--cart-overlay-backdrop-filter` | `$cart-overlay-backdrop-filter` | Overlay backdrop blur effect | blur(4px)                    |
| `--cart-panel-background`        | `$cart-panel-background`        | Panel background color       | #ffffff                      |
| `--cart-panel-shadow`            | `$cart-panel-shadow`            | Panel box shadow             | -5px 0 25px rgba(0,0,0,0.15) |
| `--cart-panel-border-radius`     | `$cart-panel-border-radius`     | Panel border radius          | 0                            |
| `--cart-transition-duration`     | `$cart-transition-duration`     | Animation duration           | 350ms                        |
| `--cart-transition-timing`       | `$cart-transition-timing`       | Animation timing function    | cubic-bezier(0.4, 0, 0.2, 1) |

#### CSS Override Examples:

```css
/* Dramatic slide-in effect */
.dramatic-cart {
	--cart-transition-duration: 600ms;
	--cart-transition-timing: cubic-bezier(0.68, -0.55, 0.265, 1.55);
	--cart-overlay-background: rgba(0, 0, 0, 0.4);
	--cart-overlay-backdrop-filter: blur(10px);
}

/* Subtle minimal styling */
.minimal-cart {
	--cart-panel-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
	--cart-panel-border-radius: 8px;
	--cart-transition-duration: 200ms;
	--cart-overlay-background: rgba(0, 0, 0, 0.05);
}

/* Mobile-optimized full-width */
@media (max-width: 768px) {
	.mobile-cart {
		--cart-panel-width: 100vw;
		--cart-panel-border-radius: 0;
	}
}
```

#### SCSS Override Examples:

```scss
// Override SCSS variables before importing
$cart-panel-width: min(500px, 95vw);
$cart-transition-duration: 400ms;
$cart-overlay-background: rgba(0, 0, 0, 0.25);

// Import the component styles
@import '@magic-spells/cart-panel/scss';

// Or import the CSS and override with CSS custom properties
@import '@magic-spells/cart-panel/css';

.my-store cart-dialog {
	--cart-transition-duration: 400ms;
	--cart-panel-background: #f8f9fa;
}
```

### JavaScript API

#### Methods

- `show(triggerElement)`: Open the cart modal and focus the first interactive element
- `hide()`: Close the cart modal and restore focus to trigger element
- `getCart()`: Fetch current cart data from `/cart.json`
- `updateCartItem(key, quantity)`: Update cart item quantity via `/cart/change.json`
- `refreshCart()`: Refresh cart data and update UI components
- `on(eventName, callback)`: Add event listener using the event emitter
- `off(eventName, callback)`: Remove event listener

#### Events

The component emits custom events for cart state changes and data updates:

**Modal Events:**

- `cart-dialog:show` - Modal has opened
- `cart-dialog:hide` - Modal has started closing
- `cart-dialog:afterHide` - Modal has finished closing animation

**Cart Data Events:**

- `cart-dialog:updated` - Cart data updated after item change
- `cart-dialog:refreshed` - Cart data refreshed from server
- `cart-dialog:data-changed` - Any cart data change (unified event)

**Cart Item Events (bubbled from cart-item components):**

- `cart-item:remove` - Remove button clicked: `{ cartKey, element }`
- `cart-item:quantity-change` - Quantity changed: `{ cartKey, quantity, element }`

#### Programmatic Control

```javascript
const cartDialog = document.querySelector('cart-dialog');

// Open/close cart
cartDialog.show(); // Open modal
cartDialog.hide(); // Close modal

// Cart data operations
const cartData = await cartDialog.getCart();
const updatedCart = await cartDialog.updateCartItem('item-key', 2);
await cartDialog.refreshCart();

// Event emitter pattern (recommended)
cartDialog
	.on('cart-dialog:show', (e) => {
		console.log('Cart opened by:', e.detail.triggerElement);
	})
	.on('cart-dialog:data-changed', (cartData) => {
		console.log('Cart updated:', cartData);
		// Update header cart count, etc.
	});

// Traditional event listeners (also supported)
cartDialog.addEventListener('cart-item:remove', (e) => {
	console.log('Remove requested:', e.detail.cartKey);

	// The component handles the API calls automatically
	// Just listen for the data changes
});

cartDialog.addEventListener('cart-item:quantity-change', (e) => {
	console.log('Quantity changed:', e.detail.quantity);
	// Component automatically syncs with Shopify
});

// Listen for all cart changes
cartDialog.on('cart-dialog:data-changed', (cartData) => {
	// Update your UI when cart changes
	updateCartBadge(cartData.item_count);
	updateCartTotal(cartData.total_price);
});
```

#### Performance & Architecture

The component is optimized for:

- **Smooth animations**: CSS transforms and transitions for slide-in effects
- **Focus management**: Automatic focus trapping with `@magic-spells/focus-trap`
- **Memory management**: Proper event listener cleanup on disconnect
- **Scroll lock**: Body scroll prevention with position restoration
- **API efficiency**: Smart cart data fetching and caching
- **Event system**: Centralized event handling with custom event emitter
- **Accessibility**: Full ARIA support and keyboard navigation

## Integration Examples

### Shopify Integration

The cart panel automatically integrates with Shopify's AJAX Cart API. Simply add the component to your theme and it handles all cart operations:

```html
<!-- In your Shopify theme layout -->
<button
	aria-haspopup="dialog"
	aria-controls="shopify-cart"
	aria-expanded="false"
	class="cart-trigger">
	Cart ({{ cart.item_count }})
</button>

<cart-dialog id="shopify-cart" aria-labelledby="cart-heading">
	<cart-panel>
		<header class="cart-header">
			<h2 id="cart-heading">Your Cart</h2>
			<button data-action="hide-cart" aria-label="hide cart">X</button>
		</header>

		<div class="cart-content">
			<!-- Cart items will be populated automatically in javascript -->
		</div>

		<footer class="cart-footer">
			<div class="cart-total"></div>
			<a href="/checkout" class="button"> Checkout </a>
		</footer>
	</cart-panel>
</cart-dialog>

<script>
	// Optional: Listen for cart updates to sync with other UI elements
	document.querySelector('cart-dialog').on('cart-dialog:data-changed', (cartData) => {
		// Update cart count in header
		document.querySelector('.cart-trigger').textContent = `Cart (${cartData.item_count})`;

		// Update cart total
		document.querySelector('[data-cart-total]').textContent = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
		}).format(cartData.total_price / 100);
	});
</script>
```

### Vanilla JavaScript Integration

```javascript
// Example for non-Shopify platforms
class CustomCartManager {
	constructor() {
		this.cartDialog = document.querySelector('cart-dialog');
		this.setupEventListeners();
	}

	setupEventListeners() {
		// Listen for cart data changes
		this.cartDialog.on('cart-dialog:data-changed', (cartData) => {
			this.updateCartUI(cartData);
		});

		// Override default cart operations for custom API
		this.cartDialog.getCart = this.customGetCart.bind(this);
		this.cartDialog.updateCartItem = this.customUpdateCartItem.bind(this);
	}

	async customGetCart() {
		try {
			const response = await fetch('/api/cart');
			return await response.json();
		} catch (error) {
			console.error('Failed to fetch cart:', error);
			return { error: true, message: error.message };
		}
	}

	async customUpdateCartItem(itemId, quantity) {
		try {
			const response = await fetch('/api/cart/update', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ itemId, quantity }),
			});

			if (!response.ok) throw new Error(response.statusText);

			// Return updated cart data
			return this.customGetCart();
		} catch (error) {
			console.error('Failed to update cart:', error);
			return { error: true, message: error.message };
		}
	}

	updateCartUI(cartData) {
		// Update cart count in navigation
		const cartCount = document.querySelector('.cart-count');
		if (cartCount) {
			cartCount.textContent = cartData.items?.length || 0;
		}

		// Update cart total display
		const cartTotal = document.querySelector('.cart-total-display');
		if (cartTotal && cartData.total) {
			cartTotal.textContent = cartData.total;
		}
	}
}

// Initialize
new CustomCartManager();
```

## Browser Support

- Chrome 54+
- Firefox 63+
- Safari 10.1+
- Edge 79+

All modern browsers with Web Components support.

## License

MIT
