import './cart-panel.css';
import EventEmitter from '@magic-spells/event-emitter';
import { CartItem, CartItemContent, CartItemProcessing } from './cart-item.js';

// =============================================================================
// CartPanel Component
// =============================================================================

/**
 * Shopping cart panel web component for Shopify.
 * Manages cart data and AJAX requests, delegates modal behavior to dialog-panel.
 * @extends HTMLElement
 */
class CartPanel extends HTMLElement {
	#currentCart = null;
	#eventEmitter;
	#isInitialRender = true;

	constructor() {
		super();
		this.#eventEmitter = new EventEmitter();
	}

	connectedCallback() {
		this.#attachListeners();

		// Load cart data immediately unless manual mode is enabled
		if (!this.hasAttribute('manual')) {
			this.refreshCart();
		}
	}

	disconnectedCallback() {
		// Clean up handled by garbage collection
	}

	// =========================================================================
	// Public API - Event Emitter
	// =========================================================================

	/**
	 * Add an event listener
	 * @param {string} eventName - Name of the event
	 * @param {Function} callback - Callback function
	 * @returns {CartPanel} Returns this for method chaining
	 */
	on(eventName, callback) {
		this.#eventEmitter.on(eventName, callback);
		return this;
	}

	/**
	 * Remove an event listener
	 * @param {string} eventName - Name of the event
	 * @param {Function} callback - Callback function
	 * @returns {CartPanel} Returns this for method chaining
	 */
	off(eventName, callback) {
		this.#eventEmitter.off(eventName, callback);
		return this;
	}

	// =========================================================================
	// Public API - Dialog Control
	// =========================================================================

	/**
	 * Show the cart by finding and opening the nearest dialog-panel ancestor
	 * @param {HTMLElement} [triggerEl=null] - The element that triggered the open
	 * @param {Object} [cartObj=null] - Optional cart object to use instead of fetching
	 */
	show(triggerEl = null, cartObj = null) {
		const _ = this;
		const dialogPanel = _.#findDialogPanel();

		if (dialogPanel) {
			dialogPanel.show(triggerEl);
			_.refreshCart(cartObj);
			_.#emit('cart-panel:show', { triggerElement: triggerEl });
		} else {
			console.warn('cart-panel: No dialog-panel ancestor found. Cart panel is visible but not in a modal.');
		}
	}

	/**
	 * Hide the cart by finding and closing the nearest dialog-panel ancestor
	 */
	hide() {
		const dialogPanel = this.#findDialogPanel();
		if (dialogPanel) {
			dialogPanel.hide();
			this.#emit('cart-panel:hide', {});
		}
	}

	// =========================================================================
	// Public API - Cart Data
	// =========================================================================

	/**
	 * Fetch current cart data from Shopify
	 * @returns {Promise<Object>} Cart data object
	 */
	getCart() {
		return fetch('/cart.json', {
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
	 * Update cart item quantity on Shopify
	 * @param {string|number} key - Cart item key/ID
	 * @param {number} quantity - New quantity (0 to remove)
	 * @returns {Promise<Object>} Updated cart data object
	 */
	updateCartItem(key, quantity) {
		return fetch('/cart/change.json', {
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
	 * Refresh cart display - fetches from server if no cart object provided
	 * @param {Object} [cartObj=null] - Cart data object to render, or null to fetch
	 * @returns {Promise<Object>} Cart data object
	 */
	async refreshCart(cartObj = null) {
		const _ = this;

		// Fetch from server if no cart object provided
		cartObj = cartObj || (await _.getCart());
		if (!cartObj || cartObj.error) {
			console.warn('Cart data has error or is null:', cartObj);
			return cartObj;
		}

		_.#currentCart = cartObj;
		_.#renderCartItems(cartObj);
		_.#renderCartPanel(cartObj);

		const cartWithCalculatedFields = _.#addCalculatedFields(cartObj);
		_.#emit('cart-panel:refreshed', { cart: cartWithCalculatedFields });
		_.#emit('cart-panel:data-changed', cartWithCalculatedFields);

		return cartObj;
	}

	// =========================================================================
	// Public API - Templates
	// =========================================================================

	/**
	 * Set the template function for cart items
	 * @param {string} templateName - Name of the template
	 * @param {Function} templateFn - Function that takes (itemData, cartData) and returns HTML string
	 */
	setCartItemTemplate(templateName, templateFn) {
		CartItem.setTemplate(templateName, templateFn);
	}

	/**
	 * Set the processing template function for cart items
	 * @param {Function} templateFn - Function that returns HTML string for processing state
	 */
	setCartItemProcessingTemplate(templateFn) {
		CartItem.setProcessingTemplate(templateFn);
	}

	// =========================================================================
	// Private Methods - Core
	// =========================================================================

	/**
	 * Find the nearest dialog-panel ancestor
	 * @private
	 */
	#findDialogPanel() {
		return this.closest('dialog-panel');
	}

	/**
	 * Emit an event via EventEmitter and native CustomEvent
	 * @private
	 */
	#emit(eventName, data = null) {
		this.#eventEmitter.emit(eventName, data);

		this.dispatchEvent(
			new CustomEvent(eventName, {
				detail: data,
				bubbles: true,
			})
		);
	}

	/**
	 * Attach event listeners
	 * @private
	 */
	#attachListeners() {
		// Handle close buttons
		this.addEventListener('click', (e) => {
			if (!e.target.closest('[data-action-hide-cart]')) return;
			this.hide();
		});

		// Handle cart item remove events
		this.addEventListener('cart-item:remove', (e) => {
			this.#handleCartItemRemove(e);
		});

		// Handle cart item quantity change events
		this.addEventListener('cart-item:quantity-change', (e) => {
			this.#handleCartItemQuantityChange(e);
		});
	}

	// =========================================================================
	// Private Methods - Cart Item Event Handlers
	// =========================================================================

	/**
	 * Handle cart item removal
	 * @private
	 */
	#handleCartItemRemove(e) {
		const _ = this;
		const { cartKey, element } = e.detail;

		element.setState('processing');

		_.updateCartItem(cartKey, 0)
			.then((updatedCart) => {
				if (updatedCart && !updatedCart.error) {
					_.#currentCart = updatedCart;
					_.#renderCartItems(updatedCart);
					_.#renderCartPanel(updatedCart);

					const cartWithCalculatedFields = _.#addCalculatedFields(updatedCart);
					_.#emit('cart-panel:updated', { cart: cartWithCalculatedFields });
					_.#emit('cart-panel:data-changed', cartWithCalculatedFields);
				} else {
					element.setState('ready');
					console.error('Failed to remove cart item:', cartKey);
				}
			})
			.catch((error) => {
				element.setState('ready');
				console.error('Error removing cart item:', error);
			});
	}

	/**
	 * Handle cart item quantity change
	 * @private
	 */
	#handleCartItemQuantityChange(e) {
		const _ = this;
		const { cartKey, quantity, element } = e.detail;

		element.setState('processing');

		_.updateCartItem(cartKey, quantity)
			.then((updatedCart) => {
				if (updatedCart && !updatedCart.error) {
					_.#currentCart = updatedCart;
					_.#renderCartItems(updatedCart);
					_.#renderCartPanel(updatedCart);

					const cartWithCalculatedFields = _.#addCalculatedFields(updatedCart);
					_.#emit('cart-panel:updated', { cart: cartWithCalculatedFields });
					_.#emit('cart-panel:data-changed', cartWithCalculatedFields);
				} else {
					element.setState('ready');
					console.error('Failed to update cart item quantity:', cartKey, quantity);
				}
			})
			.catch((error) => {
				element.setState('ready');
				console.error('Error updating cart item quantity:', error);
			});
	}

	// =========================================================================
	// Private Methods - Rendering
	// =========================================================================

	/**
	 * Update cart count elements across the page
	 * @private
	 */
	#renderCartCount(cartData) {
		if (!cartData) return;

		const visibleItems = this.#getVisibleCartItems(cartData);
		const visibleItemCount = visibleItems.reduce((total, item) => total + item.quantity, 0);

		const cartCountElements = document.querySelectorAll('[data-content-cart-count]');
		cartCountElements.forEach((element) => {
			element.textContent = visibleItemCount;
		});
	}

	/**
	 * Update cart subtotal elements across the page
	 * @private
	 */
	#renderCartSubtotal(cartData) {
		if (!cartData) return;

		const pricedItems = cartData.items.filter((item) => {
			const ignorePrice = item.properties?._ignore_price_in_subtotal;
			return !ignorePrice;
		});
		const subtotal = pricedItems.reduce((total, item) => total + (item.line_price || 0), 0);

		const cartSubtotalElements = document.querySelectorAll('[data-content-cart-subtotal]');
		cartSubtotalElements.forEach((element) => {
			const formatted = (subtotal / 100).toFixed(2);
			element.textContent = `$${formatted}`;
		});
	}

	/**
	 * Update cart panel sections (has-items/empty)
	 * @private
	 */
	#renderCartPanel(cart = null) {
		const _ = this;
		const cartData = cart || _.#currentCart;
		if (!cartData) return;

		const visibleItems = _.#getVisibleCartItems(cartData);
		const hasVisibleItems = visibleItems.length > 0;

		// Set state attribute for CSS styling (e.g., Tailwind variants)
		_.setAttribute('state', hasVisibleItems ? 'has-items' : 'empty');

		const hasItemsSection = _.querySelector('[data-cart-has-items]');
		const emptySection = _.querySelector('[data-cart-is-empty]');

		if (hasItemsSection && emptySection) {
			hasItemsSection.style.display = hasVisibleItems ? '' : 'none';
			emptySection.style.display = hasVisibleItems ? 'none' : '';
		}

		_.#renderCartCount(cartData);
		_.#renderCartSubtotal(cartData);
	}

	/**
	 * Render cart items with smart add/update/remove
	 * @private
	 */
	#renderCartItems(cartData) {
		const _ = this;
		const itemsContainer = _.querySelector('[data-content-cart-items]');

		if (!itemsContainer || !cartData || !cartData.items) return;

		const visibleItems = _.#getVisibleCartItems(cartData);

		// Initial render - load all items without animation
		if (_.#isInitialRender) {
			itemsContainer.innerHTML = '';
			visibleItems.forEach((itemData) => {
				itemsContainer.appendChild(new CartItem(itemData, cartData));
			});
			_.#isInitialRender = false;
			return;
		}

		// Get current DOM items
		const currentItems = Array.from(itemsContainer.querySelectorAll('cart-item'));
		const currentKeys = new Set(currentItems.map((item) => item.getAttribute('key')));

		// Get new cart data keys
		const newKeys = visibleItems.map((item) => item.key || item.id);
		const newKeysSet = new Set(newKeys);

		// Step 1: Remove items no longer in cart
		_.#removeItemsFromDOM(itemsContainer, newKeysSet);

		// Step 2: Update existing items
		_.#updateItemsInDOM(itemsContainer, cartData);

		// Step 3: Add new items with animation
		const itemsToAdd = visibleItems.filter(
			(itemData) => !currentKeys.has(itemData.key || itemData.id)
		);
		_.#addItemsToDOM(itemsContainer, itemsToAdd, newKeys, cartData);
	}

	/**
	 * Remove items from DOM that are no longer in cart
	 * @private
	 */
	#removeItemsFromDOM(itemsContainer, newKeysSet) {
		const currentItems = Array.from(itemsContainer.querySelectorAll('cart-item'));
		const itemsToRemove = currentItems.filter((item) => !newKeysSet.has(item.getAttribute('key')));

		itemsToRemove.forEach((item) => {
			item.destroyYourself();
		});
	}

	/**
	 * Update existing cart-item elements with fresh data
	 * @private
	 */
	#updateItemsInDOM(itemsContainer, cartData) {
		const visibleItems = this.#getVisibleCartItems(cartData);
		const existingItems = Array.from(itemsContainer.querySelectorAll('cart-item'));

		existingItems.forEach((cartItemEl) => {
			const key = cartItemEl.getAttribute('key');
			const updatedItemData = visibleItems.find((item) => (item.key || item.id) === key);
			if (updatedItemData) cartItemEl.setData(updatedItemData, cartData);
		});
	}

	/**
	 * Add new items to DOM with animation delay
	 * @private
	 */
	#addItemsToDOM(itemsContainer, itemsToAdd, newKeys, cartData) {
		setTimeout(() => {
			itemsToAdd.forEach((itemData) => {
				const cartItem = CartItem.createAnimated(itemData, cartData);
				const targetIndex = newKeys.indexOf(itemData.key || itemData.id);

				if (targetIndex === 0) {
					itemsContainer.insertBefore(cartItem, itemsContainer.firstChild);
				} else {
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
						insertAfter.insertAdjacentElement('afterend', cartItem);
					} else {
						itemsContainer.appendChild(cartItem);
					}
				}
			});
		}, 100);
	}

	// =========================================================================
	// Private Methods - Helpers
	// =========================================================================

	/**
	 * Filter cart items to exclude hidden items
	 * @private
	 */
	#getVisibleCartItems(cartData) {
		if (!cartData || !cartData.items) return [];
		return cartData.items.filter((item) => {
			const hidden = item.properties?._hide_in_cart;
			return !hidden;
		});
	}

	/**
	 * Add calculated fields to cart object
	 * @private
	 */
	#addCalculatedFields(cartData) {
		if (!cartData) return cartData;

		const visibleItems = this.#getVisibleCartItems(cartData);
		const calculated_count = visibleItems.reduce((total, item) => total + item.quantity, 0);

		const pricedItems = cartData.items.filter((item) => !item.properties?._ignore_price_in_subtotal);
		const calculated_subtotal = pricedItems.reduce((total, item) => total + (item.line_price || 0), 0);

		return { ...cartData, calculated_count, calculated_subtotal };
	}
}

// =============================================================================
// Register Custom Elements
// =============================================================================

if (!customElements.get('cart-panel')) {
	customElements.define('cart-panel', CartPanel);
}

export { CartPanel, CartItem, CartItemContent, CartItemProcessing };
export default CartPanel;
