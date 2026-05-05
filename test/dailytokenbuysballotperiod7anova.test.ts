import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenBuysBallotPeriod7Anova,
  buildDailyTokenBuysBallotPeriod7Anova,
  partitionBuysBallotPeriod7,
  fDistributionUpperTailBuysBallot,
  regularisedIncompleteBetaBuysBallot,
  lnGammaBuysBallot,
} from '../src/dailytokenbuysballotperiod7anova.js';
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

// ---------- lnGammaBuysBallot ----------

test('lnGammaBuysBallot(1) === lnGamma(2) === 0', () => {
  assert.ok(Math.abs(lnGammaBuysBallot(1)) < 1e-9);
  assert.ok(Math.abs(lnGammaBuysBallot(2)) < 1e-9);
});

test('lnGammaBuysBallot matches factorial: Gamma(n+1) = n!', () => {
  for (let n = 1; n <= 10; n += 1) {
    let fact = 1;
    for (let k = 2; k <= n; k += 1) fact *= k;
    const expected = Math.log(fact);
    const got = lnGammaBuysBallot(n + 1);
    assert.ok(Math.abs(got - expected) < 1e-8, `n=${n} expected=${expected} got=${got}`);
  }
});

test('lnGammaBuysBallot(0.5) === log(sqrt(pi))', () => {
  const expected = 0.5 * Math.log(Math.PI);
  assert.ok(Math.abs(lnGammaBuysBallot(0.5) - expected) < 1e-8);
});

test('lnGammaBuysBallot rejects non-positive and non-finite', () => {
  assert.throws(() => lnGammaBuysBallot(0));
  assert.throws(() => lnGammaBuysBallot(-1));
  assert.throws(() => lnGammaBuysBallot(Number.NaN));
  assert.throws(() => lnGammaBuysBallot(Number.POSITIVE_INFINITY));
});

// ---------- regularisedIncompleteBetaBuysBallot ----------

test('regularisedIncompleteBeta(0, a, b) === 0', () => {
  assert.equal(regularisedIncompleteBetaBuysBallot(0, 3, 21), 0);
});

test('regularisedIncompleteBeta(1, a, b) === 1', () => {
  assert.equal(regularisedIncompleteBetaBuysBallot(1, 3, 21), 1);
});

test('regularisedIncompleteBeta symmetry: I_x(a,b) + I_{1-x}(b,a) === 1', () => {
  for (const [x, a, b] of [
    [0.3, 3, 10],
    [0.5, 3, 21],
    [0.7, 6, 50],
    [0.1, 5, 5],
  ] as const) {
    const left = regularisedIncompleteBetaBuysBallot(x, a, b);
    const right = regularisedIncompleteBetaBuysBallot(1 - x, b, a);
    assert.ok(Math.abs(left + right - 1) < 1e-8, `x=${x} a=${a} b=${b}`);
  }
});

test('regularisedIncompleteBeta is monotone non-decreasing in x', () => {
  let prev = -1;
  for (let k = 0; k <= 20; k += 1) {
    const x = k / 20;
    const v = regularisedIncompleteBetaBuysBallot(x, 3, 21);
    assert.ok(v >= prev - 1e-12, `monotonicity violated at x=${x}`);
    prev = v;
  }
});

test('regularisedIncompleteBeta result is in [0, 1]', () => {
  for (const x of [0.05, 0.25, 0.5, 0.75, 0.95]) {
    const v = regularisedIncompleteBetaBuysBallot(x, 3, 21);
    assert.ok(v >= 0 && v <= 1, `x=${x} v=${v}`);
  }
});

test('regularisedIncompleteBeta rejects out-of-range', () => {
  assert.throws(() => regularisedIncompleteBetaBuysBallot(-0.1, 3, 21));
  assert.throws(() => regularisedIncompleteBetaBuysBallot(1.1, 3, 21));
  assert.throws(() => regularisedIncompleteBetaBuysBallot(Number.NaN, 3, 21));
  assert.throws(() => regularisedIncompleteBetaBuysBallot(0.5, 0, 21));
  assert.throws(() => regularisedIncompleteBetaBuysBallot(0.5, 3, -1));
});

// ---------- fDistributionUpperTailBuysBallot ----------

test('F upper tail: f <= 0 -> 1', () => {
  assert.equal(fDistributionUpperTailBuysBallot(0, 6, 21), 1);
  assert.equal(fDistributionUpperTailBuysBallot(-5, 6, 21), 1);
});

test('F upper tail: f = +inf -> 0', () => {
  assert.equal(fDistributionUpperTailBuysBallot(Number.POSITIVE_INFINITY, 6, 21), 0);
});

test('F upper tail at critical value F(6,21) at alpha=0.05', () => {
  // Standard table: F_{6,21,0.05} ~~ 2.5727
  const p = fDistributionUpperTailBuysBallot(2.5727, 6, 21);
  assert.ok(Math.abs(p - 0.05) < 0.005, `expected ~0.05 got ${p}`);
});

test('F upper tail at critical F(6,40) at alpha=0.01', () => {
  // F_{6,40,0.01} ~~ 3.291
  const p = fDistributionUpperTailBuysBallot(3.291, 6, 40);
  assert.ok(Math.abs(p - 0.01) < 0.005, `expected ~0.01 got ${p}`);
});

test('F upper tail is monotone non-increasing in f', () => {
  let prev = 2;
  for (const f of [0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 4.0, 5.0, 10.0]) {
    const p = fDistributionUpperTailBuysBallot(f, 6, 21);
    assert.ok(p <= prev + 1e-12, `monotonicity violated at f=${f}`);
    prev = p;
  }
});

test('F upper tail rejects bad DOFs', () => {
  assert.throws(() => fDistributionUpperTailBuysBallot(2, 0, 21));
  assert.throws(() => fDistributionUpperTailBuysBallot(2, 6, 0));
  assert.throws(() => fDistributionUpperTailBuysBallot(2, -1, 21));
  assert.throws(() => fDistributionUpperTailBuysBallot(Number.NaN, 6, 21));
});

// ---------- partitionBuysBallotPeriod7 ----------

test('partitionBuysBallotPeriod7: column counts always length 7 and sum to n', () => {
  for (const n of [7, 14, 28, 35, 100]) {
    const v = new Array<number>(n).fill(0).map((_, i) => i);
    const p = partitionBuysBallotPeriod7(v);
    assert.equal(p.bbColumnCounts.length, 7);
    let sum = 0;
    for (const c of p.bbColumnCounts) sum += c;
    assert.equal(sum, n);
  }
});

test('partitionBuysBallotPeriod7: n=7k -> every column count = k', () => {
  for (const k of [1, 2, 4, 10, 25]) {
    const v = new Array<number>(7 * k).fill(0).map((_, i) => i);
    const p = partitionBuysBallotPeriod7(v);
    for (const c of p.bbColumnCounts) assert.equal(c, k);
  }
});

test('partitionBuysBallotPeriod7: SS_between + SS_within == SS_total (within float)', () => {
  const v = [
    3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3,
    3, 8, 3, 2, 7, 9, 5, 0, 2, 8,
  ];
  const p = partitionBuysBallotPeriod7(v);
  const sum = p.bbSsBetween + p.bbSsWithin;
  assert.ok(Math.abs(sum - p.bbSsTotal) < 1e-8 * Math.max(1, p.bbSsTotal));
});

test('partitionBuysBallotPeriod7: all-equal -> all SS = 0', () => {
  const v = new Array<number>(28).fill(7);
  const p = partitionBuysBallotPeriod7(v);
  assert.equal(p.bbSsBetween, 0);
  assert.equal(p.bbSsWithin, 0);
  assert.equal(p.bbSsTotal, 0);
});

test('partitionBuysBallotPeriod7: perfect period-7 staircase -> SsWithin = 0', () => {
  // v[i] = i mod 7 -> within each column all values equal
  const v = new Array<number>(35).fill(0).map((_, i) => i % 7);
  const p = partitionBuysBallotPeriod7(v);
  assert.ok(Math.abs(p.bbSsWithin) < 1e-9);
  assert.ok(p.bbSsBetween > 0);
  assert.ok(Math.abs(p.bbSsBetween - p.bbSsTotal) < 1e-8 * p.bbSsTotal);
});

test('partitionBuysBallotPeriod7: cyclic shift preserves SS values', () => {
  const baseV = new Array<number>(28).fill(0).map((_, i) => Math.sin(i * 0.6) + 0.01 * i);
  const base = partitionBuysBallotPeriod7(baseV);
  for (let shift = 1; shift <= 6; shift += 1) {
    const shifted = baseV.slice(shift).concat(baseV.slice(0, shift));
    const p = partitionBuysBallotPeriod7(shifted);
    assert.ok(Math.abs(p.bbSsBetween - base.bbSsBetween) < 1e-8 * Math.max(1, base.bbSsBetween));
    assert.ok(Math.abs(p.bbSsWithin - base.bbSsWithin) < 1e-8 * Math.max(1, base.bbSsWithin));
    assert.ok(Math.abs(p.bbSsTotal - base.bbSsTotal) < 1e-8 * Math.max(1, base.bbSsTotal));
  }
});

test('partitionBuysBallotPeriod7: translation invariance -> SS unchanged', () => {
  const baseV = new Array<number>(28).fill(0).map((_, i) => i * 1.7);
  const base = partitionBuysBallotPeriod7(baseV);
  const shifted = baseV.map((x) => x + 1000);
  const p = partitionBuysBallotPeriod7(shifted);
  assert.ok(Math.abs(p.bbSsBetween - base.bbSsBetween) < 1e-6 * Math.max(1, base.bbSsBetween));
  assert.ok(Math.abs(p.bbSsWithin - base.bbSsWithin) < 1e-6 * Math.max(1, base.bbSsWithin));
  assert.ok(Math.abs(p.bbSsTotal - base.bbSsTotal) < 1e-6 * Math.max(1, base.bbSsTotal));
});

test('partitionBuysBallotPeriod7: scale homogeneity -> SS scales by a^2', () => {
  const baseV = new Array<number>(28).fill(0).map((_, i) => i * 1.7 + Math.cos(i));
  const base = partitionBuysBallotPeriod7(baseV);
  const a = 3.5;
  const scaled = baseV.map((x) => a * x);
  const p = partitionBuysBallotPeriod7(scaled);
  const sq = a * a;
  assert.ok(Math.abs(p.bbSsBetween - sq * base.bbSsBetween) < 1e-6 * Math.max(1, sq * base.bbSsBetween));
  assert.ok(Math.abs(p.bbSsWithin - sq * base.bbSsWithin) < 1e-6 * Math.max(1, sq * base.bbSsWithin));
  assert.ok(Math.abs(p.bbSsTotal - sq * base.bbSsTotal) < 1e-6 * Math.max(1, sq * base.bbSsTotal));
});

test('partitionBuysBallotPeriod7: empty / short -> column counts still sum correctly', () => {
  const p0 = partitionBuysBallotPeriod7([]);
  let s0 = 0;
  for (const c of p0.bbColumnCounts) s0 += c;
  assert.equal(s0, 0);
  const p3 = partitionBuysBallotPeriod7([1, 2, 3]);
  let s3 = 0;
  for (const c of p3.bbColumnCounts) s3 += c;
  assert.equal(s3, 3);
});

// ---------- dailyTokenBuysBallotPeriod7Anova ----------

test('dailyTokenBuysBallotPeriod7Anova: rejects n < 28', () => {
  const v = new Array<number>(27).fill(0).map((_, i) => i + 1);
  assert.throws(() => dailyTokenBuysBallotPeriod7Anova(v));
});

test('dailyTokenBuysBallotPeriod7Anova: accepts n = 28 minimum', () => {
  const v = new Array<number>(28).fill(0).map((_, i) => i + 1 + 0.01 * Math.sin(i));
  const r = dailyTokenBuysBallotPeriod7Anova(v);
  assert.equal(r.nSamples, 28);
  assert.equal(r.bbDfBetween, 6);
  assert.equal(r.bbDfWithin, 21);
});

test('dailyTokenBuysBallotPeriod7Anova: rejects non-finite values', () => {
  const v = new Array<number>(28).fill(0).map((_, i) => i);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenBuysBallotPeriod7Anova(v));
});

test('dailyTokenBuysBallotPeriod7Anova: rejects all-equal (zero variance)', () => {
  const v = new Array<number>(28).fill(7);
  assert.throws(() => dailyTokenBuysBallotPeriod7Anova(v));
});

test('dailyTokenBuysBallotPeriod7Anova: bbF >= 0 always', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const v = new Array<number>(35).fill(0).map((_, i) => Math.sin(i * seed * 0.13) + 0.001 * i);
    const r = dailyTokenBuysBallotPeriod7Anova(v);
    assert.ok(r.bbF >= 0, `bbF negative at seed=${seed}: ${r.bbF}`);
  }
});

test('dailyTokenBuysBallotPeriod7Anova: bbEta2 in [0, 1]', () => {
  for (let seed = 1; seed <= 20; seed += 1) {
    const v = new Array<number>(35).fill(0).map((_, i) => Math.sin(i * seed * 0.13) + 0.001 * i);
    const r = dailyTokenBuysBallotPeriod7Anova(v);
    assert.ok(r.bbEta2 >= 0 && r.bbEta2 <= 1, `bbEta2 out of range at seed=${seed}: ${r.bbEta2}`);
  }
});

test('dailyTokenBuysBallotPeriod7Anova: translation invariance bbF(x+c) = bbF(x)', () => {
  const baseV = new Array<number>(35).fill(0).map((_, i) => i * 1.7 + Math.sin(i));
  const base = dailyTokenBuysBallotPeriod7Anova(baseV);
  const shifted = baseV.map((x) => x + 9999);
  const r = dailyTokenBuysBallotPeriod7Anova(shifted);
  assert.ok(Math.abs(r.bbF - base.bbF) < 1e-6 * Math.max(1, base.bbF));
  assert.ok(Math.abs(r.bbEta2 - base.bbEta2) < 1e-9);
});

test('dailyTokenBuysBallotPeriod7Anova: positive scale invariance bbF(a*x) = bbF(x)', () => {
  const baseV = new Array<number>(35).fill(0).map((_, i) => i * 1.7 + Math.sin(i));
  const base = dailyTokenBuysBallotPeriod7Anova(baseV);
  for (const a of [0.5, 2.0, 100.0]) {
    const scaled = baseV.map((x) => a * x);
    const r = dailyTokenBuysBallotPeriod7Anova(scaled);
    assert.ok(Math.abs(r.bbF - base.bbF) < 1e-6 * Math.max(1, base.bbF), `a=${a}`);
    assert.ok(Math.abs(r.bbEta2 - base.bbEta2) < 1e-9, `a=${a}`);
  }
});

test('dailyTokenBuysBallotPeriod7Anova: sign invariance bbF(-x) = bbF(x)', () => {
  const baseV = new Array<number>(35).fill(0).map((_, i) => i * 1.7 + Math.sin(i));
  const base = dailyTokenBuysBallotPeriod7Anova(baseV);
  const neg = baseV.map((x) => -x);
  const r = dailyTokenBuysBallotPeriod7Anova(neg);
  assert.ok(Math.abs(r.bbF - base.bbF) < 1e-6 * Math.max(1, base.bbF));
});

test('dailyTokenBuysBallotPeriod7Anova: perfect period-7 staircase -> bbF = +inf, bbPValue = 0', () => {
  const v = new Array<number>(35).fill(0).map((_, i) => i % 7);
  const r = dailyTokenBuysBallotPeriod7Anova(v);
  assert.equal(r.bbF, Number.POSITIVE_INFINITY);
  assert.equal(r.bbPValue, 0);
  assert.ok(Math.abs(r.bbEta2 - 1) < 1e-9);
});

test('dailyTokenBuysBallotPeriod7Anova: linear trend has small bbEta2', () => {
  const v = new Array<number>(70).fill(0).map((_, i) => i * 100);
  const r = dailyTokenBuysBallotPeriod7Anova(v);
  // Pure linear -> all weekday means scattered around grand mean by O(constant), small fraction of total SS
  assert.ok(r.bbEta2 < 0.05, `linear trend gave bbEta2=${r.bbEta2}`);
});

test('dailyTokenBuysBallotPeriod7Anova: cyclic shift preserves bbF and bbEta2', () => {
  const baseV = new Array<number>(28).fill(0).map((_, i) => Math.sin(i * 0.6) + 0.01 * i);
  const base = dailyTokenBuysBallotPeriod7Anova(baseV);
  for (let shift = 1; shift <= 6; shift += 1) {
    const shifted = baseV.slice(shift).concat(baseV.slice(0, shift));
    const r = dailyTokenBuysBallotPeriod7Anova(shifted);
    assert.ok(Math.abs(r.bbF - base.bbF) < 1e-6 * Math.max(1, base.bbF), `shift=${shift}`);
    assert.ok(Math.abs(r.bbEta2 - base.bbEta2) < 1e-9, `shift=${shift}`);
  }
});

test('dailyTokenBuysBallotPeriod7Anova: bbDfBetween = 6, bbDfWithin = n - 7', () => {
  for (const n of [28, 35, 49, 100]) {
    const v = new Array<number>(n).fill(0).map((_, i) => i + 0.1 * Math.sin(i));
    const r = dailyTokenBuysBallotPeriod7Anova(v);
    assert.equal(r.bbDfBetween, 6);
    assert.equal(r.bbDfWithin, n - 7);
  }
});

test('dailyTokenBuysBallotPeriod7Anova: column counts sum to n', () => {
  for (const n of [28, 35, 49, 100]) {
    const v = new Array<number>(n).fill(0).map((_, i) => i + 0.1 * Math.sin(i));
    const r = dailyTokenBuysBallotPeriod7Anova(v);
    let s = 0;
    for (const c of r.bbColumnCounts) s += c;
    assert.equal(s, n);
  }
});

test('dailyTokenBuysBallotPeriod7Anova: weekday-mean shift produces large bbF', () => {
  // Construct a series where Saturday (column index depends on phase but
  // we just want SOME column much larger than rest).
  const n = 49;
  const v = new Array<number>(n).fill(0).map((_, i) => (i % 7 === 5 ? 1000 : 10) + 0.01 * i);
  const r = dailyTokenBuysBallotPeriod7Anova(v);
  assert.ok(r.bbF > 100, `expected large F got ${r.bbF}`);
  assert.ok(r.bbPValue < 0.001, `expected tiny p got ${r.bbPValue}`);
  assert.ok(r.bbEta2 > 0.7, `expected large eta^2 got ${r.bbEta2}`);
});

// ---------- buildDailyTokenBuysBallotPeriod7Anova ----------

test('build: empty queue -> totalSources=0', () => {
  const r = buildDailyTokenBuysBallotPeriod7Anova([], { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('build: rejects bad minTokens', () => {
  assert.throws(() => buildDailyTokenBuysBallotPeriod7Anova([], { minTokens: -1 }));
  assert.throws(() => buildDailyTokenBuysBallotPeriod7Anova([], { minTokens: Number.NaN }));
});

test('build: rejects minTenureDays < 28', () => {
  assert.throws(() => buildDailyTokenBuysBallotPeriod7Anova([], { minTenureDays: 27 }));
  assert.throws(() => buildDailyTokenBuysBallotPeriod7Anova([], { minTenureDays: 0 }));
});

test('build: rejects bad sort key', () => {
  assert.throws(() =>
    buildDailyTokenBuysBallotPeriod7Anova([], { sort: 'nonsense' as never }),
  );
});

test('build: bad hour_start counted as droppedInvalidHourStart', () => {
  const q = [ql('not-a-date', 'a', 100), ql('zzz', 'a', 200)];
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.droppedInvalidHourStart, 2);
});

test('build: non-positive tokens counted', () => {
  const q = [ql(dayIso(0), 'a', 0), ql(dayIso(1), 'a', -5)];
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('build: source filter excludes non-matching', () => {
  const q = [ql(dayIso(0), 'a', 100), ql(dayIso(0), 'b', 200)];
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { source: 'a', generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.droppedSourceFilter, 1);
});

test('build: below min-tenure dropped', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 14; i += 1) q.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('build: zero-variance dropped', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 35; i += 1) q.push(ql(dayIso(i), 'a', 1000));
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.droppedZeroVariance, 1);
});

test('build: real source produces a row with finite bbF and valid bbPValue', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 35; i += 1) {
    q.push(ql(dayIso(i), 'a', 1000 * (1 + 0.5 * Math.sin(i * 0.7) + 0.01 * i)));
  }
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.nTenureDays, 35);
  assert.ok(Number.isFinite(row.bbF) && row.bbF >= 0);
  assert.ok(row.bbPValue >= 0 && row.bbPValue <= 1);
  assert.ok(row.bbEta2 >= 0 && row.bbEta2 <= 1);
  assert.equal(row.bbDfBetween, 6);
  assert.equal(row.bbDfWithin, 28);
});

test('build: weekday-shifted source flagged with tiny p', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 49; i += 1) {
    q.push(ql(dayIso(i), 'a', i % 7 === 3 ? 100000 : 1000));
  }
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.bbF > 50, `expected large F got ${row.bbF}`);
  assert.ok(row.bbPValue < 0.0001, `expected tiny p got ${row.bbPValue}`);
});

test('build: sort bbFDesc orders sources by bbF descending', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 49; i += 1) {
    q.push(ql(dayIso(i), 'strong', i % 7 === 3 ? 100000 : 1000));
    q.push(ql(dayIso(i), 'weak', 1000 + i * 5));
  }
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { sort: 'bbFDesc', generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'strong');
  assert.equal(r.sources[1]!.source, 'weak');
  assert.ok(r.sources[0]!.bbF > r.sources[1]!.bbF);
});

test('build: sort bbPValue orders by p ascending', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 49; i += 1) {
    q.push(ql(dayIso(i), 'strong', i % 7 === 3 ? 100000 : 1000));
    q.push(ql(dayIso(i), 'weak', 1000 + i * 5));
  }
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { sort: 'bbPValue', generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.ok(r.sources[0]!.bbPValue <= r.sources[1]!.bbPValue);
});

test('build: top cap drops remainder', () => {
  const q: QueueLine[] = [];
  for (let s = 0; s < 5; s += 1) {
    for (let i = 0; i < 35; i += 1) {
      q.push(ql(dayIso(i), `src${s}`, 1000 + i * (s + 1) + 100 * Math.sin(i * (s + 1) * 0.3)));
    }
  }
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { top: 2, generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: since/until filter excludes out-of-range', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 70; i += 1) q.push(ql(dayIso(i), 'a', 1000 + Math.sin(i)));
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, {
    since: dayIso(10),
    until: dayIso(50),
    generatedAt: '2026-05-06T00:00:00.000Z',
  });
  // 40 days kept -> tenure 40 >= 28
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 40);
});

test('build: total sums match', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 35; i += 1) q.push(ql(dayIso(i), 'a', 1000 + i));
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  let expected = 0;
  for (let i = 0; i < 35; i += 1) expected += 1000 + i;
  assert.equal(r.totalTokens, expected);
});

test('build: respects generatedAt', () => {
  const r = buildDailyTokenBuysBallotPeriod7Anova([], {
    generatedAt: '2026-01-01T12:34:56.000Z',
  });
  assert.equal(r.generatedAt, '2026-01-01T12:34:56.000Z');
});

test('build: invalid since string throws', () => {
  assert.throws(() =>
    buildDailyTokenBuysBallotPeriod7Anova([], { since: 'not-a-date' }),
  );
});

test('build: invalid until string throws', () => {
  assert.throws(() =>
    buildDailyTokenBuysBallotPeriod7Anova([], { until: 'not-a-date' }),
  );
});

test('build: bad top throws', () => {
  assert.throws(() =>
    buildDailyTokenBuysBallotPeriod7Anova([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenBuysBallotPeriod7Anova([], { top: 1.5 }),
  );
});

test('build: gap-fill produces zeros for missing days; does not break tenure count', () => {
  const q: QueueLine[] = [];
  // active on days 0,1,2 then again on day 30 -- 31-day tenure with many zero-padded days
  q.push(ql(dayIso(0), 'a', 1000));
  q.push(ql(dayIso(1), 'a', 2000));
  q.push(ql(dayIso(2), 'a', 1500));
  q.push(ql(dayIso(30), 'a', 5000));
  const r = buildDailyTokenBuysBallotPeriod7Anova(q, { generatedAt: '2026-05-06T00:00:00.000Z' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nTenureDays, 31);
  assert.equal(r.sources[0]!.nActiveDays, 4);
});
