import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenFlignerPolicelloHalves,
  buildDailyTokenFlignerPolicelloHalves,
  flignerPolicelloPlacements,
  standardNormalUpperTailFp,
} from '../src/dailytokenflignerpolicellohalves.js';
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

// ---------- primitive: standardNormalUpperTailFp ----------

test('fp: standardNormalUpperTailFp(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailFp(0) - 0.5) < 1e-6);
});

test('fp: standardNormalUpperTailFp(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailFp(1.96) - 0.025) < 1e-3);
});

test('fp: standardNormalUpperTailFp symmetry', () => {
  for (const z of [0.5, 1, 2, 3]) {
    const a = standardNormalUpperTailFp(z);
    const b = standardNormalUpperTailFp(-z);
    assert.ok(Math.abs(a + b - 1) < 1e-6);
  }
});

test('fp: standardNormalUpperTailFp throws on NaN', () => {
  assert.throws(() => standardNormalUpperTailFp(Number.NaN));
});

// ---------- primitive: flignerPolicelloPlacements ----------

test('fp: placements for [1,2] vs [3,4] all P=0, all Q=2', () => {
  const { P, Q } = flignerPolicelloPlacements([1, 2], [3, 4]);
  assert.deepEqual(P, [0, 0]);
  assert.deepEqual(Q, [2, 2]);
});

test('fp: placements for [3,4] vs [1,2] all P=2, all Q=0', () => {
  const { P, Q } = flignerPolicelloPlacements([3, 4], [1, 2]);
  assert.deepEqual(P, [2, 2]);
  assert.deepEqual(Q, [0, 0]);
});

test('fp: placements with ties get mid-tie correction', () => {
  // A=[2], B=[1,2,3] -> P_1: B<2 = 1 (just 1), B=2 = 1 -> P=1+0.5=1.5
  const { P } = flignerPolicelloPlacements([2], [1, 2, 3]);
  assert.deepEqual(P, [1.5]);
});

test('fp: placements sum identity n1*Pbar = n2*Qbar = U (no ties)', () => {
  const a = [1, 5, 9];
  const b = [2, 4, 6, 8];
  const { P, Q } = flignerPolicelloPlacements(a, b);
  const sumP = P.reduce((s, v) => s + v, 0);
  const sumQ = Q.reduce((s, v) => s + v, 0);
  // total comparisons = n1 * n2
  assert.equal(sumP + sumQ, a.length * b.length);
});

test('fp: placements throw on empty samples', () => {
  assert.throws(() => flignerPolicelloPlacements([], [1, 2]));
  assert.throws(() => flignerPolicelloPlacements([1, 2], []));
});

test('fp: placements throw on non-finite', () => {
  assert.throws(() => flignerPolicelloPlacements([1, Number.NaN], [2, 3]));
  assert.throws(() => flignerPolicelloPlacements([1, 2], [Number.NaN]));
});

// ---------- core: dailyTokenFlignerPolicelloHalves ----------

test('fp: needs at least 16 samples', () => {
  assert.throws(() => dailyTokenFlignerPolicelloHalves([1, 2, 3, 4, 5]));
});

test('fp: throws on non-finite values', () => {
  const arr = new Array<number>(16).fill(1);
  arr[3] = Number.NaN;
  assert.throws(() => dailyTokenFlignerPolicelloHalves(arr));
});

test('fp: throws on zero-variance input', () => {
  const arr = new Array<number>(20).fill(7);
  assert.throws(() => dailyTokenFlignerPolicelloHalves(arr));
});

test('fp: split sizes correct', () => {
  const arr: number[] = [];
  for (let i = 0; i < 21; i += 1) arr.push(i + 1);
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.equal(r.fpN1, 10);
  assert.equal(r.fpN2, 11);
  assert.equal(r.nSamples, 21);
});

test('fp: monotone increasing series -> strongly positive fpZ', () => {
  const arr: number[] = [];
  for (let i = 0; i < 30; i += 1) arr.push(i + 1);
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.ok(r.fpZ > 3, `expected fpZ > 3 for monotone increasing, got ${r.fpZ}`);
  assert.ok(r.fpPValue < 0.01);
  // sumQ should be max possible (n1 * n2), sumP = 0
  assert.equal(r.fpSumP, 0);
});

test('fp: monotone decreasing series -> strongly negative fpZ', () => {
  const arr: number[] = [];
  for (let i = 0; i < 30; i += 1) arr.push(30 - i);
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.ok(r.fpZ < -3, `expected fpZ < -3 for monotone decreasing, got ${r.fpZ}`);
  assert.ok(r.fpPValue < 0.01);
  assert.equal(r.fpSumQ, 0);
});

test('fp: shift invariance fpZ(x + c) === fpZ(x)', () => {
  const base: number[] = [];
  for (let i = 0; i < 20; i += 1) base.push(Math.sin(i) * 5 + 10);
  const shifted = base.map((v) => v + 1000);
  const r1 = dailyTokenFlignerPolicelloHalves(base);
  const r2 = dailyTokenFlignerPolicelloHalves(shifted);
  assert.ok(Math.abs(r1.fpZ - r2.fpZ) < 1e-12);
});

test('fp: scale invariance (positive) fpZ(a*x) === fpZ(x)', () => {
  const base: number[] = [];
  for (let i = 0; i < 24; i += 1) base.push(i % 5 + 1);
  const scaled = base.map((v) => v * 17);
  const r1 = dailyTokenFlignerPolicelloHalves(base);
  const r2 = dailyTokenFlignerPolicelloHalves(scaled);
  assert.ok(Math.abs(r1.fpZ - r2.fpZ) < 1e-12);
});

test('fp: reversal antisymmetry fpZ(reverse(x)) === -fpZ(x) for n1=n2', () => {
  const base: number[] = [];
  for (let i = 0; i < 20; i += 1) base.push(Math.cos(i * 0.7) + i * 0.1);
  const rev = [...base].reverse();
  const r1 = dailyTokenFlignerPolicelloHalves(base);
  const r2 = dailyTokenFlignerPolicelloHalves(rev);
  assert.ok(
    Math.abs(r1.fpZ + r2.fpZ) < 1e-9,
    `expected anti-symmetry, got ${r1.fpZ} vs ${r2.fpZ}`,
  );
});

test('fp: random-noise series gives |fpZ| < 3 most of the time', () => {
  // Pseudo-random fixed seed via simple LCG
  let s = 42;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const arr: number[] = [];
  for (let i = 0; i < 60; i += 1) arr.push(rng());
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.ok(Math.abs(r.fpZ) < 3, `expected small |fpZ| for noise, got ${r.fpZ}`);
});

test('fp: pValue is two-sided in [0, 1]', () => {
  const arr: number[] = [];
  for (let i = 0; i < 18; i += 1) arr.push(Math.sqrt(i + 1));
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.ok(r.fpPValue >= 0 && r.fpPValue <= 1);
});

test('fp: fpV1 and fpV2 are non-negative', () => {
  const arr: number[] = [];
  for (let i = 0; i < 22; i += 1) arr.push((i * 13) % 7);
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.ok(r.fpV1 >= 0);
  assert.ok(r.fpV2 >= 0);
});

test('fp: sumP + sumQ <= n1*n2 (with ties strict <=)', () => {
  const arr: number[] = [];
  for (let i = 0; i < 18; i += 1) arr.push(i % 4);
  const r = dailyTokenFlignerPolicelloHalves(arr);
  assert.ok(r.fpSumP + r.fpSumQ <= r.fpN1 * r.fpN2 + 1e-9);
});

// ---------- builder: buildDailyTokenFlignerPolicelloHalves ----------

test('fp build: empty queue -> empty sources', () => {
  const r = buildDailyTokenFlignerPolicelloHalves([], {
    generatedAt: '2026-01-01T00:00:00Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('fp build: single source produces one row', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 100 + i * 10));
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    generatedAt: '2026-02-01T00:00:00Z',
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.sources[0]!.fpZ > 0);
});

test('fp build: minTenureDays floor 16 enforced', () => {
  assert.throws(() =>
    buildDailyTokenFlignerPolicelloHalves([], {
      minTenureDays: 8,
    }),
  );
});

test('fp build: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenFlignerPolicelloHalves([], {
      sort: 'bogus' as never,
    }),
  );
});

test('fp build: minTokens negative throws', () => {
  assert.throws(() =>
    buildDailyTokenFlignerPolicelloHalves([], { minTokens: -1 }),
  );
});

test('fp build: top negative throws', () => {
  assert.throws(() =>
    buildDailyTokenFlignerPolicelloHalves([], { top: -1 }),
  );
});

test('fp build: source filter restricts to one', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 100 + i));
    queue.push(ql(dayIso(i), 'src-b', 200 + i));
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    minTokens: 0,
    source: 'src-a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('fp build: drops sparse sources below minTokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'thin', 1));
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('fp build: drops zero-variance source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 500));
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    minTokens: 0,
  });
  assert.equal(r.droppedZeroVariance, 1);
});

test('fp build: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'src', 100)];
  const r = buildDailyTokenFlignerPolicelloHalves(queue, { minTokens: 0 });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('fp build: drops non-positive tokens', () => {
  const queue: QueueLine[] = [ql(dayIso(0), 'src', 0), ql(dayIso(1), 'src', -5)];
  const r = buildDailyTokenFlignerPolicelloHalves(queue, { minTokens: 0 });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('fp build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 100 + i + src.charCodeAt(0)));
    }
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    minTokens: 0,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('fp build: invalid since throws', () => {
  assert.throws(() =>
    buildDailyTokenFlignerPolicelloHalves([], { since: 'not-iso' }),
  );
});

test('fp build: sort by fpZ orders ascending', () => {
  const queue: QueueLine[] = [];
  // src-a: increasing -> positive fpZ
  // src-b: decreasing -> negative fpZ
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 100 + i * 5));
    queue.push(ql(dayIso(i), 'src-b', 200 - i * 5));
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    minTokens: 0,
    sort: 'fpZ',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.fpZ <= r.sources[1]!.fpZ);
});

test('fp build: sort by fpZAbsDesc puts strongest |Z| first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat-ish', 100 + (i % 2)));
    queue.push(ql(dayIso(i), 'sharp', 100 + i * 100));
  }
  const r = buildDailyTokenFlignerPolicelloHalves(queue, {
    minTokens: 0,
    sort: 'fpZAbsDesc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(Math.abs(r.sources[0]!.fpZ) >= Math.abs(r.sources[1]!.fpZ));
});
