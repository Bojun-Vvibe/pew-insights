import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceReasoningShareByDayCv } from '../src/sourcereasoningsharebydaycv.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  output_tokens: number,
  reasoning_output_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens,
    reasoning_output_tokens,
    total_tokens: output_tokens + reasoning_output_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('source-reasoning-share-by-day-cv: empty input → empty report', () => {
  const r = buildSourceReasoningShareByDayCv([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 3);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.top, null);
});

test('source-reasoning-share-by-day-cv: rejects bad minDays', () => {
  assert.throws(() => buildSourceReasoningShareByDayCv([], { minDays: 0 }));
  assert.throws(() => buildSourceReasoningShareByDayCv([], { minDays: -1 }));
  assert.throws(() => buildSourceReasoningShareByDayCv([], { minDays: 1.5 }));
});

test('source-reasoning-share-by-day-cv: rejects bad top', () => {
  assert.throws(() => buildSourceReasoningShareByDayCv([], { top: 0 }));
  assert.throws(() => buildSourceReasoningShareByDayCv([], { top: -1 }));
  assert.throws(() => buildSourceReasoningShareByDayCv([], { top: 1.5 }));
});

test('source-reasoning-share-by-day-cv: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceReasoningShareByDayCv([], { sort: 'bogus' }),
  );
});

test('source-reasoning-share-by-day-cv: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceReasoningShareByDayCv([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceReasoningShareByDayCv([], { until: 'also-bad' }),
  );
});

test('source-reasoning-share-by-day-cv: perfectly stable share -> shareCv = 0', () => {
  // 5 days, every day out=80 reas=20 -> share = 0.2 every day
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 's1', 80, 20));
  }
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysWithShare, 5);
  assert.equal(s.daysWithZeroReply, 0);
  assert.equal(s.meanShare, 0.2);
  assert.equal(s.stdShare, 0);
  assert.equal(s.shareCv, 0);
  assert.equal(s.flatLine, false);
  assert.equal(s.pureReasoning, false);
  assert.equal(s.singleSample, false);
});

test('source-reasoning-share-by-day-cv: flat-zero reasoning -> flatLine=true', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 4; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 's1', 100, 0));
  }
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.meanShare, 0);
  assert.equal(s.shareCv, 0);
  assert.equal(s.flatLine, true);
  assert.equal(s.pureReasoning, false);
});

test('source-reasoning-share-by-day-cv: pure reasoning -> pureReasoning=true', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 4; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 's1', 0, 50));
  }
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.meanShare, 1);
  assert.equal(s.shareCv, 0);
  assert.equal(s.flatLine, false);
  assert.equal(s.pureReasoning, true);
});

test('source-reasoning-share-by-day-cv: zero-reply day dropped from share sequence', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 0, 0), // zero reply -> dropped
    ql('2026-04-02T00:00:00.000Z', 's1', 80, 20),
    ql('2026-04-03T00:00:00.000Z', 's1', 60, 40),
    ql('2026-04-04T00:00:00.000Z', 's1', 70, 30),
  ];
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  const s = r.sources[0]!;
  assert.equal(s.activeDays, 4);
  assert.equal(s.daysWithShare, 3);
  assert.equal(s.daysWithZeroReply, 1);
  // shares = [0.2, 0.4, 0.3], mean = 0.3
  assert.ok(Math.abs(s.meanShare - 0.3) < 1e-9);
});

test('source-reasoning-share-by-day-cv: minDays floor drops sparse sources', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's_sparse', 100, 10),
    ql('2026-04-02T00:00:00.000Z', 's_sparse', 100, 10),
    ql('2026-04-01T00:00:00.000Z', 's_dense', 100, 10),
    ql('2026-04-02T00:00:00.000Z', 's_dense', 100, 10),
    ql('2026-04-03T00:00:00.000Z', 's_dense', 100, 10),
    ql('2026-04-04T00:00:00.000Z', 's_dense', 100, 10),
  ];
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 3 });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's_dense');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('source-reasoning-share-by-day-cv: window filter via since/until', () => {
  const q: QueueLine[] = [
    ql('2026-03-01T00:00:00.000Z', 's1', 100, 10),
    ql('2026-04-02T00:00:00.000Z', 's1', 100, 20),
    ql('2026-04-03T00:00:00.000Z', 's1', 100, 30),
    ql('2026-05-15T00:00:00.000Z', 's1', 100, 40),
  ];
  const r = buildSourceReasoningShareByDayCv(q, {
    generatedAt: GEN,
    minDays: 1,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-05-01T00:00:00.000Z',
  });
  const s = r.sources[0]!;
  assert.equal(s.daysWithShare, 2);
});

test('source-reasoning-share-by-day-cv: source filter', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100, 20),
    ql('2026-04-02T00:00:00.000Z', 's1', 100, 20),
    ql('2026-04-01T00:00:00.000Z', 's2', 100, 20),
    ql('2026-04-02T00:00:00.000Z', 's2', 100, 20),
  ];
  const r = buildSourceReasoningShareByDayCv(q, {
    generatedAt: GEN,
    minDays: 1,
    source: 's1',
  });
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 2);
});

test('source-reasoning-share-by-day-cv: bad hour_start counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's1', 100, 10),
    ql('2026-04-02T00:00:00.000Z', 's1', 100, 10),
    ql('2026-04-03T00:00:00.000Z', 's1', 100, 10),
    ql('2026-04-04T00:00:00.000Z', 's1', 100, 10),
  ];
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.daysWithShare, 3);
});

test('source-reasoning-share-by-day-cv: sort by cv asc with tie-break', () => {
  // s_stable: shares = [0.2, 0.2, 0.2] -> cv = 0
  // s_wild:   shares = [0.0, 0.5, 1.0] -> cv > 0
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's_stable', 80, 20),
    ql('2026-04-02T00:00:00.000Z', 's_stable', 80, 20),
    ql('2026-04-03T00:00:00.000Z', 's_stable', 80, 20),
    ql('2026-04-01T00:00:00.000Z', 's_wild', 100, 0),
    ql('2026-04-02T00:00:00.000Z', 's_wild', 50, 50),
    ql('2026-04-03T00:00:00.000Z', 's_wild', 0, 100),
  ];
  const r = buildSourceReasoningShareByDayCv(q, {
    generatedAt: GEN,
    minDays: 1,
    sort: 'cv',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 's_stable');
  assert.equal(r.sources[1]!.source, 's_wild');
  assert.ok(r.sources[1]!.shareCv > r.sources[0]!.shareCv);
});

test('source-reasoning-share-by-day-cv: top cap', () => {
  const q: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 1; d <= 3; d += 1) {
      const dd = String(d).padStart(2, '0');
      q.push(ql(`2026-04-${dd}T00:00:00.000Z`, src, 100, 10));
    }
  }
  // Make 'b' have the most tokens
  q.push(ql('2026-04-04T00:00:00.000Z', 'b', 10000, 0));
  const r = buildSourceReasoningShareByDayCv(q, {
    generatedAt: GEN,
    minDays: 1,
    top: 1,
    sort: 'tokens',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
  assert.equal(r.droppedBelowTopCap, 2);
});

test('source-reasoning-share-by-day-cv: source-asc final tiebreak deterministic', () => {
  const q: QueueLine[] = [];
  for (const src of ['z', 'a', 'm']) {
    for (let d = 1; d <= 3; d += 1) {
      const dd = String(d).padStart(2, '0');
      // identical share => identical tokens => tiebreak by source asc
      q.push(ql(`2026-04-${dd}T00:00:00.000Z`, src, 80, 20));
    }
  }
  const r = buildSourceReasoningShareByDayCv(q, {
    generatedAt: GEN,
    minDays: 1,
    sort: 'cv',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});

test('source-reasoning-share-by-day-cv: singleSample flag when daysWithShare === 1', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 80, 20),
  ];
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.singleSample, true);
});

test('source-reasoning-share-by-day-cv: negative/NaN tokens treated as 0', () => {
  const bad: QueueLine = {
    source: 's1',
    model: 'm1',
    hour_start: '2026-04-01T00:00:00.000Z',
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: -5,
    reasoning_output_tokens: Number.NaN,
    total_tokens: 0,
  };
  const q: QueueLine[] = [
    bad,
    ql('2026-04-02T00:00:00.000Z', 's1', 80, 20),
    ql('2026-04-03T00:00:00.000Z', 's1', 80, 20),
  ];
  const r = buildSourceReasoningShareByDayCv(q, { generatedAt: GEN, minDays: 1 });
  const s = r.sources[0]!;
  // bad row's day has out=0,reas=0 -> dropped from share sequence
  assert.equal(s.daysWithZeroReply, 1);
  assert.equal(s.daysWithShare, 2);
});
