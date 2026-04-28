import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenLehmerNegThreeMean } from '../src/sourcerowtokenlehmernegthreemean.js';
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

function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

test('lehmer-neg-3-mean property: full integer Lehmer ladder L_-3 <= L_-2 <= L_-1 <= HM <= AM <= QM <= CHM <= L_3 (200 trials)', () => {
  const rng = lcg(13579);
  for (let trial = 0; trial < 200; trial++) {
    const n = 4 + Math.floor(rng() * 30);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(1 + rng() * 100000);
    }
    const queue = mkSeries('s', xs);

    const l3n = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN }).sources[0]!;
    const l2n = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN }).sources[0]!;
    const l1n = buildSourceRowTokenLehmerNegOneMean(queue, { generatedAt: GEN }).sources[0]!;
    const hm = buildSourceRowTokenHarmonicMean(queue, { generatedAt: GEN }).sources[0]!;
    const qm = buildSourceRowTokenQuadraticMean(queue, { generatedAt: GEN }).sources[0]!;
    const chm = buildSourceRowTokenContraharmonicMean(queue, { generatedAt: GEN }).sources[0]!;
    const l3 = buildSourceRowTokenLehmer3Mean(queue, { generatedAt: GEN }).sources[0]!;

    const vL3n = l3n.lehmerNegThreeMean;
    const vL2n = l2n.lehmerNegTwoMean;
    const vL1n = l1n.lehmerNegOneMean;
    const vHM = hm.harmonicMean;
    const vAM = l3n.mean;
    const vQM = qm.quadraticMean;
    const vCHM = chm.contraharmonicMean;
    const vL3 = l3.lehmer3Mean;

    const tol = 1e-6 * Math.max(1, vL3);
    assert.ok(vL3n <= vL2n + tol, `L_-3 <= L_-2 trial ${trial}: ${vL3n} > ${vL2n}`);
    assert.ok(vL2n <= vL1n + tol, `L_-2 <= L_-1 trial ${trial}`);
    assert.ok(vL1n <= vHM + tol, `L_-1 <= HM trial ${trial}`);
    assert.ok(vHM <= vAM + tol, `HM <= AM trial ${trial}`);
    assert.ok(vAM <= vQM + tol, `AM <= QM trial ${trial}`);
    assert.ok(vQM <= vCHM + tol, `QM <= CHM trial ${trial}`);
    assert.ok(vCHM <= vL3 + tol, `CHM <= L_3 trial ${trial}`);
  }
});

test('lehmer-neg-3-mean property: L_-3 lies in [min, L_-2] for wide dynamic range', () => {
  const rng = lcg(24680);
  for (let trial = 0; trial < 100; trial++) {
    const n = 3 + Math.floor(rng() * 20);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      xs.push(0.001 + rng() * 1e6);
    }
    const r = buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', xs), {
      generatedAt: GEN,
    });
    const s = r.sources[0]!;
    const minX = Math.min(...xs);
    const tol = 1e-9 * Math.max(1, s.lehmerNegTwoMean);
    assert.ok(s.lehmerNegThreeMean >= minX - tol);
    assert.ok(s.lehmerNegThreeMean <= s.lehmerNegTwoMean + tol);
  }
});

test('lehmer-neg-3-mean property: scale-equivariance over random scales (50 trials)', () => {
  const rng = lcg(86420);
  for (let trial = 0; trial < 50; trial++) {
    const n = 5 + Math.floor(rng() * 10);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push(1 + rng() * 1000);
    const c = 0.01 + rng() * 100;

    const a = buildSourceRowTokenLehmerNegThreeMean(mkSeries('s', xs), {
      generatedAt: GEN,
    }).sources[0]!.lehmerNegThreeMean;
    const b = buildSourceRowTokenLehmerNegThreeMean(
      mkSeries('s', xs.map((x) => c * x)),
      { generatedAt: GEN },
    ).sources[0]!.lehmerNegThreeMean;

    const expected = c * a;
    const tol = 1e-9 * Math.max(1, expected);
    assert.ok(Math.abs(b - expected) < tol);
  }
});

test('lehmer-neg-3-mean property: equality on constant series (any n, any c)', () => {
  const rng = lcg(11111);
  for (let trial = 0; trial < 30; trial++) {
    const n = 1 + Math.floor(rng() * 30);
    const c = 0.001 + rng() * 1e5;
    const r = buildSourceRowTokenLehmerNegThreeMean(
      mkSeries('s', new Array(n).fill(c)),
      { generatedAt: GEN },
    ).sources[0]!;
    const tol = 1e-9 * c;
    assert.ok(Math.abs(r.lehmerNegThreeMean - c) < tol);
    assert.ok(Math.abs(r.lehmerNegTwoMean - c) < tol);
    assert.ok(Math.abs(r.harmonicMean - c) < tol);
    assert.ok(Math.abs(r.mean - c) < tol);
    assert.ok(Math.abs(r.negThreeNegTwoGap) < tol);
    assert.ok(Math.abs(r.negThreeHmGap) < tol);
    assert.ok(Math.abs(r.negThreeAmGap) < tol);
  }
});

test('lehmer-neg-3-mean property: gap monotonicity — negThreeHmGap >= negTwoHmGap (deeper-power gaps grow)', () => {
  const rng = lcg(77777);
  for (let trial = 0; trial < 50; trial++) {
    const n = 4 + Math.floor(rng() * 12);
    const xs: number[] = [];
    for (let i = 0; i < n; i++) xs.push(1 + rng() * 10000);
    const queue = mkSeries('s', xs);
    const l3row = buildSourceRowTokenLehmerNegThreeMean(queue, { generatedAt: GEN })
      .sources[0]!;
    const l2row = buildSourceRowTokenLehmerNegTwoMean(queue, { generatedAt: GEN })
      .sources[0]!;
    const tol = 1e-9 * Math.max(1, l2row.harmonicMean);
    // negThreeHmGap = HM - L_-3; negTwoHmGap = HM - L_-2; since L_-3 <= L_-2, gap_-3 >= gap_-2
    assert.ok(l3row.negThreeHmGap + tol >= l2row.negTwoHmGap);
  }
});
