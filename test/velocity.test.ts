import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildVelocity } from '../src/velocity.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourIso: string,
  tokens: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source: opts.source ?? 'test',
    model: opts.model ?? 'test-model',
    hour_start: hourIso,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? Math.floor(tokens * 0.7),
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? Math.floor(tokens * 0.3),
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: tokens,
  };
}

const ASOF = '2026-04-24T12:00:00.000Z';
const GEN = '2026-04-24T12:00:00.000Z';

test('velocity: rejects lookbackHours < 1', () => {
  assert.throws(() => buildVelocity([], { lookbackHours: 0, asOf: ASOF }));
  assert.throws(() => buildVelocity([], { lookbackHours: -1, asOf: ASOF }));
  assert.throws(() => buildVelocity([], { lookbackHours: 1.5, asOf: ASOF }));
});

test('velocity: rejects negative minTokensPerHour', () => {
  assert.throws(() => buildVelocity([], { minTokensPerHour: -1, asOf: ASOF }));
});

test('velocity: rejects topN < 1 or non-integer', () => {
  assert.throws(() => buildVelocity([], { topN: 0, asOf: ASOF }));
  assert.throws(() => buildVelocity([], { topN: 2.5, asOf: ASOF }));
});

test('velocity: empty queue → no stretches, zero average', () => {
  const r = buildVelocity([], { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 0);
  assert.equal(r.totalActiveHours, 0);
  assert.equal(r.totalActiveTokens, 0);
  assert.equal(r.averageTokensPerMinute, 0);
  assert.equal(r.medianTokensPerMinute, null);
  assert.equal(r.peakStretch, null);
  assert.equal(r.longestStretch, null);
  assert.deepEqual(r.topStretches, []);
});

test('velocity: window-aligned to asOf hour, lookback bounds inclusive', () => {
  const r = buildVelocity([], {
    lookbackHours: 5,
    asOf: '2026-04-24T12:34:56.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.windowEnd, '2026-04-24T12:00:00.000Z');
  assert.equal(r.windowStart, '2026-04-24T08:00:00.000Z');
  assert.equal(r.lookbackHours, 5);
});

test('velocity: single active hour → one 1h stretch, rate = tokens/60', () => {
  const queue = [ql('2026-04-24T10:00:00.000Z', 600)];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 1);
  assert.equal(r.totalActiveHours, 1);
  assert.equal(r.totalActiveTokens, 600);
  assert.equal(r.averageTokensPerMinute, 10);
  assert.equal(r.peakStretch?.tokensPerMinute, 10);
  assert.equal(r.peakStretch?.hours, 1);
  assert.equal(r.peakStretch?.startHour, '2026-04-24T10:00:00.000Z');
  assert.equal(r.peakStretch?.endHour, '2026-04-24T10:00:00.000Z');
});

test('velocity: contiguous active hours merge into one stretch', () => {
  const queue = [
    ql('2026-04-24T08:00:00.000Z', 600),
    ql('2026-04-24T09:00:00.000Z', 1200),
    ql('2026-04-24T10:00:00.000Z', 1800),
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 1);
  assert.equal(r.totalActiveHours, 3);
  assert.equal(r.totalActiveTokens, 3600);
  // 3600 tokens / (3 hours * 60 min) = 20/min
  assert.equal(r.averageTokensPerMinute, 20);
  assert.equal(r.peakStretch?.hours, 3);
  assert.equal(r.peakStretch?.tokensPerMinute, 20);
});

test('velocity: idle hour breaks stretches', () => {
  const queue = [
    ql('2026-04-24T08:00:00.000Z', 600),
    // 09:00 idle (no row)
    ql('2026-04-24T10:00:00.000Z', 1200),
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 2);
  assert.equal(r.totalActiveHours, 2);
  assert.equal(r.totalActiveTokens, 1800);
  // longestStretch tie (both 1h) → more tokens wins → 10:00 (1200)
  assert.equal(r.longestStretch?.startHour, '2026-04-24T10:00:00.000Z');
  // peak by velocity: 1200/60 = 20/min vs 600/60 = 10/min
  assert.equal(r.peakStretch?.startHour, '2026-04-24T10:00:00.000Z');
  assert.equal(r.peakStretch?.tokensPerMinute, 20);
});

test('velocity: minTokensPerHour filters trickle hours out of stretches', () => {
  const queue = [
    ql('2026-04-24T08:00:00.000Z', 5),
    ql('2026-04-24T09:00:00.000Z', 5),
    ql('2026-04-24T10:00:00.000Z', 6000),
  ];
  const r = buildVelocity(queue, {
    lookbackHours: 24,
    minTokensPerHour: 100,
    asOf: ASOF,
    generatedAt: GEN,
  });
  assert.equal(r.stretchCount, 1);
  assert.equal(r.totalActiveHours, 1);
  assert.equal(r.totalActiveTokens, 6000);
});

test('velocity: out-of-window rows ignored', () => {
  const queue = [
    ql('2026-04-20T00:00:00.000Z', 9999),  // older than 24h before ASOF
    ql('2026-04-24T11:00:00.000Z', 600),
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.totalActiveTokens, 600);
  assert.equal(r.stretchCount, 1);
});

test('velocity: topStretches sorted by velocity desc, deterministic', () => {
  const queue = [
    // stretch A: 08:00 alone, 60 tokens → 1/min
    ql('2026-04-24T08:00:00.000Z', 60),
    // stretch B: 10:00 alone, 600 tokens → 10/min
    ql('2026-04-24T10:00:00.000Z', 600),
    // stretch C: 11:00 alone, 600 tokens → 10/min (tie with B; earlier start wins among... wait B is earlier)
    // Actually let's give C a different rate: 12 tokens, 0.2/min (will not be in top after A, B if topN=2)
  ];
  const r = buildVelocity(queue, {
    lookbackHours: 24,
    asOf: ASOF,
    topN: 2,
    generatedAt: GEN,
  });
  assert.equal(r.topStretches.length, 2);
  assert.equal(r.topStretches[0]!.startHour, '2026-04-24T10:00:00.000Z');
  assert.equal(r.topStretches[1]!.startHour, '2026-04-24T08:00:00.000Z');
});

test('velocity: tie-break on equal velocity → more hours, then earlier start', () => {
  const queue = [
    // A: 08:00-09:00 (2h), 1200 tokens total → 10/min
    ql('2026-04-24T08:00:00.000Z', 600),
    ql('2026-04-24T09:00:00.000Z', 600),
    // B: 11:00 alone (1h), 600 tokens → 10/min
    ql('2026-04-24T11:00:00.000Z', 600),
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  // both 10/min; A has more hours → ranks first
  assert.equal(r.topStretches[0]!.hours, 2);
  assert.equal(r.topStretches[0]!.startHour, '2026-04-24T08:00:00.000Z');
  assert.equal(r.topStretches[1]!.hours, 1);
});

test('velocity: median over per-stretch rates is robust to one fast stretch', () => {
  const queue = [
    ql('2026-04-24T05:00:00.000Z', 60),    // 1/min
    ql('2026-04-24T07:00:00.000Z', 120),   // 2/min
    ql('2026-04-24T09:00:00.000Z', 6000),  // 100/min — outlier
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 3);
  assert.equal(r.medianTokensPerMinute, 2);  // middle of [1, 2, 100]
});

test('velocity: input/output sums carried through stretches', () => {
  const queue = [
    ql('2026-04-24T10:00:00.000Z', 1000, { input_tokens: 800, output_tokens: 200 }),
    ql('2026-04-24T11:00:00.000Z', 1000, { input_tokens: 600, output_tokens: 400 }),
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 1);
  assert.equal(r.peakStretch?.inputTokens, 1400);
  assert.equal(r.peakStretch?.outputTokens, 600);
  assert.equal(r.peakStretch?.events, 2);
});

test('velocity: row hour_start floored to hour bucket (defensive)', () => {
  const queue = [
    // Two rows in the same hour bucket but different sub-hour timestamps:
    // hourFloorIso should collapse them.
    ql('2026-04-24T10:00:00.000Z', 300),
    ql('2026-04-24T10:30:00.000Z', 300),
  ];
  const r = buildVelocity(queue, { lookbackHours: 24, asOf: ASOF, generatedAt: GEN });
  assert.equal(r.stretchCount, 1);
  assert.equal(r.totalActiveHours, 1);
  assert.equal(r.totalActiveTokens, 600);
});
