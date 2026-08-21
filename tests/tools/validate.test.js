const fs = require('fs');
const os = require('os');
const path = require('path');

const { validateCatalog } = require('../../tools/lib/validate');

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
 * Builds a registry shaped like loadRegistry's output, without touching disk.
 *
 * Wave 3 replaced the CATEGORIES_DICT scraper with catalog/categories.json, so
 * fixtures declare their categories here instead of in a fake scripts.js.
 * @param {string[]} leafSlugs Leaves to declare.
 * @param {object} [options] Shape overrides.
 * @param {string[]} [options.groupSlugs] Nav-only groups to declare.
 * @param {object} [options.leafOverrides] Per-slug leaf field overrides.
 * @param {object} [options.brands] Brand registry.
 * @param {object} [options.aliases] Alias map.
 * @returns {object} A registry.
 */
const fixtureRegistry = (leafSlugs, options = {}) => {
  const { groupSlugs = [], leafOverrides = {}, brands = {}, aliases = {} } = options;

  const leaves = leafSlugs.map((slug) => ({
    slug,
    type: 'leaf',
    label: 'Rótulo',
    navLabel: 'Rótulo',
    gender: 'man',
    category: slug,
    imageDir: 'images',
    usesBrandFolders: false,
    ...(leafOverrides[slug] || {}),
  }));
  const groups = groupSlugs.map((slug) => ({ slug, type: 'group', navLabel: 'Grupo', children: [] }));
  const generated = [{ slug: 'all', type: 'generated', label: 'Novidades', navLabel: 'Início' }];
  const nodes = [...generated, ...groups, ...leaves];

  return {
    categories: { nav: nodes, aliases },
    brands,
    nodes,
    leaves,
    groups,
    generated,
    aliases,
    bySlug: new Map(nodes.map((node) => [node.slug, node])),
    leafSlugs: leaves.map((leaf) => leaf.slug),
  };
};

/**
 * Writes a throwaway products directory plus the index.html the nav check reads.
 * @param {object} categories Map of category slug to product array.
 * @param {object} [options] Passed to fixtureRegistry, plus navSlugs.
 * @returns {object} Paths and the registry to validate against.
 */
const writeFixture = (categories, options = {}) => {
  const dir = fs.mkdtempSync(path.join(fixtureRoot, 'catalog-'));
  const productsDir = path.join(dir, 'products');
  fs.mkdirSync(productsDir);

  for (const [category, products] of Object.entries(categories)) {
    fs.writeFileSync(path.join(productsDir, `${category}.json`), JSON.stringify(products));
  }

  const registry = options.registry || fixtureRegistry(Object.keys(categories), options);
  const navSlugs = options.navSlugs || registry.nodes.map((node) => node.slug);
  const indexPath = path.join(dir, 'index.html');
  fs.writeFileSync(
    indexPath,
    navSlugs.map((slug) => `<button data-category="${slug}"></button>`).join('\n')
  );

  return { productsDir, indexPath, registry };
};

const validate = (categories, options = {}) =>
  validateCatalog({ ...writeFixture(categories, options), manifest: MANIFEST });

const withProduct = (overrides) => ({ 'caps-man': [{ ...VALID_PRODUCT, ...overrides }] });

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-imports-validate-'));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('Registry coverage', () => {
  // These four defects were previously possible because category identity was
  // declared in three places and only two were cross-checked.
  it('accepts a catalog whose files, registry and nav line up', () => {
    expect(validate(withProduct({}))).toEqual({ errors: [], warnings: [] });
  });

  it('rejects a product file with no leaf, since it is unreachable from the nav', () => {
    const { errors } = validate(withProduct({}), {
      registry: fixtureRegistry([]),
      navSlugs: ['all'],
    });
    expect(errors.filter((e) => /caps-man\.json has no leaf in catalog\/categories\.json/.test(e)))
      .toHaveLength(1);
  });

  it('rejects a leaf with no product file, since the fallback merge would 404', () => {
    const { errors } = validate(withProduct({}), {
      registry: fixtureRegistry(['caps-man', 'ghost-man']),
    });
    expect(errors.filter((e) => /declares leaf "ghost-man" but products\/ghost-man\.json does not exist/.test(e)))
      .toHaveLength(1);
  });

  // This is the defect that made underwear-man-subcategory look like a group.
  it('rejects a nav group that has a products file', () => {
    const { errors } = validate(withProduct({}), {
      registry: fixtureRegistry([], { groupSlugs: ['caps-man'] }),
      navSlugs: ['all', 'caps-man'],
    });
    expect(errors.filter((e) => /"caps-man" is a nav group but products\/caps-man\.json exists/.test(e)))
      .toHaveLength(1);
  });

  it('rejects a data-category the registry does not declare', () => {
    const { errors } = validate(withProduct({}), { navSlugs: ['all', 'caps-man', 'mystery-man'] });
    expect(errors.filter((e) => /data-category="mystery-man", which catalog\/categories\.json does not declare/.test(e)))
      .toHaveLength(1);
  });

  it('rejects a leaf the nav never links to', () => {
    const { errors } = validate(withProduct({}), { navSlugs: ['all'] });
    expect(errors.filter((e) => /declares leaf "caps-man" but index\.html has no button for it/.test(e)))
      .toHaveLength(1);
  });
});

describe('The real registry', () => {
  const { loadRegistry } = require('../../tools/lib/registry');

  it('loads and validates against its schemas', () => {
    expect(() => loadRegistry()).not.toThrow();
  });

  it('declares one leaf per products file, and no group with a file', () => {
    const registry = loadRegistry();
    const files = fs
      .readdirSync(path.join(ROOT, 'products'))
      .filter((file) => file.endsWith('.json'))
      .map((file) => path.basename(file, '.json'));

    expect([...registry.leafSlugs].sort()).toEqual([...files].sort());
    expect(registry.groups.filter((group) => files.includes(group.slug))).toEqual([]);
  });

  it('covers every data-category in index.html', () => {
    const registry = loadRegistry();
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const navSlugs = [...new Set([...html.matchAll(/data-category="([^"]+)"/g)].map(([, s]) => s))];

    expect(navSlugs.filter((slug) => !registry.bySlug.has(slug))).toEqual([]);
    expect(navSlugs).toHaveLength(46);
  });

  it('keeps the retired underwear slug resolvable', () => {
    const registry = loadRegistry();
    expect(registry.aliases['underwear-man-subcategory']).toBe('underwear-man');
    expect(registry.bySlug.has('underwear-man-subcategory')).toBe(false);
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
      indexPath: path.join(ROOT, 'index.html'),
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
      ...writeFixture(
        { 'caps-man': [{ ...VALID_PRODUCT, images: Object.keys(manifest) }] },
        { leafOverrides: { 'caps-man': { imageDir: 'images/man/belts' } } }
      ),
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

describe('Image location (rule 4a)', () => {
  const validateAt = (images, leafOverrides) =>
    validateCatalog({
      ...writeFixture(
        { 'caps-man': [{ ...VALID_PRODUCT, images }] },
        { leafOverrides: { 'caps-man': leafOverrides }, brands: { nike: { label: 'Nike' } } }
      ),
      manifest: Object.fromEntries(images.map((image) => [image, {}])),
    });

  const FLAT = { imageDir: 'images/man/caps', usesBrandFolders: false };
  const BRANDED = { imageDir: 'images/man/shoes', usesBrandFolders: true };

  it('accepts a flat category image directly in its directory', () => {
    expect(validateAt(['images/man/caps/2907251533-adidas.jpeg'], FLAT).errors).toEqual([]);
  });

  it('rejects an image outside its category directory', () => {
    const { errors } = validateAt(['images/man/belts/2907251533-adidas.jpeg'], FLAT);
    expect(errors.filter((e) => /is outside images\/man\/caps\//.test(e))).toHaveLength(1);
  });

  it('rejects a brand folder in a flat category', () => {
    const { errors } = validateAt(['images/man/caps/adidas/2907251533-adidas.jpeg'], FLAT);
    expect(errors.filter((e) => /must sit directly in images\/man\/caps\//.test(e))).toHaveLength(1);
  });

  it('accepts a branded product inside its brand folder', () => {
    const { errors } = validateAt(['images/man/shoes/nike/2907251533-nike.jpeg'], {
      ...BRANDED,
    });
    expect(errors.filter((e) => /must sit|is outside|brand folder/.test(e))).toEqual([]);
  });

  it('rejects a branded product sitting loose in a brand-folder category', () => {
    const { errors } = validateAt(['images/man/shoes/2907251533-nike.jpeg'], BRANDED);
    expect(errors.filter((e) => /must sit in a brand folder under images\/man\/shoes\//.test(e)))
      .toHaveLength(1);
  });

  it('rejects a brand folder the brand registry does not declare', () => {
    const { errors } = validateAt(['images/man/shoes/adidas/2907251533-adidas.jpeg'], BRANDED);
    expect(errors.filter((e) => /uses brand folder "adidas", which catalog\/brands\.json does not declare/.test(e)))
      .toHaveLength(1);
  });

  // All 6 brandless products sit directly in their category directory, which is
  // what makes shorts-jeans-man's apparently mixed shape regular rather than a
  // defect. A brandless product has no brand folder to go into.
  it('accepts a brandless product loose in a brand-folder category', () => {
    const { errors } = validateCatalog({
      ...writeFixture(
        { 'caps-man': [{ ...VALID_PRODUCT, name: '[2907251533]', images: ['images/man/shoes/2907251533.jpeg'] }] },
        { leafOverrides: { 'caps-man': BRANDED } }
      ),
      manifest: { 'images/man/shoes/2907251533.jpeg': {} },
    });
    expect(errors).toEqual([]);
  });

  it('rejects a brandless product placed in a brand folder anyway', () => {
    const { errors } = validateCatalog({
      ...writeFixture(
        { 'caps-man': [{ ...VALID_PRODUCT, name: '[2907251533]', images: ['images/man/shoes/nike/2907251533.jpeg'] }] },
        { leafOverrides: { 'caps-man': BRANDED }, brands: { nike: { label: 'Nike' } } }
      ),
      manifest: { 'images/man/shoes/nike/2907251533.jpeg': {} },
    });
    expect(errors.filter((e) => /must sit directly in images\/man\/shoes\//.test(e))).toHaveLength(1);
  });

  it('rejects a path nested deeper than the convention allows', () => {
    const { errors } = validateAt(['images/man/shoes/nike/air/2907251533-nike.jpeg'], BRANDED);
    expect(errors.filter((e) => /must sit in a brand folder under/.test(e))).toHaveLength(1);
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
      indexPath: path.join(ROOT, 'index.html'),
    });
    expect(errors).toEqual([]);
  });
});
