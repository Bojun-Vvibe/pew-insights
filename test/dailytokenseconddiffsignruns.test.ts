import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDailyTokenSecondDiffSignRuns } from '../src/dailytokenseconddiffsignruns.js';
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

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('daily-token-second-diff-sign-runs: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { minDays: 2 }));
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { minDays: -1 }));
});

test('daily-token-second-diff-sign-runs: rejects bad top', () => {
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { top: -1 }));
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { top: 1.5 }));
});

test('daily-token-second-diff-sign-runs: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenSecondDiffSignRuns([], { sort: 'bogus' as never }),
  );
});

test('daily-token-second-diff-sign-runs: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { since: 'no' }));
  assert.throws(() => buildDailyTokenSecondDiffSignRuns([], { until: 'nope' }));
});

// ---- empty / sparse --------------------------------------------------------

test('daily-token-second-diff-sign-runs: empty input', () => {
  const r = buildDailyTokenSecondDiffSignRuns([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 3);
});

test('daily-token-second-diff-sign-runs: source with < 3 active days dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 'a', 100),
    ql('2026-04-02T10:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 0);
});

// ---- core math: a strictly-linear series has all-flat d2 -------------------

test('daily-token-second-diff-sign-runs: linear arithmetic series -> all flat', () => {
  // 10, 20, 30, 40, 50: d2 all zero
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 's', 10),
    ql('2026-04-02T10:00:00.000Z', 's', 20),
    ql('2026-04-03T10:00:00.000Z', 's', 30),
    ql('2026-04-04T10:00:00.000Z', 's', 40),
    ql('2026-04-05T10:00:00.000Z', 's', 50),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 5);
  assert.equal(row.nD2Points, 3);
  assert.equal(row.nFlat, 3);
  assert.equal(row.nConcaveUp, 0);
  assert.equal(row.nConcaveDown, 0);
  assert.equal(row.longestFlatRun, 3);
  assert.equal(row.longestConcaveUpRun, 0);
  assert.equal(row.longestConcaveDownRun, 0);
  assert.equal(row.longestRegime, 'flat');
  assert.equal(row.currentRegime, 'flat');
  assert.equal(row.currentRunLength, 3);
  assert.equal(row.totalRuns, 1);
});

// ---- core math: exponential growth -> all concaveup ------------------------

test('daily-token-second-diff-sign-runs: doubling series -> all concaveup', () => {
  // 1, 2, 4, 8, 16: d2 = 1, 2, 4 all > 0
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 's', 1),
    ql('2026-04-02T10:00:00.000Z', 's', 2),
    ql('2026-04-03T10:00:00.000Z', 's', 4),
    ql('2026-04-04T10:00:00.000Z', 's', 8),
    ql('2026-04-05T10:00:00.000Z', 's', 16),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nD2Points, 3);
  assert.equal(row.nConcaveUp, 3);
  assert.equal(row.longestConcaveUpRun, 3);
  assert.equal(row.longestRegime, 'concaveup');
  assert.equal(row.longestConcaveUpStart, '2026-04-01');
  assert.equal(row.longestConcaveUpEnd, '2026-04-05');
  assert.equal(row.currentRegime, 'concaveup');
  assert.equal(row.currentRunLength, 3);
});

// ---- core math: concave-down series ----------------------------------------

test('daily-token-second-diff-sign-runs: square-root-like series -> concavedown', () => {
  // 0, 10, 14, 17, 19: deltas 10,4,3,2; d2 = -6, -1, -1 all < 0
  // but we need positive tokens; bump each by 1 -> 1,11,15,18,20
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 's', 1),
    ql('2026-04-02T10:00:00.000Z', 's', 11),
    ql('2026-04-03T10:00:00.000Z', 's', 15),
    ql('2026-04-04T10:00:00.000Z', 's', 18),
    ql('2026-04-05T10:00:00.000Z', 's', 20),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nConcaveDown, 3);
  assert.equal(row.longestConcaveDownRun, 3);
  assert.equal(row.longestConcaveDownStart, '2026-04-01');
  assert.equal(row.longestConcaveDownEnd, '2026-04-05');
  assert.equal(row.longestRegime, 'concavedown');
  assert.equal(row.currentRegime, 'concavedown');
});

// ---- mixed regime: counts and longest run separation -----------------------

test('daily-token-second-diff-sign-runs: mixed regime, longest run isolated', () => {
  // values: 1, 2, 4, 6, 7, 7, 6
  // diffs:  1, 2, 2, 1, 0, -1
  // d2:     1, 0, -1, -1, -1
  // signs: up, flat, down, down, down
  // longestUpRun=1, longestFlatRun=1, longestDownRun=3, totalRuns=3
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 's', 1),
    ql('2026-04-02T10:00:00.000Z', 's', 2),
    ql('2026-04-03T10:00:00.000Z', 's', 4),
    ql('2026-04-04T10:00:00.000Z', 's', 6),
    ql('2026-04-05T10:00:00.000Z', 's', 7),
    ql('2026-04-06T10:00:00.000Z', 's', 7),
    ql('2026-04-07T10:00:00.000Z', 's', 6),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nD2Points, 5);
  assert.equal(row.longestConcaveUpRun, 1);
  assert.equal(row.longestFlatRun, 1);
  assert.equal(row.longestConcaveDownRun, 3);
  assert.equal(row.longestRegime, 'concavedown');
  assert.equal(row.longestRegimeRun, 3);
  assert.equal(row.totalRuns, 3);
  assert.equal(row.currentRegime, 'concavedown');
  assert.equal(row.currentRunLength, 3);
});

// ---- aggregation: multiple rows per day collapse ---------------------------

test('daily-token-second-diff-sign-runs: per-day aggregation across rows', () => {
  // Day 1: 5+5=10, Day 2: 20, Day 3: 5+25=30 -> 10,20,30 linear -> 1 flat point
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00.000Z', 's', 5),
    ql('2026-04-01T22:00:00.000Z', 's', 5),
    ql('2026-04-02T10:00:00.000Z', 's', 20),
    ql('2026-04-03T03:00:00.000Z', 's', 5),
    ql('2026-04-03T18:00:00.000Z', 's', 25),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.nD2Points, 1);
  assert.equal(row.nFlat, 1);
  assert.equal(row.longestFlatRun, 1);
  assert.equal(row.longestRegime, 'flat');
});

// ---- since/until window ----------------------------------------------------

test('daily-token-second-diff-sign-runs: since/until clip', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 's', 1),
    ql('2026-04-02T10:00:00.000Z', 's', 2),
    ql('2026-04-03T10:00:00.000Z', 's', 4),
    ql('2026-04-04T10:00:00.000Z', 's', 8),
    ql('2026-04-05T10:00:00.000Z', 's', 16),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, {
    generatedAt: GEN,
    since: '2026-04-02T00:00:00.000Z',
    until: '2026-04-05T00:00:00.000Z',
  });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3); // 02, 03, 04
  assert.equal(row.firstActiveDay, '2026-04-02');
  assert.equal(row.lastActiveDay, '2026-04-04');
});

// ---- source filter ---------------------------------------------------------

test('daily-token-second-diff-sign-runs: source filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 'a', 1),
    ql('2026-04-02T10:00:00.000Z', 'a', 2),
    ql('2026-04-03T10:00:00.000Z', 'a', 4),
    ql('2026-04-01T10:00:00.000Z', 'b', 1),
    ql('2026-04-02T10:00:00.000Z', 'b', 2),
    ql('2026-04-03T10:00:00.000Z', 'b', 4),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, {
    generatedAt: GEN,
    source: 'a',
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSourceFilter, 3);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

// ---- bad inputs (zero tokens, bad hour_start) ------------------------------

test('daily-token-second-diff-sign-runs: drops bad hour_start and zero tokens', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's', 100),
    ql('2026-04-01T10:00:00.000Z', 's', 0),
    ql('2026-04-01T10:00:00.000Z', 's', 1),
    ql('2026-04-02T10:00:00.000Z', 's', 2),
    ql('2026-04-03T10:00:00.000Z', 's', 4),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nActiveDays, 3);
});

// ---- sort & top ------------------------------------------------------------

test('daily-token-second-diff-sign-runs: sort by longest, top cap', () => {
  // a: longestRegimeRun 3 (1,2,4,8 -> all up)
  // b: longestRegimeRun 1 (1,2,3 -> 1 flat)
  // c: longestRegimeRun 2 (1,2,4,7 -> d2: 1, 1 -> 2 up)
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 'a', 1),
    ql('2026-04-02T10:00:00.000Z', 'a', 2),
    ql('2026-04-03T10:00:00.000Z', 'a', 4),
    ql('2026-04-04T10:00:00.000Z', 'a', 8),
    ql('2026-04-05T10:00:00.000Z', 'a', 16),
    ql('2026-04-01T10:00:00.000Z', 'b', 1),
    ql('2026-04-02T10:00:00.000Z', 'b', 2),
    ql('2026-04-03T10:00:00.000Z', 'b', 3),
    ql('2026-04-01T10:00:00.000Z', 'c', 1),
    ql('2026-04-02T10:00:00.000Z', 'c', 2),
    ql('2026-04-03T10:00:00.000Z', 'c', 4),
    ql('2026-04-04T10:00:00.000Z', 'c', 7),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, {
    generatedAt: GEN,
    sort: 'longest',
    top: 2,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'c');
});

test('daily-token-second-diff-sign-runs: deterministic source-asc tiebreak', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T10:00:00.000Z', 'b', 1),
    ql('2026-04-02T10:00:00.000Z', 'b', 2),
    ql('2026-04-03T10:00:00.000Z', 'b', 4),
    ql('2026-04-01T10:00:00.000Z', 'a', 1),
    ql('2026-04-02T10:00:00.000Z', 'a', 2),
    ql('2026-04-03T10:00:00.000Z', 'a', 4),
  ];
  const r = buildDailyTokenSecondDiffSignRuns(q, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});
