import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildCostPerBucketPercentiles,
} from '../src/costperbucketpercentiles.js';
import type { RateTable } from '../src/cost.js';
import type { QueueLine } from '../src/types.js';

const RATES: RateTable = {
  'gpt-5': { input: 1.0, cachedInput: 0.1, output: 4.0, reasoning: 4.0 },
  'claude-opus-4.7': { input: 15.0, cachedInput: 1.5, output: 75.0, reasoning: 75.0 },
};

function ql(hourStart: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: opts.input_tokens ?? 1_000_000,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 0,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens:
      (opts.input_tokens ?? 1_000_000) +
      (opts.cached_input_tokens ?? 0) +
      (opts.output_tokens ?? 0) +
      (opts.reasoning_output_tokens ?? 0),
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation ---------------------------------------------------

test('cost-per-bucket-percentiles: rejects bad minBuckets', () => {
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { minBuckets: -1 }));
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { minBuckets: 1.5 }));
});

test('cost-per-bucket-percentiles: rejects bad top', () => {
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { top: -1 }));
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { top: 2.5 }));
});

test('cost-per-bucket-percentiles: rejects bad minCost', () => {
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { minCost: -0.01 }));
  assert.throws(() =>
    buildCostPerBucketPercentiles([], RATES, { minCost: Number.POSITIVE_INFINITY }),
  );
});

test('cost-per-bucket-percentiles: rejects bad sort', () => {
  assert.throws(() =>
    buildCostPerBucketPercentiles([], RATES, { sort: 'bogus' as unknown as 'cost' }),
  );
});

test('cost-per-bucket-percentiles: rejects bad since/until', () => {
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { since: 'not-a-date' }));
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { until: 'not-a-date' }));
});

// ---- empty / edge --------------------------------------------------------

test('cost-per-bucket-percentiles: empty queue returns zeros', () => {
  const r = buildCostPerBucketPercentiles([], RATES, { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.totalCost, 0);
  assert.deepEqual(r.sources, []);
});

test('cost-per-bucket-percentiles: drops bad hour_start rows', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('not-a-date'),
      ql('2026-04-20T01:00:00Z', { input_tokens: 2_000_000 }),
    ],
    RATES,
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalBuckets, 1);
  // 2M input tokens * $1/M = $2 in one bucket
  assert.equal(r.sources[0]!.cost, 2);
  assert.equal(r.sources[0]!.p50, 2);
});

// ---- per-bucket aggregation ---------------------------------------------

test('cost-per-bucket-percentiles: same source+hour from multiple devices/models sums into one observation', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-a', model: 'gpt-5', input_tokens: 1_000_000 }),
      ql('2026-04-20T01:00:00Z', { device_id: 'dev-b', model: 'gpt-5', input_tokens: 3_000_000 }),
    ],
    RATES,
    { generatedAt: GEN },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.totalBuckets, 1, 'two device rows in same source+hour collapse to one bucket');
  // 1M + 3M = 4M input tokens at $1/M = $4
  assert.equal(r.sources[0]!.cost, 4);
  assert.equal(r.sources[0]!.min, 4);
  assert.equal(r.sources[0]!.max, 4);
});

test('cost-per-bucket-percentiles: empty source string is bucketed as (unknown)', () => {
  const r = buildCostPerBucketPercentiles(
    [ql('2026-04-20T01:00:00Z', { source: '', input_tokens: 1_000_000 })],
    RATES,
    { generatedAt: GEN },
  );
  assert.equal(r.sources[0]!.source, '(unknown)');
});

// ---- unknown models / zero-cost buckets ---------------------------------

test('cost-per-bucket-percentiles: unknown-model rows count as unknownModelRows and contribute zero cost', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { model: 'mystery-model', input_tokens: 5_000_000 }),
      ql('2026-04-20T02:00:00Z', { model: 'gpt-5', input_tokens: 1_000_000 }),
    ],
    RATES,
    { generatedAt: GEN },
  );
  assert.equal(r.unknownModelRows, 1);
  // The unknown-model bucket has cost 0 -> dropped as zero-cost
  assert.equal(r.droppedZeroCost, 1);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalCost, 1);
});

// ---- percentile semantics ------------------------------------------------

test('cost-per-bucket-percentiles: per-source percentiles use nearest-rank R-1', () => {
  // 10 buckets across distinct hours -> known nearest-rank positions:
  // sorted rates 1..10; p50 = ceil(0.5*10)=5 -> 5; p90 = ceil(0.9*10)=9 -> 9; p99 = ceil(0.99*10)=10 -> 10
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) {
    lines.push(
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 's1',
        input_tokens: i * 1_000_000, // cost = $i
      }),
    );
  }
  const r = buildCostPerBucketPercentiles(lines, RATES, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.buckets, 10);
  assert.equal(row.cost, 55);
  assert.equal(row.min, 1);
  assert.equal(row.max, 10);
  assert.equal(row.p50, 5);
  assert.equal(row.p90, 9);
  assert.equal(row.p99, 10);
  assert.equal(row.mean, 5.5);
});

// ---- minCost noise floor ------------------------------------------------

test('cost-per-bucket-percentiles: minCost drops sub-floor buckets and re-shapes percentiles', () => {
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) {
    lines.push(
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 's1',
        input_tokens: i * 1_000_000,
      }),
    );
  }
  const r = buildCostPerBucketPercentiles(lines, RATES, {
    generatedAt: GEN,
    minCost: 5, // keep $5..$10
  });
  const row = r.sources[0]!;
  assert.equal(row.buckets, 6);
  assert.equal(r.droppedMinCost, 4);
  assert.equal(row.cost, 5 + 6 + 7 + 8 + 9 + 10);
  assert.equal(row.min, 5);
  assert.equal(row.max, 10);
});

test('cost-per-bucket-percentiles: minCost can remove a source entirely', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { source: 's1', input_tokens: 100 }), // $0.0001
      ql('2026-04-20T01:00:00Z', { source: 's2', input_tokens: 5_000_000 }), // $5
    ],
    RATES,
    { generatedAt: GEN, minCost: 1 },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.droppedMinCost, 1);
});

// ---- since / until window ----------------------------------------------

test('cost-per-bucket-percentiles: since/until are [inclusive, exclusive)', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('2026-04-20T00:00:00Z', { input_tokens: 1_000_000 }), // dropped < since
      ql('2026-04-20T01:00:00Z', { input_tokens: 2_000_000 }), // kept
      ql('2026-04-20T02:00:00Z', { input_tokens: 3_000_000 }), // dropped >= until
    ],
    RATES,
    {
      generatedAt: GEN,
      since: '2026-04-20T01:00:00Z',
      until: '2026-04-20T02:00:00Z',
    },
  );
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.totalCost, 2);
});

// ---- source filter -----------------------------------------------------

test('cost-per-bucket-percentiles: source filter narrows to one source', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { source: 's1', input_tokens: 1_000_000 }),
      ql('2026-04-20T01:00:00Z', { source: 's2', input_tokens: 2_000_000 }),
    ],
    RATES,
    { generatedAt: GEN, source: 's2' },
  );
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.sources[0]!.source, 's2');
  assert.equal(r.sources[0]!.cost, 2);
});

// ---- sort + top + minBuckets -------------------------------------------

test('cost-per-bucket-percentiles: sort=cost desc with name tiebreak, then top cap', () => {
  const r = buildCostPerBucketPercentiles(
    [
      ql('2026-04-20T01:00:00Z', { source: 'a', input_tokens: 5_000_000 }), // $5
      ql('2026-04-20T01:00:00Z', { source: 'b', input_tokens: 5_000_000 }), // $5 (tie -> 'a' first)
      ql('2026-04-20T01:00:00Z', { source: 'c', input_tokens: 1_000_000 }), // $1
    ],
    RATES,
    { generatedAt: GEN, top: 2 },
  );
  assert.equal(r.totalSources, 3);
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'b');
});

test('cost-per-bucket-percentiles: sort=p99 puts the heaviest single bucket on top', () => {
  const lines: QueueLine[] = [
    // source 'steady' has 5 evenly-priced buckets at $2 each
    ...[1, 2, 3, 4, 5].map((i) =>
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 'steady',
        input_tokens: 2_000_000,
      }),
    ),
    // source 'spiky' has 5 buckets, one is huge ($50)
    ...[1, 2, 3, 4].map((i) =>
      ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 'spiky',
        input_tokens: 100_000,
      }),
    ),
    ql('2026-04-21T05:00:00Z', { source: 'spiky', input_tokens: 50_000_000 }),
  ];
  const r = buildCostPerBucketPercentiles(lines, RATES, { generatedAt: GEN, sort: 'p99' });
  assert.equal(r.sources[0]!.source, 'spiky');
  assert.ok(r.sources[0]!.p99 >= r.sources[1]!.p99);
});

test('cost-per-bucket-percentiles: minBuckets is a display filter and does not change totals', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { source: 'big', input_tokens: 1_000_000 }),
    ql('2026-04-20T02:00:00Z', { source: 'big', input_tokens: 1_000_000 }),
    ql('2026-04-20T03:00:00Z', { source: 'big', input_tokens: 1_000_000 }),
    ql('2026-04-20T01:00:00Z', { source: 'tiny', input_tokens: 1_000_000 }),
  ];
  const r = buildCostPerBucketPercentiles(lines, RATES, { generatedAt: GEN, minBuckets: 2 });
  assert.equal(r.totalSources, 2, 'totalSources reflects pre-display population');
  assert.equal(r.totalBuckets, 4);
  assert.equal(r.totalCost, 4);
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedMinBuckets, 1);
  assert.equal(r.sources[0]!.source, 'big');
});

// ---- echo / structure --------------------------------------------------

test('cost-per-bucket-percentiles: echoes window, source, sort, and minCost into the report', () => {
  const r = buildCostPerBucketPercentiles([], RATES, {
    generatedAt: GEN,
    since: '2026-04-20T00:00:00Z',
    until: '2026-04-21T00:00:00Z',
    source: 'codex',
    sort: 'mean',
    minCost: 0.5,
    top: 3,
    minBuckets: 2,
  });
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
  assert.equal(r.source, 'codex');
  assert.equal(r.sort, 'mean');
  assert.equal(r.minCost, 0.5);
  assert.equal(r.top, 3);
  assert.equal(r.minBuckets, 2);
  assert.equal(r.generatedAt, GEN);
});

// ---- topBuckets tail-zoom -----------------------------------------------

test('cost-per-bucket-percentiles: rejects bad topBuckets', () => {
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { topBuckets: -1 }));
  assert.throws(() => buildCostPerBucketPercentiles([], RATES, { topBuckets: 1.5 }));
});

test('cost-per-bucket-percentiles: topBuckets keeps only the top-N highest-cost buckets per source', () => {
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) {
    lines.push(
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 's1',
        input_tokens: i * 1_000_000,
      }),
    );
  }
  const r = buildCostPerBucketPercentiles(lines, RATES, {
    generatedAt: GEN,
    topBuckets: 3,
  });
  const row = r.sources[0]!;
  assert.equal(row.buckets, 3);
  assert.equal(r.droppedTopBuckets, 7);
  // Top-3 highest are $8, $9, $10
  assert.equal(row.min, 8);
  assert.equal(row.max, 10);
  assert.equal(row.cost, 27);
  assert.equal(row.mean, 9);
});

test('cost-per-bucket-percentiles: topBuckets is per-source, not global', () => {
  const lines: QueueLine[] = [];
  // s1: $1..$5
  for (let i = 1; i <= 5; i++) {
    lines.push(
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 's1',
        input_tokens: i * 1_000_000,
      }),
    );
  }
  // s2: $1..$5 (same shape)
  for (let i = 1; i <= 5; i++) {
    lines.push(
      ql(`2026-04-21T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 's2',
        input_tokens: i * 1_000_000,
      }),
    );
  }
  const r = buildCostPerBucketPercentiles(lines, RATES, {
    generatedAt: GEN,
    topBuckets: 2,
  });
  // Each source keeps top-2 ($4, $5), so totalBuckets = 4 not 2
  assert.equal(r.totalBuckets, 4);
  assert.equal(r.droppedTopBuckets, 6);
  for (const row of r.sources) {
    assert.equal(row.buckets, 2);
    assert.equal(row.min, 4);
    assert.equal(row.max, 5);
  }
});

test('cost-per-bucket-percentiles: topBuckets >= bucket count is a no-op', () => {
  const lines: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { source: 's1', input_tokens: 1_000_000 }),
    ql('2026-04-20T02:00:00Z', { source: 's1', input_tokens: 2_000_000 }),
  ];
  const r = buildCostPerBucketPercentiles(lines, RATES, {
    generatedAt: GEN,
    topBuckets: 100,
  });
  assert.equal(r.droppedTopBuckets, 0);
  assert.equal(r.sources[0]!.buckets, 2);
  assert.equal(r.totalCost, 3);
});

test('cost-per-bucket-percentiles: topBuckets reshapes p50 toward the tail', () => {
  // 100 buckets: 99 at $1, 1 at $100. Without topBuckets p50=$1.
  // With topBuckets=10 we keep [$100, $1, $1, ..., $1] -> p50 still
  // $1 (since 9 of 10 are $1) but max=$100 stays, mean climbs.
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 99; i++) {
    const day = String(20 + Math.floor((i - 1) / 24)).padStart(2, '0');
    const hour = String((i - 1) % 24).padStart(2, '0');
    lines.push(
      ql(`2026-04-${day}T${hour}:00:00Z`, {
        source: 's1',
        input_tokens: 1_000_000,
      }),
    );
  }
  lines.push(
    ql('2026-05-15T00:00:00Z', {
      source: 's1',
      input_tokens: 100_000_000,
    }),
  );
  const baseline = buildCostPerBucketPercentiles(lines, RATES, { generatedAt: GEN });
  assert.equal(baseline.sources[0]!.p50, 1);
  assert.equal(baseline.sources[0]!.mean, (99 * 1 + 100) / 100);

  const zoomed = buildCostPerBucketPercentiles(lines, RATES, {
    generatedAt: GEN,
    topBuckets: 10,
  });
  const row = zoomed.sources[0]!;
  assert.equal(row.buckets, 10);
  // Sorted asc: nine $1 + one $100 => p50 = sorted[ceil(0.5*10)-1] = sorted[4] = 1
  assert.equal(row.p50, 1);
  assert.equal(row.max, 100);
  // Mean climbed dramatically once we zoomed onto the tail
  assert.equal(row.mean, (9 * 1 + 100) / 10);
  assert.equal(zoomed.droppedTopBuckets, 90);
});

test('cost-per-bucket-percentiles: topBuckets composes with minCost', () => {
  // 6 buckets at $1..$6, minCost $3 keeps [$3,$4,$5,$6], topBuckets 2 then keeps [$5,$6]
  const lines: QueueLine[] = [];
  for (let i = 1; i <= 6; i++) {
    lines.push(
      ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, {
        source: 's1',
        input_tokens: i * 1_000_000,
      }),
    );
  }
  const r = buildCostPerBucketPercentiles(lines, RATES, {
    generatedAt: GEN,
    minCost: 3,
    topBuckets: 2,
  });
  assert.equal(r.droppedMinCost, 2); // $1, $2
  assert.equal(r.droppedTopBuckets, 2); // $3, $4
  const row = r.sources[0]!;
  assert.equal(row.buckets, 2);
  assert.equal(row.min, 5);
  assert.equal(row.max, 6);
});

test('cost-per-bucket-percentiles: topBuckets echoes into the report', () => {
  const r = buildCostPerBucketPercentiles([], RATES, {
    generatedAt: GEN,
    topBuckets: 7,
  });
  assert.equal(r.topBuckets, 7);
  assert.equal(r.droppedTopBuckets, 0);
});
