const fsp = require('fs/promises');
const os = require('os');
const path = require('path');
const sharp = require('sharp');

const { loadHtml } = require('../utils/catalogCommon');
const {
  OG_CARD_HEIGHT,
  OG_CARD_PATH,
  OG_CARD_WIDTH,
  buildSocialCard,
} = require('../../tools/lib/social');

const ROOT = path.join(__dirname, '../..');

const head = new DOMParser().parseFromString(loadHtml(), 'text/html');
const property = (name) => head.querySelector(`meta[property="${name}"]`)?.getAttribute('content');
const named = (name) => head.querySelector(`meta[name="${name}"]`)?.getAttribute('content');

describe('Link preview metadata', () => {
  it('declares the Open Graph properties crawlers need for a card', () => {
    for (const name of ['og:type', 'og:title', 'og:description', 'og:url', 'og:image']) {
      expect(property(name)).toBeTruthy();
    }
    expect(property('og:type')).toBe('website');
    expect(named('description')).toBeTruthy();
  });

  it('uses absolute image URLs, since crawlers do not resolve relative ones', () => {
    for (const url of [property('og:image'), named('twitter:image')]) {
      expect(() => new URL(url)).not.toThrow();
      expect(new URL(url).protocol).toBe('https:');
    }
  });

  it('points og:url, canonical and og:image at the same deployed site', () => {
    const canonical = head.querySelector('link[rel="canonical"]').getAttribute('href');
    expect(property('og:url')).toBe(canonical);
    expect(property('og:image').startsWith(canonical)).toBe(true);
    expect(named('twitter:image')).toBe(property('og:image'));
  });

  // Guards the one thing a hardcoded URL cannot express: that og:image actually
  // names the file the build generates, at the dimensions declared to crawlers.
  it('matches the card the build generates', () => {
    expect(new URL(property('og:image')).pathname.endsWith(OG_CARD_PATH)).toBe(true);
    expect(property('og:image:width')).toBe(String(OG_CARD_WIDTH));
    expect(property('og:image:height')).toBe(String(OG_CARD_HEIGHT));
    expect(named('twitter:card')).toBe('summary_large_image');
  });
});

describe('Social card generation', () => {
  let outputRoot;

  beforeAll(async () => {
    outputRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'ma-imports-social-'));
  });

  afterAll(async () => {
    await fsp.rm(outputRoot, { recursive: true, force: true });
  });

  it('renders a landscape JPEG at the advertised size', async () => {
    const result = await buildSocialCard({ sourceRoot: ROOT, outputRoot });
    expect(result.written).toBe(true);

    const metadata = await sharp(path.join(outputRoot, result.path)).metadata();
    expect(metadata.format).toBe('jpeg');
    expect(metadata.width).toBe(OG_CARD_WIDTH);
    expect(metadata.height).toBe(OG_CARD_HEIGHT);
  });

  it('reuses an up-to-date card instead of re-rendering', async () => {
    const result = await buildSocialCard({ sourceRoot: ROOT, outputRoot });
    expect(result.written).toBe(false);
  });
});
