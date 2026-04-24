import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildPeakHourShare } from '../src/peakhour.js';
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

// ---- option validation -----------------------------------------------------

test('peak-hour-share: rejects bad minDays', () => {
  assert.throws(() => buildPeakHourShare([], { minDays: -1 }));
  assert.throws(() => buildPeakHourShare([], { minDays: 1.5 }));
});

test('peak-hour-share: rejects bad top', () => {
  assert.throws(() => buildPeakHourShare([], { top: -1 }));
  assert.throws(() => buildPeakHourShare([], { top: 2.5 }));
});

test('peak-hour-share: rejects bad minActiveHours', () => {
  assert.throws(() => buildPeakHourShare([], { minActiveHours: 0 }));
  assert.throws(() => buildPeakHourShare([], { minActiveHours: 25 }));
  assert.throws(() => buildPeakHourShare([], { minActiveHours: 1.5 }));
});

test('peak-hour-share: rejects bad since/until', () => {
  assert.throws(() => buildPeakHourShare([], { since: 'no' }));
  assert.throws(() => buildPeakHourShare([], { until: 'nope' }));
});

test('peak-hour-share: rejects bad by', () => {
  // @ts-expect-error testing runtime guard
  assert.throws(() => buildPeakHourShare([], { by: 'project' }));
});

// ---- empty / shape ---------------------------------------------------------

test('peak-hour-share: empty input yields zero population', () => {
  const r = buildPeakHourShare([], { generatedAt: GEN });
  assert.equal(r.consideredDays, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.overallMeanPeakShare, 0);
  assert.equal(r.overallMaxPeakShare, 0);
  assert.deepEqual(r.groups, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.by, 'model');
});

// ---- core arithmetic -------------------------------------------------------

test('peak-hour-share: single-hour day scores 100% and modal hour matches', () => {
  const q = [ql('2026-04-20T03:00:00.000Z', 'gpt-x', { total_tokens: 500 })];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  assert.equal(r.groups.length, 1);
  const g = r.groups[0]!;
  assert.equal(g.days, 1);
  assert.equal(g.totalTokens, 500);
  assert.equal(g.meanPeakShare, 1);
  assert.equal(g.p50PeakShare, 1);
  assert.equal(g.p95PeakShare, 1);
  assert.equal(g.maxPeakShare, 1);
  assert.equal(g.modalPeakHour, 3);
  assert.equal(g.modalPeakHourCount, 1);
  // Token-weighted overall: also 1.0 here.
  assert.equal(r.overallMeanPeakShare, 1);
});

test('peak-hour-share: peak hour wins by token mass, not row count', () => {
  // Same model, same day, four hours; hour 5 wins on mass.
  const q = [
    ql('2026-04-20T01:00:00.000Z', 'gpt-x', { total_tokens: 100 }),
    ql('2026-04-20T02:00:00.000Z', 'gpt-x', { total_tokens: 200 }),
    ql('2026-04-20T03:00:00.000Z', 'gpt-x', { total_tokens: 100 }),
    ql('2026-04-20T05:00:00.000Z', 'gpt-x', { total_tokens: 600 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.days, 1);
  assert.equal(g.totalTokens, 1000);
  assert.equal(g.meanPeakShare, 0.6); // 600 / 1000
  assert.equal(g.modalPeakHour, 5);
  assert.equal(g.modalPeakHourCount, 1);
});

test('peak-hour-share: hours sum within-hour, modal-hour aggregates across days', () => {
  // Day 1: peak hour 9. Day 2: peak hour 9 again. Day 3: peak hour 14.
  // Modal peak hour should be 9, count 2/3.
  const q = [
    // day 1
    ql('2026-04-20T09:00:00.000Z', 'm', { total_tokens: 800 }),
    ql('2026-04-20T10:00:00.000Z', 'm', { total_tokens: 200 }),
    // day 2 — also same hour twice, must sum to 700
    ql('2026-04-21T09:00:00.000Z', 'm', { total_tokens: 300 }),
    ql('2026-04-21T09:00:00.000Z', 'm', { total_tokens: 400 }),
    ql('2026-04-21T11:00:00.000Z', 'm', { total_tokens: 100 }),
    // day 3
    ql('2026-04-22T14:00:00.000Z', 'm', { total_tokens: 500 }),
    ql('2026-04-22T15:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.days, 3);
  assert.equal(g.modalPeakHour, 9);
  assert.equal(g.modalPeakHourCount, 2);
  // Per-day shares: 0.8, 700/800=0.875, 500/600≈0.8333.
  // Mean: ~0.8361.
  assert.ok(Math.abs(g.meanPeakShare - (0.8 + 0.875 + 500 / 600) / 3) < 1e-9);
  // Max share = 0.875.
  assert.equal(g.maxPeakShare, 0.875);
});

test('peak-hour-share: token-weighted overall mean differs from per-group simple mean', () => {
  // One model with 1 day at 50% peak, 2000 tokens.
  // Another model with 1 day at 100% peak, 100 tokens.
  // Simple-mean across groups = 0.75. Token-weighted across all days
  // = (0.5*2000 + 1.0*100) / 2100 ≈ 0.5238.
  const q = [
    ql('2026-04-20T01:00:00.000Z', 'big', { total_tokens: 1000 }),
    ql('2026-04-20T02:00:00.000Z', 'big', { total_tokens: 1000 }),
    ql('2026-04-21T03:00:00.000Z', 'small', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  assert.equal(r.consideredDays, 2);
  assert.equal(r.totalTokens, 2100);
  const expected = (0.5 * 2000 + 1.0 * 100) / 2100;
  assert.ok(Math.abs(r.overallMeanPeakShare - expected) < 1e-9);
  // Sanity: that's NOT 0.75 (the naive group-simple-mean answer).
  assert.notEqual(r.overallMeanPeakShare, 0.75);
});

// ---- filters ---------------------------------------------------------------

test('peak-hour-share: since/until filter rows by hour_start before bucketing', () => {
  const q = [
    ql('2026-04-19T10:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-20T10:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-21T10:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T00:00:00.000Z',
  });
  assert.equal(r.consideredDays, 1);
  assert.equal(r.groups[0]!.totalTokens, 100);
});

test('peak-hour-share: minActiveHours drops singleton-hour days, surfaces as droppedSingletonDays', () => {
  // Day 1 has only 1 active hour; day 2 has 2.
  const q = [
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 400 }),
    ql('2026-04-21T05:00:00.000Z', 'm', { total_tokens: 300 }),
    ql('2026-04-21T09:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN, minActiveHours: 2 });
  assert.equal(r.consideredDays, 1);
  assert.equal(r.droppedSingletonDays, 1);
  assert.equal(r.groups[0]!.days, 1);
  assert.equal(r.groups[0]!.meanPeakShare, 0.75); // 300/400
});

test('peak-hour-share: zero / negative / non-finite tokens land in droppedZeroTokens', () => {
  const q: QueueLine[] = [
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 0 }),
    ql('2026-04-20T02:00:00.000Z', 'm', { total_tokens: -5 }),
    ql('2026-04-20T03:00:00.000Z', 'm', { total_tokens: Number.NaN }),
    ql('2026-04-20T04:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 3);
  assert.equal(r.consideredDays, 1);
  assert.equal(r.groups[0]!.totalTokens, 100);
});

test('peak-hour-share: invalid hour_start lands in droppedInvalidHourStart', () => {
  const q = [
    ql('not-a-date', 'm', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.consideredDays, 1);
});

test('peak-hour-share: minDays floor hides low-day groups but global denominators stay stable', () => {
  const q = [
    // 'big' has 2 days
    ql('2026-04-20T01:00:00.000Z', 'big', { total_tokens: 100 }),
    ql('2026-04-21T01:00:00.000Z', 'big', { total_tokens: 100 }),
    // 'tiny' has only 1 day
    ql('2026-04-22T01:00:00.000Z', 'tiny', { total_tokens: 50 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN, minDays: 2 });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'big');
  assert.equal(r.droppedGroupRows, 1);
  // Global denominators include the 'tiny' day too.
  assert.equal(r.consideredDays, 3);
  assert.equal(r.totalTokens, 250);
});

test('peak-hour-share: top cap truncates groups[], remainder counted in droppedTopGroups', () => {
  const q = [
    ql('2026-04-20T01:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-21T01:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-22T01:00:00.000Z', 'a', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'b', { total_tokens: 100 }),
    ql('2026-04-21T01:00:00.000Z', 'b', { total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'c', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN, top: 1 });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'a');
  assert.equal(r.droppedTopGroups, 2);
});

// ---- by-source dimension ---------------------------------------------------

test('peak-hour-share: --by source regroups identical rows by producer string', () => {
  // Same model, two sources, two days each. Source view must split.
  const q = [
    ql('2026-04-20T01:00:00.000Z', 'm', { source: 'opencode', total_tokens: 100 }),
    ql('2026-04-21T01:00:00.000Z', 'm', { source: 'opencode', total_tokens: 100 }),
    ql('2026-04-20T01:00:00.000Z', 'm', { source: 'codex', total_tokens: 100 }),
    ql('2026-04-22T01:00:00.000Z', 'm', { source: 'codex', total_tokens: 100 }),
  ];
  const rModel = buildPeakHourShare(q, { generatedAt: GEN, by: 'model' });
  assert.equal(rModel.groups.length, 1);
  const rSource = buildPeakHourShare(q, { generatedAt: GEN, by: 'source' });
  assert.equal(rSource.groups.length, 2);
  const keys = rSource.groups.map((g) => g.model).sort();
  assert.deepEqual(keys, ['codex', 'opencode']);
  assert.equal(rSource.by, 'source');
});

test('peak-hour-share: empty source falls back to "unknown" sentinel', () => {
  const q = [
    ql('2026-04-20T01:00:00.000Z', 'm', { source: '', total_tokens: 100 }),
    ql('2026-04-21T01:00:00.000Z', 'm', { source: '', total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN, by: 'source' });
  assert.equal(r.groups.length, 1);
  assert.equal(r.groups[0]!.model, 'unknown');
});

// ---- modal-hour tie-break --------------------------------------------------

test('peak-hour-share: modal hour ties broken by lowest hour', () => {
  // Two days, peaks at hour 7 and 19 — both have count 1.
  // Tie-break: lowest hour (7).
  const q = [
    ql('2026-04-20T07:00:00.000Z', 'm', { total_tokens: 500 }),
    ql('2026-04-20T08:00:00.000Z', 'm', { total_tokens: 100 }),
    ql('2026-04-21T19:00:00.000Z', 'm', { total_tokens: 500 }),
    ql('2026-04-21T20:00:00.000Z', 'm', { total_tokens: 100 }),
  ];
  const r = buildPeakHourShare(q, { generatedAt: GEN });
  const g = r.groups[0]!;
  assert.equal(g.days, 2);
  assert.equal(g.modalPeakHour, 7);
  assert.equal(g.modalPeakHourCount, 1);
});
