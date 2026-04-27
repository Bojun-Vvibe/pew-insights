import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceSameModelStreak } from '../src/sourcesamemodelstreak.js';
import type { QueueLine } from '../src/types.js';

function ql(hour_start: string, source: string, model: string): QueueLine {
  return {
    source,
    model,
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('same-model-streak: empty input -> empty report with defaults', () => {
  const r = buildSourceSameModelStreak([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalRowsKept, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minRows, 2);
  assert.equal(r.minStreak, 1);
  assert.equal(r.minRatio, 0);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'streak-desc');
  assert.equal(r.generatedAt, GEN);
});

test('same-model-streak: rejects bad minRows / minStreak / minRatio', () => {
  assert.throws(() => buildSourceSameModelStreak([], { minRows: 0 }));
  assert.throws(() => buildSourceSameModelStreak([], { minRows: 1.5 }));
  assert.throws(() => buildSourceSameModelStreak([], { minStreak: 0 }));
  assert.throws(() => buildSourceSameModelStreak([], { minStreak: 2.5 }));
  assert.throws(() => buildSourceSameModelStreak([], { minRatio: -0.1 }));
  assert.throws(() => buildSourceSameModelStreak([], { minRatio: 1.1 }));
  assert.throws(() =>
    buildSourceSameModelStreak([], { minRatio: Number.NaN }),
  );
});

test('same-model-streak: rejects bad top / sort / since / until', () => {
  assert.throws(() => buildSourceSameModelStreak([], { top: 0 }));
  assert.throws(() => buildSourceSameModelStreak([], { top: -3 }));
  assert.throws(() => buildSourceSameModelStreak([], { top: 1.7 }));
  assert.throws(() =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    buildSourceSameModelStreak([], { sort: 'bogus' as any }),
  );
  assert.throws(() => buildSourceSameModelStreak([], { since: 'nope' }));
  assert.throws(() => buildSourceSameModelStreak([], { until: 'nope' }));
});

test('same-model-streak: bad hour_start increments dropped counter', () => {
  const q = [
    ql('not-a-date', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalRowsKept, 2);
});

test('same-model-streak: all-equal model -> longestStreak == rowsKept, ratio=1', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'a', 'm1'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'a');
  assert.equal(row.rowsKept, 4);
  assert.equal(row.streakCount, 1);
  assert.equal(row.longestStreak, 4);
  assert.equal(row.longestStreakRatio, 1);
  assert.equal(row.meanStreakLength, 4);
  assert.equal(row.longestStreakModel, 'm1');
});

test('same-model-streak: model rotates every row -> longestStreak=1, streakCount=n', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm2'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'a', 'm2'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestStreak, 1);
  assert.equal(row.streakCount, 4);
  assert.equal(row.longestStreakRatio, 0.25);
  assert.equal(row.meanStreakLength, 1);
  // Tiebreak: earliest model id wins among streaks of length 1.
  assert.equal(row.longestStreakModel, 'm1');
});

test('same-model-streak: classic mixed timeline', () => {
  // m1, m1, m1, m2, m2, m1 -> streaks [3, 2, 1] -> longest=3 (m1)
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'a', 'm2'),
    ql('2026-04-27T04:00:00.000Z', 'a', 'm2'),
    ql('2026-04-27T05:00:00.000Z', 'a', 'm1'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 6);
  assert.equal(row.streakCount, 3);
  assert.equal(row.longestStreak, 3);
  assert.equal(row.longestStreakModel, 'm1');
  assert.ok(Math.abs(row.longestStreakRatio - 0.5) < 1e-12);
  assert.equal(row.meanStreakLength, 2);
});

test('same-model-streak: input order does not matter (sorts by hour_start)', () => {
  const q = [
    ql('2026-04-27T05:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'a', 'm2'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T04:00:00.000Z', 'a', 'm2'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  // Same canonical timeline as previous test.
  assert.equal(row.longestStreak, 3);
  assert.equal(row.longestStreakModel, 'm1');
});

test('same-model-streak: empty model coerced to "unknown"', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', ''),
    ql('2026-04-27T01:00:00.000Z', 'a', ''),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.longestStreakModel, 'unknown');
  assert.equal(row.longestStreak, 2);
});

test('same-model-streak: minRows filter drops below threshold', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'b', 'm2'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN, minRows: 2 });
  assert.equal(r.droppedBelowMinRows, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('same-model-streak: minRatio filter selects model-locked cohort', () => {
  // a: all m1 (ratio=1.0). b: m1,m2 (ratio=0.5).
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'b', 'm2'),
  ];
  const r = buildSourceSameModelStreak(q, {
    generatedAt: GEN,
    minRatio: 0.9,
  });
  assert.equal(r.droppedBelowMinRatio, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
});

test('same-model-streak: top cap applied after sort', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'b', 'm2'),
    ql('2026-04-27T00:00:00.000Z', 'c', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'c', 'm2'),
    ql('2026-04-27T02:00:00.000Z', 'c', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'c', 'm2'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN, top: 1 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a'); // longestStreak=3 wins
  assert.equal(r.droppedBelowTopCap, 2);
});

test('same-model-streak: sort variants', () => {
  const q = [
    // a: longest=3, ratio=1.0
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
    // b: longest=1, ratio=0.5 (2 rows, alternating)
    ql('2026-04-27T00:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'b', 'm2'),
  ];
  const desc = buildSourceSameModelStreak(q, { generatedAt: GEN, sort: 'streak-desc' });
  assert.deepEqual(desc.sources.map((s) => s.source), ['a', 'b']);
  const asc = buildSourceSameModelStreak(q, { generatedAt: GEN, sort: 'streak-asc' });
  assert.deepEqual(asc.sources.map((s) => s.source), ['b', 'a']);
  const sw = buildSourceSameModelStreak(q, { generatedAt: GEN, sort: 'switches' });
  // b has 2 streaks > a has 1.
  assert.deepEqual(sw.sources.map((s) => s.source), ['b', 'a']);
});

test('same-model-streak: source filter narrows to one source', () => {
  const q = [
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'b', 'm2'),
    ql('2026-04-27T01:00:00.000Z', 'b', 'm2'),
  ];
  const r = buildSourceSameModelStreak(q, { generatedAt: GEN, source: 'b' });
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});

test('same-model-streak: since/until window filters', () => {
  const q = [
    ql('2026-04-26T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm2'),
    ql('2026-04-28T00:00:00.000Z', 'a', 'm1'),
  ];
  const r = buildSourceSameModelStreak(q, {
    generatedAt: GEN,
    since: '2026-04-27T00:00:00.000Z',
    until: '2026-04-28T00:00:00.000Z',
  });
  // Only the 2 middle rows survive.
  assert.equal(r.totalRowsKept, 2);
  const row = r.sources[0]!;
  assert.equal(row.rowsKept, 2);
  assert.equal(row.streakCount, 2);
  assert.equal(row.longestStreak, 1);
});

test('same-model-streak: minMeanStreak rejects bad values', () => {
  assert.throws(() => buildSourceSameModelStreak([], { minMeanStreak: 0.5 }));
  assert.throws(() => buildSourceSameModelStreak([], { minMeanStreak: -1 }));
  assert.throws(() =>
    buildSourceSameModelStreak([], { minMeanStreak: Number.POSITIVE_INFINITY }),
  );
  assert.throws(() =>
    buildSourceSameModelStreak([], { minMeanStreak: Number.NaN }),
  );
});

test('same-model-streak: minMeanStreak defaults to 1 in report', () => {
  const r = buildSourceSameModelStreak([], { generatedAt: GEN });
  assert.equal(r.minMeanStreak, 1);
  assert.equal(r.droppedBelowMinMeanStreak, 0);
});

test('same-model-streak: minMeanStreak filter is orthogonal to minRatio', () => {
  // a: 9 rows of m1 + 1 of m2 -> rowsKept=10, streakCount=2,
  //   longestStreak=9, longestStreakRatio=0.9, meanStreakLength=5.0
  // b: m1 m2 m1 m2 m1 m2 m1 m2 m1 m1 -> rowsKept=10, streakCount=9,
  //   longestStreak=2 (m1 at the end), ratio=0.2, meanStreak=10/9~1.11
  const q = [
    // a: 9 m1, then 1 m2
    ql('2026-04-27T00:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T02:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T04:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T05:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T06:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T07:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T08:00:00.000Z', 'a', 'm1'),
    ql('2026-04-27T09:00:00.000Z', 'a', 'm2'),
    // b: alternating with a m1,m1 pair at the end
    ql('2026-04-27T00:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T01:00:00.000Z', 'b', 'm2'),
    ql('2026-04-27T02:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T03:00:00.000Z', 'b', 'm2'),
    ql('2026-04-27T04:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T05:00:00.000Z', 'b', 'm2'),
    ql('2026-04-27T06:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T07:00:00.000Z', 'b', 'm2'),
    ql('2026-04-27T08:00:00.000Z', 'b', 'm1'),
    ql('2026-04-27T09:00:00.000Z', 'b', 'm1'),
  ];
  // Sanity check the underlying numbers first.
  const base = buildSourceSameModelStreak(q, { generatedAt: GEN });
  const aRow = base.sources.find((s) => s.source === 'a')!;
  const bRow = base.sources.find((s) => s.source === 'b')!;
  assert.equal(aRow.longestStreak, 9);
  assert.equal(aRow.streakCount, 2);
  assert.equal(aRow.meanStreakLength, 5);
  assert.ok(Math.abs(aRow.longestStreakRatio - 0.9) < 1e-12);
  assert.equal(bRow.longestStreak, 2);
  assert.equal(bRow.streakCount, 9);
  assert.ok(Math.abs(bRow.meanStreakLength - 10 / 9) < 1e-12);

  // Gating on minRatio=0.5 keeps a, drops b.
  const ratio = buildSourceSameModelStreak(q, {
    generatedAt: GEN,
    minRatio: 0.5,
  });
  assert.deepEqual(ratio.sources.map((s) => s.source), ['a']);
  assert.equal(ratio.droppedBelowMinRatio, 1);

  // Gating on minMeanStreak=2 keeps a (mean=5), drops b (mean~1.11).
  const meanGate = buildSourceSameModelStreak(q, {
    generatedAt: GEN,
    minMeanStreak: 2,
  });
  assert.deepEqual(meanGate.sources.map((s) => s.source), ['a']);
  assert.equal(meanGate.droppedBelowMinMeanStreak, 1);

  // Gating on minMeanStreak=6 drops both — orthogonality demonstrated:
  //   a still has ratio=0.9 (would survive minRatio=0.9) but mean=5 < 6.
  const tight = buildSourceSameModelStreak(q, {
    generatedAt: GEN,
    minMeanStreak: 6,
  });
  assert.equal(tight.sources.length, 0);
  assert.equal(tight.droppedBelowMinMeanStreak, 2);
});
