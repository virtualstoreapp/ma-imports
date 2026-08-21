const {
  fireEvent,
  setupDOM,
  setupGlobalFetchMock,
  waitFor,
} = require('../utils/catalogCommon');

const heading = () => document.getElementById('category-heading').textContent;
const itemCount = () => document.querySelectorAll('#product-list .product-item').length;

const bootstrap = (hash = '') => {
  window.__isTest = true;
  global.gtag = jest.fn();
  document.body.innerHTML = '';
  window.location.hash = hash;
  setupGlobalFetchMock();
  setupDOM();
};

// Stands in for the browser's back/forward buttons, which change the fragment
// without any click on the page.
const navigateToFragment = (category) => {
  window.location.hash = category;
  window.dispatchEvent(new Event('hashchange'));
};

describe('Fragment navigation', () => {
  it('renders the category named in the initial URL fragment', async () => {
    bootstrap('caps-man');
    await waitFor(() => expect(heading()).toBe('Bonés Masculino'));
  });

  it('falls back to the homepage for an unknown initial fragment', async () => {
    bootstrap('does-not-exist');
    await waitFor(() => expect(heading()).toBe('Novidades'));
  });

  it('writes the fragment when a category is selected', async () => {
    bootstrap();
    await waitFor(() => expect(heading()).toBe('Novidades'));

    fireEvent.click(document.querySelector('nav button[data-category="shoes-man"]'));

    // The heading updates before the fetch resolves, so the fragment (written
    // once the products are on screen) is what has to be awaited here.
    await waitFor(() => expect(window.location.hash).toBe('#shoes-man'));
    expect(heading()).toBe('Tênis');
  });

  it('re-renders on a fragment change, so back and forward work', async () => {
    bootstrap();
    await waitFor(() => expect(heading()).toBe('Novidades'));

    navigateToFragment('caps-man');
    await waitFor(() => expect(heading()).toBe('Bonés Masculino'));

    // Going "back" to the homepage.
    navigateToFragment('all');
    await waitFor(() => expect(heading()).toBe('Novidades'));
  });

  it('ignores an unknown fragment instead of emptying the catalog', async () => {
    bootstrap();
    await waitFor(() => expect(heading()).toBe('Novidades'));
    const before = itemCount();

    navigateToFragment('does-not-exist');

    expect(heading()).toBe('Novidades');
    expect(itemCount()).toBe(before);
  });
});
