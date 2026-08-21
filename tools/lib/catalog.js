'use strict';

const fs = require('fs');
const path = require('path');

// Product names embed a [DDMMYYHHmm] code used for newest-first ordering.
const PRODUCT_DATE_PATTERN = /\[(\d{10})\]/;

// Name of the generated, pre-merged catalog served to the homepage.
const ALL_CATEGORY = 'all';

/**
 * Parses the [DDMMYYHHmm] code embedded in a product name.
 * Products without a parseable code sort to the end.
 * @param {string} name Product name.
 * @returns {Date} Parsed date, or the epoch when no code is present.
 */
const parseProductDate = (name) => {
  const match = name ? name.match(PRODUCT_DATE_PATTERN) : null;
  if (!match) return new Date(0);

  const code = match[1];
  return new Date(
    2000 + Number(code.slice(4, 6)),
    Number(code.slice(2, 4)) - 1,
    Number(code.slice(0, 2)),
    Number(code.slice(6, 8)),
    Number(code.slice(8, 10))
  );
};

/**
 * Lists the category slugs backed by a products/*.json file.
 * @param {string} productsDir Path to the products directory.
 * @returns {string[]} Sorted category slugs, excluding the generated catalog.
 */
const listCategories = (productsDir) =>
  fs
    .readdirSync(productsDir)
    .filter((file) => file.endsWith('.json') && file !== `${ALL_CATEGORY}.json`)
    .map((file) => path.basename(file, '.json'))
    .sort();

/**
 * Reads and parses a single category file.
 * @param {string} productsDir Path to the products directory.
 * @param {string} category Category slug.
 * @returns {object[]} Products declared in that category.
 */
const readCategory = (productsDir, category) => {
  const filePath = path.join(productsDir, `${category}.json`);
  try {
    const products = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (!Array.isArray(products)) {
      throw new Error('expected a JSON array of products');
    }
    return products;
  } catch (error) {
    throw new Error(`Invalid product file ${category}.json: ${error.message}`);
  }
};

/**
 * Returns the timestamp a product sorts by, newest first.
 *
 * v2 states this explicitly in `listedAt`, in UTC. v1 derived it by regex from
 * the display name using local-time construction, so the build host's timezone
 * affected tie ordering. The v1 path remains for fixtures that still use the old
 * shape, and goes with the rest of it in Wave 5b.
 * @param {object} product Product entry.
 * @returns {number} Milliseconds since the epoch.
 */
const productSortKey = (product) => {
  if (typeof product.listedAt === 'string') {
    const parsed = Date.parse(product.listedAt);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return parseProductDate(product.name).getTime();
};

/**
 * Returns the image paths referenced by a product, newest schema first.
 * @param {object} product Product entry.
 * @returns {string[]} Referenced image paths.
 */
const productImages = (product) => {
  if (Array.isArray(product.images)) return product.images;
  return product.image ? [product.image] : [];
};

/**
 * Merges every category into one newest-first list.
 * Each product is tagged with its source category so the homepage can report
 * the real category instead of the "Novidades" heading.
 * @param {string} productsDir Path to the products directory.
 * @returns {object[]} Merged, sorted products.
 */
const buildAllCatalog = (productsDir) =>
  listCategories(productsDir)
    .flatMap((category) =>
      readCategory(productsDir, category).map((product) => ({ ...product, category }))
    )
    .sort((a, b) => productSortKey(b) - productSortKey(a));

module.exports = {
  ALL_CATEGORY,
  PRODUCT_DATE_PATTERN,
  buildAllCatalog,
  listCategories,
  parseProductDate,
  productImages,
  productSortKey,
  readCategory,
};
