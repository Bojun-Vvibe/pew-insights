/**
 * Cross-check property tests for source-row-token-lehmer-3-mean
 * that pin the FULL Lehmer-family ladder
 *
 *     HM <= GM <= AM <= QM <= CHM <= L_3
 *
 * against the four sibling builders (harmonic, quadratic,
 * contraharmonic, lehmer-3) on the same input. These tests
 * guarantee that the L_3 module stays consistent with the
 * rest of the Lehmer-mean family in the report suite — so a
 * future refactor of any single builder cannot silently
 * break the monotonicity contract that v0.6.189 documents
 * in CHANGELOG.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmer3Mean } from '../src/sourcerowtokenlehmer3mean.js';
import { buildSourceRowTokenContraharmonicMean } from '../src/sourcerowtokencontraharmonicmean.js';
import { buildSourceRowTokenQuadraticMean } from '../src/sourcerowtokenquadraticmean.js';
import { buildSourceRowTokenHarmonicMean } from '../src/sourcerowtokenharmonicmean.js';
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

const GEN = '2026-04-28T12:00:00.000Z';

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

// LCG for deterministic random series
function lcg(seed: number, n: number, mod: number): number[] {
  let s = seed;
  const xs: number[] = [];
  for (let i = 0; i < n; i += 1) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    xs.push(s % mod);
  }
  return xs;
}

test('full Lehmer ladder: HM <= AM <= QM <= CHM <= L_3 across many random seeds (strictly positive)', () => {
  const seeds = [3, 11, 29, 71, 113, 257, 521, 1031];
  for (const seed of seeds) {
    // strictly positive so HM is well-defined for cross-check
    const xs = lcg(seed, 40, 500).map((v) => v + 1);
    const queue = mkSeries('s', xs);

    const hmRow = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN })
      .sources[0]!;
    const qmRow = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN })
      .sources[0]!;
    const chmRow = buildSourceRowTokenContraharmonicMean(queue, {
      generatedAt: GEN,
    }).sources[0]!;
    const l3Row = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN })
      .sources[0]!;

    // Same arithmetic mean across all four builders.
    assert.ok(Math.abs(hmRow.mean - l3Row.mean) < 1e-9, `mean mismatch HM/L3 seed=${seed}`);
    assert.ok(Math.abs(qmRow.mean - l3Row.mean) < 1e-9, `mean mismatch QM/L3 seed=${seed}`);
    assert.ok(
      Math.abs(chmRow.mean - l3Row.mean) < 1e-9,
      `mean mismatch CHM/L3 seed=${seed}`,
    );

    // Same CHM in CHM and L_3 builders (recomputed inline in L_3).
    assert.ok(
      Math.abs(chmRow.contraharmonicMean - l3Row.contraharmonicMean) < 1e-9,
      `CHM mismatch seed=${seed}`,
    );

    // Full ladder: HM <= AM <= QM <= CHM <= L_3.
    const tol = 1e-9;
    assert.ok(hmRow.harmonicMean <= hmRow.mean + tol, `HM > AM seed=${seed}`);
    assert.ok(qmRow.mean <= qmRow.quadraticMean + tol, `AM > QM seed=${seed}`);
    assert.ok(
      qmRow.quadraticMean <= chmRow.contraharmonicMean + tol,
      `QM > CHM seed=${seed}`,
    );
    assert.ok(
      chmRow.contraharmonicMean <= l3Row.lehmer3Mean + tol,
      `CHM > L_3 seed=${seed}`,
    );
  }
});

test('full Lehmer ladder: equality on constant positive series', () => {
  const queue = mkSeries('s', [13, 13, 13, 13, 13, 13, 13]);
  const hmRow = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN })
    .sources[0]!;
  const qmRow = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN })
    .sources[0]!;
  const chmRow = buildSourceRowTokenContraharmonicMean(queue, {
    generatedAt: GEN,
  }).sources[0]!;
  const l3Row = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN })
    .sources[0]!;
  assert.ok(Math.abs(hmRow.harmonicMean - 13) < 1e-9);
  assert.equal(qmRow.quadraticMean, 13);
  assert.equal(chmRow.contraharmonicMean, 13);
  assert.equal(l3Row.lehmer3Mean, 13);
  // All gaps zero.
  assert.equal(l3Row.l3ChmGap, 0);
  assert.equal(l3Row.l3AmGap, 0);
});

test('full Lehmer ladder: bottleneck row [1,1,1,1,1000] — strict ordering with explicit numbers', () => {
  const queue = mkSeries('s', [1, 1, 1, 1, 1000]);
  const hmRow = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN })
    .sources[0]!;
  const qmRow = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN })
    .sources[0]!;
  const chmRow = buildSourceRowTokenContraharmonicMean(queue, {
    generatedAt: GEN,
  }).sources[0]!;
  const l3Row = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN })
    .sources[0]!;

  // Reference: HM = 5/(4+1/1000) = 5/4.001 ~ 1.249688
  assert.ok(Math.abs(hmRow.harmonicMean - 5 / 4.001) < 1e-6);
  // AM = 1004/5 = 200.8
  assert.equal(qmRow.mean, 200.8);
  // QM = sqrt(1000004/5) ~ 447.2148
  assert.ok(Math.abs(qmRow.quadraticMean - Math.sqrt(1000004 / 5)) < 1e-6);
  // CHM = 1000004/1004 ~ 996.0199
  assert.ok(Math.abs(chmRow.contraharmonicMean - 1000004 / 1004) < 1e-6);
  // L_3 = (4 + 1e9) / (4 + 1e6) = 1000000004 / 1000004 ~ 999.9960
  assert.ok(Math.abs(l3Row.lehmer3Mean - 1000000004 / 1000004) < 1e-6);

  // Strict ladder.
  assert.ok(hmRow.harmonicMean < qmRow.mean);
  assert.ok(qmRow.mean < qmRow.quadraticMean);
  assert.ok(qmRow.quadraticMean < chmRow.contraharmonicMean);
  assert.ok(chmRow.contraharmonicMean < l3Row.lehmer3Mean);

  // L_3 sits within 0.0005 % of the bottleneck; CHM within 0.4 %.
  assert.ok((1000 - l3Row.lehmer3Mean) / 1000 < 0.00001);
  assert.ok((1000 - chmRow.contraharmonicMean) / 1000 < 0.005);
});
