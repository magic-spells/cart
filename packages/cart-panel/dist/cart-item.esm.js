//#region src/cart-item.js
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
			transitionEnd: this.#handleTransitionEnd.bind(this)
		};
	}
	connectedCallback() {
		const _ = this;
		if (_.#itemData) _.#render();
		_.#queryDOM();
		_.#updateLinePriceElements();
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
		if (_.#generateTemplateHTML() === _.#lastRenderedHTML) {
			_.setState("ready");
			_.#updateQuantityInput();
			return;
		}
		_.setState("ready");
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
