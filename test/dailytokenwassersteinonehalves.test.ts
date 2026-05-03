import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenWassersteinOneHalves,
  buildDailyTokenWassersteinOneHalves,
} from '../src/dailytokenwassersteinonehalves.js';
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

test('dailyTokenWassersteinOneHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenWassersteinOneHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenWassersteinOneHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenWassersteinOneHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenWassersteinOneHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenWassersteinOneHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenWassersteinOneHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: half-split sizes ----------

test('dailyTokenWassersteinOneHalves: n1 = floor(n/2), n2 = n - n1, even n', () => {
  const r = dailyTokenWassersteinOneHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.wassN1, 4);
  assert.equal(r.wassN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenWassersteinOneHalves: n1 = floor(n/2), n2 = n - n1, odd n', () => {
  const r = dailyTokenWassersteinOneHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.wassN1, 4);
  assert.equal(r.wassN2, 5);
  assert.equal(r.nSamples, 9);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenWassersteinOneHalves: equal-size paired-sort closed form', () => {
  // n1 = n2 = m: W1 = (1/m) sum |A_(i) - B_(i)|.
  // x = [1, 2, 3, 4, 5, 6, 7, 8]
  // A = [1, 2, 3, 4]  B = [5, 6, 7, 8]
  // sorted equal: |1-5|+|2-6|+|3-7|+|4-8| = 16, /4 = 4.
  const r = dailyTokenWassersteinOneHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(
    Math.abs(r.wassW1 - 4) < 1e-12,
    `expected W1 = 4, got ${r.wassW1}`,
  );
});

test('dailyTokenWassersteinOneHalves: uneven-size known integral', () => {
  // n=9: A = [1,2,3,4]  B = [5,6,7,8,9]
  // n1=4 -> CDF jumps at 0.25, 0.50, 0.75, 1.00
  // n2=5 -> CDF jumps at 0.20, 0.40, 0.60, 0.80, 1.00
  // merged: 0.20, 0.25, 0.40, 0.50, 0.60, 0.75, 0.80, 1.00
  // segment, A active, B active, len, |gap|:
  //   (0.00, 0.20]  A_(0)=1, B_(0)=5  0.20  4   -> 0.80
  //   (0.20, 0.25]  A_(0)=1, B_(1)=6  0.05  5   -> 0.25
  //   (0.25, 0.40]  A_(1)=2, B_(1)=6  0.15  4   -> 0.60
  //   (0.40, 0.50]  A_(1)=2, B_(2)=7  0.10  5   -> 0.50
  //   (0.50, 0.60]  A_(2)=3, B_(2)=7  0.10  4   -> 0.40
  //   (0.60, 0.75]  A_(2)=3, B_(3)=8  0.15  5   -> 0.75
  //   (0.75, 0.80]  A_(3)=4, B_(3)=8  0.05  4   -> 0.20
  //   (0.80, 1.00]  A_(3)=4, B_(4)=9  0.20  5   -> 1.00
  // total = 4.50
  const r = dailyTokenWassersteinOneHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.ok(
    Math.abs(r.wassW1 - 4.5) < 1e-12,
    `expected W1 = 4.5, got ${r.wassW1}`,
  );
});

// ---------- primitive: invariances ----------

test('dailyTokenWassersteinOneHalves: location-invariant (W1 unchanged by additive shift)', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenWassersteinOneHalves(x);
  const r2 = dailyTokenWassersteinOneHalves(x.map((v) => v + 1000));
  assert.ok(
    Math.abs(r1.wassW1 - r2.wassW1) < 1e-9,
    `W1 location-invariant: ${r1.wassW1} vs ${r2.wassW1}`,
  );
});

test('dailyTokenWassersteinOneHalves: positive-homogeneous of degree 1 (W1(k*x) = k*W1(x))', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenWassersteinOneHalves(x);
  const r7 = dailyTokenWassersteinOneHalves(x.map((v) => v * 7));
  assert.ok(
    Math.abs(r7.wassW1 - 7 * r1.wassW1) < 1e-9,
    `W1 1-homogeneous: ${r7.wassW1} vs ${7 * r1.wassW1}`,
  );
});

test('dailyTokenWassersteinOneHalves: half-swap leaves W1 invariant, flips wassDir', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r1 = dailyTokenWassersteinOneHalves(x);
  const xSwap = [...x.slice(4), ...x.slice(0, 4)];
  const r2 = dailyTokenWassersteinOneHalves(xSwap);
  assert.ok(Math.abs(r1.wassW1 - r2.wassW1) < 1e-9);
  assert.equal(r1.wassDir, -r2.wassDir);
});

// ---------- primitive: signs and effect-size scaling ----------

test('dailyTokenWassersteinOneHalves: clean step shift up => wassDir = +1, wassZSigned > 0', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r = dailyTokenWassersteinOneHalves(x);
  assert.ok(r.wassW1 > 0);
  assert.equal(r.wassDir, 1);
  assert.ok(r.wassZSigned > 0);
});

test('dailyTokenWassersteinOneHalves: reversed step shift => wassDir = -1, wassZSigned < 0', () => {
  const x = [5, 5, 5, 5.5, 1, 1, 1, 1.5];
  const r = dailyTokenWassersteinOneHalves(x);
  assert.equal(r.wassDir, -1);
  assert.ok(r.wassZSigned < 0);
});

test('dailyTokenWassersteinOneHalves: identical halves => W1 small', () => {
  const x = [1, 2, 3, 4, 1, 2, 3, 4];
  const r = dailyTokenWassersteinOneHalves(x);
  assert.ok(r.wassW1 < 0.5, `W1 should be small for identical halves, got ${r.wassW1}`);
});

// ---------- primitive: non-negativity ----------

test('dailyTokenWassersteinOneHalves: wassW1 >= 0 always', () => {
  for (let trial = 0; trial < 20; trial += 1) {
    const x = Array.from({ length: 12 }, () => Math.random() * 100);
    let mn = x[0]!;
    let mx = x[0]!;
    for (const v of x) {
      if (v < mn) mn = v;
      if (v > mx) mx = v;
    }
    if (mn === mx) continue;
    let r;
    try {
      r = dailyTokenWassersteinOneHalves(x);
    } catch {
      // pooled MAD == 0 is acceptable in degenerate
      // randomised cases; just skip.
      continue;
    }
    assert.ok(r.wassW1 >= 0, `wassW1 should be >= 0, got ${r.wassW1}`);
    assert.ok(r.wassZ >= 0, `wassZ should be >= 0, got ${r.wassZ}`);
  }
});

// ---------- builder: source filtering ----------

test('buildDailyTokenWassersteinOneHalves: filters by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'big', d % 2 === 0 ? 200 : 5000));
    queue.push(ql(dayIso(d), 'tiny', 5));
  }
  const r = buildDailyTokenWassersteinOneHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenWassersteinOneHalves: filters by min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 8; d += 1) {
    queue.push(ql(dayIso(d), 'shortlived', d % 2 === 0 ? 100 : 5000));
  }
  const r = buildDailyTokenWassersteinOneHalves(queue, {
    minTenureDays: 14,
    minTokens: 100,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenWassersteinOneHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 1000));
  }
  const r = buildDailyTokenWassersteinOneHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

// ---------- builder: sort orderings ----------

test('buildDailyTokenWassersteinOneHalves: sort=wassW1Desc orders strongest shift first', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'shifted', d < 8 ? 100 : 5000));
  }
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'stable', 1000 + (d % 3) * 50));
  }
  const r = buildDailyTokenWassersteinOneHalves(queue, {
    sort: 'wassW1Desc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'shifted');
  assert.ok(r.sources[0]!.wassW1 > r.sources[1]!.wassW1);
});

test('buildDailyTokenWassersteinOneHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenWassersteinOneHalves([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenWassersteinOneHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenWassersteinOneHalves([], { minTenureDays: 4 }),
    /minTenureDays must be an integer >= 8/,
  );
});

// ---------- builder: top cap ----------

test('buildDailyTokenWassersteinOneHalves: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, d < 8 ? 100 : 5000));
    }
  }
  const r = buildDailyTokenWassersteinOneHalves(queue, {
    top: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

// ---------- determinism ----------

test('buildDailyTokenWassersteinOneHalves: deterministic with fixed generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 + d * 10));
  }
  const r1 = buildDailyTokenWassersteinOneHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const r2 = buildDailyTokenWassersteinOneHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

// ---------- structural orthogonality vs CvM/KS ----------

test('dailyTokenWassersteinOneHalves: support-distance dominates equal-mass narrow shift', () => {
  // Widely-separated halves (far transport).
  const wideShift = [1, 1, 1, 1.5, 100, 100, 100, 100.5];
  // Narrowly-separated halves (short transport).
  const narrowShift = [1, 1, 1, 1.5, 2, 2, 2, 2.5];
  const rWide = dailyTokenWassersteinOneHalves(wideShift);
  const rNarrow = dailyTokenWassersteinOneHalves(narrowShift);
  // W1 lives in support units, so transport distance
  // dominates: wide-shift W1 should be much larger
  // even though both have one full step at the
  // halfway point.
  assert.ok(
    rWide.wassW1 > 10 * rNarrow.wassW1,
    `wide-shift W1 ${rWide.wassW1} should be >> narrow ${rNarrow.wassW1}`,
  );
});
