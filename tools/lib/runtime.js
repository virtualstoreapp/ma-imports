'use strict';

/**
 * Compiles a v2 authoring product into the shape the client reads.
 *
 * Through Wave 4 this module re-derived the *v1* runtime shape, so the data
 * migration could ship without touching scripts.js. Wave 5b switches the client
 * over, so it now emits v2 and only the genuinely derived fields are computed:
 * the display name, and the row-level sold-out state.
 *
 * What is deliberately still emitted rather than left to the client:
 *  - `name`, because it is the customer-facing product reference in the
 *    WhatsApp message and the clipboard (CON-4). Deriving it in two places is
 *    how the brand/model split went wrong in the first place.
 *  - `soldOut`, because "every unit is sold" is a rule about the data, not a
 *    rendering concern.
 */

/**
 * Rebuilds the display name.
 *
 * Parts are joined rather than concatenated so an unbranded product with a model
 * reads "[0507251850] Star" and not "[0507251850]  Star", and a product with
 * neither reads "[1107250717]" with nothing trailing.
 * @param {object} product v2 product.
 * @param {object} brands Brand registry.
 * @returns {string} The display name.
 */
const deriveName = (product, brands) => {
  const brand = brands[product.brand];
  const parts = [brand ? brand.label : '', product.model || ''].filter(Boolean);
  return parts.length ? `[${product.id}] ${parts.join(' ')}` : `[${product.id}]`;
};

/**
 * A row is sold out when every unit in it is.
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
 * Converts a v2 authoring product to the runtime shape.
 *
 * Optional fields are omitted rather than given sentinel values: v1 carried
 * `description: ""` and `oldPrice: 0` for "absent", which is why it had three
 * states for "no description". The client tests for presence.
 * @param {object} product v2 product.
 * @param {object} brands Brand registry.
 * @returns {object} Runtime product.
 */
const toRuntime = (product, brands) => {
  const brand = brands[product.brand];

  const runtime = {
    id: product.id,
    name: deriveName(product, brands),
    brand: product.brand,
    brandLabel: brand ? brand.label : '',
  };

  if (product.model) runtime.model = product.model;
  runtime.price = product.price;
  if (product.oldPrice) runtime.oldPrice = product.oldPrice;
  if (product.description) runtime.description = product.description;

  runtime.sizes = product.sizes || [];
  if (product.sizeNote) runtime.sizeNote = product.sizeNote;
  if (deriveSoldOut(product)) runtime.soldOut = true;

  runtime.images = product.images;
  runtime.listedAt = product.listedAt;

  return runtime;
};

module.exports = { deriveName, deriveSoldOut, toRuntime };
