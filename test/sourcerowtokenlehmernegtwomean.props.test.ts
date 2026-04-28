import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmerNegTwoMean } from '../src/sourcerowtokenlehmernegtwomean.js';
import { buildSourceRowTokenLehmerNegOneMean } from '../src/sourcerowtokenlehmernegonemean.js';
import { buildSourceRowTokenHarmonicMean } from '../src/sourcerowtokenharmonicmean.js';
import { buildSourceRowTokenQuadraticMean } from '../src/sourcerowtokenquadraticmean.js';
import { buildSourceRowTokenContraharmonicMean } from '../src/sourcerowtokencontraharmonicmean.js';
import { buildSourceRowTokenLehmer3Mean } from '../src/sourcerowtokenlehmer3mean.js';
import type { QueueLine } from '../src/types.js';

const GEN = '2026-04-28T12:00:00.000Z';

function ql(hour_start: string, source: string, total_tokens: number): QueueLine {
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

// PRNG for reproducible randomized property pins
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

test('lehmer-neg-2-mean property: full integer Lehmer ladder L_-2 <= L_-1 <= HM <= AM <= QM <= CHM <= L_3 (200 trials)', () => {
  const rng = lcg(98765);
  for (let trial = 0; trial < 200; trial++) {
    const n = 4 + Math.floor(rng() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(1 + rng() * 100000);
    }
    const queue = mkSeries('s', xs);

    const l2 = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN }).sources[0]!;
    const l1 = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN }).sources[0]!;
    const hm = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN }).sources[0]!;
    const qm = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN }).sources[0]!;
    const chm = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN }).sources[0]!;
    const l3 = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN }).sources[0]!;

    const vL2 = l2.lehmerNegTwoMean;
    const vL1 = l1.lehmerNegOneMean;
    const vHM = hm.harmonicMean;
    const vAM = l2.mean;
    const vQM = qm.quadraticMean;
    const vCHM = chm.contraharmonicMean;
    const vL3 = l3.lehmer3Mean;

    const tol = 1e-6 * Math.max(1, vL3);
    assert.ok(vL2 <= vL1 + tol, `L_-2 <= L_-1 trial ${trial}: ${vL2} > ${vL1}`);
    assert.ok(vL1 <= vHM + tol, `L_-1 <= HM trial ${trial}`);
    assert.ok(vHM <= vAM + tol, `HM <= AM trial ${trial}`);
    assert.ok(vAM <= vQM + tol, `AM <= QM trial ${trial}`);
    assert.ok(vQM <= vCHM + tol, `QM <= CHM trial ${trial}`);
    assert.ok(vCHM <= vL3 + tol, `CHM <= L_3 trial ${trial}`);
  }
});

test('lehmer-neg-2-mean property: log-space midpoint sanity — L_-2 lies in [min, L_-1]', () => {
  const rng = lcg(31415);
  for (let trial = 0; trial < 100; trial++) {
    const n = 3 + Math.floor(rng() * 20);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(0.001 + rng() * 1e6); // wide dynamic range
    }
    const r = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    const minX = Math.min(...xs);
    const tol = 1e-9 * Math.max(1, s.lehmerNegOneMean);
    assert.ok(s.lehmerNegTwoMean >= minX - tol);
    assert.ok(s.lehmerNegTwoMean <= s.lehmerNegOneMean + tol);
  }
});

test('lehmer-neg-2-mean property: scale-equivariance over random scales', () => {
  const rng = lcg(271828);
  for (let trial = 0; trial < 50; trial++) {
    const n = 5 + Math.floor(rng() * 10);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push(1 + rng() * 1000);
    const c = 0.01 + rng() * 100;

    const a = buildSourceRowTokenLehmerNegTwoMean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmerNegTwoMean;
    const b = buildSourceRowTokenLehmerNegTwoMean(
      mkSeries('s', xs.map((x) => c * x)),
      { generatedAt: GEN },
    ).sources[0]!.lehmerNegTwoMean;

    const expected = c * a;
    const tol = 1e-9 * Math.max(1, expected);
    assert.ok(Math.abs(b - expected) < tol);
  }
});

test('lehmer-neg-2-mean property: equality on constant series (any n, any c)', () => {
  const rng = lcg(11235);
  for (let trial = 0; trial < 30; trial++) {
    const n = 1 + Math.floor(rng() * 30);
    const c = 0.001 + rng() * 1e5;
    const r = buildSourceRowTokenLehmerNegTwoMean(
      mkSeries('s', new Array(n).fill(c)),
      { generatedAt: GEN },
    ).sources[0]!;
    const tol = 1e-9 * c;
    assert.ok(Math.abs(r.lehmerNegTwoMean - c) < tol);
    assert.ok(Math.abs(r.lehmerNegOneMean - c) < tol);
    assert.ok(Math.abs(r.harmonicMean - c) < tol);
    assert.ok(Math.abs(r.mean - c) < tol);
    assert.ok(Math.abs(r.negTwoNegOneGap) < tol);
    assert.ok(Math.abs(r.negTwoHmGap) < tol);
    assert.ok(Math.abs(r.negTwoAmGap) < tol);
  }
});

test('lehmer-neg-2-mean property: L_-1 cross-validation against v0.6.190 builder (50 trials)', () => {
  const rng = lcg(54321);
  for (let trial = 0; trial < 50; trial++) {
    const n = 3 + Math.floor(rng() * 15);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push(1 + rng() * 5000);
    const queue = mkSeries('s', xs);
    const a = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN })
      .sources[0]!.lehmerNegOneMean;
    const b = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN })
      .sources[0]!.lehmerNegOneMean;
    const tol = 1e-9 * Math.max(1, b);
    assert.ok(Math.abs(a - b) < tol);
  }
});

test('lehmer-neg-2-mean property: HM cross-validation against harmonic-mean builder (30 trials)', () => {
  const rng = lcg(192837);
  for (let trial = 0; trial < 30; trial++) {
    const n = 3 + Math.floor(rng() * 10);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push(1 + rng() * 1000);
    const queue = mkSeries('s', xs);
    const a = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN })
      .sources[0]!.harmonicMean;
    const b = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN })
      .sources[0]!.harmonicMean;
    const tol = 1e-9 * Math.max(1, b);
    assert.ok(Math.abs(a - b) < tol);
  }
});

test('lehmer-neg-2-mean property: gap monotonicity — negTwoHmGap >= negOneHmGap (deeper-power gaps grow)', () => {
  const rng = lcg(99999);
  for (let trial = 0; trial < 50; trial++) {
    const n = 4 + Math.floor(rng() * 12);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push(1 + rng() * 10000);
    const queue = mkSeries('s', xs);
    const l2row = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN })
      .sources[0]!;
    const l1row = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN })
      .sources[0]!;
    // negTwoHmGap = HM - L_-2; negOneHmGap = HM - L_-1; since L_-2 <= L_-1, gap_-2 >= gap_-1
    const tol = 1e-9 * Math.max(1, l1row.harmonicMean);
    assert.ok(l2row.negTwoHmGap + tol >= l1row.negOneHmGap);
  }
});
