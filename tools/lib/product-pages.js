'use strict';

/**
 * Generates a page per product, plus a sitemap and robots.txt.
 *
 * Closes the gap measured in §2.9: no product content is server-rendered, so all
 * 241 products are invisible to a crawler that does not execute JavaScript, and
 * every link shared over WhatsApp previews the same logo card — for a business
 * whose entire funnel is WhatsApp link-sharing.
 *
 * These are real pages, not redirects. A crawler sees the product; a person
 * landing on one sees it too, with a link into the catalog. A redirect would
 * hand the crawler nothing and cost the visitor a round trip.
 *
 * Two escaping contexts, and they are not the same:
 *  - HTML text and quoted attributes, handled by escapeHtml;
 *  - JSON-LD, where the danger is not `<` in an attribute but a `</script>` in a
 *    product description closing the block early. JSON.stringify escapes quotes
 *    but not `<`, so jsonLd additionally escapes it as <.
 */

const SITE = 'https://virtualstoreapp.github.io/ma-imports';

/** Escapes for HTML text and quoted-attribute contexts. */
const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Serialises a value for embedding in a <script type="application/ld+json">.
 *
 * `<` becomes <, which JSON.stringify does not do. Without it a description
 * containing "</script>" would close the block and everything after it would be
 * parsed as markup.
 * @param {object} value The structured data.
 * @returns {string} Safe JSON.
 */
const jsonLd = (value) =>
  JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    // Valid in JSON but not in a JavaScript string literal, and a script block
    // is parsed as script before it is parsed as JSON.
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

/** @returns {string} The canonical URL of a product page. */
const productUrl = (product) => `${SITE}/p/${product.id}/`;

/**
 * Renders the human-readable size line.
 * @param {object} product Runtime product.
 * @returns {string} A short description of availability.
 */
const sizeSummary = (product) => {
  const sizes = product.sizes || [];
  if (!sizes.length) return product.sizeNote || '';

  const available = sizes.filter((unit) => unit.soldOut !== true).map((unit) => unit.size);
  if (!available.length) return 'Esgotado';
  return `${available.length > 1 ? 'Tamanhos' : 'Tamanho'}: ${available.join(', ')}`;
};

/**
 * Builds the schema.org Product for a product.
 *
 * `availability` is derived from the row: a partly sold-out row is still in
 * stock, which is the whole point of tracking units.
 * @param {object} product Runtime product.
 * @param {string} categoryLabel The category's display label.
 * @returns {object} JSON-LD structured data.
 */
const structuredData = (product, categoryLabel) => {
  const image = (product.media || [])[0];

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    category: categoryLabel,
    url: productUrl(product),
    sku: product.id,
    offers: {
      '@type': 'Offer',
      price: product.price.toFixed(2),
      priceCurrency: 'BRL',
      availability: product.soldOut === true
        ? 'https://schema.org/OutOfStock'
        : 'https://schema.org/InStock',
      url: productUrl(product),
    },
  };

  if (product.description) data.description = product.description;
  if (product.brandLabel) data.brand = { '@type': 'Brand', name: product.brandLabel };
  if (image) data.image = `${SITE}/${image.full}`;

  return data;
};

/**
 * Renders one product page.
 * @param {object} product Runtime product, with media attached.
 * @param {string} categoryLabel The category's display label.
 * @returns {string} The page HTML.
 */
const renderProductPage = (product, categoryLabel) => {
  const media = (product.media || [])[0];
  const title = `${product.name} — M/A Imports`;
  const summary = [categoryLabel, sizeSummary(product), product.description]
    .filter(Boolean)
    .join('. ');

  const price = product.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(summary)}">
  <link rel="canonical" href="${productUrl(product)}">

  <!-- Per-product preview, so a link shared over WhatsApp shows the product
       instead of the site logo. Crawlers do not resolve relative URLs. -->
  <meta property="og:type" content="product">
  <meta property="og:site_name" content="M/A Imports">
  <meta property="og:locale" content="pt_BR">
  <meta property="og:title" content="${escapeHtml(product.name)}">
  <meta property="og:description" content="${escapeHtml(summary)}">
  <meta property="og:url" content="${productUrl(product)}">
${media ? `  <meta property="og:image" content="${SITE}/${escapeHtml(media.full)}">
  <meta property="og:image:type" content="image/jpeg">
  <meta property="og:image:width" content="${escapeHtml(media.width)}">
  <meta property="og:image:height" content="${escapeHtml(media.height)}">
  <meta property="og:image:alt" content="${escapeHtml(product.name)}">
` : ''}
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(product.name)}">
  <meta name="twitter:description" content="${escapeHtml(summary)}">
${media ? `  <meta name="twitter:image" content="${SITE}/${escapeHtml(media.full)}">
` : ''}
  <link rel="stylesheet" href="../../styles.css">

  <script type="application/ld+json">
${jsonLd(structuredData(product, categoryLabel))}
  </script>
</head>
<body>
  <header>
    <div class="header-logo">
      <a href="../../"><img src="../../images/logo.jpeg" alt="M/A Imports Logo"></a>
    </div>
  </header>

  <main class="product-page">
    <h1>${escapeHtml(product.name)}</h1>
${media ? `    <picture>
      <source srcset="../../${escapeHtml(media.webp)}" type="image/webp">
      <img src="../../${escapeHtml(media.full)}" alt="${escapeHtml(product.name)}" width="${escapeHtml(media.width)}" height="${escapeHtml(media.height)}">
    </picture>
` : ''}
    <p class="product-page-category">${escapeHtml(categoryLabel)}</p>
${product.description ? `    <p class="description">${escapeHtml(product.description)}</p>\n` : ''}${sizeSummary(product) ? `    <p class="size-note">${escapeHtml(sizeSummary(product))}</p>\n` : ''}    <p class="price">${escapeHtml(price)}</p>
${product.soldOut === true ? '    <p class="sold-out-label">Esgotado</p>\n' : ''}
    <p><a class="product-page-link" href="../../#p/${escapeHtml(product.id)}">Ver no catálogo</a></p>
  </main>

  <footer>
    <p><a href="../../">M/A Imports</a></p>
  </footer>
</body>
</html>
`;
};

/**
 * Renders the sitemap.
 * @param {object[]} products Runtime products.
 * @returns {string} sitemap.xml contents.
 */
const renderSitemap = (products) => {
  const entries = [`  <url><loc>${SITE}/</loc><changefreq>weekly</changefreq><priority>1.0</priority></url>`];

  for (const product of products) {
    // lastmod uses listedAt: it is the only date the catalog records, and it is
    // honest — a product page changes when the product does.
    entries.push(
      `  <url><loc>${productUrl(product)}</loc>` +
        `<lastmod>${product.listedAt.slice(0, 10)}</lastmod>` +
        `<changefreq>monthly</changefreq><priority>0.8</priority></url>`
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.join('\n')}
</urlset>
`;
};

/** @returns {string} robots.txt contents. */
const renderRobots = () => `User-agent: *
Allow: /

Sitemap: ${SITE}/sitemap.xml
`;

module.exports = {
  SITE,
  escapeHtml,
  jsonLd,
  productUrl,
  renderProductPage,
  renderRobots,
  renderSitemap,
  sizeSummary,
  structuredData,
};
