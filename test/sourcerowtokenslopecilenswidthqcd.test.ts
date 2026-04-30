/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-qcd (axis 24).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthQcd,
  renderSourceRowTokenSlopeCiLensWidthQcd,
  lensWidthQcd,
  q3q1Ratio,
  SLOPE_LENS_WIDTH_QCD_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthqcd.js';
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

// ---------- pure helper: lensWidthQcd ----------

test('axis24 helper: perfectly equal half-widths give QCD = 0', () => {
  const out = lensWidthQcd([0.5, 0.5, 0.5, 0.5, 0.5, 0.5]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.q1HalfWidth, 0.5);
  assert.equal(out.q3HalfWidth, 0.5);
  assert.equal(out.iqrHalfWidth, 0);
  assert.equal(out.qcd, 0);
});

test('axis24 helper: QCD bounded in [0, 1] for any non-negative distribution', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
    [0.0001, 0.0002, 0.0003, 0.0004, 0.0005],
  ];
  for (const xs of cases) {
    const out = lensWidthQcd(xs);
    assert.ok(
      out.qcd >= 0 && out.qcd <= 1,
      `xs=${JSON.stringify(xs)}: QCD=${out.qcd} out of [0,1]`,
    );
  }
});

test('axis24 helper: QCD matches direct definition (Q3 - Q1) / (Q3 + Q1)', () => {
  // For xs = [1, 2, 3, 4, 5, 6, 7, 8] (n=8), Hyndman-Fan type 7:
  //   h_25 = 7 * 0.25 = 1.75 -> Q1 = sorted[1] + 0.75*(sorted[2]-sorted[1]) = 2 + 0.75*1 = 2.75
  //   h_75 = 7 * 0.75 = 5.25 -> Q3 = sorted[5] + 0.25*(sorted[6]-sorted[5]) = 6 + 0.25*1 = 6.25
  //   QCD = (6.25 - 2.75) / (6.25 + 2.75) = 3.5 / 9 ≈ 0.388889
  const out = lensWidthQcd([1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(Math.abs(out.q1HalfWidth - 2.75) < 1e-12);
  assert.ok(Math.abs(out.q3HalfWidth - 6.25) < 1e-12);
  const expected = (6.25 - 2.75) / (6.25 + 2.75);
  assert.ok(Math.abs(out.qcd - expected) < 1e-12, `got ${out.qcd}, expected ${expected}`);
});

test('axis24 helper: scale-invariance — QCD(c*xs) = QCD(xs) for c > 0', () => {
  const xs = [1, 2, 5, 7, 11, 13];
  const baseline = lensWidthQcd(xs);
  for (const c of [0.001, 1, 100, 1e6]) {
    const scaled = lensWidthQcd(xs.map((x) => x * c));
    assert.ok(
      Math.abs(scaled.qcd - baseline.qcd) < 1e-12,
      `c=${c}: QCD=${scaled.qcd} vs baseline=${baseline.qcd}`,
    );
  }
});

test('axis24 helper: zero-immunity — up to floor(n/2) zeros do NOT degenerate', () => {
  // Half the sources zero; QCD still well-defined as long as Q3 > 0.
  // xs = [0, 0, 0, 0, 1, 2, 3, 4] (n=8): sorted same.
  //   h_25 = 1.75 -> Q1 = 0 + 0.75*(0-0) = 0
  //   h_75 = 5.25 -> Q3 = 2 + 0.25*(3-2) = 2.25
  //   QCD = (2.25 - 0) / (2.25 + 0) = 1
  const out = lensWidthQcd([0, 0, 0, 0, 1, 2, 3, 4]);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.q1HalfWidth, 0);
  assert.ok(Math.abs(out.q3HalfWidth - 2.25) < 1e-12);
  assert.equal(out.qcd, 1);
});

test('axis24 helper: degeneracy on too few sources (n < 4)', () => {
  for (const xs of [[], [0.5], [0.5, 1], [0.5, 1, 1.5]]) {
    const out = lensWidthQcd(xs);
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.qcd, 0);
  }
});

test('axis24 helper: degeneracy on Q3 = 0 (>=75% of sources are zero)', () => {
  // xs = [0,0,0,0,0,0,0,1] (n=8, only the max is nonzero)
  // Q3 at p=0.75 → h=5.25, sorted[5]=0, sorted[6]=0 → Q3=0
  const out = lensWidthQcd([0, 0, 0, 0, 0, 0, 0, 1]);
  assert.equal(out.degenerateFlag, true);
  assert.equal(out.degenerateReason, 'zero-q3');
  assert.equal(out.qcd, 0);
});

test('axis24 helper: throws on negative or non-finite half-widths', () => {
  assert.throws(() => lensWidthQcd([1, 2, -1, 3, 4]), /non-negative/);
  assert.throws(() => lensWidthQcd([1, 2, NaN, 3, 4]), /finite/);
  assert.throws(() => lensWidthQcd([1, 2, Infinity, 3, 4]), /finite/);
});

test('axis24 helper: ROBUSTNESS — single arbitrary outlier does NOT change Q1/Q3 of an n>=8 cloud', () => {
  // Replace the max element with a 1000x outlier; Q1 and Q3 should be unchanged.
  const base = [1, 2, 3, 4, 5, 6, 7, 8];
  const outlier = [1, 2, 3, 4, 5, 6, 7, 8000];
  const a = lensWidthQcd(base);
  const b = lensWidthQcd(outlier);
  // Q3 sits at h=5.25 -> sorted[5]=6 + 0.25*(sorted[6]-sorted[5]) = 6 + 0.25*(7-6) = 6.25
  // For outlier: sorted[5]=6, sorted[6]=7 unchanged.
  assert.ok(Math.abs(a.q1HalfWidth - b.q1HalfWidth) < 1e-12);
  assert.ok(Math.abs(a.q3HalfWidth - b.q3HalfWidth) < 1e-12);
  assert.ok(Math.abs(a.qcd - b.qcd) < 1e-12);
});

// ---------- integration: full report builder ----------

test('axis24 integration: report has six lens rows and bounded summary stats', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 50, slope: 1, noise: 5 },
    { source: 'src-b', nRows: 50, slope: 2, noise: 30 },
    { source: 'src-c', nRows: 50, slope: 0.5, noise: 8 },
    { source: 'src-d', nRows: 50, slope: 3, noise: 10 },
    { source: 'src-e', nRows: 50, slope: 1.5, noise: 15 },
    { source: 'src-f', nRows: 50, slope: 0.8, noise: 7 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthQcd(queue, {
    bootstraps: 100,
    seed: 7,
    generatedAt: '2026-01-01T00:00:00Z',
  });
  assert.equal(report.sort, 'qcd-desc');
  assert.equal(report.rows.length, SLOPE_LENS_WIDTH_QCD_LENS_NAMES.length);
  for (const row of report.rows) {
    assert.ok(row.qcd >= 0 && row.qcd <= 1, `${row.lens}: QCD=${row.qcd}`);
    assert.ok(row.iqrHalfWidth >= 0);
    assert.ok(row.q3HalfWidth >= row.q1HalfWidth - 1e-12);
  }
  assert.ok(report.meanQcd >= 0 && report.meanQcd <= 1);
  assert.ok(report.maxQcd >= report.minQcd);
  // Sorted desc by QCD
  for (let i = 1; i < report.rows.length; i++) {
    assert.ok(report.rows[i - 1]!.qcd >= report.rows[i]!.qcd);
  }
});

test('axis24 integration: alert-qcd filter', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 40, slope: 1, noise: 3 },
    { source: 'src-b', nRows: 40, slope: 2, noise: 25 },
    { source: 'src-c', nRows: 40, slope: 1.5, noise: 6 },
    { source: 'src-d', nRows: 40, slope: 0.8, noise: 4 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthQcd(queue, {
    bootstraps: 100,
    seed: 11,
    alertQcd: 0.99,
    generatedAt: '2026-01-01T00:00:00Z',
  });
  // Almost certainly nothing passes a 0.99 floor.
  for (const row of report.rows) {
    assert.ok(row.qcd > 0.99, `row ${row.lens} leaked through filter`);
  }
});

test('axis24 integration: render produces non-empty plain text', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 30, slope: 1, noise: 3 },
    { source: 'src-b', nRows: 30, slope: 2, noise: 8 },
    { source: 'src-c', nRows: 30, slope: 0.5, noise: 4 },
    { source: 'src-d', nRows: 30, slope: 1.5, noise: 6 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthQcd(queue, {
    bootstraps: 100,
    seed: 3,
    generatedAt: '2026-01-01T00:00:00Z',
  });
  const out = renderSourceRowTokenSlopeCiLensWidthQcd(report, {
    showSummary: true,
    showDispersionAggregate: true,
    showLensAttribution: true,
    showQuartiles: true,
  });
  assert.ok(out.includes('source-row-token-slope-ci-lens-width-qcd'));
  assert.ok(out.includes('QCD'));
  assert.ok(out.includes('quartiles:'));
  assert.ok(out.includes('[dispersion aggregate]'));
  assert.ok(out.includes('[lens attribution]'));
});

test('axis24 integration: invalid options throw', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], { minRows: 1 }),
    /minRows/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], { confidence: 1.5 }),
    /confidence/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], { lambda: 0 }),
    /lambda/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], { bootstraps: 50 }),
    /bootstraps/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], { alertQcd: 1.5 }),
    /alertQcd/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], {
        sort: 'bogus' as 'qcd-desc',
      }),
    /sort/,
  );
});

// ---------- refinement (v0.6.252): q3q1Ratio helper + alert/sort/render ----------

test('axis24 refinement: q3q1Ratio matches direct definition Q3 / Q1', () => {
  assert.equal(q3q1Ratio(2, 8), 4);
  assert.equal(q3q1Ratio(0.5, 0.5), 1);
  assert.equal(q3q1Ratio(1, 1000), 1000);
});

test('axis24 refinement: q3q1Ratio = +Infinity when Q1 = 0 < Q3', () => {
  assert.equal(q3q1Ratio(0, 1), Infinity);
  assert.equal(q3q1Ratio(0, 0.0001), Infinity);
});

test('axis24 refinement: q3q1Ratio = NaN when Q3 = 0 (degenerate)', () => {
  assert.ok(Number.isNaN(q3q1Ratio(0, 0)));
});

test('axis24 refinement: q3q1Ratio = NaN on negative or non-finite inputs', () => {
  assert.ok(Number.isNaN(q3q1Ratio(-1, 1)));
  assert.ok(Number.isNaN(q3q1Ratio(1, -1)));
  assert.ok(Number.isNaN(q3q1Ratio(NaN, 1)));
  assert.ok(Number.isNaN(q3q1Ratio(1, Infinity)));
});

test('axis24 refinement: --alert-q3-q1-ratio filter and q3-q1-ratio-desc sort', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 40, slope: 1, noise: 3 },
    { source: 'src-b', nRows: 40, slope: 2, noise: 25 },
    { source: 'src-c', nRows: 40, slope: 1.5, noise: 6 },
    { source: 'src-d', nRows: 40, slope: 0.8, noise: 4 },
  ]);
  // Sort by q3/q1 ratio desc; expect monotone non-increasing finite ratios.
  const report = buildSourceRowTokenSlopeCiLensWidthQcd(queue, {
    bootstraps: 100,
    seed: 5,
    sort: 'q3-q1-ratio-desc',
    generatedAt: '2026-01-01T00:00:00Z',
  });
  let prev = Infinity;
  for (const row of report.rows) {
    const ratio = q3q1Ratio(row.q1HalfWidth, row.q3HalfWidth);
    if (Number.isFinite(ratio)) {
      assert.ok(
        ratio <= prev + 1e-9,
        `ratio for ${row.lens} = ${ratio} broke desc order (prev=${prev})`,
      );
      prev = ratio;
    }
  }
  // alert-q3-q1-ratio = 1e9 should drop everything realistic.
  const filtered = buildSourceRowTokenSlopeCiLensWidthQcd(queue, {
    bootstraps: 100,
    seed: 5,
    alertQ3Q1Ratio: 1e9,
    generatedAt: '2026-01-01T00:00:00Z',
  });
  assert.equal(filtered.rows.length, 0);
});

test('axis24 refinement: alertQ3Q1Ratio < 1 throws', () => {
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthQcd([], { alertQ3Q1Ratio: 0.5 }),
    /alertQ3Q1Ratio/,
  );
});

test('axis24 refinement: --show-q3-q1-ratio appears in render', () => {
  const queue = syntheticQueue([
    { source: 'src-a', nRows: 30, slope: 1, noise: 3 },
    { source: 'src-b', nRows: 30, slope: 2, noise: 8 },
    { source: 'src-c', nRows: 30, slope: 0.5, noise: 4 },
    { source: 'src-d', nRows: 30, slope: 1.5, noise: 6 },
  ]);
  const report = buildSourceRowTokenSlopeCiLensWidthQcd(queue, {
    bootstraps: 100,
    seed: 9,
    generatedAt: '2026-01-01T00:00:00Z',
  });
  const out = renderSourceRowTokenSlopeCiLensWidthQcd(report, {
    showQ3Q1Ratio: true,
  });
  assert.ok(out.includes('q3q1Ratio:'));
  assert.ok(out.includes('Q3/Q1='));
});
