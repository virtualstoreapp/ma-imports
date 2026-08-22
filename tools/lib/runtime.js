'use strict';

/**
 * Derives the v1 runtime product shape from a v2 authoring product.
 *
 * The build is a compiler, which is what lets the data migration and the runtime
 * change ship in separate waves: during the overlap it emits exactly the shape
 * scripts.js already consumes, so Wave 4 touches no client code and no test.
 * Wave 5b switches the client to read v2 fields directly and this module goes.
 */

/**
 * Rebuilds the display name.
 *
 * Parts are joined rather than concatenated so an unbranded product with a model
 * reads "[0507251850] Star" and not "[0507251850]  Star", and a product with
 * neither reads "[1107250717]" with nothing trailing.
 * @param {object} product v2 product.
 * @param {object} brands Brand registry.
 * @returns {string} The v1 display name.
 */
const deriveName = (product, brands) => {
  const brand = brands[product.brand];
  const parts = [brand ? brand.label : '', product.model || ''].filter(Boolean);
  return parts.length ? `[${product.id}] ${parts.join(' ')}` : `[${product.id}]`;
};

/**
 * Rebuilds the single size string.
 *
 * v1 stored one free-text value; v2 stores a list of independently sellable
 * units plus a note for anything that is not a size. Joining with ", "
 * reproduces every multi-value row verbatim except one, which read "40,41".
 * @param {object} product v2 product.
 * @returns {string} The v1 size string.
 */
const deriveSize = (product) => {
  if (product.sizes && product.sizes.length) {
    return product.sizes.map((entry) => entry.size).join(', ');
  }
  return product.sizeNote || 'N/A';
};

/**
 * A row is sold out when every unit in it is.
 *
 * v1 carried one boolean per product. v2 tracks it per unit, so the row-level
 * flag becomes derived — which is what lets Wave 5b show which sizes are left
 * without changing the data again.
 *
 * A row with no units (a cap, a wallet) has nothing to carry the flag, so it
 * keeps a row-level `soldOut`. Reading only the units would put nine sold-out
 * products back on sale.
 * @param {object} product v2 product.
 * @returns {boolean} Whether the row is sold out.
 */
const deriveSoldOut = (product) => {
  if (product.sizes && product.sizes.length) {
    return product.sizes.every((entry) => entry.soldOut === true);
  }
  return product.soldOut === true;
};

/**
 * Converts a v2 product to the shape scripts.js consumes.
 *
 * Key order matches what v1 emitted, so `dist/products/*.json` stays
 * byte-identical and the Wave 4 acceptance gate is a plain file comparison.
 * @param {object} product v2 product.
 * @param {object} brands Brand registry.
 * @returns {object} v1 runtime product.
 */
const toRuntime = (product, brands) => {
  const runtime = {
    name: deriveName(product, brands),
    description: product.description || '',
    oldPrice: product.oldPrice || 0,
    price: product.price,
    images: product.images,
    size: deriveSize(product),
  };

  // v1 omitted soldOut when false, and the client re-derived the default.
  if (deriveSoldOut(product)) runtime.soldOut = true;

  return runtime;
};

module.exports = { deriveName, deriveSize, deriveSoldOut, toRuntime };
