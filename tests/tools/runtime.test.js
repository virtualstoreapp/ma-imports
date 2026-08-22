const fs = require('fs');
const path = require('path');

const { deriveName, deriveSoldOut, toRuntime } = require('../../tools/lib/runtime');
const { loadRegistry } = require('../../tools/lib/registry');
const { readCategory, listCategories } = require('../../tools/lib/catalog');

const ROOT = path.join(__dirname, '../..');
const PRODUCTS_DIR = path.join(ROOT, 'products');

const BRANDS = {
  unbranded: { label: '' },
  nike: { label: 'Nike' },
  'under-armor': { label: 'Under Armour' },
};

const product = (overrides) => ({
  id: '2709252015',
  brand: 'nike',
  price: 79,
  sizes: [{ size: 'G' }],
  images: ['images/2709252015-nike.jpeg'],
  listedAt: '2025-09-27T20:15:00Z',
  ...overrides,
});

describe('deriveName', () => {
  it('joins brand and model', () => {
    expect(deriveName(product({ model: 'Pro' }), BRANDS)).toBe('[2709252015] Nike Pro');
  });

  it('uses the brand alone when there is no model', () => {
    expect(deriveName(product({}), BRANDS)).toBe('[2709252015] Nike');
  });

  // An unbranded product has an empty label, so concatenating would produce a
  // double space. The six placeholder strings all take this path.
  it('renders an unbranded product as its model alone', () => {
    expect(deriveName(product({ brand: 'unbranded', model: 'Star' }), BRANDS))
      .toBe('[2709252015] Star');
  });

  // Six products have no brand and no model at all; v1 rendered just the code,
  // with nothing trailing it.
  it('renders a product with neither brand nor model as the bare code', () => {
    expect(deriveName(product({ brand: 'unbranded' }), BRANDS)).toBe('[2709252015]');
  });

  it('uses the registry label, not the slug', () => {
    expect(deriveName(product({ brand: 'under-armor' }), BRANDS))
      .toBe('[2709252015] Under Armour');
  });
});

describe('deriveSoldOut', () => {
  it('is false when no unit is sold', () => {
    expect(deriveSoldOut(product({ sizes: [{ size: 'M' }, { size: 'G' }] }))).toBe(false);
  });

  // The point of the multi-unit model: one size going means the row stays up.
  it('is false when only some units are sold', () => {
    expect(deriveSoldOut(product({ sizes: [{ size: 'M', soldOut: true }, { size: 'G' }] })))
      .toBe(false);
  });

  it('is true when every unit is sold', () => {
    expect(deriveSoldOut(product({ sizes: [{ size: 'M', soldOut: true }, { size: 'G', soldOut: true }] })))
      .toBe(true);
  });

  // Nine products are in this position. Reading only the units would have put
  // them back on sale, which is what the migration gate caught.
  it('falls back to the row flag when there are no units', () => {
    expect(deriveSoldOut(product({ sizes: [], soldOut: true }))).toBe(true);
    expect(deriveSoldOut(product({ sizes: [] }))).toBe(false);
  });
});

describe('toRuntime', () => {
  it('emits the v2 runtime fields', () => {
    expect(Object.keys(toRuntime(product({}), BRANDS)))
      .toEqual(['id', 'name', 'brand', 'brandLabel', 'price', 'sizes', 'images', 'listedAt']);
  });

  it('appends soldOut only when the row is sold out', () => {
    expect('soldOut' in toRuntime(product({}), BRANDS)).toBe(false);
    expect(toRuntime(product({ sizes: [{ size: 'G', soldOut: true }] }), BRANDS).soldOut).toBe(true);
  });

  it('passes sizes through untouched, per-unit sold-out state included', () => {
    const sizes = [{ size: 'M' }, { size: 'G', soldOut: true }];
    expect(toRuntime(product({ sizes }), BRANDS).sizes).toEqual(sizes);
  });

  it('carries sizeNote when present', () => {
    expect(toRuntime(product({ sizes: [], sizeNote: 'Consultar' }), BRANDS).sizeNote)
      .toBe('Consultar');
  });

  it('resolves the brand label the client displays', () => {
    expect(toRuntime(product({ brand: 'under-armor' }), BRANDS).brandLabel).toBe('Under Armour');
  });

  // v1 carried description:"" and oldPrice:0 for "absent", which is how it ended
  // up with three states for "no description". v2 omits them and the client
  // tests for presence.
  it('omits absent optional fields rather than giving them sentinels', () => {
    const runtime = toRuntime(product({}), BRANDS);
    expect('description' in runtime).toBe(false);
    expect('oldPrice' in runtime).toBe(false);
    expect('sizeNote' in runtime).toBe(false);
    expect('model' in runtime).toBe(false);
  });

  it('passes a real discount through', () => {
    expect(toRuntime(product({ oldPrice: 99 }), BRANDS).oldPrice).toBe(99);
  });
});

describe('The real catalog', () => {
  const { brands } = loadRegistry();
  const all = listCategories(PRODUCTS_DIR).flatMap((category) => readCategory(PRODUCTS_DIR, category));

  it('derives a name for every product', () => {
    const names = all.map((entry) => toRuntime(entry, brands).name);
    expect(names).toHaveLength(241);
    expect(names.filter((name) => !/^\[\d{10}\]/.test(name))).toEqual([]);
    // No double space, which is what naive concatenation of an empty label gives.
    expect(names.filter((name) => name.includes('  '))).toEqual([]);
    expect(names.filter((name) => name !== name.trim())).toEqual([]);
  });

  it('preserves the sold-out total across the migration', () => {
    // 51 rows were sold out before the migration: 42 now carry it on their units
    // and 9 on the row, because they have no units.
    const soldOut = all.filter((entry) => deriveSoldOut(entry));
    expect(soldOut).toHaveLength(51);
    expect(soldOut.filter((entry) => entry.sizes.length)).toHaveLength(42);
    expect(soldOut.filter((entry) => !entry.sizes.length)).toHaveLength(9);
  });

  it('derives every id uniquely', () => {
    const ids = all.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('agrees with the committed dist output', () => {
    const distPath = path.join(ROOT, 'dist', 'products', 'caps-man.json');
    if (!fs.existsSync(distPath)) return; // dist is gitignored; skip on a clean checkout

    const dist = JSON.parse(fs.readFileSync(distPath, 'utf8'));
    const derived = readCategory(PRODUCTS_DIR, 'caps-man').map((entry) => toRuntime(entry, brands));

    derived.forEach((entry, index) => {
      expect(dist[index].name).toBe(entry.name);
      expect(dist[index].size).toBe(entry.size);
      expect(dist[index].soldOut === true).toBe(entry.soldOut === true);
    });
  });
});
