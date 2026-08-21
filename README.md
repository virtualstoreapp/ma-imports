[![Run Tests](https://github.com/virtualstoreapp/ma-imports/actions/workflows/test.yml/badge.svg?branch=main)](https://github.com/virtualstoreapp/ma-imports/actions/workflows/test.yml) [![Deploy GitHub Pages](https://github.com/virtualstoreapp/ma-imports/actions/workflows/deploy.yml/badge.svg?branch=main)](https://github.com/virtualstoreapp/ma-imports/actions/workflows/deploy.yml)

https://virtualstoreapp.github.io/ma-imports/

## Catalog

`products/*.json` is the source of truth: one file per category, each an array of
products. A product name embeds its `[DDMMYYHHmm]` code, which drives the
newest-first ordering on the homepage.

### Validation

`npm run build` validates the whole catalog before writing anything, reporting
every problem in one run rather than stopping at the first. It **fails** on:

- a name that is empty or missing its `[DDMMYYHHmm]` code
- `price` that is not a positive number
- `oldPrice` that is negative, or that is set but does not exceed `price` (the
  card strikes it through, so that would advertise a rise as a discount)
- `description`/`size` that are not strings, `soldOut` that is not a boolean
- a product with no image, or an image that does not exist under `images/`
- a `products/*.json` with no `CATEGORIES_DICT` entry in `scripts.js` (its
  products would be unreachable), or a `CATEGORIES_DICT` key with no file (the
  fallback merge would request a 404)

It **warns**, without failing, on duplicate `[DDMMYYHHmm]` codes — the code is
how a customer identifies a product over WhatsApp, so a collision leaves the
seller unable to tell which item was requested.

The same rules run under `npm test` (`tests/tools/validate.test.js`), so a bad
catalog fails a PR even without a build.

## Build

`npm run build` runs `tools/build.js` and produces `dist/`, which is what GitHub
Pages publishes. (The scripts live in `tools/`, not `build/`, because `.gitignore`
reserves `build/` for output.) `dist/` contains:

- **`products/all.json`** — every category pre-merged and pre-sorted, so the
  homepage costs one request instead of one per category.
- **`images/**`** — a WebP thumbnail and full-size WebP per image, plus a JPEG
  thumbnail and the original as fallbacks for browsers without WebP.
- **`images/og-card.jpg`** — the 1200×630 card WhatsApp and Facebook show for a
  shared link, rendered from `images/logo.jpeg`. Its dimensions are pinned to the
  `og:image:width`/`height` tags in `index.html` by `tests/seo/social-meta.test.js`,
  so the two cannot drift.
- `index.html`, `styles.css`, `scripts.js` and `.nojekyll`.

`dist/images` doubles as the conversion cache, so only images whose source
changed are re-encoded. A cold build takes a few seconds; a warm one is instant.

```bash
npm ci
npm run build      # generate dist/
npm run preview    # build, then serve dist/ on :8000 exactly as Pages will
npm run dev        # serve the source tree on :8000 with reload
npm test           # jest + snapshots
```

Running against the unbuilt source tree works too: the homepage falls back to
merging the category files in the browser when `products/all.json` is absent.

## Deploy

Pushing to `main` runs `.github/workflows/deploy.yml`, which builds `dist/` and
publishes it through the GitHub Pages Actions pipeline.

> **Repository setting:** Settings → Pages → Build and deployment → Source must
> be **GitHub Actions**. On "Deploy from a branch" the workflow uploads its
> artifact but Pages keeps serving the branch contents instead.

## Docker

The image is built from the local `Dockerfile`, so it always matches the current
`package.json`. `node_modules` lives in an anonymous volume rather than the bind
mount, because `sharp` ships a platform-specific binary — the host's macOS build
will not run inside a Linux container.

```bash
make test-app                # run the suite
make update-tests-snapshots  # run the suite, refreshing snapshots
make build-app               # produce dist/ on Linux, same platform as CI
make preview                 # build, then serve dist/ on :8000
make start-app-server        # serve the source tree on :8000 with reload
make docker-down             # stop everything
```

Or directly, adding `--build` so a changed `package.json` is picked up:

```bash
docker compose run --rm --build test-app
docker compose run --rm --build build-app
docker compose up --build preview
```

Only `app-server` and `preview` bind port 8000, and they are alternatives — run
`make docker-down` before switching between them.
