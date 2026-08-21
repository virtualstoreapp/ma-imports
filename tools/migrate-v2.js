#!/usr/bin/env node
'use strict';

/**
 * One-shot migration of products/*.json from the v1 authoring shape to v2.
 *
 * v1 fused several concerns into `name` ("[2709252015] Nike Pro" = identifier +
 * brand + model + display string + sort key) and carried `size` as free text.
 * v2 separates them:
 *
 *   v1: { name: "[2709252015] Nike Pro", size: "M, G", soldOut: true, oldPrice: 0.0 }
 *   v2: { id: "2709252015", brand: "nike", model: "Pro",
 *         sizes: [{ size: "M", soldOut: true }, { size: "G", soldOut: true }],
 *         listedAt: "2025-09-27T20:15:00Z" }
 *
 * The build re-derives the v1 runtime shape from v2 input, so scripts.js and the
 * tests are untouched by this wave and `dist/products/*.json` stays byte-identical
 * apart from a reviewed exception list. See tools/lib/runtime.js.
 *
 * Kept in the repository rather than deleted after use, deliberately: it is the
 * only record of how 241 products were transformed, and the brand mapping below
 * is the auditable part of that.
 *
 *   node tools/migrate-v2.js --check   report what would change
 *   node tools/migrate-v2.js           rewrite products/*.json in place
 */

const fs = require('fs');
const path = require('path');

const { PRODUCT_DATE_PATTERN, listCategories, productImages, readCategory } = require('./lib/catalog');
const { loadRegistry } = require('./lib/registry');

const ROOT = path.resolve(__dirname, '..');
const PRODUCTS_DIR = path.join(ROOT, 'products');

// The v1 `name` tail mapped to a v2 brand slug and model.
//
// Three kinds of entry, all grounded in measurement:
//  - a plain brand, where the tail already named one brand;
//  - a model conflation, where a model was fused into the brand string. Every one
//    is confirmed by its image folder (a "Nike Shox" sits in images/.../nike/);
//  - a placeholder, which OQ-8 settled as "not a real brand": the original string
//    moves to `model` so nothing is lost and the rendered name is unchanged.
//
// Trailing whitespace in three tails ("Quicksilver ", "Tommy Hilfiger ") is
// dropped here, which is why the exception list includes one name that differs
// only by a trailing space.
const BRAND_MAP = {
  '': { brand: 'unbranded' },

  Abercrombie: { brand: 'abercrombie' },
  Adidas: { brand: 'adidas' },
  'Adidas Campus': { brand: 'adidas', model: 'Campus' },
  Aramis: { brand: 'aramis' },
  Armani: { brand: 'armani' },
  'Armani Exchange': { brand: 'armani-exchange' },
  Asics: { brand: 'asics' },
  Austman: { brand: 'austman' },
  Balmain: { brand: 'balmain' },
  Brooksfield: { brand: 'brooksfield' },
  Burberry: { brand: 'burberry' },
  'Calvin Klein': { brand: 'calvin-klein' },
  Diesel: { brand: 'diesel' },
  'Dolce & Gabbana': { brand: 'dolce-gabbana' },
  'Emporio Armani': { brand: 'emporio-armani' },
  Gucci: { brand: 'gucci' },
  'Hang Loose': { brand: 'hang-loose' },
  'Hugo Boss': { brand: 'hugo-boss' },
  Hurley: { brand: 'hurley' },
  Jordan: { brand: 'jordan' },
  Lacoste: { brand: 'lacoste' },
  'Louis Vuitton': { brand: 'louis-vuitton' },
  Mizuno: { brand: 'mizuno' },
  'Mizuno 14': { brand: 'mizuno', model: '14' },
  'New Balance': { brand: 'new-balance' },
  Nike: { brand: 'nike' },
  'Nike Air': { brand: 'nike', model: 'Air' },
  'Nike Air Force': { brand: 'nike', model: 'Air Force' },
  'Nike Air Jordan': { brand: 'nike', model: 'Air Jordan' },
  'Nike Dunk Low Pro': { brand: 'nike', model: 'Dunk Low Pro' },
  'Nike Jordan': { brand: 'nike', model: 'Jordan' },
  'Nike Pro': { brand: 'nike', model: 'Pro' },
  'Nike R4': { brand: 'nike', model: 'R4' },
  'Nike Shox': { brand: 'nike', model: 'Shox' },
  'Nike Shox Neymar': { brand: 'nike', model: 'Shox Neymar' },
  Oakley: { brand: 'oakley' },
  Polo: { brand: 'polo' },
  Puma: { brand: 'puma' },
  Quiksilver: { brand: 'quiksilver' },
  // RD-3: a misspelling of a real brand, and the on-disk folder already reads
  // "quiksilver". Renames 3 products; decline by mapping these to their own slug.
  Quicksilver: { brand: 'quiksilver' },
  'Ralph Lauren': { brand: 'ralph-lauren' },
  Reserva: { brand: 'reserva' },
  'Ricardo Almeida': { brand: 'ricardo-almeida' },
  'Sergio K': { brand: 'sergio-k' },
  'Tommy Hilfiger': { brand: 'tommy-hilfiger' },
  // RD-3: also a misspelling; the slug stays as the folder spells it.
  'Under Armor': { brand: 'under-armor' },
  Vans: { brand: 'vans' },
  Versace: { brand: 'versace' },
  XTC: { brand: 'xtc' },

  // OQ-8: placeholders, not brands. The original string survives in `model`.
  'J. H. Bao': { brand: 'unbranded', model: 'J. H. Bao' },
  Jeans: { brand: 'unbranded', model: 'Jeans' },
  Kaiccies: { brand: 'unbranded', model: 'Kaiccies' },
  'Los Angeles': { brand: 'unbranded', model: 'Los Angeles' },
  Star: { brand: 'unbranded', model: 'Star' },
  Up: { brand: 'unbranded', model: 'Up' },
};

// Size values that are not sizes. They move to `sizeNote`, leaving `sizes` empty.
// "N/A" maps to no note at all, since the runtime already renders that string for
// a product with nothing to say about size.
const SIZE_NOTES = new Set(['N/A', 'Consultar', 'Pequena', 'Tamanho único']);

// A range-fit value describes one item that fits a span, which is not a list of
// units — one pair of socks really does fit 37 to 44.
const RANGE_FIT = /\bao\b/;

/**
 * Splits a v1 name into its identifier and brand/model.
 * @param {string} name The v1 name.
 * @returns {{id: string, brand: string, model?: string}} v2 identity fields.
 */
const splitName = (name) => {
  const match = name.match(PRODUCT_DATE_PATTERN);
  if (!match) throw new Error(`name has no [DDMMYYHHmm] code: ${JSON.stringify(name)}`);

  const [, id] = match;
  const tail = name.slice(name.indexOf(']') + 1).trim();
  const mapped = BRAND_MAP[tail];
  if (!mapped) throw new Error(`no brand mapping for ${JSON.stringify(tail)} in ${JSON.stringify(name)}`);

  return { id, ...mapped };
};

/**
 * Converts the [DDMMYYHHmm] code to the explicit UTC sort key.
 *
 * v1 parsed this with local-time `new Date(y, m, d, h, mi)` in two duplicate
 * implementations, so the build host's timezone affected tie ordering. Treating
 * the code as UTC removes that, and preserves relative order either way.
 * @param {string} id The 10-digit code.
 * @returns {string} ISO 8601 UTC timestamp.
 */
const listedAtFrom = (id) => {
  const [day, month, year, hour, minute] = [
    id.slice(0, 2),
    id.slice(2, 4),
    id.slice(4, 6),
    id.slice(6, 8),
    id.slice(8, 10),
  ];
  return `20${year}-${month}-${day}T${hour}:${minute}:00Z`;
};

/**
 * Converts a v1 free-text `size` into v2 `sizes` plus an optional note.
 * @param {string} size The v1 size string.
 * @param {boolean} soldOut The v1 product-level sold-out flag.
 * @returns {{sizes: object[], sizeNote?: string}} v2 size fields.
 */
const splitSize = (size, soldOut) => {
  const trimmed = (size || '').trim();

  if (!trimmed || trimmed === 'N/A') return { sizes: [] };
  if (SIZE_NOTES.has(trimmed)) return { sizes: [], sizeNote: trimmed };
  if (RANGE_FIT.test(trimmed)) return { sizes: [], sizeNote: trimmed };

  // A separator means several units, each independently sellable (CON-10). The
  // v1 flag was product-level, so it applies to every unit in the row.
  const values = trimmed.split(',').map((value) => value.trim()).filter(Boolean);
  return {
    sizes: values.map((value) => (soldOut ? { size: value, soldOut: true } : { size: value })),
  };
};

/**
 * Migrates one product from v1 to v2.
 * @param {object} product v1 product.
 * @returns {object} v2 product.
 */
const migrateProduct = (product) => {
  const { id, brand, model } = splitName(product.name);
  const { sizes, sizeNote } = splitSize(product.size, product.soldOut === true);

  const migrated = { id, brand };
  if (model) migrated.model = model;
  migrated.price = product.price;

  // 0.0 was the "no discount" sentinel; v2 omits the field instead.
  if (typeof product.oldPrice === 'number' && product.oldPrice > 0) {
    migrated.oldPrice = product.oldPrice;
  }

  migrated.sizes = sizes;
  if (sizeNote) migrated.sizeNote = sizeNote;

  // A row with no units has nothing to carry the flag, so it stays at row level.
  // Nine products are in this position — sold-out caps, socks and wallets — and
  // dropping it here would have quietly put them back on sale.
  if (product.soldOut === true && !sizes.length) migrated.soldOut = true;

  // v1 had three states for "no description": absent, empty string, present.
  if (typeof product.description === 'string' && product.description.trim()) {
    migrated.description = product.description;
  }

  migrated.images = productImages(product);
  migrated.listedAt = listedAtFrom(id);

  return migrated;
};

const main = () => {
  const check = process.argv.includes('--check');
  const registry = loadRegistry();
  const summary = { products: 0, categories: 0, models: 0, unbranded: 0, notes: 0, multiSize: 0 };

  for (const category of listCategories(PRODUCTS_DIR)) {
    const migrated = readCategory(PRODUCTS_DIR, category).map((product) => {
      const next = migrateProduct(product);
      summary.products += 1;
      if (next.model) summary.models += 1;
      if (next.brand === 'unbranded') summary.unbranded += 1;
      if (next.sizeNote) summary.notes += 1;
      if (next.sizes.length > 1) summary.multiSize += 1;

      if (!Object.prototype.hasOwnProperty.call(registry.brands, next.brand)) {
        throw new Error(`${category}.json: brand "${next.brand}" is not in catalog/brands.json`);
      }
      return next;
    });

    summary.categories += 1;
    if (!check) {
      fs.writeFileSync(
        path.join(PRODUCTS_DIR, `${category}.json`),
        `${JSON.stringify(migrated, null, 4)}\n`,
        'utf8'
      );
    }
  }

  process.stdout.write(
    `migrate-v2${check ? ' (check)' : ''}: ${summary.products} products across ${summary.categories} categories\n` +
      `  ${summary.models} with a model, ${summary.unbranded} unbranded, ` +
      `${summary.notes} with a size note, ${summary.multiSize} with several units\n`
  );
};

if (require.main === module) main();

module.exports = { BRAND_MAP, SIZE_NOTES, listedAtFrom, migrateProduct, splitName, splitSize };
