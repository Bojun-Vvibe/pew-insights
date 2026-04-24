import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDeviceShare } from '../src/deviceshare.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, deviceId: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: deviceId,
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('device-share: rejects bad minTokens', () => {
  assert.throws(() => buildDeviceShare([], { minTokens: -1 }));
  assert.throws(() => buildDeviceShare([], { minTokens: Number.NaN }));
});

test('device-share: rejects bad top', () => {
  assert.throws(() => buildDeviceShare([], { top: -1 }));
  assert.throws(() => buildDeviceShare([], { top: 2.5 }));
});

test('device-share: rejects bad since/until', () => {
  assert.throws(() => buildDeviceShare([], { since: 'no' }));
  assert.throws(() => buildDeviceShare([], { until: 'nope' }));
});

// ---- empty / shape --------------------------------------------------------

test('device-share: empty input yields zero population', () => {
  const r = buildDeviceShare([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalDevices, 0);
  assert.deepEqual(r.devices, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minTokens, 0);
  assert.equal(r.top, 0);
});

// ---- single device --------------------------------------------------------

test('device-share: single device gets share=1', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', { total_tokens: 500, input_tokens: 400, cached_input_tokens: 100, output_tokens: 50, reasoning_output_tokens: 50 }),
    ql('2026-04-20T01:00:00.000Z', 'devA', { total_tokens: 1500, input_tokens: 1000, cached_input_tokens: 600, output_tokens: 300, reasoning_output_tokens: 200 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN });
  assert.equal(r.devices.length, 1);
  const d = r.devices[0]!;
  assert.equal(d.deviceId, 'devA');
  assert.equal(d.totalTokens, 2000);
  assert.equal(d.share, 1);
  assert.equal(d.rows, 2);
  assert.equal(d.activeHours, 2);
  assert.equal(d.inputTokens, 1400);
  assert.equal(d.cachedInputTokens, 700);
  assert.equal(d.outputTokens, 350);
  assert.equal(d.reasoningOutputTokens, 250);
  assert.ok(Math.abs(d.cacheHitRatio - 0.5) < 1e-9);
  assert.equal(d.firstSeen, '2026-04-20T00:00:00.000Z');
  assert.equal(d.lastSeen, '2026-04-20T01:00:00.000Z');
});

// ---- multi-device share arithmetic ---------------------------------------

test('device-share: shares sum to 1 across all kept devices', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', { total_tokens: 600 }),
    ql('2026-04-20T00:00:00.000Z', 'devB', { total_tokens: 300 }),
    ql('2026-04-20T00:00:00.000Z', 'devC', { total_tokens: 100 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN });
  assert.equal(r.devices.length, 3);
  assert.equal(r.totalTokens, 1000);
  const sum = r.devices.reduce((a, x) => a + x.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `share sum = ${sum}`);
  assert.equal(r.devices[0]!.deviceId, 'devA');
  assert.ok(Math.abs(r.devices[0]!.share - 0.6) < 1e-9);
  assert.ok(Math.abs(r.devices[1]!.share - 0.3) < 1e-9);
  assert.ok(Math.abs(r.devices[2]!.share - 0.1) < 1e-9);
});

// ---- distinct models / sources --------------------------------------------

test('device-share: counts distinct normalised models and sources per device', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', { source: 'codex', model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'devA', { source: 'codex', model: 'gpt-5', total_tokens: 100 }),
    ql('2026-04-20T02:00:00.000Z', 'devA', { source: 'claude-code', model: 'claude-opus-4.7', total_tokens: 100 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN });
  const d = r.devices[0]!;
  assert.equal(d.distinctModels, 2);
  assert.equal(d.distinctSources, 2);
  assert.equal(d.activeHours, 3);
});

// ---- empty / bad rows -----------------------------------------------------

test('device-share: drops rows with bad hour_start, zero tokens, or empty device_id', () => {
  const rows = [
    ql('not-iso', 'devA', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'devA', { total_tokens: 0 }),
    ql('2026-04-20T01:00:00.000Z', 'devA', { total_tokens: -50 }),
    ql('2026-04-20T02:00:00.000Z', '', { total_tokens: 100 }),
    ql('2026-04-20T03:00:00.000Z', '   ', { total_tokens: 100 }),
    ql('2026-04-20T04:00:00.000Z', 'devA', { total_tokens: 100 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.droppedEmptyDevice, 2);
  assert.equal(r.devices.length, 1);
  assert.equal(r.totalTokens, 100);
});

// ---- since/until window ---------------------------------------------------

test('device-share: since/until clamp the window', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'devA', { total_tokens: 200 }),
    ql('2026-04-20T02:00:00.000Z', 'devA', { total_tokens: 400 }),
  ];
  const r = buildDeviceShare(rows, {
    generatedAt: GEN,
    since: '2026-04-20T01:00:00.000Z',
    until: '2026-04-20T02:00:00.000Z',
  });
  assert.equal(r.totalTokens, 200);
  assert.equal(r.devices[0]!.totalTokens, 200);
  assert.equal(r.windowStart, '2026-04-20T01:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-20T02:00:00.000Z');
});

// ---- minTokens filter -----------------------------------------------------

test('device-share: minTokens hides low-volume devices but preserves global denominators', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'big', { total_tokens: 1000 }),
    ql('2026-04-20T00:00:00.000Z', 'tiny', { total_tokens: 5 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN, minTokens: 100 });
  assert.equal(r.devices.length, 1);
  assert.equal(r.devices[0]!.deviceId, 'big');
  assert.equal(r.droppedMinTokens, 1);
  // Global total reflects full population (display filter only).
  assert.equal(r.totalTokens, 1005);
  assert.equal(r.totalDevices, 2);
  // Share is computed against the global denominator.
  assert.ok(Math.abs(r.devices[0]!.share - 1000 / 1005) < 1e-9);
});

// ---- top cap --------------------------------------------------------------

test('device-share: top truncates to N largest devices by tokens', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'b', { total_tokens: 50 }),
    ql('2026-04-20T00:00:00.000Z', 'c', { total_tokens: 10 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN, top: 2 });
  assert.equal(r.devices.length, 2);
  assert.deepEqual(r.devices.map((d) => d.deviceId), ['a', 'b']);
  assert.equal(r.droppedTopDevices, 1);
});

// ---- sort order -----------------------------------------------------------

test('device-share: devices sorted by total tokens desc, deviceId asc on tie', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'b', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'c', { total_tokens: 200 }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN });
  assert.deepEqual(r.devices.map((d) => d.deviceId), ['c', 'a', 'b']);
});

// ---- cache hit ratio edge case -------------------------------------------

test('device-share: cacheHitRatio is 0 when input_tokens is 0', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'devA', {
      total_tokens: 100,
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 100,
    }),
  ];
  const r = buildDeviceShare(rows, { generatedAt: GEN });
  assert.equal(r.devices[0]!.cacheHitRatio, 0);
});
