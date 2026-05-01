import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenRunsTestZ,
  runsTestZOfVector,
} from '../src/dailytokenrunstestz.js';
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

// ---- runsTestZOfVector primitive ---------------------------------------

test('runsTestZOfVector: empty -> degenerate, z=0', () => {
  const r = runsTestZOfVector([]);
  assert.equal(r.z, 0);
  assert.equal(r.degenerate, true);
});

test('runsTestZOfVector: singleton -> degenerate', () => {
  const r = runsTestZOfVector([42]);
  assert.equal(r.z, 0);
  assert.equal(r.degenerate, true);
});

test('runsTestZOfVector: all-equal -> all tied -> degenerate', () => {
  const r = runsTestZOfVector([7, 7, 7, 7, 7, 7]);
  // median = 7; every value drops; n+ = n- = 0
  assert.equal(r.degenerate, true);
  assert.equal(r.z, 0);
  assert.equal(r.nPlus, 0);
  assert.equal(r.nMinus, 0);
});

test('runsTestZOfVector: extreme clustering -- all - then all + (n+=n-=4)', () => {
  // sorted = [1,2,3,4,5,6,7,8]; median = 4.5
  // sequence in calendar order: [1,2,3,4,5,6,7,8]
  // signs: [-,-,-,-,+,+,+,+]; runs = 2; n+=4, n-=4, n=8
  // mu = 2*4*4/8 + 1 = 5; var = 2*4*4*(2*4*4-8)/(64*7) = 32*24/448 = 768/448 = 12/7
  // z = (2 - 5)/sqrt(12/7) = -3 / 1.30931 = -2.29129...
  const r = runsTestZOfVector([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.median, 4.5);
  assert.equal(r.nPlus, 4);
  assert.equal(r.nMinus, 4);
  assert.equal(r.runs, 2);
  assert.ok(Math.abs(r.meanRuns - 5) < 1e-12);
  assert.ok(Math.abs(r.varRuns - 12 / 7) < 1e-12);
  assert.ok(r.z < -2.29 && r.z > -2.30);
});

test('runsTestZOfVector: extreme anti-clustering -- alternating signs', () => {
  // sequence [1,8,2,7,3,6,4,5]; sorted=[1..8] median 4.5
  // signs in order: -,+,-,+,-,+,-,+; runs = 8
  // mu = 5; var = 12/7; z = (8 - 5)/sqrt(12/7) = +2.29129
  const r = runsTestZOfVector([1, 8, 2, 7, 3, 6, 4, 5]);
  assert.equal(r.runs, 8);
  assert.ok(r.z > 2.29 && r.z < 2.30);
});

test('runsTestZOfVector: i.i.d.-like trace yields |z| < ~1', () => {
  // hand-arranged 8-vector with runs=5 (mid range).
  // sequence [1, 8, 2, 3, 7, 4, 6, 5]; median=4.5; signs: -,+,-,-,+,-,+,+
  // runs: -,+,--,+,-,++  -> 1(-),2(+),3(--),4(+),5(-),6(++) = 6 runs
  // mu=5, var=12/7; z=(6-5)/sqrt(12/7) ~ 0.7638
  const r = runsTestZOfVector([1, 8, 2, 3, 7, 4, 6, 5]);
  assert.equal(r.runs, 6);
  assert.ok(Math.abs(r.z - 1 / Math.sqrt(12 / 7)) < 1e-12);
});

test('runsTestZOfVector: BREAKDOWN POINT 0.5 -- replacing one day with 1e9 changes |z| by O(1)', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  const perturbed = [1, 2, 3, 4, 5, 6, 7, 1e9];
  const rb = runsTestZOfVector(base);
  const rp = runsTestZOfVector(perturbed);
  // Replacing the largest with 1e9 leaves the SIGN at index 7 still +,
  // so the trace and runs and z are IDENTICAL. The magnitude shock
  // is invisible to RTZ.
  assert.equal(rb.runs, rp.runs);
  assert.equal(rb.z, rp.z);
});

test('runsTestZOfVector: rejects negative or non-finite', () => {
  assert.throws(() => runsTestZOfVector([1, -1, 2]));
  assert.throws(() => runsTestZOfVector([1, NaN, 2]));
  assert.throws(() => runsTestZOfVector([1, Infinity, 2]));
});

test('runsTestZOfVector: tied days drop from trace; n+=n-=3, runs=2', () => {
  // Vector [1,2,3,5,5,5,7,8,9]; median=5; ties=3; signs: -,-,-,+,+,+
  // runs=2, n+=3, n-=3, n=6; mu = 2*3*3/6+1 = 4; var = 2*3*3*(18-6)/(36*5) = 216/180 = 1.2
  // z=(2-4)/sqrt(1.2) = -1.8257...
  const r = runsTestZOfVector([1, 2, 3, 5, 5, 5, 7, 8, 9]);
  assert.equal(r.median, 5);
  assert.equal(r.nPlus, 3);
  assert.equal(r.nMinus, 3);
  assert.equal(r.runs, 2);
  assert.ok(Math.abs(r.meanRuns - 4) < 1e-12);
  assert.ok(Math.abs(r.varRuns - 1.2) < 1e-12);
  assert.ok(Math.abs(r.z + 2 / Math.sqrt(1.2)) < 1e-12);
});

test('runsTestZOfVector: degenerate when all on one side of median (constant)', () => {
  // n=4, all equal: median=v, all tied; nPlus=nMinus=0 -> degenerate
  const r = runsTestZOfVector([5, 5, 5, 5]);
  assert.equal(r.degenerate, true);
});

// ---- buildDailyTokenRunsTestZ ------------------------------------------

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenRunsTestZ([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 8);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.sort, 'absZ');
  assert.equal(r.minAbsZ, null);
  assert.equal(r.includeAcf1, false);
});

test('build: ramp 1..8 hits closed-form clustering z (-2.29)', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.runs, 2);
  assert.ok(s.z < -2.29 && s.z > -2.30);
});

test('build: collapses multi-hour rows on same day (calendar order preserved)', () => {
  const queue: QueueLine[] = [];
  // 8 days, each with two hourly rows summing to a clean ramp.
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T01:00:00.000Z`, 'a', i * 500));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 500));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  const s = r.sources[0]!;
  assert.equal(s.nDaysObserved, 8);
  assert.equal(s.nDays, 8);
  assert.equal(s.runs, 2);
});

test('build: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'big', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'tiny', 1));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minDays: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: minDays filter drops short-history sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 6; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'short', 1000));
  }
  for (let i = 1; i <= 10; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'long', 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 8,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 100));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'b', 200));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
});

test('build: time window filter trims rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 12; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 1000 + i));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    since: '2026-04-13T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.sources[0]!.nDaysObserved, 8);
});

test('build: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-11T05:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens counted', () => {
  const queue: QueueLine[] = [
    ql('2026-04-11T05:00:00.000Z', 'a', 0),
    ql('2026-04-11T06:00:00.000Z', 'a', -10),
  ];
  for (let i = 1; i <= 8; i += 1) {
    const day = (10 + i).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 100));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: sort=absZ DESC default places extreme |z| first', () => {
  const queue: QueueLine[] = [];
  // src-cluster: ramp 1..8 -> z ~ -2.29
  // src-noisy: arrangement giving |z| ~ 0.76
  const noisy = [1, 8, 2, 3, 7, 4, 6, 5];
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-cluster', i * 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-noisy', noisy[i - 1]! * 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  assert.equal(r.sources[0]!.source, 'src-cluster');
  assert.equal(r.sources[1]!.source, 'src-noisy');
});

test('build: sort=z / tokens / days / source / runs', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'b', 5000));
  }
  for (const s of ['z', 'tokens', 'days', 'source', 'runs'] as const) {
    const r = buildDailyTokenRunsTestZ(queue, {
      generatedAt: GEN,
      minTokens: 0,
      minDays: 4,
      sort: s,
    });
    assert.ok(r.sources.length >= 1);
    assert.equal(r.sort, s);
  }
});

test('build: top cap drops tail and counts droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'b', 2000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'c', 3000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    top: 2,
    sort: 'source',
  });
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 2);
});

test('build: minAbsZ filter retains degenerate rows', () => {
  const queue: QueueLine[] = [];
  // src-flat: all 1000 -> all tied -> degenerate
  // src-ramp: 1..8 -> z ~ -2.29, |z|>1
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-flat', 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-ramp', i * 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    minAbsZ: 1.0,
  });
  // src-flat is degenerate (all tied), should be retained.
  // src-ramp |z|>1, retained.
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowMinAbsZ, 0);
});

test('build: minAbsZ drops non-degenerate rows below threshold', () => {
  const queue: QueueLine[] = [];
  // src-mid: arrangement giving |z| ~ 0.76 (below 1.5)
  // src-cluster: ramp -> |z| ~ 2.29
  const mid = [1, 8, 2, 3, 7, 4, 6, 5];
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-mid', mid[i - 1]! * 1000));
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'src-cluster', i * 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    minAbsZ: 1.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-cluster');
  assert.equal(r.droppedBelowMinAbsZ, 1);
});

test('build: rejects bad knobs', () => {
  assert.throws(() => buildDailyTokenRunsTestZ([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenRunsTestZ([], { minDays: 3 }));
  assert.throws(() => buildDailyTokenRunsTestZ([], { minDays: 4.5 }));
  assert.throws(() => buildDailyTokenRunsTestZ([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenRunsTestZ([], {
      sort: 'nope' as 'absZ',
    }),
  );
  assert.throws(() => buildDailyTokenRunsTestZ([], { since: 'not-a-date' }));
  assert.throws(() => buildDailyTokenRunsTestZ([], { until: 'not-a-date' }));
  assert.throws(() => buildDailyTokenRunsTestZ([], { minAbsZ: -0.1 }));
});

// ---- includeAcf1 refinement --------------------------------------------

test('build: includeAcf1 off by default omits acf1 fields', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  const row = r.sources[0]!;
  assert.equal(r.includeAcf1, false);
  assert.equal(row.acf1, undefined);
  assert.equal(row.signCoherence, undefined);
});

test('build: includeAcf1 surfaces acf1 and signCoherence; ramp -> persistence agreement', () => {
  const queue: QueueLine[] = [];
  // monotone ramp: z << 0 (clustering), acf1 > 0 (persistent magnitude)
  // signCoherence = -z * acf1 > 0
  for (let i = 1; i <= 8; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', i * 1000));
  }
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    includeAcf1: true,
  });
  const row = r.sources[0]!;
  assert.equal(r.includeAcf1, true);
  assert.notEqual(row.acf1, undefined);
  assert.notEqual(row.signCoherence, undefined);
  // ramp has positive lag-1 autocorrelation around the median
  assert.ok((row.acf1 as number) > 0);
  // z < 0, acf1 > 0 -> -z*acf1 > 0 (agreement)
  assert.ok((row.signCoherence as number) > 0);
});

// ---- orthogonality witness vs ACF1 (the closest cousin) ----------------

test('orthogonality witness: heavy-tail spike at one side flips ACF1 but leaves RTZ unchanged', () => {
  // Arrangement A: small symmetric oscillation [1,3,1,3,1,3,1,3]
  //   median = 2; signs: -,+,-,+,-,+,-,+; runs=8; z>>0 (anti-cluster)
  //   acf1 around median (centred values [-1,+1,-1,+1,...]) -> -1 (strong negative)
  // Arrangement B: same trace but with a 1e6 spike replacing the last +.
  //   signs unchanged (sign at last day is still +); RTZ unchanged.
  //   But ACF1 (mean/median-centred Pearson) is now dominated by the
  //   1e6 outlier and shifts substantially.
  const A = [1, 3, 1, 3, 1, 3, 1, 3];
  const B = [1, 3, 1, 3, 1, 3, 1, 1_000_000];
  const ra = runsTestZOfVector(A);
  const rb = runsTestZOfVector(B);
  // RTZ identical (sign trace identical)
  assert.equal(ra.runs, rb.runs);
  assert.equal(ra.z, rb.z);
  // (Magnitude-based ACF1 would diverge -- not asserted here because
  // the primitive is internal to build, but the property follows from
  // the Pearson formula being O(outlier^2) in the numerator.)
});

test('orthogonality witness: long monotone ramp has low monotone-run-count BUT extreme RTZ clustering', () => {
  // Long ramp [1..16]: monotone-run-length axis sees this as a single
  // run of length 16 (low count of distinct monotone runs). RTZ sees
  // it as runs=2 (one '-' regime, one '+' regime), z << 0.
  const v: number[] = [];
  for (let i = 1; i <= 16; i += 1) v.push(i);
  const r = runsTestZOfVector(v);
  assert.equal(r.runs, 2);
  assert.equal(r.nPlus, 8);
  assert.equal(r.nMinus, 8);
  // mu_R = 2*8*8/16 + 1 = 9; var = 2*8*8*(128-16)/(256*15) = 14336/3840 ~ 3.733
  // z = (2 - 9)/sqrt(3.733) = -7/1.9322 = -3.6228
  assert.ok(r.z < -3.6 && r.z > -3.7);
});

// ---- Refinement (v0.6.308): tightened boundary and degeneracy edge cases

test('refinement: minimum non-degenerate boundary n+=1, n-=7 closed-form anchor', () => {
  // sequence [1, 5, 5, 5, 5, 5, 5, 5, 100] -- 7 below median (=5,
  // dropped via tie? no -- 5 IS the median so all the 5s drop).
  // Take instead [1, 2, 3, 4, 6, 7, 8, 9, 100]:
  //   sorted=[1,2,3,4,6,7,8,9,100]; median=6 (5th of 9). |D|=9 distinct.
  //   In sorted vector [1,2,3,4,6,7,8,9,100] median is sorted[4]=6.
  //   sequence in calendar order = same ascending list.
  //   signs: -,-,-,-,(tied at 6 dropped),+,+,+,+ -> n-=4, n+=4, n=8, runs=2
  // Pick instead [100, 2, 3, 4, 5, 6, 7, 8, 9]:
  //   sorted=[2,3,4,5,6,7,8,9,100]; median=6.
  //   calendar signs: +,-,-,-,-,(6 dropped),+,+,+ -> +,-,-,-,-,+,+,+
  //   n+=4, n-=4, n=8; runs: +(1), ----(2), +++(3) = 3
  //   mu = 2*4*4/8 + 1 = 5; var = 2*4*4*(32-8)/(64*7) = 768/448 = 12/7
  //   z = (3-5)/sqrt(12/7) = -2/1.30931 = -1.5275
  const v = [100, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = runsTestZOfVector(v);
  assert.equal(r.median, 6);
  assert.equal(r.nPlus, 4);
  assert.equal(r.nMinus, 4);
  assert.equal(r.runs, 3);
  assert.ok(Math.abs(r.z + 2 / Math.sqrt(12 / 7)) < 1e-12);
});

test('refinement: tightened edge case -- n+=1 sentinel preserves degenerate-guard rather than dividing by zero', () => {
  // Build a vector where only ONE day strays above the median.
  // [1, 2, 3, 4, 5, 5, 5, 5, 5, 100]: sorted=[1,2,3,4,5,5,5,5,5,100]
  //   median = (5+5)/2 = 5 (linear-interp index (10-1)*0.5 = 4.5 -> avg sorted[4]=5, sorted[5]=5)
  //   signs: -,-,-,-,(5 dropped x5),+ -> n-=4, n+=1, n=5
  //   runs: ----,+ = 2
  //   mu = 2*1*4/5 + 1 = 1.6 + 1 = 2.6; var = 2*1*4*(8-5)/(25*4) = 24/100 = 0.24
  //   z = (2 - 2.6)/sqrt(0.24) = -0.6/0.4899 = -1.22474...
  const v = [1, 2, 3, 4, 5, 5, 5, 5, 5, 100];
  const r = runsTestZOfVector(v);
  assert.equal(r.median, 5);
  assert.equal(r.nPlus, 1);
  assert.equal(r.nMinus, 4);
  assert.equal(r.runs, 2);
  assert.equal(r.degenerate, false);
  assert.ok(Math.abs(r.meanRuns - 2.6) < 1e-12);
  assert.ok(Math.abs(r.varRuns - 0.24) < 1e-12);
  assert.ok(Math.abs(r.z + 0.6 / Math.sqrt(0.24)) < 1e-12);
});

test('refinement: degenerate guard -- n+ = 0 (everything below or tied with median) returns z=0 not NaN', () => {
  // [3, 3, 3, 3, 3, 3, 3, 7]: sorted=[3,3,3,3,3,3,3,7]; n=8.
  // median = (sorted[3] + sorted[4])/2 = 3. signs: tied x7, +x1
  // -> nKept=1, nPlus=1, nMinus=0 -- degenerate, z must be 0 not NaN.
  const v = [3, 3, 3, 3, 3, 3, 3, 7];
  const r = runsTestZOfVector(v);
  assert.equal(r.median, 3);
  assert.equal(r.nPlus, 1);
  assert.equal(r.nMinus, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.z, 0);
  assert.ok(Number.isFinite(r.z));
});

test('refinement: square-wave witness -- z is positive (anti-clustering) for [low,high,low,high,...]', () => {
  // 12-point square wave: [10,90,10,90,10,90,10,90,10,90,10,90]
  // median = 50 (linear-interp on sorted [10,10,10,10,10,10,90,90,90,90,90,90])
  // = (sorted[5]+sorted[6])/2 = (10+90)/2 = 50
  // Signs: -,+,-,+,-,+,-,+,-,+,-,+ ; runs=12; n+=6, n-=6, n=12
  // mu = 2*6*6/12 + 1 = 6 + 1 = 7; var = 2*6*6*(72-12)/(144*11) = 4320/1584 = 30/11
  // z = (12 - 7)/sqrt(30/11) = 5/1.6514... = +3.0277...
  const v = [10, 90, 10, 90, 10, 90, 10, 90, 10, 90, 10, 90];
  const r = runsTestZOfVector(v);
  assert.equal(r.median, 50);
  assert.equal(r.nPlus, 6);
  assert.equal(r.nMinus, 6);
  assert.equal(r.runs, 12);
  assert.ok(Math.abs(r.z - 5 / Math.sqrt(30 / 11)) < 1e-12);
  // Strictly positive -- the SIGN convention for hyper-alternation
  // is consistent with the documented contract.
  assert.ok(r.z > 3.02 && r.z < 3.03);
});

test('refinement: build pipeline preserves degenerate-guard for n+ = 0 vector (no NaN leaks to JSON)', () => {
  // 8 days: 7 days at 1000 tokens, 1 day at 5000. median=1000;
  // tied x7, +x1; degenerate=true; z must serialise as 0.
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 7; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${day}T05:00:00.000Z`, 'a', 1000));
  }
  queue.push(ql('2026-04-08T05:00:00.000Z', 'a', 5000));
  const r = buildDailyTokenRunsTestZ(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  const row = r.sources[0]!;
  assert.equal(row.degenerate, true);
  assert.equal(row.z, 0);
  assert.equal(row.nPlus, 1);
  assert.equal(row.nMinus, 0);
  assert.equal(row.nDaysTied, 7);
  // JSON round-trip must not produce NaN.
  const j = JSON.parse(JSON.stringify(r));
  assert.equal(j.sources[0].z, 0);
});
