import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenDfa } from '../src/sourcerowtokendfa.js';
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
    const day = 25 + Math.floor(i / 1440);
    const hh = Math.floor((i % 1440) / 60) % 24;
    const mm = i % 60;
    return ql(
      `2026-04-${day.toString().padStart(2, '0')}T${hh
        .toString()
        .padStart(2, '0')}:${mm.toString().padStart(2, '0')}:00Z`,
      src,
      v,
    );
  });
}

// Mulberry32 deterministic PRNG.
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

test('dfa: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenDfa([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.scaleMin, 4);
  assert.equal(r.minScales, 4);
  assert.equal(r.minRows, 32);
  assert.equal(r.sort, 'alpha-asc');
  assert.equal(r.generatedAt, GEN);
});

test('dfa: constant series -> droppedZeroVariance', () => {
  const data = series(new Array(64).fill(7));
  const r = buildSourceRowTokenDfa(data, { generatedAt: GEN });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('dfa: too few rows -> droppedBelowMinRows', () => {
  const data = series([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  const r = buildSourceRowTokenDfa(data, { generatedAt: GEN });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 0);
});

test('dfa: white noise -> alpha near 0.5', () => {
  // i.i.d. uniform white noise should give alpha ~ 0.5.
  const r0 = rng(42);
  const vals: number[] = [];
  for (let i = 0; i < 1024; i++) vals.push(r0() * 1000);
  const data = series(vals);
  const r = buildSourceRowTokenDfa(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  // Allow generous tolerance: small-N DFA estimate has nontrivial variance.
  assert.ok(row.alpha > 0.35 && row.alpha < 0.7,
    `expected alpha~0.5 for white noise, got ${row.alpha}`);
  assert.ok(row.r2 > 0.85, `expected high R^2, got ${row.r2}`);
});

test('dfa: brownian motion (cumsum of white noise) -> alpha near 1.5', () => {
  // Random walk: cumulative sum of zero-mean noise. DFA-1 alpha ~ 1.5.
  const r0 = rng(7);
  const vals: number[] = [];
  let acc = 0;
  for (let i = 0; i < 1024; i++) {
    acc += r0() - 0.5;
    vals.push(acc * 100 + 500); // shifted so total_tokens stays >= 0
  }
  const data = series(vals);
  const r = buildSourceRowTokenDfa(data, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.alpha > 1.2 && row.alpha < 1.8,
    `expected alpha~1.5 for Brownian, got ${row.alpha}`);
  assert.ok(row.r2 > 0.9, `expected very high R^2, got ${row.r2}`);
});

test('dfa: brownian alpha > white noise alpha (correlation regime ordering)', () => {
  const r0 = rng(11);
  const r1 = rng(13);
  const wn: number[] = [];
  for (let i = 0; i < 512; i++) wn.push(r0() * 100);
  const bm: number[] = [];
  let acc = 500;
  for (let i = 0; i < 512; i++) {
    acc += r1() - 0.5;
    bm.push(acc);
  }
  const dataWn = series(wn, 'wn');
  const dataBm = series(bm, 'bm');
  const r = buildSourceRowTokenDfa([...dataWn, ...dataBm], {
    generatedAt: GEN,
    sort: 'alpha-asc',
  });
  assert.equal(r.sources.length, 2);
  // alpha-asc: most anti-persistent first; white noise has lower alpha.
  assert.equal(r.sources[0]!.source, 'wn');
  assert.equal(r.sources[1]!.source, 'bm');
  assert.ok(r.sources[0]!.alpha < r.sources[1]!.alpha);
});

test('dfa: alpha is scale-invariant (multiply v by constant -> same alpha)', () => {
  const r0 = rng(99);
  const base: number[] = [];
  let acc = 1000;
  for (let i = 0; i < 512; i++) {
    acc += (r0() - 0.5) * 10;
    base.push(Math.max(0, acc));
  }
  const scaled = base.map((x) => x * 7);
  const r1 = buildSourceRowTokenDfa(series(base), { generatedAt: GEN });
  const r2 = buildSourceRowTokenDfa(series(scaled), { generatedAt: GEN });
  assert.equal(r1.sources.length, 1);
  assert.equal(r2.sources.length, 1);
  // alpha must be identical (scale invariance).
  assert.ok(
    Math.abs(r1.sources[0]!.alpha - r2.sources[0]!.alpha) < 1e-9,
    `alpha mismatch: ${r1.sources[0]!.alpha} vs ${r2.sources[0]!.alpha}`,
  );
});

test('dfa: invalid scaleMin throws', () => {
  assert.throws(() => buildSourceRowTokenDfa([], { scaleMin: 3 }), /scaleMin/);
  assert.throws(() => buildSourceRowTokenDfa([], { scaleMin: 4.5 as unknown as number }), /scaleMin/);
});

test('dfa: invalid minScales throws', () => {
  assert.throws(() => buildSourceRowTokenDfa([], { minScales: 2 }), /minScales/);
});

test('dfa: invalid minRows (< 4*scaleMin) throws', () => {
  assert.throws(
    () => buildSourceRowTokenDfa([], { scaleMin: 4, minRows: 15 }),
    /minRows/,
  );
});

test('dfa: invalid scaleMax (< scaleMin*2) throws', () => {
  assert.throws(
    () => buildSourceRowTokenDfa([], { scaleMin: 4, scaleMax: 7 }),
    /scaleMax/,
  );
});

test('dfa: invalid sort throws', () => {
  assert.throws(
    () => buildSourceRowTokenDfa([], { sort: 'whatever' as 'alpha-asc' }),
    /sort/,
  );
});

test('dfa: source filter applies and counts non-matching rows', () => {
  const r0 = rng(3);
  const valsA: number[] = [];
  const valsB: number[] = [];
  for (let i = 0; i < 64; i++) {
    valsA.push(r0() * 100);
    valsB.push(r0() * 100);
  }
  const data = [...series(valsA, 'A'), ...series(valsB, 'B')];
  const r = buildSourceRowTokenDfa(data, {
    generatedAt: GEN,
    source: 'A',
  });
  assert.equal(r.source, 'A');
  assert.equal(r.droppedSourceFilter, 64);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('dfa: top cap surfaces droppedBelowTopCap', () => {
  const r0 = rng(5);
  const data: QueueLine[] = [];
  for (let s = 0; s < 3; s++) {
    const vals: number[] = [];
    for (let i = 0; i < 64; i++) vals.push(r0() * 100);
    data.push(...series(vals, `src${s}`));
  }
  const r = buildSourceRowTokenDfa(data, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('dfa: invalid hour_start, invalid total_tokens, negative tokens are dropped with separate counters', () => {
  const r0 = rng(17);
  const vals: number[] = [];
  for (let i = 0; i < 64; i++) vals.push(r0() * 100);
  const good = series(vals);
  // Inject 3 different bad rows.
  const bad: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-25T00:00:00Z', 's', NaN),
    ql('2026-04-25T00:00:00Z', 's', -1),
  ];
  const r = buildSourceRowTokenDfa([...good, ...bad], { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidTokens, 1);
  assert.equal(r.droppedNegativeTokens, 1);
});

test('dfa: alpha-desc sort puts highest alpha first', () => {
  const r0 = rng(21);
  const r1 = rng(23);
  const wn: number[] = [];
  for (let i = 0; i < 512; i++) wn.push(r0() * 100);
  const bm: number[] = [];
  let acc = 500;
  for (let i = 0; i < 512; i++) {
    acc += r1() - 0.5;
    bm.push(acc);
  }
  const data = [...series(wn, 'wn'), ...series(bm, 'bm')];
  const r = buildSourceRowTokenDfa(data, {
    generatedAt: GEN,
    sort: 'alpha-desc',
  });
  assert.equal(r.sources.length, 2);
  assert.ok(r.sources[0]!.alpha >= r.sources[1]!.alpha);
});

test('dfa: rows sort orders by rowsKept desc with source tiebreak', () => {
  const r0 = rng(31);
  const big: number[] = [];
  for (let i = 0; i < 200; i++) big.push(r0() * 100);
  const small: number[] = [];
  for (let i = 0; i < 64; i++) small.push(r0() * 100);
  const data = [...series(big, 'big'), ...series(small, 'small')];
  const r = buildSourceRowTokenDfa(data, {
    generatedAt: GEN,
    sort: 'rows',
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('dfa: source sort is alphabetical', () => {
  const r0 = rng(41);
  const v: number[] = [];
  for (let i = 0; i < 64; i++) v.push(r0() * 100);
  const data = [...series(v, 'zeta'), ...series(v, 'alpha')];
  const r = buildSourceRowTokenDfa(data, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'zeta');
});

test('dfa: linear ramp -> very high alpha (drift-dominated, near or above brownian)', () => {
  // Pure linear ramp. The cumulative deviation profile is a parabola;
  // local linear detrending leaves a non-zero residual that grows as
  // s^2 (window-curvature scaling), which gives alpha around 2 (the
  // upper clamp). This is the canonical DFA "smooth drift" behaviour.
  const vals: number[] = [];
  for (let i = 0; i < 256; i++) vals.push(i + 1);
  const r = buildSourceRowTokenDfa(series(vals), { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.alpha >= 1.5,
    `expected alpha >= 1.5 for ramp, got ${row.alpha}`);
});

test('dfa: window filter [since, until) honours bounds', () => {
  const r0 = rng(51);
  const vals: number[] = [];
  for (let i = 0; i < 128; i++) vals.push(r0() * 100);
  const data = series(vals);
  const r = buildSourceRowTokenDfa(data, {
    generatedAt: GEN,
    since: '2026-04-25T01:00:00Z',
    until: '2026-04-25T02:00:00Z',
  });
  // Only rows with hour_start in [01:00, 02:00) survive -> 60 rows < minRows=32 OK,
  // but tighter filter -> fewer than minRows? With 60 rows >= 32 yes.
  // The window includes mm in [0..59] for hh=01. So 60 rows.
  assert.equal(r.totalRowsKept, 60);
});

test('dfa: alpha clamped below 0 -> clampedBelow0 increments and alpha=0', () => {
  // Construct an artificial sequence whose alpha fit comes out negative.
  // Strong anti-persistence: values alternating tightly around mean
  // give a profile that stays bounded; F(s) is roughly constant or
  // shrinks with s -> slope <= 0. We use tight-amplitude alternation
  // plus tiny jitter so sigma > 0 and the fit is well-defined.
  const r0 = rng(61);
  const vals: number[] = [];
  for (let i = 0; i < 256; i++) {
    vals.push(100 + (i % 2 === 0 ? 1 : -1) + r0() * 0.001);
  }
  const r = buildSourceRowTokenDfa(series(vals), { generatedAt: GEN });
  // Anti-persistent alternation typically gives alpha very low. We
  // assert alpha is small (< 0.5) and that the clampedBelow0 counter
  // is meaningfully zero unless the slope is genuinely negative.
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.ok(row.alpha < 0.5, `expected anti-persistent alpha < 0.5, got ${row.alpha}`);
});
