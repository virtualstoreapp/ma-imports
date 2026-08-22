"use strict";

const path = require('path');
const { waitFor } = require('@testing-library/dom');
require('@testing-library/jest-dom');

const { buildAllCatalog } = require('../../tools/lib/catalog');
const { setupDOM } = require('./catalogCommon');

// The fixture directory is laid out like products/, so buildAllCatalog can read
// it directly. That means the fixture exercises the real merge-and-sort path
// instead of a reimplementation of it. See tests/fixtures/catalog/README.md.
const FIXTURES_DIR = path.join(__dirname, '../fixtures/catalog');

const buildFixtureCatalog = () => buildAllCatalog(FIXTURES_DIR);

/**
 * Renders the app against the fixture catalog instead of products/.
 * @returns {Promise<object[]>} The merged, sorted fixture catalog that was served.
 */
const setupFixtureCatalog = async () => {
  window.__isTest = true;
  global.gtag = jest.fn();
  document.body.innerHTML = '';
  window.location.hash = '';

  const catalog = buildFixtureCatalog();
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve(catalog) })
  );

  setupDOM();
  await waitFor(() => {
    expect(document.querySelectorAll('#product-list .product-item')).toHaveLength(catalog.length);
  });

  return catalog;
};

module.exports = {
  FIXTURES_DIR,
  buildFixtureCatalog,
  setupFixtureCatalog,
};
