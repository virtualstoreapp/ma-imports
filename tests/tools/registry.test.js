const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  REGISTRY_END_MARKER,
  REGISTRY_START_MARKER,
  buildClientRegistry,
  flattenNav,
  loadRegistry,
  renderRegistryElement,
} = require('../../tools/lib/registry');

const { applyBlock } = require('../../tools/sync-registry');

const ROOT = path.join(__dirname, '../..');

const LEAF = {
  slug: 'caps-man',
  type: 'leaf',
  label: 'Bonés Masculino',
  navLabel: 'Bonés',
  gender: 'man',
  category: 'caps',
  imageDir: 'images/man/caps',
  usesBrandFolders: false,
};

const GENERATED = { slug: 'all', type: 'generated', label: 'Novidades', navLabel: 'Início' };

let fixtureRoot;

/**
 * Writes a throwaway pair of registry files and loads them.
 * @param {object} categories categories.json contents.
 * @param {object} [brands] brands.json contents.
 * @returns {object} The loaded registry.
 */
const load = (categories, brands = { brands: { nike: { label: 'Nike' } } }) => {
  const dir = fs.mkdtempSync(path.join(fixtureRoot, 'registry-'));
  const categoriesPath = path.join(dir, 'categories.json');
  const brandsPath = path.join(dir, 'brands.json');
  fs.writeFileSync(categoriesPath, JSON.stringify(categories));
  fs.writeFileSync(brandsPath, JSON.stringify(brands));
  return loadRegistry({ categoriesPath, brandsPath });
};

beforeAll(() => {
  fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-imports-registry-'));
});

afterAll(() => {
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
});

describe('flattenNav', () => {
  it('returns nodes depth-first in display order', () => {
    const flat = flattenNav([
      { slug: 'a', children: [{ slug: 'a1' }, { slug: 'a2' }] },
      { slug: 'b' },
    ]);
    expect(flat.map((node) => node.slug)).toEqual(['a', 'a1', 'a2', 'b']);
  });
});

describe('loadRegistry', () => {
  it('loads a minimal valid registry', () => {
    const registry = load({ nav: [GENERATED, LEAF] });
    expect(registry.leafSlugs).toEqual(['caps-man']);
    expect(registry.generated).toHaveLength(1);
    expect(registry.bySlug.get('caps-man').label).toBe('Bonés Masculino');
  });

  it('rejects a leaf missing a required field', () => {
    const { usesBrandFolders, ...incomplete } = LEAF;
    expect(() => load({ nav: [GENERATED, incomplete] }))
      .toThrow(/usesBrandFolders/);
  });

  it('rejects an unknown field, so a typo cannot sit unnoticed', () => {
    expect(() => load({ nav: [GENERATED, { ...LEAF, imgeDir: 'images' }] }))
      .toThrow(/categories\.json/);
  });

  it('rejects a group with no children', () => {
    expect(() => load({ nav: [{ slug: 'g', type: 'group', navLabel: 'G', children: [] }] }))
      .toThrow(/categories\.json/);
  });

  it('rejects an invalid gender', () => {
    expect(() => load({ nav: [GENERATED, { ...LEAF, gender: 'adult' }] }))
      .toThrow(/categories\.json/);
  });

  // The schema cannot express uniqueness across a recursive tree, so this is a
  // hand-written check: a duplicate slug would make bySlug order-dependent.
  it('rejects a slug declared twice', () => {
    expect(() =>
      load({
        nav: [
          GENERATED,
          LEAF,
          { slug: 'g', type: 'group', navLabel: 'G', children: [{ ...LEAF, category: 'other' }] },
        ],
      })
    ).toThrow(/duplicate slugs: caps-man/);
  });

  it('rejects an alias pointing at a slug that does not exist', () => {
    expect(() => load({ nav: [GENERATED, LEAF], aliases: { old: 'ghost' } }))
      .toThrow(/unusable aliases: old -> ghost/);
  });

  // An alias whose source is still a live slug would shadow the real category.
  it('rejects an alias whose source is still declared', () => {
    expect(() => load({ nav: [GENERATED, LEAF], aliases: { 'caps-man': 'caps-man' } }))
      .toThrow(/unusable aliases/);
  });

  it('rejects a brand entry without a label', () => {
    expect(() => load({ nav: [GENERATED, LEAF] }, { brands: { nike: {} } }))
      .toThrow(/brands\.json/);
  });

  it('loads the real registry', () => {
    const registry = loadRegistry();
    expect(registry.leaves).toHaveLength(26);
    expect(registry.groups).toHaveLength(19);
    expect(registry.generated).toHaveLength(1);
    // Completed in Wave 4: every brand in the catalog, plus the `unbranded` sentinel.
    expect(Object.keys(registry.brands)).toHaveLength(38);
    expect(registry.brands.unbranded.label).toBe('');
  });
});

describe('buildClientRegistry', () => {
  it('carries only what the client needs', () => {
    const payload = buildClientRegistry(load({ nav: [GENERATED, LEAF], aliases: {} }));
    expect(payload).toEqual({
      labels: { all: 'Novidades', 'caps-man': 'Bonés Masculino' },
      leaves: ['caps-man'],
      aliases: {},
    });
  });

  it('omits groups, which are not selectable', () => {
    const payload = buildClientRegistry(
      load({ nav: [GENERATED, { slug: 'g', type: 'group', navLabel: 'G', children: [LEAF] }] })
    );
    expect(Object.keys(payload.labels).sort()).toEqual(['all', 'caps-man']);
  });

  it('matches the real registry against index.html', () => {
    const payload = buildClientRegistry(loadRegistry());
    expect(Object.keys(payload.labels)).toHaveLength(27);
    expect(payload.leaves).toHaveLength(26);
    expect(payload.aliases['underwear-man-subcategory']).toBe('underwear-man');
  });
});

describe('applyBlock', () => {
  const block = () => renderRegistryElement(load({ nav: [GENERATED, LEAF] }));

  it('inserts the block before scripts.js on first run', () => {
    const html = '<body>\n  <script src="scripts.js"></script>\n</body>\n';
    const updated = applyBlock(html, block());
    expect(updated).toContain(REGISTRY_START_MARKER);
    expect(updated.indexOf(REGISTRY_START_MARKER)).toBeLessThan(updated.indexOf('src="scripts.js"'));
  });

  it('replaces rather than appends on a second run', () => {
    const html = '<body>\n  <script src="scripts.js"></script>\n</body>\n';
    const once = applyBlock(html, block());
    const twice = applyBlock(once, block());
    expect(twice).toBe(once);
    expect(twice.match(new RegExp(REGISTRY_START_MARKER, 'g'))).toHaveLength(1);
  });

  it('throws when the anchor is missing rather than silently doing nothing', () => {
    expect(() => applyBlock('<body></body>', block())).toThrow(/insertion anchor/);
  });

  // Regression test. An earlier version anchored the replacement on an optional
  // HTML comment, and because `[^]` matches newlines the comment group matched
  // from the Open Graph comment near the top of index.html all the way to a
  // later </script>, deleting most of the document. Unique markers prevent it.
  it('leaves unrelated comments and scripts untouched', () => {
    const html = [
      '<head>',
      '  <!-- Open Graph: link previews.',
      '       Crawlers do not resolve relative URLs. -->',
      '  <meta property="og:image" content="card.jpg">',
      '  <script>gtag("config");</script>',
      '</head>',
      '<body>',
      '  <script src="scripts.js"></script>',
      '</body>',
      '',
    ].join('\n');

    const updated = applyBlock(applyBlock(html, block()), block());

    expect(updated).toContain('<!-- Open Graph: link previews.');
    expect(updated).toContain('og:image');
    expect(updated).toContain('gtag("config");');
    expect(updated).toContain('src="scripts.js"');
    expect(updated.match(new RegExp(REGISTRY_END_MARKER, 'g'))).toHaveLength(1);
  });

  it('keeps the committed index.html in step with the registry', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(applyBlock(html, renderRegistryElement(loadRegistry()))).toBe(html);
  });

  it('produces a block the browser can parse as JSON', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const match = html.match(/<script id="category-registry" type="application\/json">([\s\S]*?)<\/script>/);
    expect(match).toBeTruthy();
    const parsed = JSON.parse(match[1]);
    expect(parsed.labels.all).toBe('Novidades');
    expect(parsed.leaves).toHaveLength(26);
  });
});
