# Gift with Purchase

A powerful, e-commerce web component for automatic gift-with-purchase threshold promotions. Seamlessly integrates with Shopify and automatically manages gift items in the cart based on spending thresholds.

## Features

- 🎁 **Automatic Gift Management** - Adds/removes gifts based on cart thresholds
- 🛒 **Shopify Integration** - Built-in Cart API support with proper line item properties
- 📱 **Cart Panel Sync** - Automatically syncs with cart-panel components
- 🎨 **Highly Customizable** - CSS custom properties and swappable content elements
- ⚡ **Event-Driven** - Custom events for gift addition, removal, and errors
- 🔧 **Flexible Content** - Data attributes for dynamic image, title, and variant updates
- 📱 **Responsive** - Mobile-optimized with responsive design

## Installation

```bash
npm install @magic-spells/gift-with-purchase
```

## Basic Usage

```html
<gift-with-purchase 
  threshold="75.00" 
  current="45.00" 
  variant-id="12345678"
  message-above="🎉 Congratulations! You've qualified for your FREE gift!"
  message-below="Add ${{ amount }} more to unlock your free gift! 🎁">
  <div class="gwp-product">
    <img src="gift-image.jpg" alt="Free Gift" data-gwp-image />
    <div class="gwp-content">
      <h4 data-gwp-title>Free Sample Set</h4>
      <p data-gwp-variant>Travel Size Collection</p>
    </div>
  </div>
</gift-with-purchase>
```

```css
@import "@magic-spells/gift-with-purchase/css";
```

## Cart Integration

The component automatically listens for cart data changes when placed inside a `<cart-panel>` component:

```html
<cart-panel>
  <gift-with-purchase 
    threshold="75.00" 
    variant-id="12345678"
    message-above="🎉 Congratulations! You've qualified for FREE shipping!"
    message-below="Add ${{ amount }} more to get FREE shipping! 🚚">
    <!-- Gift content -->
  </gift-with-purchase>
</cart-panel>
```

When the cart-panel emits a `cart-dialog:data-changed` event (typically from Shopify cart updates), the gift component will automatically:

- Update the current cart amount
- Check if the threshold is met
- Add the gift to cart if threshold is reached
- Remove the gift if cart falls below threshold

## JavaScript API

```javascript
const gwp = document.querySelector("gift-with-purchase");

// Update cart amount
gwp.setCurrentAmount(85.5);

// Change threshold
gwp.setThreshold(100.0);

// Update variant ID
gwp.setVariantId("87654321");

// Get current state
const state = gwp.getState();
console.log(state.isActive, state.isAdded, state.remainingAmount);

// Update product information
gwp.updateProduct({
  image: "new-gift.jpg",
  title: "Updated Gift",
  variantTitle: "New Variant",
  alt: "New gift image",
});
```

## Attributes

| Attribute        | Description                                    | Example                                                    |
| ---------------- | ---------------------------------------------- | ---------------------------------------------------------- |
| `threshold`      | Spending threshold to unlock the gift          | `"75.00"`                                                  |
| `current`        | Current cart amount                            | `"45.00"`                                                  |
| `variant-id`     | Shopify variant ID for the gift product       | `"12345678"`                                               |
| `message-above`  | Message shown when threshold is met           | `"🎉 Congratulations! You've qualified for your FREE gift!"` |
| `message-below`  | Message shown when below threshold (uses `{{ amount }}` placeholder) | `"Add ${{ amount }} more to unlock your free gift! 🎁"`   |

## Data Attributes for Content

Use these data attributes to create swappable content elements:

| Data Attribute     | Description              | Element Type     |
| ------------------ | ------------------------ | ---------------- |
| `data-gwp-image`   | Gift product image       | `<img>`          |
| `data-gwp-title`   | Gift product title       | Any text element |
| `data-gwp-variant` | Gift variant/description | Any text element |

## Events

The component emits custom events for integration:

```javascript
// Gift successfully added to cart
gwp.addEventListener("gwp:added", (event) => {
  console.log("Gift added:", event.detail.variantId);
});

// Gift successfully removed from cart
gwp.addEventListener("gwp:removed", (event) => {
  console.log("Gift removed:", event.detail.variantId);
});

// Error occurred during add/remove
gwp.addEventListener("gwp:error", (event) => {
  console.error("Error:", event.detail.error);
  console.log("Action:", event.detail.action); // 'add' or 'remove'
});
```

## Customization

Use CSS custom properties to customize the appearance:

```css
gift-with-purchase {
  --gwp-border-radius: 12px;
  --gwp-padding: 1.5rem;
  --gwp-bg-active: #e8f5e8;
  --gwp-border-active: #28a745;
  --gwp-text-active: #155724;
  --gwp-image-size: 80px;
}
```

## Available CSS Custom Properties

| Property                | Description              | Default   |
| ----------------------- | ------------------------ | --------- |
| `--gwp-border-radius`   | Border radius            | `8px`     |
| `--gwp-padding`         | Internal padding         | `1rem`    |
| `--gwp-bg-inactive`     | Background when inactive | `#f8f9fa` |
| `--gwp-bg-active`       | Background when active   | `#e8f5e8` |
| `--gwp-bg-added`        | Background when added    | `#d4edda` |
| `--gwp-border-inactive` | Border when inactive     | `#dee2e6` |
| `--gwp-border-active`   | Border when active       | `#28a745` |
| `--gwp-border-added`    | Border when added        | `#155724` |
| `--gwp-text-inactive`   | Text color when inactive | `#6c757d` |
| `--gwp-text-active`     | Text color when active   | `#155724` |
| `--gwp-image-size`      | Size of product image    | `60px`    |
| `--gwp-gap`             | Gap between elements     | `0.75rem` |

## Component States

The component automatically applies CSS classes based on its state:

- `.gwp-inactive` - Below threshold (default state)
- `.gwp-active` - Threshold met, gift available
- `.gwp-added` - Gift successfully added to cart

And data attributes:

- `data-inactive="true"` - When below threshold
- `data-active="true"` - When threshold is met
- `data-added="true"` - When gift is in cart

## Shopify Integration Details

### Cart API Calls

The component uses Shopify's Cart API endpoints:

- `POST /cart/add.js` - Adds the gift to cart
- `GET /cart.js` - Gets current cart state
- `POST /cart/change.js` - Removes gift from cart

### Line Item Properties

When adding gifts to the cart, the component sets these properties:

```javascript
{
  id: variantId,
  quantity: 1,
  properties: {
    _gwp_item: "true",
    _gwp_threshold: "75.00"
  }
}
```

This allows you to:

- Identify gift items in cart templates
- Hide gifts from cart totals if needed
- Remove gifts when cart changes

### Cart Template Integration

In your Shopify cart template, you can identify and handle gift items:

```liquid
{% for item in cart.items %}
  {% if item.properties._gwp_item == 'true' %}
    <!-- This is a gift item -->
    <div class="cart-gift-item">
      <span class="gift-badge">FREE GIFT</span>
      {{ item.product.title }}
    </div>
  {% else %}
    <!-- Regular cart item -->
  {% endif %}
{% endfor %}
```

## Advanced Usage

### Multiple Thresholds

```html
<!-- Low tier gift -->
<gift-with-purchase 
  threshold="50.00" 
  variant-id="111111"
  message-above="🎉 You've unlocked a free tote bag!"
  message-below="Add ${{ amount }} more for a free tote bag! 👜">
  <div class="gwp-product">
    <img src="tote-bag.jpg" data-gwp-image />
    <h4 data-gwp-title>Free Tote Bag</h4>
  </div>
</gift-with-purchase>

<!-- High tier gift -->
<gift-with-purchase 
  threshold="100.00" 
  variant-id="222222"
  message-above="✨ Amazing! You've earned our premium gift set!"
  message-below="Spend ${{ amount }} more for our exclusive premium gift set! ✨">
  <div class="gwp-product">
    <img src="gift-set.jpg" data-gwp-image />
    <h4 data-gwp-title>Premium Gift Set</h4>
  </div>
</gift-with-purchase>
```

### Custom Styling Examples

```css
/* Minimal style */
.gwp-minimal {
  --gwp-padding: 0.75rem;
  --gwp-border-radius: 4px;
  --gwp-bg-active: #f0f8f0;
}

/* Bold style */
.gwp-bold {
  --gwp-padding: 1.5rem;
  --gwp-border-radius: 12px;
  --gwp-bg-active: #28a745;
  --gwp-text-active: white;
}

/* Compact mobile style */
@media (max-width: 768px) {
  gift-with-purchase {
    --gwp-image-size: 40px;
    --gwp-padding: 0.5rem;
    --gwp-gap: 0.5rem;
  }
}
```

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- All modern browsers with Custom Elements support

## TypeScript Support

Type definitions are included in the package:

```typescript
interface GiftWithPurchaseState {
  currentAmount: number;
  threshold: number;
  variantId: string | null;
  isActive: boolean;
  isAdded: boolean;
  remainingAmount: number;
}

interface GiftWithPurchaseProductData {
  image?: string;
  title?: string;
  variantTitle?: string;
  alt?: string;
}
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests to our repository.

## License

MIT License - see LICENSE file for details.
