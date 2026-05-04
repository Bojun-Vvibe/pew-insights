import test from 'node:test';
import assert from 'node:assert/strict';
import {
  fisherGPValue,
  fisherGStatistic,
  dailyTokenFisherGPeriodicity,
  buildDailyTokenFisherGPeriodicity,
} from '../src/dailytokenfishergperiodicity.js';
import type { QueueLine } from '../src/types.js';

const ISO = '2026-05-04T00:00:00.000Z';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    hour_start,
    source,
    total_tokens,
  } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- fisherGPValue closed-form ----------

test('fisherGPValue: g <= 1/K -> p = 1', () => {
  assert.equal(fisherGPValue(0.0, 10), 1);
  assert.equal(fisherGPValue(0.05, 10), 1);
  assert.equal(fisherGPValue(0.1, 10), 1); // exactly 1/K
});

test('fisherGPValue: g >= 1 -> p = 0', () => {
  assert.equal(fisherGPValue(1, 10), 0);
  assert.equal(fisherGPValue(1.5, 10), 0);
});

test('fisherGPValue: K=2, g in (1/2, 1) -> p = 2*(1-g)', () => {
  // m = floor(1/g) = 1; sum reduces to C(2,1) * (1-g)^{1} = 2*(1-g)
  for (const g of [0.55, 0.6, 0.7, 0.8, 0.95]) {
    const expected = 2 * (1 - g);
    assert.ok(Math.abs(fisherGPValue(g, 2) - expected) < 1e-12, `g=${g}`);
  }
});

test('fisherGPValue: K=4, g=0.5 -> matches 4*(0.5)^3 - C(4,2)*(0)^3 = 0.5', () => {
  // m = floor(1/0.5) = 2; second term has (1 - 2*0.5)^{K-1} = 0
  // so reduces to C(4,1)*(1 - 0.5)^3 = 4 * 0.125 = 0.5
  assert.ok(Math.abs(fisherGPValue(0.5, 4) - 0.5) < 1e-12);
});

test('fisherGPValue: K=10, g=0.5 -> 10*(0.5)^9 (single term, m=2 has (0)^9=0)', () => {
  const expected = 10 * Math.pow(0.5, 9);
  assert.ok(Math.abs(fisherGPValue(0.5, 10) - expected) < 1e-12);
});

test('fisherGPValue: monotone non-increasing in g for fixed K', () => {
  const K = 12;
  let prev = Infinity;
  for (let g = 1 / K + 1e-6; g < 1; g += 0.05) {
    const p = fisherGPValue(g, K);
    assert.ok(p <= prev + 1e-9, `non-monotone at g=${g}: ${p} > ${prev}`);
    prev = p;
  }
});

test('fisherGPValue: result in [0, 1]', () => {
  for (const K of [3, 5, 10, 50, 200]) {
    for (let g = 1 / K + 1e-6; g < 1; g += 0.07) {
      const p = fisherGPValue(g, K);
      assert.ok(p >= 0 && p <= 1, `K=${K} g=${g} -> p=${p} out of [0,1]`);
    }
  }
});

test('fisherGPValue: invalid args throw', () => {
  assert.throws(() => fisherGPValue(NaN, 10), /non-finite/);
  assert.throws(() => fisherGPValue(0.5, 1), /K must be integer >= 2/);
  assert.throws(() => fisherGPValue(0.5, 2.5), /integer/);
});

// ---------- fisherGStatistic primitive ----------

test('fisherGStatistic: too few bins -> throws', () => {
  assert.throws(() => fisherGStatistic([]), /too few bins/);
  assert.throws(() => fisherGStatistic([1]), /too few bins/);
});

test('fisherGStatistic: non-finite power -> throws', () => {
  assert.throws(() => fisherGStatistic([1, NaN]), /non-finite power/);
  assert.throws(() => fisherGStatistic([1, Infinity]), /non-finite power/);
});

test('fisherGStatistic: negative power -> throws', () => {
  assert.throws(() => fisherGStatistic([1, -1]), /negative power/);
});

test('fisherGStatistic: all-zero spectrum -> throws', () => {
  assert.throws(
    () => fisherGStatistic([0, 0, 0, 0]),
    /non-positive total power/,
  );
});

test('fisherGStatistic: uniform PSD -> gStat = 1/K (lower bound), gPValue = 1', () => {
  const r = fisherGStatistic([5, 5, 5, 5, 5]);
  assert.equal(r.peakBin, 1); // smallest-k tie
  assert.ok(Math.abs(r.gStat - 0.2) < 1e-12);
  assert.equal(r.gPValue, 1);
});

test('fisherGStatistic: single-bin spike -> gStat = 1, gPValue = 0', () => {
  const r = fisherGStatistic([0, 0, 0, 1]);
  assert.equal(r.peakBin, 4);
  assert.equal(r.gStat, 1);
  assert.equal(r.gPValue, 0);
  assert.ok(r.gNeg2LogP > 1000); // -2*log(1e-300) ~ 1381
});

test('fisherGStatistic: scale-invariance of gStat and gPValue', () => {
  const power = [1, 3, 2, 5, 4];
  const r1 = fisherGStatistic(power);
  const r2 = fisherGStatistic(power.map((p) => p * 1e6));
  assert.ok(Math.abs(r1.gStat - r2.gStat) < 1e-12);
  assert.ok(Math.abs(r1.gPValue - r2.gPValue) < 1e-12);
});

test('fisherGStatistic: bin-permutation invariance of gStat / gPValue', () => {
  const a = fisherGStatistic([3, 1, 4, 1, 5, 9, 2, 6]);
  const b = fisherGStatistic([9, 6, 5, 4, 3, 2, 1, 1]); // permutation
  assert.ok(Math.abs(a.gStat - b.gStat) < 1e-12);
  assert.ok(Math.abs(a.gPValue - b.gPValue) < 1e-12);
});

test('fisherGStatistic: bin-reversal invariance of gStat / gPValue', () => {
  const power = [1, 2, 3, 4, 5, 6];
  const a = fisherGStatistic(power);
  const b = fisherGStatistic([...power].reverse());
  assert.ok(Math.abs(a.gStat - b.gStat) < 1e-12);
  assert.ok(Math.abs(a.gPValue - b.gPValue) < 1e-12);
});

test('fisherGStatistic: gNeg2LogP = -2 log(gPValue + eps)', () => {
  const r = fisherGStatistic([1, 1, 1, 1, 5]);
  const expected = -2 * Math.log(r.gPValue + 1e-300);
  assert.ok(Math.abs(r.gNeg2LogP - expected) < 1e-9);
});

test('fisherGStatistic: peakBin smallest-k tie-break', () => {
  const r = fisherGStatistic([5, 5, 1, 1]);
  assert.equal(r.peakBin, 1);
});

// ---------- dailyTokenFisherGPeriodicity ----------

test('dailyTokenFisherGPeriodicity: too short -> throws', () => {
  assert.throws(
    () => dailyTokenFisherGPeriodicity([1, 2, 3, 4, 5, 6, 7]),
    /too short/,
  );
});

test('dailyTokenFisherGPeriodicity: non-finite -> throws', () => {
  assert.throws(
    () => dailyTokenFisherGPeriodicity([1, 2, 3, 4, 5, 6, 7, NaN]),
    /finite/,
  );
});

test('dailyTokenFisherGPeriodicity: zero variance -> throws', () => {
  assert.throws(
    () => dailyTokenFisherGPeriodicity([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero variance/,
  );
});

test('dailyTokenFisherGPeriodicity: pure sinusoid -> very low gPValue', () => {
  const n = 64;
  const period = 8; // f = 1/8 = bin k=8
  const v: number[] = [];
  for (let i = 0; i < n; i += 1) {
    v.push(100 + 50 * Math.sin((2 * Math.PI * i) / period));
  }
  const r = dailyTokenFisherGPeriodicity(v);
  assert.ok(r.gStat > 0.5, `expected gStat > 0.5 for clean sinusoid, got ${r.gStat}`);
  assert.ok(r.gPValue < 0.001, `expected gPValue < 0.001, got ${r.gPValue}`);
  assert.ok(r.gNeg2LogP > 10, `expected gNeg2LogP > 10, got ${r.gNeg2LogP}`);
});

test('dailyTokenFisherGPeriodicity: linear ramp (no periodicity) -> low gStat', () => {
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) v.push(i + 1);
  const r = dailyTokenFisherGPeriodicity(v);
  // linear ramp concentrates power at low bins but spread out
  assert.ok(r.gStat < 1, 'gStat should be < 1');
  assert.ok(r.gStat > 1 / r.nFreqBins, 'gStat above lower bound');
  assert.ok(r.gPValue >= 0 && r.gPValue <= 1);
});

test('dailyTokenFisherGPeriodicity: gStat invariant to global rescaling', () => {
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    v.push(100 + 30 * Math.sin((2 * Math.PI * i) / 4));
  }
  const a = dailyTokenFisherGPeriodicity(v);
  const b = dailyTokenFisherGPeriodicity(v.map((x) => x * 1000));
  assert.ok(Math.abs(a.gStat - b.gStat) < 1e-10);
  assert.ok(Math.abs(a.gPValue - b.gPValue) < 1e-10);
});

test('dailyTokenFisherGPeriodicity: gStat invariant to mean shift', () => {
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) {
    v.push(50 + 20 * Math.sin((2 * Math.PI * i) / 4));
  }
  const a = dailyTokenFisherGPeriodicity(v);
  const b = dailyTokenFisherGPeriodicity(v.map((x) => x + 1e6));
  assert.ok(Math.abs(a.gStat - b.gStat) < 1e-9);
});

test('dailyTokenFisherGPeriodicity: time-reversal invariant', () => {
  const v: number[] = [];
  for (let i = 0; i < 32; i += 1) v.push(Math.exp(i / 8) + (i % 3));
  const a = dailyTokenFisherGPeriodicity(v);
  const b = dailyTokenFisherGPeriodicity([...v].reverse());
  assert.ok(Math.abs(a.gStat - b.gStat) < 1e-9);
  assert.ok(Math.abs(a.gPValue - b.gPValue) < 1e-9);
});

// ---------- buildDailyTokenFisherGPeriodicity ----------

test('build: invalid options throw', () => {
  assert.throws(
    () => buildDailyTokenFisherGPeriodicity([], { minTokens: -1 }),
    /minTokens/,
  );
  assert.throws(
    () => buildDailyTokenFisherGPeriodicity([], { minTenureDays: 4 }),
    /minTenureDays/,
  );
  assert.throws(
    () => buildDailyTokenFisherGPeriodicity([], { top: -1 }),
    /top/,
  );
  assert.throws(
    () =>
      buildDailyTokenFisherGPeriodicity([], {
        sort: 'bogus' as 'gStat',
      }),
    /sort/,
  );
});

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenFisherGPeriodicity([], {
    generatedAt: ISO,
    minTenureDays: 8,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: invalid hour_start counted', () => {
  const r = buildDailyTokenFisherGPeriodicity(
    [ql('not-an-iso', 'a', 100)],
    { generatedAt: ISO, minTenureDays: 8 },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: source filter excludes others', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'keep', 1000 + i));
    queue.push(ql(dayIso(i), 'drop', 1000));
  }
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    source: 'keep',
    minTenureDays: 8,
  });
  assert.equal(r.droppedSourceFilter, 16);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
});

test('build: short tenure dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    minTenureDays: 8,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: zero variance dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    minTenureDays: 8,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('build: sort by gPValue ascending (default)', () => {
  const queue: QueueLine[] = [];
  // sinusoidal source -> low p
  for (let i = 0; i < 32; i += 1) {
    queue.push(
      ql(dayIso(i), 'sinus', Math.round(100 + 50 * Math.sin((2 * Math.PI * i) / 4))),
    );
  }
  // noisy source -> high p
  for (let i = 0; i < 32; i += 1) {
    queue.push(ql(dayIso(i), 'noisy', 50 + ((i * 13) % 17)));
  }
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.gPValue <= r.sources[1]!.gPValue);
  assert.equal(r.sources[0]!.source, 'sinus');
});

test('build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 16; i += 1) {
      queue.push(
        ql(dayIso(i), src, Math.round(100 + 30 * Math.sin((2 * Math.PI * i) / 4))),
      );
    }
  }
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    minTenureDays: 8,
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('build: sparse source dropped by min-tokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) queue.push(ql(dayIso(i), 'tiny', 1));
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    minTenureDays: 8,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
});

test('build: report fields populated', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    queue.push(
      ql(dayIso(i), 's1', Math.round(100 + 40 * Math.sin((2 * Math.PI * i) / 4))),
    );
  }
  const r = buildDailyTokenFisherGPeriodicity(queue, {
    generatedAt: ISO,
    minTenureDays: 8,
    minTokens: 0,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 's1');
  assert.equal(row.nTenureDays, 16);
  assert.equal(row.nFreqBins, 8);
  assert.ok(row.gStat > 1 / 8 && row.gStat <= 1);
  assert.ok(row.gPValue >= 0 && row.gPValue <= 1);
  assert.ok(Number.isFinite(row.gNeg2LogP));
});
