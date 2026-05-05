import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenHoggAdaptiveHalves,
  buildDailyTokenHoggAdaptiveHalves,
  hoggSelectorQ,
  hoggDispatchFromQ,
  hoggMoodMedianZ,
  hoggWilcoxonZ,
  hoggVanDerWaerdenZ,
  midRanksHogg,
  medianHogg,
  standardNormalUpperTailHogg,
  standardNormalInverseHogg,
  aggregateHoggAdaptiveHalves,
  type HoggAdaptiveDispatch,
} from '../src/dailytokenhoggadaptivehalves.js';
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

// ---------- primitive: medianHogg ----------

test('medianHogg: odd-length picks middle', () => {
  assert.equal(medianHogg([3, 1, 2]), 2);
});

test('medianHogg: even-length averages middle two', () => {
  assert.equal(medianHogg([4, 1, 2, 3]), 2.5);
});

test('medianHogg: throws on empty', () => {
  assert.throws(() => medianHogg([]), /empty/);
});

// ---------- primitive: midRanksHogg ----------

test('midRanksHogg: distinct values give straight ranks', () => {
  const ranks = midRanksHogg([10, 20, 5, 30]);
  assert.deepEqual(ranks, [2, 3, 1, 4]);
});

test('midRanksHogg: ties get average rank', () => {
  const ranks = midRanksHogg([5, 5, 5, 10]);
  // ranks 1,2,3 average -> 2
  assert.deepEqual(ranks, [2, 2, 2, 4]);
});

// ---------- primitive: standardNormalUpperTailHogg ----------

test('standardNormalUpperTailHogg: Q(0) = 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailHogg(0) - 0.5) < 1e-6);
});

test('standardNormalUpperTailHogg: Q(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailHogg(1.96) - 0.025) < 1e-3);
});

test('standardNormalUpperTailHogg: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailHogg(Number.NaN), /finite/);
});

// ---------- primitive: standardNormalInverseHogg ----------

test('standardNormalInverseHogg: Phi^-1(0.5) ~ 0', () => {
  assert.ok(Math.abs(standardNormalInverseHogg(0.5)) < 1e-6);
});

test('standardNormalInverseHogg: Phi^-1(0.975) ~ 1.96', () => {
  assert.ok(Math.abs(standardNormalInverseHogg(0.975) - 1.959964) < 1e-4);
});

test('standardNormalInverseHogg: throws on out-of-range', () => {
  assert.throws(() => standardNormalInverseHogg(0), /must be in/);
  assert.throws(() => standardNormalInverseHogg(1), /must be in/);
});

// ---------- primitive: hoggSelectorQ ----------

test('hoggSelectorQ: symmetric data gives Q ~ 1', () => {
  // Symmetric arithmetic progression around 100.
  const xs: number[] = [];
  for (let i = -10; i < 10; i += 1) xs.push(100 + i);
  const q = hoggSelectorQ(xs);
  assert.ok(Math.abs(q - 1) < 0.05, `expected Q ~ 1, got ${q}`);
});

test('hoggSelectorQ: right-skew data gives Q > 1', () => {
  // Heavy upper tail.
  const xs: number[] = [];
  for (let i = 0; i < 18; i += 1) xs.push(i + 1);
  xs.push(1000);
  xs.push(2000);
  const q = hoggSelectorQ(xs);
  assert.ok(q > 1.5, `expected Q > 1.5, got ${q}`);
});

test('hoggSelectorQ: left-skew data gives Q < 1', () => {
  const xs: number[] = [];
  xs.push(-2000);
  xs.push(-1000);
  for (let i = 0; i < 18; i += 1) xs.push(i + 1);
  const q = hoggSelectorQ(xs);
  assert.ok(q < 0.7, `expected Q < 0.7, got ${q}`);
});

test('hoggSelectorQ: throws on n < 20', () => {
  assert.throws(() => hoggSelectorQ([1, 2, 3, 4, 5]), /at least 20/);
});

// ---------- primitive: hoggDispatchFromQ ----------

test('hoggDispatchFromQ: extreme low Q -> Mood', () => {
  assert.equal(hoggDispatchFromQ(0.3), 'HFR1-mood-median');
});

test('hoggDispatchFromQ: moderate low Q -> Wilcoxon', () => {
  assert.equal(hoggDispatchFromQ(0.6), 'HFR2-wilcoxon');
});

test('hoggDispatchFromQ: near-symmetric Q -> van der Waerden', () => {
  assert.equal(hoggDispatchFromQ(1.0), 'HFR3-vanderwaerden');
  assert.equal(hoggDispatchFromQ(0.8), 'HFR3-vanderwaerden');
  assert.equal(hoggDispatchFromQ(1.25), 'HFR3-vanderwaerden');
});

test('hoggDispatchFromQ: moderate high Q -> Wilcoxon', () => {
  assert.equal(hoggDispatchFromQ(1.5), 'HFR2-wilcoxon');
  assert.equal(hoggDispatchFromQ(2.0), 'HFR2-wilcoxon');
});

test('hoggDispatchFromQ: extreme high Q -> Mood', () => {
  assert.equal(hoggDispatchFromQ(3.0), 'HFR1-mood-median');
});

test('hoggDispatchFromQ: throws on non-positive / non-finite', () => {
  assert.throws(() => hoggDispatchFromQ(0), /positive finite/);
  assert.throws(() => hoggDispatchFromQ(-1), /positive finite/);
  assert.throws(() => hoggDispatchFromQ(Number.NaN), /positive finite/);
});

// ---------- dispatched: hoggMoodMedianZ ----------

test('hoggMoodMedianZ: B located strictly above A -> Z > 0', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [10, 11, 12, 13, 14];
  const z = hoggMoodMedianZ(a, b);
  assert.ok(z > 0, `expected Z > 0, got ${z}`);
});

test('hoggMoodMedianZ: B located strictly below A -> Z < 0', () => {
  const a = [10, 11, 12, 13, 14];
  const b = [1, 2, 3, 4, 5];
  const z = hoggMoodMedianZ(a, b);
  assert.ok(z < 0, `expected Z < 0, got ${z}`);
});

test('hoggMoodMedianZ: throws when n < 2 per side', () => {
  assert.throws(() => hoggMoodMedianZ([1], [2, 3]), /at least 2/);
});

// ---------- dispatched: hoggWilcoxonZ ----------

test('hoggWilcoxonZ: B above A -> Z > 0', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [10, 11, 12, 13, 14];
  const z = hoggWilcoxonZ(a, b);
  assert.ok(z > 0, `expected Z > 0, got ${z}`);
});

test('hoggWilcoxonZ: identical halves -> Z = 0', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [1, 2, 3, 4, 5];
  const z = hoggWilcoxonZ(a, b);
  assert.ok(Math.abs(z) < 1e-9, `expected Z ~ 0, got ${z}`);
});

// ---------- dispatched: hoggVanDerWaerdenZ ----------

test('hoggVanDerWaerdenZ: B above A -> Z > 0', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [10, 11, 12, 13, 14];
  const z = hoggVanDerWaerdenZ(a, b);
  assert.ok(z > 0, `expected Z > 0, got ${z}`);
});

test('hoggVanDerWaerdenZ: identical halves -> Z = 0', () => {
  const a = [1, 2, 3, 4, 5];
  const b = [1, 2, 3, 4, 5];
  const z = hoggVanDerWaerdenZ(a, b);
  assert.ok(Math.abs(z) < 1e-9, `expected Z ~ 0, got ${z}`);
});

// ---------- top-level: dailyTokenHoggAdaptiveHalves ----------

test('dailyTokenHoggAdaptiveHalves: throws on n < 20', () => {
  assert.throws(
    () => dailyTokenHoggAdaptiveHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]),
    /at least 20/,
  );
});

test('dailyTokenHoggAdaptiveHalves: throws on non-finite', () => {
  const xs = new Array(25).fill(0).map((_, i) => i + 1);
  xs[5] = Number.NaN;
  assert.throws(
    () => dailyTokenHoggAdaptiveHalves(xs),
    /finite/,
  );
});

test('dailyTokenHoggAdaptiveHalves: throws on constant series', () => {
  const xs = new Array(25).fill(7);
  assert.throws(
    () => dailyTokenHoggAdaptiveHalves(xs),
    /zero centred variance/,
  );
});

test('dailyTokenHoggAdaptiveHalves: deterministic given same input', () => {
  const xs: number[] = [];
  for (let i = 0; i < 30; i += 1) xs.push(Math.sin(i) + i / 10);
  const r1 = dailyTokenHoggAdaptiveHalves(xs);
  const r2 = dailyTokenHoggAdaptiveHalves(xs);
  assert.equal(r1.hoggZ, r2.hoggZ);
  assert.equal(r1.hoggQ, r2.hoggQ);
  assert.equal(r1.hoggDispatch, r2.hoggDispatch);
});

test('dailyTokenHoggAdaptiveHalves: monotone increasing has Z > 0', () => {
  const xs: number[] = [];
  for (let i = 0; i < 30; i += 1) xs.push(i + 1);
  const r = dailyTokenHoggAdaptiveHalves(xs);
  assert.ok(r.hoggZ > 0, `expected Z > 0, got ${r.hoggZ}`);
  // p-value should be small.
  assert.ok(r.hoggPValue < 0.01, `expected p < 0.01, got ${r.hoggPValue}`);
});

test('dailyTokenHoggAdaptiveHalves: monotone decreasing has Z < 0', () => {
  const xs: number[] = [];
  for (let i = 0; i < 30; i += 1) xs.push(30 - i);
  const r = dailyTokenHoggAdaptiveHalves(xs);
  assert.ok(r.hoggZ < 0, `expected Z < 0, got ${r.hoggZ}`);
});

test('dailyTokenHoggAdaptiveHalves: heavy-tail symmetric series dispatches reasonably', () => {
  // Symmetric heavy-tail mock.
  const xs: number[] = [];
  for (let i = 0; i < 28; i += 1) xs.push(50 + i % 5);
  xs.push(-1000);
  xs.push(2000);
  const r = dailyTokenHoggAdaptiveHalves(xs);
  // Should report a finite Z and a valid dispatch label.
  assert.ok(Number.isFinite(r.hoggZ));
  assert.ok(['HFR1-mood-median', 'HFR2-wilcoxon', 'HFR3-vanderwaerden'].includes(r.hoggDispatch));
  assert.ok(r.hoggQ > 0);
});

// ---------- aggregator ----------

test('aggregateHoggAdaptiveHalves: empty rows produce zero stoufferZ + 1 p-value', () => {
  const agg = aggregateHoggAdaptiveHalves([]);
  assert.equal(agg.stoufferZ, 0);
  assert.equal(agg.stoufferTwoSidedPValue, 1);
  assert.equal(agg.rowsUsed, 0);
});

test('aggregateHoggAdaptiveHalves: skips malformed rows', () => {
  const agg = aggregateHoggAdaptiveHalves([
    { hoggZ: Number.NaN, hoggPValue: 0.5, nTenureDays: 30, hoggDispatch: 'HFR2-wilcoxon' },
    { hoggZ: 1.5, hoggPValue: 0.5, nTenureDays: -1, hoggDispatch: 'HFR2-wilcoxon' },
    { hoggZ: 1.5, hoggPValue: 1.5, nTenureDays: 30, hoggDispatch: 'HFR2-wilcoxon' },
  ]);
  assert.equal(agg.rowsUsed, 0);
  assert.equal(agg.rowsSkipped, 3);
});

test('aggregateHoggAdaptiveHalves: stoufferZ aggregates two finite rows', () => {
  const agg = aggregateHoggAdaptiveHalves([
    { hoggZ: 1.0, hoggPValue: 0.32, nTenureDays: 30, hoggDispatch: 'HFR2-wilcoxon' },
    { hoggZ: 1.0, hoggPValue: 0.32, nTenureDays: 30, hoggDispatch: 'HFR3-vanderwaerden' },
  ]);
  assert.ok(Math.abs(agg.stoufferZ - Math.sqrt(2)) < 1e-9);
  assert.equal(agg.rowsUsed, 2);
  assert.equal(agg.dispatchCounts['HFR2-wilcoxon'], 1);
  assert.equal(agg.dispatchCounts['HFR3-vanderwaerden'], 1);
});

// ---------- end-to-end: buildDailyTokenHoggAdaptiveHalves ----------

test('buildDailyTokenHoggAdaptiveHalves: empty queue produces empty report', () => {
  const r = buildDailyTokenHoggAdaptiveHalves([]);
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHoggAdaptiveHalves: monotone-up source surfaces with Z > 0', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'srcA', 100 + i * 50));
  }
  const r = buildDailyTokenHoggAdaptiveHalves(queue, { minTenureDays: 20 });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'srcA');
  assert.ok(row.hoggZ > 0);
  assert.ok(row.hoggPValue < 0.05);
  // dispatch counts updated.
  const totalDispatches =
    r.dispatchCounts['HFR1-mood-median'] +
    r.dispatchCounts['HFR2-wilcoxon'] +
    r.dispatchCounts['HFR3-vanderwaerden'];
  assert.equal(totalDispatches, 1);
});

test('buildDailyTokenHoggAdaptiveHalves: drops tenures below minTenureDays', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'tooShort', 100 + i));
  }
  const r = buildDailyTokenHoggAdaptiveHalves(queue);
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHoggAdaptiveHalves: drops constant-series sources as zero-variance', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenHoggAdaptiveHalves(queue);
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenHoggAdaptiveHalves: source filter narrows', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 30; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 100 + i * 10));
    queue.push(ql(dayIso(i), 'drop', 200 + i * 5));
  }
  const r = buildDailyTokenHoggAdaptiveHalves(queue, { source: 'keep' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

test('buildDailyTokenHoggAdaptiveHalves: throws on bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenHoggAdaptiveHalves([], {
        sort: 'nonsense' as never,
      }),
    /sort must be one of/,
  );
});

test('buildDailyTokenHoggAdaptiveHalves: throws on minTenureDays < 20', () => {
  assert.throws(
    () => buildDailyTokenHoggAdaptiveHalves([], { minTenureDays: 10 }),
    />= 20/,
  );
});
