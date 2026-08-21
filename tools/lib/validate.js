'use strict';

const fs = require('fs');

const {
  ALL_CATEGORY,
  PRODUCT_DATE_PATTERN,
  listCategories,
  productImages,
  readCategory,
} = require('./catalog');

const CATEGORIES_DICT_NAME = 'CATEGORIES_DICT';

/**
 * Extracts the CATEGORIES_DICT keys declared in scripts.js.
 * The client uses that map for both the headings and the per-category fallback
 * merge, so a category present in only one of the two places is a real defect:
 * an unlisted file is unreachable, and a listed file that does not exist makes
 * the fallback merge request a 404.
 * @param {string} scriptsPath Path to scripts.js.
 * @returns {string[]} Declared category keys, including the generated one.
 */
const readCategoryDictKeys = (scriptsPath) => {
  const source = fs.readFileSync(scriptsPath, 'utf8');
  const declaration = source.indexOf(CATEGORIES_DICT_NAME);
  const start = declaration === -1 ? -1 : source.indexOf('{', declaration);
  if (start === -1) {
    throw new Error(`Could not locate ${CATEGORIES_DICT_NAME} in ${scriptsPath}`);
  }

  let depth = 0;
  let end = -1;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }
  if (end === -1) throw new Error(`Unterminated ${CATEGORIES_DICT_NAME} literal`);

  // Matches `key: '...'` for quoted, double-quoted and bare keys.
  const keys = [
    ...source
      .slice(start, end + 1)
      .matchAll(/(?:'([^']+)'|"([^"]+)"|([A-Za-z_$][\w$]*))\s*:\s*'/g),
  ].map(([, single, double, bare]) => single || double || bare);

  if (!keys.length) throw new Error(`No entries parsed from ${CATEGORIES_DICT_NAME}`);
  return keys;
};

/**
 * Checks that every category file is reachable from the menu map, and vice versa.
 * @param {string[]} categories Category slugs backed by a products file.
 * @param {string[]} dictKeys Keys declared in CATEGORIES_DICT.
 * @returns {string[]} Error messages.
 */
const checkCategoryCoverage = (categories, dictKeys) => {
  const declared = new Set(dictKeys.filter((key) => key !== ALL_CATEGORY));
  const onDisk = new Set(categories);

  return [
    ...categories
      .filter((category) => !declared.has(category))
      .map(
        (category) =>
          `products/${category}.json has no ${CATEGORIES_DICT_NAME} entry, so its products are unreachable`
      ),
    ...[...declared]
      .filter((category) => !onDisk.has(category))
      .map(
        (category) =>
          `${CATEGORIES_DICT_NAME} declares "${category}" but products/${category}.json does not exist`
      ),
  ];
};

/**
 * Validates one product's fields.
 * @param {object} product Product entry.
 * @param {string} where Human-readable location for messages.
 * @param {object|null} manifest Image manifest, or null to skip file checks.
 * @returns {string[]} Error messages.
 */
const checkProduct = (product, where, manifest) => {
  const errors = [];
  const fail = (message) => errors.push(`${where}: ${message}`);

  if (typeof product.name !== 'string' || !product.name.trim()) {
    fail('name must be a non-empty string');
  } else if (!PRODUCT_DATE_PATTERN.test(product.name)) {
    fail('name is missing its [DDMMYYHHmm] code, which drives the newest-first order');
  }

  if (!Number.isFinite(product.price) || product.price <= 0) {
    fail(`price must be a positive number (got ${JSON.stringify(product.price)})`);
  }

  if (product.oldPrice !== undefined) {
    if (!Number.isFinite(product.oldPrice) || product.oldPrice < 0) {
      fail(`oldPrice must be a non-negative number (got ${JSON.stringify(product.oldPrice)})`);
    } else if (product.oldPrice > 0 && product.oldPrice <= product.price) {
      // The card strikes oldPrice through, so this would advertise a rise as a cut.
      fail(`oldPrice ${product.oldPrice} must exceed price ${product.price} to read as a discount`);
    }
  }

  if (product.description !== undefined && typeof product.description !== 'string') {
    fail('description must be a string when present');
  }

  if (product.size !== undefined && typeof product.size !== 'string') {
    fail('size must be a string when present');
  }

  if (product.soldOut !== undefined && typeof product.soldOut !== 'boolean') {
    fail(`soldOut must be a boolean when present (got ${JSON.stringify(product.soldOut)})`);
  }

  const images = productImages(product);
  if (!images.length) {
    fail('must reference at least one image via "images" or "image"');
  }
  images.forEach((source) => {
    if (typeof source !== 'string' || !source.trim()) {
      fail(`image reference must be a non-empty string (got ${JSON.stringify(source)})`);
      return;
    }
    if (manifest && !manifest[source]) {
      fail(`image ${source} does not exist on disk`);
    }
  });

  return errors;
};

/**
 * Validates the whole catalog, collecting every problem rather than stopping at
 * the first, so a catalog update PR reports all its defects in one run.
 * @param {object} options Validation options.
 * @param {string} options.productsDir Path to the products directory.
 * @param {string} options.scriptsPath Path to scripts.js.
 * @param {object} [options.manifest] Image manifest keyed by source path.
 * @returns {{errors: string[], warnings: string[]}} Collected problems.
 */
const validateCatalog = ({ productsDir, scriptsPath, manifest = null }) => {
  const errors = [];
  const warnings = [];

  const categories = listCategories(productsDir);
  errors.push(...checkCategoryCoverage(categories, readCategoryDictKeys(scriptsPath)));

  // Product codes identify a product in the WhatsApp message, so a collision
  // leaves the seller unable to tell which item was requested.
  const seenIds = new Map();

  for (const category of categories) {
    readCategory(productsDir, category).forEach((product, index) => {
      const label = typeof product.name === 'string' ? product.name : '(unnamed)';
      const where = `${category}.json[${index}] "${label}"`;
      errors.push(...checkProduct(product, where, manifest));

      const match = typeof product.name === 'string' && product.name.match(PRODUCT_DATE_PATTERN);
      if (!match) return;
      const previous = seenIds.get(match[1]);
      if (previous) {
        warnings.push(
          `duplicate product code [${match[1]}]: ${previous} and ${where} — the WhatsApp message cannot distinguish them`
        );
      } else {
        seenIds.set(match[1], where);
      }
    });
  }

  return { errors, warnings };
};

module.exports = {
  checkCategoryCoverage,
  checkProduct,
  readCategoryDictKeys,
  validateCatalog,
};
