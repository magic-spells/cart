# Cart Progress Bar

A beautiful, accessible cart progress bar web component for free shipping thresholds and e-commerce sites.

[**Live Demo**](https://magic-spells.github.io/cart-progress-bar/demo/)

## Features

- 🎯 **Smart Messaging** - Template-based messages with flexible placeholder formats
- 🎨 **Simplified Theming** - Just 5 CSS variables to control all colors and appearance
- 📱 **Responsive** - Mobile-optimized with responsive breakpoints
- ⚡ **Smooth Animations** - Buttery smooth transitions and completion effects
- 🔧 **Easy Integration** - Drop-in web component that works with any framework

## Installation

```bash
npm install @magic-spells/cart-progress-bar
```

## Basic Usage

```html
<cart-progress-bar
	threshold="75.00"
	current="25.50"
	message-above="🎉 Congratulations! You've qualified for FREE shipping!"
	message-below="Add ${ amount } more for FREE shipping!">
	<p data-content-cart-progress-message>Add ${ amount } more for FREE shipping!</p>
	<progress-bar></progress-bar>
</cart-progress-bar>
```

```css
@import '@magic-spells/cart-progress-bar/css/min';
```

## JavaScript API

```javascript
const progressBar = document.querySelector('cart-progress-bar');

// Set progress percentage directly
progressBar.setPercent(67);

// Update cart amount
progressBar.setCurrentAmount(45.5);

// Change threshold
progressBar.setThresholdAmount(100.0);

// Get current progress info
const info = progressBar.getProgress();
console.log(info.percent, info.isComplete, info.thresholdAmount);

// Update message templates
progressBar.setMessages('Almost there!', 'Only ${ amount } more to go!');
```

## Cart Integration

The component automatically listens for cart data changes when placed inside a `<cart-dialog>` component from the `@magic-spells/cart-panel` package:

```html
<cart-dialog>
	<cart-progress-bar threshold="75.00" message-below="Add ${ amount } more for FREE shipping!">
	</cart-progress-bar>
</cart-dialog>
```

When the cart-dialog emits a `cart-dialog:data-changed` event (typically from Shopify cart API updates), the progress bar will automatically update with the calculated cart subtotal.

### Smart Pricing Logic

The progress bar uses intelligent pricing calculation:

- **Preferred**: Uses `calculated_subtotal` from cart-panel (respects `_ignore_price_in_subtotal` property)
- **Fallback**: Uses `total_price` for backwards compatibility
- **Includes**: Bundle items that are hidden in cart but should count toward shipping threshold
- **Excludes**: Gift items or promotions marked with `_ignore_price_in_subtotal` property

## Attributes

| Attribute       | Description                               | Example                        |
| --------------- | ----------------------------------------- | ------------------------------ |
| `threshold`     | Threshold amount for free shipping        | `"75.00"`                      |
| `current`       | Current cart amount                       | `"25.50"`                      |
| `message-above` | Success message when threshold is reached | `"🎉 FREE shipping unlocked!"` |
| `message-below` | Message template shown below the bar      | `"Add ${ amount } more!"`       |

## Customization

Use CSS custom properties to customize the appearance:

```css
cart-progress-bar {
	/* Core color customization */
	--cart-progress-section-bg: #f8f9fa;
	--cart-progress-section-color: #333;
	--cart-progress-bar-bg: #e9ecef;
	--cart-progress-bar-fill-before: #ff6b6b;
	--cart-progress-bar-fill-after: #28a745;

	/* Structure (optional) */
	--cart-progress-bar-height: 16px;
	--cart-progress-bar-border-radius: 8px;
}
```

## Available CSS Custom Properties

### Core Color Variables

| Property                          | Description                          | Default       |
| --------------------------------- | ------------------------------------ | ------------- |
| `--cart-progress-section-bg`      | Background color of entire component | `transparent` |
| `--cart-progress-section-color`   | Text/foreground color                | `#495057`     |
| `--cart-progress-bar-bg`          | Background of progress bar track     | `#e9ecef`     |
| `--cart-progress-bar-fill-before` | Fill color before reaching threshold | `#28a745`     |
| `--cart-progress-bar-fill-after`  | Fill color after reaching threshold  | `#007bff`     |

### Structure Variables (Optional)

| Property                                | Description                       | Default |
| --------------------------------------- | --------------------------------- | ------- |
| `--cart-progress-bar-height`            | Height of the progress bar        | `12px`  |
| `--cart-progress-bar-border-radius`     | Border radius                     | `6px`   |
| `--cart-progress-bar-shadow`            | Box shadow for progress bar       | `inset 0 1px 2px rgba(0, 0, 0, 0.1)` |
| `--cart-progress-bar-transition-duration` | Animation transition duration   | `0.3s`  |

## Message Templates

Use placeholder formats in your message templates and include the currency symbol:

```html
<cart-progress-bar
	message-above="🎉 FREE shipping unlocked!"
	message-below="You need ${ amount } more for free shipping!">
	<p data-content-cart-progress-message>You need ${ amount } more for free shipping!</p>
</cart-progress-bar>
```

### Supported Placeholder Formats

- `{ amount }` - spaces around amount
- `{amount}` - no spaces
- `[amount]` - square brackets (with or without spaces)

### Examples

```html
<!-- Dollar amounts -->
<cart-progress-bar message-below="Add ${ amount } more for free shipping!">

<!-- Euro amounts -->
<cart-progress-bar message-below="Only €{amount} left to unlock free delivery!">

<!-- With square brackets -->
<cart-progress-bar message-below="Just £[amount] more to go!">
```

The component automatically:

- Shows `message-below` when incomplete (with placeholder replaced with remaining amount)
- Shows `message-above` when threshold is reached (success message)  
- Formats amounts as minimal decimal numbers (removes .00 for whole amounts)
- Updates messages when amounts change
- Switches between before/after progress bar colors based on completion status

## States and Attributes

The component automatically sets attributes based on completion status:

- `complete="true"` - When threshold is reached
- `complete="false"` - When threshold is not reached

These attributes are used internally to switch between the "before" and "after" progress bar colors.

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- All modern browsers with Custom Elements support

## License

MIT License - see LICENSE file for details.
