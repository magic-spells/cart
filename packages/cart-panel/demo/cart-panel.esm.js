/**
 * CartItem class that handles the functionality of a cart item component
 */
class CartItem extends HTMLElement {
	// Static template functions shared across all instances
	static #template = null;
	static #processingTemplate = null;

	// Private fields
	#currentState = 'ready';
	#isDestroying = false;
	#handlers = {};
	#itemData = null;

	/**
	 * Set the template function for rendering cart items
	 * @param {Function} templateFn - Function that takes item data and returns HTML string
	 */
	static setTemplate(templateFn) {
		if (typeof templateFn !== 'function') {
			throw new Error('Template must be a function');
		}
		CartItem.#template = templateFn;
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

	constructor(itemData = null) {
		super();

		// Store item data if provided
		this.#itemData = itemData;

		// Set initial state - start with 'appearing' if we have item data to render
		this.#currentState = itemData ? 'appearing' : this.getAttribute('state') || 'ready';

		// Bind event handlers
		this.#handlers = {
			click: this.#handleClick.bind(this),
			change: this.#handleChange.bind(this),
			transitionEnd: this.#handleTransitionEnd.bind(this),
		};
	}

	connectedCallback() {
		// If we have item data, render it first
		if (this.#itemData) {
			this.#renderFromData();
		}

		// Find child elements
		this.content = this.querySelector('cart-item-content');
		this.processing = this.querySelector('cart-item-processing');

		// Attach event listeners
		this.#attachListeners();

		// If we started with 'appearing' state, handle the entry animation
		if (this.#currentState === 'appearing') {
			// Set the state attribute
			this.setAttribute('state', 'appearing');

			// Get the natural height after rendering
			requestAnimationFrame(() => {
				const naturalHeight = this.scrollHeight;

				// Set explicit height for animation
				this.style.height = `${naturalHeight}px`;

				// Transition to ready state after a brief delay
				setTimeout(() => {
					this.setState('ready');
					// Remove explicit height after animation completes
					setTimeout(() => {
						this.style.height = '';
					}, 400); // Match appearing duration
				}, 50);
			});
		}
	}

	disconnectedCallback() {
		// Cleanup event listeners
		this.#detachListeners();
	}

	/**
	 * Attach event listeners
	 */
	#attachListeners() {
		this.addEventListener('click', this.#handlers.click);
		this.addEventListener('change', this.#handlers.change);
		this.addEventListener('transitionend', this.#handlers.transitionEnd);
	}

	/**
	 * Detach event listeners
	 */
	#detachListeners() {
		this.removeEventListener('click', this.#handlers.click);
		this.removeEventListener('change', this.#handlers.change);
		this.removeEventListener('transitionend', this.#handlers.transitionEnd);
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
	 * Handle change events (for quantity inputs)
	 */
	#handleChange(e) {
		// Check if changed element is a quantity input
		const quantityInput = e.target.closest('[data-cart-quantity]');
		if (quantityInput) {
			this.#emitQuantityChangeEvent(quantityInput.value);
		}
	}

	/**
	 * Handle transition end events for destroy animation
	 */
	#handleTransitionEnd(e) {
		if (e.propertyName === 'height' && this.#isDestroying) {
			// Remove from DOM after height animation completes
			this.remove();
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
	 * Render cart item from data using the static template
	 */
	#renderFromData() {
		if (!this.#itemData || !CartItem.#template) {
			return;
		}

		// Set the key attribute from item data
		const key = this.#itemData.key || this.#itemData.id;
		if (key) {
			this.setAttribute('key', key);
		}

		// Generate HTML from template
		const templateHTML = CartItem.#template(this.#itemData);

		// Generate processing HTML from template or use default
		const processingHTML = CartItem.#processingTemplate
			? CartItem.#processingTemplate()
			: '<div class="cart-item-loader"></div>';

		// Create the cart-item structure with template content inside cart-item-content
		this.innerHTML = `
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
	 */
	setData(itemData) {
		this.#itemData = itemData;
		this.#renderFromData();

		// Re-find child elements after re-rendering
		this.content = this.querySelector('cart-item-content');
		this.processing = this.querySelector('cart-item-processing');
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
	 * gracefully animate this cart item closed, then let #handleTransitionEnd remove it
	 *
	 * @returns {void}
	 */
	destroyYourself() {
		// bail if already in the middle of a destroy cycle
		if (this.#isDestroying) return;

		this.#isDestroying = true;

		// snapshot the current rendered height before applying any "destroying" styles
		const initialHeight = this.offsetHeight;

		// switch to 'destroying' state so css can fade / slide visuals
		this.setState('destroying');

		// lock the measured height on the next animation frame to ensure layout is fully flushed
		requestAnimationFrame(() => {
			this.style.height = `${initialHeight}px`;
			this.offsetHeight; // force a reflow so the browser registers the fixed height

			// read the css custom property for timing, defaulting to 400ms
			const elementStyle = getComputedStyle(this);
			const destroyDuration =
				elementStyle.getPropertyValue('--cart-item-destroying-duration')?.trim() || '400ms';

			// animate only the height to zero; other properties stay under stylesheet control
			this.style.transition = `height ${destroyDuration} ease`;
			this.style.height = '0px';
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

// Define custom elements (check if not already defined)
if (!customElements.get('cart-item')) {
	customElements.define('cart-item', CartItem);
}
if (!customElements.get('cart-item-content')) {
	customElements.define('cart-item-content', CartItemContent);
}
if (!customElements.get('cart-item-processing')) {
	customElements.define('cart-item-processing', CartItemProcessing);
}

/**
 * Retrieves all focusable elements within a given container.
 *
 * @param {HTMLElement} container - The container element to search for focusable elements.
 * @returns {HTMLElement[]} An array of focusable elements found within the container.
 */
const getFocusableElements = (container) => {
	const focusableSelectors =
		'summary, a[href], button:not(:disabled), [tabindex]:not([tabindex^="-"]):not(focus-trap-start):not(focus-trap-end), [draggable], area, input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled), object, iframe';
	return Array.from(container.querySelectorAll(focusableSelectors));
};

class FocusTrap extends HTMLElement {
	/** @type {boolean} Indicates whether the styles have been injected into the DOM. */
	static styleInjected = false;

	constructor() {
		super();
		this.trapStart = null;
		this.trapEnd = null;

		// Inject styles only once, when the first FocusTrap instance is created.
		if (!FocusTrap.styleInjected) {
			this.injectStyles();
			FocusTrap.styleInjected = true;
		}
	}

	/**
	 * Injects necessary styles for the focus trap into the document's head.
	 * This ensures that focus-trap-start and focus-trap-end elements are hidden.
	 */
	injectStyles() {
		const style = document.createElement('style');
		style.textContent = `
      focus-trap-start,
      focus-trap-end {
        position: absolute;
        width: 1px;
        height: 1px;
        margin: -1px;
        padding: 0;
        border: 0;
        clip: rect(0, 0, 0, 0);
        overflow: hidden;
        white-space: nowrap;
      }
    `;
		document.head.appendChild(style);
	}

	/**
	 * Called when the element is connected to the DOM.
	 * Sets up the focus trap and adds the keydown event listener.
	 */
	connectedCallback() {
		this.setupTrap();
		this.addEventListener('keydown', this.handleKeyDown);
	}

	/**
	 * Called when the element is disconnected from the DOM.
	 * Removes the keydown event listener.
	 */
	disconnectedCallback() {
		this.removeEventListener('keydown', this.handleKeyDown);
	}

	/**
	 * Sets up the focus trap by adding trap start and trap end elements.
	 * Focuses the trap start element to initiate the focus trap.
	 */
	setupTrap() {
		// check to see it there are any focusable children
		const focusableElements = getFocusableElements(this);
		// exit if there aren't any
		if (focusableElements.length === 0) return;

		// create trap start and end elements
		this.trapStart = document.createElement('focus-trap-start');
		this.trapEnd = document.createElement('focus-trap-end');

		// add to DOM
		this.prepend(this.trapStart);
		this.append(this.trapEnd);
	}

	/**
	 * Handles the keydown event. If the Escape key is pressed, the focus trap is exited.
	 *
	 * @param {KeyboardEvent} e - The keyboard event object.
	 */
	handleKeyDown = (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			this.exitTrap();
		}
	};

	/**
	 * Exits the focus trap by hiding the current container and shifting focus
	 * back to the trigger element that opened the trap.
	 */
	exitTrap() {
		const container = this.closest('[aria-hidden="false"]');
		if (!container) return;

		container.setAttribute('aria-hidden', 'true');

		const trigger = document.querySelector(
			`[aria-expanded="true"][aria-controls="${container.id}"]`
		);
		if (trigger) {
			trigger.setAttribute('aria-expanded', 'false');
			trigger.focus();
		}
	}
}

class FocusTrapStart extends HTMLElement {
	/**
	 * Called when the element is connected to the DOM.
	 * Sets the tabindex and adds the focus event listener.
	 */
	connectedCallback() {
		this.setAttribute('tabindex', '0');
		this.addEventListener('focus', this.handleFocus);
	}

	/**
	 * Called when the element is disconnected from the DOM.
	 * Removes the focus event listener.
	 */
	disconnectedCallback() {
		this.removeEventListener('focus', this.handleFocus);
	}

	/**
	 * Handles the focus event. If focus moves backwards from the first focusable element,
	 * it is cycled to the last focusable element, and vice versa.
	 *
	 * @param {FocusEvent} e - The focus event object.
	 */
	handleFocus = (e) => {
		const trap = this.closest('focus-trap');
		const focusableElements = getFocusableElements(trap);

		if (focusableElements.length === 0) return;

		const firstElement = focusableElements[0];
		const lastElement = focusableElements[focusableElements.length - 1];

		if (e.relatedTarget === firstElement) {
			lastElement.focus();
		} else {
			firstElement.focus();
		}
	};
}

class FocusTrapEnd extends HTMLElement {
	/**
	 * Called when the element is connected to the DOM.
	 * Sets the tabindex and adds the focus event listener.
	 */
	connectedCallback() {
		this.setAttribute('tabindex', '0');
		this.addEventListener('focus', this.handleFocus);
	}

	/**
	 * Called when the element is disconnected from the DOM.
	 * Removes the focus event listener.
	 */
	disconnectedCallback() {
		this.removeEventListener('focus', this.handleFocus);
	}

	/**
	 * Handles the focus event. When the trap end is focused, focus is shifted back to the trap start.
	 */
	handleFocus = () => {
		const trap = this.closest('focus-trap');
		const trapStart = trap.querySelector('focus-trap-start');
		trapStart.focus();
	};
}

customElements.define('focus-trap', FocusTrap);
customElements.define('focus-trap-start', FocusTrapStart);
customElements.define('focus-trap-end', FocusTrapEnd);

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
		if (typeof listener !== 'function') {
			throw new TypeError('Listener must be a function');
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
		cart || this.#currentCart;
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

if (!customElements.get('cart-dialog')) {
	customElements.define('cart-dialog', CartDialog);
}
if (!customElements.get('cart-overlay')) {
	customElements.define('cart-overlay', CartOverlay);
}
if (!customElements.get('cart-panel')) {
	customElements.define('cart-panel', CartPanel);
}

export { CartDialog, CartOverlay, CartPanel, CartDialog as default };
//# sourceMappingURL=cart-panel.esm.js.map
