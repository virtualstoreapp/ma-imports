#!/usr/bin/env node
'use strict';

/**
 * Applies an edit to one product, from the workflow_dispatch form (option 6-C).
 *
 * Editing is the other half of CON-8. It needs no photo, which is why it is a
 * dispatch form rather than an issue: the only thing an Issue Form gives that
 * this does not is a file upload.
 *
 * The interesting case is marking a single size sold out. That is what the v2
 * size model made possible, and what the seller will reach for most: one size
 * goes, the row keeps selling.
 */

const fsp = require('fs/promises');
const path = require('path');

const { checkAuthor } = require('./add-product');
const { listCategories, readCategory } = require('../lib/catalog');
const { parsePrice } = require('../lib/authoring');

const ROOT = path.resolve(__dirname, '../..');
const PRODUCTS_DIR = path.join(ROOT, 'products');

// Written in an input to mean "clear this field" — a form cannot express an
// empty string distinctly from an untouched field.
const CLEAR = 'remover';
const NONE = 'nenhum';

/**
 * Finds a product by id across every category.
 * @param {string} id The product id.
 * @returns {{category: string, index: number, products: object[]}|null} Location.
 */
const locate = (id) => {
  for (const category of listCategories(PRODUCTS_DIR)) {
    const products = readCategory(PRODUCTS_DIR, category);
    const index = products.findIndex((product) => product.id === id);
    if (index !== -1) return { category, index, products };
  }
  return null;
};

/**
 * Applies the requested changes to a product.
 * @param {object} product The product to change.
 * @param {object} inputs Raw form inputs.
 * @returns {{changes: string[]}|{errors: string[]}} What changed, or why not.
 */
const applyEdit = (product, inputs) => {
  const errors = [];
  const changes = [];

  if (inputs.price) {
    const price = parsePrice(inputs.price);
    if (price === null) errors.push(`Preço "${inputs.price}" is not a valid price.`);
    else {
      changes.push(`preço: ${product.price} → ${price}`);
      product.price = price;
    }
  }

  if (inputs.oldPrice) {
    if (inputs.oldPrice.trim().toLowerCase() === CLEAR) {
      if (product.oldPrice) changes.push(`desconto removido (era ${product.oldPrice})`);
      delete product.oldPrice;
    } else {
      const oldPrice = parsePrice(inputs.oldPrice);
      if (oldPrice === null) errors.push(`Preço antigo "${inputs.oldPrice}" is not a valid price.`);
      else if (oldPrice <= product.price) {
        errors.push(`Preço antigo (${oldPrice}) must be higher than the price (${product.price}).`);
      } else {
        changes.push(`preço antigo: ${product.oldPrice || 'nenhum'} → ${oldPrice}`);
        product.oldPrice = oldPrice;
      }
    }
  }

  if (inputs.description) {
    if (inputs.description.trim().toLowerCase() === CLEAR) {
      if (product.description) changes.push('descrição removida');
      delete product.description;
    } else {
      changes.push('descrição atualizada');
      product.description = inputs.description.trim();
    }
  }

  if (inputs.soldOutSizes) {
    const raw = inputs.soldOutSizes.trim();
    const clearAll = raw.toLowerCase() === NONE;
    const wanted = clearAll
      ? []
      : raw.split(',').map((value) => value.trim()).filter(Boolean);

    if (!product.sizes.length) {
      // A row with no units carries the flag itself; there is no size to name.
      if (!clearAll && wanted.length) {
        errors.push('This product has no sizes; use "nenhum" to put it back on sale, or a size list is meaningless.');
      } else if (clearAll) {
        if (product.soldOut) changes.push('volta a estar disponível');
        delete product.soldOut;
      }
    } else {
      const known = new Set(product.sizes.map((unit) => unit.size));
      const unknown = wanted.filter((size) => !known.has(size));
      if (unknown.length) {
        errors.push(`This product has no size ${unknown.join(', ')} — it has ${[...known].join(', ')}.`);
      } else {
        const before = product.sizes.filter((unit) => unit.soldOut === true).map((unit) => unit.size);
        product.sizes = product.sizes.map((unit) =>
          (wanted.includes(unit.size) ? { size: unit.size, soldOut: true } : { size: unit.size })
        );
        changes.push(`esgotados: ${before.join(', ') || 'nenhum'} → ${wanted.join(', ') || 'nenhum'}`);

        // soldOut is derived by the build, so the authoring file must not carry a
        // stale row-level flag alongside units.
        delete product.soldOut;
      }
    }
  }

  if (errors.length) return { errors };
  if (!changes.length) return { errors: ['Nothing to change — every field was left blank.'] };
  return { changes };
};

const main = async () => {
  const id = String(process.env.PRODUCT_ID || '').trim();

  const authorError = checkAuthor(process.env.ACTOR, process.env.ALLOWED_AUTHORS);
  if (authorError) throw new Error(authorError);

  if (!/^\d{10}$/.test(id)) throw new Error(`"${id}" is not a 10-digit product code.`);

  const found = locate(id);
  if (!found) throw new Error(`No product with code [${id}] exists in the catalog.`);

  const { category, index, products } = found;
  const result = applyEdit(products[index], {
    price: process.env.NEW_PRICE,
    oldPrice: process.env.NEW_OLD_PRICE,
    soldOutSizes: process.env.SOLD_OUT_SIZES,
    description: process.env.NEW_DESCRIPTION,
  });

  if (result.errors) throw new Error(result.errors.join('\n'));

  await fsp.writeFile(
    path.join(PRODUCTS_DIR, `${category}.json`),
    `${JSON.stringify(products, null, 4)}\n`,
    'utf8'
  );

  const summary = result.changes.map((change) => `- ${change}`).join('\n');
  process.stdout.write(`[${id}] in ${category}:\n${summary}\n`);

  if (process.env.GITHUB_OUTPUT) {
    await fsp.appendFile(
      process.env.GITHUB_OUTPUT,
      `summary<<EOF_SUMMARY\n${summary}\nEOF_SUMMARY\ncategory=${category}\n`
    );
  }
};

if (require.main === module) {
  main().catch((error) => {
    process.exitCode = 1;
    process.stderr.write(`edit-product failed: ${error.message}\n`);
  });
}

module.exports = { CLEAR, NONE, applyEdit, locate };
