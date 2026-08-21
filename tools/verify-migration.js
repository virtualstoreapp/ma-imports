#!/usr/bin/env node
'use strict';

/**
 * Wave 4 acceptance gate: compares a baseline of dist/products against the
 * current build, product by product, and reports every difference.
 *
 *   node tools/verify-migration.js <baseline-dir>
 *
 * The comparison is *semantic*, not byte-for-byte, and that is a deliberate
 * correction to the plan. v1 had three states for "no description" (absent,
 * empty string, present) and two for "no discount" (absent, 0). v2 collapses
 * each to one, so 36 products gain a key v1 omitted — `description: ""` on 34
 * and `oldPrice: 0` on 2. The client reads both through a falsy fallback
 * (`product.description ? … : ''`, `product.oldPrice && product.oldPrice > 0`),
 * so rendering cannot change. Byte-identity was therefore never achievable for
 * both groups at once; identical *rendering* is the guarantee that matters, and
 * it is what this checks.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CURRENT_DIR = path.join(ROOT, 'dist', 'products');

// The render-relevant projection of a product: everything scripts.js reads.
const project = (product) => ({
  name: product.name,
  description: product.description || '',
  oldPrice: product.oldPrice || 0,
  price: product.price,
  images: product.images,
  size: product.size,
  soldOut: product.soldOut === true,
  category: product.category,
  media: (product.media || []).map((entry) => entry.src),
});

const readProducts = (dir, file) => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));

const main = () => {
  const baselineDir = process.argv[2];
  if (!baselineDir) {
    process.stderr.write('usage: node tools/verify-migration.js <baseline-dir>\n');
    process.exitCode = 1;
    return;
  }

  const files = fs.readdirSync(baselineDir).filter((file) => file.endsWith('.json')).sort();
  const changes = [];
  const structural = { description: 0, oldPrice: 0 };
  let compared = 0;

  for (const file of files) {
    // A baseline can predate a category rename, so a file it holds may no
    // longer exist. Report it rather than crashing — it is information about the
    // baseline, not a regression.
    if (!fs.existsSync(path.join(CURRENT_DIR, file))) {
      changes.push(`${file}: present in the baseline but not in the current build (renamed or removed)`);
      continue;
    }

    const before = readProducts(baselineDir, file);
    const after = readProducts(CURRENT_DIR, file);

    if (before.length !== after.length) {
      changes.push(`${file}: ${before.length} products became ${after.length}`);
      continue;
    }

    before.forEach((previous, index) => {
      const next = after[index];
      compared += 1;

      // Count the keys v1 omitted and v2 always emits, so the report can show
      // they are the only structural difference.
      if (!('description' in previous) && 'description' in next) structural.description += 1;
      if (!('oldPrice' in previous) && 'oldPrice' in next) structural.oldPrice += 1;

      const a = JSON.stringify(project(previous));
      const b = JSON.stringify(project(next));
      if (a === b) return;

      const fields = Object.keys(project(previous)).filter(
        (key) => JSON.stringify(project(previous)[key]) !== JSON.stringify(project(next)[key])
      );
      changes.push(
        `${file}[${index}] ${previous.name} -> ${next.name}\n` +
          fields
            .map(
              (key) =>
                `    ${key}: ${JSON.stringify(project(previous)[key])} -> ${JSON.stringify(project(next)[key])}`
            )
            .join('\n')
      );
    });
  }

  process.stdout.write(`verify: compared ${compared} products across ${files.length} files\n`);
  process.stdout.write(
    `verify: ${structural.description} gained description:"" and ${structural.oldPrice} gained oldPrice:0 ` +
      '(both read through a falsy fallback, so rendering is unaffected)\n'
  );

  if (!changes.length) {
    process.stdout.write('verify: no render-relevant differences\n');
    return;
  }

  process.stdout.write(`verify: ${changes.length} render-relevant difference(s)\n`);
  changes.forEach((change) => process.stdout.write(`  ${change}\n`));
};

if (require.main === module) main();

module.exports = { project };
