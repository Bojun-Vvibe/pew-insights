/**
 * source-row-token-lehmer-neg-1-mean: refinement property
 * tests pinning the symmetric integer Lehmer ladder
 * `L_-1 <= HM <= AM <= QM <= CHM <= L_3` against sibling
 * builders, plus randomized scale-equivariance / order-
 * invariance / single-row-domination invariants.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmerNegOneMean } from '../src/sourcerowtokenlehmernegonemean.js';
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
    model: 'm',
    hour_start,
    device_id: 'd',
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

// Mulberry32 PRNG for deterministic tests
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('lehmer-neg-1-mean refinement: full symmetric ladder L_-1 <= HM <= AM <= QM <= CHM <= L_3 pinned across 200 randomized samples', () => {
  const rand = rng(0xa5a5a5a5);
  for (let trial = 0; trial < 200; trial += 1) {
    const n = 4 + Math.floor(rand() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      // strictly positive — required for L_-1
      xs.push(0.5 + rand() * 1000);
    }
    const queue = mkSeries('s', xs);
    const rNeg1 = buildSourceRowTokenLehmerNegOneMean(queue, {
      generatedAt: GEN,
    });
    const rHm = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN });
    const rQm = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN });
    const rChm = buildSourceRowTokenContraharmonicMean(queue, {
      generatedAt: GEN,
    });
    const rL3 = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN });

    const lneg1 = rNeg1.sources[0]!.lehmerNegOneMean;
    const hm = rHm.sources[0]!.harmonicMean;
    const am = rNeg1.sources[0]!.mean;
    const qm = rQm.sources[0]!.quadraticMean;
    const chm = rChm.sources[0]!.contraharmonicMean;
    const l3 = rL3.sources[0]!.lehmer3Mean;

    const eps = 1e-7 * Math.max(1, l3);
    assert.ok(lneg1 <= hm + eps, `L_-1 > HM @ trial ${trial}: ${lneg1} > ${hm}`);
    assert.ok(hm <= am + eps, `HM > AM @ trial ${trial}: ${hm} > ${am}`);
    assert.ok(am <= qm + eps, `AM > QM @ trial ${trial}: ${am} > ${qm}`);
    assert.ok(qm <= chm + eps, `QM > CHM @ trial ${trial}: ${qm} > ${chm}`);
    assert.ok(chm <= l3 + eps, `CHM > L_3 @ trial ${trial}: ${chm} > ${l3}`);
  }
});

test('lehmer-neg-1-mean refinement: L_-1 and L_3 mirror across AM — gap symmetry on a self-reciprocal-pair sample', () => {
  // Construct a sample where x and 1/x both appear: under
  // p -> -p Lehmer flip with appropriate normalisation,
  // L_-1 of [c*x_i] equals c^2 / L_3 of [c*x_i] for the
  // canonical reciprocal-pair sample. We verify the weaker
  // but still strong invariant: as the multiplicative
  // spread of the sample widens, both gaps grow monotonically.
  const tight = [10, 10, 10, 10, 11];
  const wide = [1, 10, 100, 1000, 10000];
  const widerThanWide = [1, 100, 10000, 1000000, 100000000];

  for (const builderPair of [
    [tight, wide],
    [wide, widerThanWide],
  ] as const) {
    const [a, b] = builderPair;
    const ra = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', a), {
      generatedAt: GEN,
    });
    const rb = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', b), {
      generatedAt: GEN,
    });
    const r3a = buildSourceRowTokenLehmer3Mean(mkSeries('s', a), {
      generatedAt: GEN,
    });
    const r3b = buildSourceRowTokenLehmer3Mean(mkSeries('s', b), {
      generatedAt: GEN,
    });
    // wider sample -> larger HM gap below AM AND larger L_3 gap above AM
    assert.ok(
      ra.sources[0]!.negOneAmGap < rb.sources[0]!.negOneAmGap,
      'negOneAmGap should grow with multiplicative spread',
    );
    assert.ok(
      r3a.sources[0]!.l3AmGap < r3b.sources[0]!.l3AmGap,
      'l3AmGap should grow with multiplicative spread',
    );
  }
});

test('lehmer-neg-1-mean refinement: scale-equivariance across 50 randomized scales', () => {
  const rand = rng(0xc0ffee01);
  const xs = [3, 5, 8, 13, 21, 34, 55, 89];
  const r1 = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  for (let trial = 0; trial < 50; trial += 1) {
    const c = 0.01 + rand() * 100;
    const scaled = xs.map((x) => x * c);
    const r2 = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', scaled), {
      generatedAt: GEN,
    });
    const expected = r1.sources[0]!.lehmerNegOneMean * c;
    const got = r2.sources[0]!.lehmerNegOneMean;
    const rel = Math.abs(got - expected) / expected;
    assert.ok(rel < 1e-9, `scale c=${c}: rel-err ${rel}`);
  }
});

test('lehmer-neg-1-mean refinement: order-invariance across 50 random permutations', () => {
  const rand = rng(0xdeadbeef);
  const xs = [1, 3, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41];
  const baseline = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
    generatedAt: GEN,
  }).sources[0]!.lehmerNegOneMean;
  for (let trial = 0; trial < 50; trial += 1) {
    const perm = xs.slice();
    for (let i = perm.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [perm[i], perm[j]] = [perm[j]!, perm[i]!];
    }
    const got = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', perm), {
      generatedAt: GEN,
    }).sources[0]!.lehmerNegOneMean;
    assert.ok(Math.abs(got - baseline) < 1e-12);
  }
});

test('lehmer-neg-1-mean refinement: bottleneck-row domination — L_-1 <= 2*min for [min, M, M, ..., M] with M >= 100*min', () => {
  // tight pin: a single small row dominates L_-1 to within
  // a factor 2 of the smallest row when M >= 100*min and
  // n <= 100.
  const rand = rng(0xfeedface);
  for (let trial = 0; trial < 30; trial += 1) {
    const minVal = 1 + rand() * 10;
    const ratio = 100 + rand() * 900;
    const n = 4 + Math.floor(rand() * 20);
    const xs = [minVal];
    for (let i = 0; i < n - 1; i += 1) xs.push(minVal * ratio);
    const r = buildSourceRowTokenLehmerNegOneMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const lneg1 = r.sources[0]!.lehmerNegOneMean;
    assert.ok(
      lneg1 < 2 * minVal,
      `bottleneck domination failed: L_-1=${lneg1}, min=${minVal}, ratio=${ratio}, n=${n}`,
    );
    assert.ok(lneg1 >= minVal - 1e-9);
  }
});

test('lehmer-neg-1-mean refinement: harmonicMean byproduct cross-check vs sibling builder on randomized samples', () => {
  const rand = rng(0x12345678);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 5 + Math.floor(rand() * 20);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + rand() * 1000);
    const queue = mkSeries('s', xs);
    const rNeg1 = buildSourceRowTokenLehmerNegOneMean(queue, {
      generatedAt: GEN,
    });
    const rHm = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN });
    const a = rNeg1.sources[0]!.harmonicMean;
    const b = rHm.sources[0]!.harmonicMean;
    assert.ok(Math.abs(a - b) < 1e-9, `HM mismatch trial ${trial}: ${a} vs ${b}`);
  }
});
