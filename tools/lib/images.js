'use strict';

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
const JPEG_THUMB_QUALITY = 74;

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
 * @param {string} relativePath Path relative to the site root, POSIX separators.
 * @returns {{webp: string, thumbWebp: string, thumbJpeg: string}} Output paths.
 */
const outputPathsFor = (relativePath) => {
  const withoutExtension = relativePath.replace(/\.[^.]+$/, '');
  return {
    webp: `${withoutExtension}.webp`,
    thumbWebp: `${withoutExtension}-thumb.webp`,
    thumbJpeg: `${withoutExtension}-thumb.jpg`,
  };
};

/**
 * Converts one source image into the WebP/JPEG derivatives the site serves.
 * Existing up-to-date outputs are reused so repeat builds stay cheap.
 * @param {object} options Conversion options.
 * @param {string} options.sourceRoot Directory holding the original images.
 * @param {string} options.outputRoot Directory receiving the derivatives.
 * @param {string} options.relativePath Source path relative to the site root.
 * @returns {Promise<object>} Manifest entry describing the derivatives.
 */
const convertImage = async ({ sourceRoot, outputRoot, relativePath }) => {
  const sourcePath = path.join(sourceRoot, relativePath);
  const posixPath = relativePath.split(path.sep).join('/');
  const outputs = outputPathsFor(posixPath);

  const metadata = await sharp(sourcePath).metadata();
  const full = scaleToWidth(metadata.width, metadata.height, FULL_WIDTH);
  const thumb = scaleToWidth(metadata.width, metadata.height, THUMB_WIDTH);

  const sourceStat = await fsp.stat(sourcePath);
  const isFresh = async (outputRelative) => {
    try {
      const stat = await fsp.stat(path.join(outputRoot, outputRelative));
      return stat.mtimeMs >= sourceStat.mtimeMs;
    } catch {
      return false;
    }
  };

  const renders = [
    {
      relative: outputs.webp,
      render: () =>
        sharp(sourcePath)
          .resize({ width: FULL_WIDTH, withoutEnlargement: true })
          .webp({ quality: WEBP_FULL_QUALITY }),
    },
    {
      relative: outputs.thumbWebp,
      render: () =>
        sharp(sourcePath)
          .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .webp({ quality: WEBP_THUMB_QUALITY }),
    },
    {
      relative: outputs.thumbJpeg,
      render: () =>
        sharp(sourcePath)
          .resize({ width: THUMB_WIDTH, withoutEnlargement: true })
          .jpeg({ quality: JPEG_THUMB_QUALITY, progressive: true, mozjpeg: true }),
    },
  ];

  let written = 0;
  for (const { relative, render } of renders) {
    if (await isFresh(relative)) continue;
    const destination = path.join(outputRoot, relative);
    await fsp.mkdir(path.dirname(destination), { recursive: true });
    await render().toFile(destination);
    written += 1;
  }

  return {
    entry: {
      src: posixPath,
      webp: outputs.webp,
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
  log = () => {},
}) => {
  const sources = listSourceImages(sourceRoot, imagesDir);
  const manifest = {};
  let written = 0;

  for (let index = 0; index < sources.length; index += concurrency) {
    const batch = sources.slice(index, index + concurrency);
    const results = await Promise.all(
      batch.map((relativePath) =>
        convertImage({ sourceRoot, outputRoot, relativePath }).catch((error) => {
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

  return { manifest, converted: sources.length, written };
};

module.exports = {
  FULL_WIDTH,
  THUMB_WIDTH,
  buildImageManifest,
  listSourceImages,
  outputPathsFor,
  scaleToWidth,
};
