import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenKDivergenceHalves,
  buildDailyTokenKDivergenceHalves,
  kDivSummand,
  kDivDirectionalSign,
  KDIV_GRID_K,
  KDIV_SILVERMAN_MULTIPLIER,
  KDIV_GRID_EXTENSION_H,
  KDIV_PMF_FLOOR,
  KDIV_UPPER_BOUND,
} from '../src/dailytokenkdivergencehalves.js';
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

test('kdiv primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('kdiv primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.kN1, 4);
  assert.equal(r.kN2, 4);
});

test('kdiv primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenKDivergenceHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('kdiv primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenKDivergenceHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('kdiv primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenKDivergenceHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('kdiv primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.kN1, 4);
  assert.equal(r.kN2, 5);
});

test('kdiv primitive: gridK matches constant', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.kGridK, KDIV_GRID_K);
  assert.equal(r.kGridK, 257);
});

test('kdiv primitive: grid spans [min - 3h, max + 3h]', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r = dailyTokenKDivergenceHalves(xs);
  const mn = Math.min(...xs);
  const mx = Math.max(...xs);
  assert.ok(Math.abs(r.kGridLo - (mn - KDIV_GRID_EXTENSION_H * r.kBandwidth)) < 1e-9);
  assert.ok(Math.abs(r.kGridHi - (mx + KDIV_GRID_EXTENSION_H * r.kBandwidth)) < 1e-9);
});

test('kdiv primitive: silverman multiplier constant is 0.9', () => {
  assert.equal(KDIV_SILVERMAN_MULTIPLIER, 0.9);
});

test('kdiv primitive: returns expected fields', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 100]);
  for (const f of [
    'kForward',
    'kReverse',
    'kMax',
    'kAsymmetry',
    'kJsd',
    'kMaxBinFwd',
    'kMaxBinRev',
  ]) {
    assert.ok(f in r, `missing field ${f}`);
  }
});

// ---------- primitive: numerical bounds ----------

test('kdiv primitive: forward and reverse non-negative', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 100]);
  assert.ok(r.kForward >= 0);
  assert.ok(r.kReverse >= 0);
});

test('kdiv primitive: forward and reverse bounded by ln(2)', () => {
  // K(p||q) <= log(2) per direction (analytic upper bound).
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.kForward <= KDIV_UPPER_BOUND + 1e-9, `kFwd=${r.kForward}`);
  assert.ok(r.kReverse <= KDIV_UPPER_BOUND + 1e-9, `kRev=${r.kReverse}`);
});

test('kdiv primitive: max equals max(forward, reverse)', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 100, 200, 300]);
  assert.equal(r.kMax, Math.max(r.kForward, r.kReverse));
});

test('kdiv primitive: jsd equals 0.5 * (forward + reverse)', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 100, 200, 300]);
  assert.ok(Math.abs(r.kJsd - 0.5 * (r.kForward + r.kReverse)) < 1e-12);
});

test('kdiv primitive: asymmetry in [0, 1]', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 100, 200, 300]);
  assert.ok(r.kAsymmetry >= 0);
  assert.ok(r.kAsymmetry <= 1);
});

test('kdiv primitive: maxBin <= total sum (per-bin component bounds)', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 5, 6, 7, 100, 200, 300]);
  assert.ok(r.kMaxBinFwd <= r.kForward + 1e-12);
  assert.ok(r.kMaxBinRev <= r.kReverse + 1e-12);
});

test('kdiv primitive: identical halves -> forward and reverse small', () => {
  const xs = [10, 20, 30, 40, 10, 20, 30, 40];
  const r = dailyTokenKDivergenceHalves(xs);
  assert.ok(r.kForward < 1e-3);
  assert.ok(r.kReverse < 1e-3);
});

test('kdiv primitive: shifted halves yield positive divergence', () => {
  const r = dailyTokenKDivergenceHalves([1, 2, 3, 4, 100, 200, 300, 400]);
  assert.ok(r.kMax > 1e-3);
});

// ---------- primitive: invariances ----------

test('kdiv primitive: translation-invariant in data', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r1 = dailyTokenKDivergenceHalves(xs);
  const r2 = dailyTokenKDivergenceHalves(xs.map((x) => x + 1000));
  const relF = Math.abs(r1.kForward - r2.kForward) / Math.max(1e-9, Math.abs(r1.kForward));
  const relR = Math.abs(r1.kReverse - r2.kReverse) / Math.max(1e-9, Math.abs(r1.kReverse));
  assert.ok(relF < 1e-9, `relF=${relF}`);
  assert.ok(relR < 1e-9, `relR=${relR}`);
});

test('kdiv primitive: positive-scale-invariant in data', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r1 = dailyTokenKDivergenceHalves(xs);
  const r2 = dailyTokenKDivergenceHalves(xs.map((x) => x * 7.5));
  const relF = Math.abs(r1.kForward - r2.kForward) / Math.max(1e-9, Math.abs(r1.kForward));
  const relR = Math.abs(r1.kReverse - r2.kReverse) / Math.max(1e-9, Math.abs(r1.kReverse));
  assert.ok(relF < 1e-9, `relF=${relF}`);
  assert.ok(relR < 1e-9, `relR=${relR}`);
});

test('kdiv primitive: swapping halves swaps forward and reverse', () => {
  const A = [1, 2, 3, 4];
  const B = [50, 60, 70, 80];
  const r1 = dailyTokenKDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenKDivergenceHalves([...B, ...A]);
  const relA = Math.abs(r1.kForward - r2.kReverse) / Math.max(1e-9, Math.abs(r1.kForward));
  const relB = Math.abs(r1.kReverse - r2.kForward) / Math.max(1e-9, Math.abs(r1.kReverse));
  assert.ok(relA < 1e-9, `relA=${relA}`);
  assert.ok(relB < 1e-9, `relB=${relB}`);
});

test('kdiv primitive: swapping halves preserves max, jsd, asymmetry', () => {
  const A = [1, 2, 3, 4];
  const B = [50, 60, 70, 80];
  const r1 = dailyTokenKDivergenceHalves([...A, ...B]);
  const r2 = dailyTokenKDivergenceHalves([...B, ...A]);
  assert.ok(Math.abs(r1.kMax - r2.kMax) / Math.max(1e-9, r1.kMax) < 1e-9);
  assert.ok(Math.abs(r1.kJsd - r2.kJsd) / Math.max(1e-9, r1.kJsd) < 1e-9);
  assert.ok(Math.abs(r1.kAsymmetry - r2.kAsymmetry) < 1e-9);
});

// ---------- helper: kDivSummand ----------

test('kDivSummand: vanishes on the diagonal', () => {
  assert.equal(kDivSummand(0.3, 0.3), 0);
});

test('kDivSummand: zero p -> 0 (limit)', () => {
  assert.equal(kDivSummand(0, 0.4), 0);
});

test('kDivSummand: non-negative when p >= q (log arg >= 1)', () => {
  assert.ok(kDivSummand(0.5, 0.1) >= 0);
});

test('kDivSummand: negative when p < q (log arg < 1) -- per-bin signed', () => {
  // Per-bin K-div is signed; only the SUM over bins is non-negative (Gibbs').
  assert.ok(kDivSummand(0.1, 0.5) < 0);
});

test('kDivSummand: bounded by p * log(2) per bin', () => {
  // 2p / (p + q) <= 2 always, so log <= log(2)
  const p = 0.5;
  const v = kDivSummand(p, KDIV_PMF_FLOOR);
  assert.ok(v <= p * Math.log(2) + 1e-9, `v=${v}`);
});

test('kDivSummand: rejects negative p', () => {
  assert.throws(() => kDivSummand(-0.1, 0.3), /non-negative/);
});

test('kDivSummand: rejects NaN', () => {
  assert.throws(() => kDivSummand(NaN, 0.3), /finite/);
});

// ---------- helper: kDivDirectionalSign ----------

test('kDivDirectionalSign: +1 when forward dominates', () => {
  assert.equal(kDivDirectionalSign(0.3, 0.1), 1);
});

test('kDivDirectionalSign: -1 when reverse dominates', () => {
  assert.equal(kDivDirectionalSign(0.1, 0.3), -1);
});

test('kDivDirectionalSign: 0 when within tol', () => {
  assert.equal(kDivDirectionalSign(0.2, 0.2), 0);
  assert.equal(kDivDirectionalSign(0, 0), 0);
});

test('kDivDirectionalSign: anti-symmetric', () => {
  assert.equal(
    kDivDirectionalSign(0.5, 0.2),
    -kDivDirectionalSign(0.2, 0.5),
  );
});

test('kDivDirectionalSign: rejects negative', () => {
  assert.throws(() => kDivDirectionalSign(-1, 1), /non-negative/);
});

// ---------- builder ----------

function makeQueue(): QueueLine[] {
  // Two sources: alpha (steady ~100), beta (drifting up).
  const out: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    out.push(ql(dayIso(d), 'alpha', 100 + (d % 5)));
    out.push(ql(dayIso(d), 'beta', 50 + d * 10));
  }
  return out;
}

test('kdiv builder: produces both source rows', () => {
  const r = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  const beta = r.sources.find((s) => s.source === 'beta')!;
  const alpha = r.sources.find((s) => s.source === 'alpha')!;
  assert.ok(beta.kMax > alpha.kMax, `beta drift should exceed alpha steady`);
});

test('kdiv builder: emits constants in report', () => {
  const r = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
  });
  assert.equal(r.gridK, KDIV_GRID_K);
  assert.equal(r.silvermanMultiplier, KDIV_SILVERMAN_MULTIPLIER);
  assert.equal(r.pmfFloor, KDIV_PMF_FLOOR);
  assert.ok(Math.abs(r.upperBound - Math.log(2)) < 1e-15);
});

test('kdiv builder: every row has bounded forward/reverse', () => {
  const r = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
  });
  for (const s of r.sources) {
    assert.ok(s.kForward >= 0 && s.kForward <= KDIV_UPPER_BOUND + 1e-9);
    assert.ok(s.kReverse >= 0 && s.kReverse <= KDIV_UPPER_BOUND + 1e-9);
    assert.ok(Math.abs(s.kJsd - 0.5 * (s.kForward + s.kReverse)) < 1e-12);
  }
});

test('kdiv builder: respects min-tenure-days', () => {
  const r = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 28,
  });
  // alpha and beta both span 30 days, both should pass.
  assert.equal(r.sources.length, 2);
});

test('kdiv builder: source filter restricts output', () => {
  const r = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
    source: 'beta',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'beta');
});

test('kdiv builder: sort kMax ascending vs descending', () => {
  const asc = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
    sort: 'kMax',
  });
  const desc = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
    sort: 'kMaxDesc',
  });
  assert.ok(asc.sources[0]!.kMax <= asc.sources[asc.sources.length - 1]!.kMax);
  assert.ok(desc.sources[0]!.kMax >= desc.sources[desc.sources.length - 1]!.kMax);
});

test('kdiv builder: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenKDivergenceHalves(makeQueue(), {
        sort: 'bogus' as never,
      }),
    /sort must be one of/,
  );
});

test('kdiv builder: invalid min-tenure-days throws', () => {
  assert.throws(
    () =>
      buildDailyTokenKDivergenceHalves(makeQueue(), { minTenureDays: 4 }),
    /minTenureDays/,
  );
});

test('kdiv builder: top cap surfaces droppedTopSources', () => {
  const r = buildDailyTokenKDivergenceHalves(makeQueue(), {
    minTokens: 100,
    minTenureDays: 14,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 1);
});

test('kdiv builder: empty queue -> empty rows, totals 0', () => {
  const r = buildDailyTokenKDivergenceHalves([], { minTokens: 100, minTenureDays: 14 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});
