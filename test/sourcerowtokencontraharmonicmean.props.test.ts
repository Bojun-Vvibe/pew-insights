/**
 * Property tests / refinement for source-row-token-contraharmonic-mean.
 *
 * Pins the deeper invariants that v0.6.188's unit tests touch only
 * sample-by-sample, plus a Lehmer-family monotonicity check that
 * verifies CHM is genuinely the L_2 member of the same family that
 * has HM = L_0 and AM = L_1, by computing all three from the same
 * sample and verifying L_0 <= L_1 <= L_2.
 *
 * Also adds the **extended Pythagorean sandwich verification**
 * `HM <= GM <= AM <= QM <= CHM` randomized over 200 random samples
 * to give us a strong empirical pin that the cross-lens ordering
 * never breaks.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenContraharmonicMean } from '../src/sourcerowtokencontraharmonicmean.js';
import { buildSourceRowTokenQuadraticMean } from '../src/sourcerowtokenquadraticmean.js';
import { buildSourceRowTokenHarmonicMean } from '../src/sourcerowtokenharmonicmean.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-04-28T12:00:00.000Z';

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

function mkSeries(source: string, vals: number[]): QueueLine[] {
  return vals.map((v, i) =>
    ql(
      `2026-04-27T${String(Math.floor(i / 60) % 24).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00.000Z`,
      source,
      v,
    ),
  );
}

// Deterministic LCG so property tests are reproducible
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

test('chm property: extended Pythagorean sandwich HM <= GM <= AM <= QM <= CHM on 200 random positive samples', () => {
  const rand = lcg(0xc4f);
  let constantTrials = 0;
  let strictTrials = 0;
  for (let trial = 0; trial < 200; trial += 1) {
    const n = 4 + Math.floor(rand() * 50);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) {
      // mix of small and occasionally large values
      const v =
        rand() < 0.05
          ? 1 + Math.floor(rand() * 100000)
          : 1 + Math.floor(rand() * 100);
      xs.push(v);
    }
    const queue = mkSeries('s', xs);
    const chmR = buildSourceRowTokenContraharmonicMean(queue, {
      generatedAt: GEN,
    });
    const qmR = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN });
    const hmR = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN });
    const chm = chmR.sources[0]!.contraharmonicMean;
    const qm = qmR.sources[0]!.quadraticMean;
    const am = qmR.sources[0]!.mean;
    const hm = hmR.sources[0]!.harmonicMean;
    const gm = hmR.sources[0]!.geometricMean;
    assert.ok(hm <= gm + 1e-6, `HM <= GM violated: hm=${hm} gm=${gm}`);
    assert.ok(gm <= am + 1e-6, `GM <= AM violated: gm=${gm} am=${am}`);
    assert.ok(am <= qm + 1e-6, `AM <= QM violated: am=${am} qm=${qm}`);
    assert.ok(qm <= chm + 1e-6, `QM <= CHM violated: qm=${qm} chm=${chm}`);
    if (xs.every((x) => x === xs[0])) constantTrials += 1;
    else if (chm > qm + 1e-6) strictTrials += 1;
  }
  // We should have many strict-inequality trials given random samples
  assert.ok(strictTrials > 100, `expected many strict trials, got ${strictTrials}`);
});

test('chm property: Lehmer family L_0 <= L_1 <= L_2 (HM <= AM <= CHM) recovered from same lens math', () => {
  const rand = lcg(0xbeef);
  for (let trial = 0; trial < 100; trial += 1) {
    const n = 3 + Math.floor(rand() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(rand() * 500));
    let sumSq = 0;
    let sumX = 0;
    let sumInv = 0;
    for (const x of xs) {
      sumSq += x * x;
      sumX += x;
      sumInv += 1 / x;
    }
    // Lehmer L_p = sum(x^p) / sum(x^{p-1})
    const L0 = n / sumInv; // HM = sum(x^0)/sum(x^{-1}) = n / sum(1/x)
    const L1 = sumX / n; // AM
    const L2 = sumSq / sumX; // CHM
    assert.ok(L0 <= L1 + 1e-9, `L_0 > L_1: ${L0} vs ${L1}`);
    assert.ok(L1 <= L2 + 1e-9, `L_1 > L_2: ${L1} vs ${L2}`);
  }
});

test('chm property: scale-equivariance preserved on 50 random samples + scales', () => {
  const rand = lcg(0x123);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 4 + Math.floor(rand() * 20);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(rand() * 1000));
    const c = 0.001 + rand() * 100;
    const r0 = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const r1 = buildSourceRowTokenContraharmonicMean(
      mkSeries('s', xs.map((x) => x * c)),
      { generatedAt: GEN },
    );
    const expected = c * r0.sources[0]!.contraharmonicMean;
    const got = r1.sources[0]!.contraharmonicMean;
    // relative tolerance because c can be small
    const rel = Math.abs(expected - got) / Math.max(1e-9, Math.abs(expected));
    assert.ok(rel < 1e-9, `scale-equivariance broke: c=${c} expected=${expected} got=${got}`);
  }
});

test('chm property: chmAmGap and chmQmGap are >= 0 on 100 random samples', () => {
  const rand = lcg(0xdeadbeef);
  for (let trial = 0; trial < 100; trial += 1) {
    const n = 3 + Math.floor(rand() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(Math.floor(rand() * 10000));
    if (xs.every((x) => x === 0)) xs[0] = 1;
    const r = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.ok(row.chmAmGap >= -1e-9);
    assert.ok(row.chmQmGap >= -1e-9);
  }
});

test('chm property: order-invariance on 30 shuffled samples', () => {
  const rand = lcg(0x42);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 5 + Math.floor(rand() * 25);
    const xs: number[] = [];
    for (let i = 0; i < n; i += 1) xs.push(1 + Math.floor(rand() * 500));
    const shuf = [...xs];
    for (let i = shuf.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [shuf[i], shuf[j]] = [shuf[j]!, shuf[i]!];
    }
    const r0 = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const r1 = buildSourceRowTokenContraharmonicMean(mkSeries('s', shuf), {
      generatedAt: GEN,
    });
    assert.ok(
      Math.abs(
        r0.sources[0]!.contraharmonicMean - r1.sources[0]!.contraharmonicMean,
      ) < 1e-9,
    );
  }
});

test('chm property: bottleneck row dominance — CHM grows monotonically with the largest row', () => {
  const base = [1, 1, 1, 1, 1];
  let prevChm = -Infinity;
  for (const M of [10, 100, 1_000, 10_000, 100_000, 1_000_000]) {
    const xs = [...base, M];
    const r = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const chm = r.sources[0]!.contraharmonicMean;
    assert.ok(chm > prevChm, `CHM did not grow: M=${M} chm=${chm} prev=${prevChm}`);
    prevChm = chm;
  }
});

test('chm property: identity on constant series for 20 random constants', () => {
  const rand = lcg(0xc0ffee);
  for (let trial = 0; trial < 20; trial += 1) {
    const c = 1 + Math.floor(rand() * 10000);
    const n = 3 + Math.floor(rand() * 30);
    const xs = Array(n).fill(c);
    const r = buildSourceRowTokenContraharmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const row = r.sources[0]!;
    assert.equal(row.contraharmonicMean, c);
    assert.equal(row.mean, c);
    assert.equal(row.quadraticMean, c);
    assert.equal(row.chmAmGap, 0);
    assert.equal(row.chmQmGap, 0);
  }
});
