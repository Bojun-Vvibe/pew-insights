import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenYuenWelchHalves,
  buildDailyTokenYuenWelchHalves,
  trimmedMean,
  winsorizedVarianceContribution,
  studentTTwoSidedSurvival,
  regularisedIncompleteBeta,
  lnGamma,
  inverseStandardNormalCdf,
  standardNormalUpperTailYw,
  aggregateYuenWelchHalves,
  labelYuenWelchHalvesRow,
} from '../src/dailytokenyuenwelchhalves.js';
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

// ---------- primitive: lnGamma ----------

test('yw: lnGamma(1) === 0 within 1e-6', () => {
  assert.ok(Math.abs(lnGamma(1)) < 1e-6);
});

test('yw: lnGamma(2) === 0 within 1e-6', () => {
  assert.ok(Math.abs(lnGamma(2)) < 1e-6);
});

test('yw: lnGamma(0.5) ~ ln(sqrt(pi))', () => {
  const expected = Math.log(Math.sqrt(Math.PI));
  assert.ok(Math.abs(lnGamma(0.5) - expected) < 1e-6);
});

test('yw: lnGamma throws on non-positive', () => {
  assert.throws(() => lnGamma(0));
  assert.throws(() => lnGamma(-1));
});

// ---------- primitive: regularisedIncompleteBeta ----------

test('yw: I_0(a, b) === 0 and I_1(a, b) === 1', () => {
  assert.equal(regularisedIncompleteBeta(0, 2, 3), 0);
  assert.equal(regularisedIncompleteBeta(1, 2, 3), 1);
});

test('yw: I_0.5(1, 1) === 0.5 (uniform cdf)', () => {
  assert.ok(Math.abs(regularisedIncompleteBeta(0.5, 1, 1) - 0.5) < 1e-9);
});

test('yw: I throws on bad inputs', () => {
  assert.throws(() => regularisedIncompleteBeta(-0.1, 1, 1));
  assert.throws(() => regularisedIncompleteBeta(1.1, 1, 1));
  assert.throws(() => regularisedIncompleteBeta(0.5, -1, 1));
});

// ---------- primitive: studentTTwoSidedSurvival ----------

test('yw: t-survival(0, df) === 1', () => {
  assert.equal(studentTTwoSidedSurvival(0, 10), 1);
});

test('yw: t-survival(1.96, 1e6) ~ 0.05 (asymptotically normal)', () => {
  const p = studentTTwoSidedSurvival(1.96, 1e6);
  assert.ok(Math.abs(p - 0.05) < 1e-3);
});

test('yw: t-survival(2.776, 4) ~ 0.05 (Student-t critical value)', () => {
  // t_{0.025, 4} = 2.776
  const p = studentTTwoSidedSurvival(2.776, 4);
  assert.ok(Math.abs(p - 0.05) < 5e-4, `p=${p}`);
});

test('yw: t-survival(2.262, 9) ~ 0.05 (Student-t critical value)', () => {
  // t_{0.025, 9} = 2.262
  const p = studentTTwoSidedSurvival(2.262, 9);
  assert.ok(Math.abs(p - 0.05) < 5e-4, `p=${p}`);
});

test('yw: t-survival symmetric in sign', () => {
  for (const t of [0.5, 1, 2, 3]) {
    const a = studentTTwoSidedSurvival(t, 5);
    const b = studentTTwoSidedSurvival(-t, 5);
    assert.ok(Math.abs(a - b) < 1e-9);
  }
});

test('yw: t-survival throws on non-positive df', () => {
  assert.throws(() => studentTTwoSidedSurvival(1, 0));
  assert.throws(() => studentTTwoSidedSurvival(1, -1));
});

// ---------- primitive: trimmedMean ----------

test('yw: trimmedMean g=0 === plain mean', () => {
  const xs = [1, 2, 3, 4, 5];
  assert.equal(trimmedMean(xs, 0), 3);
});

test('yw: trimmedMean g=1 drops min and max', () => {
  const xs = [1, 2, 3, 4, 100];
  // sorted = [1,2,3,4,100]; trim 1 -> [2,3,4]; mean = 3
  assert.equal(trimmedMean(xs, 1), 3);
});

test('yw: trimmedMean throws on bad g', () => {
  assert.throws(() => trimmedMean([1, 2, 3], -1));
  assert.throws(() => trimmedMean([1, 2, 3], 2));
});

// ---------- primitive: winsorizedVarianceContribution ----------

test('yw: winsorizedVarianceContribution g=0 reduces to s2/((m)(m-1))', () => {
  const xs = [1, 2, 3, 4, 5];
  // mean = 3, ss = 10, h = 5, d = 10 / (5*4) = 0.5
  const d = winsorizedVarianceContribution(xs, 0);
  assert.ok(Math.abs(d - 0.5) < 1e-12);
});

test('yw: winsorizedVarianceContribution g=1 with extreme outlier', () => {
  // sorted = [1,2,3,4,1000]; winsorized = [2,2,3,4,4];
  // mean = 15/5 = 3; ss = 1+1+0+1+1 = 4; h = 3, d = 4/(3*2) = 2/3
  const d = winsorizedVarianceContribution([1, 2, 3, 4, 1000], 1);
  assert.ok(Math.abs(d - 2 / 3) < 1e-12);
});

test('yw: winsorizedVarianceContribution throws when h<2', () => {
  assert.throws(() => winsorizedVarianceContribution([1, 2, 3], 1));
});

// ---------- inverseStandardNormalCdf ----------

test('yw: inverseStandardNormalCdf(0.5) ~ 0', () => {
  assert.ok(Math.abs(inverseStandardNormalCdf(0.5)) < 1e-6);
});

test('yw: inverseStandardNormalCdf(0.975) ~ 1.96', () => {
  assert.ok(Math.abs(inverseStandardNormalCdf(0.975) - 1.96) < 1e-3);
});

test('yw: inverseStandardNormalCdf throws on boundary', () => {
  assert.throws(() => inverseStandardNormalCdf(0));
  assert.throws(() => inverseStandardNormalCdf(1));
});

// ---------- standardNormalUpperTailYw ----------

test('yw: standardNormalUpperTailYw(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailYw(0) - 0.5) < 1e-6);
});

test('yw: standardNormalUpperTailYw(1.96) ~ 0.025', () => {
  assert.ok(Math.abs(standardNormalUpperTailYw(1.96) - 0.025) < 1e-3);
});

// ---------- core: dailyTokenYuenWelchHalves ----------

test('yw: needs at least 16 samples', () => {
  assert.throws(() => dailyTokenYuenWelchHalves([1, 2, 3, 4, 5]));
});

test('yw: throws on non-finite values', () => {
  const xs = new Array(16).fill(0).map((_, i) => (i === 5 ? NaN : i));
  assert.throws(() => dailyTokenYuenWelchHalves(xs));
});

test('yw: throws on zero-variance input', () => {
  assert.throws(() => dailyTokenYuenWelchHalves(new Array(16).fill(7)));
});

test('yw: throws on bad trimFraction', () => {
  const xs = Array.from({ length: 16 }, (_, i) => i + 1);
  assert.throws(() => dailyTokenYuenWelchHalves(xs, -0.1));
  assert.throws(() => dailyTokenYuenWelchHalves(xs, 0.5));
});

test('yw: split sizes correct for n=20', () => {
  const xs = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenYuenWelchHalves(xs);
  assert.equal(r.ywN1, 10);
  assert.equal(r.ywN2, 10);
  assert.equal(r.ywG1, 2);
  assert.equal(r.ywG2, 2);
  assert.equal(r.ywH1, 6);
  assert.equal(r.ywH2, 6);
});

test('yw: monotone increasing series -> strongly positive ywT', () => {
  const xs = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = dailyTokenYuenWelchHalves(xs);
  assert.ok(r.ywT > 5, `ywT=${r.ywT}`);
  assert.ok(r.ywPValue < 1e-4, `ywPValue=${r.ywPValue}`);
});

test('yw: monotone decreasing series -> strongly negative ywT', () => {
  const xs = Array.from({ length: 30 }, (_, i) => 30 - i);
  const r = dailyTokenYuenWelchHalves(xs);
  assert.ok(r.ywT < -5, `ywT=${r.ywT}`);
  assert.ok(r.ywPValue < 1e-4, `ywPValue=${r.ywPValue}`);
});

test('yw: shift invariance ywT(x + c) === ywT(x)', () => {
  const base = Array.from({ length: 24 }, (_, i) => Math.sin(i) + i / 10);
  const shifted = base.map((v) => v + 100);
  const a = dailyTokenYuenWelchHalves(base);
  const b = dailyTokenYuenWelchHalves(shifted);
  assert.ok(Math.abs(a.ywT - b.ywT) < 1e-9);
  assert.ok(Math.abs(a.ywPValue - b.ywPValue) < 1e-9);
});

test('yw: scale invariance (positive) ywT(a*x) === ywT(x)', () => {
  const base = Array.from({ length: 24 }, (_, i) => Math.sin(i) + i / 10 + 5);
  const scaled = base.map((v) => 7 * v);
  const a = dailyTokenYuenWelchHalves(base);
  const b = dailyTokenYuenWelchHalves(scaled);
  assert.ok(Math.abs(a.ywT - b.ywT) < 1e-9, `${a.ywT} vs ${b.ywT}`);
});

test('yw: reversal antisymmetry ywT(reverse(x)) === -ywT(x) for n1=n2', () => {
  const xs = Array.from({ length: 20 }, (_, i) => Math.cos(i) + i / 5 + 10);
  const rev = [...xs].reverse();
  const a = dailyTokenYuenWelchHalves(xs);
  const b = dailyTokenYuenWelchHalves(rev);
  assert.ok(Math.abs(a.ywT + b.ywT) < 1e-9, `${a.ywT} vs ${b.ywT}`);
});

test('yw: pValue is two-sided in [0, 1]', () => {
  const xs = Array.from({ length: 25 }, (_, i) => Math.sin(i) + 5);
  const r = dailyTokenYuenWelchHalves(xs);
  assert.ok(r.ywPValue >= 0 && r.ywPValue <= 1);
});

test('yw: df is positive and finite', () => {
  const xs = Array.from({ length: 30 }, (_, i) => Math.sin(i / 3) + i / 5 + 3);
  const r = dailyTokenYuenWelchHalves(xs);
  assert.ok(r.ywDf > 0 && Number.isFinite(r.ywDf));
});

test('yw: gamma=0 collapses toward Welch t (sign matches)', () => {
  const xs = Array.from({ length: 30 }, (_, i) => i + 1);
  const r = dailyTokenYuenWelchHalves(xs, 0);
  assert.ok(r.ywG1 === 0 && r.ywG2 === 0);
  assert.ok(r.ywT > 0);
});

test('yw: noise series rarely produces |ywT| > 5', () => {
  // deterministic LCG noise
  let seed = 42;
  const xs = Array.from({ length: 30 }, () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) + 100;
  });
  const r = dailyTokenYuenWelchHalves(xs);
  assert.ok(Math.abs(r.ywT) < 5, `ywT=${r.ywT}`);
});

// ---------- buildDailyTokenYuenWelchHalves ----------

test('yw build: empty queue -> empty sources', () => {
  const r = buildDailyTokenYuenWelchHalves([]);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('yw build: single source produces one row', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 24; i += 1) {
    queue.push(ql(dayIso(i), 'src1', 100 + i * 10));
  }
  const r = buildDailyTokenYuenWelchHalves(queue);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'src1');
  assert.ok(r.sources[0]!.ywT > 0); // monotone increasing
});

test('yw build: minTenureDays floor 16 enforced', () => {
  assert.throws(() =>
    buildDailyTokenYuenWelchHalves([], { minTenureDays: 15 }),
  );
});

test('yw build: invalid sort throws', () => {
  assert.throws(() =>
    // @ts-expect-error intentional bad sort key
    buildDailyTokenYuenWelchHalves([], { sort: 'bogus' }),
  );
});

test('yw build: bad trimFraction throws', () => {
  assert.throws(() =>
    buildDailyTokenYuenWelchHalves([], { trimFraction: 0.5 }),
  );
  assert.throws(() =>
    buildDailyTokenYuenWelchHalves([], { trimFraction: -0.01 }),
  );
});

test('yw build: source filter restricts to one', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 100 + i));
    queue.push(ql(dayIso(i), 'b', 200 + i));
  }
  const r = buildDailyTokenYuenWelchHalves(queue, { source: 'a' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});

test('yw build: drops sparse sources below minTokens', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'tiny', 1));
  }
  const r = buildDailyTokenYuenWelchHalves(queue, { minTokens: 1000 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedSparseSources, 1);
});

test('yw build: drops zero-variance source', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 500));
  }
  const r = buildDailyTokenYuenWelchHalves(queue, { minTokens: 100 });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('yw build: drops invalid hour_start', () => {
  const queue: QueueLine[] = [ql('not-a-date', 'x', 100)];
  const r = buildDailyTokenYuenWelchHalves(queue);
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('yw build: drops non-positive tokens', () => {
  const queue: QueueLine[] = [ql(dayIso(0), 'x', 0), ql(dayIso(1), 'x', -5)];
  const r = buildDailyTokenYuenWelchHalves(queue);
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('yw build: top cap surfaces droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 20; i += 1) {
      queue.push(ql(dayIso(i), src, 100 + i + (src === 'a' ? 100 : 0)));
    }
  }
  const r = buildDailyTokenYuenWelchHalves(queue, { top: 2 });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('yw build: invalid since throws', () => {
  assert.throws(() =>
    buildDailyTokenYuenWelchHalves([], { since: 'garbage' }),
  );
});

test('yw build: sort by ywT orders ascending', () => {
  const queue: QueueLine[] = [];
  // src up: increasing -> ywT > 0; src down: decreasing -> ywT < 0
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'up', 100 + i * 10));
    queue.push(ql(dayIso(i), 'down', 1000 - i * 10));
  }
  const r = buildDailyTokenYuenWelchHalves(queue, { sort: 'ywT' });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.ywT < r.sources[1]!.ywT);
});

test('yw build: sort by ywTAbsDesc puts strongest |T| first', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat-ish', 500 + (i % 3))); // tiny shift
    queue.push(ql(dayIso(i), 'big-shift', 100 + i * 50));
  }
  const r = buildDailyTokenYuenWelchHalves(queue, { sort: 'ywTAbsDesc' });
  assert.equal(r.sources[0]!.source, 'big-shift');
});

// ---------- aggregator ----------

test('yw agg: empty rows -> rowsUsed=0, stoufferZ=0', () => {
  const r = aggregateYuenWelchHalves([]);
  assert.equal(r.rowsUsed, 0);
  assert.equal(r.stoufferZ, 0);
  assert.equal(r.stoufferTwoSidedPValue, 1);
});

test('yw agg: single row stoufferZ matches sign of ywT', () => {
  const r = aggregateYuenWelchHalves([
    { ywT: 2.5, ywPValue: 0.02, nTenureDays: 30 },
  ]);
  assert.equal(r.rowsUsed, 1);
  assert.ok(r.stoufferZ > 0);
});

test('yw agg: two equal-direction rows -> larger combined Z than each', () => {
  const r = aggregateYuenWelchHalves([
    { ywT: 2.0, ywPValue: 0.05, nTenureDays: 30 },
    { ywT: 2.5, ywPValue: 0.02, nTenureDays: 30 },
  ]);
  assert.ok(r.stoufferZ > 1.96);
});

test('yw agg: cancelling signs sum to ~zero', () => {
  const r = aggregateYuenWelchHalves([
    { ywT: 2.0, ywPValue: 0.05, nTenureDays: 30 },
    { ywT: -2.0, ywPValue: 0.05, nTenureDays: 30 },
  ]);
  assert.ok(Math.abs(r.stoufferZ) < 1e-9);
  assert.ok(Math.abs(r.stoufferTwoSidedPValue - 1) < 1e-6);
});

test('yw agg: skips malformed rows', () => {
  const r = aggregateYuenWelchHalves([
    { ywT: 1, ywPValue: 0.3, nTenureDays: 20 },
    { ywT: NaN, ywPValue: 0.5, nTenureDays: 20 },
    { ywT: 1, ywPValue: 1.5, nTenureDays: 20 },
    { ywT: 1, ywPValue: 0.5, nTenureDays: -1 },
  ]);
  assert.equal(r.rowsUsed, 1);
  assert.equal(r.rowsSkipped, 3);
});

test('yw agg: tenure-weighted mean uses nTenureDays weights', () => {
  const r = aggregateYuenWelchHalves([
    { ywT: 1, ywPValue: 0.3, nTenureDays: 10 },
    { ywT: 3, ywPValue: 0.3, nTenureDays: 30 },
  ]);
  // (10*1 + 30*3) / 40 = 100/40 = 2.5
  assert.ok(Math.abs(r.tenureWeightedMeanYwT - 2.5) < 1e-9);
});

// ---------- label classifier ----------

test('yw label: large positive T + tiny p -> second-decisive', () => {
  const l = labelYuenWelchHalvesRow({ ywT: 5, ywPValue: 1e-6 });
  assert.equal(l, 'second-decisively-trimmed-mean-larger');
});

test('yw label: large negative T + tiny p -> first-decisive', () => {
  const l = labelYuenWelchHalvesRow({ ywT: -5, ywPValue: 1e-6 });
  assert.equal(l, 'first-decisively-trimmed-mean-larger');
});

test('yw label: positive T in lean band -> second-leans', () => {
  const l = labelYuenWelchHalvesRow({ ywT: 1.5, ywPValue: 0.07 });
  assert.equal(l, 'second-leans-trimmed-mean-larger');
});

test('yw label: negative T in lean band -> first-leans', () => {
  const l = labelYuenWelchHalvesRow({ ywT: -1.5, ywPValue: 0.07 });
  assert.equal(l, 'first-leans-trimmed-mean-larger');
});

test('yw label: large p -> no-evidence', () => {
  const l = labelYuenWelchHalvesRow({ ywT: 0.3, ywPValue: 0.7 });
  assert.equal(l, 'no-evidence-of-trimmed-mean-shift');
});

test('yw label: throws on non-finite T', () => {
  assert.throws(() =>
    labelYuenWelchHalvesRow({ ywT: NaN, ywPValue: 0.5 }),
  );
});

test('yw label: throws on p out of range', () => {
  assert.throws(() =>
    labelYuenWelchHalvesRow({ ywT: 1, ywPValue: 1.5 }),
  );
  assert.throws(() =>
    labelYuenWelchHalvesRow({ ywT: 1, ywPValue: -0.1 }),
  );
});

test('yw label: throws on bad alpha', () => {
  assert.throws(() =>
    labelYuenWelchHalvesRow({ ywT: 1, ywPValue: 0.3 }, 0),
  );
  assert.throws(() =>
    labelYuenWelchHalvesRow({ ywT: 1, ywPValue: 0.3 }, 0.6),
  );
});

test('yw label: respects custom alpha (0.01)', () => {
  // p=0.03 is decisive at 0.05 but only "lean" at 0.01? actually:
  // alpha=0.01 -> lean band [0.01, 0.02), p=0.03 falls outside both -> no-evidence
  const l = labelYuenWelchHalvesRow({ ywT: 2, ywPValue: 0.03 }, 0.01);
  assert.equal(l, 'no-evidence-of-trimmed-mean-shift');
});
