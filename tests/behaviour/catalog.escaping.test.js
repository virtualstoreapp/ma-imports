const { waitFor, setupDOM } = require('../utils/catalogCommon');

// Product data reaches the DOM through innerHTML, so a name or description
// containing markup must be rendered as text rather than parsed as HTML.
const HOSTILE_PRODUCT = {
  id: '2907251533',
  name: '<img src=x onerror=alert(1)> "Nike" & \'Adidas\'',
  brandLabel: 'Nike',
  description: '<script>document.title = "pwned";</script>',
  price: 10,
  // Every size value is interpolated separately now, so each is its own
  // escaping site — including the aria-label on a sold-out chip.
  sizes: [
    { size: '<b>GG</b>' },
    { size: '" onmouseover="alert(1)', soldOut: true },
  ],
  images: ['images/man/caps/quote".jpeg'],
  listedAt: '2025-07-29T15:33:00Z',
};

const NOTE_PRODUCT = {
  id: '2907251534',
  name: '[2907251534] Nota',
  brandLabel: 'Nota',
  price: 10,
  sizes: [],
  sizeNote: '<em>Consultar</em>',
  images: ['images/man/caps/2907251534-nota.jpeg'],
  listedAt: '2025-07-29T15:34:00Z',
};

const card = () => document.querySelector('#product-list .product-item');

describe('Product data escaping', () => {
  beforeEach(async () => {
    window.__isTest = true;
    global.gtag = jest.fn();
    document.body.innerHTML = '';
    window.location.hash = '';
    global.fetch = jest.fn(() =>
      Promise.resolve({ ok: true, json: () => Promise.resolve([HOSTILE_PRODUCT, NOTE_PRODUCT]) })
    );
    setupDOM();
    await waitFor(() => expect(card()).toBeTruthy());
  });

  it('does not let product text inject elements', () => {
    expect(card().querySelectorAll('script')).toHaveLength(0);
    // Only the card's own image: the <img> in the product name did not parse.
    expect(card().querySelectorAll('img')).toHaveLength(1);
    expect(card().querySelectorAll('b')).toHaveLength(0);
    expect(document.title).not.toBe('pwned');
  });

  it('renders the name and description verbatim as text', () => {
    expect(card().querySelector('h3').textContent).toBe(HOSTILE_PRODUCT.name);
    expect(card().querySelector('.description').textContent).toBe(HOSTILE_PRODUCT.description);
  });

  it('renders each size as text rather than markup', () => {
    const chips = [...card().querySelectorAll('.size-chip')];
    expect(chips.map((chip) => chip.textContent))
      .toEqual(HOSTILE_PRODUCT.sizes.map((unit) => unit.size));
  });

  // The sold-out chip interpolates the size into an aria-label, a quoted
  // attribute, so a value containing a quote must not break out of it.
  it('keeps a hostile size inside the aria-label attribute', () => {
    const soldOut = card().querySelector('.size-chip-sold-out');
    expect(soldOut.getAttribute('aria-label')).toBe('" onmouseover="alert(1) (esgotado)');
    expect(soldOut.hasAttribute('onmouseover')).toBe(false);
  });

  it('renders a hostile sizeNote as text', () => {
    const note = document.querySelectorAll('#product-list .product-item')[1].querySelector('.size-note');
    expect(note.textContent).toBe(NOTE_PRODUCT.sizeNote);
    expect(note.querySelectorAll('em')).toHaveLength(0);
  });

  it('keeps quotes inside attributes instead of breaking out of them', () => {
    const img = card().querySelector('img');
    expect(img.getAttribute('alt')).toBe(HOSTILE_PRODUCT.name);
    expect(img.getAttribute('src')).toBe(HOSTILE_PRODUCT.images[0]);
  });
});
