import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMielkeQuarticHalves,
  buildDailyTokenMielkeQuarticHalves,
  midRanksMielke,
  medianMielke,
  standardNormalUpperTailMielke,
  aggregateMielkeQuarticHalves,
} from '../src/dailytokenmielkequartichalves.js';
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

// ---------- primitive: midRanksMielke ----------

test('midRanksMielke: strictly increasing 1..n', () => {
  assert.deepEqual(midRanksMielke([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midRanksMielke: strictly decreasing n..1', () => {
  assert.deepEqual(midRanksMielke([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midRanksMielke: ties get average rank', () => {
  assert.deepEqual(midRanksMielke([5, 5, 7, 5]), [2, 2, 4, 2]);
});

test('midRanksMielke: pair tie at top', () => {
  assert.deepEqual(midRanksMielke([1, 2, 9, 9]), [1, 2, 3.5, 3.5]);
});

// ---------- primitive: medianMielke ----------

test('medianMielke: odd-length picks middle', () => {
  assert.equal(medianMielke([3, 1, 2]), 2);
});

test('medianMielke: even-length averages middle two', () => {
  assert.equal(medianMielke([4, 1, 2, 3]), 2.5);
});

test('medianMielke: throws on empty', () => {
  assert.throws(() => medianMielke([]), /empty/);
});

// ---------- primitive: standardNormalUpperTailMielke ----------

test('standardNormalUpperTailMielke: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailMielke(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailMielke: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailMielke(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-4, `got ${q}`);
});

test('standardNormalUpperTailMielke: Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  assert.ok(
    Math.abs(
      standardNormalUpperTailMielke(z) +
        standardNormalUpperTailMielke(-z) -
        1,
    ) < 1e-7,
  );
});

test('standardNormalUpperTailMielke: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailMielke(Number.NaN));
});

// ---------- core: dailyTokenMielkeQuarticHalves ----------

test('dailyTokenMielkeQuarticHalves: throws on n < 16', () => {
  assert.throws(
    () =>
      dailyTokenMielkeQuarticHalves(
        new Array(15).fill(0).map((_, i) => i + 1),
      ),
    /at least 16/,
  );
});

test('dailyTokenMielkeQuarticHalves: throws on constant series', () => {
  assert.throws(
    () => dailyTokenMielkeQuarticHalves(new Array(20).fill(7)),
    /zero centred variance/,
  );
});

test('dailyTokenMielkeQuarticHalves: throws on non-finite values', () => {
  const v = new Array(20).fill(0).map((_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenMielkeQuarticHalves(v), /finite/);
});

test('dailyTokenMielkeQuarticHalves: shift-invariant (mielkeZ unchanged by +c)', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  ];
  const y = x.map((v) => v + 1000);
  const rx = dailyTokenMielkeQuarticHalves(x);
  const ry = dailyTokenMielkeQuarticHalves(y);
  assert.ok(Math.abs(rx.mielkeZ - ry.mielkeZ) < 1e-10);
});

test('dailyTokenMielkeQuarticHalves: positive-scale invariant (mielkeZ unchanged by *a)', () => {
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18,
  ];
  const y = x.map((v) => v * 7.5);
  const rx = dailyTokenMielkeQuarticHalves(x);
  const ry = dailyTokenMielkeQuarticHalves(y);
  assert.ok(Math.abs(rx.mielkeZ - ry.mielkeZ) < 1e-10);
});

test('dailyTokenMielkeQuarticHalves: sign convention - second half MORE dispersed gives mielkeZ > 0', () => {
  const a = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const b = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const r = dailyTokenMielkeQuarticHalves([...a, ...b]);
  assert.ok(r.mielkeZ > 0, `mielkeZ=${r.mielkeZ}`);
});

test('dailyTokenMielkeQuarticHalves: sign convention - first half MORE dispersed gives mielkeZ < 0', () => {
  const a = [-100, -50, 0, 50, 100, -80, 80, -120, 120];
  const b = [-1, 0, 1, -1, 0, 1, -1, 0, 1];
  const r = dailyTokenMielkeQuarticHalves([...a, ...b]);
  assert.ok(r.mielkeZ < 0, `mielkeZ=${r.mielkeZ}`);
});

test('dailyTokenMielkeQuarticHalves: equal halves gives mielkeZ near 0', () => {
  const x = [
    -3, -2, -1, 0, 1, 2, 3, 0, // first half
    -3, -2, -1, 0, 1, 2, 3, 0, // second half (same)
  ];
  const r = dailyTokenMielkeQuarticHalves(x);
  assert.ok(Math.abs(r.mielkeZ) < 0.5, `mielkeZ=${r.mielkeZ}`);
  assert.ok(r.mielkePValue > 0.3);
});

test('dailyTokenMielkeQuarticHalves: returns expected fields with correct shapes', () => {
  const x = Array.from({ length: 20 }, (_, i) => Math.sin(i) + i * 0.1);
  const r = dailyTokenMielkeQuarticHalves(x);
  assert.equal(r.nSamples, 20);
  assert.equal(r.mielkeN1, 10);
  assert.equal(r.mielkeN2, 10);
  assert.ok(Number.isFinite(r.mielkeZ));
  assert.ok(Number.isFinite(r.mielkeM));
  assert.ok(Math.abs(r.mielkeExpM - r.mielkeN2 * r.mielkeAbar) < 1e-9);
  assert.ok(r.mielkeVarM > 0);
  assert.ok(r.mielkePValue >= 0 && r.mielkePValue <= 1);
});

test('dailyTokenMielkeQuarticHalves: uneven n splits as floor(n/2) | n - floor(n/2)', () => {
  const x = Array.from({ length: 17 }, (_, i) => i + 1);
  const r = dailyTokenMielkeQuarticHalves(x);
  assert.equal(r.mielkeN1, 8);
  assert.equal(r.mielkeN2, 9);
});

test('dailyTokenMielkeQuarticHalves: reversed halves negate mielkeZ when n1=n2 and no ties', () => {
  // Use values designed to avoid ties after median-alignment.
  // First half: tight; second half: wide. Reversal should flip sign.
  const a = [10, 11, 12, 13, 14, 15, 16, 17];
  const b = [-50, -30, -10, 100, 200, -200, 300, 400];
  const x = [...a, ...b];
  const y = [...b, ...a];
  const rx = dailyTokenMielkeQuarticHalves(x);
  const ry = dailyTokenMielkeQuarticHalves(y);
  assert.ok(
    Math.abs(rx.mielkeZ + ry.mielkeZ) < 1e-9,
    `rx.Z=${rx.mielkeZ} ry.Z=${ry.mielkeZ}`,
  );
});

test('dailyTokenMielkeQuarticHalves: quartic weight DOMINATED by extreme ranks (sanity check)', () => {
  // The score a(R) = (R - (n+1)/2)^4 must give the
  // top/bottom ranks the largest contribution. For
  // n = 20 the extreme score is 9.5^4 = 8145, vs the
  // median-rank score 0.5^4 = 0.0625 — a ratio of ~130000x.
  // We test that mielkeAbar <= max-score / 2 (i.e. mass
  // concentrated at extremes, mean is way below the max).
  const x = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenMielkeQuarticHalves(x);
  const maxScore = ((20 - 1) / 2) ** 4; // = 9.5^4 = 8145.0625
  assert.ok(r.mielkeAbar < maxScore / 2, `abar=${r.mielkeAbar} max=${maxScore}`);
});

// ---------- core: buildDailyTokenMielkeQuarticHalves ----------

test('buildDailyTokenMielkeQuarticHalves: empty queue -> empty sources', () => {
  const r = buildDailyTokenMielkeQuarticHalves([], {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenMielkeQuarticHalves: filters sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'sparse', 1));
    queue.push(ql(dayIso(i), 'rich', 5000 + i * 100));
  }
  const r = buildDailyTokenMielkeQuarticHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'rich');
});

test('buildDailyTokenMielkeQuarticHalves: filters below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenMielkeQuarticHalves(queue, {
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMielkeQuarticHalves: rejects min-tenure-days < 16', () => {
  assert.throws(
    () =>
      buildDailyTokenMielkeQuarticHalves([], {
        minTenureDays: 8,
        generatedAt: '2026-05-04T00:00:00Z',
      }),
    />= 16/,
  );
});

test('buildDailyTokenMielkeQuarticHalves: rejects unknown sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenMielkeQuarticHalves([], {
        sort: 'banana' as never,
        generatedAt: '2026-05-04T00:00:00Z',
      }),
    /sort must be/,
  );
});

test('buildDailyTokenMielkeQuarticHalves: source filter restricts and counts dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 5000 + i * 13));
    queue.push(ql(dayIso(i), 'skip', 7000));
  }
  const r = buildDailyTokenMielkeQuarticHalves(queue, {
    source: 'keep',
    generatedAt: '2026-05-04T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.ok(r.droppedSourceFilter > 0);
});

// ---------- aggregator ----------

test('aggregateMielkeQuarticHalves: empty input -> rowsUsed 0', () => {
  const r = aggregateMielkeQuarticHalves([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.stoufferTwoSidedPValue, 1);
});

test('aggregateMielkeQuarticHalves: skips malformed rows', () => {
  const r = aggregateMielkeQuarticHalves([
    {
      mielkeZ: Number.NaN,
      mielkePValue: 0.1,
      mielkeVarM: 1,
      nTenureDays: 20,
    },
    { mielkeZ: 1, mielkePValue: 0, mielkeVarM: 1, nTenureDays: 20 },
    { mielkeZ: 1, mielkePValue: 0.5, mielkeVarM: 0, nTenureDays: 20 },
    { mielkeZ: 1, mielkePValue: 0.5, mielkeVarM: 1, nTenureDays: 0 },
  ]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.rowsSkipped, 4);
});

test('aggregateMielkeQuarticHalves: signed cancellation - equal +z and -z give stoufferZ ~ 0', () => {
  const r = aggregateMielkeQuarticHalves([
    { mielkeZ: 2.0, mielkePValue: 0.0455, mielkeVarM: 1, nTenureDays: 20 },
    { mielkeZ: -2.0, mielkePValue: 0.0455, mielkeVarM: 1, nTenureDays: 20 },
  ]);
  assert.equal(r.rowsUsed, 2);
  assert.ok(Math.abs(r.stoufferZ) < 1e-10);
});

test('aggregateMielkeQuarticHalves: same-sign reinforcement - sqrt(m) scaling', () => {
  const r = aggregateMielkeQuarticHalves(
    Array.from({ length: 4 }, () => ({
      mielkeZ: 2.0,
      mielkePValue: 0.0455,
      mielkeVarM: 1,
      nTenureDays: 20,
    })),
  );
  assert.equal(r.rowsUsed, 4);
  assert.ok(Math.abs(r.stoufferZ - 4.0) < 1e-9);
  assert.ok(r.stoufferTwoSidedPValue < 1e-4);
});

test('aggregateMielkeQuarticHalves: tenure weighting differs from unweighted mean', () => {
  const r = aggregateMielkeQuarticHalves([
    { mielkeZ: 5, mielkePValue: 1e-6, mielkeVarM: 1, nTenureDays: 1000 },
    { mielkeZ: -1, mielkePValue: 0.317, mielkeVarM: 1, nTenureDays: 20 },
    { mielkeZ: -1, mielkePValue: 0.317, mielkeVarM: 1, nTenureDays: 20 },
  ]);
  assert.ok(Math.abs(r.meanMielkeZ - 1.0) < 1e-9);
  assert.ok(r.tenureWeightedMeanMielkeZ > 4.5);
});
