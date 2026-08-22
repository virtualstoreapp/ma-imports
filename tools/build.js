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
const { buildImageManifest, manifestOutputs } = require('./lib/images');
const { TEMPLATE_PATH, renderIssueForm } = require('./lib/issue-form');
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

  // dist/ is incremental, so a renamed or deleted category would otherwise
  // leave its old file behind forever — a live URL serving a frozen copy of the
  // catalog. Wave 3's underwear-man rename did exactly that.
  const expected = new Set([...categories, ALL_CATEGORY].map((slug) => `${slug}.json`));
  const stale = (await fsp.readdir(outputDir)).filter((file) => !expected.has(file));
  for (const file of stale) {
    await fsp.rm(path.join(outputDir, file));
  }

  return { categories: categories.length, products: all.length, stale: stale.length };
};

// Files scanned for direct image references. These are served verbatim, so any
// image they name has to exist in dist/ under exactly that path.
const REFERENCING_FILES = ['index.html', 'styles.css'];

/**
 * Collects the image paths that index.html and styles.css reference directly.
 *
 * These are site assets, not product images: the header logo rather than a
 * photo of a cap. They must be copied verbatim rather than replaced by a
 * generated derivative, because CON-2 requires the same markup to work in an
 * unbuilt source tree — where `images/logo.jpg` does not exist and only the
 * original `images/logo.jpeg` does.
 * @returns {Promise<string[]>} Referenced image paths, relative to the root.
 */
const collectSiteAssets = async () => {
  const refs = new Set();
  for (const file of REFERENCING_FILES) {
    const source = await fsp.readFile(path.join(ROOT, file), 'utf8');
    for (const [, ref] of source.matchAll(/(?:src|href)="(images\/[^"]+)"/g)) refs.add(ref);
    for (const [, , ref] of source.matchAll(/url\((["']?)(images\/[^)"']+)\1\)/g)) refs.add(ref);
  }
  return [...refs].sort();
};

/**
 * Copies the site assets into dist/, so markup that names them keeps working.
 * @param {string[]} assets Image paths relative to the root.
 * @returns {Promise<number>} Number of assets copied.
 */
const copySiteAssets = async (assets) => {
  let copied = 0;
  for (const relative of assets) {
    const from = path.join(ROOT, relative);
    const to = path.join(DIST, relative);
    try {
      await fsp.access(from);
    } catch {
      throw new Error(`${relative} is referenced by the site but does not exist in the source tree`);
    }
    await fsp.mkdir(path.dirname(to), { recursive: true });
    await fsp.copyFile(from, to);
    copied += 1;
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
  // `entry.src` is deliberately absent: originals are no longer copied into
  // dist/, so an original still sitting there is stale and should be pruned.
  const expected = new Set([...keep, ...manifestOutputs(manifest)]);

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

/**
 * Asserts dist/images holds exactly the files it should.
 *
 * Freshness is now decided by a recorded fingerprint rather than by looking at
 * the tree, so a cache that claims a derivative exists when it does not would
 * otherwise ship a broken image. This is the check that makes the cache safe to
 * trust.
 * @param {object} manifest Image manifest keyed by source path.
 * @param {string[]} keep Generated paths that belong to no product.
 * @returns {Promise<void>} Resolves when the tree is intact.
 */
const assertImagesIntact = async (manifest, keep) => {
  const expected = [...keep, ...manifestOutputs(manifest)];

  const missing = [];
  for (const relative of expected) {
    try {
      await fsp.access(path.join(DIST, relative));
    } catch {
      missing.push(relative);
    }
  }
  if (missing.length) {
    throw new Error(
      `${missing.length} declared derivative(s) missing from dist/:\n  ${missing.slice(0, 10).join('\n  ')}`
    );
  }

  const expectedSet = new Set(expected);
  const walk = async (relative) => {
    let entries;
    try {
      entries = await fsp.readdir(path.join(DIST, relative), { withFileTypes: true });
    } catch {
      return [];
    }
    const found = [];
    for (const entry of entries) {
      const entryRelative = path.posix.join(relative, entry.name);
      if (entry.isDirectory()) found.push(...(await walk(entryRelative)));
      else if (!expectedSet.has(entryRelative)) found.push(entryRelative);
    }
    return found;
  };

  const unexpected = await walk('images');
  if (unexpected.length) {
    throw new Error(
      `${unexpected.length} unreferenced file(s) in dist/images:\n  ${unexpected.slice(0, 10).join('\n  ')}`
    );
  }
};

/**
 * Asserts every image the site markup names resolves in dist/.
 *
 * Wave 5a stopped copying originals into dist/ and, with them, the header logo
 * that index.html references — a 404 nothing checked for. Validator rule 5
 * catches a file no product references; this is the opposite direction, a
 * reference with no file.
 * @param {string[]} assets Referenced image paths, relative to the root.
 * @returns {Promise<void>} Resolves when every reference resolves.
 */
const assertReferencesResolve = async (assets) => {
  const missing = [];
  for (const relative of assets) {
    try {
      await fsp.access(path.join(DIST, relative));
    } catch {
      missing.push(relative);
    }
  }
  if (missing.length) {
    const list = missing.join('\n  ');
    throw new Error(`${missing.length} image(s) referenced by the site are missing from dist/:\n  ${list}`);
  }
};

module.exports = {
  assertImagesIntact,
  assertReferencesResolve,
  collectSiteAssets,
  copySiteAssets,
  pruneImages,
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

  // Site assets are copied verbatim and must survive both the prune and the
  // integrity check, or the header logo 404s on the built site.
  const siteAssets = await collectSiteAssets();
  const copied = await copySiteAssets(siteAssets);
  const keep = [card.path, ...siteAssets];

  const pruned = await pruneImages(manifest, keep);
  if (copied || pruned) log(`images: ${copied} site asset(s) copied, ${pruned} stale file(s) pruned`);
  await assertImagesIntact(manifest, keep);
  await assertReferencesResolve(siteAssets);

  // The registry block in index.html is generated and committed, so a stale
  // block means the catalog and the client disagree about category identity.
  const registry = loadRegistry();
  const html = await fsp.readFile(path.join(ROOT, 'index.html'), 'utf8');
  if (applyBlock(html, renderRegistryElement(registry)) !== html) {
    throw new Error(
      'index.html registry block is stale — run `node tools/sync-registry.js` and commit the result'
    );
  }

  // The Issue Form's dropdowns *are* the registries, so a stale template means
  // the seller is offered categories or brands that no longer exist. This is the
  // closure that keeps the registries load-bearing rather than decorative.
  const formPath = path.join(ROOT, TEMPLATE_PATH);
  const currentForm = await fsp.readFile(formPath, 'utf8').catch(() => null);
  if (currentForm !== renderIssueForm(registry)) {
    throw new Error(
      `${TEMPLATE_PATH} is stale — run \`node tools/sync-issue-form.js\` and commit the result`
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

  const { categories, products, stale } = await writeProducts(manifest, registry.brands);
  log(`products: ${products} products across ${categories} categories`);
  if (stale) log(`products: ${stale} stale file(s) pruned`);
  if (warnings.length) log(`products: ${warnings.length} warning(s) above`);

  for (const file of STATIC_FILES) {
    await fsp.copyFile(path.join(ROOT, file), path.join(DIST, file));
  }

  // Publishing through the Pages Actions pipeline, so Jekyll must not run.
  await fsp.writeFile(path.join(DIST, '.nojekyll'), '', 'utf8');

  const seconds = Number(process.hrtime.bigint() - startedAt) / 1e9;
  log(`build: dist/ ready in ${seconds.toFixed(1)}s`);
};

if (require.main === module) {
  main().catch((error) => {
    process.exitCode = 1;
    process.stderr.write(`build failed: ${error.message}\n`);
  });
}
