import './cart-panel.css';
import EventEmitter from '@magic-spells/event-emitter';

// =============================================================================
// Cart Item Resolution
//
// cart-panel does not bundle cart-item. The <cart-item> element is resolved
// from the custom element registry at render time, so consumers opt in with
// `import '@magic-spells/cart-panel/cart-item'` or register their own element.
// =============================================================================

const CART_ITEM_TAG = 'cart-item';

// Warn-once flag for the render path only - never consumed by the template setters
let hasWarnedAboutMissingCartItemOnRender = false;

// Static template methods already reported as missing on a replacement element
const warnedMissingTemplateMethods = new Set();

// Template calls made before <cart-item> was registered, replayed on definition
const pendingCartItemTemplateCalls = [];
let isPendingTemplateFlushScheduled = false;

// Warn-once flags for the two section-mode misconfigurations
let hasWarnedAboutTemplateInSectionMode = false;
let hasWarnedAboutMissingSetContent = false;

/**
 * Resolve the registered <cart-item> constructor for rendering, warning once if it is missing
 * @returns {Function|null} Registered cart-item constructor, or null
 */
function resolveCartItemElement() {
	const CartItemElement = customElements.get(CART_ITEM_TAG);
	if (CartItemElement) return CartItemElement;

	if (!hasWarnedAboutMissingCartItemOnRender) {
		hasWarnedAboutMissingCartItemOnRender = true;
		console.warn(
			'cart-panel: no <cart-item> element is registered, so cart items cannot be rendered. ' +
				"Import '@magic-spells/cart-panel' for both elements, or " +
				"'@magic-spells/cart-panel/cart-item' on its own, or register your own with " +
				"customElements.define('cart-item', ...)."
		);
	}

	return null;
}

/**
 * Invoke a static template method on the registered cart-item class
 * @param {Function} CartItemElement - Registered cart-item constructor
 * @param {string} methodName - Static method name to call
 * @param {Array} args - Arguments forwarded to the method
 */
function invokeCartItemTemplateMethod(CartItemElement, methodName, args) {
	if (typeof CartItemElement[methodName] !== 'function') {
		if (!warnedMissingTemplateMethods.has(methodName)) {
			warnedMissingTemplateMethods.add(methodName);
			console.warn(
				`cart-panel: the registered <cart-item> element has no static ${methodName}() method, ` +
					'so the template was ignored. Replacement elements must implement ' +
					'static setTemplate(name, fn), static setProcessingTemplate(fn), and ' +
					'static createAnimated(itemData, cartData).'
			);
		}
		return;
	}

	CartItemElement[methodName](...args);
}

/**
 * Replay template calls that were buffered before <cart-item> was registered
 */
function flushPendingCartItemTemplates() {
	if (pendingCartItemTemplateCalls.length === 0) return;

	const CartItemElement = customElements.get(CART_ITEM_TAG);
	if (!CartItemElement) return;

	const bufferedCalls = pendingCartItemTemplateCalls.splice(0);
	bufferedCalls.forEach(({ methodName, args }) => {
		invokeCartItemTemplateMethod(CartItemElement, methodName, args);
	});
}

/**
 * Call a static template method on <cart-item>, buffering it until the element
 * is registered so templates can be set before the item component is imported
 * @param {string} methodName - Static method name to call
 * @param {Array} args - Arguments forwarded to the method
 */
function callCartItemTemplateMethod(methodName, args) {
	const CartItemElement = customElements.get(CART_ITEM_TAG);

	if (CartItemElement) {
		invokeCartItemTemplateMethod(CartItemElement, methodName, args);
		return;
	}

	pendingCartItemTemplateCalls.push({ methodName, args });

	if (!isPendingTemplateFlushScheduled) {
		isPendingTemplateFlushScheduled = true;
		customElements.whenDefined(CART_ITEM_TAG).then(flushPendingCartItemTemplates);
	}
}

/**
 * Warn once when JS templates are set while the panel renders from a section
 */
function warnAboutTemplateInSectionMode() {
	if (hasWarnedAboutTemplateInSectionMode) return;
	hasWarnedAboutTemplateInSectionMode = true;
	console.warn(
		'cart-panel: a cart item template was set while the `section` attribute is present. ' +
			'Section mode renders line items from the Shopify section, so the template is ignored. ' +
			'Pick one source of truth: drop the `section` attribute, or drop the template.'
	);
}

/**
 * Warn once when the registered <cart-item> cannot take server-rendered markup
 */
function warnAboutMissingSetContent() {
	if (hasWarnedAboutMissingSetContent) return;
	hasWarnedAboutMissingSetContent = true;
	console.warn(
		'cart-panel: the registered <cart-item> element has no setContent() method, so ' +
			'server-rendered markup cannot be applied. Elements used with the `section` ' +
			'attribute must implement setContent(html).'
	);
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
	#hasRenderedCartItems = false;
	#isAwaitingCartItemDefinition = false;

	#hasConnected = false;

	// Count elements this panel hid, so it only ever removes its own inline
	// display and never an author's
	#hiddenCountElements = new WeakSet();

	// One record per line key while a mutation is in flight or queued.
	// { seq, inFlight, pending, removed } - see #queueLineMutation.
	#lineRequests = new Map();

	constructor() {
		super();
		this.#eventEmitter = new EventEmitter();
	}

	/**
	 * Attributes the panel reacts to after it is connected
	 */
	static get observedAttributes() {
		return ['section', 'hide-count-when-empty'];
	}

	/**
	 * React to a live attribute change. Switching render mode starts the item
	 * list over: the two modes build their elements differently, so nothing is
	 * worth carrying across.
	 */
	attributeChangedCallback(name, oldValue, newValue) {
		const _ = this;
		if (oldValue === newValue) return;

		// the initial value arrives before connectedCallback, which does the first
		// render itself - or deliberately does not, in manual mode
		if (!_.#hasConnected || !_.isConnected) return;

		if (name === 'hide-count-when-empty') {
			_.#renderCartCount(_.#currentCart);
			return;
		}

		if (name !== 'section') return;

		const itemsContainer = _.querySelector('[data-content-cart-items]');
		if (itemsContainer) itemsContainer.innerHTML = '';
		_.#isInitialRender = true;
		_.#hasRenderedCartItems = false;

		_.refreshCart();
	}

	connectedCallback() {
		this.#hasConnected = true;
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
	// Public API - Attributes
	// =========================================================================

	/**
	 * Whether quantity changes and removals are applied locally before the
	 * server answers
	 * @returns {boolean}
	 */
	get optimistic() {
		return this.hasAttribute('optimistic');
	}

	/**
	 * @param {boolean} value - Turn optimistic updates on or off
	 */
	set optimistic(value) {
		if (value) this.setAttribute('optimistic', '');
		else this.removeAttribute('optimistic');
	}

	/**
	 * Whether [data-content-cart-count] elements are hidden while the cart is
	 * empty, page-wide
	 * @returns {boolean}
	 */
	get hideCountWhenEmpty() {
		return this.hasAttribute('hide-count-when-empty');
	}

	/**
	 * @param {boolean} value - Hide the count elements at zero, or leave them
	 */
	set hideCountWhenEmpty(value) {
		if (value) this.setAttribute('hide-count-when-empty', '');
		else this.removeAttribute('hide-count-when-empty');
	}

	/**
	 * The Shopify section id that renders the line items, or null for JS templates
	 * @returns {string|null}
	 */
	get section() {
		return this.getAttribute('section');
	}

	/**
	 * @param {string|null} value - Section id to render from, falsy for JS templates
	 */
	set section(value) {
		if (value) this.setAttribute('section', value);
		else this.removeAttribute('section');
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
			console.warn(
				'cart-panel: No dialog-panel ancestor found. Cart panel is visible but not in a modal.'
			);
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
	 * Fetch the rendered line-item section from Shopify.
	 * Only used in section mode; resolves to null without a `section` attribute.
	 * @returns {Promise<string|null>} Section markup, or null when unavailable
	 */
	getCartSection() {
		const sectionId = this.section;
		if (!sectionId) return Promise.resolve(null);

		return fetch(`/?sections=${encodeURIComponent(sectionId)}`, {
			credentials: 'same-origin',
		})
			.then((response) => {
				if (!response.ok) {
					throw Error(response.statusText);
				}
				return response.json();
			})
			.then((sections) => sections?.[sectionId] ?? null)
			.catch((error) => {
				console.error('Error fetching cart section:', error);
				return null;
			});
	}

	/**
	 * Update cart item quantity on Shopify.
	 * In section mode the request asks for the rendered section too, so the
	 * markup arrives in the same response - no second round trip.
	 * @param {string|number} key - Cart item key/ID
	 * @param {number} quantity - New quantity (0 to remove)
	 * @returns {Promise<Object>} Updated cart data object
	 */
	updateCartItem(key, quantity) {
		const requestBody = { id: key, quantity: quantity };
		const sectionId = this.section;
		if (sectionId) requestBody.sections = sectionId;

		return fetch('/cart/change.json', {
			method: 'POST',
			credentials: 'same-origin',
			body: JSON.stringify(requestBody),
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
		cartObj = cartObj || (await _.#fetchCartState());
		if (!cartObj || cartObj.error) {
			console.warn('Cart data has error or is null:', cartObj);
			return cartObj;
		}

		// A caller-supplied cart carries JSON but no rendered markup, so section
		// mode fetches the markup that goes with it
		if (_.section && !cartObj.sections?.[_.section]) {
			cartObj = _.#withSectionMarkup(cartObj, await _.getCartSection());
		}

		// An optimistic mutation may still be in the air - a refresh (say, the
		// panel opening) must not flash that line's pre-mutation number back
		cartObj = _.#preserveInFlightLines(cartObj);

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
	 * Delegates to the registered <cart-item> element class, buffering the call
	 * until the element is registered if it is not defined yet
	 * @param {string} templateName - Name of the template
	 * @param {Function} templateFn - Function that takes (itemData, cartData) and returns HTML string
	 */
	setCartItemTemplate(templateName, templateFn) {
		if (this.section) warnAboutTemplateInSectionMode();
		callCartItemTemplateMethod('setTemplate', [templateName, templateFn]);
	}

	/**
	 * Set the processing template function for cart items
	 * Delegates to the registered <cart-item> element class, buffering the call
	 * until the element is registered if it is not defined yet
	 * @param {Function} templateFn - Function that returns HTML string for processing state
	 */
	setCartItemProcessingTemplate(templateFn) {
		callCartItemTemplateMethod('setProcessingTemplate', [templateFn]);
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

		if (_.optimistic) {
			_.#applyOptimisticMutation(cartKey, 0, element);
			return;
		}

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

		if (_.optimistic) {
			_.#applyOptimisticMutation(cartKey, quantity, element);
			return;
		}

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
	// Private Methods - Optimistic Updates
	//
	// With `optimistic` set, a quantity change or a removal is applied to the
	// local cart and drawn immediately - no processing state, no waiting on the
	// network. The request goes out behind it and the answer only ever
	// reconciles: it never drives the first paint.
	//
	// Three rules keep that honest under fast fingers, and #lineRequests is
	// where all three live:
	//   1. coalescing - at most one request per line key is in flight; the
	//      newest value waits its turn and the ones it overtook are dropped;
	//   2. sequence ids - every queued value bumps the key's counter, and a
	//      response is applied only if its counter is still the current one, so
	//      a slow answer can never overwrite newer local state;
	//   3. remove wins - a removal marks the key, and changes queued behind it
	//      are ignored until it settles.
	// =========================================================================

	/**
	 * Apply a line mutation locally and send it in the background
	 * @param {string} key - Cart line key
	 * @param {number} quantity - New quantity, 0 to remove
	 * @param {HTMLElement} element - The cart-item element that raised the event
	 * @private
	 */
	#applyOptimisticMutation(key, quantity, element) {
		const _ = this;
		const parsed = Number.parseInt(quantity, 10);
		const nextQuantity = Number.isNaN(parsed) ? 0 : Math.max(0, parsed);

		// a line already on its way out ignores anything but its own removal
		if (_.#lineRequests.get(key)?.removed && nextQuantity > 0) return;

		// the element leaves at once - the animation is the acknowledgement
		if (nextQuantity === 0 && typeof element?.destroyYourself === 'function') {
			element.destroyYourself();
		}

		const projectedCart = _.#projectCart(_.#currentCart, key, nextQuantity);
		if (projectedCart) {
			_.#currentCart = projectedCart;
			_.#renderCartItems(projectedCart);
			_.#renderCartPanel(projectedCart);

			// progress bars and gifts react to this the instant the click lands
			const cartWithCalculatedFields = _.#addCalculatedFields(projectedCart);
			_.#emit('cart-panel:updated', { cart: cartWithCalculatedFields });
			_.#emit('cart-panel:data-changed', cartWithCalculatedFields);
		}

		_.#queueLineMutation(key, nextQuantity);
	}

	/**
	 * Build the cart the server is about to agree with: one line's quantity and
	 * line price recalculated, everything else untouched
	 * @param {Object} cartData - Current cart object
	 * @param {string} key - Cart line key
	 * @param {number} quantity - New quantity, 0 to remove
	 * @returns {Object|null} Projected cart, or null if the line is not in it
	 * @private
	 */
	#projectCart(cartData, key, quantity) {
		if (!cartData || !Array.isArray(cartData.items)) return null;

		const index = cartData.items.findIndex((item) => (item.key || item.id) === key);
		if (index === -1) return null;

		const items = cartData.items.slice();

		if (quantity === 0) {
			items.splice(index, 1);
		} else {
			const item = items[index];
			const unitPrice = this.#unitPrice(item);
			const projectedItem = { ...item, quantity, line_price: unitPrice * quantity };

			// mirror the other line totals only when the cart actually carries them
			if (typeof item.final_line_price === 'number') {
				projectedItem.final_line_price = unitPrice * quantity;
			}
			if (typeof item.original_line_price === 'number') {
				const originalUnit =
					typeof item.original_price === 'number' ? item.original_price : unitPrice;
				projectedItem.original_line_price = originalUnit * quantity;
			}

			items[index] = projectedItem;
		}

		const item_count = items.reduce((total, item) => total + item.quantity, 0);

		// the section markup on the old cart described the old quantities, so it
		// is dropped rather than re-applied - the server's answer brings fresh HTML
		const projectedCart = { ...cartData, items, item_count };
		delete projectedCart.sections;

		return projectedCart;
	}

	/**
	 * Work out a line's unit price, falling back to the line total when the cart
	 * JSON is thin (a stand-in cart, or an older Shopify payload)
	 * @private
	 */
	#unitPrice(item) {
		if (typeof item.final_price === 'number') return item.final_price;
		if (typeof item.price === 'number') return item.price;
		if (typeof item.line_price === 'number' && item.quantity > 0) {
			return Math.round(item.line_price / item.quantity);
		}
		return 0;
	}

	/**
	 * Queue a line mutation, coalescing on the key
	 * @private
	 */
	#queueLineMutation(key, quantity) {
		const _ = this;
		let entry = _.#lineRequests.get(key);

		if (!entry) {
			entry = { seq: 0, inFlight: false, pending: null, removed: false };
			_.#lineRequests.set(key, entry);
		}

		if (quantity === 0) entry.removed = true;

		// trailing edge: the newest value replaces whatever was waiting
		entry.pending = quantity;
		entry.seq += 1;

		if (!entry.inFlight) _.#drainLineMutation(key);
	}

	/**
	 * Send the queued value for a key, then either send what arrived while it
	 * was out or apply the answer
	 * @private
	 */
	async #drainLineMutation(key) {
		const _ = this;
		const entry = _.#lineRequests.get(key);
		if (!entry || entry.inFlight || entry.pending === null) return;

		const quantity = entry.pending;
		const seq = entry.seq;
		entry.pending = null;
		entry.inFlight = true;

		let response;
		try {
			response = await _.updateCartItem(key, quantity);
		} catch (error) {
			response = { error: true, message: error?.message };
		}

		entry.inFlight = false;

		// anything queued while this was out is newer than the answer we hold
		const isStale = seq !== entry.seq;
		if (entry.pending !== null) _.#drainLineMutation(key);
		if (isStale) return;

		if (!response || response.error) {
			await _.#revertToServerTruth(key, response);
		} else {
			_.#reconcileWithServerCart(response);
		}

		// settled and idle - drop the record so a re-added line with the same
		// key (Shopify reuses them) starts clean
		const settled = _.#lineRequests.get(key);
		if (settled && !settled.inFlight && settled.pending === null && settled.seq === seq) {
			_.#lineRequests.delete(key);
		}
	}

	/**
	 * Take the server's cart as truth, quietly - an event only if it disagrees
	 * with what is already on screen
	 * @private
	 */
	#reconcileWithServerCart(serverCart) {
		const _ = this;
		const reconciledCart = _.#preserveInFlightLines(serverCart);
		const agrees = _.#cartsAgree(_.#currentCart, reconciledCart);

		_.#currentCart = reconciledCart;
		_.#renderCartItems(reconciledCart);
		_.#renderCartPanel(reconciledCart);

		if (agrees) return;

		const cartWithCalculatedFields = _.#addCalculatedFields(reconciledCart);
		_.#emit('cart-panel:updated', { cart: cartWithCalculatedFields });
		_.#emit('cart-panel:data-changed', cartWithCalculatedFields);
	}

	/**
	 * Keep the locally projected quantity of any line that still has a mutation
	 * of its own in the air. Another line's response describes those lines as
	 * they were before their request landed, and rendering that would flash the
	 * old number back.
	 * @private
	 */
	#preserveInFlightLines(serverCart) {
		const _ = this;
		if (_.#lineRequests.size === 0 || !Array.isArray(serverCart?.items)) return serverCart;

		let items = serverCart.items;
		let changed = false;

		_.#lineRequests.forEach((entry, key) => {
			if (!entry.inFlight && entry.pending === null) return;

			const index = items.findIndex((item) => (item.key || item.id) === key);

			if (entry.removed) {
				if (index === -1) return;
				items = items.filter((item, itemIndex) => itemIndex !== index);
				changed = true;
				return;
			}

			const localItem = _.#currentCart?.items?.find((item) => (item.key || item.id) === key);
			if (index === -1 || !localItem || items[index].quantity === localItem.quantity) return;

			items = items.slice();
			items[index] = localItem;
			changed = true;
		});

		if (!changed) return serverCart;

		const item_count = items.reduce((total, item) => total + item.quantity, 0);
		return { ...serverCart, items, item_count };
	}

	/**
	 * Compare two carts line for line - keys, quantities and line prices
	 * @private
	 */
	#cartsAgree(cartA, cartB) {
		const itemsA = cartA?.items;
		const itemsB = cartB?.items;
		if (!Array.isArray(itemsA) || !Array.isArray(itemsB)) return false;
		if (itemsA.length !== itemsB.length) return false;

		return itemsA.every((item, index) => {
			const other = itemsB[index];
			return (
				(item.key || item.id) === (other.key || other.id) &&
				item.quantity === other.quantity &&
				(item.line_price || 0) === (other.line_price || 0)
			);
		});
	}

	/**
	 * Put the server's cart back on screen after a failed mutation and announce
	 * the failure. A line that was removed optimistically animates back in.
	 * @private
	 */
	async #revertToServerTruth(key, error) {
		const _ = this;
		const serverCart = await _.#fetchCartState();

		if (serverCart && !serverCart.error) {
			_.#currentCart = serverCart;
			_.#renderCartItems(serverCart);
			_.#renderCartPanel(serverCart);
			_.#emit('cart-panel:data-changed', _.#addCalculatedFields(serverCart));
		}

		_.#emit('cart-panel:error', { key, error });
	}

	// =========================================================================
	// Private Methods - Rendering
	// =========================================================================

	/**
	 * Update cart count elements across the page
	 * @private
	 */
	#renderCartCount(cartData) {
		const _ = this;
		if (!cartData) return;

		const visibleItems = _.#getVisibleCartItems(cartData);
		const visibleItemCount = visibleItems.reduce((total, item) => total + item.quantity, 0);
		const hideWhenEmpty = _.hideCountWhenEmpty;

		// Document-wide on purpose: the site header's cart badge lives outside
		// the panel and still has to move with everything else
		const cartCountElements = document.querySelectorAll('[data-content-cart-count]');
		cartCountElements.forEach((element) => {
			element.textContent = visibleItemCount;

			if (hideWhenEmpty && visibleItemCount === 0) {
				element.style.display = 'none';
				_.#hiddenCountElements.add(element);
				return;
			}

			// only ever undo our own inline display - an author's stays theirs
			if (!_.#hiddenCountElements.has(element)) return;
			element.style.removeProperty('display');
			_.#hiddenCountElements.delete(element);
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

		// Bail out if no cart-item element is registered - warns once, then waits
		// for a late registration so the panel can catch up on its own
		const CartItemElement = resolveCartItemElement();
		if (!CartItemElement) {
			_.#watchForCartItemDefinition();
			return;
		}

		_.#hasRenderedCartItems = true;

		// Section mode: Shopify rendered the lines, so the markup is the truth
		// about their content and this render only diffs it into place
		if (_.section) {
			_.#renderCartItemsFromSection(itemsContainer, cartData, CartItemElement);
			return;
		}

		const visibleItems = _.#getVisibleCartItems(cartData);

		// Initial render - load all items without animation
		if (_.#isInitialRender) {
			itemsContainer.innerHTML = '';
			visibleItems.forEach((itemData) => {
				itemsContainer.appendChild(new CartItemElement(itemData, cartData));
			});
			_.#isInitialRender = false;
			return;
		}

		// Get current DOM items
		const currentItems = _.#getLiveCartItems(itemsContainer);
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
		_.#addItemsToDOM({ itemsContainer, itemsToAdd, newKeys, cartData, CartItemElement });
	}

	/**
	 * Wait for a late <cart-item> registration and render the current cart once
	 * it arrives, so import order does not require a manual refresh
	 * @private
	 */
	#watchForCartItemDefinition() {
		const _ = this;
		if (_.#isAwaitingCartItemDefinition) return;
		_.#isAwaitingCartItemDefinition = true;

		customElements.whenDefined(CART_ITEM_TAG).then(() => {
			_.#isAwaitingCartItemDefinition = false;

			// apply buffered templates before rendering so items are not blank
			flushPendingCartItemTemplates();

			// skip if a render already succeeded, the panel left the DOM,
			// or there is no cart data to render yet
			if (_.#hasRenderedCartItems || !_.isConnected || !_.#currentCart) return;

			_.#renderCartItems(_.#currentCart);
		});
	}

	/**
	 * Remove items from DOM that are no longer in cart
	 * @private
	 */
	#removeItemsFromDOM(itemsContainer, newKeysSet) {
		const currentItems = this.#getLiveCartItems(itemsContainer);
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
		const existingItems = this.#getLiveCartItems(itemsContainer);

		existingItems.forEach((cartItemEl) => {
			const key = cartItemEl.getAttribute('key');
			const updatedItemData = visibleItems.find((item) => (item.key || item.id) === key);
			if (updatedItemData) cartItemEl.setData(updatedItemData, cartData);
		});
	}

	/**
	 * Add new items to DOM with animation delay
	 * @param {Object} options
	 * @param {HTMLElement} options.itemsContainer - Container holding the cart-item elements
	 * @param {Array} options.itemsToAdd - Item data objects that are not yet in the DOM
	 * @param {Array} options.newKeys - Ordered cart keys for the full visible item list
	 * @param {Object} options.cartData - Full Shopify cart object
	 * @param {Function} options.CartItemElement - Registered cart-item constructor
	 * @private
	 */
	#addItemsToDOM({ itemsContainer, itemsToAdd, newKeys, cartData, CartItemElement }) {
		setTimeout(() => {
			itemsToAdd.forEach((itemData) => {
				const cartItem = CartItemElement.createAnimated(itemData, cartData);
				const key = itemData.key || itemData.id;
				this.#insertAtKeyOrder(itemsContainer, cartItem, key, newKeys);
			});
		}, 100);
	}

	/**
	 * Insert a cart-item where its key sits in the cart's order, anchoring off
	 * the nearest earlier key already in the DOM
	 * @private
	 */
	#insertAtKeyOrder(itemsContainer, cartItem, key, orderedKeys) {
		const targetIndex = orderedKeys.indexOf(key);

		if (targetIndex === 0) {
			itemsContainer.insertBefore(cartItem, itemsContainer.firstChild);
			return;
		}

		let insertAfter = null;
		for (let i = targetIndex - 1; i >= 0; i--) {
			const prevItem = itemsContainer.querySelector(
				`cart-item[key="${orderedKeys[i]}"]:not([state='destroying'])`
			);
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

	// =========================================================================
	// Private Methods - Section Rendering
	//
	// With a `section` attribute the panel stops generating line-item markup and
	// starts diffing markup Shopify rendered. The split is: the server renders
	// content, JS renders behaviour. Everything else about the panel is
	// unchanged - the JSON still drives count, subtotal, state and events, and
	// the progress bar and the gift stay client-side, because server HTML never
	// touches them.
	// =========================================================================

	/**
	 * Diff server-rendered line items into the container, preserving element
	 * identity for keys that are already there
	 * @private
	 */
	#renderCartItemsFromSection(itemsContainer, cartData, CartItemElement) {
		const _ = this;
		const sectionMarkup = cartData.sections?.[_.section];

		// No markup in this cart object: an optimistic projection is JSON-only,
		// and the JSON still moves the numbers on the lines already drawn
		if (!sectionMarkup) {
			_.#syncCartItemsFromData(itemsContainer, cartData);
			return;
		}

		const parsedItems = _.#parseSectionItems(sectionMarkup);
		const orderedKeys = [...parsedItems.keys()];

		// Initial render - the whole list at once, without animation
		if (_.#isInitialRender) {
			itemsContainer.innerHTML = '';
			orderedKeys.forEach((key) => {
				itemsContainer.appendChild(
					_.#createSectionItem({ key, parsedItems, cartData, CartItemElement })
				);
			});
			_.#isInitialRender = false;
			return;
		}

		const currentItems = _.#getLiveCartItems(itemsContainer);
		const currentKeys = new Set(currentItems.map((item) => item.getAttribute('key')));

		// Step 1: lines the server no longer renders
		_.#removeItemsFromDOM(itemsContainer, new Set(orderedKeys));

		// Step 2: swap content into the elements that stay, so their identity,
		// their state and the focus inside them survive
		currentItems.forEach((cartItemEl) => {
			const parsedItem = parsedItems.get(cartItemEl.getAttribute('key'));
			if (!parsedItem) return;

			// a line with a mutation of its own in the air keeps what it shows -
			// its own answer brings markup that matches it
			if (_.#hasLiveMutation(cartItemEl.getAttribute('key'))) return;

			if (typeof cartItemEl.setContent !== 'function') {
				warnAboutMissingSetContent();
				return;
			}
			cartItemEl.setContent(parsedItem.innerHTML);
		});

		// Step 3: lines the server has and the DOM does not, animated in
		const keysToAdd = orderedKeys.filter((key) => !currentKeys.has(key));
		if (keysToAdd.length === 0) return;

		setTimeout(() => {
			keysToAdd.forEach((key) => {
				const cartItem = _.#createSectionItem({
					key,
					parsedItems,
					cartData,
					CartItemElement,
					animate: true,
				});
				_.#insertAtKeyOrder(itemsContainer, cartItem, key, orderedKeys);
			});
		}, 100);
	}

	/**
	 * Build a cart-item element around server-rendered markup
	 * @private
	 */
	#createSectionItem({ key, parsedItems, cartData, CartItemElement, animate = false }) {
		const itemData = cartData.items?.find((item) => (item.key || item.id) === key) || null;

		// createAnimated needs item data to start in the appearing state; without
		// it the line simply arrives without the entry animation
		const cartItem =
			animate && itemData
				? CartItemElement.createAnimated(itemData, cartData)
				: new CartItemElement(itemData, cartData);

		cartItem.setAttribute('key', key);

		if (typeof cartItem.setContent === 'function') {
			cartItem.setContent(parsedItems.get(key).innerHTML);
		} else {
			warnAboutMissingSetContent();
		}

		return cartItem;
	}

	/**
	 * Pull the cart-item nodes out of rendered section markup, keyed
	 * @returns {Map<string, Element>} Line key to its parsed element, in order
	 * @private
	 */
	#parseSectionItems(sectionMarkup) {
		const parsedDocument = new DOMParser().parseFromString(sectionMarkup, 'text/html');

		// Shopify wraps a rendered section in <div id="shopify-section-{id}">;
		// markup that arrives unwrapped is read straight off the body
		const root =
			parsedDocument.getElementById(`shopify-section-${this.section}`) || parsedDocument.body;

		const parsedItems = new Map();
		root.querySelectorAll('cart-item[key]').forEach((node) => {
			const key = node.getAttribute('key');
			if (key && !parsedItems.has(key)) parsedItems.set(key, node);
		});

		return parsedItems;
	}

	/**
	 * Move the numbers on already-rendered lines from cart JSON alone, leaving
	 * their markup as the server drew it
	 * @private
	 */
	#syncCartItemsFromData(itemsContainer, cartData) {
		const _ = this;
		const visibleItems = _.#getVisibleCartItems(cartData);
		const visibleKeys = new Set(visibleItems.map((item) => item.key || item.id));

		_.#removeItemsFromDOM(itemsContainer, visibleKeys);

		_.#getLiveCartItems(itemsContainer).forEach((cartItemEl) => {
			const key = cartItemEl.getAttribute('key');
			const itemData = visibleItems.find((item) => (item.key || item.id) === key);
			if (!itemData || typeof cartItemEl.applyItemData !== 'function') return;

			cartItemEl.applyItemData(itemData, cartData);
		});
	}

	// =========================================================================
	// Private Methods - Helpers
	// =========================================================================

	/**
	 * The single "what does the server say" entry point: used by refreshCart()
	 * and by the revert after a failed optimistic mutation
	 * @returns {Promise<Object>} Cart data object
	 * @private
	 */
	async #fetchCartState() {
		const _ = this;
		if (!_.section) return _.getCart();

		// One round trip each, in parallel: JSON always drives the numbers, the
		// state and the events; the section only ever draws the line items
		const [cartData, sectionMarkup] = await Promise.all([_.getCart(), _.getCartSection()]);
		return _.#withSectionMarkup(cartData, sectionMarkup);
	}

	/**
	 * Hang rendered section markup on a cart object, the same shape Shopify
	 * returns from a mutation with `sections` in the body
	 * @private
	 */
	#withSectionMarkup(cartData, sectionMarkup) {
		const sectionId = this.section;
		if (!cartData || cartData.error || !sectionId || !sectionMarkup) return cartData;

		return {
			...cartData,
			sections: { ...(cartData.sections || {}), [sectionId]: sectionMarkup },
		};
	}

	/**
	 * Whether a line still has a mutation of its own in flight or queued
	 * @private
	 */
	#hasLiveMutation(key) {
		const entry = this.#lineRequests.get(key);
		return Boolean(entry && (entry.inFlight || entry.pending !== null));
	}

	/**
	 * The cart-item elements currently in the container, ignoring any that are
	 * mid-destroy. A collapsing element is already gone as far as the cart is
	 * concerned, and counting it would stop the same key from animating back in -
	 * which is exactly what a failed optimistic removal has to do.
	 * @private
	 */
	#getLiveCartItems(itemsContainer) {
		return Array.from(itemsContainer.querySelectorAll('cart-item')).filter(
			(item) => item.getAttribute('state') !== 'destroying'
		);
	}

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

		const pricedItems = cartData.items.filter(
			(item) => !item.properties?._ignore_price_in_subtotal
		);
		const calculated_subtotal = pricedItems.reduce(
			(total, item) => total + (item.line_price || 0),
			0
		);

		return { ...cartData, calculated_count, calculated_subtotal };
	}
}

// =============================================================================
// Register Custom Elements
// =============================================================================

if (!customElements.get('cart-panel')) {
	customElements.define('cart-panel', CartPanel);
}

export { CartPanel };
export default CartPanel;
