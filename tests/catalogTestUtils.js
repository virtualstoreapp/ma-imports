"use strict";

const fs = require('fs');
const path = require('path');
const { waitFor, fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');

/**
 * Reads and parses a JSON file from the products directory.
 * @param {string} fileName - Name of the JSON file.
 * @returns {Object} Parsed JSON content.
 */
const readProductsJson = (fileName) => {
  try {
    const filePath = path.join(__dirname, '../products', fileName);
    const fileContents = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(fileContents);
  } catch (error) {
    throw new Error(`Error reading file ${fileName}: ${error.message}`);
  }
};

/**
 * Sets up a global fetch mock for product JSON requests.
 */
const setupGlobalFetchMock = () => {
  global.fetch = jest.fn((url) => {
    const match = url.match(/products\/(.*)\.json/);
    const category = match ? match[1] : null;
    if (category) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(readProductsJson(`${category}.json`))
      });
    }
    return Promise.reject(new Error(`Unknown URL: ${url}`));
  });
};

/**
 * Loads index.html content from disk.
 * @returns {string} The HTML content.
 */
const loadHtml = () => {
  return fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
};

/**
 * Initializes the DOM for testing.
 */
const setupDOM = () => {
  delete window.__catalogInitialized;
  document.documentElement.innerHTML = loadHtml();
  jest.resetModules();
  require('../scripts.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
};

/**
 * Simulates clicking a category button and waits for updates.
 * @param {string} category - The data-category value.
 * @param {string} expectedHeading - Expected heading after selection.
 */
const selectCategory = async (category, expectedHeading) => {
  const button = document.querySelector(`nav button[data-category="${category}"]`);
  if (!button) throw new Error(`Button for category '${category}' not found`);
  fireEvent.click(button);
  await waitFor(() => {
    expect(document.getElementById('category-heading').textContent).toBe(expectedHeading);
  });
  await waitFor(() => {
    const productList = document.getElementById('product-list');
    expect(productList.children.length).toBeGreaterThan(0);
  });
};

/**
 * Sets up mobile view and triggers the menu toggle.
 */
const setupMobile = async () => {
  window.innerWidth = 375;
  window.dispatchEvent(new Event('resize'));
  await waitFor(() => {
    expect(document.getElementById('menu-toggle')).toBeInTheDocument();
  });
  const menuButton = document.getElementById('menu-toggle');
  fireEvent.click(menuButton);
};

/**
 * Combines mobile setup and category selection.
 * @param {string} category - The data-category value.
 * @param {string} expectedHeading - Expected heading.
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
