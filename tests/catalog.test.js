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
// Force reinitialization in tests
window.__isTest = true;

/**
 * Asserts that the category heading and products are rendered, then matches snapshot.
 * @param {string} expectedHeading - Expected category heading.
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
 * Helper to click a category button.
 * @param {string} category - The category identifier.
 */
const clickCategoryButton = (category) => {
  const button = document.querySelector(`nav button[data-category="${category}"]`);
  expect(button).not.toBeNull();
  fireEvent.click(button);
};

describe('Catalog', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    window.location.hash = '';
    setupGlobalFetchMock();
    setupDOM();
  });

  describe('Desktop View', () => {
    it('Matches snapshot for "All Products"', async () => {
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
      await setupMobile();
    });

    it('Matches snapshot for "All Products" on mobile', async () => {
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

    it('Displays mobile menu when toggle is clicked', async () => {
      const menuToggle = document.getElementById('menu-toggle');
      expect(menuToggle).toBeInTheDocument();
      fireEvent.click(menuToggle);
      await waitFor(() => {
        expect(document.querySelector('nav')).toHaveClass('active');
      });
    });
  });

  describe('Footer', () => {
    it('Should have centered text', () => {
      const footer = document.querySelector('footer');
      expect(footer).toBeInTheDocument();
      expect(footer).toHaveStyle({ textAlign: 'center' });
    });
  });
});
