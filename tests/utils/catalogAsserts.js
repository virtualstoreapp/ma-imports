"use strict";

const path = require('path');
const { waitFor } = require('@testing-library/dom');

const { buildAllCatalog, productImages, readCategory } = require('../../tools/lib/catalog');
const { loadRegistry } = require('../../tools/lib/registry');
const { toRuntime } = require('../../tools/lib/runtime');

const PRODUCTS_DIR = path.join(__dirname, '../../products');

// products/ holds the v2 authoring shape; the client reads the runtime shape the
// build derives from it. The invariants below describe rendering, so they compare
// the DOM against that derived shape rather than against the authoring fields.
//
// Note what this cannot catch: it checks rendering against the *current* data, so
// it cannot detect data lost during a migration. That is what
// tools/verify-migration.js is for — it compared against a pre-migration
// baseline and caught nine sold-out products that had silently gone back on sale.
const runtimeProducts = (products) => {
  const { brands } = loadRegistry();
  return products.map((product) => toRuntime(product, brands));
};

// Category suites assert invariants against the live catalog rather than
// snapshotting it. Byte-exact card and modal markup is pinned once, against a
// fixed fixture, in tests/catalog/fixture/catalog.fixture.test.js.
//
// Why: full-DOM snapshots of products/ made every product addition rewrite
// hundreds of unrelated snapshot lines (products/all.json is a global re-sort),
// so the snapshots were regenerated wholesale instead of reviewed. Expected
// counts are derived from the source files for the same reason — a hardcoded
// 241 has to be hand-edited on every addition.

const assertExpectedHeading = async (expectedHeading) => {
  await waitFor(() => {
    expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
  });
};

const assertExpectedProductQuantity = async (expectedCount) => {
  await waitFor(() => {
    expect(document.querySelectorAll('#product-list .product-item').length).toEqual(expectedCount);
  });
};

/**
 * Asserts that the rendered grid faithfully represents the given products,
 * without pinning the exact markup.
 * @param {object[]} products The products that were served, in render order.
 */
const assertCardInvariants = (products) => {
  const cards = Array.from(document.querySelectorAll('#product-list .product-item'));
  expect(cards).toHaveLength(products.length);

  // Product text reaches the DOM through innerHTML, so nothing in the data may
  // introduce an element. tests/behaviour/catalog.escaping.test.js covers the
  // hostile case in detail; this is the catalog-wide guard.
  expect(document.querySelectorAll('#product-list script')).toHaveLength(0);

  const names = new Set(products.map((product) => product.name));

  cards.forEach((card) => {
    const heading = card.querySelector('h3');
    expect(heading).toBeTruthy();
    // The rendered name round-trips to a name that exists in the source data,
    // which catches truncation, double-escaping and off-by-one merges.
    expect(names.has(heading.textContent)).toBe(true);

    const img = card.querySelector('img');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBeTruthy();
    expect(img.getAttribute('alt')).toBe(heading.textContent);
    expect(img).toHaveAttribute('loading', 'lazy');

    // Exactly one of the two price shapes, never both and never neither.
    const plainPrice = card.querySelector('.price');
    const discounted = card.querySelector('.old-price') && card.querySelector('.new-price');
    expect(Boolean(plainPrice) !== Boolean(discounted)).toBe(true);
  });

  // Optional fields render exactly as often as the data declares them.
  //
  // These count sizes per *unit*, not per product. The previous version tested
  // `product.size`, a v1 field, and after the v2 switch it compared 0 against 0
  // — passing without checking anything. Counting units keeps the assertion
  // anchored to something that exists.
  const units = products.flatMap((product) => product.sizes || []);

  const expected = {
    soldOut: products.filter((product) => product.soldOut === true).length,
    description: products.filter((product) => product.description).length,
    sizeBlocks: products.filter((product) => (product.sizes || []).length).length,
    notes: products.filter((product) => !(product.sizes || []).length && product.sizeNote).length,
    chips: units.length,
    soldOutChips: units.filter((unit) => unit.soldOut === true).length,
  };

  expect(document.querySelectorAll('#product-list .sold-out-label')).toHaveLength(expected.soldOut);
  expect(document.querySelectorAll('#product-list .description')).toHaveLength(expected.description);
  expect(document.querySelectorAll('#product-list .sizes')).toHaveLength(expected.sizeBlocks);
  expect(document.querySelectorAll('#product-list .size-note')).toHaveLength(expected.notes);
  expect(document.querySelectorAll('#product-list .size-chip')).toHaveLength(expected.chips);
  expect(document.querySelectorAll('#product-list .size-chip-sold-out'))
    .toHaveLength(expected.soldOutChips);

  // A row is badged only when every unit in it is gone, so a partly sold-out row
  // keeps selling — the whole point of tracking availability per unit.
  products
    .filter((product) => (product.sizes || []).length && !product.sizes.every((u) => u.soldOut === true))
    .forEach((product) => {
      expect(product.soldOut).not.toBe(true);
    });

  // Every product contributes at least one image reference, so no card can
  // silently render without art.
  products.forEach((product) => {
    expect(productImages(product).length).toBeGreaterThan(0);
  });
};

/**
 * Asserts a single category renders correctly, deriving the expected count from
 * the category file rather than a hardcoded number.
 * @param {string} expectedHeading Heading text for the category.
 * @param {string} categorySlug Slug matching products/{slug}.json.
 */
const assertCategory = async (expectedHeading, categorySlug) => {
  const products = runtimeProducts(readCategory(PRODUCTS_DIR, categorySlug));
  expect(products.length).toBeGreaterThan(0);

  await assertExpectedHeading(expectedHeading);
  await assertExpectedProductQuantity(products.length);
  assertCardInvariants(products);
};

/**
 * Asserts the homepage renders the full merged catalog.
 */
const assertAllProducts = async () => {
  const products = runtimeProducts(buildAllCatalog(PRODUCTS_DIR));
  expect(products.length).toBeGreaterThan(0);

  await assertExpectedHeading('Novidades');
  await assertExpectedProductQuantity(products.length);
  assertCardInvariants(products);
};

module.exports = {
  PRODUCTS_DIR,
  assertAllProducts,
  assertCardInvariants,
  assertCategory,
  assertExpectedHeading,
  assertExpectedProductQuantity,
};
