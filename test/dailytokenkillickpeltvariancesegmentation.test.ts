import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenKillickPeltVarianceSegmentation,
  dailyTokenKillickPeltVarianceSegmentation,
  peltVarianceSegment,
} from '../src/dailytokenkillickpeltvariancesegmentation.js';
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

// ---- option validation ---------------------------------------------------

test('pelt: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { minTenureDays: 21.5 }),
  );
});

test('pelt: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { minTokens: NaN }),
  );
});

test('pelt: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { top: 1.5 }),
  );
});

test('pelt: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], {
      sort: 'nope' as 'mChangepoints',
    }),
  );
});

test('pelt: rejects bad betaK', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { betaK: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { betaK: NaN }),
  );
});

test('pelt: rejects bad varFloor', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { varFloor: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { varFloor: -1 }),
  );
});

test('pelt: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { since: 'no' }),
  );
  assert.throws(() =>
    buildDailyTokenKillickPeltVarianceSegmentation([], { until: 'no' }),
  );
});

// ---- pure helpers --------------------------------------------------------

test('peltVarianceSegment: throws on n<2', () => {
  assert.throws(() => peltVarianceSegment([], 1, 1e-12));
  assert.throws(() => peltVarianceSegment([1], 1, 1e-12));
});

test('peltVarianceSegment: rejects bad beta and varFloor', () => {
  assert.throws(() => peltVarianceSegment([1, 2, 3], -1, 1e-12));
  assert.throws(() => peltVarianceSegment([1, 2, 3], NaN, 1e-12));
  assert.throws(() => peltVarianceSegment([1, 2, 3], 1, 0));
  assert.throws(() => peltVarianceSegment([1, 2, 3], 1, -1));
});

test('peltVarianceSegment: huge beta forces zero changepoints', () => {
  const n = 40;
  const y: number[] = new Array(n);
  // genuine variance shift at midpoint
  for (let i = 0; i < n / 2; i += 1) y[i] = i % 2 === 0 ? 1 : -1;
  for (let i = n / 2; i < n; i += 1) y[i] = i % 2 === 0 ? 50 : -50;
  const r = peltVarianceSegment(y, 1e9, 1e-12);
  assert.equal(r.tauStar.length, 0);
});

test('peltVarianceSegment: small beta finds the variance shift', () => {
  const n = 60;
  const y: number[] = new Array(n);
  // mean-centred series with sharp variance shift at i=30
  for (let i = 0; i < 30; i += 1) y[i] = (i % 2 === 0 ? 1 : -1) * 0.1;
  for (let i = 30; i < 60; i += 1) y[i] = (i % 2 === 0 ? 1 : -1) * 10;
  // re-centre exactly
  let mean = 0;
  for (const v of y) mean += v;
  mean /= n;
  for (let i = 0; i < n; i += 1) y[i] -= mean;
  const r = peltVarianceSegment(y, 2 * Math.log(n), 1e-12);
  assert.ok(r.tauStar.length >= 1, `expected >=1 CP, got ${r.tauStar.length}`);
  // first CP should be near 30
  const tau = r.tauStar[0]!;
  assert.ok(Math.abs(tau - 30) <= 5, `tau=${tau} far from 30`);
});

test('peltVarianceSegment: F(n) is finite and segVars length = m+1', () => {
  const n = 50;
  const y: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) y[i] = Math.sin(i * 0.7);
  const r = peltVarianceSegment(y, 2 * Math.log(n), 1e-12);
  assert.ok(Number.isFinite(r.cost));
  assert.equal(r.segVars.length, r.tauStar.length + 1);
});

test('peltVarianceSegment: deterministic across repeated runs', () => {
  const n = 80;
  const y: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) y[i] = Math.cos(i * 0.31) * (i < 40 ? 0.3 : 3);
  let mean = 0;
  for (const v of y) mean += v;
  mean /= n;
  for (let i = 0; i < n; i += 1) y[i] -= mean;
  const a = peltVarianceSegment(y, 2 * Math.log(n), 1e-12);
  const b = peltVarianceSegment(y, 2 * Math.log(n), 1e-12);
  assert.deepEqual(a.tauStar, b.tauStar);
  assert.equal(a.cost, b.cost);
});

// ---- top-level function --------------------------------------------------

test('dailyTokenKillickPeltVarianceSegmentation: throws on n<21', () => {
  assert.throws(() =>
    dailyTokenKillickPeltVarianceSegmentation(new Array(20).fill(1)),
  );
});

test('dailyTokenKillickPeltVarianceSegmentation: throws on negative weights', () => {
  const w = new Array(25).fill(1);
  w[3] = -1;
  assert.throws(() => dailyTokenKillickPeltVarianceSegmentation(w));
});

test('dailyTokenKillickPeltVarianceSegmentation: throws on non-finite weights', () => {
  const w = new Array(25).fill(1);
  w[3] = Number.POSITIVE_INFINITY;
  assert.throws(() => dailyTokenKillickPeltVarianceSegmentation(w));
});

test('dailyTokenKillickPeltVarianceSegmentation: throws on zero variance', () => {
  assert.throws(() =>
    dailyTokenKillickPeltVarianceSegmentation(new Array(25).fill(7)),
  );
});

test('dailyTokenKillickPeltVarianceSegmentation: m=0 on iid noise', () => {
  // homoscedastic: BIC penalty should usually win
  const n = 40;
  const w: number[] = new Array(n);
  let s = 1;
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    w[i] = 100 + (s % 20);
  }
  const r = dailyTokenKillickPeltVarianceSegmentation(w);
  assert.ok(r.mChangepoints >= 0);
  assert.equal(r.segVars.length, r.tauStar.length + 1);
});

test('dailyTokenKillickPeltVarianceSegmentation: m>=1 on clear variance shift', () => {
  const n = 80;
  const w: number[] = new Array(n);
  // first half: tight oscillation around 1000
  // second half: very wide oscillation around 1000
  for (let i = 0; i < 40; i += 1) {
    w[i] = 1000 + (i % 2 === 0 ? 1 : -1);
  }
  for (let i = 40; i < 80; i += 1) {
    w[i] = 1000 + (i % 2 === 0 ? 800 : -800);
  }
  const r = dailyTokenKillickPeltVarianceSegmentation(w);
  assert.ok(r.mChangepoints >= 1, `expected >=1 CP, got ${r.mChangepoints}`);
  assert.ok(r.varRangeRatio > 1.5, `varRangeRatio=${r.varRangeRatio}`);
});

test('dailyTokenKillickPeltVarianceSegmentation: costReduction >= 0', () => {
  const n = 50;
  const w: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) w[i] = 50 + (i % 7);
  const r = dailyTokenKillickPeltVarianceSegmentation(w);
  assert.ok(r.costReduction >= 0);
});

test('dailyTokenKillickPeltVarianceSegmentation: varHomogeneity in (0, 1]', () => {
  const n = 30;
  const w: number[] = new Array(n);
  for (let i = 0; i < n; i += 1) w[i] = 50 + (i % 5);
  const r = dailyTokenKillickPeltVarianceSegmentation(w);
  assert.ok(r.varHomogeneity > 0 && r.varHomogeneity <= 1);
});

// ---- builder integration -------------------------------------------------

function buildSyntheticQueue(): QueueLine[] {
  const out: QueueLine[] = [];
  // source A: clear variance shift
  for (let d = 0; d < 30; d += 1) {
    const day = `2026-01-${String(d + 1).padStart(2, '0')}`;
    out.push(ql(`${day}T00:00:00.000Z`, 'srcA', 100 + (d % 3)));
  }
  for (let d = 30; d < 60; d += 1) {
    const dt = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000);
    const day = dt.toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, 'srcA', 100 + (d * 17) % 200));
  }
  // source B: homogeneous
  for (let d = 0; d < 40; d += 1) {
    const dt = new Date(Date.UTC(2026, 0, 1) + d * 86_400_000);
    const day = dt.toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, 'srcB', 200 + (d % 5)));
  }
  return out;
}

test('build: returns rows with valid structure', () => {
  const q = buildSyntheticQueue();
  const r = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
  });
  assert.ok(r.sources.length >= 1);
  for (const s of r.sources) {
    assert.equal(s.tauStar.length, s.mChangepoints);
    assert.equal(s.tauStarDays.length, s.mChangepoints);
    assert.equal(s.segments.length, s.mChangepoints + 1);
    let cum = 0;
    for (const seg of s.segments) {
      assert.equal(seg.tStart, cum);
      cum = seg.tEndExclusive;
      assert.ok(seg.length >= 1);
    }
    assert.equal(cum, s.nTenureDays);
    assert.ok(s.costReduction >= 0);
    assert.ok(s.varHomogeneity > 0 && s.varHomogeneity <= 1);
  }
});

test('build: deterministic across repeated runs', () => {
  const q = buildSyntheticQueue();
  const a = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
  });
  const b = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
  });
  assert.deepEqual(a, b);
});

test('build: top truncation surfaces droppedTopSources', () => {
  const q = buildSyntheticQueue();
  const r = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
    top: 1,
  });
  assert.ok(r.sources.length <= 1);
  assert.ok(r.droppedTopSources >= 0);
});

test('build: source filter respected', () => {
  const q = buildSyntheticQueue();
  const r = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
    source: 'srcA',
  });
  for (const s of r.sources) assert.equal(s.source, 'srcA');
});

test('build: all sort modes preserve total source count', () => {
  const q = buildSyntheticQueue();
  const sorts: Array<
    | 'mChangepoints'
    | 'mChangepointsDesc'
    | 'costReduction'
    | 'costReductionDesc'
    | 'varRangeRatio'
    | 'varRangeRatioDesc'
    | 'varHomogeneity'
    | 'varHomogeneityDesc'
    | 'tokens'
    | 'tenure'
    | 'source'
  > = [
    'mChangepoints',
    'mChangepointsDesc',
    'costReduction',
    'costReductionDesc',
    'varRangeRatio',
    'varRangeRatioDesc',
    'varHomogeneity',
    'varHomogeneityDesc',
    'tokens',
    'tenure',
    'source',
  ];
  const baseline = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
  });
  for (const sort of sorts) {
    const r = buildDailyTokenKillickPeltVarianceSegmentation(q, {
      generatedAt: GEN,
      sort,
    });
    assert.equal(r.sources.length, baseline.sources.length, `sort=${sort}`);
  }
});

test('build: tauStar strictly ascending and within (0, n)', () => {
  const q = buildSyntheticQueue();
  const r = buildDailyTokenKillickPeltVarianceSegmentation(q, {
    generatedAt: GEN,
  });
  for (const s of r.sources) {
    for (let i = 0; i < s.tauStar.length; i += 1) {
      assert.ok(s.tauStar[i]! > 0);
      assert.ok(s.tauStar[i]! < s.nTenureDays);
      if (i > 0) assert.ok(s.tauStar[i]! > s.tauStar[i - 1]!);
    }
  }
});
