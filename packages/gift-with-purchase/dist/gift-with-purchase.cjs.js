'use strict';

/**
 * giftwithpurchase main component
 * - automatically adds / removes a gift variant when a cart threshold is met
 * - emits gwp:added / gwp:removed / gwp:error and re-broadcasts cart-dialog:data-changed using the
 *   cart payload returned by shopify so the cart ui can update without an extra fetch
 */
class GiftWithPurchase extends HTMLElement {
  // private fields
  #threshold = 0;
  #currentAmount = 0;
  #variantId = null;
  #isActive = false;
  #isAdded = false;
  #promoEnded = false;
  #cartPanel = null;
  #productImage = null;
  #productTitle = null;
  #variantTitle = null;
  #boundHandleCartDataChange = null; // pre-bound listener ref for clean-up
  #debounceTimer = null; // debouncing cart updates
  #messageAbove = null; // message when threshold is met
  #messageBelow = null; // message when below threshold

  /** attributes to observe */
  static get observedAttributes() {
    return ["threshold", "current", "variant-id", "promo-ended", "message-above", "message-below"];
  }

  constructor() {
    super();
    // read initial attributes once
    this.#threshold = parseFloat(this.getAttribute("threshold")) || 0;
    this.#currentAmount = parseFloat(this.getAttribute("current")) || 0;
    this.#variantId = this.getAttribute("variant-id");
    this.#promoEnded = this.hasAttribute("promo-ended");
    this.#messageAbove = this.getAttribute("message-above");
    this.#messageBelow = this.getAttribute("message-below");
    this.#boundHandleCartDataChange = this.#handleCartDataChange.bind(this);
  }

  connectedCallback() {
    this.#render();
    this.#updateState();
    this.#attachListeners();
  }

  disconnectedCallback() {
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    if (this.#cartPanel)
      this.#cartPanel.removeEventListener(
        "cart-dialog:data-changed",
        this.#boundHandleCartDataChange
      );
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === "threshold") this.#threshold = parseFloat(newVal) || 0;
    else if (name === "current") this.#currentAmount = parseFloat(newVal) || 0;
    else if (name === "variant-id") this.#variantId = newVal;
    else if (name === "promo-ended") this.#promoEnded = newVal !== null;
    else if (name === "message-above") this.#messageAbove = newVal;
    else if (name === "message-below") this.#messageBelow = newVal;
    this.#updateState();
  }

  #render() {
    this.#productImage = this.querySelector("[data-gwp-image]");
    this.#productTitle = this.querySelector("[data-gwp-title]");
    this.#variantTitle = this.querySelector("[data-gwp-variant]");
    this.classList.add("gift-with-purchase");
    this.#renderMessages();
  }

  #renderMessages() {
    // create or update message element
    let messageEl = this.querySelector(".gwp-message");
    if (!messageEl && (this.#messageAbove || this.#messageBelow)) {
      messageEl = document.createElement("div");
      messageEl.className = "gwp-message";
      this.appendChild(messageEl);
    }
    this.#updateMessages();
  }

  #updateMessages() {
    const messageEl = this.querySelector(".gwp-message");
    if (!messageEl) return;

    let message = "";
    if (this.#isActive && this.#messageAbove) {
      message = this.#messageAbove;
    } else if (!this.#isActive && this.#messageBelow) {
      const remaining = this.#threshold - this.#currentAmount;
      message = this.#messageBelow.replace("{{ amount }}", remaining.toFixed(2));
    }

    messageEl.textContent = message;
    messageEl.style.display = message ? "block" : "none";
  }

  #attachListeners() {
    this.#cartPanel = this.closest("cart-panel");
    if (this.#cartPanel)
      this.#cartPanel.addEventListener(
        "cart-dialog:data-changed",
        this.#boundHandleCartDataChange
      );
  }

  #handleCartDataChange(event) {
    const cart = event.detail;
    if (!cart || typeof cart.total_price === "undefined") return;
    if (this.#debounceTimer) clearTimeout(this.#debounceTimer);
    this.#debounceTimer = setTimeout(() => {
      this.#debounceTimer = null;
      this.setCurrentAmount(cart.total_price / 100);
      this.#checkGiftInCart(cart);
    }, 300);
  }

  #checkGiftInCart(cart) {
    if (!cart.items || !this.#variantId) {
      this.#isAdded = false;
      this.#updateState();
      return;
    }
    const giftLines = cart.items.filter(
      (lineItem) =>
        lineItem.variant_id.toString() === this.#variantId.toString() &&
        lineItem.properties?._gwp_item === "true"
    );
    this.#isAdded = giftLines.length > 0;
    if (this.#promoEnded && giftLines.length)
      this.#removeAllGiftItems(giftLines);
    this.#updateState();
  }

  #updateState() {
    const wasActive = this.#isActive;
    this.#isActive =
      this.#currentAmount >= this.#threshold && !this.#promoEnded;

    if (this.#promoEnded) {
      this.setAttribute("data-promo-ended", "true");
      this.removeAttribute("data-active");
      this.removeAttribute("data-inactive");
    } else if (this.#isActive) {
      this.setAttribute("data-active", "true");
      this.removeAttribute("data-inactive");
      this.removeAttribute("data-promo-ended");
    } else {
      this.setAttribute("data-inactive", "true");
      this.removeAttribute("data-active");
      this.removeAttribute("data-promo-ended");
    }
    this.toggleAttribute("data-added", this.#isAdded);

    if (!this.#promoEnded) {
      if (this.#isActive && !wasActive && !this.#isAdded && this.#variantId)
        this.#addGiftToCart();
      else if (!this.#isActive && wasActive && this.#isAdded && this.#variantId)
        this.#removeGiftFromCart();
    }
    this.#updateVisualState();
    this.#updateMessages();
  }

  #updateVisualState() {
    this.classList.remove(
      "gwp-inactive",
      "gwp-active",
      "gwp-added",
      "gwp-ended"
    );
    if (this.#promoEnded) {
      this.classList.add("gwp-ended");
      this.style.display = "none";
      return;
    }
    this.style.display = "";
    this.classList.add(
      this.#isAdded
        ? "gwp-added"
        : this.#isActive
          ? "gwp-active"
          : "gwp-inactive"
    );
  }

  /** helper: broadcast updated cart payload to surrounding cart-dialog / components */
  #broadcastCart(cart) {
    if (!cart) return;
    this.dispatchEvent(
      new CustomEvent("cart-dialog:data-changed", {
        detail: cart,
        bubbles: true,
      })
    );
  }

  async #addGiftToCart() {
    try {
      const res = await fetch("/cart/add.js", {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-Requested-With": "XMLHttpRequest",
        },
        body: JSON.stringify({
          items: [
            {
              id: this.#variantId,
              quantity: 1,
              properties: { _gwp_item: "true", _hide_in_cart: "true" },
            },
          ],
        }),
      });
      if (!res.ok) throw new Error(`http ${res.status}`);
      const updatedCart = await res.json();
      this.#isAdded = true;
      this.#updateState();
      this.#broadcastCart(updatedCart);
      this.dispatchEvent(
        new CustomEvent("gwp:added", {
          detail: { variantId: this.#variantId },
          bubbles: true,
        })
      );
    } catch (err) {
      console.error("giftwithpurchase: add error", err);
      this.dispatchEvent(
        new CustomEvent("gwp:error", {
          detail: { action: "add", error: err.message },
          bubbles: true,
        })
      );
    }
  }

  async #removeGiftFromCart() {
    try {
      const cart = await (
        await fetch("/cart.js", { credentials: "same-origin" })
      ).json();
      const giftLines = cart.items.filter(
        (lineItem) =>
          lineItem.variant_id.toString() === this.#variantId.toString() &&
          lineItem.properties?._gwp_item === "true"
      );
      if (!giftLines.length) {
        this.#isAdded = false;
        this.#updateState();
        return;
      }
      await this.#removeAllGiftItems(giftLines);
    } catch (err) {
      console.error("giftwithpurchase: remove error", err);
      this.dispatchEvent(
        new CustomEvent("gwp:error", {
          detail: { action: "remove", error: err.message },
          bubbles: true,
        })
      );
    }
  }

  async #removeAllGiftItems(giftLines) {
    try {
      await Promise.all(
        giftLines.map((giftItem) =>
          fetch("/cart/change.js", {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({ id: giftItem.key, quantity: 0 }),
          })
        )
      );
      this.#isAdded = false;
      this.#updateState();
      // note: you can broadcast cart again here if you want real-time re-render after remove
      this.dispatchEvent(
        new CustomEvent("gwp:removed", {
          detail: { variantId: this.#variantId },
          bubbles: true,
        })
      );
    } catch (err) {
      console.error("giftwithpurchase: bulk remove error", err);
      this.dispatchEvent(
        new CustomEvent("gwp:error", {
          detail: { action: "remove", error: err.message },
          bubbles: true,
        })
      );
    }
  }

  // public api helpers
  setCurrentAmount(amount) {
    this.#currentAmount = parseFloat(amount) || 0;
    this.setAttribute("current", this.#currentAmount.toString());
    this.#updateState();
  }
  setThreshold(amount) {
    this.#threshold = parseFloat(amount) || 0;
    this.setAttribute("threshold", this.#threshold.toString());
    this.#updateState();
  }
  setVariantId(id) {
    this.#variantId = id;
    this.setAttribute("variant-id", id);
  }
  setPromoEnded(flag) {
    this.#promoEnded = !!flag;
    flag
      ? this.setAttribute("promo-ended", "")
      : this.removeAttribute("promo-ended");
    this.#updateState();
  }
  getState() {
    return {
      currentAmount: this.#currentAmount,
      threshold: this.#threshold,
      variantId: this.#variantId,
      isActive: this.#isActive,
      isAdded: this.#isAdded,
      promoEnded: this.#promoEnded,
      remainingAmount: Math.max(0, this.#threshold - this.#currentAmount),
    };
  }
  updateProduct({ image, title, variantTitle, alt } = {}) {
    if (image && this.#productImage) {
      this.#productImage.src = image;
      if (alt) this.#productImage.alt = alt;
    }
    if (title && this.#productTitle) this.#productTitle.textContent = title;
    if (variantTitle && this.#variantTitle)
      this.#variantTitle.textContent = variantTitle;
  }
  get currentAmount() {
    return this.#currentAmount;
  }
  get threshold() {
    return this.#threshold;
  }
  get variantId() {
    return this.#variantId;
  }
  get isActive() {
    return this.#isActive;
  }
  get isAdded() {
    return this.#isAdded;
  }
  get promoEnded() {
    return this.#promoEnded;
  }
}

if (!customElements.get("gift-with-purchase")) {
  customElements.define("gift-with-purchase", GiftWithPurchase);
}

exports.GiftWithPurchase = GiftWithPurchase;
//# sourceMappingURL=gift-with-purchase.cjs.js.map
