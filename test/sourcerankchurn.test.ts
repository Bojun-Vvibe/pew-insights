import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceRankChurn } from '../src/sourcerankchurn.js';
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

test('source-rank-churn: empty input → zero rows', () => {
  const r = buildSourceRankChurn([], { generatedAt: GEN });
  assert.equal(r.observedDays, 0);
  assert.equal(r.dayPairs, 0);
  assert.equal(r.keptSources, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.meanFootrule, 0);
  assert.equal(r.medianFootrule, 0);
  assert.equal(r.maxFootrule, 0);
  assert.equal(r.stableDayPairs, 0);
  assert.equal(r.chaosDayPairs, 0);
});

test('source-rank-churn: rejects bad minDays', () => {
  assert.throws(() => buildSourceRankChurn([], { minDays: 0 }));
  assert.throws(() => buildSourceRankChurn([], { minDays: -1 }));
  assert.throws(() => buildSourceRankChurn([], { minDays: 1.5 }));
  assert.throws(() => buildSourceRankChurn([], { minDays: Number.NaN }));
});

test('source-rank-churn: rejects bad topK', () => {
  assert.throws(() => buildSourceRankChurn([], { topK: 0 }));
  assert.throws(() => buildSourceRankChurn([], { topK: -2 }));
  assert.throws(() => buildSourceRankChurn([], { topK: 1.5 }));
});

test('source-rank-churn: rejects bad since/until', () => {
  assert.throws(() => buildSourceRankChurn([], { since: 'not-iso' }));
  assert.throws(() => buildSourceRankChurn([], { until: 'not-iso' }));
});

test('source-rank-churn: drops invalid hour_start and zero tokens', () => {
  const queue: QueueLine[] = [
    ql('not-an-iso', 's1', 100),
    ql('2026-04-20T09:00:00Z', 's1', 0),
    ql('2026-04-20T09:00:00Z', 's1', -7),
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-21T09:00:00Z', 's1', 200),
  ];
  const r = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.observedDays, 2);
});

test('source-rank-churn: identical leaderboard two adjacent days → footrule 0', () => {
  // Day 1: s1=100, s2=50. Day 2: s1=200, s2=80. Both days same rank order.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-21T09:00:00Z', 's1', 200),
    ql('2026-04-21T10:00:00Z', 's2', 80),
  ];
  const r = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(r.dayPairs, 1);
  assert.equal(r.meanFootrule, 0);
  assert.equal(r.medianFootrule, 0);
  assert.equal(r.maxFootrule, 0);
  assert.equal(r.stableDayPairs, 1);
  assert.equal(r.chaosDayPairs, 0);
});

test('source-rank-churn: full reversal two adjacent days → footrule 1', () => {
  // Day 1: s1>s2. Day 2: s2>s1.  union n=2, raw = |1-2|+|2-1| = 2,
  // denom = floor(2*2/2) = 2  → 1.0
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-21T09:00:00Z', 's1', 50),
    ql('2026-04-21T10:00:00Z', 's2', 200),
  ];
  const r = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(r.dayPairs, 1);
  assert.equal(r.meanFootrule, 1);
  assert.equal(r.medianFootrule, 1);
  assert.equal(r.maxFootrule, 1);
  assert.equal(r.stableDayPairs, 0);
  assert.equal(r.chaosDayPairs, 1);
});

test('source-rank-churn: non-adjacent days are skipped (no day-pair)', () => {
  // Day 1 and Day 3 — no Day 2 in the corpus, so no adjacent pair.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-22T09:00:00Z', 's1', 100),
    ql('2026-04-22T10:00:00Z', 's2', 50),
  ];
  const r = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(r.observedDays, 2);
  assert.equal(r.dayPairs, 0);
  assert.equal(r.meanFootrule, 0);
});

test('source-rank-churn: per-source rank stats over multiple days', () => {
  // Three days, two sources, identical order each day. s1 always rank 1.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-21T09:00:00Z', 's1', 100),
    ql('2026-04-21T10:00:00Z', 's2', 50),
    ql('2026-04-22T09:00:00Z', 's1', 100),
    ql('2026-04-22T10:00:00Z', 's2', 50),
  ];
  const r = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(r.consideredDays, 3);
  assert.equal(r.dayPairs, 2);
  assert.equal(r.stableDayPairs, 2);
  const s1 = r.sources.find((s) => s.source === 's1')!;
  const s2 = r.sources.find((s) => s.source === 's2')!;
  assert.equal(s1.daysObserved, 3);
  assert.equal(s1.meanRank, 1);
  assert.equal(s1.stddevRank, 0);
  assert.equal(s1.bestRank, 1);
  assert.equal(s1.worstRank, 1);
  assert.equal(s1.distinctRanks, 1);
  assert.equal(s2.meanRank, 2);
  assert.equal(s2.distinctRanks, 1);
  // sorted by meanRank asc: s1 first, s2 second.
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.sources[1]!.source, 's2');
});

test('source-rank-churn: minDays filter drops sparse sources', () => {
  // s1 appears on 2 days; s2 only on day 1. minDays=2 should drop s2.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 999),
    ql('2026-04-21T09:00:00Z', 's1', 200),
  ];
  const r = buildSourceRankChurn(queue, { minDays: 2, generatedAt: GEN });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.keptSources, 1);
  assert.equal(r.sources[0]!.source, 's1');
});

test('source-rank-churn: topK caps sources[] but rollup unchanged', () => {
  // Three sources, two adjacent days. topK=1 should hide two rows
  // but the day-pair footrule is computed on the full set first.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 300),
    ql('2026-04-20T10:00:00Z', 's2', 200),
    ql('2026-04-20T11:00:00Z', 's3', 100),
    ql('2026-04-21T09:00:00Z', 's1', 300),
    ql('2026-04-21T10:00:00Z', 's2', 200),
    ql('2026-04-21T11:00:00Z', 's3', 100),
  ];
  const noCap = buildSourceRankChurn(queue, { generatedAt: GEN });
  const capped = buildSourceRankChurn(queue, { topK: 1, generatedAt: GEN });
  assert.equal(capped.sources.length, 1);
  assert.equal(capped.droppedBelowTopK, 2);
  assert.equal(capped.dayPairs, noCap.dayPairs);
  assert.equal(capped.meanFootrule, noCap.meanFootrule);
  assert.equal(capped.medianFootrule, noCap.medianFootrule);
  assert.equal(capped.stableDayPairs, noCap.stableDayPairs);
  assert.equal(capped.keptSources, noCap.keptSources);
});

test('source-rank-churn: union with absent sources counts as worst-slot+1', () => {
  // Day 1: s1=100, s2=50.   ranks: s1=1, s2=2.
  // Day 2: s1=100, s3=50.   ranks: s1=1, s3=2.
  // Union = {s1, s2, s3}, n=3, absentRank=3.
  // raw = |1-1| (s1) + |2-3| (s2: present d1=2, absent d2=3) + |3-2| (s3: absent d1=3, present d2=2)
  //     = 0 + 1 + 1 = 2.  denom = floor(9/2) = 4.  → 0.5.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-21T09:00:00Z', 's1', 100),
    ql('2026-04-21T10:00:00Z', 's3', 50),
  ];
  const r = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(r.dayPairs, 1);
  assert.equal(r.meanFootrule, 0.5);
  assert.equal(r.chaosDayPairs, 1);
});

test('source-rank-churn: window filter via since/until is inclusive/exclusive', () => {
  const queue: QueueLine[] = [
    ql('2026-04-19T09:00:00Z', 's1', 100), // before since
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-22T09:00:00Z', 's1', 100), // at/after until → excluded
  ];
  const r = buildSourceRankChurn(queue, {
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-22T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(r.observedDays, 1);
  assert.equal(r.dayPairs, 0);
});

test('source-rank-churn: rejects bad minPairUnion', () => {
  assert.throws(() => buildSourceRankChurn([], { minPairUnion: 0 }));
  assert.throws(() => buildSourceRankChurn([], { minPairUnion: 1 }));
  assert.throws(() => buildSourceRankChurn([], { minPairUnion: 2.5 }));
  assert.throws(() => buildSourceRankChurn([], { minPairUnion: Number.NaN }));
});

test('source-rank-churn: minPairUnion=3 drops degenerate n=2 pairs', () => {
  // Two adjacent days, only s1 + s2 ever appear → unionSize=2.
  // Default minPairUnion=2 keeps the pair; raising to 3 drops it
  // and surfaces it as droppedBelowMinPairUnion.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 100),
    ql('2026-04-20T10:00:00Z', 's2', 50),
    ql('2026-04-21T09:00:00Z', 's1', 50),
    ql('2026-04-21T10:00:00Z', 's2', 200),
  ];
  const def = buildSourceRankChurn(queue, { generatedAt: GEN });
  assert.equal(def.dayPairs, 1);
  assert.equal(def.minPairUnion, 2);
  assert.equal(def.droppedBelowMinPairUnion, 0);
  const tight = buildSourceRankChurn(queue, { minPairUnion: 3, generatedAt: GEN });
  assert.equal(tight.dayPairs, 0);
  assert.equal(tight.droppedBelowMinPairUnion, 1);
  assert.equal(tight.meanFootrule, 0);
  assert.equal(tight.maxFootrule, 0);
});

test('source-rank-churn: minPairUnion keeps n>=floor pairs intact', () => {
  // Three sources across two adjacent days → unionSize=3.
  const queue: QueueLine[] = [
    ql('2026-04-20T09:00:00Z', 's1', 300),
    ql('2026-04-20T10:00:00Z', 's2', 200),
    ql('2026-04-20T11:00:00Z', 's3', 100),
    ql('2026-04-21T09:00:00Z', 's1', 300),
    ql('2026-04-21T10:00:00Z', 's2', 200),
    ql('2026-04-21T11:00:00Z', 's3', 100),
  ];
  const r = buildSourceRankChurn(queue, { minPairUnion: 3, generatedAt: GEN });
  assert.equal(r.dayPairs, 1);
  assert.equal(r.droppedBelowMinPairUnion, 0);
  assert.equal(r.meanFootrule, 0);
});
