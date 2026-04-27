import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRowTokenKurtosis } from '../src/sourcerowtokenkurtosis.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens = 0,
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

const GEN = '2026-04-27T12:00:00.000Z';

test('row-token-kurtosis: empty input -> empty report with defaults', () => {
  const r = buildSourceRowTokenKurtosis([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 4);
  assert.equal(r.minMean, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'kurt-desc');
  assert.equal(r.generatedAt, GEN);
});

test('row-token-kurtosis: rejects bad minRows', () => {
  assert.throws(() => buildSourceRowTokenKurtosis([], { minRows: 0 }));
  assert.throws(() => buildSourceRowTokenKurtosis([], { minRows: 3 }));
  assert.throws(() => buildSourceRowTokenKurtosis([], { minRows: 4.5 }));
});

test('row-token-kurtosis: rejects bad minMean', () => {
  assert.throws(() => buildSourceRowTokenKurtosis([], { minMean: -1 }));
  assert.throws(() =>
    buildSourceRowTokenKurtosis([], { minMean: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() => buildSourceRowTokenKurtosis([], { minMean: Number.NaN }));
});

test('row-token-kurtosis: rejects bad top', () => {
  assert.throws(() => buildSourceRowTokenKurtosis([], { top: 0 }));
  assert.throws(() => buildSourceRowTokenKurtosis([], { top: 1.5 }));
});

test('row-token-kurtosis: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceRowTokenKurtosis([], { sort: 'bogus' }),
  );
});

test('row-token-kurtosis: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceRowTokenKurtosis([], { since: 'bad-date' }),
  );
  assert.throws(() =>
    buildSourceRowTokenKurtosis([], { until: 'bad-date' }),
  );
});

test('row-token-kurtosis: drops sources with rows < 4 as too-few', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalRowsKept, 3);
  assert.equal(r.sources.length, 0);
  assert.equal(r.droppedTooFewRowsForKurtosis, 1);
});

test('row-token-kurtosis: counts invalid hour_start', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
    ql('2026-04-20T03:00:00Z', 'a', 400),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 4);
  assert.equal(r.sources.length, 1);
});

test('row-token-kurtosis: uniform-like sample -> negative excess kurtosis (platykurtic)', () => {
  // Discrete uniform on {1..10} has population kurtosis ~ 1.776, so excess ~ -1.224.
  const samples = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const q: QueueLine[] = samples.map((v, i) =>
    ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'u', v * 100),
  );
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 10);
  // For 1..10 (population): mean=5.5, var=8.25, m4=120.8625
  // kurt = m4/m2^2 = 120.8625 / 68.0625 = 1.7757..., excess = -1.2242...
  // Scaled by 100 doesn't change kurtosis (scale invariant).
  assert.ok(
    row.excessKurtosis < 0,
    `expected negative excess kurt, got ${row.excessKurtosis}`,
  );
  assert.ok(
    Math.abs(row.excessKurtosis - (-1.2242424242424241)) < 1e-9,
    `expected ~ -1.2242, got ${row.excessKurtosis}`,
  );
  assert.equal(row.degenerate, false);
});

test('row-token-kurtosis: heavy-tailed sample -> large positive excess kurtosis', () => {
  // {10, 10, 10, 10, 1000}: one fat tail row.
  // mean = 208, m2 = (4*198^2 + 792^2)/5 = 156816, m4 = (4*198^4 + 792^4)/5
  // m2^2 = 24,591,257,856
  // m4 = (4*1,536,953,616 + 393,460,233,984)/5 = (6,147,814,464 + 393,460,233,984)/5
  //    = 399,608,048,448/5 = 79,921,609,689.6
  // excess = 79,921,609,689.6 / 24,591,257,856 - 3 = 3.25 - 3 = 0.25
  // Wait that seems low. Let me recompute: this is pop kurtosis.
  // Actually sample of 5 with 1 outlier at 4-5 stddev, max possible excess kurtosis
  // for n=5 is n-3 = 2. So 0.25 is in range, but let's just verify positive + within range.
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'h', 10),
    ql('2026-04-20T01:00:00Z', 'h', 10),
    ql('2026-04-20T02:00:00Z', 'h', 10),
    ql('2026-04-20T03:00:00Z', 'h', 10),
    ql('2026-04-20T04:00:00Z', 'h', 1000),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // For n=5 with one extreme outlier and four ties, kurtosis is bounded.
  // Just verify it's finite, positive (heavier tail than uniform), and within expected ballpark.
  assert.ok(Number.isFinite(row.excessKurtosis));
  // Verified by hand: ~ 0.25 (the n=5 ceiling is +2; this is heavy tail vs symmetric).
  assert.ok(
    Math.abs(row.excessKurtosis - 0.25) < 0.01,
    `expected ~0.25, got ${row.excessKurtosis}`,
  );
});

test('row-token-kurtosis: bigger heavy-tailed sample -> larger excess kurtosis', () => {
  // Many small + one mega-outlier: 19 small (=10) + 1 huge (=10000)
  const q: QueueLine[] = [];
  for (let i = 0; i < 19; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'big', 10));
  }
  q.push(ql('2026-04-21T00:00:00Z', 'big', 10000));
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // n=20, max possible excess = n-3 = 17. With one outlier should be near max.
  assert.ok(
    row.excessKurtosis > 5,
    `expected > 5, got ${row.excessKurtosis}`,
  );
  assert.ok(row.excessKurtosis <= 17.001);
});

test('row-token-kurtosis: all-zero rows -> degenerate flag, kurtosis 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'z', 0),
    ql('2026-04-20T01:00:00Z', 'z', 0),
    ql('2026-04-20T02:00:00Z', 'z', 0),
    ql('2026-04-20T03:00:00Z', 'z', 0),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.mean, 0);
  assert.equal(row.variance, 0);
  assert.equal(row.stddev, 0);
  assert.equal(row.excessKurtosis, 0);
  assert.equal(row.degenerate, true);
});

test('row-token-kurtosis: all-identical non-zero rows -> degenerate', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'k', 500),
    ql('2026-04-20T01:00:00Z', 'k', 500),
    ql('2026-04-20T02:00:00Z', 'k', 500),
    ql('2026-04-20T03:00:00Z', 'k', 500),
    ql('2026-04-20T04:00:00Z', 'k', 500),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.mean, 500);
  assert.equal(row.stddev, 0);
  assert.equal(row.excessKurtosis, 0);
  assert.equal(row.degenerate, true);
});

test('row-token-kurtosis: clamps negative total_tokens to 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'n', 100),
    ql('2026-04-20T01:00:00Z', 'n', 100),
    ql('2026-04-20T02:00:00Z', 'n', 100),
    ql('2026-04-20T03:00:00Z', 'n', -50),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Effective samples: {100, 100, 100, 0}: mean = 75
  assert.equal(row.mean, 75);
});

test('row-token-kurtosis: NaN total_tokens treated as 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'n', 100),
    ql('2026-04-20T01:00:00Z', 'n', 100),
    ql('2026-04-20T02:00:00Z', 'n', 100),
    ql('2026-04-20T03:00:00Z', 'n', Number.NaN),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.mean, 75);
});

test('row-token-kurtosis: --since/--until window gating', () => {
  const q: QueueLine[] = [
    ql('2026-04-19T00:00:00Z', 'a', 100), // pre-window
    ql('2026-04-20T00:00:00Z', 'a', 200),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 200),
    ql('2026-04-20T03:00:00Z', 'a', 200),
    ql('2026-04-21T00:00:00Z', 'a', 999), // post-window (until is exclusive)
  ];
  const r = buildSourceRowTokenKurtosis(q, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.totalRowsKept, 4);
  assert.equal(r.sources[0]!.mean, 200);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

test('row-token-kurtosis: --source restricts and counts dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 100),
    ql('2026-04-20T02:00:00Z', 'a', 100),
    ql('2026-04-20T03:00:00Z', 'a', 100),
    ql('2026-04-20T04:00:00Z', 'b', 50),
    ql('2026-04-20T05:00:00Z', 'b', 50),
  ];
  const r = buildSourceRowTokenKurtosis(q, {
    source: 'a',
    generatedAt: GEN,
  });
  assert.equal(r.source, 'a');
  assert.equal(r.totalRowsKept, 4);
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('row-token-kurtosis: missing/empty source -> "unknown"', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-20T00:00:00Z', '', 100) },
    { ...ql('2026-04-20T01:00:00Z', '', 100) },
    { ...ql('2026-04-20T02:00:00Z', '', 200) },
    { ...ql('2026-04-20T03:00:00Z', '', 300) },
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('row-token-kurtosis: --min-rows display gate', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'small', 100),
    ql('2026-04-20T01:00:00Z', 'small', 200),
    ql('2026-04-20T02:00:00Z', 'small', 300),
    ql('2026-04-20T03:00:00Z', 'small', 400),
    ql('2026-04-20T04:00:00Z', 'big', 100),
    ql('2026-04-20T05:00:00Z', 'big', 200),
    ql('2026-04-20T06:00:00Z', 'big', 300),
    ql('2026-04-20T07:00:00Z', 'big', 400),
    ql('2026-04-20T08:00:00Z', 'big', 500),
  ];
  const r = buildSourceRowTokenKurtosis(q, {
    minRows: 5,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinRows, 1);
});

test('row-token-kurtosis: --min-mean display gate', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'tiny', 1),
    ql('2026-04-20T01:00:00Z', 'tiny', 2),
    ql('2026-04-20T02:00:00Z', 'tiny', 3),
    ql('2026-04-20T03:00:00Z', 'tiny', 4),
    ql('2026-04-20T04:00:00Z', 'big', 1000),
    ql('2026-04-20T05:00:00Z', 'big', 2000),
    ql('2026-04-20T06:00:00Z', 'big', 3000),
    ql('2026-04-20T07:00:00Z', 'big', 4000),
  ];
  const r = buildSourceRowTokenKurtosis(q, {
    minMean: 100,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedBelowMinMean, 1);
});

test('row-token-kurtosis: --top caps and counts dropped', () => {
  const q: QueueLine[] = [];
  // 3 sources, each 4 rows.
  for (const s of ['a', 'b', 'c']) {
    for (let i = 0; i < 4; i += 1) {
      q.push(
        ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, s, 100 * (i + 1)),
      );
    }
  }
  const r = buildSourceRowTokenKurtosis(q, { top: 2, generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.top, 2);
});

test('row-token-kurtosis: sort kurt-desc by default (most leptokurtic first)', () => {
  // 'fat' has heavy tail; 'flat' is uniform.
  const q: QueueLine[] = [];
  // fat: 7 small + 1 huge (heavy positive excess kurt)
  for (let i = 0; i < 7; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'fat', 10));
  }
  q.push(ql('2026-04-20T07:00:00Z', 'fat', 10000));
  // flat: linear ramp (low/negative excess kurt)
  for (let i = 0; i < 8; i += 1) {
    q.push(
      ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'flat', (i + 1) * 100),
    );
  }
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'fat');
  assert.equal(r.sources[1]!.source, 'flat');
  assert.ok(r.sources[0]!.excessKurtosis > r.sources[1]!.excessKurtosis);
});

test('row-token-kurtosis: sort kurt-asc reverses', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 7; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'fat', 10));
  }
  q.push(ql('2026-04-20T07:00:00Z', 'fat', 10000));
  for (let i = 0; i < 8; i += 1) {
    q.push(
      ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'flat', (i + 1) * 100),
    );
  }
  const r = buildSourceRowTokenKurtosis(q, {
    sort: 'kurt-asc',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'flat');
  assert.equal(r.sources[1]!.source, 'fat');
});

test('row-token-kurtosis: sort abs-kurt orders by magnitude', () => {
  // 'fat' high positive, 'flat' near zero, 'plat' moderate negative
  const q: QueueLine[] = [];
  // fat: heavy outlier -> large positive excess kurt
  for (let i = 0; i < 7; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'fat', 10));
  }
  q.push(ql('2026-04-20T07:00:00Z', 'fat', 10000));
  // plat: 2-mode bimodal -> negative excess kurt (platykurtic)
  for (const v of [10, 10, 10, 10, 100, 100, 100, 100]) {
    q.push(
      ql(`2026-04-21T${String(q.length).padStart(2, '0')}:00:00Z`, 'plat', v),
    );
  }
  const r = buildSourceRowTokenKurtosis(q, {
    sort: 'abs-kurt',
    generatedAt: GEN,
  });
  // 'plat' bimodal symmetric has excess kurt = -2 exactly (two equal peaks).
  // 'fat' is large positive. Compare magnitudes — fat should win.
  assert.equal(r.sources[0]!.source, 'fat');
  assert.ok(
    r.sources[0]!.absExcessKurtosis >= r.sources[1]!.absExcessKurtosis,
  );
});

test('row-token-kurtosis: sort by source asc lex', () => {
  const q: QueueLine[] = [];
  for (const s of ['gamma', 'alpha', 'beta']) {
    for (let i = 0; i < 4; i += 1) {
      q.push(
        ql(
          `2026-04-2${s.length}T${String(i).padStart(2, '0')}:00:00Z`,
          s,
          100 * (i + 1),
        ),
      );
    }
  }
  const r = buildSourceRowTokenKurtosis(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'beta', 'gamma'],
  );
});

test('row-token-kurtosis: sort by rows desc', () => {
  const q: QueueLine[] = [];
  // a has 6 rows, b has 4 rows
  for (let i = 0; i < 6; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'a', 100 + i));
  }
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'b', 100 + i));
  }
  const r = buildSourceRowTokenKurtosis(q, {
    sort: 'rows',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('row-token-kurtosis: sort by mean desc', () => {
  const q: QueueLine[] = [];
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'big', 1000));
  }
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'small', 10));
  }
  // make small all-identical so kurt is degenerate but mean is still 10
  // Actually big is all-identical too in this construction — need variation:
  const q2: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'big', 900),
    ql('2026-04-20T01:00:00Z', 'big', 1000),
    ql('2026-04-20T02:00:00Z', 'big', 1100),
    ql('2026-04-20T03:00:00Z', 'big', 1200),
    ql('2026-04-21T00:00:00Z', 'small', 10),
    ql('2026-04-21T01:00:00Z', 'small', 20),
    ql('2026-04-21T02:00:00Z', 'small', 30),
    ql('2026-04-21T03:00:00Z', 'small', 40),
  ];
  const r = buildSourceRowTokenKurtosis(q2, {
    sort: 'mean',
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'small');
});

test('row-token-kurtosis: tiebreak by source asc', () => {
  // Two sources with identical kurtosis -> alphabetical tiebreak.
  const q: QueueLine[] = [];
  for (const s of ['z', 'a']) {
    for (const v of [1, 2, 3, 4]) {
      q.push(
        ql(
          `2026-04-2${s === 'z' ? '0' : '1'}T${String(v).padStart(2, '0')}:00:00Z`,
          s,
          v * 100,
        ),
      );
    }
  }
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  // identical samples -> identical kurt -> a before z
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'z');
});

test('row-token-kurtosis: report carries all options/metadata', () => {
  const r = buildSourceRowTokenKurtosis([], {
    minRows: 7,
    minMean: 50,
    top: 5,
    sort: 'abs-kurt',
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.minRows, 7);
  assert.equal(r.minMean, 50);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'abs-kurt');
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
});

test('row-token-kurtosis: bimodal symmetric -> negative excess kurtosis (platykurtic)', () => {
  // Two equal-mass spikes -> excess kurt = -2 (theoretical floor for symmetric two-point).
  const q: QueueLine[] = [];
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'bi', 100));
  }
  for (let i = 0; i < 4; i += 1) {
    q.push(ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'bi', 1000));
  }
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Two-point symmetric: m4 = m2^2, so kurt = 1, excess = -2.
  assert.ok(
    Math.abs(row.excessKurtosis - -2) < 1e-9,
    `expected -2 exactly, got ${row.excessKurtosis}`,
  );
});

test('row-token-kurtosis: monotone progression, finite kurt', () => {
  // Linearly increasing samples -> excess kurt about -1.2 (uniform-ish)
  const q: QueueLine[] = [];
  for (let i = 1; i <= 11; i += 1) {
    q.push(ql(`2026-04-20T${String(i - 1).padStart(2, '0')}:00:00Z`, 'mono', i * 50));
  }
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Number.isFinite(row.excessKurtosis));
  assert.ok(row.excessKurtosis < 0);
  assert.ok(row.excessKurtosis > -1.5);
});

test('row-token-kurtosis: kurtosis is location-shift invariant', () => {
  // Add a constant to every sample -> kurtosis unchanged.
  const samplesA = [10, 20, 30, 40, 50, 60, 70];
  const samplesB = samplesA.map((v) => v + 1000);
  const qa: QueueLine[] = samplesA.map((v, i) =>
    ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'a', v),
  );
  const qb: QueueLine[] = samplesB.map((v, i) =>
    ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'b', v),
  );
  const ra = buildSourceRowTokenKurtosis(qa, { generatedAt: GEN });
  const rb = buildSourceRowTokenKurtosis(qb, { generatedAt: GEN });
  assert.ok(
    Math.abs(ra.sources[0]!.excessKurtosis - rb.sources[0]!.excessKurtosis) <
      1e-9,
  );
});

test('row-token-kurtosis: kurtosis is positive-scale invariant', () => {
  // Multiply every sample by a positive constant -> kurtosis unchanged.
  const samplesA = [10, 20, 30, 40, 50, 60, 70];
  const samplesB = samplesA.map((v) => v * 7);
  const qa: QueueLine[] = samplesA.map((v, i) =>
    ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'a', v),
  );
  const qb: QueueLine[] = samplesB.map((v, i) =>
    ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, 'b', v),
  );
  const ra = buildSourceRowTokenKurtosis(qa, { generatedAt: GEN });
  const rb = buildSourceRowTokenKurtosis(qb, { generatedAt: GEN });
  assert.ok(
    Math.abs(ra.sources[0]!.excessKurtosis - rb.sources[0]!.excessKurtosis) <
      1e-9,
  );
});

test('row-token-kurtosis: degenerate flag iff variance = 0', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'var', 100),
    ql('2026-04-20T01:00:00Z', 'var', 200),
    ql('2026-04-20T02:00:00Z', 'var', 100),
    ql('2026-04-20T03:00:00Z', 'var', 200),
    ql('2026-04-20T04:00:00Z', 'flat', 500),
    ql('2026-04-20T05:00:00Z', 'flat', 500),
    ql('2026-04-20T06:00:00Z', 'flat', 500),
    ql('2026-04-20T07:00:00Z', 'flat', 500),
  ];
  const r = buildSourceRowTokenKurtosis(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  const flat = r.sources.find((s) => s.source === 'flat')!;
  const variable = r.sources.find((s) => s.source === 'var')!;
  assert.equal(flat.degenerate, true);
  assert.equal(variable.degenerate, false);
});

test('row-token-kurtosis: JSON shape stability — keys present and typed', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T00:00:00Z', 'a', 100),
    ql('2026-04-20T01:00:00Z', 'a', 200),
    ql('2026-04-20T02:00:00Z', 'a', 300),
    ql('2026-04-20T03:00:00Z', 'a', 400),
  ];
  const r = buildSourceRowTokenKurtosis(q, { generatedAt: GEN });
  for (const k of [
    'generatedAt',
    'windowStart',
    'windowEnd',
    'source',
    'minRows',
    'minMean',
    'top',
    'sort',
    'totalSources',
    'totalRowsKept',
    'droppedInvalidHourStart',
    'droppedSourceFilter',
    'droppedTooFewRowsForKurtosis',
    'droppedBelowMinRows',
    'droppedBelowMinMean',
    'droppedBelowTopCap',
    'sources',
  ]) {
    assert.ok(k in r, `missing key ${k}`);
  }
  const row = r.sources[0]!;
  for (const k of [
    'source',
    'rowsKept',
    'mean',
    'variance',
    'stddev',
    'excessKurtosis',
    'absExcessKurtosis',
    'degenerate',
  ]) {
    assert.ok(k in row, `missing row key ${k}`);
  }
});
