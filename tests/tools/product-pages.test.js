const fs = require('fs');
const path = require('path');

const {
  SITE,
  jsonLd,
  productUrl,
  renderProductPage,
  renderRobots,
  renderSitemap,
  sizeSummary,
  structuredData,
} = require('../../tools/lib/product-pages');

const ROOT = path.join(__dirname, '../..');

const product = (overrides = {}) => ({
  id: '2307251157',
  name: '[2307251157] Gucci',
  brand: 'gucci',
  brandLabel: 'Gucci',
  price: 89.9,
  sizes: [{ size: 'M' }, { size: 'G' }],
  images: ['images/man/belts/2307251157-gucci.jpeg'],
  listedAt: '2025-07-23T11:57:00Z',
  category: 'belts-man',
  media: [{
    src: 'images/man/belts/2307251157-gucci.jpeg',
    webp: 'images/man/belts/2307251157-gucci.webp',
    full: 'images/man/belts/2307251157-gucci.jpg',
    width: 1200,
    height: 1500,
  }],
  ...overrides,
});

const page = (overrides) => renderProductPage(product(overrides), 'Cintos Masculino');

describe('sizeSummary', () => {
  it('lists the sizes still available', () => {
    expect(sizeSummary(product())).toBe('Tamanhos: M, G');
  });

  // A partly sold-out row keeps selling, so the page shows what is left.
  it('omits a sold-out size', () => {
    expect(sizeSummary(product({ sizes: [{ size: 'M', soldOut: true }, { size: 'G' }] })))
      .toBe('Tamanho: G');
  });

  it('reads Esgotado when every size is gone', () => {
    expect(sizeSummary(product({ sizes: [{ size: 'M', soldOut: true }] }))).toBe('Esgotado');
  });

  it('uses the note when there are no sizes', () => {
    expect(sizeSummary(product({ sizes: [], sizeNote: 'Tamanho único' }))).toBe('Tamanho único');
  });

  it('is empty for a product with neither', () => {
    expect(sizeSummary(product({ sizes: [] }))).toBe('');
  });
});

describe('jsonLd', () => {
  // The danger in a script block is not `<` in an attribute but a `</script>`
  // closing the block early. JSON.stringify does not escape it.
  it('neutralises a closing script tag', () => {
    const out = jsonLd({ description: 'x</script><img onerror=alert(1)>' });
    expect(out).not.toContain('</script>');
    expect(out).toContain('\\u003c/script\\u003e');
    expect(JSON.parse(out).description).toBe('x</script><img onerror=alert(1)>');
  });

  it('escapes the line separators that are valid JSON but not valid JS', () => {
    expect(jsonLd({ a: '\u2028\u2029' })).toBe('{"a":"\\u2028\\u2029"}');
  });

  it('round-trips ordinary text unchanged', () => {
    expect(JSON.parse(jsonLd({ a: 'Calças Jeans — 42' })).a).toBe('Calças Jeans — 42');
  });
});

describe('structuredData', () => {
  it('describes the product and its offer', () => {
    const data = structuredData(product(), 'Cintos Masculino');
    expect(data['@type']).toBe('Product');
    expect(data.sku).toBe('2307251157');
    expect(data.brand).toEqual({ '@type': 'Brand', name: 'Gucci' });
    expect(data.offers).toMatchObject({
      '@type': 'Offer',
      price: '89.90',
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
    });
  });

  it('marks a fully sold-out product out of stock', () => {
    const data = structuredData(product({ soldOut: true }), 'Cintos Masculino');
    expect(data.offers.availability).toBe('https://schema.org/OutOfStock');
  });

  // A partly sold-out row is still in stock — the point of tracking units.
  it('keeps a partly sold-out product in stock', () => {
    const data = structuredData(
      product({ sizes: [{ size: 'M', soldOut: true }, { size: 'G' }] }),
      'Cintos Masculino'
    );
    expect(data.offers.availability).toBe('https://schema.org/InStock');
  });

  it('omits brand for an unbranded product', () => {
    expect('brand' in structuredData(product({ brandLabel: '' }), 'x')).toBe(false);
  });

  it('uses an absolute image URL, since crawlers do not resolve relative ones', () => {
    expect(structuredData(product(), 'x').image).toBe(`${SITE}/images/man/belts/2307251157-gucci.jpg`);
  });
});

describe('renderProductPage', () => {
  it('carries a per-product canonical, title and preview image', () => {
    const html = page();
    expect(html).toContain(`<link rel="canonical" href="${productUrl(product())}">`);
    expect(html).toContain('<title>[2307251157] Gucci — M/A Imports</title>');
    expect(html).toContain(`og:image" content="${SITE}/images/man/belts/2307251157-gucci.jpg"`);
    expect(html).toContain('og:type" content="product"');
  });

  it('server-renders the product, so a crawler sees it without running JS', () => {
    const html = page();
    expect(html).toContain('<h1>[2307251157] Gucci</h1>');
    expect(html).toContain('Cintos Masculino');
    expect(html).toMatch(/R\$\s?89,90/);
  });

  it('links back into the catalog at the product', () => {
    expect(page()).toContain('href="../../#p/2307251157"');
  });

  it('embeds parseable JSON-LD', () => {
    const match = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(page());
    expect(JSON.parse(match[1])['@type']).toBe('Product');
  });

  it('escapes hostile product text in every context', () => {
    const hostile = page({
      name: '<img src=x onerror=alert(1)> "Nike"',
      description: '</script><script>alert(1)</script>',
    });
    // One img: the product photo. The one in the name did not become markup.
    expect(hostile.match(/<img /g)).toHaveLength(2); // logo + product photo
    expect(hostile).not.toContain('<img src=x');
    expect(hostile).not.toContain('</script><script>alert(1)');
    const match = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(hostile);
    expect(JSON.parse(match[1]).description).toBe('</script><script>alert(1)</script>');
  });

  it('renders without media, for a product whose images are not built', () => {
    const html = page({ media: [] });
    expect(html).not.toContain('og:image');
    expect(html).toContain('<h1>');
  });

  it('shows the sold-out label only when the row is gone', () => {
    expect(page({ soldOut: true })).toContain('class="sold-out-label"');
    expect(page()).not.toContain('class="sold-out-label"');
  });
});

describe('renderSitemap', () => {
  it('lists the homepage and every product', () => {
    const xml = renderSitemap([product(), product({ id: '0101250900' })]);
    expect(xml).toContain(`<loc>${SITE}/</loc>`);
    expect(xml).toContain(`<loc>${SITE}/p/2307251157/</loc>`);
    expect(xml).toContain(`<loc>${SITE}/p/0101250900/</loc>`);
  });

  it('uses the sitemaps.org namespace', () => {
    expect(renderSitemap([])).toContain('http://www.sitemaps.org/schemas/sitemap/0.9');
  });

  it('dates each entry from listedAt', () => {
    expect(renderSitemap([product()])).toContain('<lastmod>2025-07-23</lastmod>');
  });
});

describe('renderRobots', () => {
  it('allows crawling and points at the sitemap', () => {
    const robots = renderRobots();
    expect(robots).toContain('Allow: /');
    expect(robots).toContain(`Sitemap: ${SITE}/sitemap.xml`);
  });
});

describe('The built output', () => {
  const dist = path.join(ROOT, 'dist');
  const skip = !fs.existsSync(path.join(dist, 'p'));

  it('writes a page per product', () => {
    if (skip) return;
    const all = JSON.parse(fs.readFileSync(path.join(dist, 'products', 'all.json'), 'utf8'));
    const pages = fs.readdirSync(path.join(dist, 'p'));
    expect(pages).toHaveLength(all.length);
    all.forEach((entry) => {
      expect(fs.existsSync(path.join(dist, 'p', entry.id, 'index.html'))).toBe(true);
    });
  });

  it('writes a sitemap covering every product', () => {
    if (skip) return;
    const all = JSON.parse(fs.readFileSync(path.join(dist, 'products', 'all.json'), 'utf8'));
    const xml = fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8');
    expect((xml.match(/<loc>/g) || []).length).toBe(all.length + 1);
  });

  it('writes robots.txt', () => {
    if (skip) return;
    expect(fs.readFileSync(path.join(dist, 'robots.txt'), 'utf8')).toContain('Sitemap:');
  });

  it('produces valid JSON-LD on every page', () => {
    if (skip) return;
    for (const id of fs.readdirSync(path.join(dist, 'p'))) {
      const html = fs.readFileSync(path.join(dist, 'p', id, 'index.html'), 'utf8');
      const match = /<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/.exec(html);
      expect(match).toBeTruthy();
      expect(() => JSON.parse(match[1])).not.toThrow();
    }
  });
});
