const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  THRESHOLDS,
  collectGrowthMetrics,
  evaluateThresholds,
  formatBytes,
  formatReport,
  measureDirectory,
} = require('../../tools/report-growth');

const MB = 1024 * 1024;

const thresholdById = (id) => THRESHOLDS.find((threshold) => threshold.id === id);

// A metrics object shaped like collectGrowthMetrics output, with everything
// comfortably under its threshold unless a test overrides it.
const metrics = (overrides = {}) => ({
  pack: { bytes: 22 * MB, shallow: false, reason: null },
  images: { count: 266, bytes: 21 * MB },
  dist: { bytes: 37 * MB, files: 1096 },
  ...overrides,
});

let tempRoot;

beforeAll(() => {
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ma-imports-growth-'));
});

afterAll(() => {
  fs.rmSync(tempRoot, { recursive: true, force: true });
});

describe('measureDirectory', () => {
  it('sums file sizes recursively', () => {
    const dir = fs.mkdtempSync(path.join(tempRoot, 'tree-'));
    fs.mkdirSync(path.join(dir, 'nested'));
    fs.writeFileSync(path.join(dir, 'a.txt'), 'x'.repeat(100));
    fs.writeFileSync(path.join(dir, 'nested', 'b.txt'), 'y'.repeat(200));

    expect(measureDirectory(dir)).toEqual({ bytes: 300, files: 2 });
  });

  it('returns null for a directory that does not exist', () => {
    expect(measureDirectory(path.join(tempRoot, 'absent'))).toBeNull();
  });
});

describe('Threshold evaluation', () => {
  it('reports nothing at the current scale', () => {
    expect(evaluateThresholds(metrics())).toEqual([]);
  });

  it.each([
    ['T1', { pack: { bytes: 101 * MB, shallow: false, reason: null } }],
    ['T3', { images: { count: 1001, bytes: 90 * MB } }],
    ['T5', { dist: { bytes: 501 * MB, files: 5000 } }],
  ])('flags %s once its signal is exceeded', (id, override) => {
    const crossed = evaluateThresholds(metrics(override));
    expect(crossed.map((entry) => entry.id)).toEqual([id]);
  });

  it('does not flag a threshold sitting exactly on its limit', () => {
    const onLimit = metrics({ images: { count: thresholdById('T3').limit, bytes: 90 * MB } });
    expect(evaluateThresholds(onLimit)).toEqual([]);
  });

  it('flags every crossed threshold in one pass', () => {
    const crossed = evaluateThresholds(
      metrics({
        pack: { bytes: 300 * MB, shallow: false, reason: null },
        images: { count: 2500, bytes: 200 * MB },
        dist: { bytes: 600 * MB, files: 9000 },
      })
    );
    expect(crossed.map((entry) => entry.id)).toEqual(['T1', 'T3', 'T5']);
  });

  // An unavailable signal must not read as a passing one. actions/checkout
  // clones shallow by default, so pack size is genuinely unknown in CI.
  it('skips a threshold whose metric is unavailable rather than passing it', () => {
    const shallow = metrics({
      pack: { bytes: null, shallow: true, reason: 'shallow clone, so the pack is not representative' },
    });
    expect(evaluateThresholds(shallow)).toEqual([]);
    expect(formatReport(shallow)[0]).toMatch(/git pack unavailable \(shallow clone/);
  });

  it('keeps the documented threshold values', () => {
    expect(thresholdById('T1').limit).toBe(100 * MB);
    expect(thresholdById('T3').limit).toBe(1000);
    expect(thresholdById('T5').limit).toBe(500 * MB);
  });
});

describe('Reporting', () => {
  it('formats bytes in MB above a megabyte and KB below', () => {
    expect(formatBytes(22 * MB)).toBe('22.0 MB');
    expect(formatBytes(512 * 1024)).toBe('512 KB');
    expect(formatBytes(null)).toBe('unavailable');
  });

  it('notes an unbuilt dist/ instead of reporting zero', () => {
    expect(formatReport(metrics({ dist: { bytes: null, files: null } }))[2])
      .toBe('growth: dist/ not built');
  });
});

describe('The real repository', () => {
  it('measures itself without crossing a threshold', () => {
    const observed = collectGrowthMetrics();
    expect(observed.images.count).toBeGreaterThan(0);
    expect(evaluateThresholds(observed)).toEqual([]);
  });
});
