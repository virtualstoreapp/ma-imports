'use strict';

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const {
  ALL_CATEGORY,
  PRODUCT_DATE_PATTERN,
  listCategories,
  productImages,
  readCategory,
} = require('./catalog');

const CATEGORIES_DICT_NAME = 'CATEGORIES_DICT';

const DEFAULT_SCHEMA_PATH = path.join(__dirname, '../../schemas/product.schema.json');

// Images that legitimately live under images/ without belonging to a product.
// Kept explicit so an orphan is a reported warning rather than an assumption.
const NON_CATALOG_IMAGES = new Set(['images/logo.jpeg']);

// Multi-image products distinguish their photos with these suffixes. Both are in
// use across all 23 multi-image products, and no single-image product carries
// one, so the vocabulary is closed rather than merely conventional.
const IMAGE_VARIANTS = new Set(['front', 'back']);

// Image filenames are expected to lead with the owning product's 10-digit code.
// The convention is validated rather than computed: the path stays an explicit
// field, because four references disagreed with their product code before this
// check existed and a computed path would have broken on all four.
const IMAGE_LEADING_DIGITS = /^(\d+)/;
const PRODUCT_CODE_LENGTH = 10;

/**
 * Checks one image reference against the filename convention.
 * @param {string} source Referenced image path.
 * @param {string|null} productCode The owning product's code, or null when the
 *   name has no parseable code (already reported separately).
 * @returns {string|null} An error message, or null when the reference conforms.
 */
const checkImageName = (source, productCode) => {
  if (!productCode) return null;

  const basename = path.posix.basename(source);
  const leading = IMAGE_LEADING_DIGITS.exec(basename);

  if (!leading) {
    return `image ${source} must be named after its product code [${productCode}]`;
  }
  if (leading[1].length !== PRODUCT_CODE_LENGTH) {
    return `image ${source} leads with ${leading[1].length} digits; the product code is ${PRODUCT_CODE_LENGTH} (expected [${productCode}])`;
  }
  if (leading[1] !== productCode) {
    return `image ${source} is named for [${leading[1]}] but belongs to [${productCode}]`;
  }
  return null;
};

/**
 * Compiles the product schema.
 * Kept as a factory so tests can validate against a schema of their own without
 * reaching into module state.
 * @param {string} [schemaPath] Path to the schema document.
 * @returns {Function} An ajv validate function carrying `.errors`.
 */
const compileProductSchema = (schemaPath = DEFAULT_SCHEMA_PATH) => {
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8'));
  // allErrors so a catalog update PR sees every schema defect in one run, which
  // is the same reason the hand-written checks collect rather than fail fast.
  return new Ajv({ allErrors: true, strict: true }).compile(schema);
};

/**
 * Renders one ajv error against a category file as a human-readable message.
 * `/0/price` reads as `[0].price`, so the message points at the product a
 * reviewer can actually find.
 * @param {object} error An ajv error object.
 * @param {string} category Category slug.
 * @returns {string} Error message.
 */
const formatSchemaError = (error, category) => {
  const location = error.instancePath
    .replace(/^\//, '')
    .split('/')
    .map((segment) => (/^\d+$/.test(segment) ? `[${segment}]` : `.${segment}`))
    .join('')
    .replace(/^\./, '');

  const where = location ? `${category}.json${location.startsWith('[') ? '' : '.'}${location}` : `${category}.json`;
  const detail = error.keyword === 'additionalProperties'
    ? `has unknown property "${error.params.additionalProperty}"`
    : error.message;

  return `${where} ${detail}`;
};

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
 * Returns the trailing `-front` / `-back` suffix of an image basename, if any.
 * @param {string} source Referenced image path.
 * @returns {string|null} The variant name, or null when the name carries none.
 */
const imageVariant = (source) => {
  const basename = path.posix.basename(source, path.posix.extname(source));
  const last = basename.split('-').pop();
  return IMAGE_VARIANTS.has(last) ? last : null;
};

/**
 * Checks that a product's photos are distinguishable by variant suffix.
 *
 * A product with several photos needs them ordered deterministically, since the
 * card shows images[0] and the modal steps through the rest. A lone `-front`
 * usually means its `-back` was forgotten.
 * @param {string[]} images The product's image references.
 * @returns {string[]} Error messages.
 */
const checkImageVariants = (images) => {
  const usable = images.filter((source) => typeof source === 'string' && source.trim());
  const variants = usable.map((source) => ({ source, variant: imageVariant(source) }));

  if (usable.length === 1) {
    const [only] = variants;
    return only.variant
      ? [
          `image ${only.source} carries the "${only.variant}" suffix but is the product's only photo — its counterpart is missing`,
        ]
      : [];
  }

  const errors = [];
  const missing = variants.filter((entry) => !entry.variant);
  missing.forEach(({ source }) => {
    errors.push(
      `image ${source} needs a "${[...IMAGE_VARIANTS].join('" or "')}" suffix, because the product has ${usable.length} photos to order`
    );
  });

  const seen = new Map();
  variants
    .filter((entry) => entry.variant)
    .forEach(({ source, variant }) => {
      const previous = seen.get(variant);
      if (previous) {
        errors.push(`images ${previous} and ${source} both claim the "${variant}" variant`);
      } else {
        seen.set(variant, source);
      }
    });

  return errors;
};

/**
 * Finds images on disk that no product references.
 *
 * A warning rather than an error: an orphan wastes repository space and shows up
 * in `dist/`, but it never breaks the site, and failing a build over one would
 * block a deploy for a tidiness problem.
 * @param {object} manifest Image manifest keyed by source path — effectively the
 *   list of every image file on disk.
 * @param {Set<string>} referenced Image paths referenced by the catalog.
 * @returns {string[]} Warning messages.
 */
const checkOrphanImages = (manifest, referenced) =>
  Object.keys(manifest)
    .filter((source) => !referenced.has(source) && !NON_CATALOG_IMAGES.has(source))
    .sort()
    .map(
      (source) =>
        `${source} is not referenced by any product — delete it, or add it to NON_CATALOG_IMAGES if it is used outside the catalog`
    );

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

  let productCode = null;
  if (typeof product.name !== 'string' || !product.name.trim()) {
    fail('name must be a non-empty string');
  } else {
    const match = product.name.match(PRODUCT_DATE_PATTERN);
    if (!match) {
      fail('name is missing its [DDMMYYHHmm] code, which drives the newest-first order');
    } else {
      [, productCode] = match;
    }
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
    const namingError = checkImageName(source, productCode);
    if (namingError) fail(namingError);
  });
  checkImageVariants(images).forEach(fail);

  return errors;
};

/**
 * Validates the whole catalog, collecting every problem rather than stopping at
 * the first, so a catalog update PR reports all its defects in one run.
 * @param {object} options Validation options.
 * @param {string} options.productsDir Path to the products directory.
 * @param {string} options.scriptsPath Path to scripts.js.
 * @param {object} [options.manifest] Image manifest keyed by source path.
 * @param {string} [options.schemaPath] Path to the product schema.
 * @returns {{errors: string[], warnings: string[]}} Collected problems.
 */
const validateCatalog = ({ productsDir, scriptsPath, manifest = null, schemaPath }) => {
  const errors = [];
  const warnings = [];

  const categories = listCategories(productsDir);
  errors.push(...checkCategoryCoverage(categories, readCategoryDictKeys(scriptsPath)));

  const matchesSchema = compileProductSchema(schemaPath);

  // Product codes identify a product in the WhatsApp message, so a collision
  // leaves the seller unable to tell which item was requested. Enforced as an
  // error: none exist today, which makes now the only cheap moment to close it.
  const seenIds = new Map();
  const referencedImages = new Set();

  for (const category of categories) {
    const products = readCategory(productsDir, category);

    // Schema first: it catches shape defects (unknown property, wrong type) that
    // would otherwise surface as a confusing cascade of field-level messages.
    if (!matchesSchema(products)) {
      errors.push(...matchesSchema.errors.map((error) => formatSchemaError(error, category)));
    }

    products.forEach((product, index) => {
      const label = typeof product.name === 'string' ? product.name : '(unnamed)';
      const where = `${category}.json[${index}] "${label}"`;
      errors.push(...checkProduct(product, where, manifest));

      productImages(product).forEach((source) => {
        if (typeof source === 'string') referencedImages.add(source);
      });

      const match = typeof product.name === 'string' && product.name.match(PRODUCT_DATE_PATTERN);
      if (!match) return;
      const previous = seenIds.get(match[1]);
      if (previous) {
        errors.push(
          `duplicate product code [${match[1]}]: ${previous} and ${where} — the WhatsApp message cannot distinguish them`
        );
      } else {
        seenIds.set(match[1], where);
      }
    });
  }

  if (manifest) warnings.push(...checkOrphanImages(manifest, referencedImages));

  return { errors, warnings };
};

module.exports = {
  DEFAULT_SCHEMA_PATH,
  IMAGE_VARIANTS,
  NON_CATALOG_IMAGES,
  checkCategoryCoverage,
  checkImageName,
  checkImageVariants,
  checkOrphanImages,
  checkProduct,
  compileProductSchema,
  formatSchemaError,
  imageVariant,
  readCategoryDictKeys,
  validateCatalog,
};
