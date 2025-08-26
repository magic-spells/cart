'use strict';

/**
 * ProgressBar helper class for the visual progress bar element
 */
class ProgressBar extends HTMLElement {
	constructor() {
		super();
		this.#setupProgressBar();
	}

	#setupProgressBar() {
		this.setAttribute('role', 'progressbar');
		this.setAttribute('aria-valuemin', '0');
		this.setAttribute('aria-valuemax', '100');
		this.setAttribute('aria-valuenow', '0');

		// Create the visual progress bar
		this.innerHTML = '<div class="progress-bar-fill"></div>';
	}

	setPercent(percent) {
		const clampedPercent = Math.max(0, Math.min(100, percent));
		this.style.setProperty('--cart-progress-percent', `${clampedPercent}%`);
		this.setAttribute('aria-valuenow', clampedPercent);
	}
}

// Define ProgressBar custom element immediately so it's available for CartProgressBar
customElements.define('progress-bar', ProgressBar);

/**
 * CartProgressBar main component
 */
class CartProgressBar extends HTMLElement {
	// Private fields
	#minAmount = 0;
	#currentAmount = 0;
	#progressPercent = 0;
	#originalAboveMessage = '';
	#originalBelowMessage = '';
	#progressBar = null;
	#messageElement = null;

	/**
	 * Define which attributes should be observed for changes
	 */
	static get observedAttributes() {
		return ['threshold', 'current', 'message-above', 'message-below'];
	}

	constructor() {
		super();
		this.#init();
	}

	#init() {
		// Read initial attributes
		this.#minAmount = parseFloat(this.getAttribute('threshold')) || 0;
		this.#currentAmount = parseFloat(this.getAttribute('current')) || 0;

		// Store original message templates
		this.#originalAboveMessage = this.getAttribute('message-above') || '';
		this.#originalBelowMessage = this.getAttribute('message-below') || '';
	}

	async connectedCallback() {
		// ensure the child custom element has been registered
		await customElements.whenDefined('progress-bar');

		if (!customElements.get('progress-bar')) {
			throw new Error('<progress-bar> must be registered before <cart-progress-bar> runs');
		}

		this.#render();
		this.#updateProgress();
		this.#attachListeners();
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (oldValue === newValue) return;

		switch (name) {
			case 'threshold':
				this.#minAmount = parseFloat(newValue) || 0;
				this.#updateProgress();
				break;
			case 'current':
				this.#currentAmount = parseFloat(newValue) || 0;
				this.#updateProgress();
				break;
			case 'message-above':
				this.#originalAboveMessage = newValue || '';
				this.#updateMessages();
				break;
			case 'message-below':
				this.#originalBelowMessage = newValue || '';
				this.#updateMessages();
				break;
		}
	}

	#render() {
		// Find or create the message element
		this.#messageElement =
			this.querySelector('[data-content-cart-progress-message]') ||
			this.querySelector('p[data-content-cart-progress-message]');

		// Find existing progress bar (user can add their own)
		this.#progressBar = this.querySelector('progress-bar');

		// Create message element if it doesn't exist but we have message templates
		if (!this.#messageElement && (this.#originalAboveMessage || this.#originalBelowMessage)) {
			this.#messageElement = document.createElement('p');
			this.#messageElement.setAttribute('data-content-cart-progress-message', '');
			this.appendChild(this.#messageElement);
		}

		// Create progress bar if it doesn't exist - add it at the end (below text message)
		if (!this.#progressBar) {
			// Ensure progress-bar is defined before creating
			if (customElements.get('progress-bar')) {
				this.#progressBar = document.createElement('progress-bar');
				this.appendChild(this.#progressBar);
			} else {
				// Fallback: wait for definition
				customElements.whenDefined('progress-bar').then(() => {
					if (!this.#progressBar) {
						this.#progressBar = document.createElement('progress-bar');
						this.appendChild(this.#progressBar);
						this.#updateProgress(); // Update progress after creating
					}
				});
			}
		}
	}

	#updateProgress() {
		if (this.#minAmount === 0) {
			this.#progressPercent = 100;
		} else {
			this.#progressPercent = Math.min(100, (this.#currentAmount / this.#minAmount) * 100);
		}

		// Update progress bar
		if (this.#progressBar) {
			this.#progressBar.setPercent(this.#progressPercent);
		}

		// Update messages
		this.#updateMessages();

		// Update component state
		this.#updateComponentState();
	}

	#attachListeners() {
		// Find the nearest cart-panel component
		const cartDialog = this.closest('cart-dialog');

		if (cartDialog) {
			// Listen for cart data changes
			cartDialog.addEventListener('cart-dialog:data-changed', (event) => {
				this.#handleCartDataChange(event);
			});
		}
	}

	#handleCartDataChange(event) {
		const updatedCart = event.detail;

		if (updatedCart) {
			// Use calculated_subtotal if available (handles _ignore_price_in_subtotal logic)
			// Otherwise fall back to total_price for backwards compatibility
			let currentAmount = 0;

			if (typeof updatedCart.calculated_subtotal !== 'undefined') {
				// calculated_subtotal is already in dollars, no conversion needed
				currentAmount = updatedCart.calculated_subtotal / 100;
			} else if (typeof updatedCart.total_price !== 'undefined') {
				// Convert from cents to dollars if needed (Shopify typically returns cents)
				currentAmount = updatedCart.total_price / 100;
			}

			this.setCurrentAmount(currentAmount);
		}
	}

	#updateMessages() {
		const isComplete = this.#currentAmount >= this.#minAmount;
		const remainingAmount = Math.max(0, this.#minAmount - this.#currentAmount);

		// Format amount with minimal formatting
		const formattedAmount = remainingAmount.toFixed(2).replace('.00', '');

		// Update the single message element
		if (this.#messageElement) {
			let messageTemplate;

			if (isComplete && this.#originalAboveMessage) {
				// Show success message when complete
				messageTemplate = this.#originalAboveMessage;
			} else if (!isComplete) {
				// Show progress message when incomplete
				messageTemplate = this.#originalBelowMessage || this.#originalAboveMessage;
			}

			if (messageTemplate) {
				// Support multiple placeholder formats: {amount}, { amount }, [amount]
				const message = messageTemplate
					.replace(/\{\s*amount\s*\}/g, formattedAmount)
					.replace(/\[\s*amount\s*\]/g, formattedAmount);
				this.#messageElement.textContent = message;
				this.#messageElement.style.display = 'block';
			} else {
				// Hide message if no template available for current state
				this.#messageElement.style.display = 'none';
			}
		}
	}

	#updateComponentState() {
		const isComplete = this.#currentAmount >= this.#minAmount;
		this.setAttribute('complete', isComplete.toString());
	}


	/**
	 * Public API: Set the progress percentage directly
	 * @param {number} percent - Progress percentage (0-100)
	 */
	setPercent(percent) {
		const clampedPercent = Math.max(0, Math.min(100, percent));
		this.#progressPercent = clampedPercent;

		if (this.#progressBar) {
			this.#progressBar.setPercent(clampedPercent);
		}

		// Calculate current amount based on percentage
		this.#currentAmount = (clampedPercent / 100) * this.#minAmount;
		this.setAttribute('current', this.#currentAmount.toString());

		this.#updateMessages();
		this.#updateComponentState();
	}

	/**
	 * Public API: Set the current cart amount
	 * @param {number} amount - Current cart amount
	 */
	setCurrentAmount(amount) {
		this.#currentAmount = parseFloat(amount) || 0;
		this.setAttribute('current', this.#currentAmount.toString());
		this.#updateProgress();
	}

	/**
	 * Public API: Set the threshold amount for free shipping
	 * @param {number} amount - Threshold amount for free shipping
	 */
	setThresholdAmount(amount) {
		this.#minAmount = parseFloat(amount) || 0;
		this.setAttribute('threshold', this.#minAmount.toString());
		this.#updateProgress();
	}

	/**
	 * Public API: Set the minimum amount for free shipping (deprecated - use setThresholdAmount)
	 * @param {number} amount - Minimum amount threshold
	 * @deprecated Use setThresholdAmount instead
	 */
	setMinAmount(amount) {
		this.setThresholdAmount(amount);
	}

	/**
	 * Public API: Get current progress information
	 */
	getProgress() {
		return {
			currentAmount: this.#currentAmount,
			thresholdAmount: this.#minAmount,
			minAmount: this.#minAmount, // backwards compatibility
			remainingAmount: Math.max(0, this.#minAmount - this.#currentAmount),
			percent: this.#progressPercent,
			isComplete: this.#currentAmount >= this.#minAmount,
		};
	}

	/**
	 * Public API: Update message templates
	 * @param {string} aboveMessage - Message template for above the bar
	 * @param {string} belowMessage - Message template for below the bar
	 */
	setMessages(aboveMessage = null, belowMessage = null) {
		if (aboveMessage !== null) {
			this.#originalAboveMessage = aboveMessage;
			this.setAttribute('message-above', aboveMessage);
		}

		if (belowMessage !== null) {
			this.#originalBelowMessage = belowMessage;
			this.setAttribute('message-below', belowMessage);
		}

		this.#updateMessages();
	}

	// Getters
	get currentAmount() {
		return this.#currentAmount;
	}
	get thresholdAmount() {
		return this.#minAmount;
	}
	get minAmount() {
		return this.#minAmount;
	} // backwards compatibility
	get percent() {
		return this.#progressPercent;
	}
	get isComplete() {
		return this.#currentAmount >= this.#minAmount;
	}
}

// Define CartProgressBar custom element
customElements.define('cart-progress-bar', CartProgressBar);

exports.CartProgressBar = CartProgressBar;
exports.ProgressBar = ProgressBar;
//# sourceMappingURL=cart-progress-bar.cjs.js.map
