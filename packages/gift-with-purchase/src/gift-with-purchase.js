import './gift-with-purchase.scss';

/**
 * Gift With Purchase Component - automatically adds/removes gift when cart threshold is met
 * Emits gwp:added/gwp:removed/gwp:error events and broadcasts cart updates
 */
class GiftWithPurchase extends HTMLElement {
	// private fields
	#threshold = 0;
	#currentAmount = 0;
	#variantId = null;
	#isActive = false;
	#isAdded = false;
	#promoEnded = false;
	#cartDialog = null;
	#boundHandleCartDataChange = null; // pre-bound listener ref for clean-up
	#debounceTimer = null; // debouncing cart updates
	#messageAbove = null; // message when threshold is met
	#messageBelow = null; // message when below threshold

	static get observedAttributes() {
		return ['threshold', 'current', 'variant-id', 'promo-ended', 'message-above', 'message-below'];
	}

	constructor() {
		super();
		// read initial attributes once
		this.#threshold = parseFloat(this.getAttribute('threshold')) || 0;
		this.#currentAmount = parseFloat(this.getAttribute('current')) || 0;
		this.#variantId = this.getAttribute('variant-id');
		this.#promoEnded = this.hasAttribute('promo-ended');
		this.#messageAbove = this.getAttribute('message-above');
		this.#messageBelow = this.getAttribute('message-below');
		this.#boundHandleCartDataChange = this.#handleCartDataChange.bind(this);
	}

	connectedCallback() {
		this.#render();
		this.#attachListeners();
	}

	disconnectedCallback() {
		if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
		if (this.#cartDialog)
			this.#cartDialog.removeEventListener(
				'cart-dialog:data-changed',
				this.#boundHandleCartDataChange
			);
	}

	#render() {
		this.classList.add('gift-with-purchase');
		this.#renderMessages();
	}

	#renderMessages() {
		// Look for existing message element with data-content-gwp-message
		this.#updateMessages();
	}

	#updateMessages() {
		const messageEl = this.querySelector('[data-content-gwp-message]');
		if (!messageEl) return;

		let message = '';

		// console.log('updateMessages - this.#isActive', this.#isActive);

		if (this.#isActive && this.#messageAbove) {
			// set message to above threshold message
			message = this.#messageAbove;
		} else if (!this.#isActive && this.#messageBelow) {
			// set message to below threshold message
			const remaining = this.#threshold - this.#currentAmount;
			const formattedAmount = remaining.toFixed(2).replace(/\.00$/, '');
			message = this.#messageBelow
				.replace(/\{\s*amount\s*\}/g, formattedAmount)
				.replace(/\{amount\}/g, formattedAmount);
		}

		messageEl.textContent = message;
		messageEl.style.display = message ? 'block' : 'none';
	}

	#attachListeners() {
		// Look for cart-dialog element when attaching listeners (more reliable timing)
		this.#cartDialog = this.closest('cart-dialog');

		if (this.#cartDialog) {
			// console.log('cartDialog exists and is attaching events');
			this.#cartDialog.addEventListener(
				'cart-dialog:data-changed',
				this.#boundHandleCartDataChange
			);
		} else {
			// Try again after a short delay in case the DOM isn't fully ready
			setTimeout(() => {
				// console.log('cartDialog DIDNT exist and we waited to attach events');
				this.#cartDialog = this.closest('cart-dialog');
				if (this.#cartDialog) {
					this.#cartDialog.addEventListener(
						'cart-dialog:data-changed',
						this.#boundHandleCartDataChange
					);
				} else {
					console.error('GWP - cart-dialog still not found after delay');
				}
			}, 100);
		}
	}

	#handleCartDataChange(event) {
		const cart = event.detail;
		// console.log('GWP - handleCartDataChange cart: ', cart.calculated_subtotal, cart);

		if (!cart || typeof cart.calculated_subtotal === 'undefined') return;
		if (this.#debounceTimer) clearTimeout(this.#debounceTimer);

		this.#debounceTimer = setTimeout(() => {
			this.#debounceTimer = null;
			this.#currentAmount = parseFloat(cart.calculated_subtotal / 100) || 0;
			this.#checkGiftInCart(cart);
			this.#updateState(cart);
		}, 300);
	}

	// checks to see if the gift is already in the cart
	#checkGiftInCart(cart) {
		if (!cart.items || !this.#variantId) {
			this.#isAdded = false;
			return;
		}
		const giftLines = cart.items.filter(
			(lineItem) =>
				lineItem.variant_id.toString() === this.#variantId.toString() &&
				lineItem.properties?._gwp_item === 'true'
		);
		this.#isAdded = giftLines.length > 0;
		if (this.#promoEnded && giftLines.length) this.#removeAllGiftItems(giftLines);
	}

	#updateState(cart) {
		// console.log('********** ----------   Updating state....');
		const wasActive = this.#isActive;
		this.#isActive = this.#currentAmount >= this.#threshold && !this.#promoEnded;

		// console.log('********** ----------   this.#isActive', this.#isActive);

		if (this.#promoEnded) {
			// remove GWP from cart
			this.#removeGiftFromCart(cart);
		}

		if (this.#isActive && !wasActive && !this.#isAdded && this.#variantId) {
			this.#addGiftToCart();
		} else if (!this.#isActive && wasActive && this.#isAdded && this.#variantId) {
			this.#removeGiftFromCart(cart);
		}

		this.#updateVisualState();
		this.#updateMessages();
	}

	#updateVisualState() {
		if (this.#promoEnded) {
			this.setAttribute('state', 'ended');
			this.style.display = 'none';
			return;
		}

		this.style.display = '';
		if (this.#isAdded) {
			this.setAttribute('state', 'added');
		} else if (this.#isActive) {
			this.setAttribute('state', 'active');
		}
		// Note: no 'inactive' state since component wouldn't be loaded if inactive
	}

	async #addGiftToCart() {
		try {
			const res = await fetch('/cart/add.js', {
				method: 'POST',
				credentials: 'same-origin',
				headers: {
					'Content-Type': 'application/json',
					'X-Requested-With': 'XMLHttpRequest',
				},
				body: JSON.stringify({
					items: [
						{
							id: this.#variantId,
							quantity: 1,
							properties: {
								_gwp_item: 'true',
								_hide_in_cart: 'true',
								_ignore_price_in_subtotal: 'true',
							},
						},
					],
				}),
			});
			if (!res.ok) throw new Error(`http ${res.status}`);
			await res.json();
			this.#isAdded = true;
			this.dispatchEvent(
				new CustomEvent('gwp:added', {
					detail: { variantId: this.#variantId },
					bubbles: true,
				})
			);
		} catch (err) {
			console.error('giftwithpurchase: add error', err);
			this.dispatchEvent(
				new CustomEvent('gwp:error', {
					detail: { action: 'add', error: err.message },
					bubbles: true,
				})
			);
		}
	}

	async #removeGiftFromCart(cart) {
		try {
			// get all GWP items in the cart
			const giftLines = cart.items.filter(
				(lineItem) =>
					lineItem.variant_id.toString() === this.#variantId.toString() &&
					lineItem.properties?._gwp_item === 'true'
			);

			// exit if no items in the cart
			if (!giftLines.length) {
				this.#isAdded = false;
				return;
			}

			// remove all GWP items from the cart
			await this.#removeAllGiftItems(giftLines);
		} catch (err) {
			console.error('giftwithpurchase: remove error', err);
			this.dispatchEvent(
				new CustomEvent('gwp:error', {
					detail: { action: 'remove', error: err.message },
					bubbles: true,
				})
			);
		}
	}

	async #removeAllGiftItems(giftLines) {
		try {
			await Promise.all(
				giftLines.map((giftItem) =>
					fetch('/cart/change.js', {
						method: 'POST',
						credentials: 'same-origin',
						headers: {
							'Content-Type': 'application/json',
							'X-Requested-With': 'XMLHttpRequest',
						},
						body: JSON.stringify({ id: giftItem.key, quantity: 0 }),
					})
				)
			);
			this.#isAdded = false;
			// note: you can broadcast cart again here if you want real-time re-render after remove
			this.dispatchEvent(
				new CustomEvent('gwp:removed', {
					detail: { variantId: this.#variantId },
					bubbles: true,
				})
			);
		} catch (err) {
			console.error('giftwithpurchase: bulk remove error', err);
			this.dispatchEvent(
				new CustomEvent('gwp:error', {
					detail: { action: 'remove', error: err.message },
					bubbles: true,
				})
			);
		}
	}

	getState() {
		return {
			currentAmount: this.#currentAmount,
			threshold: this.#threshold,
			variantId: this.#variantId,
			isActive: this.#isActive,
			isAdded: this.#isAdded,
			promoEnded: this.#promoEnded,
			remainingAmount: Math.max(0, this.#threshold - this.#currentAmount),
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

	// Public setter methods for programmatic control
	setCurrentAmount(amount) {
		this.#currentAmount = parseFloat(amount) || 0;
		this.#updateState({ items: [] }); // Pass empty cart to avoid cart operations
		this.#updateMessages();
	}

	setThreshold(threshold) {
		this.#threshold = parseFloat(threshold) || 0;
		this.#updateState({ items: [] }); // Pass empty cart to avoid cart operations
		this.#updateMessages();
	}

	setVariantId(variantId) {
		this.#variantId = variantId;
	}
}

if (!customElements.get('gift-with-purchase')) {
	customElements.define('gift-with-purchase', GiftWithPurchase);
}

export { GiftWithPurchase };
