import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenCusumMaxDeviation,
  cusumSummary,
} from '../src/dailytokencusummaxdeviation.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-05-04T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('cusum: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { minDays: 2 }));
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { minDays: -1 }));
});

test('cusum: rejects bad top', () => {
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { top: -1 }));
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { top: 1.5 }));
});

test('cusum: rejects bad sort', () => {
  assert.throws(() =>
    buildDailyTokenCusumMaxDeviation([], { sort: 'nope' as 'tokens' }),
  );
});

test('cusum: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { since: 'no' }));
  assert.throws(() => buildDailyTokenCusumMaxDeviation([], { until: 'nope' }));
});

// ---- pure helpers --------------------------------------------------------

test('cusumSummary: empty -> flat', () => {
  const s = cusumSummary([]);
  assert.equal(s.flat, true);
  assert.equal(s.cusumMax, 0);
  assert.equal(s.cusumMin, 0);
  assert.equal(s.argMaxIndex, -1);
});

test('cusumSummary: constant -> flat (rms = 0)', () => {
  const s = cusumSummary([5, 5, 5, 5]);
  assert.equal(s.mean, 5);
  assert.equal(s.rms, 0);
  assert.equal(s.flat, true);
  assert.equal(s.cusumMax, 0);
  assert.equal(s.cusumMin, 0);
  assert.equal(s.normMax, 0);
  assert.equal(s.normMin, 0);
  assert.equal(s.normRange, 0);
});

test('cusumSummary: monotone ramp has large positive cusumMax (drift class)', () => {
  // 1,2,3,4,5,6,7,8,9,10 -> mean=5.5 -> deviations -4.5..+4.5
  // S accumulates negative first (reaches min around middle) then climbs back to 0 at end
  // Wait — actually for a ramp, S goes very negative first then back up.
  // Let's check the OPPOSITE ramp instead so cusumMax dominates.
  const s = cusumSummary([10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
  // mean = 5.5; first deviation = +4.5, then +3.5,... S climbs then descends to 0.
  assert.ok(s.cusumMax > 0, 'descending ramp produces positive cusumMax');
  assert.ok(Math.abs(s.cusumMin) < 1e-9 || s.cusumMin === 0, 'no negative excursion for descending ramp');
  assert.ok(s.flat === false);
  // argMax should be near the middle
  assert.ok(s.argMaxIndex > 0 && s.argMaxIndex < 9);
});

test('cusumSummary: ascending ramp has large negative cusumMin', () => {
  const s = cusumSummary([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.ok(s.cusumMin < 0, 'ascending ramp produces negative cusumMin');
  assert.ok(Math.abs(s.cusumMax) < 1e-9 || s.cusumMax === 0);
  assert.equal(s.flat, false);
});

test('cusumSummary: cusumMax >= 0 and cusumMin <= 0 always', () => {
  const series = [
    [1, 1, 100, 1, 1],
    [100, 1, 1, 1, 100],
    [1, 100, 1, 100, 1],
    [50, 50, 50, 51, 49],
  ];
  for (const arr of series) {
    const s = cusumSummary(arr);
    assert.ok(s.cusumMax >= 0, `cusumMax >= 0 for ${JSON.stringify(arr)}`);
    assert.ok(s.cusumMin <= 0, `cusumMin <= 0 for ${JSON.stringify(arr)}`);
    assert.ok(s.cusumRange >= 0);
  }
});

test('cusumSummary: sign-reversal mirrors S[i] across zero (path dependence)', () => {
  const xs = [10, 20, 5, 30, 15, 25, 40];
  const s = cusumSummary(xs);
  const r = cusumSummary([...xs].reverse());
  // The CUSUM of the reversed series equals -CUSUM of original (when both
  // anchored at the implicit 0 baseline at index -1) up to a path traversal
  // — i.e. cusumRange is preserved under reversal.
  assert.ok(Math.abs(s.cusumRange - r.cusumRange) / Math.max(s.cusumRange, 1) < 1e-9);
});

test('cusumSummary: normalization yields finite normMax/Min', () => {
  const s = cusumSummary([10, 50, 30, 70, 20, 90, 40]);
  assert.ok(Number.isFinite(s.normMax));
  assert.ok(Number.isFinite(s.normMin));
  assert.ok(Number.isFinite(s.normRange));
  assert.ok(s.normRange >= 0);
});

// ---- builder behavior ----------------------------------------------------

test('cusum: empty queue -> empty report', () => {
  const r = buildDailyTokenCusumMaxDeviation([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
});

test('cusum: drops zero/negative tokens', () => {
  const q = [
    ql('2026-05-01T00:00:00.000Z', 's', 0),
    ql('2026-05-01T01:00:00.000Z', 's', -5),
    ql('2026-05-01T02:00:00.000Z', 's', 100),
    ql('2026-05-02T00:00:00.000Z', 's', 200),
    ql('2026-05-03T00:00:00.000Z', 's', 300),
  ];
  const r = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.totalTokens, 600);
});

test('cusum: drops sources below minDays', () => {
  const q = [
    ql('2026-05-01T00:00:00.000Z', 'short', 100),
    ql('2026-05-02T00:00:00.000Z', 'short', 200),
    ql('2026-05-01T00:00:00.000Z', 'long', 100),
    ql('2026-05-02T00:00:00.000Z', 'long', 200),
    ql('2026-05-03T00:00:00.000Z', 'long', 300),
  ];
  const r = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN, minDays: 3 });
  assert.equal(r.droppedSparseSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
});

test('cusum: gap-fills with zeros', () => {
  // 5 days, only days 1 and 5 active. Series = [100,0,0,0,100].
  const q = [
    ql('2026-05-01T00:00:00.000Z', 's', 100),
    ql('2026-05-05T00:00:00.000Z', 's', 100),
  ];
  const r = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 2);
  assert.equal(row.nFilledDays, 5);
  assert.equal(row.mean, 40);
  // deviations: +60,-40,-40,-40,+60. CUSUM: 60,20,-20,-60,0.
  assert.equal(row.cusumMax, 60);
  assert.equal(row.cusumMin, -60);
  assert.equal(row.cusumRange, 120);
  assert.equal(row.argMaxDay, '2026-05-01');
  assert.equal(row.argMinDay, '2026-05-04');
});

test('cusum: source filter', () => {
  const q = [
    ql('2026-05-01T00:00:00.000Z', 'a', 100),
    ql('2026-05-02T00:00:00.000Z', 'a', 200),
    ql('2026-05-03T00:00:00.000Z', 'a', 300),
    ql('2026-05-01T00:00:00.000Z', 'b', 50),
    ql('2026-05-02T00:00:00.000Z', 'b', 60),
    ql('2026-05-03T00:00:00.000Z', 'b', 70),
  ];
  const r = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN, source: 'a' });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 3);
});

test('cusum: --top truncates after sort', () => {
  const q: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let d = 1; d <= 4; d++) {
      const day = `2026-05-0${d}T00:00:00.000Z`;
      const tokens = src === 'a' ? 1000 : src === 'b' ? 500 : 100;
      q.push(ql(day, src, tokens));
    }
  }
  const r = buildDailyTokenCusumMaxDeviation(q, {
    generatedAt: GEN,
    top: 2,
    sort: 'tokens',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('cusum: sort=range orders by cusumRange desc', () => {
  // Source A: ramp -> large CUSUM. Source B: alternating -> small.
  const q: QueueLine[] = [];
  for (let d = 1; d <= 6; d++) {
    const day = `2026-05-0${d}T00:00:00.000Z`;
    q.push(ql(day, 'ramp', d * 1000));
    q.push(ql(day, 'alt', d % 2 === 0 ? 100 : 200));
  }
  const r = buildDailyTokenCusumMaxDeviation(q, {
    generatedAt: GEN,
    sort: 'range',
  });
  assert.equal(r.sources[0]!.source, 'ramp');
  assert.ok(r.sources[0]!.cusumRange > r.sources[1]!.cusumRange);
});

test('cusum: deterministic across two builds', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 7; d++) {
    const day = `2026-05-0${d}T00:00:00.000Z`;
    q.push(ql(day, 's', d * 100));
  }
  const a = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN });
  const b = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN });
  assert.deepEqual(a, b);
});

test('cusum: constant series surfaces flat=true', () => {
  const q: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const day = `2026-05-0${d}T00:00:00.000Z`;
    q.push(ql(day, 's', 1000));
  }
  const r = buildDailyTokenCusumMaxDeviation(q, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.flat, true);
  assert.equal(row.cusumMax, 0);
  assert.equal(row.cusumMin, 0);
  assert.equal(row.normMax, 0);
  assert.equal(row.argMaxDay, null);
  assert.equal(row.argMinDay, null);
});
