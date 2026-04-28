import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenQuadraticMean } from '../src/sourcerowtokenquadraticmean.js';
import { buildSourceRowTokenHarmonicMean } from '../src/sourcerowtokenharmonicmean.js';
import { buildSourceRowTokenCrestFactor } from '../src/sourcerowtokencrestfactor.js';
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

// deterministic LCG used across all property tests
function makeRng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// ---------- QM-AM sandwich, randomized ----------

test('quadratic-mean refinement: QM >= AM holds across 50 randomized non-negative series', () => {
  const rand = makeRng(424242);
  for (let trial = 0; trial < 50; trial += 1) {
    const n = 3 + Math.floor(rand() * 80);
    const xs = Array.from({ length: n }, () => Math.floor(rand() * 50000));
    const r = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    assert.ok(
      s.quadraticMean >= s.mean - 1e-9,
      `trial ${trial}: QM (${s.quadraticMean}) < AM (${s.mean})`,
    );
    assert.ok(s.qmAmGap >= -1e-9);
  }
});

// ---------- full Pythagorean sandwich randomized ----------

test('quadratic-mean refinement: HM <= GM <= AM <= QM holds across 30 randomized strictly-positive series', () => {
  const rand = makeRng(987654);
  for (let trial = 0; trial < 30; trial += 1) {
    const n = 5 + Math.floor(rand() * 60);
    const xs = Array.from(
      { length: n },
      () => 1 + Math.floor(rand() * 50000),
    );
    const qm = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const hm = buildSourceRowTokenHarmonicMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const q = qm.sources[0]!;
    const h = hm.sources[0]!;
    // means must agree across the two lenses on the same data
    assert.ok(
      Math.abs(q.mean - h.mean) < 1e-6 * Math.max(1, h.mean),
      `trial ${trial}: AM disagrees QM=${q.mean} HM=${h.mean}`,
    );
    // sandwich
    assert.ok(
      h.harmonicMean <= h.geometricMean + 1e-6 * Math.max(1, h.geometricMean),
      `trial ${trial}: HM > GM`,
    );
    assert.ok(
      h.geometricMean <= h.mean + 1e-6 * Math.max(1, h.mean),
      `trial ${trial}: GM > AM`,
    );
    assert.ok(
      q.mean <= q.quadraticMean + 1e-6 * Math.max(1, q.mean),
      `trial ${trial}: AM > QM`,
    );
  }
});

// ---------- scale-equivariance under random positive scales ----------

test('quadratic-mean refinement: scale-equivariance — QM(c*x) = c * QM(x) for 20 random c in [0.001, 1000]', () => {
  const rand = makeRng(111213);
  const xs = [3, 7, 11, 13, 17, 23, 29, 31];
  const base = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
    generatedAt: GEN,
  });
  const baseQm = base.sources[0]!.quadraticMean;
  for (let trial = 0; trial < 20; trial += 1) {
    const c = 0.001 + rand() * 1000;
    const r = buildSourceRowTokenQuadraticMean(
      mkSeries(
        's',
        xs.map((v) => v * c),
      ),
      { generatedAt: GEN },
    );
    const got = r.sources[0]!.quadraticMean;
    assert.ok(
      Math.abs(got - c * baseQm) < 1e-6 * Math.max(1, c * baseQm),
      `trial ${trial}: scale=${c}, expected ${c * baseQm}, got ${got}`,
    );
  }
});

// ---------- cross-check vs source-row-token-crest-factor ----------

test('quadratic-mean refinement: QM matches crest-factor`s rms exactly on the same data', () => {
  // crest-factor exposes its internal rms = sqrt(mean(x^2)), which by
  // definition is identical to our quadratic mean. They should be
  // bit-identical (same data, same arithmetic, same kept rows).
  const rand = makeRng(555666);
  for (let trial = 0; trial < 10; trial += 1) {
    const n = 5 + Math.floor(rand() * 30);
    // strictly positive so crest-factor doesn't drop the source
    const xs = Array.from(
      { length: n },
      () => 1 + Math.floor(rand() * 10000),
    );
    const rows = mkSeries('s', xs);
    const qm = buildSourceRowTokenQuadraticMean(rows, { generatedAt: GEN });
    const cf = buildSourceRowTokenCrestFactor(rows, { generatedAt: GEN });
    assert.ok(qm.sources.length === 1 && cf.sources.length === 1);
    const q = qm.sources[0]!;
    const c = cf.sources[0]!;
    assert.equal(q.rowsKept, c.rowsKept);
    assert.ok(
      Math.abs(q.quadraticMean - c.rms) < 1e-9 * Math.max(1, c.rms),
      `trial ${trial}: QM ${q.quadraticMean} != crest-factor.rms ${c.rms}`,
    );
  }
});

// ---------- monotone-spread invariant (orthogonality pin) ----------

test('quadratic-mean refinement: replacing the smallest row with a larger value cannot decrease QM (monotone in upper tail growth)', () => {
  // Replacing one row with a strictly larger value can only increase
  // sumSq (since v_new^2 > v_old^2 when v_new > v_old >= 0), so QM
  // monotonically does not decrease. Pin the property.
  const rand = makeRng(778899);
  for (let trial = 0; trial < 20; trial += 1) {
    const n = 5 + Math.floor(rand() * 30);
    const xs = Array.from({ length: n }, () => Math.floor(rand() * 1000));
    // pick a random index and bump it up by a random positive amount
    const idx = Math.floor(rand() * n);
    const bump = 1 + Math.floor(rand() * 5000);
    const ys = [...xs];
    ys[idx] = ys[idx]! + bump;
    const r1 = buildSourceRowTokenQuadraticMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const r2 = buildSourceRowTokenQuadraticMean(mkSeries('s', ys), {
      generatedAt: GEN,
    });
    assert.ok(
      r2.sources[0]!.quadraticMean >= r1.sources[0]!.quadraticMean - 1e-9,
      `trial ${trial}: QM decreased after upward replacement`,
    );
  }
});

// ---------- per-source independence ----------

test('quadratic-mean refinement: per-source orthogonality — adding rows to source A does not change QM of source B', () => {
  const rand = makeRng(13579);
  const xsA = Array.from({ length: 20 }, () => 1 + Math.floor(rand() * 1000));
  const xsB = [3, 7, 11, 13];
  const r1 = buildSourceRowTokenQuadraticMean(mkSeries('B', xsB), {
    generatedAt: GEN,
  });
  const combined = [...mkSeries('A', xsA), ...mkSeries('B', xsB)];
  const r2 = buildSourceRowTokenQuadraticMean(combined, { generatedAt: GEN });
  const bSolo = r1.sources[0]!.quadraticMean;
  const bWithA = r2.sources.find((s) => s.source === 'B')!.quadraticMean;
  assert.ok(Math.abs(bSolo - bWithA) < 1e-12);
});

// ---------- cross-source spread analysis on synthetic data ----------

test('quadratic-mean refinement: cross-source spread — heavier upper tail -> larger qmAmGap rank', () => {
  // Construct three sources with identical mean but increasing
  // upper-tail concentration. The qmAmGap should rank in the same
  // direction as the upper-tail concentration.
  // mean=20 in each case
  const flat = Array.from({ length: 20 }, () => 20); // mean=20, gap=0
  const mid = [
    ...Array.from({ length: 19 }, () => 10),
    ...Array.from({ length: 1 }, () => 210),
  ]; // mean=20, has one ~10x outlier
  const heavy = [
    ...Array.from({ length: 19 }, () => 0.01),
    ...Array.from({ length: 1 }, () => 19 * 19.99 + 0.01),
  ]; // mean ~20, has one massive outlier
  const rows = [
    ...mkSeries('flat', flat),
    ...mkSeries('mid', mid),
    ...mkSeries('heavy', heavy),
  ];
  const r = buildSourceRowTokenQuadraticMean(rows, {
    generatedAt: GEN,
    sort: 'gap-desc',
  });
  // heavy > mid > flat by qmAmGap
  assert.equal(r.sources[0]!.source, 'heavy');
  assert.equal(r.sources[1]!.source, 'mid');
  assert.equal(r.sources[2]!.source, 'flat');
  assert.equal(r.sources[2]!.qmAmGap, 0);
  assert.ok(r.sources[1]!.qmAmGap > 0);
  assert.ok(r.sources[0]!.qmAmGap > r.sources[1]!.qmAmGap);
});
