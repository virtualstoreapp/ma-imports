'use strict';

const Ajv = require('ajv');
const fs = require('fs');
const path = require('path');

const CATALOG_DIR = path.join(__dirname, '../../catalog');
const SCHEMA_DIR = path.join(__dirname, '../../schemas');

const DEFAULT_CATEGORIES_PATH = path.join(CATALOG_DIR, 'categories.json');
const DEFAULT_BRANDS_PATH = path.join(CATALOG_DIR, 'brands.json');

const CATEGORIES_SCHEMA_PATH = path.join(SCHEMA_DIR, 'categories.schema.json');
const BRANDS_SCHEMA_PATH = path.join(SCHEMA_DIR, 'brands.schema.json');

// The element scripts.js reads the injected registry from.
const REGISTRY_ELEMENT_ID = 'category-registry';

// Unique delimiters around the generated block in index.html. Markers rather
// than a pattern matched against the element itself: an earlier version anchored
// on an optional HTML comment, and the comment group matched from the Open Graph
// comment near the top of the file all the way to a later </script>, replacing
// most of the document. A unique start marker cannot do that.
const REGISTRY_START_MARKER = '<!-- registry:start -->';
const REGISTRY_END_MARKER = '<!-- registry:end -->';

const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

/**
 * Validates a document against a schema, throwing with every defect listed.
 * @param {object} document Parsed document.
 * @param {string} schemaPath Path to the schema.
 * @param {string} label Human-readable document name for the message.
 */
const assertValid = (document, schemaPath, label) => {
  const validate = new Ajv({ allErrors: true, strict: true }).compile(readJson(schemaPath));
  if (validate(document)) return;

  const detail = validate.errors
    .map((error) => `  ${label}${error.instancePath} ${error.message}`)
    .join('\n');
  throw new Error(`${label} is invalid:\n${detail}`);
};

/**
 * Walks the nav tree depth-first, in display order.
 * @param {object[]} nodes Nav nodes.
 * @returns {object[]} Every node, flattened.
 */
const flattenNav = (nodes) =>
  nodes.flatMap((node) => [node, ...(node.children ? flattenNav(node.children) : [])]);

/**
 * Loads and validates the category and brand registries.
 *
 * Throws rather than degrading: every consumer here is build-time, and a
 * malformed registry would otherwise produce a site with silently missing
 * categories.
 * @param {object} [options] Overrides, for tests.
 * @param {string} [options.categoriesPath] Path to categories.json.
 * @param {string} [options.brandsPath] Path to brands.json.
 * @returns {object} The loaded registry and derived lookups.
 */
const loadRegistry = ({
  categoriesPath = DEFAULT_CATEGORIES_PATH,
  brandsPath = DEFAULT_BRANDS_PATH,
} = {}) => {
  const categories = readJson(categoriesPath);
  const brands = readJson(brandsPath);

  assertValid(categories, CATEGORIES_SCHEMA_PATH, 'catalog/categories.json');
  assertValid(brands, BRANDS_SCHEMA_PATH, 'catalog/brands.json');

  const nodes = flattenNav(categories.nav);
  const leaves = nodes.filter((node) => node.type === 'leaf');
  const groups = nodes.filter((node) => node.type === 'group');
  const generated = nodes.filter((node) => node.type === 'generated');

  // A slug declared twice would make lookups order-dependent, and the schema
  // cannot express uniqueness across a recursive tree.
  const duplicates = nodes
    .map((node) => node.slug)
    .filter((slug, index, all) => all.indexOf(slug) !== index);
  if (duplicates.length) {
    throw new Error(`catalog/categories.json declares duplicate slugs: ${[...new Set(duplicates)].join(', ')}`);
  }

  const aliases = categories.aliases || {};
  const bySlug = new Map(nodes.map((node) => [node.slug, node]));

  const aliasProblems = Object.entries(aliases).filter(([from, to]) => bySlug.has(from) || !bySlug.has(to));
  if (aliasProblems.length) {
    throw new Error(
      `catalog/categories.json has unusable aliases: ${aliasProblems
        .map(([from, to]) => `${from} -> ${to}`)
        .join(', ')} (the source must be retired, and the target must exist)`
    );
  }

  return {
    categories,
    brands: brands.brands,
    nodes,
    leaves,
    groups,
    generated,
    aliases,
    bySlug,
    leafSlugs: leaves.map((leaf) => leaf.slug),
  };
};

/**
 * Builds the compact payload injected into index.html and read by scripts.js.
 *
 * Only what the client needs: heading labels for the categories it may render,
 * the product-backed slugs for the unbuilt-tree fallback merge, and the alias
 * map so an old deep link still resolves.
 * @param {object} registry Output of loadRegistry.
 * @returns {object} Client payload.
 */
const buildClientRegistry = (registry) => {
  const labels = {};
  for (const node of [...registry.generated, ...registry.leaves]) {
    labels[node.slug] = node.label;
  }

  return {
    labels,
    leaves: registry.leafSlugs,
    aliases: registry.aliases,
  };
};

/**
 * Renders the client payload as the script element committed to index.html.
 * @param {object} registry Output of loadRegistry.
 * @returns {string} The full element, including its generated-file warning.
 */
const renderRegistryElement = (registry) => {
  const payload = JSON.stringify(buildClientRegistry(registry), null, 2)
    .split('\n')
    .map((line) => (line ? `    ${line}` : line))
    .join('\n');

  return [
    `  ${REGISTRY_START_MARKER}`,
    '  <!-- Generated from catalog/categories.json by `node tools/sync-registry.js`.',
    '       Do not edit by hand; the build fails when this block is stale.',
    '       Committed rather than injected at build time so an unbuilt checkout still renders. -->',
    `  <script id="${REGISTRY_ELEMENT_ID}" type="application/json">`,
    payload,
    '  </script>',
    `  ${REGISTRY_END_MARKER}`,
  ].join('\n');
};

module.exports = {
  BRANDS_SCHEMA_PATH,
  CATEGORIES_SCHEMA_PATH,
  DEFAULT_BRANDS_PATH,
  DEFAULT_CATEGORIES_PATH,
  REGISTRY_ELEMENT_ID,
  REGISTRY_END_MARKER,
  REGISTRY_START_MARKER,
  buildClientRegistry,
  flattenNav,
  loadRegistry,
  renderRegistryElement,
};
