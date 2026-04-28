import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenTemporalEntropy } from '../src/sourcerowtokentemporalentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-28T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 1 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

// ---- Basic / shape ----

test('temporal-entropy: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenTemporalEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 8);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'norm-entropy-desc');
  assert.equal(r.generatedAt, GEN);
});

test('temporal-entropy: constant positive series -> normEntropy == 1 exactly', () => {
  const r = buildSourceRowTokenTemporalEntropy(
    series(new Array(20).fill(50)),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.normEntropy - 1) < 1e-12,
    `expected normEntropy == 1 for constant series, got ${row.normEntropy}`,
  );
  assert.equal(row.nonZeroRows, 20);
});

test('temporal-entropy: single-row spike -> normEntropy == 0 (one row carries all mass)', () => {
  const v = new Array(15).fill(0);
  v[7] = 5000;
  const r = buildSourceRowTokenTemporalEntropy(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(
    row.normEntropy < 1e-12,
    `expected normEntropy ~= 0 for single-row spike, got ${row.normEntropy}`,
  );
  assert.equal(row.nonZeroRows, 1);
});

test('temporal-entropy: normEntropy in [0, 1] always (Shannon bounds invariant)', () => {
  const cases = [
    [1, 2, 3, 4, 5, 4, 3, 2, 1],
    [10, 10, 10, 10, 10, 10, 10, 10, 10],
    [1, 50, 1, 1, 1, 1, 50, 1],
    [1000, 0, 0, 0, 0, 0, 0, 0, 0, 1000],
    [5, 5, 5, 100, 5, 5, 5, 5],
    [0, 0, 0, 1, 0, 0, 0, 0, 0],
  ];
  for (let k = 0; k < cases.length; k++) {
    const r = buildSourceRowTokenTemporalEntropy(series(cases[k]!, `s${k}`), {
      generatedAt: GEN,
    });
    if (r.sources.length === 1) {
      const ne = r.sources[0]!.normEntropy;
      assert.ok(ne >= -1e-12, `case ${k}: normEntropy < 0 (got ${ne})`);
      assert.ok(ne <= 1 + 1e-9, `case ${k}: normEntropy > 1 (got ${ne})`);
    }
  }
});

test('temporal-entropy: spike envelope -> normEntropy much smaller than uniform', () => {
  const v = new Array(15).fill(1);
  v[7] = 5000;
  const flat = new Array(15).fill(50);
  const r = buildSourceRowTokenTemporalEntropy(
    [...series(v, 'spike'), ...series(flat, 'flat')],
    { generatedAt: GEN },
  );
  const sp = r.sources.find((s) => s.source === 'spike')!;
  const fl = r.sources.find((s) => s.source === 'flat')!;
  assert.ok(
    sp.normEntropy < fl.normEntropy,
    `expected spike normEntropy (${sp.normEntropy}) < flat normEntropy (${fl.normEntropy})`,
  );
  assert.ok(
    Math.abs(fl.normEntropy - 1) < 1e-12,
    `expected flat normEntropy == 1, got ${fl.normEntropy}`,
  );
});

test('temporal-entropy: maxEntropy equals ln(N)', () => {
  const r = buildSourceRowTokenTemporalEntropy(
    series(new Array(12).fill(7)),
    { generatedAt: GEN },
  );
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.maxEntropy - Math.log(12)) < 1e-12,
    `expected maxEntropy = ln(12), got ${row.maxEntropy}`,
  );
});

test('temporal-entropy: entropyNats == ln(N) for uniform series', () => {
  const r = buildSourceRowTokenTemporalEntropy(
    series(new Array(16).fill(3)),
    { generatedAt: GEN },
  );
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.entropyNats - Math.log(16)) < 1e-12,
    `expected entropyNats == ln(16), got ${row.entropyNats}`,
  );
});

test('temporal-entropy: two-row equal split (rest zero) -> H == ln(2)', () => {
  // 10 rows: two rows with mass v, 8 rows zero.
  const v = new Array(10).fill(0);
  v[2] = 100;
  v[7] = 100;
  const r = buildSourceRowTokenTemporalEntropy(series(v), { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.entropyNats - Math.log(2)) < 1e-12,
    `expected H == ln(2), got ${row.entropyNats}`,
  );
  assert.equal(row.nonZeroRows, 2);
});

// ---- Invariants ----

test('temporal-entropy: amplitude-scale invariant (rescale by c > 0)', () => {
  const base = [3, 1, 7, 2, 5, 4, 6, 1, 8, 2];
  const a = buildSourceRowTokenTemporalEntropy(series(base, 'a'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenTemporalEntropy(
    series(
      base.map((v) => v * 100),
      'a',
    ),
    { generatedAt: GEN },
  );
  assert.ok(
    Math.abs(a.sources[0]!.normEntropy - b.sources[0]!.normEntropy) < 1e-12,
    `expected scale invariance: a=${a.sources[0]!.normEntropy} b=${b.sources[0]!.normEntropy}`,
  );
  assert.ok(
    Math.abs(a.sources[0]!.entropyNats - b.sources[0]!.entropyNats) < 1e-12,
  );
});

test('temporal-entropy: order invariant (permute rows)', () => {
  const base = [3, 1, 7, 2, 5, 4, 6, 1, 8, 2];
  const reversed = [...base].reverse();
  const a = buildSourceRowTokenTemporalEntropy(series(base, 'x'), {
    generatedAt: GEN,
  });
  const b = buildSourceRowTokenTemporalEntropy(series(reversed, 'x'), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(a.sources[0]!.normEntropy - b.sources[0]!.normEntropy) < 1e-12,
    `expected order invariance under reversal`,
  );
});

test('temporal-entropy: nonZeroRows correctly counts positive rows', () => {
  const v = [0, 5, 0, 3, 0, 0, 7, 0, 1, 0, 0, 4];
  const r = buildSourceRowTokenTemporalEntropy(series(v), { generatedAt: GEN });
  assert.equal(r.sources[0]!.nonZeroRows, 5);
});

test('temporal-entropy: totalAmp equals sum of total_tokens', () => {
  const v = [3, 1, 7, 2, 5, 4, 6, 1, 8, 2];
  const r = buildSourceRowTokenTemporalEntropy(series(v), { generatedAt: GEN });
  const expected = v.reduce((a, b) => a + b, 0);
  assert.equal(r.sources[0]!.totalAmp, expected);
});

// ---- Filtering: validity ----

test('temporal-entropy: drops bad hour_start', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5)),
    ql('not-a-date', 's2', 10),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('temporal-entropy: drops non-finite total_tokens', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5)),
    ql('2026-04-10T00:00:00Z', 's2', Number.NaN),
    ql('2026-04-10T01:00:00Z', 's2', Number.POSITIVE_INFINITY),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 2);
});

test('temporal-entropy: drops negative total_tokens separately', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5)),
    ql('2026-04-10T00:00:00Z', 's2', -1),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('temporal-entropy: source filter counts dropped non-matches', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'keep'),
    ...series(new Array(10).fill(5), 'drop'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 10);
});

test('temporal-entropy: missing source becomes "unknown"', () => {
  const rows: QueueLine[] = new Array(10).fill(0).map((_, i) =>
    ql(`2026-04-10T${i.toString().padStart(2, '0')}:00:00Z`, '', 5),
  );
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('temporal-entropy: window since/until applied', () => {
  const r = buildSourceRowTokenTemporalEntropy(
    series(new Array(20).fill(5)),
    { generatedAt: GEN, since: '2026-04-01T00:05:00Z', until: '2026-04-01T00:15:00Z' },
  );
  // 20 rows at minutes 0..19 -> [5,15) -> rows 5..14 = 10 rows
  assert.equal(r.totalRowsKept, 10);
});

// ---- Min-rows gate ----

test('temporal-entropy: drops sources below min-rows', () => {
  const rows: QueueLine[] = [
    ...series(new Array(8).fill(5), 'big'),
    ...series(new Array(3).fill(5), 'small'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('temporal-entropy: minRows must be integer >= 4', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { minRows: 3 }),
    /minRows must be an integer >= 4/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { minRows: 4.5 }),
    /minRows must be an integer >= 4/,
  );
});

test('temporal-entropy: zero-series counted under droppedZeroSeries', () => {
  const rows = series(new Array(10).fill(0));
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroSeries, 1);
});

// ---- Sort modes ----

test('temporal-entropy: default sort norm-entropy-desc puts uniform first', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'flat'),
    ...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'flat');
  assert.equal(r.sources[1]!.source, 'spike');
});

test('temporal-entropy: norm-entropy-asc puts spike first', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'flat'),
    ...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    sort: 'norm-entropy-asc',
  });
  assert.equal(r.sources[0]!.source, 'spike');
});

test('temporal-entropy: dist-uniform-asc puts closest-to-1 first', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'flat'),
    ...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'),
    ...series([10, 9, 11, 10, 9, 11, 10, 9, 11, 10], 'near'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    sort: 'dist-uniform-asc',
  });
  assert.equal(r.sources[0]!.source, 'flat');
});

test('temporal-entropy: dist-uniform-desc puts farthest-from-1 first', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'flat'),
    ...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    sort: 'dist-uniform-desc',
  });
  assert.equal(r.sources[0]!.source, 'spike');
});

test('temporal-entropy: sort by rows desc', () => {
  const rows: QueueLine[] = [
    ...series(new Array(20).fill(5), 'big'),
    ...series(new Array(10).fill(5), 'small'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('temporal-entropy: sort by source asc', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'zeta'),
    ...series(new Array(10).fill(5), 'alpha'),
    ...series(new Array(10).fill(5), 'mu'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('temporal-entropy: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { sort: 'nope' as any }),
    /sort must be one of/,
  );
});

// ---- Top cap ----

test('temporal-entropy: top cap limits returned rows and sets droppedBelowTopCap', () => {
  const rows: QueueLine[] = [];
  for (let k = 0; k < 5; k++) {
    rows.push(...series(new Array(10).fill(k + 1), `s${k}`));
  }
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 3);
});

test('temporal-entropy: top must be positive integer', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { top: 0 }),
    /top must be a positive integer/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { top: 1.5 }),
    /top must be a positive integer/,
  );
});

// ---- Min/Max norm-entropy band ----

test('temporal-entropy: minNormEntropy filters out below threshold', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'flat'),
    ...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    minNormEntropy: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'flat');
  assert.equal(r.droppedBelowMinNormEntropy, 1);
});

test('temporal-entropy: maxNormEntropy filters out above threshold', () => {
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'flat'),
    ...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, {
    generatedAt: GEN,
    maxNormEntropy: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'spike');
  assert.equal(r.droppedAboveMaxNormEntropy, 1);
});

test('temporal-entropy: minNormEntropy out of [0, 1] throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { minNormEntropy: -0.1 }),
    /minNormEntropy must be in \[0, 1\]/,
  );
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { minNormEntropy: 1.5 }),
    /minNormEntropy must be in \[0, 1\]/,
  );
});

test('temporal-entropy: maxNormEntropy out of [0, 1] throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { maxNormEntropy: -0.1 }),
    /maxNormEntropy must be in \[0, 1\]/,
  );
});

test('temporal-entropy: min > max throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenTemporalEntropy([], {
        minNormEntropy: 0.7,
        maxNormEntropy: 0.3,
      }),
    /minNormEntropy.*must be <= maxNormEntropy/,
  );
});

// ---- Window validation ----

test('temporal-entropy: invalid since throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { since: 'garbage' }),
    /invalid since/,
  );
});

test('temporal-entropy: invalid until throws', () => {
  assert.throws(
    () => buildSourceRowTokenTemporalEntropy([], { until: 'garbage' }),
    /invalid until/,
  );
});

// ---- Determinism / report shape ----

test('temporal-entropy: generatedAt override is honored', () => {
  const r = buildSourceRowTokenTemporalEntropy([], { generatedAt: GEN });
  assert.equal(r.generatedAt, GEN);
});

test('temporal-entropy: tiebreak by source asc', () => {
  // Two sources with identical normEntropy (both uniform).
  const rows: QueueLine[] = [
    ...series(new Array(10).fill(5), 'beta'),
    ...series(new Array(10).fill(5), 'alpha'),
  ];
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'beta');
});

test('temporal-entropy: report exposes window/source/sort/min-max in echo', () => {
  const r = buildSourceRowTokenTemporalEntropy([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-30T00:00:00Z',
    source: 'x',
    sort: 'norm-entropy-asc',
    minNormEntropy: 0.1,
    maxNormEntropy: 0.9,
    minRows: 5,
    top: 7,
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00Z');
  assert.equal(r.source, 'x');
  assert.equal(r.sort, 'norm-entropy-asc');
  assert.equal(r.minNormEntropy, 0.1);
  assert.equal(r.maxNormEntropy, 0.9);
  assert.equal(r.minRows, 5);
  assert.equal(r.top, 7);
});

// ---- Cross-check theoretical formula ----

test('temporal-entropy: explicit Shannon formula matches builder output', () => {
  const v = [3, 1, 7, 2, 5];
  const padded = [...v, 0, 0, 0, 0, 0]; // pad to 10 to clear minRows
  const r = buildSourceRowTokenTemporalEntropy(series(padded), {
    generatedAt: GEN,
  });
  const total = padded.reduce((a, b) => a + b, 0);
  let expectedH = 0;
  for (const x of padded) {
    if (x > 0) {
      const p = x / total;
      expectedH -= p * Math.log(p);
    }
  }
  const row = r.sources[0]!;
  assert.ok(
    Math.abs(row.entropyNats - expectedH) < 1e-12,
    `expected H=${expectedH}, got ${row.entropyNats}`,
  );
  assert.ok(
    Math.abs(row.normEntropy - expectedH / Math.log(padded.length)) < 1e-12,
  );
});

test('temporal-entropy: H >= 0 and H <= ln(N) holds across many random series', () => {
  // Deterministic pseudo-random
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let trial = 0; trial < 20; trial++) {
    const len = 10 + Math.floor(rand() * 30);
    const vals = new Array(len).fill(0).map(() => Math.floor(rand() * 100));
    if (vals.reduce((a, b) => a + b, 0) === 0) continue;
    const r = buildSourceRowTokenTemporalEntropy(series(vals, `t${trial}`), {
      generatedAt: GEN,
    });
    if (r.sources.length === 1) {
      const row = r.sources[0]!;
      assert.ok(row.entropyNats >= -1e-12, `H >= 0 (got ${row.entropyNats})`);
      assert.ok(
        row.entropyNats <= Math.log(len) + 1e-9,
        `H <= ln(N) (got ${row.entropyNats}, ln(${len})=${Math.log(len)})`,
      );
    }
  }
});

// ---- Integration: many sources, mixed ----

test('temporal-entropy: handles many sources with mixed shapes', () => {
  const rows: QueueLine[] = [];
  rows.push(...series(new Array(12).fill(5), 'uniform'));
  rows.push(...series([100, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 'spike'));
  rows.push(...series([10, 20, 10, 20, 10, 20, 10, 20, 10, 20, 10, 20], 'two-level'));
  rows.push(...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'ramp'));
  const r = buildSourceRowTokenTemporalEntropy(rows, { generatedAt: GEN });
  assert.equal(r.sources.length, 4);
  // uniform should top norm-entropy-desc
  assert.equal(r.sources[0]!.source, 'uniform');
  // spike should be at the bottom
  assert.equal(r.sources[r.sources.length - 1]!.source, 'spike');
});
