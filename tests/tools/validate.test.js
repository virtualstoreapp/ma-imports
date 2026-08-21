const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  readCategoryDictKeys,
  validateCatalog,
} = require('../../tools/lib/validate');

const ROOT = path.join(__dirname, '../..');

const VALID_PRODUCT = {
  name: '[2907251533] Adidas',
  description: '',
  oldPrice: 0,
  price: 39,
  size: 'N/A',
  images: ['images/2907251533-adidas.jpeg'],
};

const MANIFEST = { 'images/2907251533-adidas.jpeg': { src: 'images/2907251533-adidas.jpeg' } };

let fixtureRoot;

/**
 * Writes a throwaway catalog plus the scripts.js that declares its categories.
 * @param {object} categories Map of category slug to product array.
 * @param {string[]} [dictKeys] Keys to declare, defaulting to the categories written.
 * @returns {{productsDir: string, scriptsPath: string}} Fixture paths.
 */
const writeFixture = (categories, dictKeys) => {
  const dir = fs.mkdtempSync(path.join(fixtureRoot, 'catalog-'));
  const productsDir = path.join(dir, 'products');
  fs.mkdirSync(productsDir);

  for (const [category, products] of Object.entries(categories)) {
    fs.writeFileSync(path.join(productsDir, `${category}.json`), JSON.stringify(products));
  }

  const keys = dictKeys || Object.keys(categories);
  const entries = [...keys.map((key) => `    '${key}': 'Rótulo',`), "    all: 'Novidades',"];
  const scriptsPath = path.join(dir, 'scripts.js');
  fs.writeFileSync(scriptsPath, `const CATEGORIES_DICT = {\n${entries.join('\n')}\n  }\n`);

  return { productsDir, scriptsPath };
};

const validate = (categories, dictKeys) =>
  validateCatalog({ ...writeFixture(categories, dictKeys), manifest: MANIFEST });

const withProduct = (overrides) => ({ 'caps-man': [{ ...VALID_PRODUCT, ...overrides }] });

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-imports-validate-'));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('CATEGORIES_DICT parsing', () => {
  it('reads the keys declared in the real scripts.js', () => {
    const keys = readCategoryDictKeys(path.join(ROOT, 'scripts.js'));
    expect(keys).toContain('all');
    expect(keys).toContain('caps-man');
    expect(keys.length).toBeGreaterThan(20);
  });

  it('throws rather than silently skipping the check when the map is gone', () => {
    const scriptsPath = path.join(fixtureRoot, 'no-dict.js');
    fs.writeFileSync(scriptsPath, 'const OTHER = { a: 1 };\n');
    expect(() => readCategoryDictKeys(scriptsPath)).toThrow(/CATEGORIES_DICT/);
  });
});

describe('Category coverage', () => {
  it('accepts a catalog whose files and menu entries line up', () => {
    expect(validate(withProduct({}))).toEqual({ errors: [], warnings: [] });
  });

  it('rejects a product file with no menu entry, since it is unreachable', () => {
    const { errors } = validate(withProduct({}), []);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/caps-man\.json has no CATEGORIES_DICT entry/);
  });

  it('rejects a menu entry with no product file, since the merge would 404', () => {
    const { errors } = validate(withProduct({}), ['caps-man', 'ghost-man']);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(/declares "ghost-man" but products\/ghost-man\.json does not exist/);
  });
});

describe('Product fields', () => {
  it.each([
    ['a name without its date code', { name: 'Adidas' }, /missing its \[DDMMYYHHmm\] code/],
    ['a zero price', { price: 0 }, /price must be a positive number/],
    ['a non-numeric price', { price: '39' }, /price must be a positive number/],
    ['an oldPrice below price', { oldPrice: 10, price: 39 }, /must exceed price/],
    ['an oldPrice equal to price', { oldPrice: 39, price: 39 }, /must exceed price/],
    ['a non-boolean soldOut', { soldOut: 'yes' }, /soldOut must be a boolean/],
    ['a non-string description', { description: 5 }, /description must be a string/],
    ['no image reference', { images: undefined }, /must reference at least one image/],
    ['an empty image list', { images: [] }, /must reference at least one image/],
    ['an image missing on disk', { images: ['images/2907251533-gone.jpeg'] }, /does not exist on disk/],
  ])('rejects %s', (_label, overrides, expected) => {
    const { errors } = validate(withProduct(overrides));
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatch(expected);
  });

  it('accepts the legacy singular "image" field', () => {
    const { errors } = validate(withProduct({ images: undefined, image: 'images/2907251533-adidas.jpeg' }));
    expect(errors).toEqual([]);
  });

  it('reports every problem in one run rather than stopping at the first', () => {
    const { errors } = validate({
      'caps-man': [
        { ...VALID_PRODUCT, price: 0 },
        { ...VALID_PRODUCT, name: 'no code', images: ['images/2907251533-gone.jpeg'] },
      ],
    });
    expect(errors).toHaveLength(3);
  });
});

describe('Image filename convention', () => {
  // Each case is a defect that existed in the catalog and was invisible to the
  // old gate, which only checked that the referenced file resolved.
  it.each([
    [
      'an 11-digit code from a stray leading zero',
      'images/04507251850-star.jpeg',
      /leads with 11 digits; the product code is 10/,
    ],
    [
      'a code that disagrees with the product',
      'images/1109251223-adidas.jpeg',
      /named for \[1109251223\] but belongs to \[2907251533\]/,
    ],
    [
      'transposed digits',
      'images/2907521533-adidas.jpeg',
      /named for \[2907521533\] but belongs to \[2907251533\]/,
    ],
    [
      'a filename with no leading code at all',
      'images/adidas.jpeg',
      /must be named after its product code \[2907251533\]/,
    ],
  ])('rejects %s', (_label, image, expected) => {
    const { errors } = validate(withProduct({ images: [image] }));
    // The manifest check fires too, since these paths are not in it. Only the
    // naming error is asserted here.
    expect(errors.filter((error) => expected.test(error))).toHaveLength(1);
  });

  it('accepts a conforming name, including brand and variant suffixes', () => {
    const manifest = {
      'images/man/belts/2907251533-gucci-front.jpeg': {},
      'images/man/belts/2907251533-gucci-back.jpeg': {},
    };
    const { errors } = validateCatalog({
      ...writeFixture({
        'caps-man': [{ ...VALID_PRODUCT, images: Object.keys(manifest) }],
      }),
      manifest,
    });
    expect(errors).toEqual([]);
  });

  it('stays silent when the name has no code, leaving that error to speak once', () => {
    const { errors } = validate(withProduct({ name: 'Adidas', images: ['images/whatever.jpeg'] }));
    expect(errors.filter((error) => /must be named after/.test(error))).toEqual([]);
    expect(errors.filter((error) => /missing its \[DDMMYYHHmm\] code/.test(error))).toHaveLength(1);
  });
});

describe('Duplicate product codes', () => {
  it('warns without failing the build, naming both locations', () => {
    const { errors, warnings } = validate({
      'caps-man': [VALID_PRODUCT, { ...VALID_PRODUCT, name: '[2907251533] Nike' }],
    });
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/duplicate product code \[2907251533\]/);
    expect(warnings[0]).toContain('caps-man.json[0]');
    expect(warnings[0]).toContain('caps-man.json[1]');
  });
});

describe('The real catalog', () => {
  // Keeps catalog defects failing in `npm test`, not only in `npm run build`.
  it('has no validation errors', () => {
    const { errors } = validateCatalog({
      productsDir: path.join(ROOT, 'products'),
      scriptsPath: path.join(ROOT, 'scripts.js'),
    });
    expect(errors).toEqual([]);
  });
});
