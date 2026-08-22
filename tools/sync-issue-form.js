#!/usr/bin/env node
'use strict';

/**
 * Writes the "add a product" Issue Form from the registries.
 *
 *   node tools/sync-issue-form.js           regenerate the template
 *   node tools/sync-issue-form.js --check   fail if it is stale
 *
 * Same closure as tools/sync-registry.js: generated, committed, and checked by
 * the build. Adding a brand to catalog/brands.json puts it in the dropdown on
 * the next run — and the build refuses to pass until that run happens, so the
 * form cannot quietly disagree with the registry.
 */

const fs = require('fs');
const path = require('path');

const { loadRegistry } = require('./lib/registry');
const { TEMPLATE_PATH, renderIssueForm } = require('./lib/issue-form');

const ROOT = path.resolve(__dirname, '..');

const main = () => {
  const check = process.argv.includes('--check');
  const target = path.join(ROOT, TEMPLATE_PATH);
  const expected = renderIssueForm(loadRegistry());

  let current = null;
  try {
    current = fs.readFileSync(target, 'utf8');
  } catch {
    // Not generated yet.
  }

  if (current === expected) {
    process.stdout.write(`issue form: ${TEMPLATE_PATH} is up to date\n`);
    return;
  }

  if (check) {
    process.stderr.write(
      `issue form: ${TEMPLATE_PATH} is stale — the registries have changed.\n` +
        '  Run `node tools/sync-issue-form.js` and commit the result.\n'
    );
    process.exitCode = 1;
    return;
  }

  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, expected, 'utf8');
  process.stdout.write(`issue form: ${TEMPLATE_PATH} ${current === null ? 'created' : 'updated'}\n`);
};

if (require.main === module) main();

module.exports = { main };
