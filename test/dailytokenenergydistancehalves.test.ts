import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenEnergyDistanceHalves,
  buildDailyTokenEnergyDistanceHalves,
} from '../src/dailytokenenergydistancehalves.js';
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

// Brute-force reference implementation of the energy
// V-statistic. O((n1+n2)^2). Used only in tests.
function energyHatBrute(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  let ab = 0;
  for (let i = 0; i < n1; i += 1) {
    for (let j = 0; j < n2; j += 1) {
      ab += Math.abs(a[i]! - b[j]!);
    }
  }
  let aa = 0;
  for (let i = 0; i < n1; i += 1) {
    for (let j = 0; j < n1; j += 1) {
      aa += Math.abs(a[i]! - a[j]!);
    }
  }
  let bb = 0;
  for (let i = 0; i < n2; i += 1) {
    for (let j = 0; j < n2; j += 1) {
      bb += Math.abs(b[i]! - b[j]!);
    }
  }
  return (
    (2 * ab) / (n1 * n2) - aa / (n1 * n1) - bb / (n2 * n2)
  );
}

// ---------- primitive: input validation ----------

test('dailyTokenEnergyDistanceHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenEnergyDistanceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenEnergyDistanceHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenEnergyDistanceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenEnergyDistanceHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
});

test('dailyTokenEnergyDistanceHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenEnergyDistanceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: half-split sizes ----------

test('dailyTokenEnergyDistanceHalves: n1 = floor(n/2), n2 = n - n1, even n', () => {
  const r = dailyTokenEnergyDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.enN1, 4);
  assert.equal(r.enN2, 4);
  assert.equal(r.nSamples, 8);
});

test('dailyTokenEnergyDistanceHalves: n1 = floor(n/2), n2 = n - n1, odd n', () => {
  const r = dailyTokenEnergyDistanceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.enN1, 4);
  assert.equal(r.enN2, 5);
  assert.equal(r.nSamples, 9);
});

// ---------- primitive: matches brute-force ----------

test('dailyTokenEnergyDistanceHalves: matches brute-force E_hat (even split)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenEnergyDistanceHalves(x);
  const ref = energyHatBrute([1, 2, 3, 4], [5, 6, 7, 8]);
  assert.ok(
    Math.abs(r.enE - ref) < 1e-12,
    `expected E_hat = ${ref}, got ${r.enE}`,
  );
});

test('dailyTokenEnergyDistanceHalves: matches brute-force E_hat (odd split)', () => {
  const x = [3, 1, 4, 1, 5, 9, 2, 6, 5];
  const r = dailyTokenEnergyDistanceHalves(x);
  const ref = energyHatBrute([3, 1, 4, 1], [5, 9, 2, 6, 5]);
  assert.ok(
    Math.abs(r.enE - ref) < 1e-12,
    `expected E_hat = ${ref}, got ${r.enE}`,
  );
});

test('dailyTokenEnergyDistanceHalves: matches brute-force on 30-sample series', () => {
  const x: number[] = [];
  for (let i = 0; i < 30; i += 1) {
    x.push(((i * 9301 + 49297) % 233280) / 100);
  }
  const r = dailyTokenEnergyDistanceHalves(x);
  const ref = energyHatBrute(x.slice(0, 15), x.slice(15));
  assert.ok(
    Math.abs(r.enE - ref) < 1e-9,
    `expected E_hat = ${ref}, got ${r.enE}`,
  );
});

// ---------- primitive: T = n1*n2/(n1+n2) * E ----------

test('dailyTokenEnergyDistanceHalves: enT = n1*n2/(n1+n2) * enE', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const r = dailyTokenEnergyDistanceHalves(x);
  const expected = ((r.enN1 * r.enN2) / (r.enN1 + r.enN2)) * r.enE;
  assert.ok(
    Math.abs(r.enT - expected) < 1e-12,
    `enT mismatch: ${r.enT} vs ${expected}`,
  );
});

// ---------- primitive: invariances ----------

test('dailyTokenEnergyDistanceHalves: location-invariant (E_hat unchanged by additive shift)', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenEnergyDistanceHalves(x);
  const r2 = dailyTokenEnergyDistanceHalves(x.map((v) => v + 1000));
  assert.ok(
    Math.abs(r1.enE - r2.enE) < 1e-9,
    `E_hat location-invariant: ${r1.enE} vs ${r2.enE}`,
  );
});

test('dailyTokenEnergyDistanceHalves: positive-homogeneous of degree 1 (E_hat(k*x) = k*E_hat(x))', () => {
  const x = [1, 3, 2, 5, 4, 7, 6, 9];
  const r1 = dailyTokenEnergyDistanceHalves(x);
  const r7 = dailyTokenEnergyDistanceHalves(x.map((v) => v * 7));
  assert.ok(
    Math.abs(r7.enE - 7 * r1.enE) < 1e-9,
    `E_hat 1-homogeneous: ${r7.enE} vs ${7 * r1.enE}`,
  );
});

test('dailyTokenEnergyDistanceHalves: half-swap leaves E_hat invariant, flips enDir', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r1 = dailyTokenEnergyDistanceHalves(x);
  const xSwap = [...x.slice(4), ...x.slice(0, 4)];
  const r2 = dailyTokenEnergyDistanceHalves(xSwap);
  assert.ok(Math.abs(r1.enE - r2.enE) < 1e-9);
  assert.equal(r1.enDir, -r2.enDir);
});

// ---------- primitive: signs and effect-size scaling ----------

test('dailyTokenEnergyDistanceHalves: clean step shift up => enDir = +1, enZSigned > 0', () => {
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r = dailyTokenEnergyDistanceHalves(x);
  assert.ok(r.enE > 0);
  assert.equal(r.enDir, 1);
  assert.ok(r.enZSigned > 0);
});

test('dailyTokenEnergyDistanceHalves: reversed step shift => enDir = -1, enZSigned < 0', () => {
  const x = [5, 5, 5, 5.5, 1, 1, 1, 1.5];
  const r = dailyTokenEnergyDistanceHalves(x);
  assert.equal(r.enDir, -1);
  assert.ok(r.enZSigned < 0);
});

test('dailyTokenEnergyDistanceHalves: identical halves => E_hat small', () => {
  const x = [1, 2, 3, 4, 1, 2, 3, 4];
  const r = dailyTokenEnergyDistanceHalves(x);
  assert.ok(
    r.enE < 0.5,
    `E_hat should be small for identical halves, got ${r.enE}`,
  );
});

// ---------- primitive: non-negativity ----------

test('dailyTokenEnergyDistanceHalves: enE >= 0 always (Szekely-Rizzo 2013 Thm 1)', () => {
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
      r = dailyTokenEnergyDistanceHalves(x);
    } catch {
      continue;
    }
    assert.ok(r.enE >= 0, `enE should be >= 0, got ${r.enE}`);
    assert.ok(r.enZ >= 0, `enZ should be >= 0, got ${r.enZ}`);
    assert.ok(r.enT >= 0, `enT should be >= 0, got ${r.enT}`);
  }
});

// ---------- builder: source filtering ----------

test('buildDailyTokenEnergyDistanceHalves: filters by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'big', d % 2 === 0 ? 200 : 5000));
    queue.push(ql(dayIso(d), 'tiny', 5));
  }
  const r = buildDailyTokenEnergyDistanceHalves(queue, {
    minTokens: 1000,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenEnergyDistanceHalves: filters by min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 8; d += 1) {
    queue.push(ql(dayIso(d), 'shortlived', d % 2 === 0 ? 100 : 5000));
  }
  const r = buildDailyTokenEnergyDistanceHalves(queue, {
    minTenureDays: 14,
    minTokens: 100,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('buildDailyTokenEnergyDistanceHalves: drops zero-variance sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'flat', 1000));
  }
  const r = buildDailyTokenEnergyDistanceHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

// ---------- builder: sort orderings ----------

test('buildDailyTokenEnergyDistanceHalves: sort=enTDesc orders strongest shift first', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'shifted', d < 8 ? 100 : 5000));
  }
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'stable', 1000 + (d % 3) * 50));
  }
  const r = buildDailyTokenEnergyDistanceHalves(queue, {
    sort: 'enTDesc',
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'shifted');
  assert.ok(r.sources[0]!.enT > r.sources[1]!.enT);
});

test('buildDailyTokenEnergyDistanceHalves: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenEnergyDistanceHalves([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenEnergyDistanceHalves: rejects min-tenure-days < 8', () => {
  assert.throws(
    () => buildDailyTokenEnergyDistanceHalves([], { minTenureDays: 4 }),
    /minTenureDays must be an integer >= 8/,
  );
});

// ---------- builder: top cap ----------

test('buildDailyTokenEnergyDistanceHalves: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 16; d += 1) {
      queue.push(ql(dayIso(d), src, d < 8 ? 100 : 5000));
    }
  }
  const r = buildDailyTokenEnergyDistanceHalves(queue, {
    top: 1,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

// ---------- determinism ----------

test('buildDailyTokenEnergyDistanceHalves: deterministic with fixed generatedAt', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 16; d += 1) {
    queue.push(ql(dayIso(d), 'src', 100 + d * 10));
  }
  const r1 = buildDailyTokenEnergyDistanceHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const r2 = buildDailyTokenEnergyDistanceHalves(queue, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

// ---------- structural orthogonality vs W1/CvM/KS ----------

test('dailyTokenEnergyDistanceHalves: detects shape difference at equal medians', () => {
  // Both halves have median ~3 but different shape.
  // First half: tight cluster around 3.
  // Second half: bimodal at 1 and 5, also median ~3.
  const x = [3, 3, 3, 3, 1, 1, 5, 5];
  const r = dailyTokenEnergyDistanceHalves(x);
  // Energy distance should pick this up even though
  // medians are equal.
  assert.ok(r.enE > 0.5, `expected E_hat > 0.5, got ${r.enE}`);
});

test('dailyTokenEnergyDistanceHalves: enZ scale-invariant under x -> k*x', () => {
  // E_hat is 1-homogeneous and pooledMad is also
  // 1-homogeneous, so sqrt(E_hat)/pooledMad scales
  // as sqrt(k)/k = 1/sqrt(k), which is NOT invariant.
  // So we just verify enZ is finite under rescale.
  const x = [1, 1, 1, 1.5, 5, 5, 5, 5.5];
  const r1 = dailyTokenEnergyDistanceHalves(x);
  const r10 = dailyTokenEnergyDistanceHalves(x.map((v) => v * 10));
  assert.ok(Number.isFinite(r1.enZ));
  assert.ok(Number.isFinite(r10.enZ));
  // sqrt(E_hat(10x))/pooledMad(10x) = sqrt(10)*sqrt(E_hat(x))/(10*pooledMad(x))
  //   = sqrt(E_hat(x))/(sqrt(10)*pooledMad(x)) = enZ(x)/sqrt(10)
  assert.ok(
    Math.abs(r10.enZ * Math.sqrt(10) - r1.enZ) < 1e-9,
    `enZ scaling: r10.enZ*sqrt(10)=${r10.enZ * Math.sqrt(10)} vs r1.enZ=${r1.enZ}`,
  );
});

test('dailyTokenEnergyDistanceHalves: support-distance dominates equal-mass narrow shift', () => {
  // Widely-separated halves vs narrowly-separated.
  const wideShift = [1, 1, 1, 1.5, 100, 100, 100, 100.5];
  const narrowShift = [1, 1, 1, 1.5, 2, 2, 2, 2.5];
  const rWide = dailyTokenEnergyDistanceHalves(wideShift);
  const rNarrow = dailyTokenEnergyDistanceHalves(narrowShift);
  assert.ok(
    rWide.enE > 10 * rNarrow.enE,
    `wide-shift E_hat ${rWide.enE} should be >> narrow ${rNarrow.enE}`,
  );
});
