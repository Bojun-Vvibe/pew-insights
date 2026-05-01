import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMidSpreadRatio,
  midSpreadRatioOfVector,
} from '../src/dailytokenmidspreadratio.js';
import { iqrOverMedianOfVector } from '../src/dailytokeniqrovermedian.js';
import { percentileGapRatioOfVector } from '../src/dailytokenpercentilegapratio.js';
import { ge2OfVector } from '../src/dailytokenge2index.js';
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

const GEN = '2026-05-01T09:00:00.000Z';

// ---- midSpreadRatioOfVector primitive --------------------------------

test('midSpreadRatioOfVector: empty -> degenerate, msr=0', () => {
  const r = midSpreadRatioOfVector([]);
  assert.equal(r.msr, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.iqrAbsolute, 0);
  assert.equal(r.idrAbsolute, 0);
});

test('midSpreadRatioOfVector: singleton -> degenerate, msr=0', () => {
  const r = midSpreadRatioOfVector([42]);
  assert.equal(r.msr, 0);
  assert.equal(r.p10, 42);
  assert.equal(r.p25, 42);
  assert.equal(r.p50, 42);
  assert.equal(r.p75, 42);
  assert.equal(r.p90, 42);
  assert.equal(r.degenerate, true);
});

test('midSpreadRatioOfVector: closed-form anchor on [1..11] -> 0.625', () => {
  const r = midSpreadRatioOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  // P10 (h=1.0) = v[1] = 2
  // P25 (h=2.5) = 3 + 0.5*(4-3) = 3.5
  // P50 (h=5.0) = v[5] = 6
  // P75 (h=7.5) = 8 + 0.5*(9-8) = 8.5
  // P90 (h=9.0) = v[9] = 10
  // IQR = 5, IDR = 8, MSR = 5/8 = 0.625
  assert.ok(Math.abs(r.p10 - 2) < 1e-12);
  assert.ok(Math.abs(r.p25 - 3.5) < 1e-12);
  assert.ok(Math.abs(r.p50 - 6) < 1e-12);
  assert.ok(Math.abs(r.p75 - 8.5) < 1e-12);
  assert.ok(Math.abs(r.p90 - 10) < 1e-12);
  assert.ok(Math.abs(r.iqrAbsolute - 5) < 1e-12);
  assert.ok(Math.abs(r.idrAbsolute - 8) < 1e-12);
  assert.ok(Math.abs(r.msr - 0.625) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('midSpreadRatioOfVector: all-equal vector -> msr=0, degenerate', () => {
  const r = midSpreadRatioOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.msr, 0);
  assert.equal(r.iqrAbsolute, 0);
  assert.equal(r.idrAbsolute, 0);
  assert.equal(r.degenerate, true);
});

test('midSpreadRatioOfVector: rejects non-positive / non-finite values', () => {
  assert.throws(() => midSpreadRatioOfVector([1, 2, 0, 4]), /strictly-positive/);
  assert.throws(() => midSpreadRatioOfVector([1, 2, -3, 4]), /strictly-positive/);
  assert.throws(
    () => midSpreadRatioOfVector([1, 2, Number.NaN, 4]),
    /strictly-positive/,
  );
  assert.throws(
    () => midSpreadRatioOfVector([1, 2, Number.POSITIVE_INFINITY, 4]),
    /strictly-positive/,
  );
});

test('midSpreadRatioOfVector: SCALE-INVARIANT', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const a = midSpreadRatioOfVector(v).msr;
  const b = midSpreadRatioOfVector(v.map((x) => x * 1000)).msr;
  const c = midSpreadRatioOfVector(v.map((x) => x * 0.001)).msr;
  assert.ok(Math.abs(a - b) < 1e-12);
  assert.ok(Math.abs(a - c) < 1e-12);
});

test('midSpreadRatioOfVector: PERMUTATION-INVARIANT', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const perm = [11, 1, 7, 4, 9, 2, 5, 8, 3, 6, 10];
  assert.ok(
    Math.abs(
      midSpreadRatioOfVector(v).msr - midSpreadRatioOfVector(perm).msr,
    ) < 1e-12,
  );
});

test('midSpreadRatioOfVector: range [0, 1] always', () => {
  // Random checks
  const cases = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    [1, 1, 1, 1, 1, 5, 5, 5, 5, 5, 100],
    [1, 100, 100, 100, 100, 100, 100, 100, 100, 100, 1000],
    [1, 2, 3, 4, 5],
    [10, 20, 30],
  ];
  for (const c of cases) {
    const m = midSpreadRatioOfVector(c).msr;
    assert.ok(m >= 0 && m <= 1, `MSR out of [0,1]: ${m} for ${JSON.stringify(c)}`);
  }
});

// ---- ORTHOGONALITY: invariance to extreme tail and to median --------

test('midSpreadRatioOfVector: INVARIANT to changes strictly above P90 (n=11)', () => {
  // Sorted [1,2,3,4,5,6,7,8,9,10,X] with X >= 10:
  //   P10=v[1]=2, P25=3.5, P50=6, P75=8.5, P90=v[9]=10. All independent of X.
  const a = midSpreadRatioOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 100]);
  const b = midSpreadRatioOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1_000_000_000]);
  assert.ok(Math.abs(a.msr - b.msr) < 1e-12);
  assert.ok(Math.abs(a.iqrAbsolute - b.iqrAbsolute) < 1e-12);
  assert.ok(Math.abs(a.idrAbsolute - b.idrAbsolute) < 1e-12);
});

test('midSpreadRatioOfVector: INVARIANT to changes strictly below P10 (n=11)', () => {
  // Sorted [Y,2,3,4,5,6,7,8,9,10,11] with Y <= 2 (and > 0):
  //   P10=v[1]=2, etc. All independent of Y.
  const a = midSpreadRatioOfVector([0.5, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  const b = midSpreadRatioOfVector([0.001, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.ok(Math.abs(a.msr - b.msr) < 1e-12);
});

test('midSpreadRatioOfVector: INVARIANT to median changes that hold P25,P75 fixed', () => {
  // For n=11, P50 = v[5]. We can change v[5] inside [v[4], v[6]] without
  // affecting P25 (h=2.5 -> v[2..3]) or P75 (h=7.5 -> v[7..8]) or
  // P10/P90. So MSR is unchanged but IOM (which divides by P50) moves.
  const a = midSpreadRatioOfVector([1, 2, 3, 4, 5, 5, 7, 8, 9, 10, 11]);
  const b = midSpreadRatioOfVector([1, 2, 3, 4, 5, 7, 7, 8, 9, 10, 11]);
  // (changed v[5] from 5 to 7 -- still <= v[6]=7; sorted unchanged shape
  //  modulo where v[5] sits.)
  // Actually we need sorted positions identical. Both [1,2,3,4,5,5,7,8,9,10,11]
  // and [1,2,3,4,5,7,7,8,9,10,11] are sorted, with v[2..3]=3,4 and v[7..8]=8,9
  // identical, v[1]=2 v[9]=10 identical -> MSR identical.
  assert.ok(Math.abs(a.msr - b.msr) < 1e-12);
  // But IOM (which uses P50) changes:
  const iomA = iqrOverMedianOfVector([1, 2, 3, 4, 5, 5, 7, 8, 9, 10, 11]).iom;
  const iomB = iqrOverMedianOfVector([1, 2, 3, 4, 5, 7, 7, 8, 9, 10, 11]).iom;
  assert.ok(
    Math.abs(iomA - iomB) > 1e-9,
    `IOM should respond to median change, got ${iomA} vs ${iomB}`,
  );
});

// ---- RANK FLIP vs IOM (axis 59) and vs PGR (axis 58) ----------------

test('rank flip vs IOM: stretched vs boxy distributions on matched P50', () => {
  // Y has narrower interdecile spread, larger MSR; Z has wider interdecile
  // spread, smaller MSR. But Z has larger absolute IQR -> larger IOM.
  // Y = [1, 2, 4, 4, 5, 5, 5, 6, 8, 8, 9]   (sorted, n=11)
  //   P10=v[1]=2, P25 (h=2.5)=v[2]+0.5*(v[3]-v[2])=4+0.5*0=4
  //   P50=v[5]=5, P75 (h=7.5)=v[7]+0.5*(v[8]-v[7])=6+0.5*2=7
  //   P90=v[9]=8
  //   IQR=3, IDR=6, MSR=0.5; IOM=3/5=0.6
  // Z = [1, 1, 4, 4, 5, 5, 5, 6, 9, 9, 100]   (sorted, n=11)
  //   P10=v[1]=1, P25=v[2]+0.5*0=4, P50=v[5]=5
  //   P75=v[7]+0.5*(v[8]-v[7])=6+0.5*3=7.5, P90=v[9]=9
  //   IQR=3.5, IDR=8, MSR=3.5/8=0.4375; IOM=3.5/5=0.7
  const Y = [1, 2, 4, 4, 5, 5, 5, 6, 8, 8, 9];
  const Z = [1, 1, 4, 4, 5, 5, 5, 6, 9, 9, 100];
  const yMsr = midSpreadRatioOfVector(Y);
  const zMsr = midSpreadRatioOfVector(Z);
  const yIom = iqrOverMedianOfVector(Y);
  const zIom = iqrOverMedianOfVector(Z);
  assert.ok(Math.abs(yMsr.msr - 0.5) < 1e-12);
  assert.ok(Math.abs(zMsr.msr - 0.4375) < 1e-12);
  assert.ok(Math.abs(yIom.iom - 0.6) < 1e-12);
  assert.ok(Math.abs(zIom.iom - 0.7) < 1e-12);
  // RANK FLIP: MSR ranks Y > Z; IOM ranks Z > Y.
  assert.ok(yMsr.msr > zMsr.msr, `MSR should rank Y > Z`);
  assert.ok(zIom.iom > yIom.iom, `IOM should rank Z > Y`);
});

test('rank flip vs PGR: heavy-upper-tail vs symmetric on matched IDR-shape', () => {
  // T has heavy upper tail -> big PGR but small MSR (interquartile is
  // small fraction of interdecile because P90 is far from P75).
  // S is more symmetric -> moderate PGR but bigger MSR.
  // T = [1, 2, 3, 3, 3, 3, 3, 3, 3, 4, 30]   (n=11)
  //   P10=v[1]=2, P25 (h=2.5)=3+0.5*0=3, P50=3, P75 (h=7.5)=3+0.5*0=3, P90=v[9]=4
  //   IQR=0, IDR=2, MSR = 0/2 = 0 (degenerate body); PGR = 4/3 = 1.333
  // S = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  //   IQR=5, IDR=8, MSR=0.625; PGR = 10/6 = 1.667
  // Both have PGR > 1.3, but MSR(S) >> MSR(T).
  const T = [1, 2, 3, 3, 3, 3, 3, 3, 3, 4, 30];
  const S = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const tMsr = midSpreadRatioOfVector(T);
  const sMsr = midSpreadRatioOfVector(S);
  const tPgr = percentileGapRatioOfVector(T);
  const sPgr = percentileGapRatioOfVector(S);
  assert.equal(tMsr.msr, 0);
  assert.ok(Math.abs(sMsr.msr - 0.625) < 1e-12);
  assert.ok(sMsr.msr > tMsr.msr, `MSR ranks S > T`);
  // T's PGR is non-degenerate too:
  assert.ok(tPgr.pgr > 1);
  assert.ok(sPgr.pgr > 1);
});

test('rank flip vs GE(2): tail-spike vector huge GE(2) but MSR=0', () => {
  // P = [1,1,1,1,1,1,1,1,1,1,1000]
  //   P10=v[1]=1, P25=1, P50=1, P75=1, P90=v[9]=1, MSR = 0/0 -> 0 (degenerate)
  //   GE(2) is huge.
  const P = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1000];
  const r = midSpreadRatioOfVector(P);
  assert.equal(r.msr, 0);
  assert.equal(r.degenerate, true);
  const ge2 = ge2OfVector(P).ge2;
  assert.ok(ge2 > 1, `GE(2) should be huge on tail-spike, got ${ge2}`);
});

test('midSpreadRatioOfVector: msr=1 ONLY when P10=P25 AND P75=P90 (box-clipped)', () => {
  // Sorted [3,3,3,5,5,5,5,5,7,7,7] (n=11):
  //   P10 (h=1.0) = v[1] = 3; P25 (h=2.5) = 3+0.5*(5-3)=4;
  //   P50=5; P75 (h=7.5) = 5+0.5*(7-5)=6; P90 (h=9) = v[9] = 7.
  //   IQR=2, IDR=4, MSR=0.5. NOT box-clipped (P10=3 != P25=4).
  // Sorted [3,3,3,3,5,5,5,7,7,7,7] (n=11):
  //   P10 (h=1.0) = v[1] = 3; P25 (h=2.5) = 3+0.5*0 = 3;
  //   P50=5; P75 (h=7.5) = 7+0.5*0 = 7; P90 (h=9) = v[9] = 7.
  //   IQR=4, IDR=4, MSR=1. P10=P25=3 AND P75=P90=7 -> box-clipped, degenerate=true.
  const notBox = midSpreadRatioOfVector([3, 3, 3, 5, 5, 5, 5, 5, 7, 7, 7]);
  assert.ok(Math.abs(notBox.msr - 0.5) < 1e-12);
  assert.equal(notBox.degenerate, false);
  const boxed = midSpreadRatioOfVector([3, 3, 3, 3, 5, 5, 5, 7, 7, 7, 7]);
  assert.ok(Math.abs(boxed.msr - 1.0) < 1e-12);
  assert.equal(boxed.degenerate, true);
});

// ---- Builder integration --------------------------------------------

test('buildDailyTokenMidSpreadRatio: filters bad rows, computes MSR correctly', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'A', 1),
    ql('2026-04-02T00:00:00Z', 'A', 2),
    ql('2026-04-03T00:00:00Z', 'A', 3),
    ql('2026-04-04T00:00:00Z', 'A', 4),
    ql('2026-04-05T00:00:00Z', 'A', 5),
    ql('2026-04-06T00:00:00Z', 'A', 6),
    ql('2026-04-07T00:00:00Z', 'A', 7),
    ql('2026-04-08T00:00:00Z', 'A', 8),
    ql('2026-04-09T00:00:00Z', 'A', 9),
    ql('2026-04-10T00:00:00Z', 'A', 10),
    ql('2026-04-11T00:00:00Z', 'A', 11),
    // bad rows
    ql('not-a-date', 'A', 5),
    ql('2026-04-01T00:00:00Z', 'A', 0),
  ];
  const r = buildDailyTokenMidSpreadRatio(queue, {
    minTokens: 0,
    minDays: 2,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.sources.length, 1);
  const a = r.sources[0]!;
  assert.equal(a.source, 'A');
  assert.equal(a.nDays, 11);
  // [1..11] -> MSR = 0.625 (anchored above)
  assert.ok(Math.abs(a.msr - 0.625) < 1e-12);
  assert.ok(Math.abs(a.iqrAbsolute - 5) < 1e-12);
  assert.ok(Math.abs(a.idrAbsolute - 8) < 1e-12);
});

test('buildDailyTokenMidSpreadRatio: minTokens / minDays drop sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'sparse', 5),
    ql('2026-04-02T00:00:00Z', 'sparse', 5),
    ql('2026-04-03T00:00:00Z', 'sparse', 5),
    ql('2026-04-04T00:00:00Z', 'sparse', 5),
    // dense
    ql('2026-04-01T00:00:00Z', 'dense', 5000),
    ql('2026-04-02T00:00:00Z', 'dense', 5000),
    ql('2026-04-03T00:00:00Z', 'dense', 5000),
    ql('2026-04-04T00:00:00Z', 'dense', 5000),
  ];
  const r = buildDailyTokenMidSpreadRatio(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'dense');
});

test('buildDailyTokenMidSpreadRatio: includeIom surfaces iom field', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 11; d++) {
    queue.push(ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'A', d * 100));
  }
  const r = buildDailyTokenMidSpreadRatio(queue, {
    minTokens: 0,
    minDays: 2,
    includeIom: true,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const a = r.sources[0]!;
  // [100..1100] (n=11): same shape as [1..11]*100. MSR = 0.625, IOM = 5/6
  assert.ok(Math.abs(a.msr - 0.625) < 1e-12);
  assert.ok(a.iom !== undefined);
  // P50 = 600, IQR (absolute) = 500 -> IOM = 500/600 = 5/6
  assert.ok(Math.abs((a.iom as number) - 5 / 6) < 1e-12);
});

test('buildDailyTokenMidSpreadRatio: minMsr display filter', () => {
  const queue: QueueLine[] = [];
  // flat -> degenerate, kept
  for (let d = 1; d <= 6; d++) {
    queue.push(
      ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'flat', 1000),
    );
  }
  // spread -> non-degenerate, MSR computed
  for (let d = 1; d <= 6; d++) {
    queue.push(
      ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, 'spread', d * 1000),
    );
  }
  const r = buildDailyTokenMidSpreadRatio(queue, {
    minTokens: 0,
    minDays: 2,
    minMsr: 0.0,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinMsr, 0);
});

test('buildDailyTokenMidSpreadRatio: top cap accounts for droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['x', 'y', 'z']) {
    for (let d = 1; d <= 5; d++) {
      queue.push(
        ql(`2026-04-${String(d).padStart(2, '0')}T00:00:00Z`, src, d * 100),
      );
    }
  }
  const r = buildDailyTokenMidSpreadRatio(queue, {
    minTokens: 0,
    minDays: 2,
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenMidSpreadRatio: deterministic on identical input', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'A', 100),
    ql('2026-04-02T00:00:00Z', 'A', 200),
    ql('2026-04-03T00:00:00Z', 'A', 300),
    ql('2026-04-04T00:00:00Z', 'A', 400),
    ql('2026-04-05T00:00:00Z', 'A', 500),
  ];
  const a = buildDailyTokenMidSpreadRatio(queue, { minTokens: 0, generatedAt: GEN });
  const b = buildDailyTokenMidSpreadRatio(queue, { minTokens: 0, generatedAt: GEN });
  assert.deepEqual(a, b);
});

test('buildDailyTokenMidSpreadRatio: rejects bad knobs', () => {
  assert.throws(
    () => buildDailyTokenMidSpreadRatio([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenMidSpreadRatio([], { minDays: 1 }),
    /minDays/,
  );
  assert.throws(
    () => buildDailyTokenMidSpreadRatio([], { top: -5 }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenMidSpreadRatio([], { minMsr: -0.1 }),
    /minMsr/,
  );
  assert.throws(
    () =>
      buildDailyTokenMidSpreadRatio([], {
        // @ts-expect-error testing runtime guard
        sort: 'not-a-sort',
      }),
    /sort/,
  );
});

test('buildDailyTokenMidSpreadRatio: sort by idrAbsolute orders rows by interdecile width', () => {
  const queue: QueueLine[] = [];
  // narrow: per-day all close
  for (let d = 1; d <= 11; d++) {
    queue.push(
      ql(
        `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`,
        'narrow',
        100 + d,
      ),
    );
  }
  // wide: per-day spread out
  for (let d = 1; d <= 11; d++) {
    queue.push(
      ql(
        `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`,
        'wide',
        d * 1000,
      ),
    );
  }
  const r = buildDailyTokenMidSpreadRatio(queue, {
    minTokens: 0,
    minDays: 2,
    sort: 'idrAbsolute',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'wide');
  assert.equal(r.sources[1]!.source, 'narrow');
  assert.ok(r.sources[0]!.idrAbsolute > r.sources[1]!.idrAbsolute);
});
