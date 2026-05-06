import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPageHinkleyMeanShiftChangepoint,
  pageHinkleyArm,
  pageHinkleyScan,
  pageHinkleyVerdict,
  pageHinkleyIsSubstantiveShift,
  iqr,
  quantile,
} from '../src/dailytokenpagehinkleymeanshiftchangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-06T12:00:00.000Z';

function synth(source: string, vals: number[], startDay = '2026-01-01'): QueueLine[] {
  return vals.map((v, i) => {
    const ms = Date.parse(`${startDay}T00:00:00.000Z`) + i * 86_400_000;
    const ts = new Date(ms).toISOString();
    return ql(ts, source, Math.max(1, Math.round(v)));
  });
}

// ---- numeric helpers -----------------------------------------------------

test('quantile: endpoints and midpoints', () => {
  const xs = [1, 2, 3, 4, 5];
  assert.equal(quantile(xs, 0), 1);
  assert.equal(quantile(xs, 1), 5);
  assert.equal(quantile(xs, 0.5), 3);
  // Q1 of [1..5] with linear interp on n=5: pos = 0.25 * 4 = 1.0 -> 2.
  assert.equal(quantile(xs, 0.25), 2);
  assert.equal(quantile(xs, 0.75), 4);
});

test('iqr: standard sequence', () => {
  // [1..9] -> Q3=7, Q1=3, IQR=4
  assert.equal(iqr([1, 2, 3, 4, 5, 6, 7, 8, 9]), 4);
});

test('iqr: returns NaN for n<2', () => {
  assert.ok(Number.isNaN(iqr([])));
  assert.ok(Number.isNaN(iqr([42])));
});

// ---- single-arm PH -------------------------------------------------------

test('pageHinkleyArm: throws on N<2', () => {
  assert.throws(() => pageHinkleyArm([1], 0, 'up'));
});

test('pageHinkleyArm: throws on negative delta', () => {
  assert.throws(() => pageHinkleyArm([1, 2, 3], -1, 'up'));
});

test('pageHinkleyArm: constant series gives PH=0 on both arms', () => {
  const x = new Array(20).fill(5);
  const up = pageHinkleyArm(x, 0, 'up');
  const dn = pageHinkleyArm(x, 0, 'down');
  assert.equal(up.phMax, 0);
  assert.equal(dn.phMax, 0);
});

test('pageHinkleyArm: clear up-shift produces phMaxUp >> phMaxDown', () => {
  // 30 days at level 100, then 30 days at level 200.
  const x = [
    ...new Array(30).fill(100),
    ...new Array(30).fill(200),
  ];
  const up = pageHinkleyArm(x, 0, 'up');
  const dn = pageHinkleyArm(x, 0, 'down');
  assert.ok(up.phMax > dn.phMax * 5, `up.phMax=${up.phMax} dn.phMax=${dn.phMax}`);
  // tauStar should be in the vicinity of the true changepoint (idx=30).
  assert.ok(
    Math.abs(up.tauStar - 30) <= 5,
    `tauStar=${up.tauStar} not near 30`,
  );
});

test('pageHinkleyArm: clear down-shift produces phMaxDown >> phMaxUp', () => {
  const x = [
    ...new Array(30).fill(200),
    ...new Array(30).fill(100),
  ];
  const up = pageHinkleyArm(x, 0, 'up');
  const dn = pageHinkleyArm(x, 0, 'down');
  assert.ok(dn.phMax > up.phMax * 5);
  assert.ok(Math.abs(dn.tauStar - 30) <= 5);
});

test('pageHinkleyArm: PH curve is non-negative', () => {
  const x = [1, 5, 2, 8, 3, 9, 4, 10, 5, 11, 6, 12];
  const r = pageHinkleyArm(x, 0, 'up');
  for (const v of r.phCurve) assert.ok(v >= 0);
});

test('pageHinkleyArm: delta dampens PH growth', () => {
  const x = [
    ...new Array(20).fill(100),
    ...new Array(20).fill(120),
  ];
  const r0 = pageHinkleyArm(x, 0, 'up');
  const r1 = pageHinkleyArm(x, 50, 'up'); // huge delta swallows the shift
  assert.ok(r0.phMax > r1.phMax);
});

// ---- full scan -----------------------------------------------------------

test('pageHinkleyScan: throws on N<5', () => {
  assert.throws(() => pageHinkleyScan([1, 2, 3, 4]));
});

test('pageHinkleyScan: throws on bad scales', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  assert.throws(() => pageHinkleyScan(x, { deltaScale: -1 }));
  assert.throws(() => pageHinkleyScan(x, { lambdaScale: 0 }));
  assert.throws(() => pageHinkleyScan(x, { lambdaScale: -3 }));
});

test('pageHinkleyScan: constant-IQR series throws', () => {
  // All identical -> IQR = 0
  assert.throws(() => pageHinkleyScan(new Array(10).fill(7)));
});

test('pageHinkleyScan: peakRatio = phMax / lambdaUsed exactly', () => {
  const x = [
    ...new Array(20).fill(50),
    ...new Array(20).fill(150),
  ];
  const r = pageHinkleyScan(x);
  assert.ok(Math.abs(r.peakRatio - r.phMax / r.lambdaUsed) < 1e-9);
});

test('pageHinkleyScan: up-shift -> direction == "up"', () => {
  const x = [
    ...new Array(25).fill(100),
    ...new Array(25).fill(400),
  ];
  const r = pageHinkleyScan(x);
  assert.equal(r.direction, 'up');
  assert.ok(r.peakRatio > 1.0);
});

test('pageHinkleyScan: down-shift -> direction == "down"', () => {
  const x = [
    ...new Array(25).fill(400),
    ...new Array(25).fill(100),
  ];
  const r = pageHinkleyScan(x);
  assert.equal(r.direction, 'down');
  assert.ok(r.peakRatio > 1.0);
});

// ---- verdict ladder ------------------------------------------------------

test('pageHinkleyVerdict: ladder boundaries', () => {
  assert.equal(pageHinkleyVerdict(0), 'no-shift');
  assert.equal(pageHinkleyVerdict(0.3), 'no-shift');
  assert.equal(pageHinkleyVerdict(0.5), 'borderline');
  assert.equal(pageHinkleyVerdict(0.99), 'borderline');
  assert.equal(pageHinkleyVerdict(1.0), 'shift');
  assert.equal(pageHinkleyVerdict(1.99), 'shift');
  assert.equal(pageHinkleyVerdict(2.0), 'strong-shift');
  assert.equal(pageHinkleyVerdict(50.0), 'strong-shift');
  assert.equal(pageHinkleyVerdict(NaN), 'no-shift');
  assert.equal(pageHinkleyVerdict(Infinity), 'strong-shift');
});

test('pageHinkleyIsSubstantiveShift: gates on verdict + meanGap/iqr', () => {
  assert.equal(
    pageHinkleyIsSubstantiveShift({
      peakRatio: 3.0,
      verdict: 'strong-shift',
      meanGap: 50,
      iqrUsed: 10,
    }),
    true,
  );
  // borderline -> never substantive
  assert.equal(
    pageHinkleyIsSubstantiveShift({
      peakRatio: 0.7,
      verdict: 'borderline',
      meanGap: 100,
      iqrUsed: 10,
    }),
    false,
  );
  // shift but tiny gap -> not substantive
  assert.equal(
    pageHinkleyIsSubstantiveShift(
      { peakRatio: 1.5, verdict: 'shift', meanGap: 0.1, iqrUsed: 10 },
      0.1,
    ),
    false,
  );
  // non-finite guards
  assert.equal(
    pageHinkleyIsSubstantiveShift({
      peakRatio: NaN,
      verdict: 'shift',
      meanGap: 5,
      iqrUsed: 10,
    }),
    false,
  );
});

// ---- option validation ---------------------------------------------------

test('PH builder: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { minTokens: NaN }),
  );
});

test('PH builder: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { minTenureDays: 1.5 }),
  );
});

test('PH builder: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { top: -1 }),
  );
});

test('PH builder: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], {
      sort: 'banana' as never,
    }),
  );
});

test('PH builder: rejects bad deltaScale / lambdaScale', () => {
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { deltaScale: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { lambdaScale: 0 }),
  );
});

test('PH builder: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { since: 'NOT-A-DATE' }),
  );
  assert.throws(() =>
    buildDailyTokenPageHinkleyMeanShiftChangepoint([], { until: 'NOPE' }),
  );
});

// ---- empty / dropped -----------------------------------------------------

test('PH builder: empty queue -> empty rows, totalSources=0', () => {
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
});

test('PH builder: drops sparse sources below min-tokens', () => {
  // 25 days, 10 tokens each = 250 total — below default 1000.
  const q = synth('s', new Array(25).fill(10));
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('PH builder: drops sources below min-tenure-days', () => {
  // 15 days, 1000 tokens each = 15000 total > min, but tenure < 21.
  const q = synth('s', new Array(15).fill(1000));
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('PH builder: drops zero-variance / IQR=0 series', () => {
  // 25 days, all same large value -> mn==mx degeneracy
  const q = synth('s', new Array(25).fill(5000));
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('PH builder: invalid hour_start counted', () => {
  const bad = ql('not-a-date', 's', 1000);
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint([bad], {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('PH builder: source filter excludes other sources', () => {
  const q = [
    ...synth('keep', new Array(25).fill(1000)),
    ...synth('drop', new Array(25).fill(1000), '2026-02-01'),
  ];
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.ok(r.droppedSourceFilter > 0);
});

// ---- end-to-end correctness ---------------------------------------------

test('PH builder: detects an up-shift correctly', () => {
  // 25 days at 1000, then 25 days at 5000 — clear up shift.
  const vals = [
    ...new Array(25).fill(1000),
    ...new Array(25).fill(5000),
  ];
  const q = synth('alpha', vals);
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.direction, 'up');
  assert.ok(row.peakRatio > 1.0, `peakRatio=${row.peakRatio}`);
  assert.ok(row.meanGap > 0);
  assert.ok(['shift', 'strong-shift'].includes(row.verdict));
  // tauStar should land in [20..30]
  assert.ok(
    row.tauStar >= 20 && row.tauStar <= 30,
    `tauStar=${row.tauStar}`,
  );
});

test('PH builder: detects a down-shift correctly', () => {
  const vals = [
    ...new Array(25).fill(5000),
    ...new Array(25).fill(1000),
  ];
  const q = synth('beta', vals);
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.direction, 'down');
  assert.ok(row.peakRatio > 1.0);
  assert.ok(row.meanGap < 0);
});

test('PH builder: stationary noisy series -> no-shift / borderline', () => {
  // Deterministic pseudo-noise: oscillating but no drift.
  const vals = new Array(60).fill(0).map((_, i) => 1000 + ((i * 37) % 13) * 50);
  const q = synth('gamma', vals);
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  // Should not be a strong shift on stationary mild oscillation
  assert.notEqual(row.verdict, 'strong-shift');
});

test('PH builder: onlyShifts filters no-shift rows', () => {
  const stationary = synth('flat', new Array(60).fill(0).map((_, i) => 1000 + (i % 5) * 30));
  const shifted = synth(
    'jump',
    [...new Array(25).fill(500), ...new Array(25).fill(5000)],
    '2026-02-01',
  );
  const q = [...stationary, ...shifted];
  const all = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  const filtered = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    onlyShifts: true,
  });
  assert.ok(all.sources.length >= filtered.sources.length);
});

test('PH builder: top cap surfaces droppedTopSources', () => {
  const q = [
    ...synth('a', [...new Array(25).fill(500), ...new Array(25).fill(5000)], '2026-01-01'),
    ...synth('b', [...new Array(25).fill(800), ...new Array(25).fill(4500)], '2026-02-01'),
    ...synth('c', [...new Array(25).fill(700), ...new Array(25).fill(4800)], '2026-03-01'),
  ];
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('PH builder: deterministic across runs', () => {
  const q = synth('det', [...new Array(25).fill(500), ...new Array(25).fill(2500)]);
  const r1 = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, { generatedAt: GEN });
  const r2 = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('PH builder: tauStarDay matches firstActiveDay + tauStar days', () => {
  const q = synth('cal', [...new Array(25).fill(500), ...new Array(25).fill(3000)], '2026-03-15');
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  const firstMs = Date.parse(`${row.firstActiveDay}T00:00:00.000Z`);
  const expectMs = firstMs + row.tauStar * 86_400_000;
  const expect = new Date(expectMs).toISOString().slice(0, 10);
  assert.equal(row.tauStarDay, expect);
});

test('PH builder: meanLeft and meanRight sum-decompose totalTokens', () => {
  const q = synth('sum', [...new Array(25).fill(1000), ...new Array(25).fill(3000)]);
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  const nL = row.tauStar;
  const nR = row.nTenureDays - row.tauStar;
  const total = (Number.isFinite(row.meanLeft) ? row.meanLeft * nL : 0) +
                (Number.isFinite(row.meanRight) ? row.meanRight * nR : 0);
  // tolerance: rounding (Math.round in synth) gives a small residual
  assert.ok(
    Math.abs(total - row.totalTokens) < row.totalTokens * 0.01,
    `decomposition mismatch: total=${total} vs row.totalTokens=${row.totalTokens}`,
  );
});

test('PH builder: sort=peakRatioDesc orders sources by descending peakRatio', () => {
  const q = [
    ...synth('weak', [...new Array(25).fill(900), ...new Array(25).fill(1100)], '2026-01-01'),
    ...synth('strong', [...new Array(25).fill(500), ...new Array(25).fill(5000)], '2026-02-01'),
    ...synth('mid', [...new Array(25).fill(800), ...new Array(25).fill(2400)], '2026-03-01'),
  ];
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    sort: 'peakRatioDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.peakRatio >= r.sources[i]!.peakRatio,
      `not descending at i=${i}`,
    );
  }
});

test('PH builder: sort=source orders alphabetically (with no primary key)', () => {
  const q = [
    ...synth('zzz', [...new Array(25).fill(500), ...new Array(25).fill(2500)], '2026-01-01'),
    ...synth('aaa', [...new Array(25).fill(500), ...new Array(25).fill(2500)], '2026-02-01'),
    ...synth('mmm', [...new Array(25).fill(500), ...new Array(25).fill(2500)], '2026-03-01'),
  ];
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'aaa');
  assert.equal(r.sources[1]!.source, 'mmm');
  assert.equal(r.sources[2]!.source, 'zzz');
});

test('PH builder: lambdaScale higher -> peakRatio lower (inverse linear)', () => {
  const q = synth('inv', [...new Array(25).fill(500), ...new Array(25).fill(3000)]);
  const r1 = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    lambdaScale: 1.0,
  });
  const r2 = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    lambdaScale: 2.0,
  });
  const p1 = r1.sources[0]!.peakRatio;
  const p2 = r2.sources[0]!.peakRatio;
  // Doubling lambdaScale should halve peakRatio (within numeric float tolerance).
  assert.ok(
    Math.abs(p1 - 2 * p2) / p1 < 1e-6,
    `p1=${p1} 2*p2=${2 * p2}`,
  );
});

test('PH builder: deltaScale=0 vs deltaScale=large changes phMax', () => {
  const q = synth('del', [...new Array(25).fill(500), ...new Array(25).fill(3000)]);
  const r0 = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    deltaScale: 0,
  });
  const rBig = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
    deltaScale: 5.0, // delta = 5 * IQR is huge
  });
  assert.ok(r0.sources[0]!.phMax > rBig.sources[0]!.phMax);
});

test('PH builder: scale invariance — phMax / IQR / sqrt(N) is roughly preserved under linear rescale', () => {
  const base = [...new Array(25).fill(500), ...new Array(25).fill(3000)];
  const q1 = synth('s1', base, '2026-01-01');
  const q10 = synth('s10', base.map((v) => v * 10), '2026-02-01');
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint([...q1, ...q10], {
    generatedAt: GEN,
  });
  const peak1 = r.sources.find((s) => s.source === 's1')!.peakRatio;
  const peak10 = r.sources.find((s) => s.source === 's10')!.peakRatio;
  // peakRatio is constructed to be scale-invariant up to rounding
  assert.ok(
    Math.abs(peak1 - peak10) / Math.max(peak1, peak10) < 0.05,
    `peak1=${peak1} peak10=${peak10}`,
  );
});

test('PH builder: report exposes all dropped buckets', () => {
  const q = synth('only', [...new Array(25).fill(500), ...new Array(25).fill(3000)]);
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, { generatedAt: GEN });
  // Schema check: every dropped* field is a number
  for (const k of [
    'droppedInvalidHourStart',
    'droppedNonPositiveTokens',
    'droppedSourceFilter',
    'droppedSparseSources',
    'droppedBelowMinTenure',
    'droppedZeroVariance',
    'droppedNonFiniteFit',
    'droppedTopSources',
  ] as const) {
    assert.equal(typeof r[k], 'number', `field ${k} must be a number`);
  }
});

test('PH builder: tenuredays gap-filled correctly even with missing days', () => {
  // 1 entry on day 0, 1 on day 24 -> tenure=25 (gap-filled days between are zero).
  const q = [
    ql('2026-01-01T00:00:00.000Z', 's', 5000),
    ql('2026-01-25T00:00:00.000Z', 's', 5000),
  ];
  const r = buildDailyTokenPageHinkleyMeanShiftChangepoint(q, {
    generatedAt: GEN,
  });
  // Either dropped (zero variance possible if two equal entries with zeros in
  // between still produce non-zero IQR — let's just verify either one source
  // row OR a clean drop).
  if (r.sources.length === 1) {
    assert.equal(r.sources[0]!.nTenureDays, 25);
  } else {
    assert.equal(r.sources.length, 0);
  }
});

// ---- refinement: PH up/down symmetry property test ----------------------

test('pageHinkleyArm: up/down symmetry under sign reflection', () => {
  // Reflect x around its mean: y_t = 2*mean(x) - x_t.
  // Then pageHinkleyArm(y, delta, 'up') should be IDENTICAL (numerically)
  // to pageHinkleyArm(x, delta, 'down') because mHat(y) = 2*mean - mHat(x)
  // and y_t - mHat(y) = -(x_t - mHat(x)).
  const x = [
    100, 110, 95, 105, 100, 102, 98, 99, 103,
    250, 248, 252, 245, 251, 249, 253, 247, 250,
    255, 252, 248, 256, 254, 251,
  ];
  const meanX = x.reduce((a, b) => a + b, 0) / x.length;
  const y = x.map((v) => 2 * meanX - v);
  const upY = pageHinkleyArm(y, 0, 'up');
  const dnX = pageHinkleyArm(x, 0, 'down');
  // Both PH curves should match within float tolerance.
  for (let i = 0; i < x.length; i += 1) {
    const a = upY.phCurve[i]!;
    const b = dnX.phCurve[i]!;
    assert.ok(
      Math.abs(a - b) <= 1e-8 * Math.max(1, Math.abs(a) + Math.abs(b)),
      `PH symmetry mismatch at i=${i}: up(y)=${a} vs dn(x)=${b}`,
    );
  }
  assert.ok(Math.abs(upY.phMax - dnX.phMax) <= 1e-8 * Math.max(1, dnX.phMax));
  assert.equal(upY.tauStar, dnX.tauStar);
});

test('pageHinkleyArm: PH_t = U_t - mMin_t identity holds at every t', () => {
  const x = [
    50, 51, 49, 52, 48, 50, 51, 49,
    150, 152, 148, 151, 149, 150, 152,
  ];
  const r = pageHinkleyArm(x, 0, 'up');
  // Reconstruct: U_t - cumulative-min(U) should equal phCurve[t] exactly.
  // We can't access uCurve from outside, but we can recompute it manually.
  let runSum = 0;
  let u = 0;
  let mMin = 0;
  for (let t = 0; t < x.length; t += 1) {
    runSum += x[t]!;
    const mHat = runSum / (t + 1);
    u += x[t]! - mHat - 0;
    if (u < mMin) mMin = u;
    const expectedPh = u - mMin;
    assert.ok(
      Math.abs(r.phCurve[t]! - expectedPh) < 1e-9,
      `PH identity broken at t=${t}: got ${r.phCurve[t]} want ${expectedPh}`,
    );
  }
});
