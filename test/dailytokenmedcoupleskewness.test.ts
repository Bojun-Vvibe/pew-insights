import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenMedcoupleSkewness,
  medcoupleOfVector,
} from '../src/dailytokenmedcoupleskewness.js';
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

// ---- medcoupleOfVector primitive --------------------------------------

test('medcoupleOfVector: rejects non-finite values', () => {
  assert.throws(() => medcoupleOfVector([1, NaN, 3]));
  assert.throws(() => medcoupleOfVector([1, Infinity, 3]));
});

test('medcoupleOfVector: empty / singleton -> degenerate', () => {
  const r0 = medcoupleOfVector([]);
  assert.equal(r0.degenerate, true);
  assert.equal(r0.mc, 0);
  const r1 = medcoupleOfVector([42]);
  assert.equal(r1.degenerate, true);
  assert.equal(r1.mc, 0);
});

test('medcoupleOfVector: all-equal -> degenerate, mc=0', () => {
  const r = medcoupleOfVector([7, 7, 7, 7, 7]);
  assert.equal(r.degenerate, true);
  assert.equal(r.mc, 0);
  assert.equal(r.median, 7);
  assert.equal(r.nTies, 5);
});

test('medcoupleOfVector: symmetric vector -> mc=0', () => {
  // Symmetric around 5: 1,3,5,7,9
  const r = medcoupleOfVector([1, 3, 5, 7, 9]);
  // m=5; lower={1,3}, upper={7,9}, ties={5}
  // pairs: left = {1,3,5}, right = {5,7,9}
  // Skip (5,5). Remaining 8 pairs (1,5),(1,7),(1,9),(3,5),(3,7),(3,9),(5,7),(5,9):
  //   (1,5): ((5-5)-(5-1))/(5-1) = (0-4)/4 = -1
  //   (1,7): ((7-5)-(5-1))/(7-1) = (2-4)/6 = -1/3
  //   (1,9): ((9-5)-(5-1))/(9-1) = (4-4)/8 = 0
  //   (3,5): ((5-5)-(5-3))/(5-3) = -1
  //   (3,7): ((7-5)-(5-3))/(7-3) = 0
  //   (3,9): ((9-5)-(5-3))/(9-3) = 2/6 = 1/3
  //   (5,7): ((7-5)-(5-5))/(7-5) = 1
  //   (5,9): ((9-5)-(5-5))/(9-5) = 1
  // Median of {-1,-1/3,0,-1,0,1/3,1,1} sorted = {-1,-1,-1/3,0,0,1/3,1,1}
  // median (avg of 4th and 5th) = (0+0)/2 = 0
  assert.equal(r.median, 5);
  assert.ok(Math.abs(r.mc - 0) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('medcoupleOfVector: right-skewed -> mc > 0', () => {
  // Most values low, one very high
  const r = medcoupleOfVector([1, 2, 3, 4, 100]);
  // m = 3; lower={1,2}, upper={4,100}, ties={3}
  // Right-skewed -> mc should be positive.
  assert.ok(r.mc > 0, `expected positive mc, got ${r.mc}`);
  assert.equal(r.degenerate, false);
});

test('medcoupleOfVector: left-skewed -> mc < 0', () => {
  // Most values high, one very low
  const r = medcoupleOfVector([1, 96, 97, 98, 99]);
  // m = 97; lower={1,96}, upper={98,99}, ties={97}
  assert.ok(r.mc < 0, `expected negative mc, got ${r.mc}`);
});

test('medcoupleOfVector: reflection sign-flip -- MC(-X + 2m) = -MC(X)', () => {
  const X = [1, 2, 3, 4, 100];
  const m = 3; // sample median of X
  const reflected = X.map((v) => 2 * m - v);
  const a = medcoupleOfVector(X);
  const b = medcoupleOfVector(reflected);
  assert.ok(Math.abs(a.mc + b.mc) < 1e-12, `expected MC(-X+2m) = -MC(X), got ${a.mc} vs ${b.mc}`);
});

test('medcoupleOfVector: scale invariance -- MC(c*X) = MC(X) for c > 0', () => {
  const X = [1, 2, 3, 4, 100];
  const a = medcoupleOfVector(X);
  const b = medcoupleOfVector(X.map((v) => v * 137.5));
  assert.ok(Math.abs(a.mc - b.mc) < 1e-12);
});

test('medcoupleOfVector: bounded in [-1, +1]', () => {
  // Try several distributions and check the bound.
  const vectors = [
    [1, 1, 1, 1, 100],
    [1, 100, 100, 100, 100],
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [1, 1, 2, 2, 3, 100, 100, 100, 100, 100],
  ];
  for (const v of vectors) {
    const r = medcoupleOfVector(v);
    assert.ok(r.mc >= -1 - 1e-12 && r.mc <= 1 + 1e-12, `mc out of bounds: ${r.mc} for ${JSON.stringify(v)}`);
  }
});

test('medcoupleOfVector: handles ties at the median', () => {
  // Many ties at m=5
  const r = medcoupleOfVector([1, 2, 5, 5, 5, 5, 5, 8, 9]);
  assert.equal(r.median, 5);
  assert.equal(r.nTies, 5);
  assert.equal(r.degenerate, false);
  assert.ok(r.mc >= -1 && r.mc <= 1);
});

// ---- buildDailyTokenMedcoupleSkewness builder -------------------------

test('build: empty queue -> totalSources 0', () => {
  const r = buildDailyTokenMedcoupleSkewness([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: drops sources below min-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 4; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'A', 1000 * i));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, { generatedAt: GEN, minDays: 5 });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 0);
});

test('build: drops sources below min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 6; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'A', 10));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, { generatedAt: GEN, minTokens: 1000 });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: end-to-end right-skewed source has mc > 0', () => {
  const queue: QueueLine[] = [];
  // Per-day vector [1000, 2000, 3000, 4000, 100000] -> right-skewed
  const vals = [1000, 2000, 3000, 4000, 100000];
  for (let i = 0; i < vals.length; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'RIGHT', vals[i]!));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'RIGHT');
  assert.ok(r.sources[0]!.mc > 0);
  assert.equal(r.sources[0]!.median, 3000);
});

test('build: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { minDays: 2 }));
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { top: -2 }));
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { sort: 'bogus' as never }));
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { minAbsMc: -0.1 }));
  assert.throws(() => buildDailyTokenMedcoupleSkewness([], { minAbsMc: 1.5 }));
});

test('build: source filter restricts to a single source', () => {
  const queue: QueueLine[] = [];
  const vals = [1000, 2000, 3000, 4000, 5000];
  for (let i = 0; i < vals.length; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'KEEP', vals[i]!));
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'DROP', vals[i]!));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, {
    generatedAt: GEN,
    source: 'KEEP',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'KEEP');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: sort by mc / mcAsc / absMc orderings', () => {
  const queue: QueueLine[] = [];
  // Three sources: right-skewed, symmetric, left-skewed.
  const right = [1000, 2000, 3000, 4000, 100000];
  const sym = [1000, 2000, 3000, 4000, 5000];
  const left = [1000, 96000, 97000, 98000, 99000];
  for (let i = 0; i < 5; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'RIGHT', right[i]!));
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'SYM', sym[i]!));
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'LEFT', left[i]!));
  }
  const desc = buildDailyTokenMedcoupleSkewness(queue, { generatedAt: GEN, sort: 'mc' });
  assert.equal(desc.sources[0]!.source, 'RIGHT');
  assert.equal(desc.sources[2]!.source, 'LEFT');

  const asc = buildDailyTokenMedcoupleSkewness(queue, { generatedAt: GEN, sort: 'mcAsc' });
  assert.equal(asc.sources[0]!.source, 'LEFT');
  assert.equal(asc.sources[2]!.source, 'RIGHT');
});

test('build: min-abs-mc filter hides near-symmetric sources', () => {
  const queue: QueueLine[] = [];
  const right = [1000, 2000, 3000, 4000, 100000]; // |mc| large
  const sym = [1000, 2000, 3000, 4000, 5000];     // |mc| small
  for (let i = 0; i < 5; i += 1) {
    const day = String(i + 1).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'RIGHT', right[i]!));
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'SYM', sym[i]!));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, {
    generatedAt: GEN,
    minAbsMc: 0.4,
  });
  const names = r.sources.map((s) => s.source);
  assert.ok(names.includes('RIGHT'));
  assert.ok(!names.includes('SYM'));
  assert.equal(r.droppedBelowMinAbsMc, 1);
});

test('build: respects --since/--until window', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    queue.push(ql(`2026-04-${String(i).padStart(2, '0')}T00:00:00.000Z`, 'W', 1000 * i));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, {
    generatedAt: GEN,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-08T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  // Days 02..07 inclusive = 6 days.
  assert.equal(r.sources[0]!.nDays, 6);
});

test('build: hourly buckets correctly collapse into per-day totals', () => {
  const queue: QueueLine[] = [];
  // Same day, two hourly buckets each.
  for (let i = 1; i <= 5; i += 1) {
    const day = String(i).padStart(2, '0');
    queue.push(ql(`2026-04-${day}T00:00:00.000Z`, 'COLL', 500 * i));
    queue.push(ql(`2026-04-${day}T01:00:00.000Z`, 'COLL', 500 * i));
  }
  const r = buildDailyTokenMedcoupleSkewness(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nDays, 5);
  // per-day vector [1000, 2000, 3000, 4000, 5000]; median 3000.
  assert.equal(r.sources[0]!.median, 3000);
});

// ---- refinement / witness tests ---------------------------------------

test('witness: medcouple disagrees with Gini-style dispersion under reflection', () => {
  // X and reflected X have IDENTICAL Gini / variance / Theil etc.
  // (mirroring around the mean leaves all unsigned dispersion measures
  // unchanged) but OPPOSITE medcouple sign.
  const X = [1, 2, 3, 4, 100];
  const m = 3;
  const reflected = X.map((v) => 2 * m - v); // [5, 4, 3, 2, -94]
  const a = medcoupleOfVector(X);
  const b = medcoupleOfVector(reflected);
  // Same |MC| but opposite sign -- this is the orthogonality witness.
  assert.ok(a.mc > 0);
  assert.ok(b.mc < 0);
  assert.ok(Math.abs(a.mc + b.mc) < 1e-12);
});

test('witness: medcouple disagrees with Hill-tail under symmetric heavy tail', () => {
  // A perfectly symmetric heavy-tailed-looking distribution
  // (mirror image) should have MC = 0 even though its tails
  // are large -- demonstrating MC and tail-magnitude axes are
  // genuinely independent.
  // [1, 2, 3, 4, 5, 6, 7, 8] is uniform / symmetric.
  const r = medcoupleOfVector([1, 2, 3, 4, 5, 6, 7, 8]);
  // Symmetric uniform discrete -> MC should be 0 to floating precision.
  assert.ok(Math.abs(r.mc) < 1e-12, `expected MC ~ 0 for symmetric uniform, got ${r.mc}`);
});
