/**
 * @jest-environment jest-environment-jsdom
 */
const fs = require('fs');
const path = require('path');
const { waitFor, fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');

// Stub gtag to prevent ReferenceError during tests
global.gtag = jest.fn();

// ---
// Mock data for fetch responses
// ---
const mockShoes = [
  {
    name: 'Shoe 1',
    price: 100,
    image: 'images/shoe1.png',
    size: 'M'
  }
];

const mockSlippers = [
  {
    name: 'Slipper 1',
    price: 50,
    image: 'images/slipper1.png',
    size: 'N/A'
  }
];

// Global fetch mock
beforeAll(() => {
  global.fetch = jest.fn((url) => {
    if (url.includes('shoes.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockShoes)
      });
    }
    if (url.includes('slippers.json')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockSlippers)
      });
    }
    return Promise.reject(new Error('Unknown URL: ' + url));
  });
});

// Helper function to simulate clicking a category button and waiting for the heading update
const selectCategory = async (category, expectedHeading) => {
  const btn = document.querySelector(`nav button[data-category="${category}"]`);
  fireEvent.click(btn);
  await waitFor(() => {
    expect(document.getElementById('category-heading').textContent).toMatch(expectedHeading);
  });
};

describe('Catalog Page Snapshot Tests', () => {
  let html;

  // Set up HTML and reload scripts before each test
  beforeEach(() => {
    // Clear any URL hash to avoid residual state
    window.location.hash = '';
    html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    document.documentElement.innerHTML = html;
    global.fetch.mockClear();
    jest.resetModules();
    require('../scripts.js');
    // Dispatch DOMContentLoaded so scripts attach their event listeners
    document.dispatchEvent(new Event('DOMContentLoaded'));
  });

  describe('Desktop View', () => {
    it('Matches snapshot for "All Products"', async () => {
      await waitFor(() => {
        expect(document.getElementById('category-heading').textContent).toMatch("Todos os Produtos");
      });
      expect(document.body.innerHTML).toMatchSnapshot();
    });

    it('Matches snapshot for "Shoes"', async () => {
      await selectCategory("shoes", "Calçados");
      expect(document.body.innerHTML).toMatchSnapshot();
    });

    it('Matches snapshot for "Slippers"', async () => {
      await selectCategory("slippers", "Chinelos");
      expect(document.body.innerHTML).toMatchSnapshot();
    });
  });

  describe('Mobile View', () => {
    // Set mobile viewport dimensions before mobile tests
    beforeEach(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
      expect(document.getElementById('menu-toggle')).toBeInTheDocument();
    });

    // Helper for mobile view: open mobile menu then select a category
    const selectMobileCategory = async (category, expectedHeading) => {
      const menu = document.querySelector('#menu-toggle');
      fireEvent.click(menu);
      await selectCategory(category, expectedHeading);
    };

    it('Matches snapshot for "All Products" on mobile', async () => {
      // For "All Products", we assume the default is already set
      await selectCategory("all", "Todos os Produtos");
      expect(document.body.innerHTML).toMatchSnapshot();
    });

    it('Matches snapshot for "Shoes" on mobile', async () => {
      await selectMobileCategory("shoes", "Calçados");
      expect(document.body.innerHTML).toMatchSnapshot();
    });

    it('Matches snapshot for "Slippers" on mobile', async () => {
      await selectMobileCategory("slippers", "Chinelos");
      expect(document.body.innerHTML).toMatchSnapshot();
    });
  });
});
