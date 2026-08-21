'use strict';

const fsp = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

// Path, relative to the site root, of the image referenced by og:image.
const OG_CARD_PATH = 'images/og-card.jpg';

// The size WhatsApp, Facebook and X expect for a large preview card. A square
// image would be cropped to a small thumbnail instead.
const OG_CARD_WIDTH = 1200;
const OG_CARD_HEIGHT = 630;

// Leaves breathing room above and below the logo.
const LOGO_HEIGHT = 460;

// Matches --primary-color in styles.css, and the logo's own background.
const BACKGROUND = { r: 0, g: 0, b: 0 };

/**
 * Renders the link-preview card by centring the logo on the brand background.
 * Regenerated only when the logo is newer than the existing card.
 * @param {object} options Card options.
 * @param {string} options.sourceRoot Site root the logo lives under.
 * @param {string} options.outputRoot Directory receiving the card.
 * @param {string} [options.logo] Logo path, relative to sourceRoot.
 * @returns {Promise<{path: string, written: boolean}>} Card path and whether it was rendered.
 */
const buildSocialCard = async ({ sourceRoot, outputRoot, logo = 'images/logo.jpeg' }) => {
  const logoPath = path.join(sourceRoot, logo);
  const destination = path.join(outputRoot, OG_CARD_PATH);

  const logoStat = await fsp.stat(logoPath);
  try {
    const existing = await fsp.stat(destination);
    if (existing.mtimeMs >= logoStat.mtimeMs) return { path: OG_CARD_PATH, written: false };
  } catch {
    // Card has not been generated yet.
  }

  const logoBuffer = await sharp(logoPath)
    .resize({ height: LOGO_HEIGHT, fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  await fsp.mkdir(path.dirname(destination), { recursive: true });
  await sharp({
    create: {
      width: OG_CARD_WIDTH,
      height: OG_CARD_HEIGHT,
      channels: 3,
      background: BACKGROUND,
    },
  })
    .composite([{ input: logoBuffer, gravity: 'centre' }])
    .jpeg({ quality: 86, progressive: true, mozjpeg: true })
    .toFile(destination);

  return { path: OG_CARD_PATH, written: true };
};

module.exports = {
  OG_CARD_HEIGHT,
  OG_CARD_PATH,
  OG_CARD_WIDTH,
  buildSocialCard,
};
