# Cart monorepo migration

Consolidating the Magic Spells cart family into one repo, on the same pattern as the tarot
monorepo: npm workspaces, shared eslint/prettier at the root, `release/x.y.z` branches as the
working trunk and `main` as the shipped trunk.

## Why

The three cart packages are developed together and break together. `cart-progress-bar` and
`gift-with-purchase` both read `calculated_subtotal` off `cart-panel`'s events, so a change to the
panel's event contract has to land in all three at once. Separate repos made that a three-PR
dance with no single place to verify the result.

## Packages

| Package                            | Standalone repo                                    | Status                                   |
| ---------------------------------- | -------------------------------------------------- | ---------------------------------------- |
| `@magic-spells/cart-panel`         | `magic-spells/cart-panel` (absorbs `cart-item`)     | Imported from `release/2.0.0`            |
| `@magic-spells/cart-progress-bar`  | `magic-spells/cart-progress-bar`                    | Imported from `main`                     |
| `@magic-spells/gift-with-purchase` | `magic-spells/gift-with-purchase`                   | Imported from `release/1.0.1`            |

All three packages are now in the repo. What is left before 2.0.0 ships is listed under
[Remaining work](#remaining-work).

## Versioning: lockstep 2.0.0

The whole family ships together as **2.0.0** from this repo. That is a clean break, not a
semver-driven bump on each package individually — the version number now identifies a family
generation rather than a per-package changelog position. Published predecessors were
`cart-panel@1.0.1`, `cart-progress-bar@1.0.0`, `gift-with-purchase@1.0.0` and the standalone
`cart-item@0.4.2`.

`cart-item` does not come back as its own package. It ships inside `cart-panel` on a subpath
export, and the standalone `@magic-spells/cart-item` gets npm-deprecated pointing at
`@magic-spells/cart-panel/cart-item` once 2.0.0 is out.

## History import

Both imported packages keep their full history, rewritten under `packages/<name>/` so blame
survives:

```
git clone <repo>                                       # fresh clone, never a working copy
git filter-repo --to-subdirectory-filter packages/<name>
# then, in the monorepo:
git fetch <rewritten> && git merge --allow-unrelated-histories
```

Commit counts carried over: `cart-progress-bar` 13, `gift-with-purchase` 10, `cart-panel` 40.

`gift-with-purchase` was imported from its `release/1.0.1` tip rather than `main` — that branch
carries the merged PR #1 fix that calls `cart-panel`'s `refreshCart()` instead of the
long-removed `getCartAndRefresh()`, and `main` does not have it yet.

`cart-panel` was imported from its `release/2.0.0` tip (`5c4b1c9`, the PR #5 merge) for the same
reason: that PR is what makes the root entry register both `<cart-panel>` and `<cart-item>`, and it
was the reason the import waited. The rewritten `packages/cart-panel` tree hashes identical to the
source tip, and blame runs back to the June 2025 initial commit.

## Build tooling: one house pattern, no CJS, no sass

As part of the 2.0.0 clean break, every package in this repo moves to the current house build
pattern — the vite-based `scripts/build.mjs` that `sticky-header` defines (vite 8, lightningcss,
terser), with `sheet` as the most documented example of the same setup.

Family policy, applied to all packages including `cart-panel` when it arrives:

- **Outputs are ESM (never minified), a browser `.min.js`, and plain `.css` / `.min.css`.**
- **No CJS.** No `.cjs.js` artifacts, no `require` conditions in exports maps, no `main` field
  pointing at a CJS bundle.
- **No sass.** No `sass` dependency, no `.scss` sources, no `./scss` export. Existing `.scss` is
  ported to plain CSS preserving the custom-property API, the way `cart-panel/src/cart-item.css`
  was ported.
- `npm run dev` writes its output into the package's `demo/dist/`, never into `dist/`.
- No source maps in the published `dist/` (`sourcemap: isDev`). Rolldown inlines `sourcesContent`,
  which shipped the whole source tree twice in the tarball; `sheet` already made this call.
- Each package keeps a fixed dev port: `gift-with-purchase` 3000, `cart-progress-bar` 3001,
  `cart-panel` 3002 (it was 3004 in the standalone repo; renumbered to close the run).

Two things change relative to the standalone repos:

- **`demo/dist/` is gitignored here**, following tarot, where dev-mode build output is not
  committed. The standalone repos committed their demo bundles because GitHub Pages served the
  demo straight out of the repo. That demo-hosting story has to be rebuilt for the monorepo
  (one Pages deploy covering `packages/*/demo`), and is **not** part of this migration.
- Published `dist/` **is** still committed, which is the existing house policy.

`gift-with-purchase` was the only package still carrying sass (a `.scss` source, the `sass`
devDependency, and a published `./scss` entry point); dropping it is a breaking change for anyone
who imported that entry, which the 2.0.0 major covers.

These build changes live in the 2.0.0 commits on `release/2.0.0` — deliberately **not** rewritten
into the imported history, so the imported commits still describe what those packages actually
were at the time.

### Fixed: class names were mangled in `.min.js`

Rolldown rewrites `class Foo extends HTMLElement {}` into `var Foo = class extends HTMLElement {}`
before Terser runs, so Terser's `mangle.keep_classnames: true` finds no named class to keep and
the name was lost. The old rollup builds kept it.

**The fix is not `rolldownOptions.output.keepNames`,** which is what this document previously
assumed. That option is real — rolldown 1.2.6 declares it on `OutputOptions` and forwards it into
the input bindings — but Vite never delivers it. Vite calls `rolldown(inputOptions)` and only then
`bundle.write(outputOptions)`, so at the moment rolldown reads `outputOptions.keepNames` to build
its input options, there are no output options yet. Setting it through Vite is silently ignored;
setting it at the input level is rejected as an unknown key. Verified empirically against
vite 8.2.2 / rolldown 1.2.6.

What works is reserving the names from Terser instead:

```js
mangle: { keep_classnames: true, keep_fnames: false, reserved: RESERVED_CLASS_NAMES }
```

`RESERVED_CLASS_NAMES` is scanned out of `src/*.js` at build time, so a class added later is
covered without anyone updating a list. A reserved identifier is never renamed, so
`var Foo = class` survives intact and JS name inference gives the class its name back. Cost is
5–14 bytes gzipped per bundle.

Rolldown's own minifier (`output.minify` with `mangle.keepNames`) also mostly works and is slightly
smaller, but it cannot preserve `CartItem` — a class with `static #private` fields that reference
the class binding from inside its own body — and adopting it would swap Terser out of the house
pattern. The reserved-names approach keeps Terser and preserves every class name in all five
bundles.

This is **not** specific to the cart packages: `sticky-header` and `sheet` have the same shape, so
the same three-line block belongs in the shared pattern everywhere.

## The flagship demo

`packages/cart-panel/demo` is the one page that drives all three packages together, so it is also
the integration test. It loads `cart-progress-bar` and `gift-with-purchase` from their **workspace**
builds, not from unpkg: `npm run dev` copies their committed `dist/` into
`packages/cart-panel/demo/dist/vendor/` before starting the server. `dialog-panel`,
`quantity-input` and `split-text` stay on pinned unpkg URLs — they are external packages, not
siblings.

The demo used to carry a one-line `cartPanel.getCartAndRefresh = () => cartPanel.refreshCart()`
shim, because `gift-with-purchase@1.0.0` called a method the panel had removed. The 2.0.0 source in
this repo calls `refreshCart()` and only falls back to `getCartAndRefresh()`, so the shim is gone.

## Branches

- `main` — shipped trunk. Holds the skeleton commit and the three history-import merges.
- `release/2.0.0` — branched off `main`; carries the version bumps, the repository-field
  rewrites, the build-tooling migration and the single workspace lockfile.

Release branches are never deleted; they are the rollback path to a prior version.

## Remaining work

Everything below is still open. Nothing in this repo has been pushed, tagged or published.

1. **Upgrades work** — the substantive 2.0.0 feature and API changes across the three packages.
   The migration so far is structural: history, build tooling and wiring, not behavior.
2. **Fable review** — a full read of the merged result before it ships.
3. **Push** — the `magic-spells/cart` remote does not exist yet. Creating it, pushing `main` and
   `release/2.0.0`, and re-pointing the packages' `repository` fields' assumptions is a deliberate
   later step; the fields already name `git+https://github.com/magic-spells/cart.git`.
4. Propagate the Terser `reserved` fix above to `sticky-header`, `sheet` and anything else on the
   house build pattern.

## After 2.0.0 ships

1. Archive the standalone `magic-spells/cart-panel`, `magic-spells/cart-progress-bar` and
   `magic-spells/gift-with-purchase` repos on GitHub.
2. `npm deprecate @magic-spells/cart-item` pointing at `@magic-spells/cart-panel/cart-item`.
3. Rebuild the demo-hosting story — one GitHub Pages deploy covering `packages/*/demo`, replacing
   the three standalone Pages sites. Until that exists, all three package READMEs still link their
   **Live Demo** at the old standalone Pages URL (`magic-spells.github.io/<package>/demo/`), which
   keeps working only while those repos stay unarchived. Re-point all three together.
