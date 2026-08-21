const {
  loadHtml,
  setupDOM,
  setupGlobalFetchMock,
  waitFor,
} = require('../utils/catalogCommon');

const heading = () => document.getElementById('category-heading').textContent;
const itemCount = () => document.querySelectorAll('#product-list .product-item').length;

const bootstrap = (hash = '', transformHtml = (html) => html) => {
  window.__isTest = true;
  global.gtag = jest.fn();
  document.body.innerHTML = '';
  window.location.hash = hash;
  setupGlobalFetchMock();

  // setupDOM loads index.html verbatim; these cases need it altered first.
  delete window.__catalogInitialized;
  document.documentElement.innerHTML = transformHtml(loadHtml());
  jest.resetModules();
  require('../../scripts.js');
  document.dispatchEvent(new Event('DOMContentLoaded'));
};

const navigateToFragment = (category) => {
  window.location.hash = category;
  window.dispatchEvent(new Event('hashchange'));
};

describe('Category registry', () => {
  describe('retired slugs', () => {
    // underwear-man-subcategory was a leaf named as though it were a nav group.
    // Wave 3 renamed it, and the alias is what keeps links shared before the
    // rename working.
    it('resolves a retired slug to its replacement', async () => {
      bootstrap('underwear-man-subcategory');
      await waitFor(() => expect(heading()).toBe('Cuecas Masculina'));
      await waitFor(() => expect(itemCount()).toBeGreaterThan(0));
    });

    it('resolves the current slug', async () => {
      bootstrap('underwear-man');
      await waitFor(() => expect(heading()).toBe('Cuecas Masculina'));
    });
  });

  describe('untrusted fragment', () => {
    // The registry is parsed JSON, so a plain `labels[raw]` lookup would resolve
    // "__proto__", "constructor" and "toString" against Object.prototype and
    // treat them as real categories. Both the label and alias lookups go through
    // hasOwnProperty; this is the guard scripts.js must never lose.
    it.each(['__proto__', 'constructor', 'toString', 'valueOf', 'hasOwnProperty'])(
      'does not treat "%s" as a category',
      async (fragment) => {
        bootstrap(fragment);
        await waitFor(() => expect(heading()).toBe('Novidades'));
        await waitFor(() => expect(itemCount()).toBeGreaterThan(0));
      }
    );

    it('ignores a nav group, which has no products file', async () => {
      bootstrap();
      await waitFor(() => expect(heading()).toBe('Novidades'));
      const before = itemCount();

      navigateToFragment('clothing-man-subcategory');

      expect(heading()).toBe('Novidades');
      expect(itemCount()).toBe(before);
    });

    it('survives a malformed percent-escape', async () => {
      bootstrap('%E0%A4%A');
      await waitFor(() => expect(heading()).toBe('Novidades'));
    });
  });

  describe('degradation', () => {
    const silenceErrors = () => jest.spyOn(console, 'error').mockImplementation(() => {});

    it('still renders the homepage when the registry block is missing', async () => {
      const spy = silenceErrors();
      bootstrap('', (html) =>
        html.replace(/<script id="category-registry"[\s\S]*?<\/script>/, '')
      );

      await waitFor(() => expect(heading()).toBe('Novidades'));
      await waitFor(() => expect(itemCount()).toBeGreaterThan(0));
      expect(spy).toHaveBeenCalledWith(expect.stringContaining('Category registry block is missing'));
      spy.mockRestore();
    });

    it('still renders the homepage when the registry block is malformed', async () => {
      const spy = silenceErrors();
      bootstrap('', (html) =>
        html.replace(
          /(<script id="category-registry" type="application\/json">)[\s\S]*?(<\/script>)/,
          '$1{ not json $2'
        )
      );

      await waitFor(() => expect(heading()).toBe('Novidades'));
      await waitFor(() => expect(itemCount()).toBeGreaterThan(0));
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('Category registry block is not valid JSON'),
        expect.any(Error)
      );
      spy.mockRestore();
    });
  });
});
