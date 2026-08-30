import './gift-with-purchase.css';

/**
 * Gift With Purchase Component - automatically adds/removes gift when cart threshold is met
 * Emits gwp:added/gwp:removed/gwp:error events and broadcasts cart updates
 */
class GiftWithPurchase extends HTMLElement {
	#threshold = 0;
	#currentAmount = 0;
	#variantId = null;
	#isActive = false;
	#isAdded = false;
	#promoEnded = false;
	#productAvailable = true;
	#isDisabled = false;
	#cartPanel = null;
	#handlers = {};
	#debounceTimer = null;
	#attachRetryTimer = null;
	#isMutating = false; // prevents overlapping cart mutations
	#missedUpdate = false; // a cart update was dropped mid-mutation - refresh after
	#messageAbove = null;
	#messageBelow = null;
	#moneyFormat = null;

	static get observedAttributes() {
		return [
			'threshold',
			'current',
			'variant-id',
			'promo-ended',
			'product-available',
			'message-above',
			'message-below',
			'money-format',
		];
	}

	constructor() {
		super();
		const _ = this;
		_.#threshold = parseFloat(_.getAttribute('threshold')) || 0;
		_.#currentAmount = parseFloat(_.getAttribute('current')) || 0;
		_.#variantId = _.getAttribute('variant-id');
		_.#promoEnded = _.hasAttribute('promo-ended');
		_.#productAvailable = _.#parseBooleanValue(_.getAttribute('product-available'), true);
		_.#messageAbove = _.getAttribute('message-above');
		_.#messageBelow = _.getAttribute('message-below');
		_.#moneyFormat = _.getAttribute('money-format');
		_.#handlers = { cartDataChange: _.#handleCartDataChange.bind(_) };
	}

	connectedCallback() {
		const _ = this;

		_.#calculateInitialState();
		_.#render();
		_.#updateVisualState();
		_.#attachListeners();
		// a live panel's own boot refresh drives the same removal - only cover the gap
		// where nothing else will emit a cart snapshot
		if (_.#isDisabled && (!_.#cartPanel || _.#cartPanel.hasAttribute('manual'))) _.#updateState(null);
	}

	#calculateInitialState() {
		const _ = this;
		// Calculate initial active state based on attributes (before any cart events)
		const convertedThreshold = _.#getConvertedThreshold();
		_.#isDisabled = _.#promoEnded || !_.#productAvailable;
		_.#isActive = _.#currentAmount >= convertedThreshold && !_.#isDisabled;
	}

	disconnectedCallback() {
		const _ = this;
		if (_.#debounceTimer) clearTimeout(_.#debounceTimer);
		if (_.#attachRetryTimer) clearTimeout(_.#attachRetryTimer);
		if (_.#cartPanel) _.#cartPanel.removeEventListener('cart-panel:data-changed', _.#handlers.cartDataChange);
	}

	attributeChangedCallback(name, oldValue, newValue) {
		const _ = this;
		if (oldValue === newValue) return;

		switch (name) {
			case 'threshold':
				_.#threshold = parseFloat(newValue) || 0;
				break;
			case 'current':
				_.#currentAmount = parseFloat(newValue) || 0;
				break;
			case 'variant-id':
				_.#variantId = newValue;
				break;
			case 'promo-ended':
				_.#promoEnded = newValue !== null;
				break;
			case 'product-available':
				_.#productAvailable = _.#parseBooleanValue(newValue, true);
				break;
			case 'message-above':
				_.#messageAbove = newValue;
				break;
			case 'message-below':
				_.#messageBelow = newValue;
				break;
			case 'money-format':
				_.#moneyFormat = newValue;
				break;
		}

		// Recalculate state and update UI if component is connected
		if (!_.isConnected) return;

		const wasDisabled = _.#isDisabled;
		_.#calculateInitialState();
		_.#updateVisualState();
		_.#updateMessages();
		// only the transition into disabled needs to clear the gift
		if (_.#isDisabled && !wasDisabled) _.#updateState(null);
	}

	#render() {
		this.classList.add('gift-with-purchase');
		this.#renderMessages();
	}

	#renderMessages() {
		// Look for existing message element with data-content-gwp-message
		this.#updateMessages();
	}

	#formatMoney(amount) {
		if (!this.#moneyFormat) return amount.toFixed(2).replace(/\.00$/, '');

		const amountFixed = amount.toFixed(2);
		const amountNoDecimals = Math.round(amount).toString();
		const amountWithComma = amountFixed.replace('.', ',');
		const amountNoDecimalsWithComma = amountNoDecimals.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

		return this.#moneyFormat
			.replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, amountNoDecimalsWithComma)
			.replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, amountWithComma)
			.replace(/\{\{\s*amount_no_decimals\s*\}\}/g, amountNoDecimals)
			.replace(/\{\{\s*amount\s*\}\}/g, amountFixed);
	}

	#getConvertedThreshold() {
		// Convert threshold using Shopify currency rate if available (for multi-currency stores)
		const rate = parseFloat(window.Shopify?.currency?.rate) || 1;
		return this.#threshold * rate;
	}

	#parseBooleanValue(value, defaultValue = true) {
		if (value === null || typeof value === 'undefined') return defaultValue;
		if (value === '') return true;
		const normalized = String(value).trim().toLowerCase();
		if (normalized === 'false' || normalized === '0') return false;
		if (normalized === 'true' || normalized === '1') return true;
		return defaultValue;
	}

	#updateMessages() {
		const _ = this;
		const messageEl = _.querySelector('[data-content-gwp-message]');
		if (!messageEl) return;

		let message = '';
		if (_.#isActive && _.#messageAbove) {
			message = _.#messageAbove;
		} else if (!_.#isActive && _.#messageBelow) {
			const remaining = _.#getConvertedThreshold() - _.#currentAmount;
			const formattedAmount = _.#formatMoney(remaining);
			message = _.#messageBelow
				.replace(/\[\s*amount\s*\]/g, formattedAmount)
				.replace(/\[amount\]/g, formattedAmount);
		}

		messageEl.textContent = message;
		messageEl.style.display = message ? 'block' : 'none';
	}

	#attachListeners() {
		const _ = this;
		_.#cartPanel = _.closest('cart-panel');

		if (_.#cartPanel) {
			_.#cartPanel.addEventListener('cart-panel:data-changed', _.#handlers.cartDataChange);
		} else {
			_.#attachRetryTimer = setTimeout(() => {
				_.#attachRetryTimer = null;
				_.#cartPanel = _.closest('cart-panel');
				if (_.#cartPanel) _.#cartPanel.addEventListener('cart-panel:data-changed', _.#handlers.cartDataChange);
				else console.error('GWP - cart-panel still not found after delay');
			}, 100);
		}
	}

	/**
	 * Ask the parent cart-panel to re-fetch and re-render the cart.
	 * refreshCart() is the public API across every published cart-panel (0.3.x - 2.x);
	 * getCartAndRefresh() is only tried as a fallback for custom panels written against
	 * the name earlier versions of this component mistakenly called. Missing methods are
	 * ignored rather than thrown so a successful add/remove never reports a spurious error.
	 */
	#refreshCartPanel() {
		const panel = this.#cartPanel;
		if (!panel) return;
		if (typeof panel.refreshCart === 'function') panel.refreshCart();
		else if (typeof panel.getCartAndRefresh === 'function') panel.getCartAndRefresh();
	}

	#handleCartDataChange(event) {
		const _ = this;
		const cart = event.detail;
		if (!cart || typeof cart.calculated_subtotal === 'undefined') return;
		if (_.#debounceTimer) clearTimeout(_.#debounceTimer);

		_.#debounceTimer = setTimeout(() => {
			_.#debounceTimer = null;
			// a snapshot taken during a mutation predates it - the post-mutation refresh has truth
			if (_.#isMutating) {
				_.#missedUpdate = true;
				return;
			}
			_.#currentAmount = parseFloat(cart.calculated_subtotal / 100) || 0;
			_.#checkGiftInCart(cart);
			_.#updateState(cart);
		}, 300);
	}

	#checkGiftInCart(cart) {
		const _ = this;
		const giftLines = _.#getGiftLines(cart);
		_.#isAdded = giftLines.length > 0;
		// an out-of-order add can double the line, and the gift is hidden in cart -
		// trim it back so a duplicate never rides to checkout unseen
		const duplicate = giftLines.find((item) => item.quantity > 1);
		if (duplicate) _.#trimGiftQuantity(duplicate);
	}

	async #trimGiftQuantity(item) {
		const _ = this;
		_.#isMutating = true;
		try {
			const res = await fetch('/cart/change.js', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
				body: JSON.stringify({ id: item.key, quantity: 1 }),
			});
			if (!res.ok) throw new Error(`http ${res.status}`);
			_.#refreshCartPanel();
		} catch (err) {
			console.error('giftwithpurchase: quantity trim error', err);
			_.dispatchEvent(new CustomEvent('gwp:error', { detail: { action: 'trim', error: err.message }, bubbles: true }));
		} finally {
			_.#isMutating = false;
			_.#discardStaleCart();
		}
	}

	#getGiftLines(cart) {
		const _ = this;
		if (!cart?.items || !_.#variantId) return [];
		return cart.items.filter((item) => {
			if (item.properties?._gwp_item !== 'true') return false;
			return item.variant_id?.toString() === _.#variantId.toString();
		});
	}

	/**
	 * Cart snapshots held across a mutation predate it - drop them and ask for fresh truth.
	 */
	#discardStaleCart() {
		const _ = this;
		if (_.#debounceTimer) {
			clearTimeout(_.#debounceTimer);
			_.#debounceTimer = null;
			_.#missedUpdate = true;
		}
		if (!_.#missedUpdate) return;
		_.#missedUpdate = false;
		// with no panel to re-fetch for us the replay would vanish - re-derive locally
		if (_.#cartPanel) _.#refreshCartPanel();
		else _.#updateState(null);
	}

	#updateState(cart) {
		const _ = this;

		// If mutation in progress, drop this update and refresh once it settles
		if (_.#isMutating) {
			_.#missedUpdate = true;
			return;
		}

		const convertedThreshold = _.#getConvertedThreshold();
		_.#isDisabled = _.#promoEnded || !_.#productAvailable;
		_.#isActive = _.#currentAmount >= convertedThreshold && !_.#isDisabled;

		if (_.#isDisabled) _.#removeGiftFromCart(cart);
		else if (_.#isActive && !_.#isAdded && _.#variantId) _.#addGiftToCart();
		else if (!_.#isActive && _.#isAdded && _.#variantId) _.#removeGiftFromCart(cart);

		_.#updateVisualState();
		_.#updateMessages();
	}

	#updateVisualState() {
		const _ = this;
		if (_.#promoEnded) {
			_.setAttribute('state', 'ended');
			_.style.display = 'none';
			return;
		}

		if (!_.#productAvailable) {
			_.setAttribute('state', 'disabled');
			_.style.display = 'none';
			return;
		}

		_.style.display = '';
		if (_.#isAdded) _.setAttribute('state', 'added');
		else if (_.#isActive) _.setAttribute('state', 'active');
		else _.setAttribute('state', 'inactive');
	}

	async #addGiftToCart() {
		const _ = this;
		_.#isMutating = true;
		try {
			const res = await fetch('/cart/add.js', {
				method: 'POST',
				credentials: 'same-origin',
				headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
				body: JSON.stringify({
					items: [{ id: _.#variantId, quantity: 1, properties: { _gwp_item: 'true', _hide_in_cart: 'true', _ignore_price_in_subtotal: 'true' } }],
				}),
			});
			if (!res.ok) throw new Error(`http ${res.status}`);
			await res.json();
			_.#isAdded = true;
			_.dispatchEvent(new CustomEvent('gwp:added', { detail: { variantId: _.#variantId }, bubbles: true }));
			_.#refreshCartPanel();
		} catch (err) {
			console.error('giftwithpurchase: add error', err);
			_.dispatchEvent(new CustomEvent('gwp:error', { detail: { action: 'add', error: err.message }, bubbles: true }));
		} finally {
			_.#isMutating = false;
			_.#discardStaleCart();
		}
	}

	async #removeGiftFromCart(cart) {
		const _ = this;
		// flag set before the fetch so concurrent updates queue instead of racing
		_.#isMutating = true;
		try {
			// setters and attribute changes pass no cart - fetch live truth instead of bailing
			if (!cart?.items) cart = await _.#fetchCart();
			if (!cart?.items) return;

			const giftLines = _.#getGiftLines(cart);
			if (!giftLines.length) {
				_.#isAdded = false;
				return;
			}

			await _.#removeAllGiftItems(giftLines);
		} finally {
			_.#isMutating = false;
			_.#discardStaleCart();
		}
	}

	async #fetchCart() {
		const _ = this;
		try {
			let cart;
			if (typeof _.#cartPanel?.getCart === 'function') {
				cart = await _.#cartPanel.getCart();
			} else {
				const res = await fetch('/cart.js', { credentials: 'same-origin' });
				if (!res.ok) throw new Error(`http ${res.status}`);
				cart = await res.json();
			}
			// getCart resolves { error: true } rather than rejecting
			return cart?.error ? null : cart;
		} catch (err) {
			console.error('giftwithpurchase: cart fetch error', err);
			return null;
		}
	}

	async #removeAllGiftItems(giftLines) {
		const _ = this;
		try {
			await Promise.all(
				giftLines.map(async (item) => {
					const res = await fetch('/cart/change.js', {
						method: 'POST',
						credentials: 'same-origin',
						headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
						body: JSON.stringify({ id: item.key, quantity: 0 }),
					});
					if (!res.ok) throw new Error(`http ${res.status}`);
				})
			);
			_.#isAdded = false;
			_.dispatchEvent(new CustomEvent('gwp:removed', { detail: { variantId: _.#variantId }, bubbles: true }));
			_.#refreshCartPanel();
		} catch (err) {
			console.error('giftwithpurchase: bulk remove error', err);
			_.dispatchEvent(new CustomEvent('gwp:error', { detail: { action: 'remove', error: err.message }, bubbles: true }));
		}
	}

	getState() {
		const _ = this;
		const convertedThreshold = _.#getConvertedThreshold();
		return {
			currentAmount: _.#currentAmount,
			threshold: _.#threshold,
			convertedThreshold,
			variantId: _.#variantId,
			isActive: _.#isActive,
			isAdded: _.#isAdded,
			promoEnded: _.#promoEnded,
			productAvailable: _.#productAvailable,
			isDisabled: _.#isDisabled,
			remainingAmount: Math.max(0, convertedThreshold - _.#currentAmount),
			currencyRate: parseFloat(window.Shopify?.currency?.rate) || 1,
		};
	}

	get currentAmount() {
		return this.#currentAmount;
	}
	get threshold() {
		return this.#threshold;
	}
	get variantId() {
		return this.#variantId;
	}
	get isActive() {
		return this.#isActive;
	}
	get isAdded() {
		return this.#isAdded;
	}
	get promoEnded() {
		return this.#promoEnded;
	}
	get productAvailable() {
		return this.#productAvailable;
	}
	get isDisabled() {
		return this.#isDisabled;
	}

	setCurrentAmount(amount) {
		const _ = this;
		_.#currentAmount = parseFloat(amount) || 0;
		_.#updateState(null);
		_.#updateMessages();
	}

	setThreshold(threshold) {
		const _ = this;
		_.#threshold = parseFloat(threshold) || 0;
		_.#updateState(null);
		_.#updateMessages();
	}

	setVariantId(variantId) {
		this.#variantId = variantId;
	}
}

if (!customElements.get('gift-with-purchase')) {
	customElements.define('gift-with-purchase', GiftWithPurchase);
}

export { GiftWithPurchase };
