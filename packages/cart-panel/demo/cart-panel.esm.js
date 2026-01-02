class EventEmitter {
  #events;

  constructor() {
    this.#events = new Map();
  }

  /**
   * Binds a listener to an event.
   * @param {string} event - The event to bind the listener to.
   * @param {Function} listener - The listener function to bind.
   * @returns {EventEmitter} The current instance for chaining.
   * @throws {TypeError} If the listener is not a function.
   */
  on(event, listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Listener must be a function");
    }

    const listeners = this.#events.get(event) || [];
    if (!listeners.includes(listener)) {
      listeners.push(listener);
    }
    this.#events.set(event, listeners);

    return this;
  }

  /**
   * Unbinds a listener from an event.
   * @param {string} event - The event to unbind the listener from.
   * @param {Function} listener - The listener function to unbind.
   * @returns {EventEmitter} The current instance for chaining.
   */
  off(event, listener) {
    const listeners = this.#events.get(event);
    if (!listeners) return this;

    const index = listeners.indexOf(listener);
    if (index !== -1) {
      listeners.splice(index, 1);
      if (listeners.length === 0) {
        this.#events.delete(event);
      } else {
        this.#events.set(event, listeners);
      }
    }

    return this;
  }

  /**
   * Triggers an event and calls all bound listeners.
   * @param {string} event - The event to trigger.
   * @param {...*} args - Arguments to pass to the listener functions.
   * @returns {boolean} True if the event had listeners, false otherwise.
   */
  emit(event, ...args) {
    const listeners = this.#events.get(event);
    if (!listeners || listeners.length === 0) return false;

    for (let i = 0, n = listeners.length; i < n; ++i) {
      try {
        listeners[i].apply(this, args);
      } catch (error) {
        console.error(`Error in listener for event '${event}':`, error);
      }
    }

    return true;
  }

  /**
   * Removes all listeners for a specific event or all events.
   * @param {string} [event] - The event to remove listeners from. If not provided, removes all listeners.
   * @returns {EventEmitter} The current instance for chaining.
   */
  removeAllListeners(event) {
    if (event) {
      this.#events.delete(event);
    } else {
      this.#events.clear();
    }
    return this;
  }
}

// =============================================================================
// CartItem Component
// =============================================================================

/**
 * CartItem class that handles the functionality of a cart item component
 */
class CartItem extends HTMLElement {
	// Static template functions shared across all instances
	static #templates = new Map();
	static #processingTemplate = null;

	// Private fields
	#currentState = 'ready';
	#isDestroying = false;
	#isAppearing = false;
	#handlers = {};
	#itemData = null;
	#cartData = null;
	#lastRenderedHTML = '';

	/**
	 * Set the template function for rendering cart items
	 * @param {string} name - Template name ('default' for default template)
	 * @param {Function} templateFn - Function that takes (itemData, cartData) and returns HTML string
	 */
	static setTemplate(name, templateFn) {
		if (typeof name !== 'string') {
			throw new Error('Template name must be a string');
		}
		if (typeof templateFn !== 'function') {
			throw new Error('Template must be a function');
		}
		CartItem.#templates.set(name, templateFn);
	}

	/**
	 * Set the processing template function for rendering processing overlay
	 * @param {Function} templateFn - Function that returns HTML string for processing state
	 */
	static setProcessingTemplate(templateFn) {
		if (typeof templateFn !== 'function') {
			throw new Error('Processing template must be a function');
		}
		CartItem.#processingTemplate = templateFn;
	}

	/**
	 * Create a cart item with appearing animation
	 * @param {Object} itemData - Shopify cart item data
	 * @param {Object} cartData - Full Shopify cart object
	 * @returns {CartItem} Cart item instance that will animate in
	 */
	static createAnimated(itemData, cartData) {
		return new CartItem(itemData, cartData, { animate: true });
	}

	/**
	 * Define which attributes should be observed for changes
	 */
	static get observedAttributes() {
		return ['state', 'key'];
	}

	/**
	 * Called when observed attributes change
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		if (name === 'state') {
			this.#currentState = newValue || 'ready';
		}
	}

	constructor(itemData = null, cartData = null, options = {}) {
		super();

		// Store item and cart data if provided
		this.#itemData = itemData;
		this.#cartData = cartData;

		// Set initial state - start with 'appearing' only if explicitly requested
		const shouldAnimate = options.animate || this.hasAttribute('animate-in');
		this.#currentState =
			itemData && shouldAnimate ? 'appearing' : this.getAttribute('state') || 'ready';

		// Bind event handlers
		this.#handlers = {
			click: this.#handleClick.bind(this),
			change: this.#handleChange.bind(this),
			transitionEnd: this.#handleTransitionEnd.bind(this),
		};
	}

	connectedCallback() {
		const _ = this;

		// If we have item data, render it first
		if (_.#itemData) _.#render();

		// Find child elements and attach listeners
		_.#queryDOM();
		_.#updateLinePriceElements();
		_.#attachListeners();

		// If we started with 'appearing' state, handle the entry animation
		if (_.#currentState === 'appearing') {
			_.setAttribute('state', 'appearing');
			_.#isAppearing = true;

			requestAnimationFrame(() => {
				_.style.height = `${_.scrollHeight}px`;
				requestAnimationFrame(() => _.setState('ready'));
			});
		}
	}

	disconnectedCallback() {
		// Cleanup event listeners
		this.#detachListeners();
	}

	/**
	 * Query and cache DOM elements
	 */
	#queryDOM() {
		this.content = this.querySelector('cart-item-content');
		this.processing = this.querySelector('cart-item-processing');
	}

	/**
	 * Attach event listeners
	 */
	#attachListeners() {
		const _ = this;
		_.addEventListener('click', _.#handlers.click);
		_.addEventListener('change', _.#handlers.change);
		_.addEventListener('quantity-input:change', _.#handlers.change);
		_.addEventListener('transitionend', _.#handlers.transitionEnd);
	}

	/**
	 * Detach event listeners
	 */
	#detachListeners() {
		const _ = this;
		_.removeEventListener('click', _.#handlers.click);
		_.removeEventListener('change', _.#handlers.change);
		_.removeEventListener('quantity-input:change', _.#handlers.change);
		_.removeEventListener('transitionend', _.#handlers.transitionEnd);
	}

	/**
	 * Get the current state
	 */
	get state() {
		return this.#currentState;
	}

	/**
	 * Get the cart key for this item
	 */
	get cartKey() {
		return this.getAttribute('key');
	}

	/**
	 * Handle click events (for Remove buttons, etc.)
	 */
	#handleClick(e) {
		// Check if clicked element is a remove button
		const removeButton = e.target.closest('[data-action-remove-item]');
		if (removeButton) {
			e.preventDefault();
			this.#emitRemoveEvent();
		}
	}

	/**
	 * Handle change events (for quantity inputs and quantity-input component)
	 */
	#handleChange(e) {
		// Check if event is from quantity-input component
		if (e.type === 'quantity-input:change') {
			this.#emitQuantityChangeEvent(e.detail.value);
			return;
		}

		// Check if changed element is a quantity input
		const quantityInput = e.target.closest('[data-cart-quantity]');
		if (quantityInput) {
			this.#emitQuantityChangeEvent(quantityInput.value);
		}
	}

	/**
	 * Handle transition end events for destroy animation and appearing animation
	 */
	#handleTransitionEnd(e) {
		if (e.propertyName === 'height' && this.#isDestroying) {
			// Remove from DOM after height animation completes
			this.remove();
		} else if (e.propertyName === 'height' && this.#isAppearing) {
			// Remove explicit height after appearing animation completes
			this.style.height = '';
			this.#isAppearing = false;
		}
	}

	/**
	 * Emit remove event
	 */
	#emitRemoveEvent() {
		this.dispatchEvent(
			new CustomEvent('cart-item:remove', {
				bubbles: true,
				detail: {
					cartKey: this.cartKey,
					element: this,
				},
			})
		);
	}

	/**
	 * Emit quantity change event
	 */
	#emitQuantityChangeEvent(quantity) {
		this.dispatchEvent(
			new CustomEvent('cart-item:quantity-change', {
				bubbles: true,
				detail: {
					cartKey: this.cartKey,
					quantity: parseInt(quantity),
					element: this,
				},
			})
		);
	}

	/**
	 * Render cart item from data using the appropriate template
	 */
	#render() {
		const _ = this;
		if (!_.#itemData || CartItem.#templates.size === 0) return;

		// Set the key attribute from item data
		const key = _.#itemData.key || _.#itemData.id;
		if (key) _.setAttribute('key', key);

		// Generate HTML from template and store for future comparisons
		const templateHTML = _.#generateTemplateHTML();
		_.#lastRenderedHTML = templateHTML;

		// Generate processing HTML from template or use default
		const processingHTML = CartItem.#processingTemplate
			? CartItem.#processingTemplate()
			: '<div class="cart-item-loader"></div>';

		// Create the cart-item structure with template content inside cart-item-content
		_.innerHTML = `
			<cart-item-content>
				${templateHTML}
			</cart-item-content>
			<cart-item-processing>
				${processingHTML}
			</cart-item-processing>
		`;
	}

	/**
	 * Update the cart item with new data
	 * @param {Object} itemData - Shopify cart item data
	 * @param {Object} cartData - Full Shopify cart object
	 */
	setData(itemData, cartData = null) {
		const _ = this;

		// Update internal data
		_.#itemData = itemData;
		if (cartData) _.#cartData = cartData;

		// Generate new HTML with updated data
		const newHTML = _.#generateTemplateHTML();

		// Compare with previously rendered HTML
		if (newHTML === _.#lastRenderedHTML) {
			// HTML hasn't changed, just reset processing state
			_.setState('ready');
			_.#updateQuantityInput();
			return;
		}

		// HTML is different, proceed with full update
		_.setState('ready');
		_.#render();
		_.#queryDOM();
		_.#updateLinePriceElements();
	}

	/**
	 * Generate HTML from the current template with current data
	 * @returns {string} Generated HTML string or empty string if no template
	 * @private
	 */
	#generateTemplateHTML() {
		// If no templates are available, return empty string
		if (!this.#itemData || CartItem.#templates.size === 0) {
			return '';
		}

		// Determine which template to use
		const templateName = this.#itemData.properties?._cart_template || 'default';
		const templateFn = CartItem.#templates.get(templateName) || CartItem.#templates.get('default');

		if (!templateFn) {
			return '';
		}

		// Generate and return HTML from template
		return templateFn(this.#itemData, this.#cartData);
	}

	/**
	 * Update quantity input component to match server data
	 * @private
	 */
	#updateQuantityInput() {
		if (!this.#itemData) return;

		const quantityInput = this.querySelector('quantity-input');
		if (quantityInput) {
			quantityInput.value = this.#itemData.quantity;
		}
	}

	/**
	 * Update elements with data-content-line-price attribute
	 * @private
	 */
	#updateLinePriceElements() {
		if (!this.#itemData) return;

		const linePriceElements = this.querySelectorAll('[data-content-line-price]');
		const formattedLinePrice = this.#formatCurrency(this.#itemData.line_price || 0);

		linePriceElements.forEach((element) => {
			element.textContent = formattedLinePrice;
		});
	}

	/**
	 * Format currency value from cents to dollar string
	 * @param {number} cents - Price in cents
	 * @returns {string} Formatted currency string (e.g., "$29.99")
	 * @private
	 */
	#formatCurrency(cents) {
		if (typeof cents !== 'number') return '$0.00';
		return `$${(cents / 100).toFixed(2)}`;
	}

	/**
	 * Get the current item data
	 */
	get itemData() {
		return this.#itemData;
	}

	/**
	 * Set the state of the cart item
	 * @param {string} state - 'ready', 'processing', 'destroying', or 'appearing'
	 */
	setState(state) {
		if (['ready', 'processing', 'destroying', 'appearing'].includes(state)) {
			this.setAttribute('state', state);
		}
	}

	/**
	 * Gracefully animate this cart item closed, then remove it
	 */
	destroyYourself() {
		const _ = this;

		// bail if already in the middle of a destroy cycle
		if (_.#isDestroying) return;
		_.#isDestroying = true;

		// snapshot the current rendered height before applying any "destroying" styles
		const initialHeight = _.offsetHeight;
		_.setState('destroying');

		// lock the measured height on the next animation frame to ensure layout is fully flushed
		requestAnimationFrame(() => {
			_.style.height = `${initialHeight}px`;

			// read the css custom property for timing, defaulting to 400ms
			const destroyDuration =
				getComputedStyle(_).getPropertyValue('--cart-item-destroying-duration')?.trim() || '400ms';

			// animate only the height to zero; other properties stay under stylesheet control
			_.style.transition = `height ${destroyDuration} ease`;
			_.style.height = '0px';

			setTimeout(() => _.remove(), 600);
		});
	}
}

/**
 * Supporting component classes for cart item
 */
class CartItemContent extends HTMLElement {
	constructor() {
		super();
	}
}

class CartItemProcessing extends HTMLElement {
	constructor() {
		super();
	}
}

// =============================================================================
// Register Custom Elements
// =============================================================================

if (!customElements.get('cart-item')) {
	customElements.define('cart-item', CartItem);
}
if (!customElements.get('cart-item-content')) {
	customElements.define('cart-item-content', CartItemContent);
}
if (!customElements.get('cart-item-processing')) {
	customElements.define('cart-item-processing', CartItemProcessing);
}

// Make CartItem available globally for Shopify themes
if (typeof window !== 'undefined') {
	window.CartItem = CartItem;
}

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

export { CartItem, CartItemContent, CartItemProcessing, CartPanel, CartPanel as default };
//# sourceMappingURL=cart-panel.esm.js.map
