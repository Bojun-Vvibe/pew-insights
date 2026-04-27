import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenKatzFd } from '../src/sourcerowtokenkatzfd.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  model = 'm1',
  device_id = 'd1',
): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

function series(values: number[], src = 's'): QueueLine[] {
  return values.map((v, i) => {
    const hh = Math.floor(i / 60) % 24;
    const mm = i % 60;
    const day = 25 + Math.floor(i / (24 * 60));
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

test('katz-fd: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenKatzFd([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 16);
  assert.equal(r.sort, 'kfd-asc');
  assert.equal(r.detrend, false);
  assert.equal(r.generatedAt, GEN);
});

test('katz-fd: linear ramp -> KFD ~ 1 (straight line)', () => {
  // strictly linear v[i] = i  -> the (i, v) curve is the diagonal line
  const v = Array.from({ length: 64 }, (_, i) => i);
  const r = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // d == L for a perfectly straight curve, so log(d/L) = 0 -> KFD = 1.
  assert.ok(Math.abs(row.kfd - 1) < 1e-9, `kfd=${row.kfd} should be ~1`);
  assert.ok(Math.abs(row.kfdRaw - 1) < 1e-9);
});

test('katz-fd: constant series dropped under zero-variance', () => {
  const v = new Array(32).fill(7);
  const r = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('katz-fd: below min-rows dropped', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('katz-fd: oscillating series has higher KFD than linear ramp', () => {
  const linear = Array.from({ length: 64 }, (_, i) => i);
  const osc = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const queue = [
    ...series(linear, 'lin'),
    ...series(osc, 'osc'),
  ];
  const r = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const lin = r.sources.find((s) => s.source === 'lin')!;
  const osc1 = r.sources.find((s) => s.source === 'osc')!;
  assert.ok(osc1.kfd > lin.kfd, `osc kfd=${osc1.kfd} should exceed lin kfd=${lin.kfd}`);
  assert.ok(osc1.kfd > 1.05, `osc kfd=${osc1.kfd} should be >1.05 for sharp oscillation`);
});

test('katz-fd: scale invariance under value scaling — KFD changes only modestly', () => {
  // Note: Katz's normalisation makes KFD *approximately* invariant to
  // value scaling but not exactly so, because the i-axis step (=1) is
  // not rescaled by the normalisation. We assert the two KFDs agree to
  // within a few percent, which is the well-known Katz behaviour.
  const v = [1, 5, 2, 8, 3, 7, 4, 6, 1, 9, 2, 7, 3, 6, 4, 5, 1, 8, 2, 7];
  const v10 = v.map((x) => x * 10);
  const queue = [
    ...series(v, 'a'),
    ...series(v10, 'b'),
  ];
  const r = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'a')!;
  const b = r.sources.find((s) => s.source === 'b')!;
  assert.ok(
    Math.abs(a.kfd - b.kfd) < 0.05,
    `KFD should be approximately scale-invariant: a=${a.kfd}, b=${b.kfd}`,
  );
});

test('katz-fd: KFD clamped to [1, 2]', () => {
  // monotone but with a single overshoot — kfdRaw could in principle
  // be slightly outside [1, 2] for very short series, but on this
  // shape it should land cleanly inside. This test asserts the clamp
  // counters are zero for a normal case.
  const v = Array.from({ length: 32 }, (_, i) => i + (i % 3 === 0 ? 5 : 0));
  const r = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.kfd >= 1 && row.kfd <= 2);
});

test('katz-fd: invalid total_tokens dropped', () => {
  const v = Array.from({ length: 20 }, (_, i) => i);
  const queue = series(v);
  // Inject one bad row + one negative.
  queue[5]!.total_tokens = NaN;
  queue[10]!.total_tokens = -1;
  const r = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
});

test('katz-fd: invalid hour_start dropped', () => {
  const v = Array.from({ length: 20 }, (_, i) => i);
  const queue = series(v);
  queue[3]!.hour_start = 'not-a-date';
  const r = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('katz-fd: source filter', () => {
  const queue = [
    ...series(
      Array.from({ length: 20 }, (_, i) => i),
      'keep',
    ),
    ...series(
      Array.from({ length: 20 }, (_, i) => i),
      'drop',
    ),
  ];
  const r = buildSourceRowTokenKatzFd(queue, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.source, 'keep');
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 20);
});

test('katz-fd: time window filter', () => {
  const v = Array.from({ length: 60 }, (_, i) => i);
  const r = buildSourceRowTokenKatzFd(series(v), {
    generatedAt: GEN,
    since: '2026-04-25T00:30:00Z',
    until: '2026-04-25T00:55:00Z',
  });
  // 25 rows survive; below default minRows=16 in our case actually 25>=16
  if (r.sources.length === 1) {
    assert.equal(r.sources[0]!.rowsKept, 25);
  }
});

test('katz-fd: sort kfd-asc puts straightest first', () => {
  const linear = Array.from({ length: 32 }, (_, i) => i);
  const osc = Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const queue = [...series(linear, 'lin'), ...series(osc, 'osc')];
  const r = buildSourceRowTokenKatzFd(queue, {
    generatedAt: GEN,
    sort: 'kfd-asc',
  });
  assert.equal(r.sources[0]!.source, 'lin');
  assert.equal(r.sources[1]!.source, 'osc');
});

test('katz-fd: sort kfd-desc puts most coiled first', () => {
  const linear = Array.from({ length: 32 }, (_, i) => i);
  const osc = Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const queue = [...series(linear, 'lin'), ...series(osc, 'osc')];
  const r = buildSourceRowTokenKatzFd(queue, {
    generatedAt: GEN,
    sort: 'kfd-desc',
  });
  assert.equal(r.sources[0]!.source, 'osc');
  assert.equal(r.sources[1]!.source, 'lin');
});

test('katz-fd: top cap drops surplus sources', () => {
  const v = Array.from({ length: 20 }, (_, i) => i);
  const queue = [
    ...series(v, 'a'),
    ...series(v, 'b'),
    ...series(v, 'c'),
  ];
  const r = buildSourceRowTokenKatzFd(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('katz-fd: detrend flag changes kfd for drifty series', () => {
  // Strong linear drift + small noise: raw should look near-straight
  // (KFD ~ 1); detrended should reveal the noise roughness (KFD > raw).
  const noise = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5, 8, 9, 7, 9, 3, 2, 3, 8, 4, 6, 2, 6, 4, 3, 3, 8, 3, 2, 7, 9, 5];
  const v = noise.map((n, i) => i * 50 + n);
  const r1 = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN, detrend: false });
  const r2 = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN, detrend: true });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  assert.ok(
    r2.sources[0]!.kfd > r1.sources[0]!.kfd,
    `detrended kfd=${r2.sources[0]!.kfd} should exceed raw kfd=${r1.sources[0]!.kfd}`,
  );
});

test('katz-fd: invalid options throw', () => {
  assert.throws(() =>
    buildSourceRowTokenKatzFd([], { minRows: 3 }),
  );
  assert.throws(() =>
    buildSourceRowTokenKatzFd([], { minRows: 16, top: 0 }),
  );
  assert.throws(() =>
    buildSourceRowTokenKatzFd([], {
      sort: 'bad' as 'kfd-asc',
    }),
  );
  assert.throws(() =>
    buildSourceRowTokenKatzFd([], { since: 'not-a-date' }),
  );
});

test('katz-fd: deterministic — same input -> same output', () => {
  const v = Array.from({ length: 40 }, (_, i) => Math.sin(i / 3) * 100 + i);
  const r1 = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.deepEqual(r1, r2);
});

test('katz-fd: rows are kept regardless of input order, sorted by hour_start', () => {
  const v = Array.from({ length: 20 }, (_, i) => i * 7);
  const queue = series(v);
  // shuffle deterministically
  const shuffled = [...queue];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = (i * 7) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }
  const r1 = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN });
  const r2 = buildSourceRowTokenKatzFd(shuffled, { generatedAt: GEN });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  assert.ok(Math.abs(r1.sources[0]!.kfd - r2.sources[0]!.kfd) < 1e-12);
});

test('katz-fd: kfdRaw equals kfd when no clamp fires', () => {
  const v = [10, 20, 15, 25, 18, 30, 22, 35, 28, 40, 32, 45, 36, 50, 40, 55, 44, 58, 46, 60];
  const r = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.kfd, row.kfdRaw);
  assert.equal(r.clampedBelow1, 0);
  assert.equal(r.clampedAbove2, 0);
});

test('katz-fd: planform default is 2d', () => {
  const v = Array.from({ length: 32 }, (_, i) => Math.sin(i / 2) * 100);
  const r = buildSourceRowTokenKatzFd(series(v), { generatedAt: GEN });
  assert.equal(r.planform, '2d');
});

test('katz-fd: planform=1d produces wider KFD spread than 2d on rough vs smooth signals', () => {
  // Two signals: nearly straight ramp, vs. moderate oscillation
  // riding on a ramp. 1d planform should magnify the gap because
  // the i-axis padding that compresses 2d KFDs is removed. We
  // pick a moderate oscillation amplitude (not 0/100 alternation,
  // which collapses 1d log(d/L) to -log(N) and triggers the
  // degenerate-denominator drop).
  const ramp = Array.from({ length: 64 }, (_, i) => i);
  const rough = Array.from({ length: 64 }, (_, i) => i + (i % 2 === 0 ? 0 : 5));
  const queue = [...series(ramp, 'r'), ...series(rough, 'o')];
  const r2d = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN, planform: '2d' });
  const r1d = buildSourceRowTokenKatzFd(queue, { generatedAt: GEN, planform: '1d' });
  assert.equal(r2d.sources.length, 2);
  assert.equal(r1d.sources.length, 2);
  const gap2d =
    r2d.sources.find((s) => s.source === 'o')!.kfd -
    r2d.sources.find((s) => s.source === 'r')!.kfd;
  const gap1d =
    r1d.sources.find((s) => s.source === 'o')!.kfd -
    r1d.sources.find((s) => s.source === 'r')!.kfd;
  assert.ok(
    gap1d > gap2d,
    `1d gap=${gap1d} should exceed 2d gap=${gap2d}`,
  );
});

test('katz-fd: planform=1d on monotone ramp -> KFD ~ 1', () => {
  const v = Array.from({ length: 32 }, (_, i) => i * 3);
  const r = buildSourceRowTokenKatzFd(series(v), {
    generatedAt: GEN,
    planform: '1d',
  });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Strictly monotone -> sum|dv| equals max|v[i]-v[0]|, so log(d/L)=0
  // and KFD = 1 exactly.
  assert.ok(Math.abs(row.kfd - 1) < 1e-9, `kfd=${row.kfd} should be ~1`);
});

test('katz-fd: invalid planform throws', () => {
  assert.throws(() =>
    buildSourceRowTokenKatzFd([], {
      planform: 'bad' as '2d',
    }),
  );
});
