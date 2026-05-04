import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKlotzHalves,
  buildDailyTokenKlotzHalves,
  midRanksKlotz,
  medianKlotz,
  standardNormalUpperTailKlotz,
  inverseStandardNormalCdfKlotz,
} from '../src/dailytokenklotzhalves.js';
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

// ---------- primitive: midRanksKlotz ----------

test('midRanksKlotz: strictly increasing 1..n', () => {
  assert.deepEqual(midRanksKlotz([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midRanksKlotz: strictly decreasing n..1', () => {
  assert.deepEqual(midRanksKlotz([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midRanksKlotz: ties get average rank', () => {
  assert.deepEqual(midRanksKlotz([5, 5, 7, 5]), [2, 2, 4, 2]);
});

test('midRanksKlotz: pair tie at top', () => {
  assert.deepEqual(midRanksKlotz([1, 2, 9, 9]), [1, 2, 3.5, 3.5]);
});

// ---------- primitive: medianKlotz ----------

test('medianKlotz: odd-length picks middle', () => {
  assert.equal(medianKlotz([3, 1, 2]), 2);
});

test('medianKlotz: even-length averages two middle', () => {
  assert.equal(medianKlotz([1, 2, 3, 4]), 2.5);
});

test('medianKlotz: does not mutate input', () => {
  const a = [3, 1, 2];
  medianKlotz(a);
  assert.deepEqual(a, [3, 1, 2]);
});

test('medianKlotz: throws on empty', () => {
  assert.throws(() => medianKlotz([]), /empty/);
});

// ---------- primitive: standardNormalUpperTailKlotz ----------

test('standardNormalUpperTailKlotz: Q(0) = 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailKlotz(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailKlotz: Q(-z) + Q(z) = 1', () => {
  const z = 1.234;
  const sum = standardNormalUpperTailKlotz(z) + standardNormalUpperTailKlotz(-z);
  assert.ok(Math.abs(sum - 1) < 1e-7);
});

test('standardNormalUpperTailKlotz: Q(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailKlotz(1.96) - 0.025) < 1e-3);
});

test('standardNormalUpperTailKlotz: rejects non-finite', () => {
  assert.throws(
    () => standardNormalUpperTailKlotz(Number.NaN),
    /finite/,
  );
});

// ---------- primitive: inverseStandardNormalCdfKlotz ----------

test('inverseStandardNormalCdfKlotz: Phi^{-1}(0.5) = 0', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfKlotz(0.5)) < 1e-9);
});

test('inverseStandardNormalCdfKlotz: Phi^{-1}(0.975) ~ 1.96', () => {
  assert.ok(Math.abs(inverseStandardNormalCdfKlotz(0.975) - 1.96) < 1e-3);
});

test('inverseStandardNormalCdfKlotz: symmetric Phi^{-1}(p) = -Phi^{-1}(1-p)', () => {
  const p = 0.137;
  const a = inverseStandardNormalCdfKlotz(p);
  const b = inverseStandardNormalCdfKlotz(1 - p);
  assert.ok(Math.abs(a + b) < 1e-7);
});

test('inverseStandardNormalCdfKlotz: rejects out-of-bound p', () => {
  assert.throws(() => inverseStandardNormalCdfKlotz(0), /\(0,1\)/);
  assert.throws(() => inverseStandardNormalCdfKlotz(1), /\(0,1\)/);
  assert.throws(() => inverseStandardNormalCdfKlotz(-0.1), /\(0,1\)/);
});

// ---------- core: dailyTokenKlotzHalves ----------

test('dailyTokenKlotzHalves: throws on n < 16', () => {
  assert.throws(
    () => dailyTokenKlotzHalves(new Array(15).fill(0).map((_, i) => i + 1)),
    /at least 16/,
  );
});

test('dailyTokenKlotzHalves: throws on constant series', () => {
  assert.throws(
    () => dailyTokenKlotzHalves(new Array(20).fill(7)),
    /zero centred variance/,
  );
});

test('dailyTokenKlotzHalves: throws on non-finite values', () => {
  const v = new Array(20).fill(0).map((_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenKlotzHalves(v), /finite/);
});

test('dailyTokenKlotzHalves: shift-invariant (klotzZ unchanged by +c)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const y = x.map((v) => v + 1000);
  const rx = dailyTokenKlotzHalves(x);
  const ry = dailyTokenKlotzHalves(y);
  assert.ok(Math.abs(rx.klotzZ - ry.klotzZ) < 1e-10);
});

test('dailyTokenKlotzHalves: positive-scale invariant (klotzZ unchanged by *a)', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  ];
  const y = x.map((v) => v * 7.5);
  const rx = dailyTokenKlotzHalves(x);
  const ry = dailyTokenKlotzHalves(y);
  assert.ok(Math.abs(rx.klotzZ - ry.klotzZ) < 1e-10);
});

test('dailyTokenKlotzHalves: sign convention — second half MORE dispersed gives klotzZ > 0', () => {
  // First half tightly around 0; second half wide.
  const a = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const b = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const r = dailyTokenKlotzHalves([...a, ...b]);
  assert.ok(r.klotzZ > 0);
  assert.ok(r.klotzPValue < 0.1);
});

test('dailyTokenKlotzHalves: sign convention — first half MORE dispersed gives klotzZ < 0', () => {
  const a = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const b = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const r = dailyTokenKlotzHalves([...a, ...b]);
  assert.ok(r.klotzZ < 0);
});

test('dailyTokenKlotzHalves: equal halves gives klotzZ near 0', () => {
  // Symmetric series around 0 with equal dispersion in halves.
  const x = [
    -3, -2, -1, 0, 1, 2, 3, 0, // first half
    -3, -2, -1, 0, 1, 2, 3, 0, // second half (same)
  ];
  const r = dailyTokenKlotzHalves(x);
  assert.ok(Math.abs(r.klotzZ) < 0.5);
  assert.ok(r.klotzPValue > 0.3);
});

test('dailyTokenKlotzHalves: returns expected fields with correct shapes', () => {
  const x = Array.from({ length: 20 }, (_, i) => Math.sin(i) + i * 0.1);
  const r = dailyTokenKlotzHalves(x);
  assert.equal(r.nSamples, 20);
  assert.equal(r.klotzN1, 10);
  assert.equal(r.klotzN2, 10);
  assert.ok(Number.isFinite(r.klotzZ));
  assert.ok(Number.isFinite(r.klotzK));
  assert.ok(Math.abs(r.klotzExpK - r.klotzN2 * r.klotzAbar) < 1e-10);
  assert.ok(r.klotzVarK > 0);
  assert.ok(r.klotzPValue >= 0 && r.klotzPValue <= 1);
});

test('dailyTokenKlotzHalves: uneven n splits as floor(n/2) | n - floor(n/2)', () => {
  const x = Array.from({ length: 17 }, (_, i) => i + 1);
  const r = dailyTokenKlotzHalves(x);
  assert.equal(r.klotzN1, 8);
  assert.equal(r.klotzN2, 9);
});

// ---------- core: buildDailyTokenKlotzHalves ----------

test('buildDailyTokenKlotzHalves: empty queue -> empty sources', () => {
  const r = buildDailyTokenKlotzHalves([], { generatedAt: '2026-05-04T00:00:00Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenKlotzHalves: filters sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 1)); // total 20 < default 1000
    queue.push(ql(dayIso(i), 'rich', 5000 + i * 100));
  }
  const r = buildDailyTokenKlotzHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'rich');
});

test('buildDailyTokenKlotzHalves: filters below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenKlotzHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenKlotzHalves: rejects min-tenure-days < 16', () => {
  assert.throws(
    () =>
      buildDailyTokenKlotzHalves([], {
        minTenureDays: 8,
        generatedAt: '2026-05-04T00:00:00Z',
      }),
    />= 16/,
  );
});

test('buildDailyTokenKlotzHalves: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenKlotzHalves([], {
        sort: 'banana' as never,
        generatedAt: '2026-05-04T00:00:00Z',
      }),
    /sort must be/,
  );
});

test('buildDailyTokenKlotzHalves: top truncates with droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    const seed = src.charCodeAt(0);
    for (let i = 0; i < 20; i += 1) {
      // Ensure each source has a non-degenerate, varying daily series.
      const v = 5000 + ((i * 137 + seed * 53) % 4000) + i * 11;
      queue.push(ql(dayIso(i), src, v));
    }
  }
  const r = buildDailyTokenKlotzHalves(queue, {
    top: 2,
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenKlotzHalves: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 5000 + i * 13));
    queue.push(ql(dayIso(i), 'skip', 7000));
  }
  const r = buildDailyTokenKlotzHalves(queue, {
    source: 'keep',
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});
