'use strict';

const crypto = require('crypto');
const fs = require('fs');
const fsp = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const SOURCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

// Grid cards never render wider than this, so thumbnails are capped here.
const THUMB_WIDTH = 400;
// The modal is the only full-size consumer; 1200px covers retina phones.
const FULL_WIDTH = 1200;

const WEBP_FULL_QUALITY = 78;
const WEBP_THUMB_QUALITY = 72;
const JPEG_FULL_QUALITY = 80;
const JPEG_THUMB_QUALITY = 74;

// Where the freshness cache lives. Outside dist/ so it is never published, and
// listed separately in the CI cache paths so it travels with dist/images.
const DEFAULT_CACHE_PATH = '.image-cache/manifest.json';
const CACHE_VERSION = 1;

/**
 * Recursively collects every convertible image under a directory.
 * @param {string} rootDir Site root the returned paths stay relative to.
 * @param {string} [relative] Subtree to walk, relative to rootDir.
 * @returns {string[]} Image paths relative to rootDir (e.g. "images/man/x.jpeg").
 */
const listSourceImages = (rootDir, relative = '') => {
  const absolute = path.join(rootDir, relative);
  return fs.readdirSync(absolute, { withFileTypes: true }).flatMap((entry) => {
    const entryRelative = path.join(relative, entry.name);
    if (entry.isDirectory()) return listSourceImages(rootDir, entryRelative);
    if (!SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) return [];
    return [entryRelative];
  });
};

/**
 * Scales a source dimension pair down to a target width, never upscaling.
 * @param {number} width Source width.
 * @param {number} height Source height.
 * @param {number} targetWidth Maximum output width.
 * @returns {{width: number, height: number}} Rendered dimensions.
 */
const scaleToWidth = (width, height, targetWidth) => {
  if (!width || !height || width <= targetWidth) {
    return { width: width || targetWidth, height: height || targetWidth };
  }
  return {
    width: targetWidth,
    height: Math.round((height / width) * targetWidth),
  };
};

/**
 * Derives every output path for one source image.
 *
 * `fullJpeg` exists so the modal has a non-WebP fallback without shipping the
 * original: copying originals cost 169 KB of dist/ per image, 59% of the tree.
 * @param {string} relativePath Path relative to the site root, POSIX separators.
 * @returns {{webp: string, fullJpeg: string, thumbWebp: string, thumbJpeg: string}} Output paths.
 */
const outputPathsFor = (relativePath) => {
  const withoutExtension = relativePath.replace(/\.[^.]+$/, '');
  return {
    webp: `${withoutExtension}.webp`,
    fullJpeg: `${withoutExtension}.jpg`,
    thumbWebp: `${withoutExtension}-thumb.webp`,
    thumbJpeg: `${withoutExtension}-thumb.jpg`,
  };
};

/**
 * Reads the freshness cache, tolerating absence or corruption.
 * @param {string} cachePath Absolute path to the cache file.
 * @returns {object} Output path -> recipe fingerprint.
 */
const readCache = (cachePath) => {
  try {
    const parsed = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (parsed && parsed.version === CACHE_VERSION && parsed.entries) return parsed.entries;
  } catch {
    // A missing or unreadable cache just means everything re-renders.
  }
  return {};
};

/**
 * Writes the freshness cache.
 * @param {string} cachePath Absolute path to the cache file.
 * @param {object} entries Output path -> recipe fingerprint.
 */
const writeCache = (cachePath, entries) => {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, `${JSON.stringify({ version: CACHE_VERSION, entries }, null, 0)}\n`, 'utf8');
};

/**
 * Fingerprints a derivative: the source's content plus the recipe that rendered it.
 *
 * Replaces an mtime comparison. mtime is the wrong signal in CI: `actions/checkout`
 * writes every source file with the checkout time while `actions/cache` restores
 * derivatives with their archived, older mtimes, so every derivative tested as
 * stale and the whole tree re-encoded on each run. Content hashing is also
 * strictly more correct locally — it notices an edited image whose mtime was
 * preserved, and ignores a touched file whose bytes did not change.
 * @param {string} sourceHash Hex digest of the source bytes.
 * @param {string} recipe Stable description of the render parameters.
 * @returns {string} The fingerprint stored in the cache.
 */
const fingerprint = (sourceHash, recipe) => `${sourceHash}:${recipe}`;

/**
 * Converts one source image into the WebP/JPEG derivatives the site serves.
 * Existing up-to-date outputs are reused so repeat builds stay cheap.
 * @param {object} options Conversion options.
 * @param {string} options.sourceRoot Directory holding the original images.
 * @param {string} options.outputRoot Directory receiving the derivatives.
 * @param {string} options.relativePath Source path relative to the site root.
 * @returns {Promise<object>} Manifest entry describing the derivatives.
 */
const convertImage = async ({ sourceRoot, outputRoot, relativePath, cache = {}, nextCache = {} }) => {
  const sourcePath = path.join(sourceRoot, relativePath);
  const posixPath = relativePath.split(path.sep).join('/');
  const outputs = outputPathsFor(posixPath);

  const bytes = await fsp.readFile(sourcePath);
  const sourceHash = crypto.createHash('sha256').update(bytes).digest('hex');

  const metadata = await sharp(bytes).metadata();
  const full = scaleToWidth(metadata.width, metadata.height, FULL_WIDTH);
  const thumb = scaleToWidth(metadata.width, metadata.height, THUMB_WIDTH);

  const renders = [
    {
      relative: outputs.webp,
      recipe: `webp:${FULL_WIDTH}:${WEBP_FULL_QUALITY}`,
      render: () =>
        sharp(bytes).resize({ width: FULL_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_FULL_QUALITY }),
    },
    {
      relative: outputs.fullJpeg,
      recipe: `jpeg:${FULL_WIDTH}:${JPEG_FULL_QUALITY}`,
      render: () =>
        sharp(bytes)
          .resize({ width: FULL_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: JPEG_FULL_QUALITY, progressive: true, mozjpeg: true }),
    },
    {
      relative: outputs.thumbWebp,
      recipe: `webp:${THUMB_WIDTH}:${WEBP_THUMB_QUALITY}`,
      render: () =>
        sharp(bytes).resize({ width: THUMB_WIDTH, withoutEnlargement: true }).webp({ quality: WEBP_THUMB_QUALITY }),
    },
    {
      relative: outputs.thumbJpeg,
      recipe: `jpeg:${THUMB_WIDTH}:${JPEG_THUMB_QUALITY}`,
      render: () =>
        sharp(bytes)
          .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: JPEG_THUMB_QUALITY, progressive: true, mozjpeg: true }),
    },
  ];

  let written = 0;
  for (const { relative, recipe, render } of renders) {
    const stamp = fingerprint(sourceHash, recipe);
    nextCache[relative] = stamp;

    // The recorded fingerprint alone is not enough: the file has to be there
    // too, or a pruned or partially restored dist/ would look up to date.
    const cached = cache[relative] === stamp && fs.existsSync(path.join(outputRoot, relative));
    if (cached) continue;

    const destination = path.join(outputRoot, relative);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await render().toFile(destination);
    written += 1;
  }

  return {
    entry: {
      // `src` stays the source path: it is the manifest key, and what a product's
      // `images` entry refers to. `full` is the generated non-WebP fallback that
      // replaced shipping the original.
      src: posixPath,
      webp: outputs.webp,
      full: outputs.fullJpeg,
      thumb: outputs.thumbWebp,
      thumbFallback: outputs.thumbJpeg,
      width: full.width,
      height: full.height,
      thumbWidth: thumb.width,
      thumbHeight: thumb.height,
    },
    written,
  };
};

/**
 * Builds every image derivative and returns a manifest keyed by source path.
 * @param {object} options Pipeline options.
 * @param {string} options.sourceRoot Site root the original images live under.
 * @param {string} options.outputRoot Directory receiving the derivatives.
 * @param {string} [options.imagesDir] Image subtree, relative to sourceRoot.
 * @param {number} [options.concurrency] Parallel conversions.
 * @param {(message: string) => void} [options.log] Progress reporter.
 * @returns {Promise<{manifest: object, converted: number, written: number}>} Build result.
 */
const buildImageManifest = async ({
  sourceRoot,
  outputRoot,
  imagesDir = 'images',
  concurrency = 8,
  cachePath = path.join(sourceRoot, DEFAULT_CACHE_PATH),
  log = () => {},
}) => {
  const sources = listSourceImages(sourceRoot, imagesDir);
  const manifest = {};
  const cache = readCache(cachePath);
  const nextCache = {};
  let written = 0;

  for (let index = 0; index < sources.length; index += concurrency) {
    const batch = sources.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map((relativePath) =>
        convertImage({ sourceRoot, outputRoot, relativePath, cache, nextCache }).catch((error) => {
          throw new Error(`Failed to process ${relativePath}: ${error.message}`);
        })
      )
    );
    results.forEach(({ entry, written: count }) => {
      manifest[entry.src] = entry;
      written += count;
    });
    log(`images: ${Math.min(index + concurrency, sources.length)}/${sources.length}`);
  }

  // Rebuilt from scratch rather than merged, so entries for deleted sources
  // disappear instead of accumulating.
  writeCache(cachePath, nextCache);

  return { manifest, converted: sources.length, written, cachePath };
};

/**
 * Lists every derivative the manifest declares.
 * @param {object} manifest Image manifest keyed by source path.
 * @returns {string[]} Output paths, relative to the output root.
 */
const manifestOutputs = (manifest) =>
  Object.values(manifest).flatMap((entry) => [entry.webp, entry.full, entry.thumb, entry.thumbFallback]);

module.exports = {
  CACHE_VERSION,
  DEFAULT_CACHE_PATH,
  FULL_WIDTH,
  THUMB_WIDTH,
  buildImageManifest,
  fingerprint,
  listSourceImages,
  manifestOutputs,
  outputPathsFor,
  readCache,
  scaleToWidth,
};
