#!/usr/bin/env node
'use strict';

/**
 * Writes the category registry into index.html as a committed JSON literal.
 *
 * catalog/categories.json is the source of truth, but the client cannot read it
 * from disk and CON-2 requires that an unbuilt checkout still renders. So the
 * payload is generated here, committed, and checked for staleness by the build —
 * the same closure Wave 6 will use for the Issue Form template.
 *
 * Run after editing catalog/categories.json:  node tools/sync-registry.js
 * Check without writing:                      node tools/sync-registry.js --check
 */

const fs = require('fs');
const path = require('path');

const {
  REGISTRY_END_MARKER,
  REGISTRY_START_MARKER,
  loadRegistry,
  renderRegistryElement,
} = require('./lib/registry');

const ROOT = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT, 'index.html');

const escapeForRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Delimited by unique markers so re-running replaces the block rather than
// appending, and so the match cannot escape into surrounding markup.
const BLOCK_PATTERN = new RegExp(
  `[ \\t]*${escapeForRegExp(REGISTRY_START_MARKER)}[\\s\\S]*?${escapeForRegExp(REGISTRY_END_MARKER)}`
);

// Where the block is inserted on first run: immediately before scripts.js, so
// the registry is in the DOM by the time the catalog initialises.
const ANCHOR = '  <script src="scripts.js"></script>';

/**
 * Produces index.html with an up-to-date registry block.
 * @param {string} html Current index.html contents.
 * @param {string} block The rendered registry element.
 * @returns {string} Updated contents.
 */
const applyBlock = (html, block) => {
  if (BLOCK_PATTERN.test(html)) return html.replace(BLOCK_PATTERN, block);

  if (!html.includes(ANCHOR)) {
    throw new Error(`Could not find the insertion anchor in index.html:\n  ${ANCHOR}`);
  }
  return html.replace(ANCHOR, `${block}\n\n${ANCHOR}`);
};

const main = () => {
  const check = process.argv.includes('--check');
  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const expected = applyBlock(html, renderRegistryElement(loadRegistry()));

  if (expected === html) {
    process.stdout.write('registry: index.html is up to date\n');
    return;
  }

  if (check) {
    process.stderr.write(
      'registry: index.html is stale — catalog/categories.json has changed.\n' +
        '  Run `node tools/sync-registry.js` and commit the result.\n'
    );
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(INDEX_PATH, expected, 'utf8');
  process.stdout.write('registry: index.html updated\n');
};

if (require.main === module) main();

module.exports = { BLOCK_PATTERN, INDEX_PATH, applyBlock };
