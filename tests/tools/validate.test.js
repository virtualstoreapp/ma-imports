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
  // Several of these are now caught by both the schema and the hand-written
  // business rules, so each case asserts that its own message is present rather
  // than that exactly one error was produced. The layering is deliberate: the
  // schema states the shape, and the hand-written rules state the things JSON
  // Schema cannot express.
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
    expect(errors.filter((error) => expected.test(error))).toHaveLength(1);
  });

  it.each([
    ['an oldPrice equal to zero, the no-discount sentinel', { oldPrice: 0 }],
    ['an omitted oldPrice', { oldPrice: undefined }],
    ['an omitted description', { description: undefined }],
    ['an empty description, which 26 products still carry', { description: '' }],
    ['soldOut present and true', { soldOut: true }],
    ['a multi-size value, since a row may hold several units', { size: '39, 42' }],
  ])('accepts %s', (_label, overrides) => {
    expect(validate(withProduct(overrides))).toEqual({ errors: [], warnings: [] });
  });

  it('reports every problem in one run rather than stopping at the first', () => {
    const { errors } = validate({
      'caps-man': [
        { ...VALID_PRODUCT, price: 0 },
        { ...VALID_PRODUCT, name: 'no code', images: ['images/2907251533-gone.jpeg'] },
      ],
    });
    // Two products, three distinct defects: the price, the missing code, and the
    // absent file. Schema errors add to this, so the assertion is on coverage.
    expect(errors.filter((error) => /price must be a positive number/.test(error))).toHaveLength(1);
    expect(errors.filter((error) => /missing its \[DDMMYYHHmm\] code/.test(error))).toHaveLength(1);
    expect(errors.filter((error) => /does not exist on disk/.test(error))).toHaveLength(1);
  });
});

describe('Schema gate', () => {
  it('accepts the real catalog unchanged, as a descriptive schema must', () => {
    const { errors } = validateCatalog({
      productsDir: path.join(ROOT, 'products'),
      scriptsPath: path.join(ROOT, 'scripts.js'),
    });
    expect(errors).toEqual([]);
  });

  it('rejects an unknown property, which is how a typo surfaces', () => {
    const { errors } = validate(withProduct({ imgaes: ['images/2907251533-adidas.jpeg'] }));
    expect(errors.filter((error) => /has unknown property "imgaes"/.test(error))).toHaveLength(1);
  });

  it('names the offending product by index so it can be found', () => {
    const { errors } = validate({
      'caps-man': [VALID_PRODUCT, { ...VALID_PRODUCT, price: 'free' }],
    });
    expect(errors.some((error) => error.includes('caps-man.json[1].price'))).toBe(true);
  });

  // Wave 0 normalised the last 33 legacy singulars, so every product now uses
  // images[]. The schema locks that in; scripts.js and productImages() keep
  // their fallback branch until Wave 5b, so rendering an old shape still works.
  it('rejects the legacy singular "image" field now that no product uses it', () => {
    const { errors } = validate(withProduct({ images: undefined, image: 'images/2907251533-adidas.jpeg' }));
    expect(errors.filter((error) => /has unknown property "image"/.test(error))).toHaveLength(1);
  });

  it.each([
    ['a name not opening with the code', { name: 'Adidas [2907251533]' }, /name/],
    ['a non-jpeg image', { images: ['images/2907251533-adidas.png'] }, /images\[0\]/],
    ['a duplicated image reference', {
      images: ['images/2907251533-adidas.jpeg', 'images/2907251533-adidas.jpeg'],
    }, /duplicate items/],
    ['an empty size', { size: '' }, /size/],
  ])('rejects %s', (_label, overrides, expected) => {
    const { errors } = validate(withProduct(overrides));
    expect(errors.some((error) => expected.test(error))).toBe(true);
  });

  it('rejects an empty category file', () => {
    const { errors } = validate({ 'caps-man': [] });
    expect(errors.some((error) => /caps-man\.json/.test(error))).toBe(true);
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

describe('Image variant suffixes', () => {
  const pair = ['images/2907251533-adidas-front.jpeg', 'images/2907251533-adidas-back.jpeg'];
  const manifest = Object.fromEntries(pair.map((source) => [source, {}]));

  const validateWith = (images, extraManifest = manifest) =>
    validateCatalog({
      ...writeFixture({ 'caps-man': [{ ...VALID_PRODUCT, images }] }),
      manifest: { ...extraManifest, ...Object.fromEntries(images.map((i) => [i, {}])) },
    });

  it('accepts a front/back pair', () => {
    expect(validateWith(pair).errors).toEqual([]);
  });

  it('accepts a single image with no variant suffix', () => {
    expect(validateWith(['images/2907251533-adidas.jpeg']).errors).toEqual([]);
  });

  it('rejects a second image with no suffix to order it by', () => {
    const { errors } = validateWith([
      'images/2907251533-adidas.jpeg',
      'images/2907251533-adidas-2.jpeg',
    ]);
    expect(errors.filter((error) => /needs a "front" or "back" suffix/.test(error))).toHaveLength(2);
  });

  it('rejects two images claiming the same variant', () => {
    const { errors } = validateWith([
      'images/2907251533-adidas-front.jpeg',
      'images/2907251533-adidas-alt-front.jpeg',
    ]);
    expect(errors.filter((error) => /both claim the "front" variant/.test(error))).toHaveLength(1);
  });

  // A lone -front is nearly always a -back that was forgotten on upload.
  it('rejects a lone variant suffix on a single-image product', () => {
    const { errors } = validateWith(['images/2907251533-adidas-front.jpeg']);
    expect(errors.filter((error) => /its counterpart is missing/.test(error))).toHaveLength(1);
  });
});

describe('Orphaned images', () => {
  const referenced = 'images/2907251533-adidas.jpeg';

  const validateWithManifest = (manifestKeys) =>
    validateCatalog({
      ...writeFixture({ 'caps-man': [VALID_PRODUCT] }),
      manifest: Object.fromEntries(manifestKeys.map((key) => [key, {}])),
    });

  it('warns without failing the build, since an orphan breaks nothing', () => {
    const { errors, warnings } = validateWithManifest([referenced, 'images/9999999999-ghost.jpeg']);
    expect(errors).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/9999999999-ghost\.jpeg is not referenced by any product/);
  });

  it('allows images used outside the catalog', () => {
    const { warnings } = validateWithManifest([referenced, 'images/logo.jpeg']);
    expect(warnings).toEqual([]);
  });

  it('stays silent when no manifest is supplied, since disk was not read', () => {
    const { warnings } = validateCatalog(writeFixture({ 'caps-man': [VALID_PRODUCT] }));
    expect(warnings).toEqual([]);
  });

  it('reports orphans in a stable order', () => {
    const { warnings } = validateWithManifest([
      referenced,
      'images/9999999999-b.jpeg',
      'images/9999999999-a.jpeg',
    ]);
    expect(warnings.map((warning) => warning.split(' ')[0])).toEqual([
      'images/9999999999-a.jpeg',
      'images/9999999999-b.jpeg',
    ]);
  });
});

describe('Duplicate product codes', () => {
  // Promoted from warning to error in Wave 2. The code exists to tell two
  // same-brand products apart, so a collision defeats its only purpose. Zero
  // collisions exist today, which is what makes this free to enforce now.
  it('fails the build, naming both locations', () => {
    const { errors } = validate({
      'caps-man': [VALID_PRODUCT, { ...VALID_PRODUCT, name: '[2907251533] Nike' }],
    });
    const duplicates = errors.filter((error) => /duplicate product code \[2907251533\]/.test(error));
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toContain('caps-man.json[0]');
    expect(duplicates[0]).toContain('caps-man.json[1]');
  });

  it('catches a collision spanning two category files', () => {
    const { errors } = validate({
      'caps-man': [VALID_PRODUCT],
      'belts-man': [{ ...VALID_PRODUCT, name: '[2907251533] Gucci' }],
    });
    expect(errors.filter((error) => /duplicate product code/.test(error))).toHaveLength(1);
  });

  it('accepts distinct codes', () => {
    const { errors } = validate({
      'caps-man': [VALID_PRODUCT, { ...VALID_PRODUCT, name: '[2907251534] Nike' }],
    });
    expect(errors.filter((error) => /duplicate product code/.test(error))).toEqual([]);
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
