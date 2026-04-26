import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildSourceIoRatioStability } from '../src/sourceioratiostability.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  input_tokens: number,
  output_tokens: number,
): QueueLine {
  return {
    source,
    model: 'm1',
    hour_start,
    device_id: 'd1',
    input_tokens,
    cached_input_tokens: 0,
    output_tokens,
    reasoning_output_tokens: 0,
    total_tokens: input_tokens + output_tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

test('source-io-ratio-stability: empty input → empty report', () => {
  const r = buildSourceIoRatioStability([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.sources.length, 0);
  assert.equal(r.minDays, 3);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.top, null);
});

test('source-io-ratio-stability: rejects bad minDays', () => {
  assert.throws(() => buildSourceIoRatioStability([], { minDays: 0 }));
  assert.throws(() => buildSourceIoRatioStability([], { minDays: -1 }));
  assert.throws(() => buildSourceIoRatioStability([], { minDays: 1.5 }));
});

test('source-io-ratio-stability: rejects bad top', () => {
  assert.throws(() => buildSourceIoRatioStability([], { top: 0 }));
  assert.throws(() => buildSourceIoRatioStability([], { top: -1 }));
  assert.throws(() => buildSourceIoRatioStability([], { top: 1.5 }));
});

test('source-io-ratio-stability: rejects bad sort', () => {
  assert.throws(() =>
    // @ts-expect-error invalid sort
    buildSourceIoRatioStability([], { sort: 'bogus' }),
  );
});

test('source-io-ratio-stability: rejects bad since/until', () => {
  assert.throws(() =>
    buildSourceIoRatioStability([], { since: 'not-a-date' }),
  );
  assert.throws(() =>
    buildSourceIoRatioStability([], { until: 'also-bad' }),
  );
});

test('source-io-ratio-stability: perfectly stable source -> ratioCv = 0', () => {
  // 5 days, every day in=100 out=50 -> ratio = 0.5 every day
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 's1', 100, 50));
  }
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysWithRatio, 5);
  assert.equal(s.daysWithZeroInput, 0);
  assert.equal(s.meanRatio, 0.5);
  assert.equal(s.stdRatio, 0);
  assert.equal(s.ratioCv, 0);
  assert.equal(s.flatLine, false);
  assert.equal(s.singleSample, false);
});

test('source-io-ratio-stability: alternating ratios -> nonzero CV computed correctly', () => {
  // ratios: 1.0, 0.0, 1.0, 0.0 -> mean = 0.5, var = 0.25, std = 0.5, cv = 1.0
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100, 100),
    ql('2026-04-02T00:00:00.000Z', 's1', 100, 0),
    ql('2026-04-03T00:00:00.000Z', 's1', 100, 100),
    ql('2026-04-04T00:00:00.000Z', 's1', 100, 0),
  ];
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysWithRatio, 4);
  assert.equal(s.meanRatio, 0.5);
  assert.equal(Number(s.stdRatio.toFixed(6)), 0.5);
  assert.equal(Number(s.ratioCv.toFixed(6)), 1.0);
  assert.equal(s.flatLine, false);
});

test('source-io-ratio-stability: zero-input day excluded from ratio sequence but counted', () => {
  // day 1: in=100 out=50, day 2: in=0 out=0, day 3: in=200 out=100
  // ratios: 0.5, 0.5 -> mean 0.5, std 0, cv 0
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100, 50),
    ql('2026-04-02T00:00:00.000Z', 's1', 0, 0),
    ql('2026-04-03T00:00:00.000Z', 's1', 200, 100),
  ];
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.activeDays, 3);
  assert.equal(s.daysWithRatio, 2);
  assert.equal(s.daysWithZeroInput, 1);
  assert.equal(s.meanRatio, 0.5);
  assert.equal(s.ratioCv, 0);
});

test('source-io-ratio-stability: flat-line zero output → flatLine=true, cv=0', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 100, 0),
    ql('2026-04-02T00:00:00.000Z', 's1', 200, 0),
    ql('2026-04-03T00:00:00.000Z', 's1', 300, 0),
  ];
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysWithRatio, 3);
  assert.equal(s.meanRatio, 0);
  assert.equal(s.ratioCv, 0);
  assert.equal(s.flatLine, true);
});

test('source-io-ratio-stability: minDays floor drops sparse sources', () => {
  // s1: 4 ratio days, s2: 2 ratio days -> minDays=3 drops s2
  const q: QueueLine[] = [];
  for (let d = 1; d <= 4; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 's1', 100, 50));
  }
  q.push(ql('2026-04-01T00:00:00.000Z', 's2', 100, 80));
  q.push(ql('2026-04-02T00:00:00.000Z', 's2', 100, 80));
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 3 });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's1');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('source-io-ratio-stability: top cap and droppedBelowTopCap', () => {
  const q: QueueLine[] = [];
  // three sources with distinct token totals, 3 days each
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'big', 1000, 500));
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'mid', 500, 250));
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'tiny', 100, 50));
  }
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 3,
    top: 2,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedBelowTopCap, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'mid');
});

test('source-io-ratio-stability: sort=cv puts most-stable first', () => {
  // s1: stable ratios -> cv=0; s2: alternating -> cv>0
  const q: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'stable', 100, 50));
  }
  q.push(ql('2026-04-01T00:00:00.000Z', 'wild', 100, 100));
  q.push(ql('2026-04-02T00:00:00.000Z', 'wild', 100, 10));
  q.push(ql('2026-04-03T00:00:00.000Z', 'wild', 100, 200));
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 3,
    sort: 'cv',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'stable');
  assert.equal(r.sources[0]!.ratioCv, 0);
  assert.equal(r.sources[1]!.source, 'wild');
  assert.ok(r.sources[1]!.ratioCv > 0);
});

test('source-io-ratio-stability: source filter restricts and counts drops', () => {
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'keep', 100, 50),
    ql('2026-04-02T00:00:00.000Z', 'keep', 100, 50),
    ql('2026-04-03T00:00:00.000Z', 'keep', 100, 50),
    ql('2026-04-01T00:00:00.000Z', 'skip', 100, 50),
    ql('2026-04-02T00:00:00.000Z', 'skip', 100, 50),
  ];
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 1,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 2);
});

test('source-io-ratio-stability: since/until window filters', () => {
  const q: QueueLine[] = [
    ql('2026-03-31T23:00:00.000Z', 's1', 100, 50), // before since
    ql('2026-04-01T00:00:00.000Z', 's1', 100, 50),
    ql('2026-04-02T00:00:00.000Z', 's1', 100, 50),
    ql('2026-04-03T00:00:00.000Z', 's1', 100, 50),
    ql('2026-04-05T00:00:00.000Z', 's1', 100, 50), // at/after until
  ];
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 1,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.daysWithRatio, 3);
});

test('source-io-ratio-stability: invalid hour_start dropped and counted', () => {
  const q: QueueLine[] = [
    ql('not-a-date', 's1', 100, 50),
    ql('2026-04-01T00:00:00.000Z', 's1', 100, 50),
    ql('2026-04-02T00:00:00.000Z', 's1', 100, 50),
    ql('2026-04-03T00:00:00.000Z', 's1', 100, 50),
  ];
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.daysWithRatio, 3);
});

test('source-io-ratio-stability: sort=source orders lex asc', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'zeta', 100, 50));
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'alpha', 100, 50));
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'mu', 100, 50));
  }
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 3,
    sort: 'source',
  });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['alpha', 'mu', 'zeta'],
  );
});

test('source-io-ratio-stability: empty source string normalised to "unknown"', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, '', 100, 50));
  }
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'unknown');
});

test('source-io-ratio-stability: minDays default is 3', () => {
  const r = buildSourceIoRatioStability([], { generatedAt: GEN });
  assert.equal(r.minDays, 3);
});

test('source-io-ratio-stability: aggregates multiple buckets within same UTC day', () => {
  // two buckets on same day: in=50+150=200, out=20+30=50 -> ratio=0.25
  const q: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's1', 50, 20),
    ql('2026-04-01T05:00:00.000Z', 's1', 150, 30),
    ql('2026-04-02T00:00:00.000Z', 's1', 200, 50), // ratio=0.25
    ql('2026-04-03T00:00:00.000Z', 's1', 400, 100), // ratio=0.25
  ];
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.daysWithRatio, 3);
  assert.equal(s.meanRatio, 0.25);
  assert.equal(s.ratioCv, 0);
});

test('source-io-ratio-stability: cvMin floor drops stable sources', () => {
  // s_stable: cv=0; s_wild: cv > 0.5
  const q: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'stable', 100, 50));
  }
  q.push(ql('2026-04-01T00:00:00.000Z', 'wild', 100, 100));
  q.push(ql('2026-04-02T00:00:00.000Z', 'wild', 100, 0));
  q.push(ql('2026-04-03T00:00:00.000Z', 'wild', 100, 200));
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 3,
    cvMin: 0.5,
  });
  assert.equal(r.totalSources, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'wild');
  assert.equal(r.droppedBelowCvMin, 1);
  assert.equal(r.cvMin, 0.5);
});

test('source-io-ratio-stability: cvMin=0 default keeps everything', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 's1', 100, 50));
  }
  const r = buildSourceIoRatioStability(q, { generatedAt: GEN, minDays: 1 });
  assert.equal(r.cvMin, 0);
  assert.equal(r.droppedBelowCvMin, 0);
  assert.equal(r.sources.length, 1);
});

test('source-io-ratio-stability: rejects bad cvMin', () => {
  assert.throws(() => buildSourceIoRatioStability([], { cvMin: -0.1 }));
  assert.throws(() => buildSourceIoRatioStability([], { cvMin: Number.NaN }));
  assert.throws(() => buildSourceIoRatioStability([], { cvMin: Number.POSITIVE_INFINITY }));
});

test('source-io-ratio-stability: cvMin applies before top cap', () => {
  // 3 sources: a (cv=0), b (cv>0), c (cv>0). cvMin filters a, then top=1 keeps highest tokens.
  const q: QueueLine[] = [];
  for (let d = 1; d <= 3; d += 1) {
    const dd = String(d).padStart(2, '0');
    q.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'a', 1000, 500)); // stable
  }
  q.push(ql('2026-04-01T00:00:00.000Z', 'b', 200, 100));
  q.push(ql('2026-04-02T00:00:00.000Z', 'b', 200, 0));
  q.push(ql('2026-04-03T00:00:00.000Z', 'b', 200, 200));
  q.push(ql('2026-04-01T00:00:00.000Z', 'c', 100, 50));
  q.push(ql('2026-04-02T00:00:00.000Z', 'c', 100, 0));
  q.push(ql('2026-04-03T00:00:00.000Z', 'c', 100, 100));
  const r = buildSourceIoRatioStability(q, {
    generatedAt: GEN,
    minDays: 3,
    cvMin: 0.1,
    top: 1,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.droppedBelowCvMin, 1); // a dropped
  assert.equal(r.droppedBelowTopCap, 1); // c dropped (b has more tokens)
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'b');
});
