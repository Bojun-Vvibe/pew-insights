import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenFosterWolfsonIndex,
  fosterWolfsonOfVector,
} from '../src/dailytokenfosterwolfsonindex.js';
import { wolfsonOfVector } from '../src/dailytokenwolfsonpolarizationindex.js';
import { giniOfVector } from '../src/dailytokenginicoefficient.js';
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

const GEN = '2026-05-01T00:00:00.000Z';

// ---- fosterWolfsonOfVector primitive --------------------------------

test('fosterWolfsonOfVector: empty -> degenerate, fw=0', () => {
  const r = fosterWolfsonOfVector([]);
  assert.equal(r.fw, 0);
  assert.equal(r.degenerate, true);
});

test('fosterWolfsonOfVector: n=1 -> degenerate, fw=0', () => {
  const r = fosterWolfsonOfVector([42]);
  assert.equal(r.fw, 0);
  assert.equal(r.degenerate, true);
});

test('fosterWolfsonOfVector: all-zero -> degenerate, fw=0', () => {
  const r = fosterWolfsonOfVector([0, 0, 0, 0]);
  assert.equal(r.fw, 0);
  assert.equal(r.degenerate, true);
});

test('fosterWolfsonOfVector: perfect equality -> fw=0', () => {
  const r = fosterWolfsonOfVector([10, 10, 10, 10, 10, 10]);
  assert.ok(Math.abs(r.fw) < 1e-12, `expected fw=0, got ${r.fw}`);
  assert.equal(r.degenerate, false);
  assert.equal(r.gini, 0);
  assert.equal(r.halfLorenzGap, 0);
});

test('fosterWolfsonOfVector: scale-equivariance in token units (FW scales linearly)', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = fosterWolfsonOfVector(v);
  const b = fosterWolfsonOfVector(v.map((x) => x * 1000));
  // FW scales linearly with token units (mu term scales, T and G are scale-invariant).
  assert.ok(
    Math.abs(b.fw - 1000 * a.fw) < 1e-6,
    `fw scale-equivariance broken: ${a.fw} vs ${b.fw} (expected ratio 1000)`,
  );
});

test('fosterWolfsonOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = fosterWolfsonOfVector(v);
  const b = fosterWolfsonOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.fw - b.fw) < 1e-12);
});

test('fosterWolfsonOfVector: known closed-form on [1, 2, 3, 4]', () => {
  // n=4, sorted=[1,2,3,4]. mu = 2.5, m = 2.5 (median of 4 sorted = (2+3)/2).
  // Lorenz at p=0.5: bottom 2 / 4 entries = (1+2)/10 = 0.3.
  // T = 0.5 - 0.3 = 0.2.
  // Gini of [1,2,3,4] = 1/4 = 0.25 (closed-form for arithmetic sequence
  // 1..n is (n-1)/(3*((n+1)/2)) = 3/(3*2.5) = 0.4? -- actually let's
  // not hard-code Gini; use the giniOfVector helper to get the
  // expected value, then assert FW = 2*mu*(2T - G) holds against the
  // helper outputs.
  const v = [1, 2, 3, 4];
  const r = fosterWolfsonOfVector(v);
  const g = giniOfVector(v);
  const expected = 2 * 2.5 * (2 * 0.2 - g);
  assert.ok(
    Math.abs(r.fw - expected) < 1e-9,
    `closed-form mismatch: got ${r.fw}, expected ${expected}`,
  );
  assert.equal(r.mean, 2.5);
  assert.equal(r.median, 2.5);
  assert.ok(Math.abs(r.halfLorenzGap - 0.2) < 1e-12);
});

test('fosterWolfsonOfVector: FW = 2 * median * Wolfson identity (closed-form)', () => {
  // FW = 2*mu*(2T - G); W = (mu/m)*(2T - G).
  // Hence FW / W = 2*m exactly (closed-form), provided W != 0 and
  // the input is non-degenerate.
  for (const v of [
    [1, 2, 3, 4, 5, 6],
    [10, 10, 10, 100, 100, 100],
    [1, 1, 1, 1, 1, 1, 1000],
    [3, 7, 1, 11, 4, 9],
    [50, 100, 150, 200, 250, 300, 350],
  ]) {
    const fw = fosterWolfsonOfVector(v);
    const w = wolfsonOfVector(v);
    if (Math.abs(w.wolfson) < 1e-12) continue;
    const ratio = fw.fw / w.wolfson;
    const expected = 2 * w.median;
    assert.ok(
      Math.abs(ratio - expected) < 1e-9,
      `FW/W = 2*median identity broken on ${JSON.stringify(v)}: ` +
        `got ratio=${ratio}, expected=${expected}`,
    );
  }
});

test('fosterWolfsonOfVector: bipolarization monotone -- mass pulled from median into tails increases FW', () => {
  // Start with a unimodal-around-median distribution; gradually move
  // mass into the two tails, keeping mean constant. FW should rise.
  const make = (delta: number): number[] => [
    100 - delta,
    100 - delta,
    100 - delta / 2,
    100,
    100 + delta / 2,
    100 + delta,
    100 + delta,
  ];
  let prev = -Infinity;
  for (const d of [0, 5, 10, 20, 40, 60]) {
    const r = fosterWolfsonOfVector(make(d)).fw;
    assert.ok(r >= prev - 1e-9, `non-monotone at delta=${d}: ${prev} -> ${r}`);
    prev = r;
  }
});

test('fosterWolfsonOfVector: throws on negative entry', () => {
  assert.throws(() => fosterWolfsonOfVector([1, 2, -1, 4]), /non-negative/);
});

test('fosterWolfsonOfVector: throws on non-finite entry', () => {
  assert.throws(() => fosterWolfsonOfVector([1, NaN, 3]), /non-negative/);
});

// ---- builder integration -----------------------------------------

test('buildDailyTokenFosterWolfsonIndex: basic shape + sort', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T01:00:00Z', 'srcA', 100),
    ql('2026-04-20T01:00:00Z', 'srcA', 100),
    ql('2026-04-21T01:00:00Z', 'srcA', 200),
    ql('2026-04-22T01:00:00Z', 'srcA', 700),
    ql('2026-04-19T01:00:00Z', 'srcB', 1000),
    ql('2026-04-20T01:00:00Z', 'srcB', 1000),
    ql('2026-04-21T01:00:00Z', 'srcB', 1000),
    ql('2026-04-22T01:00:00Z', 'srcB', 1000),
  ];
  const r = buildDailyTokenFosterWolfsonIndex(queue, {
    minTokens: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'srcA')!;
  const b = r.sources.find((s) => s.source === 'srcB')!;
  // Equality source: fw == 0. Skewed source: fw can be either sign
  // depending on whether (2T - G) is positive.
  assert.ok(Math.abs(b.fw) < 1e-12, `srcB (equality) fw should be ~0, got ${b.fw}`);
  assert.ok(a.gini > 0, `srcA gini should be > 0, got ${a.gini}`);
  assert.equal(r.sort, 'fw');
});

test('buildDailyTokenFosterWolfsonIndex: refinement wolfson-anchor exposes fw/wolfson = 2*median', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T01:00:00Z', 'srcA', 100),
    ql('2026-04-20T01:00:00Z', 'srcA', 200),
    ql('2026-04-21T01:00:00Z', 'srcA', 300),
    ql('2026-04-22T01:00:00Z', 'srcA', 1000),
  ];
  const r = buildDailyTokenFosterWolfsonIndex(queue, {
    minTokens: 100,
    includeWolfsonAnchor: true,
    generatedAt: GEN,
  });
  const row = r.sources[0]!;
  assert.ok(row.wolfson !== undefined);
  if (row.fwOverWolfson !== undefined && !Number.isNaN(row.fwOverWolfson)) {
    const expected = 2 * row.medianDailyTokens;
    assert.ok(
      Math.abs(row.fwOverWolfson - expected) < 1e-6,
      `fw/wolfson identity broken: got ${row.fwOverWolfson}, expected ${expected}`,
    );
  }
});

test('buildDailyTokenFosterWolfsonIndex: minDays drop', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'srcA', 5000),
    ql('2026-04-21T01:00:00Z', 'srcA', 5000),
  ];
  const r = buildDailyTokenFosterWolfsonIndex(queue, {
    minTokens: 100,
    minDays: 4,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinDays, 1);
});

test('buildDailyTokenFosterWolfsonIndex: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenFosterWolfsonIndex([], {
        sort: 'bogus' as 'fw',
      }),
    /sort/,
  );
});

test('buildDailyTokenFosterWolfsonIndex: invalid minDays throws', () => {
  assert.throws(
    () => buildDailyTokenFosterWolfsonIndex([], { minDays: 1 }),
    /minDays/,
  );
});

test('buildDailyTokenFosterWolfsonIndex: minFw signed filter (FW can be negative)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T01:00:00Z', 'srcA', 100),
    ql('2026-04-20T01:00:00Z', 'srcA', 200),
    ql('2026-04-21T01:00:00Z', 'srcA', 300),
    ql('2026-04-22T01:00:00Z', 'srcA', 1000),
  ];
  // Set min-fw very high so srcA gets filtered (its fw is finite but
  // surely below 1e9).
  const r = buildDailyTokenFosterWolfsonIndex(queue, {
    minTokens: 100,
    minFw: 1e9,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinFw, 1);
});

// ---- structural decoupling vs Wolfson ----------------------------

test('structural: FW and Wolfson have IDENTICAL signs (both inherit from 2T - G)', () => {
  for (const v of [
    [1, 2, 3, 4, 5, 6, 7],
    [10, 10, 10, 10, 100],
    [1, 100, 100, 100, 100, 1],
    [3, 7, 1, 11, 4, 9, 13, 2, 8],
    [100, 100, 100, 100, 100, 100, 100],
  ]) {
    const fw = fosterWolfsonOfVector(v).fw;
    const w = wolfsonOfVector(v).wolfson;
    assert.ok(
      Math.sign(fw) === Math.sign(w) ||
        (Math.abs(fw) < 1e-12 && Math.abs(w) < 1e-12),
      `sign mismatch on ${JSON.stringify(v)}: FW=${fw}, W=${w}`,
    );
  }
});

test('structural: FW source ranking can DIVERGE from Wolfson when medians differ across sources (non-degeneracy witness)', () => {
  // Construct two sources with the SAME relative bipolarization
  // pattern but very different medians. Wolfson should be similar;
  // FW should differ proportionally to the median ratio.
  const va = [10, 10, 50, 90, 90]; // small-scale, m = 50
  const vb = [100, 100, 500, 900, 900]; // 10x scaled, m = 500
  const fwA = fosterWolfsonOfVector(va).fw;
  const fwB = fosterWolfsonOfVector(vb).fw;
  const wA = wolfsonOfVector(va).wolfson;
  const wB = wolfsonOfVector(vb).wolfson;
  // Wolfson is scale-invariant: wA == wB.
  assert.ok(
    Math.abs(wA - wB) < 1e-9,
    `Wolfson scale-invariance broken: ${wA} vs ${wB}`,
  );
  // FW is scale-equivariant: fwB = 10 * fwA.
  assert.ok(
    Math.abs(fwB - 10 * fwA) < 1e-6,
    `FW scale-equivariance broken: ${fwA} vs ${fwB} (expected ratio 10)`,
  );
  // The cross-source decoupling: even though Wolfson ranks them as
  // tied, FW ranks vb >> va. That is the new signal axis-52 surfaces.
  assert.ok(fwB > fwA, `FW should rank scaled-up source higher`);
});
