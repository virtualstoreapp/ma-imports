const fs = require('fs');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const {
  CACHE_VERSION,
  FULL_WIDTH,
  THUMB_WIDTH,
  buildImageManifest,
  manifestOutputs,
  outputPathsFor,
  readCache,
  scaleToWidth,
} = require('../../tools/lib/images');

let root;

/**
 * Writes a throwaway source tree with one solid-colour image.
 * @param {object} [options] Image options.
 * @param {number} [options.width] Source width.
 * @param {number} [options.hue] Colour, so two images differ in content.
 * @returns {Promise<{root: string, source: string}>} Fixture paths.
 */
const writeTree = async ({ width = 1600, hue = 20 } = {}) => {
  const dir = fs.mkdtempSync(path.join(root, 'tree-'));
  const source = path.join(dir, 'images', 'man', 'caps', '2907251533-adidas.jpeg');
  fs.mkdirSync(path.dirname(source), { recursive: true });
  await sharp({
    create: { width, height: Math.round(width * 1.25), channels: 3, background: { r: hue, g: 90, b: 160 } },
  })
    .jpeg()
    .toFile(source);
  return { root: dir, source };
};

const build = (dir, overrides = {}) =>
  buildImageManifest({
    sourceRoot: dir,
    outputRoot: path.join(dir, 'dist'),
    cachePath: path.join(dir, '.image-cache', 'manifest.json'),
    ...overrides,
  });

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-imports-images-'));
});

afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe('scaleToWidth', () => {
  it('scales down preserving the aspect ratio', () => {
    expect(scaleToWidth(1600, 2000, 400)).toEqual({ width: 400, height: 500 });
  });

  it('never upscales', () => {
    expect(scaleToWidth(300, 400, 1200)).toEqual({ width: 300, height: 400 });
  });
});

describe('outputPathsFor', () => {
  it('derives all four derivative paths', () => {
    expect(outputPathsFor('images/man/caps/x.jpeg')).toEqual({
      webp: 'images/man/caps/x.webp',
      fullJpeg: 'images/man/caps/x.jpg',
      thumbWebp: 'images/man/caps/x-thumb.webp',
      thumbJpeg: 'images/man/caps/x-thumb.jpg',
    });
  });
});

describe('buildImageManifest', () => {
  it('renders four derivatives per source and records their dimensions', async () => {
    const { root: dir } = await writeTree({ width: 1600 });
    const { manifest, converted, written } = await build(dir);

    expect(converted).toBe(1);
    expect(written).toBe(4);

    const entry = manifest['images/man/caps/2907251533-adidas.jpeg'];
    expect(entry.src).toBe('images/man/caps/2907251533-adidas.jpeg');
    expect(entry.full).toBe('images/man/caps/2907251533-adidas.jpg');
    expect(entry.width).toBe(FULL_WIDTH);
    expect(entry.thumbWidth).toBe(THUMB_WIDTH);

    manifestOutputs(manifest).forEach((relative) => {
      expect(fs.existsSync(path.join(dir, 'dist', relative))).toBe(true);
    });
  });

  it('writes a versioned cache with one entry per derivative', async () => {
    const { root: dir } = await writeTree();
    await build(dir);

    const cachePath = path.join(dir, '.image-cache', 'manifest.json');
    expect(JSON.parse(fs.readFileSync(cachePath, 'utf8')).version).toBe(CACHE_VERSION);
    expect(Object.keys(readCache(cachePath))).toHaveLength(4);
  });

  it('re-renders nothing on an unchanged rebuild', async () => {
    const { root: dir } = await writeTree();
    await build(dir);
    expect((await build(dir)).written).toBe(0);
  });

  // The whole point of moving off mtime: CI restores derivatives with older
  // mtimes than the freshly checked-out sources, which made every rebuild
  // re-encode the entire tree.
  it('re-renders nothing when the source mtime is newer than the derivatives', async () => {
    const { root: dir, source } = await writeTree();
    await build(dir);

    const future = new Date(Date.now() + 60_000);
    fs.utimesSync(source, future, future);

    expect((await build(dir)).written).toBe(0);
  });

  it('re-renders when the source content actually changes', async () => {
    const { root: dir, source } = await writeTree({ hue: 20 });
    await build(dir);

    // Same path and same size, different pixels.
    await sharp({ create: { width: 1600, height: 2000, channels: 3, background: { r: 200, g: 10, b: 10 } } })
      .jpeg()
      .toFile(`${source}.tmp`);
    fs.renameSync(`${source}.tmp`, source);

    expect((await build(dir)).written).toBe(4);
  });

  // A fingerprint alone is not proof: dist/ may have been pruned or only
  // partially restored, and trusting the record would ship a missing image.
  it('re-renders a derivative whose file has gone missing', async () => {
    const { root: dir } = await writeTree();
    await build(dir);

    fs.rmSync(path.join(dir, 'dist', 'images/man/caps/2907251533-adidas.webp'));
    expect((await build(dir)).written).toBe(1);
  });

  it('re-renders everything when the cache is lost', async () => {
    const { root: dir } = await writeTree();
    await build(dir);

    fs.rmSync(path.join(dir, '.image-cache'), { recursive: true });
    expect((await build(dir)).written).toBe(4);
  });

  it('survives a corrupt cache instead of failing the build', async () => {
    const { root: dir } = await writeTree();
    await build(dir);

    const cachePath = path.join(dir, '.image-cache', 'manifest.json');
    fs.writeFileSync(cachePath, 'not json at all');
    expect((await build(dir)).written).toBe(4);
    expect(JSON.parse(fs.readFileSync(cachePath, 'utf8')).version).toBe(CACHE_VERSION);
  });

  it('drops cache entries for sources that no longer exist', async () => {
    const { root: dir, source } = await writeTree();
    await build(dir);
    fs.rmSync(source);

    await build(dir);
    expect(Object.keys(readCache(path.join(dir, '.image-cache', 'manifest.json')))).toEqual([]);
  });

  it('produces a full-size JPEG smaller than a 1600px source', async () => {
    const { root: dir, source } = await writeTree({ width: 1600 });
    const { manifest } = await build(dir);
    const entry = manifest['images/man/caps/2907251533-adidas.jpeg'];

    const generated = fs.statSync(path.join(dir, 'dist', entry.full)).size;
    expect(generated).toBeLessThan(fs.statSync(source).size);
  });
});

describe('assertImagesIntact', () => {
  const { assertImagesIntact } = require('../../tools/build');

  // A backstop rather than the primary mechanism: buildImageManifest already
  // re-renders a derivative whose file is gone. This catches the case where the
  // tree disagrees with the manifest for any other reason.
  it('rejects a manifest declaring a derivative that is not on disk', async () => {
    await expect(
      assertImagesIntact({ 'images/x.jpeg': { webp: 'images/nope.webp', full: 'images/nope.jpg', thumb: 'images/nope-thumb.webp', thumbFallback: 'images/nope-thumb.jpg' } }, [])
    ).rejects.toThrow(/declared derivative\(s\) missing from dist/);
  });

  it('accepts the real tree after a build', async () => {
    const { buildImageManifest: build } = require('../../tools/lib/images');
    const { collectSiteAssets } = require('../../tools/build');
    const ROOT = path.join(__dirname, '../..');
    if (!fs.existsSync(path.join(ROOT, 'dist', 'images'))) return; // dist is gitignored

    const { manifest } = await build({
      sourceRoot: ROOT,
      outputRoot: path.join(ROOT, 'dist'),
    });
    // The keep-list is the social card plus the verbatim site assets; without
    // them the copied logo reads as an unreferenced file.
    const keep = ['images/og-card.jpg', ...(await collectSiteAssets())];
    await expect(assertImagesIntact(manifest, keep)).resolves.toBeUndefined();
  });
});

describe('Site assets', () => {
  const { assertReferencesResolve, collectSiteAssets } = require('../../tools/build');
  const ROOT = path.join(__dirname, '../..');

  // Wave 5a stopped copying originals into dist/ and took the header logo with
  // them, 404ing it on the built site. index.html cannot simply point at the
  // generated images/logo.jpg instead: CON-2 requires the same markup to work in
  // an unbuilt tree, where only the original exists. So site assets are copied
  // verbatim, and this is the check that they arrived.
  it('finds the images the site markup references', async () => {
    expect(await collectSiteAssets()).toContain('images/logo.jpeg');
  });

  it('accepts a reference that resolves in dist', async () => {
    if (!fs.existsSync(path.join(ROOT, 'dist', 'images', 'logo.jpeg'))) return; // dist is gitignored
    await expect(assertReferencesResolve(['images/logo.jpeg'])).resolves.toBeUndefined();
  });

  it('rejects a reference with no file behind it', async () => {
    await expect(assertReferencesResolve(['images/absent-asset.jpeg']))
      .rejects.toThrow(/referenced by the site are missing from dist/);
  });

  it('keeps the referenced original out of the manifest outputs', async () => {
    // The logo has derivatives too, but the reference is to the original, so the
    // original is what has to be copied.
    const { buildImageManifest: build } = require('../../tools/lib/images');
    if (!fs.existsSync(path.join(ROOT, 'dist', 'images'))) return;

    const { manifest } = await build({ sourceRoot: ROOT, outputRoot: path.join(ROOT, 'dist') });
    expect(manifestOutputs(manifest)).not.toContain('images/logo.jpeg');
    expect(manifestOutputs(manifest)).toContain('images/logo.jpg');
  });
});
