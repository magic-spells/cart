# Cart Progress Bar

A beautiful, accessible cart progress bar web component for free shipping thresholds and e-commerce sites.

## Features

- 🎯 **Smart Messaging** - Template-based messages with automatic currency formatting
- ♿ **Accessible** - Proper ARIA attributes and screen reader support
- 🎨 **Highly Customizable** - CSS custom properties for easy theming
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
  message-below="Add ${left} more for FREE shipping!">
  <p data-content-cart-progress-message>Add ${left} more for FREE shipping!</p>
  <progress-bar></progress-bar>
</cart-progress-bar>
```

```css
@import '@magic-spells/cart-progress-bar/css';
```

## JavaScript API

```javascript
const progressBar = document.querySelector('cart-progress-bar');

// Set progress percentage directly
progressBar.setPercent(67);

// Update cart amount
progressBar.setCurrentAmount(45.50);

// Change threshold
progressBar.setThresholdAmount(100.00);

// Get current progress info
const info = progressBar.getProgress();
console.log(info.percent, info.isComplete, info.thresholdAmount);

// Update message templates
progressBar.setMessages(
  "Almost there!", 
  "Only ${left} more to go!"
);
```

## Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `threshold` | Threshold amount for free shipping | `"75.00"` |
| `current` | Current cart amount | `"25.50"` |
| `message-above` | Success message when threshold is reached | `"🎉 FREE shipping unlocked!"` |
| `message-below` | Message template shown below the bar | `"Add ${left} more!"` |

## Customization

Use CSS custom properties to customize the appearance:

```css
cart-progress-bar {
  --cart-progress-bar-height: 16px;
  --cart-progress-bar-fill-bg: #ff6b6b;
  --cart-progress-bar-border-radius: 8px;
  --cart-progress-message-font-size: 1rem;
  --cart-progress-message-color: #333;
}
```

## Available CSS Custom Properties

| Property | Description | Default |
|----------|-------------|---------|
| `--cart-progress-bar-height` | Height of the progress bar | `12px` |
| `--cart-progress-bar-border-radius` | Border radius | `6px` |
| `--cart-progress-bar-bg` | Background color | `#e9ecef` |
| `--cart-progress-bar-fill-bg` | Fill color | `#28a745` |
| `--cart-progress-bar-complete-bg` | Color when complete | `#007bff` |
| `--cart-progress-message-font-size` | Message font size | `0.875rem` |
| `--cart-progress-message-color` | Message text color | `#495057` |

## Message Templates

Use `${left}` in your message templates for automatic currency formatting:

```html
<cart-progress-bar 
  message-above="🎉 FREE shipping unlocked!"
  message-below="You need ${left} more for free shipping!">
  <p data-content-cart-progress-message>You need ${left} more for free shipping!</p>
</cart-progress-bar>
```

The component automatically:
- Shows `message-below` when incomplete (with `${left}` replaced)
- Shows `message-above` when threshold is reached (success message)
- Formats the amount as currency (USD by default)
- Updates messages when amounts change

## States and Classes

The component automatically adds CSS classes based on progress:

- `.progress-low` - 0-49% progress
- `.progress-medium` - 50-74% progress  
- `.progress-high` - 75-99% progress
- `.progress-complete` - 100% progress

And data attributes:
- `data-complete="true"` - When threshold is reached
- `data-incomplete="true"` - When threshold is not reached

## Browser Support

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- All modern browsers with Custom Elements support

## License

MIT License - see LICENSE file for details.