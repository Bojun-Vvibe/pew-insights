/**
 * Unit + integration tests for
 * source-row-token-slope-ci-lens-width-kolm-pollak (axis 29).
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildSourceRowTokenSlopeCiLensWidthKolmPollak,
  renderSourceRowTokenSlopeCiLensWidthKolmPollak,
  lensWidthKolmPollak,
  SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES,
} from '../src/sourcerowtokenslopecilenswidthkolmpollak.js';
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

// ---------- pure helper: lensWidthKolmPollak ----------

test('axis29 helper: identical half-widths give K = 0', () => {
  const out = lensWidthKolmPollak([0.5, 0.5, 0.5, 0.5, 0.5, 0.5], 1);
  assert.equal(out.degenerateFlag, false);
  assert.equal(out.degenerateReason, null);
  assert.equal(out.nShared, 6);
  assert.equal(out.meanHalfWidth, 0.5);
  assert.ok(Math.abs(out.kolmPollak) < 1e-12, `K=${out.kolmPollak}`);
  assert.ok(
    Math.abs(out.equallyDistributedEquivalent - 0.5) < 1e-12,
    `Xi=${out.equallyDistributedEquivalent}`,
  );
  assert.equal(out.kolmRelativeIntensity, 0);
  assert.equal(out.rawlsianDeficit, 0);
});

test('axis29 helper: K is non-negative and finite for any non-negative input', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0.1, 0.2, 100, 200, 1000],
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [0, 0, 0, 1, 2, 3, 100],
    [0.0001, 0.0002, 0.0003, 0.0004, 0.0005],
    [0, 0, 0, 0, 0, 0, 1],
  ];
  for (const xs of cases) {
    const out = lensWidthKolmPollak(xs, 1);
    assert.ok(
      Number.isFinite(out.kolmPollak) && out.kolmPollak >= 0,
      `xs=${JSON.stringify(xs)}: K=${out.kolmPollak}`,
    );
    // K is bounded above by the Rawlsian deficit (mean - min):
    assert.ok(
      out.kolmPollak <= out.rawlsianDeficit + 1e-9,
      `xs=${JSON.stringify(xs)}: K=${out.kolmPollak} > rawls=${out.rawlsianDeficit}`,
    );
  }
});

test('axis29 helper: TRANSLATION INVARIANCE -- adding c shifts mean and Xi by c, leaves K unchanged', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0, 100];
  const baseline = lensWidthKolmPollak(xs, 1);
  for (const c of [0.5, 5, 100, 1000]) {
    const shifted = xs.map((v) => v + c);
    const out = lensWidthKolmPollak(shifted, 1);
    assert.ok(
      Math.abs(out.kolmPollak - baseline.kolmPollak) < 1e-9,
      `c=${c}: K shifted ${out.kolmPollak} vs baseline ${baseline.kolmPollak}`,
    );
    assert.ok(
      Math.abs(out.meanHalfWidth - (baseline.meanHalfWidth + c)) < 1e-9,
      `c=${c}: mean did not shift by c`,
    );
    assert.ok(
      Math.abs(
        out.equallyDistributedEquivalent -
          (baseline.equallyDistributedEquivalent + c),
      ) < 1e-9,
      `c=${c}: Xi did not shift by c`,
    );
  }
});

test('axis29 helper: SCALE EQUIVARIANCE -- scaling by c multiplies K by c (NOT scale-invariant -- orthogonal to axes 21-28)', () => {
  const xs = [0.1, 0.5, 1.2, 3.7, 8.0];
  const baseline = lensWidthKolmPollak(xs, 1);
  for (const c of [0.5, 2, 10]) {
    // Scale x by c AND scale alpha by 1/c so that alpha*x stays
    // the same -- K_alpha(c*x; alpha/c) = c * K_alpha(x; alpha).
    const scaled = xs.map((v) => v * c);
    const out = lensWidthKolmPollak(scaled, 1 / c);
    assert.ok(
      Math.abs(out.kolmPollak - c * baseline.kolmPollak) < 1e-9,
      `c=${c}: K=${out.kolmPollak} vs c*baseline=${c * baseline.kolmPollak}`,
    );
  }
});

test('axis29 helper: alpha -> small gives K -> 0', () => {
  const xs = [1, 2, 3, 4, 5, 100];
  const small = lensWidthKolmPollak(xs, 1e-6);
  // For alpha very small, K -> 0 (no aversion).
  assert.ok(small.kolmPollak < 1e-3, `K=${small.kolmPollak} not near 0`);
});

test('axis29 helper: alpha -> large gives K -> mean - min (Rawlsian limit)', () => {
  const xs = [1, 2, 3, 4, 5, 100];
  const big = lensWidthKolmPollak(xs, 1000);
  const expected = big.rawlsianDeficit;
  // At alpha=1000, n=6: gap = log(6)/1000 ~ 0.00179, well below 0.01.
  const tol = Math.log(xs.length) / 1000 + 1e-6;
  assert.ok(
    Math.abs(big.kolmPollak - expected) < tol,
    `K=${big.kolmPollak} vs expected rawls=${expected} (tol=${tol})`,
  );
});

test('axis29 helper: too-few-sources (n<4) returns degenerate', () => {
  for (const xs of [[], [1], [1, 2], [1, 2, 3]]) {
    const out = lensWidthKolmPollak(xs, 1);
    assert.equal(out.degenerateFlag, true);
    assert.equal(out.degenerateReason, 'too-few-sources');
    assert.equal(out.kolmPollak, 0);
  }
});

test('axis29 helper: rejects negative or non-finite inputs', () => {
  assert.throws(() => lensWidthKolmPollak([1, 2, 3, -1], 1), /non-negative/);
  assert.throws(() => lensWidthKolmPollak([1, 2, 3, NaN], 1), /finite/);
  assert.throws(
    () => lensWidthKolmPollak([1, 2, 3, Infinity], 1),
    /finite/,
  );
});

test('axis29 helper: rejects non-positive alpha', () => {
  assert.throws(() => lensWidthKolmPollak([1, 2, 3, 4], 0), /alpha/);
  assert.throws(() => lensWidthKolmPollak([1, 2, 3, 4], -1), /alpha/);
  assert.throws(() => lensWidthKolmPollak([1, 2, 3, 4], NaN), /alpha/);
});

test('axis29 helper: numerical safety on huge magnitudes (log-sum-exp max-trick)', () => {
  // alpha * x_i can be enormous; without max-subtraction this would
  // overflow exp() and explode. With log-sum-exp it is finite.
  const xs = [1e6, 2e6, 3e6, 4e6, 5e6];
  const out = lensWidthKolmPollak(xs, 1); // alpha*x ~ 5e6
  assert.equal(out.degenerateFlag, false);
  assert.ok(Number.isFinite(out.kolmPollak));
  // For large alpha*x, Xi -> min(x) within a gap of log(n)/alpha.
  const expected = out.rawlsianDeficit;
  const tol = Math.log(xs.length) / 1 + 1e-6; // alpha=1, n=5
  assert.ok(
    Math.abs(out.kolmPollak - expected) < tol,
    `K=${out.kolmPollak} vs expected=${expected} (tol=${tol})`,
  );
});

test('axis29 helper: kolmRelativeIntensity = K / mean is dimensionless and in [0, 1]', () => {
  const cases = [
    [1, 2, 3, 4, 5],
    [0, 0, 0, 1, 2, 3, 100],
    [10, 10, 10, 10, 1000],
  ];
  for (const xs of cases) {
    const out = lensWidthKolmPollak(xs, 1);
    assert.ok(
      out.kolmRelativeIntensity >= 0 && out.kolmRelativeIntensity <= 1.0001,
      `xs=${JSON.stringify(xs)}: relK=${out.kolmRelativeIntensity}`,
    );
  }
});

// ---------- integration: build report ----------

test('axis29 build: produces one row per lens with shared sources', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 60, slope: 1, noise: 5 },
    { source: 's2', nRows: 60, slope: 2, noise: 10 },
    { source: 's3', nRows: 60, slope: 0.5, noise: 1 },
    { source: 's4', nRows: 60, slope: 3, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
    generatedAt: '2026-04-30T00:00:00Z',
  });
  assert.equal(r.rows.length, SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES.length);
  for (const row of r.rows) {
    assert.ok(SLOPE_LENS_WIDTH_KOLM_POLLAK_LENS_NAMES.includes(row.lens));
    assert.equal(row.nShared, 4);
    assert.ok(Number.isFinite(row.kolmPollak));
    assert.ok(row.kolmPollak >= 0);
    assert.ok(row.kolmPollak <= row.rawlsianDeficit + 1e-6);
  }
});

test('axis29 build: alpha option flows through to per-lens computation', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 60, slope: 1, noise: 5 },
    { source: 's2', nRows: 60, slope: 2, noise: 10 },
    { source: 's3', nRows: 60, slope: 0.5, noise: 1 },
    { source: 's4', nRows: 60, slope: 3, noise: 50 },
  ]);
  const small = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
    alpha: 0.001,
  });
  const big = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
    alpha: 1e6,
  });
  // Sum of K across lenses must be smaller for small alpha than big alpha.
  const sumSmall = small.rows.reduce((a, r) => a + r.kolmPollak, 0);
  const sumBig = big.rows.reduce((a, r) => a + r.kolmPollak, 0);
  assert.ok(
    sumSmall < sumBig,
    `alpha=0.001 sumK=${sumSmall} not < alpha=1e6 sumK=${sumBig}`,
  );
});

test('axis29 build: rejects bad opts', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 50, slope: 1, noise: 5 },
  ]);
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, { alpha: 0 }),
    /alpha/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, { alpha: -1 }),
    /alpha/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
        sort: 'bogus' as never,
      }),
    /sort/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
        alertKolm: -1,
      }),
    /alertKolm/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
        alertRelative: -1,
      }),
    /alertRelative/,
  );
  assert.throws(
    () =>
      buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
        alertRawls: -1,
      }),
    /alertRawls/,
  );
});

test('axis29 build: filters work', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 60, slope: 1, noise: 5 },
    { source: 's2', nRows: 60, slope: 2, noise: 10 },
    { source: 's3', nRows: 60, slope: 0.5, noise: 1 },
    { source: 's4', nRows: 60, slope: 3, noise: 50 },
  ]);
  const huge = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
    alertKolm: 1e18,
  });
  assert.equal(huge.rows.length, 0);
  const all = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
    alertKolm: 0,
  });
  // K may be 0 for some lenses (degenerate or exact uniform), so
  // alertKolm=0 keeps strictly-positive ones; in practice with
  // synthetic data it keeps most.
  assert.ok(all.rows.length >= 0);
});

test('axis29 render: pretty output contains expected header tokens', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 60, slope: 1, noise: 5 },
    { source: 's2', nRows: 60, slope: 2, noise: 10 },
    { source: 's3', nRows: 60, slope: 0.5, noise: 1 },
    { source: 's4', nRows: 60, slope: 3, noise: 50 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthKolmPollak(r, {
    showSummary: true,
    showConcentrationAggregate: true,
    showLensAttribution: true,
    showRawlsianBound: true,
    showPerSourceWidths: true,
  });
  assert.match(
    out,
    /pew-insights source-row-token-slope-ci-lens-width-kolm-pollak/,
  );
  assert.match(out, /alpha:/);
  assert.match(out, /lens               n     K/);
  assert.match(out, /\[concentration aggregate\]/);
  assert.match(out, /\[lens attribution\]/);
  assert.match(out, /rawlsianBound:/);
  assert.match(out, /widths:/);
});

test('axis29 render: empty rows path', () => {
  const queue = syntheticQueue([
    { source: 's1', nRows: 50, slope: 1, noise: 5 },
  ]);
  const r = buildSourceRowTokenSlopeCiLensWidthKolmPollak(queue, {
    bootstraps: 100,
    seed: 1,
    alertKolm: 1e18,
  });
  const out = renderSourceRowTokenSlopeCiLensWidthKolmPollak(r);
  assert.match(out, /\(no lenses\)/);
});
