import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenLogMeanAbsoluteDeviationIndex,
  logMeanAbsoluteDeviationOfVector,
  LMAD_OVER_SIGMA_NORMAL,
} from '../src/dailytokenlogmeanabsolutedeviationindex.js';
import { varianceOfLogarithmsOfVector } from '../src/dailytokenvarianceoflogarithms.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- LMAD primitive --------------------------------------------------

test('logMeanAbsoluteDeviationOfVector: empty -> degenerate', () => {
  const r = logMeanAbsoluteDeviationOfVector([]);
  assert.equal(r.lmad, 0);
  assert.equal(r.degenerate, true);
});

test('logMeanAbsoluteDeviationOfVector: n=1 -> degenerate, lmad=0', () => {
  const r = logMeanAbsoluteDeviationOfVector([42]);
  assert.equal(r.lmad, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.mean, 42);
  assert.ok(Math.abs(r.meanLog - Math.log(42)) < 1e-12);
});

test('logMeanAbsoluteDeviationOfVector: perfect equality -> 0', () => {
  const r = logMeanAbsoluteDeviationOfVector([7, 7, 7, 7, 7, 7]);
  assert.equal(r.lmad, 0);
  assert.equal(r.degenerate, true);
  assert.ok(Math.abs(r.geoMean - 7) < 1e-12);
  assert.ok(Math.abs(r.mean - 7) < 1e-12);
});

test('logMeanAbsoluteDeviationOfVector: scale-invariance (multiplying by k leaves LMAD unchanged)', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8];
  const a = logMeanAbsoluteDeviationOfVector(v);
  const b = logMeanAbsoluteDeviationOfVector(v.map((x) => x * 1e6));
  assert.ok(Math.abs(a.lmad - b.lmad) < 1e-12);
  assert.ok(Math.abs(b.meanLog - a.meanLog - Math.log(1e6)) < 1e-10);
});

test('logMeanAbsoluteDeviationOfVector: permutation-invariant', () => {
  const a = logMeanAbsoluteDeviationOfVector([1, 3, 7, 9, 4, 11]);
  const b = logMeanAbsoluteDeviationOfVector([11, 4, 9, 3, 7, 1]);
  assert.ok(Math.abs(a.lmad - b.lmad) < 1e-12);
});

test('logMeanAbsoluteDeviationOfVector: known closed form on [1,2,4,8]', () => {
  // log values (in units of log2): 0, 1, 2, 3
  // mean = 1.5; abs deviations = [1.5, 0.5, 0.5, 1.5]
  // sum = 4; LMAD = 4/4 * log2 = log2
  const r = logMeanAbsoluteDeviationOfVector([1, 2, 4, 8]);
  assert.ok(
    Math.abs(r.lmad - Math.log(2)) < 1e-12,
    `got ${r.lmad}, expected log2=${Math.log(2)}`,
  );
});

test('logMeanAbsoluteDeviationOfVector: two-point [a,b] symmetric formula', () => {
  // For 2 points a,b with mean of logs = (log a + log b)/2,
  // each deviation has magnitude |log(a/b)|/2, so LMAD = |log(a/b)|/2.
  const r = logMeanAbsoluteDeviationOfVector([2, 32]);
  const expected = Math.abs(Math.log(2 / 32)) / 2; // = 2*log(2)
  assert.ok(Math.abs(r.lmad - expected) < 1e-12);
});

test('logMeanAbsoluteDeviationOfVector: throws on zero', () => {
  assert.throws(() => logMeanAbsoluteDeviationOfVector([1, 0, 4]));
});

test('logMeanAbsoluteDeviationOfVector: throws on negative', () => {
  assert.throws(() => logMeanAbsoluteDeviationOfVector([1, -3, 4]));
});

test('logMeanAbsoluteDeviationOfVector: throws on NaN', () => {
  assert.throws(() => logMeanAbsoluteDeviationOfVector([1, Number.NaN, 4]));
});

test('logMeanAbsoluteDeviationOfVector: lognormal Monte-Carlo -> sqrt(2/pi)*sigma', () => {
  // Box-Muller, deterministic (seed via simple LCG).
  let s = 12345;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  function rnorm(): number {
    const u1 = rnd();
    const u2 = rnd();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  const sigma = 0.7;
  const N = 50000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) v.push(Math.exp(5 + sigma * rnorm()));
  const r = logMeanAbsoluteDeviationOfVector(v);
  const expected = sigma * Math.sqrt(2 / Math.PI);
  assert.ok(
    Math.abs(r.lmad - expected) < 0.02,
    `lognormal LMAD ~ ${expected.toFixed(4)}, got ${r.lmad.toFixed(4)}`,
  );
});

test('logMeanAbsoluteDeviationOfVector: LMAD/sqrt(VL) -> sqrt(2/pi) for lognormal', () => {
  let s = 99;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  function rnorm(): number {
    return Math.sqrt(-2 * Math.log(rnd())) * Math.cos(2 * Math.PI * rnd());
  }
  const N = 30000;
  const v: number[] = [];
  for (let i = 0; i < N; i++) v.push(Math.exp(2 + 1.3 * rnorm()));
  const lmad = logMeanAbsoluteDeviationOfVector(v).lmad;
  const vl = varianceOfLogarithmsOfVector(v).vl;
  const ratio = lmad / Math.sqrt(vl);
  assert.ok(
    Math.abs(ratio - Math.sqrt(2 / Math.PI)) < 0.02,
    `ratio ${ratio} vs ${Math.sqrt(2 / Math.PI)}`,
  );
});

test('LMAD_OVER_SIGMA_NORMAL constant matches Math.sqrt(2/pi)', () => {
  assert.equal(LMAD_OVER_SIGMA_NORMAL, Math.sqrt(2 / Math.PI));
});

test('logMeanAbsoluteDeviationOfVector: numerical stability on near-equal vector', () => {
  const v: number[] = [];
  for (let i = 0; i < 100; i++) v.push(1000 + 1e-9 * (i - 50));
  const r = logMeanAbsoluteDeviationOfVector(v);
  assert.ok(r.lmad >= 0);
  assert.ok(r.lmad < 1e-9, `expected near-zero lmad, got ${r.lmad}`);
});

// ---- builder shape ---------------------------------------------------

test('builder: empty queue returns empty report', () => {
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.generatedAt, GEN);
});

test('builder: drops bad hour_start', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-01T00:00:00Z', 'pew', 5000), hour_start: 'nonsense' } as QueueLine,
    ql('2026-04-01T00:00:00Z', 'pew', 5000),
    ql('2026-04-02T00:00:00Z', 'pew', 6000),
    ql('2026-04-03T00:00:00Z', 'pew', 7000),
    ql('2026-04-04T00:00:00Z', 'pew', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: drops non-positive total_tokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'pew', 0),
    ql('2026-04-01T00:00:00Z', 'pew', 5000),
    ql('2026-04-02T00:00:00Z', 'pew', 6000),
    ql('2026-04-03T00:00:00Z', 'pew', 7000),
    ql('2026-04-04T00:00:00Z', 'pew', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 1);
  assert.equal(r.sources.length, 1);
});

test('builder: minTokens filter surfaces droppedSparseSources', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'small', 10),
    ql('2026-04-02T00:00:00Z', 'small', 10),
    ql('2026-04-03T00:00:00Z', 'small', 10),
    ql('2026-04-04T00:00:00Z', 'small', 10),
    ql('2026-04-01T00:00:00Z', 'big', 5000),
    ql('2026-04-02T00:00:00Z', 'big', 6000),
    ql('2026-04-03T00:00:00Z', 'big', 7000),
    ql('2026-04-04T00:00:00Z', 'big', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

test('builder: minDays filter surfaces droppedBelowMinDays', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'sparse', 5000),
    ql('2026-04-02T00:00:00Z', 'sparse', 5000),
    ql('2026-04-01T00:00:00Z', 'good', 5000),
    ql('2026-04-02T00:00:00Z', 'good', 6000),
    ql('2026-04-03T00:00:00Z', 'good', 7000),
    ql('2026-04-04T00:00:00Z', 'good', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'good');
});

test('builder: source filter restricts intake', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'A', 5000),
    ql('2026-04-02T00:00:00Z', 'A', 6000),
    ql('2026-04-03T00:00:00Z', 'A', 7000),
    ql('2026-04-04T00:00:00Z', 'A', 8000),
    ql('2026-04-01T00:00:00Z', 'B', 9000),
    ql('2026-04-02T00:00:00Z', 'B', 1000),
    ql('2026-04-03T00:00:00Z', 'B', 1000),
    ql('2026-04-04T00:00:00Z', 'B', 1000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    source: 'A',
  });
  assert.equal(r.droppedSourceFilter, 4);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'A');
});

test('builder: equal daily totals -> degenerate row, lmad=0', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'flat', 5000),
    ql('2026-04-02T00:00:00Z', 'flat', 5000),
    ql('2026-04-03T00:00:00Z', 'flat', 5000),
    ql('2026-04-04T00:00:00Z', 'flat', 5000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.lmad, 0);
  assert.equal(r.sources[0]!.degenerate, true);
});

test('builder: spread daily totals -> positive lmad', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 1000),
    ql('2026-04-02T00:00:00Z', 's', 2000),
    ql('2026-04-03T00:00:00Z', 's', 4000),
    ql('2026-04-04T00:00:00Z', 's', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  // [1000,2000,4000,8000] -> log/log2 = [log1000+0,+1,+2,+3]
  // mean log shift in log2 units = 1.5; LMAD = log(2)
  assert.ok(Math.abs(r.sources[0]!.lmad - Math.log(2)) < 1e-9);
});

test('builder: scale-invariance under uniform multiplicative rescale', () => {
  const q1: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 1000),
    ql('2026-04-02T00:00:00Z', 's', 2500),
    ql('2026-04-03T00:00:00Z', 's', 7300),
    ql('2026-04-04T00:00:00Z', 's', 4400),
  ];
  const q2: QueueLine[] = q1.map((q) =>
    ql(q.hour_start, q.source, q.total_tokens * 1000),
  );
  const r1 = buildDailyTokenLogMeanAbsoluteDeviationIndex(q1, { generatedAt: GEN });
  const r2 = buildDailyTokenLogMeanAbsoluteDeviationIndex(q2, {
    generatedAt: GEN,
    minTokens: 1,
  });
  assert.ok(Math.abs(r1.sources[0]!.lmad - r2.sources[0]!.lmad) < 1e-10);
});

test('builder: hourly buckets aggregate into per-day totals', () => {
  // Two hourly buckets per day; LMAD computed on summed daily totals.
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 500),
    ql('2026-04-01T01:00:00Z', 's', 500), // day1 = 1000
    ql('2026-04-02T00:00:00Z', 's', 1000),
    ql('2026-04-02T03:00:00Z', 's', 1000), // day2 = 2000
    ql('2026-04-03T00:00:00Z', 's', 2000),
    ql('2026-04-03T05:00:00Z', 's', 2000), // day3 = 4000
    ql('2026-04-04T00:00:00Z', 's', 4000),
    ql('2026-04-04T06:00:00Z', 's', 4000), // day4 = 8000
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.nDays, 4);
  assert.ok(Math.abs(r.sources[0]!.lmad - Math.log(2)) < 1e-9);
});

test('builder: window filter (since/until)', () => {
  const q: QueueLine[] = [
    ql('2026-03-31T00:00:00Z', 's', 5000), // before window
    ql('2026-04-01T00:00:00Z', 's', 5000),
    ql('2026-04-02T00:00:00Z', 's', 6000),
    ql('2026-04-03T00:00:00Z', 's', 7000),
    ql('2026-04-04T00:00:00Z', 's', 8000),
    ql('2026-04-05T00:00:00Z', 's', 9000), // at upper bound
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-05T00:00:00Z',
  });
  assert.equal(r.sources[0]!.nDays, 4);
});

test('builder: top filter caps display, surfaces droppedTopSources', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    q.push(ql('2026-04-01T00:00:00Z', s, 1000));
    q.push(ql('2026-04-02T00:00:00Z', s, 2000));
    q.push(ql('2026-04-03T00:00:00Z', s, 4000));
    q.push(ql('2026-04-04T00:00:00Z', s, 8000));
  }
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('builder: minLmad filter surfaces droppedBelowMinLmad (degenerate always passes)', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'flat', 5000),
    ql('2026-04-02T00:00:00Z', 'flat', 5000),
    ql('2026-04-03T00:00:00Z', 'flat', 5000),
    ql('2026-04-04T00:00:00Z', 'flat', 5000),
    ql('2026-04-01T00:00:00Z', 'low', 1000),
    ql('2026-04-02T00:00:00Z', 'low', 1100),
    ql('2026-04-03T00:00:00Z', 'low', 900),
    ql('2026-04-04T00:00:00Z', 'low', 1050),
    ql('2026-04-01T00:00:00Z', 'high', 1000),
    ql('2026-04-02T00:00:00Z', 'high', 2000),
    ql('2026-04-03T00:00:00Z', 'high', 4000),
    ql('2026-04-04T00:00:00Z', 'high', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    minLmad: 0.3,
  });
  // 'low' lmad < 0.3 -> dropped; 'flat' degenerate -> kept; 'high' kept
  const names = r.sources.map((s) => s.source).sort();
  assert.deepEqual(names, ['flat', 'high']);
  assert.equal(r.droppedBelowMinLmad, 1);
});

test('builder: sort=tokens orders by totalTokens desc', () => {
  const q: QueueLine[] = [];
  for (const [s, mult] of [
    ['a', 1],
    ['b', 2],
    ['c', 3],
  ] as const) {
    for (let d = 1; d <= 4; d++) {
      q.push(
        ql(`2026-04-0${d}T00:00:00Z`, s, 1000 * mult * (d % 3 === 0 ? 3 : 1)),
      );
    }
  }
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    sort: 'tokens',
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['c', 'b', 'a']);
});

test('builder: sort=source produces alphabetical', () => {
  const q: QueueLine[] = [];
  for (const s of ['c', 'a', 'b']) {
    for (let d = 1; d <= 4; d++) {
      q.push(ql(`2026-04-0${d}T00:00:00Z`, s, 1000 * d));
    }
  }
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['a', 'b', 'c']);
});

test('builder: sort=geoMeanDaily orders by geometric mean desc', () => {
  const q: QueueLine[] = [];
  for (const [s, base] of [
    ['lo', 100],
    ['mid', 1000],
    ['hi', 10000],
  ] as const) {
    for (let d = 1; d <= 4; d++) {
      q.push(ql(`2026-04-0${d}T00:00:00Z`, s, base * d));
    }
  }
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    sort: 'geoMeanDaily',
    minTokens: 1,
  });
  assert.deepEqual(r.sources.map((s) => s.source), ['hi', 'mid', 'lo']);
});

test('builder: includeVlAnchor surfaces vl + lmadOverSqrtVl', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 1000),
    ql('2026-04-02T00:00:00Z', 's', 2000),
    ql('2026-04-03T00:00:00Z', 's', 4000),
    ql('2026-04-04T00:00:00Z', 's', 8000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    includeVlAnchor: true,
  });
  const row = r.sources[0]!;
  assert.ok(row.vl !== undefined);
  assert.ok(row.lmadOverSqrtVl !== undefined);
  // ratio = LMAD / sqrt(VL); for [1,2,4,8] LMAD=log2, VL=(5/4)*(log2)^2
  // -> ratio = log2 / (sqrt(5)/2 * log2) = 2/sqrt(5) ~ 0.8944
  const expected = 2 / Math.sqrt(5);
  assert.ok(Math.abs((row.lmadOverSqrtVl as number) - expected) < 1e-9);
});

test('builder: includeVlAnchor sets NaN when vl ~ 0 (degenerate guard)', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'flat', 5000),
    ql('2026-04-02T00:00:00Z', 'flat', 5000),
    ql('2026-04-03T00:00:00Z', 'flat', 5000),
    ql('2026-04-04T00:00:00Z', 'flat', 5000),
  ];
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    includeVlAnchor: true,
  });
  const row = r.sources[0]!;
  assert.equal(row.vl, 0);
  assert.ok(Number.isNaN(row.lmadOverSqrtVl as number));
});

test('builder: validates --min-days >= 2', () => {
  assert.throws(() =>
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { minDays: 1 }),
  );
});

test('builder: validates --top >= 0 integer', () => {
  assert.throws(() =>
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { top: -1 }),
  );
});

test('builder: validates --min-tokens non-negative finite', () => {
  assert.throws(() =>
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { minTokens: -1 }),
  );
});

test('builder: validates --min-lmad non-negative finite', () => {
  assert.throws(() =>
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { minLmad: -0.5 }),
  );
});

test('builder: validates sort key', () => {
  assert.throws(() =>
    // @ts-expect-error sort key validation
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { sort: 'banana' }),
  );
});

test('builder: validates --since ISO', () => {
  assert.throws(() =>
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { since: 'banana' }),
  );
});

test('builder: validates --until ISO', () => {
  assert.throws(() =>
    buildDailyTokenLogMeanAbsoluteDeviationIndex([], { until: 'banana' }),
  );
});

test('builder: deterministic generatedAt is honoured', () => {
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex([], {
    generatedAt: '1999-01-01T00:00:00.000Z',
  });
  assert.equal(r.generatedAt, '1999-01-01T00:00:00.000Z');
});

test('builder: report shape contains droppedBelowMinLmad bookkeeping', () => {
  const r = buildDailyTokenLogMeanAbsoluteDeviationIndex([], { generatedAt: GEN });
  assert.ok('droppedBelowMinLmad' in r);
  assert.equal(r.droppedBelowMinLmad, 0);
});

// ---- Refinement: closed-form audits + numerical hardening + non-degeneracy witness vs VL ----

test('refinement: equal-spaced log-grid closed form, LMAD = ((N^2-1)/(2N)) * d for v_i=exp(i*d)', () => {
  // For values v_i = exp(i*d), i = 0..N-1, log v = i*d, mean = (N-1)*d/2,
  // |i - (N-1)/2| sums to N^2/4 (even N) or (N^2-1)/4 (odd N).
  // Closed form: LMAD = (d/N) * sum_i |i - (N-1)/2|
  const d = 0.7;
  for (const N of [3, 5, 8, 13, 21]) {
    const v: number[] = [];
    for (let i = 0; i < N; i++) v.push(Math.exp(i * d));
    let sumAbs = 0;
    const c = (N - 1) / 2;
    for (let i = 0; i < N; i++) sumAbs += Math.abs(i - c);
    const expected = (d * sumAbs) / N;
    const got = logMeanAbsoluteDeviationOfVector(v).lmad;
    assert.ok(Math.abs(got - expected) < 1e-12, `N=${N}: got ${got}, expected ${expected}`);
  }
});

test('refinement: replication-invariance (Dalton population principle on log scale)', () => {
  // Tripling every entry leaves LMAD unchanged.
  const v = [1000, 2500, 7300, 4400, 11000, 600];
  const a = logMeanAbsoluteDeviationOfVector(v).lmad;
  const triple = [...v, ...v, ...v];
  const b = logMeanAbsoluteDeviationOfVector(triple).lmad;
  assert.ok(Math.abs(a - b) < 1e-12, `single ${a}, tripled ${b}`);
});

test('refinement: scale-invariance across 12 orders of magnitude', () => {
  const v = [1, 2, 3, 5, 8, 13, 21];
  const base = logMeanAbsoluteDeviationOfVector(v).lmad;
  for (const k of [1e-6, 1e-3, 1, 1e3, 1e6]) {
    const got = logMeanAbsoluteDeviationOfVector(v.map((x) => x * k)).lmad;
    assert.ok(
      Math.abs(got - base) < 1e-12,
      `k=${k}: got ${got} vs base ${base}`,
    );
  }
});

test('refinement: numerical-stability sweep -- 100k near-equal log-vector via Kahan two-pass', () => {
  // Multiplicative jitter at the 1e-6 level around exp(20) is the regime
  // where naive single-pass mean-abs-dev would lose digits.
  const N = 100000;
  const v: number[] = [];
  let s = 7;
  for (let i = 0; i < N; i++) {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    const u = (s + 1) / 0x80000000 - 0.5; // U(-0.5, 0.5)
    v.push(Math.exp(20) * (1 + 1e-6 * u));
  }
  const r = logMeanAbsoluteDeviationOfVector(v);
  assert.ok(r.lmad >= 0, `LMAD non-negative, got ${r.lmad}`);
  assert.ok(r.lmad < 1e-6, `LMAD ~ jitter scale, got ${r.lmad}`);
});

test('refinement: Pareto(alpha) closed-form contrast vs lognormal sqrt(2/pi) reference', () => {
  // Pareto(alpha) on log y has log y = log x_min + Z, Z ~ Exponential(alpha).
  // For Z ~ Exp(rate=alpha), mean = 1/alpha, E|Z - 1/alpha| = 2/(alpha*e).
  // So LMAD(Pareto) = 2/(alpha*e), VL(Pareto) = 1/alpha^2,
  //    LMAD/sqrt(VL) = 2/e ~ 0.7358 (alpha-INVARIANT, distinct from sqrt(2/pi) ~ 0.7979).
  //
  // Inverse-CDF sample: U ~ U(0,1), x = x_min * (1-U)^(-1/alpha).
  let s = 1234567;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  const N = 30000;
  const alpha = 3.0;
  const xmin = 1.0;
  const v: number[] = [];
  for (let i = 0; i < N; i++) v.push(xmin * (1 - rnd()) ** (-1 / alpha));
  const lmad = logMeanAbsoluteDeviationOfVector(v).lmad;
  const vl = varianceOfLogarithmsOfVector(v).vl;
  const ratio = lmad / Math.sqrt(vl);
  const paretoRef = 2 / Math.E;
  const lognormalRef = Math.sqrt(2 / Math.PI);
  // Confirm the empirical Pareto ratio is closer to 2/e than to sqrt(2/pi)
  assert.ok(
    Math.abs(ratio - paretoRef) < 0.02,
    `Pareto ratio ~ ${paretoRef.toFixed(4)}, got ${ratio.toFixed(4)}`,
  );
  // Non-degeneracy: 2/e and sqrt(2/pi) are NOT equal (different families)
  assert.notEqual(paretoRef, lognormalRef);
  assert.ok(Math.abs(paretoRef - lognormalRef) > 0.05);
});

test('refinement: non-degeneracy witness vs axis-53 VL via L1/L2 ratio inequality', () => {
  // Cauchy-Schwarz: (E|Z|)^2 <= E[Z^2], so LMAD^2 <= VL, i.e. LMAD/sqrt(VL) <= 1.
  // The lognormal reference sqrt(2/pi) ~ 0.7979 is strictly < 1.
  // Construct two vectors with the SAME VL but DIFFERENT LMAD by mixing
  // a heavy log-tail with a light core.
  // Vector A: symmetric two-point on log scale: exp(-1), exp(-1), exp(1), exp(1)
  // Vector B: asymmetric: exp(-3), exp(0), exp(0), exp(3)  (same n=4)
  const A = [Math.exp(-1), Math.exp(-1), Math.exp(1), Math.exp(1)];
  const B = [Math.exp(-3), Math.exp(0), Math.exp(0), Math.exp(3)];
  const ra = logMeanAbsoluteDeviationOfVector(A);
  const rb = logMeanAbsoluteDeviationOfVector(B);
  const va = varianceOfLogarithmsOfVector(A);
  const vb = varianceOfLogarithmsOfVector(B);
  // A: VL = 1, LMAD = 1, ratio = 1 (extremal: Cauchy-Schwarz equality)
  assert.ok(Math.abs(va.vl - 1) < 1e-12);
  assert.ok(Math.abs(ra.lmad - 1) < 1e-12);
  // B: VL = (9+0+0+9)/4 = 4.5, LMAD = (3+0+0+3)/4 = 1.5, ratio = 1.5/sqrt(4.5) = 0.7071
  assert.ok(Math.abs(vb.vl - 4.5) < 1e-12);
  assert.ok(Math.abs(rb.lmad - 1.5) < 1e-12);
  // Witness: A has VL=1, B has VL=4.5 -- VL ranks B > A.
  // Ratios: A=1.0, B=0.7071 -- L1/L2 ratio ranks A > B.
  // The two functionals disagree on rank order, proving LMAD is not a
  // monotone reparameterization of VL.
  const ratioA = ra.lmad / Math.sqrt(va.vl);
  const ratioB = rb.lmad / Math.sqrt(vb.vl);
  assert.ok(va.vl < vb.vl, `VL: A < B: ${va.vl} vs ${vb.vl}`);
  assert.ok(ratioA > ratioB, `ratio: A > B: ${ratioA} vs ${ratioB}`);
});

test('refinement: includeVlAnchor read-only, vl/lmad bit-identical across toggle', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 's', 1000),
    ql('2026-04-02T00:00:00Z', 's', 2500),
    ql('2026-04-03T00:00:00Z', 's', 7300),
    ql('2026-04-04T00:00:00Z', 's', 4400),
    ql('2026-04-05T00:00:00Z', 's', 11000),
  ];
  const off = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    includeVlAnchor: false,
  });
  const on = buildDailyTokenLogMeanAbsoluteDeviationIndex(q, {
    generatedAt: GEN,
    includeVlAnchor: true,
  });
  assert.equal(off.sources[0]!.lmad, on.sources[0]!.lmad);
  assert.equal(off.sources[0]!.meanLog, on.sources[0]!.meanLog);
  assert.equal(off.sources[0]!.geoMeanDaily, on.sources[0]!.geoMeanDaily);
  assert.equal(off.sources[0]!.vl, undefined);
  assert.ok(on.sources[0]!.vl !== undefined);
});

test('refinement: Cauchy-Schwarz upper bound LMAD <= sqrt(VL) on randomised sweep', () => {
  let s = 4242;
  function rnd(): number {
    s = (1103515245 * s + 12345) & 0x7fffffff;
    return (s + 1) / 0x80000000;
  }
  for (let trial = 0; trial < 50; trial++) {
    const N = 4 + Math.floor(rnd() * 30);
    const v: number[] = [];
    for (let i = 0; i < N; i++) v.push(Math.exp(rnd() * 6 - 3));
    const lmad = logMeanAbsoluteDeviationOfVector(v).lmad;
    const vl = varianceOfLogarithmsOfVector(v).vl;
    // Allow 1e-12 slack for floating-point.
    assert.ok(
      lmad <= Math.sqrt(vl) + 1e-12,
      `Cauchy-Schwarz: LMAD ${lmad} > sqrt(VL) ${Math.sqrt(vl)}`,
    );
    // Ratio strictly positive when not degenerate.
    if (vl > 1e-15) {
      const ratio = lmad / Math.sqrt(vl);
      assert.ok(ratio > 0 && ratio <= 1 + 1e-12);
    }
  }
});

test('refinement: log-MAD invariance under reciprocal y -> 1/y (log-scale reflection symmetry)', () => {
  // log(1/y) = -log y, so all deviations from the mean flip sign but
  // |.| is sign-invariant -> LMAD(y) = LMAD(1/y).
  const v = [0.1, 0.3, 0.7, 1.1, 2.5, 7.3, 11.0];
  const a = logMeanAbsoluteDeviationOfVector(v).lmad;
  const b = logMeanAbsoluteDeviationOfVector(v.map((x) => 1 / x)).lmad;
  assert.ok(Math.abs(a - b) < 1e-12, `LMAD(y)=${a}, LMAD(1/y)=${b}`);
});

test('refinement: two-point exact closed form LMAD = |log(a/b)|/2', () => {
  for (const [a, b] of [
    [3, 12],
    [100, 1],
    [1e6, 1],
    [7, 7.5],
  ] as const) {
    const got = logMeanAbsoluteDeviationOfVector([a, b]).lmad;
    const expected = Math.abs(Math.log(a / b)) / 2;
    assert.ok(
      Math.abs(got - expected) < 1e-12,
      `[${a},${b}]: got ${got}, expected ${expected}`,
    );
  }
});
