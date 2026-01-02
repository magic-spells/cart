'use strict';

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
	#cartPanel = null;
	#handlers = {}; // pre-bound listener refs for clean-up
	#debounceTimer = null;
	#attachRetryTimer = null;
	#messageAbove = null;
	#messageBelow = null;
	#moneyFormat = null;

	static get observedAttributes() {
		return [
			'threshold',
			'current',
			'variant-id',
			'promo-ended',
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
	}

	#calculateInitialState() {
		const _ = this;
		// Calculate initial active state based on attributes (before any cart events)
		const convertedThreshold = _.#getConvertedThreshold();
		_.#isActive = _.#currentAmount >= convertedThreshold && !_.#promoEnded;
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
		if (_.isConnected) {
			_.#calculateInitialState();
			_.#updateVisualState();
			_.#updateMessages();
		}
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

	#handleCartDataChange(event) {
		const _ = this;
		const cart = event.detail;
		if (!cart || typeof cart.calculated_subtotal === 'undefined') return;
		if (_.#debounceTimer) clearTimeout(_.#debounceTimer);

		_.#debounceTimer = setTimeout(() => {
			_.#debounceTimer = null;
			_.#currentAmount = parseFloat(cart.calculated_subtotal / 100) || 0;
			_.#checkGiftInCart(cart);
			_.#updateState(cart);
		}, 300);
	}

	#checkGiftInCart(cart) {
		const _ = this;
		if (!cart.items || !_.#variantId) {
			_.#isAdded = false;
			return;
		}
		const giftLines = cart.items.filter(
			(item) => item.variant_id.toString() === _.#variantId.toString() && item.properties?._gwp_item === 'true'
		);
		_.#isAdded = giftLines.length > 0;
	}

	#updateState(cart) {
		const _ = this;
		const wasActive = _.#isActive;
		const convertedThreshold = _.#getConvertedThreshold();
		_.#isActive = _.#currentAmount >= convertedThreshold && !_.#promoEnded;

		if (_.#promoEnded) _.#removeGiftFromCart(cart);

		if (_.#isActive && !wasActive && !_.#isAdded && _.#variantId) {
			_.#addGiftToCart();
		} else if (!_.#isActive && _.#isAdded && _.#variantId) {
			_.#removeGiftFromCart(cart);
		}

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

		_.style.display = '';
		if (_.#isAdded) _.setAttribute('state', 'added');
		else if (_.#isActive) _.setAttribute('state', 'active');
		else _.setAttribute('state', 'inactive');
	}

	async #addGiftToCart() {
		const _ = this;
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
			_.#cartPanel?.getCartAndRefresh();
		} catch (err) {
			console.error('giftwithpurchase: add error', err);
			_.dispatchEvent(new CustomEvent('gwp:error', { detail: { action: 'add', error: err.message }, bubbles: true }));
		}
	}

	async #removeGiftFromCart(cart) {
		const _ = this;
		if (!cart?.items) return;

		try {
			const giftLines = cart.items.filter(
				(item) => item.variant_id.toString() === _.#variantId.toString() && item.properties?._gwp_item === 'true'
			);
			if (!giftLines.length) {
				_.#isAdded = false;
				return;
			}
			await _.#removeAllGiftItems(giftLines);
		} catch (err) {
			console.error('giftwithpurchase: remove error', err);
			_.dispatchEvent(new CustomEvent('gwp:error', { detail: { action: 'remove', error: err.message }, bubbles: true }));
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
			_.#cartPanel?.getCartAndRefresh();
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

	setCurrentAmount(amount) {
		const _ = this;
		_.#currentAmount = parseFloat(amount) || 0;
		_.#updateState({ items: [] });
		_.#updateMessages();
	}

	setThreshold(threshold) {
		const _ = this;
		_.#threshold = parseFloat(threshold) || 0;
		_.#updateState({ items: [] });
		_.#updateMessages();
	}

	setVariantId(variantId) {
		this.#variantId = variantId;
	}
}

if (!customElements.get('gift-with-purchase')) {
	customElements.define('gift-with-purchase', GiftWithPurchase);
}

exports.GiftWithPurchase = GiftWithPurchase;
//# sourceMappingURL=gift-with-purchase.cjs.js.map
