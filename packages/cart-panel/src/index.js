// =============================================================================
// Root Entry Point
//
// `import '@magic-spells/cart-panel'` registers the whole set: <cart-panel>,
// <cart-item>, <cart-item-content> and <cart-item-processing>. The panel and the
// item are designed as a pair — a page that renders a cart needs both — so the
// default import is a working cart in one line.
//
// The item is imported first so <cart-item> is already in the custom element
// registry before <cart-panel> is defined. The panel's runtime lookup then
// resolves on its very first render and the late-registration path is never
// entered.
//
// This composition lives here and nowhere else. `src/cart-panel.js` must still
// have no import of `./cart-item.js` — that constraint is the only reason
// `@magic-spells/cart-panel/panel` can stay a panel-sized bundle.
// =============================================================================

import './cart-item.js';
import './cart-panel.js';

export { CartItem, CartItemContent, CartItemProcessing } from './cart-item.js';
export { CartPanel, default } from './cart-panel.js';
