import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildTokenVelocityPercentiles, MINUTES_PER_BUCKET } from '../src/tokenvelocitypercentiles.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('token-velocity-percentiles: rejects bad minBuckets', () => {
  assert.throws(() => buildTokenVelocityPercentiles([], { minBuckets: -1 }));
  assert.throws(() => buildTokenVelocityPercentiles([], { minBuckets: 1.5 }));
});

test('token-velocity-percentiles: rejects bad top', () => {
  assert.throws(() => buildTokenVelocityPercentiles([], { top: -1 }));
  assert.throws(() => buildTokenVelocityPercentiles([], { top: 2.5 }));
});

test('token-velocity-percentiles: rejects bad sort', () => {
  assert.throws(() =>
    buildTokenVelocityPercentiles([], { sort: 'bogus' as unknown as 'tokens' }),
  );
});

test('token-velocity-percentiles: rejects bad since/until', () => {
  assert.throws(() => buildTokenVelocityPercentiles([], { since: 'not-a-date' }));
  assert.throws(() => buildTokenVelocityPercentiles([], { until: 'nope' }));
});

// ---- empty / edge --------------------------------------------------------

test('token-velocity-percentiles: empty queue returns zeros', () => {
  const r = buildTokenVelocityPercentiles([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.sources, []);
});

test('token-velocity-percentiles: drops zero-token rows and bad hour_start', () => {
  const r = buildTokenVelocityPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { total_tokens: 600 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalTokens, 600);
  // 600 tokens / 60 minutes = 10 tok/min
  assert.equal(r.sources[0]!.p50, 10);
  assert.equal(r.sources[0]!.mean, 10);
});

// ---- per-bucket aggregation ---------------------------------------------

test('token-velocity-percentiles: same source+hour from multiple devices/models sums into one observation', () => {
  const r = buildTokenVelocityPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-a', model: 'gpt-5', total_tokens: 300 }),
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-b', model: 'claude', total_tokens: 300 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalBuckets, 1, 'two device/model rows in same source+hour collapse to one bucket');
  assert.equal(r.sources[0]!.tokens, 600);
  // 600 / 60 = 10 tok/min, and it's the only bucket
  assert.equal(r.sources[0]!.min, 10);
  assert.equal(r.sources[0]!.max, 10);
});

test('token-velocity-percentiles: empty source string is bucketed as (unknown)', () => {
  const r = buildTokenVelocityPercentiles(
    [ql('2026-04-20T01:00:00Z', { source: '', total_tokens: 600 })],
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.source, '(unknown)');
});

// ---- percentile semantics ------------------------------------------------

test('token-velocity-percentiles: percentiles use nearest-rank (R-1) on sorted observations', () => {
  // 10 buckets per source, total_tokens 60, 120, ..., 600 -> 1, 2, ..., 10 tok/min
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T01:00:00Z`, {
        source: 'codex',
        total_tokens: i * MINUTES_PER_BUCKET,
      }),
    );
  }
  const r = buildTokenVelocityPercentiles(lines, { generatedAt: GEN });
  const s = r.sources[0]!;
  assert.equal(s.buckets, 10);
  assert.equal(s.min, 1);
  assert.equal(s.max, 10);
  // p50 = ceil(0.5 * 10) = rank 5 -> index 4 -> 5
  assert.equal(s.p50, 5);
  // p90 = ceil(0.9 * 10) = rank 9 -> index 8 -> 9
  assert.equal(s.p90, 9);
  // p99 = ceil(0.99 * 10) = rank 10 -> index 9 -> 10
  assert.equal(s.p99, 10);
  // mean = sum(1..10)/10 = 55/10 = 5.5
  assert.equal(s.mean, 5.5);
});

// ---- per-source isolation ------------------------------------------------

test('token-velocity-percentiles: sources are isolated; same hour for different sources is two observations', () => {
  const r = buildTokenVelocityPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex', total_tokens: 600 }),
      ql('2026-04-20T01:00:00Z', { source: 'opencode', total_tokens: 1200 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 2);
  assert.equal(r.totalBuckets, 2);
  assert.equal(r.totalTokens, 1800);
  const codex = r.sources.find((s) => s.source === 'codex')!;
  const opencode = r.sources.find((s) => s.source === 'opencode')!;
  assert.equal(codex.p50, 10);
  assert.equal(opencode.p50, 20);
});

// ---- source filter -------------------------------------------------------

test('token-velocity-percentiles: source filter excludes non-matching rows and surfaces drops', () => {
  const r = buildTokenVelocityPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex', total_tokens: 600 }),
      ql('2026-04-20T01:00:00Z', { source: 'opencode', total_tokens: 999 }),
    ],
    { source: 'codex', generatedAt: GEN },
  );
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.sources[0]!.tokens, 600);
  assert.equal(r.source, 'codex');
});

// ---- sort modes ----------------------------------------------------------

test('token-velocity-percentiles: sort=p99 orders by tail desc with lex tiebreak', () => {
  // src "calm": 5 buckets all 60 tok (1 tok/min). p99 = 1.
  // src "spiky": 4 small + 1 big. p99 = the big one.
  const lines: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T01:00:00Z`, {
        source: 'calm',
        total_tokens: 60,
      }),
    );
  }
  for (let i = 0; i < 4; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T02:00:00Z`, {
        source: 'spiky',
        total_tokens: 60,
      }),
    );
  }
  lines.push(
    ql('2026-04-25T02:00:00Z', { source: 'spiky', total_tokens: 6_000_000 }),
  );
  const r = buildTokenVelocityPercentiles(lines, { sort: 'p99', generatedAt: GEN });
  assert.equal(r.sources[0]!.source, 'spiky');
  assert.ok(r.sources[0]!.p99 > r.sources[1]!.p99);
  assert.equal(r.sources[1]!.source, 'calm');
});

// ---- minBuckets + top composition ---------------------------------------

test('token-velocity-percentiles: minBuckets and top compose; totals reflect full population', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { source: 'a', total_tokens: 60 }),
    ql('2026-04-20T02:00:00Z', { source: 'b', total_tokens: 60 }),
    ql('2026-04-20T03:00:00Z', { source: 'b', total_tokens: 60 }),
    ql('2026-04-20T04:00:00Z', { source: 'c', total_tokens: 60 }),
    ql('2026-04-20T05:00:00Z', { source: 'c', total_tokens: 60 }),
    ql('2026-04-20T06:00:00Z', { source: 'c', total_tokens: 60 }),
  ];
  const r = buildTokenVelocityPercentiles(lines, {
    minBuckets: 2,
    top: 1,
    sort: 'buckets',
    generatedAt: GEN,
  });
  assert.equal(r.totalSources, 3);
  assert.equal(r.totalBuckets, 6);
  assert.equal(r.totalTokens, 360);
  assert.equal(r.droppedMinBuckets, 1);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'c');
});

// ---- window filter -------------------------------------------------------

test('token-velocity-percentiles: since/until window applied before bucketing', () => {
  const r = buildTokenVelocityPercentiles(
    [
      ql('2026-04-19T23:00:00Z', { total_tokens: 999 }), // before window
      ql('2026-04-20T01:00:00Z', { total_tokens: 60 }), // in
      ql('2026-04-20T02:00:00Z', { total_tokens: 120 }), // in
      ql('2026-04-21T00:00:00Z', { total_tokens: 999 }), // at upper edge (exclusive)
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.totalBuckets, 2);
  assert.equal(r.totalTokens, 180);
});

// ---- rateMin (refinement) -----------------------------------------------

test('token-velocity-percentiles: rejects bad rateMin', () => {
  assert.throws(() => buildTokenVelocityPercentiles([], { rateMin: -1 }));
  assert.throws(() =>
    buildTokenVelocityPercentiles([], { rateMin: Number.POSITIVE_INFINITY }),
  );
});

test('token-velocity-percentiles: rateMin echoes through the report', () => {
  const r = buildTokenVelocityPercentiles([], { rateMin: 0.5, generatedAt: GEN });
  assert.equal(r.rateMin, 0.5);
});

test('token-velocity-percentiles: rateMin drops sub-threshold buckets and re-shapes percentiles', () => {
  // Two sources. tiny: only sub-threshold buckets (drops out entirely);
  // real: all-medium buckets (unchanged).
  const lines: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { source: 'tiny', total_tokens: 6 }),     // 0.1 tok/min
    ql('2026-04-20T02:00:00Z', { source: 'tiny', total_tokens: 30 }),    // 0.5 tok/min
    ql('2026-04-20T01:00:00Z', { source: 'real', total_tokens: 6_000 }), // 100 tok/min
    ql('2026-04-20T02:00:00Z', { source: 'real', total_tokens: 12_000 }), // 200 tok/min
  ];
  const baseline = buildTokenVelocityPercentiles(lines, { generatedAt: GEN });
  assert.equal(baseline.totalSources, 2);
  assert.equal(baseline.totalBuckets, 4);
  assert.equal(baseline.droppedRateMin, 0);

  // Threshold 1 tok/min wipes tiny entirely, leaves real intact.
  const filtered = buildTokenVelocityPercentiles(lines, {
    rateMin: 1,
    generatedAt: GEN,
  });
  assert.equal(filtered.droppedRateMin, 2, 'tiny\'s 2 buckets dropped by threshold');
  assert.equal(filtered.totalSources, 1);
  assert.equal(filtered.totalBuckets, 2);
  assert.equal(filtered.totalTokens, 18_000);
  assert.equal(filtered.sources[0]!.source, 'real');
  const baseReal = baseline.sources.find((s) => s.source === 'real')!;
  assert.equal(filtered.sources[0]!.p50, baseReal.p50);
  assert.equal(filtered.sources[0]!.p99, baseReal.p99);
});

test('token-velocity-percentiles: rateMin partial filter alters surviving source percentiles', () => {
  // Single source, 5 sub-threshold + 5 above-threshold.
  const lines: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    lines.push(
      ql(`2026-04-${String(10 + i).padStart(2, '0')}T01:00:00Z`, {
        total_tokens: 6, // 0.1 tok/min
      }),
    );
  }
  for (let i = 0; i < 5; i++) {
    lines.push(
      ql(`2026-04-${String(15 + i).padStart(2, '0')}T01:00:00Z`, {
        total_tokens: 60_000 + i * 60, // 1000..1004 tok/min
      }),
    );
  }
  const r = buildTokenVelocityPercentiles(lines, {
    rateMin: 1,
    generatedAt: GEN,
  });
  assert.equal(r.droppedRateMin, 5);
  assert.equal(r.totalBuckets, 5);
  assert.equal(r.sources[0]!.min, 1000);
  assert.equal(r.sources[0]!.max, 1004);
});
