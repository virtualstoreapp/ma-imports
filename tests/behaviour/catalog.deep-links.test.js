const path = require('path');
const {
  fireEvent,
  setupDOM,
  setupGlobalFetchMock,
  waitFor,
} = require('../utils/catalogCommon');

const { buildAllCatalog } = require('../../tools/lib/catalog');
const { loadRegistry } = require('../../tools/lib/registry');
const { toRuntime } = require('../../tools/lib/runtime');

const PRODUCTS_DIR = path.join(__dirname, '../../products');
const { brands } = loadRegistry();
const catalog = buildAllCatalog(PRODUCTS_DIR).map((p) => ({ ...toRuntime(p, brands), category: p.category }));

const SAMPLE = catalog.find((p) => p.category === 'caps-man');

const bootstrap = (hash = '') => {
  window.__isTest = true;
  global.gtag = jest.fn();
  document.body.innerHTML = '';
  window.location.hash = hash;
  setupGlobalFetchMock();
  setupDOM();
};

const modal = () => document.getElementById('product-modal');
const heading = () => document.getElementById('category-heading').textContent;
const cards = () => document.querySelectorAll('#product-list .product-item');
const hash = () => window.location.hash;

const navigate = (to) => {
  window.location.hash = to;
  window.dispatchEvent(new Event('hashchange'));
};

describe('Product deep links', () => {
  describe('arriving on a shared link', () => {
    it('opens the product named in the fragment', async () => {
      bootstrap(`p/${SAMPLE.id}`);
      await waitFor(() => expect(modal()).toHaveStyle({ display: 'flex' }));
      expect(document.getElementById('modal-image').getAttribute('src')).toBeTruthy();
    });

    // The whole catalog is rendered so the product can be found wherever it
    // lives, rather than requiring the link to name a category too.
    it('renders the full catalog behind the modal', async () => {
      bootstrap(`p/${SAMPLE.id}`);
      await waitFor(() => expect(cards().length).toBe(catalog.length));
      expect(heading()).toBe('Novidades');
    });

    // renderProducts writes the category into the fragment; without a guard it
    // would replace #p/{id} with #all before the modal could open.
    it('keeps the product fragment through the initial render', async () => {
      bootstrap(`p/${SAMPLE.id}`);
      await waitFor(() => expect(modal()).toHaveStyle({ display: 'flex' }));
      expect(hash()).toBe(`#p/${SAMPLE.id}`);
    });

    it('falls back to the homepage for an id no product has', async () => {
      bootstrap('p/0000000000');
      await waitFor(() => expect(cards().length).toBeGreaterThan(0));
      expect(modal()).not.toHaveStyle({ display: 'flex' });
      expect(heading()).toBe('Novidades');
    });
  });

  describe('writing the fragment', () => {
    it('writes #p/{id} when a product is opened', async () => {
      bootstrap();
      await waitFor(() => expect(cards().length).toBeGreaterThan(0));

      fireEvent.click(cards()[0]);
      await waitFor(() => expect(modal()).toHaveStyle({ display: 'flex' }));
      expect(hash()).toMatch(/^#p\/\d{10}$/);
    });

    it('hands the fragment back to the category when closed', async () => {
      bootstrap();
      await waitFor(() => expect(cards().length).toBeGreaterThan(0));

      fireEvent.click(cards()[0]);
      await waitFor(() => expect(hash()).toMatch(/^#p\//));

      fireEvent.click(document.getElementById('modal-close'));
      expect(hash()).toBe('#all');
    });
  });

  describe('untrusted fragment', () => {
    // Same discipline as categoryFromHash: matched against a fixed shape, then
    // looked up by scanning, never used to index an object.
    it.each([
      'p/__proto__',
      'p/constructor',
      'p/../../etc/passwd',
      'p/12345',
      'p/12345678901',
      'p/abcdefghij',
      'p/',
    ])('ignores %s', async (fragment) => {
      bootstrap(fragment);
      await waitFor(() => expect(cards().length).toBeGreaterThan(0));
      expect(modal()).not.toHaveStyle({ display: 'flex' });
    });

    it('still treats a category fragment as a category', async () => {
      bootstrap('caps-man');
      await waitFor(() => expect(heading()).toBe('Bonés Masculino'));
      expect(modal()).not.toHaveStyle({ display: 'flex' });
    });
  });

  describe('back and forward', () => {
    it('opens the modal when navigating to a product fragment', async () => {
      bootstrap();
      await waitFor(() => expect(cards().length).toBeGreaterThan(0));

      navigate(`p/${SAMPLE.id}`);
      await waitFor(() => expect(modal()).toHaveStyle({ display: 'flex' }));
    });

    it('closes the modal when navigating back to a category', async () => {
      bootstrap(`p/${SAMPLE.id}`);
      await waitFor(() => expect(modal()).toHaveStyle({ display: 'flex' }));

      navigate('all');
      await waitFor(() => expect(modal()).not.toHaveStyle({ display: 'flex' }));
    });
  });
});
