import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildProviderSwitchingFrequency } from '../src/providerswitchingfrequency.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  source: string,
  model: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model,
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('provider-switching-frequency: rejects bad topPairs', () => {
  assert.throws(() =>
    buildProviderSwitchingFrequency([], { topPairs: -1 }),
  );
  assert.throws(() =>
    buildProviderSwitchingFrequency([], { topPairs: 1.5 }),
  );
});

test('provider-switching-frequency: rejects bad topDays', () => {
  assert.throws(() =>
    buildProviderSwitchingFrequency([], { topDays: -1 }),
  );
  assert.throws(() =>
    buildProviderSwitchingFrequency([], { topDays: 2.5 }),
  );
});

test('provider-switching-frequency: rejects bad sort', () => {
  assert.throws(() =>
    buildProviderSwitchingFrequency([], {
      // @ts-expect-error invalid sort key on purpose
      sort: 'cheese',
    }),
  );
});

test('provider-switching-frequency: rejects bad since/until', () => {
  assert.throws(() =>
    buildProviderSwitchingFrequency([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildProviderSwitchingFrequency([], { until: 'still-not' }),
  );
});

// ---- empty / degenerate inputs --------------------------------------------

test('provider-switching-frequency: empty queue produces zeros', () => {
  const r = buildProviderSwitchingFrequency([], { generatedAt: GEN });
  assert.equal(r.activeDays, 0);
  assert.equal(r.activeBuckets, 0);
  assert.equal(r.consideredPairs, 0);
  assert.equal(r.switchPairs, 0);
  assert.equal(r.switchShare, 0);
  assert.equal(r.crossDayPairs, 0);
  assert.equal(r.crossDaySwitches, 0);
  assert.equal(r.meanSwitchesPerActiveDay, 0);
  assert.equal(r.daysWithAnySwitch, 0);
  assert.equal(r.dayCoverage, 0);
  assert.deepEqual(r.pairs, []);
  assert.deepEqual(r.days, []);
});

test('provider-switching-frequency: single-bucket day yields 0 pairs', () => {
  const q = [ql('2026-04-20T10:00:00.000Z', 'src', 'claude-opus-4.7', 1000)];
  const r = buildProviderSwitchingFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeDays, 1);
  assert.equal(r.activeBuckets, 1);
  assert.equal(r.consideredPairs, 0);
  assert.equal(r.switchPairs, 0);
  assert.equal(r.switchShare, 0);
  assert.equal(r.daysWithAnySwitch, 0);
  assert.equal(r.dayCoverage, 0);
  assert.equal(r.days[0]!.dominantProvider, 'anthropic');
  assert.equal(r.days[0]!.dominantProviderBuckets, 1);
});

// ---- core mechanic --------------------------------------------------------

test('provider-switching-frequency: counts intra-day provider switches and ignores same-provider model swaps', () => {
  const q = [
    // Day A: anthropic -> openai -> anthropic — 2 switches in 2 pairs
    ql('2026-04-20T10:00:00.000Z', 'src', 'claude-opus-4.7', 1000),
    ql('2026-04-20T11:00:00.000Z', 'src', 'gpt-5', 2000),
    ql('2026-04-20T12:00:00.000Z', 'src', 'claude-sonnet-4.5', 1500),
    // Day B: anthropic -> anthropic (different model id, same provider) -> openai
    ql('2026-04-21T09:00:00.000Z', 'src', 'claude-opus-4.7', 800),
    ql('2026-04-21T10:00:00.000Z', 'src', 'claude-sonnet-4.5', 700),
    ql('2026-04-21T11:00:00.000Z', 'src', 'gpt-5', 600),
  ];
  const r = buildProviderSwitchingFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeDays, 2);
  assert.equal(r.activeBuckets, 6);
  assert.equal(r.consideredPairs, 4); // 2 + 2
  // Day A: 2 switches; Day B: 1 switch (claude->claude is not a provider switch, claude->gpt is).
  assert.equal(r.switchPairs, 3);
  assert.equal(r.daysWithAnySwitch, 2);
  // Cross-day pair Day-A 12:00 -> Day-B 09:00 = anthropic -> anthropic, no switch.
  assert.equal(r.crossDayPairs, 1);
  assert.equal(r.crossDaySwitches, 0);
  // Top pairs: anthropic->openai (2), openai->anthropic (1)
  assert.equal(r.pairs.length, 2);
  assert.equal(r.pairs[0]!.from, 'anthropic');
  assert.equal(r.pairs[0]!.to, 'openai');
  assert.equal(r.pairs[0]!.count, 2);
  assert.equal(r.pairs[1]!.from, 'openai');
  assert.equal(r.pairs[1]!.to, 'anthropic');
  assert.equal(r.pairs[1]!.count, 1);
});

test('provider-switching-frequency: cross-day boundary not counted in same-day switches', () => {
  const q = [
    ql('2026-04-20T23:00:00.000Z', 'src', 'claude-opus-4.7', 500),
    ql('2026-04-21T00:00:00.000Z', 'src', 'gpt-5', 500),
  ];
  const r = buildProviderSwitchingFrequency(q, { generatedAt: GEN });
  assert.equal(r.activeDays, 2);
  assert.equal(r.consideredPairs, 0); // both days have 1 bucket each
  assert.equal(r.switchPairs, 0);
  assert.equal(r.crossDayPairs, 1);
  assert.equal(r.crossDaySwitches, 1);
});

// ---- malformed input ------------------------------------------------------

test('provider-switching-frequency: malformed rows surface as drop counters', () => {
  const q: QueueLine[] = [
    ql('not-a-timestamp', 'src', 'claude-opus-4.7', 1000),
    ql('2026-04-20T10:00:00.000Z', 'src', 'claude-opus-4.7', 0),
    ql('2026-04-20T11:00:00.000Z', 'src', '', 500),
    ql('2026-04-20T12:00:00.000Z', 'src', 'gpt-5', 500),
    ql('2026-04-20T13:00:00.000Z', 'src', 'claude-opus-4.7', 500),
  ];
  const r = buildProviderSwitchingFrequency(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedEmptyModelBuckets, 1);
  // Two surviving buckets on the same day: gpt-5 (12:00) -> claude (13:00)
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.consideredPairs, 1);
  assert.equal(r.switchPairs, 1);
});

test('provider-switching-frequency: source filter excludes non-matching rows', () => {
  const q = [
    ql('2026-04-20T10:00:00.000Z', 'opencode', 'claude-opus-4.7', 1000),
    ql('2026-04-20T11:00:00.000Z', 'codex', 'gpt-5', 1000),
    ql('2026-04-20T12:00:00.000Z', 'opencode', 'claude-sonnet-4.5', 500),
  ];
  const r = buildProviderSwitchingFrequency(q, {
    source: 'opencode',
    generatedAt: GEN,
  });
  assert.equal(r.droppedSourceFilter, 1);
  // Two opencode buckets on same day, both anthropic -> 0 switches.
  assert.equal(r.activeBuckets, 2);
  assert.equal(r.consideredPairs, 1);
  assert.equal(r.switchPairs, 0);
  assert.equal(r.source, 'opencode');
});

test('provider-switching-frequency: deterministic top-N with tie-break on from then to', () => {
  // Build several days each with the same handful of switches to
  // make ties easy to construct.
  const q: QueueLine[] = [];
  // Three (anthropic -> openai) switches across three days.
  for (const day of ['2026-04-10', '2026-04-11', '2026-04-12']) {
    q.push(ql(`${day}T10:00:00.000Z`, 'src', 'claude-opus-4.7', 500));
    q.push(ql(`${day}T11:00:00.000Z`, 'src', 'gpt-5', 500));
  }
  // Three (openai -> google) switches across three other days.
  for (const day of ['2026-04-13', '2026-04-14', '2026-04-15']) {
    q.push(ql(`${day}T10:00:00.000Z`, 'src', 'gpt-5', 500));
    q.push(ql(`${day}T11:00:00.000Z`, 'src', 'gemini-2.5-pro', 500));
  }
  const r = buildProviderSwitchingFrequency(q, { topPairs: 1, generatedAt: GEN });
  // Both pairs tied at 3 — lex sort breaks the tie: 'anthropic' < 'openai'.
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0]!.from, 'anthropic');
  assert.equal(r.pairs[0]!.to, 'openai');
  assert.equal(r.droppedBelowTopCap, 1);
});
