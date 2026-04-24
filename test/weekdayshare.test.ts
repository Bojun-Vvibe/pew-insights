import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildWeekdayShare, WEEKDAY_LABELS_MON_FIRST } from '../src/weekdayshare.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, model: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model,
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// 2026 reference dates by ISO weekday (Mon-first, UTC):
//   Mon 2026-04-20, Tue 21, Wed 22, Thu 23, Fri 24, Sat 25, Sun 26.

// ---- option validation -----------------------------------------------------

test('weekday-share: rejects bad minTokens', () => {
  assert.throws(() => buildWeekdayShare([], { minTokens: -1 }));
});

test('weekday-share: rejects bad top', () => {
  assert.throws(() => buildWeekdayShare([], { top: -1 }));
  assert.throws(() => buildWeekdayShare([], { top: 2.5 }));
});

test('weekday-share: rejects bad since/until', () => {
  assert.throws(() => buildWeekdayShare([], { since: 'no' }));
  assert.throws(() => buildWeekdayShare([], { until: 'nope' }));
});

test('weekday-share: rejects bad by', () => {
  // @ts-expect-error testing runtime guard
  assert.throws(() => buildWeekdayShare([], { by: 'project' }));
});

// ---- empty / shape ---------------------------------------------------------

test('weekday-share: empty input yields zero population', () => {
  const r = buildWeekdayShare([], { generatedAt: GEN });
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.groups, []);
  assert.equal(r.globalPeakWeekday, -1);
  assert.equal(r.globalHhi, 0);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.by, 'model');
});

// ---- weekday mapping -------------------------------------------------------

test('weekday-share: ISO Mon=0 .. Sun=6 mapping is correct from UTC', () => {
  // One row on each weekday for the same model.
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 1 }), // Mon -> 0
    ql('2026-04-21T00:00:00.000Z', 'm', { total_tokens: 1 }), // Tue -> 1
    ql('2026-04-22T00:00:00.000Z', 'm', { total_tokens: 1 }), // Wed -> 2
    ql('2026-04-23T00:00:00.000Z', 'm', { total_tokens: 1 }), // Thu -> 3
    ql('2026-04-24T00:00:00.000Z', 'm', { total_tokens: 1 }), // Fri -> 4
    ql('2026-04-25T00:00:00.000Z', 'm', { total_tokens: 1 }), // Sat -> 5
    ql('2026-04-26T00:00:00.000Z', 'm', { total_tokens: 1 }), // Sun -> 6
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN });
  assert.equal(r.groups.length, 1);
  const g = r.groups[0]!;
  assert.deepEqual(g.tokensPerWeekday, [1, 1, 1, 1, 1, 1, 1]);
  assert.equal(g.activeWeekdays, 7);
  // Uniform week => HHI = 7 * (1/7)^2 = 1/7
  assert.ok(Math.abs(g.hhi - 1 / 7) < 1e-9);
  // Tie-break: peakWeekday is first with max share => Mon (0).
  assert.equal(g.peakWeekday, 0);
  // Global mirrors group when there's only one group.
  assert.equal(r.globalPeakWeekday, 0);
});

test('weekday-share: single-weekday model has hhi 1.0 and peakShare 1.0', () => {
  const rows = [
    ql('2026-04-22T03:00:00.000Z', 'wed-only', { total_tokens: 50 }),
    ql('2026-04-22T15:00:00.000Z', 'wed-only', { total_tokens: 100 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.totalTokens, 150);
  assert.equal(g.peakWeekday, 2); // Wednesday
  assert.equal(g.peakShare, 1);
  assert.equal(g.hhi, 1);
  assert.equal(g.activeWeekdays, 1);
  assert.equal(WEEKDAY_LABELS_MON_FIRST[g.peakWeekday], 'Wed');
});

test('weekday-share: shares sum to ~1 per group', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 30 }),
    ql('2026-04-22T00:00:00.000Z', 'm', { total_tokens: 50 }),
    ql('2026-04-25T00:00:00.000Z', 'm', { total_tokens: 20 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  const sum = g.sharePerWeekday.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.equal(g.peakWeekday, 2); // Wed has 50/100 share
  assert.equal(g.peakShare, 0.5);
  assert.equal(g.activeWeekdays, 3);
});

// ---- droppage --------------------------------------------------------------

test('weekday-share: drops bad hour_start and zero-token rows', () => {
  const rows = [
    ql('not-a-date', 'm'),
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 0 }),
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: -10 }),
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.totalTokens, 100);
});

// ---- since / until ---------------------------------------------------------

test('weekday-share: window filters by hour_start', () => {
  const rows = [
    ql('2026-04-13T12:00:00.000Z', 'm', { total_tokens: 999 }), // outside
    ql('2026-04-22T12:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-05-01T00:00:00.000Z', 'm', { total_tokens: 999 }), // at exclusive upper
  ];
  const r = buildWeekdayShare(rows, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
  });
  assert.equal(r.totalTokens, 100);
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.totalTokens, 100);
});

// ---- by source -------------------------------------------------------------

test('weekday-share: by=source groups by source string', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', { source: 'codex', total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'b', { source: 'codex', total_tokens: 200 }),
    ql('2026-04-22T00:00:00.000Z', 'a', { source: 'opencode', total_tokens: 50 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN, by: 'source' });
  assert.equal(r.groups.length, 2);
  assert.equal(r.by, 'source');
  const codex = r.groups.find((g) => g.model === 'codex')!;
  const opencode = r.groups.find((g) => g.model === 'opencode')!;
  assert.equal(codex.totalTokens, 300);
  assert.equal(opencode.totalTokens, 50);
});

test('weekday-share: by=source folds empty source to "unknown"', () => {
  const rows = [ql('2026-04-20T00:00:00.000Z', 'a', { source: '', total_tokens: 100 })];
  const r = buildWeekdayShare(rows, { generatedAt: GEN, by: 'source' });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'unknown');
});

// ---- minTokens / top -------------------------------------------------------

test('weekday-share: minTokens drops small groups and counts droppedGroupRows', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'big', { total_tokens: 1000 }),
    ql('2026-04-20T00:00:00.000Z', 'small', { total_tokens: 5 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN, minTokens: 100 });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'big');
  assert.equal(r.droppedGroupRows, 1);
  // Global denominator still reflects everyone.
  assert.equal(r.totalTokens, 1005);
});

test('weekday-share: top caps display rows and sets droppedTopGroups', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'a', { total_tokens: 300 }),
    ql('2026-04-20T00:00:00.000Z', 'b', { total_tokens: 200 }),
    ql('2026-04-20T00:00:00.000Z', 'c', { total_tokens: 100 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN, top: 2 });
  assert.equal(r.groups.length, 2);
  assert.equal(r.groups[0]!.model, 'a');
  assert.equal(r.groups[1]!.model, 'b');
  assert.equal(r.droppedTopGroups, 1);
});

test('weekday-share: groups sort by tokens desc then key asc', () => {
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'b', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T00:00:00.000Z', 'c', { total_tokens: 200 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN });
  assert.deepEqual(
    r.groups.map((g) => g.model),
    ['c', 'a', 'b'],
  );
});

// ---- HHI math --------------------------------------------------------------

test('weekday-share: HHI matches hand-computed value for a known split', () => {
  // 75% Mon, 25% Tue => HHI = 0.75^2 + 0.25^2 = 0.5625 + 0.0625 = 0.625
  const rows = [
    ql('2026-04-20T00:00:00.000Z', 'm', { total_tokens: 75 }),
    ql('2026-04-21T00:00:00.000Z', 'm', { total_tokens: 25 }),
  ];
  const r = buildWeekdayShare(rows, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.ok(Math.abs(g.hhi - 0.625) < 1e-9);
  assert.equal(g.peakWeekday, 0);
  assert.equal(g.peakShare, 0.75);
  // Global also matches when there's only one group.
  assert.ok(Math.abs(r.globalHhi - 0.625) < 1e-9);
});
