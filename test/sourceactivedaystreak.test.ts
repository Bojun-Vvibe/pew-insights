import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceActiveDayStreak } from '../src/sourceactivedaystreak.js';
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

test('source-active-day-streak: empty input → zero rows', () => {
  const r = buildSourceActiveDayStreak([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 1);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.densityMin, 0);
  assert.equal(r.minLongestStreak, 1);
  assert.equal(r.droppedBelowMinLongestStreak, 0);
});

test('source-active-day-streak: rejects bad opts', () => {
  assert.throws(() => buildSourceActiveDayStreak([], { minDays: 0 }));
  assert.throws(() => buildSourceActiveDayStreak([], { minDays: -1 }));
  assert.throws(() => buildSourceActiveDayStreak([], { minDays: 1.5 }));
  assert.throws(() => buildSourceActiveDayStreak([], { top: 0 }));
  assert.throws(() => buildSourceActiveDayStreak([], { top: 1.5 }));
  assert.throws(() => buildSourceActiveDayStreak([], { densityMin: -0.1 }));
  assert.throws(() => buildSourceActiveDayStreak([], { densityMin: 1.5 }));
  assert.throws(() =>
    buildSourceActiveDayStreak([], { minLongestStreak: 0 }),
  );
  assert.throws(() =>
    buildSourceActiveDayStreak([], { minLongestStreak: -3 }),
  );
  assert.throws(() =>
    buildSourceActiveDayStreak([], { minLongestStreak: 1.5 }),
  );
  assert.throws(() =>
    buildSourceActiveDayStreak([], {
      // @ts-expect-error invalid sort
      sort: 'bogus',
    }),
  );
  assert.throws(() =>
    buildSourceActiveDayStreak([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceActiveDayStreak([], { until: 'not-a-date' }),
  );
});

test('source-active-day-streak: perfect 5-day streak → density 1, longestStreak 5', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    const day = `2026-04-0${d}T08:00:00Z`;
    q.push(ql(day, 'alpha', 100));
  }
  const r = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'alpha');
  assert.equal(s.activeDays, 5);
  assert.equal(s.tenureDays, 5);
  assert.equal(s.streaks, 1);
  assert.equal(s.longestStreak, 5);
  assert.equal(s.longestStreakStart, '2026-04-01');
  assert.equal(s.longestStreakEnd, '2026-04-05');
  assert.equal(s.currentStreak, 5);
  assert.equal(s.density, 1);
  assert.equal(s.tokens, 500);
  assert.equal(s.firstDay, '2026-04-01');
  assert.equal(s.lastDay, '2026-04-05');
});

test('source-active-day-streak: split streaks → counts maximal runs and picks earliest tied longest', () => {
  // active days: 04-01, 04-02 (run len 2), gap, 04-05, 04-06 (run len 2),
  // gap, 04-09 (run len 1). Two runs tie at 2; earliest must win.
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'beta', 10),
    ql('2026-04-02T01:00:00Z', 'beta', 10),
    ql('2026-04-05T01:00:00Z', 'beta', 10),
    ql('2026-04-06T01:00:00Z', 'beta', 10),
    ql('2026-04-09T01:00:00Z', 'beta', 10),
  ];
  const r = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeDays, 5);
  assert.equal(s.tenureDays, 9); // 04-01..04-09 inclusive
  assert.equal(s.streaks, 3);
  assert.equal(s.longestStreak, 2);
  assert.equal(s.longestStreakStart, '2026-04-01');
  assert.equal(s.longestStreakEnd, '2026-04-02');
  assert.equal(s.currentStreak, 1); // trailing run is just 04-09
  assert.equal(s.meanStreak, 5 / 3);
  assert.ok(Math.abs(s.density - 5 / 9) < 1e-9);
});

test('source-active-day-streak: same-day multiple buckets collapse to one active day', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'gamma', 10),
    ql('2026-04-01T05:00:00Z', 'gamma', 20),
    ql('2026-04-01T23:30:00Z', 'gamma', 30),
  ];
  const r = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.activeDays, 1);
  assert.equal(s.tenureDays, 1);
  assert.equal(s.streaks, 1);
  assert.equal(s.longestStreak, 1);
  assert.equal(s.currentStreak, 1);
  assert.equal(s.density, 1);
  assert.equal(s.tokens, 60);
});

test('source-active-day-streak: zero/negative/non-finite tokens dropped', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'd1', 100),
    ql('2026-04-02T01:00:00Z', 'd1', 0),
    ql('2026-04-03T01:00:00Z', 'd1', -5),
    ql('2026-04-04T01:00:00Z', 'd1', Number.NaN as unknown as number),
    ql('2026-04-05T01:00:00Z', 'd1', 200),
  ];
  const r = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 3);
  const s = r.sources[0]!;
  assert.equal(s.activeDays, 2);
  assert.equal(s.tenureDays, 5);
  assert.equal(s.longestStreak, 1); // 04-01 alone, then gap, then 04-05 alone
  assert.equal(s.streaks, 2);
});

test('source-active-day-streak: bad hour_start counted, not crashing', () => {
  const q: QueueLine[] = [
    ql('not-an-iso', 'd1', 100),
    ql('2026-04-01T01:00:00Z', 'd1', 50),
  ];
  const r = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.activeDays, 1);
});

test('source-active-day-streak: empty source key normalised to "unknown"', () => {
  const q: QueueLine[] = [ql('2026-04-01T01:00:00Z', '', 100)];
  const r = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-active-day-streak: model + source filters', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'alpha', 10, { model: 'm1' }),
    ql('2026-04-02T01:00:00Z', 'alpha', 10, { model: 'm2' }),
    ql('2026-04-01T01:00:00Z', 'beta', 10, { model: 'm1' }),
  ];
  const r1 = buildSourceActiveDayStreak(q, {
    model: 'm1',
    generatedAt: GEN,
  });
  assert.equal(r1.droppedModelFilter, 1);
  assert.equal(r1.totalSources, 2);

  const r2 = buildSourceActiveDayStreak(q, {
    source: 'alpha',
    generatedAt: GEN,
  });
  assert.equal(r2.droppedSourceFilter, 1);
  assert.equal(r2.totalSources, 1);
  assert.equal(r2.sources[0]!.source, 'alpha');
});

test('source-active-day-streak: window cut can split a streak', () => {
  // Source has 04-01, 04-02, 04-03 active. Cut window to [04-02, +inf):
  // surviving days = 04-02, 04-03; longest streak = 2 (was 3 unbounded).
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 's', 10),
    ql('2026-04-02T01:00:00Z', 's', 10),
    ql('2026-04-03T01:00:00Z', 's', 10),
  ];
  const full = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.equal(full.sources[0]!.longestStreak, 3);
  const cut = buildSourceActiveDayStreak(q, {
    since: '2026-04-02T00:00:00Z',
    generatedAt: GEN,
  });
  assert.equal(cut.sources[0]!.longestStreak, 2);
  assert.equal(cut.sources[0]!.firstDay, '2026-04-02');
});

test('source-active-day-streak: minDays / densityMin / top filters and droppedBelow* counters', () => {
  const q: QueueLine[] = [
    // alpha: 3 active days, dense (3/3)
    ql('2026-04-01T01:00:00Z', 'alpha', 100),
    ql('2026-04-02T01:00:00Z', 'alpha', 100),
    ql('2026-04-03T01:00:00Z', 'alpha', 100),
    // beta: 2 active days across 5 (sparse)
    ql('2026-04-01T01:00:00Z', 'beta', 50),
    ql('2026-04-05T01:00:00Z', 'beta', 50),
    // gamma: 1 active day
    ql('2026-04-01T01:00:00Z', 'gamma', 25),
  ];
  const r = buildSourceActiveDayStreak(q, {
    minDays: 2,
    densityMin: 0.5,
    generatedAt: GEN,
  });
  // gamma dropped by minDays (1 < 2). beta has density 2/5 = 0.4 < 0.5 → dropped.
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.droppedBelowDensityMin, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  // total denominators echo full population
  assert.equal(r.totalSources, 3);
  assert.equal(r.totalTokens, 425);

  // top cap
  const r2 = buildSourceActiveDayStreak(q, { top: 1, generatedAt: GEN });
  assert.equal(r2.sources.length, 1);
  assert.equal(r2.droppedBelowTopCap, 2);
});

test('source-active-day-streak: sort modes are stable and deterministic', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'aaa', 100),
    ql('2026-04-02T01:00:00Z', 'aaa', 100),
    ql('2026-04-03T01:00:00Z', 'aaa', 100),
    ql('2026-04-01T01:00:00Z', 'bbb', 50),
    ql('2026-04-02T01:00:00Z', 'bbb', 50),
    ql('2026-04-01T01:00:00Z', 'ccc', 200),
  ];
  // sort=tokens: aaa(300), ccc(200), bbb(100)
  const t = buildSourceActiveDayStreak(q, {
    sort: 'tokens',
    generatedAt: GEN,
  });
  assert.deepEqual(
    t.sources.map((s) => s.source),
    ['aaa', 'ccc', 'bbb'],
  );
  // sort=streak: aaa(3), bbb(2), ccc(1) — straight by length, ties lex
  const s = buildSourceActiveDayStreak(q, {
    sort: 'streak',
    generatedAt: GEN,
  });
  assert.deepEqual(
    s.sources.map((x) => x.source),
    ['aaa', 'bbb', 'ccc'],
  );
  // sort=days: same as streak here
  const d = buildSourceActiveDayStreak(q, {
    sort: 'days',
    generatedAt: GEN,
  });
  assert.deepEqual(
    d.sources.map((x) => x.source),
    ['aaa', 'bbb', 'ccc'],
  );
  // sort=source: lex asc
  const so = buildSourceActiveDayStreak(q, {
    sort: 'source',
    generatedAt: GEN,
  });
  assert.deepEqual(
    so.sources.map((x) => x.source),
    ['aaa', 'bbb', 'ccc'],
  );
});

test('source-active-day-streak: deterministic — identical input → identical output', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'x', 10),
    ql('2026-04-02T01:00:00Z', 'y', 20),
    ql('2026-04-03T01:00:00Z', 'x', 30),
    ql('2026-04-04T01:00:00Z', 'z', 40),
  ];
  const a = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  const b = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.deepEqual(a, b);
});

test('source-active-day-streak: --min-longest-streak filters out short habits', () => {
  // alpha: longestStreak 5 (5 consecutive days)
  // beta:  longestStreak 2 (2 days, gap, 1 day)
  // gamma: longestStreak 1
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'alpha', 10),
    ql('2026-04-02T01:00:00Z', 'alpha', 10),
    ql('2026-04-03T01:00:00Z', 'alpha', 10),
    ql('2026-04-04T01:00:00Z', 'alpha', 10),
    ql('2026-04-05T01:00:00Z', 'alpha', 10),
    ql('2026-04-01T01:00:00Z', 'beta', 10),
    ql('2026-04-02T01:00:00Z', 'beta', 10),
    ql('2026-04-04T01:00:00Z', 'beta', 10),
    ql('2026-04-01T01:00:00Z', 'gamma', 10),
  ];
  const r3 = buildSourceActiveDayStreak(q, {
    minLongestStreak: 3,
    generatedAt: GEN,
  });
  assert.equal(r3.minLongestStreak, 3);
  assert.equal(r3.droppedBelowMinLongestStreak, 2); // beta + gamma
  assert.equal(r3.sources.length, 1);
  assert.equal(r3.sources[0]!.source, 'alpha');
  // global denominators echo the full kept population
  assert.equal(r3.totalSources, 3);
  assert.equal(r3.totalTokens, 90);

  const r2 = buildSourceActiveDayStreak(q, {
    minLongestStreak: 2,
    generatedAt: GEN,
  });
  assert.equal(r2.droppedBelowMinLongestStreak, 1); // only gamma drops
  assert.equal(r2.sources.length, 2);

  // default (1) keeps everyone
  const r1 = buildSourceActiveDayStreak(q, { generatedAt: GEN });
  assert.equal(r1.droppedBelowMinLongestStreak, 0);
  assert.equal(r1.sources.length, 3);
});

test('source-active-day-streak: --min-longest-streak applies AFTER minDays / densityMin and BEFORE top cap', () => {
  // alpha: longestStreak 4, activeDays 4, density 1.0
  // beta:  longestStreak 3, activeDays 3, density 1.0
  // gamma: longestStreak 2, activeDays 2, density 0.4 (sparse over 5 days)
  // delta: longestStreak 1, activeDays 1, density 1.0
  const q: QueueLine[] = [
    ql('2026-04-01T01:00:00Z', 'alpha', 100),
    ql('2026-04-02T01:00:00Z', 'alpha', 100),
    ql('2026-04-03T01:00:00Z', 'alpha', 100),
    ql('2026-04-04T01:00:00Z', 'alpha', 100),
    ql('2026-04-01T01:00:00Z', 'beta', 50),
    ql('2026-04-02T01:00:00Z', 'beta', 50),
    ql('2026-04-03T01:00:00Z', 'beta', 50),
    ql('2026-04-01T01:00:00Z', 'gamma', 30),
    ql('2026-04-05T01:00:00Z', 'gamma', 30),
    ql('2026-04-01T01:00:00Z', 'delta', 5),
  ];
  // Order of filters: minDays(2) drops delta first; then densityMin(0.5)
  // drops gamma (0.4 < 0.5); then minLongestStreak(3) drops anyone
  // surviving with longestStreak < 3.
  const r = buildSourceActiveDayStreak(q, {
    minDays: 2,
    densityMin: 0.5,
    minLongestStreak: 3,
    top: 1,
    generatedAt: GEN,
  });
  assert.equal(r.droppedBelowMinDays, 1); // delta
  assert.equal(r.droppedBelowDensityMin, 1); // gamma
  assert.equal(r.droppedBelowMinLongestStreak, 0); // alpha(4) and beta(3) both pass
  assert.equal(r.droppedBelowTopCap, 1); // alpha and beta survived; top=1 hides one
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.totalSources, 4);
});
