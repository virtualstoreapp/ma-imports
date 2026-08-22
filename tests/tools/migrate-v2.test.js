const path = require('path');

const {
  BRAND_MAP,
  listedAtFrom,
  migrateProduct,
  splitName,
  splitSize,
} = require('../../tools/migrate-v2');

const { loadRegistry } = require('../../tools/lib/registry');
const { listCategories, readCategory } = require('../../tools/lib/catalog');
const { toRuntime } = require('../../tools/lib/runtime');

const ROOT = path.join(__dirname, '../..');
const PRODUCTS_DIR = path.join(ROOT, 'products');

const v1 = (overrides) => ({
  name: '[2709252015] Nike Pro',
  description: 'Calça Legging',
  oldPrice: 0.0,
  price: 79,
  size: 'G',
  images: ['images/2709252015-nike.jpeg'],
  ...overrides,
});

describe('splitName', () => {
  it('separates the code, brand and model', () => {
    expect(splitName('[2709252015] Nike Pro')).toEqual({
      id: '2709252015',
      brand: 'nike',
      model: 'Pro',
    });
  });

  it('handles a brand with no model', () => {
    expect(splitName('[2709252015] Nike')).toEqual({ id: '2709252015', brand: 'nike' });
  });

  it('handles a name that is only a code', () => {
    expect(splitName('[2709252015]')).toEqual({ id: '2709252015', brand: 'unbranded' });
  });

  // OQ-8: the original string survives in `model`, so the rendered name is
  // unchanged and no information is lost by calling it unbranded.
  it('maps a placeholder to unbranded, keeping the original text', () => {
    expect(splitName('[0507251850] Star')).toEqual({
      id: '0507251850',
      brand: 'unbranded',
      model: 'Star',
    });
  });

  // RD-3: a misspelling of a real brand, matching the on-disk folder.
  it('corrects the two misspelled brands', () => {
    expect(splitName('[2307251155] Quicksilver').brand).toBe('quiksilver');
    expect(splitName('[1104250026] Under Armor').brand).toBe('under-armor');
  });

  it('tolerates trailing whitespace in the tail', () => {
    expect(splitName('[2307251250] Tommy Hilfiger ').brand).toBe('tommy-hilfiger');
  });

  it('throws on an unmapped brand rather than inventing a slug', () => {
    expect(() => splitName('[2709252015] Unheard Of')).toThrow(/no brand mapping/);
  });

  it('throws on a name with no code', () => {
    expect(() => splitName('Nike Pro')).toThrow(/no \[DDMMYYHHmm\] code/);
  });
});

describe('listedAtFrom', () => {
  it('reads the code as UTC, removing the build host timezone from sort order', () => {
    expect(listedAtFrom('2709252015')).toBe('2025-09-27T20:15:00Z');
    expect(listedAtFrom('0101250900')).toBe('2025-01-01T09:00:00Z');
  });
});

describe('splitSize', () => {
  it('turns a single value into one unit', () => {
    expect(splitSize('G', false)).toEqual({ sizes: [{ size: 'G' }] });
  });

  // CON-10: a separator means several units, which is why the four shoe rows
  // that an earlier revision called defects are ordinary data.
  it('turns a separated list into several units', () => {
    expect(splitSize('39, 42', false)).toEqual({ sizes: [{ size: '39' }, { size: '42' }] });
    expect(splitSize('40,41', false)).toEqual({ sizes: [{ size: '40' }, { size: '41' }] });
  });

  it('applies the v1 row-level flag to every unit', () => {
    expect(splitSize('M, G', true)).toEqual({
      sizes: [{ size: 'M', soldOut: true }, { size: 'G', soldOut: true }],
    });
  });

  it('treats a range as a note, since one item fits the span', () => {
    expect(splitSize('37 ao 44', false)).toEqual({ sizes: [], sizeNote: '37 ao 44' });
  });

  it.each(['Consultar', 'Pequena', 'Tamanho único'])('treats %s as a note', (value) => {
    expect(splitSize(value, false)).toEqual({ sizes: [], sizeNote: value });
  });

  // "N/A" is what the card renders for a product with no sizes, so repeating it
  // as a note would show it twice.
  it('drops "N/A" entirely', () => {
    expect(splitSize('N/A', false)).toEqual({ sizes: [] });
  });
});

describe('migrateProduct', () => {
  it('drops the 0.0 no-discount sentinel', () => {
    expect('oldPrice' in migrateProduct(v1({ oldPrice: 0.0 }))).toBe(false);
    expect(migrateProduct(v1({ oldPrice: 99 })).oldPrice).toBe(99);
  });

  it('drops an empty description, leaving one state for "no description"', () => {
    expect('description' in migrateProduct(v1({ description: '' }))).toBe(false);
    expect('description' in migrateProduct(v1({ description: undefined }))).toBe(false);
    expect(migrateProduct(v1({})).description).toBe('Calça Legging');
  });

  it('collapses the legacy singular image field', () => {
    const migrated = migrateProduct(v1({ images: undefined, image: 'images/2709252015-nike.jpeg' }));
    expect(migrated.images).toEqual(['images/2709252015-nike.jpeg']);
  });

  // The bug the acceptance gate caught: a row with no units has nothing to carry
  // the flag, so it has to stay at row level or the product goes back on sale.
  it('keeps a row-level soldOut when there are no units', () => {
    const migrated = migrateProduct(v1({ size: 'N/A', soldOut: true }));
    expect(migrated.sizes).toEqual([]);
    expect(migrated.soldOut).toBe(true);
  });

  it('does not duplicate soldOut at both levels', () => {
    const migrated = migrateProduct(v1({ size: 'G', soldOut: true }));
    expect(migrated.sizes).toEqual([{ size: 'G', soldOut: true }]);
    expect('soldOut' in migrated).toBe(false);
  });

  it('emits a stable field order', () => {
    expect(Object.keys(migrateProduct(v1({ model: undefined }))))
      .toEqual(['id', 'brand', 'model', 'price', 'sizes', 'description', 'images', 'listedAt']);
  });
});

describe('The brand map against the real catalog', () => {
  const { brands } = loadRegistry();
  const all = listCategories(PRODUCTS_DIR).flatMap((category) => readCategory(PRODUCTS_DIR, category));

  it('maps every entry to a declared brand', () => {
    const unknown = Object.entries(BRAND_MAP)
      .filter(([, mapped]) => !Object.prototype.hasOwnProperty.call(brands, mapped.brand))
      .map(([tail]) => tail);
    expect(unknown).toEqual([]);
  });

  it('leaves no product carrying a v1 field', () => {
    const stale = all.filter((entry) => 'name' in entry || 'size' in entry || 'image' in entry);
    expect(stale).toEqual([]);
  });

  // The six placeholder brand strings the migration moved into `model` on an
  // unbranded row. Pinned by identity rather than by count: how many rows carry
  // a model is a fact about how many products the catalog happens to hold, and
  // pinning it failed the first submission that filled in Modelo — a product
  // added through the issue form turned 40 into 41 and reddened a PR that had
  // nothing to do with the migration.
  const PLACEHOLDER_BRAND_ROWS = [
    '2907251536',
    '0507251850',
    '1107251407',
    '1107251408',
    '1107251409',
    '0106250802',
  ];

  it('resolves every model conflation onto a declared brand', () => {
    const withModel = all.filter((entry) => entry.model);
    expect(withModel.length).toBeGreaterThan(0);
    expect(
      withModel.filter((entry) => !Object.prototype.hasOwnProperty.call(brands, entry.brand))
    ).toEqual([]);
  });

  it('keeps every placeholder brand string as the model of an unbranded row', () => {
    const byId = new Map(all.map((entry) => [entry.id, entry]));
    PLACEHOLDER_BRAND_ROWS.forEach((id) => {
      expect(byId.get(id)).toMatchObject({ brand: 'unbranded' });
      expect(byId.get(id).model).toBeTruthy();
    });
  });

  it('renders the two corrected brands', () => {
    const names = all.map((entry) => toRuntime(entry, brands).name);
    expect(names.some((name) => name.includes('Quiksilver'))).toBe(true);
    expect(names.filter((name) => name.includes('Quicksilver'))).toEqual([]);
    expect(names.some((name) => name.includes('Under Armour'))).toBe(true);
    expect(names.filter((name) => name.includes('Under Armor '))).toEqual([]);
  });
});
