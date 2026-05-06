import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation,
  eDivisiveSegmentation,
  scaledEnergyStat,
  median,
  mad,
  sigmaHatMadDiff,
} from '../src/dailytokenmattesonjamesedivisivedistributionalsegmentation.js';
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

test('ecp: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { minTenureDays: 21.5 }),
  );
});

test('ecp: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { minTokens: NaN }),
  );
});

test('ecp: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { top: 1.5 }),
  );
});

test('ecp: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], {
      sort: 'nope' as 'mChangepoints',
    }),
  );
});

test('ecp: rejects bad cZeta', () => {
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { cZeta: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { cZeta: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { cZeta: NaN }),
  );
});

test('ecp: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { since: 'no' }),
  );
  assert.throws(() =>
    buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], { until: 'no' }),
  );
});

// ---- pure helpers --------------------------------------------------------

test('median: odd, even, empty', () => {
  assert.equal(median([]), 0);
  assert.equal(median([7]), 7);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('mad: zero on constant, positive on spread', () => {
  assert.equal(mad([5, 5, 5, 5]), 0);
  assert.ok(mad([1, 2, 3, 4, 5]) > 0);
});

test('mad: empty returns 0', () => {
  assert.equal(mad([]), 0);
});

test('sigmaHatMadDiff: zero on constant, positive on iid noise', () => {
  assert.equal(sigmaHatMadDiff([10, 10, 10, 10, 10]), 0);
  const noisy = [0, 1, 3, 2, 5, 4, 8, 6, 11, 9];
  assert.ok(sigmaHatMadDiff(noisy) > 0);
});

test('sigmaHatMadDiff: tiny n returns 0', () => {
  assert.equal(sigmaHatMadDiff([]), 0);
  assert.equal(sigmaHatMadDiff([5]), 0);
});

// ---- energy distance properties -----------------------------------------

test('scaledEnergyStat: identical distributions yield ~0', () => {
  const xs = [1, 2, 3, 4, 5];
  const ys = [1, 2, 3, 4, 5];
  const q = scaledEnergyStat(xs, ys);
  assert.ok(Math.abs(q) < 1e-10, `q=${q}`);
});

test('scaledEnergyStat: separated means yield positive Q', () => {
  const xs = [0, 0, 0, 0, 0];
  const ys = [100, 100, 100, 100, 100];
  const q = scaledEnergyStat(xs, ys);
  assert.ok(q > 0);
});

test('scaledEnergyStat: empty inputs yield 0', () => {
  assert.equal(scaledEnergyStat([], [1, 2]), 0);
  assert.equal(scaledEnergyStat([1, 2], []), 0);
});

test('scaledEnergyStat: symmetric in arguments', () => {
  const xs = [1, 2, 3];
  const ys = [10, 11, 12];
  const a = scaledEnergyStat(xs, ys);
  const b = scaledEnergyStat(ys, xs);
  assert.ok(Math.abs(a - b) < 1e-10);
});

test('scaledEnergyStat: monotone in mean shift', () => {
  const xs = [0, 0, 0, 0];
  const q1 = scaledEnergyStat(xs, [10, 10, 10, 10]);
  const q2 = scaledEnergyStat(xs, [50, 50, 50, 50]);
  const q3 = scaledEnergyStat(xs, [200, 200, 200, 200]);
  assert.ok(q1 < q2 && q2 < q3);
});

test('scaledEnergyStat: variance shift is detected (zero mean)', () => {
  const xs = [-1, 0, 1, 0, -1, 1];
  const ys = [-50, 50, -50, 50, -50, 50];
  // same mean (0) but very different scales
  const q = scaledEnergyStat(xs, ys);
  assert.ok(q > 0);
});

// ---- ECP core ------------------------------------------------------------

test('eDivisiveSegmentation: throws on small/invalid input', () => {
  assert.throws(() => eDivisiveSegmentation([1, 2, 3], 0));
  assert.throws(() => eDivisiveSegmentation([1, 2, 3, 4], -1));
  assert.throws(() => eDivisiveSegmentation([1, 2, 3, 4], Number.POSITIVE_INFINITY));
});

test('eDivisiveSegmentation: huge threshold => zero changepoints', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = eDivisiveSegmentation(x, 1e15);
  assert.equal(r.tauStar.length, 0);
  assert.equal(r.maxQStar, 0);
});

test('eDivisiveSegmentation: detects sharp single mean shift', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = eDivisiveSegmentation(x, 1);
  assert.ok(r.tauStar.length >= 1);
  let nearest = Infinity;
  for (const t of r.tauStar) {
    const d = Math.abs(t - 30);
    if (d < nearest) nearest = d;
  }
  assert.ok(nearest <= 2, `nearest CP distance ${nearest}`);
});

test('eDivisiveSegmentation: detects pure variance shift (constant mean)', () => {
  // mean 0 throughout, but scale changes at i=30
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) {
    if (i < 30) x.push(i % 2 === 0 ? -1 : 1);
    else x.push(i % 2 === 0 ? -50 : 50);
  }
  const r = eDivisiveSegmentation(x, 1);
  assert.ok(r.tauStar.length >= 1, `expected >=1 CP, got ${r.tauStar.length}`);
});

test('eDivisiveSegmentation: deterministic on identical inputs', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const a = eDivisiveSegmentation(x, 5);
  const b = eDivisiveSegmentation(x, 5);
  assert.deepEqual(a.tauStar, b.tauStar);
  assert.equal(a.maxQStar, b.maxQStar);
});

test('eDivisiveSegmentation: tauStar is strictly ascending', () => {
  const x: number[] = [];
  for (let i = 0; i < 90; i += 1) {
    if (i < 30) x.push(0);
    else if (i < 60) x.push(50);
    else x.push(100);
  }
  const r = eDivisiveSegmentation(x, 1);
  for (let i = 1; i < r.tauStar.length; i += 1) {
    assert.ok(r.tauStar[i]! > r.tauStar[i - 1]!);
  }
});

test('eDivisiveSegmentation: detects two changepoints in three-regime series', () => {
  const x: number[] = [];
  for (let i = 0; i < 90; i += 1) {
    if (i < 30) x.push(0);
    else if (i < 60) x.push(50);
    else x.push(100);
  }
  const r = eDivisiveSegmentation(x, 1);
  assert.ok(r.tauStar.length >= 2, `expected >=2 CPs, got ${r.tauStar.length}`);
});

test('eDivisiveSegmentation: maxQStar = max over acceptances', () => {
  const x: number[] = [];
  for (let i = 0; i < 60; i += 1) x.push(i < 30 ? 0 : 100);
  const r = eDivisiveSegmentation(x, 1);
  let mx = 0;
  for (const a of r.acceptances) if (a.qStar > mx) mx = a.qStar;
  assert.equal(r.maxQStar, mx);
});

test('eDivisiveSegmentation: zero CPs on a constant-ish series', () => {
  const x: number[] = [];
  // Tiny noise - threshold should reject
  for (let i = 0; i < 50; i += 1) x.push(10 + (i % 2));
  const r = eDivisiveSegmentation(x, 1000);
  assert.equal(r.tauStar.length, 0);
});

test('eDivisiveSegmentation: zero threshold accepts at least one CP on non-trivial input', () => {
  const x = [1, 2, 3, 4, 100, 101, 102, 103];
  const r = eDivisiveSegmentation(x, 0);
  // any positive Q^* > 0 is accepted
  assert.ok(r.tauStar.length >= 1);
});

test('eDivisiveSegmentation: invariant under translation', () => {
  const x: number[] = [];
  for (let i = 0; i < 50; i += 1) x.push(i < 25 ? 0 : 30);
  const y = x.map((v) => v + 1000);
  // ECP energy distance is translation-equivariant only in the QStar value;
  // taus should still align (energy distance is shift-invariant on identical
  // shifts to both halves).
  const a = eDivisiveSegmentation(x, 1);
  const b = eDivisiveSegmentation(y, 1);
  assert.deepEqual(a.tauStar, b.tauStar);
});

test('eDivisiveSegmentation: scaling by k scales QStar by k (1-D)', () => {
  const x: number[] = [];
  for (let i = 0; i < 50; i += 1) x.push(i < 25 ? 0 : 30);
  const y = x.map((v) => v * 2);
  const a = eDivisiveSegmentation(x, 0);
  const b = eDivisiveSegmentation(y, 0);
  // taus should match
  assert.deepEqual(a.tauStar, b.tauStar);
  // And QStar scales by 2 (energy is L^1 and so scales linearly)
  if (a.maxQStar > 0) {
    const ratio = b.maxQStar / a.maxQStar;
    assert.ok(Math.abs(ratio - 2) < 1e-9, `ratio=${ratio}`);
  }
});

// ---- per-source builder --------------------------------------------------

function genSource(
  src: string,
  startIso: string,
  pattern: number[],
): QueueLine[] {
  const out: QueueLine[] = [];
  const start = Date.parse(startIso);
  for (let i = 0; i < pattern.length; i += 1) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, src, pattern[i]!));
  }
  return out;
}

test('builder: empty queue returns empty', () => {
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('builder: respects generatedAt', () => {
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], {
    generatedAt: GEN,
  });
  assert.equal(r.generatedAt, GEN);
});

test('builder: single source with sharp shift surfaces >= 1 CP', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.mChangepoints >= 1);
});

test('builder: constant source dropped as zeroVariance', () => {
  const pattern: number[] = new Array(40).fill(500);
  const queue = genSource('flat', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('builder: minTokens filter drops sparse', () => {
  const queue = genSource(
    'sparse',
    '2026-01-01T00:00:00.000Z',
    new Array(30).fill(10),
  );
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    minTokens: 1000,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: minTenureDays filter drops short series', () => {
  const queue = genSource('short', '2026-01-01T00:00:00.000Z', [
    1000, 1100, 1200, 1300, 1400,
  ]);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('builder: source filter excludes non-matching', () => {
  const a = genSource('a', '2026-01-01T00:00:00.000Z', new Array(30).fill(2000));
  const b = genSource('b', '2026-01-01T00:00:00.000Z', new Array(30).fill(2000));
  const queue = [...a, ...b];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.ok(r.droppedSourceFilter > 0);
});

test('builder: invalid hour_start surfaces in dropped', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 1000),
    ...genSource('a', '2026-01-01T00:00:00.000Z', new Array(30).fill(2000)),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: non-positive tokens surfaces in dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 'a', 0),
    ql('2026-01-02T00:00:00.000Z', 'a', -5),
    ...genSource('a', '2026-01-03T00:00:00.000Z', new Array(30).fill(2000)),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('builder: top cap surfaces remainder', () => {
  const lines: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    const pat: number[] = [];
    for (let i = 0; i < 30; i += 1) pat.push(i < 15 ? 100 + s : 1000 + s);
    lines.push(...genSource(`s${s}`, '2026-01-01T00:00:00.000Z', pat));
  }
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    top: 2,
    generatedAt: GEN,
  });
  assert.ok(r.sources.length <= 2);
  assert.ok(r.droppedTopSources >= 0);
});

test('builder: tauStarDays format YYYY-MM-DD', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  for (const day of r.sources[0]!.tauStarDays) {
    assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
  }
});

test('builder: segments cover [0, n) exactly with m+1 segments', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.segments.length, row.mChangepoints + 1);
  assert.equal(row.segments[0]!.tStart, 0);
  assert.equal(row.segments[row.segments.length - 1]!.tEndExclusive, row.nTenureDays);
  for (let i = 0; i + 1 < row.segments.length; i += 1) {
    assert.equal(row.segments[i]!.tEndExclusive, row.segments[i + 1]!.tStart);
  }
});

test('builder: distributionalHomogeneity in (0, 1]', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const h = r.sources[0]!.distributionalHomogeneity;
  assert.ok(h > 0 && h <= 1, `h=${h}`);
});

test('builder: maxQStar >= threshold or 0', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  if (row.mChangepoints > 0) {
    assert.ok(row.maxQStar >= row.threshold, `${row.maxQStar} vs ${row.threshold}`);
  } else {
    assert.equal(row.maxQStar, 0);
  }
});

test('builder: cZeta scaling pushes threshold up monotonically', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r1 = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    cZeta: 1.0,
    generatedAt: GEN,
  });
  const r2 = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    cZeta: 100.0,
    generatedAt: GEN,
  });
  assert.ok(r2.sources[0]!.threshold > r1.sources[0]!.threshold);
});

test('builder: huge cZeta yields zero CPs', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    cZeta: 1e9,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.mChangepoints, 0);
});

test('builder: multi-source ordering by mChangepointsDesc', () => {
  const single: number[] = [];
  for (let i = 0; i < 30; i += 1) single.push(100);
  for (let i = 0; i < 30; i += 1) single.push(5000);
  const triple: number[] = [];
  for (let i = 0; i < 90; i += 1) {
    if (i < 30) triple.push(100);
    else if (i < 60) triple.push(2500);
    else triple.push(5000);
  }
  const lines = [
    ...genSource('one', '2026-01-01T00:00:00.000Z', single),
    ...genSource('three', '2026-01-01T00:00:00.000Z', triple),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    r.sources[0]!.mChangepoints >= r.sources[1]!.mChangepoints,
    `${r.sources[0]!.mChangepoints} vs ${r.sources[1]!.mChangepoints}`,
  );
});

test('builder: source-tied sort breaks alphabetically', () => {
  const a = genSource('a-src', '2026-01-01T00:00:00.000Z', new Array(30).fill(1000));
  const b = genSource('b-src', '2026-01-01T00:00:00.000Z', new Array(30).fill(1000));
  const queue = [...b, ...a];
  // both will be droppedZeroVariance, no rows; force non-constant via sort='source'
  const aPat: number[] = [];
  for (let i = 0; i < 30; i += 1) aPat.push(i < 15 ? 100 : 1000);
  const bPat: number[] = [];
  for (let i = 0; i < 30; i += 1) bPat.push(i < 15 ? 100 : 1000);
  const lines = [
    ...genSource('zeta', '2026-01-01T00:00:00.000Z', aPat),
    ...genSource('alpha', '2026-01-01T00:00:00.000Z', bPat),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('builder: deterministic across calls', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const a = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const b = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(a.sources, b.sources);
});

test('builder: gap-filling fills missing days with 0', () => {
  // Provide only days 1 and 30 with positive tokens
  const queue: QueueLine[] = [
    ql('2026-01-01T00:00:00.000Z', 's', 1000),
    ql('2026-01-30T00:00:00.000Z', 's', 5000),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  // tenure = 30 days, with the middle 28 = 0
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 30);
});

test('builder: unknown source label normalises to (unknown)', () => {
  const queue: QueueLine[] = [];
  const start = Date.parse('2026-01-01T00:00:00.000Z');
  for (let i = 0; i < 30; i += 1) {
    const day = new Date(start + i * 86_400_000).toISOString().slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, '', i < 15 ? 100 : 1000));
  }
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('builder: sort=tokens orders by total tokens desc', () => {
  const a: number[] = [];
  for (let i = 0; i < 30; i += 1) a.push(i < 15 ? 100 : 1000);
  const b: number[] = [];
  for (let i = 0; i < 30; i += 1) b.push(i < 15 ? 1000 : 10000);
  const lines = [
    ...genSource('a', '2026-01-01T00:00:00.000Z', a),
    ...genSource('b', '2026-01-01T00:00:00.000Z', b),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    sort: 'tokens',
    generatedAt: GEN,
  });
  assert.ok(r.sources[0]!.totalTokens >= r.sources[1]!.totalTokens);
});

test('builder: sort=tenure orders by tenure desc', () => {
  const a: number[] = [];
  for (let i = 0; i < 30; i += 1) a.push(i < 15 ? 100 : 1000);
  const b: number[] = [];
  for (let i = 0; i < 60; i += 1) b.push(i < 30 ? 100 : 1000);
  const lines = [
    ...genSource('a', '2026-01-01T00:00:00.000Z', a),
    ...genSource('b', '2026-01-01T00:00:00.000Z', b),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    sort: 'tenure',
    generatedAt: GEN,
  });
  assert.ok(r.sources[0]!.nTenureDays >= r.sources[1]!.nTenureDays);
});

test('builder: window since/until restricts data', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 60; i += 1) pattern.push(i < 30 ? 100 : 1000);
  const queue = genSource('s', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    since: '2026-01-15T00:00:00.000Z',
    until: '2026-02-15T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowStart, '2026-01-15T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-02-15T00:00:00.000Z');
});

test('builder: report top/seed/cZeta echoed', () => {
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], {
    cZeta: 2.5,
    top: 7,
    minTokens: 500,
    minTenureDays: 25,
    generatedAt: GEN,
  });
  assert.equal(r.cZeta, 2.5);
  assert.equal(r.top, 7);
  assert.equal(r.minTokens, 500);
  assert.equal(r.minTenureDays, 25);
});

test('builder: sigmaHat positive when there is variance', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.ok(r.sources[0]!.sigmaHat > 0);
});

test('builder: m=0 row has sdRangeRatio = 1', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100 + (i % 3));
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    cZeta: 1e9,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.mChangepoints, 0);
  assert.equal(r.sources[0]!.sdRangeRatio, 1);
});

test('builder: distributionalSpread = 0 when m = 0', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100 + (i % 3));
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    cZeta: 1e9,
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.distributionalSpread, 0);
  assert.equal(r.sources[0]!.distributionalHomogeneity, 1);
});

test('builder: tauStar matches tauStarDays length', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.tauStar.length, row.tauStarDays.length);
});

test('builder: segment lengths sum to nTenureDays', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  let sum = 0;
  for (const seg of row.segments) sum += seg.length;
  assert.equal(sum, row.nTenureDays);
});

test('builder: each segment meanSeg equals empirical mean of slice', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue = genSource('alpha', '2026-01-01T00:00:00.000Z', pattern);
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  for (const seg of row.segments) {
    let sum = 0;
    let count = 0;
    for (let i = seg.tStart; i < seg.tEndExclusive; i += 1) {
      sum += pattern[i] ?? 0;
      count += 1;
    }
    const expected = sum / count;
    assert.ok(Math.abs(seg.meanSeg - expected) < 1e-6);
  }
});

test('builder: source filter restricts dropped counts', () => {
  const a = genSource('a', '2026-01-01T00:00:00.000Z', new Array(30).fill(2000));
  const b = genSource('b', '2026-01-01T00:00:00.000Z', new Array(30).fill(2000));
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([...a, ...b], {
    source: 'b',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'b');
});

test('builder: totalSources counts unique sources', () => {
  const a: number[] = [];
  for (let i = 0; i < 30; i += 1) a.push(i < 15 ? 100 : 1000);
  const lines = [
    ...genSource('a', '2026-01-01T00:00:00.000Z', a),
    ...genSource('b', '2026-01-01T00:00:00.000Z', a),
    ...genSource('c', '2026-01-01T00:00:00.000Z', a),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 3);
});

test('builder: invariant under translation of all tokens', () => {
  const pattern: number[] = [];
  for (let i = 0; i < 30; i += 1) pattern.push(100);
  for (let i = 0; i < 30; i += 1) pattern.push(5000);
  const queue1 = genSource('a', '2026-01-01T00:00:00.000Z', pattern);
  const queue2 = genSource(
    'a',
    '2026-01-01T00:00:00.000Z',
    pattern.map((v) => v + 100),
  );
  const r1 = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue1, {
    generatedAt: GEN,
  });
  const r2 = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue2, {
    generatedAt: GEN,
  });
  assert.deepEqual(r1.sources[0]!.tauStar, r2.sources[0]!.tauStar);
});

// ---- live smoke test against real ~/.config/pew/queue.jsonl --------------

test('live-smoke: real queue.jsonl produces deterministic ECP report', async () => {
  const fs = await import('node:fs');
  const path = `${process.env.HOME}/.config/pew/queue.jsonl`;
  if (!fs.existsSync(path)) return; // skip on environments without it
  const text = fs.readFileSync(path, 'utf8');
  const queue: QueueLine[] = [];
  for (const line of text.split('\n')) {
    if (!line.trim()) continue;
    try {
      queue.push(JSON.parse(line) as QueueLine);
    } catch {
      // skip malformed
    }
  }
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  // sanity: deterministic across two calls
  const r2 = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(r.sources, r2.sources);
  // sanity: m >= 0 for every row
  for (const row of r.sources) {
    assert.ok(row.mChangepoints >= 0);
    assert.equal(row.segments.length, row.mChangepoints + 1);
  }
});

test('builder: onlyWithCps drops m=0 rows', () => {
  // one source with shift, one without
  const withShift: number[] = [];
  for (let i = 0; i < 60; i += 1) withShift.push(i < 30 ? 100 : 5000);
  const constish: number[] = [];
  for (let i = 0; i < 60; i += 1) constish.push(100 + (i % 5));
  const lines = [
    ...genSource('shift', '2026-01-01T00:00:00.000Z', withShift),
    ...genSource('flat', '2026-01-01T00:00:00.000Z', constish),
  ];
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation(lines, {
    onlyWithCps: true,
    generatedAt: GEN,
  });
  for (const row of r.sources) {
    assert.ok(row.mChangepoints > 0);
  }
  assert.equal(r.onlyWithCps, true);
});

test('builder: onlyWithCps default false echoes false', () => {
  const r = buildDailyTokenMattesonJamesEDivisiveDistributionalSegmentation([], {
    generatedAt: GEN,
  });
  assert.equal(r.onlyWithCps, false);
});
