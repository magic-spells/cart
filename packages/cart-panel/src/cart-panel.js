import './cart-panel.scss';
import '@magic-spells/focus-trap';
import EventEmitter from '@magic-spells/event-emitter';

/**
 * Custom element that creates an accessible modal cart dialog with focus management
 * @extends HTMLElement
 */
class CartDialog extends HTMLElement {
	#handleTransitionEnd;
	#scrollPosition = 0;
	#currentCart = null;
	#eventEmitter;

	/**
	 * Clean up event listeners when component is removed from DOM
	 */
	disconnectedCallback() {
		const _ = this;
		if (_.contentPanel) {
			_.contentPanel.removeEventListener('transitionend', _.#handleTransitionEnd);
		}

		// Ensure body scroll is restored if component is removed while open
		document.body.classList.remove('overflow-hidden');
		this.#restoreScroll();

		// Detach event listeners
		this.#detachListeners();
	}

	/**
	 * Saves current scroll position and locks body scrolling
	 * @private
	 */
	#lockScroll() {
		const _ = this;
		// Save current scroll position
		_.#scrollPosition = window.pageYOffset;

		// Apply fixed position to body
		document.body.classList.add('overflow-hidden');
		document.body.style.top = `-${_.#scrollPosition}px`;
	}

	/**
	 * Restores scroll position when cart dialog is closed
	 * @private
	 */
	#restoreScroll() {
		const _ = this;
		// Remove fixed positioning
		document.body.classList.remove('overflow-hidden');
		document.body.style.removeProperty('top');

		// Restore scroll position
		window.scrollTo(0, _.#scrollPosition);
	}

	/**
	 * Initializes the cart dialog, sets up focus trap and overlay
	 */
	constructor() {
		super();
		const _ = this;
		_.id = _.getAttribute('id');
		_.setAttribute('role', 'dialog');
		_.setAttribute('aria-modal', 'true');
		_.setAttribute('aria-hidden', 'true');

		_.triggerEl = null;

		// Initialize event emitter
		_.#eventEmitter = new EventEmitter();

		// Create a handler for transition end events
		_.#handleTransitionEnd = (e) => {
			if (e.propertyName === 'opacity' && _.getAttribute('aria-hidden') === 'true') {
				_.contentPanel.classList.add('hidden');

				// Emit afterHide event - cart dialog has completed its transition
				_.#emit('cart-dialog:afterHide', { triggerElement: _.triggerEl });
			}
		};
	}

	connectedCallback() {
		const _ = this;

		// Now that we're in the DOM, find the content panel and set up focus trap
		_.contentPanel = _.querySelector('cart-panel');

		if (!_.contentPanel) {
			console.error('cart-panel element not found inside cart-dialog');
			return;
		}

		_.focusTrap = document.createElement('focus-trap');

		// Ensure we have labelledby and describedby references
		if (!_.getAttribute('aria-labelledby')) {
			const heading = _.querySelector('h1, h2, h3');
			if (heading && !heading.id) {
				heading.id = `${_.id}-title`;
			}
			if (heading?.id) {
				_.setAttribute('aria-labelledby', heading.id);
			}
		}

		_.contentPanel.parentNode.insertBefore(_.focusTrap, _.contentPanel);
		_.focusTrap.appendChild(_.contentPanel);

		_.focusTrap.setupTrap();

		// Add modal overlay
		_.prepend(document.createElement('cart-overlay'));
		_.#attachListeners();
		_.#bindKeyboard();
	}

	/**
	 * Event emitter method - Add an event listener with a cleaner API
	 * @param {string} eventName - Name of the event to listen for
	 * @param {Function} callback - Callback function to execute when event is fired
	 * @returns {CartDialog} Returns this for method chaining
	 */
	on(eventName, callback) {
		this.#eventEmitter.on(eventName, callback);
		return this;
	}

	/**
	 * Event emitter method - Remove an event listener
	 * @param {string} eventName - Name of the event to stop listening for
	 * @param {Function} callback - Callback function to remove
	 * @returns {CartDialog} Returns this for method chaining
	 */
	off(eventName, callback) {
		this.#eventEmitter.off(eventName, callback);
		return this;
	}

	/**
	 * Internal method to emit events via the event emitter
	 * @param {string} eventName - Name of the event to emit
	 * @param {*} [data] - Optional data to include with the event
	 * @private
	 */
	#emit(eventName, data = null) {
		this.#eventEmitter.emit(eventName, data);
	}

	/**
	 * Attach event listeners for cart dialog functionality
	 * @private
	 */
	#attachListeners() {
		const _ = this;

		// Handle trigger buttons
		document.addEventListener('click', (e) => {
			const trigger = e.target.closest(`[aria-controls="${_.id}"]`);
			if (!trigger) return;

			if (trigger.getAttribute('data-prevent-default') === 'true') {
				e.preventDefault();
			}

			_.show(trigger);
		});

		// Handle close buttons
		_.addEventListener('click', (e) => {
			if (!e.target.closest('[data-action="hide-cart"]')) return;
			_.hide();
		});

		// Handle cart item remove events
		_.addEventListener('cart-item:remove', (e) => {
			_.#handleCartItemRemove(e);
		});

		// Handle cart item quantity change events
		_.addEventListener('cart-item:quantity-change', (e) => {
			_.#handleCartItemQuantityChange(e);
		});

		// Add transition end listener
		_.contentPanel.addEventListener('transitionend', _.#handleTransitionEnd);
	}

	/**
	 * Detach event listeners
	 * @private
	 */
	#detachListeners() {
		const _ = this;
		if (_.contentPanel) {
			_.contentPanel.removeEventListener('transitionend', _.#handleTransitionEnd);
		}
	}

	/**
	 * Binds keyboard events for accessibility
	 * @private
	 */
	#bindKeyboard() {
		this.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') {
				this.hide();
			}
		});
	}

	/**
	 * Handle cart item removal
	 * @private
	 */
	#handleCartItemRemove(e) {
		const { cartKey, element } = e.detail;

		// Set item to processing state
		element.setState('processing');

		// Remove item by setting quantity to 0
		this.updateCartItem(cartKey, 0)
			.then((updatedCart) => {
				if (updatedCart && !updatedCart.error) {
					// Success - remove with animation
					element.destroyYourself();
					this.#currentCart = updatedCart;
					this.#updateCartItems(updatedCart);

					// Emit cart updated and data changed events
					this.#emit('cart-dialog:updated', { cart: updatedCart });
					this.#emit('cart-dialog:data-changed', updatedCart);
				} else {
					// Error - reset to ready state
					element.setState('ready');
					console.error('Failed to remove cart item:', cartKey);
				}
			})
			.catch((error) => {
				// Error - reset to ready state
				element.setState('ready');
				console.error('Error removing cart item:', error);
			});
	}

	/**
	 * Handle cart item quantity change
	 * @private
	 */
	#handleCartItemQuantityChange(e) {
		const { cartKey, quantity, element } = e.detail;

		// Set item to processing state
		element.setState('processing');

		// Update item quantity
		this.updateCartItem(cartKey, quantity)
			.then((updatedCart) => {
				if (updatedCart && !updatedCart.error) {
					// Success - update cart data
					this.#currentCart = updatedCart;
					this.#updateCartItems(updatedCart);
					element.setState('ready');

					// Emit cart updated and data changed events
					this.#emit('cart-dialog:updated', { cart: updatedCart });
					this.#emit('cart-dialog:data-changed', updatedCart);
				} else {
					// Error - reset to ready state
					element.setState('ready');
					console.error('Failed to update cart item quantity:', cartKey, quantity);
				}
			})
			.catch((error) => {
				// Error - reset to ready state
				element.setState('ready');
				console.error('Error updating cart item quantity:', error);
			});
	}

	/**
	 * Update cart items
	 * @private
	 */
	#updateCartItems(cart = null) {
		// Placeholder for cart item updates
		// Could be used to sync cart items with server data
		const cartData = cart || this.#currentCart;
		if (cartData) {
			// Future implementation: update cart item components
		}
	}

	/**
	 * Fetch current cart data from server
	 * @returns {Promise<Object>} Cart data object
	 */
	getCart() {
		return fetch('/cart.json', {
			crossDomain: true,
			credentials: 'same-origin',
		})
			.then((response) => {
				if (!response.ok) {
					throw Error(response.statusText);
				}
				return response.json();
			})
			.catch((error) => {
				console.error('Error fetching cart:', error);
				return { error: true, message: error.message };
			});
	}

	/**
	 * Update cart item quantity on server
	 * @param {string|number} key - Cart item key/ID
	 * @param {number} quantity - New quantity (0 to remove)
	 * @returns {Promise<Object>} Updated cart data object
	 */
	updateCartItem(key, quantity) {
		return fetch('/cart/change.json', {
			crossDomain: true,
			method: 'POST',
			credentials: 'same-origin',
			body: JSON.stringify({ id: key, quantity: quantity }),
			headers: { 'Content-Type': 'application/json' },
		})
			.then((response) => {
				if (!response.ok) {
					throw Error(response.statusText);
				}
				return response.json();
			})
			.catch((error) => {
				console.error('Error updating cart item:', error);
				return { error: true, message: error.message };
			});
	}

	/**
	 * Refresh cart data from server and update components
	 * @returns {Promise<Object>} Cart data object
	 */
	refreshCart() {
		return this.getCart().then((cartData) => {
			if (cartData && !cartData.error) {
				this.#currentCart = cartData;
				this.#updateCartItems(cartData);

				// Emit cart refreshed and data changed events
				this.#emit('cart-dialog:refreshed', { cart: cartData });
				this.#emit('cart-dialog:data-changed', cartData);
			}
			return cartData;
		});
	}

	/**
	 * Shows the cart dialog and traps focus within it
	 * @param {HTMLElement} [triggerEl=null] - The element that triggered the cart dialog
	 * @fires CartDialog#show - Fired when the cart dialog has been shown
	 */
	show(triggerEl = null) {
		const _ = this;
		_.triggerEl = triggerEl || false;

		// Remove the hidden class first to ensure content is rendered
		_.contentPanel.classList.remove('hidden');

		// Give the browser a moment to process before starting animation
		requestAnimationFrame(() => {
			// Update ARIA states
			_.setAttribute('aria-hidden', 'false');
			if (_.triggerEl) {
				_.triggerEl.setAttribute('aria-expanded', 'true');
			}

			// Lock body scrolling and save scroll position
			_.#lockScroll();

			// Focus management
			const firstFocusable = _.querySelector(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			if (firstFocusable) {
				requestAnimationFrame(() => {
					firstFocusable.focus();
				});
			}

			// Refresh cart data when showing
			_.refreshCart();

			// Emit show event - cart dialog is now visible
			_.#emit('cart-dialog:show', { triggerElement: _.triggerEl });
		});
	}

	/**
	 * Hides the cart dialog and restores focus
	 * @fires CartDialog#hide - Fired when the cart dialog has started hiding (transition begins)
	 * @fires CartDialog#afterHide - Fired when the cart dialog has completed its hide transition
	 */
	hide() {
		const _ = this;

		// Restore body scroll and scroll position
		_.#restoreScroll();

		// Update ARIA states
		if (_.triggerEl) {
			// remove focus from modal panel first
			_.triggerEl.focus();
			// mark trigger as no longer expanded
			_.triggerEl.setAttribute('aria-expanded', 'false');
		}

		// Set aria-hidden to start transition
		// The transitionend event handler will add display:none when complete
		_.setAttribute('aria-hidden', 'true');

		// Emit hide event - cart dialog is now starting to hide
		_.#emit('cart-dialog:hide', { triggerElement: _.triggerEl });
	}
}

/**
 * Custom element that creates a clickable overlay for the cart dialog
 * @extends HTMLElement
 */
class CartOverlay extends HTMLElement {
	constructor() {
		super();
		this.setAttribute('tabindex', '-1');
		this.setAttribute('aria-hidden', 'true');
		this.cartDialog = this.closest('cart-dialog');
		this.#attachListeners();
	}

	#attachListeners() {
		this.addEventListener('click', () => {
			this.cartDialog.hide();
		});
	}
}

/**
 * Custom element that wraps the content of the cart dialog
 * @extends HTMLElement
 */
class CartPanel extends HTMLElement {
	constructor() {
		super();
		this.setAttribute('role', 'document');
	}
}

customElements.define('cart-dialog', CartDialog);
customElements.define('cart-overlay', CartOverlay);
customElements.define('cart-panel', CartPanel);

export { CartDialog, CartOverlay, CartPanel };
export default CartDialog;
