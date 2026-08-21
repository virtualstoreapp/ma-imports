#!/usr/bin/env node
'use strict';

const fsp = require('fs/promises');
const path = require('path');

const {
  ALL_CATEGORY,
  buildAllCatalog,
  listCategories,
  productImages,
  readCategory,
} = require('./lib/catalog');
const { buildImageManifest } = require('./lib/images');
const { loadRegistry, renderRegistryElement } = require('./lib/registry');
const { toRuntime } = require('./lib/runtime');
const { buildSocialCard } = require('./lib/social');
const { validateCatalog } = require('./lib/validate');
const { applyBlock } = require('./sync-registry');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PRODUCTS_DIR = path.join(ROOT, 'products');

// Files served verbatim from the site root.
const STATIC_FILES = ['index.html', 'styles.css', 'scripts.js'];

const log = (message) => process.stdout.write(`${message}\n`);

/**
 * Attaches build-time image metadata to a product.
 * Cards can then reserve layout space and prefer WebP without a second request.
 * Validation has already confirmed every reference resolves, so unresolved
 * entries are simply dropped here rather than reported twice.
 * @param {object} product Source product entry.
 * @param {object} manifest Image manifest keyed by source path.
 * @returns {object} Product with a `media` array.
 */
const withMedia = (product, manifest) => ({
  ...product,
  media: productImages(product)
    .map((source) => manifest[source])
    .filter(Boolean),
});

/**
 * Compiles a v2 authoring product into what the client reads.
 * The runtime shape is still v1, so Wave 4's data migration ships without
 * touching scripts.js; Wave 5b switches the client over and this collapses.
 * @param {object} product v2 product.
 * @param {object} manifest Image manifest keyed by source path.
 * @param {object} brands Brand registry.
 * @returns {object} Runtime product with media attached.
 */
const compileProduct = (product, manifest, brands) => withMedia(toRuntime(product, brands), manifest);

/**
 * Writes the generated product payloads: one file per category plus the
 * pre-merged `all.json` that replaces 26 homepage requests with one.
 * @param {object} manifest Image manifest keyed by source path.
 * @returns {Promise<{categories: number, products: number}>} Generation summary.
 */
const writeProducts = async (manifest, brands) => {
  const outputDir = path.join(DIST, 'products');
  await fsp.mkdir(outputDir, { recursive: true });

  const categories = listCategories(PRODUCTS_DIR);

  for (const category of categories) {
    const products = readCategory(PRODUCTS_DIR, category).map((product) =>
      compileProduct(product, manifest, brands)
    );
    await fsp.writeFile(
      path.join(outputDir, `${category}.json`),
      JSON.stringify(products),
      'utf8'
    );
  }

  // The merged catalog tags each product with its source category, so the
  // homepage can report the real one instead of the "Novidades" heading.
  // `category` is added before `media` so the emitted key order is unchanged.
  const all = buildAllCatalog(PRODUCTS_DIR).map((product) =>
    withMedia({ ...toRuntime(product, brands), category: product.category }, manifest)
  );
  await fsp.writeFile(
    path.join(outputDir, `${ALL_CATEGORY}.json`),
    JSON.stringify(all),
    'utf8'
  );

  return { categories: categories.length, products: all.length };
};

/**
 * Copies a file only when the destination is missing or stale.
 * @param {string} from Absolute source path.
 * @param {string} to Absolute destination path.
 * @returns {Promise<boolean>} True when the file was copied.
 */
const copyIfStale = async (from, to) => {
  const source = await fsp.stat(from);
  try {
    const destination = await fsp.stat(to);
    if (destination.mtimeMs >= source.mtimeMs) return false;
  } catch {
    // Destination does not exist yet.
  }
  await fsp.mkdir(path.dirname(to), { recursive: true });
  await fsp.copyFile(from, to);
  return true;
};

/**
 * Copies the original images so the modal keeps a full-resolution fallback
 * for browsers without WebP support.
 * @param {object} manifest Image manifest keyed by source path.
 * @returns {Promise<number>} Number of originals refreshed.
 */
const copyOriginals = async (manifest) => {
  let copied = 0;
  for (const source of Object.keys(manifest)) {
    if (await copyIfStale(path.join(ROOT, source), path.join(DIST, source))) copied += 1;
  }
  return copied;
};

/**
 * Removes generated image files whose source no longer exists.
 * `dist/images` doubles as the conversion cache, so it is pruned instead of wiped.
 * @param {object} manifest Image manifest keyed by source path.
 * @param {string[]} [keep] Generated paths to preserve, such as the social card.
 * @returns {Promise<number>} Number of stale files removed.
 */
const pruneImages = async (manifest, keep = []) => {
  const expected = new Set([
    ...keep,
    ...Object.values(manifest).flatMap((entry) => [
      entry.src,
      entry.webp,
      entry.thumb,
      entry.thumbFallback,
    ]),
  ]);

  const walk = async (relative) => {
    const absolute = path.join(DIST, relative);
    let entries;
    try {
      entries = await fsp.readdir(absolute, { withFileTypes: true });
    } catch {
      return 0;
    }

    let removed = 0;
    for (const entry of entries) {
      const entryRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) {
        removed += await walk(entryRelative);
        continue;
      }
      if (!expected.has(entryRelative)) {
        await fsp.rm(path.join(DIST, entryRelative));
        removed += 1;
      }
    }
    return removed;
  };

  return walk('images');
};

const main = async () => {
  const startedAt = process.hrtime.bigint();
  await fsp.mkdir(DIST, { recursive: true });

  const { manifest, converted, written } = await buildImageManifest({
    sourceRoot: ROOT,
    outputRoot: DIST,
    log: () => {},
  });
  log(`images: ${converted} sources, ${written} derivative(s) written`);

  const card = await buildSocialCard({ sourceRoot: ROOT, outputRoot: DIST });
  if (card.written) log(`social: ${card.path} rendered`);

  const copied = await copyOriginals(manifest);
  const pruned = await pruneImages(manifest, [card.path]);
  if (copied || pruned) log(`images: ${copied} original(s) copied, ${pruned} stale file(s) pruned`);

  // The registry block in index.html is generated and committed, so a stale
  // block means the catalog and the client disagree about category identity.
  const registry = loadRegistry();
  const html = await fsp.readFile(path.join(ROOT, 'index.html'), 'utf8');
  if (applyBlock(html, renderRegistryElement(registry)) !== html) {
    throw new Error(
      'index.html registry block is stale — run `node tools/sync-registry.js` and commit the result'
    );
  }

  // Validated before anything is written, so a bad catalog never reaches dist/.
  const { errors, warnings } = validateCatalog({
    productsDir: PRODUCTS_DIR,
    indexPath: path.join(ROOT, 'index.html'),
    manifest,
    registry,
  });
  warnings.forEach((warning) => log(`warning: ${warning}`));
  if (errors.length) {
    throw new Error(`${errors.length} catalog problem(s):\n  ${errors.join('\n  ')}`);
  }

  const { categories, products } = await writeProducts(manifest, registry.brands);
  log(`products: ${products} products across ${categories} categories`);
  if (warnings.length) log(`products: ${warnings.length} warning(s) above`);

  for (const file of STATIC_FILES) {
    await fsp.copyFile(path.join(ROOT, file), path.join(DIST, file));
  }

  // Publishing through the Pages Actions pipeline, so Jekyll must not run.
  await fsp.writeFile(path.join(DIST, '.nojekyll'), '', 'utf8');

  const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
  log(`build: dist/ ready in ${seconds.toFixed(1)}s`);
};

main().catch((error) => {
  process.exitCode = 1;
  process.stderr.write(`build failed: ${error.message}\n`);
});
