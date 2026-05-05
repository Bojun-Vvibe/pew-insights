import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenCoxStuartThirdsTrend,
  buildDailyTokenCoxStuartThirdsTrend,
  countCoxStuartThirdsPairs,
  standardNormalUpperTailCoxStuartThirds,
} from '../src/dailytokencoxstuartthirdstrend.js';
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

// ---------- countCoxStuartThirdsPairs ----------

test('countCoxStuartThirdsPairs: n=9 -> m=3, gap=6, pairs (0,6)(1,7)(2,8)', () => {
  // strictly increasing => every late > early
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = countCoxStuartThirdsPairs(v);
  assert.equal(r.csTPairs, 3);
  assert.equal(r.csTGap, 6);
  assert.equal(r.csTPlus, 3);
  assert.equal(r.csTMinus, 0);
  assert.equal(r.csTTies, 0);
});

test('countCoxStuartThirdsPairs: n=10 -> m=3, gap=7, pairs (0,7)(1,8)(2,9)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = countCoxStuartThirdsPairs(v);
  assert.equal(r.csTPairs, 3);
  assert.equal(r.csTGap, 7);
  assert.equal(r.csTPlus, 3);
});

test('countCoxStuartThirdsPairs: n=12 -> m=4, gap=8, equality gap=2*m', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = countCoxStuartThirdsPairs(v);
  assert.equal(r.csTPairs, 4);
  assert.equal(r.csTGap, 8);
  assert.equal(r.csTGap, 2 * r.csTPairs);
});

test('countCoxStuartThirdsPairs: gap = n - floor(n/3) holds for n in [3..40]', () => {
  for (let n = 3; n <= 40; n += 1) {
    const v = new Array<number>(n).fill(0).map((_, i) => i);
    const r = countCoxStuartThirdsPairs(v);
    assert.equal(r.csTPairs, Math.floor(n / 3));
    assert.equal(r.csTGap, n - Math.floor(n / 3));
    assert.ok(
      r.csTGap >= 2 * r.csTPairs,
      `gap >= 2*pairs invariant violated at n=${n}`,
    );
  }
});

test('countCoxStuartThirdsPairs: strictly decreasing => csTMinus = pairs', () => {
  const v = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const r = countCoxStuartThirdsPairs(v);
  assert.equal(r.csTMinus, 3);
  assert.equal(r.csTPlus, 0);
  assert.equal(r.csTTies, 0);
});

test('countCoxStuartThirdsPairs: all-equal => all ties', () => {
  const v = [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4];
  const r = countCoxStuartThirdsPairs(v);
  assert.equal(r.csTTies, 4);
  assert.equal(r.csTPlus, 0);
  assert.equal(r.csTMinus, 0);
});

test('countCoxStuartThirdsPairs: empty / singleton => zero pairs', () => {
  assert.equal(countCoxStuartThirdsPairs([]).csTPairs, 0);
  assert.equal(countCoxStuartThirdsPairs([5]).csTPairs, 0);
  assert.equal(countCoxStuartThirdsPairs([1, 2]).csTPairs, 0);
});

test('countCoxStuartThirdsPairs: csTPlus + csTMinus + csTTies = csTPairs', () => {
  const v = [
    3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3,
    3, 8, 3, 2, 7,
  ];
  const r = countCoxStuartThirdsPairs(v);
  assert.equal(r.csTPlus + r.csTMinus + r.csTTies, r.csTPairs);
});

test('countCoxStuartThirdsPairs: middle third is genuinely dropped', () => {
  // n=12, m=4, gap=8. Middle indices 4..7 should NOT affect pairs (0,8)(1,9)(2,10)(3,11).
  const baseline = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const corruptedMiddle = [1, 2, 3, 4, 999, -999, 999, -999, 9, 10, 11, 12];
  const a = countCoxStuartThirdsPairs(baseline);
  const b = countCoxStuartThirdsPairs(corruptedMiddle);
  assert.deepEqual(a, b);
});

// ---------- standardNormalUpperTailCoxStuartThirds ----------

test('standardNormalUpperTailCoxStuartThirds: Q(0) ~ 0.5', () => {
  assert.ok(
    Math.abs(standardNormalUpperTailCoxStuartThirds(0) - 0.5) < 1e-7,
  );
});

test('standardNormalUpperTailCoxStuartThirds: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailCoxStuartThirds(1.96);
  assert.ok(Math.abs(q - 0.025) < 5e-4);
});

test('standardNormalUpperTailCoxStuartThirds: Q(-z) = 1 - Q(z)', () => {
  for (const z of [0.1, 0.5, 1.0, 2.0, 3.5]) {
    const a = standardNormalUpperTailCoxStuartThirds(z);
    const b = standardNormalUpperTailCoxStuartThirds(-z);
    assert.ok(Math.abs(a + b - 1) < 1e-7, `Q(${z})+Q(-${z}) != 1`);
  }
});

test('standardNormalUpperTailCoxStuartThirds: monotone decreasing', () => {
  let prev = standardNormalUpperTailCoxStuartThirds(-3);
  for (let z = -2.5; z <= 3.0; z += 0.5) {
    const cur = standardNormalUpperTailCoxStuartThirds(z);
    assert.ok(cur <= prev, `not monotone at z=${z}`);
    prev = cur;
  }
});

test('standardNormalUpperTailCoxStuartThirds: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailCoxStuartThirds(NaN));
  assert.throws(() => standardNormalUpperTailCoxStuartThirds(Infinity));
});

test('standardNormalUpperTailCoxStuartThirds: clamps to [0,1]', () => {
  const tail = standardNormalUpperTailCoxStuartThirds(10);
  assert.ok(tail >= 0 && tail <= 1);
  const head = standardNormalUpperTailCoxStuartThirds(-10);
  assert.ok(head >= 0 && head <= 1);
});

// ---------- dailyTokenCoxStuartThirdsTrend ----------

test('dailyTokenCoxStuartThirdsTrend: n<24 throws', () => {
  const v = new Array(23).fill(0).map((_, i) => i + 1);
  assert.throws(() => dailyTokenCoxStuartThirdsTrend(v));
});

test('dailyTokenCoxStuartThirdsTrend: non-finite values throw', () => {
  const v = new Array(24).fill(1);
  v[5] = NaN;
  assert.throws(() => dailyTokenCoxStuartThirdsTrend(v));
});

test('dailyTokenCoxStuartThirdsTrend: zero-variance throws', () => {
  const v = new Array(24).fill(7);
  assert.throws(() => dailyTokenCoxStuartThirdsTrend(v));
});

test('dailyTokenCoxStuartThirdsTrend: strict-up monotone => max +Z', () => {
  const v = new Array(30).fill(0).map((_, i) => i + 1);
  const r = dailyTokenCoxStuartThirdsTrend(v);
  // m=10, gap=20, all 10 pairs positive
  assert.equal(r.csTPairs, 10);
  assert.equal(r.csTGap, 20);
  assert.equal(r.csTPlus, 10);
  assert.equal(r.csTMinus, 0);
  assert.equal(r.csTTies, 0);
  assert.equal(r.csTNonTies, 10);
  // (10 - 5)/sqrt(2.5) = 5/1.5811... = 3.16228
  assert.ok(Math.abs(r.csTZ - 3.1622776601683795) < 1e-9);
  // p-value tiny
  assert.ok(r.csTPValue < 0.005);
});

test('dailyTokenCoxStuartThirdsTrend: strict-down monotone => max -Z', () => {
  const v = new Array(30).fill(0).map((_, i) => 30 - i);
  const r = dailyTokenCoxStuartThirdsTrend(v);
  assert.equal(r.csTMinus, 10);
  assert.equal(r.csTPlus, 0);
  assert.ok(Math.abs(r.csTZ + 3.1622776601683795) < 1e-9);
});

test('dailyTokenCoxStuartThirdsTrend: translation invariance', () => {
  const v = [
    3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3,
    3, 8, 3, 2, 7,
  ];
  const a = dailyTokenCoxStuartThirdsTrend(v);
  const b = dailyTokenCoxStuartThirdsTrend(v.map((x) => x + 1000));
  assert.equal(a.csTPlus, b.csTPlus);
  assert.equal(a.csTMinus, b.csTMinus);
  assert.equal(a.csTTies, b.csTTies);
  assert.ok(Math.abs(a.csTZ - b.csTZ) < 1e-12);
});

test('dailyTokenCoxStuartThirdsTrend: positive-scale invariance of signs', () => {
  const v = [
    3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3,
    3, 8, 3, 2, 7,
  ];
  const a = dailyTokenCoxStuartThirdsTrend(v);
  const b = dailyTokenCoxStuartThirdsTrend(v.map((x) => x * 17.5));
  assert.equal(a.csTPlus, b.csTPlus);
  assert.equal(a.csTMinus, b.csTMinus);
  assert.equal(a.csTTies, b.csTTies);
  assert.ok(Math.abs(a.csTZ - b.csTZ) < 1e-12);
});

test('dailyTokenCoxStuartThirdsTrend: negation flips Z sign on tie-free input', () => {
  const v: number[] = [];
  for (let i = 0; i < 30; i += 1) v.push(i * 1.7 + 0.3);
  const a = dailyTokenCoxStuartThirdsTrend(v);
  const b = dailyTokenCoxStuartThirdsTrend(v.map((x) => -x));
  assert.equal(a.csTPlus, b.csTMinus);
  assert.equal(a.csTMinus, b.csTPlus);
  assert.equal(a.csTTies, b.csTTies);
  assert.ok(Math.abs(a.csTZ + b.csTZ) < 1e-12);
});

test('dailyTokenCoxStuartThirdsTrend: csTZ formula matches definition', () => {
  // Construct exact mix: 6 positives, 4 negatives among 10 pairs.
  // n=30, m=10, gap=20. Pairs (i, i+20).
  // Make pair i positive iff i in {0..5}, negative iff i in {6..9}.
  const v = new Array<number>(30).fill(50);
  for (let i = 0; i < 6; i += 1) {
    v[i + 20] = 100 + i; // late > 50
  }
  for (let i = 6; i < 10; i += 1) {
    v[i + 20] = 10 + i; // late < 50
  }
  // Disambiguate centred variance and ensure no zero-variance throw:
  v[10] = 60;
  v[15] = 40;
  const r = dailyTokenCoxStuartThirdsTrend(v);
  assert.equal(r.csTPlus, 6);
  assert.equal(r.csTMinus, 4);
  assert.equal(r.csTTies, 0);
  assert.equal(r.csTNonTies, 10);
  // Z = (6 - 5)/sqrt(2.5)
  const expectedZ = 1 / Math.sqrt(2.5);
  assert.ok(Math.abs(r.csTZ - expectedZ) < 1e-12);
  // Two-sided p-value
  const expectedP =
    2 * standardNormalUpperTailCoxStuartThirds(Math.abs(expectedZ));
  assert.ok(Math.abs(r.csTPValue - expectedP) < 1e-12);
});

test('dailyTokenCoxStuartThirdsTrend: too few non-ties throws', () => {
  // Make most pairs ties (so csTNonTies < 8). n=30, m=10.
  const v = new Array<number>(30).fill(5);
  // Force only 1 non-tied pair (csTPlus=1, rest ties).
  v[20] = 100; // pair (0, 20): 100 > 5 => positive
  // All other pairs (i, i+20) have v[i]=v[i+20]=5 => ties.
  // But all-equal triggers zero-variance. Add small noise that stays tied at thirds-pair lag.
  // Add bumps only to indices in middle third (10..19) – they are dropped but still affect variance.
  v[12] = 6;
  v[15] = 4;
  assert.throws(() => dailyTokenCoxStuartThirdsTrend(v));
});

test('dailyTokenCoxStuartThirdsTrend: csTPairs + csTGap = n', () => {
  for (const n of [24, 25, 26, 30, 33, 50, 99, 100, 101]) {
    const v = new Array<number>(n).fill(0).map((_, i) => i + 1);
    const r = dailyTokenCoxStuartThirdsTrend(v);
    assert.equal(r.csTPairs + r.csTGap, n);
  }
});

test('dailyTokenCoxStuartThirdsTrend: gap >= 2*pairs invariant on real range', () => {
  for (const n of [24, 25, 26, 30, 33, 60, 99, 100, 101]) {
    const v = new Array<number>(n).fill(0).map((_, i) => i + 1);
    const r = dailyTokenCoxStuartThirdsTrend(v);
    assert.ok(r.csTGap >= 2 * r.csTPairs);
  }
});

test('dailyTokenCoxStuartThirdsTrend: middle-third corruption does not change Z', () => {
  // n=30, m=10, gap=20. Middle indices 10..19 dropped from the statistic.
  const base = new Array<number>(30).fill(0).map((_, i) => (i + 1) * 1.0);
  const corrupted = base.slice();
  for (let i = 10; i < 20; i += 1) corrupted[i] = 9999 - i * 17;
  const a = dailyTokenCoxStuartThirdsTrend(base);
  const b = dailyTokenCoxStuartThirdsTrend(corrupted);
  assert.equal(a.csTPlus, b.csTPlus);
  assert.equal(a.csTMinus, b.csTMinus);
  assert.equal(a.csTTies, b.csTTies);
  assert.ok(Math.abs(a.csTZ - b.csTZ) < 1e-12);
});

test('dailyTokenCoxStuartThirdsTrend: |csTZ| upper bound = sqrt(csTNonTies)', () => {
  const v = new Array<number>(30).fill(0).map((_, i) => i + 1);
  const r = dailyTokenCoxStuartThirdsTrend(v);
  // max |Z| when csTPlus = csTNonTies => (k - k/2)/sqrt(k/4) = sqrt(k)
  assert.ok(Math.abs(Math.abs(r.csTZ) - Math.sqrt(r.csTNonTies)) < 1e-12);
});

test('dailyTokenCoxStuartThirdsTrend: csTPValue in [0, 1]', () => {
  for (const n of [24, 30, 45, 99]) {
    const v = new Array<number>(n).fill(0).map((_, i) => Math.sin(i) + i * 0.1);
    const r = dailyTokenCoxStuartThirdsTrend(v);
    assert.ok(r.csTPValue >= 0 && r.csTPValue <= 1);
  }
});

// ---------- buildDailyTokenCoxStuartThirdsTrend ----------

function makeQueueForSource(
  source: string,
  series: number[],
  startDayOffset = 0,
): QueueLine[] {
  return series.map((v, i) =>
    ql(dayIso(i + startDayOffset), source, Math.max(1, Math.round(v))),
  );
}

test('build: empty queue returns empty report', () => {
  const r = buildDailyTokenCoxStuartThirdsTrend([], { generatedAt: 'X' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.generatedAt, 'X');
});

test('build: rejects minTokens < 0', () => {
  assert.throws(() =>
    buildDailyTokenCoxStuartThirdsTrend([], { minTokens: -1 }),
  );
});

test('build: rejects minTenureDays < 24', () => {
  assert.throws(() =>
    buildDailyTokenCoxStuartThirdsTrend([], { minTenureDays: 23 }),
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenCoxStuartThirdsTrend([], { minTenureDays: 24.5 }),
  );
});

test('build: rejects negative top', () => {
  assert.throws(() => buildDailyTokenCoxStuartThirdsTrend([], { top: -1 }));
});

test('build: rejects bad sort key', () => {
  assert.throws(() =>
    buildDailyTokenCoxStuartThirdsTrend([], {
      sort: 'nonsense' as never,
    }),
  );
});

test('build: rejects bad since', () => {
  assert.throws(() =>
    buildDailyTokenCoxStuartThirdsTrend([], { since: 'not-a-date' }),
  );
});

test('build: rejects bad until', () => {
  assert.throws(() =>
    buildDailyTokenCoxStuartThirdsTrend([], { until: 'not-a-date' }),
  );
});

test('build: source filter restricts rows; non-match counts as droppedSourceFilter', () => {
  const a = makeQueueForSource('alpha', new Array(30).fill(100), 0);
  const b = makeQueueForSource('beta', new Array(30).fill(100), 0);
  const r = buildDailyTokenCoxStuartThirdsTrend([...a, ...b], {
    source: 'alpha',
    minTokens: 0,
  });
  assert.equal(r.source, 'alpha');
  assert.equal(r.droppedSourceFilter, 30);
});

test('build: sparse source dropped (below min-tokens)', () => {
  const q = makeQueueForSource('s1', new Array(30).fill(1), 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 1_000_000 });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

test('build: short tenure dropped (below min-tenure-days)', () => {
  const q = makeQueueForSource('s1', new Array(20).fill(1000), 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: zero-variance source dropped', () => {
  const q = makeQueueForSource('s1', new Array(30).fill(1000), 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: monotone-up source surfaces with high +csTZ', () => {
  const series = new Array(30).fill(0).map((_, i) => 1000 + i * 50);
  const q = makeQueueForSource('s1', series, 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.csTPlus, 10);
  assert.equal(row.csTMinus, 0);
  assert.ok(row.csTZ > 3);
  assert.ok(row.csTPValue < 0.005);
});

test('build: monotone-down source surfaces with high -csTZ', () => {
  const series = new Array(30).fill(0).map((_, i) => 5000 - i * 50);
  const q = makeQueueForSource('s1', series, 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.csTMinus, 10);
  assert.equal(row.csTPlus, 0);
  assert.ok(row.csTZ < -3);
});

test('build: middle-third spike does not change ranks/Z', () => {
  // n=30, base monotone up; spike middle (indices 10..19) only.
  const base = new Array(30).fill(0).map((_, i) => 1000 + i * 50);
  const spiked = base.slice();
  for (let i = 10; i < 20; i += 1) spiked[i] = 999_999;
  const a = buildDailyTokenCoxStuartThirdsTrend(
    makeQueueForSource('s1', base, 0),
    { minTokens: 0, generatedAt: 'X' },
  );
  const b = buildDailyTokenCoxStuartThirdsTrend(
    makeQueueForSource('s1', spiked, 0),
    { minTokens: 0, generatedAt: 'X' },
  );
  assert.equal(a.sources[0]!.csTZ, b.sources[0]!.csTZ);
  assert.equal(a.sources[0]!.csTPlus, b.sources[0]!.csTPlus);
});

test('build: top cap surfaces droppedTopSources', () => {
  const queues: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    const series = new Array(30).fill(0).map((_, i) => 1000 + i * (s + 1));
    queues.push(...makeQueueForSource(`src${s}`, series, 0));
  }
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: sort csTZ ascending', () => {
  const queues: QueueLine[] = [];
  // up-trend
  queues.push(
    ...makeQueueForSource(
      'up',
      new Array(30).fill(0).map((_, i) => 1000 + i * 50),
      0,
    ),
  );
  // down-trend
  queues.push(
    ...makeQueueForSource(
      'down',
      new Array(30).fill(0).map((_, i) => 5000 - i * 50),
      0,
    ),
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    sort: 'csTZ',
  });
  assert.equal(r.sources[0]!.source, 'down');
  assert.equal(r.sources[1]!.source, 'up');
});

test('build: sort csTZAbsDesc puts strongest |Z| first', () => {
  const queues: QueueLine[] = [];
  queues.push(
    ...makeQueueForSource(
      'strong',
      new Array(30).fill(0).map((_, i) => 1000 + i * 200),
      0,
    ),
  );
  queues.push(
    ...makeQueueForSource(
      'weak',
      // alternating noisy series with roughly balanced sign
      new Array(30).fill(0).map((_, i) => 1000 + (i % 2 === 0 ? 50 : -50)),
      0,
    ),
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    sort: 'csTZAbsDesc',
  });
  assert.equal(r.sources[0]!.source, 'strong');
});

test('build: sort csTPValue ascending puts most-significant first', () => {
  const queues: QueueLine[] = [];
  queues.push(
    ...makeQueueForSource(
      'sig',
      new Array(30).fill(0).map((_, i) => 1000 + i * 200),
      0,
    ),
  );
  queues.push(
    ...makeQueueForSource(
      'noisy',
      new Array(30).fill(0).map((_, i) => 1000 + (i % 2 === 0 ? 50 : -50)),
      0,
    ),
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    sort: 'csTPValue',
  });
  assert.equal(r.sources[0]!.source, 'sig');
});

test('build: sort source falls back to alpha order on ties', () => {
  const queues: QueueLine[] = [];
  for (const name of ['zeta', 'alpha', 'mu']) {
    queues.push(
      ...makeQueueForSource(
        name,
        new Array(30).fill(0).map((_, i) => 1000 + i * 50),
        0,
      ),
    );
  }
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('build: sort tokens descending', () => {
  const queues: QueueLine[] = [];
  queues.push(
    ...makeQueueForSource(
      'small',
      new Array(30).fill(0).map((_, i) => 1000 + i * 50),
      0,
    ),
  );
  queues.push(
    ...makeQueueForSource(
      'big',
      new Array(30).fill(0).map((_, i) => 100_000 + i * 50),
      0,
    ),
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('build: sort tenure descending', () => {
  const queues: QueueLine[] = [];
  queues.push(
    ...makeQueueForSource(
      'short',
      new Array(30).fill(0).map((_, i) => 1000 + i * 50),
      0,
    ),
  );
  queues.push(
    ...makeQueueForSource(
      'long',
      new Array(60).fill(0).map((_, i) => 1000 + i * 50),
      0,
    ),
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, {
    minTokens: 0,
    sort: 'tenure',
  });
  assert.equal(r.sources[0]!.source, 'long');
});

test('build: gap-fill across missing days fills zeros (which become ties)', () => {
  // active days 0, 1, 28, 29 only -> tenure = 30, but most days are 0
  const queues: QueueLine[] = [
    ql(dayIso(0), 's1', 1000),
    ql(dayIso(1), 's1', 2000),
    ql(dayIso(28), 's1', 3000),
    ql(dayIso(29), 's1', 4000),
  ];
  const r = buildDailyTokenCoxStuartThirdsTrend(queues, { minTokens: 0 });
  // Tenure = 30, but most pairs are (0, 0) ties.
  // Expect droppedNonFiniteFit=1 because csTNonTies < 8 forces an internal throw
  // in the per-source builder (caught and re-counted as droppedNonFiniteFit).
  assert.equal(r.droppedNonFiniteFit, 1);
  assert.equal(r.sources.length, 0);
});

test('build: invalid hour_start counted as droppedInvalidHourStart', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's1', 1000),
    ...makeQueueForSource(
      's1',
      new Array(30).fill(0).map((_, i) => 1000 + i * 50),
      0,
    ),
  ];
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens dropped', () => {
  const q: QueueLine[] = [
    ql(dayIso(0), 's1', 0),
    ql(dayIso(1), 's1', -5),
    ...makeQueueForSource(
      's1',
      new Array(30).fill(0).map((_, i) => 1000 + i * 50),
      2,
    ),
  ];
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: window since/until filters', () => {
  const q = makeQueueForSource(
    's1',
    new Array(60).fill(0).map((_, i) => 1000 + i * 50),
    0,
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(q, {
    minTokens: 0,
    since: dayIso(10),
    until: dayIso(50),
  });
  assert.equal(r.windowStart, dayIso(10));
  assert.equal(r.windowEnd, dayIso(50));
  // Tenure should be ~40 days
  if (r.sources.length > 0) {
    assert.ok(r.sources[0]!.nTenureDays <= 40);
  }
});

test('build: empty source string aliases to (unknown)', () => {
  const q = makeQueueForSource(
    '',
    new Array(30).fill(0).map((_, i) => 1000 + i * 50),
    0,
  );
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('build: row exposes csTPairs + csTGap = nTenureDays', () => {
  const series = new Array(45).fill(0).map((_, i) => 1000 + i * 50);
  const q = makeQueueForSource('s1', series, 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, { minTokens: 0 });
  const row = r.sources[0]!;
  assert.equal(row.csTPairs + row.csTGap, row.nTenureDays);
  assert.equal(row.csTPairs, Math.floor(45 / 3));
  assert.equal(row.csTGap, 45 - 15);
});

test('build: report headline mirrors options', () => {
  const series = new Array(30).fill(0).map((_, i) => 1000 + i * 50);
  const q = makeQueueForSource('s1', series, 0);
  const r = buildDailyTokenCoxStuartThirdsTrend(q, {
    minTokens: 0,
    minTenureDays: 25,
    top: 5,
    sort: 'tenure',
    generatedAt: 'fixed',
  });
  assert.equal(r.minTokens, 0);
  assert.equal(r.minTenureDays, 25);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'tenure');
  assert.equal(r.generatedAt, 'fixed');
});

test('build: deterministic on fixed input', () => {
  const series = new Array(30).fill(0).map((_, i) => 1000 + i * 50);
  const q = makeQueueForSource('s1', series, 0);
  const a = buildDailyTokenCoxStuartThirdsTrend(q, {
    minTokens: 0,
    generatedAt: 'fixed',
  });
  const b = buildDailyTokenCoxStuartThirdsTrend(q, {
    minTokens: 0,
    generatedAt: 'fixed',
  });
  assert.deepEqual(a, b);
});
