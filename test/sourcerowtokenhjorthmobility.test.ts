import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenHjorthMobility } from '../src/sourcerowtokenhjorthmobility.js';
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

test('hjorth-mobility: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenHjorthMobility([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 16);
  assert.equal(r.sort, 'mobility-asc');
  assert.equal(r.generatedAt, GEN);
});

test('hjorth-mobility: linear ramp -> mobility very small', () => {
  // dv is constant => var(dv) = 0 => mobility = 0
  const v = Array.from({ length: 64 }, (_, i) => i);
  const r = buildSourceRowTokenHjorthMobility(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.mobility < 1e-9, `mobility=${row.mobility} should be ~0`);
});

test('hjorth-mobility: constant series dropped under zero-variance', () => {
  const v = new Array(32).fill(7);
  const r = buildSourceRowTokenHjorthMobility(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('hjorth-mobility: below min-rows dropped', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = buildSourceRowTokenHjorthMobility(series(v), { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedBelowMinRows, 1);
});

test('hjorth-mobility: alternating series has high mobility (>~ sqrt(2))', () => {
  const osc = Array.from({ length: 64 }, (_, i) =>
    i % 2 === 0 ? 0 : 100,
  );
  const r = buildSourceRowTokenHjorthMobility(series(osc), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const m = r.sources[0]!.mobility;
  // For exact alternation with even N, var(dv) ~= 4*var(v), so mobility ~= 2.
  assert.ok(Math.abs(m - 2) < 1e-3, `mobility=${m} should be ~2`);
});

test('hjorth-mobility: oscillating > smooth ramp', () => {
  const linear = Array.from({ length: 64 }, (_, i) => i);
  const osc = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const queue = [
    ...series(linear, 'lin'),
    ...series(osc, 'osc'),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, { generatedAt: GEN });
  const lin = r.sources.find((s) => s.source === 'lin')!;
  const o = r.sources.find((s) => s.source === 'osc')!;
  assert.ok(o.mobility > lin.mobility);
});

test('hjorth-mobility: scale-invariance', () => {
  const v = Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.5) * 10 + 50);
  const v2 = v.map((x) => x * 1000);
  const r1 = buildSourceRowTokenHjorthMobility(series(v, 'a'), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenHjorthMobility(series(v2, 'a'), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.mobility - r2.sources[0]!.mobility) < 1e-9,
  );
});

test('hjorth-mobility: shift-invariance (additive constant)', () => {
  const v = Array.from({ length: 32 }, (_, i) => Math.sin(i * 0.3) + 1);
  const v2 = v.map((x) => x + 1000000);
  const r1 = buildSourceRowTokenHjorthMobility(series(v, 'a'), {
    generatedAt: GEN,
  });
  const r2 = buildSourceRowTokenHjorthMobility(series(v2, 'a'), {
    generatedAt: GEN,
  });
  assert.ok(
    Math.abs(r1.sources[0]!.mobility - r2.sources[0]!.mobility) < 1e-9,
  );
});

test('hjorth-mobility: invalid hour_start dropped', () => {
  const queue = [ql('not-a-date', 's', 5), ...series([1, 2, 3, 4], 's')];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('hjorth-mobility: non-finite tokens dropped', () => {
  const queue = [
    ql('2026-04-25T00:00:00Z', 's', Number.NaN),
    ...series([1, 2, 3, 4], 's'),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedInvalidTokens, 1);
});

test('hjorth-mobility: negative tokens dropped', () => {
  const queue = [
    ql('2026-04-25T00:00:00Z', 's', -5),
    ...series([1, 2, 3, 4], 's'),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    minRows: 4,
  });
  assert.equal(r.droppedNegativeTokens, 1);
});

test('hjorth-mobility: source filter drops non-matching rows', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a'),
    ...series([10, 20, 30, 40, 50, 60, 70, 80], 'b'),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    minRows: 4,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 8);
});

test('hjorth-mobility: since/until window applied', () => {
  const v = Array.from({ length: 64 }, (_, i) => i);
  const q = series(v);
  const r = buildSourceRowTokenHjorthMobility(q, {
    generatedAt: GEN,
    since: '2026-04-25T00:30:00Z',
    until: '2026-04-25T00:45:00Z',
    minRows: 4,
  });
  assert.equal(r.totalRowsKept, 15);
  assert.equal(r.windowStart, '2026-04-25T00:30:00Z');
  assert.equal(r.windowEnd, '2026-04-25T00:45:00Z');
});

test('hjorth-mobility: invalid since rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenHjorthMobility([], {
      generatedAt: GEN,
      since: 'bogus',
    }),
  );
});

test('hjorth-mobility: invalid until rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenHjorthMobility([], {
      generatedAt: GEN,
      until: 'bogus',
    }),
  );
});

test('hjorth-mobility: minRows < 4 rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenHjorthMobility([], { generatedAt: GEN, minRows: 3 }),
  );
});

test('hjorth-mobility: non-integer minRows rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenHjorthMobility([], { generatedAt: GEN, minRows: 16.5 }),
  );
});

test('hjorth-mobility: top<1 rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenHjorthMobility([], { generatedAt: GEN, top: 0 }),
  );
});

test('hjorth-mobility: invalid sort rejected', () => {
  assert.throws(() =>
    buildSourceRowTokenHjorthMobility([], {
      generatedAt: GEN,
      sort: 'wat' as 'mobility-asc',
    }),
  );
});

test('hjorth-mobility: top cap surfaces droppedBelowTopCap', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8], 'a'),
    ...series([10, 30, 5, 90, 5, 70, 5, 50], 'b'),
    ...series([2, 1, 4, 3, 6, 5, 8, 7], 'c'),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    minRows: 4,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('hjorth-mobility: sort=mobility-desc puts most-jittery first', () => {
  const queue = [
    ...series(
      Array.from({ length: 32 }, (_, i) => i),
      'smooth',
    ),
    ...series(
      Array.from({ length: 32 }, (_, i) => (i % 2 === 0 ? 0 : 100)),
      'jitter',
    ),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    sort: 'mobility-desc',
  });
  assert.equal(r.sources[0]!.source, 'jitter');
  assert.equal(r.sources[1]!.source, 'smooth');
});

test('hjorth-mobility: sort=source asc lex order', () => {
  const queue = [
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 'b'),
    ...series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], 'a'),
  ];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'b'],
  );
});

test('hjorth-mobility: sort=rows desc by rowsKept', () => {
  const big = Array.from({ length: 24 }, (_, i) => i + 1);
  const small = Array.from({ length: 16 }, (_, i) => i + 1);
  const queue = [...series(big, 'big'), ...series(small, 'small')];
  const r = buildSourceRowTokenHjorthMobility(queue, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'big');
});

test('hjorth-mobility: white-noise-like series mobility ~ sqrt(2)', () => {
  // Use a deterministic LCG so the test is reproducible.
  let s = 12345;
  function rnd() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  }
  const v = Array.from({ length: 4096 }, () => rnd());
  const r = buildSourceRowTokenHjorthMobility(series(v), { generatedAt: GEN });
  const m = r.sources[0]!.mobility;
  // For uncorrelated samples, var(dv) ~= 2*var(v), so mobility ~= sqrt(2).
  assert.ok(
    Math.abs(m - Math.SQRT2) < 0.05,
    `mobility=${m} should be ~sqrt(2)=${Math.SQRT2}`,
  );
});

test('hjorth-mobility: JSON-shape round-trip preserves all fields', () => {
  const v = Array.from({ length: 32 }, (_, i) => i + (i % 3));
  const r = buildSourceRowTokenHjorthMobility(series(v), { generatedAt: GEN });
  const round = JSON.parse(JSON.stringify(r));
  assert.equal(round.generatedAt, r.generatedAt);
  assert.equal(round.sort, r.sort);
  assert.equal(round.minRows, r.minRows);
  assert.equal(round.sources.length, r.sources.length);
  assert.equal(round.sources[0].mobility, r.sources[0]!.mobility);
  assert.equal(round.sources[0].varV, r.sources[0]!.varV);
  assert.equal(round.sources[0].varDv, r.sources[0]!.varDv);
});

test('hjorth-mobility: shuffle inflates mobility vs. ordered', () => {
  // Smooth ramp = low mobility; same multiset shuffled = high mobility.
  const v = Array.from({ length: 64 }, (_, i) => i);
  const shuffled = [...v];
  // Deterministic shuffle.
  let s = 7;
  for (let i = shuffled.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    const j = s % (i + 1);
    const tmp = shuffled[i]!;
    shuffled[i] = shuffled[j]!;
    shuffled[j] = tmp;
  }
  const queue = [...series(v, 'sorted'), ...series(shuffled, 'shuf')];
  const r = buildSourceRowTokenHjorthMobility(queue, { generatedAt: GEN });
  const sorted = r.sources.find((x) => x.source === 'sorted')!;
  const shuf = r.sources.find((x) => x.source === 'shuf')!;
  assert.ok(
    shuf.mobility > sorted.mobility * 5,
    `shuf=${shuf.mobility} should be much greater than sorted=${sorted.mobility}`,
  );
});

test('hjorth-mobility: var(v) preserved across shuffle (sanity)', () => {
  const v = Array.from({ length: 64 }, (_, i) => i);
  const shuffled = [...v].reverse();
  const queue = [...series(v, 'a'), ...series(shuffled, 'b')];
  const r = buildSourceRowTokenHjorthMobility(queue, { generatedAt: GEN });
  const a = r.sources.find((x) => x.source === 'a')!;
  const b = r.sources.find((x) => x.source === 'b')!;
  assert.ok(Math.abs(a.varV - b.varV) < 1e-9);
});

test('hjorth-mobility: detrend defaults to false; report flag round-trips', () => {
  const v = Array.from({ length: 32 }, (_, i) => i + (i % 3));
  const r1 = buildSourceRowTokenHjorthMobility(series(v), { generatedAt: GEN });
  const r2 = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(r1.detrend, false);
  assert.equal(r2.detrend, true);
});

test('hjorth-mobility: detrend strips a perfect linear ramp -> drops zero-variance', () => {
  // Pure linear v[i] = i. Detrend residuals are exactly zero -> var(v)=0.
  const v = Array.from({ length: 32 }, (_, i) => i);
  const r = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
    detrend: true,
  });
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedZeroVariance, 1);
});

test('hjorth-mobility: detrend recovers white-noise asymptote on noise+drift', () => {
  // v[i] = i + e[i] with deterministic-LCG noise. No-detrend mobility -> 0
  // because the trend variance dominates var(v); detrended mobility ~ sqrt(2).
  let s = 99;
  function rnd() {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff - 0.5;
  }
  const N = 2048;
  const e = Array.from({ length: N }, () => rnd());
  const v = e.map((ei, i) => i + ei);

  const noDetrend = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
  });
  const detr = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
    detrend: true,
  });
  const mNo = noDetrend.sources[0]!.mobility;
  const mDe = detr.sources[0]!.mobility;
  // No-detrend: dominated by quadratic trend variance -> mobility small.
  assert.ok(mNo < 0.05, `no-detrend mobility=${mNo} should be near 0`);
  // Detrended: white-noise asymptote ~ sqrt(2).
  assert.ok(
    Math.abs(mDe - Math.SQRT2) < 0.1,
    `detrended mobility=${mDe} should be ~sqrt(2)`,
  );
});

test('hjorth-mobility: detrend preserves mobility on already-zero-trend series', () => {
  // Symmetric oscillation around zero has no linear trend; detrend should
  // give essentially the same answer as no-detrend.
  const v = Array.from({ length: 64 }, (_, i) =>
    Math.sin(i * 0.4) * 100,
  );
  const noDe = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
  });
  const de = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
    detrend: true,
  });
  assert.ok(
    Math.abs(noDe.sources[0]!.mobility - de.sources[0]!.mobility) < 1e-2,
  );
});

test('hjorth-mobility: detrend on alternating-only series unchanged', () => {
  // Alternation 0/100 has zero linear trend; detrend should not change mobility.
  const v = Array.from({ length: 64 }, (_, i) => (i % 2 === 0 ? 0 : 100));
  const noDe = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
  });
  const de = buildSourceRowTokenHjorthMobility(series(v), {
    generatedAt: GEN,
    detrend: true,
  });
  assert.ok(
    Math.abs(noDe.sources[0]!.mobility - de.sources[0]!.mobility) < 1e-2,
  );
});
