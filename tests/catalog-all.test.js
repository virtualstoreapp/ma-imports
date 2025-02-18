/**
 * @jest-environment jest-environment-jsdom
 */
const fs = require('fs');
const path = require('path');
const { waitFor, setupDOM, setupMobile, selectMobileCategory } = require('./catalogTestUtils');
require('@testing-library/jest-dom');
const { setupGlobalFetchMock } = require('./catalogTestUtils');

global.gtag = jest.fn();

beforeAll(() => {
  setupGlobalFetchMock();
});

describe('Catalog Page - All Products', () => {
  beforeEach(() => {
    window.location.hash = '';
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    document.documentElement.innerHTML = html;
    setupDOM();
  });

  describe('Desktop View', () => {
    it('Matches snapshot for "All Products"', async () => {
      await waitFor(() => {
        expect(document.getElementById('category-heading').textContent).toMatch("Todos os Produtos");
      });
      expect(document.body.innerHTML).toMatchSnapshot();
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      setupMobile();
    });

    it('Matches snapshot for "All Products" on mobile', async () => {
      // For mobile, open the menu then select "all" so products load.
      await selectMobileCategory("all", "Todos os Produtos");
      expect(document.body.innerHTML).toMatchSnapshot();
    });
  });
});
