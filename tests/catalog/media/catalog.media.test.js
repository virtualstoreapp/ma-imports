const { waitFor, fireEvent, setupDOM } = require('../../utils/catalogCommon');

// Mirrors one entry of the `media` array that tools/build.js injects into the
// generated product JSON. The source tree has no media, so the per-category
// suites cover the fallback markup and this suite covers what actually ships.
const MEDIA = {
  src: 'images/man/caps/2907251533-adidas.jpeg',
  webp: 'images/man/caps/2907251533-adidas.webp',
  thumb: 'images/man/caps/2907251533-adidas-thumb.webp',
  thumbFallback: 'images/man/caps/2907251533-adidas-thumb.jpg',
  width: 1200,
  height: 1500,
  thumbWidth: 400,
  thumbHeight: 500,
};

const ENRICHED_PRODUCT = {
  name: '[2907251533] Adidas',
  description: '',
  oldPrice: 0,
  price: 39,
  size: 'N/A',
  category: 'caps-man',
  images: [MEDIA.src],
  media: [MEDIA],
};

const setupWithEnrichedCatalog = async () => {
  window.__isTest = true;
  global.gtag = jest.fn();
  document.body.innerHTML = '';
  window.location.hash = '';
  global.fetch = jest.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve([ENRICHED_PRODUCT]) })
  );
  setupDOM();
  await waitFor(() => {
    expect(document.querySelectorAll('#product-list .product-item')).toHaveLength(1);
  });
};

const openModal = async () => {
  fireEvent.click(document.querySelector('#product-list .product-item'));
  await waitFor(() => {
    expect(document.getElementById('product-modal')).toHaveStyle({ display: 'flex' });
  });
};

describe('Generated media rendering', () => {
  beforeEach(setupWithEnrichedCatalog);

  it('requests the merged catalog once instead of one file per category', () => {
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(global.fetch).toHaveBeenCalledWith('products/all.json');
  });

  it('serves the WebP thumbnail on cards with the original as fallback', () => {
    const source = document.querySelector('#product-list .product-item picture source');
    expect(source).toHaveAttribute('type', 'image/webp');
    expect(source).toHaveAttribute('srcset', MEDIA.thumb);

    const img = document.querySelector('#product-list .product-item picture img');
    expect(img).toHaveAttribute('src', MEDIA.thumbFallback);
  });

  it('declares thumbnail dimensions and defers offscreen loading', () => {
    const img = document.querySelector('#product-list .product-item picture img');
    expect(img).toHaveAttribute('width', String(MEDIA.thumbWidth));
    expect(img).toHaveAttribute('height', String(MEDIA.thumbHeight));
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
  });

  it('serves the full-size WebP in the modal, keeping the original as fallback', async () => {
    await openModal();
    expect(document.getElementById('modal-image-source')).toHaveAttribute('srcset', MEDIA.webp);
    expect(document.getElementById('modal-image')).toHaveAttribute('src', MEDIA.src);
  });

  it('reports the real category on the homepage rather than the "Novidades" heading', async () => {
    await openModal();
    expect(document.getElementById('category-heading')).toHaveTextContent('Novidades');

    const openSpy = jest.spyOn(window, 'open').mockImplementation(() => {});
    fireEvent.click(document.getElementById('buy-product'));

    const [url] = openSpy.mock.calls[0];
    expect(decodeURIComponent(url)).toContain('na categoria Bonés Masculino');
    openSpy.mockRestore();
  });
});
