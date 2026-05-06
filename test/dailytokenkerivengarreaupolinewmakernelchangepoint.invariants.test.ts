/**
 * axis-230 invariant + property tests:
 * - MAD-standardisation translation invariance: adding a
 *   constant to every observation must not change CP indices,
 *   tMax, or tArea (the MAD pre-step removes the mean shift).
 * - Positive scale invariance: multiplying every observation
 *   by a positive constant must not change CP indices (MAD
 *   scales linearly so z = (x - med)/MAD is unchanged).
 * - delayCool monotonicity: increasing delayCool can only
 *   keep or REDUCE the number of detected CPs.
 * - thrMul monotonicity: increasing thrMul can only keep or
 *   REDUCE the number of detected CPs.
 * - Per-source seed isolation: changing rffSalt changes the
 *   RFF basis (and thus tCurve) for the same source data.
 */
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint } from '../src/dailytokenkerivengarreaupolinewmakernelchangepoint.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

function makeStepQueue(src: string, low: number, high: number, n1 = 30, n2 = 30): QueueLine[] {
  const out: QueueLine[] = [];
  for (let d = 0; d < n1; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, src, low));
  }
  for (let d = 0; d < n2; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + n1 + d)).toISOString().slice(0, 10);
    out.push(ql(`${day}T00:00:00.000Z`, src, high));
  }
  return out;
}

const GEN = '2026-05-06T12:00:00.000Z';
const OPTS = { generatedAt: GEN, thrMul: 0.5 };

test('axis-230 invariant: MAD-standardisation translation invariance (additive shift)', () => {
  const a = makeStepQueue('inv-trans', 1000, 5000);
  const b = makeStepQueue('inv-trans', 1000 + 7777, 5000 + 7777);
  const ra = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(a, OPTS);
  const rb = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(b, OPTS);
  assert.equal(ra.sources.length, 1);
  assert.equal(rb.sources.length, 1);
  const ra0 = ra.sources[0]!;
  const rb0 = rb.sources[0]!;
  assert.deepEqual(ra0.tauStar, rb0.tauStar);
  assert.ok(Math.abs(ra0.tMax - rb0.tMax) < 1e-9);
  assert.ok(Math.abs(ra0.tArea - rb0.tArea) < 1e-9);
});

test('axis-230 invariant: positive-scale invariance', () => {
  const a = makeStepQueue('inv-scale', 1000, 5000);
  const b = makeStepQueue('inv-scale', 3000, 15000); // x3
  const ra = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(a, OPTS);
  const rb = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(b, OPTS);
  assert.deepEqual(ra.sources[0]!.tauStar, rb.sources[0]!.tauStar);
  assert.ok(Math.abs(ra.sources[0]!.tMax - rb.sources[0]!.tMax) < 1e-9);
});

test('axis-230 monotonicity: increasing delayCool never increases CP count', () => {
  const q = makeStepQueue('mono-cool', 1000, 5000, 50, 50);
  const r1 = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, {
    ...OPTS,
    delayCool: 1,
  });
  const r30 = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, {
    ...OPTS,
    delayCool: 30,
  });
  const m1 = r1.sources[0]!.mChangepoints;
  const m30 = r30.sources[0]!.mChangepoints;
  assert.ok(m30 <= m1, `delayCool monotonicity violated: ${m1} -> ${m30}`);
});

test('axis-230 monotonicity: increasing thrMul never increases CP count', () => {
  const q = makeStepQueue('mono-thr', 1000, 5000, 40, 40);
  const rLow = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, {
    ...OPTS,
    thrMul: 0.3,
  });
  const rHi = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, {
    ...OPTS,
    thrMul: 5.0,
  });
  const mLo = rLow.sources[0]!.mChangepoints;
  const mHi = rHi.sources[0]!.mChangepoints;
  assert.ok(mHi <= mLo, `thrMul monotonicity violated: ${mLo} -> ${mHi}`);
});

test('axis-230: changing rffSalt changes the RFF basis (different tCurve)', () => {
  const q = makeStepQueue('seed-iso', 1000, 5000);
  const rA = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, {
    ...OPTS,
    rffSalt: 'salt-A',
  });
  const rB = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, {
    ...OPTS,
    rffSalt: 'salt-B',
  });
  assert.notEqual(rA.sources[0]!.rffSeed, rB.sources[0]!.rffSeed);
  // tMax/tArea/tauStar may differ; at least one of them
  // should differ in finite-D RFF approximation.
  const same =
    rA.sources[0]!.tMax === rB.sources[0]!.tMax &&
    rA.sources[0]!.tArea === rB.sources[0]!.tArea;
  assert.ok(!same, 'RFF basis change must perturb tCurve');
});

test('axis-230: report sigma is non-null whenever any source survives', () => {
  const q = makeStepQueue('sigma-rep', 1000, 5000);
  const r = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(q, OPTS);
  assert.equal(r.sources.length, 1);
  assert.ok(r.sigma !== null);
  assert.ok(r.sigma! > 0);
});
