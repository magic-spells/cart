import EventEmitter from "@magic-spells/event-emitter";
//#region src/cart-item.js
var FOCUSABLE_SELECTORS = [
	"[data-cart-quantity]",
	"quantity-input input",
	"quantity-modifier input",
	"[data-action-remove-item]"
];
/**
* CartItem class that handles the functionality of a cart item component
*/
var CartItem = class CartItem extends HTMLElement {
	static #templates = /* @__PURE__ */ new Map();
	static #processingTemplate = null;
	#currentState = "ready";
	#isDestroying = false;
	#isAppearing = false;
	#handlers = {};
	#itemData = null;
	#cartData = null;
	#lastRenderedHTML = "";
	#lastKnownQuantity = null;
	#hasServerContent = false;
	/**
	* Set the template function for rendering cart items
	* @param {string} name - Template name ('default' for default template)
	* @param {Function} templateFn - Function that takes (itemData, cartData) and returns HTML string
	*/
	static setTemplate(name, templateFn) {
		if (typeof name !== "string") throw new Error("Template name must be a string");
		if (typeof templateFn !== "function") throw new Error("Template must be a function");
		CartItem.#templates.set(name, templateFn);
	}
	/**
	* Set the processing template function for rendering processing overlay
	* @param {Function} templateFn - Function that returns HTML string for processing state
	*/
	static setProcessingTemplate(templateFn) {
		if (typeof templateFn !== "function") throw new Error("Processing template must be a function");
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
		return ["state", "key"];
	}
	/**
	* Called when observed attributes change
	*/
	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;
		if (name === "state") this.#currentState = newValue || "ready";
	}
	constructor(itemData = null, cartData = null, options = {}) {
		super();
		this.#itemData = itemData;
		this.#cartData = cartData;
		const shouldAnimate = options.animate || this.hasAttribute("animate-in");
		this.#currentState = itemData && shouldAnimate ? "appearing" : this.getAttribute("state") || "ready";
		this.#handlers = {
			click: this.#handleClick.bind(this),
			change: this.#handleChange.bind(this),
			keydown: this.#handleKeydown.bind(this),
			transitionEnd: this.#handleTransitionEnd.bind(this)
		};
	}
	connectedCallback() {
		const _ = this;
		if (_.#itemData && !_.#hasServerContent) _.#render();
		_.#queryDOM();
		if (!_.#hasServerContent) _.#updateLinePriceElements();
		_.#syncLastKnownQuantity();
		_.#attachListeners();
		if (_.#currentState === "appearing") {
			_.setAttribute("state", "appearing");
			_.#isAppearing = true;
			requestAnimationFrame(() => {
				_.style.height = `${_.scrollHeight}px`;
				requestAnimationFrame(() => _.setState("ready"));
			});
		}
	}
	disconnectedCallback() {
		this.#detachListeners();
	}
	/**
	* Query and cache DOM elements
	*/
	#queryDOM() {
		this.content = this.querySelector("cart-item-content");
		this.processing = this.querySelector("cart-item-processing");
	}
	/**
	* Attach event listeners
	*/
	#attachListeners() {
		const _ = this;
		_.addEventListener("click", _.#handlers.click);
		_.addEventListener("change", _.#handlers.change);
		_.addEventListener("keydown", _.#handlers.keydown);
		_.addEventListener("quantity-input:change", _.#handlers.change);
		_.addEventListener("quantity-modifier:change", _.#handlers.change);
		_.addEventListener("transitionend", _.#handlers.transitionEnd);
	}
	/**
	* Detach event listeners
	*/
	#detachListeners() {
		const _ = this;
		_.removeEventListener("click", _.#handlers.click);
		_.removeEventListener("change", _.#handlers.change);
		_.removeEventListener("keydown", _.#handlers.keydown);
		_.removeEventListener("quantity-input:change", _.#handlers.change);
		_.removeEventListener("quantity-modifier:change", _.#handlers.change);
		_.removeEventListener("transitionend", _.#handlers.transitionEnd);
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
		return this.getAttribute("key");
	}
	/**
	* Handle click events (for Remove buttons, etc.)
	*/
	#handleClick(e) {
		if (e.target.closest("[data-action-remove-item]")) {
			e.preventDefault();
			this.#emitRemoveEvent();
		}
	}
	/**
	* Handle change events (for quantity inputs, quantity-input and quantity-modifier)
	*/
	#handleChange(e) {
		if (e.type === "quantity-input:change" || e.type === "quantity-modifier:change") {
			this.#emitQuantityChangeEvent(e.detail.value);
			return;
		}
		const quantityInput = e.target.closest("[data-cart-quantity]");
		if (quantityInput && !quantityInput.closest("quantity-input, quantity-modifier")) this.#commitQuantityInput(quantityInput);
	}
	/**
	* Handle Enter inside a bare quantity input.
	*
	* A quantity field inside a <form> submits the page on Enter, and a field
	* outside one commits nothing at all until it loses focus - both read as the
	* cart ignoring you. Enter commits the typed value through the same path a
	* change event takes.
	*
	* An input owned by <quantity-input> or <quantity-modifier> is different:
	* the component owns the commit. Enter still must not submit the form, so
	* the submission is stopped here, but the value is left to the component's
	* own change flow. A component version that handles Enter itself arrives
	* here already defaultPrevented and is not touched at all - no double event.
	*/
	#handleKeydown(e) {
		if (e.key !== "Enter" || e.isComposing || e.defaultPrevented) return;
		const input = e.target.closest?.("input");
		if (!input) return;
		if (input.closest("quantity-input, quantity-modifier")) {
			e.preventDefault();
			return;
		}
		const quantityInput = input.closest("[data-cart-quantity]");
		if (!quantityInput) return;
		e.preventDefault();
		this.#commitQuantityInput(quantityInput);
	}
	/**
	* Commit a quantity input's current value: clamp it, write the clamped value
	* back into the field, and emit only when the quantity actually changed
	* @param {HTMLInputElement} quantityInput - The [data-cart-quantity] field
	* @private
	*/
	#commitQuantityInput(quantityInput) {
		const clamped = this.#clampQuantity(quantityInput);
		if (clamped === null) {
			if (this.#lastKnownQuantity !== null) quantityInput.value = this.#lastKnownQuantity;
			return;
		}
		if (String(clamped) !== String(quantityInput.value)) quantityInput.value = clamped;
		if (this.#lastKnownQuantity !== null && clamped === this.#lastKnownQuantity) return;
		this.#emitQuantityChangeEvent(clamped);
	}
	/**
	* Clamp an input's value to its own min/max attributes
	* @param {HTMLInputElement} quantityInput - The [data-cart-quantity] field
	* @returns {number|null} Clamped quantity, or null if the value is not a number
	* @private
	*/
	#clampQuantity(quantityInput) {
		const parsed = parseInt(quantityInput.value, 10);
		if (Number.isNaN(parsed)) return null;
		const min = parseInt(quantityInput.getAttribute("min"), 10);
		const max = parseInt(quantityInput.getAttribute("max"), 10);
		let clamped = Math.max(Number.isNaN(min) ? 0 : min, parsed);
		if (!Number.isNaN(max)) clamped = Math.min(max, clamped);
		return clamped;
	}
	/**
	* Handle transition end events for destroy animation and appearing animation
	*/
	#handleTransitionEnd(e) {
		if (e.propertyName === "height" && this.#isDestroying) this.remove();
		else if (e.propertyName === "height" && this.#isAppearing) {
			this.style.height = "";
			this.#isAppearing = false;
		}
	}
	/**
	* Emit remove event
	*/
	#emitRemoveEvent() {
		this.dispatchEvent(new CustomEvent("cart-item:remove", {
			bubbles: true,
			detail: {
				cartKey: this.cartKey,
				element: this
			}
		}));
	}
	/**
	* Emit quantity change event
	*/
	#emitQuantityChangeEvent(quantity) {
		const parsed = parseInt(quantity, 10);
		if (!Number.isNaN(parsed)) this.#lastKnownQuantity = parsed;
		this.dispatchEvent(new CustomEvent("cart-item:quantity-change", {
			bubbles: true,
			detail: {
				cartKey: this.cartKey,
				quantity: parseInt(quantity),
				element: this
			}
		}));
	}
	/**
	* Render cart item from data using the appropriate template
	*/
	#render() {
		const _ = this;
		if (!_.#itemData || CartItem.#templates.size === 0) return;
		const key = _.#itemData.key || _.#itemData.id;
		if (key) _.setAttribute("key", key);
		const templateHTML = _.#generateTemplateHTML();
		_.#lastRenderedHTML = templateHTML;
		_.innerHTML = `
			<cart-item-content>
				${templateHTML}
			</cart-item-content>
			<cart-item-processing>
				${CartItem.#processingTemplate ? CartItem.#processingTemplate() : "<div class=\"cart-item-loader\"></div>"}
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
		_.#itemData = itemData;
		if (cartData) _.#cartData = cartData;
		_.#syncLastKnownQuantity();
		if (_.#generateTemplateHTML() === _.#lastRenderedHTML) {
			_.setState("ready");
			_.#updateQuantityInput();
			return;
		}
		const focusState = _.#captureFocus();
		_.setState("ready");
		_.#render();
		_.#queryDOM();
		_.#updateLinePriceElements();
		_.#restoreFocus(focusState);
	}
	/**
	* Refresh the remembered quantity from item data, falling back to whatever
	* the rendered quantity field says - server-rendered items carry no JSON
	* @private
	*/
	#syncLastKnownQuantity() {
		const quantity = this.#itemData?.quantity;
		if (typeof quantity === "number" && !this.#hasServerContent) {
			this.#lastKnownQuantity = quantity;
			return;
		}
		const quantityInput = this.querySelector("[data-cart-quantity]");
		const parsed = parseInt(quantityInput?.value ?? quantityInput?.getAttribute?.("value"), 10);
		if (!Number.isNaN(parsed)) this.#lastKnownQuantity = parsed;
		else if (typeof quantity === "number") this.#lastKnownQuantity = quantity;
	}
	/**
	* Replace this item's content with server-rendered markup.
	*
	* Section mode calls this: Shopify renders the line, this component renders
	* the behaviour. The element itself is never replaced, so its identity, its
	* state attribute and any animation already running survive the swap - and
	* focus with its caret position goes back where it was, so a swap cannot
	* interrupt someone typing a quantity.
	*
	* @param {string} html - Inner markup of a <cart-item>, with or without a
	*   <cart-item-content> wrapper. Any <cart-item-processing> in it is dropped:
	*   the overlay stays JS-owned in both render modes, so states behave the same.
	*/
	setContent(html) {
		const _ = this;
		const focusState = _.#captureFocus();
		const holder = document.createElement("div");
		holder.innerHTML = html ?? "";
		holder.querySelectorAll("cart-item-processing").forEach((node) => node.remove());
		const serverContent = holder.querySelector("cart-item-content");
		const contentHTML = serverContent ? serverContent.outerHTML : `<cart-item-content>${holder.innerHTML}</cart-item-content>`;
		const processingHTML = CartItem.#processingTemplate ? CartItem.#processingTemplate() : "<div class=\"cart-item-loader\"></div>";
		_.#hasServerContent = true;
		_.innerHTML = `${contentHTML}<cart-item-processing>${processingHTML}</cart-item-processing>`;
		if (_.#currentState === "processing") _.setState("ready");
		_.#queryDOM();
		_.#syncLastKnownQuantity();
		_.#restoreFocus(focusState);
	}
	/**
	* Apply fresh cart JSON to already-rendered markup without redrawing it.
	*
	* This is the "numbers now, markup later" path an optimistic update takes in
	* section mode: the line price and quantity field move at once, and the
	* server's own markup replaces them when it arrives.
	*
	* @param {Object} itemData - Shopify cart item data
	* @param {Object} [cartData=null] - Full Shopify cart object
	*/
	applyItemData(itemData, cartData = null) {
		const _ = this;
		if (!itemData) return;
		_.#itemData = itemData;
		if (cartData) _.#cartData = cartData;
		_.#updateLinePriceElements();
		_.#updateQuantityInput();
		const quantityInput = _.querySelector("[data-cart-quantity]");
		if (quantityInput && "value" in quantityInput && String(quantityInput.value) !== String(itemData.quantity)) quantityInput.value = itemData.quantity;
		if (typeof itemData.quantity === "number") _.#lastKnownQuantity = itemData.quantity;
	}
	/**
	* Note what has focus inside this item, and where the caret sits
	* @returns {Object|null} Focus state to hand to #restoreFocus, or null
	* @private
	*/
	#captureFocus() {
		const active = document.activeElement;
		if (!active || !this.contains(active) || typeof active.closest !== "function") return null;
		const selector = FOCUSABLE_SELECTORS.find((candidate) => active.closest(candidate));
		if (!selector) return null;
		const focusState = {
			selector,
			selectionStart: null,
			selectionEnd: null
		};
		try {
			focusState.selectionStart = active.selectionStart;
			focusState.selectionEnd = active.selectionEnd;
		} catch {}
		return focusState;
	}
	/**
	* Put focus and caret back after a content swap
	* @param {Object|null} focusState - What #captureFocus returned
	* @private
	*/
	#restoreFocus(focusState) {
		if (!focusState) return;
		const target = this.querySelector(focusState.selector);
		if (!target || typeof target.focus !== "function") return;
		target.focus({ preventScroll: true });
		if (focusState.selectionStart == null) return;
		try {
			target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
		} catch {}
	}
	/**
	* Generate HTML from the current template with current data
	* @returns {string} Generated HTML string or empty string if no template
	* @private
	*/
	#generateTemplateHTML() {
		if (!this.#itemData || CartItem.#templates.size === 0) return "";
		const templateName = this.#itemData.properties?._cart_template || "default";
		const templateFn = CartItem.#templates.get(templateName) || CartItem.#templates.get("default");
		if (!templateFn) return "";
		return templateFn(this.#itemData, this.#cartData);
	}
	/**
	* Update the quantity component to match server data
	* @private
	*/
	#updateQuantityInput() {
		if (!this.#itemData) return;
		const quantityElement = this.querySelector("quantity-input, quantity-modifier");
		if (quantityElement) quantityElement.value = this.#itemData.quantity;
	}
	/**
	* Update elements with data-content-line-price attribute
	* @private
	*/
	#updateLinePriceElements() {
		if (!this.#itemData) return;
		const linePriceElements = this.querySelectorAll("[data-content-line-price]");
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
		if (typeof cents !== "number") return "$0.00";
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
		if ([
			"ready",
			"processing",
			"destroying",
			"appearing"
		].includes(state)) this.setAttribute("state", state);
	}
	/**
	* Gracefully animate this cart item closed, then remove it
	*/
	destroyYourself() {
		const _ = this;
		if (_.#isDestroying) return;
		_.#isDestroying = true;
		const initialHeight = _.offsetHeight;
		_.setState("destroying");
		requestAnimationFrame(() => {
			_.style.height = `${initialHeight}px`;
			const destroyDuration = getComputedStyle(_).getPropertyValue("--cart-item-destroying-duration")?.trim() || "600ms";
			_.style.transition = `height ${destroyDuration} ease`;
			_.style.height = "0px";
			const durationMs = parseFloat(destroyDuration) * (/ms$/.test(destroyDuration) ? 1 : 1e3);
			setTimeout(() => _.remove(), (Number.isNaN(durationMs) ? 600 : durationMs) + 100);
		});
	}
};
/**
* Supporting component classes for cart item
*/
var CartItemContent = class extends HTMLElement {
	constructor() {
		super();
	}
};
var CartItemProcessing = class extends HTMLElement {
	constructor() {
		super();
	}
};
if (!customElements.get("cart-item")) customElements.define("cart-item", CartItem);
if (!customElements.get("cart-item-content")) customElements.define("cart-item-content", CartItemContent);
if (!customElements.get("cart-item-processing")) customElements.define("cart-item-processing", CartItemProcessing);
if (typeof window !== "undefined") window.CartItem = CartItem;
//#endregion
//#region src/cart-panel.js
var CART_ITEM_TAG = "cart-item";
var hasWarnedAboutMissingCartItemOnRender = false;
var warnedMissingTemplateMethods = /* @__PURE__ */ new Set();
var pendingCartItemTemplateCalls = [];
var isPendingTemplateFlushScheduled = false;
var hasWarnedAboutTemplateInSectionMode = false;
var hasWarnedAboutMissingSetContent = false;
/**
* Resolve the registered <cart-item> constructor for rendering, warning once if it is missing
* @returns {Function|null} Registered cart-item constructor, or null
*/
function resolveCartItemElement() {
	const CartItemElement = customElements.get(CART_ITEM_TAG);
	if (CartItemElement) return CartItemElement;
	if (!hasWarnedAboutMissingCartItemOnRender) {
		hasWarnedAboutMissingCartItemOnRender = true;
		console.warn("cart-panel: no <cart-item> element is registered, so cart items cannot be rendered. Import '@magic-spells/cart-panel' for both elements, or '@magic-spells/cart-panel/cart-item' on its own, or register your own with customElements.define('cart-item', ...).");
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
	if (typeof CartItemElement[methodName] !== "function") {
		if (!warnedMissingTemplateMethods.has(methodName)) {
			warnedMissingTemplateMethods.add(methodName);
			console.warn(`cart-panel: the registered <cart-item> element has no static ${methodName}() method, so the template was ignored. Replacement elements must implement static setTemplate(name, fn), static setProcessingTemplate(fn), and static createAnimated(itemData, cartData).`);
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
	pendingCartItemTemplateCalls.splice(0).forEach(({ methodName, args }) => {
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
	pendingCartItemTemplateCalls.push({
		methodName,
		args
	});
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
	console.warn("cart-panel: a cart item template was set while the `section` attribute is present. Section mode renders line items from the Shopify section, so the template is ignored. Pick one source of truth: drop the `section` attribute, or drop the template.");
}
/**
* Warn once when the registered <cart-item> cannot take server-rendered markup
*/
function warnAboutMissingSetContent() {
	if (hasWarnedAboutMissingSetContent) return;
	hasWarnedAboutMissingSetContent = true;
	console.warn("cart-panel: the registered <cart-item> element has no setContent() method, so server-rendered markup cannot be applied. Elements used with the `section` attribute must implement setContent(html).");
}
/**
* Shopping cart panel web component for Shopify.
* Manages cart data and AJAX requests, delegates modal behavior to dialog-panel.
* @extends HTMLElement
*/
var CartPanel = class extends HTMLElement {
	#currentCart = null;
	#eventEmitter;
	#isInitialRender = true;
	#hasRenderedCartItems = false;
	#isAwaitingCartItemDefinition = false;
	#hasConnected = false;
	#hiddenCountElements = /* @__PURE__ */ new WeakSet();
	#lineRequests = /* @__PURE__ */ new Map();
	constructor() {
		super();
		this.#eventEmitter = new EventEmitter();
	}
	/**
	* Attributes the panel reacts to after it is connected
	*/
	static get observedAttributes() {
		return ["section", "hide-count-when-empty"];
	}
	/**
	* React to a live attribute change. Switching render mode starts the item
	* list over: the two modes build their elements differently, so nothing is
	* worth carrying across.
	*/
	attributeChangedCallback(name, oldValue, newValue) {
		const _ = this;
		if (oldValue === newValue) return;
		if (!_.#hasConnected || !_.isConnected) return;
		if (name === "hide-count-when-empty") {
			_.#renderCartCount(_.#currentCart);
			return;
		}
		if (name !== "section") return;
		const itemsContainer = _.querySelector("[data-content-cart-items]");
		if (itemsContainer) itemsContainer.innerHTML = "";
		_.#isInitialRender = true;
		_.#hasRenderedCartItems = false;
		_.refreshCart();
	}
	connectedCallback() {
		this.#hasConnected = true;
		this.#attachListeners();
		if (!this.hasAttribute("manual")) this.refreshCart();
	}
	disconnectedCallback() {}
	/**
	* Whether quantity changes and removals are applied locally before the
	* server answers
	* @returns {boolean}
	*/
	get optimistic() {
		return this.hasAttribute("optimistic");
	}
	/**
	* @param {boolean} value - Turn optimistic updates on or off
	*/
	set optimistic(value) {
		if (value) this.setAttribute("optimistic", "");
		else this.removeAttribute("optimistic");
	}
	/**
	* Whether [data-content-cart-count] elements are hidden while the cart is
	* empty, page-wide
	* @returns {boolean}
	*/
	get hideCountWhenEmpty() {
		return this.hasAttribute("hide-count-when-empty");
	}
	/**
	* @param {boolean} value - Hide the count elements at zero, or leave them
	*/
	set hideCountWhenEmpty(value) {
		if (value) this.setAttribute("hide-count-when-empty", "");
		else this.removeAttribute("hide-count-when-empty");
	}
	/**
	* The Shopify section id that renders the line items, or null for JS templates
	* @returns {string|null}
	*/
	get section() {
		return this.getAttribute("section");
	}
	/**
	* @param {string|null} value - Section id to render from, falsy for JS templates
	*/
	set section(value) {
		if (value) this.setAttribute("section", value);
		else this.removeAttribute("section");
	}
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
			_.#emit("cart-panel:show", { triggerElement: triggerEl });
		} else console.warn("cart-panel: No dialog-panel ancestor found. Cart panel is visible but not in a modal.");
	}
	/**
	* Hide the cart by finding and closing the nearest dialog-panel ancestor
	*/
	hide() {
		const dialogPanel = this.#findDialogPanel();
		if (dialogPanel) {
			dialogPanel.hide();
			this.#emit("cart-panel:hide", {});
		}
	}
	/**
	* Fetch current cart data from Shopify
	* @returns {Promise<Object>} Cart data object
	*/
	getCart() {
		return fetch("/cart.json", { credentials: "same-origin" }).then((response) => {
			if (!response.ok) throw Error(response.statusText);
			return response.json();
		}).catch((error) => {
			console.error("Error fetching cart:", error);
			return {
				error: true,
				message: error.message
			};
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
		return fetch(`/?sections=${encodeURIComponent(sectionId)}`, { credentials: "same-origin" }).then((response) => {
			if (!response.ok) throw Error(response.statusText);
			return response.json();
		}).then((sections) => sections?.[sectionId] ?? null).catch((error) => {
			console.error("Error fetching cart section:", error);
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
		const requestBody = {
			id: key,
			quantity
		};
		const sectionId = this.section;
		if (sectionId) requestBody.sections = sectionId;
		return fetch("/cart/change.json", {
			method: "POST",
			credentials: "same-origin",
			body: JSON.stringify(requestBody),
			headers: { "Content-Type": "application/json" }
		}).then((response) => {
			if (!response.ok) throw Error(response.statusText);
			return response.json();
		}).catch((error) => {
			console.error("Error updating cart item:", error);
			return {
				error: true,
				message: error.message
			};
		});
	}
	/**
	* Refresh cart display - fetches from server if no cart object provided
	* @param {Object} [cartObj=null] - Cart data object to render, or null to fetch
	* @returns {Promise<Object>} Cart data object
	*/
	async refreshCart(cartObj = null) {
		const _ = this;
		cartObj = cartObj || await _.#fetchCartState();
		if (!cartObj || cartObj.error) {
			console.warn("Cart data has error or is null:", cartObj);
			return cartObj;
		}
		if (_.section && !cartObj.sections?.[_.section]) cartObj = _.#withSectionMarkup(cartObj, await _.getCartSection());
		cartObj = _.#preserveInFlightLines(cartObj);
		_.#currentCart = cartObj;
		_.#renderCartItems(cartObj);
		_.#renderCartPanel(cartObj);
		const cartWithCalculatedFields = _.#addCalculatedFields(cartObj);
		_.#emit("cart-panel:refreshed", { cart: cartWithCalculatedFields });
		_.#emit("cart-panel:data-changed", cartWithCalculatedFields);
		return cartObj;
	}
	/**
	* Set the template function for cart items
	* Delegates to the registered <cart-item> element class, buffering the call
	* until the element is registered if it is not defined yet
	* @param {string} templateName - Name of the template
	* @param {Function} templateFn - Function that takes (itemData, cartData) and returns HTML string
	*/
	setCartItemTemplate(templateName, templateFn) {
		if (this.section) warnAboutTemplateInSectionMode();
		callCartItemTemplateMethod("setTemplate", [templateName, templateFn]);
	}
	/**
	* Set the processing template function for cart items
	* Delegates to the registered <cart-item> element class, buffering the call
	* until the element is registered if it is not defined yet
	* @param {Function} templateFn - Function that returns HTML string for processing state
	*/
	setCartItemProcessingTemplate(templateFn) {
		callCartItemTemplateMethod("setProcessingTemplate", [templateFn]);
	}
	/**
	* Find the nearest dialog-panel ancestor
	* @private
	*/
	#findDialogPanel() {
		return this.closest("dialog-panel");
	}
	/**
	* Emit an event via EventEmitter and native CustomEvent
	* @private
	*/
	#emit(eventName, data = null) {
		this.#eventEmitter.emit(eventName, data);
		this.dispatchEvent(new CustomEvent(eventName, {
			detail: data,
			bubbles: true
		}));
	}
	/**
	* Attach event listeners
	* @private
	*/
	#attachListeners() {
		this.addEventListener("click", (e) => {
			if (!e.target.closest("[data-action-hide-cart]")) return;
			this.hide();
		});
		this.addEventListener("cart-item:remove", (e) => {
			this.#handleCartItemRemove(e);
		});
		this.addEventListener("cart-item:quantity-change", (e) => {
			this.#handleCartItemQuantityChange(e);
		});
	}
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
		element.setState("processing");
		_.updateCartItem(cartKey, 0).then((updatedCart) => {
			if (updatedCart && !updatedCart.error) {
				_.#currentCart = updatedCart;
				_.#renderCartItems(updatedCart);
				_.#renderCartPanel(updatedCart);
				const cartWithCalculatedFields = _.#addCalculatedFields(updatedCart);
				_.#emit("cart-panel:updated", { cart: cartWithCalculatedFields });
				_.#emit("cart-panel:data-changed", cartWithCalculatedFields);
			} else {
				element.setState("ready");
				console.error("Failed to remove cart item:", cartKey);
			}
		}).catch((error) => {
			element.setState("ready");
			console.error("Error removing cart item:", error);
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
		element.setState("processing");
		_.updateCartItem(cartKey, quantity).then((updatedCart) => {
			if (updatedCart && !updatedCart.error) {
				_.#currentCart = updatedCart;
				_.#renderCartItems(updatedCart);
				_.#renderCartPanel(updatedCart);
				const cartWithCalculatedFields = _.#addCalculatedFields(updatedCart);
				_.#emit("cart-panel:updated", { cart: cartWithCalculatedFields });
				_.#emit("cart-panel:data-changed", cartWithCalculatedFields);
			} else {
				element.setState("ready");
				console.error("Failed to update cart item quantity:", cartKey, quantity);
			}
		}).catch((error) => {
			element.setState("ready");
			console.error("Error updating cart item quantity:", error);
		});
	}
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
		if (_.#lineRequests.get(key)?.removed && nextQuantity > 0) return;
		if (nextQuantity === 0 && typeof element?.destroyYourself === "function") element.destroyYourself();
		const projectedCart = _.#projectCart(_.#currentCart, key, nextQuantity);
		if (projectedCart) {
			_.#currentCart = projectedCart;
			_.#renderCartItems(projectedCart);
			_.#renderCartPanel(projectedCart);
			const cartWithCalculatedFields = _.#addCalculatedFields(projectedCart);
			_.#emit("cart-panel:updated", { cart: cartWithCalculatedFields });
			_.#emit("cart-panel:data-changed", cartWithCalculatedFields);
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
		if (quantity === 0) items.splice(index, 1);
		else {
			const item = items[index];
			const unitPrice = this.#unitPrice(item);
			const projectedItem = {
				...item,
				quantity,
				line_price: unitPrice * quantity
			};
			if (typeof item.final_line_price === "number") projectedItem.final_line_price = unitPrice * quantity;
			if (typeof item.original_line_price === "number") projectedItem.original_line_price = (typeof item.original_price === "number" ? item.original_price : unitPrice) * quantity;
			items[index] = projectedItem;
		}
		const item_count = items.reduce((total, item) => total + item.quantity, 0);
		const projectedCart = {
			...cartData,
			items,
			item_count
		};
		delete projectedCart.sections;
		return projectedCart;
	}
	/**
	* Work out a line's unit price, falling back to the line total when the cart
	* JSON is thin (a stand-in cart, or an older Shopify payload)
	* @private
	*/
	#unitPrice(item) {
		if (typeof item.final_price === "number") return item.final_price;
		if (typeof item.price === "number") return item.price;
		if (typeof item.line_price === "number" && item.quantity > 0) return Math.round(item.line_price / item.quantity);
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
			entry = {
				seq: 0,
				inFlight: false,
				pending: null,
				removed: false
			};
			_.#lineRequests.set(key, entry);
		}
		if (quantity === 0) entry.removed = true;
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
			response = {
				error: true,
				message: error?.message
			};
		}
		entry.inFlight = false;
		const isStale = seq !== entry.seq;
		if (entry.pending !== null) _.#drainLineMutation(key);
		if (isStale) return;
		if (!response || response.error) await _.#revertToServerTruth(key, response);
		else _.#reconcileWithServerCart(response);
		const settled = _.#lineRequests.get(key);
		if (settled && !settled.inFlight && settled.pending === null && settled.seq === seq) _.#lineRequests.delete(key);
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
		_.#emit("cart-panel:updated", { cart: cartWithCalculatedFields });
		_.#emit("cart-panel:data-changed", cartWithCalculatedFields);
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
		return {
			...serverCart,
			items,
			item_count
		};
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
			return (item.key || item.id) === (other.key || other.id) && item.quantity === other.quantity && (item.line_price || 0) === (other.line_price || 0);
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
			const revertedCart = _.#preserveInFlightLines(serverCart);
			_.#currentCart = revertedCart;
			_.#renderCartItems(revertedCart);
			_.#renderCartPanel(revertedCart);
			_.#emit("cart-panel:data-changed", _.#addCalculatedFields(revertedCart));
		}
		_.#emit("cart-panel:error", {
			key,
			error
		});
	}
	/**
	* Update cart count elements across the page
	* @private
	*/
	#renderCartCount(cartData) {
		const _ = this;
		if (!cartData) return;
		const visibleItemCount = _.#getVisibleCartItems(cartData).reduce((total, item) => total + item.quantity, 0);
		const hideWhenEmpty = _.hideCountWhenEmpty;
		document.querySelectorAll("[data-content-cart-count]").forEach((element) => {
			element.textContent = visibleItemCount;
			if (hideWhenEmpty && visibleItemCount === 0) {
				element.style.display = "none";
				_.#hiddenCountElements.add(element);
				return;
			}
			if (!_.#hiddenCountElements.has(element)) return;
			element.style.removeProperty("display");
			_.#hiddenCountElements.delete(element);
		});
	}
	/**
	* Update cart subtotal elements across the page
	* @private
	*/
	#renderCartSubtotal(cartData) {
		if (!cartData?.items) return;
		const subtotal = cartData.items.filter((item) => {
			return !item.properties?._ignore_price_in_subtotal;
		}).reduce((total, item) => total + (item.line_price || 0), 0);
		document.querySelectorAll("[data-content-cart-subtotal]").forEach((element) => {
			element.textContent = `$${(subtotal / 100).toFixed(2)}`;
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
		const hasVisibleItems = _.#getVisibleCartItems(cartData).length > 0;
		_.setAttribute("state", hasVisibleItems ? "has-items" : "empty");
		const hasItemsSection = _.querySelector("[data-cart-has-items]");
		const emptySection = _.querySelector("[data-cart-is-empty]");
		if (hasItemsSection && emptySection) {
			hasItemsSection.style.display = hasVisibleItems ? "" : "none";
			emptySection.style.display = hasVisibleItems ? "none" : "";
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
		const itemsContainer = _.querySelector("[data-content-cart-items]");
		if (!itemsContainer || !cartData || !cartData.items) return;
		const CartItemElement = resolveCartItemElement();
		if (!CartItemElement) {
			_.#watchForCartItemDefinition();
			return;
		}
		_.#hasRenderedCartItems = true;
		if (_.section) {
			_.#renderCartItemsFromSection(itemsContainer, cartData, CartItemElement);
			return;
		}
		const visibleItems = _.#getVisibleCartItems(cartData);
		if (_.#isInitialRender) {
			itemsContainer.innerHTML = "";
			visibleItems.forEach((itemData) => {
				itemsContainer.appendChild(new CartItemElement(itemData, cartData));
			});
			_.#isInitialRender = false;
			return;
		}
		const currentItems = _.#getLiveCartItems(itemsContainer);
		const currentKeys = new Set(currentItems.map((item) => item.getAttribute("key")));
		const newKeys = visibleItems.map((item) => item.key || item.id);
		const newKeysSet = new Set(newKeys);
		_.#removeItemsFromDOM(itemsContainer, newKeysSet);
		_.#updateItemsInDOM(itemsContainer, cartData);
		const itemsToAdd = visibleItems.filter((itemData) => !currentKeys.has(itemData.key || itemData.id));
		_.#addItemsToDOM({
			itemsContainer,
			itemsToAdd,
			newKeys,
			cartData,
			CartItemElement
		});
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
			flushPendingCartItemTemplates();
			if (_.#hasRenderedCartItems || !_.isConnected || !_.#currentCart) return;
			_.#renderCartItems(_.#currentCart);
		});
	}
	/**
	* Remove items from DOM that are no longer in cart
	* @private
	*/
	#removeItemsFromDOM(itemsContainer, newKeysSet) {
		this.#getLiveCartItems(itemsContainer).filter((item) => !newKeysSet.has(item.getAttribute("key"))).forEach((item) => {
			item.destroyYourself();
		});
	}
	/**
	* Update existing cart-item elements with fresh data
	* @private
	*/
	#updateItemsInDOM(itemsContainer, cartData) {
		const visibleItems = this.#getVisibleCartItems(cartData);
		this.#getLiveCartItems(itemsContainer).forEach((cartItemEl) => {
			const key = cartItemEl.getAttribute("key");
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
				const key = itemData.key || itemData.id;
				const existing = itemsContainer.querySelector(`cart-item[key="${key}"]:not([state='destroying'])`);
				if (existing) {
					existing.setData(itemData, cartData);
					return;
				}
				const cartItem = CartItemElement.createAnimated(itemData, cartData);
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
			const prevItem = itemsContainer.querySelector(`cart-item[key="${orderedKeys[i]}"]:not([state='destroying'])`);
			if (prevItem) {
				insertAfter = prevItem;
				break;
			}
		}
		if (insertAfter) insertAfter.insertAdjacentElement("afterend", cartItem);
		else itemsContainer.appendChild(cartItem);
	}
	/**
	* Diff server-rendered line items into the container, preserving element
	* identity for keys that are already there
	* @private
	*/
	#renderCartItemsFromSection(itemsContainer, cartData, CartItemElement) {
		const _ = this;
		const sectionMarkup = cartData.sections?.[_.section];
		if (!sectionMarkup) {
			_.#syncCartItemsFromData(itemsContainer, cartData);
			return;
		}
		const parsedItems = _.#parseSectionItems(sectionMarkup);
		const orderedKeys = [...parsedItems.keys()];
		if (_.#isInitialRender) {
			itemsContainer.innerHTML = "";
			orderedKeys.forEach((key) => {
				itemsContainer.appendChild(_.#createSectionItem({
					key,
					parsedItems,
					cartData,
					CartItemElement
				}));
			});
			_.#isInitialRender = false;
			return;
		}
		const currentItems = _.#getLiveCartItems(itemsContainer);
		const currentKeys = new Set(currentItems.map((item) => item.getAttribute("key")));
		_.#removeItemsFromDOM(itemsContainer, new Set(orderedKeys));
		currentItems.forEach((cartItemEl) => {
			const parsedItem = parsedItems.get(cartItemEl.getAttribute("key"));
			if (!parsedItem) return;
			if (_.#hasLiveMutation(cartItemEl.getAttribute("key"))) return;
			if (typeof cartItemEl.setContent !== "function") {
				warnAboutMissingSetContent();
				return;
			}
			cartItemEl.setContent(parsedItem.innerHTML);
		});
		const keysToAdd = orderedKeys.filter((key) => !currentKeys.has(key));
		if (keysToAdd.length === 0) return;
		setTimeout(() => {
			keysToAdd.forEach((key) => {
				const existing = itemsContainer.querySelector(`cart-item[key="${key}"]:not([state='destroying'])`);
				if (existing) {
					if (typeof existing.setContent === "function") existing.setContent(parsedItems.get(key).innerHTML);
					else warnAboutMissingSetContent();
					return;
				}
				const cartItem = _.#createSectionItem({
					key,
					parsedItems,
					cartData,
					CartItemElement,
					animate: true
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
		const cartItem = animate && itemData ? CartItemElement.createAnimated(itemData, cartData) : new CartItemElement(itemData, cartData);
		cartItem.setAttribute("key", key);
		if (typeof cartItem.setContent === "function") cartItem.setContent(parsedItems.get(key).innerHTML);
		else warnAboutMissingSetContent();
		return cartItem;
	}
	/**
	* Pull the cart-item nodes out of rendered section markup, keyed
	* @returns {Map<string, Element>} Line key to its parsed element, in order
	* @private
	*/
	#parseSectionItems(sectionMarkup) {
		const parsedDocument = new DOMParser().parseFromString(sectionMarkup, "text/html");
		const root = parsedDocument.getElementById(`shopify-section-${this.section}`) || parsedDocument.body;
		const parsedItems = /* @__PURE__ */ new Map();
		root.querySelectorAll("cart-item[key]").forEach((node) => {
			const key = node.getAttribute("key");
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
			const key = cartItemEl.getAttribute("key");
			const itemData = visibleItems.find((item) => (item.key || item.id) === key);
			if (!itemData || typeof cartItemEl.applyItemData !== "function") return;
			cartItemEl.applyItemData(itemData, cartData);
		});
	}
	/**
	* The single "what does the server say" entry point: used by refreshCart()
	* and by the revert after a failed optimistic mutation
	* @returns {Promise<Object>} Cart data object
	* @private
	*/
	async #fetchCartState() {
		const _ = this;
		if (!_.section) return _.getCart();
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
			sections: {
				...cartData.sections || {},
				[sectionId]: sectionMarkup
			}
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
		return Array.from(itemsContainer.querySelectorAll("cart-item")).filter((item) => item.getAttribute("state") !== "destroying");
	}
	/**
	* Filter cart items to exclude hidden items
	* @private
	*/
	#getVisibleCartItems(cartData) {
		if (!cartData || !cartData.items) return [];
		return cartData.items.filter((item) => {
			return !item.properties?._hide_in_cart;
		});
	}
	/**
	* Add calculated fields to cart object
	* @private
	*/
	#addCalculatedFields(cartData) {
		if (!cartData) return cartData;
		const calculated_count = this.#getVisibleCartItems(cartData).reduce((total, item) => total + item.quantity, 0);
		const calculated_subtotal = cartData.items.filter((item) => !item.properties?._ignore_price_in_subtotal).reduce((total, item) => total + (item.line_price || 0), 0);
		return {
			...cartData,
			calculated_count,
			calculated_subtotal
		};
	}
};
if (!customElements.get("cart-panel")) customElements.define("cart-panel", CartPanel);
//#endregion
export { CartItem, CartItemContent, CartItemProcessing, CartPanel, CartPanel as default };
