// tests/catalogTestUtils.js
const fs = require('fs');
const path = require('path');
const { waitFor, fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');

/**
 * Reads and parses a JSON file from the products directory.
 *
 * @param {string} fileName - Name of the JSON file to read.
 * @returns {Object} Parsed JSON content.
 * @throws Will throw an error if the file cannot be read or parsed.
 */
const readProductsJson = (fileName) => {
  try {
    const filePath = path.resolve(__dirname, '../products', fileName);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Error reading file ${fileName}: ${error.message}`);
  }
};

/**
 * Sets up a global fetch mock that intercepts requests for product JSON files.
 */
const setupGlobalFetchMock = () => {
  global.fetch = jest.fn((url) => {
    // Extract category name from URL (e.g., "shoes" from "products/shoes.json")
    const category = url.match(/products\/(.*)\.json/)?.[1];
    if (category) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(readProductsJson(`${category}.json`)),
      });
    }
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
};

/**
 * Loads the contents of index.html from disk.
 *
 * @returns {string} The HTML content of index.html.
 */
const loadHtml = () => {
  return fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
};

/**
 * Initializes the DOM for testing by loading the HTML,
 * resetting modules, and dispatching the DOMContentLoaded event.
 */
const setupDOM = () => {
  // Remove any custom flags to ensure fresh initialization
  delete window.__catalogInitialized;
  document.documentElement.innerHTML = loadHtml();
  jest.resetModules();
  require('../scripts.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
};

/**
 * Simulates a click on a category button, then waits for the expected updates.
 *
 * @param {string} category - The data-category attribute value.
 * @param {string} expectedHeading - The expected heading text after selection.
 * @returns {Promise<void>}
 */
const selectCategory = async (category, expectedHeading) => {
  const button = document.querySelector(`nav button[data-category="${category}"]`);
  if (!button) throw new Error(`Button for category '${category}' not found`);

  fireEvent.click(button);

  // Wait for the category heading to update
  await waitFor(() => {
    expect(document.getElementById('category-heading').textContent).toBe(expectedHeading);
  });

  // Wait for products to be rendered correctly
  await waitFor(() => {
    const productList = document.getElementById('product-list');
    expect(productList.children.length).toBeGreaterThan(0);
    expect(new Set(productList.children).size).toBe(productList.children.length);
  });
};

/**
 * Simulates a mobile menu interaction by resizing the window,
 * triggering the menu toggle, and waiting for the toggle to appear.
 *
 * @returns {Promise<void>}
 */
const setupMobile = async () => {
  window.innerWidth = 375;
  window.dispatchEvent(new Event('resize'));

  // Wait for the mobile menu toggle button to be present
  await waitFor(() => {
    expect(document.getElementById('menu-toggle')).toBeInTheDocument();
  });

  const menuButton = document.getElementById('menu-toggle');
  fireEvent.click(menuButton);
};

/**
 * Combines mobile menu setup and category selection for mobile testing.
 *
 * @param {string} category - The data-category value to select.
 * @param {string} expectedHeading - The expected heading after selection.
 * @returns {Promise<void>}
 */
const selectMobileCategory = async (category, expectedHeading) => {
  await setupMobile();
  await selectCategory(category, expectedHeading);
};

module.exports = {
  readProductsJson,
  setupGlobalFetchMock,
  loadHtml,
  setupDOM,
  selectCategory,
  setupMobile,
  selectMobileCategory,
  waitFor,
  fireEvent,
};
