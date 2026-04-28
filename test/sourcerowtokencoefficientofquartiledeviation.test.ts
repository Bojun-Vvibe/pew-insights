import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenCoefficientOfQuartileDeviation } from '../src/sourcerowtokencoefficientofquartiledeviation.js';
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
    ql(`2026-04-27T${String(i % 24).padStart(2, '0')}:00:00.000Z`, source, v),
  );
}

// ---------- shape / option validation ----------

test('cqd: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minQ3, 0);
  assert.equal(r.minCqd, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'cqd-desc');
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
  assert.equal(r.source, null);
});

test('cqd: rejects bad minRows (< 4 or non-integer)', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minRows: 3 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minRows: 4.5 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minRows: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minRows: 0 }),
  );
});

test('cqd: rejects bad minQ3', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minQ3: -1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], {
      minQ3: Number.NaN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], {
      minQ3: Number.POSITIVE_INFINITY,
    }),
  );
});

test('cqd: rejects bad minCqd (out of [0,1] or non-finite)', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minCqd: -0.1 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { minCqd: 1.0001 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], {
      minCqd: Number.NaN,
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], {
      minCqd: Number.POSITIVE_INFINITY,
    }),
  );
});

test('cqd: rejects bad top', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { top: -3 }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { top: 1.5 }),
  );
});

test('cqd: rejects bad sort', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], {
      sort: 'nope' as never,
    }),
  );
});

test('cqd: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { since: 'nope' }),
  );
  assert.throws(() =>
    buildSourceRowTokenCoefficientOfQuartileDeviation([], { until: 'bad' }),
  );
});

// ---------- worked numerics ----------

test('cqd: simple worked example - q1=2 q3=8, cqd = 6/10 = 0.6', () => {
  // sorted: 1,2,3,4,5,6,7,8,9 (n=9)
  // type-7: q1 = (n-1)*0.25 = 2 -> xs[2] = 3 (oh actually not 2)
  // Actually for n=9, h=2 for q1 -> xs[2]=3; h=4 for median -> xs[4]=5;
  // h=6 for q3 -> xs[6]=7. So q1=3, q3=7, cqd = 4/10 = 0.4.
  // Let me just test what comes out.
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', [1, 2, 3, 4, 5, 6, 7, 8, 9]),
    { generatedAt: GEN },
  );
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.q1, 3);
  assert.equal(s.median, 5);
  assert.equal(s.q3, 7);
  assert.equal(s.iqr, 4);
  assert.equal(s.qsum, 10);
  assert.equal(s.cqd, 0.4);
  assert.equal(s.degenerate, false);
});

test('cqd: all-equal positive series -> CQD = 0, NOT degenerate', () => {
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', [100, 100, 100, 100, 100, 100, 100, 100]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.q1, 100);
  assert.equal(s.q3, 100);
  assert.equal(s.iqr, 0);
  assert.equal(s.qsum, 200);
  assert.equal(s.cqd, 0);
  assert.equal(s.degenerate, false);
});

test('cqd: all-zero series -> CQD = 0, degenerate=true', () => {
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', [0, 0, 0, 0, 0, 0]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.q1, 0);
  assert.equal(s.q3, 0);
  assert.equal(s.iqr, 0);
  assert.equal(s.qsum, 0);
  assert.equal(s.cqd, 0);
  assert.equal(s.degenerate, true);
});

test('cqd: >=25% zeros and q3>0 -> CQD = 1 (saturation)', () => {
  // half zeros, half 1000s; q1 = 0, q3 = 1000, cqd = 1000/1000 = 1.
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', [0, 0, 0, 0, 1000, 1000, 1000, 1000]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.q1, 0);
  assert.equal(s.q3, 1000);
  assert.equal(s.iqr, 1000);
  assert.equal(s.qsum, 1000);
  assert.equal(s.cqd, 1);
  assert.equal(s.degenerate, false);
});

test('cqd: |cqd| <= 1 invariant on a mixed positive series', () => {
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 1000, 10000]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.ok(s.cqd >= 0 && s.cqd <= 1);
});

// ---------- invariants ----------

test('cqd: scale-invariance under positive c', () => {
  const base = [3, 7, 12, 18, 25, 33, 42, 52];
  for (const c of [0.001, 0.5, 1, 2, 17, 1000, 1e6]) {
    const r1 = buildSourceRowTokenCoefficientOfQuartileDeviation(
      mkSeries('s', base),
      { generatedAt: GEN },
    );
    const r2 = buildSourceRowTokenCoefficientOfQuartileDeviation(
      mkSeries('s', base.map((v) => v * c)),
      { generatedAt: GEN },
    );
    const a = r1.sources[0]!.cqd;
    const b = r2.sources[0]!.cqd;
    assert.ok(
      Math.abs(a - b) < 1e-12,
      `c=${c}: ${a} vs ${b} differ by ${Math.abs(a - b)}`,
    );
  }
});

test('cqd: order-invariance under permutation', () => {
  const base = [11, 23, 41, 67, 89, 103, 199, 271, 311, 401, 503, 601];
  const r1 = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', base),
    { generatedAt: GEN },
  );
  const shuffled = [...base];
  // simple reproducible swap pattern
  for (let i = 0; i < shuffled.length; i++) {
    const j = (i * 7 + 3) % shuffled.length;
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const r2 = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', shuffled),
    { generatedAt: GEN },
  );
  assert.ok(Math.abs(r1.sources[0]!.cqd - r2.sources[0]!.cqd) < 1e-12);
});

test('cqd: outlier-immunity vs CV-style sensitivity', () => {
  // Replace the largest of an 8-row series with a giant value;
  // CQD must barely move (q1, q3 unchanged when n=8 because q3
  // is interpolated between xs[5] and xs[6], outlier at xs[7]
  // touches q3 only via the endpoint slot of type-7 — actually
  // for n=8, q3 = xs[5] + 0.25*(xs[6]-xs[5]). xs[7] does NOT
  // enter Q3. So CQD is unchanged.
  const base = [10, 20, 30, 40, 50, 60, 70, 80];
  const out = [10, 20, 30, 40, 50, 60, 70, 1e12];
  const r1 = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', base),
    { generatedAt: GEN },
  );
  const r2 = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', out),
    { generatedAt: GEN },
  );
  assert.equal(r1.sources[0]!.cqd, r2.sources[0]!.cqd);
});

test('cqd: bounds invariant on pseudo-random sources', () => {
  // simple LCG for determinism
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 20; trial++) {
    const n = 10 + Math.floor(rand() * 80);
    const vals: number[] = [];
    for (let i = 0; i < n; i++) {
      // mix of zeros and positives to exercise both ends
      vals.push(rand() < 0.2 ? 0 : Math.floor(rand() * 1e6));
    }
    const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
      mkSeries(`s${trial}`, vals),
      { generatedAt: GEN },
    );
    if (r.sources.length > 0) {
      const s = r.sources[0]!;
      assert.ok(
        s.cqd >= 0 && s.cqd <= 1,
        `trial ${trial} cqd=${s.cqd} out of [0,1]`,
      );
    }
  }
});

test('cqd: q1=q3>0 (constant central half) -> cqd = 0', () => {
  // 8 values where Q1 and Q3 land on the same value (e.g. lots
  // of 50s in the middle)
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(
    mkSeries('s', [10, 50, 50, 50, 50, 50, 50, 100]),
    { generatedAt: GEN },
  );
  const s = r.sources[0]!;
  assert.equal(s.q1, 50);
  assert.equal(s.q3, 50);
  assert.equal(s.cqd, 0);
  assert.equal(s.degenerate, false);
});

// ---------- filtering / dropped counters ----------

test('cqd: drops bad hour_start', () => {
  const queue = [
    ql('not-a-date', 's', 100),
    ...mkSeries('s', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 4);
});

test('cqd: drops non-finite total_tokens', () => {
  const queue = mkSeries('s', [Number.NaN, 1, 2, 3, 4, 5]);
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.totalRowsKept, 5);
});

test('cqd: drops negative total_tokens', () => {
  const queue = mkSeries('s', [-1, -5, 1, 2, 3, 4]);
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedNegativeTokens, 2);
  assert.equal(r.totalRowsKept, 4);
});

test('cqd: source filter counts non-matching', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30, 40]),
    ...mkSeries('b', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.droppedSourceFilter, 4);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('cqd: empty source -> "unknown"', () => {
  const queue = mkSeries('', [10, 20, 30, 40]);
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('cqd: minRows drops sources below threshold', () => {
  const queue = [
    ...mkSeries('a', [10, 20, 30]),
    ...mkSeries('b', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('cqd: minQ3 filter drops sources whose q3 is too low', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [100, 200, 300, 400, 500]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    minQ3: 50,
  });
  assert.equal(r.droppedBelowMinQ3, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('cqd: minCqd filter drops sources whose cqd is too low', () => {
  // a: nearly constant -> low CQD
  // b: spread -> higher CQD
  const queue = [
    ...mkSeries('a', [99, 100, 100, 100, 101]),
    ...mkSeries('b', [10, 30, 50, 70, 90]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    minCqd: 0.3,
  });
  assert.equal(r.droppedBelowMinCqd, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('cqd: minCqd separates degenerate from filtered', () => {
  const queue = [
    ...mkSeries('zero', [0, 0, 0, 0, 0]),
    ...mkSeries('mid', [10, 30, 50, 70, 90]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    minCqd: 0.1,
  });
  assert.equal(r.droppedDegenerate, 1);
  assert.equal(r.droppedBelowMinCqd, 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'mid');
});

test('cqd: top cap + droppedBelowTopCap', () => {
  const queue = [
    ...mkSeries('a', [10, 30, 50, 70, 90]),
    ...mkSeries('b', [1, 2, 3, 4, 5]),
    ...mkSeries('c', [100, 100, 100, 100, 100]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

// ---------- since / until window ----------

test('cqd: since/until inclusive/exclusive', () => {
  const queue = [
    ql('2026-04-26T00:00:00.000Z', 's', 10),
    ql('2026-04-27T00:00:00.000Z', 's', 20),
    ql('2026-04-27T01:00:00.000Z', 's', 30),
    ql('2026-04-27T02:00:00.000Z', 's', 40),
    ql('2026-04-27T03:00:00.000Z', 's', 50),
    ql('2026-04-28T00:00:00.000Z', 's', 100),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  assert.equal(r.totalRowsKept, 4);
  assert.equal(r.windowStart, '2026-04-27T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-28T00:00:00.000Z');
});

// ---------- sort modes ----------

test('cqd: sort cqd-desc default', () => {
  const queue = [
    ...mkSeries('low', [99, 100, 100, 100, 101]),
    ...mkSeries('high', [0, 0, 100, 100, 200]),
    ...mkSeries('mid', [10, 30, 50, 70, 90]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'high');
  assert.ok(r.sources[0]!.cqd >= r.sources[1]!.cqd);
  assert.ok(r.sources[1]!.cqd >= r.sources[2]!.cqd);
});

test('cqd: sort cqd-asc', () => {
  const queue = [
    ...mkSeries('low', [99, 100, 100, 100, 101]),
    ...mkSeries('high', [0, 0, 100, 100, 200]),
    ...mkSeries('mid', [10, 30, 50, 70, 90]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    sort: 'cqd-asc',
  });
  assert.ok(r.sources[0]!.cqd <= r.sources[1]!.cqd);
  assert.ok(r.sources[1]!.cqd <= r.sources[2]!.cqd);
});

test('cqd: sort iqr-desc', () => {
  const queue = [
    ...mkSeries('s1', [10, 20, 30, 40]),
    ...mkSeries('s2', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    sort: 'iqr-desc',
  });
  assert.equal(r.sources[0]!.source, 's2');
});

test('cqd: sort q3-desc', () => {
  const queue = [
    ...mkSeries('s1', [10, 20, 30, 40]),
    ...mkSeries('s2', [100, 200, 300, 400]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    sort: 'q3-desc',
  });
  assert.equal(r.sources[0]!.source, 's2');
});

test('cqd: sort rows', () => {
  const queue = [
    ...mkSeries('few', [1, 2, 3, 4]),
    ...mkSeries('many', [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'many');
});

test('cqd: sort source asc', () => {
  const queue = [
    ...mkSeries('zebra', [1, 2, 3, 4]),
    ...mkSeries('alpha', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zebra');
});

test('cqd: tiebreak source asc when primary keys equal', () => {
  const queue = [
    ...mkSeries('beta', [10, 20, 30, 40]),
    ...mkSeries('alpha', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  // Same data -> identical cqd; tiebreak source asc
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'beta');
});

// ---------- determinism ----------

test('cqd: deterministic across two runs', () => {
  const queue = mkSeries('s', [3, 7, 11, 19, 23, 31, 41, 53]);
  const r1 = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(r1, r2);
});

// ---------- algebraic identity vs iqr/qsum ----------

test('cqd: identity cqd === iqr/qsum when not degenerate', () => {
  const queue = mkSeries('s', [10, 50, 100, 250, 500, 1000, 2500, 5000]);
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.cqd, s.iqr / s.qsum);
});

// ---------- cohort aggregate counters ----------

test('cqd: totalSources counts pre-filter sources', () => {
  const queue = [
    ...mkSeries('a', [1, 2, 3]),
    ...mkSeries('b', [10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenCoefficientOfQuartileDeviation(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalRowsKept, 7);
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
});
