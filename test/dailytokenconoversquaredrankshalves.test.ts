import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenConoverSquaredRanksHalves,
  buildDailyTokenConoverSquaredRanksHalves,
  midRanksConover,
  medianConover,
  standardNormalUpperTailConover,
} from '../src/dailytokenconoversquaredrankshalves.js';
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

// ---------- primitive: midRanksConover ----------

test('midRanksConover: strictly increasing 1..n', () => {
  assert.deepEqual(midRanksConover([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midRanksConover: strictly decreasing n..1', () => {
  assert.deepEqual(midRanksConover([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midRanksConover: ties get average rank', () => {
  assert.deepEqual(midRanksConover([5, 5, 7, 5]), [2, 2, 4, 2]);
});

test('midRanksConover: pair tie at top', () => {
  assert.deepEqual(midRanksConover([1, 2, 9, 9]), [1, 2, 3.5, 3.5]);
});

// ---------- primitive: medianConover ----------

test('medianConover: odd-length picks middle', () => {
  assert.equal(medianConover([3, 1, 2]), 2);
});

test('medianConover: even-length averages two middle', () => {
  assert.equal(medianConover([1, 2, 3, 4]), 2.5);
});

test('medianConover: does not mutate input', () => {
  const a = [3, 1, 2];
  medianConover(a);
  assert.deepEqual(a, [3, 1, 2]);
});

test('medianConover: throws on empty', () => {
  assert.throws(() => medianConover([]));
});

// ---------- primitive: standardNormalUpperTailConover ----------

test('standardNormalUpperTailConover: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailConover(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailConover: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailConover(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-4, `got ${q}`);
});

test('standardNormalUpperTailConover: Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const qPos = standardNormalUpperTailConover(z);
  const qNeg = standardNormalUpperTailConover(-z);
  assert.ok(Math.abs(qPos + qNeg - 1) < 1e-7);
});

test('standardNormalUpperTailConover: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailConover(Number.NaN));
});

// ---------- core: dailyTokenConoverSquaredRanksHalves ----------

test('dailyTokenConoverSquaredRanksHalves: throws under min length 16', () => {
  assert.throws(() =>
    dailyTokenConoverSquaredRanksHalves([1, 2, 3, 4, 5, 6, 7, 8]),
  );
});

test('dailyTokenConoverSquaredRanksHalves: throws on non-finite', () => {
  const v = Array.from({ length: 16 }, (_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenConoverSquaredRanksHalves(v));
});

test('dailyTokenConoverSquaredRanksHalves: throws on constant input', () => {
  const v = Array.from({ length: 16 }, () => 7);
  assert.throws(() => dailyTokenConoverSquaredRanksHalves(v));
});

test('dailyTokenConoverSquaredRanksHalves: n1 = floor(n/2), n2 = n - n1', () => {
  const v = Array.from({ length: 17 }, (_, i) => i * 0.5 + 1);
  const r = dailyTokenConoverSquaredRanksHalves(v);
  assert.equal(r.conoverN1, 8);
  assert.equal(r.conoverN2, 9);
  assert.equal(r.nSamples, 17);
});

test('dailyTokenConoverSquaredRanksHalves: constant-shift invariance conoverZ(x + c) == conoverZ(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const z1 = dailyTokenConoverSquaredRanksHalves(x).conoverZ;
  const z2 = dailyTokenConoverSquaredRanksHalves(x.map((v) => v + 1000)).conoverZ;
  assert.ok(Math.abs(z1 - z2) < 1e-9, `z1=${z1} z2=${z2}`);
});

test('dailyTokenConoverSquaredRanksHalves: positive-scale invariance conoverZ(a x) == conoverZ(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const z1 = dailyTokenConoverSquaredRanksHalves(x).conoverZ;
  const z2 = dailyTokenConoverSquaredRanksHalves(x.map((v) => v * 17)).conoverZ;
  assert.ok(Math.abs(z1 - z2) < 1e-9, `z1=${z1} z2=${z2}`);
});

test('dailyTokenConoverSquaredRanksHalves: independent half-shift invariance', () => {
  const a = [1, 3, 5, 7, 9, 11, 13, 15];
  const b = [2, 4, 6, 8, 10, 12, 14, 16];
  const z1 = dailyTokenConoverSquaredRanksHalves([...a, ...b]).conoverZ;
  // Add huge integer shift to A, different shift to B; absolute deviations
  // from each half's median are integer-preserved.
  const z2 = dailyTokenConoverSquaredRanksHalves([
    ...a.map((v) => v + 500),
    ...b.map((v) => v - 200),
  ]).conoverZ;
  assert.ok(Math.abs(z1 - z2) < 1e-9, `z1=${z1} z2=${z2}`);
});

test('dailyTokenConoverSquaredRanksHalves: half-swap negates Z when n1 = n2 and no ties', () => {
  // n = 18 so n1 = n2 = 9. Use distinct values to avoid ties.
  const x = [
    1.2, 2.3, 0.7, 4.1, 3.5, 1.8, 5.2, 0.9, 3.1, 2.7, 4.6, 1.5, 0.4, 3.9, 2.0,
    5.5, 0.1, 4.3,
  ];
  const z1 = dailyTokenConoverSquaredRanksHalves(x).conoverZ;
  const swapped = [...x.slice(9), ...x.slice(0, 9)];
  const z2 = dailyTokenConoverSquaredRanksHalves(swapped).conoverZ;
  assert.ok(Math.abs(z1 + z2) < 1e-9, `z1=${z1} z2=${z2}`);
});

test('dailyTokenConoverSquaredRanksHalves: detects scale shift (B much wider than A)', () => {
  // First half tight around 0, second half wide spread.
  const a = [0.1, -0.1, 0.05, -0.05, 0.0, 0.08, -0.08, 0.02];
  const b = [10, -12, 8, -9, 11, -10, 9, -11];
  const r = dailyTokenConoverSquaredRanksHalves([...a, ...b]);
  assert.ok(r.conoverZ > 2, `expected strong positive Z, got ${r.conoverZ}`);
  assert.ok(r.conoverPValue < 0.05, `expected reject, got p=${r.conoverPValue}`);
});

test('dailyTokenConoverSquaredRanksHalves: equal-dispersion gives p > 0.1 (deterministic case)', () => {
  // Perfectly symmetric halves with same dispersion structure.
  const x = [
    1, 2, 3, 4, 5, 6, 7, 8, 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1, 8.1,
  ];
  const r = dailyTokenConoverSquaredRanksHalves(x);
  assert.ok(
    r.conoverPValue > 0.1,
    `expected non-rejection, got p=${r.conoverPValue}`,
  );
});

test('dailyTokenConoverSquaredRanksHalves: variance and stat positive', () => {
  const x = [
    1.2, 2.3, 0.7, 4.1, 3.5, 1.8, 5.2, 0.9, 3.1, 2.7, 4.6, 1.5, 0.4, 3.9, 2.0,
    5.5, 0.1, 4.3,
  ];
  const r = dailyTokenConoverSquaredRanksHalves(x);
  assert.ok(r.conoverVarT > 0);
  assert.ok(r.conoverScoreSS > 0);
  assert.ok(r.conoverT > 0);
  assert.ok(r.conoverExpT > 0);
  assert.ok(r.conoverPValue > 0 && r.conoverPValue <= 1);
});

// ---------- builder: buildDailyTokenConoverSquaredRanksHalves ----------

test('buildDailyTokenConoverSquaredRanksHalves: empty queue gives empty rows', () => {
  const r = buildDailyTokenConoverSquaredRanksHalves([], {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
});

test('buildDailyTokenConoverSquaredRanksHalves: drops sources below min-tenure-days', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenConoverSquaredRanksHalves(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenConoverSquaredRanksHalves: produces a row for adequate tenure', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 24; i += 1) {
    // varying tokens so we have non-zero variance
    const tt = 1000 + (i % 7) * 250 + (i > 11 ? i * 80 : 0);
    queue.push(ql(dayIso(i), 'svc', tt));
  }
  const r = buildDailyTokenConoverSquaredRanksHalves(queue, {
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'svc');
  assert.ok(Number.isFinite(row.conoverZ));
  assert.ok(row.conoverPValue > 0 && row.conoverPValue <= 1);
});

test('buildDailyTokenConoverSquaredRanksHalves: validates sort key', () => {
  assert.throws(() =>
    buildDailyTokenConoverSquaredRanksHalves([], {
      sort: 'nonsense' as never,
    }),
  );
});

test('buildDailyTokenConoverSquaredRanksHalves: validates min-tenure-days >= 16', () => {
  assert.throws(() =>
    buildDailyTokenConoverSquaredRanksHalves([], {
      minTenureDays: 8,
    }),
  );
});

test('buildDailyTokenConoverSquaredRanksHalves: respects top cap and reports droppedTopSources', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 0; i < 24; i += 1) {
      const tt = 1000 + (i % 5) * 300 + (i > 11 ? i * 60 : 0);
      queue.push(ql(dayIso(i), src, tt));
    }
  }
  const r = buildDailyTokenConoverSquaredRanksHalves(queue, {
    top: 2,
    generatedAt: '2026-05-04T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});
