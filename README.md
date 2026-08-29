# @magic-spells/cart

The Magic Spells cart family — a set of web components that build a complete Shopify cart
experience out of small, independent pieces. The panel owns the cart data and the AJAX; the
progress bar and the gift-with-purchase component listen to it and react.

Each package ships on its own from npm, so you only install the parts you use. They are versioned
in lockstep as one family, and they are developed together in this monorepo.

[**Live Demo**](https://magic-spells.github.io/cart/) — all three running together.

## Packages

| Package                                                       | Description                                                       | Size (min + gzip) |
| ------------------------------------------------------------- | ----------------------------------------------------------------- | ----------------- |
| [`@magic-spells/cart-panel`](packages/cart-panel)             | Slide-out shopping cart that owns cart data, Shopify AJAX and item rendering. | 4.9 kB both · 2.8 kB panel · 2.8 kB cart item |
| [`@magic-spells/cart-progress-bar`](packages/cart-progress-bar) | Progress bar for free-shipping and other cart spend thresholds.   | 2.1 kB            |
| [`@magic-spells/gift-with-purchase`](packages/gift-with-purchase) | Automatic gift-with-purchase threshold promotions.                | 2.8 kB            |

### [@magic-spells/cart-panel](packages/cart-panel)

A slide-out shopping cart web component. The panel owns the cart data, the Shopify AJAX and the
item rendering; [`@magic-spells/dialog-panel`](https://github.com/magic-spells/dialog-panel) owns
the modal behavior.

Three entry points. The root import registers the panel and the item together — a working cart in
one line — and each half is also on its own subpath, so a page that brings its own item element
pays for the panel only.

| Import                                  | Registers                              | min + gzip                       |
| --------------------------------------- | -------------------------------------- | -------------------------------- |
| `@magic-spells/cart-panel`              | `<cart-panel>` **and** `<cart-item>`   | **4.9 kB** (3.9 JS, 1.0 CSS)     |
| `@magic-spells/cart-panel/panel`        | `<cart-panel>`                         | **2.8 kB** (2.7 JS, 0.1 CSS)     |
| `@magic-spells/cart-panel/cart-item`    | `<cart-item>`                          | **2.8 kB** (1.8 JS, 1.0 CSS)     |

`<cart-item>` ships in this same package rather than as a standalone one.

Line items render from a JS template by default, or from a Shopify section with
`<cart-panel section="API-cart-items">` — the server renders content, JS renders behavior. Add
`optimistic` and quantity changes land on the click rather than on the response.

```bash
npm install @magic-spells/cart-panel
```

### [@magic-spells/cart-progress-bar](packages/cart-progress-bar)

A cart progress bar web component for free shipping thresholds and other e-commerce spend goals.
Template-based messaging, five CSS variables for theming, and automatic updates when it sits
inside a `<cart-panel>`.

**2.1 kB** min + gzip (1.7 kB JS, 0.4 kB CSS).

```bash
npm install @magic-spells/cart-progress-bar
```

### [@magic-spells/gift-with-purchase](packages/gift-with-purchase)

A web component for automatic gift-with-purchase threshold promotions. Adds and removes the gift
line item through the Shopify Cart API as the cart subtotal crosses the threshold, honoring the
panel's `calculated_subtotal` so bundles count and other gifts do not.

**2.8 kB** min + gzip (2.4 kB JS, 0.4 kB CSS).

```bash
npm install @magic-spells/gift-with-purchase
```

## Development

This is an npm workspaces monorepo. Install once at the root:

```bash
npm install
```

| Command               | What it does                              |
| --------------------- | ----------------------------------------- |
| `npm run build`       | Build every package                       |
| `npm run lint`        | Lint every package                        |
| `npm run format`      | Prettier across the repo                  |
| `npm run dev:panel`   | Dev server for `cart-panel`               |
| `npm run dev:progress`| Dev server for `cart-progress-bar`        |
| `npm run dev:gwp`     | Dev server for `gift-with-purchase`       |

Day-to-day work happens on `release/x.y.z` branches; `main` is the shipped trunk.

## License

MIT © Cory Schulz

---

<p align="center">
  Made by <a href="https://github.com/coryschulz">Cory Schulz</a>
</p>
