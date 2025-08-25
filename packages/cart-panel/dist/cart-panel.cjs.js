'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var cartItem = require('@magic-spells/cart-item');
require('@magic-spells/focus-trap');
var EventEmitter = require('@magic-spells/event-emitter');

/**
 * Custom element that creates an accessible modal cart dialog with focus management
 * @extends HTMLElement
 */
class CartDialog extends HTMLElement {
	#handleTransitionEnd;
	#currentCart = null;
	#eventEmitter;
	#isInitialRender = true;

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
	 * Locks body scrolling
	 * @private
	 */
	#lockScroll() {
		// Apply overflow hidden to body
		document.body.classList.add('overflow-hidden');
	}

	/**
	 * Restores body scrolling when cart dialog is closed
	 * @private
	 */
	#restoreScroll() {
		// Remove overflow hidden from body
		document.body.classList.remove('overflow-hidden');
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

		// Check if focus-trap already exists, if not create one
		_.focusTrap = _.contentPanel.querySelector('focus-trap');
		if (!_.focusTrap) {
			_.focusTrap = document.createElement('focus-trap');

			// Move all existing cart-panel content into the focus trap
			const existingContent = Array.from(_.contentPanel.childNodes);
			existingContent.forEach((child) => _.focusTrap.appendChild(child));

			// Insert focus trap inside the cart-panel
			_.contentPanel.appendChild(_.focusTrap);
		}

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

		// Add modal overlay if it doesn't already exist
		if (!_.querySelector('cart-overlay')) {
			_.prepend(document.createElement('cart-overlay'));
		}
		_.#attachListeners();
		_.#bindKeyboard();

		// Load cart data immediately after component initialization
		_.refreshCart();
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

		// Also emit as native DOM events for better compatibility
		this.dispatchEvent(
			new CustomEvent(eventName, {
				detail: data,
				bubbles: true,
			})
		);
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
			if (!e.target.closest('[data-action-hide-cart]')) return;
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
					// Success - let smart comparison handle the removal animation
					this.#currentCart = updatedCart;
					this.#renderCartItems(updatedCart);
					this.#renderCartPanel(updatedCart);

					// Emit cart updated and data changed events
					const cartWithCalculatedFields = this.#addCalculatedFields(updatedCart);
					this.#emit('cart-dialog:updated', { cart: cartWithCalculatedFields });
					this.#emit('cart-dialog:data-changed', cartWithCalculatedFields);
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
					// Success - update cart data and refresh items
					this.#currentCart = updatedCart;
					this.#renderCartItems(updatedCart);
					this.#renderCartPanel(updatedCart);
					element.setState('ready');

					// Emit cart updated and data changed events
					const cartWithCalculatedFields = this.#addCalculatedFields(updatedCart);
					this.#emit('cart-dialog:updated', { cart: cartWithCalculatedFields });
					this.#emit('cart-dialog:data-changed', cartWithCalculatedFields);
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
	 * Update cart count elements across the site
	 * @private
	 */
	#renderCartCount(cartData) {
		if (!cartData) return;

		// Calculate visible item count (excluding _hide_in_cart items)
		const visibleItems = this.#getVisibleCartItems(cartData);
		const visibleItemCount = visibleItems.reduce((total, item) => total + item.quantity, 0);

		// Update all cart count elements across the site
		const cartCountElements = document.querySelectorAll('[data-content-cart-count]');
		cartCountElements.forEach((element) => {
			element.textContent = visibleItemCount;
		});
	}

	/**
	 * Update cart subtotal elements across the site
	 * @private
	 */
	#renderCartSubtotal(cartData) {
		if (!cartData) return;

		// Calculate visible item subtotal (excluding _hide_in_cart items)
		const visibleItems = this.#getVisibleCartItems(cartData);
		const visibleSubtotal = visibleItems.reduce((total, item) => total + (item.line_price || 0), 0);

		// Update all cart subtotal elements across the site
		const cartSubtotalElements = document.querySelectorAll('[data-content-cart-subtotal]');
		cartSubtotalElements.forEach((element) => {
			// Format as currency (assuming cents, convert to dollars)
			const formatted = (visibleSubtotal / 100).toFixed(2);
			element.textContent = `$${formatted}`;
		});
	}

	/**
	 * Update cart items display based on cart data
	 * @private
	 */
	#renderCartPanel(cart = null) {
		const cartData = cart || this.#currentCart;
		if (!cartData) return;

		// Get cart sections
		const hasItemsSection = this.querySelector('[data-cart-has-items]');
		const emptySection = this.querySelector('[data-cart-is-empty]');
		const itemsContainer = this.querySelector('[data-content-cart-items]');

		if (!hasItemsSection || !emptySection || !itemsContainer) {
			console.warn(
				'Cart sections not found. Expected [data-cart-has-items], [data-cart-is-empty], and [data-content-cart-items]'
			);
			return;
		}

		// Check visible item count for showing/hiding sections
		const visibleItems = this.#getVisibleCartItems(cartData);
		const hasVisibleItems = visibleItems.length > 0;

		// Show/hide sections based on visible item count
		if (hasVisibleItems) {
			hasItemsSection.style.display = '';
			emptySection.style.display = 'none';
		} else {
			hasItemsSection.style.display = 'none';
			emptySection.style.display = '';
		}

		// Update cart count and subtotal across the site
		this.#renderCartCount(cartData);
		this.#renderCartSubtotal(cartData);
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
	 * @param {Object} [cartObj=null] - Optional cart object to use instead of fetching
	 * @returns {Promise<Object>} Cart data object
	 */
	refreshCart(cartObj = null) {
		// If cart object is provided, use it directly
		if (cartObj && !cartObj.error) {
			// console.log('Using provided cart data:', cartObj);
			this.#currentCart = cartObj;
			this.#renderCartItems(cartObj);
			this.#renderCartPanel(cartObj);

			// Emit cart refreshed and data changed events
			const cartWithCalculatedFields = this.#addCalculatedFields(cartObj);
			this.#emit('cart-dialog:refreshed', { cart: cartWithCalculatedFields });
			this.#emit('cart-dialog:data-changed', cartWithCalculatedFields);

			return Promise.resolve(cartObj);
		}

		// Otherwise fetch from server
		return this.getCart().then((cartData) => {
			// console.log('Cart data received:', cartData);
			if (cartData && !cartData.error) {
				this.#currentCart = cartData;
				this.#renderCartItems(cartData);
				this.#renderCartPanel(cartData);

				// Emit cart refreshed and data changed events
				const cartWithCalculatedFields = this.#addCalculatedFields(cartData);
				this.#emit('cart-dialog:refreshed', { cart: cartWithCalculatedFields });
				this.#emit('cart-dialog:data-changed', cartWithCalculatedFields);
			} else {
				console.warn('Cart data has error or is null:', cartData);
			}
			return cartData;
		});
	}

	/**
	 * Remove items from DOM that are no longer in cart data
	 * @private
	 */
	#removeItemsFromDOM(itemsContainer, newKeysSet) {
		const currentItems = Array.from(itemsContainer.querySelectorAll('cart-item'));

		const itemsToRemove = currentItems.filter((item) => !newKeysSet.has(item.getAttribute('key')));

		itemsToRemove.forEach((item) => {
			console.log('destroy yourself', item);
			item.destroyYourself();
		});
	}

	/**
	 * Add new items to DOM with animation delay
	 * @private
	 */
	#addItemsToDOM(itemsContainer, itemsToAdd, newKeys) {
		// Delay adding new items by 300ms to let cart slide open first
		setTimeout(() => {
			itemsToAdd.forEach((itemData) => {
				const cartItem$1 = cartItem.CartItem.createAnimated(itemData);
				const targetIndex = newKeys.indexOf(itemData.key || itemData.id);

				// Find the correct position to insert the new item
				if (targetIndex === 0) {
					// Insert at the beginning
					itemsContainer.insertBefore(cartItem$1, itemsContainer.firstChild);
				} else {
					// Find the item that should come before this one
					let insertAfter = null;
					for (let i = targetIndex - 1; i >= 0; i--) {
						const prevKey = newKeys[i];
						const prevItem = itemsContainer.querySelector(`cart-item[key="${prevKey}"]`);
						if (prevItem) {
							insertAfter = prevItem;
							break;
						}
					}

					if (insertAfter) {
						insertAfter.insertAdjacentElement('afterend', cartItem$1);
					} else {
						itemsContainer.appendChild(cartItem$1);
					}
				}
			});
		}, 100);
	}

	/**
	 * Filter cart items to exclude those with _hide_in_cart property
	 * @private
	 */
	#getVisibleCartItems(cartData) {
		if (!cartData || !cartData.items) return [];
		return cartData.items.filter((item) => {
			// Check for _hide_in_cart in various possible locations
			const hidden = item.properties?._hide_in_cart;

			return !hidden;
		});
	}

	/**
	 * Add calculated fields to cart object for events
	 * @private
	 */
	#addCalculatedFields(cartData) {
		if (!cartData) return cartData;

		const visibleItems = this.#getVisibleCartItems(cartData);
		const calculated_count = visibleItems.reduce((total, item) => total + item.quantity, 0);
		const calculated_subtotal = visibleItems.reduce(
			(total, item) => total + (item.line_price || 0),
			0
		);

		return {
			...cartData,
			calculated_count,
			calculated_subtotal,
		};
	}

	/**
	 * Render cart items from Shopify cart data with smart comparison
	 * @private
	 */
	#renderCartItems(cartData) {
		const itemsContainer = this.querySelector('[data-content-cart-items]');

		if (!itemsContainer || !cartData || !cartData.items) {
			console.warn('Cannot render cart items:', {
				itemsContainer: !!itemsContainer,
				cartData: !!cartData,
				items: cartData?.items?.length,
			});
			return;
		}

		// Filter out items with _hide_in_cart property
		const visibleItems = this.#getVisibleCartItems(cartData);

		// Handle initial render - load all items without animation
		if (this.#isInitialRender) {
			// console.log('Initial cart render:', visibleItems.length, 'visible items');

			// Clear existing items
			itemsContainer.innerHTML = '';

			// Create cart-item elements without animation
			visibleItems.forEach((itemData) => {
				const cartItem$1 = new cartItem.CartItem(itemData); // No animation
				// const cartItem = document.createElement('cart-item');
				// cartItem.setData(itemData);
				itemsContainer.appendChild(cartItem$1);
			});

			this.#isInitialRender = false;

			return;
		}

		// Get current DOM items and their keys
		const currentItems = Array.from(itemsContainer.querySelectorAll('cart-item'));
		const currentKeys = new Set(currentItems.map((item) => item.getAttribute('key')));

		// Get new cart data keys in order (only visible items)
		const newKeys = visibleItems.map((item) => item.key || item.id);
		const newKeysSet = new Set(newKeys);

		// Step 1: Remove items that are no longer in cart data
		this.#removeItemsFromDOM(itemsContainer, newKeysSet);

		// Step 2: Add new items that weren't in DOM (with animation delay)
		const itemsToAdd = visibleItems.filter(
			(itemData) => !currentKeys.has(itemData.key || itemData.id)
		);
		this.#addItemsToDOM(itemsContainer, itemsToAdd, newKeys);
	}

	/**
	 * Set the template function for cart items
	 * @param {Function} templateFn - Function that takes item data and returns HTML string
	 */
	setCartItemTemplate(templateName, templateFn) {
		cartItem.CartItem.setTemplate(templateName, templateFn);
	}

	/**
	 * Set the processing template function for cart items
	 * @param {Function} templateFn - Function that returns HTML string for processing state
	 */
	setCartItemProcessingTemplate(templateFn) {
		cartItem.CartItem.setProcessingTemplate(templateFn);
	}

	/**
	 * Shows the cart dialog and traps focus within it
	 * @param {HTMLElement} [triggerEl=null] - The element that triggered the cart dialog
	 * @fires CartDialog#show - Fired when the cart dialog has been shown
	 */
	show(triggerEl = null, cartObj) {
		const _ = this;
		_.triggerEl = triggerEl || false;

		// Lock body scrolling
		_.#lockScroll();

		// Remove the hidden class first to ensure content is rendered
		_.contentPanel.classList.remove('hidden');

		// Give the browser a moment to process before starting animation
		requestAnimationFrame(() => {
			// Update ARIA states
			_.setAttribute('aria-hidden', 'false');

			if (_.triggerEl) {
				_.triggerEl.setAttribute('aria-expanded', 'true');
			}

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
			_.refreshCart(cartObj);

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

		// Update ARIA states
		if (_.triggerEl) {
			// remove focus from modal panel first
			_.triggerEl.focus();
			// mark trigger as no longer expanded
			_.triggerEl.setAttribute('aria-expanded', 'false');
		} else {
			// If no trigger element, blur any focused element inside the panel
			const activeElement = document.activeElement;
			if (activeElement && _.contains(activeElement)) {
				activeElement.blur();
			}
		}

		requestAnimationFrame(() => {
			// Set aria-hidden to start transition
			// The transitionend event handler will add display:none when complete
			_.setAttribute('aria-hidden', 'true');

			// Emit hide event - cart dialog is now starting to hide
			_.#emit('cart-dialog:hide', { triggerElement: _.triggerEl });

			// Restore body scroll
			_.#restoreScroll();
		});
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

if (!customElements.get('cart-dialog')) {
	customElements.define('cart-dialog', CartDialog);
}
if (!customElements.get('cart-overlay')) {
	customElements.define('cart-overlay', CartOverlay);
}
if (!customElements.get('cart-panel')) {
	customElements.define('cart-panel', CartPanel);
}

// Make CartItem available globally for Shopify themes
if (typeof window !== 'undefined') {
	window.CartItem = cartItem.CartItem;
}

Object.defineProperty(exports, 'CartItem', {
	enumerable: true,
	get: function () { return cartItem.CartItem; }
});
exports.CartDialog = CartDialog;
exports.CartOverlay = CartOverlay;
exports.CartPanel = CartPanel;
exports.default = CartDialog;
//# sourceMappingURL=cart-panel.cjs.js.map
