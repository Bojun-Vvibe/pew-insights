import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenPcaProjectionDistanceHalves,
  buildDailyTokenPcaProjectionDistanceHalves,
  PC_EMBEDDING_DIM,
  PC_EMBEDDING_LAG,
} from '../src/dailytokenpcaprojectiondistancehalves.js';
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

// ---------- primitive: input validation ----------

test('dailyTokenPcaProjectionDistanceHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenPcaProjectionDistanceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenPcaProjectionDistanceHalves: rejects non-finite values', () => {
  assert.throws(
    () =>
      dailyTokenPcaProjectionDistanceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenPcaProjectionDistanceHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenPcaProjectionDistanceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('dailyTokenPcaProjectionDistanceHalves: M = n - 2, m1 = floor(M/2)', () => {
  const r = dailyTokenPcaProjectionDistanceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.pcM, 8);
  assert.equal(r.pcM1, 4);
  assert.equal(r.pcM2, 4);
});

test('dailyTokenPcaProjectionDistanceHalves: pcU1 is unit-norm', () => {
  const r = dailyTokenPcaProjectionDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  const u = r.pcU1;
  const n = Math.sqrt(u[0]! * u[0]! + u[1]! * u[1]! + u[2]! * u[2]!);
  assert.ok(Math.abs(n - 1) < 1e-10, `||u_1|| = ${n}`);
});

test('dailyTokenPcaProjectionDistanceHalves: eigenvalues are non-negative and descending', () => {
  const r = dailyTokenPcaProjectionDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.pcEigenvalues[0]! >= r.pcEigenvalues[1]!);
  assert.ok(r.pcEigenvalues[1]! >= r.pcEigenvalues[2]!);
  for (const lam of r.pcEigenvalues) assert.ok(lam >= 0);
});

test('dailyTokenPcaProjectionDistanceHalves: variance explained ratios in [0,1] and ordered', () => {
  const r = dailyTokenPcaProjectionDistanceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.pcVarExplained1 >= 0 && r.pcVarExplained1 <= 1 + 1e-12);
  assert.ok(r.pcVarExplained2 >= r.pcVarExplained1 - 1e-12);
  assert.ok(r.pcVarExplained2 <= 1 + 1e-12);
});

// ---------- primitive: identities ----------

test('dailyTokenPcaProjectionDistanceHalves: translation-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenPcaProjectionDistanceHalves(x);
  const r2 = dailyTokenPcaProjectionDistanceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.pcZ - r2.pcZ) < 1e-8, `pcZ ${r1.pcZ} vs ${r2.pcZ}`);
  assert.ok(Math.abs(r1.pcT - r2.pcT) < 1e-8);
  for (let i = 0; i < 3; i += 1) {
    assert.ok(Math.abs(r1.pcEigenvalues[i]! - r2.pcEigenvalues[i]!) < 1e-6);
  }
});

test('dailyTokenPcaProjectionDistanceHalves: positive-scale-invariant', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenPcaProjectionDistanceHalves(x);
  const r2 = dailyTokenPcaProjectionDistanceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.pcZ - r2.pcZ) < 1e-8, `pcZ ${r1.pcZ} vs ${r2.pcZ}`);
  assert.ok(Math.abs(r1.pcT - r2.pcT) < 1e-8);
});

test('dailyTokenPcaProjectionDistanceHalves: pcT === m1*m2/(m1+m2) * pcZ^2', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12, 14, 13];
  const r = dailyTokenPcaProjectionDistanceHalves(x);
  const expected = ((r.pcM1 * r.pcM2) / (r.pcM1 + r.pcM2)) * r.pcZ * r.pcZ;
  assert.ok(Math.abs(r.pcT - expected) < 1e-12);
});

test('dailyTokenPcaProjectionDistanceHalves: shifted halves produce non-zero pcZ', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenPcaProjectionDistanceHalves(x);
  assert.ok(Math.abs(r.pcZ) > 0.5, `expected sizeable shift, got pcZ=${r.pcZ}`);
});

test('dailyTokenPcaProjectionDistanceHalves: sum(eigenvalues) === trace(C) for a known input', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r = dailyTokenPcaProjectionDistanceHalves(x);
  // Reconstruct trace(C) from definition.
  const M = r.pcM;
  const V: number[][] = [];
  for (let t = 0; t < M; t += 1) V.push([x[t]!, x[t + 1]!, x[t + 2]!]);
  let m0 = 0;
  let m1 = 0;
  let m2 = 0;
  for (const v of V) {
    m0 += v[0]!;
    m1 += v[1]!;
    m2 += v[2]!;
  }
  m0 /= M;
  m1 /= M;
  m2 /= M;
  let tr = 0;
  for (const v of V) {
    const a0 = v[0]! - m0;
    const a1 = v[1]! - m1;
    const a2 = v[2]! - m2;
    tr += a0 * a0 + a1 * a1 + a2 * a2;
  }
  tr /= M;
  const sumLam = r.pcEigenvalues[0]! + r.pcEigenvalues[1]! + r.pcEigenvalues[2]!;
  assert.ok(Math.abs(tr - sumLam) < 1e-8, `trace ${tr} vs sumLam ${sumLam}`);
});

test('dailyTokenPcaProjectionDistanceHalves: pcStdGapByAxis length 3 and finite', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12, 14, 13];
  const r = dailyTokenPcaProjectionDistanceHalves(x);
  assert.equal(r.pcGapByAxis.length, 3);
  assert.equal(r.pcStdGapByAxis.length, 3);
  for (const g of r.pcStdGapByAxis) assert.ok(Number.isFinite(g));
});

test('dailyTokenPcaProjectionDistanceHalves: pcStdGapByAxis[0] equals pcZ', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12, 14, 13];
  const r = dailyTokenPcaProjectionDistanceHalves(x);
  assert.ok(Math.abs(r.pcStdGapByAxis[0]! - r.pcZ) < 1e-10);
});

test('PC_EMBEDDING_DIM === 3 and PC_EMBEDDING_LAG === 1', () => {
  assert.equal(PC_EMBEDDING_DIM, 3);
  assert.equal(PC_EMBEDDING_LAG, 1);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenPcaProjectionDistanceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenPcaProjectionDistanceHalves([], { minTenureDays: 7.5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenPcaProjectionDistanceHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenPcaProjectionDistanceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenPcaProjectionDistanceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since/until', () => {
  assert.throws(
    () =>
      buildDailyTokenPcaProjectionDistanceHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
  assert.throws(
    () =>
      buildDailyTokenPcaProjectionDistanceHalves([], { until: 'not-a-date' }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end & sorting ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const q: QueueLine[] = [];
  // src-a: clear half-shift
  for (let i = 0; i < 20; i += 1) {
    const v = i < 10 ? 100 + (i % 3) * 10 : 1000 + (i % 3) * 10;
    q.push(ql(dayIso(i), 'src-a', v));
  }
  // src-b: stable
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'src-b', 500 + ((i * 7) % 11)));
  }
  return q;
}

test('build: returns rows for two-source fixture', () => {
  const r = buildDailyTokenPcaProjectionDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.embeddingDim, 3);
  assert.equal(r.embeddingLag, 1);
});

test('build: sort pcTDesc puts biggest pcT first', () => {
  const r = buildDailyTokenPcaProjectionDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'pcTDesc',
  });
  assert.ok(r.sources[0]!.pcT >= r.sources[1]!.pcT);
});

test('build: sort source asc orders alphabetically', () => {
  const r = buildDailyTokenPcaProjectionDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[1]!.source, 'src-b');
});

test('build: drops sparse sources below minTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenPcaProjectionDistanceHalves(q, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('build: drops below-min-tenure sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 6; i += 1) q.push(ql(dayIso(i), 'short', 5000));
  const r = buildDailyTokenPcaProjectionDistanceHalves(q, {
    minTokens: 0,
    minTenureDays: 14,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('build: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'flat', 100));
  const r = buildDailyTokenPcaProjectionDistanceHalves(q, { minTokens: 0 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: counts droppedNonPositiveTokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) q.push(ql(dayIso(i), 'mixed', 100));
  q.push(ql(dayIso(20), 'mixed', 0));
  q.push(ql(dayIso(21), 'mixed', -5));
  const r = buildDailyTokenPcaProjectionDistanceHalves(q, { minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter restricts and counts droppedSourceFilter', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    q.push(ql(dayIso(i), 'keep', 100 + i));
    q.push(ql(dayIso(i), 'drop', 100 + i));
  }
  const r = buildDailyTokenPcaProjectionDistanceHalves(q, {
    minTokens: 0,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 20);
});

test('build: top truncates and counts droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 4; s += 1) {
    for (let i = 0; i < 20; i += 1) {
      q.push(ql(dayIso(i), `src-${s}`, 100 + s * 10 + i));
    }
  }
  const r = buildDailyTokenPcaProjectionDistanceHalves(q, {
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: empty queue returns empty sources', () => {
  const r = buildDailyTokenPcaProjectionDistanceHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: generatedAt override is honoured', () => {
  const r = buildDailyTokenPcaProjectionDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
    generatedAt: '2030-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '2030-01-01T00:00:00.000Z');
});

test('build: rows expose pcU1 length 3 and unit-norm', () => {
  const r = buildDailyTokenPcaProjectionDistanceHalves(makeQueueWithTwoSources(), {
    minTokens: 0,
  });
  for (const s of r.sources) {
    assert.equal(s.pcU1.length, 3);
    const n = Math.sqrt(s.pcU1[0]! ** 2 + s.pcU1[1]! ** 2 + s.pcU1[2]! ** 2);
    assert.ok(Math.abs(n - 1) < 1e-8);
  }
});

test('build: respects all valid sort keys without throwing', () => {
  const q = makeQueueWithTwoSources();
  const sorts = [
    'pcT',
    'pcTDesc',
    'pcZ',
    'pcZDesc',
    'pcZAbs',
    'pcZAbsDesc',
    'pcVarExplained1',
    'pcVarExplained1Desc',
    'tokens',
    'tenure',
    'source',
  ] as const;
  for (const s of sorts) {
    const r = buildDailyTokenPcaProjectionDistanceHalves(q, {
      minTokens: 0,
      sort: s,
    });
    assert.equal(r.sort, s);
    assert.equal(r.sources.length, 2);
  }
});
