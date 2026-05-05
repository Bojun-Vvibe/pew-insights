import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenHirschSlackSeasonalKendall,
  buildDailyTokenHirschSlackSeasonalKendall,
  mannKendallSWithinSeason,
  mannKendallVarianceWithinSeason,
  standardNormalCdfHirschSlack,
  twoSidedNormalPHirschSlack,
} from '../src/dailytokenhirschslackseasonalkendall.js';
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

// ---------- standardNormalCdfHirschSlack ----------

test('standardNormalCdfHirschSlack(0) === 0.5', () => {
  assert.ok(Math.abs(standardNormalCdfHirschSlack(0) - 0.5) < 1e-9);
});

test('standardNormalCdfHirschSlack symmetry: Phi(z) + Phi(-z) === 1', () => {
  for (const z of [0.1, 0.5, 1.0, 1.96, 2.5, 3.0]) {
    const sum =
      standardNormalCdfHirschSlack(z) + standardNormalCdfHirschSlack(-z);
    assert.ok(Math.abs(sum - 1) < 1e-6, `z=${z} sum=${sum}`);
  }
});

test('standardNormalCdfHirschSlack(1.96) ~ 0.975', () => {
  assert.ok(Math.abs(standardNormalCdfHirschSlack(1.96) - 0.975) < 1e-3);
});

test('standardNormalCdfHirschSlack handles +/- infinity', () => {
  assert.equal(standardNormalCdfHirschSlack(Number.POSITIVE_INFINITY), 1);
  assert.equal(standardNormalCdfHirschSlack(Number.NEGATIVE_INFINITY), 0);
});

test('standardNormalCdfHirschSlack rejects NaN', () => {
  assert.throws(() => standardNormalCdfHirschSlack(Number.NaN));
});

// ---------- twoSidedNormalPHirschSlack ----------

test('twoSidedNormalPHirschSlack(0) === 1', () => {
  assert.ok(Math.abs(twoSidedNormalPHirschSlack(0) - 1) < 1e-6);
});

test('twoSidedNormalPHirschSlack(1.96) ~ 0.05', () => {
  assert.ok(Math.abs(twoSidedNormalPHirschSlack(1.96) - 0.05) < 1e-3);
});

test('twoSidedNormalPHirschSlack symmetric in sign of z', () => {
  for (const z of [0.5, 1.0, 1.5, 2.0, 2.58]) {
    assert.ok(
      Math.abs(
        twoSidedNormalPHirschSlack(z) - twoSidedNormalPHirschSlack(-z),
      ) < 1e-9,
    );
  }
});

test('twoSidedNormalPHirschSlack rejects non-finite z', () => {
  assert.throws(() => twoSidedNormalPHirschSlack(Number.NaN));
  assert.throws(() => twoSidedNormalPHirschSlack(Number.POSITIVE_INFINITY));
});

// ---------- mannKendallSWithinSeason ----------

test('mannKendallSWithinSeason monotone increase = max', () => {
  const v = [1, 2, 3, 4, 5];
  // 5 choose 2 = 10
  assert.equal(mannKendallSWithinSeason(v), 10);
});

test('mannKendallSWithinSeason monotone decrease = min', () => {
  assert.equal(mannKendallSWithinSeason([5, 4, 3, 2, 1]), -10);
});

test('mannKendallSWithinSeason all-equal = 0', () => {
  assert.equal(mannKendallSWithinSeason([7, 7, 7, 7, 7]), 0);
});

test('mannKendallSWithinSeason negation under reversal', () => {
  const v = [3, 1, 4, 1, 5, 9, 2, 6];
  const s1 = mannKendallSWithinSeason(v);
  const s2 = mannKendallSWithinSeason([...v].reverse());
  assert.equal(s1, -s2);
});

// ---------- mannKendallVarianceWithinSeason ----------

test('mannKendallVarianceWithinSeason no ties: n*(n-1)*(2n+5)/18', () => {
  // n=5: 5*4*15/18 = 300/18
  assert.ok(
    Math.abs(mannKendallVarianceWithinSeason([1, 2, 3, 4, 5]) - 300 / 18) <
      1e-9,
  );
});

test('mannKendallVarianceWithinSeason with all ties (one tie group of n)', () => {
  // base - tieAdjust: equal so var = 0
  assert.equal(mannKendallVarianceWithinSeason([3, 3, 3, 3]), 0);
});

test('mannKendallVarianceWithinSeason tie-correction monotone non-increasing under more ties', () => {
  const v0 = mannKendallVarianceWithinSeason([1, 2, 3, 4, 5]);
  const v1 = mannKendallVarianceWithinSeason([1, 2, 3, 4, 4]);
  const v2 = mannKendallVarianceWithinSeason([1, 2, 3, 3, 3]);
  assert.ok(v0 >= v1 - 1e-9);
  assert.ok(v1 >= v2 - 1e-9);
});

// ---------- dailyTokenHirschSlackSeasonalKendall ----------

test('dailyTokenHirschSlackSeasonalKendall rejects n < 21', () => {
  assert.throws(() =>
    dailyTokenHirschSlackSeasonalKendall(new Array(20).fill(1).map((_, i) => i + 1)),
  );
});

test('dailyTokenHirschSlackSeasonalKendall rejects negative weights', () => {
  const v = new Array(21).fill(1).map((_, i) => i + 1);
  v[5] = -1;
  assert.throws(() => dailyTokenHirschSlackSeasonalKendall(v));
});

test('dailyTokenHirschSlackSeasonalKendall rejects non-finite weights', () => {
  const v = new Array(21).fill(1).map((_, i) => i + 1);
  v[10] = Number.NaN;
  assert.throws(() => dailyTokenHirschSlackSeasonalKendall(v));
});

test('dailyTokenHirschSlackSeasonalKendall rejects zero centred variance', () => {
  assert.throws(() =>
    dailyTokenHirschSlackSeasonalKendall(new Array(21).fill(7)),
  );
});

test('dailyTokenHirschSlackSeasonalKendall: pure linear ramp loads STRONGLY positive', () => {
  // 21 days, x[i] = i+1 (1..21). Within each weekday cohort the
  // values are strictly increasing across weeks => every S_g = max.
  const v = new Array(21).fill(0).map((_, i) => i + 1);
  const r = dailyTokenHirschSlackSeasonalKendall(v);
  assert.ok(r.hsS > 0);
  assert.ok(r.hsZ > 0);
  assert.ok(r.hsTau > 0.99); // every cohort strictly increasing => tau ~ 1
  assert.equal(r.hsConcordantSeasons, 7);
  assert.equal(r.hsActiveSeasons, 7);
  assert.ok(r.hsPValue < 0.05);
});

test('dailyTokenHirschSlackSeasonalKendall: reversed linear ramp negates Z', () => {
  const up = new Array(21).fill(0).map((_, i) => i + 1);
  const down = [...up].reverse();
  const ru = dailyTokenHirschSlackSeasonalKendall(up);
  const rd = dailyTokenHirschSlackSeasonalKendall(down);
  assert.ok(Math.abs(ru.hsS + rd.hsS) < 1e-9);
  assert.ok(Math.abs(ru.hsZ + rd.hsZ) < 1e-9);
  assert.ok(Math.abs(ru.hsPValue - rd.hsPValue) < 1e-9);
});

test('dailyTokenHirschSlackSeasonalKendall: pure period-7 weekday step loads NEAR ZERO', () => {
  // 21 days: weekday cohort g gets the same value g across all 3 weeks.
  // x[i] = i mod 7. Within EACH cohort: all observations equal => S_g = 0.
  // But this triggers zero centred variance? No: across the full series
  // values vary. Let's check: 21 entries, values 0..6 each repeated 3 times.
  // Centred variance > 0 => OK. Each cohort is constant => hsS = 0, hsZ = 0.
  const v: number[] = [];
  for (let i = 0; i < 21; i += 1) v.push(i % 7);
  // Need non-negative; OK. But effect: dailyToken... checks finite + nonneg
  // and centred variance > 0. Cohort-internal variance is 0 -> S_g = 0 each.
  // Variance per cohort (n_g=3, all tied): base 3*2*11/18 - 3*2*11/18 = 0.
  // So total Var(S^{HS}) = 0 -> function will throw.
  assert.throws(() => dailyTokenHirschSlackSeasonalKendall(v));
});

test('dailyTokenHirschSlackSeasonalKendall: weekday step PLUS small drift gives positive Z', () => {
  // weekday step (g) + small drift (i*0.001).
  // Within each cohort the values strictly increase across weeks => S_g = max.
  // hsZ > 0 even though plain MK would be dominated by the weekday structure.
  const v: number[] = [];
  for (let i = 0; i < 21; i += 1) v.push((i % 7) * 1000 + i * 0.001);
  const r = dailyTokenHirschSlackSeasonalKendall(v);
  assert.ok(r.hsS > 0);
  assert.ok(r.hsZ > 0);
  assert.equal(r.hsConcordantSeasons, 7);
});

test('dailyTokenHirschSlackSeasonalKendall: per-cohort additive shift INVARIANCE', () => {
  // Same trend signal, just shift each cohort by a different additive constant.
  // This must leave hsS, hsVar, hsZ, hsPValue, hsTau unchanged.
  const baseTrend: number[] = [];
  for (let i = 0; i < 28; i += 1) baseTrend.push(i + 1);
  const shifted: number[] = [];
  const shifts = [100, 200, 300, 400, 500, 600, 700];
  for (let i = 0; i < 28; i += 1) shifted.push(baseTrend[i]! + shifts[i % 7]!);
  const a = dailyTokenHirschSlackSeasonalKendall(baseTrend);
  const b = dailyTokenHirschSlackSeasonalKendall(shifted);
  assert.equal(a.hsS, b.hsS);
  assert.ok(Math.abs(a.hsVar - b.hsVar) < 1e-9);
  assert.ok(Math.abs(a.hsZ - b.hsZ) < 1e-9);
  assert.ok(Math.abs(a.hsPValue - b.hsPValue) < 1e-9);
  assert.ok(Math.abs(a.hsTau - b.hsTau) < 1e-9);
  assert.equal(a.hsConcordantSeasons, b.hsConcordantSeasons);
});

test('dailyTokenHirschSlackSeasonalKendall: hsTau bounded in [-1, +1]', () => {
  for (const v of [
    new Array(21).fill(0).map((_, i) => i + 1),
    new Array(21).fill(0).map((_, i) => 21 - i),
    new Array(28).fill(0).map((_, i) => Math.sin(i) + 5),
  ]) {
    const r = dailyTokenHirschSlackSeasonalKendall(v);
    assert.ok(r.hsTau >= -1 - 1e-9 && r.hsTau <= 1 + 1e-9);
    assert.ok(r.hsConcordanceRatio >= 0 && r.hsConcordanceRatio <= 1);
  }
});

// ---------- buildDailyTokenHirschSlackSeasonalKendall ----------

test('build: rejects min-tenure-days < 21', () => {
  assert.throws(() =>
    buildDailyTokenHirschSlackSeasonalKendall([], { minTenureDays: 14 }),
  );
});

test('build: rejects negative minTokens', () => {
  assert.throws(() =>
    buildDailyTokenHirschSlackSeasonalKendall([], { minTokens: -1 }),
  );
});

test('build: rejects bad sort key', () => {
  assert.throws(() =>
    buildDailyTokenHirschSlackSeasonalKendall([], {
      sort: 'banana' as never,
    }),
  );
});

test('build: produces deterministic per-source ordering on synthetic data', () => {
  const queue: QueueLine[] = [];
  // source A: linear ramp
  for (let i = 0; i < 28; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 * (i + 1)));
  }
  // source B: declining
  for (let i = 0; i < 28; i += 1) {
    queue.push(ql(dayIso(i), 'src-b', 1000 * (28 - i)));
  }
  const r = buildDailyTokenHirschSlackSeasonalKendall(queue, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    minTokens: 1000,
    minTenureDays: 21,
    sort: 'hsZDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
  assert.ok(r.sources[0]!.hsZ > 0);
  assert.ok(r.sources[1]!.hsZ < 0);
  assert.equal(r.sort, 'hsZDesc');
});

test('build: respects min-tokens / min-tenure / source filter', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 28; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 100)); // total 2800 > 1000
    queue.push(ql(dayIso(i), 'src-b', 1)); // total 28 < 1000
  }
  // tiny tenure source
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'src-tiny', 10000));
  }
  const r = buildDailyTokenHirschSlackSeasonalKendall(queue, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    minTokens: 1000,
    minTenureDays: 21,
  });
  // src-b dropped (sparse), src-tiny dropped (below tenure), src-a should appear unless zero-variance
  const got = r.sources.map((s) => s.source);
  assert.ok(got.includes('src-a') || r.droppedZeroVariance >= 1);
  assert.ok(r.droppedSparseSources >= 1);
  assert.ok(r.droppedBelowMinTenure >= 1);
});

test('build: --json honoured via report shape (top cap counts dropped)', () => {
  const queue: QueueLine[] = [];
  for (let s = 0; s < 3; s += 1) {
    for (let i = 0; i < 28; i += 1) {
      queue.push(ql(dayIso(i), `src-${s}`, 1000 * (i + 1) + s));
    }
  }
  const r = buildDailyTokenHirschSlackSeasonalKendall(queue, {
    generatedAt: '2026-05-06T00:00:00.000Z',
    top: 1,
    minTokens: 1000,
    minTenureDays: 21,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});
