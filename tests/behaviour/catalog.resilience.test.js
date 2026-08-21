const path = require('path');
const { waitFor, setupDOM } = require('../utils/catalogCommon');
const { listCategories } = require('../../tools/lib/catalog');

const PRODUCTS_DIR = path.join(__dirname, '../../products');
const BROKEN_CATEGORY = 'caps-man';

const productFor = (category) => ({
  name: `[0101250900] ${category}`,
  description: '',
  oldPrice: 0,
  price: 10,
  size: 'N/A',
  images: [`images/${category}.jpeg`],
});

describe('Homepage resilience', () => {
  let errorSpy;
  let warnSpy;

  beforeEach(() => {
    window.__isTest = true;
    global.gtag = jest.fn();
    document.body.innerHTML = '';
    window.location.hash = '';
    errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('falls back to per-category fetches when the merged catalog is missing', async () => {
    global.fetch = jest.fn((url) => {
      if (url === 'products/all.json') return Promise.resolve({ ok: false, status: 404 });
      const category = url.match(/products\/(.*)\.json/)[1];
      return Promise.resolve({ ok: true, json: () => Promise.resolve([productFor(category)]) });
    });

    setupDOM();

    // One card per category: the unbuilt source tree still renders in full.
    await waitFor(() => {
      expect(document.querySelectorAll('#product-list .product-item'))
        .toHaveLength(listCategories(PRODUCTS_DIR).length);
    });
    expect(warnSpy).toHaveBeenCalled();
  });

  it('skips only the failing category instead of blanking the homepage', async () => {
    global.fetch = jest.fn((url) => {
      const category = url.match(/products\/(.*)\.json/)[1];
      if (category === 'all' || category === BROKEN_CATEGORY) {
        return Promise.resolve({ ok: false, status: 404 });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([productFor(category)]) });
    });

    setupDOM();

    await waitFor(() => {
      expect(document.querySelectorAll('#product-list .product-item'))
        .toHaveLength(listCategories(PRODUCTS_DIR).length - 1);
    });
    expect(errorSpy).toHaveBeenCalled();
  });
});
