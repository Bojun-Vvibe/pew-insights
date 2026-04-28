import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenWinsorizedMean10 } from '../src/sourcerowtokenwinsorizedmean10.js';
import { buildSourceRowTokenTrimMean25 } from '../src/sourcerowtokentrimmean25.js';
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

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

function winsorMean10Reference(xs: number[]): {
  mean: number;
  winsorizedMean: number;
  k: number;
  lo: number;
  hi: number;
} {
  const s = xs.slice().sort((a, b) => a - b);
  const n = s.length;
  const k = Math.floor(0.1 * n);
  const lo = s[k]!;
  const hi = s[n - k - 1]!;
  let totalSum = 0;
  for (let i = 0; i < n; i += 1) totalSum += s[i]!;
  let centralSum = 0;
  for (let i = k; i < n - k; i += 1) centralSum += s[i]!;
  const sumWinsor = k * lo + centralSum + k * hi;
  return {
    mean: totalSum / n,
    winsorizedMean: sumWinsor / n,
    k,
    lo,
    hi,
  };
}

// ---------- shape / option validation ----------

test('winsorized-mean-10: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenWinsorizedMean10([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 10);
  assert.equal(r.minWinsorizedMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'winsorized-mean-desc');
  assert.equal(r.generatedAt, GEN);
});

test('winsorized-mean-10: minRows < 10 throws', () => {
  assert.throws(
    () => buildSourceRowTokenWinsorizedMean10([], { minRows: 9 }),
    /minRows must be an integer >= 10/,
  );
});

test('winsorized-mean-10: minRows non-integer throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenWinsorizedMean10([], {
        minRows: 10.5 as unknown as number,
      }),
    /minRows must be an integer >= 10/,
  );
});

test('winsorized-mean-10: negative minWinsorizedMean throws', () => {
  assert.throws(
    () => buildSourceRowTokenWinsorizedMean10([], { minWinsorizedMean: -1 }),
    /minWinsorizedMean must be a finite, non-negative number/,
  );
});

test('winsorized-mean-10: NaN minWinsorizedMean throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenWinsorizedMean10([], { minWinsorizedMean: NaN }),
    /minWinsorizedMean must be a finite, non-negative number/,
  );
});

test('winsorized-mean-10: top < 1 throws', () => {
  assert.throws(
    () => buildSourceRowTokenWinsorizedMean10([], { top: 0 }),
    /top must be a positive integer/,
  );
});

test('winsorized-mean-10: invalid sort throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenWinsorizedMean10([], {
        sort: 'bogus' as unknown as 'winsorized-mean-desc',
      }),
    /sort must be one of/,
  );
});

test('winsorized-mean-10: invalid since throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenWinsorizedMean10([], { since: 'not-a-date' as string }),
    /invalid since/,
  );
});

test('winsorized-mean-10: invalid until throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenWinsorizedMean10([], { until: 'not-a-date' as string }),
    /invalid until/,
  );
});

// ---------- numeric correctness ----------

test('winsorized-mean-10: identity on constant series (all rows = c)', () => {
  const c = 1234;
  const queue = mkSeries('s1', new Array(10).fill(c));
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.winsorizedMean, c);
  assert.equal(row.mean, c);
  assert.equal(row.wmMeanGap, 0);
  assert.equal(row.loBoundary, c);
  assert.equal(row.hiBoundary, c);
});

test('winsorized-mean-10: identity on all-zero series', () => {
  const queue = mkSeries('s1', new Array(10).fill(0));
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.winsorizedMean, 0);
  assert.equal(row.mean, 0);
  assert.equal(row.wmMeanGap, 0);
});

test('winsorized-mean-10: hard-coded n=10 [1..10] check', () => {
  // n=10, k=1; lo = sorted[1] = 2, hi = sorted[8] = 9
  // sumWinsor = 1*2 + (2+3+4+5+6+7+8+9) + 1*9 = 2 + 44 + 9 = 55
  // wm = 55/10 = 5.5; mean = 55/10 = 5.5; gap = 0
  // because 1 -> 2 raises by 1, 10 -> 9 lowers by 1, cancels exactly.
  const queue = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.clippedPerTail, 1);
  assert.equal(row.loBoundary, 2);
  assert.equal(row.hiBoundary, 9);
  assert.equal(row.mean, 5.5);
  assert.equal(row.winsorizedMean, 5.5);
  assert.equal(row.wmMeanGap, 0);
});

test('winsorized-mean-10: heavy upper tail -> wmMeanGap < 0', () => {
  // n=10, one huge row at the top
  const queue = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000000]);
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  // k=1; lo=sorted[1]=2; hi=sorted[8]=9
  // sumWinsor = 2 + (2+3+4+5+6+7+8+9) + 9 = 55
  assert.equal(row.winsorizedMean, 5.5);
  assert.ok(row.mean > 100000);
  assert.ok(row.wmMeanGap < 0);
});

test('winsorized-mean-10: heavy lower tail -> wmMeanGap > 0 vs negative outlier dropped', () => {
  // total_tokens cannot be negative (dropped). Construct a left-heavy series
  // where one row sits well BELOW the body of the distribution. Use
  // [0, 100, 100, 100, 100, 100, 100, 100, 100, 100]:
  // mean = 900/10 = 90; sorted = same; k=1, lo=sorted[1]=100, hi=sorted[8]=100;
  // sumWinsor = 1*100 + (100+100+100+100+100+100+100+100) + 1*100 = 1000;
  // wm = 1000/10 = 100; gap = 100 - 90 = +10 (winsorizing replaced the
  // single 0 with the boundary 100 -> raised location estimate).
  const queue = mkSeries('s1', [0, 100, 100, 100, 100, 100, 100, 100, 100, 100]);
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.clippedPerTail, 1);
  assert.equal(row.loBoundary, 100);
  assert.equal(row.hiBoundary, 100);
  assert.equal(row.mean, 90);
  assert.equal(row.winsorizedMean, 100);
  assert.ok(row.wmMeanGap > 0);
  assert.ok(Math.abs(row.wmMeanGap - 10) < 1e-9);
});

test('winsorized-mean-10: matches reference impl on random series', () => {
  // Deterministic pseudo-random
  const xs: number[] = [];
  let state = 42;
  for (let i = 0; i < 137; i += 1) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    xs.push(state % 100000);
  }
  const queue = mkSeries('s1', xs);
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  const ref = winsorMean10Reference(xs);
  assert.equal(row.clippedPerTail, ref.k);
  assert.equal(row.loBoundary, ref.lo);
  assert.equal(row.hiBoundary, ref.hi);
  assert.ok(Math.abs(row.mean - ref.mean) < 1e-9);
  assert.ok(Math.abs(row.winsorizedMean - ref.winsorizedMean) < 1e-9);
  assert.ok(Math.abs(row.wmMeanGap - (ref.winsorizedMean - ref.mean)) < 1e-9);
});

test('winsorized-mean-10: scale-equivariance — c * series scales WM and mean by c', () => {
  const xs = [3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
  const c = 1000;
  const r1 = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', xs.map((x) => x * c)),
    { generatedAt: GEN },
  );
  const a = r1.sources[0]!;
  const b = r2.sources[0]!;
  assert.ok(Math.abs(b.winsorizedMean - c * a.winsorizedMean) < 1e-6);
  assert.ok(Math.abs(b.mean - c * a.mean) < 1e-6);
  assert.ok(Math.abs(b.wmMeanGap - c * a.wmMeanGap) < 1e-6);
});

test('winsorized-mean-10: translation-equivariance — series + c shifts WM and mean by c', () => {
  // Restrict shift to non-negative (negative total_tokens dropped).
  const xs = [3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
  const c = 50;
  const r1 = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', xs.map((x) => x + c)),
    { generatedAt: GEN },
  );
  const a = r1.sources[0]!;
  const b = r2.sources[0]!;
  assert.ok(Math.abs(b.winsorizedMean - (a.winsorizedMean + c)) < 1e-6);
  assert.ok(Math.abs(b.mean - (a.mean + c)) < 1e-6);
  // Translation-equivariance => gap unchanged
  assert.ok(Math.abs(b.wmMeanGap - a.wmMeanGap) < 1e-6);
});

test('winsorized-mean-10: order-invariance', () => {
  const xs = [11, 3, 41, 7, 17, 31, 13, 19, 29, 37, 23];
  const reversed = xs.slice().reverse();
  const a = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', reversed),
    { generatedAt: GEN },
  ).sources[0]!;
  assert.equal(a.winsorizedMean, b.winsorizedMean);
  assert.equal(a.mean, b.mean);
  assert.equal(a.wmMeanGap, b.wmMeanGap);
  assert.equal(a.loBoundary, b.loBoundary);
  assert.equal(a.hiBoundary, b.hiBoundary);
});

test('winsorized-mean-10: bounded by [loBoundary, hiBoundary]', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 100, 200];
  const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.winsorizedMean >= row.loBoundary);
  assert.ok(row.winsorizedMean <= row.hiBoundary);
});

test('winsorized-mean-10: WM lies between trim-mean-25 and arithmetic mean for heavy upper tail', () => {
  // Heavy right tail: WM clips less aggressively than trim-mean-25 drops,
  // so WM should sit between trim-mean and raw mean (both pulled toward
  // the body but trim-mean more aggressively).
  const xs = [
    100, 110, 120, 130, 140, 150, 160, 170, 180, 190, 200, 210, 220, 230,
    240, 250, 260, 270, 280, 1000000,
  ];
  const wm = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const tm = buildSourceRowTokenTrimMean25(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  // Body location: trim-mean-25 drops more, sits closer to body center.
  // wm clips less (10 % vs 25 %), still close to body but not as tight.
  // Raw mean is hugely inflated.
  // Expected: trim_mean <= winsorized_mean <= mean (when upper tail heavy).
  // Actually: trim_mean is a body avg; winsorized_mean keeps replaced tails
  // contributing the boundary. With one huge top row, the winsorized mean
  // will be pulled UP slightly more than the trim_mean (the boundary value is
  // larger than any body row would average to), but still vastly less than
  // the raw mean.
  assert.ok(tm.trimMean <= wm.winsorizedMean + 1e-6);
  assert.ok(wm.winsorizedMean < wm.mean);
  assert.ok(wm.mean > 10000); // raw mean inflated by huge row
  assert.ok(wm.winsorizedMean < 1000); // winsorized stays in body range
});

test('winsorized-mean-10: round-trip identity sumWinsor == n * winsorizedMean', () => {
  const xs = [5, 8, 13, 21, 34, 55, 89, 144, 233, 377, 610, 987];
  const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  const n = row.rowsKept;
  const k = row.clippedPerTail;
  const sorted = xs.slice().sort((a, b) => a - b);
  let centralSum = 0;
  for (let i = k; i < n - k; i += 1) centralSum += sorted[i]!;
  const sumWinsor = k * row.loBoundary + centralSum + k * row.hiBoundary;
  assert.ok(Math.abs(sumWinsor - n * row.winsorizedMean) < 1e-6);
});

test('winsorized-mean-10: lo == sorted[k], hi == sorted[n-k-1]', () => {
  const xs = [99, 1, 50, 70, 25, 30, 80, 40, 90, 10, 60, 20, 5];
  const sorted = xs.slice().sort((a, b) => a - b);
  const n = xs.length;
  const k = Math.floor(0.1 * n);
  const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.clippedPerTail, k);
  assert.equal(row.loBoundary, sorted[k]!);
  assert.equal(row.hiBoundary, sorted[n - k - 1]!);
});

// ---------- filter / drop accounting ----------

test('winsorized-mean-10: drops below minRows', () => {
  const queue = [
    ...mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ...mkSeries('s2', [1, 2, 3]),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('winsorized-mean-10: drops invalid hour_start', () => {
  const queue = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  queue.push(ql('not-a-date', 's1', 999));
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('winsorized-mean-10: drops invalid total_tokens', () => {
  const queue = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  queue.push(ql('2026-04-27T01:00:00.000Z', 's1', NaN));
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('winsorized-mean-10: drops negative total_tokens', () => {
  const queue = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  queue.push(ql('2026-04-27T01:00:00.000Z', 's1', -1));
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('winsorized-mean-10: source filter restricts and counts dropped', () => {
  const queue = [
    ...mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    ...mkSeries('s2', [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    source: 's1',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 10);
});

test('winsorized-mean-10: since/until window slicing', () => {
  const queue = mkSeries('s1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    since: '2026-04-27T00:05:00.000Z',
    until: '2026-04-27T00:11:00.000Z',
  });
  // Rows kept: indices 5..10 (6 rows: 6,7,8,9,10,11). 6 < 10 => dropped.
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('winsorized-mean-10: top cap', () => {
  const queue = [
    ...mkSeries('a', new Array(10).fill(100)),
    ...mkSeries('b', new Array(10).fill(200)),
    ...mkSeries('c', new Array(10).fill(300)),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  // Default sort: winsorized-mean-desc => c then b
  assert.equal(r.sources[0]!.source, 'c');
  assert.equal(r.sources[1]!.source, 'b');
});

test('winsorized-mean-10: minWinsorizedMean filter', () => {
  const queue = [
    ...mkSeries('low', new Array(10).fill(5)),
    ...mkSeries('high', new Array(10).fill(500)),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    minWinsorizedMean: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'high');
  assert.equal(r.droppedBelowMinWinsorizedMean, 1);
});

test('winsorized-mean-10: sort by mean-desc', () => {
  const queue = [
    ...mkSeries('a', [1, 1, 1, 1, 1, 1, 1, 1, 1, 100]),
    ...mkSeries('b', [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    sort: 'mean-desc',
  });
  // a mean = 110/10 = 11; b mean = 10
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('winsorized-mean-10: sort by gap-desc surfaces tail-dominant first', () => {
  const queue = [
    ...mkSeries('quiet', [10, 10, 10, 10, 10, 10, 10, 10, 10, 10]),
    ...mkSeries('spiky', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000000]),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  assert.equal(r.sources[0]!.source, 'spiky');
});

test('winsorized-mean-10: sort by source asc', () => {
  const queue = [
    ...mkSeries('zeta', new Array(10).fill(100)),
    ...mkSeries('alpha', new Array(10).fill(200)),
    ...mkSeries('mu', new Array(10).fill(300)),
  ];
  const r = buildSourceRowTokenWinsorizedMean10(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'mu');
  assert.equal(r.sources[2]!.source, 'zeta');
});

test('winsorized-mean-10: empty source string -> "unknown" group', () => {
  const queue = mkSeries('', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  const r = buildSourceRowTokenWinsorizedMean10(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

// ---------- monotonicity / cross-builder property tests ----------

test('winsorized-mean-10: WM is between min and max of original series', () => {
  const xs = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3];
  const r = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', xs), {
    generatedAt: GEN,
  }).sources[0]!;
  const mn = Math.min(...xs);
  const mx = Math.max(...xs);
  assert.ok(r.winsorizedMean >= mn);
  assert.ok(r.winsorizedMean <= mx);
});

test('winsorized-mean-10: clipping reduces the impact of an extreme outlier', () => {
  // Compare same series with vs without a single huge outlier; WM should
  // change much less than the raw mean does.
  const base = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19];
  const withOutlier = [...base, 10_000_000];
  const a = buildSourceRowTokenWinsorizedMean10(mkSeries('s1', base), {
    generatedAt: GEN,
  }).sources[0]!;
  const b = buildSourceRowTokenWinsorizedMean10(
    mkSeries('s1', withOutlier),
    { generatedAt: GEN },
  ).sources[0]!;
  const wmDelta = Math.abs(b.winsorizedMean - a.winsorizedMean);
  const meanDelta = Math.abs(b.mean - a.mean);
  // Mean delta is enormous; WM delta is bounded.
  assert.ok(meanDelta > 100000);
  assert.ok(wmDelta < 100);
});
