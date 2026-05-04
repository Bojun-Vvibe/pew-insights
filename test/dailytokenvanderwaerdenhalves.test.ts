import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenVanDerWaerdenHalves,
  buildDailyTokenVanDerWaerdenHalves,
  fractionalMidRanksVdw,
  inverseStandardNormalCdfVdw,
  standardNormalUpperTailVdw,
  aggregateVanDerWaerdenHalves,
  labelVanDerWaerdenHalvesRow,
} from '../src/dailytokenvanderwaerdenhalves.js';
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

// ---------- primitive: inverseStandardNormalCdfVdw ----------

test('inverseStandardNormalCdfVdw: median maps to 0', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfVdw(0.5)) < 1e-9);
});

test('inverseStandardNormalCdfVdw: 0.975 maps near 1.96', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfVdw(0.975) - 1.959963985) < 1e-6);
});

test('inverseStandardNormalCdfVdw: 0.025 maps near -1.96', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfVdw(0.025) + 1.959963985) < 1e-6);
});

test('inverseStandardNormalCdfVdw: symmetry Phi^{-1}(p) = -Phi^{-1}(1-p)', () => {
  for (const p of [0.01, 0.1, 0.3, 0.7, 0.9, 0.99]) {
    const a = inverseStandardNormalCdfVdw(p);
    const b = inverseStandardNormalCdfVdw(1 - p);
    assert.ok(Math.abs(a + b) < 1e-7, `p=${p}, a=${a}, b=${b}`);
  }
});

test('inverseStandardNormalCdfVdw: tail near 0.999 reasonable', () => {
  const z = inverseStandardNormalCdfVdw(0.999);
  assert.ok(z > 3.0 && z < 3.5);
});

test('inverseStandardNormalCdfVdw: throws on p<=0', () => {
  assert.throws(() => inverseStandardNormalCdfVdw(0));
  assert.throws(() => inverseStandardNormalCdfVdw(-0.1));
});

test('inverseStandardNormalCdfVdw: throws on p>=1', () => {
  assert.throws(() => inverseStandardNormalCdfVdw(1));
  assert.throws(() => inverseStandardNormalCdfVdw(1.5));
});

test('inverseStandardNormalCdfVdw: throws on NaN', () => {
  assert.throws(() => inverseStandardNormalCdfVdw(Number.NaN));
});

// ---------- primitive: fractionalMidRanksVdw ----------

test('fractionalMidRanksVdw: distinct ascending', () => {
  assert.deepEqual(fractionalMidRanksVdw([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('fractionalMidRanksVdw: distinct unsorted', () => {
  assert.deepEqual(fractionalMidRanksVdw([30, 10, 40, 20]), [3, 1, 4, 2]);
});

test('fractionalMidRanksVdw: handles ties via mid-rank', () => {
  // values: [10, 10, 20] -> ranks: [1.5, 1.5, 3]
  assert.deepEqual(fractionalMidRanksVdw([10, 10, 20]), [1.5, 1.5, 3]);
});

test('fractionalMidRanksVdw: all ties -> all (n+1)/2', () => {
  assert.deepEqual(fractionalMidRanksVdw([5, 5, 5, 5]), [2.5, 2.5, 2.5, 2.5]);
});

test('fractionalMidRanksVdw: throws on empty', () => {
  assert.throws(() => fractionalMidRanksVdw([]));
});

test('fractionalMidRanksVdw: throws on non-finite', () => {
  assert.throws(() => fractionalMidRanksVdw([1, 2, Number.NaN]));
});

// ---------- primitive: standardNormalUpperTailVdw ----------

test('standardNormalUpperTailVdw: 0 returns 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailVdw(0) - 0.5) < 1e-6);
});

test('standardNormalUpperTailVdw: 1.96 ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailVdw(1.96) - 0.025) < 1e-4);
});

test('standardNormalUpperTailVdw: throws on NaN', () => {
  assert.throws(() => standardNormalUpperTailVdw(Number.NaN));
});

// ---------- core: dailyTokenVanDerWaerdenHalves ----------

test('dailyTokenVanDerWaerdenHalves: throws under 16 samples', () => {
  assert.throws(() =>
    dailyTokenVanDerWaerdenHalves(Array.from({ length: 15 }, (_, i) => i + 1)),
  );
});

test('dailyTokenVanDerWaerdenHalves: throws on non-finite', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  xs[5] = Number.NaN;
  assert.throws(() => dailyTokenVanDerWaerdenHalves(xs));
});

test('dailyTokenVanDerWaerdenHalves: throws on zero variance', () => {
  assert.throws(() => dailyTokenVanDerWaerdenHalves(new Array(20).fill(7)));
});

test('dailyTokenVanDerWaerdenHalves: returns shape and finite values', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenVanDerWaerdenHalves(xs);
  assert.equal(r.nSamples, 20);
  assert.equal(r.vdwN1, 10);
  assert.equal(r.vdwN2, 10);
  assert.ok(Number.isFinite(r.vdwT));
  assert.ok(Number.isFinite(r.vdwZ));
  assert.ok(Number.isFinite(r.vdwPValue));
  assert.ok(r.vdwPValue >= 0 && r.vdwPValue <= 1);
  assert.ok(r.vdwSumSquaredScores > 0);
});

test('dailyTokenVanDerWaerdenHalves: monotone increasing -> second half larger -> vdwZ > 0', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenVanDerWaerdenHalves(xs);
  assert.ok(r.vdwZ > 0, `expected vdwZ>0 (second half bigger), got ${r.vdwZ}`);
  assert.ok(
    r.vdwPValue < 0.05,
    `expected significant rejection, got p=${r.vdwPValue}`,
  );
});

test('dailyTokenVanDerWaerdenHalves: monotone decreasing -> first half larger -> vdwZ < 0', () => {
  const xs = Array.from({ length: 20 }, (_, i) => 20 - i);
  const r = dailyTokenVanDerWaerdenHalves(xs);
  assert.ok(r.vdwZ < 0, `expected vdwZ<0, got ${r.vdwZ}`);
});

test('dailyTokenVanDerWaerdenHalves: location-shift invariant under +c', () => {
  const xs = Array.from({ length: 24 }, (_, i) => Math.sin(i) + i * 0.1);
  const r1 = dailyTokenVanDerWaerdenHalves(xs);
  const r2 = dailyTokenVanDerWaerdenHalves(xs.map((v) => v + 100));
  assert.ok(Math.abs(r1.vdwZ - r2.vdwZ) < 1e-9);
});

test('dailyTokenVanDerWaerdenHalves: positive-scale invariant', () => {
  const xs = Array.from({ length: 24 }, (_, i) => i * 0.5 + Math.cos(i));
  const r1 = dailyTokenVanDerWaerdenHalves(xs);
  const r2 = dailyTokenVanDerWaerdenHalves(xs.map((v) => v * 7));
  assert.ok(Math.abs(r1.vdwZ - r2.vdwZ) < 1e-9);
});

test('dailyTokenVanDerWaerdenHalves: reverse(x) negates vdwZ when n1=n2 (no inter-half ties)', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  const r1 = dailyTokenVanDerWaerdenHalves(xs);
  const rev = xs.slice().reverse();
  const r2 = dailyTokenVanDerWaerdenHalves(rev);
  assert.ok(Math.abs(r1.vdwZ + r2.vdwZ) < 1e-9, `r1=${r1.vdwZ} r2=${r2.vdwZ}`);
});

test('dailyTokenVanDerWaerdenHalves: balanced random-ish noise gives small Z', () => {
  // Symmetric pattern around midpoint -> first/second halves similar location
  const xs = Array.from({ length: 30 }, (_, i) => Math.sin(i));
  const r = dailyTokenVanDerWaerdenHalves(xs);
  assert.ok(Math.abs(r.vdwZ) < 3, `expected modest |Z|, got ${r.vdwZ}`);
});

test('dailyTokenVanDerWaerdenHalves: pValue is two-sided 2*(1-Phi(|Z|))', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenVanDerWaerdenHalves(xs);
  const expected = 2 * standardNormalUpperTailVdw(Math.abs(r.vdwZ));
  assert.ok(Math.abs(r.vdwPValue - expected) < 1e-12);
});

test('dailyTokenVanDerWaerdenHalves: variance formula matches definition', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1 + 0.01 * (i % 3));
  const r = dailyTokenVanDerWaerdenHalves(xs);
  const expectedVar =
    ((r.vdwN1 * r.vdwN2) / (r.nSamples * (r.nSamples - 1))) *
    r.vdwSumSquaredScores;
  assert.ok(Math.abs(r.vdwVarT - expectedVar) < 1e-12);
});

// ---------- builder: buildDailyTokenVanDerWaerdenHalves ----------

test('builder: includes one source with sufficient tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'svc-a', (i + 1) * 1000));
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue, {
    minTokens: 1000,
    minTenureDays: 16,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'svc-a');
  assert.ok(r.sources[0]!.vdwZ > 0);
});

test('builder: drops below-min-tenure sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'svc-a', 5000));
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('builder: drops below-min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'svc-tiny', 10));
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'svc', 100)];
  const r = buildDailyTokenVanDerWaerdenHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: drops non-positive tokens', () => {
  const queue: QueueLine[] = [ql(dayIso(0), 'svc', 0)];
  const r = buildDailyTokenVanDerWaerdenHalves(queue);
  assert.equal(r.droppedNonPositiveTokens, 1);
});

test('builder: source filter drops non-matching', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', (i + 1) * 1000));
    queue.push(ql(dayIso(i), 'b', (i + 1) * 1000));
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue, { source: 'a' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('builder: zero-variance constant series counted', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'svc', 1000));
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('builder: top cap drops surplus rows', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, (i + 1) * 100 * (src.charCodeAt(0) - 96)));
    }
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('builder: throws on invalid sort', () => {
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildDailyTokenVanDerWaerdenHalves([], { sort: 'bogus' as any }),
  );
});

test('builder: throws on min-tenure-days below floor', () => {
  assert.throws(() =>
    buildDailyTokenVanDerWaerdenHalves([], { minTenureDays: 8 }),
  );
});

test('builder: throws on negative minTokens', () => {
  assert.throws(() =>
    buildDailyTokenVanDerWaerdenHalves([], { minTokens: -1 }),
  );
});

test('builder: throws on negative top', () => {
  assert.throws(() => buildDailyTokenVanDerWaerdenHalves([], { top: -3 }));
});

test('builder: sort by vdwPValue ascending', () => {
  const queue: QueueLine[] = [];
  for (const src of ['x', 'y']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, (i + 1) * 100));
    }
  }
  const r = buildDailyTokenVanDerWaerdenHalves(queue, { sort: 'vdwPValue' });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.vdwPValue <= r.sources[i]!.vdwPValue);
  }
});

// ---------- aggregator: aggregateVanDerWaerdenHalves ----------

test('aggregator: empty rows returns zero-state', () => {
  const a = aggregateVanDerWaerdenHalves([]);
  assert.equal(a.rowsUsed, 0);
  assert.equal(a.stoufferZ, 0);
  assert.equal(a.stoufferTwoSidedPValue, 1);
});

test('aggregator: skips malformed', () => {
  const a = aggregateVanDerWaerdenHalves([
    {
      vdwZ: Number.NaN,
      vdwPValue: 0.5,
      vdwVarT: 1,
      nTenureDays: 20,
    },
    { vdwZ: 1, vdwPValue: 0, vdwVarT: 1, nTenureDays: 20 }, // bad pValue
    { vdwZ: 2, vdwPValue: 0.04, vdwVarT: 1, nTenureDays: 20 }, // good
  ]);
  assert.equal(a.rowsUsed, 1);
  assert.equal(a.rowsSkipped, 2);
  assert.ok(Math.abs(a.stoufferZ - 2) < 1e-9);
});

test('aggregator: stouffer = sum/sqrt(m)', () => {
  const rows = [1.5, -0.5, 2.0].map((z) => ({
    vdwZ: z,
    vdwPValue: 0.1,
    vdwVarT: 1,
    nTenureDays: 20,
  }));
  const a = aggregateVanDerWaerdenHalves(rows);
  assert.equal(a.rowsUsed, 3);
  assert.ok(Math.abs(a.stoufferZ - (1.5 - 0.5 + 2) / Math.sqrt(3)) < 1e-9);
});

test('aggregator: tenure-weighted mean correct', () => {
  const rows = [
    { vdwZ: 1, vdwPValue: 0.3, vdwVarT: 1, nTenureDays: 10 },
    { vdwZ: 3, vdwPValue: 0.3, vdwVarT: 1, nTenureDays: 30 },
  ];
  const a = aggregateVanDerWaerdenHalves(rows);
  // weighted = (10*1 + 30*3) / 40 = 100/40 = 2.5
  assert.ok(Math.abs(a.tenureWeightedMeanVdwZ - 2.5) < 1e-9);
  // unweighted = 2
  assert.ok(Math.abs(a.meanVdwZ - 2) < 1e-9);
});

// ---------- classifier: labelVanDerWaerdenHalvesRow ----------

test('classifier: second-decisively-larger', () => {
  assert.equal(
    labelVanDerWaerdenHalvesRow({ vdwZ: 3, vdwPValue: 0.001 }),
    'second-decisively-larger-location',
  );
});

test('classifier: first-decisively-larger', () => {
  assert.equal(
    labelVanDerWaerdenHalvesRow({ vdwZ: -3, vdwPValue: 0.001 }),
    'first-decisively-larger-location',
  );
});

test('classifier: second-leans (alpha<=p<2alpha)', () => {
  assert.equal(
    labelVanDerWaerdenHalvesRow({ vdwZ: 1.8, vdwPValue: 0.07 }),
    'second-leans-larger-location',
  );
});

test('classifier: first-leans', () => {
  assert.equal(
    labelVanDerWaerdenHalvesRow({ vdwZ: -1.8, vdwPValue: 0.07 }),
    'first-leans-larger-location',
  );
});

test('classifier: no evidence', () => {
  assert.equal(
    labelVanDerWaerdenHalvesRow({ vdwZ: 0.3, vdwPValue: 0.5 }),
    'no-evidence-of-location-shift',
  );
});

test('classifier: throws on bad alpha', () => {
  assert.throws(() =>
    labelVanDerWaerdenHalvesRow({ vdwZ: 1, vdwPValue: 0.1 }, 0.6),
  );
});

test('classifier: throws on bad pValue', () => {
  assert.throws(() => labelVanDerWaerdenHalvesRow({ vdwZ: 1, vdwPValue: 0 }));
});

test('classifier: throws on non-finite Z', () => {
  assert.throws(() =>
    labelVanDerWaerdenHalvesRow({ vdwZ: Number.NaN, vdwPValue: 0.1 }),
  );
});
