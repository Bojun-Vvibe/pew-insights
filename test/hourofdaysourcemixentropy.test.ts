import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildHourOfDaySourceMixEntropy } from '../src/hourofdaysourcemixentropy.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source,
    model: opts.model ?? 'm1',
    hour_start,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? Math.floor(total_tokens / 2),
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? Math.floor(total_tokens / 2),
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('hour-of-day-source-mix-entropy: empty input → zero rows', () => {
  const r = buildHourOfDaySourceMixEntropy([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.equal(r.occupiedHours, 0);
  assert.equal(r.hours.length, 0);
  assert.equal(r.weightedMeanEntropyBits, 0);
  assert.equal(r.weightedMeanNormalizedEntropy, 0);
  assert.equal(r.monoSourceHourCount, 0);
});

test('hour-of-day-source-mix-entropy: rejects bad minTokens', () => {
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { minTokens: -1 }));
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { minTokens: Number.NaN }));
});

test('hour-of-day-source-mix-entropy: rejects bad since/until', () => {
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { since: 'not-iso' }));
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { until: 'not-iso' }));
});

test('hour-of-day-source-mix-entropy: rejects bad filterSources', () => {
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { filterSources: [] }));
  assert.throws(() =>
    buildHourOfDaySourceMixEntropy([], { filterSources: [''] as string[] }),
  );
});

test('hour-of-day-source-mix-entropy: rejects bad topK', () => {
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { topK: 0 }));
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { topK: -1 }));
  assert.throws(() => buildHourOfDaySourceMixEntropy([], { topK: 1.5 }));
});

test('hour-of-day-source-mix-entropy: topK keeps highest-entropy hours and re-sorts by H desc', () => {
  // Hour 9: mono (entropy 0).
  // Hour 10: 4-way even (entropy 2).
  // Hour 11: 2-way even (entropy 1).
  // Hour 12: 3-way even (entropy log2(3) ≈ 1.585).
  const queue = [
    ql('2026-04-20T09:00:00Z', 'a', 100),
    ql('2026-04-20T10:00:00Z', 'a', 25),
    ql('2026-04-20T10:00:00Z', 'b', 25),
    ql('2026-04-20T10:00:00Z', 'c', 25),
    ql('2026-04-20T10:00:00Z', 'd', 25),
    ql('2026-04-20T11:00:00Z', 'a', 50),
    ql('2026-04-20T11:00:00Z', 'b', 50),
    ql('2026-04-20T12:00:00Z', 'a', 33),
    ql('2026-04-20T12:00:00Z', 'b', 33),
    ql('2026-04-20T12:00:00Z', 'c', 33),
  ];
  const r = buildHourOfDaySourceMixEntropy(queue, { topK: 2, generatedAt: GEN });
  assert.equal(r.topK, 2);
  assert.equal(r.hours.length, 2);
  // Sorted by entropy desc: hour 10 (H=2), hour 12 (H≈1.585).
  assert.equal(r.hours[0]!.hour, 10);
  assert.equal(r.hours[1]!.hour, 12);
  assert.equal(r.droppedBelowTopK, 2);
});

test('hour-of-day-source-mix-entropy: topK does not change global rollup (computed on full kept set)', () => {
  const queue = [
    ql('2026-04-20T09:00:00Z', 'a', 100),
    ql('2026-04-20T10:00:00Z', 'a', 50),
    ql('2026-04-20T10:00:00Z', 'b', 50),
    ql('2026-04-20T11:00:00Z', 'a', 50),
    ql('2026-04-20T11:00:00Z', 'b', 50),
  ];
  const noCap = buildHourOfDaySourceMixEntropy(queue, { generatedAt: GEN });
  const capped = buildHourOfDaySourceMixEntropy(queue, { topK: 1, generatedAt: GEN });
  assert.equal(noCap.weightedMeanEntropyBits, capped.weightedMeanEntropyBits);
  assert.equal(noCap.monoSourceHourCount, capped.monoSourceHourCount);
  assert.equal(noCap.totalTokens, capped.totalTokens);
  assert.equal(capped.hours.length, 1);
  assert.equal(capped.droppedBelowTopK, 2);
});

test('hour-of-day-source-mix-entropy: topK >= kept count does not drop anything', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T09:00:00Z', 'a', 100),
      ql('2026-04-20T10:00:00Z', 'b', 100),
    ],
    { topK: 99, generatedAt: GEN },
  );
  assert.equal(r.hours.length, 2);
  assert.equal(r.droppedBelowTopK, 0);
});

test('hour-of-day-source-mix-entropy: topK applies after minTokens floor', () => {
  const queue = [
    ql('2026-04-20T08:00:00Z', 'a', 5), // dropped by minTokens
    ql('2026-04-20T09:00:00Z', 'a', 100), // mono, H=0
    ql('2026-04-20T10:00:00Z', 'a', 50), // 2-way, H=1
    ql('2026-04-20T10:00:00Z', 'b', 50),
  ];
  const r = buildHourOfDaySourceMixEntropy(queue, {
    minTokens: 50,
    topK: 1,
    generatedAt: GEN,
  });
  assert.equal(r.droppedSparseHours, 1);
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.hour, 10);
  assert.equal(r.droppedBelowTopK, 1);
});

test('hour-of-day-source-mix-entropy: single-source hour → entropy 0, mono', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [ql('2026-04-20T09:00:00Z', 'a', 100), ql('2026-04-21T09:00:00Z', 'a', 200)],
    { generatedAt: GEN },
  );
  assert.equal(r.hours.length, 1);
  const h = r.hours[0]!;
  assert.equal(h.hour, 9);
  assert.equal(h.totalTokens, 300);
  assert.equal(h.sourceCount, 1);
  assert.equal(h.entropyBits, 0);
  assert.equal(h.normalizedEntropy, 0);
  assert.equal(h.effectiveSources, 1);
  assert.equal(h.topSource, 'a');
  assert.equal(h.topSourceShare, 1);
  assert.equal(r.monoSourceHourCount, 1);
});

test('hour-of-day-source-mix-entropy: even 2-source split → entropy = 1 bit, normalized = 1', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [ql('2026-04-20T10:00:00Z', 'a', 50), ql('2026-04-20T10:30:00Z', 'b', 50)],
    { generatedAt: GEN },
  );
  assert.equal(r.hours.length, 1);
  const h = r.hours[0]!;
  assert.equal(h.sourceCount, 2);
  assert.ok(Math.abs(h.entropyBits - 1) < 1e-9);
  assert.equal(h.maxEntropyBits, 1);
  assert.ok(Math.abs(h.normalizedEntropy - 1) < 1e-9);
  assert.ok(Math.abs(h.effectiveSources - 2) < 1e-9);
  assert.equal(h.topSourceShare, 0.5);
  assert.equal(r.monoSourceHourCount, 0);
});

test('hour-of-day-source-mix-entropy: bins by UTC hour-of-day not local', () => {
  // Same UTC hour 14:xx across different days collapse to one row.
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T14:05:00Z', 'a', 10),
      ql('2026-04-21T14:50:00Z', 'b', 30),
      ql('2026-04-22T03:00:00Z', 'a', 5),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.hours.length, 2);
  const h14 = r.hours.find((h) => h.hour === 14)!;
  assert.equal(h14.totalTokens, 40);
  assert.equal(h14.sourceCount, 2);
  assert.equal(h14.topSource, 'b');
  const h3 = r.hours.find((h) => h.hour === 3)!;
  assert.equal(h3.sourceCount, 1);
});

test('hour-of-day-source-mix-entropy: drops invalid hour_start and zero tokens', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('not-iso', 'a', 100),
      ql('2026-04-20T10:00:00Z', 'a', 0),
      ql('2026-04-20T10:00:00Z', 'a', -5),
      ql('2026-04-20T11:00:00Z', 'a', 50),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.hour, 11);
});

test('hour-of-day-source-mix-entropy: window since/until filters hour_start before bucketing', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-19T08:00:00Z', 'a', 100),
      ql('2026-04-20T08:00:00Z', 'b', 100),
      ql('2026-04-21T08:00:00Z', 'a', 100),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.totalTokens, 100);
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.topSource, 'b');
});

test('hour-of-day-source-mix-entropy: minTokens hides sparse hours and counts them', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T05:00:00Z', 'a', 5),
      ql('2026-04-20T10:00:00Z', 'a', 50),
      ql('2026-04-20T10:00:00Z', 'b', 50),
    ],
    { minTokens: 100, generatedAt: GEN },
  );
  // Two occupied hours total; 05 has 5 tokens (dropped), 10 has 100 (kept).
  assert.equal(r.occupiedHours, 2);
  assert.equal(r.hours.length, 1);
  assert.equal(r.hours[0]!.hour, 10);
  assert.equal(r.droppedSparseHours, 1);
});

test('hour-of-day-source-mix-entropy: token-weighted mean weights bigger hours more', () => {
  // Hour 9: pure mono-source (entropy 0), 1000 tokens.
  // Hour 10: even 2-source split (entropy 1), 100 tokens.
  // Token-weighted mean entropy = (0*1000 + 1*100)/1100 = ~0.0909.
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T09:00:00Z', 'a', 1000),
      ql('2026-04-20T10:00:00Z', 'a', 50),
      ql('2026-04-20T10:00:00Z', 'b', 50),
    ],
    { generatedAt: GEN },
  );
  assert.ok(Math.abs(r.weightedMeanEntropyBits - 100 / 1100) < 1e-9);
  assert.equal(r.monoSourceHourCount, 1);
});

test('hour-of-day-source-mix-entropy: filterSources collapses multi-source hour to mono', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T10:00:00Z', 'a', 50),
      ql('2026-04-20T10:00:00Z', 'b', 50),
      ql('2026-04-20T10:00:00Z', 'c', 50),
    ],
    { filterSources: ['a', 'b'], generatedAt: GEN },
  );
  assert.deepEqual(r.filterSources, ['a', 'b']);
  assert.equal(r.droppedByFilterSource, 1);
  assert.equal(r.hours.length, 1);
  const h = r.hours[0]!;
  assert.equal(h.sourceCount, 2);
  assert.ok(Math.abs(h.entropyBits - 1) < 1e-9);
});

test('hour-of-day-source-mix-entropy: sources with empty source string fold to "unknown"', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T07:00:00Z', '', 100),
      ql('2026-04-20T07:00:00Z', 'a', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.hours.length, 1);
  const h = r.hours[0]!;
  assert.equal(h.sourceCount, 2);
  // 'a' and 'unknown' are tied at 100 each → top picked by name asc.
  assert.equal(h.topSource, 'a');
});

test('hour-of-day-source-mix-entropy: rows sorted by hour ascending', () => {
  const r = buildHourOfDaySourceMixEntropy(
    [
      ql('2026-04-20T15:00:00Z', 'a', 10),
      ql('2026-04-20T03:00:00Z', 'a', 10),
      ql('2026-04-20T22:00:00Z', 'a', 10),
      ql('2026-04-20T00:00:00Z', 'a', 10),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.hours.map((h) => h.hour),
    [0, 3, 15, 22],
  );
});

// integration: full end-to-end through realistic fixture
test('hour-of-day-source-mix-entropy integration: realistic mixed dataset', () => {
  const queue: QueueLine[] = [];
  // Hour 9: opencode-monoplied, big.
  for (let d = 0; d < 5; d++) {
    queue.push(ql(`2026-04-${String(15 + d).padStart(2, '0')}T09:00:00Z`, 'opencode', 5000));
  }
  // Hour 14: even 4-way split, smaller.
  for (const s of ['opencode', 'codex', 'claude-code', 'openclaw']) {
    queue.push(ql('2026-04-15T14:00:00Z', s, 250));
  }
  // Hour 21: 3-way 70/20/10.
  queue.push(ql('2026-04-15T21:00:00Z', 'opencode', 700));
  queue.push(ql('2026-04-15T21:00:00Z', 'codex', 200));
  queue.push(ql('2026-04-15T21:00:00Z', 'openclaw', 100));

  const r = buildHourOfDaySourceMixEntropy(queue, { generatedAt: GEN });
  assert.equal(r.hours.length, 3);
  assert.equal(r.totalTokens, 25000 + 1000 + 1000);

  const h9 = r.hours.find((h) => h.hour === 9)!;
  assert.equal(h9.sourceCount, 1);
  assert.equal(h9.entropyBits, 0);

  const h14 = r.hours.find((h) => h.hour === 14)!;
  assert.equal(h14.sourceCount, 4);
  // Even 4-way split → entropy = log2(4) = 2.
  assert.ok(Math.abs(h14.entropyBits - 2) < 1e-9);
  assert.ok(Math.abs(h14.maxEntropyBits - 2) < 1e-9);
  assert.ok(Math.abs(h14.normalizedEntropy - 1) < 1e-9);

  const h21 = r.hours.find((h) => h.hour === 21)!;
  assert.equal(h21.sourceCount, 3);
  assert.ok(h21.entropyBits > 0 && h21.entropyBits < Math.log2(3));
  assert.equal(h21.topSource, 'opencode');
  assert.ok(Math.abs(h21.topSourceShare - 0.7) < 1e-9);

  assert.equal(r.monoSourceHourCount, 1);
  // Token-weighted mean entropy heavily pulled toward 0 by the
  // 25000-token monoplied hour.
  assert.ok(r.weightedMeanEntropyBits < 0.2);
});
