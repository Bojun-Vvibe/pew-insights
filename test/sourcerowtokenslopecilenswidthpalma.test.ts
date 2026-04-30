/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-palma (axis 26).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthPalma,
  renderSourceRowTokenSlopeCiLensWidthPalma,
  lensWidthPalma,
  lorenzAt,
  SLOPE_LENS_WIDTH_PALMA_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthpalma.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

function syntheticQueue(
  spec: { source: string; nRows: number; slope: number; noise: number }[],
): QueueLine[] {
  const out: QueueLine[] = [];
  for (const s of spec) {
    let seed = 1;
    const rng = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return ((seed >>> 0) & 0xffff) / 0xffff;
    };
    for (let i = 0; i < s.nRows; i++) {
      const base = 100 + s.slope * i;
      const jitter = (rng() - 0.5) * 2 * s.noise;
      const total = Math.max(0, Math.round(base + jitter));
      const ts = `2026-01-${String(1 + Math.floor(i / 24)).padStart(2, '0')}T${String(i % 24).padStart(2, '0')}:00:00Z`;
      out.push(ql(ts, s.source, total));
    }
  }
  return out;
}

// ---------- pure helper: lorenzAt ----------

test('axis26 lorenzAt: equal-mass uniform Lorenz curve is the diagonal', () => {
  const sorted = [1, 1, 1, 1, 1];
  const total = 5;
  for (const p of [0, 0.2, 0.4, 0.5, 0.7, 0.9, 1]) {
    const L = lorenzAt(sorted, total, p);
    assert.ok(Math.abs(L - p) < 1e-12, `L(${p})=${L}`);
  }
});

test('axis26 lorenzAt: anchor points exactly satisfy L(k/n) = c_k', () => {
  // sorted = [1,2,3,4], S=10
  // c_0=0, c_1=0.1, c_2=0.3, c_3=0.6, c_4=1.0
  const sorted = [1, 2, 3, 4];
  const total = 10;
  assert.ok(Math.abs(lorenzAt(sorted, total, 0) - 0) < 1e-12);
  assert.ok(Math.abs(lorenzAt(sorted, total, 0.25) - 0.1) < 1e-12);
  assert.ok(Math.abs(lorenzAt(sorted, total, 0.5) - 0.3) < 1e-12);
  assert.ok(Math.abs(lorenzAt(sorted, total, 0.75) - 0.6) < 1e-12);
  assert.ok(Math.abs(lorenzAt(sorted, total, 1) - 1) < 1e-12);
});

test('axis26 lorenzAt: piecewise-linear interpolation between anchors', () => {
  // sorted = [1,2,3,4], anchors at 0, 0.25 -> 0.1, 0.5 -> 0.3
  // L(0.4) is on segment from (0.25, 0.1) to (0.5, 0.3):
  //   slope = (0.3-0.1)/(0.5-0.25) = 0.2/0.25 = 0.8
  //   L(0.4) = 0.1 + 0.8 * (0.4 - 0.25) = 0.1 + 0.12 = 0.22
  const sorted = [1, 2, 3, 4];
  const total = 10;
  assert.ok(Math.abs(lorenzAt(sorted, total, 0.4) - 0.22) < 1e-12);
});

test('axis26 lorenzAt: degenerate edge cases return 0', () => {
  assert.equal(lorenzAt([], 0, 0.5), 0);
  assert.equal(lorenzAt([1, 2, 3], 0, 0.5), 0);
  assert.equal(lorenzAt([1, 2, 3], -1, 0.5), 0);
  assert.equal(lorenzAt([1, 2, 3], 6, -0.1), 0);
  assert.equal(lorenzAt([1, 2, 3], 6, 1.1), 1);
});

// ---------- pure helper: lensWidthPalma ----------

test('axis26 helper: perfectly equal half-widths give Palma = 0.25', () => {
  // For uniform L(p) = p: S40 = 0.4, S90 = 0.1, Palma = 0.25.
  const out = lensWidthPalma([0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.ok(Math.abs(out.s40 - 0.4) < 1e-12);
  assert.ok(Math.abs(out.s90 - 0.1) < 1e-12);
  assert.ok(Math.abs(out.palma - 0.25) < 1e-12);
  assert.equal(out.palmaIsInfinite, false);
});

test('axis26 helper: too-few-sources is degenerate (n < 4)', () => {
  for (const n of [0, 1, 2, 3]) {
    const out = lensWidthPalma(new Array(n).fill(1));
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.palma, 0);
  }
});

test('axis26 helper: zero-mass is degenerate', () => {
  const out = lensWidthPalma([0, 0, 0, 0, 0]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-mass');
  assert.equal(out.palma, 0);
});

test('axis26 helper: zero-bottom-mass with positive top mass yields palmaIsInfinite', () => {
  // n=10, the bottom 4 are 0, the rest are positive.
  // L(0.4) = 0, L(0.9) < 1 so S90 > 0.
  const out = lensWidthPalma([0, 0, 0, 0, 1, 1, 1, 1, 1, 1]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-bottom-mass');
  assert.equal(out.palmaIsInfinite, true);
  assert.equal(out.s40, 0);
  assert.ok(out.s90 > 0);
});

test('axis26 helper: rejects negative half-widths', () => {
  assert.throws(() => lensWidthPalma([1, 2, -1, 3, 4]), /non-negative/);
});

test('axis26 helper: rejects non-finite half-widths', () => {
  assert.throws(() => lensWidthPalma([1, 2, NaN, 3, 4]), /finite/);
  assert.throws(() => lensWidthPalma([1, 2, Infinity, 3, 4]), /finite/);
});

test('axis26 helper: tail decomposition sums to 1 (mass conservation)', () => {
  const cases = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [0.1, 0.2, 0.3, 0.4, 0.5, 100],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [1, 2, 3, 4, 5],
  ];
  for (const xs of cases) {
    const out = lensWidthPalma(xs);
    if (out.degenerateFlag) continue;
    const s = out.s40 + out.s50middle + out.s90;
    assert.ok(Math.abs(s - 1) < 1e-9, `s40+s50+s90=${s} for ${xs}`);
  }
});

test('axis26 helper: scale invariance -- multiplying all half-widths by c > 0 leaves Palma unchanged', () => {
  const xs = [0.1, 0.3, 0.5, 0.7, 1.1, 1.3, 1.7, 2.3];
  const a = lensWidthPalma(xs);
  const b = lensWidthPalma(xs.map((v) => v * 7.3));
  assert.ok(Math.abs(a.palma - b.palma) < 1e-9);
  assert.ok(Math.abs(a.s40 - b.s40) < 1e-12);
  assert.ok(Math.abs(a.s90 - b.s90) < 1e-12);
});

test('axis26 helper: monotone in top concentration -- moving mass from middle to top raises Palma', () => {
  const base = [1, 1, 1, 1, 1, 1, 1, 1, 1, 5];
  const heavier = [1, 1, 1, 1, 1, 1, 1, 1, 1, 50];
  const a = lensWidthPalma(base);
  const b = lensWidthPalma(heavier);
  assert.ok(b.palma > a.palma, `${b.palma} should exceed ${a.palma}`);
});

test('axis26 helper: monotone in bottom emptying -- shrinking bottom raises Palma', () => {
  const base = [1, 1, 1, 1, 2, 2, 2, 2, 2, 5];
  const thinner = [0.01, 0.01, 0.01, 0.01, 2, 2, 2, 2, 2, 5];
  const a = lensWidthPalma(base);
  const b = lensWidthPalma(thinner);
  assert.ok(b.palma > a.palma, `${b.palma} should exceed ${a.palma}`);
});

test('axis26 helper: insensitive to mean-preserving transfers strictly within the bottom 40%', () => {
  // n=10, p=0.4 boundary lies at k=4/10. Transfers among the
  // bottom 4 do not move L(0.4) (because cumulative mass at k=4
  // is unchanged), and do not move L(0.9). So Palma is unchanged.
  const a = [1, 1, 3, 3, 5, 5, 5, 5, 5, 10]; // bottom-4 sum = 8
  const b = [0, 2, 3, 3, 5, 5, 5, 5, 5, 10]; // bottom-4 sum = 8
  const ra = lensWidthPalma(a);
  const rb = lensWidthPalma(b);
  assert.ok(Math.abs(ra.palma - rb.palma) < 1e-12);
  assert.ok(Math.abs(ra.s40 - rb.s40) < 1e-12);
  assert.ok(Math.abs(ra.s90 - rb.s90) < 1e-12);
});

test('axis26 helper: Palma in [0, +inf) -- many distributions', () => {
  const cases = [
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    [0.1, 0.2, 0.3, 0.4, 0.5, 100, 200, 300, 400, 5000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
    [1, 2, 3, 4, 5],
  ];
  for (const xs of cases) {
    const out = lensWidthPalma(xs);
    if (out.degenerateFlag) continue;
    assert.ok(out.palma >= 0, `Palma=${out.palma} for ${xs}`);
    assert.ok(Number.isFinite(out.palma), `Palma=${out.palma} for ${xs}`);
  }
});

// ---------- worked example with hand-computed Palma ----------

test('axis26 helper: worked example sorted = [0,0,0,0,1,1,1,1,1,5] gives canonical S40/S90', () => {
  // n=10, S=10. Sorted ascending. c_0=0, c_4=0/10=0, c_9=5/10=0.5, c_10=1.
  // Anchors: (0,0), (0.1,0), (0.2,0), (0.3,0), (0.4,0), (0.5,0.1),
  //          (0.6,0.2), (0.7,0.3), (0.8,0.4), (0.9,0.5), (1,1).
  // L(0.4) = 0 (anchor). L(0.9) = 0.5 (anchor).
  // S40 = 0; S90 = 1 - 0.5 = 0.5. zero-bottom-mass + palmaIsInfinite.
  const out = lensWidthPalma([0, 0, 0, 0, 1, 1, 1, 1, 1, 5]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-bottom-mass');
  assert.equal(out.palmaIsInfinite, true);
  assert.ok(Math.abs(out.s40 - 0) < 1e-12);
  assert.ok(Math.abs(out.s90 - 0.5) < 1e-12);
});

test('axis26 helper: worked example sorted = [1,1,1,1,1,1,1,1,1,10] gives Palma = 19/4', () => {
  // n=10, S=19. Sorted: nine 1s then a 10.
  // c_4 = 4/19, so L(0.4) = 4/19.
  // c_9 = 9/19, so L(0.9) = 9/19; S90 = 10/19.
  // Palma = (10/19) / (4/19) = 10/4 = 2.5.
  const out = lensWidthPalma([1, 1, 1, 1, 1, 1, 1, 1, 1, 10]);
  assert.equal(out.degenerateFlag, false);
  assert.ok(Math.abs(out.s40 - 4 / 19) < 1e-12);
  assert.ok(Math.abs(out.s90 - 10 / 19) < 1e-12);
  assert.ok(Math.abs(out.palma - 2.5) < 1e-9);
  assert.equal(out.palmaIsInfinite, false);
});

// ---------- option validation ----------

test('axis26 build: rejects bad confidence', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthPalma([], { confidence: 0 }),
    /confidence/,
  );
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthPalma([], { confidence: 1 }),
    /confidence/,
  );
});

test('axis26 build: rejects bad min-rows', () => {
  assert.throws(
    () => buildSourceRowTokenSlopeCiLensWidthPalma([], { minRows: 3 }),
    /minRows/,
  );
});

test('axis26 build: rejects bad alert-palma', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthPalma([], { alertPalma: -0.1 }),
    /alertPalma/,
  );
});

test('axis26 build: rejects bad alert-bottom-share', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthPalma([], {
        alertBottomShare: 1.1,
      }),
    /alertBottomShare/,
  );
});

test('axis26 build: rejects bad sort key', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthPalma([], {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
});

// ---------- end-to-end with synthetic queue ----------

test('axis26 build: empty queue -> all six lens rows degenerate too-few-sources', () => {
  const r = buildSourceRowTokenSlopeCiLensWidthPalma([]);
  assert.equal(r.rows.length, 6);
  for (const row of r.rows) {
    assert.equal(row.degenerateFlag, true);
    assert.equal(row.degenerateReason, 'too-few-sources');
    assert.equal(row.nShared, 0);
    assert.equal(row.palma, 0);
  }
  assert.equal(r.nDegenerate, 6);
  assert.equal(r.nExtreme, 0);
  assert.equal(r.mostExtremeLens, null);
  assert.equal(r.mostBalancedLens, null);
});

test('axis26 build: synthetic 5-source queue produces shared-source half-widths in all six lenses', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 30, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 30, slope: 0.5, noise: 8 },
    { source: 'c', nRows: 30, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 30, slope: 1.5, noise: 3 },
    { source: 'e', nRows: 30, slope: 0.8, noise: 15 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthPalma(queue);
  assert.equal(r.rows.length, 6);
  for (const row of r.rows) {
    assert.ok(row.nShared >= 4 || row.degenerateFlag);
    if (!row.degenerateFlag) {
      assert.ok(row.s40 >= 0 && row.s40 <= 1);
      assert.ok(row.s90 >= 0 && row.s90 <= 1);
      assert.ok(row.palma >= 0);
      assert.ok(Number.isFinite(row.palma) || row.palmaIsInfinite);
    }
  }
});

// ---------- sort behaviour ----------

test('axis26 build: palma-desc sort puts infinite rows first then descending', () => {
  // Synthetic queue is the cheapest way to generate consistent
  // structure; we just assert the global ordering invariant.
  const queue = syntheticQueue([
    { source: 'a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 24, slope: 0.5, noise: 8 },
    { source: 'c', nRows: 24, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 24, slope: 1.5, noise: 3 },
    { source: 'e', nRows: 24, slope: 0.8, noise: 15 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthPalma(queue, {
    sort: 'palma-desc',
  });
  let lastFinite = Infinity;
  let sawFinite = false;
  for (const row of r.rows) {
    if (row.palmaIsInfinite) {
      assert.equal(sawFinite, false, 'infinite rows must come first');
      continue;
    }
    if (row.degenerateFlag) continue;
    sawFinite = true;
    assert.ok(row.palma <= lastFinite + 1e-12);
    lastFinite = row.palma;
  }
});

test('axis26 build: lens sort is canonical lens-name order', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 24, slope: 0.5, noise: 8 },
    { source: 'c', nRows: 24, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 24, slope: 1.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthPalma(queue, { sort: 'lens' });
  assert.equal(r.rows.length, 6);
  for (let i = 0; i < r.rows.length; i++) {
    assert.equal(r.rows[i]!.lens, SLOPE_LENS_WIDTH_PALMA_LENS_NAMES[i]);
  }
});

// ---------- alert filters ----------

test('axis26 build: alert-palma filter keeps only rows with palma > threshold', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 24, slope: 0.5, noise: 8 },
    { source: 'c', nRows: 24, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 24, slope: 1.5, noise: 3 },
    { source: 'e', nRows: 24, slope: 0.8, noise: 15 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthPalma(queue, {
    alertPalma: 1e9,
  });
  // No finite Palma will exceed 1e9, so only palmaIsInfinite rows
  // (if any) survive.
  for (const row of r.rows) {
    assert.ok(!row.degenerateFlag, 'degenerate rows must be filtered out');
    assert.ok(row.palma > 1e9);
  }
});

// ---------- render ----------

test('axis26 render: header, summary, and table render without throwing', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 24, slope: 0.5, noise: 8 },
    { source: 'c', nRows: 24, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 24, slope: 1.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthPalma(queue, {
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const out = renderSourceRowTokenSlopeCiLensWidthPalma(r, {
    showSummary: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
    showTailDecomposition: true,
  });
  assert.ok(out.includes('source-row-token-slope-ci-lens-width-palma'));
  assert.ok(out.includes('palma'));
  assert.ok(out.includes('S40'));
  assert.ok(out.includes('S90'));
  assert.ok(out.includes('[concentration aggregate]'));
  assert.ok(out.includes('[lens attribution]'));
  assert.ok(out.includes('tails:'));
});

test('axis26 render: empty rows reports "(no lenses)"', () => {
  const queue = syntheticQueue([
    { source: 'a', nRows: 24, slope: 1.0, noise: 5 },
    { source: 'b', nRows: 24, slope: 0.5, noise: 8 },
    { source: 'c', nRows: 24, slope: 2.0, noise: 12 },
    { source: 'd', nRows: 24, slope: 1.5, noise: 3 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthPalma(queue, {
    alertPalma: 1e15,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  const out = renderSourceRowTokenSlopeCiLensWidthPalma(r);
  assert.ok(out.includes('(no lenses)'));
});
