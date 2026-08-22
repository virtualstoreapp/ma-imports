#!/usr/bin/env node
'use strict';

/**
 * Turns an "add a product" issue into a catalog change.
 *
 * The workflow does nothing but pass inputs in and open a PR with whatever this
 * writes; all the logic lives here and in tools/lib/authoring.js so it can be
 * tested. Run it directly to dry-run an issue body:
 *
 *   ISSUE_BODY="$(cat body.md)" ISSUE_AUTHOR=someone \
 *   ALLOWED_AUTHORS=owner node tools/authoring/add-product.js --dry-run
 *
 * Every input is untrusted. The controls that matter:
 *  - the author is checked against an allow-list before anything is read;
 *  - the category and brand are resolved against the registries, never used as
 *    given, so a path cannot be steered out of images/;
 *  - the image is fetched only from a GitHub attachment host, size-capped, and
 *    re-encoded through sharp rather than trusted as a JPEG;
 *  - the product file is parsed and re-serialised, never string-concatenated.
 */

const fsp = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const {
  MAX_IMAGE_BYTES,
  buildSubmission,
  extractImageUrls,
  isSafeImagePath,
  parseIssueBody,
} = require('../lib/authoring');
const { listCategories, readCategory } = require('../lib/catalog');
const { loadRegistry } = require('../lib/registry');

const ROOT = path.resolve(__dirname, '../..');
const PRODUCTS_DIR = path.join(ROOT, 'products');

// Re-encode ceiling. Wider than the 1200px derivative so the source keeps some
// headroom, but bounded so a huge upload cannot land in the repository.
const MAX_STORED_WIDTH = 1600;
const STORED_QUALITY = 86;

/**
 * Checks the issue author against the allow-list.
 *
 * First, before the body is even parsed. Without this, any GitHub user could
 * file an issue on a public repository and have the workflow commit for them.
 * @param {string} author The issue author's login.
 * @param {string} allowed Comma-separated allow-list.
 * @returns {string|null} An error message, or null when the author is allowed.
 */
const checkAuthor = (author, allowed) => {
  const permitted = String(allowed || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  if (!permitted.length) return 'No allowed authors are configured, so nothing can be accepted.';
  if (!author) return 'The issue has no author.';
  return permitted.includes(String(author).toLowerCase())
    ? null
    : `@${author} is not on the allow-list for adding products.`;
};

/**
 * Downloads an attachment, refusing anything oversized.
 * @param {string} url Attachment URL, already host-checked.
 * @param {Function} fetchImpl Injected for tests.
 * @returns {Promise<Buffer>} The downloaded bytes.
 */
const download = async (url, fetchImpl) => {
  const response = await fetchImpl(url);
  if (!response.ok) throw new Error(`could not download the photo (HTTP ${response.status})`);

  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) {
    throw new Error(`the photo is larger than ${MAX_IMAGE_BYTES} bytes`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  // Checked again after the fact: content-length is a claim, not a guarantee.
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw new Error(`the photo is larger than ${MAX_IMAGE_BYTES} bytes`);
  }
  return bytes;
};

/**
 * Re-encodes an upload as a JPEG.
 *
 * The upload is never stored as received. sharp either produces a JPEG or
 * throws, which turns "is this really an image?" into a decode step rather than
 * a guess about a filename.
 * @param {Buffer} bytes Downloaded bytes.
 * @returns {Promise<Buffer>} A JPEG.
 */
const reencode = async (bytes) => {
  try {
    return await sharp(bytes)
      .rotate()
      .resize({ width: MAX_STORED_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: STORED_QUALITY, progressive: true, mozjpeg: true })
      .toBuffer();
  } catch (error) {
    throw new Error(`the uploaded file is not an image sharp can decode: ${error.message}`);
  }
};

/**
 * Inserts a product at the head of its category file.
 *
 * Parsed and re-serialised rather than appended textually, so a crafted value
 * cannot break out of the JSON. Nothing but the new entry moves: sorting the
 * array here rewrote the whole file, because the committed order is not
 * listedAt order, and buried one added product under a few hundred lines of
 * reordering that a reviewer then had to read to be sure nothing else changed.
 * Nothing needed that sort — display order is derived, by buildAllCatalog for
 * products/all.json and by scripts.js for the in-browser fallback — so the
 * order on disk is cosmetic.
 * @param {string} category Category slug.
 * @param {object} product The product to add.
 * @param {string} [productsDir] Directory holding the category files.
 * @returns {Promise<number>} The resulting product count.
 */
const insertProduct = async (category, product, productsDir = PRODUCTS_DIR) => {
  const file = path.join(productsDir, `${category}.json`);
  const products = readCategory(productsDir, category);

  products.unshift(product);

  await fsp.writeFile(file, `${JSON.stringify(products, null, 4)}\n`, 'utf8');
  return products.length;
};

/**
 * Collects every id already in use, so the allocator cannot reuse one.
 * @returns {Set<string>} Ids in use.
 */
const takenIds = () => {
  const ids = new Set();
  for (const category of listCategories(PRODUCTS_DIR)) {
    for (const product of readCategory(PRODUCTS_DIR, category)) ids.add(product.id);
  }
  return ids;
};

/**
 * Processes one issue into a catalog change.
 * @param {object} options Inputs.
 * @param {string} options.body Issue body.
 * @param {string} options.author Issue author login.
 * @param {string} options.allowedAuthors Comma-separated allow-list.
 * @param {boolean} [options.dryRun] Skip writing.
 * @param {Date} [options.now] Current time.
 * @param {Function} [options.fetchImpl] Injected fetch.
 * @returns {Promise<object>} Either { errors } or a summary of what was written.
 */
const processIssue = async ({
  body,
  author,
  allowedAuthors,
  dryRun = false,
  now = new Date(),
  fetchImpl = fetch,
}) => {
  const authorError = checkAuthor(author, allowedAuthors);
  if (authorError) return { errors: [authorError] };

  const registry = loadRegistry();
  const fields = parseIssueBody(body);
  const urls = extractImageUrls(body);

  const submission = buildSubmission({
    fields,
    registry,
    takenIds: takenIds(),
    now,
    imageCount: urls.length,
  });
  if (submission.errors) return { errors: submission.errors };

  const { product, category, imagePaths } = submission;

  // Should be unreachable: every path is composed from registry values. Checked
  // because the cost of being wrong is a write outside the repository.
  const unsafe = imagePaths.filter((relative) => !isSafeImagePath(relative));
  if (unsafe.length) return { errors: [`refusing to write outside images/: ${unsafe.join(', ')}`] };

  const images = [];
  for (const [index, url] of urls.entries()) {
    try {
      images.push({ relative: imagePaths[index], bytes: await reencode(await download(url, fetchImpl)) });
    } catch (error) {
      return { errors: [error.message] };
    }
  }

  if (dryRun) {
    return { product, category, imagePaths, dryRun: true, bytes: images.map((image) => image.bytes.length) };
  }

  for (const image of images) {
    const target = path.join(ROOT, image.relative);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.writeFile(target, image.bytes);
  }

  const count = await insertProduct(category, product);
  return { product, category, imagePaths, count };
};

const main = async () => {
  const result = await processIssue({
    body: process.env.ISSUE_BODY,
    author: process.env.ISSUE_AUTHOR,
    allowedAuthors: process.env.ALLOWED_AUTHORS,
    dryRun: process.argv.includes('--dry-run'),
  });

  if (result.errors) {
    // Written to stdout as a markdown list so the workflow can post it back to
    // the issue verbatim, giving the seller every problem at once.
    process.stdout.write(`${result.errors.map((error) => `- ${error}`).join('\n')}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `added [${result.product.id}] to ${result.category}` +
      `${result.dryRun ? ' (dry run)' : ` (${result.count} products)`}\n` +
      `${result.imagePaths.map((relative) => `  ${relative}`).join('\n')}\n`
  );

  if (process.env.GITHUB_OUTPUT) {
    await fsp.appendFile(
      process.env.GITHUB_OUTPUT,
      `product_id=${result.product.id}\ncategory=${result.category}\n`
    );
  }
};

if (require.main === module) {
  main().catch((error) => {
    process.exitCode = 1;
    process.stderr.write(`add-product failed: ${error.message}\n`);
  });
}

module.exports = { MAX_STORED_WIDTH, checkAuthor, download, insertProduct, processIssue, reencode };
