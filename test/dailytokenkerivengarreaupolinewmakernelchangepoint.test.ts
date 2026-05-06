import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint,
  newmaRun,
  newmaSteadyStateSd,
  buildRffBasis,
  rffEmbed,
  mulberry32,
  fnv1a32,
  median,
  mad,
  medianPairwiseDistance,
} from '../src/dailytokenkerivengarreaupolinewmakernelchangepoint.js';
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

const GEN = '2026-05-06T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('newma: rejects bad minTenureDays', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { minTenureDays: 20 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { minTenureDays: 21.5 }),
  );
});

test('newma: rejects bad minTokens', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { minTokens: NaN }),
  );
});

test('newma: rejects bad top', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { top: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { top: 1.5 }),
  );
});

test('newma: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], {
      sort: 'nope' as 'tMax',
    }),
  );
});

test('newma: rejects bad lambda1 / lambda2 / ordering', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { lambda1: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { lambda1: 1 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { lambda2: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { lambda2: 1.1 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], {
      lambda1: 0.3,
      lambda2: 0.2,
    }),
  );
});

test('newma: rejects bad D / sigma / thrMul / delayCool / onlyWithCps', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { D: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { D: 4.5 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { sigma: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { sigma: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { thrMul: -0.1 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { delayCool: 0 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { delayCool: 1.5 }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], {
      onlyWithCps: 'yes' as unknown as boolean,
    }),
  );
});

test('newma: rejects bad since/until', () => {
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], { until: 'nope' }),
  );
});

// ---- pure helpers --------------------------------------------------------

test('mulberry32 is deterministic and in [0,1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) {
    const x = a();
    const y = b();
    assert.equal(x, y);
    assert.ok(x >= 0 && x < 1);
  }
});

test('fnv1a32 hashes deterministically', () => {
  assert.equal(fnv1a32('abc'), fnv1a32('abc'));
  assert.notEqual(fnv1a32('abc'), fnv1a32('abd'));
});

test('median / mad compute correctly', () => {
  assert.equal(median([1, 2, 3, 4, 5]), 3);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(mad([1, 1, 1, 1]), 0);
  assert.equal(mad([1, 2, 3, 4, 5]), 1);
});

test('medianPairwiseDistance handles small/edge cases', () => {
  assert.equal(medianPairwiseDistance([]), 0);
  assert.equal(medianPairwiseDistance([5]), 0);
  assert.equal(medianPairwiseDistance([0, 1]), 1);
  assert.equal(medianPairwiseDistance([0, 0, 0]), 0);
});

test('buildRffBasis is deterministic for fixed seed', () => {
  const a = buildRffBasis(8, 1.5, 12345);
  const b = buildRffBasis(8, 1.5, 12345);
  assert.deepEqual(a, b);
  assert.equal(a.D, 8);
  assert.equal(a.omega.length, 8);
  assert.equal(a.bias.length, 8);
});

test('buildRffBasis rejects bad inputs', () => {
  assert.throws(() => buildRffBasis(0, 1, 1));
  assert.throws(() => buildRffBasis(4.5, 1, 1));
  assert.throws(() => buildRffBasis(4, 0, 1));
  assert.throws(() => buildRffBasis(4, -1, 1));
});

test('rffEmbed produces vectors of norm <= 1 + eps (numerically bounded)', () => {
  const basis = buildRffBasis(32, 1.0, 7);
  for (const z of [-3, -1, 0, 1, 5]) {
    const phi = rffEmbed(z, basis);
    assert.equal(phi.length, 32);
    let sq = 0;
    for (const v of phi) sq += v * v;
    // Each Phi_d in [-sqrt(2/D), sqrt(2/D)], so ||Phi||^2 <= 2.
    assert.ok(sq <= 2 + 1e-9);
  }
});

test('newmaSteadyStateSd is non-negative and independent of D in leading order', () => {
  const a = newmaSteadyStateSd(0.05, 0.2, 32);
  const b = newmaSteadyStateSd(0.05, 0.2, 128);
  assert.ok(a >= 0);
  assert.ok(Math.abs(a - b) < 1e-12);
  assert.ok(a > 0);
});

test('newmaSteadyStateSd is symmetric in (lambda1, lambda2) swap', () => {
  const a = newmaSteadyStateSd(0.05, 0.2, 64);
  const b = newmaSteadyStateSd(0.2, 0.05, 64);
  assert.ok(Math.abs(a - b) < 1e-12);
});

// ---- newmaRun input validation -------------------------------------------

test('newmaRun rejects bad shape arguments', () => {
  const baseOpts = {
    lambda1: 0.05,
    lambda2: 0.2,
    D: 8,
    sigma: 1,
    thrMul: 0.7,
    delayCool: 7,
    rffSeed: 1,
  };
  assert.throws(() => newmaRun([], baseOpts));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, lambda1: 0 }));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, lambda2: 1 }));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, lambda1: 0.5, lambda2: 0.4 }));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, D: 0 }));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, sigma: 0 }));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, thrMul: -1 }));
  assert.throws(() => newmaRun([1, 2, 3], { ...baseOpts, delayCool: 0 }));
});

// ---- newmaRun behaviour --------------------------------------------------

test('newmaRun on stationary white noise stays bounded with high thrMul', () => {
  const rng = mulberry32(99);
  const z: number[] = [];
  for (let i = 0; i < 200; i += 1) z.push(rng() * 2 - 1);
  const r = newmaRun(z, {
    lambda1: 0.05,
    lambda2: 0.2,
    D: 64,
    sigma: 0.5,
    thrMul: 8.0,
    delayCool: 7,
    rffSeed: 1,
  });
  assert.equal(r.tCurve.length, 200);
  // With a generous thrMul (8x the closed-form steady-state
  // SD) we expect zero or very few false-alarm detections
  // on bounded iid uniform noise.
  assert.ok(r.tauStar.length <= 2, `unexpected ${r.tauStar.length} CPs on noise`);
  assert.ok(r.tMax >= 0);
  assert.ok(Number.isFinite(r.tArea));
});

test('newmaRun fires after a clear mean shift', () => {
  const z: number[] = [];
  for (let i = 0; i < 80; i += 1) z.push(0.0);
  for (let i = 0; i < 80; i += 1) z.push(5.0);
  const r = newmaRun(z, {
    lambda1: 0.05,
    lambda2: 0.2,
    D: 64,
    sigma: 0.5,
    thrMul: 0.5,
    delayCool: 5,
    rffSeed: 1,
  });
  assert.ok(r.tauStar.length >= 1, 'expected at least one CP after step');
  // The detection should fall AFTER the step (allow some EWMA lag).
  assert.ok(r.tauStar.some((t) => t >= 80 && t < 120), `tauStar=${r.tauStar.join(',')}`);
});

test('newmaRun is deterministic for fixed seed', () => {
  const z = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((v) => v / 4);
  const opts = {
    lambda1: 0.05,
    lambda2: 0.2,
    D: 16,
    sigma: 0.5,
    thrMul: 0.7,
    delayCool: 3,
    rffSeed: 12345,
  };
  const a = newmaRun(z, opts);
  const b = newmaRun(z, opts);
  assert.deepEqual(a, b);
});

test('newmaRun: thrSteady scales linearly with thrMul', () => {
  const z = new Array(50).fill(0).map((_, i) => Math.sin(i / 5));
  const baseOpts = {
    lambda1: 0.05,
    lambda2: 0.2,
    D: 32,
    sigma: 0.5,
    delayCool: 5,
    rffSeed: 7,
  };
  const a = newmaRun(z, { ...baseOpts, thrMul: 1.0 });
  const b = newmaRun(z, { ...baseOpts, thrMul: 2.0 });
  assert.ok(Math.abs(b.thrSteady - 2 * a.thrSteady) < 1e-9);
  // Same tCurve (does not depend on thrMul).
  assert.deepEqual(a.tCurve, b.tCurve);
});

// ---- builder behaviour ---------------------------------------------------

test('newma: empty queue produces empty report', () => {
  const r = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint([], {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.lambda1, 0.05);
  assert.equal(r.lambda2, 0.2);
  assert.equal(r.D, 64);
  assert.equal(r.thrMul, 0.7);
});

test('newma: drops sources below minTenureDays', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(`2026-01-${String(i + 1).padStart(2, '0')}T00:00:00.000Z`, 'short', 1000));
  }
  const r = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('newma: drops zero-variance series', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 25; d += 1) {
    queue.push(
      ql(
        `2026-01-${String(d).padStart(2, '0')}T00:00:00.000Z`,
        'flat',
        1000,
      ),
    );
  }
  const r = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('newma: detects mean shift in synthetic source', () => {
  const queue: QueueLine[] = [];
  // 30 days low + 30 days high.
  for (let d = 0; d < 30; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'shift-src', 1000));
  }
  for (let d = 0; d < 30; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 31 + d)).toISOString().slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 'shift-src', 5000));
  }
  const r = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
    thrMul: 0.5,
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'shift-src');
  assert.equal(row.nTenureDays, 60);
  assert.ok(row.mChangepoints >= 1, `expected >=1 CP, got ${row.mChangepoints}`);
  assert.equal(row.tauStar.length, row.tauStarDays.length);
  assert.equal(row.lambda1, 0.05);
  assert.equal(row.lambda2, 0.2);
  assert.ok(row.thrSteady > 0);
});

test('newma: builder is deterministic across calls', () => {
  const queue: QueueLine[] = [];
  for (let d = 0; d < 30; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 's', 1000 + d * 50));
  }
  for (let d = 0; d < 30; d += 1) {
    const day = new Date(Date.UTC(2026, 0, 31 + d)).toISOString().slice(0, 10);
    queue.push(ql(`${day}T00:00:00.000Z`, 's', 6000));
  }
  const a = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
  });
  const b = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
  });
  assert.deepEqual(a, b);
});

test('newma: top truncation and onlyWithCps work', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 0; d < 30; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 1000));
    }
    for (let d = 0; d < 30; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 31 + d)).toISOString().slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 5000));
    }
  }
  const full = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
    thrMul: 0.5,
  });
  assert.equal(full.sources.length, 3);
  const top1 = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
    top: 1,
    thrMul: 0.5,
  });
  assert.equal(top1.sources.length, 1);
  assert.equal(top1.droppedTopSources, 2);
  const flat = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
    thrMul: 100, // impossibly high — no CPs
  });
  for (const row of flat.sources) assert.equal(row.mChangepoints, 0);
  const filtered = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
    thrMul: 100,
    onlyWithCps: true,
  });
  assert.equal(filtered.sources.length, 0);
});

test('newma: source filter restricts output', () => {
  const queue: QueueLine[] = [];
  for (const src of ['x', 'y']) {
    for (let d = 0; d < 25; d += 1) {
      const day = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10);
      queue.push(ql(`${day}T00:00:00.000Z`, src, 1000 + d * 100));
    }
  }
  const r = buildDailyTokenKerivenGarreauPoliNewmaKernelChangepoint(queue, {
    generatedAt: GEN,
    source: 'x',
  });
  for (const row of r.sources) assert.equal(row.source, 'x');
  assert.ok(r.droppedSourceFilter > 0);
});
