const { waitFor, fireEvent } = require('../../utils/catalogCommon');
const { setupFixtureCatalog } = require('../../utils/catalogFixture');
const { assertCardInvariants } = require('../../utils/catalogAsserts');

// This is the ONLY suite that snapshots product markup, and it does so against a
// fixed fixture rather than products/. Adding a real product therefore cannot
// move a snapshot; changing the rendering contract can, and the diff stays small
// enough to review. See tests/fixtures/catalog/README.md.

const cardFor = (name) =>
  Array.from(document.querySelectorAll('#product-list .product-item'))
    .find((card) => card.querySelector('h3').textContent === name);

const openModalFor = async (name) => {
  fireEvent.click(cardFor(name));
  await waitFor(() => {
    expect(document.getElementById('product-modal')).toHaveStyle({ display: 'flex' });
  });
};

describe('Fixture catalog', () => {
  let catalog;

  beforeEach(async () => {
    catalog = await setupFixtureCatalog();
  });

  it('merges and sorts the fixture categories newest-first', () => {
    expect(catalog.map((product) => product.name)).toEqual([
      '[0501251300] Fixture Epsilon',
      '[0401251200] Fixture Delta',
      '[0301251100] Fixture Gamma',
      '[0201251000] Fixture Beta',
      '[0101250900] Fixture Alpha',
    ]);
  });

  it('renders the product grid with the expected markup', () => {
    expect(document.getElementById('product-list').innerHTML).toMatchSnapshot();
  });

  it('renders the site chrome', () => {
    // Nav markup comes from index.html and is independent of catalog content,
    // so this snapshot is stable across product changes.
    expect(document.querySelector('nav').innerHTML).toMatchSnapshot();
  });

  it('satisfies the shared card invariants', () => {
    assertCardInvariants(catalog);
  });

  describe('media handling', () => {
    it('uses <picture> with a WebP source when the build generated media', () => {
      const card = cardFor('[0101250900] Fixture Alpha');
      const source = card.querySelector('picture source');
      expect(source).toHaveAttribute('type', 'image/webp');
      expect(source).toHaveAttribute('srcset', 'images/fixtures/alpha-front-thumb.webp');

      const img = card.querySelector('picture img');
      expect(img).toHaveAttribute('src', 'images/fixtures/alpha-front-thumb.jpg');
      expect(img).toHaveAttribute('width', '400');
      expect(img).toHaveAttribute('height', '500');
    });

    it('falls back to a plain <img> for an unbuilt source tree', () => {
      const card = cardFor('[0401251200] Fixture Delta');
      expect(card.querySelector('picture')).toBeNull();
      expect(card.querySelector('img')).toHaveAttribute('src', 'images/fixtures/delta.jpeg');
    });

    it('still renders a product using the legacy single-image field', () => {
      const card = cardFor('[0301251100] Fixture Gamma');
      expect(card.querySelector('img')).toHaveAttribute('src', 'images/fixtures/gamma.jpeg');
    });
  });

  describe('optional fields', () => {
    it('renders discount markup only when oldPrice is set', () => {
      const discounted = cardFor('[0201251000] Fixture Beta');
      expect(discounted.querySelector('.old-price')).toBeInTheDocument();
      expect(discounted.querySelector('.new-price')).toBeInTheDocument();
      expect(discounted.querySelector('.price')).toBeNull();

      const plain = cardFor('[0401251200] Fixture Delta');
      expect(plain.querySelector('.price')).toBeInTheDocument();
      expect(plain.querySelector('.old-price')).toBeNull();
    });

    it('labels sold-out products and leaves the others unlabelled', () => {
      expect(cardFor('[0301251100] Fixture Gamma').querySelector('.sold-out-label'))
        .toHaveTextContent('Esgotado');
      expect(cardFor('[0501251300] Fixture Epsilon').querySelector('.sold-out-label'))
        .toBeInTheDocument();
      expect(cardFor('[0401251200] Fixture Delta').querySelector('.sold-out-label'))
        .toBeNull();
    });

    it('suppresses the size line for "N/A" but keeps other size text', () => {
      expect(cardFor('[0201251000] Fixture Beta').querySelector('.size')).toBeNull();
      expect(cardFor('[0501251300] Fixture Epsilon').querySelector('.size'))
        .toHaveTextContent('Tamanho: Tamanho único');
    });

    it('omits the description for both a missing key and an empty string', () => {
      expect(cardFor('[0201251000] Fixture Beta').querySelector('.description')).toBeNull();
      expect(cardFor('[0501251300] Fixture Epsilon').querySelector('.description')).toBeNull();
      expect(cardFor('[0401251200] Fixture Delta').querySelector('.description'))
        .toHaveTextContent('Produto de fixture padrão');
    });
  });

  describe('modal', () => {
    it('renders the modal with the expected markup', async () => {
      await openModalFor('[0101250900] Fixture Alpha');
      expect(document.getElementById('product-modal').innerHTML).toMatchSnapshot();
    });

    it('serves the full-size WebP with the original as fallback', async () => {
      await openModalFor('[0101250900] Fixture Alpha');
      expect(document.getElementById('modal-image-source'))
        .toHaveAttribute('srcset', 'images/fixtures/alpha-front.webp');
      expect(document.getElementById('modal-image'))
        .toHaveAttribute('src', 'images/fixtures/alpha-front.jpeg');
    });

    it('marks a sold-out product inside the modal', async () => {
      await openModalFor('[0301251100] Fixture Gamma');
      expect(document.querySelector('#product-modal .sold-out-label')).toBeInTheDocument();
    });
  });
});
