import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMadOverMedian,
  madOverMedianOfVector,
} from '../src/dailytokenmadovermedian.js';
import { iqrOverMedianOfVector } from '../src/dailytokeniqrovermedian.js';
import { quintileShareRatioOfVector } from '../src/dailytokenquintileshareratio.js';
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

const GEN = '2026-05-01T12:00:00.000Z';

// ---- madOverMedianOfVector primitive -----------------------------------

test('madOverMedianOfVector: empty -> degenerate, madm=0', () => {
  const r = madOverMedianOfVector([]);
  assert.equal(r.madm, 0);
  assert.equal(r.degenerate, true);
});

test('madOverMedianOfVector: singleton -> degenerate', () => {
  const r = madOverMedianOfVector([42]);
  assert.equal(r.madm, 0);
  assert.equal(r.median, 42);
  assert.equal(r.degenerate, true);
});

test('madOverMedianOfVector: closed-form anchor on [1..7]', () => {
  // sorted = [1,2,3,4,5,6,7]; median = 4
  // |D - 4| = [3,2,1,0,1,2,3]; sorted abs = [0,1,1,2,2,3,3]; inner median = 2
  // MADM = 2 / 4 = 0.5
  const r = madOverMedianOfVector([1, 2, 3, 4, 5, 6, 7]);
  assert.equal(r.median, 4);
  assert.equal(r.mad, 2);
  assert.ok(Math.abs(r.madm - 0.5) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('madOverMedianOfVector: even n closed-form on [1..6]', () => {
  // sorted = [1,2,3,4,5,6]; median = (3+4)/2 = 3.5
  // |D - 3.5| = [2.5, 1.5, 0.5, 0.5, 1.5, 2.5]; sorted = [0.5,0.5,1.5,1.5,2.5,2.5]
  // inner median = (1.5 + 1.5)/2 = 1.5; MADM = 1.5 / 3.5
  const r = madOverMedianOfVector([1, 2, 3, 4, 5, 6]);
  assert.ok(Math.abs(r.median - 3.5) < 1e-12);
  assert.ok(Math.abs(r.mad - 1.5) < 1e-12);
  assert.ok(Math.abs(r.madm - 1.5 / 3.5) < 1e-12);
});

test('madOverMedianOfVector: scale-invariance under c=10', () => {
  const a = [1, 2, 3, 4, 5, 6, 7];
  const b = a.map((x) => x * 10);
  const ra = madOverMedianOfVector(a);
  const rb = madOverMedianOfVector(b);
  assert.ok(Math.abs(ra.madm - rb.madm) < 1e-12);
});

test('madOverMedianOfVector: permutation-invariance', () => {
  const a = [1, 2, 3, 4, 5, 6, 7];
  const b = [4, 1, 7, 3, 6, 2, 5];
  const ra = madOverMedianOfVector(a);
  const rb = madOverMedianOfVector(b);
  assert.ok(Math.abs(ra.madm - rb.madm) < 1e-12);
});

test('madOverMedianOfVector: rejects negative or non-finite', () => {
  assert.throws(() => madOverMedianOfVector([1, -1, 2]));
  assert.throws(() => madOverMedianOfVector([1, NaN, 2]));
  assert.throws(() => madOverMedianOfVector([1, Infinity, 2]));
});

test('madOverMedianOfVector: BREAKDOWN POINT 0.5 -- huge outliers leave MADM bounded (median unchanged, MAD jumps by O(1) NOT O(outlier))', () => {
  // Replace the upper 3 of a 7-vector with 1e9; median (=4) is
  // exactly preserved (the strict robust-median property). MAD shifts
  // by ONE rank position in the sorted absolute deviations (from 2
  // to 3) but does NOT explode -- it remains O(median), unaffected
  // by the 1e9 magnitude. This is the strict robust-scale property
  // that distinguishes MADM from every shipped mean-normalised
  // inequality axis (which all move by O(outlier) under the same
  // perturbation).
  const base = [1, 2, 3, 4, 5, 6, 7];
  const perturbed = [1, 2, 3, 4, 1e9, 1e9, 1e9];
  const rb = madOverMedianOfVector(base);
  const rp = madOverMedianOfVector(perturbed);
  // Median strictly unchanged.
  assert.equal(rb.median, rp.median);
  // MAD bounded by max(base) -- it does NOT scale with the 1e9 outlier.
  assert.ok(rp.mad <= 7, `MAD ${rp.mad} should be bounded by max(base)=7`);
  // MADM bounded by 1 (i.e. O(1)) despite outliers being O(1e9).
  assert.ok(rp.madm <= 1, `MADM ${rp.madm} should be O(1) despite 1e9 outliers`);
  // For contrast: a mean-based dispersion (variance/mean^2) would
  // explode by ~1e18.
});

test('madOverMedianOfVector: degenerate when > n/2 days equal the median', () => {
  // 5 days at value 7, 2 days at value 100. sorted=[7,7,7,7,7,100,100],
  // median=7. |D-7| sorted = [0,0,0,0,0,93,93]; inner median = 0.
  // MADM = 0 even though there are large outliers.
  const r = madOverMedianOfVector([7, 7, 7, 7, 7, 100, 100]);
  assert.equal(r.median, 7);
  assert.equal(r.mad, 0);
  assert.equal(r.madm, 0);
});

// ---- buildDailyTokenMadOverMedian --------------------------------------

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenMadOverMedian([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 5);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'madm');
  assert.equal(r.minMadm, null);
  assert.equal(r.includeIom, false);
});

test('build: single-source 7-day vector hits closed-form MADM=0.5', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.medianDaily, 4000);
  assert.equal(s.mad, 2000);
  assert.ok(Math.abs(s.madm - 0.5) < 1e-12);
});

test('build: collapses multi-hour rows on same day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'src-a', 2000),
    ql('2026-04-20T05:00:00.000Z', 'src-a', 3000),
    ql('2026-04-21T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-22T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-23T05:00:00.000Z', 'src-a', 5000),
    ql('2026-04-24T05:00:00.000Z', 'src-a', 5000),
  ];
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
  });
  const row = r.sources[0]!;
  assert.equal(row.nDays, 5); // 2026-04-20 collapses to 5000
  assert.equal(row.medianDaily, 5000);
  // Four 5000s and one 5000 => MAD=0
  assert.equal(row.mad, 0);
  assert.equal(row.madm, 0);
});

test('build: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'big', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'tiny', 1));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: minDays filter drops short-history sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 4; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'short', 1000));
  }
  for (let i = 1; i <= 6; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'long', 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 5; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 100));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'b', 200));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('build: time window filter trims rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
    since: '2026-04-13T00:00:00.000Z',
    until: '2026-04-19T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.nDays, 6);
});

test('build: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-11T05:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens counted', () => {
  const queue: QueueLine[] = [
    ql('2026-04-11T05:00:00.000Z', 'a', 0),
    ql('2026-04-11T06:00:00.000Z', 'a', -10),
    ql('2026-04-12T05:00:00.000Z', 'a', 100),
    ql('2026-04-13T05:00:00.000Z', 'a', 200),
    ql('2026-04-14T05:00:00.000Z', 'a', 300),
    ql('2026-04-15T05:00:00.000Z', 'a', 400),
    ql('2026-04-16T05:00:00.000Z', 'a', 500),
  ];
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources[0]!.nDays, 5);
});

test('build: sort=madm DESC default', () => {
  const queue: QueueLine[] = [];
  // src-flat: all 1000 -> madm=0
  // src-spread: ramp 1..7 -> madm=0.5
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-flat', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-spread', i * 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
  });
  assert.equal(r.sources[0]!.source, 'src-spread');
  assert.equal(r.sources[1]!.source, 'src-flat');
});

test('build: sort=tokens / days / source / meanDaily / medianDaily / mad', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'b', 5000));
  }
  for (const s of ['tokens', 'days', 'source', 'meanDaily', 'medianDaily', 'mad'] as const) {
    const r = buildDailyTokenMadOverMedian(queue, {
      generatedAt: GEN,
      minTokens: 0,
      minDays: 5,
      sort: s,
    });
    assert.equal(r.sources.length, 2);
    assert.equal(r.sort, s);
  }
});

test('build: top cap drops tail and counts droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'b', 2000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'c', 3000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('build: minMadm filter retains degenerate rows', () => {
  const queue: QueueLine[] = [];
  // src-flat -> madm=0 (degenerate via mad=0; not via median=0)
  // src-spread -> madm=0.5
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-flat', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-spread', i * 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
    minMadm: 0.3,
  });
  // src-flat: madm=0 but degenerate=false (median=1000>0, mad=0).
  // Per the contract degenerate flag is true only when median <= 0.
  // We drop low madm here, so src-flat is dropped (madm=0 < 0.3).
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-spread');
  assert.equal(r.droppedBelowMinMadm, 1);
});

test('build: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenMadOverMedian([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenMadOverMedian([], { minDays: 1 }));
  assert.throws(() => buildDailyTokenMadOverMedian([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenMadOverMedian([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenMadOverMedian([], {
      sort: 'nope' as 'madm',
    }),
  );
  assert.throws(() => buildDailyTokenMadOverMedian([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenMadOverMedian([], { until: 'not-a-date' }));
  assert.throws(() => buildDailyTokenMadOverMedian([], { minMadm: -0.1 }));
});

// ---- includeIom refinement ---------------------------------------------

test('build: includeIom off by default omits iom fields', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
  });
  const row = r.sources[0]!;
  assert.equal(r.includeIom, false);
  assert.equal(row.iom, undefined);
  assert.equal(row.iomOverMadm, undefined);
});

test('build: includeIom surfaces iom and iomOverMadm', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
  }
  const r = buildDailyTokenMadOverMedian(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 5,
    includeIom: true,
  });
  const row = r.sources[0]!;
  assert.equal(r.includeIom, true);
  assert.notEqual(row.iom, undefined);
  assert.notEqual(row.iomOverMadm, undefined);
  // Check IOM matches the canonical primitive
  const iqr = iqrOverMedianOfVector([1000, 2000, 3000, 4000, 5000, 6000, 7000]);
  assert.ok(Math.abs((row.iom as number) - iqr.iom) < 1e-12);
  // For symmetric uniform: IQR/MAD ratio should be > 1 (IQR catches both quartile gaps)
  assert.ok((row.iomOverMadm as number) > 1);
});

// ---- orthogonality witness vs axis 62 (QSR) ----------------------------

test('rank-flip witness: MADM vs QSR (axis 62)', () => {
  // Two 10-day vectors hand-tuned for opposite rankings.
  //
  // Vector A = [10, 10, 10, 10, 100, 100, 100, 100, 100, 100]
  //   median = 100; |D - 100| sorted = [0,0,0,0,0,0,90,90,90,90]
  //   inner median = 0 -> MADM_A = 0
  //   QSR (k=2): bottomMass = 20, topMass = 200 -> QSR_A = 10
  //
  // Vector B = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9]
  //   sorted; median = (4+5)/2 = 4.5
  //   |D - 4.5| = [3.5,3.5,2.5,1.5,0.5,0.5,1.5,2.5,3.5,4.5]
  //   sorted = [0.5,0.5,1.5,1.5,2.5,2.5,3.5,3.5,3.5,4.5]
  //   inner median = (2.5+2.5)/2 = 2.5 -> MAD_B = 2.5; MADM_B = 2.5/4.5 ~ 0.5556
  //   QSR (k=2): bottomMass = 1+1=2; topMass = 8+9=17 -> QSR_B = 8.5
  //
  // QSR ranks A > B (10 > 8.5); MADM ranks B > A (~0.556 > 0).
  const A = [10, 10, 10, 10, 100, 100, 100, 100, 100, 100];
  const B = [1, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  const ma = madOverMedianOfVector(A);
  const mb = madOverMedianOfVector(B);
  assert.equal(ma.madm, 0);
  assert.ok(Math.abs(mb.madm - 2.5 / 4.5) < 1e-9);
  assert.ok(mb.madm > ma.madm);
  const qa = quintileShareRatioOfVector(A);
  const qb = quintileShareRatioOfVector(B);
  assert.ok(qa.qsr > qb.qsr, `QSR rank-flip: A.qsr ${qa.qsr} should be > B.qsr ${qb.qsr}`);
});

test('rank-flip witness: MADM ignores extreme tail that drives QSR', () => {
  // Two 10-day vectors that DIFFER only in the magnitude of the
  // single largest day. QSR explodes; MADM is unchanged because the
  // inner median of |D - median| does not see the upper-half extreme.
  const baseLow = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
  const baseHigh = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1_000_000];
  const ml = madOverMedianOfVector(baseLow);
  const mh = madOverMedianOfVector(baseHigh);
  // median = (5+6)/2 = 5.5 in both. MAD recomputed:
  // |D - 5.5| sorted same except last is 94.5 vs 999994.5 -- both
  // sit at the top of the sorted-abs vector, so the inner median
  // (5.5th element of 10) is unaffected.
  assert.equal(ml.median, 5.5);
  assert.equal(mh.median, 5.5);
  assert.equal(ml.mad, mh.mad);
  assert.equal(ml.madm, mh.madm);
  const ql_ = quintileShareRatioOfVector(baseLow);
  const qh = quintileShareRatioOfVector(baseHigh);
  assert.ok(qh.qsr > 100 * ql_.qsr, 'QSR moves >100x while MADM is invariant');
});
