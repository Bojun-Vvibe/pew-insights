import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBrownForsythHalves,
  buildDailyTokenBrownForsythHalves,
} from '../src/dailytokenbrownforsythhalves.js';
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

test('dailyTokenBrownForsythHalves: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenBrownForsythHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('dailyTokenBrownForsythHalves: rejects non-finite values', () => {
  assert.throws(
    () => dailyTokenBrownForsythHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenBrownForsythHalves([1, Infinity, 3, 4, 5, 6, 7, 8]),
    /finite values/,
  );
  assert.throws(
    () => dailyTokenBrownForsythHalves([1, 2, 3, 4, 5, 6, 7, -Infinity]),
    /finite values/,
  );
});

test('dailyTokenBrownForsythHalves: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenBrownForsythHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: split sizes ----------

test('dailyTokenBrownForsythHalves: even n splits evenly', () => {
  const r = dailyTokenBrownForsythHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.bfN1, 4);
  assert.equal(r.bfN2, 4);
  assert.equal(r.nSamples, 8);
  assert.equal(r.bfDf, 6);
});

test('dailyTokenBrownForsythHalves: odd n puts middle into second half', () => {
  const r = dailyTokenBrownForsythHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.bfN1, 4);
  assert.equal(r.bfN2, 5);
  assert.equal(r.bfDf, 7);
});

// ---------- primitive: shift / scale / sign invariances ----------

test('dailyTokenBrownForsythHalves: shift-invariant (bfT, bfZ)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenBrownForsythHalves(x);
  const r2 = dailyTokenBrownForsythHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.bfT - r2.bfT) < 1e-9, `bfT shift drift ${r1.bfT} vs ${r2.bfT}`);
  assert.ok(Math.abs(r1.bfZ - r2.bfZ) < 1e-9);
  assert.ok(Math.abs(r1.bfTSigned - r2.bfTSigned) < 1e-9);
});

test('dailyTokenBrownForsythHalves: positive-scale-invariant (bfT, bfZ)', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenBrownForsythHalves(x);
  const r2 = dailyTokenBrownForsythHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.bfT - r2.bfT) < 1e-9, `bfT scale drift`);
  assert.ok(Math.abs(r1.bfZ - r2.bfZ) < 1e-9);
});

test('dailyTokenBrownForsythHalves: negation flips bfTSigned and bfZ sign', () => {
  const x = [1, 5, 2, 4, 9, 11, 3, 17];
  const r1 = dailyTokenBrownForsythHalves(x);
  const r2 = dailyTokenBrownForsythHalves(x.map((v) => -v));
  // Negation flips deviations identically per group, so madA, madB swap signs of comparisons but |.| invariant.
  // Actually |-x - median(-x)| == |x - median(x)|, so deviations identical, bfT identical, bfTSigned identical.
  assert.ok(Math.abs(r1.bfT - r2.bfT) < 1e-9);
  assert.ok(Math.abs(r1.bfTSigned - r2.bfTSigned) < 1e-9);
});

// ---------- primitive: closed-form anchors ----------

test('dailyTokenBrownForsythHalves: identical-spread halves give bfZ approx 0', () => {
  // First half: 0,2,1,3 -> med=1.5, devs=1.5,0.5,0.5,1.5, mean=1.0
  // Second half: 10,12,11,13 -> med=11.5, devs=1.5,0.5,0.5,1.5, mean=1.0
  // zBarA == zBarB exactly -> SSB = 0 -> bfT = 0.
  const r = dailyTokenBrownForsythHalves([0, 2, 1, 3, 10, 12, 11, 13]);
  assert.ok(r.bfT < 1e-12, `expected bfT~0 got ${r.bfT}`);
  assert.ok(Math.abs(r.bfZ) < 1e-12);
});

test('dailyTokenBrownForsythHalves: equal zBarA == zBarB gives bfTSigned exactly +0 (no -0 sign-bit)', () => {
  // Same input as above; zBarA === zBarB exactly so
  // sign === 0 and bfTSigned must be the +0 literal,
  // never -0 from a `0 * sqrt(...)` artefact.
  const r = dailyTokenBrownForsythHalves([0, 2, 1, 3, 10, 12, 11, 13]);
  assert.equal(r.bfTSigned, 0);
  // Object.is differentiates +0 from -0 -- pin +0.
  assert.ok(Object.is(r.bfTSigned, 0), `bfTSigned should be +0, got ${r.bfTSigned}`);
  assert.ok(Object.is(r.bfZ, 0), `bfZ should be +0, got ${r.bfZ}`);
});

test('dailyTokenBrownForsythHalves: second half wider gives bfZ > 0', () => {
  // First half tight: 4,5,5,6 -> med=5, devs=1,0,0,1 mean=0.5
  // Second half wide: 0,10,1,9 -> med=5, devs=5,5,4,4 mean=4.5
  const r = dailyTokenBrownForsythHalves([4, 5, 5, 6, 0, 10, 1, 9]);
  assert.ok(r.bfZ > 0, `expected bfZ > 0 got ${r.bfZ}`);
  assert.ok(r.bfT > 0);
  assert.ok(r.bfMadA < r.bfMadB, `${r.bfMadA} should be < ${r.bfMadB}`);
});

test('dailyTokenBrownForsythHalves: first half wider gives bfZ < 0', () => {
  // Mirror image.
  const r = dailyTokenBrownForsythHalves([0, 10, 1, 9, 4, 5, 5, 6]);
  assert.ok(r.bfZ < 0, `expected bfZ < 0 got ${r.bfZ}`);
  assert.ok(r.bfMadA > r.bfMadB);
});

test('dailyTokenBrownForsythHalves: bfT >= 0 always', () => {
  const inputs: number[][] = [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [8, 7, 6, 5, 4, 3, 2, 1],
    [1, 100, 2, 99, 3, 98, 4, 97],
    [0, 0, 0, 0, 1, 1, 1, 100],
  ];
  for (const x of inputs) {
    const r = dailyTokenBrownForsythHalves(x);
    assert.ok(r.bfT >= 0, `bfT < 0 for ${JSON.stringify(x)}: ${r.bfT}`);
    assert.ok(Number.isFinite(r.bfZ));
  }
});

test('dailyTokenBrownForsythHalves: bfDf == n - 2', () => {
  for (const n of [8, 10, 13, 17, 30]) {
    const x = Array.from({ length: n }, (_, i) => (i % 2) * (i + 1));
    const r = dailyTokenBrownForsythHalves(x);
    assert.equal(r.bfDf, n - 2);
  }
});

test('dailyTokenBrownForsythHalves: half-medians are correctly computed', () => {
  // n=8: A=[3,1,4,1] sorted [1,1,3,4] median = 2; B=[5,9,2,6] sorted [2,5,6,9] median = 5.5
  const r = dailyTokenBrownForsythHalves([3, 1, 4, 1, 5, 9, 2, 6]);
  assert.equal(r.bfMedianA, 2);
  assert.equal(r.bfMedianB, 5.5);
});

test('dailyTokenBrownForsythHalves: equal-n halves swap flips bfTSigned sign', () => {
  // Build a series where second half is wider -> bfTSigned > 0 originally.
  const orig = [4, 5, 5, 6, 0, 10, 1, 9];
  const swap = [0, 10, 1, 9, 4, 5, 5, 6];
  const r1 = dailyTokenBrownForsythHalves(orig);
  const r2 = dailyTokenBrownForsythHalves(swap);
  assert.ok(Math.abs(r1.bfT - r2.bfT) < 1e-9, `swap should preserve bfT`);
  assert.ok(Math.abs(r1.bfTSigned + r2.bfTSigned) < 1e-9, `swap should flip bfTSigned sign`);
  assert.ok(Math.abs(r1.bfZ + r2.bfZ) < 1e-9);
});

// ---------- builder: empty ----------

test('buildDailyTokenBrownForsythHalves: empty queue returns empty sources', () => {
  const r = buildDailyTokenBrownForsythHalves([], { generatedAt: '2026-05-03T00:00:00Z' });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('buildDailyTokenBrownForsythHalves: rejects bad minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenBrownForsythHalves([], { minTenureDays: 5 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('buildDailyTokenBrownForsythHalves: rejects bad sort', () => {
  assert.throws(
    () => buildDailyTokenBrownForsythHalves([], {
      sort: 'bogus' as never,
    }),
    /sort must be one of/,
  );
});

test('buildDailyTokenBrownForsythHalves: dropped counters work', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'src1', 100),
    ql(dayIso(0), 'src2', 0),
    ql(dayIso(0), 'src2', -50),
  ];
  const r = buildDailyTokenBrownForsythHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenBrownForsythHalves: end-to-end with one wide source', () => {
  const queue: QueueLine[] = [];
  // 16 days; first 8 mildly varying around 100, last 8 highly variable.
  for (let i = 0; i < 8; i += 1) {
    queue.push(ql(dayIso(i), 'src1', 100 + (i % 4)));
  }
  for (let i = 8; i < 16; i += 1) {
    // Wide values: 30, 220, 60, 200, 40, 230, 70, 210 -> high spread, varied
    queue.push(ql(dayIso(i), 'src1', i % 2 === 0 ? 30 + (i - 8) * 5 : 200 + (i - 9) * 7));
  }
  const r = buildDailyTokenBrownForsythHalves(queue, {
    minTokens: 100,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src1');
  assert.equal(row.bfN1, 8);
  assert.equal(row.bfN2, 8);
  assert.ok(row.bfMadA < row.bfMadB, `madA ${row.bfMadA} should be < madB ${row.bfMadB}`);
  assert.ok(row.bfZ > 0, `expected bfZ > 0 got ${row.bfZ}`);
});

test('buildDailyTokenBrownForsythHalves: source-filter restricts and counts', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src1', 100 + (i % 4) * 10));
    queue.push(ql(dayIso(i), 'src2', 100 + (i % 5) * 7));
  }
  const r = buildDailyTokenBrownForsythHalves(queue, {
    source: 'src1',
    minTokens: 10,
    minTenureDays: 14,
  });
  assert.equal(r.source, 'src1');
  assert.ok(r.droppedSourceFilter > 0);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src1');
});

test('buildDailyTokenBrownForsythHalves: sort by bfZAbsDesc puts strongest first', () => {
  const queue: QueueLine[] = [];
  // src-tight: small variation throughout -> small bfZ
  // src-grow: tight first half (small variation), wide second half -> large positive bfZ
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'src-tight', 100 + (i % 4) * 3));
    queue.push(
      ql(
        dayIso(i),
        'src-grow',
        i < 8
          ? 100 + (i % 3)
          : 100 + (i % 2 === 0 ? -80 : 80),
      ),
    );
  }
  const r = buildDailyTokenBrownForsythHalves(queue, {
    minTokens: 10,
    minTenureDays: 14,
    sort: 'bfZAbsDesc',
  });
  assert.ok(r.sources.length >= 2);
  assert.equal(r.sources[0]!.source, 'src-grow');
});

test('buildDailyTokenBrownForsythHalves: zero-variance source dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 100));
  }
  const r = buildDailyTokenBrownForsythHalves(queue, {
    minTokens: 10,
    minTenureDays: 14,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});
