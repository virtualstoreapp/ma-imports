const {
  MAX_IMAGE_BYTES,
  VARIANTS,
  allocateId,
  buildSubmission,
  extractImageUrls,
  imagePathFor,
  isAllowedAttachmentUrl,
  isSafeImagePath,
  listedAtFrom,
  parseIssueBody,
  parsePrice,
  parseSizes,
} = require('../../tools/lib/authoring');

const { loadRegistry } = require('../../tools/lib/registry');

const registry = loadRegistry();
const NOW = new Date('2026-08-22T14:35:00Z');

const body = (fields) =>
  Object.entries(fields)
    .map(([label, value]) => `### ${label}\n\n${value}\n`)
    .join('\n');

const VALID_FIELDS = {
  Categoria: 'caps-man',
  Marca: 'nike',
  'Preço': '89,90',
  Tamanhos: 'P, M',
  'Descrição': 'Boné aba curva',
};

const submit = (overrides = {}, options = {}) =>
  buildSubmission({
    fields: { ...VALID_FIELDS, ...overrides },
    registry,
    takenIds: new Set(),
    now: NOW,
    imageCount: 1,
    ...options,
  });

describe('parseIssueBody', () => {
  it('reads each field under its heading', () => {
    expect(parseIssueBody(body({ Categoria: 'caps-man', Marca: 'nike' })))
      .toEqual({ Categoria: 'caps-man', Marca: 'nike' });
  });

  it('omits a field GitHub marked as unanswered', () => {
    expect(parseIssueBody('### Marca\n\n_No response_\n')).toEqual({});
  });

  it('keeps a multi-line answer', () => {
    const fields = parseIssueBody('### Descrição\n\nlinha um\nlinha dois\n');
    expect(fields['Descrição']).toBe('linha um\nlinha dois');
  });

  it('tolerates an empty body', () => {
    expect(parseIssueBody('')).toEqual({});
    expect(parseIssueBody(undefined)).toEqual({});
  });

  // A maintainer may tidy the issue by hand before the workflow runs.
  it('tolerates extra blank lines and stray text before the first field', () => {
    expect(parseIssueBody('olá\n\n### Marca\n\n\nnike\n\n\n')).toEqual({ Marca: 'nike' });
  });
});

describe('parsePrice', () => {
  it.each([
    ['89,90', 89.9],
    ['89.90', 89.9],
    ['R$ 89,90', 89.9],
    ['120', 120],
  ])('reads %s', (raw, expected) => {
    expect(parsePrice(raw)).toBe(expected);
  });

  // Guessing at a malformed price is worse than rejecting it.
  it.each(['', 'grátis', '89,900', '-5', '0', '1.2.3', '89,9,9'])('rejects %s', (raw) => {
    expect(parsePrice(raw)).toBeNull();
  });
});

describe('parseSizes', () => {
  it('splits a multi-select answer into units', () => {
    expect(parseSizes('P, M, G')).toEqual({ sizes: [{ size: 'P' }, { size: 'M' }, { size: 'G' }] });
  });

  it('returns no units for a blank answer', () => {
    expect(parseSizes('')).toEqual({ sizes: [] });
    expect(parseSizes(undefined)).toEqual({ sizes: [] });
  });

  // Two units of the same size is a stock question the form cannot express, so
  // it is asked rather than assumed.
  it('rejects a duplicated size', () => {
    expect(parseSizes('M, M').error).toMatch(/listed twice/);
  });
});

describe('allocateId', () => {
  it('uses the current minute when it is free', () => {
    expect(allocateId(new Set(), NOW)).toBe('2208261435');
  });

  it('derives a listedAt that agrees with the id', () => {
    expect(listedAtFrom(allocateId(new Set(), NOW))).toBe('2026-08-22T14:35:00Z');
  });

  // The reason this exists: the code has minute granularity, so a clock alone
  // collides for two submissions in the same minute — and a collision is a build
  // error, not a warning.
  it('steps forward past a taken minute', () => {
    expect(allocateId(new Set(['2208261435']), NOW)).toBe('2208261436');
  });

  it('steps past a run of taken minutes', () => {
    const taken = new Set(['2208261435', '2208261436', '2208261437']);
    expect(allocateId(taken, NOW)).toBe('2208261438');
  });

  it('never returns an id already in the catalog', () => {
    const taken = new Set();
    for (let i = 0; i < 50; i += 1) taken.add(allocateId(taken, NOW));
    expect(taken.size).toBe(50);
  });

  it('gives up rather than spinning when everything is taken', () => {
    const taken = new Set();
    for (let i = 0; i < 60 * 24; i += 1) {
      taken.add(allocateId(new Set([...taken]), NOW));
    }
    expect(() => allocateId(taken, NOW)).toThrow(/could not allocate/);
  });
});

describe('imagePathFor', () => {
  const flat = registry.bySlug.get('caps-man');
  const branded = registry.bySlug.get('shoes-man');

  it('places a flat category image directly in its directory', () => {
    expect(imagePathFor(flat, 'nike', '2208261435'))
      .toBe('images/man/caps/2208261435-nike.jpeg');
  });

  it('places a branded product inside its brand folder', () => {
    expect(imagePathFor(branded, 'nike', '2208261435'))
      .toBe('images/man/shoes/nike/2208261435-nike.jpeg');
  });

  // Matching validator rule 4a: an unbranded product has no folder to sit in.
  it('keeps an unbranded product out of a brand folder', () => {
    expect(imagePathFor(branded, 'unbranded', '2208261435'))
      .toBe('images/man/shoes/2208261435.jpeg');
  });

  it('adds the variant suffix for a two-photo product', () => {
    expect(imagePathFor(flat, 'nike', '2208261435', 'front'))
      .toBe('images/man/caps/2208261435-nike-front.jpeg');
  });

  it('refuses an unknown variant', () => {
    expect(() => imagePathFor(flat, 'nike', '2208261435', 'side')).toThrow(/unknown image variant/);
  });
});

describe('buildSubmission', () => {
  it('builds a valid product', () => {
    const result = submit();
    expect(result.errors).toBeUndefined();
    expect(result.category).toBe('caps-man');
    expect(result.product).toEqual({
      id: '2208261435',
      brand: 'nike',
      price: 89.9,
      sizes: [{ size: 'P' }, { size: 'M' }],
      description: 'Boné aba curva',
      images: ['images/man/caps/2208261435-nike.jpeg'],
      listedAt: '2026-08-22T14:35:00Z',
    });
  });

  it('produces a product the catalog schema accepts', () => {
    const { compileProductSchema } = require('../../tools/lib/validate');
    const matches = compileProductSchema();
    expect(matches([submit().product])).toBe(true);
  });

  it('names both files for a two-photo product', () => {
    expect(submit({}, { imageCount: 2 }).imagePaths).toEqual([
      'images/man/caps/2208261435-nike-front.jpeg',
      'images/man/caps/2208261435-nike-back.jpeg',
    ]);
  });

  it('defaults a blank brand to unbranded', () => {
    expect(submit({ Marca: undefined }).product.brand).toBe('unbranded');
  });

  it('carries a size note when there are no sizes', () => {
    const result = submit({ Tamanhos: undefined, 'Observação de tamanho': 'Consultar' });
    expect(result.product.sizes).toEqual([]);
    expect(result.product.sizeNote).toBe('Consultar');
  });

  it('omits optional fields rather than emitting sentinels', () => {
    const product = submit({ 'Descrição': undefined }).product;
    expect('description' in product).toBe(false);
    expect('oldPrice' in product).toBe(false);
    expect('model' in product).toBe(false);
  });

  it('accepts a genuine discount', () => {
    expect(submit({ 'Preço antigo': '129,90' }).product.oldPrice).toBe(129.9);
  });

  describe('rejections', () => {
    it.each([
      ['a missing category', { Categoria: undefined }, /Categoria is required/],
      ['an unknown category', { Categoria: 'ghost-man' }, /is not a category/],
      // A nav group is not selectable and has no products file.
      ['a nav group as the category', { Categoria: 'clothing-man-subcategory' }, /is not a category/],
      ['an unknown brand', { Marca: 'ghostbrand' }, /is not in catalog\/brands\.json/],
      ['a missing price', { 'Preço': undefined }, /Preço must be a positive number/],
      ['a discount that is not one', { 'Preço antigo': '10,00' }, /must be higher than/],
      ['both sizes and a note', { 'Observação de tamanho': 'Consultar' }, /not both/],
      ['a redundant N\\/A note', { Tamanhos: undefined, 'Observação de tamanho': 'N/A' }, /redundant/],
      ['a duplicated size', { Tamanhos: 'M, M' }, /listed twice/],
    ])('rejects %s', (_label, overrides, expected) => {
      const { errors } = submit(overrides);
      expect(errors.some((error) => expected.test(error))).toBe(true);
    });

    it('rejects a submission with no photo', () => {
      expect(submit({}, { imageCount: 0 }).errors).toContain('At least one photo is required.');
    });

    it('rejects more photos than the variant vocabulary supports', () => {
      expect(submit({}, { imageCount: 3 }).errors.some((e) => /At most 2 photos/.test(e))).toBe(true);
    });

    // All of them at once, so the submitter is not sent round the loop repeatedly.
    it('reports every problem in one pass', () => {
      const { errors } = submit({ Categoria: 'ghost', Marca: 'ghost', 'Preço': 'grátis' });
      expect(errors.length).toBeGreaterThanOrEqual(3);
    });

    // A path traversal cannot get through, because the path is composed from
    // registry values and the allocated id rather than from anything submitted.
    it('cannot be steered outside images/ by a crafted category', () => {
      const { errors } = submit({ Categoria: '../../etc/passwd' });
      expect(errors.some((error) => /is not a category/.test(error))).toBe(true);
    });

    it('cannot be steered outside images/ by a crafted brand', () => {
      const { errors } = submit({ Marca: '../../../root' });
      expect(errors.some((error) => /is not in catalog\/brands\.json/.test(error))).toBe(true);
    });
  });
});

describe('extractImageUrls', () => {
  const ok = 'https://user-images.githubusercontent.com/1/photo.jpeg';

  it('reads a markdown image', () => {
    expect(extractImageUrls(`![foto](${ok})`)).toEqual([ok]);
  });

  it('reads an html image', () => {
    expect(extractImageUrls(`<img src="${ok}" width="300">`)).toEqual([ok]);
  });

  it('keeps upload order and de-duplicates', () => {
    const second = 'https://github.com/o/r/assets/1/b.jpeg';
    expect(extractImageUrls(`![a](${ok})\n![a](${ok})\n![b](${second})`)).toEqual([ok, second]);
  });

  // Otherwise a submitter could make the runner fetch any URL they like.
  it.each([
    'https://evil.example.com/payload.jpeg',
    'http://user-images.githubusercontent.com/1/x.jpeg',
    'file:///etc/passwd',
    'https://user-images.githubusercontent.com.evil.example.com/x.jpeg',
  ])('ignores %s', (url) => {
    expect(extractImageUrls(`![x](${url})`)).toEqual([]);
    expect(isAllowedAttachmentUrl(url)).toBe(false);
  });

  it('ignores a body with no images', () => {
    expect(extractImageUrls('### Marca\n\nnike')).toEqual([]);
  });
});

describe('isSafeImagePath', () => {
  it('accepts a composed catalog path', () => {
    expect(isSafeImagePath('images/man/caps/2208261435-nike.jpeg')).toBe(true);
  });

  it.each([
    '../secrets.jpeg',
    'images/../../etc/passwd',
    '/etc/passwd',
    'C:/windows/system32',
    'products/all.json',
    'images/./x.jpeg',
    '',
  ])('rejects %s', (candidate) => {
    expect(isSafeImagePath(candidate)).toBe(false);
  });

  it('rejects a null byte', () => {
    expect(isSafeImagePath('images/x\0.jpeg')).toBe(false);
  });
});

describe('Constants', () => {
  it('caps the upload size', () => {
    expect(MAX_IMAGE_BYTES).toBe(12 * 1024 * 1024);
  });

  it('uses the same variant vocabulary as the validator', () => {
    const { IMAGE_VARIANTS } = require('../../tools/lib/validate');
    expect(VARIANTS.slice().sort()).toEqual([...IMAGE_VARIANTS].sort());
  });
});

describe('Resolving by label or slug', () => {
  const { NO_BRAND_OPTION, resolveBrand, resolveLeaf } = require('../../tools/lib/authoring');

  it('resolves a category by its human label, which is what the form shows', () => {
    expect(resolveLeaf(registry, 'Bonés Masculino').slug).toBe('caps-man');
  });

  it('resolves a category by slug, for an issue edited by hand', () => {
    expect(resolveLeaf(registry, 'caps-man').slug).toBe('caps-man');
  });

  it('refuses a nav group by either name', () => {
    expect(resolveLeaf(registry, 'clothing-man-subcategory')).toBeNull();
    expect(resolveLeaf(registry, 'Moda')).toBeNull();
  });

  it('resolves a brand by label and by slug', () => {
    expect(resolveBrand(registry, 'Tommy Hilfiger')).toBe('tommy-hilfiger');
    expect(resolveBrand(registry, 'tommy-hilfiger')).toBe('tommy-hilfiger');
  });

  // `unbranded` has an empty label, so the form offers a readable sentinel.
  it('maps the no-brand option to unbranded', () => {
    expect(resolveBrand(registry, NO_BRAND_OPTION)).toBe('unbranded');
  });

  it('does not resolve the empty label to unbranded by accident', () => {
    expect(resolveBrand(registry, '')).toBeNull();
  });

  it('refuses an unknown brand', () => {
    expect(resolveBrand(registry, 'Ghostbrand')).toBeNull();
  });

  it('accepts a submission that used labels throughout', () => {
    const result = submit({ Categoria: 'Bonés Masculino', Marca: 'Nike' });
    expect(result.errors).toBeUndefined();
    expect(result.category).toBe('caps-man');
    expect(result.product.brand).toBe('nike');
  });
});
