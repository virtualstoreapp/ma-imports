/**
 * @jest-environment jest-environment-jsdom
 */
const fs = require('fs');
const path = require('path');
const { selectCategory, selectMobileCategory } = require('./catalogTestUtils');
require('@testing-library/jest-dom');
const { setupGlobalFetchMock } = require('./catalogTestUtils');

global.gtag = jest.fn();

beforeAll(() => {
  setupGlobalFetchMock();
});

describe('Catalog Page - Slippers', () => {
  beforeEach(() => {
    window.location.hash = '';
    const html = fs.readFileSync(path.resolve(__dirname, '../index.html'), 'utf8');
    document.documentElement.innerHTML = html;
    setupDOM();
  });

  describe('Desktop View', () => {
    it('Matches snapshot for "Slippers"', async () => {
      await selectCategory("slippers", "Chinelos");
      expect(document.body.innerHTML).toMatchSnapshot();
    });
  });

  describe('Mobile View', () => {
    beforeEach(() => {
      window.innerWidth = 375;
      window.dispatchEvent(new Event('resize'));
      expect(document.getElementById('menu-toggle')).toBeInTheDocument();
    });

    it('Matches snapshot for "Slippers" on mobile', async () => {
      await selectMobileCategory("slippers", "Chinelos");
      expect(document.body.innerHTML).toMatchSnapshot();
    });
  });
});

// Helper to set up the DOM for each test
function setupDOM() {
  jest.resetModules();
  require('../scripts.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
}
