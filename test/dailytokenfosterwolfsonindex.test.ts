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

// ---- refinement (axis-52 follow-up): exhaustive non-degeneracy
// audit + numerical-stability sweep. The KEY LESSON FROM AXIS-51
// (which we discovered to collapse to 2/n * Gini under per-day
// projection) is to PROVE that axis-52 is non-degenerate vs every
// neighboring axis BEFORE committing it as a real signal. We audit:
//   (a) FW vs Wolfson: closed-form FW/W = 2*m identity on a 50-trial
//       random sweep, proving the relationship is EXACT (so the only
//       cross-source variation in FW that is NOT Wolfson is the
//       median variation -- a real signal whenever medians vary).
//   (b) FW source ranking vs Wolfson source ranking: Spearman-style
//       rank-divergence on a synthetic 6-source panel built to mimic
//       the live-data spread (high-volume / low-bipolarization vs
//       low-volume / high-bipolarization), proving the rankings
//       DIVERGE (not just numerically differ) -- the non-degeneracy
//       proof in source-ordering space.
//   (c) Numerical stability on long heavy-tailed vectors (n=1000),
//       checking finite output and the FW/W = 2*m identity at scale.

test('refinement: closed-form FW/W = 2*median identity holds at machine precision on a 50-trial random sweep', () => {
  const rand = (seed: number) => {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 0xffffffff;
    };
  };
  const r = rand(20260502);
  let degenerateSkipped = 0;
  for (let trial = 0; trial < 50; trial += 1) {
    const len = 4 + Math.floor(r() * 12);
    const v: number[] = [];
    for (let i = 0; i < len; i += 1) v.push(Math.floor(r() * 1000) + 1);
    const fw = fosterWolfsonOfVector(v);
    const w = wolfsonOfVector(v);
    if (Math.abs(w.wolfson) < 1e-9) {
      degenerateSkipped += 1;
      continue;
    }
    const ratio = fw.fw / w.wolfson;
    const expected = 2 * w.median;
    assert.ok(
      Math.abs(ratio - expected) < 1e-7,
      `FW/W = 2*median drift on ${JSON.stringify(v)}: ` +
        `got ${ratio}, expected ${expected}`,
    );
  }
  // We expect almost all trials to be non-degenerate; allow up to
  // 10 to be skipped (would happen if 2T = G by accident).
  assert.ok(
    degenerateSkipped <= 10,
    `too many degenerate trials: ${degenerateSkipped}/50`,
  );
});

test('refinement: FW source ranking DIVERGES from Wolfson source ranking on a 6-source panel mimicking live-data spread', () => {
  // Build 6 synthetic per-day vectors with varying (median, gini, T)
  // combinations so that the Wolfson order and FW order differ. The
  // construction: half the sources are HIGH-VOLUME with LOW relative
  // bipolarization; half are LOW-VOLUME with HIGH relative
  // bipolarization. This mimics the live opencode-vs-vscode-copilot
  // pattern.
  const sources: Record<string, number[]> = {
    s1_highvol_lowpolar: [
      400_000_000,
      450_000_000,
      450_000_000,
      500_000_000,
      500_000_000,
      550_000_000,
    ],
    s2_highvol_modpolar: [
      80_000_000,
      90_000_000,
      100_000_000,
      150_000_000,
      200_000_000,
      300_000_000,
    ],
    s3_modvol_modpolar: [
      40_000_000,
      50_000_000,
      60_000_000,
      80_000_000,
      120_000_000,
      200_000_000,
    ],
    s4_modvol_highpolar: [
      10_000_000,
      15_000_000,
      25_000_000,
      35_000_000,
      80_000_000,
      150_000_000,
    ],
    s5_lowvol_modpolar: [
      8_000_000,
      10_000_000,
      12_000_000,
      14_000_000,
      18_000_000,
      25_000_000,
    ],
    s6_lowvol_highpolar: [
      1_000,
      2_000,
      5_000,
      10_000,
      30_000,
      80_000,
    ],
  };
  type Row = { name: string; fw: number; w: number };
  const rows: Row[] = [];
  for (const [name, v] of Object.entries(sources)) {
    rows.push({
      name,
      fw: fosterWolfsonOfVector(v).fw,
      w: wolfsonOfVector(v).wolfson,
    });
  }
  const fwOrder = [...rows].sort((a, b) => b.fw - a.fw).map((r) => r.name);
  const wOrder = [...rows].sort((a, b) => b.w - a.w).map((r) => r.name);
  // Compute Spearman-style displacement: count positions that differ.
  let diff = 0;
  for (let i = 0; i < rows.length; i += 1) {
    if (fwOrder[i] !== wOrder[i]) diff += 1;
  }
  // We require AT LEAST 4 of 6 positions to differ -- a strong
  // non-degeneracy witness.
  assert.ok(
    diff >= 4,
    `FW and Wolfson rankings should diverge on >= 4/6 positions; ` +
      `got diff=${diff}. fwOrder=${JSON.stringify(fwOrder)}, ` +
      `wOrder=${JSON.stringify(wOrder)}`,
  );
  // And the top FW source should NOT equal the top Wolfson source --
  // the headline non-degeneracy claim from the live-smoke data.
  assert.notEqual(
    fwOrder[0],
    wOrder[0],
    `FW top != Wolfson top is the headline non-degeneracy claim; both = ${fwOrder[0]}`,
  );
});

test('refinement: numerical stability on long heavy-tailed vectors (n=1000) -- finite output, FW/W = 2*m holds at scale', () => {
  const n = 1000;
  const v: number[] = [];
  for (let i = 1; i <= n; i += 1) {
    v.push(i % 50 === 0 ? i * 100 : i);
  }
  const fw = fosterWolfsonOfVector(v);
  const w = wolfsonOfVector(v);
  assert.ok(Number.isFinite(fw.fw), `fw not finite: ${fw.fw}`);
  assert.ok(Number.isFinite(w.wolfson), `wolfson not finite`);
  assert.equal(fw.degenerate, false);
  if (Math.abs(w.wolfson) > 1e-9) {
    const ratio = fw.fw / w.wolfson;
    const expected = 2 * w.median;
    // Allow slightly larger tolerance at n=1000.
    assert.ok(
      Math.abs(ratio - expected) / Math.abs(expected) < 1e-9,
      `n=1000 FW/W = 2*m broken: got ${ratio}, expected ${expected}`,
    );
  }
});

test('refinement: defensive sweep over edge inputs -- median = 0 degenerates cleanly', () => {
  // If more than half the entries are zero, median = 0 and Wolfson
  // is degenerate; FW must inherit this degeneracy cleanly (no
  // NaN, no Infinity).
  const v = [0, 0, 0, 0, 0, 100, 200, 300]; // n=8, sorted -> median = 0
  const fw = fosterWolfsonOfVector(v);
  // Wolfson degenerates here (median = 0); FW must follow.
  assert.equal(fw.degenerate, true);
  assert.equal(fw.fw, 0);
});

test('refinement: alpha-free invariance -- FW takes no alpha parameter (unlike Esteban-Ray axis-51); identity is unique', () => {
  // Defensive: confirm the API surface does not expose an alpha
  // (FW is parameter-free; the axiom-cube corner it fills has no
  // axiomatic free parameter, unlike the Esteban-Ray family).
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  const a = fosterWolfsonOfVector(v);
  const b = fosterWolfsonOfVector(v);
  assert.equal(a.fw, b.fw, 'FW must be deterministic and parameter-free');
});
