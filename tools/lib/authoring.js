'use strict';

/**
 * Turns a GitHub Issue Form submission into a v2 product.
 *
 * This is the logic behind the non-developer authoring path (CON-8). It lives
 * here, not in the workflow, because a workflow cannot be unit-tested: the
 * workflow's only job is to pass inputs in and commit the result. Everything
 * that can be wrong — parsing, validation, id allocation, path construction —
 * is here and covered by tests, including adversarial ones.
 *
 * Every field arriving from an issue body is untrusted. It is validated against
 * the registries rather than interpolated anywhere, and nothing here builds a
 * shell command or concatenates JSON.
 */

const path = require('path');

// Issue Forms render each answer under its field label as a markdown heading.
const FIELD_HEADING = /^###\s+(.+?)\s*$/;

// What GitHub writes for an untouched optional field.
const NO_RESPONSE = '_No response_';

// Ten digits, DDMMYYHHmm. OQ-5 established the code is internal, so the format
// is a free choice; it is kept because the seller already reads codes in this
// shape, and Wave 7 publishes them as URLs, after which they must never change.
const ID_LENGTH = 10;

// A single upload should never be this large; anything bigger is a mistake or an
// attempt to exhaust the runner.
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;

// Variant suffixes, matching validator rule 3.
const VARIANTS = ['front', 'back'];

/**
 * Splits an issue body into a map of heading to raw answer.
 *
 * Deliberately tolerant about surrounding whitespace and blank lines, because a
 * human may edit the issue by hand after it is filed.
 * @param {string} body The issue body.
 * @returns {object} Heading -> answer, with unanswered fields absent.
 */
const parseIssueBody = (body) => {
  const fields = {};
  let heading = null;
  let buffer = [];

  const flush = () => {
    if (!heading) return;
    const value = buffer.join('\n').trim();
    if (value && value !== NO_RESPONSE) fields[heading] = value;
    buffer = [];
  };

  for (const line of String(body || '').split(/\r?\n/)) {
    const match = FIELD_HEADING.exec(line);
    if (match) {
      flush();
      [, heading] = match;
      continue;
    }
    if (heading) buffer.push(line);
  }
  flush();

  return fields;
};

/**
 * Parses a decimal price written the way a Brazilian seller writes it.
 *
 * Accepts "89,90" and "89.90" and "R$ 89,90". Rejects anything else rather than
 * guessing, because a misread price is worse than a rejected form.
 * @param {string} raw The raw answer.
 * @returns {number|null} The price, or null when unparseable.
 */
const parsePrice = (raw) => {
  if (typeof raw !== 'string') return null;
  const cleaned = raw.replace(/[R$\s]/g, '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned.replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
};

/**
 * Parses the size answer into units.
 *
 * A row may hold several units (CON-10), so the form's size control is a
 * multi-select and this accepts a comma-separated list. Duplicates are rejected
 * rather than collapsed: two units of the same size is a stock question the form
 * cannot express, so it should be asked rather than assumed.
 * @param {string} raw The raw answer.
 * @returns {{sizes: object[]}|{error: string}} Units, or a rejection reason.
 */
const parseSizes = (raw) => {
  if (!raw) return { sizes: [] };

  const values = String(raw)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  const seen = new Set();
  for (const value of values) {
    if (seen.has(value)) return { error: `size "${value}" is listed twice` };
    seen.add(value);
  }

  return { sizes: values.map((size) => ({ size })) };
};

/**
 * Allocates a free product id.
 *
 * The clock alone is not enough: the code has minute granularity, so two
 * submissions in the same minute would collide — and a collision is a build
 * error, not a warning. This walks forward a minute at a time until it finds an
 * unused code, which keeps the code approximately the listing time while
 * guaranteeing uniqueness.
 * @param {Set<string>|string[]} taken Ids already in use.
 * @param {Date} now Current time.
 * @returns {string} An unused 10-digit id.
 */
const allocateId = (taken, now) => {
  const used = taken instanceof Set ? taken : new Set(taken);
  const pad = (value) => String(value).padStart(2, '0');

  // A whole day of minutes is far more headroom than one submission needs, and
  // bounds the loop so a corrupt `taken` set cannot spin forever.
  for (let offset = 0; offset < 60 * 24; offset += 1) {
    const at = new Date(now.getTime() + offset * 60_000);
    const id = [
      pad(at.getUTCDate()),
      pad(at.getUTCMonth() + 1),
      pad(at.getUTCFullYear() % 100),
      pad(at.getUTCHours()),
      pad(at.getUTCMinutes()),
    ].join('');
    if (!used.has(id)) return id;
  }

  throw new Error('could not allocate a free product id within 24 hours of now');
};

/**
 * Derives the UTC listing timestamp implied by an id.
 * Kept identical to the migration's derivation so validator rule on
 * id/listedAt agreement holds.
 * @param {string} id A 10-digit id.
 * @returns {string} ISO 8601 UTC timestamp.
 */
const listedAtFrom = (id) =>
  `20${id.slice(4, 6)}-${id.slice(2, 4)}-${id.slice(0, 2)}T${id.slice(6, 8)}:${id.slice(8, 10)}:00Z`;

/**
 * Builds the repository path for an uploaded image.
 *
 * The path is composed from registry values and the allocated id, never from
 * anything the submitter typed — which is what stops a crafted filename from
 * escaping the images directory.
 * @param {object} leaf The category's registry leaf.
 * @param {string} brand Brand slug.
 * @param {string} id Allocated product id.
 * @param {string|null} variant `front`, `back`, or null for a single image.
 * @returns {string} Repository-relative path.
 */
const imagePathFor = (leaf, brand, id, variant = null) => {
  if (variant !== null && !VARIANTS.includes(variant)) {
    throw new Error(`unknown image variant "${variant}"`);
  }

  // Brandless products sit directly in imageDir even where the category uses
  // brand folders, matching validator rule 4a.
  const directory = leaf.usesBrandFolders && brand !== 'unbranded'
    ? `${leaf.imageDir}/${brand}`
    : leaf.imageDir;

  const suffix = brand === 'unbranded' ? '' : `-${brand}`;
  const variantSuffix = variant ? `-${variant}` : '';

  return `${directory}/${id}${suffix}${variantSuffix}.jpeg`;
};

// Sentinel shown in the form for a product with no brand, since `unbranded`
// carries an empty label and an empty dropdown option is unusable.
const NO_BRAND_OPTION = 'Sem marca';

/**
 * Resolves a category answer to its registry leaf, by label or by slug.
 * @param {object} registry Output of loadRegistry.
 * @param {string} answer The submitted value.
 * @returns {object|null} The leaf, or null when it matches no selectable category.
 */
const resolveLeaf = (registry, answer) => {
  const bySlug = registry.bySlug.get(answer);
  if (bySlug && bySlug.type === 'leaf') return bySlug;
  return registry.leaves.find((leaf) => leaf.label === answer) || null;
};

/**
 * Resolves a brand answer to its slug, by label or by slug.
 * @param {object} registry Output of loadRegistry.
 * @param {string} answer The submitted value.
 * @returns {string|null} The brand slug, or null when unknown.
 */
const resolveBrand = (registry, answer) => {
  if (answer === NO_BRAND_OPTION) return 'unbranded';
  if (Object.prototype.hasOwnProperty.call(registry.brands, answer)) return answer;

  const match = Object.entries(registry.brands)
    .find(([slug, brand]) => brand.label === answer && slug !== 'unbranded');
  return match ? match[0] : null;
};

/**
 * Validates a parsed submission against the registries and builds a product.
 *
 * Returns errors rather than throwing, so the workflow can post all of them back
 * to the issue at once instead of the submitter discovering them one at a time.
 * @param {object} options Build options.
 * @param {object} options.fields Output of parseIssueBody.
 * @param {object} options.registry Output of loadRegistry.
 * @param {Set<string>} options.takenIds Ids already in use.
 * @param {Date} options.now Current time.
 * @param {number} options.imageCount How many images were uploaded.
 * @returns {{product: object, category: string, imagePaths: string[]}|{errors: string[]}} Result.
 */
const buildSubmission = ({ fields, registry, takenIds, now, imageCount }) => {
  const errors = [];
  const answer = (label) => fields[label];

  // The form shows human labels ("Bonés Masculino"), which read better for a
  // non-developer, but an issue edited by hand may carry the slug instead.
  // Accepting both removes the choice between a readable form and a robust
  // parser. Either way the value is resolved against the registry, never used
  // as given.
  const rawCategory = answer('Categoria');
  const leaf = rawCategory ? resolveLeaf(registry, rawCategory) : null;
  if (!rawCategory) {
    errors.push('Categoria is required.');
  } else if (!leaf) {
    errors.push(`Categoria "${rawCategory}" is not a category in catalog/categories.json.`);
  }

  const rawBrand = answer('Marca');
  const brand = rawBrand ? resolveBrand(registry, rawBrand) : 'unbranded';
  if (rawBrand && !brand) {
    errors.push(`Marca "${rawBrand}" is not in catalog/brands.json.`);
  }

  const price = parsePrice(answer('Preço'));
  if (price === null) {
    errors.push('Preço must be a positive number, for example 89,90.');
  }

  let oldPrice = null;
  if (answer('Preço antigo')) {
    oldPrice = parsePrice(answer('Preço antigo'));
    if (oldPrice === null) {
      errors.push('Preço antigo must be a positive number, or left blank.');
    } else if (price !== null && oldPrice <= price) {
      errors.push(`Preço antigo (${oldPrice}) must be higher than Preço (${price}) to read as a discount.`);
    }
  }

  const parsedSizes = parseSizes(answer('Tamanhos'));
  if (parsedSizes.error) errors.push(parsedSizes.error);

  const sizeNote = answer('Observação de tamanho') || null;
  if (sizeNote && parsedSizes.sizes && parsedSizes.sizes.length) {
    errors.push('Fill in either Tamanhos or Observação de tamanho, not both.');
  }
  if (sizeNote === 'N/A') {
    errors.push('Observação de tamanho "N/A" is redundant — leave it blank instead.');
  }

  if (!imageCount) errors.push('At least one photo is required.');
  if (imageCount > VARIANTS.length) {
    errors.push(`At most ${VARIANTS.length} photos are supported (${VARIANTS.join(', ')}).`);
  }

  if (errors.length) return { errors };

  const id = allocateId(takenIds, now);
  const product = { id, brand };

  const model = answer('Modelo');
  if (model) product.model = model;

  product.price = price;
  if (oldPrice !== null) product.oldPrice = oldPrice;

  product.sizes = parsedSizes.sizes;
  if (sizeNote) product.sizeNote = sizeNote;

  const description = answer('Descrição');
  if (description) product.description = description;

  const imagePaths = imageCount === 1
    ? [imagePathFor(leaf, brand, id)]
    : VARIANTS.slice(0, imageCount).map((variant) => imagePathFor(leaf, brand, id, variant));

  product.images = imagePaths;
  product.listedAt = listedAtFrom(id);

  return { product, category: leaf.slug, imagePaths };
};

/**
 * Extracts image URLs from an issue body's markdown or HTML image references.
 *
 * Only GitHub's own attachment hosts are accepted. A submitter could otherwise
 * point the workflow at any URL and have the runner fetch it.
 * @param {string} body The issue body.
 * @returns {string[]} Accepted image URLs, in order.
 */
const extractImageUrls = (body) => {
  const text = String(body || '');
  const urls = [];

  const push = (url) => {
    if (!urls.includes(url)) urls.push(url);
  };

  for (const [, url] of text.matchAll(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/g)) push(url);
  for (const [, url] of text.matchAll(/<img[^>]+src="(https:\/\/[^"]+)"/g)) push(url);

  return urls.filter(isAllowedAttachmentUrl);
};

/**
 * Whether a URL is a GitHub-hosted attachment.
 * @param {string} url Candidate URL.
 * @returns {boolean} True when the host is a known GitHub attachment host.
 */
const isAllowedAttachmentUrl = (url) => {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;

  return [
    'user-images.githubusercontent.com',
    'github.com',
    'raw.githubusercontent.com',
    'private-user-images.githubusercontent.com',
    'objects.githubusercontent.com',
  ].includes(parsed.hostname);
};

/**
 * Whether a path stays inside the repository's images directory.
 *
 * A last line of defence: every path is composed from registry values already,
 * so this should be unreachable, and is checked anyway because the cost of being
 * wrong is a write outside the repository.
 * @param {string} relative Candidate repository-relative path.
 * @returns {boolean} True when the path is safe to write.
 */
const isSafeImagePath = (relative) => {
  if (typeof relative !== 'string' || !relative) return false;
  if (relative.includes('..') || relative.includes('\0')) return false;
  if (path.posix.isAbsolute(relative) || /^[A-Za-z]:/.test(relative)) return false;

  const normalised = path.posix.normalize(relative);
  return normalised === relative && normalised.startsWith('images/');
};

module.exports = {
  ID_LENGTH,
  NO_BRAND_OPTION,
  MAX_IMAGE_BYTES,
  NO_RESPONSE,
  VARIANTS,
  allocateId,
  buildSubmission,
  extractImageUrls,
  imagePathFor,
  isAllowedAttachmentUrl,
  isSafeImagePath,
  listedAtFrom,
  parseIssueBody,
  parsePrice,
  parseSizes,
  resolveBrand,
  resolveLeaf,
};
