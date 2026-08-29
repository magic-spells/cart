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
		if (quantityInput) this.#emitQuantityChangeEvent(quantityInput.value);
	}
	/**
	* Handle Enter inside a bare quantity input.
	*
	* A quantity field inside a <form> submits the page on Enter, and a field
	* outside one commits nothing at all until it loses focus - both read as the
	* cart ignoring you. Enter commits the typed value through the same path a
	* change event takes.
	*
	* Skipped entirely when the input belongs to <quantity-input> or
	* <quantity-modifier>: those components own their own commit logic and
	* handle Enter themselves, so acting here would emit the event twice.
	*/
	#handleKeydown(e) {
		if (e.key !== "Enter" || e.isComposing) return;
		const quantityInput = e.target.closest?.("[data-cart-quantity]");
		if (!quantityInput) return;
		if (quantityInput.closest("quantity-input, quantity-modifier")) return;
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
			const destroyDuration = getComputedStyle(_).getPropertyValue("--cart-item-destroying-duration")?.trim() || "400ms";
			_.style.transition = `height ${destroyDuration} ease`;
			_.style.height = "0px";
			setTimeout(() => _.remove(), 600);
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
export { CartItem, CartItem as default, CartItemContent, CartItemProcessing };
