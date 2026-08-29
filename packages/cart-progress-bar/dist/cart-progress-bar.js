(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
	typeof define === 'function' && define.amd ? define(['exports'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global.CartProgressBar = {}));
})(this, (function (exports) { 'use strict';

	/**
	 * ProgressBar helper class for the visual progress bar element
	 */
	class ProgressBar extends HTMLElement {
		constructor() {
			super();
			const _ = this;
			_.setAttribute('role', 'progressbar');
			_.setAttribute('aria-valuemin', '0');
			_.setAttribute('aria-valuemax', '100');
			_.setAttribute('aria-valuenow', '0');
			_.innerHTML = '<div class="progress-bar-fill"></div>';
		}

		setPercent(percent) {
			const p = Math.max(0, Math.min(100, percent));
			this.style.setProperty('--cart-progress-percent', `${p}%`);
			this.setAttribute('aria-valuenow', p);
		}
	}

	// Define ProgressBar custom element immediately so it's available for CartProgressBar
	customElements.define('progress-bar', ProgressBar);

	/**
	 * CartProgressBar main component
	 */
	class CartProgressBar extends HTMLElement {
		// Private fields
		#threshold = 0;
		#current = 0;
		#percent = 0;
		#msgAbove = '';
		#msgBelow = '';
		#bar = null;
		#msgEl = null;
		#moneyFmt = null;
		#debounce = null;
		#listenSelector = 'cart-panel';
		#listenEvent = 'cart-panel:data-changed';
		#listenTarget = null;
		#listenHandler = null;

		static get observedAttributes() {
			return ['threshold', 'current', 'message-above', 'message-below', 'money-format', 'listen-selector', 'listen-event'];
		}

		constructor() {
			super();
			const _ = this;
			_.#threshold = parseFloat(_.getAttribute('threshold')) || 0;
			_.#current = parseFloat(_.getAttribute('current')) || 0;
			_.#msgAbove = _.getAttribute('message-above') || '';
			_.#msgBelow = _.getAttribute('message-below') || '';
			_.#moneyFmt = _.getAttribute('money-format');
			_.#listenSelector = _.getAttribute('listen-selector') || 'cart-panel';
			_.#listenEvent = _.getAttribute('listen-event') || 'cart-panel:data-changed';
		}

		async connectedCallback() {
			await customElements.whenDefined('progress-bar');
			this.#render();
			this.#updateProgress();
			this.#attachListeners();
		}

		disconnectedCallback() {
			if (this.#debounce) clearTimeout(this.#debounce);
			this.#detachListeners();
		}

		attributeChangedCallback(name, oldVal, newVal) {
			if (oldVal === newVal) return;
			const _ = this;

			switch (name) {
				case 'threshold':
					_.#threshold = parseFloat(newVal) || 0;
					_.#updateProgress();
					break;
				case 'current':
					_.#current = parseFloat(newVal) || 0;
					_.#updateProgress();
					break;
				case 'message-above':
					_.#msgAbove = newVal || '';
					_.#updateMessages();
					break;
				case 'message-below':
					_.#msgBelow = newVal || '';
					_.#updateMessages();
					break;
				case 'money-format':
					_.#moneyFmt = newVal;
					_.#updateMessages();
					break;
				case 'listen-selector':
					_.#listenSelector = newVal || 'cart-panel';
					_.#detachListeners();
					_.#attachListeners();
					break;
				case 'listen-event':
					_.#listenEvent = newVal || 'cart-panel:data-changed';
					_.#detachListeners();
					_.#attachListeners();
					break;
			}
		}

		#render() {
			const _ = this;
			// Find existing elements or create them
			_.#msgEl = _.querySelector('[data-content-cart-progress-message]');
			_.#bar = _.querySelector('progress-bar');

			// Create message element if needed
			if (!_.#msgEl && (_.#msgAbove || _.#msgBelow)) {
				_.#msgEl = document.createElement('p');
				_.#msgEl.setAttribute('data-content-cart-progress-message', '');
				_.appendChild(_.#msgEl);
			}

			// Create progress bar if needed
			if (!_.#bar) {
				_.#bar = document.createElement('progress-bar');
				_.appendChild(_.#bar);
			}
		}

		#updateProgress() {
			const _ = this;
			const converted = _.#converted();
			_.#percent = converted === 0 ? 100 : Math.min(100, (_.#current / converted) * 100);
			if (_.#bar) _.#bar.setPercent(_.#percent);
			_.#updateState(converted);
		}

		#attachListeners() {
			const _ = this;
			const target = _.closest(_.#listenSelector);
			if (target) {
				_.#listenHandler = (e) => _.#onCartChange(e);
				_.#listenTarget = target;
				target.addEventListener(_.#listenEvent, _.#listenHandler);
			}
		}

		#detachListeners() {
			const _ = this;
			if (_.#listenTarget && _.#listenHandler) {
				_.#listenTarget.removeEventListener(_.#listenEvent, _.#listenHandler);
				_.#listenTarget = null;
				_.#listenHandler = null;
			}
		}

		#onCartChange(event) {
			const _ = this;
			const cart = event.detail;
			if (!cart) return;

			if (_.#debounce) clearTimeout(_.#debounce);
			_.#debounce = setTimeout(() => {
				_.#debounce = null;
				// Use calculated_subtotal if available, else total_price (both in cents)
				const amt = (cart.calculated_subtotal ?? cart.total_price ?? 0) / 100;
				_.setCurrentAmount(amt);
			}, 100);
		}

		#updateState(converted) {
			const _ = this;
			const complete = _.#current >= converted;
			const remaining = Math.max(0, converted - _.#current);
			const formatted = _.#fmtMoney(remaining);

			// Update message
			if (_.#msgEl) {
				let tpl = complete ? _.#msgAbove : (_.#msgBelow || _.#msgAbove);
				if (tpl) {
					_.#msgEl.textContent = tpl.replace(/\[\s*amount\s*\]/g, formatted);
					_.#msgEl.style.display = 'block';
				} else {
					_.#msgEl.style.display = 'none';
				}
			}

			// Update complete attribute
			_.setAttribute('complete', complete.toString());
		}

		#fmtMoney(amt) {
			const fmt = this.#moneyFmt;
			if (!fmt) return amt.toFixed(2).replace(/\.00$/, '');

			const fixed = amt.toFixed(2);
			const noDecimals = Math.round(amt).toString();
			const withComma = fixed.replace('.', ',');
			const noDecWithComma = noDecimals.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

			return fmt
				.replace(/\{\{\s*amount_no_decimals_with_comma_separator\s*\}\}/g, noDecWithComma)
				.replace(/\{\{\s*amount_with_comma_separator\s*\}\}/g, withComma)
				.replace(/\{\{\s*amount_no_decimals\s*\}\}/g, noDecimals)
				.replace(/\{\{\s*amount\s*\}\}/g, fixed);
		}

		#converted() {
			const rate = parseFloat(window.Shopify?.currency?.rate) || 1;
			return this.#threshold * rate;
		}

		#updateMessages() {
			this.#updateState(this.#converted());
		}

		// Public API
		setPercent(pct) {
			const _ = this;
			const p = Math.max(0, Math.min(100, pct));
			_.#percent = p;
			if (_.#bar) _.#bar.setPercent(p);
			// Use converted threshold for multi-currency consistency
			_.#current = (p / 100) * _.#converted();
			_.setAttribute('current', _.#current.toString());
			_.#updateState(_.#converted());
		}

		setCurrentAmount(amt) {
			const _ = this;
			_.#current = parseFloat(amt) || 0;
			_.setAttribute('current', _.#current.toString());
			_.#updateProgress();
		}

		setThresholdAmount(amt) {
			const _ = this;
			_.#threshold = parseFloat(amt) || 0;
			_.setAttribute('threshold', _.#threshold.toString());
			_.#updateProgress();
		}

		/** @deprecated Use setThresholdAmount */
		setMinAmount(amt) {
			this.setThresholdAmount(amt);
		}

		getProgress() {
			const _ = this;
			const converted = _.#converted();
			return {
				currentAmount: _.#current,
				thresholdAmount: _.#threshold,
				convertedThreshold: converted,
				minAmount: _.#threshold,
				remainingAmount: Math.max(0, converted - _.#current),
				percent: _.#percent,
				isComplete: _.#current >= converted,
				currencyRate: parseFloat(window.Shopify?.currency?.rate) || 1,
			};
		}

		setMessages(above = null, below = null) {
			const _ = this;
			if (above !== null) {
				_.#msgAbove = above;
				_.setAttribute('message-above', above);
			}
			if (below !== null) {
				_.#msgBelow = below;
				_.setAttribute('message-below', below);
			}
			_.#updateMessages();
		}

		// Getters (with backwards compatibility)
		get currentAmount() { return this.#current; }
		get thresholdAmount() { return this.#threshold; }
		get minAmount() { return this.#threshold; }
		get percent() { return this.#percent; }
		get isComplete() { return this.#current >= this.#converted(); }
	}

	// Define CartProgressBar custom element
	customElements.define('cart-progress-bar', CartProgressBar);

	exports.CartProgressBar = CartProgressBar;
	exports.ProgressBar = ProgressBar;

}));
//# sourceMappingURL=cart-progress-bar.js.map
