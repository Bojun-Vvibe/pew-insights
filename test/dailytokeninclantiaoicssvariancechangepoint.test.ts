import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenInclanTiaoIcssVarianceChangepoint,
  dailyTokenInclanTiaoIcssVarianceChangepoint,
  icssSummary,
  kolmogorovUpperTailP,
  ICSS_CRITICAL_05,
  ICSS_CRITICAL_01,
} from '../src/dailytokeninclantiaoicssvariancechangepoint.js';
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

test('icss: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { minTenureDays: 21.5 }),
  );
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { minTenureDays: 0 }),
  );
});

test('icss: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { minTokens: NaN }),
  );
});

test('icss: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { top: 1.5 }),
  );
});

test('icss: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { sort: 'nope' as 'itStat' }),
  );
});

test('icss: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { since: 'no' }),
  );
  assert.throws(() =>
    buildDailyTokenInclanTiaoIcssVarianceChangepoint([], { until: 'no' }),
  );
});

// ---- pure helpers --------------------------------------------------------

test('kolmogorovUpperTailP: monotone decreasing in c', () => {
  assert.equal(kolmogorovUpperTailP(0), 1);
  assert.equal(kolmogorovUpperTailP(-1), 1);
  const a = kolmogorovUpperTailP(0.5);
  const b = kolmogorovUpperTailP(1.0);
  const c = kolmogorovUpperTailP(1.358);
  const d = kolmogorovUpperTailP(1.628);
  const e = kolmogorovUpperTailP(2.0);
  assert.ok(a > b);
  assert.ok(b > c);
  assert.ok(c > d);
  assert.ok(d > e);
});

test('kolmogorovUpperTailP: known critical-value alignment', () => {
  // alpha=0.05 critical c = 1.358 -> p ~ 0.05
  const p05 = kolmogorovUpperTailP(1.358);
  assert.ok(p05 > 0.04 && p05 < 0.06, `p05=${p05}`);
  // alpha=0.01 critical c = 1.628 -> p ~ 0.01
  const p01 = kolmogorovUpperTailP(1.628);
  assert.ok(p01 > 0.008 && p01 < 0.013, `p01=${p01}`);
});

test('kolmogorovUpperTailP: large c gives ~0', () => {
  assert.ok(kolmogorovUpperTailP(10) < 1e-50);
});

test('kolmogorovUpperTailP: bounded in [0,1]', () => {
  for (let c = 0.01; c <= 5; c += 0.13) {
    const p = kolmogorovUpperTailP(c);
    assert.ok(p >= 0 && p <= 1, `c=${c} p=${p}`);
  }
});

test('icssSummary: short series returns degenerate', () => {
  const out = icssSummary([]);
  assert.equal(out.itStat, 0);
  assert.equal(out.kStar, -1);
});

test('icssSummary: throws on zero total sum-of-squares', () => {
  assert.throws(() => icssSummary([0, 0, 0, 0, 0]));
});

test('icssSummary: constant variance gives small itStat', () => {
  const n = 50;
  const s: number[] = [];
  // alternating +1/-1 -> exactly constant cusum-of-squares slope
  for (let i = 0; i < n; i += 1) s.push(i % 2 === 0 ? 1 : -1);
  const out = icssSummary(s);
  // D[k] = (k+1)/n - (k+1)/n = 0 for all k; so itStat ~ 0
  assert.ok(out.itStat < 1e-12, `itStat=${out.itStat}`);
});

test('icssSummary: variance increase gives positive directionSign? No -- variance INCREASE on right means LEFT contributes LESS to C[k] for small k => D[k] < 0', () => {
  // first half low variance, second half high variance
  const s: number[] = [];
  for (let i = 0; i < 25; i += 1) s.push(i % 2 === 0 ? 0.1 : -0.1);
  for (let i = 0; i < 25; i += 1) s.push(i % 2 === 0 ? 5 : -5);
  const out = icssSummary(s);
  assert.ok(out.itStat > ICSS_CRITICAL_05, `itStat=${out.itStat}`);
  // variance INCREASE on right -> C[k]/C[n-1] is LESS than (k+1)/n on the
  // left -> D[k] is NEGATIVE -> directionSign -1
  assert.equal(out.directionSign, -1);
});

test('icssSummary: variance decrease gives directionSign +1', () => {
  const s: number[] = [];
  for (let i = 0; i < 25; i += 1) s.push(i % 2 === 0 ? 5 : -5);
  for (let i = 0; i < 25; i += 1) s.push(i % 2 === 0 ? 0.1 : -0.1);
  const out = icssSummary(s);
  assert.ok(out.itStat > ICSS_CRITICAL_05, `itStat=${out.itStat}`);
  assert.equal(out.directionSign, 1);
});

test('icssSummary: kStar near the true changepoint', () => {
  const s: number[] = [];
  for (let i = 0; i < 30; i += 1) s.push(i % 2 === 0 ? 0.1 : -0.1);
  for (let i = 0; i < 30; i += 1) s.push(i % 2 === 0 ? 5 : -5);
  const out = icssSummary(s);
  // true changepoint at k = 30 (zero-based index 29)
  assert.ok(Math.abs(out.kStar - 29) <= 3, `kStar=${out.kStar}`);
});

test('icssSummary: lEdgeRatio and secondPeakRatio in [0,1]', () => {
  const s: number[] = [];
  for (let i = 0; i < 30; i += 1) s.push(i % 2 === 0 ? 0.1 : -0.1);
  for (let i = 0; i < 30; i += 1) s.push(i % 2 === 0 ? 5 : -5);
  const out = icssSummary(s);
  assert.ok(out.lEdgeRatio >= 0 && out.lEdgeRatio <= 1, `lEdgeRatio=${out.lEdgeRatio}`);
  assert.ok(out.secondPeakRatio >= 0 && out.secondPeakRatio <= 1, `sp=${out.secondPeakRatio}`);
});

test('ICSS_CRITICAL constants match Inclan-Tiao 1994 Table 1', () => {
  assert.equal(ICSS_CRITICAL_05, 1.358);
  assert.equal(ICSS_CRITICAL_01, 1.628);
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: rejects n<21', () => {
  const w = new Array(20).fill(1);
  w[0] = 2;
  assert.throws(() => dailyTokenInclanTiaoIcssVarianceChangepoint(w));
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: rejects negative', () => {
  const w = new Array(25).fill(1);
  w[0] = -1;
  assert.throws(() => dailyTokenInclanTiaoIcssVarianceChangepoint(w));
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: rejects non-finite', () => {
  const w = new Array(25).fill(1);
  w[0] = Number.NaN;
  assert.throws(() => dailyTokenInclanTiaoIcssVarianceChangepoint(w));
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: rejects zero variance', () => {
  const w = new Array(25).fill(7);
  assert.throws(() => dailyTokenInclanTiaoIcssVarianceChangepoint(w));
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: detects variance increase', () => {
  const w: number[] = [];
  for (let i = 0; i < 25; i += 1) w.push(100 + (i % 2 === 0 ? 1 : -1));
  for (let i = 0; i < 25; i += 1) w.push(100 + (i % 2 === 0 ? 50 : -50));
  const r = dailyTokenInclanTiaoIcssVarianceChangepoint(w);
  assert.equal(r.nSamples, 50);
  assert.ok(r.itStat > ICSS_CRITICAL_05);
  assert.ok(r.significant05);
  assert.ok(r.pApprox < 0.05);
  // variance INCREASE on right => varAfter > varBefore => logVarRatio > 0
  assert.ok(r.logVarRatio > 0);
  // directionSign matches D[kStar] convention (negative when variance grows on right)
  assert.equal(r.directionSign, -1);
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: detects variance decrease', () => {
  const w: number[] = [];
  for (let i = 0; i < 25; i += 1) w.push(100 + (i % 2 === 0 ? 50 : -50));
  for (let i = 0; i < 25; i += 1) w.push(100 + (i % 2 === 0 ? 1 : -1));
  const r = dailyTokenInclanTiaoIcssVarianceChangepoint(w);
  assert.ok(r.itStat > ICSS_CRITICAL_05);
  assert.ok(r.logVarRatio < 0);
  assert.equal(r.directionSign, 1);
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: insignificant under H0', () => {
  // pseudo-iid Gaussian-like via deterministic permutation of fixed magnitudes
  const w: number[] = [];
  // Simple periodic series with constant variance
  for (let i = 0; i < 50; i += 1) {
    w.push(100 + 5 * Math.sin(i * 0.7));
  }
  const r = dailyTokenInclanTiaoIcssVarianceChangepoint(w);
  // Constant unconditional variance; itStat should not exceed 1.628 (alpha=0.01)
  assert.ok(r.itStat < ICSS_CRITICAL_01, `itStat=${r.itStat}`);
  assert.equal(r.significant01, false);
});

test('dailyTokenInclanTiaoIcssVarianceChangepoint: pApprox in [0,1]', () => {
  const w: number[] = [];
  for (let i = 0; i < 30; i += 1) w.push(100 + (i % 2 === 0 ? 1 : -1));
  for (let i = 0; i < 30; i += 1) w.push(100 + (i % 2 === 0 ? 20 : -20));
  const r = dailyTokenInclanTiaoIcssVarianceChangepoint(w);
  assert.ok(r.pApprox >= 0 && r.pApprox <= 1);
});

// ---- builder integration -------------------------------------------------

test('icss: empty queue returns zero rows', () => {
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.kCritical05, 1.358);
  assert.equal(r.kCritical01, 1.628);
});

test('icss: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'A', 1000)];
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('icss: drops non-positive tokens', () => {
  const queue: QueueLine[] = [ql('2026-01-01T00:00:00.000Z', 'A', 0)];
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('icss: drops sparse sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'tiny', 10));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('icss: drops below-min-tenure sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'short', 1000));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('icss: drops zero-variance sources (constant daily totals)', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'flat', 1000));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
    minTokens: 100,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('icss: detects a real per-source variance changepoint', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'shifty', 1000 + (i % 2 === 0 ? 5 : -5)));
  }
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 31 + i)).toISOString();
    queue.push(ql(day, 'shifty', 1000 + (i % 2 === 0 ? 200 : -200)));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'shifty');
  assert.ok(row.itStat > ICSS_CRITICAL_05);
  assert.ok(row.significant05);
  assert.ok(row.logVarRatio > 0);
  assert.equal(row.directionSign, -1);
  // kStar should be near true changepoint at index 29
  assert.ok(Math.abs(row.kStar - 29) <= 5, `kStar=${row.kStar}`);
});

test('icss: source filter restricts analysis', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'A', 1000 + i * 10));
    queue.push(ql(day, 'B', 1000 + i * 5));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
    source: 'A',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
  assert.ok(r.droppedSourceFilter > 0);
});

test('icss: top cap drops excess sources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
      const tokens =
        src === 'A'
          ? 1000 + (i < 15 ? 1 : 50) * (i % 2 === 0 ? 1 : -1) + 1000
          : 1000 + (i % 2 === 0 ? 5 : -5) + (src === 'B' ? i : i * 2);
      queue.push(ql(day, src, Math.max(1, tokens)));
    }
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('icss: sort modes all produce stable ordering', () => {
  const queue: QueueLine[] = [];
  for (const src of ['Alpha', 'Beta', 'Gamma']) {
    for (let i = 0; i < 30; i += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
      queue.push(
        ql(day, src, 1000 + (i < 15 ? 1 : 50) * (i % 2 === 0 ? 1 : -1) + 100),
      );
    }
  }
  const sorts: Array<
    | 'itStat'
    | 'itStatDesc'
    | 'pApprox'
    | 'pApproxDesc'
    | 'kStar'
    | 'kStarDesc'
    | 'absLogVarRatio'
    | 'absLogVarRatioDesc'
    | 'secondPeakRatio'
    | 'secondPeakRatioDesc'
    | 'tokens'
    | 'tenure'
    | 'source'
  > = [
    'itStat',
    'itStatDesc',
    'pApprox',
    'pApproxDesc',
    'kStar',
    'kStarDesc',
    'absLogVarRatio',
    'absLogVarRatioDesc',
    'secondPeakRatio',
    'secondPeakRatioDesc',
    'tokens',
    'tenure',
    'source',
  ];
  for (const s of sorts) {
    const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
      generatedAt: GEN,
      sort: s,
    });
    assert.equal(r.sources.length, 3);
    assert.equal(r.sort, s);
  }
});

test('icss: window since/until filters', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 60; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'A', 1000 + (i % 2 === 0 ? 5 : -5)));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
    since: '2026-01-15T00:00:00.000Z',
    until: '2026-02-15T00:00:00.000Z',
  });
  assert.equal(r.windowStart, '2026-01-15T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-02-15T00:00:00.000Z');
});

test('icss: report exposes critical values in payload', () => {
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.kCritical05, ICSS_CRITICAL_05);
  assert.equal(r.kCritical01, ICSS_CRITICAL_01);
});

test('icss: row fields all present and finite for healthy fit', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'src', 1000 + (i % 2 === 0 ? 5 : -5)));
  }
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 31 + i)).toISOString();
    queue.push(ql(day, 'src', 1000 + (i % 2 === 0 ? 80 : -80)));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(Number.isFinite(row.itStat));
  assert.ok(Number.isFinite(row.dStar));
  assert.ok(Number.isFinite(row.varBefore));
  assert.ok(Number.isFinite(row.varAfter));
  assert.ok(Number.isFinite(row.logVarRatio));
  assert.ok(Number.isFinite(row.pApprox));
  assert.ok(Number.isFinite(row.lEdgeRatio));
  assert.ok(Number.isFinite(row.secondPeakRatio));
  assert.ok(typeof row.kStarDay === 'string');
  assert.ok(row.kStar >= 0 && row.kStar < row.nTenureDays - 1);
});

test('icss: gap-filling of missing days surfaces zeros', () => {
  const queue: QueueLine[] = [];
  // sparse: day 0..14 active, day 15..29 active but a long gap in middle
  for (let i = 0; i < 15; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'gappy', 1000 + (i % 2 === 0 ? 5 : -5)));
  }
  // skip days 15..24 (zero tokens); resume 25..39
  for (let i = 25; i < 40; i += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    queue.push(ql(day, 'gappy', 1000 + (i % 2 === 0 ? 5 : -5)));
  }
  const r = buildDailyTokenInclanTiaoIcssVarianceChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Tenure spans day 0..39 inclusive = 40 days
  assert.equal(row.nTenureDays, 40);
  // The introduced zeros create LARGE within-window variance vs surrounding
  assert.ok(row.itStat > 0);
});

test('icss: directionSign accuracy for synthetic abrupt-variance toy', () => {
  // small variance left, large variance right: directionSign -1
  const w: number[] = [];
  for (let i = 0; i < 22; i += 1) w.push(100 + (i % 2 === 0 ? 0.5 : -0.5));
  for (let i = 0; i < 22; i += 1) w.push(100 + (i % 2 === 0 ? 30 : -30));
  const r = dailyTokenInclanTiaoIcssVarianceChangepoint(w);
  assert.equal(r.directionSign, -1);
  // logVarRatio = ln(varAfter/varBefore) > 0 because right has higher variance
  assert.ok(r.logVarRatio > 1);
});
