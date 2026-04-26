import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceCumulativeMassHalfLifeDay } from '../src/sourcecumulativemasshalflifeday.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens,
  };
}

const GEN = '2026-04-27T12:00:00.000Z';

test('source-cumulative-mass-half-life-day: empty input -> empty report', () => {
  const r = buildSourceCumulativeMassHalfLifeDay([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 2);
  assert.equal(r.maxHalfLifeRatio, 1);
  assert.equal(r.maxHalfLifeDays, null);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'half');
});

test('source-cumulative-mass-half-life-day: rejects bad minDays', () => {
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { minDays: 0 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { minDays: -1 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { minDays: 1.5 }),
  );
});

test('source-cumulative-mass-half-life-day: rejects bad maxHalfLifeRatio', () => {
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: 0 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: -0.1 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: 1.1 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: Number.NaN }),
  );
});

test('source-cumulative-mass-half-life-day: rejects bad maxHalfLifeDays', () => {
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeDays: 0 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeDays: -1 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeDays: 1.5 }),
  );
});

test('source-cumulative-mass-half-life-day: maxHalfLifeDays=2 keeps only sources whose half clears within 2 days', () => {
  // s1: heavy-headed (half=1 in 4 days)  -> kept
  // s2: uniform 4d (half=2 in 4 days)    -> kept
  // s3: uniform 8d (half=4 in 8 days)    -> dropped
  const q: QueueLine[] = [];
  q.push(ql('2026-04-01T00:00:00.000Z', 's1', 800));
  q.push(ql('2026-04-02T00:00:00.000Z', 's1', 100));
  q.push(ql('2026-04-03T00:00:00.000Z', 's1', 50));
  q.push(ql('2026-04-04T00:00:00.000Z', 's1', 50));
  for (let i = 1; i <= 4; i++) {
    q.push(ql(`2026-04-0${i}T00:00:00.000Z`, 's2', 100));
  }
  for (let i = 1; i <= 8; i++) {
    q.push(ql(`2026-04-0${i}T00:00:00.000Z`, 's3', 100));
  }
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    maxHalfLifeDays: 2,
  });
  assert.equal(r.sources.length, 2);
  const surviving = r.sources.map((s) => s.source).sort();
  assert.deepEqual(surviving, ['s1', 's2']);
  assert.equal(r.droppedAboveMaxHalfLifeDays, 1);
});

test('source-cumulative-mass-half-life-day: maxHalfLifeDays composes orthogonally with maxHalfLifeRatio', () => {
  // s1: heavy-headed 4d -> half=1, ratio=0.25
  // s2: uniform 4d      -> half=2, ratio=0.5
  // s3: uniform 100d    -> half=50, ratio=0.5
  // With max-half-days=10 and max-half-ratio=0.6:
  //   s1 passes both, s2 passes both, s3 fails the absolute cap
  //   (half=50 > 10) but would pass the ratio cap (0.5 <= 0.6).
  const q: QueueLine[] = [];
  q.push(ql('2026-04-01T00:00:00.000Z', 's1', 800));
  q.push(ql('2026-04-02T00:00:00.000Z', 's1', 100));
  q.push(ql('2026-04-03T00:00:00.000Z', 's1', 50));
  q.push(ql('2026-04-04T00:00:00.000Z', 's1', 50));
  for (let i = 1; i <= 4; i++) {
    q.push(ql(`2026-04-0${i}T00:00:00.000Z`, 's2', 100));
  }
  for (let i = 0; i < 100; i++) {
    const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString();
    q.push(ql(d, 's3', 100));
  }
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    maxHalfLifeDays: 10,
    maxHalfLifeRatio: 0.6,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedAboveMaxHalfLifeDays, 1);
});

test('source-cumulative-mass-half-life-day: rejects bad maxHalfLifeRatio (still rejects)', () => {
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: 0 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: -0.1 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: 1.1 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { maxHalfLifeRatio: Number.NaN }),
  );
});

test('source-cumulative-mass-half-life-day: rejects bad top', () => {
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { top: 1.5 }),
  );
});

test('source-cumulative-mass-half-life-day: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceCumulativeMassHalfLifeDay([], { sort: 'bogus' }),
  );
});

test('source-cumulative-mass-half-life-day: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceCumulativeMassHalfLifeDay([], { until: 'also-bad' }),
  );
});

test('source-cumulative-mass-half-life-day: single-day source -> all life=1, ratio=1', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T01:00:00.000Z', 's1', 50),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    minDays: 1,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 1);
  assert.equal(s.tokenSum, 150);
  assert.equal(s.quartileLifeDays, 1);
  assert.equal(s.halfLifeDays, 1);
  assert.equal(s.threeQuarterLifeDays, 1);
  assert.equal(s.top1Share, 1);
  assert.equal(s.top3Share, 1);
  assert.equal(s.halfLifeRatio, 1);
});

test('source-cumulative-mass-half-life-day: uniform 4 days -> half=2 (50% reached at top-2)', () => {
  // 4 days, 100 each: cum shares 0.25, 0.50, 0.75, 1.00
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
    ql('2026-04-04T00:00:00.000Z', 's1', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 4);
  assert.equal(s.tokenSum, 400);
  // cum at k=1 is 0.25 -> q25 hits at 1
  assert.equal(s.quartileLifeDays, 1);
  // cum at k=2 is 0.50 -> half hits at 2
  assert.equal(s.halfLifeDays, 2);
  // cum at k=3 is 0.75 -> q75 hits at 3
  assert.equal(s.threeQuarterLifeDays, 3);
  assert.equal(s.top1Share, 0.25);
  assert.equal(s.top3Share, 0.75);
  assert.equal(s.halfLifeRatio, 0.5);
});

test('source-cumulative-mass-half-life-day: heavy-headed 4 days -> half=1', () => {
  // 800 + 100 + 50 + 50; total 1000.
  // top1 share = 0.8 -> q25, half, q75 all hit at k=1.
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 800),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 50),
    ql('2026-04-04T00:00:00.000Z', 's1', 50),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 4);
  assert.equal(s.tokenSum, 1000);
  assert.equal(s.quartileLifeDays, 1);
  assert.equal(s.halfLifeDays, 1);
  assert.equal(s.threeQuarterLifeDays, 1);
  assert.equal(s.top1Share, 0.8);
  assert.equal(s.top3Share, 0.95);
  assert.equal(s.halfLifeRatio, 0.25);
});

test('source-cumulative-mass-half-life-day: tie-broken-day-asc determinism', () => {
  // Two equal-mass days; sort tiebreak should be day asc, so the
  // earlier date is "max day" (top1). The result is rotation-invariant
  // (cum shares don't care which equal day is first), but it makes
  // the report deterministic across runs.
  const q = [
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 50),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 3);
  assert.equal(s.tokenSum, 250);
  // cum at k=1 = 100/250 = 0.4 -> q25 at 1, half at 2 (200/250=0.8), q75 at 2
  assert.equal(s.quartileLifeDays, 1);
  assert.equal(s.halfLifeDays, 2);
  assert.equal(s.threeQuarterLifeDays, 2);
});

test('source-cumulative-mass-half-life-day: minDays filter drops single-day sources by default', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    // s2 has 2 days
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
    ql('2026-04-03T00:00:00.000Z', 's2', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  // Default minDays = 2: s1 dropped.
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('source-cumulative-mass-half-life-day: maxHalfLifeRatio filter keeps only concentrated sources', () => {
  // s1: heavy-headed (halfLifeRatio = 0.25 in 4 days)
  // s2: uniform (halfLifeRatio = 0.5 in 4 days)
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 800),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 50),
    ql('2026-04-04T00:00:00.000Z', 's1', 50),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
    ql('2026-04-03T00:00:00.000Z', 's2', 100),
    ql('2026-04-04T00:00:00.000Z', 's2', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    maxHalfLifeRatio: 0.3,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedAboveMaxHalfLifeRatio, 1);
});

test('source-cumulative-mass-half-life-day: source filter restricts to one source', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    source: 's1',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 2);
});

test('source-cumulative-mass-half-life-day: window filter excludes out-of-range rows', () => {
  const q = [
    ql('2026-03-31T00:00:00.000Z', 's1', 100), // before window
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100), // at/past until
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-03T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.tokenSum, 200);
  assert.equal(r.sources[0]!.daysActive, 2);
});

test('source-cumulative-mass-half-life-day: drops invalid hour_start', () => {
  const q: QueueLine[] = [
    { ...ql('2026-04-01T00:00:00.000Z', 's1', 100) },
    { ...ql('garbage', 's1', 100) },
    { ...ql('2026-04-02T00:00:00.000Z', 's1', 100) },
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources[0]!.daysActive, 2);
});

test('source-cumulative-mass-half-life-day: zero-mass and negative tokens dropped per row', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 0),
    ql('2026-04-01T00:00:00.000Z', 's1', -50),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  // s1 should still survive with 2 active days, 200 tokens.
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.tokenSum, 200);
  assert.equal(r.sources[0]!.daysActive, 2);
});

test('source-cumulative-mass-half-life-day: sort by ratio asc orders most-concentrated first', () => {
  // s1: ratio 0.25 (heavy-headed); s2: ratio 0.5 (uniform 4d);
  // s3: ratio = 1/2 in 2d (uniform 2d)
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 800),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 50),
    ql('2026-04-04T00:00:00.000Z', 's1', 50),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
    ql('2026-04-03T00:00:00.000Z', 's2', 100),
    ql('2026-04-04T00:00:00.000Z', 's2', 100),
    ql('2026-04-01T00:00:00.000Z', 's3', 100),
    ql('2026-04-02T00:00:00.000Z', 's3', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    sort: 'ratio',
  });
  // s1 ratio=0.25, s2/s3 both ratio=0.5 (tiebreak by source asc -> s2, s3).
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.sources[1]!.source, 's2');
  assert.equal(r.sources[2]!.source, 's3');
});

test('source-cumulative-mass-half-life-day: top cap drops tail and reports count', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
    ql('2026-04-01T00:00:00.000Z', 's3', 100),
    ql('2026-04-02T00:00:00.000Z', 's3', 100),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-cumulative-mass-half-life-day: thresholds are monotone (q25 <= half <= q75)', () => {
  // Random-ish dist; the property is structural.
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 500),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 150),
    ql('2026-04-04T00:00:00.000Z', 's1', 80),
    ql('2026-04-05T00:00:00.000Z', 's1', 40),
    ql('2026-04-06T00:00:00.000Z', 's1', 20),
    ql('2026-04-07T00:00:00.000Z', 's1', 10),
  ];
  const r = buildSourceCumulativeMassHalfLifeDay(q, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.ok(s.quartileLifeDays <= s.halfLifeDays);
  assert.ok(s.halfLifeDays <= s.threeQuarterLifeDays);
  assert.ok(s.halfLifeDays >= 1 && s.halfLifeDays <= s.daysActive);
  assert.ok(s.halfLifeRatio > 0 && s.halfLifeRatio <= 1);
});
