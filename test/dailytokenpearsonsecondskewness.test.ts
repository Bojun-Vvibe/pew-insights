import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenPearsonSecondSkewness,
  pearsonSecondSkewnessOfVector,
} from '../src/dailytokenpearsonsecondskewness.js';
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

const GEN = '2026-05-04T12:00:00.000Z';

// ---------------- pearsonSecondSkewnessOfVector primitive ----------------

test('pearsonSecondSkewnessOfVector: empty -> degenerate', () => {
  const r = pearsonSecondSkewnessOfVector([]);
  assert.equal(r.pss, 0);
  assert.equal(r.degenerate, true);
});

test('pearsonSecondSkewnessOfVector: singleton -> degenerate', () => {
  const r = pearsonSecondSkewnessOfVector([42]);
  assert.equal(r.pss, 0);
  assert.equal(r.median, 42);
  assert.equal(r.mean, 42);
  assert.equal(r.degenerate, true);
});

test('pearsonSecondSkewnessOfVector: constant series -> degenerate (stddev=0)', () => {
  const r = pearsonSecondSkewnessOfVector([7, 7, 7, 7, 7]);
  assert.equal(r.stddev, 0);
  assert.equal(r.pss, 0);
  assert.equal(r.degenerate, true);
});

test('pearsonSecondSkewnessOfVector: symmetric -> pss = 0', () => {
  // Symmetric vector: mean = median by construction.
  const r = pearsonSecondSkewnessOfVector([1, 2, 3, 4, 5]);
  assert.equal(r.mean, 3);
  assert.equal(r.median, 3);
  assert.ok(r.stddev > 0);
  assert.ok(Math.abs(r.pss) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('pearsonSecondSkewnessOfVector: right-skewed -> pss > 0', () => {
  // [1,1,1,1,100]: mean = 20.8, median = 1, stddev > 0 -> pss large positive
  const r = pearsonSecondSkewnessOfVector([1, 1, 1, 1, 100]);
  assert.equal(r.median, 1);
  assert.ok(Math.abs(r.mean - 20.8) < 1e-12);
  assert.ok(r.pss > 0);
});

test('pearsonSecondSkewnessOfVector: left-skewed -> pss < 0', () => {
  // [1,100,100,100,100]: mean = 80.2, median = 100 -> pss < 0
  const r = pearsonSecondSkewnessOfVector([1, 100, 100, 100, 100]);
  assert.equal(r.median, 100);
  assert.ok(Math.abs(r.mean - 80.2) < 1e-12);
  assert.ok(r.pss < 0);
});

test('pearsonSecondSkewnessOfVector: closed-form on [1,2,3,4,10]', () => {
  // mean = 4, median = 3, var = ((9+4+1+0+36)/5) = 50/5 = 10, stddev = sqrt(10)
  // pss = 3 * (4 - 3) / sqrt(10) = 3 / sqrt(10)
  const r = pearsonSecondSkewnessOfVector([1, 2, 3, 4, 10]);
  assert.equal(r.mean, 4);
  assert.equal(r.median, 3);
  assert.ok(Math.abs(r.stddev - Math.sqrt(10)) < 1e-12);
  assert.ok(Math.abs(r.pss - 3 / Math.sqrt(10)) < 1e-12);
});

test('pearsonSecondSkewnessOfVector: scale-invariance under c=10', () => {
  const a = [1, 2, 3, 4, 10];
  const b = a.map((x) => x * 10);
  const ra = pearsonSecondSkewnessOfVector(a);
  const rb = pearsonSecondSkewnessOfVector(b);
  assert.ok(Math.abs(ra.pss - rb.pss) < 1e-12);
});

test('pearsonSecondSkewnessOfVector: permutation-invariance', () => {
  const a = [1, 1, 1, 1, 100];
  const b = [100, 1, 1, 1, 1];
  const ra = pearsonSecondSkewnessOfVector(a);
  const rb = pearsonSecondSkewnessOfVector(b);
  assert.ok(Math.abs(ra.pss - rb.pss) < 1e-12);
});

test('pearsonSecondSkewnessOfVector: sign flip under reflection x -> max - x', () => {
  // Reflecting around any constant flips skew direction.
  const a = [1, 1, 1, 1, 100];
  const M = 200;
  const b = a.map((x) => M - x);
  const ra = pearsonSecondSkewnessOfVector(a);
  const rb = pearsonSecondSkewnessOfVector(b);
  assert.ok(ra.pss > 0);
  assert.ok(rb.pss < 0);
  // |pss| is preserved under reflection (mean shifts by M, median
  // shifts by M, stddev unchanged, sign flips).
  assert.ok(Math.abs(Math.abs(ra.pss) - Math.abs(rb.pss)) < 1e-12);
});

test('pearsonSecondSkewnessOfVector: rejects negative or non-finite', () => {
  assert.throws(() => pearsonSecondSkewnessOfVector([1, -1, 2]));
  assert.throws(() => pearsonSecondSkewnessOfVector([1, Number.NaN, 2]));
  assert.throws(() =>
    pearsonSecondSkewnessOfVector([1, Number.POSITIVE_INFINITY, 2]),
  );
});

// ---------------- buildDailyTokenPearsonSecondSkewness ----------------

test('buildDailyTokenPearsonSecondSkewness: empty queue', () => {
  const r = buildDailyTokenPearsonSecondSkewness([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
});

test('buildDailyTokenPearsonSecondSkewness: drops invalid hour_start', () => {
  const q = [
    ql('not-a-date', 'a', 1000),
    ql('2026-05-01T00:00:00Z', 'a', 1000),
    ql('2026-05-02T00:00:00Z', 'a', 1000),
    ql('2026-05-03T00:00:00Z', 'a', 1000),
    ql('2026-05-04T00:00:00Z', 'a', 1000),
    ql('2026-05-05T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenPearsonSecondSkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('buildDailyTokenPearsonSecondSkewness: drops non-positive tokens', () => {
  const q = [
    ql('2026-05-01T00:00:00Z', 'a', 0),
    ql('2026-05-02T00:00:00Z', 'a', -5),
    ql('2026-05-03T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenPearsonSecondSkewness(q, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
});

test('buildDailyTokenPearsonSecondSkewness: source filter', () => {
  const q = [
    ql('2026-05-01T00:00:00Z', 'a', 1000),
    ql('2026-05-01T00:00:00Z', 'b', 1000),
    ql('2026-05-02T00:00:00Z', 'a', 1000),
    ql('2026-05-02T00:00:00Z', 'b', 1000),
    ql('2026-05-03T00:00:00Z', 'a', 1000),
    ql('2026-05-03T00:00:00Z', 'b', 1000),
    ql('2026-05-04T00:00:00Z', 'a', 1000),
    ql('2026-05-04T00:00:00Z', 'b', 1000),
    ql('2026-05-05T00:00:00Z', 'a', 1000),
    ql('2026-05-05T00:00:00Z', 'b', 1000),
  ];
  const r = buildDailyTokenPearsonSecondSkewness(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('buildDailyTokenPearsonSecondSkewness: minTokens filter', () => {
  const q: QueueLine[] = [];
  for (let i = 1; i <= 5; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'small', 10));
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'big', 1000));
  }
  const r = buildDailyTokenPearsonSecondSkewness(q, {
    generatedAt: GEN,
    minTokens: 100,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('buildDailyTokenPearsonSecondSkewness: minDays filter', () => {
  const q: QueueLine[] = [];
  for (let i = 1; i <= 3; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'short', 10000));
  }
  for (let i = 1; i <= 5; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'long', 10000));
  }
  const r = buildDailyTokenPearsonSecondSkewness(q, {
    generatedAt: GEN,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('buildDailyTokenPearsonSecondSkewness: right-skewed source has positive pss and pssSign=+1', () => {
  // Source `right`: 4 small days + 1 huge day -> right tail.
  const q: QueueLine[] = [];
  for (let i = 1; i <= 4; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'right', 1000));
  }
  q.push(ql('2026-05-05T00:00:00Z', 'right', 100000));
  const r = buildDailyTokenPearsonSecondSkewness(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.pss > 0);
  assert.equal(r.sources[0]!.pssSign, 1);
});

test('buildDailyTokenPearsonSecondSkewness: left-skewed source has negative pss and pssSign=-1', () => {
  const q: QueueLine[] = [];
  q.push(ql('2026-05-01T00:00:00Z', 'left', 1000));
  for (let i = 2; i <= 5; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'left', 100000));
  }
  const r = buildDailyTokenPearsonSecondSkewness(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.ok(r.sources[0]!.pss < 0);
  assert.equal(r.sources[0]!.pssSign, -1);
});

test('buildDailyTokenPearsonSecondSkewness: constant source -> degenerate, pss=0', () => {
  const q: QueueLine[] = [];
  for (let i = 1; i <= 5; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'flat', 1000));
  }
  const r = buildDailyTokenPearsonSecondSkewness(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.degenerate, true);
  assert.equal(r.sources[0]!.pss, 0);
  assert.equal(r.sources[0]!.pssSign, 0);
  assert.equal(r.sources[0]!.stddevDaily, 0);
});

test('buildDailyTokenPearsonSecondSkewness: top cap drops surplus rows', () => {
  const q: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    for (let i = 1; i <= 5; i += 1) {
      q.push(
        ql(`2026-05-0${i}T00:00:00Z`, s, s === 'a' ? 1000 + i * 5000 : 1000),
      );
    }
  }
  const r = buildDailyTokenPearsonSecondSkewness(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
});

test('buildDailyTokenPearsonSecondSkewness: sort by absPss puts loudest skew first', () => {
  const q: QueueLine[] = [];
  // Source `loud`: huge skew
  for (let i = 1; i <= 4; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'loud', 1000));
  }
  q.push(ql('2026-05-05T00:00:00Z', 'loud', 1000000));
  // Source `quiet`: symmetric
  q.push(ql('2026-05-01T00:00:00Z', 'quiet', 1000));
  q.push(ql('2026-05-02T00:00:00Z', 'quiet', 2000));
  q.push(ql('2026-05-03T00:00:00Z', 'quiet', 3000));
  q.push(ql('2026-05-04T00:00:00Z', 'quiet', 4000));
  q.push(ql('2026-05-05T00:00:00Z', 'quiet', 5000));
  const r = buildDailyTokenPearsonSecondSkewness(q, {
    generatedAt: GEN,
    sort: 'absPss',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'loud');
  assert.ok(Math.abs(r.sources[0]!.pss) > Math.abs(r.sources[1]!.pss));
});

test('buildDailyTokenPearsonSecondSkewness: sort by pss puts most negative first', () => {
  const q: QueueLine[] = [];
  for (let i = 1; i <= 4; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'pos', 1000));
  }
  q.push(ql('2026-05-05T00:00:00Z', 'pos', 1000000));
  q.push(ql('2026-05-01T00:00:00Z', 'neg', 1000));
  for (let i = 2; i <= 5; i += 1) {
    q.push(ql(`2026-05-0${i}T00:00:00Z`, 'neg', 1000000));
  }
  const r = buildDailyTokenPearsonSecondSkewness(q, {
    generatedAt: GEN,
    sort: 'pss',
  });
  assert.equal(r.sources[0]!.source, 'neg');
  assert.ok(r.sources[0]!.pss < 0);
});

test('buildDailyTokenPearsonSecondSkewness: invalid sort key throws', () => {
  assert.throws(() =>
    buildDailyTokenPearsonSecondSkewness([], {
      generatedAt: GEN,
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
});

test('buildDailyTokenPearsonSecondSkewness: invalid minDays throws', () => {
  assert.throws(() =>
    buildDailyTokenPearsonSecondSkewness([], { generatedAt: GEN, minDays: 1 }),
  );
});

test('buildDailyTokenPearsonSecondSkewness: invalid since throws', () => {
  assert.throws(() =>
    buildDailyTokenPearsonSecondSkewness([], {
      generatedAt: GEN,
      since: 'bogus',
    }),
  );
});

test('buildDailyTokenPearsonSecondSkewness: scale-invariance per source', () => {
  const q1: QueueLine[] = [];
  const q2: QueueLine[] = [];
  const days = ['01', '02', '03', '04', '05'];
  const vs = [1000, 1500, 1100, 1200, 50000];
  for (let i = 0; i < days.length; i += 1) {
    q1.push(ql(`2026-05-${days[i]}T00:00:00Z`, 's', vs[i]!));
    q2.push(ql(`2026-05-${days[i]}T00:00:00Z`, 's', vs[i]! * 7));
  }
  const r1 = buildDailyTokenPearsonSecondSkewness(q1, { generatedAt: GEN });
  const r2 = buildDailyTokenPearsonSecondSkewness(q2, { generatedAt: GEN });
  assert.ok(
    Math.abs(r1.sources[0]!.pss - r2.sources[0]!.pss) < 1e-9,
    `expected scale-invariance, got ${r1.sources[0]!.pss} vs ${r2.sources[0]!.pss}`,
  );
});
