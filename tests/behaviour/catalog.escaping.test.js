const { waitFor, setupDOM } = require('../utils/catalogCommon');

// Product data reaches the DOM through innerHTML, so a name or description
// containing markup must be rendered as text rather than parsed as HTML.
const HOSTILE_PRODUCT = {
  name: '<img src=x onerror=alert(1)> "Nike" & \'Adidas\'',
  description: '<script>document.title = "pwned";</script>',
  oldPrice: 0,
  price: 10,
  size: '<b>GG</b>',
  images: ['images/man/caps/quote".jpeg'],
};

const card = () => document.querySelector('#product-list .product-item');

describe('Product data escaping', () => {
  beforeEach(async () => {
    window.__isTest = true;
    global.gtag = jest.fn();
    document.body.innerHTML = '';
    window.location.hash = '';
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([HOSTILE_PRODUCT]) })
    );
    setupDOM();
    await waitFor(() => expect(card()).toBeTruthy());
  });

  it('does not let product text inject elements', () => {
    expect(card().querySelectorAll('script')).toHaveLength(0);
    // Only the card's own image: the <img> in the product name did not parse.
    expect(card().querySelectorAll('img')).toHaveLength(1);
    expect(document.title).not.toBe('pwned');
  });

  it('renders the name and description verbatim as text', () => {
    expect(card().querySelector('h3').textContent).toBe(HOSTILE_PRODUCT.name);
    expect(card().querySelector('.description').textContent).toBe(HOSTILE_PRODUCT.description);
    expect(card().querySelector('.size').textContent).toBe(`Tamanho: ${HOSTILE_PRODUCT.size}`);
  });

  it('keeps quotes inside attributes instead of breaking out of them', () => {
    const img = card().querySelector('img');
    expect(img.getAttribute('alt')).toBe(HOSTILE_PRODUCT.name);
    expect(img.getAttribute('src')).toBe(HOSTILE_PRODUCT.images[0]);
  });
});
