# Cart-item/panel 2.0.0 upgrades — build plan

Approved by Cory 2026-08-29. Build in the cart monorepo, `packages/cart-panel`, on a feature
branch off `release/2.0.0`. Three features: A and B as one commit series, C as another, same
branch. All work must pass the existing build (vite `scripts/build.mjs`, ESM never minified,
no CJS/sass), lint, and browser verification. The flagship demo demonstrates everything.

## A. Enter-key guard (cart-item)

Delegated `keydown` on `[data-cart-quantity]` inputs inside cart-item:
- `e.key === 'Enter' && !e.isComposing` → `preventDefault()`, commit the input's current value
  through the same path as a change event (clamped; fires `cart-item:quantity-change` only if
  the value actually differs).
- SKIP if the input sits inside a `<quantity-input>` or `<quantity-modifier>` element — those
  components own their commit logic (quantity-input ≥1.0.3 handles Enter itself); the guard is
  for bare inputs and older component versions. No double events, ever.

## B. `optimistic` attribute (cart-panel)

Boolean attribute + reflected property on `<cart-panel>`. Default off; today's behavior unchanged.

When on:
- Quantity change: mutate the local cart object immediately — item quantity, `line_price`
  (unit price × qty), recomputed `calculated_count`/`calculated_subtotal` honoring
  `_ignore_price_in_subtotal` and `_hide_in_cart` — re-render numbers/line prices at once,
  never enter the `processing` state. POST `/cart/change.js` in the background.
- Remove: `destroyYourself()` immediately; POST in background.
- Success: silently reconcile from the server cart (numbers + any drift; in section mode also
  the item HTML). `cart-panel:data-changed` fires on the optimistic update (progress bar/GWP
  react instantly) and again on reconcile only if the server disagrees.
- Failure: restore server truth (re-fetch or use error response), removed items re-enter with
  the `appearing` animation, emit `cart-panel:error` with `{ key, error }` detail.

Race safety (review this hardest):
- Coalesce per key: at most one in-flight request per line key; rapid +/− sends only the
  latest value once the in-flight settles (trailing-edge).
- Monotonic sequence id per key; a response is applied only if it is the latest — a stale
  response can never overwrite newer local state.
- Interleaved remove + change on the same key: remove wins locally; late change response for
  a removed key is ignored.

## C. Dual render modes (cart-panel + cart-item)

Mode select: `section="API-cart-items"` attribute on `<cart-panel>` (value = Shopify section
id). Absent → JS-template mode, byte-for-byte today's behavior. Present → Liquid mode.

Liquid mode:
- Mutations: add `sections: '<id>'` to the existing `/cart/change.js` / `/cart/add.js` request
  bodies — Shopify returns rendered HTML in the same response, zero extra requests.
- Plain refresh: `Promise.all` of `/cart.js` and `/?sections=<id>`; JSON still drives
  count/subtotal/state/events (progress bar and GWP are ALWAYS client-side JS — server HTML
  never touches them; only cart items are server-rendered).
- Parse: DOMParser on the section HTML; look inside Shopify's `#shopify-section-*` wrapper;
  collect `cart-item[key]` nodes into a map.
- Diff through the existing key machinery, preserving element identity:
  - existing key → swap the live element's content in place (state attributes, animations,
    and the element itself preserved);
  - new key → animated insert (createAnimated path) with the parsed content;
  - missing key → `destroyYourself()`.
- Focus preservation: if focus was inside a swapped item, re-find `[data-cart-quantity]` in
  the new content and restore focus + caret position.
- The JS-injected processing overlay is kept in both modes, so states behave identically.
- Event handling needs zero changes: the section contract uses the same selectors the JS
  templates use (`[data-action-remove-item]`, `[data-cart-quantity]`,
  `[data-content-line-price]`).
- `setCartItemTemplate()` called while `section` is set → warn once (config error, two
  sources of truth). Section mode ignores JS templates.
- B+C compose: optimistic updates numbers instantly from JSON math; section HTML reconciles
  item content silently on arrival (only for still-latest sequence ids).

Ships with:
- `shopify/API-cart-items.liquid` reference section in the package (`files` includes it):
  loops `cart.items`, skips `_hide_in_cart`, emits `<cart-item key="{{ item.key }}">` with
  `<cart-item-content>` markup using the standard selectors. Documented in README with a
  copy-into-`sections/` note and the "server renders content, JS renders behavior" framing.
- Demo: the stand-in fetch shim grows a fake section endpoint rendering HTML from the
  simulated cart, plus a mode toggle so the flagship demo demonstrates BOTH modes live.

## Verification bar

Browser (Playwright, static server, killed after; zero stray files):
- JS mode: full existing regression (add/remove/quantity/clear/empty, progress bar, GWP).
- Section mode: same regression via the fake section endpoint; element identity stable across
  swaps; focus survives a quantity change; new/removed items animate.
- Optimistic: numbers update instantly with no processing state; rapid-click coalescing sends
  ≤1 concurrent request per key; simulated failure reverts and fires cart-panel:error.
- Enter key: bare input commits without navigation; quantity-input inputs get exactly one event.
- Zero console errors/warnings throughout; reduced-motion and 390px checks still pass.

Docs: README (modes section, optimistic section, updated events/API reference), repo CLAUDE.md,
demo reference card rows for the new attributes/events.
