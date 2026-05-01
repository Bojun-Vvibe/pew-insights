import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenDecileShareGap,
  decileShareGapOfVector,
} from '../src/dailytokendecilesharegap.js';
import { hooverOfVector } from '../src/dailytokenhooverindex.js';
import { midSpreadRatioOfVector } from '../src/dailytokenmidspreadratio.js';
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

// ---- decileShareGapOfVector primitive --------------------------------

test('decileShareGapOfVector: empty -> degenerate, dsg=0', () => {
  const r = decileShareGapOfVector([]);
  assert.equal(r.dsg, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.bottomMass, 0);
  assert.equal(r.topMass, 0);
});

test('decileShareGapOfVector: singleton -> degenerate, dsg=0', () => {
  const r = decileShareGapOfVector([42]);
  assert.equal(r.dsg, 0);
  assert.equal(r.bottomMass, 42);
  assert.equal(r.topMass, 42);
  assert.equal(r.k, 1);
  assert.equal(r.degenerate, true);
});

test('decileShareGapOfVector: closed-form anchor on [1..10] -> 9/55', () => {
  const r = decileShareGapOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // k = ceil(0.1 * 10) = 1
  // bottomMass = 1; topMass = 10; total = 55
  // dsg = (10 - 1) / 55 = 9/55
  assert.equal(r.k, 1);
  assert.equal(r.bottomMass, 1);
  assert.equal(r.topMass, 10);
  assert.ok(Math.abs(r.dsg - 9 / 55) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('decileShareGapOfVector: closed-form anchor on [1..20] -> k=2, (19+20-1-2)/210', () => {
  const v = [];
  for (let i = 1; i <= 20; i += 1) v.push(i);
  const r = decileShareGapOfVector(v);
  assert.equal(r.k, 2);
  assert.equal(r.bottomMass, 1 + 2);
  assert.equal(r.topMass, 19 + 20);
  // total = 210
  assert.ok(Math.abs(r.dsg - (39 - 3) / 210) < 1e-12);
});

test('decileShareGapOfVector: all-equal vector -> dsg=0, degenerate', () => {
  const r = decileShareGapOfVector([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
  assert.equal(r.dsg, 0);
  assert.equal(r.bottomMass, r.topMass);
  assert.equal(r.degenerate, true);
});

test('decileShareGapOfVector: scale-invariance under c=10', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = a.map((x) => x * 10);
  const ra = decileShareGapOfVector(a);
  const rb = decileShareGapOfVector(b);
  assert.ok(Math.abs(ra.dsg - rb.dsg) < 1e-12);
});

test('decileShareGapOfVector: permutation-invariance', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [10, 1, 5, 3, 7, 2, 9, 4, 8, 6];
  const ra = decileShareGapOfVector(a);
  const rb = decileShareGapOfVector(b);
  assert.ok(Math.abs(ra.dsg - rb.dsg) < 1e-12);
});

test('decileShareGapOfVector: invariance to central-80% rearrangement (sum-preserving)', () => {
  // n=10, k=1; central 80% = positions 1..8 (0-indexed). Swap two
  // central values (preserving total) => same sorted-extreme deciles.
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100];
  const b = [1, 4, 2, 8, 3, 5, 7, 6, 9, 100]; // same multiset
  const ra = decileShareGapOfVector(a);
  const rb = decileShareGapOfVector(b);
  assert.ok(Math.abs(ra.dsg - rb.dsg) < 1e-12);
  assert.equal(ra.bottomMass, rb.bottomMass);
  assert.equal(ra.topMass, rb.topMass);
});

test('decileShareGapOfVector: rejects non-positive / non-finite values', () => {
  assert.throws(() => decileShareGapOfVector([1, 2, 0, 4]), /strictly-positive/);
  assert.throws(() => decileShareGapOfVector([1, 2, -3, 4]), /strictly-positive/);
  assert.throws(() => decileShareGapOfVector([1, 2, Number.NaN, 4]), /strictly-positive/);
  assert.throws(() => decileShareGapOfVector([1, 2, Number.POSITIVE_INFINITY, 4]), /strictly-positive/);
});

test('decileShareGapOfVector: dsg in [0, 1]', () => {
  const r = decileShareGapOfVector([1, 1, 1, 1, 1, 1, 1, 1, 1, 1000]);
  assert.ok(r.dsg >= 0);
  assert.ok(r.dsg <= 1);
});

test('decileShareGapOfVector: rank-flip witness vs Hoover (axis 36)', () => {
  // From the docstring witness:
  //   A = [1,2,2,2,2,2,2,2,2,11] -> DSG ~ 0.357, Hoover ~ 0.293
  //   B = [1,1,1,1,5,5,5,5,9,9]  -> DSG ~ 0.190, Hoover ~ 0.305
  // DSG ranks A > B; Hoover ranks B > A. Real flip.
  const A = [1, 2, 2, 2, 2, 2, 2, 2, 2, 11];
  const B = [1, 1, 1, 1, 5, 5, 5, 5, 9, 9];
  const ra = decileShareGapOfVector(A);
  const rb = decileShareGapOfVector(B);
  assert.ok(ra.dsg > rb.dsg, `A.dsg ${ra.dsg} should be > B.dsg ${rb.dsg}`);
  // Cross-check Hoover via the public hooverOfVector primitive:
  const ha = hooverOfVector(A);
  const hb = hooverOfVector(B);
  assert.ok(hb.hoover > ha.hoover, `B.hoover ${hb.hoover} should be > A.hoover ${ha.hoover}`);
});

test('decileShareGapOfVector: rank-flip witness vs MSR (axis 60)', () => {
  // From the docstring witness:
  //   A = [1,2,2,2,2,2,2,2,2,11]: P10..P90 around 2 (tight body) -> MSR=0 (degenerate)
  //   B = [1,1,1,1,5,5,5,5,9,9]:  MSR = (P75-P25)/(P90-P10) = (5-1)/(9-1) = 0.5
  // DSG ranks A > B; MSR ranks B > A.
  const A = [1, 2, 2, 2, 2, 2, 2, 2, 2, 11];
  const B = [1, 1, 1, 1, 5, 5, 5, 5, 9, 9];
  const ra = decileShareGapOfVector(A);
  const rb = decileShareGapOfVector(B);
  assert.ok(ra.dsg > rb.dsg);
  const ma = midSpreadRatioOfVector(A);
  const mb = midSpreadRatioOfVector(B);
  assert.ok(mb.msr > ma.msr);
});

test('decileShareGapOfVector: hoover refinement matches reference primitive', () => {
  const v = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  const r = decileShareGapOfVector(v);
  const h = hooverOfVector(v);
  assert.ok(Math.abs(r.hoover - h.hoover) < 1e-12);
});

test('decileShareGapOfVector: top/bottom share sum to <= 1 and DSG = topShare - bottomShare', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = decileShareGapOfVector(v);
  assert.ok(r.topShare + r.bottomShare <= 1 + 1e-12);
  assert.ok(Math.abs(r.dsg - (r.topShare - r.bottomShare)) < 1e-12);
});

// ---- buildDailyTokenDecileShareGap end-to-end ------------------------

test('buildDailyTokenDecileShareGap: simple two-source happy path', () => {
  const queue: QueueLine[] = [];
  // Source A: 10 days, ramp 1..10 (after rounding) tokens per day x1000
  for (let d = 1; d <= 10; d += 1) {
    const day = `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`;
    queue.push(ql(day, 'A', d * 1000));
  }
  // Source B: 10 days, all 5000 tokens
  for (let d = 1; d <= 10; d += 1) {
    const day = `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`;
    queue.push(ql(day, 'B', 5000));
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 2);
  // A is non-degenerate; B is degenerate (all equal).
  const a = r.sources.find((s) => s.source === 'A')!;
  const b = r.sources.find((s) => s.source === 'B')!;
  assert.equal(a.degenerate, false);
  // A DSG = (10000 - 1000) / 55000 = 9/55
  assert.ok(Math.abs(a.dsg - 9 / 55) < 1e-12);
  assert.equal(b.degenerate, true);
  assert.equal(b.dsg, 0);
});

test('buildDailyTokenDecileShareGap: hides sparse + low-day sources', () => {
  const queue: QueueLine[] = [];
  // Sparse: under min-tokens
  queue.push(ql('2026-04-01T00:00:00Z', 'sparse', 500));
  // Low days: 3 days, exceeds min-tokens but below min-days=4
  for (let d = 1; d <= 3; d += 1) {
    queue.push(ql(`2026-04-0${d}T00:00:00Z`, 'lowdays', 1000));
  }
  // Full
  for (let d = 1; d <= 5; d += 1) {
    queue.push(ql(`2026-04-0${d}T00:00:00Z`, 'full', 1000));
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'full');
});

test('buildDailyTokenDecileShareGap: source filter routes through droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    queue.push(ql(`2026-04-0${d}T00:00:00Z`, 'A', 1000));
    queue.push(ql(`2026-04-0${d}T00:00:00Z`, 'B', 1000));
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    source: 'A',
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.source, 'A');
  assert.equal(r.droppedSourceFilter, 5);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('buildDailyTokenDecileShareGap: includeHoover surfaces hoover field', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 10; d += 1) {
    const day = `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`;
    queue.push(ql(day, 'A', d * 1000));
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    includeHoover: true,
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  const a = r.sources[0]!;
  assert.ok(a.hoover !== undefined);
  // Sanity: positive ramp has hoover > 0.
  assert.ok((a.hoover as number) > 0);
});

test('buildDailyTokenDecileShareGap: minDsg filter drops below threshold', () => {
  const queue: QueueLine[] = [];
  // Source HIGH: ramp -> dsg = 9/55 ~ 0.1636
  for (let d = 1; d <= 10; d += 1) {
    const day = `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`;
    queue.push(ql(day, 'HIGH', d * 1000));
  }
  // Source FLAT: constant -> degenerate (kept regardless of minDsg per spec)
  for (let d = 1; d <= 10; d += 1) {
    const day = `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`;
    queue.push(ql(day, 'FLAT', 5000));
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    minDsg: 0.5,
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  // HIGH (dsg ~0.16) below threshold; FLAT degenerate (passes filter).
  assert.equal(r.droppedBelowMinDsg, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'FLAT');
});

test('buildDailyTokenDecileShareGap: top-cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['A', 'B', 'C']) {
    for (let d = 1; d <= 5; d += 1) {
      queue.push(ql(`2026-04-0${d}T00:00:00Z`, src, 1000));
    }
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    top: 2,
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenDecileShareGap: rejects bad knobs', () => {
  assert.throws(
    () => buildDailyTokenDecileShareGap([], { minDays: 1, generatedAt: GEN }),
    /minDays/,
  );
  assert.throws(
    () => buildDailyTokenDecileShareGap([], { top: -1, generatedAt: GEN }),
    /top/,
  );
  assert.throws(
    () => buildDailyTokenDecileShareGap([], { minDsg: -0.1, generatedAt: GEN }),
    /minDsg/,
  );
  assert.throws(
    () =>
      buildDailyTokenDecileShareGap([], {
        // @ts-expect-error invalid sort
        sort: 'not-a-key',
        generatedAt: GEN,
      }),
    /sort/,
  );
});

test('buildDailyTokenDecileShareGap: bad hour_start surfaces in dropped counter', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'A', 1000),
    ql('2026-04-01T00:00:00Z', 'A', 1000),
    ql('2026-04-02T00:00:00Z', 'A', 1000),
    ql('2026-04-03T00:00:00Z', 'A', 1000),
    ql('2026-04-04T00:00:00Z', 'A', 1000),
  ];
  const r = buildDailyTokenDecileShareGap(queue, {
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('buildDailyTokenDecileShareGap: deterministic given fixed input + generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 6; d += 1) {
    queue.push(ql(`2026-04-0${d}T00:00:00Z`, 'A', d * 100));
  }
  const r1 = buildDailyTokenDecileShareGap(queue, { generatedAt: GEN, minTokens: 100 });
  const r2 = buildDailyTokenDecileShareGap(queue, { generatedAt: GEN, minTokens: 100 });
  assert.deepEqual(r1, r2);
});

// ---- structural edge cases (refinement) -----------------------------

test('decileShareGapOfVector: small-n (k may exceed floor(n/2)) still yields finite dsg', () => {
  // n=2: k = ceil(0.10*2) = 1. bottom=1, top=2, total=3, dsg=1/3.
  const r = decileShareGapOfVector([1, 2]);
  assert.equal(r.k, 1);
  assert.ok(Math.abs(r.dsg - 1 / 3) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('decileShareGapOfVector: small-n with duplicate extremes -> dsg=0 degenerate', () => {
  // n=2 both equal: bottom=top -> dsg=0 degenerate.
  const r = decileShareGapOfVector([5, 5]);
  assert.equal(r.dsg, 0);
  assert.equal(r.degenerate, true);
});

test('decileShareGapOfVector: dsg upper-bound asymptote (heavy tail)', () => {
  // n=10, single huge spike: dsg -> close to 1 - 2*minDay/total
  const v = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1_000_000];
  const r = decileShareGapOfVector(v);
  // bottom=1, top=1_000_000, total=1_000_009
  // dsg = (1_000_000 - 1) / 1_000_009 ~= 0.99999...
  assert.ok(r.dsg > 0.9999);
  assert.ok(r.dsg < 1);
});

test('decileShareGapOfVector: changing the central body without changing total preserves dsg', () => {
  // n=10, k=1; central 80% = positions 1..8 (sorted, 0-indexed).
  // Swap two interior values in a way that does NOT change which
  // value is the min/max: dsg unchanged.
  const a = [1, 3, 5, 5, 5, 5, 5, 5, 7, 100];
  const b = [1, 5, 3, 7, 5, 5, 5, 5, 5, 100]; // same multiset
  const ra = decileShareGapOfVector(a);
  const rb = decileShareGapOfVector(b);
  assert.equal(ra.dsg, rb.dsg);
  assert.equal(ra.bottomMass, rb.bottomMass);
  assert.equal(ra.topMass, rb.topMass);
});

test('decileShareGapOfVector: k = ceil(0.10*n) jumps at n=11 (k=2)', () => {
  // For n=10 -> k=1; for n=11 -> k = ceil(1.1) = 2.
  const r10 = decileShareGapOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r10.k, 1);
  const r11 = decileShareGapOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  assert.equal(r11.k, 2);
  // r11 bottom = 1+2 = 3; top = 10+11 = 21; total = 66; dsg = 18/66 = 3/11
  assert.equal(r11.bottomMass, 3);
  assert.equal(r11.topMass, 21);
  assert.ok(Math.abs(r11.dsg - 18 / 66) < 1e-12);
});

test('decileShareGapOfVector: closed-cone identity DSG = topShare - bottomShare', () => {
  // The numerator and denominator are both linear in the day vector,
  // so DSG is exactly topShare - bottomShare. Verify on a non-trivial
  // sample.
  const v = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9];
  const r = decileShareGapOfVector(v);
  assert.ok(Math.abs(r.dsg - (r.topShare - r.bottomShare)) < 1e-12);
});

test('buildDailyTokenDecileShareGap: minDsg keeps degenerate rows regardless of threshold', () => {
  const queue: QueueLine[] = [];
  // FLAT source: degenerate (all same) -> dsg=0
  for (let d = 1; d <= 10; d += 1) {
    const day = `2026-04-${String(d).padStart(2, '0')}T00:00:00Z`;
    queue.push(ql(day, 'FLAT', 5000));
  }
  const r = buildDailyTokenDecileShareGap(queue, {
    minDsg: 0.99, // very strict
    minTokens: 1000,
    minDays: 4,
    generatedAt: GEN,
  });
  // Degenerate kept, no drops.
  assert.equal(r.droppedBelowMinDsg, 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
});
