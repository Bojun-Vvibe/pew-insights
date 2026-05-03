import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenHerfindahlHirschmanIndex,
  herfindahlHirschmanIndexOfVector,
} from '../src/dailytokenherfindahlhirschmanindex.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-04T12:00:00.000Z';

test('primitive: empty -> degenerate, hhi=0, total=0', () => {
  const r = herfindahlHirschmanIndexOfVector([]);
  assert.equal(r.hhi, 0);
  assert.equal(r.total, 0);
  assert.equal(r.degenerate, true);
});

test('primitive: n=1 -> degenerate, hhi=1', () => {
  const r = herfindahlHirschmanIndexOfVector([42]);
  assert.equal(r.hhi, 1);
  assert.equal(r.degenerate, true);
  assert.equal(r.lowerBound, 1);
});

test('primitive: D=[1..10] closed-form HHI = 385/3025', () => {
  const r = herfindahlHirschmanIndexOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(r.total, 55);
  assert.ok(Math.abs(r.hhi - 385 / 3025) < 1e-15);
  assert.ok(Math.abs(r.lowerBound - 0.1) < 1e-15);
  assert.ok(Math.abs(r.slack - (385 / 3025 - 0.1)) < 1e-15);
  const expectedNorm = (385 / 3025 - 0.1) / 0.9;
  assert.ok(Math.abs(r.normalisedHhi - expectedNorm) < 1e-14);
  assert.ok(Math.abs(r.effectiveDays - 3025 / 385) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('primitive: perfectly flat vector -> hhi = 1/n exactly (lower bound)', () => {
  const r = herfindahlHirschmanIndexOfVector([5, 5, 5, 5, 5, 5, 5, 5, 5, 5]);
  assert.ok(Math.abs(r.hhi - 0.1) < 1e-15);
  assert.ok(Math.abs(r.hhi - r.lowerBound) < 1e-15);
  assert.ok(Math.abs(r.slack) < 1e-15);
  assert.ok(Math.abs(r.normalisedHhi) < 1e-15);
  assert.ok(Math.abs(r.effectiveDays - 10) < 1e-12);
});

test('primitive: monopoly day -> hhi -> 1, normalised -> 1, N_eff -> 1', () => {
  const v = [1e12, 1e-6, 1e-6, 1e-6, 1e-6, 1e-6];
  const r = herfindahlHirschmanIndexOfVector(v);
  assert.ok(r.hhi > 0.999999);
  assert.ok(r.hhi <= 1);
  assert.ok(r.normalisedHhi > 0.999999);
  assert.ok(r.effectiveDays < 1.0001);
});

test('primitive: scale invariance -- HHI(c*v) === HHI(v)', () => {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r1 = herfindahlHirschmanIndexOfVector(base);
  const r2 = herfindahlHirschmanIndexOfVector(base.map((x) => x * 1e6));
  assert.ok(Math.abs(r1.hhi - r2.hhi) < 1e-15);
});

test('primitive: permutation invariance', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [10, 1, 9, 2, 8, 3, 7, 4, 6, 5];
  const r1 = herfindahlHirschmanIndexOfVector(a);
  const r2 = herfindahlHirschmanIndexOfVector(b);
  assert.ok(Math.abs(r1.hhi - r2.hhi) < 1e-15);
});

test('primitive: throws on negative input', () => {
  assert.throws(() => herfindahlHirschmanIndexOfVector([1, 2, -3, 4, 5]));
});

test('primitive: throws on zero input', () => {
  assert.throws(() => herfindahlHirschmanIndexOfVector([1, 2, 0, 4, 5]));
});

test('primitive: throws on NaN input', () => {
  assert.throws(() => herfindahlHirschmanIndexOfVector([1, 2, NaN, 4, 5]));
});

test('primitive: rank-flip witness vs CR4 (HHI is spike-sensitive)', () => {
  // A: four big days at 40, six tiny at 1; B: one mega-day at 100,
  // three medium at 30, six tiny at 1. CR4 nearly tied (~0.96 vs
  // 0.97); HHI strongly separates (~0.232 vs ~0.331).
  const A = [40, 40, 40, 40, 1, 1, 1, 1, 1, 1];
  const B = [100, 30, 30, 30, 1, 1, 1, 1, 1, 1];
  const ra = herfindahlHirschmanIndexOfVector(A);
  const rb = herfindahlHirschmanIndexOfVector(B);
  assert.ok(rb.hhi > ra.hhi);
  assert.ok(rb.hhi - ra.hhi > 0.05); // genuine MAGNITUDE gap
  // closed-form check on A: 4*(40/166)^2 + 6*(1/166)^2
  const expectedA = 4 * (40 / 166) ** 2 + 6 * (1 / 166) ** 2;
  assert.ok(Math.abs(ra.hhi - expectedA) < 1e-12);
});

test('primitive: maxShare equals largest D_i / total', () => {
  const r = herfindahlHirschmanIndexOfVector([1, 2, 3, 4, 100]);
  assert.ok(Math.abs(r.maxShare - 100 / 110) < 1e-15);
});

test('builder: rejects minDays < 2', () => {
  assert.throws(() =>
    buildDailyTokenHerfindahlHirschmanIndex([], { minDays: 1, generatedAt: GEN }),
  );
});

test('builder: rejects minHhi outside [0,1]', () => {
  assert.throws(() =>
    buildDailyTokenHerfindahlHirschmanIndex([], { minHhi: 1.5, generatedAt: GEN }),
  );
  assert.throws(() =>
    buildDailyTokenHerfindahlHirschmanIndex([], { minHhi: -0.1, generatedAt: GEN }),
  );
});

test('builder: rejects unknown sort', () => {
  assert.throws(() =>
    buildDailyTokenHerfindahlHirschmanIndex([], {
      sort: 'bogus' as 'hhi',
      generatedAt: GEN,
    }),
  );
});

test('builder: emits per-source row with bound-correct hhi/lowerBound/slack', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 10; d += 1) {
    queue.push(
      ql(`2026-05-${String(d).padStart(2, '0')}T10:00:00Z`, 'tri', d * 1000),
    );
  }
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nDays, 10);
  assert.equal(row.totalTokens, 55_000);
  // shares equal v/55, sum v^2 = 385, sum (v/55)^2 = 385/3025
  assert.ok(Math.abs(row.hhi - 385 / 3025) < 1e-12);
  assert.ok(Math.abs(row.lowerBound - 0.1) < 1e-12);
  assert.ok(Math.abs(row.normalisedHhi - (385 / 3025 - 0.1) / 0.9) < 1e-12);
  assert.ok(Math.abs(row.effectiveDays - 3025 / 385) < 1e-10);
});

test('builder: drops sources with nDays < minDays', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T10:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: sort=hhi desc with multiple sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'flat', 1000));
  }
  // spike: one mega-day plus four tiny
  queue.push(ql('2026-05-01T10:00:00Z', 'spike', 1_000_000));
  for (let d = 2; d <= 5; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'spike', 1));
  }
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    sort: 'hhi',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'spike');
  assert.equal(r.sources[1]!.source, 'flat');
  assert.ok(r.sources[0]!.hhi > r.sources[1]!.hhi);
  assert.ok(Math.abs(r.sources[1]!.hhi - 0.2) < 1e-12);
});

test('builder: minHhi filter drops below-threshold sources', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'flat', 1000));
  }
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    minHhi: 0.5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinHhi, 1);
});

// ---- refinement: concentrationRegime + normalisedHhi + effectiveDays --

test('refinement: flat vector -> low regime, normalisedHhi ~ 0', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 8; d += 1) {
    queue.push(ql(`2026-05-0${d}T10:00:00Z`, 'flat', 1000));
  }
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationRegime, 'low');
  assert.ok(row.normalisedHhi < 1e-12);
  assert.ok(Math.abs(row.effectiveDays - 8) < 1e-10);
});

test('refinement: monopoly vector -> high regime, normalisedHhi -> 1', () => {
  const queue: QueueLine[] = [];
  queue.push(ql('2026-05-01T10:00:00Z', 'spike', 1_000_000));
  for (let d = 2; d <= 10; d += 1) {
    queue.push(ql(`2026-05-${String(d).padStart(2, '0')}T10:00:00Z`, 'spike', 1));
  }
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationRegime, 'high');
  assert.ok(row.normalisedHhi > 0.99);
  assert.ok(row.effectiveDays < 1.05);
});

test('refinement: moderate regime in [0.15, 0.25)', () => {
  // Construct shares roughly s = (0.5, 0.4, 0.05, 0.05) for n=4:
  // HHI = 0.25 + 0.16 + 0.0025 + 0.0025 = 0.415; lowerBound=0.25,
  // headroom=0.75, normHhi = 0.165/0.75 = 0.22 -> moderate band.
  const queue: QueueLine[] = [
    ql('2026-05-01T10:00:00Z', 'mod', 50_000),
    ql('2026-05-02T10:00:00Z', 'mod', 40_000),
    ql('2026-05-03T10:00:00Z', 'mod', 5_000),
    ql('2026-05-04T10:00:00Z', 'mod', 5_000),
  ];
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.equal(row.concentrationRegime, 'moderate');
  assert.ok(row.normalisedHhi >= 0.15 && row.normalisedHhi < 0.25);
});

test('refinement: effectiveDays = 1/hhi exactly', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 10; d += 1) {
    queue.push(
      ql(`2026-05-${String(d).padStart(2, '0')}T10:00:00Z`, 'tri', d * 1000),
    );
  }
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.effectiveDays - 1 / row.hhi) < 1e-12);
});

test('refinement: maxShare emitted on row matches largest day / total', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T10:00:00Z', 'a', 100),
    ql('2026-05-02T10:00:00Z', 'a', 1),
    ql('2026-05-03T10:00:00Z', 'a', 1),
    ql('2026-05-04T10:00:00Z', 'a', 1),
  ];
  const r = buildDailyTokenHerfindahlHirschmanIndex(queue, {
    minTokens: 1,
    minDays: 2,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.maxShare - 100 / 103) < 1e-12);
  assert.equal(row.maxDay, '2026-05-01');
});
