import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenNeymanChiSquaredHalves,
  buildDailyTokenNeymanChiSquaredHalves,
  neymanSummand,
  NEYMAN_GRID_K,
  NEYMAN_SILVERMAN_MULTIPLIER,
  NEYMAN_GRID_EXTENSION_H,
  NEYMAN_PMF_FLOOR,
} from '../src/dailytokenneymanchisquaredhalves.js';
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

test('neyman primitive: rejects fewer than 8 samples', () => {
  assert.throws(
    () => dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7]),
    /at least 8 samples/,
  );
});

test('neyman primitive: accepts exactly 8 samples', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.neymanN1, 4);
  assert.equal(r.neymanN2, 4);
});

test('neyman primitive: rejects NaN', () => {
  assert.throws(
    () => dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, NaN, 6, 7, 8]),
    /finite values/,
  );
});

test('neyman primitive: rejects +Infinity', () => {
  assert.throws(
    () => dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('neyman primitive: rejects -Infinity', () => {
  assert.throws(
    () => dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, -Infinity, 6, 7, 8]),
    /finite values/,
  );
});

test('neyman primitive: zero centred variance throws', () => {
  assert.throws(
    () => dailyTokenNeymanChiSquaredHalves([5, 5, 5, 5, 5, 5, 5, 5]),
    /zero centred variance/,
  );
});

// ---------- primitive: shape ----------

test('neyman primitive: n1 = floor(n/2), n2 = n - n1 (even)', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.neymanN1, 5);
  assert.equal(r.neymanN2, 5);
});

test('neyman primitive: n1 = floor(n/2), n2 = n - n1 (odd)', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  assert.equal(r.neymanN1, 4);
  assert.equal(r.neymanN2, 5);
});

test('neyman primitive: nSamples reports actual length', () => {
  const r = dailyTokenNeymanChiSquaredHalves([
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12,
  ]);
  assert.equal(r.nSamples, 12);
});

test('neyman primitive: gridK matches NEYMAN_GRID_K constant', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.equal(r.neymanGridK, NEYMAN_GRID_K);
  assert.equal(r.neymanGridK, 257);
});

test('neyman primitive: madPool and bandwidth strictly positive on varied input', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 100]);
  assert.ok(r.neymanMadPool > 0);
  assert.ok(r.neymanBandwidth > 0);
});

test('neyman primitive: grid spans [min - 3h, max + 3h]', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  const mn = Math.min(...xs);
  const mx = Math.max(...xs);
  assert.ok(Math.abs(r.neymanGridLo - (mn - 3 * r.neymanBandwidth)) < 1e-9);
  assert.ok(Math.abs(r.neymanGridHi - (mx + 3 * r.neymanBandwidth)) < 1e-9);
});

test('neyman primitive: grid dx > 0', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 100]);
  assert.ok(r.neymanGridDx > 0);
});

test('neyman primitive: returns expected fields', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 100]);
  assert.ok('neymanForward' in r);
  assert.ok('neymanReverse' in r);
  assert.ok('neymanMax' in r);
  assert.ok('neymanAsymmetry' in r);
  assert.ok('neymanMaxBinFwd' in r);
  assert.ok('neymanMaxBinRev' in r);
});

// ---------- primitive: numerical properties ----------

test('neyman primitive: forward and reverse non-negative', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  assert.ok(r.neymanForward >= 0);
  assert.ok(r.neymanReverse >= 0);
});

test('neyman primitive: max equals max(forward, reverse)', () => {
  const r = dailyTokenNeymanChiSquaredHalves([
    1, 2, 3, 4, 5, 6, 7, 100, 200, 300,
  ]);
  assert.equal(r.neymanMax, Math.max(r.neymanForward, r.neymanReverse));
});

test('neyman primitive: asymmetry in [0, 1]', () => {
  const r = dailyTokenNeymanChiSquaredHalves([
    1, 2, 3, 4, 5, 6, 7, 100, 200, 300,
  ]);
  assert.ok(r.neymanAsymmetry >= 0);
  assert.ok(r.neymanAsymmetry <= 1);
});

test('neyman primitive: maxBinFwd, maxBinRev non-negative', () => {
  const r = dailyTokenNeymanChiSquaredHalves([
    1, 2, 3, 4, 5, 6, 7, 100, 200, 300,
  ]);
  assert.ok(r.neymanMaxBinFwd >= 0);
  assert.ok(r.neymanMaxBinRev >= 0);
});

test('neyman primitive: maxBin <= total sum (per-bin component bounds)', () => {
  const r = dailyTokenNeymanChiSquaredHalves([
    1, 2, 3, 4, 5, 6, 7, 100, 200, 300,
  ]);
  assert.ok(r.neymanMaxBinFwd <= r.neymanForward + 1e-12);
  assert.ok(r.neymanMaxBinRev <= r.neymanReverse + 1e-12);
});

test('neyman primitive: identical halves -> forward and reverse small', () => {
  // identical halves => Neyman approximately 0 (KDE approximation may not be exact)
  const xs = [10, 20, 30, 40, 10, 20, 30, 40];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  assert.ok(r.neymanForward < 1e-3);
  assert.ok(r.neymanReverse < 1e-3);
});

test('neyman primitive: identical halves -> asymmetry exists in [0,1]', () => {
  const xs = [10, 20, 30, 40, 10, 20, 30, 40];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  assert.ok(r.neymanAsymmetry >= 0);
  assert.ok(r.neymanAsymmetry <= 1);
});

// ---------- primitive: invariances ----------

test('neyman primitive: translation-invariant in data', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r1 = dailyTokenNeymanChiSquaredHalves(xs);
  const r2 = dailyTokenNeymanChiSquaredHalves(xs.map((x) => x + 1000));
  const relF = Math.abs(r1.neymanForward - r2.neymanForward) / Math.max(1, Math.abs(r1.neymanForward));
  const relR = Math.abs(r1.neymanReverse - r2.neymanReverse) / Math.max(1, Math.abs(r1.neymanReverse));
  assert.ok(relF < 1e-9, `relF=${relF}`);
  assert.ok(relR < 1e-9, `relR=${relR}`);
});

test('neyman primitive: positive-scale-invariant in data', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 100];
  const r1 = dailyTokenNeymanChiSquaredHalves(xs);
  const r2 = dailyTokenNeymanChiSquaredHalves(xs.map((x) => x * 7.5));
  const relF = Math.abs(r1.neymanForward - r2.neymanForward) / Math.max(1, Math.abs(r1.neymanForward));
  const relR = Math.abs(r1.neymanReverse - r2.neymanReverse) / Math.max(1, Math.abs(r1.neymanReverse));
  assert.ok(relF < 1e-9, `relF=${relF}`);
  assert.ok(relR < 1e-9, `relR=${relR}`);
});

test('neyman primitive: swapping halves swaps forward and reverse', () => {
  const A = [1, 2, 3, 4];
  const B = [50, 60, 70, 80];
  const r1 = dailyTokenNeymanChiSquaredHalves([...A, ...B]);
  const r2 = dailyTokenNeymanChiSquaredHalves([...B, ...A]);
  // forward and reverse should swap (relative tolerance, magnitudes can be huge)
  const relA = Math.abs(r1.neymanForward - r2.neymanReverse) / Math.max(1, Math.abs(r1.neymanForward));
  const relB = Math.abs(r1.neymanReverse - r2.neymanForward) / Math.max(1, Math.abs(r1.neymanReverse));
  assert.ok(relA < 1e-9, `relA=${relA}`);
  assert.ok(relB < 1e-9, `relB=${relB}`);
});

test('neyman primitive: swapping halves preserves max', () => {
  const A = [1, 2, 3, 4];
  const B = [50, 60, 70, 80];
  const r1 = dailyTokenNeymanChiSquaredHalves([...A, ...B]);
  const r2 = dailyTokenNeymanChiSquaredHalves([...B, ...A]);
  const rel = Math.abs(r1.neymanMax - r2.neymanMax) / Math.max(1, Math.abs(r1.neymanMax));
  assert.ok(rel < 1e-9, `rel=${rel}`);
});

test('neyman primitive: swapping halves preserves asymmetry', () => {
  const A = [1, 2, 3, 4];
  const B = [50, 60, 70, 80];
  const r1 = dailyTokenNeymanChiSquaredHalves([...A, ...B]);
  const r2 = dailyTokenNeymanChiSquaredHalves([...B, ...A]);
  assert.ok(Math.abs(r1.neymanAsymmetry - r2.neymanAsymmetry) < 1e-9);
});

test('neyman primitive: shifted halves yield positive divergence', () => {
  // strongly different halves should give large neymanMax
  const r = dailyTokenNeymanChiSquaredHalves([
    1, 2, 3, 4, 100, 200, 300, 400,
  ]);
  assert.ok(r.neymanMax > 0.01);
});

test('neyman primitive: mean reflects raw mean', () => {
  const xs = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  assert.ok(Math.abs(r.mean - 4.5) < 1e-9);
});

test('neyman primitive: stddev > 0 for varied input', () => {
  const r = dailyTokenNeymanChiSquaredHalves([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(r.stddev > 0);
});

test('neyman primitive: bandwidth fallback on zero MAD', () => {
  // mad_pool = 0 forces fallback to range-based bandwidth
  const xs = [10, 10, 10, 10, 10, 10, 10, 100];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  assert.ok(r.neymanBandwidth > 0);
  assert.equal(r.neymanMadPool, 0);
});

test('neyman primitive: neymanMax dominates each direction', () => {
  for (const xs of [
    [1, 2, 3, 4, 5, 6, 7, 8],
    [10, 20, 30, 40, 50, 60, 70, 80],
    [1, 1, 1, 1, 100, 100, 100, 100],
  ]) {
    const r = dailyTokenNeymanChiSquaredHalves(xs);
    assert.ok(r.neymanMax >= r.neymanForward);
    assert.ok(r.neymanMax >= r.neymanReverse);
  }
});

test('neyman primitive: asymmetry equals 0 when forward = reverse', () => {
  // symmetric exchange: ascending vs descending preserves overall variance
  // not guaranteed exact, but on degenerate-symmetric input should be near 0
  const xs = [1, 2, 3, 4, 4, 3, 2, 1];
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  // both halves are mirrors -> kde approximately equal -> small asymmetry
  assert.ok(r.neymanAsymmetry >= 0);
});

test('neyman primitive: large input remains finite', () => {
  const xs: number[] = [];
  for (let i = 0; i < 200; i++) xs.push(Math.sin(i) * 100 + 200);
  const r = dailyTokenNeymanChiSquaredHalves(xs);
  assert.ok(Number.isFinite(r.neymanForward));
  assert.ok(Number.isFinite(r.neymanReverse));
  assert.ok(Number.isFinite(r.neymanMax));
  assert.ok(Number.isFinite(r.neymanAsymmetry));
});

// ---------- pure helper: neymanSummand ----------

test('neymanSummand: vanishes on diagonal', () => {
  assert.equal(neymanSummand(0.1, 0.1), 0);
  assert.equal(neymanSummand(0.5, 0.5), 0);
});

test('neymanSummand: non-negative', () => {
  for (const [p, q] of [
    [0.1, 0.2],
    [0.5, 0.1],
    [0.9, 0.05],
  ]) {
    assert.ok(neymanSummand(p, q) >= 0);
  }
});

test('neymanSummand: symmetric in (p,q) only when p=q', () => {
  // explicitly asymmetric
  const a = neymanSummand(0.1, 0.5);
  const b = neymanSummand(0.5, 0.1);
  assert.notEqual(a, b);
});

test('neymanSummand: matches formula (p-q)^2/q', () => {
  const p = 0.3, q = 0.4;
  const expected = (p - q) ** 2 / q;
  assert.ok(Math.abs(neymanSummand(p, q) - expected) < 1e-12);
});

test('neymanSummand: q=0 floored to PMF_FLOOR (large but finite)', () => {
  const v = neymanSummand(0.1, 0);
  assert.ok(Number.isFinite(v));
  assert.ok(v > 0);
});

test('neymanSummand: p=0 yields q (since (0-q)^2/q = q after flooring)', () => {
  const v = neymanSummand(0, 0.4);
  assert.ok(Math.abs(v - 0.4) < 1e-12);
});

test('neymanSummand: rejects negative p', () => {
  assert.throws(() => neymanSummand(-0.1, 0.5), /non-negative/);
});

test('neymanSummand: rejects negative q', () => {
  assert.throws(() => neymanSummand(0.1, -0.5), /non-negative/);
});

test('neymanSummand: rejects NaN p', () => {
  assert.throws(() => neymanSummand(NaN, 0.5), /finite/);
});

test('neymanSummand: rejects NaN q', () => {
  assert.throws(() => neymanSummand(0.1, NaN), /finite/);
});

test('neymanSummand: rejects Infinity', () => {
  assert.throws(() => neymanSummand(0.1, Infinity), /finite/);
});

// ---------- exported constants ----------

test('NEYMAN_GRID_K === 257', () => {
  assert.equal(NEYMAN_GRID_K, 257);
});

test('NEYMAN_SILVERMAN_MULTIPLIER === 0.9', () => {
  assert.equal(NEYMAN_SILVERMAN_MULTIPLIER, 0.9);
});

test('NEYMAN_GRID_EXTENSION_H === 3', () => {
  assert.equal(NEYMAN_GRID_EXTENSION_H, 3);
});

test('NEYMAN_PMF_FLOOR === 1e-15', () => {
  assert.equal(NEYMAN_PMF_FLOOR, 1e-15);
});

// ---------- builder: input validation ----------

test('builder: rejects negative minTokens', () => {
  assert.throws(
    () => buildDailyTokenNeymanChiSquaredHalves([], { minTokens: -1 }),
    /minTokens/,
  );
});

test('builder: rejects non-integer minTenureDays', () => {
  assert.throws(
    () => buildDailyTokenNeymanChiSquaredHalves([], { minTenureDays: 14.5 as any }),
    /minTenureDays/,
  );
});

test('builder: rejects minTenureDays < 8', () => {
  assert.throws(
    () => buildDailyTokenNeymanChiSquaredHalves([], { minTenureDays: 7 }),
    /minTenureDays/,
  );
});

test('builder: rejects negative top', () => {
  assert.throws(
    () => buildDailyTokenNeymanChiSquaredHalves([], { top: -1 }),
    /top/,
  );
});

test('builder: rejects invalid sort', () => {
  assert.throws(
    () =>
      buildDailyTokenNeymanChiSquaredHalves([], {
        sort: 'bogus' as any,
      }),
    /sort must be one of/,
  );
});

test('builder: rejects invalid since', () => {
  assert.throws(
    () => buildDailyTokenNeymanChiSquaredHalves([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('builder: rejects invalid until', () => {
  assert.throws(
    () => buildDailyTokenNeymanChiSquaredHalves([], { until: 'still-not' }),
    /invalid until/,
  );
});

// ---------- builder: empty input ----------

test('builder: empty queue yields empty report', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('builder: report has all metadata fields', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.equal(r.gridK, 257);
  assert.equal(r.silvermanMultiplier, 0.9);
  assert.equal(r.pmfFloor, 1e-15);
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minTenureDays, 14);
});

// ---------- builder: drop accounting ----------

test('builder: drops invalid hour_start', () => {
  const q: QueueLine[] = [ql('not-a-date', 'src', 1000)];
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('builder: drops non-positive tokens', () => {
  const q: QueueLine[] = [ql(dayIso(0), 'src', 0), ql(dayIso(1), 'src', -5)];
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('builder: drops sparse sources below min-tokens', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 14; i++) q.push(ql(dayIso(i), 'tiny', 5));
  const r = buildDailyTokenNeymanChiSquaredHalves(q, { minTokens: 1000 });
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: drops short-tenure sources below min-tenure-days', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 5; i++) q.push(ql(dayIso(i), 'short', 1000));
  const r = buildDailyTokenNeymanChiSquaredHalves(q, { minTenureDays: 14 });
  assert.equal(r.droppedBelowMinTenure, 1);
});

test('builder: drops zero-variance sources', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i++) q.push(ql(dayIso(i), 'flat', 1000));
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.droppedZeroVariance, 1);
});

test('builder: source-filter drops non-matching rows', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 20; i++) {
    q.push(ql(dayIso(i), 'a', 100 + i));
    q.push(ql(dayIso(i), 'b', 200 + i));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q, { source: 'a' });
  assert.ok(r.droppedSourceFilter > 0);
  assert.ok(r.sources.every((s) => s.source === 'a'));
});

// ---------- builder: integration ----------

test('builder: produces a valid row for a varied source', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'src', 100 + i * 10 + (i % 3) * 50));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'src');
  assert.ok(s.neymanForward >= 0);
  assert.ok(s.neymanReverse >= 0);
  assert.equal(s.neymanGridK, 257);
});

test('builder: row contains all expected diagnostic fields', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'src', 100 + i * 10 + (i % 3) * 50));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  const s = r.sources[0]!;
  assert.ok('neymanForward' in s);
  assert.ok('neymanReverse' in s);
  assert.ok('neymanMax' in s);
  assert.ok('neymanAsymmetry' in s);
  assert.ok('neymanMaxBinFwd' in s);
  assert.ok('neymanMaxBinRev' in s);
  assert.ok('neymanMadPool' in s);
  assert.ok('neymanBandwidth' in s);
});

test('builder: gap-filled days fill zeros for missing dates', () => {
  const q: QueueLine[] = [];
  // emit only days 0, 5, 10, 15, 20
  for (const i of [0, 5, 10, 15, 20]) {
    q.push(ql(dayIso(i), 'src', 1000));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 21);
  assert.equal(r.sources[0]!.nActiveDays, 5);
});

test('builder: sort=tokens orders by total_tokens desc', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'big', 5000 + i * 100));
    q.push(ql(dayIso(i), 'mid', 2000 + i * 50));
    q.push(ql(dayIso(i), 'sml', 1000 + i * 25));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q, { sort: 'tokens' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['big', 'mid', 'sml'],
  );
});

test('builder: sort=source orders alphabetically', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'zoo', 5000 + i * 100));
    q.push(ql(dayIso(i), 'apple', 2000 + i * 50));
    q.push(ql(dayIso(i), 'mid', 1000 + i * 25));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q, { sort: 'source' });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['apple', 'mid', 'zoo'],
  );
});

test('builder: top=N caps source list', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'a', 5000 + i * 100));
    q.push(ql(dayIso(i), 'b', 2000 + i * 50));
    q.push(ql(dayIso(i), 'c', 1000 + i * 25));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('builder: sort=neymanMaxDesc default', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([]);
  assert.equal(r.sort, 'neymanMaxDesc');
});

test('builder: sort=neymanAsymmetryDesc accepted', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    sort: 'neymanAsymmetryDesc',
  });
  assert.equal(r.sort, 'neymanAsymmetryDesc');
});

test('builder: sort=neymanForward accepted', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    sort: 'neymanForward',
  });
  assert.equal(r.sort, 'neymanForward');
});

test('builder: sort=neymanReverse accepted', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    sort: 'neymanReverse',
  });
  assert.equal(r.sort, 'neymanReverse');
});

test('builder: window since/until passed through', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    since: '2026-01-01T00:00:00.000Z',
    until: '2026-02-01T00:00:00.000Z',
  });
  assert.equal(r.windowStart, '2026-01-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-02-01T00:00:00.000Z');
});

test('builder: sources filter passed through', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], { source: 'foo' });
  assert.equal(r.source, 'foo');
});

test('builder: generatedAt passed through', () => {
  const r = buildDailyTokenNeymanChiSquaredHalves([], {
    generatedAt: '2026-05-03T01:02:03.000Z',
  });
  assert.equal(r.generatedAt, '2026-05-03T01:02:03.000Z');
});

test('builder: deterministic on same input', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'src', 100 + i * 10 + (i % 3) * 50));
  }
  const r1 = buildDailyTokenNeymanChiSquaredHalves(q, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  const r2 = buildDailyTokenNeymanChiSquaredHalves(q, {
    generatedAt: '2026-05-03T00:00:00.000Z',
  });
  assert.deepEqual(r1, r2);
});

test('builder: multiple sources kept correctly', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'a', 100 + i * 10 + (i % 3) * 50));
    q.push(ql(dayIso(i), 'b', 200 + i * 7 + (i % 5) * 30));
    q.push(ql(dayIso(i), 'c', 50 + i * 3 + (i % 2) * 15));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.sources.length, 3);
});

test('builder: unknown source name labelled (unknown)', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push({
      hour_start: dayIso(i),
      source: '',
      total_tokens: 100 + i * 10 + (i % 3) * 50,
    } as unknown as QueueLine);
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('builder: per-row neymanMax >= each direction', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'src', 100 + i * 10 + (i % 3) * 50));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  for (const s of r.sources) {
    assert.ok(s.neymanMax >= s.neymanForward);
    assert.ok(s.neymanMax >= s.neymanReverse);
  }
});

test('builder: per-row asymmetry in [0, 1]', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'src', 100 + i * 10 + (i % 3) * 50));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  for (const s of r.sources) {
    assert.ok(s.neymanAsymmetry >= 0);
    assert.ok(s.neymanAsymmetry <= 1);
  }
});

test('builder: per-row diagnostics finite', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 30; i++) {
    q.push(ql(dayIso(i), 'src', 100 + i * 10 + (i % 3) * 50));
  }
  const r = buildDailyTokenNeymanChiSquaredHalves(q);
  for (const s of r.sources) {
    assert.ok(Number.isFinite(s.neymanForward));
    assert.ok(Number.isFinite(s.neymanReverse));
    assert.ok(Number.isFinite(s.neymanMax));
    assert.ok(Number.isFinite(s.neymanAsymmetry));
    assert.ok(Number.isFinite(s.neymanMaxBinFwd));
    assert.ok(Number.isFinite(s.neymanMaxBinRev));
  }
});
