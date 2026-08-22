const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const { checkAuthor, processIssue, reencode } = require('../../tools/authoring/add-product');

const ROOT = path.join(__dirname, '../..');
const PHOTO_URL = 'https://user-images.githubusercontent.com/1/photo.jpeg';
const NOW = new Date('2026-08-22T14:35:00Z');

const issueBody = (overrides = {}, photos = 1) => {
  const fields = {
    Categoria: 'Bonés Masculino',
    Marca: 'Nike',
    'Preço': '89,90',
    Tamanhos: 'P, M',
    'Descrição': 'Boné aba curva',
    ...overrides,
  };

  const sections = Object.entries(fields)
    .filter(([, value]) => value !== undefined)
    .map(([label, value]) => `### ${label}\n\n${value}\n`);

  const images = Array.from({ length: photos }, (_, i) => `![foto](${PHOTO_URL}?n=${i})`);
  if (photos) sections.push(`### Fotos\n\n${images.join('\n')}\n`);

  return sections.join('\n');
};

/** A real JPEG, so sharp has something genuine to decode. */
const jpeg = (width = 900) =>
  sharp({ create: { width, height: Math.round(width * 1.25), channels: 3, background: { r: 20, g: 90, b: 160 } } })
    .jpeg()
    .toBuffer();

const respondWith = (bytes) => async () => ({
  ok: true,
  status: 200,
  headers: { get: (name) => (name === 'content-length' ? String(bytes.length) : null) },
  arrayBuffer: async () => bytes,
});

const run = async (overrides = {}, options = {}) =>
  processIssue({
    body: issueBody(overrides, options.photos === undefined ? 1 : options.photos),
    author: 'owner',
    allowedAuthors: 'owner,collaborator',
    dryRun: true,
    now: NOW,
    fetchImpl: options.fetchImpl || respondWith(await jpeg()),
  });

describe('checkAuthor', () => {
  // First, before the body is read: without it, any GitHub user could file an
  // issue on a public repository and have the workflow commit for them.
  it('accepts an allow-listed author, case-insensitively', () => {
    expect(checkAuthor('Owner', 'owner,other')).toBeNull();
  });

  it('rejects an author who is not listed', () => {
    expect(checkAuthor('stranger', 'owner')).toMatch(/not on the allow-list/);
  });

  it('rejects everything when the allow-list is empty', () => {
    expect(checkAuthor('owner', '')).toMatch(/No allowed authors are configured/);
    expect(checkAuthor('owner', undefined)).toMatch(/No allowed authors are configured/);
  });

  it('rejects a missing author', () => {
    expect(checkAuthor('', 'owner')).toMatch(/no author/);
  });
});

describe('reencode', () => {
  // The upload is never stored as received: sharp either decodes it or throws,
  // which turns "is this an image?" into a decode rather than a guess.
  it('produces a JPEG from a JPEG', async () => {
    const out = await reencode(await jpeg());
    expect((await sharp(out).metadata()).format).toBe('jpeg');
  });

  it('caps the stored width', async () => {
    const out = await reencode(await jpeg(3000));
    expect((await sharp(out).metadata()).width).toBe(1600);
  });

  it('converts a PNG upload rather than storing it as-is', async () => {
    const png = await sharp({ create: { width: 400, height: 400, channels: 3, background: '#fff' } })
      .png()
      .toBuffer();
    expect((await sharp(await reencode(png)).metadata()).format).toBe('jpeg');
  });

  it('refuses a file that is not an image', async () => {
    await expect(reencode(Buffer.from('#!/bin/sh\nrm -rf /\n'))).rejects.toThrow(/not an image/);
  });
});

describe('processIssue', () => {
  it('builds a product from a filled-in form', async () => {
    const result = await run();
    expect(result.errors).toBeUndefined();
    expect(result.category).toBe('caps-man');
    expect(result.product).toMatchObject({
      brand: 'nike',
      price: 89.9,
      sizes: [{ size: 'P' }, { size: 'M' }],
      description: 'Boné aba curva',
    });
    expect(result.imagePaths).toEqual([`images/man/caps/${result.product.id}-nike.jpeg`]);
  });

  it('allocates an id no product already uses', async () => {
    const { product } = await run();
    const existing = fs
      .readdirSync(path.join(ROOT, 'products'))
      .filter((file) => file.endsWith('.json'))
      .flatMap((file) => JSON.parse(fs.readFileSync(path.join(ROOT, 'products', file), 'utf8')))
      .map((entry) => entry.id);
    expect(existing).not.toContain(product.id);
  });

  it('produces a product the catalog schema accepts', async () => {
    const { compileProductSchema } = require('../../tools/lib/validate');
    const { product } = await run();
    expect(compileProductSchema()([product])).toBe(true);
  });

  it('names both files for a two-photo submission', async () => {
    const result = await run({}, { photos: 2 });
    expect(result.imagePaths).toEqual([
      `images/man/caps/${result.product.id}-nike-front.jpeg`,
      `images/man/caps/${result.product.id}-nike-back.jpeg`,
    ]);
  });

  it('places an unbranded product outside any brand folder', async () => {
    const result = await run({ Categoria: 'Tênis', Marca: 'Sem marca' });
    expect(result.imagePaths[0]).toBe(`images/man/shoes/${result.product.id}.jpeg`);
  });

  describe('rejections', () => {
    it('refuses an author who is not allow-listed', async () => {
      const result = await processIssue({
        body: issueBody(),
        author: 'stranger',
        allowedAuthors: 'owner',
        dryRun: true,
        now: NOW,
        fetchImpl: respondWith(await jpeg()),
      });
      expect(result.errors[0]).toMatch(/not on the allow-list/);
    });

    it('refuses a submission with no photo', async () => {
      const result = await run({}, { photos: 0 });
      expect(result.errors).toContain('At least one photo is required.');
    });

    // A submitter could otherwise point the runner at any URL they like.
    it('ignores a photo hosted somewhere other than GitHub', async () => {
      const result = await processIssue({
        body: `${issueBody({}, 0)}\n### Fotos\n\n![x](https://evil.example.com/p.jpeg)\n`,
        author: 'owner',
        allowedAuthors: 'owner',
        dryRun: true,
        now: NOW,
        fetchImpl: respondWith(await jpeg()),
      });
      expect(result.errors).toContain('At least one photo is required.');
    });

    it('refuses an oversized photo even when content-length lies', async () => {
      const huge = Buffer.alloc(13 * 1024 * 1024, 1);
      const result = await run({}, {
        fetchImpl: async () => ({
          ok: true,
          status: 200,
          headers: { get: () => '10' },
          arrayBuffer: async () => huge,
        }),
      });
      expect(result.errors[0]).toMatch(/larger than/);
    });

    it('reports a failed download rather than throwing', async () => {
      const result = await run({}, {
        fetchImpl: async () => ({ ok: false, status: 404, headers: { get: () => null }, arrayBuffer: async () => Buffer.alloc(0) }),
      });
      expect(result.errors[0]).toMatch(/HTTP 404/);
    });

    it('refuses a payload that is not an image', async () => {
      const result = await run({}, { fetchImpl: respondWith(Buffer.from('not an image')) });
      expect(result.errors[0]).toMatch(/not an image/);
    });

    it.each([
      ['a crafted category', { Categoria: '../../../etc' }, /is not a category/],
      ['a crafted brand', { Marca: '../../root' }, /is not in catalog\/brands\.json/],
      ['a nav group', { Categoria: 'clothing-man-subcategory' }, /is not a category/],
      ['an unparseable price', { 'Preço': 'de graça' }, /must be a positive number/],
      ['a fake discount', { 'Preço antigo': '10,00' }, /must be higher than/],
    ])('refuses %s', async (_label, overrides, expected) => {
      const { errors } = await run(overrides);
      expect(errors.some((error) => expected.test(error))).toBe(true);
    });

    it('reports every problem at once, so the seller is not sent round the loop', async () => {
      const { errors } = await run({ Categoria: 'ghost', Marca: 'ghost', 'Preço': 'x' });
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // Two issues filed in the same minute would collide on a clock-derived code,
  // and a duplicate id is a build error.
  it('gives two same-minute submissions different ids', async () => {
    const { allocateId } = require('../../tools/lib/authoring');
    const first = allocateId(new Set(), NOW);
    const second = allocateId(new Set([first]), NOW);
    expect(second).not.toBe(first);
  });
});

describe('The generated issue form', () => {
  const { FIELDS, TEMPLATE_PATH, renderIssueForm } = require('../../tools/lib/issue-form');
  const { loadRegistry } = require('../../tools/lib/registry');

  it('is committed and up to date', () => {
    const committed = fs.readFileSync(path.join(ROOT, TEMPLATE_PATH), 'utf8');
    expect(renderIssueForm(loadRegistry())).toBe(committed);
  });

  // The form and the parser agree on field labels only because both are pinned
  // here; a renamed label in one would otherwise silently drop an answer.
  it('labels every field the parser reads', () => {
    const template = fs.readFileSync(path.join(ROOT, TEMPLATE_PATH), 'utf8');
    Object.values(FIELDS).forEach((label) => {
      expect(template).toContain(`label: "${label}"`);
    });
  });

  it('offers every category and brand from the registries', () => {
    const template = fs.readFileSync(path.join(ROOT, TEMPLATE_PATH), 'utf8');
    const registry = loadRegistry();

    registry.leaves.forEach((leaf) => expect(template).toContain(`- "${leaf.label}"`));
    Object.entries(registry.brands)
      .filter(([slug]) => slug !== 'unbranded')
      .forEach(([, brand]) => expect(template).toContain(`- "${brand.label}"`));
  });

  it('does not offer a nav group as a category', () => {
    const template = fs.readFileSync(path.join(ROOT, TEMPLATE_PATH), 'utf8');
    loadRegistry().groups.forEach((group) => {
      expect(template).not.toContain(`- "${group.navLabel}"\n`);
    });
  });

  // GitHub refuses to render the form when any field carries a placeholder: it
  // vanishes from the chooser and ?template= falls through to a blank issue,
  // with no error to say why. The form is valid by every documented rule, so
  // nothing but this test stands between a helpful-looking edit and a form
  // nobody can open. Each hint lives in a `description` instead.
  it('carries no placeholder', () => {
    const template = fs.readFileSync(path.join(ROOT, TEMPLATE_PATH), 'utf8');
    expect(template).not.toMatch(/placeholder:/);
  });

  // The workflow decides whether an issue is a submission by looking for these
  // two headings in its body, rather than for a label GitHub only applies when
  // it already exists. That makes the field labels load-bearing twice over, so
  // they are pinned here too: renaming one without updating the gate would stop
  // the workflow from firing at all, which is the silent failure this replaced.
  it('is recognised by the workflow that reads it', () => {
    const workflow = fs.readFileSync(path.join(ROOT, '.github/workflows/add-product.yml'), 'utf8');

    expect(workflow).toContain(`'### ${FIELDS.category}'`);
    expect(workflow).toContain(`'### ${FIELDS.photos}'`);
    expect(workflow).not.toMatch(/^\s*if: contains\(github\.event\.issue\.labels/m);
  });
});
