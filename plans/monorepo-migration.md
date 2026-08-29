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
| `@magic-spells/cart-panel`         | `magic-spells/cart-panel` (absorbs `cart-item`)     | **Deferred** — see below                 |
| `@magic-spells/cart-progress-bar`  | `magic-spells/cart-progress-bar`                    | Imported from `main`                     |
| `@magic-spells/gift-with-purchase` | `magic-spells/gift-with-purchase`                   | Imported from `release/1.0.1`            |

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

Commit counts carried over: `cart-progress-bar` 13, `gift-with-purchase` 10.

`gift-with-purchase` was imported from its `release/1.0.1` tip rather than `main` — that branch
carries the merged PR #1 fix that calls `cart-panel`'s `refreshCart()` instead of the
long-removed `getCartAndRefresh()`, and `main` does not have it yet.

### cart-panel is deferred

`cart-panel` is intentionally **not** imported yet. It has an in-flight PR reworking its root
entry point and the opt-in `cart-item` subpath, and importing mid-PR would either freeze a
half-finished tree into the monorepo or force the PR to be re-targeted across repos. It gets the
same `filter-repo` treatment once that PR merges.

Until then:

- `packages/cart-panel` is listed in the root `workspaces` array (npm ignores a workspace path
  that does not exist yet) and has a `dev:panel` script waiting for it.
- The root `build` script fans out over the two imported packages only. **Add
  `-w @magic-spells/cart-panel` to it when the import lands.**

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
- Each package keeps a fixed dev port: `cart-progress-bar` 3001, `gift-with-purchase` 3000,
  `cart-panel` to be assigned on import.

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

### Known follow-up: class names are mangled in `.min.js`

Rolldown rewrites `class Foo extends HTMLElement {}` into `var Foo = class extends HTMLElement {}`
before Terser runs, so Terser's `mangle.keep_classnames: true` finds no named class to keep and
the name is lost. The old rollup builds kept it.

Impact is cosmetic — devtools display and `constructor.name`. `customElements.define()` and the
UMD named exports are unaffected, so nothing functional depends on it.

This is **not** specific to the cart packages: `sticky-header` has the same shape, which means the
whole house build pattern has it. The fix is a one-line `rolldownOptions.output.keepNames` in the
shared pattern, applied everywhere at once. Deliberately **not** patched here in isolation —
diverging one repo from the house pattern costs more than the cosmetic name is worth.

## Branches

- `main` — shipped trunk. Holds the skeleton commit and the two history-import merges.
- `release/2.0.0` — branched off `main`; carries the version bumps, the repository-field
  rewrites, the build-tooling migration and the single workspace lockfile.

Release branches are never deleted; they are the rollback path to a prior version.

## After 2.0.0 ships

1. Import `cart-panel` (see above) and add it to the root `build` fan-out.
2. Archive the standalone `magic-spells/cart-panel`, `magic-spells/cart-progress-bar` and
   `magic-spells/gift-with-purchase` repos on GitHub.
3. `npm deprecate @magic-spells/cart-item` pointing at `@magic-spells/cart-panel/cart-item`.
