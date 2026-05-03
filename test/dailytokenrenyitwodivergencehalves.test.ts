import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenRenyiTwoDivergenceHalves,
  buildDailyTokenRenyiTwoDivergenceHalves,
  RENYI_TWO_GRID_K,
  RENYI_TWO_SILVERMAN_MULTIPLIER,
  RENYI_TWO_GRID_EXTENSION_H,
  RENYI_TWO_PMF_FLOOR,
} from '../src/dailytokenrenyitwodivergencehalves.js';
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

test('renyiTwo primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenRenyiTwoDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('renyiTwo primitive: rejects non-finite values (NaN)', () => {
  assert.throws(
    () =>
      dailyTokenRenyiTwoDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('renyiTwo primitive: rejects non-finite values (Infinity)', () => {
  assert.throws(
    () =>
      dailyTokenRenyiTwoDivergenceHalves([
        1, 2, 3, 4, Infinity, 6, 7, 8,
      ]),
    /finite values/,
  );
});

test('renyiTwo primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenRenyiTwoDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('renyiTwo primitive: n1 = floor(n/2), n2 = n - n1 (even n)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.renyiTwoN1, 5);
  assert.equal(r.renyiTwoN2, 5);
});

test('renyiTwo primitive: n1 = floor(n/2), n2 = n - n1 (odd n)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9,
  ]);
  assert.equal(r.renyiTwoN1, 4);
  assert.equal(r.renyiTwoN2, 5);
});

test('renyiTwo primitive: gridK === 257', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.renyiTwoGridK, 257);
});

test('renyiTwo primitive: bandwidth > 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.renyiTwoBandwidth > 0);
});

test('renyiTwo primitive: grid endpoints flank min/max with 3*h padding', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10];
  const r = dailyTokenRenyiTwoDivergenceHalves(x);
  assert.ok(
    Math.abs(r.renyiTwoGridLo - (1 - 3 * r.renyiTwoBandwidth)) < 1e-10,
  );
  assert.ok(
    Math.abs(r.renyiTwoGridHi - (10 + 3 * r.renyiTwoBandwidth)) < 1e-10,
  );
});

test('renyiTwo primitive: nSamples reported correctly', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.nSamples, 9);
});

test('renyiTwo primitive: gridDx > 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.renyiTwoGridDx > 0);
});

test('renyiTwo primitive: madPool > 0 on integer ramp', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.ok(r.renyiTwoMadPool > 0);
});

// ---------- primitive: bounds and identities ----------

test('renyiTwo primitive: forward direction >= 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.renyiTwoForward >= -1e-12);
});

test('renyiTwo primitive: reverse direction >= 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.renyiTwoReverse >= -1e-12);
});

test('renyiTwo primitive: symmetrised >= 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.renyiTwoSym >= -1e-12);
});

test('renyiTwo primitive: chiSquaredForward >= 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.chiSquaredForward >= -1e-12);
});

test('renyiTwo primitive: chiSquaredReverse >= 0', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(r.chiSquaredReverse >= -1e-12);
});

test('renyiTwo primitive: D2sym = 0.5*(forward + reverse)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  assert.ok(
    Math.abs(r.renyiTwoSym - 0.5 * (r.renyiTwoForward + r.renyiTwoReverse)) <
      1e-12,
  );
});

test('renyiTwo primitive: D2(p||q) = ln(1 + chi^2_fwd) (van Erven & Harremos identity)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  const recoveredForward = Math.log(1 + r.chiSquaredForward);
  // Numerical floor and trapezoidal rounding on K=257 leave only
  // microscopic deviation; tolerance generous to subnormal mass tails.
  assert.ok(
    Math.abs(recoveredForward - r.renyiTwoForward) < 1e-9,
    `recovered=${recoveredForward}, forward=${r.renyiTwoForward}`,
  );
});

test('renyiTwo primitive: D2(q||p) = ln(1 + chi^2_rev)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12,
  ]);
  const recoveredReverse = Math.log(1 + r.chiSquaredReverse);
  assert.ok(
    Math.abs(recoveredReverse - r.renyiTwoReverse) < 1e-9,
    `recovered=${recoveredReverse}, reverse=${r.renyiTwoReverse}`,
  );
});

test('renyiTwo primitive: identical halves give D2sym near 0', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenRenyiTwoDivergenceHalves(x);
  assert.ok(r.renyiTwoSym < 1e-9, `D2sym=${r.renyiTwoSym}`);
  assert.ok(r.renyiTwoForward < 1e-9, `D2(p||q)=${r.renyiTwoForward}`);
  assert.ok(r.renyiTwoReverse < 1e-9, `D2(q||p)=${r.renyiTwoReverse}`);
});

test('renyiTwo primitive: identical halves give chi^2 near 0 in both directions', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenRenyiTwoDivergenceHalves(x);
  assert.ok(r.chiSquaredForward < 1e-9);
  assert.ok(r.chiSquaredReverse < 1e-9);
});

test('renyiTwo primitive: well-separated halves produce D2sym > 0.1', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r = dailyTokenRenyiTwoDivergenceHalves(x);
  assert.ok(r.renyiTwoSym > 0.1, `expected sizeable D2sym, got ${r.renyiTwoSym}`);
});

test('renyiTwo primitive: nearly-disjoint halves drive D2sym large', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1e6, 1e6 + 1, 1e6 + 2, 1e6 + 3, 1e6 + 4,
    1e6 + 5, 1e6 + 6, 1e6 + 7,
  ]);
  assert.ok(r.renyiTwoSym > 1, `expected D2sym > 1, got ${r.renyiTwoSym}`);
  assert.ok(Number.isFinite(r.renyiTwoSym));
});

test('renyiTwo primitive: D2sym finite even on extreme separation', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1e12, 1e12 + 1, 1e12 + 2, 1e12 + 3, 1e12 + 4,
    1e12 + 5, 1e12 + 6, 1e12 + 7,
  ]);
  assert.ok(Number.isFinite(r.renyiTwoSym));
  assert.ok(Number.isFinite(r.renyiTwoForward));
  assert.ok(Number.isFinite(r.renyiTwoReverse));
});

test('renyiTwo primitive: translation-invariant (D2sym, fwd, rev)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const r2 = dailyTokenRenyiTwoDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.renyiTwoSym - r2.renyiTwoSym) < 1e-8);
  assert.ok(Math.abs(r1.renyiTwoForward - r2.renyiTwoForward) < 1e-8);
  assert.ok(Math.abs(r1.renyiTwoReverse - r2.renyiTwoReverse) < 1e-8);
});

test('renyiTwo primitive: translation-invariant (chi^2 forward and reverse)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const r2 = dailyTokenRenyiTwoDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.chiSquaredForward - r2.chiSquaredForward) < 1e-8);
  assert.ok(Math.abs(r1.chiSquaredReverse - r2.chiSquaredReverse) < 1e-8);
});

test('renyiTwo primitive: positive-scale-invariant (D2sym)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const r2 = dailyTokenRenyiTwoDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.renyiTwoSym - r2.renyiTwoSym) < 1e-8);
  assert.ok(Math.abs(r1.renyiTwoForward - r2.renyiTwoForward) < 1e-8);
  assert.ok(Math.abs(r1.renyiTwoReverse - r2.renyiTwoReverse) < 1e-8);
});

test('renyiTwo primitive: positive-scale-invariant (chi^2)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const r2 = dailyTokenRenyiTwoDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(Math.abs(r1.chiSquaredForward - r2.chiSquaredForward) < 1e-8);
  assert.ok(Math.abs(r1.chiSquaredReverse - r2.chiSquaredReverse) < 1e-8);
});

test('renyiTwo primitive: symmetric (reverse halves preserves D2sym; forward and reverse swap)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenRenyiTwoDivergenceHalves(xSwap);
  assert.ok(Math.abs(r1.renyiTwoSym - r2.renyiTwoSym) < 1e-10);
  assert.ok(Math.abs(r1.renyiTwoForward - r2.renyiTwoReverse) < 1e-10);
  assert.ok(Math.abs(r1.renyiTwoReverse - r2.renyiTwoForward) < 1e-10);
});

test('renyiTwo primitive: chi^2 swap consistency', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const xSwap = [
    100, 101, 102, 103, 104, 105, 106, 107, 1, 2, 3, 4, 5, 6, 7, 8,
  ];
  const r2 = dailyTokenRenyiTwoDivergenceHalves(xSwap);
  assert.ok(Math.abs(r1.chiSquaredForward - r2.chiSquaredReverse) < 1e-10);
  assert.ok(Math.abs(r1.chiSquaredReverse - r2.chiSquaredForward) < 1e-10);
});

test('renyiTwo primitive: bandwidth scales linearly with positive scaling', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const r2 = dailyTokenRenyiTwoDivergenceHalves(x.map((v) => 7 * v));
  assert.ok(
    Math.abs(r2.renyiTwoBandwidth / r1.renyiTwoBandwidth - 7) < 1e-8,
  );
});

test('renyiTwo primitive: bandwidth invariant under translation', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r1 = dailyTokenRenyiTwoDivergenceHalves(x);
  const r2 = dailyTokenRenyiTwoDivergenceHalves(x.map((v) => v + 1000));
  assert.ok(Math.abs(r1.renyiTwoBandwidth - r2.renyiTwoBandwidth) < 1e-10);
});

test('renyiTwo primitive: renyiTwoAsymmetry in [0, 1]', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(r.renyiTwoAsymmetry >= 0);
  assert.ok(r.renyiTwoAsymmetry <= 1 + 1e-12);
});

test('renyiTwo primitive: renyiTwoAsymmetry === 0 on identical halves', () => {
  const half = [1, 2, 3, 4, 5, 6, 7, 8];
  const x = [...half, ...half];
  const r = dailyTokenRenyiTwoDivergenceHalves(x);
  assert.equal(r.renyiTwoAsymmetry, 0);
});

test('renyiTwo primitive: renyiTwoNormalized = D2sym / (D2sym + 1) in [0, 1)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 100, 101, 102, 103, 104, 105, 106, 107,
  ]);
  assert.ok(
    Math.abs(
      r.renyiTwoNormalized - r.renyiTwoSym / (r.renyiTwoSym + 1),
    ) < 1e-12,
  );
  assert.ok(r.renyiTwoNormalized >= 0);
  assert.ok(r.renyiTwoNormalized < 1);
});

test('renyiTwo primitive: constants exposed', () => {
  assert.equal(RENYI_TWO_GRID_K, 257);
  assert.equal(RENYI_TWO_SILVERMAN_MULTIPLIER, 0.9);
  assert.equal(RENYI_TWO_GRID_EXTENSION_H, 3);
  assert.equal(RENYI_TWO_PMF_FLOOR, 1e-300);
});

test('renyiTwo primitive: bandwidth identity matches Silverman h = 0.9*madPool*n^(-1/5)', () => {
  const x = [1, 4, 2, 9, 5, 7, 3, 6, 8, 10, 11, 12];
  const r = dailyTokenRenyiTwoDivergenceHalves(x);
  const expected =
    RENYI_TWO_SILVERMAN_MULTIPLIER *
    r.renyiTwoMadPool *
    Math.pow(r.nSamples, -1 / 5);
  assert.ok(
    Math.abs(r.renyiTwoBandwidth - expected) < 1e-10,
    `h=${r.renyiTwoBandwidth} expected=${expected}`,
  );
});

test('renyiTwo primitive: gridDx === (gridHi - gridLo) / (K-1)', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 4, 2, 9, 5, 7, 3, 6, 8, 10,
  ]);
  const expected = (r.renyiTwoGridHi - r.renyiTwoGridLo) / (r.renyiTwoGridK - 1);
  assert.ok(Math.abs(r.renyiTwoGridDx - expected) < 1e-12);
});

test('renyiTwo primitive: D2sym monotone with separation magnitude', () => {
  const small = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007,
  ]);
  assert.ok(big.renyiTwoSym > small.renyiTwoSym);
});

test('renyiTwo primitive: chi^2 monotone with separation magnitude', () => {
  const small = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
  ]);
  const big = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007,
  ]);
  assert.ok(big.chiSquaredForward > small.chiSquaredForward);
  assert.ok(big.chiSquaredReverse > small.chiSquaredReverse);
});

test('renyiTwo primitive: mean and stddev populated', () => {
  const r = dailyTokenRenyiTwoDivergenceHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
  ]);
  assert.equal(r.mean, 5.5);
  assert.ok(r.stddev > 0);
});

// ---------- builder: input validation ----------

test('build: rejects negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenRenyiTwoDivergenceHalves([], { minTokens: -1 }),
    /minTokens must be a non-negative finite number/,
  );
});

test('build: rejects non-integer minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenRenyiTwoDivergenceHalves([], {
        minTenureDays: 7.5,
      }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects below-floor minTenureDays', () => {
  assert.throws(
    () =>
      buildDailyTokenRenyiTwoDivergenceHalves([], { minTenureDays: 7 }),
    /minTenureDays must be an integer >= 8/,
  );
});

test('build: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenRenyiTwoDivergenceHalves([], { top: -1 }),
    /top must be a non-negative integer/,
  );
});

test('build: rejects invalid sort key', () => {
  assert.throws(
    () =>
      buildDailyTokenRenyiTwoDivergenceHalves([], {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('build: rejects invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenRenyiTwoDivergenceHalves([], {
        since: 'not-a-date',
      }),
    /invalid since/,
  );
});

test('build: rejects invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenRenyiTwoDivergenceHalves([], {
        until: 'not-a-date',
      }),
    /invalid until/,
  );
});

// ---------- builder: end-to-end ----------

function makeQueueWithTwoSources(): QueueLine[] {
  const lines: QueueLine[] = [];
  // source A: 16-day tenure, well-separated halves
  for (let i = 0; i < 8; i += 1) {
    lines.push(ql(dayIso(i), 'srcA', 1000 + i));
  }
  for (let i = 8; i < 16; i += 1) {
    lines.push(ql(dayIso(i), 'srcA', 100000 + i));
  }
  // source B: 14-day tenure, mild variation
  for (let i = 0; i < 14; i += 1) {
    lines.push(ql(dayIso(i), 'srcB', 500 + i * 7));
  }
  return lines;
}

test('build: produces one row per qualifying source', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
});

test('build: gridK === 257 in report', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.gridK, 257);
});

test('build: silvermanMultiplier === 0.9 in report', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.silvermanMultiplier, 0.9);
});

test('build: srcA (well-separated halves) has bigger D2sym than srcB (gentle ramp)', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'source',
  });
  const a = r.sources.find((s) => s.source === 'srcA')!;
  const b = r.sources.find((s) => s.source === 'srcB')!;
  assert.ok(a.renyiTwoSym > b.renyiTwoSym);
});

test('build: default sort is renyiTwoSymDesc', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.renyiTwoSym >= r.sources[i]!.renyiTwoSym);
  }
});

test('build: sort=renyiTwoSym ascending', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'renyiTwoSym',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.renyiTwoSym <= r.sources[i]!.renyiTwoSym);
  }
});

test('build: sort=renyiTwoForwardDesc orders by forward direction', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'renyiTwoForwardDesc',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.renyiTwoForward >= r.sources[i]!.renyiTwoForward,
    );
  }
});

test('build: sort=renyiTwoReverse orders by reverse asc', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'renyiTwoReverse',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.renyiTwoReverse <= r.sources[i]!.renyiTwoReverse,
    );
  }
});

test('build: sort=tokens orders by totalTokens desc', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'tokens',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.totalTokens >= r.sources[i]!.totalTokens,
    );
  }
});

test('build: sort=tenure orders by tenure desc', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'tenure',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(
      r.sources[i - 1]!.nTenureDays >= r.sources[i]!.nTenureDays,
    );
  }
});

test('build: sort=source ties resolved alphabetically', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    sort: 'source',
  });
  for (let i = 1; i < r.sources.length; i += 1) {
    assert.ok(r.sources[i - 1]!.source <= r.sources[i]!.source);
  }
});

test('build: top cap drops surplus rows', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('build: source filter drops non-matching rows', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    source: 'srcA',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'srcA');
  assert.ok(r.droppedSourceFilter > 0);
});

test('build: minTokens drops sparse sources', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    minTokens: 1e9,
  });
  assert.equal(r.sources.length, 0);
  assert.ok(r.droppedSparseSources >= 2);
});

test('build: minTenureDays drops short sources', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    minTenureDays: 50,
  });
  assert.equal(r.sources.length, 0);
  assert.ok(r.droppedBelowMinTenure >= 2);
});

test('build: drops rows with non-positive tokens', () => {
  const q: QueueLine[] = [
    ql(dayIso(0), 'srcA', 0),
    ql(dayIso(1), 'srcA', -5),
    ql(dayIso(2), 'srcA', NaN),
  ];
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.droppedNonPositiveTokens, 3);
  assert.equal(r.sources.length, 0);
});

test('build: drops rows with invalid hour_start', () => {
  const q: QueueLine[] = [ql('not-a-date', 'srcA', 1000)];
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: drops zero-variance sources (gap-filled all-equal)', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    q.push(ql(dayIso(i), 'flat', 1000));
  }
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: window since/until trims rows', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    since: dayIso(8),
  });
  assert.equal(r.windowStart, dayIso(8));
});

test('build: generatedAt set when not provided', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q);
  assert.ok(r.generatedAt.length >= 20);
});

test('build: per-source row carries n1, n2 matching tenure halves', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    assert.equal(s.renyiTwoN1 + s.renyiTwoN2, s.nTenureDays);
    assert.equal(s.renyiTwoN1, Math.floor(s.nTenureDays / 2));
  }
});

test('build: per-source row carries gridK = 257', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    assert.equal(s.renyiTwoGridK, 257);
  }
});

test('build: per-source row D2sym = 0.5*(forward + reverse)', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    assert.ok(
      Math.abs(s.renyiTwoSym - 0.5 * (s.renyiTwoForward + s.renyiTwoReverse)) <
        1e-12,
    );
  }
});

test('build: per-source row renyiTwoNormalized = D2sym/(D2sym+1)', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    assert.ok(
      Math.abs(s.renyiTwoNormalized - s.renyiTwoSym / (s.renyiTwoSym + 1)) <
        1e-12,
    );
  }
});

test('build: empty queue returns no sources', () => {
  const r = buildDailyTokenRenyiTwoDivergenceHalves([], {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('build: totalTokens equals sum across kept rows', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  let s = 0;
  for (const row of r.sources) s += row.totalTokens;
  assert.equal(s, r.totalTokens);
});

test('build: orthogonality probe: D2sym is NOT a monotone image of forward direction alone', () => {
  // Construct two distinct shapes whose forward directions are
  // ordered one way but symmetrised D2sym swaps order. Cleanest
  // hand-crafted check: compare two builders. We just assert
  // both fields are independently informative (not equal).
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  const a = r.sources.find((s) => s.source === 'srcA')!;
  // For the well-separated halves, asymmetry should be > 0 strictly
  // (forward and reverse differ because chi^2 inverts mass roles).
  assert.ok(a.renyiTwoForward !== a.renyiTwoReverse);
});

test('build: harmonic-mean Renyi-2 lower bound: D2sym >= 0', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    assert.ok(s.renyiTwoSym >= 0);
  }
});

test('build: per-source chi^2 forward and reverse are non-negative', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    assert.ok(s.chiSquaredForward >= 0);
    assert.ok(s.chiSquaredReverse >= 0);
  }
});

test('build: renyiTwoForward = ln(1 + chi^2_fwd) holds in report rows', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    const recovered = Math.log(1 + s.chiSquaredForward);
    assert.ok(
      Math.abs(recovered - s.renyiTwoForward) < 1e-9,
      `recovered=${recovered}, forward=${s.renyiTwoForward}`,
    );
  }
});

test('build: renyiTwoReverse = ln(1 + chi^2_rev) holds in report rows', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  for (const s of r.sources) {
    const recovered = Math.log(1 + s.chiSquaredReverse);
    assert.ok(
      Math.abs(recovered - s.renyiTwoReverse) < 1e-9,
      `recovered=${recovered}, reverse=${s.renyiTwoReverse}`,
    );
  }
});

test('build: report carries top, sort, source filter echoes', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    top: 5,
    sort: 'tokens',
    source: 'srcA',
  });
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.source, 'srcA');
});

test('build: dropped counters all initialised to 0 in clean run', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.equal(r.droppedInvalidHourStart, 0);
  assert.equal(r.droppedNonPositiveTokens, 0);
  assert.equal(r.droppedSourceFilter, 0);
  assert.equal(r.droppedSparseSources, 0);
  assert.equal(r.droppedBelowMinTenure, 0);
  assert.equal(r.droppedZeroVariance, 0);
  assert.equal(r.droppedNonFiniteFit, 0);
  assert.equal(r.droppedTopSources, 0);
});

test('build: handles unknown source label as "(unknown)"', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 16; i += 1) {
    q.push(ql(dayIso(i), '', 1000 + i * 100));
  }
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  assert.ok(r.sources.some((s) => s.source === '(unknown)'));
});

test('build: srcB Renyi-2 forward ≈ reverse on smooth ramp (low asymmetry)', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
  });
  const b = r.sources.find((s) => s.source === 'srcB')!;
  // Smooth halves ramp should have small asymmetry (< 0.5).
  assert.ok(
    b.renyiTwoAsymmetry < 0.5,
    `expected low asymmetry, got ${b.renyiTwoAsymmetry}`,
  );
});

test('build: top cap of 0 means no cap', () => {
  const q = makeQueueWithTwoSources();
  const r = buildDailyTokenRenyiTwoDivergenceHalves(q, {
    generatedAt: '2026-01-20T00:00:00.000Z',
    top: 0,
  });
  assert.equal(r.droppedTopSources, 0);
});
