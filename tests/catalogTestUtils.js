// tests/catalogTestUtils.js
const fs = require('fs');
const path = require('path');
const { waitFor, fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');

// Helper: Read a JSON product file from disk
const readProductsJson = (fileName) => {
  const filePath = path.resolve(__dirname, '../products', fileName);
  const fileContents = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(fileContents);
};

// Setup global fetch mock to read products from disk
const setupGlobalFetchMock = () => {
  global.fetch = jest.fn((url) => {
    if (url.includes('shoes.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(readProductsJson('shoes.json'))
      });
    }
    if (url.includes('slippers.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(readProductsJson('slippers.json'))
      });
    }
    return Promise.reject(new Error('Unknown URL: ' + url));
  });
};

// Load index.html from disk
const loadHtml = () => {
  return fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
};

// Setup the DOM for each test
const setupDOM = () => {
  document.documentElement.innerHTML = loadHtml();
  jest.resetModules();
  require('../scripts.js');
  // Dispatch DOMContentLoaded so scripts attach their event listeners
  document.dispatchEvent(new Event('DOMContentLoaded'));
};

// Helper: Simulate clicking a category button and wait for heading update
const selectCategory = async (category, expectedHeading) => {
  const btn = document.querySelector(`nav button[data-category="${category}"]`);
  fireEvent.click(btn);
  await waitFor(() => {
    expect(document.getElementById('category-heading').textContent).toMatch(expectedHeading);
  });
};

// Mobile helpers
const setupMobile = () => {
  window.innerWidth = 375;
  window.dispatchEvent(new Event('resize'));
  expect(document.getElementById('menu-toggle')).toBeInTheDocument();
};

// For mobile, click the menu toggle first, then select the category
const selectMobileCategory = async (category, expectedHeading) => {
  const menu = document.querySelector('#menu-toggle');
  fireEvent.click(menu);
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
  fireEvent
};
