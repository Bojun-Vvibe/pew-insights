import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildInputTokenDecileDistribution } from '../src/inputtokendeciledistribution.js';
import type { QueueLine } from '../src/types.js';

function ql(inp: number, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: opts.hour_start ?? '2026-04-20T12:00:00.000Z',
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: inp,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 50,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? inp + 50,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('input-token-decile-distribution: rejects bad since/until', () => {
  assert.throws(() => buildInputTokenDecileDistribution([], { since: 'nope' }));
  assert.throws(() => buildInputTokenDecileDistribution([], { until: 'nope' }));
});

test('input-token-decile-distribution: rejects bad minInput', () => {
  assert.throws(() => buildInputTokenDecileDistribution([], { minInput: -1 }));
  assert.throws(() =>
    buildInputTokenDecileDistribution([], { minInput: NaN }),
  );
});

// ---- empty / drops --------------------------------------------------------

test('input-token-decile-distribution: empty queue -> zero buckets, null stats', () => {
  const r = buildInputTokenDecileDistribution([], { generatedAt: GEN });
  assert.equal(r.bucketCount, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.gini, null);
  assert.equal(r.p90Share, null);
  assert.equal(r.p99Share, null);
  assert.equal(r.deciles.length, 10);
  for (const d of r.deciles) {
    assert.equal(d.bucketCount, 0);
    assert.equal(d.tokensInDecile, 0);
    assert.equal(d.shareOfTokens, 0);
  }
});

test('input-token-decile-distribution: drop counters attribute correctly', () => {
  const r = buildInputTokenDecileDistribution(
    [
      ql(100, { hour_start: 'nonsense' }),
      ql(-5),
      ql(0),
      ql(100, { source: 'claude-code' }),
      ql(100),
    ],
    { source: 'codex', generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedInvalidInput, 1);
  assert.equal(r.droppedZeroInput, 1);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.bucketCount, 1);
});

// ---- partitioning correctness --------------------------------------------

test('input-token-decile-distribution: 10 buckets -> exactly one per decile', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) rows.push(ql(i * 100));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.bucketCount, 10);
  assert.equal(r.totalInputTokens, 5500);
  for (let d = 0; d < 10; d++) {
    assert.equal(r.deciles[d]!.bucketCount, 1);
    assert.equal(r.deciles[d]!.tokensInDecile, (d + 1) * 100);
  }
  assert.ok(Math.abs(r.deciles[0]!.shareOfTokens - 100 / 5500) < 1e-12);
  assert.ok(Math.abs(r.deciles[9]!.shareOfTokens - 1000 / 5500) < 1e-12);
});

test('input-token-decile-distribution: remainder distributes onto lowest deciles', () => {
  // 13 rows -> sizes [2,2,2,1,1,1,1,1,1,1]
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 13; i++) rows.push(ql(i));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.bucketCount, 13);
  const sizes = r.deciles.map((d) => d.bucketCount);
  assert.deepEqual(sizes, [2, 2, 2, 1, 1, 1, 1, 1, 1, 1]);
  assert.equal(r.deciles[0]!.tokensInDecile, 3); // [1,2]
  assert.equal(r.deciles[1]!.tokensInDecile, 7); // [3,4]
  assert.equal(r.deciles[2]!.tokensInDecile, 11); // [5,6]
  assert.equal(r.deciles[3]!.tokensInDecile, 7);
  assert.equal(r.deciles[9]!.tokensInDecile, 13);
});

test('input-token-decile-distribution: fewer than 10 rows -> only leading deciles populated', () => {
  const r = buildInputTokenDecileDistribution(
    [ql(10), ql(20), ql(30)],
    { generatedAt: GEN },
  );
  const sizes = r.deciles.map((d) => d.bucketCount);
  assert.deepEqual(sizes, [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(r.deciles[0]!.tokensInDecile, 10);
  assert.equal(r.deciles[2]!.tokensInDecile, 30);
  assert.equal(r.deciles[9]!.bucketCount, 0);
});

// ---- per-decile stats ----------------------------------------------------

test('input-token-decile-distribution: per-decile min/mean/max correct', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) rows.push(ql(i));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.deciles[0]!.minInput, 1);
  assert.equal(r.deciles[0]!.meanInput, 1.5);
  assert.equal(r.deciles[0]!.maxInput, 2);
  assert.equal(r.deciles[9]!.minInput, 19);
  assert.equal(r.deciles[9]!.meanInput, 19.5);
  assert.equal(r.deciles[9]!.maxInput, 20);
});

// ---- Gini -----------------------------------------------------------------

test('input-token-decile-distribution: uniform distribution -> gini ~ 0', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 10; i++) rows.push(ql(100));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.ok(r.gini! < 1e-9, `expected gini ~ 0, got ${r.gini}`);
});

test('input-token-decile-distribution: highly skewed distribution -> gini close to (n-1)/n', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 9; i++) rows.push(ql(1));
  rows.push(ql(1_000_000));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.ok(r.gini! > 0.85 && r.gini! <= 0.9 + 1e-9, `gini=${r.gini}`);
});

// ---- top-K share ----------------------------------------------------------

test('input-token-decile-distribution: top-10% share equals D10 share when N % 10 == 0', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 30; i++) rows.push(ql(i));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.ok(Math.abs(r.p90Share! - 87 / 465) < 1e-12);
  assert.ok(Math.abs(r.p99Share! - 30 / 465) < 1e-12);
  assert.ok(Math.abs(r.deciles[9]!.shareOfTokens - r.p90Share!) < 1e-12);
});

// ---- window filtering -----------------------------------------------------

test('input-token-decile-distribution: since/until window respected', () => {
  const rows: QueueLine[] = [
    ql(100, { hour_start: '2026-04-20T00:00:00.000Z' }),
    ql(200, { hour_start: '2026-04-21T00:00:00.000Z' }),
    ql(300, { hour_start: '2026-04-22T00:00:00.000Z' }),
  ];
  const r = buildInputTokenDecileDistribution(rows, {
    since: '2026-04-21T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.bucketCount, 1);
  assert.equal(r.totalInputTokens, 200);
});

// ---- determinism ----------------------------------------------------------

test('input-token-decile-distribution: input order does not affect output', () => {
  const a: QueueLine[] = [];
  for (let i = 1; i <= 25; i++) a.push(ql(i * 7));
  const b = [...a].reverse();
  const ra = buildInputTokenDecileDistribution(a, { generatedAt: GEN });
  const rb = buildInputTokenDecileDistribution(b, { generatedAt: GEN });
  assert.deepEqual(ra, rb);
});

// ---- min-input floor ------------------------------------------------------

test('input-token-decile-distribution: minInput=0 default keeps all positive-input rows', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) rows.push(ql(i));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.minInput, 0);
  assert.equal(r.droppedBelowMinInput, 0);
  assert.equal(r.bucketCount, 10);
});

test('input-token-decile-distribution: minInput floor drops below-floor rows and re-deciles the survivors', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) rows.push(ql(i));
  const r = buildInputTokenDecileDistribution(rows, {
    minInput: 11,
    generatedAt: GEN,
  });
  assert.equal(r.minInput, 11);
  assert.equal(r.droppedBelowMinInput, 10);
  assert.equal(r.droppedZeroInput, 0);
  assert.equal(r.bucketCount, 10);
  assert.equal(r.totalInputTokens, 11 + 12 + 13 + 14 + 15 + 16 + 17 + 18 + 19 + 20);
  for (let d = 0; d < 10; d++) {
    assert.equal(r.deciles[d]!.bucketCount, 1);
    assert.equal(r.deciles[d]!.tokensInDecile, 11 + d);
  }
});

test('input-token-decile-distribution: minInput does NOT count zero-input rows (those go to droppedZeroInput)', () => {
  const r = buildInputTokenDecileDistribution(
    [ql(0), ql(0), ql(50), ql(200)],
    { minInput: 100, generatedAt: GEN },
  );
  assert.equal(r.droppedZeroInput, 2);
  assert.equal(r.droppedBelowMinInput, 1);
  assert.equal(r.bucketCount, 1);
  assert.equal(r.totalInputTokens, 200);
});

// ---- top heaviest buckets refinement (v0.5.3) -----------------------------

test('input-token-decile-distribution: rejects bad top', () => {
  assert.throws(() => buildInputTokenDecileDistribution([], { top: -1 }));
  assert.throws(() => buildInputTokenDecileDistribution([], { top: 1.5 }));
  assert.throws(() => buildInputTokenDecileDistribution([], { top: NaN }));
});

test('input-token-decile-distribution: top=0 default emits empty topBuckets', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 5; i++) rows.push(ql(i * 100));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.top, 0);
  assert.deepEqual(r.topBuckets, []);
});

test('input-token-decile-distribution: top=3 returns 3 heaviest buckets descending with metadata + decile tag', () => {
  const rows: QueueLine[] = [
    ql(100, { hour_start: '2026-04-20T00:00:00.000Z', source: 'codex', model: 'gpt-5' }),
    ql(900, { hour_start: '2026-04-20T01:00:00.000Z', source: 'cli-a', model: 'm-a' }),
    ql(500, { hour_start: '2026-04-20T02:00:00.000Z', source: 'cli-b', model: 'm-b' }),
    ql(800, { hour_start: '2026-04-20T03:00:00.000Z', source: 'cli-c', model: 'm-c' }),
    ql(200, { hour_start: '2026-04-20T04:00:00.000Z', source: 'cli-d', model: 'm-d' }),
  ];
  const r = buildInputTokenDecileDistribution(rows, { top: 3, generatedAt: GEN });
  assert.equal(r.topBuckets.length, 3);
  assert.equal(r.topBuckets[0]!.inputTokens, 900);
  assert.equal(r.topBuckets[0]!.source, 'cli-a');
  assert.equal(r.topBuckets[0]!.model, 'm-a');
  assert.equal(r.topBuckets[0]!.hourStart, '2026-04-20T01:00:00.000Z');
  assert.equal(r.topBuckets[1]!.inputTokens, 800);
  assert.equal(r.topBuckets[2]!.inputTokens, 500);
  // share = 900 / (100+900+500+800+200) = 900 / 2500
  assert.ok(Math.abs(r.topBuckets[0]!.shareOfTotal - 900 / 2500) < 1e-12);
  // Each entry tagged with its decile (5 rows -> sizes [1,1,1,1,1,0,0,0,0,0]):
  // sorted asc = [100,200,500,800,900] -> deciles 1..5
  // 900 -> D5, 800 -> D4, 500 -> D3
  assert.equal(r.topBuckets[0]!.decile, 5);
  assert.equal(r.topBuckets[1]!.decile, 4);
  assert.equal(r.topBuckets[2]!.decile, 3);
});

test('input-token-decile-distribution: top capped at bucketCount', () => {
  const r = buildInputTokenDecileDistribution(
    [ql(10), ql(20)],
    { top: 99, generatedAt: GEN },
  );
  assert.equal(r.topBuckets.length, 2);
  assert.equal(r.topBuckets[0]!.inputTokens, 20);
  assert.equal(r.topBuckets[1]!.inputTokens, 10);
});

test('input-token-decile-distribution: top tie-break by hour_start is deterministic across input order', () => {
  const a: QueueLine[] = [
    ql(100, { hour_start: '2026-04-20T03:00:00.000Z' }),
    ql(100, { hour_start: '2026-04-20T01:00:00.000Z' }),
    ql(100, { hour_start: '2026-04-20T02:00:00.000Z' }),
  ];
  const b = [...a].reverse();
  const ra = buildInputTokenDecileDistribution(a, { top: 3, generatedAt: GEN });
  const rb = buildInputTokenDecileDistribution(b, { top: 3, generatedAt: GEN });
  assert.deepEqual(ra, rb);
});

test('input-token-decile-distribution: top respects minInput floor (only floor survivors are eligible)', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) rows.push(ql(i, { hour_start: `2026-04-20T${String(i).padStart(2, '0')}:00:00.000Z` }));
  const r = buildInputTokenDecileDistribution(rows, {
    minInput: 15,
    top: 3,
    generatedAt: GEN,
  });
  assert.equal(r.topBuckets.length, 3);
  assert.equal(r.topBuckets[0]!.inputTokens, 20);
  assert.equal(r.topBuckets[1]!.inputTokens, 19);
  assert.equal(r.topBuckets[2]!.inputTokens, 18);
});

// ---- bottom lightest buckets refinement (v0.5.4) -------------------------

test('input-token-decile-distribution: rejects bad bottom', () => {
  assert.throws(() => buildInputTokenDecileDistribution([], { bottom: -1 }));
  assert.throws(() => buildInputTokenDecileDistribution([], { bottom: 1.5 }));
  assert.throws(() => buildInputTokenDecileDistribution([], { bottom: NaN }));
});

test('input-token-decile-distribution: bottom=0 default emits empty bottomBuckets', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 5; i++) rows.push(ql(i * 100));
  const r = buildInputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.bottom, 0);
  assert.deepEqual(r.bottomBuckets, []);
});

test('input-token-decile-distribution: bottom=3 returns 3 lightest ascending with metadata + decile tag', () => {
  const rows: QueueLine[] = [
    ql(100, { hour_start: '2026-04-20T00:00:00.000Z', source: 'codex', model: 'gpt-5' }),
    ql(900, { hour_start: '2026-04-20T01:00:00.000Z', source: 'cli-a', model: 'm-a' }),
    ql(500, { hour_start: '2026-04-20T02:00:00.000Z', source: 'cli-b', model: 'm-b' }),
    ql(800, { hour_start: '2026-04-20T03:00:00.000Z', source: 'cli-c', model: 'm-c' }),
    ql(200, { hour_start: '2026-04-20T04:00:00.000Z', source: 'cli-d', model: 'm-d' }),
  ];
  const r = buildInputTokenDecileDistribution(rows, { bottom: 3, generatedAt: GEN });
  assert.equal(r.bottomBuckets.length, 3);
  // ascending: 100, 200, 500
  assert.equal(r.bottomBuckets[0]!.inputTokens, 100);
  assert.equal(r.bottomBuckets[0]!.source, 'codex');
  assert.equal(r.bottomBuckets[0]!.decile, 1);
  assert.equal(r.bottomBuckets[1]!.inputTokens, 200);
  assert.equal(r.bottomBuckets[1]!.decile, 2);
  assert.equal(r.bottomBuckets[2]!.inputTokens, 500);
  assert.equal(r.bottomBuckets[2]!.decile, 3);
});

test('input-token-decile-distribution: top + bottom can be requested together and are independent', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) rows.push(ql(i * 100));
  const r = buildInputTokenDecileDistribution(rows, {
    top: 2,
    bottom: 2,
    generatedAt: GEN,
  });
  assert.equal(r.topBuckets.length, 2);
  assert.equal(r.topBuckets[0]!.inputTokens, 1000);
  assert.equal(r.topBuckets[1]!.inputTokens, 900);
  assert.equal(r.bottomBuckets.length, 2);
  assert.equal(r.bottomBuckets[0]!.inputTokens, 100);
  assert.equal(r.bottomBuckets[1]!.inputTokens, 200);
});

test('input-token-decile-distribution: bottom respects minInput floor (only floor survivors are eligible)', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) rows.push(ql(i, { hour_start: `2026-04-20T${String(i).padStart(2, '0')}:00:00.000Z` }));
  const r = buildInputTokenDecileDistribution(rows, {
    minInput: 15,
    bottom: 3,
    generatedAt: GEN,
  });
  assert.equal(r.bottomBuckets.length, 3);
  // Survivors: 15..20. Lightest 3 = 15, 16, 17.
  assert.equal(r.bottomBuckets[0]!.inputTokens, 15);
  assert.equal(r.bottomBuckets[1]!.inputTokens, 16);
  assert.equal(r.bottomBuckets[2]!.inputTokens, 17);
});

test('input-token-decile-distribution: bottom capped at bucketCount', () => {
  const r = buildInputTokenDecileDistribution(
    [ql(10), ql(20)],
    { bottom: 99, generatedAt: GEN },
  );
  assert.equal(r.bottomBuckets.length, 2);
  assert.equal(r.bottomBuckets[0]!.inputTokens, 10);
  assert.equal(r.bottomBuckets[1]!.inputTokens, 20);
});
