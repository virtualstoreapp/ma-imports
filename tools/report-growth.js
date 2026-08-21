#!/usr/bin/env node
'use strict';

/**
 * Reports the growth signals that decide when images-in-git stops being the
 * right choice, and warns when one crosses its threshold.
 *
 * The storage decision (docs/architecture/adr/ADR-001-product-image-storage.md)
 * is "keep images in git, for now". The thresholds below are what make that a
 * measured position rather than a remembered one, so they are checked on every
 * build instead of living only in a document.
 *
 * This never fails the build. A monitor that blocks a deploy over a capacity
 * signal would be worse than the problem it reports.
 */

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;
const ROOT = path.resolve(__dirname, '..');

// IDs match the threshold table in docs/architecture/product-image-storage-plan.md §5.1.
const THRESHOLDS = [
  {
    id: 'T1',
    label: 'git pack size',
    limit: 100 * MB,
    metric: (metrics) => metrics.pack.bytes,
    format: (value) => formatBytes(value),
    action: 'review whether ingest is tracking the planning baseline, and re-run the storage analysis',
  },
  {
    id: 'T3',
    label: 'image count',
    limit: 1000,
    metric: (metrics) => metrics.images.count,
    format: (value) => `${value} files`,
    action: 'build-time pressure: key image freshness on content hash rather than mtime',
  },
  {
    id: 'T5',
    label: 'dist/ size',
    limit: 500 * MB,
    metric: (metrics) => metrics.dist.bytes,
    format: (value) => formatBytes(value),
    action: 'Pages artifact pressure: stop copying original images into dist/',
  },
];

const formatBytes = (bytes) => {
  if (bytes === null) return 'unavailable';
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
};

/**
 * Sums the size of every file under a directory.
 *
 * This is apparent size, not on-disk blocks, so it reads lower than `du -sh`
 * for a tree of many small files (dist/ holds ~1,100). Apparent size is the
 * right measure here because that is what the uploaded Pages artifact contains.
 * @param {string} directory Absolute path.
 * @returns {{bytes: number, files: number}|null} Totals, or null when absent.
 */
const measureDirectory = (directory) => {
  let entries;
  try {
    entries = fs.readdirSync(directory, { withFileTypes: true });
  } catch {
    return null;
  }

  let bytes = 0;
  let files = 0;
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = measureDirectory(absolute);
      if (nested) {
        bytes += nested.bytes;
        files += nested.files;
      }
      continue;
    }
    try {
      bytes += fs.statSync(absolute).size;
      files += 1;
    } catch {
      // Raced with a concurrent build; the totals stay advisory either way.
    }
  }
  return { bytes, files };
};

const git = (args) =>
  execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/**
 * Reads the packed size of the object store.
 *
 * `actions/checkout` clones with `fetch-depth: 1` by default, which produces a
 * shallow repository whose pack is a small fraction of the real history. Pack
 * size is therefore reported as unavailable there rather than as a reassuringly
 * small number — a false green on T1 would defeat the point of the monitor.
 * @returns {{bytes: number|null, shallow: boolean, reason: string|null}} Pack size.
 */
const measurePack = () => {
  let shallow = false;
  try {
    shallow = git(['rev-parse', '--is-shallow-repository']) === 'true';
  } catch {
    return { bytes: null, shallow: false, reason: 'not a git repository' };
  }

  if (shallow) {
    return { bytes: null, shallow: true, reason: 'shallow clone, so the pack is not representative' };
  }

  try {
    // `size-pack` is reported in KiB.
    const line = git(['count-objects', '-v'])
      .split('\n')
      .find((entry) => entry.startsWith('size-pack:'));
    if (!line) return { bytes: null, shallow: false, reason: 'size-pack not reported' };
    return { bytes: Number(line.split(':')[1].trim()) * 1024, shallow: false, reason: null };
  } catch {
    return { bytes: null, shallow: false, reason: 'git count-objects failed' };
  }
};

/**
 * Collects every growth signal.
 * @returns {object} Metrics for the threshold table.
 */
const collectGrowthMetrics = () => {
  const images = measureDirectory(path.join(ROOT, 'images')) || { bytes: 0, files: 0 };
  const dist = measureDirectory(path.join(ROOT, 'dist'));

  return {
    pack: measurePack(),
    images: { count: images.files, bytes: images.bytes },
    dist: { bytes: dist ? dist.bytes : null, files: dist ? dist.files : null },
  };
};

/**
 * Returns the thresholds whose signal has been crossed.
 * A threshold whose metric is unavailable is skipped, not treated as passing.
 * @param {object} metrics Output of collectGrowthMetrics.
 * @returns {object[]} Crossed thresholds, with their observed value.
 */
const evaluateThresholds = (metrics) =>
  THRESHOLDS.map((threshold) => ({ threshold, value: threshold.metric(metrics) }))
    .filter(({ threshold, value }) => typeof value === 'number' && value > threshold.limit)
    .map(({ threshold, value }) => ({ ...threshold, value }));

/**
 * Renders the human-readable report lines.
 * @param {object} metrics Output of collectGrowthMetrics.
 * @returns {string[]} Report lines.
 */
const formatReport = (metrics) => {
  const pack = metrics.pack.bytes === null
    ? `unavailable (${metrics.pack.reason})`
    : formatBytes(metrics.pack.bytes);

  return [
    `growth: git pack ${pack}`,
    `growth: images ${metrics.images.count} files, ${formatBytes(metrics.images.bytes)}`,
    metrics.dist.bytes === null
      ? 'growth: dist/ not built'
      : `growth: dist/ ${metrics.dist.files} files, ${formatBytes(metrics.dist.bytes)}`,
  ];
};

const main = () => {
  const metrics = collectGrowthMetrics();
  formatReport(metrics).forEach((line) => process.stdout.write(`${line}\n`));

  const crossed = evaluateThresholds(metrics);
  const inActions = Boolean(process.env.GITHUB_ACTIONS);

  for (const { id, label, limit, value, format, action } of crossed) {
    const message =
      `${id} crossed: ${label} is ${format(value)}, above ${format(limit)}. ` +
      `Next step: ${action}. See docs/architecture/adr/ADR-001-product-image-storage.md`;
    // GitHub renders ::warning:: as an annotation on the run.
    process.stdout.write(inActions ? `::warning::${message}\n` : `warning: ${message}\n`);
  }

  if (!crossed.length) process.stdout.write('growth: no thresholds crossed\n');
};

if (require.main === module) main();

module.exports = {
  THRESHOLDS,
  collectGrowthMetrics,
  evaluateThresholds,
  formatBytes,
  formatReport,
  measureDirectory,
};
