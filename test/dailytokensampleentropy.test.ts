import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenSampleEntropy,
  sampleEntropy,
  DEFAULT_SAMPEN_M,
  DEFAULT_SAMPEN_R_FACTOR,
} from '../src/dailytokensampleentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-02T12:00:00.000Z';

function dayN(start: string, offsetDays: number): string {
  const ms = Date.parse(`${start}T00:00:00.000Z`);
  return new Date(ms + offsetDays * 86_400_000).toISOString().slice(0, 10);
}

// ---- sampleEntropy primitive ------------------------------------------

test('sampleEntropy: defaults exposed', () => {
  assert.equal(DEFAULT_SAMPEN_M, 2);
  assert.equal(DEFAULT_SAMPEN_R_FACTOR, 0.2);
});

test('sampleEntropy: rejects bad inputs', () => {
  assert.throws(() => sampleEntropy([1, 2, 3], { m: 0 }), /m must be/);
  assert.throws(() => sampleEntropy([1, 2, 3], { rFactor: 0 }), /rFactor/);
  assert.throws(() => sampleEntropy([1, NaN, 3]), /finite values/);
  assert.throws(() => sampleEntropy([1, 2, 3], { m: 2 }), /too short/);
});

test('sampleEntropy: zero variance throws', () => {
  assert.throws(() => sampleEntropy([5, 5, 5, 5, 5, 5]), /zero variance/);
});

test('sampleEntropy: constant-with-one-spike series produces a finite SampEn or surfaces a guarded zero-A throw', () => {
  // Hand-checked deterministic fixture: a near-flat series with
  // one outlier. The Chebyshev-distance counts are easy to enumerate.
  const series = [1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 1];
  const r = sampleEntropy(series, { m: 2, rFactor: 0.5 });
  assert.ok(Number.isFinite(r.sampEn));
  assert.ok(r.matchesB > 0);
  assert.ok(r.matchesAplusone > 0);
  assert.ok(r.rAbsolute > 0);
});

test('sampleEntropy: pure sinusoid (period 6, amplitude 10) -> very low SampEn', () => {
  // Periodic series: every length-m match should also extend.
  const N = 60;
  const series: number[] = [];
  for (let i = 0; i < N; i += 1) {
    series.push(10 * Math.sin((2 * Math.PI * i) / 6));
  }
  const r = sampleEntropy(series, { m: 2, rFactor: 0.2 });
  // Periodic + dense matches => SampEn should be very small (<<1).
  assert.ok(
    r.sampEn < 0.5,
    `expected periodic SampEn < 0.5, got ${r.sampEn}`,
  );
});

test('sampleEntropy: orthogonality witness — sorted vs shuffled multiset gives different SampEn', () => {
  // Same multiset: a sorted ramp vs a deterministic shuffle.
  const sorted: number[] = [];
  for (let i = 0; i < 80; i += 1) sorted.push(i);
  // Deterministic LCG shuffle so test is reproducible.
  const shuffled = sorted.slice();
  let s = 12345;
  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const sortedR = sampleEntropy(sorted, { m: 2, rFactor: 0.2 });
  const shuffledR = sampleEntropy(shuffled, { m: 2, rFactor: 0.2 });
  // Shuffled IID-uniform-like => high SampEn; sorted ramp => low
  // (consecutive triples are tightly clustered).
  assert.ok(
    sortedR.sampEn < shuffledR.sampEn,
    `sorted (${sortedR.sampEn}) should have SampEn < shuffled (${shuffledR.sampEn})`,
  );
});

test('sampleEntropy: deterministic small fixture - byhand counts', () => {
  // Hand-computed fixture: x = [0, 1, 0, 1, 0, 1, 0]
  // mean = 3/7, var = 0.244898, sd ~= 0.494872, r = 0.2 * sd ~= 0.099
  // length-2 templates (N-m=5): (0,1),(1,0),(0,1),(1,0),(0,1)
  // Pairs i<j with all coords within r ~= 0.099:
  //   (0,1)<->(0,1): three identical templates at i=0,2,4 -> C(3,2)=3
  //   (1,0)<->(1,0): two identical at i=1,3 -> C(2,2)=1
  //   cross-types differ by 1 in some coord, > r => no match.
  // So B = 3 + 1 = 4.
  // length-3 templates: (0,1,0),(1,0,1),(0,1,0),(1,0,1),(0,1,0)
  //   (0,1,0) at i=0,2,4 -> C(3,2)=3 ; (1,0,1) at i=1,3 -> C(2,2)=1
  //   B(m+1) = 4. So A = 4, B = 4, SampEn = -ln(1) = 0 (or -0).
  const x = [0, 1, 0, 1, 0, 1, 0];
  const r = sampleEntropy(x, { m: 2, rFactor: 0.2 });
  assert.equal(r.matchesB, 4);
  assert.equal(r.matchesAplusone, 4);
  assert.equal(Math.abs(r.sampEn), 0);
});

// ---- buildDailyTokenSampleEntropy -------------------------------------

test('buildDailyTokenSampleEntropy: validates option ranges', () => {
  assert.throws(
    () => buildDailyTokenSampleEntropy([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(() => buildDailyTokenSampleEntropy([], { m: 0 }), /m must/);
  assert.throws(
    () => buildDailyTokenSampleEntropy([], { rFactor: 0 }),
    /rFactor/,
  );
  assert.throws(
    () => buildDailyTokenSampleEntropy([], { minTenureDays: 4 }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenSampleEntropy([], { sort: 'bogus' as never }),
    /sort/,
  );
  assert.throws(
    () => buildDailyTokenSampleEntropy([], { top: -1 }),
    /top must/,
  );
});

test('buildDailyTokenSampleEntropy: empty queue -> empty report', () => {
  const r = buildDailyTokenSampleEntropy([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
});

test('buildDailyTokenSampleEntropy: drops bad rows + source filter', () => {
  const rows: QueueLine[] = [
    { ...ql('not-a-date', 'a', 100) },
    ql('2026-01-01T00:00:00Z', 'a', 0),
    ql('2026-01-01T00:00:00Z', 'a', 100),
    ql('2026-01-01T00:00:00Z', 'b', 100),
  ];
  const r = buildDailyTokenSampleEntropy(rows, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.droppedSourceFilter, 1);
});

test('buildDailyTokenSampleEntropy: drops sparse + short-tenure sources', () => {
  const rows: QueueLine[] = [
    ql('2026-01-01T00:00:00Z', 'sparse', 50), // below minTokens
    // short tenure: only 5 days
    ql('2026-01-01T00:00:00Z', 'short', 2000),
    ql('2026-01-05T00:00:00Z', 'short', 3000),
  ];
  const r = buildDailyTokenSampleEntropy(rows, { generatedAt: GEN });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenSampleEntropy: end-to-end on a synthetic alternating source', () => {
  // 40-day source alternating large/small token counts -> should
  // produce a finite SampEn.
  const rows: QueueLine[] = [];
  for (let d = 0; d < 40; d += 1) {
    const day = dayN('2026-02-01', d);
    rows.push(ql(`${day}T00:00:00Z`, 'alt', d % 2 === 0 ? 5000 : 1000));
  }
  const r = buildDailyTokenSampleEntropy(rows, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'alt');
  assert.equal(row.nTenureDays, 40);
  assert.ok(Number.isFinite(row.sampEn));
  assert.ok(row.matchesB > 0);
  assert.ok(row.matchesAplusone > 0);
  assert.ok(row.stddev > 0);
});

test('buildDailyTokenSampleEntropy: gap-fill across missing days', () => {
  // 32-day window, but only 2 data days at the boundaries.
  const rows: QueueLine[] = [
    ql('2026-03-01T00:00:00Z', 'gap', 5000),
    ql('2026-04-01T00:00:00Z', 'gap', 5000),
  ];
  const r = buildDailyTokenSampleEntropy(rows, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  // 32 days inclusive -> just at minTenureDays. SampEn should
  // be computable because the two non-zero days produce non-zero
  // variance and B>0 from the long zero stretch.
  assert.equal(r.sources.length + r.droppedZeroBMatches + r.droppedZeroAMatches, 1);
});

test('buildDailyTokenSampleEntropy: top cap', () => {
  const rows: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 40; d += 1) {
      const day = dayN('2026-02-01', d);
      rows.push(ql(`${day}T00:00:00Z`, src, 1000 + d * (src.charCodeAt(0) - 96) * 10));
    }
  }
  const r = buildDailyTokenSampleEntropy(rows, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenSampleEntropy: respects --since/--until window', () => {
  const rows: QueueLine[] = [];
  for (let d = 0; d < 60; d += 1) {
    const day = dayN('2026-02-01', d);
    if (Date.parse(day) < Date.parse('2026-04-01')) {
      rows.push(ql(`${day}T00:00:00Z`, 'win', 2000 + d * 50));
    }
  }
  const r = buildDailyTokenSampleEntropy(rows, {
    generatedAt: GEN,
    since: '2026-02-15T00:00:00Z',
    until: '2026-03-31T00:00:00Z',
  });
  assert.equal(r.windowStart, '2026-02-15T00:00:00Z');
  assert.equal(r.windowEnd, '2026-03-31T00:00:00Z');
});

test('buildDailyTokenSampleEntropy: JSON report carries every documented field', () => {
  const rows: QueueLine[] = [];
  for (let d = 0; d < 35; d += 1) {
    const day = dayN('2026-02-01', d);
    rows.push(ql(`${day}T00:00:00Z`, 'js', 1500 + d * 20));
  }
  const r = buildDailyTokenSampleEntropy(rows, { generatedAt: GEN });
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'minTokens',
    'minTenureDays',
    'm',
    'rFactor',
    'top',
    'sort',
    'source',
    'totalTokens',
    'totalSources',
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedSparseSources',
    'droppedBelowMinTenure',
    'droppedZeroVariance',
    'droppedZeroBMatches',
    'droppedZeroAMatches',
    'droppedTopSources',
    'sources',
  ]) {
    assert.ok(k in r, `missing key: ${k}`);
  }
  if (r.sources.length > 0) {
    const s = r.sources[0]!;
    for (const k of [
      'source',
      'totalTokens',
      'nActiveDays',
      'nTenureDays',
      'firstActiveDay',
      'lastActiveDay',
      'sampEn',
      'stddev',
      'rAbsolute',
      'matchesAplusone',
      'matchesB',
    ]) {
      assert.ok(k in s, `missing source key: ${k}`);
    }
  }
});

test('sampleEntropy: m=1 works and uses N-1 templates', () => {
  // m=1, simple 6-point series, r large enough so all match.
  const x = [1, 2, 3, 4, 5, 6];
  const r = sampleEntropy(x, { m: 1, rFactor: 5 });
  // N-m = 5 templates, C(5,2) = 10 unique pairs.
  // r = 5 * stddev ~ 5 * 1.708 = 8.54, so all length-1 pairs match.
  // Length-2 pairs: max(|x[i]-x[j]|, |x[i+1]-x[j+1]|) <= 8.54 — all
  // pairs of consecutive-indexed templates have differences <= 5,
  // so all 10 pairs match at length 2 as well -> A=B=10, SampEn=0.
  assert.equal(r.matchesB, 10);
  assert.equal(r.matchesAplusone, 10);
  assert.equal(Math.abs(r.sampEn), 0);
});

test('sampleEntropy: tighter rFactor on a noisy series can drop matches and surface a guarded throw', () => {
  // All distinct values, so a very tight r relative to stddev forces
  // either B=0 or A=0 -> the API contract is a guarded throw the
  // caller routes to droppedZeroBMatches / droppedZeroAMatches at
  // the source level.
  const x = [0, 100, 5, 95, 10, 90, 15, 85, 20, 80, 25];
  assert.throws(
    () => sampleEntropy(x, { m: 2, rFactor: 0.001 }),
    /B=0|A=0/,
  );
});
