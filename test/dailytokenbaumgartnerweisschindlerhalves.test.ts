import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBaumgartnerWeissSchindlerHalves,
  buildDailyTokenBaumgartnerWeissSchindlerHalves,
  midrankBws,
  bwsAsymptoticUpperTail,
  medianSortedBws,
  labelBwsHalvesRow,
} from '../src/dailytokenbaumgartnerweisschindlerhalves.js';
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

// ---------- midrankBws ----------

test('bws: midrankBws preserves rank-sum N(N+1)/2 with ties', () => {
  const r = midrankBws([1, 2, 2, 3, 3, 3, 4]);
  let sum = 0;
  for (const v of r) sum += v;
  const n = 7;
  assert.equal(sum, (n * (n + 1)) / 2);
});

test('bws: midrankBws averages tied positions', () => {
  const r = midrankBws([5, 5, 5, 5]);
  for (const v of r) assert.equal(v, 2.5);
});

test('bws: midrankBws strict ordering on distinct values', () => {
  const r = midrankBws([10, 30, 20, 40]);
  assert.deepEqual(r, [1, 3, 2, 4]);
});

// ---------- medianSortedBws ----------

test('bws: medianSortedBws odd length', () => {
  assert.equal(medianSortedBws([1, 2, 3, 4, 5]), 3);
});

test('bws: medianSortedBws even length averages middle two', () => {
  assert.equal(medianSortedBws([1, 2, 3, 4]), 2.5);
});

test('bws: medianSortedBws throws on empty', () => {
  assert.throws(() => medianSortedBws([]));
});

// ---------- bwsAsymptoticUpperTail ----------

test('bws: bwsAsymptoticUpperTail throws on non-finite', () => {
  assert.throws(() => bwsAsymptoticUpperTail(Number.NaN));
  assert.throws(() => bwsAsymptoticUpperTail(Number.POSITIVE_INFINITY));
});

test('bws: bwsAsymptoticUpperTail at b<=0 returns 1', () => {
  assert.equal(bwsAsymptoticUpperTail(0), 1);
  assert.equal(bwsAsymptoticUpperTail(-1), 1);
});

test('bws: bwsAsymptoticUpperTail monotone decreasing on b in [1, 30]', () => {
  let prev = bwsAsymptoticUpperTail(1);
  for (let b = 1.5; b <= 30; b += 0.5) {
    const cur = bwsAsymptoticUpperTail(b);
    assert.ok(cur <= prev + 1e-12, `non-monotone at b=${b}: ${cur} > ${prev}`);
    prev = cur;
  }
});

test('bws: bwsAsymptoticUpperTail produces valid probability', () => {
  for (let b = 0.5; b < 30; b += 0.5) {
    const p = bwsAsymptoticUpperTail(b);
    assert.ok(p >= 0 && p <= 1, `p out of [0,1] at b=${b}: ${p}`);
  }
});

test('bws: bwsAsymptoticUpperTail tail decays toward 0', () => {
  assert.ok(bwsAsymptoticUpperTail(20) < 1e-6);
  assert.ok(bwsAsymptoticUpperTail(30) < 1e-9);
});

// ---------- core: dailyTokenBaumgartnerWeissSchindlerHalves ----------

test('bws: throws below n=16', () => {
  assert.throws(() =>
    dailyTokenBaumgartnerWeissSchindlerHalves(
      Array.from({ length: 15 }, (_, i) => i + 1),
    ),
  );
});

test('bws: throws on non-finite', () => {
  const v = Array.from({ length: 16 }, (_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenBaumgartnerWeissSchindlerHalves(v));
});

test('bws: throws on zero variance', () => {
  const v = Array.from({ length: 16 }, () => 7);
  assert.throws(() => dailyTokenBaumgartnerWeissSchindlerHalves(v));
});

test('bws: bwsB is non-negative', () => {
  for (const seed of [1, 7, 13, 23, 99]) {
    let s = seed;
    const v = Array.from({ length: 24 }, () => {
      s = (s * 9301 + 49297) % 233280;
      return s;
    });
    const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
    assert.ok(r.bwsB >= 0, `bwsB negative for seed ${seed}: ${r.bwsB}`);
  }
});

test('bws: bwsB invariant under constant shift', () => {
  const v = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
  ];
  const r1 = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  const shifted = v.map((x) => x + 12345);
  const r2 = dailyTokenBaumgartnerWeissSchindlerHalves(shifted);
  assert.equal(r2.bwsB, r1.bwsB);
  assert.equal(r2.bwsSign, r1.bwsSign);
});

test('bws: bwsB invariant under positive scale', () => {
  const v = [
    10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 140, 150, 160,
  ];
  const r1 = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  const scaled = v.map((x) => x * 7.5);
  const r2 = dailyTokenBaumgartnerWeissSchindlerHalves(scaled);
  assert.equal(r2.bwsB, r1.bwsB);
});

test('bws: monotone increasing yields bwsSign=+1 and bwsB > 0', () => {
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  assert.equal(r.bwsSign, 1);
  assert.ok(r.bwsB > 0);
  assert.ok(r.bwsSignedB > 0);
});

test('bws: monotone decreasing yields bwsSign=-1 and bwsB > 0', () => {
  const v = Array.from({ length: 20 }, (_, i) => 100 - i);
  const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  assert.equal(r.bwsSign, -1);
  assert.ok(r.bwsB > 0);
  assert.ok(r.bwsSignedB < 0);
});

test('bws: bwsB symmetric on reverse when n1=n2', () => {
  const v = [
    3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4,
  ];
  const r1 = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  const r2 = dailyTokenBaumgartnerWeissSchindlerHalves([...v].reverse());
  assert.ok(
    Math.abs(r1.bwsB - r2.bwsB) < 1e-12,
    `bwsB not symmetric: ${r1.bwsB} vs ${r2.bwsB}`,
  );
});

test('bws: identical halves yield small bwsB', () => {
  // Two halves drawn from the same arithmetic progression
  // permuted should give a small bwsB.
  const half = [10, 20, 30, 40, 50, 60, 70, 80];
  const v = [...half, ...half.map((x) => x + 1)];
  const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  assert.ok(r.bwsB < 5, `bwsB too large for near-identical halves: ${r.bwsB}`);
});

test('bws: separated halves yield decisive bwsPValue', () => {
  // Strong location shift: A in [1..10], B in [1000..1010]
  const v = [
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1000, 1001, 1002, 1003, 1004, 1005, 1006,
    1007, 1008, 1009,
  ];
  const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  assert.ok(
    r.bwsPValue < 0.05,
    `expected decisive p-value, got ${r.bwsPValue}`,
  );
  assert.equal(r.bwsSign, 1);
});

test('bws: bwsPValue in [0, 1]', () => {
  for (const seed of [1, 2, 3, 5, 8, 13, 21, 34]) {
    let s = seed;
    const v = Array.from({ length: 30 }, () => {
      s = (s * 9301 + 49297) % 233280;
      return s + 1;
    });
    const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
    assert.ok(r.bwsPValue >= 0 && r.bwsPValue <= 1);
  }
});

test('bws: bwsBfromA and bwsBfromB both non-negative', () => {
  const v = Array.from({ length: 30 }, (_, i) => Math.sin(i) * 100 + 200);
  const r = dailyTokenBaumgartnerWeissSchindlerHalves(v);
  assert.ok(r.bwsBfromA >= 0);
  assert.ok(r.bwsBfromB >= 0);
  assert.ok(Math.abs(r.bwsB - (r.bwsBfromA + r.bwsBfromB) / 2) < 1e-12);
});

// ---------- builder ----------

test('bws: builder validates min-tenure-days hard floor 16', () => {
  assert.throws(() =>
    buildDailyTokenBaumgartnerWeissSchindlerHalves([], { minTenureDays: 15 }),
  );
  assert.throws(() =>
    buildDailyTokenBaumgartnerWeissSchindlerHalves([], { minTenureDays: 0 }),
  );
});

test('bws: builder validates min-tokens', () => {
  assert.throws(() =>
    buildDailyTokenBaumgartnerWeissSchindlerHalves([], { minTokens: -1 }),
  );
});

test('bws: builder validates top non-negative integer', () => {
  assert.throws(() =>
    buildDailyTokenBaumgartnerWeissSchindlerHalves([], { top: -1 }),
  );
});

test('bws: builder validates sort key', () => {
  assert.throws(() =>
    buildDailyTokenBaumgartnerWeissSchindlerHalves([], {
      sort: 'invalid' as never,
    }),
  );
});

test('bws: builder builds rows from synthetic queue', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 25; i += 1) {
    lines.push(ql(dayIso(i), 'src-a', 1000 + i * 50));
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines, {
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src-a');
  assert.equal(r.sources[0]!.bwsN1, 12);
  assert.equal(r.sources[0]!.bwsN2, 13);
  assert.ok(r.sources[0]!.bwsB > 0);
});

test('bws: builder drops below min-tokens', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'tiny', 10));
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines, {
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('bws: builder drops below min-tenure-days', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    lines.push(ql(dayIso(i), 'short', 10000));
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines, {
    minTenureDays: 16,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('bws: builder drops zero-variance sources', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'flat', 5000));
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('bws: builder honors source filter', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'a', 1000 + i * 50));
    lines.push(ql(dayIso(i), 'b', 1000 + i * 70));
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines, {
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('bws: builder respects top cap and reports remainder', () => {
  const lines: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 20; i += 1) {
      lines.push(ql(dayIso(i), src, 1000 + i * 50));
    }
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('bws: builder counts bad hour_start', () => {
  const lines: QueueLine[] = [ql('not-a-date', 'a', 100)];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'a', 1000 + i * 50));
  }
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('bws: builder counts non-positive tokens', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    lines.push(ql(dayIso(i), 'a', 1000 + i * 50));
  }
  lines.push(ql(dayIso(20), 'a', 0));
  lines.push(ql(dayIso(21), 'a', -5));
  const r = buildDailyTokenBaumgartnerWeissSchindlerHalves(lines);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

// ---------- labels ----------

test('bws: labelBwsHalvesRow second-decisive when sign>0 and p<alpha', () => {
  assert.equal(
    labelBwsHalvesRow({ bwsB: 5.0, bwsPValue: 0.01, bwsSign: 1 }),
    'second-decisively-stochastically-larger',
  );
});

test('bws: labelBwsHalvesRow first-decisive when sign<0 and p<alpha', () => {
  assert.equal(
    labelBwsHalvesRow({ bwsB: 5.0, bwsPValue: 0.01, bwsSign: -1 }),
    'first-decisively-stochastically-larger',
  );
});

test('bws: labelBwsHalvesRow undirected when sign=0 and decisive', () => {
  assert.equal(
    labelBwsHalvesRow({ bwsB: 5.0, bwsPValue: 0.01, bwsSign: 0 }),
    'undirected-decisive-bws-departure',
  );
});

test('bws: labelBwsHalvesRow leans when alpha<=p<2alpha', () => {
  assert.equal(
    labelBwsHalvesRow({ bwsB: 2.0, bwsPValue: 0.07, bwsSign: 1 }),
    'leans-bws-departure',
  );
});

test('bws: labelBwsHalvesRow no-evidence when p>=2alpha', () => {
  assert.equal(
    labelBwsHalvesRow({ bwsB: 0.5, bwsPValue: 0.5, bwsSign: 0 }),
    'no-evidence-of-bws-departure',
  );
});

test('bws: labelBwsHalvesRow validates inputs', () => {
  assert.throws(() =>
    labelBwsHalvesRow({ bwsB: -1, bwsPValue: 0.5, bwsSign: 0 }),
  );
  assert.throws(() =>
    labelBwsHalvesRow({ bwsB: 1, bwsPValue: 1.5, bwsSign: 0 }),
  );
  assert.throws(() =>
    labelBwsHalvesRow({ bwsB: 1, bwsPValue: 0.5, bwsSign: 2 as never }),
  );
  assert.throws(() =>
    labelBwsHalvesRow({ bwsB: 1, bwsPValue: 0.5, bwsSign: 0 }, 0),
  );
  assert.throws(() =>
    labelBwsHalvesRow({ bwsB: 1, bwsPValue: 0.5, bwsSign: 0 }, 0.6),
  );
});
