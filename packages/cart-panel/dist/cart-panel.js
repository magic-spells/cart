(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
  typeof define === 'function' && define.amd ? define(['exports'], factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.CartDialog = {}));
})(this, (function (exports) { 'use strict';

  class QuantityModifier extends HTMLElement {
    // Static flag to track if styles have been injected
    static #stylesInjected = false;

    constructor() {
      super();
      this.handleDecrement = this.handleDecrement.bind(this);
      this.handleIncrement = this.handleIncrement.bind(this);
      this.handleInputChange = this.handleInputChange.bind(this);

      // Inject styles once when first component is created
      QuantityModifier.#injectStyles();
    }

    /**
     * Inject global styles for hiding number input spin buttons
     * Only runs once regardless of how many components exist
     */
    static #injectStyles() {
      if (QuantityModifier.#stylesInjected) return;

      // this will hide the arrow buttons in the number input field
      const style = document.createElement('style');
      style.textContent = `
      /* Hide number input spin buttons for quantity-modifier */
      quantity-modifier input::-webkit-outer-spin-button,
      quantity-modifier input::-webkit-inner-spin-button {
        -webkit-appearance: none;
        margin: 0;
      }
      
      quantity-modifier input[type="number"] {
        -moz-appearance: textfield;
      }
    `;

      document.head.appendChild(style);
      QuantityModifier.#stylesInjected = true;
    }

    // Define which attributes trigger attributeChangedCallback when modified
    static get observedAttributes() {
      return ['min', 'max', 'value'];
    }

    // Called when element is added to the DOM
    connectedCallback() {
      this.render();
      this.attachEventListeners();
    }

    // Called when element is removed from the DOM
    disconnectedCallback() {
      this.removeEventListeners();
    }

    // Called when observed attributes change
    attributeChangedCallback(name, oldValue, newValue) {
      if (oldValue !== newValue) {
        this.updateInput();
      }
    }

    // Get minimum value allowed, defaults to 1
    get min() {
      return parseInt(this.getAttribute('min')) || 1;
    }

    // Get maximum value allowed, defaults to 99
    get max() {
      return parseInt(this.getAttribute('max')) || 99;
    }

    // Get current value, defaults to 1
    get value() {
      return parseInt(this.getAttribute('value')) || 1;
    }

    // Set current value by updating the attribute
    set value(val) {
      this.setAttribute('value', val);
    }

    // Render the quantity modifier HTML structure
    render() {
      const min = this.min;
      const max = this.max;
      const value = this.value;

      // check to see if these fields already exist
      const existingDecrement = this.querySelector('[data-action-decrement]');
      const existingIncrement = this.querySelector('[data-action-increment]');
      const existingInput = this.querySelector('[data-quantity-modifier-field]');

      // if they already exist, just set the values
      if (existingDecrement && existingIncrement && existingInput) {
        existingInput.value = value;
        existingInput.min = min;
        existingInput.max = max;
        existingInput.type = 'number';
      } else {
        // if they don't exist, inject the template
        this.innerHTML = `
        <button data-action-decrement type="button">
          <svg class="svg-decrement" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <title>decrement</title>
            <path fill="currentColor" d="M368 224H16c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h352c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16z"></path>
          </svg>
        </button>
        <input 
          type="number" 
          inputmode="numeric" 
          pattern="[0-9]*" 
          data-quantity-modifier-field 
          value="${value}" min="${min}" max="${max}">
        <button data-action-increment type="button">
          <svg class="svg-increment" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512">
            <title>increment</title>
            <path fill="currentColor" d="M368 224H224V80c0-8.84-7.16-16-16-16h-32c-8.84 0-16 7.16-16 16v144H16c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h144v144c0 8.84 7.16 16 16 16h32c8.84 0 16-7.16 16-16V288h144c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16z"></path>
          </svg>
        </button>
      `;
      }
    }

    // Attach click and input event listeners to buttons and input field
    attachEventListeners() {
      const decrementBtn = this.querySelector('[data-action-decrement]');
      const incrementBtn = this.querySelector('[data-action-increment]');
      const input = this.querySelector('[data-quantity-modifier-field]');

      if (decrementBtn) decrementBtn.addEventListener('click', this.handleDecrement);
      if (incrementBtn) incrementBtn.addEventListener('click', this.handleIncrement);
      if (input) input.addEventListener('input', this.handleInputChange);
    }

    // Remove event listeners to prevent memory leaks
    removeEventListeners() {
      const decrementBtn = this.querySelector('[data-action-decrement]');
      const incrementBtn = this.querySelector('[data-action-increment]');
      const input = this.querySelector('[data-quantity-modifier-field]');

      if (decrementBtn) decrementBtn.removeEventListener('click', this.handleDecrement);
      if (incrementBtn) incrementBtn.removeEventListener('click', this.handleIncrement);
      if (input) input.removeEventListener('input', this.handleInputChange);
    }

    // Handle decrement button click, respects minimum value
    handleDecrement() {
      const currentValue = this.value;
      const newValue = Math.max(currentValue - 1, this.min);
      this.updateValue(newValue);
    }

    // Handle increment button click, respects maximum value
    handleIncrement() {
      const currentValue = this.value;
      const newValue = Math.min(currentValue + 1, this.max);
      this.updateValue(newValue);
    }

    // Handle direct input changes, clamps value between min and max
    handleInputChange(event) {
      const inputValue = parseInt(event.target.value);
      if (!isNaN(inputValue)) {
        const clampedValue = Math.max(this.min, Math.min(inputValue, this.max));
        this.updateValue(clampedValue);
      }
    }

    // Update the component value and dispatch change event if value changed
    updateValue(newValue) {
      if (newValue !== this.value) {
        this.value = newValue;
        this.updateInput();
        this.dispatchChangeEvent(newValue);
      }
    }

    // Sync the input field with current component state
    updateInput() {
      const input = this.querySelector('[data-quantity-modifier-field]');
      if (input) {
        input.value = this.value;
        input.min = this.min;
        input.max = this.max;
      }
    }

    // Dispatch custom event when value changes for external listeners
    dispatchChangeEvent(value) {
      this.dispatchEvent(
        new CustomEvent('quantity-modifier:change', {
          detail: { value },
          bubbles: true,
        })
      );
    }
  }

  customElements.define('quantity-modifier', QuantityModifier);

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
  		// If we have item data, render it first
  		if (this.#itemData) {
  			this.#render();
  		}

  		// Find child elements
  		this.content = this.querySelector('cart-item-content');
  		this.processing = this.querySelector('cart-item-processing');

  		// Update line price elements in case of pre-rendered content
  		this.#updateLinePriceElements();

  		// Attach event listeners
  		this.#attachListeners();

  		// If we started with 'appearing' state, handle the entry animation
  		if (this.#currentState === 'appearing') {
  			// Set the state attribute
  			this.setAttribute('state', 'appearing');
  			this.#isAppearing = true;

  			// Get the natural height after rendering
  			requestAnimationFrame(() => {
  				const naturalHeight = this.scrollHeight;

  				// Set explicit height for animation
  				this.style.height = `${naturalHeight}px`;

  				// Transition to ready state after a brief delay
  				requestAnimationFrame(() => {
  					this.setState('ready');
  				});
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
  		this.addEventListener('quantity-modifier:change', this.#handlers.change);
  		this.addEventListener('transitionend', this.#handlers.transitionEnd);
  	}

  	/**
  	 * Detach event listeners
  	 */
  	#detachListeners() {
  		this.removeEventListener('click', this.#handlers.click);
  		this.removeEventListener('change', this.#handlers.change);
  		this.removeEventListener('quantity-modifier:change', this.#handlers.change);
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
  	 * Handle change events (for quantity inputs and quantity-modifier)
  	 */
  	#handleChange(e) {
  		// Check if event is from quantity-modifier component
  		if (e.type === 'quantity-modifier:change') {
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
  		if (!this.#itemData || CartItem.#templates.size === 0) {
  			console.log('no item data or no template', this.#itemData, CartItem.#templates);
  			return;
  		}

  		// Set the key attribute from item data
  		const key = this.#itemData.key || this.#itemData.id;
  		if (key) {
  			this.setAttribute('key', key);
  		}

  		// Determine which template to use
  		const templateName = this.#itemData.properties?._cartTemplate || 'default';
  		const templateFn = CartItem.#templates.get(templateName) || CartItem.#templates.get('default');

  		if (!templateFn) {
  			console.warn(`Cart item template '${templateName}' not found and no default template set`);
  			return;
  		}

  		// Generate HTML from template with both item and cart data
  		const templateHTML = templateFn(this.#itemData, this.#cartData);

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
  	 * @param {Object} cartData - Full Shopify cart object
  	 */
  	setData(itemData, cartData = null) {
  		this.#itemData = itemData;
  		if (cartData) {
  			this.#cartData = cartData;
  		}
  		this.#render();

  		// Re-find child elements after re-rendering
  		this.content = this.querySelector('cart-item-content');
  		this.processing = this.querySelector('cart-item-processing');

  		// Update line price elements
  		this.#updateLinePriceElements();
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
  			// this.offsetHeight; // force a reflow so the browser registers the fixed height

  			// read the css custom property for timing, defaulting to 400ms
  			const elementStyle = getComputedStyle(this);
  			const destroyDuration =
  				elementStyle.getPropertyValue('--cart-item-destroying-duration')?.trim() || '400ms';

  			// animate only the height to zero; other properties stay under stylesheet control
  			this.style.transition = `height ${destroyDuration} ease`;
  			this.style.height = '0px';

  			// setTimeout(() => {
  			// 	this.style.height = '0px';
  			// }, 1);

  			setTimeout(() => {
  				// make sure item is removed
  				this.remove();
  			}, 600);
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
  		const lastElement =
  			focusableElements[focusableElements.length - 1];

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

  if (!customElements.get('focus-trap')) {
  	customElements.define('focus-trap', FocusTrap);
  }
  if (!customElements.get('focus-trap-start')) {
  	customElements.define('focus-trap-start', FocusTrapStart);
  }
  if (!customElements.get('focus-trap-end')) {
  	customElements.define('focus-trap-end', FocusTrapEnd);
  }

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

  			// Setup the trap - this will add focus-trap-start/end elements around the content
  			// We don't need this anymore because we restructured the code
  			// _.focusTrap.setupTrap();
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
  				const cartItem = CartItem.createAnimated(itemData);
  				const targetIndex = newKeys.indexOf(itemData.key || itemData.id);

  				// Find the correct position to insert the new item
  				if (targetIndex === 0) {
  					// Insert at the beginning
  					itemsContainer.insertBefore(cartItem, itemsContainer.firstChild);
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
  						insertAfter.insertAdjacentElement('afterend', cartItem);
  					} else {
  						itemsContainer.appendChild(cartItem);
  					}
  				}
  			});
  		}, 100);
  	}

  	/**
  	 * Filter cart items to exclude those with _hidden property
  	 * @private
  	 */
  	#getVisibleCartItems(cartData) {
  		if (!cartData || !cartData.items) return [];
  		return cartData.items.filter((item) => {
  			// Check for _hidden in various possible locations
  			const hidden =
  				(item.properties && item.properties._hidden) ||
  				(item.properties && item.properties['_hidden']) ||
  				item._hidden;

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
  				const cartItem = new CartItem(itemData); // No animation
  				// const cartItem = document.createElement('cart-item');
  				// cartItem.setData(itemData);
  				itemsContainer.appendChild(cartItem);
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
  		CartItem.setTemplate(templateName, templateFn);
  	}

  	/**
  	 * Set the processing template function for cart items
  	 * @param {Function} templateFn - Function that returns HTML string for processing state
  	 */
  	setCartItemProcessingTemplate(templateFn) {
  		CartItem.setProcessingTemplate(templateFn);
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
  	window.CartItem = CartItem;
  }

  exports.CartDialog = CartDialog;
  exports.CartItem = CartItem;
  exports.CartOverlay = CartOverlay;
  exports.CartPanel = CartPanel;
  exports.default = CartDialog;

  Object.defineProperty(exports, '__esModule', { value: true });

}));
//# sourceMappingURL=cart-panel.js.map
