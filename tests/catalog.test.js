/**
 * @jest-environment jest-environment-jsdom
 */
const { waitFor, fireEvent } = require('@testing-library/dom');
require('@testing-library/jest-dom');

const {
  setupDOM,
  setupMobile,
  selectMobileCategory,
  setupGlobalFetchMock,
} = require('./catalogTestUtils');

// Mock Google Analytics
global.gtag = jest.fn();

// Ensure that in tests our catalog always re-initializes.
window.__isTest = true;

/**
 * Helper to assert that the category heading and products are rendered,
 * then match the current document snapshot.
 *
 * @param {string} expectedHeading - The expected text content for the category heading.
 */
const assertRenderedSnapshot = async (expectedHeading) => {
  await waitFor(() => {
    expect(document.getElementById('category-heading')).toHaveTextContent(expectedHeading);
  });

  await waitFor(() => {
    const productItems = document.querySelectorAll('#product-list .product-item');
    expect(productItems.length).toBeGreaterThan(0);
  });

  expect(document.body.innerHTML).toMatchSnapshot();
};

/**
 * Helper to click a category button by data-category attribute.
 *
 * @param {string} category - The category identifier.
 */
const clickCategoryButton = (category) => {
  const button = document.querySelector(`nav button[data-category="${category}"]`);
  expect(button).not.toBeNull();
  fireEvent.click(button);
};

describe('Catalog', () => {
  beforeEach(() => {
    // Reset the DOM and flags
    document.body.innerHTML = '';
    // Do NOT delete window.__catalogInitialized here, as __isTest flag is used to force reinitialization.
    window.location.hash = ''; // Reset hash state
    setupGlobalFetchMock();
    setupDOM(); // This sets up the necessary markup and initializes the catalog.
  });

  describe('Desktop View', () => {
    it('Matches snapshot for "All Products"', async () => {
      // "All Products" is rendered by default
      await assertRenderedSnapshot("Todos os Produtos");
    });

    it('Matches snapshot for "Shoes"', async () => {
      clickCategoryButton('shoes');
      await assertRenderedSnapshot("Calçados");
    });

    it('Matches snapshot for "Slippers"', async () => {
      clickCategoryButton('slippers');
      await assertRenderedSnapshot("Chinelos");
    });

    it('Matches snapshot for "Tshirts"', async () => {
      clickCategoryButton('tshirts');
      await assertRenderedSnapshot("Camisetas");
    });
  });

  describe('Mobile View', () => {
    beforeEach(async () => {
      await setupMobile(); // Initialize mobile menu state
    });

    it('Matches snapshot for "All Products" on mobile', async () => {
      // "All Products" is rendered by default
      await assertRenderedSnapshot("Todos os Produtos");
    });

    it('Matches snapshot for "Shoes" on mobile', async () => {
      await selectMobileCategory("shoes", "Calçados");
      await assertRenderedSnapshot("Calçados");
    });

    it('Matches snapshot for "Slippers" on mobile', async () => {
      await selectMobileCategory("slippers", "Chinelos");
      await assertRenderedSnapshot("Chinelos");
    });

    it('Matches snapshot for "Tshirts" on mobile', async () => {
      await selectMobileCategory("tshirts", "Camisetas");
      await assertRenderedSnapshot("Camisetas");
    });
  });
});
