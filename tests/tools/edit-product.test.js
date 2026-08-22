const { applyEdit, locate } = require('../../tools/authoring/edit-product');

const product = (overrides = {}) => ({
  id: '2307251157',
  brand: 'gucci',
  price: 89.9,
  sizes: [{ size: 'M' }, { size: 'G' }],
  images: ['images/man/belts/2307251157-gucci.jpeg'],
  listedAt: '2025-07-23T11:57:00Z',
  ...overrides,
});

const edit = (inputs, overrides) => {
  const target = product(overrides);
  const result = applyEdit(target, inputs);
  return { ...result, product: target };
};

describe('locate', () => {
  it('finds a real product and its category', () => {
    const found = locate('2307251157');
    expect(found).not.toBeNull();
    expect(found.products[found.index].id).toBe('2307251157');
  });

  it('returns null for an unknown code', () => {
    expect(locate('0000000000')).toBeNull();
  });
});

describe('applyEdit', () => {
  it('updates the price', () => {
    const { changes, product: after } = edit({ price: '99,90' });
    expect(after.price).toBe(99.9);
    expect(changes[0]).toMatch(/preço/);
  });

  it('rejects an unparseable price', () => {
    expect(edit({ price: 'de graça' }).errors[0]).toMatch(/not a valid price/);
  });

  it('adds a discount and refuses one that is not a discount', () => {
    expect(edit({ oldPrice: '129,90' }).product.oldPrice).toBe(129.9);
    expect(edit({ oldPrice: '10,00' }).errors[0]).toMatch(/must be higher/);
  });

  it('clears a discount on request', () => {
    const { product: after } = edit({ oldPrice: 'remover' }, { oldPrice: 129.9 });
    expect('oldPrice' in after).toBe(false);
  });

  it('clears a description on request', () => {
    const { product: after } = edit({ description: 'REMOVER' }, { description: 'antigo' });
    expect('description' in after).toBe(false);
  });

  // The edit the seller will reach for most: one size goes, the row keeps selling.
  it('marks a single size sold out and leaves the rest available', () => {
    const { product: after } = edit({ soldOutSizes: 'M' });
    expect(after.sizes).toEqual([{ size: 'M', soldOut: true }, { size: 'G' }]);
    expect('soldOut' in after).toBe(false);
  });

  it('replaces the sold-out set rather than adding to it', () => {
    const { product: after } = edit({ soldOutSizes: 'G' }, {
      sizes: [{ size: 'M', soldOut: true }, { size: 'G' }],
    });
    expect(after.sizes).toEqual([{ size: 'M' }, { size: 'G', soldOut: true }]);
  });

  it('puts every size back on sale', () => {
    const { product: after } = edit({ soldOutSizes: 'nenhum' }, {
      sizes: [{ size: 'M', soldOut: true }, { size: 'G', soldOut: true }],
    });
    expect(after.sizes).toEqual([{ size: 'M' }, { size: 'G' }]);
  });

  it('refuses a size the product does not have', () => {
    expect(edit({ soldOutSizes: 'XG' }).errors[0]).toMatch(/has no size XG/);
  });

  // A row with no units carries the flag itself, so there is no size to name.
  it('puts a sizeless product back on sale', () => {
    const { product: after } = edit({ soldOutSizes: 'nenhum' }, { sizes: [], soldOut: true });
    expect('soldOut' in after).toBe(false);
  });

  it('refuses a size list for a sizeless product', () => {
    expect(edit({ soldOutSizes: 'M' }, { sizes: [] }).errors[0]).toMatch(/has no sizes/);
  });

  it('refuses an edit that changes nothing', () => {
    expect(edit({}).errors[0]).toMatch(/Nothing to change/);
  });

  it('applies several changes at once', () => {
    const { changes } = edit({ price: '79,90', soldOutSizes: 'G', description: 'novo' });
    expect(changes).toHaveLength(3);
  });

  it('leaves the product valid against the schema', () => {
    const { compileProductSchema } = require('../../tools/lib/validate');
    const { product: after } = edit({ price: '79,90', soldOutSizes: 'M' });
    expect(compileProductSchema()([after])).toBe(true);
  });
});
