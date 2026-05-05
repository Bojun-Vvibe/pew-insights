import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenLaplaceCentroidTrend,
  buildDailyTokenLaplaceCentroidTrend,
  effectiveSampleSizeLaplace,
  standardNormalCdfLaplace,
  twoSidedNormalPLaplace,
} from '../src/dailytokenlaplacecentroidtrend.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- standardNormalCdfLaplace ----------

test('standardNormalCdfLaplace(0) === 0.5', () => {
  assert.ok(Math.abs(standardNormalCdfLaplace(0) - 0.5) < 1e-9);
});

test('standardNormalCdfLaplace symmetry: Phi(z) + Phi(-z) === 1', () => {
  for (const z of [0.1, 0.5, 1.0, 1.96, 2.5, 3.0]) {
    const sum = standardNormalCdfLaplace(z) + standardNormalCdfLaplace(-z);
    assert.ok(Math.abs(sum - 1) < 1e-6, `z=${z} sum=${sum}`);
  }
});

test('standardNormalCdfLaplace(1.96) ~ 0.975', () => {
  assert.ok(Math.abs(standardNormalCdfLaplace(1.96) - 0.975) < 1e-3);
});

test('standardNormalCdfLaplace handles +/- infinity', () => {
  assert.equal(standardNormalCdfLaplace(Number.POSITIVE_INFINITY), 1);
  assert.equal(standardNormalCdfLaplace(Number.NEGATIVE_INFINITY), 0);
});

test('standardNormalCdfLaplace is monotone non-decreasing', () => {
  let prev = -1;
  for (let k = -40; k <= 40; k += 1) {
    const v = standardNormalCdfLaplace(k / 10);
    assert.ok(v >= prev - 1e-10, `monotonicity violated at z=${k / 10}`);
    prev = v;
  }
});

test('standardNormalCdfLaplace rejects NaN', () => {
  assert.throws(() => standardNormalCdfLaplace(Number.NaN));
});

// ---------- twoSidedNormalPLaplace ----------

test('twoSidedNormalP(0) === 1', () => {
  assert.ok(Math.abs(twoSidedNormalPLaplace(0) - 1) < 1e-6);
});

test('twoSidedNormalP(1.96) ~ 0.05', () => {
  assert.ok(Math.abs(twoSidedNormalPLaplace(1.96) - 0.05) < 1e-3);
});

test('twoSidedNormalP is symmetric in sign of z', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 2.58]) {
    const a = twoSidedNormalPLaplace(z);
    const b = twoSidedNormalPLaplace(-z);
    assert.ok(Math.abs(a - b) < 1e-9);
  }
});

test('twoSidedNormalP result in [0, 1]', () => {
  for (const z of [-5, -2, -1, 0, 1, 2, 5]) {
    const p = twoSidedNormalPLaplace(z);
    assert.ok(p >= 0 && p <= 1, `z=${z} p=${p}`);
  }
});

test('twoSidedNormalP rejects non-finite', () => {
  assert.throws(() => twoSidedNormalPLaplace(Number.NaN));
  assert.throws(() => twoSidedNormalPLaplace(Number.POSITIVE_INFINITY));
});

// ---------- effectiveSampleSizeLaplace ----------

test('nEff(uniform weights) === n', () => {
  for (const n of [3, 5, 14, 100]) {
    const w = new Array(n).fill(1);
    assert.ok(Math.abs(effectiveSampleSizeLaplace(w) - n) < 1e-9);
  }
});

test('nEff(uniform-scaled) === n (scale invariance)', () => {
  const n = 20;
  const w = new Array(n).fill(7);
  assert.ok(Math.abs(effectiveSampleSizeLaplace(w) - n) < 1e-9);
});

test('nEff(single mass) === 1', () => {
  const w = new Array(20).fill(0);
  w[5] = 42;
  assert.ok(Math.abs(effectiveSampleSizeLaplace(w) - 1) < 1e-9);
});

test('nEff invariant under positive scaling', () => {
  const w = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = effectiveSampleSizeLaplace(w);
  const b = effectiveSampleSizeLaplace(w.map((x) => 100 * x));
  assert.ok(Math.abs(a - b) < 1e-9);
});

test('nEff invariant under permutation', () => {
  const w = [1, 5, 2, 8, 3, 7, 4, 6];
  const a = effectiveSampleSizeLaplace(w);
  const b = effectiveSampleSizeLaplace([...w].reverse());
  const c = effectiveSampleSizeLaplace([8, 7, 6, 5, 4, 3, 2, 1]);
  assert.ok(Math.abs(a - b) < 1e-9);
  assert.ok(Math.abs(a - c) < 1e-9);
});

test('nEff in [1, n]', () => {
  const cases = [
    [1, 1, 1, 1],
    [1, 0, 0, 0],
    [10, 1, 1, 1],
    [3, 4, 5, 6],
    [0.5, 0.5, 0.5, 0.5, 0.5],
  ];
  for (const w of cases) {
    const ne = effectiveSampleSizeLaplace(w);
    assert.ok(ne >= 1 - 1e-9 && ne <= w.length + 1e-9, `w=${w} ne=${ne}`);
  }
});

test('nEff rejects negative or non-finite weights', () => {
  assert.throws(() => effectiveSampleSizeLaplace([1, -1, 1]));
  assert.throws(() => effectiveSampleSizeLaplace([1, Number.NaN, 1]));
  assert.throws(() => effectiveSampleSizeLaplace([0, 0, 0]));
  assert.throws(() => effectiveSampleSizeLaplace([]));
});

// ---------- dailyTokenLaplaceCentroidTrend ----------

test('rejects n < 14', () => {
  assert.throws(() => dailyTokenLaplaceCentroidTrend(new Array(13).fill(1)));
});

test('rejects negative weights', () => {
  const w = new Array(14).fill(1);
  w[3] = -2;
  assert.throws(() => dailyTokenLaplaceCentroidTrend(w));
});

test('rejects non-finite weights', () => {
  const w = new Array(14).fill(1);
  w[3] = Number.NaN;
  assert.throws(() => dailyTokenLaplaceCentroidTrend(w));
});

test('rejects zero centred variance (all-equal weights)', () => {
  assert.throws(() => dailyTokenLaplaceCentroidTrend(new Array(14).fill(5)));
});

test('uniform-then-perturb has lapZ ~ 0 for tiny perturbation', () => {
  const w = new Array(20).fill(100);
  w[10] = 100.0001;
  const r = dailyTokenLaplaceCentroidTrend(w);
  assert.ok(Math.abs(r.lapZ) < 0.01, `expected near-zero, got ${r.lapZ}`);
  assert.ok(Math.abs(r.lapCBarNorm) < 0.001);
  assert.ok(r.lapPValue > 0.9);
});

test('strict back-loaded ramp 1..n: lapZ > 0, lapCBarNorm > 0', () => {
  const n = 20;
  const w: number[] = [];
  for (let i = 0; i < n; i += 1) w.push(i + 1);
  const r = dailyTokenLaplaceCentroidTrend(w);
  assert.ok(r.lapZ > 0, `expected positive Z, got ${r.lapZ}`);
  assert.ok(r.lapCBarNorm > 0);
  // centroid of weights 1..n at positions 1..n equals
  // sum(i^2)/sum(i) = (n+1)(2n+1)/(3(n+1)) = (2n+1)/3.
  const expectedCBar = (2 * n + 1) / 3;
  assert.ok(Math.abs(r.lapCBar - expectedCBar) < 1e-9);
  assert.ok(Math.abs(r.lapMidpoint - (n + 1) / 2) < 1e-9);
});

test('strict front-loaded reverse ramp n..1: lapZ < 0, lapCBarNorm < 0', () => {
  const n = 20;
  const w: number[] = [];
  for (let i = 0; i < n; i += 1) w.push(n - i);
  const r = dailyTokenLaplaceCentroidTrend(w);
  assert.ok(r.lapZ < 0, `expected negative Z, got ${r.lapZ}`);
  assert.ok(r.lapCBarNorm < 0);
});

test('all mass at last position triggers nEff < 2 gate when single nonzero', () => {
  const n = 20;
  const w = new Array(n).fill(0);
  w[n - 1] = 1;
  // nEff = 1; should throw
  assert.throws(() => dailyTokenLaplaceCentroidTrend(w));
});

test('reversal negates lapZ and lapCBarNorm; preserves p-value', () => {
  const n = 30;
  const w: number[] = [];
  for (let i = 0; i < n; i += 1) w.push((i + 1) * (i + 1));
  const fwd = dailyTokenLaplaceCentroidTrend(w);
  const rev = dailyTokenLaplaceCentroidTrend([...w].reverse());
  assert.ok(Math.abs(fwd.lapZ + rev.lapZ) < 1e-9);
  assert.ok(Math.abs(fwd.lapCBarNorm + rev.lapCBarNorm) < 1e-9);
  assert.ok(Math.abs(fwd.lapPValue - rev.lapPValue) < 1e-9);
});

test('positive scale invariance: a*w gives identical lapZ, lapNEff, lapCBarNorm, lapPValue', () => {
  const n = 18;
  const w: number[] = [];
  for (let i = 0; i < n; i += 1) w.push(1 + i + (i % 3) * 2);
  const a = dailyTokenLaplaceCentroidTrend(w);
  const b = dailyTokenLaplaceCentroidTrend(w.map((x) => 1000 * x));
  assert.ok(Math.abs(a.lapZ - b.lapZ) < 1e-9);
  assert.ok(Math.abs(a.lapNEff - b.lapNEff) < 1e-9);
  assert.ok(Math.abs(a.lapCBarNorm - b.lapCBarNorm) < 1e-9);
  assert.ok(Math.abs(a.lapPValue - b.lapPValue) < 1e-9);
});

test('lapCBar in [1, n] always', () => {
  for (const n of [14, 30, 100]) {
    const w: number[] = [];
    for (let i = 0; i < n; i += 1) w.push(Math.abs(Math.sin(i)) + 0.1);
    const r = dailyTokenLaplaceCentroidTrend(w);
    assert.ok(r.lapCBar >= 1 - 1e-9 && r.lapCBar <= n + 1e-9);
  }
});

test('lapMidpoint === (n+1)/2 always', () => {
  for (const n of [14, 17, 50]) {
    const w: number[] = [];
    for (let i = 0; i < n; i += 1) w.push(1 + (i % 5));
    const r = dailyTokenLaplaceCentroidTrend(w);
    assert.ok(Math.abs(r.lapMidpoint - (n + 1) / 2) < 1e-9);
  }
});

test('lapCBarNorm in [-1, 1] always', () => {
  for (const n of [14, 25, 50]) {
    const w: number[] = [];
    for (let i = 0; i < n; i += 1) w.push(((i * 7) % 11) + 1);
    const r = dailyTokenLaplaceCentroidTrend(w);
    assert.ok(r.lapCBarNorm >= -1 - 1e-9 && r.lapCBarNorm <= 1 + 1e-9);
  }
});

test('Mass concentrated late ([1,...,1,8]) -> back-loaded significant', () => {
  const n = 30;
  const w = new Array(n).fill(1);
  w[n - 1] = 8;
  const r = dailyTokenLaplaceCentroidTrend(w);
  assert.ok(r.lapNEff >= 2);
  assert.ok(r.lapZ > 0);
  assert.ok(r.lapCBarNorm > 0);
});

// ---------- buildDailyTokenLaplaceCentroidTrend ----------

test('build: empty queue -> zero rows', () => {
  const r = buildDailyTokenLaplaceCentroidTrend([], {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: one source with monotone-increasing daily mass loads positive lapZ', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    lines.push(ql(dayIso(i), 'vsc-redacted', 100 + i * 50));
  }
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'vsc-redacted');
  assert.equal(row.nTenureDays, 30);
  assert.ok(row.lapZ > 0);
  assert.ok(row.lapCBarNorm > 0);
});

test('build: sparse-source filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'tiny', 5));
  }
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'big', 1000 + i * 10));
  }
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    minTokens: 1000,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: below min-tenure-days dropped', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    lines.push(ql(dayIso(i), 'short', 200 + i * 100));
  }
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance dropped (all days equal)', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'flat', 500));
  }
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: source-filter restriction', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'a', 100 + i));
    lines.push(ql(dayIso(i), 'b', 100 + i));
  }
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    source: 'a',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 20);
});

test('build: invalid hour_start counted', () => {
  const lines: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ...Array.from({ length: 20 }, (_, i) => ql(dayIso(i), 'a', 100 + i)),
  ];
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive token rows dropped', () => {
  const lines: QueueLine[] = [
    ql(dayIso(0), 'a', 0),
    ql(dayIso(1), 'a', -50),
    ...Array.from({ length: 20 }, (_, i) => ql(dayIso(i + 2), 'a', 100 + i)),
  ];
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: top cap honoured', () => {
  const lines: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd']) {
    for (let i = 0; i < 20; i += 1) {
      lines.push(ql(dayIso(i), src, 100 + i + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    top: 2,
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: sort lapZDesc orders descending by Z', () => {
  const lines: QueueLine[] = [];
  // back-loaded source
  for (let i = 0; i < 20; i += 1) lines.push(ql(dayIso(i), 'back', 50 + i * 80));
  // front-loaded source (offset by 50 days to keep tenures separate)
  for (let i = 0; i < 20; i += 1)
    lines.push(ql(dayIso(50 + i), 'front', 50 + (19 - i) * 80));
  const r = buildDailyTokenLaplaceCentroidTrend(lines, {
    sort: 'lapZDesc',
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'back');
  assert.equal(r.sources[1]!.source, 'front');
});

test('build: invalid options rejected', () => {
  assert.throws(() => buildDailyTokenLaplaceCentroidTrend([], { minTokens: -1 }));
  assert.throws(() =>
    buildDailyTokenLaplaceCentroidTrend([], { minTenureDays: 10 }),
  );
  assert.throws(() => buildDailyTokenLaplaceCentroidTrend([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenLaplaceCentroidTrend([], { sort: 'bogus' as never }),
  );
  assert.throws(() => buildDailyTokenLaplaceCentroidTrend([], { since: 'bad' }));
  assert.throws(() => buildDailyTokenLaplaceCentroidTrend([], { until: 'bad' }));
});

test('build: report fields are deterministic given generatedAt', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) lines.push(ql(dayIso(i), 'x', 100 + i * 5));
  const a = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  const b = buildDailyTokenLaplaceCentroidTrend(lines, {
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  assert.deepEqual(a, b);
});
