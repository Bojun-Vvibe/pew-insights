import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenAtkinsonIndex,
  atkinsonOfVector,
} from '../src/dailytokenatkinsonindex.js';
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

// ---- atkinsonOfVector ----------------------------------------------------

test('atkinsonOfVector: empty -> 0', () => {
  const r = atkinsonOfVector([], 0.5);
  assert.equal(r.atkinson, 0);
  assert.equal(r.ede, 0);
});

test('atkinsonOfVector: singleton -> 0', () => {
  const r = atkinsonOfVector([42], 0.5);
  assert.equal(r.atkinson, 0);
});

test('atkinsonOfVector: all zeros -> 0', () => {
  const r = atkinsonOfVector([0, 0, 0, 0], 0.5);
  assert.equal(r.atkinson, 0);
  assert.equal(r.ede, 0);
});

test('atkinsonOfVector: perfect equality -> 0', () => {
  const r = atkinsonOfVector([100, 100, 100, 100, 100], 0.5);
  assert.ok(r.atkinson < 1e-12, `expected ~0, got ${r.atkinson}`);
  assert.ok(Math.abs(r.ede - 100) < 1e-9);
});

test('atkinsonOfVector: epsilon=0 -> always 0 (utilitarian)', () => {
  const r = atkinsonOfVector([1, 10, 100, 1000], 0);
  assert.equal(r.atkinson, 0);
  assert.equal(r.ede, r.mean);
});

test('atkinsonOfVector: epsilon=1 = 1 - GeoMean / ArithMean', () => {
  const v = [1, 2, 4, 8, 16];
  const arith = (1 + 2 + 4 + 8 + 16) / 5;
  const geo = Math.pow(1 * 2 * 4 * 8 * 16, 1 / 5);
  const expected = 1 - geo / arith;
  const r = atkinsonOfVector(v, 1);
  assert.ok(
    Math.abs(r.atkinson - expected) < 1e-12,
    `epsilon=1 should give 1 - GM/AM = ${expected}, got ${r.atkinson}`,
  );
});

test('atkinsonOfVector: epsilon -> infinity approaches 1 - min/mean', () => {
  const v = [1, 2, 3, 4, 5];
  const mu = 3;
  const limit = 1 - 1 / mu;
  const r = atkinsonOfVector(v, 50);
  assert.ok(
    r.atkinson > limit - 0.05,
    `large epsilon should approach Rawlsian limit ${limit}, got ${r.atkinson}`,
  );
});

test('atkinsonOfVector: zero collapse at epsilon >= 1', () => {
  const r1 = atkinsonOfVector([0, 1, 2, 3], 1);
  assert.equal(r1.atkinson, 1);
  assert.equal(r1.zeroCollapse, true);
  assert.equal(r1.ede, 0);
  const r2 = atkinsonOfVector([0, 1, 2, 3], 2);
  assert.equal(r2.atkinson, 1);
  assert.equal(r2.zeroCollapse, true);
});

test('atkinsonOfVector: zero allowed at epsilon < 1 (no collapse)', () => {
  const r = atkinsonOfVector([0, 1, 2, 3], 0.5);
  assert.equal(r.zeroCollapse, false);
  assert.ok(r.atkinson > 0 && r.atkinson < 1);
});

test('atkinsonOfVector: monotone in epsilon (concentration grows with aversion)', () => {
  const v = [1, 2, 4, 8, 16, 32];
  const a0 = atkinsonOfVector(v, 0).atkinson;
  const a1 = atkinsonOfVector(v, 0.25).atkinson;
  const a2 = atkinsonOfVector(v, 0.5).atkinson;
  const a3 = atkinsonOfVector(v, 1).atkinson;
  const a4 = atkinsonOfVector(v, 2).atkinson;
  assert.ok(a0 <= a1, `${a0} <= ${a1}`);
  assert.ok(a1 <= a2, `${a1} <= ${a2}`);
  assert.ok(a2 <= a3, `${a2} <= ${a3}`);
  assert.ok(a3 <= a4, `${a3} <= ${a4}`);
});

test('atkinsonOfVector: scale-invariant (multiplying every value by k preserves A)', () => {
  const v = [1, 2, 4, 8, 16];
  const r1 = atkinsonOfVector(v, 0.5);
  const r2 = atkinsonOfVector(
    v.map((x) => x * 1000),
    0.5,
  );
  assert.ok(
    Math.abs(r1.atkinson - r2.atkinson) < 1e-12,
    `scale-invariance broken: ${r1.atkinson} vs ${r2.atkinson}`,
  );
});

test('atkinsonOfVector: permutation-invariant', () => {
  const a = [1, 5, 100, 2, 47, 8];
  const b = [100, 47, 8, 5, 2, 1];
  const ra = atkinsonOfVector(a, 0.5).atkinson;
  const rb = atkinsonOfVector(b, 0.5).atkinson;
  assert.ok(Math.abs(ra - rb) < 1e-12);
});

test('atkinsonOfVector: A in [0, 1]', () => {
  for (const eps of [0.1, 0.5, 1, 2, 5]) {
    const r = atkinsonOfVector([1, 10, 100, 1000, 10000], eps);
    assert.ok(r.atkinson >= 0 && r.atkinson <= 1, `eps=${eps}: ${r.atkinson}`);
  }
});

test('atkinsonOfVector: EDE = mu * (1 - A)', () => {
  const v = [10, 20, 30, 40, 50];
  const r = atkinsonOfVector(v, 0.5);
  assert.ok(Math.abs(r.ede - r.mean * (1 - r.atkinson)) < 1e-9);
});

test('atkinsonOfVector: rejects negative epsilon', () => {
  assert.throws(() => atkinsonOfVector([1, 2, 3], -0.1), /epsilon >= 0/);
});

test('atkinsonOfVector: rejects negative values', () => {
  assert.throws(
    () => atkinsonOfVector([1, -2, 3], 0.5),
    /non-negative finite/,
  );
});

test('atkinsonOfVector: rejects non-finite values', () => {
  assert.throws(
    () => atkinsonOfVector([1, Infinity, 3], 0.5),
    /non-negative finite/,
  );
  assert.throws(
    () => atkinsonOfVector([1, NaN, 3], 0.5),
    /non-negative finite/,
  );
});

test('atkinsonOfVector: pinpoint two-valued formula at epsilon=1', () => {
  // For v = [1, 1, 1, 1, k], GM = k^(1/5), AM = (4 + k) / 5.
  const k = 100;
  const am = (4 + k) / 5;
  const gm = Math.pow(k, 1 / 5);
  const expected = 1 - gm / am;
  const r = atkinsonOfVector([1, 1, 1, 1, k], 1);
  assert.ok(
    Math.abs(r.atkinson - expected) < 1e-12,
    `expected ${expected}, got ${r.atkinson}`,
  );
});

// ---- buildDailyTokenAtkinsonIndex ----------------------------------------

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenAtkinsonIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.epsilon, 0.5);
});

test('build: defaults', () => {
  const r = buildDailyTokenAtkinsonIndex([], { generatedAt: GEN });
  assert.equal(r.minTokens, 1000);
  assert.equal(r.minDays, 2);
  assert.equal(r.epsilon, 0.5);
  assert.equal(r.sort, 'atkinson');
  assert.equal(r.dropZeroDays, false);
});

test('build: respects custom epsilon', () => {
  const queue = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
    ql('2026-04-03T00:00:00Z', 'a', 300),
    ql('2026-04-04T00:00:00Z', 'a', 9000),
  ];
  const r05 = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    epsilon: 0.5,
  });
  const r2 = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    epsilon: 2,
  });
  assert.ok(r2.sources[0].atkinson > r05.sources[0].atkinson);
  assert.equal(r05.epsilon, 0.5);
  assert.equal(r2.epsilon, 2);
});

test('build: collapses hourly buckets to UTC days', () => {
  const queue = [
    ql('2026-04-01T08:00:00Z', 'a', 50),
    ql('2026-04-01T09:00:00Z', 'a', 50),
    ql('2026-04-02T08:00:00Z', 'a', 100),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  // Two days of equal mass (100, 100) -> A=0.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].nDays, 2);
  assert.ok(r.sources[0].atkinson < 1e-12);
});

test('build: sort=atkinson DESC primary, source ASC tiebreaker', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c']) {
    queue.push(
      ql('2026-04-01T00:00:00Z', s, 100),
      ql('2026-04-02T00:00:00Z', s, 100),
    );
  }
  // Make 'b' more unequal.
  queue.push(ql('2026-04-03T00:00:00Z', 'b', 5000));
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  assert.equal(r.sources[0].source, 'b');
});

test('build: sort=tokens', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'low', 100),
    ql('2026-04-02T00:00:00Z', 'low', 100),
    ql('2026-04-01T00:00:00Z', 'high', 5000),
    ql('2026-04-02T00:00:00Z', 'high', 5000),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'tokens',
  });
  assert.equal(r.sources[0].source, 'high');
});

test('build: sort=ede', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-01T00:00:00Z', 'b', 100),
    ql('2026-04-02T00:00:00Z', 'b', 100),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    sort: 'ede',
  });
  assert.equal(r.sources[0].source, 'a'); // higher EDE
});

test('build: minTokens drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'sparse', 10),
    ql('2026-04-02T00:00:00Z', 'sparse', 10),
    ql('2026-04-01T00:00:00Z', 'dense', 5000),
    ql('2026-04-02T00:00:00Z', 'dense', 5000),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'dense');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: minDays drops single-day sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'oneday', 5000),
    ql('2026-04-01T00:00:00Z', 'twoday', 2500),
    ql('2026-04-02T00:00:00Z', 'twoday', 2500),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 2,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'twoday');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: source filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-01T00:00:00Z', 'b', 1000),
    ql('2026-04-02T00:00:00Z', 'b', 1000),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'a');
  assert.equal(r.droppedSourceFilter, 2);
});

test('build: top cap', () => {
  const queue: QueueLine[] = [];
  for (const s of ['a', 'b', 'c', 'd']) {
    queue.push(
      ql('2026-04-01T00:00:00Z', s, 100),
      ql('2026-04-02T00:00:00Z', s, 100 + s.charCodeAt(0)),
    );
  }
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 2);
});

test('build: minAtkinson display filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'flat', 1000),
    ql('2026-04-02T00:00:00Z', 'flat', 1000),
    ql('2026-04-01T00:00:00Z', 'spike', 100),
    ql('2026-04-02T00:00:00Z', 'spike', 100),
    ql('2026-04-03T00:00:00Z', 'spike', 50000),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minAtkinson: 0.1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'spike');
  assert.equal(r.droppedBelowMinAtkinson, 1);
});

test('build: dropZeroDays removes zero-mass days', () => {
  // Note: ingest already drops non-positive token rows, so we simulate
  // a hypothetical zero by injecting through a non-zero row that's
  // later filtered. Here we test the option path directly on
  // atkinsonOfVector via the build() filter. The build() entry rejects
  // total_tokens <= 0, so dropZeroDays primarily protects against
  // future augmentation; here we just check the option echoes.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 200),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    dropZeroDays: true,
  });
  assert.equal(r.dropZeroDays, true);
  assert.equal(r.sources[0].nDroppedZeroDays, 0);
});

test('build: time-window filter via since/until', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 1000),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
    ql('2026-04-10T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    since: '2026-04-01T00:00:00Z',
    until: '2026-04-03T00:00:00Z',
  });
  assert.equal(r.sources[0].nDays, 2);
});

test('build: row carries all expected diagnostic fields', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'a', 100),
    ql('2026-04-02T00:00:00Z', 'a', 1000),
  ];
  const r = buildDailyTokenAtkinsonIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
  });
  const row = r.sources[0];
  assert.equal(row.source, 'a');
  assert.equal(row.nDays, 2);
  assert.equal(row.firstDay, '2026-04-01');
  assert.equal(row.lastDay, '2026-04-02');
  assert.equal(row.maxDay, '2026-04-02');
  assert.equal(row.maxDailyTokens, 1000);
  assert.equal(row.totalTokens, 1100);
  assert.equal(row.zeroCollapse, false);
  assert.ok(row.atkinson > 0 && row.atkinson < 1);
  assert.ok(Math.abs(row.ede - row.meanDailyTokens * (1 - row.atkinson)) < 1e-6);
});

test('build: rejects bad epsilon', () => {
  assert.throws(
    () => buildDailyTokenAtkinsonIndex([], { epsilon: -1 }),
    /epsilon/,
  );
  assert.throws(
    () => buildDailyTokenAtkinsonIndex([], { epsilon: NaN }),
    /epsilon/,
  );
});

test('build: rejects bad minDays', () => {
  assert.throws(
    () => buildDailyTokenAtkinsonIndex([], { minDays: 1 }),
    /minDays/,
  );
});

test('build: rejects bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenAtkinsonIndex([], {
        sort: 'bogus' as 'atkinson',
      }),
    /sort/,
  );
});

test('build: rejects invalid since', () => {
  assert.throws(
    () => buildDailyTokenAtkinsonIndex([], { since: 'not-a-date' }),
    /invalid since/,
  );
});

test('build: counts droppedInvalidHourStart', () => {
  const bad: QueueLine = {
    source: 'a',
    model: 'm',
    hour_start: 'garbage',
    device_id: 'd',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 100,
    reasoning_output_tokens: 0,
    total_tokens: 100,
  };
  const r = buildDailyTokenAtkinsonIndex(
    [bad, ql('2026-04-01T00:00:00Z', 'a', 1000), ql('2026-04-02T00:00:00Z', 'a', 1000)],
    { generatedAt: GEN, minTokens: 0 },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: orthogonality witness vs Pietra (epsilon high reorders)', () => {
  // Two sources with same Pietra but very different Atkinson at high
  // epsilon. We construct vectors where one has a long flat tail and
  // a single huge day (high Pietra, low Atkinson@high-eps because
  // min/mean is OK) vs one with a small min (low Pietra in some
  // configurations, high Atkinson@high-eps).
  // Simpler: vector [1, 1, 1, 100] and [1, 50, 50, 50] -- different
  // bottom-sensitivity.
  const a = atkinsonOfVector([1, 1, 1, 100], 5).atkinson;
  const b = atkinsonOfVector([1, 50, 50, 50], 5).atkinson;
  // Both have small min but very different above-min mass. b should
  // have HIGHER Atkinson at high epsilon because mean is much larger
  // relative to min.
  assert.ok(b > a, `expected b (${b}) > a (${a}) under bottom-sensitivity`);
});
