import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDeviceTenure } from '../src/devicetenure.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hourStart: string,
  device: string,
  source: string,
  model: string,
  totalTokens: number,
): QueueLine {
  return {
    source,
    model,
    hour_start: hourStart,
    device_id: device,
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: totalTokens,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('device-tenure: rejects bad minBuckets', () => {
  assert.throws(() => buildDeviceTenure([], { minBuckets: -1 }));
  assert.throws(() => buildDeviceTenure([], { minBuckets: 1.5 }));
});

test('device-tenure: rejects bad top', () => {
  assert.throws(() => buildDeviceTenure([], { top: -1 }));
  assert.throws(() => buildDeviceTenure([], { top: 1.5 }));
});

test('device-tenure: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error testing runtime validation
    buildDeviceTenure([], { sort: 'nope' }),
  );
});

test('device-tenure: rejects bad since/until', () => {
  assert.throws(() => buildDeviceTenure([], { since: 'no' }));
  assert.throws(() => buildDeviceTenure([], { until: 'nope' }));
});

// ---- empty / shape -------------------------------------------------------

test('device-tenure: empty input yields zero population', () => {
  const r = buildDeviceTenure([], { generatedAt: GEN });
  assert.equal(r.totalDevices, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.devices, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.sort, 'span');
});

// ---- core aggregation ----------------------------------------------------

test('device-tenure: aggregates per-device span, buckets, tokens, sources, models', () => {
  // device A: 2 buckets, 2 sources, 2 models, span 5h, tokens 300
  // device B: 1 bucket, 1 source, 1 model, span 0h, tokens 50
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'devA', 'opencode', 'claude-opus-4.7', 200),
    ql('2026-04-20T10:00:00.000Z', 'devB', 'codex', 'gpt-5', 50),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN });
  assert.equal(r.totalDevices, 2);
  assert.equal(r.totalActiveBuckets, 3);
  assert.equal(r.totalTokens, 350);
  // sorted by span desc: devA (5h) first
  assert.equal(r.devices[0]!.device, 'devA');
  assert.equal(r.devices[0]!.spanHours, 5);
  assert.equal(r.devices[0]!.activeBuckets, 2);
  assert.equal(r.devices[0]!.tokens, 300);
  assert.equal(r.devices[0]!.distinctSources, 2);
  assert.equal(r.devices[0]!.distinctModels, 2);
  assert.equal(r.devices[0]!.tokensPerActiveBucket, 150);
  assert.equal(r.devices[0]!.tokensPerSpanHour, 60); // 300/5
  assert.equal(r.devices[1]!.device, 'devB');
  assert.equal(r.devices[1]!.spanHours, 0);
  // span<1h falls back to /1 in tokensPerSpanHour
  assert.equal(r.devices[1]!.tokensPerSpanHour, 50);
});

// ---- sort options --------------------------------------------------------

test('device-tenure: sort=tokens orders by token mass desc', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'small', 'codex', 'gpt-5', 100),
    ql('2026-04-20T100:00:00.000Z', 'small', 'codex', 'gpt-5', 100), // bad date dropped
    ql('2026-04-20T00:00:00.000Z', 'big', 'codex', 'gpt-5', 5000),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN, sort: 'tokens' });
  assert.equal(r.devices[0]!.device, 'big');
  assert.equal(r.devices[1]!.device, 'small');
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('device-tenure: sort=sources orders by distinctSources desc with lex tiebreak', () => {
  const rows = [
    // devA: 1 source
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    // devB: 3 sources
    ql('2026-04-20T00:00:00.000Z', 'devB', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'devB', 'opencode', 'gpt-5', 100),
    ql('2026-04-20T02:00:00.000Z', 'devB', 'claude-code', 'gpt-5', 100),
    // devC: 1 source (tiebreak with devA: lex 'devA' < 'devC')
    ql('2026-04-20T00:00:00.000Z', 'devC', 'codex', 'gpt-5', 100),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN, sort: 'sources' });
  assert.equal(r.devices[0]!.device, 'devB');
  assert.equal(r.devices[0]!.distinctSources, 3);
  assert.equal(r.devices[1]!.device, 'devA');
  assert.equal(r.devices[2]!.device, 'devC');
});

// ---- filters -------------------------------------------------------------

test('device-tenure: source filter excludes non-matching rows', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'devA', 'opencode', 'gpt-5', 999),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN, source: 'codex' });
  assert.equal(r.totalTokens, 100);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.source, 'codex');
});

test('device-tenure: model filter excludes non-matching rows', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'devA', 'codex', 'claude-opus-4.7', 999),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN, model: 'gpt-5' });
  assert.equal(r.totalTokens, 100);
  assert.equal(r.droppedModelFilter, 1);
});

// ---- minBuckets floor ----------------------------------------------------

test('device-tenure: minBuckets floor hides sparse devices but preserves global denominators', () => {
  const rows = [
    // 'sparse': 1 bucket, 50 tokens
    ql('2026-04-20T00:00:00.000Z', 'sparse', 'codex', 'gpt-5', 50),
    // 'dense': 3 buckets, 600 tokens
    ql('2026-04-20T00:00:00.000Z', 'dense', 'codex', 'gpt-5', 200),
    ql('2026-04-20T01:00:00.000Z', 'dense', 'codex', 'gpt-5', 200),
    ql('2026-04-20T02:00:00.000Z', 'dense', 'codex', 'gpt-5', 200),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN, minBuckets: 2 });
  assert.equal(r.minBuckets, 2);
  assert.equal(r.droppedSparseDevices, 1);
  assert.equal(r.devices.length, 1);
  assert.equal(r.devices[0]!.device, 'dense');
  // Global tallies cover the FULL population including the dropped sparse device.
  assert.equal(r.totalActiveBuckets, 4);
  assert.equal(r.totalTokens, 650);
});

// ---- top cap -------------------------------------------------------------

test('device-tenure: top cap truncates devices[] and counts droppedTopDevices', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', 'codex', 'gpt-5', 1),
    ql('2026-04-20T00:00:00.000Z', 'b', 'codex', 'gpt-5', 2),
    ql('2026-04-20T00:00:00.000Z', 'c', 'codex', 'gpt-5', 3),
  ];
  const r = buildDeviceTenure(rows, {
    generatedAt: GEN,
    top: 2,
    sort: 'tokens',
  });
  assert.equal(r.devices.length, 2);
  assert.equal(r.droppedTopDevices, 1);
  // global denominators still reflect the full 3-device population
  assert.equal(r.totalDevices, 3);
});

// ---- bad rows ------------------------------------------------------------

test('device-tenure: bad hour_start and zero tokens are dropped and counted', () => {
  const rows = [
    ql('not-a-date', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 0),
    ql('2026-04-20T01:00:00.000Z', 'devA', 'codex', 'gpt-5', 50),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.totalActiveBuckets, 1);
  assert.equal(r.totalTokens, 50);
});

// ---- empty/missing device_id falls back to 'unknown' ---------------------

test('device-tenure: empty device_id falls back to "unknown"', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', '', 'codex', 'gpt-5', 100),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN });
  assert.equal(r.devices.length, 1);
  assert.equal(r.devices[0]!.device, 'unknown');
});

// ---- refinement v0.4.90: longestGapHours + recentlyActive ---------------

test('device-tenure: rejects bad recentThresholdHours', () => {
  assert.throws(() => buildDeviceTenure([], { recentThresholdHours: 0 }));
  assert.throws(() => buildDeviceTenure([], { recentThresholdHours: -5 }));
  assert.throws(() =>
    buildDeviceTenure([], { recentThresholdHours: Number.NaN }),
  );
});

test('device-tenure: longestGapHours = 0 for single-bucket device', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN });
  assert.equal(r.devices[0]!.longestGapHours, 0);
});

test('device-tenure: longestGapHours = max consecutive idle gap in hours', () => {
  // active buckets: t=0, t=2h, t=10h, t=12h
  // gaps: 2h, 8h, 2h -> longest = 8h
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T02:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T10:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T12:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN });
  assert.equal(r.devices[0]!.longestGapHours, 8);
});

test('device-tenure: recentlyActive flag respects recentThresholdHours', () => {
  // GEN = 2026-04-25T12:00:00.000Z
  // active: 2026-04-25T00:00:00 -> 12h ago
  //         2026-04-23T00:00:00 -> 60h ago
  const rows = [
    ql('2026-04-25T00:00:00.000Z', 'fresh', 'codex', 'gpt-5', 100),
    ql('2026-04-23T00:00:00.000Z', 'stale', 'codex', 'gpt-5', 100),
  ];
  const r24 = buildDeviceTenure(rows, {
    generatedAt: GEN,
    recentThresholdHours: 24,
  });
  const fresh = r24.devices.find((d) => d.device === 'fresh')!;
  const stale = r24.devices.find((d) => d.device === 'stale')!;
  assert.equal(fresh.recentlyActive, true);
  assert.equal(stale.recentlyActive, false);
  assert.equal(r24.recentlyActiveCount, 1);
  assert.ok(Math.abs(fresh.hoursSinceLastSeen - 12) < 1e-9);
  assert.ok(Math.abs(stale.hoursSinceLastSeen - 60) < 1e-9);

  // Widen the threshold to 72h: both flip to recentlyActive.
  const r72 = buildDeviceTenure(rows, {
    generatedAt: GEN,
    recentThresholdHours: 72,
  });
  assert.equal(r72.recentlyActiveCount, 2);
  assert.equal(r72.recentThresholdHours, 72);
});

test('device-tenure: sort=gap orders by longestGapHours desc', () => {
  const rows = [
    // devA: gap 1h
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T01:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    // devB: gap 5h
    ql('2026-04-20T00:00:00.000Z', 'devB', 'codex', 'gpt-5', 100),
    ql('2026-04-20T05:00:00.000Z', 'devB', 'codex', 'gpt-5', 100),
    // devC: gap 0h (single bucket)
    ql('2026-04-20T00:00:00.000Z', 'devC', 'codex', 'gpt-5', 100),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN, sort: 'gap' });
  assert.equal(r.devices[0]!.device, 'devB');
  assert.equal(r.devices[0]!.longestGapHours, 5);
  assert.equal(r.devices[1]!.device, 'devA');
  assert.equal(r.devices[2]!.device, 'devC');
  assert.equal(r.sort, 'gap');
});

test('device-tenure: longestGapHours dedupes repeated hour_start values', () => {
  // Three rows on same hour_start -> single bucket -> gap=0
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 100),
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 200),
    ql('2026-04-20T00:00:00.000Z', 'devA', 'codex', 'gpt-5', 300),
  ];
  const r = buildDeviceTenure(rows, { generatedAt: GEN });
  assert.equal(r.devices[0]!.activeBuckets, 1);
  assert.equal(r.devices[0]!.longestGapHours, 0);
  assert.equal(r.devices[0]!.tokens, 600);
});
