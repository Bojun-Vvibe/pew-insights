import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceSingleDayMassConcentration } from '../src/sourcesingledaymassconcentration.js';
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

const GEN = '2026-04-26T12:00:00.000Z';

test('source-single-day-mass-concentration: empty input -> empty report', () => {
  const r = buildSourceSingleDayMassConcentration([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 3);
  assert.equal(r.top, null);
  assert.equal(r.sort, 'tokens');
});

test('source-single-day-mass-concentration: rejects bad minDays', () => {
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { minDays: 0 }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { minDays: -1 }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { minDays: 1.5 }),
  );
});

test('source-single-day-mass-concentration: rejects bad top', () => {
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { top: 0 }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { top: -1 }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { top: 1.5 }),
  );
});

test('source-single-day-mass-concentration: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceSingleDayMassConcentration([], { sort: 'bogus' }),
  );
});

test('source-single-day-mass-concentration: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { until: 'also-bad' }),
  );
});

test('source-single-day-mass-concentration: single-day source -> all shares 1.0', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T01:00:00.000Z', 's1', 50),
    ql('2026-04-01T02:00:00.000Z', 's1', 50),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    minDays: 1,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 1);
  assert.equal(s.tokenSum, 200);
  assert.equal(s.maxDay, '2026-04-01');
  assert.equal(s.maxDayTokens, 200);
  assert.equal(s.maxDayShare, 1);
  assert.equal(s.top2Share, 1);
  assert.equal(s.top3Share, 1);
  assert.equal(s.hhi, 1);
  assert.equal(s.singleDay, true);
});

test('source-single-day-mass-concentration: uniform N days -> maxShare=1/N, hhi=1/N', () => {
  // 5 days, 100 tokens each
  const q: QueueLine[] = [];
  for (let i = 1; i <= 5; i += 1) {
    q.push(
      ql(`2026-04-0${i}T00:00:00.000Z`, 's1', 100),
    );
  }
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    minDays: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 5);
  assert.equal(s.tokenSum, 500);
  assert.equal(s.maxDayTokens, 100);
  assert.equal(s.maxDayShare, 0.2);
  assert.equal(s.top2Share, 0.4);
  assert.equal(s.top3Share, 0.6);
  // hhi = 5 * 0.2^2 = 0.2
  assert.ok(Math.abs(s.hhi - 0.2) < 1e-12);
  assert.equal(s.singleDay, false);
});

test('source-single-day-mass-concentration: skewed days -> maxShare correct', () => {
  // day1=700, day2=200, day3=100 -> total 1000
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 700),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 3);
  assert.equal(s.tokenSum, 1000);
  assert.equal(s.maxDay, '2026-04-01');
  assert.equal(s.maxDayShare, 0.7);
  assert.equal(s.top2Share, 0.9);
  assert.equal(s.top3Share, 1);
  // hhi = 0.49 + 0.04 + 0.01 = 0.54
  assert.ok(Math.abs(s.hhi - 0.54) < 1e-12);
});

test('source-single-day-mass-concentration: rows aggregate per UTC day', () => {
  // multiple rows on same day get summed before max-share computation
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 300),
    ql('2026-04-01T12:00:00.000Z', 's1', 400),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.tokenSum, 1000);
  assert.equal(s.maxDay, '2026-04-01');
  assert.equal(s.maxDayTokens, 700);
  assert.equal(s.maxDayShare, 0.7);
});

test('source-single-day-mass-concentration: ignores zero/negative/non-finite total_tokens', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 0),
    ql('2026-04-03T00:00:00.000Z', 's1', -5),
    {
      source: 's1',
      model: 'm',
      hour_start: '2026-04-04T00:00:00.000Z',
      device_id: 'd',
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: Number.NaN,
    } as QueueLine,
    ql('2026-04-05T00:00:00.000Z', 's1', 200),
    ql('2026-04-06T00:00:00.000Z', 's1', 50),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.equal(s.daysActive, 3);
  assert.equal(s.tokenSum, 350);
  assert.equal(s.maxDay, '2026-04-05');
  assert.equal(s.maxDayTokens, 200);
});

test('source-single-day-mass-concentration: dropped invalid hour_start counted', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    {
      source: 's1',
      model: 'm',
      hour_start: 'garbage',
      device_id: 'd',
      input_tokens: 0,
      cached_input_tokens: 0,
      output_tokens: 0,
      reasoning_output_tokens: 0,
      total_tokens: 999,
    } as QueueLine,
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    minDays: 1,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalTokens, 100);
});

test('source-single-day-mass-concentration: source filter routes non-matches to droppedSourceFilter', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's2', 999),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    source: 's1',
    minDays: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.totalTokens, 200);
  assert.equal(r.source, 's1');
});

test('source-single-day-mass-concentration: since/until window applied', () => {
  const q = [
    ql('2026-03-30T00:00:00.000Z', 's1', 100), // before since
    ql('2026-04-01T00:00:00.000Z', 's1', 200),
    ql('2026-04-02T00:00:00.000Z', 's1', 300),
    ql('2026-04-05T00:00:00.000Z', 's1', 400), // at/after until
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-05T00:00:00.000Z',
    minDays: 1,
  });
  const s = r.sources[0]!;
  assert.equal(s.tokenSum, 500);
  assert.equal(s.daysActive, 2);
  assert.equal(s.maxDay, '2026-04-02');
});

test('source-single-day-mass-concentration: minDays gates correctly', () => {
  const q = [
    // s1: 4 days
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
    ql('2026-04-04T00:00:00.000Z', 's1', 100),
    // s2: 2 days (below default min-days 3)
    ql('2026-04-01T00:00:00.000Z', 's2', 50),
    ql('2026-04-02T00:00:00.000Z', 's2', 50),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('source-single-day-mass-concentration: top cap applied after sort', () => {
  const q: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 1; d <= 4; d += 1) {
      q.push(
        ql(
          `2026-04-0${d}T00:00:00.000Z`,
          src,
          src === 'a' ? 1000 : src === 'b' ? 500 : 100,
        ),
      );
    }
  }
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
  assert.equal(r.droppedBelowTopCap, 1);
});

test('source-single-day-mass-concentration: sort by maxshare', () => {
  // s1 is concentrated (maxShare ~ 0.875), s2 is uniform (maxShare = 0.25)
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 700),
    ql('2026-04-02T00:00:00.000Z', 's1', 50),
    ql('2026-04-03T00:00:00.000Z', 's1', 25),
    ql('2026-04-04T00:00:00.000Z', 's1', 25),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
    ql('2026-04-03T00:00:00.000Z', 's2', 100),
    ql('2026-04-04T00:00:00.000Z', 's2', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    sort: 'maxshare',
  });
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.sources[1]!.source, 's2');
});

test('source-single-day-mass-concentration: deterministic source-key tiebreak', () => {
  // two sources with identical tokenSum -> sort 'tokens' tiebreaks on source asc
  const q = [
    ql('2026-04-01T00:00:00.000Z', 'beta', 100),
    ql('2026-04-02T00:00:00.000Z', 'beta', 100),
    ql('2026-04-03T00:00:00.000Z', 'beta', 100),
    ql('2026-04-01T00:00:00.000Z', 'alpha', 100),
    ql('2026-04-02T00:00:00.000Z', 'alpha', 100),
    ql('2026-04-03T00:00:00.000Z', 'alpha', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
  });
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'beta');
});

test('source-single-day-mass-concentration: hhi within [1/N, 1] bounds', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 700),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 50),
    ql('2026-04-04T00:00:00.000Z', 's1', 50),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
  });
  const s = r.sources[0]!;
  assert.ok(s.hhi >= 1 / s.daysActive - 1e-12);
  assert.ok(s.hhi <= 1 + 1e-12);
});

test('source-single-day-mass-concentration: rejects bad minMaxShare', () => {
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { minMaxShare: -0.1 }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { minMaxShare: 1.5 }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], {
      minMaxShare: Number.POSITIVE_INFINITY,
    }),
  );
  assert.throws(() =>
    buildSourceSingleDayMassConcentration([], { minMaxShare: Number.NaN }),
  );
});

test('source-single-day-mass-concentration: minMaxShare gates per-source', () => {
  // s1: maxShare = 0.7, s2: maxShare = 0.25
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 700),
    ql('2026-04-02T00:00:00.000Z', 's1', 200),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
    ql('2026-04-01T00:00:00.000Z', 's2', 100),
    ql('2026-04-02T00:00:00.000Z', 's2', 100),
    ql('2026-04-03T00:00:00.000Z', 's2', 100),
    ql('2026-04-04T00:00:00.000Z', 's2', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    minMaxShare: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedBelowMinMaxShare, 1);
  assert.equal(r.minMaxShare, 0.5);
});

test('source-single-day-mass-concentration: minMaxShare 0 = no floor (default)', () => {
  const q = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100),
    ql('2026-04-03T00:00:00.000Z', 's1', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedBelowMinMaxShare, 0);
  assert.equal(r.minMaxShare, 0);
});

test('source-single-day-mass-concentration: minMaxShare 1.0 keeps only single-day sources', () => {
  const q = [
    // single-day source: maxShare = 1
    ql('2026-04-01T00:00:00.000Z', 'one'),
    ql('2026-04-01T01:00:00.000Z', 'one', 100),
    ql('2026-04-01T02:00:00.000Z', 'one', 100),
    // multi-day source: maxShare < 1
    ql('2026-04-01T00:00:00.000Z', 'multi', 100),
    ql('2026-04-02T00:00:00.000Z', 'multi', 100),
  ];
  // ql signature is (hour_start, source, total_tokens=...) so above
  // 'one' first call needs explicit tokens — fix below by retyping
  const q2 = [
    ql('2026-04-01T00:00:00.000Z', 'one', 100),
    ql('2026-04-01T01:00:00.000Z', 'one', 100),
    ql('2026-04-01T02:00:00.000Z', 'one', 100),
    ql('2026-04-01T00:00:00.000Z', 'multi', 100),
    ql('2026-04-02T00:00:00.000Z', 'multi', 100),
  ];
  void q;
  const r = buildSourceSingleDayMassConcentration(q2, {
    generatedAt: GEN,
    minDays: 1,
    minMaxShare: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'one');
  assert.equal(r.sources[0]!.maxDayShare, 1);
  assert.equal(r.droppedBelowMinMaxShare, 1);
});

test('source-single-day-mass-concentration: minMaxShare composes after minDays', () => {
  const q = [
    // s1: 2 days (below default minDays=3) with maxShare=0.6 -> dropped by minDays first
    ql('2026-04-01T00:00:00.000Z', 's1', 600),
    ql('2026-04-02T00:00:00.000Z', 's1', 400),
    // s2: 4 days, maxShare = 0.4 -> survives minDays, dropped by minMaxShare 0.5
    ql('2026-04-01T00:00:00.000Z', 's2', 400),
    ql('2026-04-02T00:00:00.000Z', 's2', 300),
    ql('2026-04-03T00:00:00.000Z', 's2', 200),
    ql('2026-04-04T00:00:00.000Z', 's2', 100),
    // s3: 3 days, maxShare = 0.7 -> survives both
    ql('2026-04-01T00:00:00.000Z', 's3', 700),
    ql('2026-04-02T00:00:00.000Z', 's3', 200),
    ql('2026-04-03T00:00:00.000Z', 's3', 100),
  ];
  const r = buildSourceSingleDayMassConcentration(q, {
    generatedAt: GEN,
    minMaxShare: 0.5,
  });
  assert.equal(r.droppedBelowMinDays, 1);
  assert.equal(r.droppedBelowMinMaxShare, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's3');
});
