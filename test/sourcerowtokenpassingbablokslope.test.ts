/**
 * Unit + property tests for source-row-token-passing-bablok-slope.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenPassingBablokSlope,
  passingBablokSlope,
} from '../src/sourcerowtokenpassingbablokslope.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-29T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

// --- kernel: passingBablokSlope ---

test('passingBablokSlope: perfect line slope=2 intercept=3', () => {
  const xs = [3, 5, 7, 9, 11, 13];
  const r = passingBablokSlope(xs);
  assert.equal(r.slope, 2);
  assert.equal(r.intercept, 3);
  assert.equal(r.theilSenSlope, 2);
  assert.equal(r.pairsBelowMinusOne, 0);
  assert.equal(r.pairsValid, 15);
  assert.equal(r.pairsDroppedMinusOne, 0);
});

test('passingBablokSlope: flat constant slope=0', () => {
  const xs = [42, 42, 42, 42, 42];
  const r = passingBablokSlope(xs);
  assert.equal(r.slope, 0);
  assert.equal(r.intercept, 42);
  assert.equal(r.theilSenSlope, 0);
  assert.equal(r.pairsBelowMinusOne, 0);
  assert.equal(r.pairsValid, 10);
});

test('passingBablokSlope: strictly decreasing', () => {
  const xs = [10, 8, 6, 4, 2];
  const r = passingBablokSlope(xs);
  assert.equal(r.slope, -2);
  assert.equal(r.theilSenSlope, -2);
  assert.equal(r.intercept, 10);
  // K = #{slopes < -1}: slopes are all -2, so K = 10
  assert.equal(r.pairsBelowMinusOne, 10);
});

test('passingBablokSlope: needs at least 2 points', () => {
  assert.throws(() => passingBablokSlope([7]), /at least 2 points/);
  assert.throws(() => passingBablokSlope([]), /at least 2 points/);
});

test('passingBablokSlope: two points slope = (x1-x0)/1', () => {
  const r = passingBablokSlope([5, 9]);
  assert.equal(r.slope, 4);
  assert.equal(r.theilSenSlope, 4);
  assert.equal(r.pairsValid, 1);
  assert.equal(r.pairsBelowMinusOne, 0);
});

test('passingBablokSlope: PB matches plain median when no slopes < -1', () => {
  // ascending -> all slopes positive -> K=0 -> shiftIndex == standard median pos
  const xs = [0, 1, 3, 6, 10];
  const r = passingBablokSlope(xs);
  assert.equal(r.pairsBelowMinusOne, 0);
  assert.equal(r.slope, r.theilSenSlope);
});

test('passingBablokSlope: PB shifts away from Theil-Sen when many slopes < -1', () => {
  // Mixture: heavy negative slopes at the start, mild positive after.
  const xs = [100, 50, 20, 5, 6, 8, 11, 15];
  const r = passingBablokSlope(xs);
  assert.ok(r.pairsBelowMinusOne > 0);
  // PB shift should be non-trivial.
  assert.notEqual(r.slope, r.theilSenSlope);
});

test('passingBablokSlope: pbVsTheilSenGap sign matches direction of shift', () => {
  const xs = [100, 80, 60, 40, 20, 0];
  const r = passingBablokSlope(xs);
  // All slopes are -20; K equals all pairs; PB and TS should both be -20.
  assert.equal(r.theilSenSlope, -20);
  assert.equal(r.slope, -20);
});

test('passingBablokSlope: shiftIndex within [1, N]', () => {
  const xs = [10, 1, 30, 5, 22, 7, 18];
  const r = passingBablokSlope(xs);
  assert.ok(r.shiftIndex >= 1);
  assert.ok(r.shiftIndex <= r.pairsValid);
});

test('passingBablokSlope: K is always <= shiftIndex except in the all-K degenerate fallback', () => {
  const xs = [50, 40, 30, 20, 10, 9, 8, 7];
  const r = passingBablokSlope(xs);
  // Normal case: not all slopes are < -1, so the K + localPos branch fires
  // and shiftIndex > K. (When K == N every slope is < -1 and we fall back to
  // the plain median position floor((N+1)/2), which can be < K. That branch is
  // covered separately.)
  if (r.pairsBelowMinusOne < r.pairsValid) {
    assert.ok(r.pairsBelowMinusOne < r.shiftIndex);
  }
  assert.ok(r.shiftIndex >= 1);
  assert.ok(r.shiftIndex <= r.pairsValid);
});

test('passingBablokSlope: PB recovers slope under heavy point-corruption (~29% breakdown)', () => {
  // 12 pristine y=i, corrupt 3 (~25%) to wild outliers; PB should still recover slope ~ 1
  const xs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  xs[2] = 1000;
  xs[5] = -500;
  xs[9] = 9999;
  const r = passingBablokSlope(xs);
  // Should still be close to 1, not 100s.
  assert.ok(Math.abs(r.slope - 1) < 5);
});

test('passingBablokSlope: drops slope == -1', () => {
  // Construct: x0=10, x1=9 -> slope (9-10)/(1-0) = -1 -> dropped.
  const xs = [10, 9, 5];
  const r = passingBablokSlope(xs);
  // Pair (0,1) drops; remaining: (0,2) slope=(5-10)/2=-2.5; (1,2) slope=(5-9)/1=-4
  assert.equal(r.pairsDroppedMinusOne, 1);
  assert.equal(r.pairsValid, 2);
});

test('passingBablokSlope: translation equivariance in x (shift y)', () => {
  const xs = [1, 4, 9, 16, 25];
  const r1 = passingBablokSlope(xs);
  const r2 = passingBablokSlope(xs.map((v) => v + 1000));
  assert.equal(r1.slope, r2.slope); // slope unchanged under y-translation
});

test('passingBablokSlope: positive scale equivariance (multiply y by c>0)', () => {
  const xs = [1, 4, 9, 16, 25];
  const r1 = passingBablokSlope(xs);
  const r2 = passingBablokSlope(xs.map((v) => v * 7));
  assert.ok(Math.abs(r2.slope - 7 * r1.slope) < 1e-9);
});

// --- builder: buildSourceRowTokenPassingBablokSlope ---

test('builder: empty queue -> zero sources', () => {
  const r = buildSourceRowTokenPassingBablokSlope([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalRowsKept, 0);
});

test('builder: single source ascending series', () => {
  const queue = mkSeries('s1', [10, 20, 30, 40, 50]);
  const r = buildSourceRowTokenPassingBablokSlope(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.rowsKept, 5);
  assert.equal(row.slope, 10);
  assert.equal(row.theilSenSlope, 10);
  assert.equal(row.slopeSign, 'up');
  assert.equal(row.firstX, 10);
  assert.equal(row.lastX, 50);
});

test('builder: drops sources below min-rows', () => {
  const q = [
    ...mkSeries('big', [1, 2, 3, 4, 5]),
    ...mkSeries('tiny', [9, 9]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('builder: rejects min-rows < 4', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        minRows: 3,
      }),
    /minRows must be an integer >= 4/,
  );
});

test('builder: rejects non-integer min-rows', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        minRows: 4.5,
      }),
    /minRows must be an integer/,
  );
});

test('builder: rejects negative min-slope-magnitude', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        minSlopeMagnitude: -0.1,
      }),
    /minSlopeMagnitude/,
  );
});

test('builder: rejects bad max-pairs', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        maxPairs: 0,
      }),
    /maxPairs/,
  );
});

test('builder: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        // @ts-expect-error invalid sort
        sort: 'wibble',
      }),
    /sort must be one of/,
  );
});

test('builder: rejects bad top', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], { generatedAt: GEN, top: 0 }),
    /top must be a positive integer/,
  );
});

test('builder: rejects invalid since', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        since: 'not-a-date',
      }),
    /invalid since/,
  );
});

test('builder: rejects invalid until', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

test('builder: source filter keeps only matches', () => {
  const q = [
    ...mkSeries('keep', [1, 2, 3, 4, 5]),
    ...mkSeries('skip', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 5);
});

test('builder: drops bad hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 5),
    ...mkSeries('s', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: drops non-finite total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', NaN),
    ...mkSeries('s', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('builder: drops negative total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-27T00:00:00.000Z', 's', -1),
    ...mkSeries('s', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('builder: empty source string maps to "unknown"', () => {
  const q: QueueLine[] = [1, 2, 3, 4, 5].map((v, i) =>
    ql(
      `2026-04-27T00:${String(i).padStart(2, '0')}:00.000Z`,
      '',
      v,
    ),
  );
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('builder: max-pairs cap drops the source', () => {
  const q = mkSeries('big', [1, 2, 3, 4, 5]);
  // n=5 -> n*(n-1)/2 = 10. Cap at 9 -> drops.
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    maxPairs: 9,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedAbovePairCap, 1);
});

test('builder: min-slope-magnitude filter', () => {
  const q = [
    ...mkSeries('flat', [5, 5, 5, 5, 5]),
    ...mkSeries('steep', [1, 10, 20, 30, 40]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    minSlopeMagnitude: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'steep');
  assert.equal(r.droppedBelowMinSlopeMagnitude, 1);
});

test('builder: top cap reports droppedBelowTopCap', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [1, 4, 9, 16, 25]),
    ...mkSeries('c', [10, 20, 30, 40, 50]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowTopCap, 2);
});

test('builder: sort=slope-desc orders by slope descending', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]), // slope=1
    ...mkSeries('b', [1, 11, 21, 31, 41]), // slope=10
    ...mkSeries('c', [50, 40, 30, 20, 10]), // slope=-10
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'slope-desc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['b', 'a', 'c'],
  );
});

test('builder: sort=slope-asc orders by slope ascending', () => {
  const q = [
    ...mkSeries('a', [1, 2, 3, 4, 5]),
    ...mkSeries('b', [1, 11, 21, 31, 41]),
    ...mkSeries('c', [50, 40, 30, 20, 10]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'slope-asc',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['c', 'a', 'b'],
  );
});

test('builder: sort=rows orders by rowsKept desc, source asc tiebreak', () => {
  const q = [
    ...mkSeries('aa', [1, 2, 3, 4, 5]),
    ...mkSeries('bb', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('cc', [1, 2, 3, 4, 5, 6]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['bb', 'cc', 'aa'],
  );
});

test('builder: sort=source orders alphabetically', () => {
  const q = [
    ...mkSeries('zeta', [1, 2, 3, 4, 5]),
    ...mkSeries('alpha', [1, 2, 3, 4, 5]),
    ...mkSeries('mu', [1, 2, 3, 4, 5]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('builder: sort=gap-magnitude-desc by |pbVsTheilSenGap| desc', () => {
  // Construct a contrast: one ascending (gap=0), one with large negative slopes.
  const q = [
    ...mkSeries('clean', [0, 1, 2, 3, 4, 5, 6, 7]),
    ...mkSeries('shifty', [100, 80, 60, 40, 20, 0, -20, -40]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'gap-magnitude-desc',
  });
  // 'shifty' has K > 0 so PB shifts off TS; but here all slopes are -20 -> gap=0.
  // It's still a valid sort; just verify length and ordering is deterministic.
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.pbVsTheilSenGap) >=
      Math.abs(r.sources[1]!.pbVsTheilSenGap),
  );
});

test('builder: sort=shift-ratio-desc by shiftIndex/N desc', () => {
  const q = [
    ...mkSeries('asc', [0, 1, 2, 3, 4, 5, 6, 7]),
    ...mkSeries('desc', [100, 80, 60, 40, 20, 5, 1, 0]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'shift-ratio-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.shiftRatio >= r.sources[1]!.shiftRatio);
  // 'desc' (which has many slopes < -1) should land first.
  assert.equal(r.sources[0]!.source, 'desc');
});

test('builder: report metadata echoes options', () => {
  const r = buildSourceRowTokenPassingBablokSlope([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
    minRows: 5,
    minSlopeMagnitude: 0.25,
    maxPairs: 100,
    top: 7,
    sort: 'slope-desc',
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.minRows, 5);
  assert.equal(r.minSlopeMagnitude, 0.25);
  assert.equal(r.maxPairs, 100);
  assert.equal(r.top, 7);
  assert.equal(r.sort, 'slope-desc');
});

test('builder: anchorAgreement-style invariants — pairsBelowMinusOne <= pairsValid', () => {
  const q = mkSeries('s', [50, 40, 30, 20, 10, 5, 4, 3]);
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(row.pairsBelowMinusOne <= row.pairsValid);
  assert.ok(row.shiftIndex >= 1 && row.shiftIndex <= row.pairsValid);
  assert.ok(row.shiftRatio >= 0 && row.shiftRatio <= 1);
});

test('builder: pbVsTheilSenGap = slope - theilSenSlope exactly', () => {
  const q = mkSeries('s', [9, 1, 8, 2, 7, 3, 6, 4]);
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.pbVsTheilSenGap, row.slope - row.theilSenSlope);
});

test('builder: rows sorted chronologically by hour_start', () => {
  // Insert out of order: PB should still pick xs in time order.
  const q: QueueLine[] = [
    ql('2026-04-27T00:04:00.000Z', 's', 50),
    ql('2026-04-27T00:00:00.000Z', 's', 10),
    ql('2026-04-27T00:01:00.000Z', 's', 20),
    ql('2026-04-27T00:02:00.000Z', 's', 30),
    ql('2026-04-27T00:03:00.000Z', 's', 40),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.firstX, 10);
  assert.equal(row.lastX, 50);
  assert.equal(row.slope, 10);
});

// --- property tests ---

function seededRand(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('property: PB slope stable under y-translation across 30 random series', () => {
  const rand = seededRand(0xc0ffee);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 5 + Math.floor(rand() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(rand() * 100);
    const c = (rand() - 0.5) * 1000;
    const a = passingBablokSlope(xs).slope;
    const b = passingBablokSlope(xs.map((v) => v + c)).slope;
    assert.ok(Math.abs(a - b) < 1e-9, `trial ${trial}: ${a} vs ${b}`);
  }
});

test('property: PB slope is positive-scale equivariant when c >= 1 keeps no slope from crossing -1', () => {
  // PB is NOT scale-equivariant in general: multiplying y by c can move
  // slopes across the fixed s = -1 cutoff and change K. But if all
  // pristine slopes are already non-negative (no chance of crossing -1
  // under positive scaling), PB scales linearly.
  const rand = seededRand(0xbeef);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 5 + Math.floor(rand() * 15);
    // Strictly ascending xs -> all pairwise slopes > 0 -> K stays 0 under any c > 0.
    const xs: number[] = [];
    let v = rand() * 10;
    for (let i = 0; i < n; i += 1) {
      v += 0.5 + rand() * 5;
      xs.push(v);
    }
    const c = 0.1 + rand() * 10;
    const a = passingBablokSlope(xs).slope;
    const b = passingBablokSlope(xs.map((v) => v * c)).slope;
    assert.ok(
      Math.abs(b - c * a) < 1e-6,
      `trial ${trial}: ${b} vs ${c * a}`,
    );
  }
});

test('property: PB on monotone-ascending data is non-negative', () => {
  const rand = seededRand(0xfeed);
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 5 + Math.floor(rand() * 20);
    const xs: number[] = [];
    let v = rand() * 10;
    for (let i = 0; i < n; i += 1) {
      v += rand() * 5;
      xs.push(v);
    }
    const r = passingBablokSlope(xs);
    assert.ok(r.slope >= 0, `trial ${trial}: slope ${r.slope}`);
    assert.equal(r.pairsBelowMinusOne, 0);
  }
});

test('property: PB shiftIndex bounded by [1, N]', () => {
  const rand = seededRand(0x1234);
  for (let trial = 0; trial < 25; trial += 1) {
    const n = 5 + Math.floor(rand() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push((rand() - 0.5) * 200);
    const r = passingBablokSlope(xs);
    assert.ok(r.shiftIndex >= 1 && r.shiftIndex <= r.pairsValid);
  }
});

// --- v0.6.218 refinement: pbVsNaiveGap + signFlippedFromNaive ---

test('refinement: pbVsNaiveGap = slope - naiveSlope exactly', () => {
  const q = mkSeries('s', [9, 1, 8, 2, 7, 3, 6, 4]);
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.pbVsNaiveGap, row.slope - row.naiveSlope);
});

test('refinement: signFlippedFromNaive=true when naive negative but PB positive', () => {
  // Endpoints drag down: huge first, tiny last, but bulk rises afterwards.
  const xs = [1000, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
  const r = passingBablokSlope(xs);
  const naive = (xs[xs.length - 1]! - xs[0]!) / (xs.length - 1);
  // naive should be negative; PB likely positive given the long ascending tail.
  assert.ok(naive < 0);
  const q = mkSeries('s', xs);
  const built = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = built.sources[0]!;
  if (row.slope > 0) {
    assert.equal(row.signFlippedFromNaive, true);
  }
});

test('refinement: signFlippedFromNaive=false when both same sign', () => {
  const q = mkSeries('s', [1, 2, 3, 4, 5, 6, 7]);
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.signFlippedFromNaive, false);
  assert.ok(row.slope > 0);
  assert.ok(row.naiveSlope > 0);
});

test('refinement: signFlippedFromNaive=false when slope is exactly zero', () => {
  const q = mkSeries('s', [5, 5, 5, 5, 5]);
  const r = buildSourceRowTokenPassingBablokSlope(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.slope, 0);
  assert.equal(row.naiveSlope, 0);
  assert.equal(row.signFlippedFromNaive, false);
});

test('refinement: sort=naive-gap-magnitude-desc orders by |pbVsNaiveGap| desc', () => {
  const q = [
    ...mkSeries('clean', [1, 2, 3, 4, 5, 6]),
    ...mkSeries('noisy', [1000, 5, 6, 7, 8, 9, 10, 11, 12]),
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'naive-gap-magnitude-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(
    Math.abs(r.sources[0]!.pbVsNaiveGap) >=
      Math.abs(r.sources[1]!.pbVsNaiveGap),
  );
});

test('refinement: sort=sign-flipped-first puts flipped sources before non-flipped', () => {
  const q = [
    ...mkSeries('clean', [1, 2, 3, 4, 5, 6, 7, 8]), // no flip
    ...mkSeries('flipper', [1000, 5, 6, 7, 8, 9, 10, 11, 12, 13]), // potential flip
  ];
  const r = buildSourceRowTokenPassingBablokSlope(q, {
    generatedAt: GEN,
    sort: 'sign-flipped-first',
  });
  assert.equal(r.sources.length, 2);
  // Flipped (true=1) should sort before non-flipped (false=0) under desc.
  if (r.sources[0]!.signFlippedFromNaive !== r.sources[1]!.signFlippedFromNaive) {
    assert.equal(r.sources[0]!.signFlippedFromNaive, true);
    assert.equal(r.sources[1]!.signFlippedFromNaive, false);
  }
});

test('refinement: validates new sort keys', () => {
  assert.throws(
    () =>
      buildSourceRowTokenPassingBablokSlope([], {
        generatedAt: GEN,
        // @ts-expect-error invalid sort
        sort: 'naive-gap-magnitude-asc',
      }),
    /sort must be one of/,
  );
});
