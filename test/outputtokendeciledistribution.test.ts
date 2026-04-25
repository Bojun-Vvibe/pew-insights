import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildOutputTokenDecileDistribution } from '../src/outputtokendeciledistribution.js';
import type { QueueLine } from '../src/types.js';

function ql(out: number, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model: opts.model ?? 'gpt-5',
    hour_start: opts.hour_start ?? '2026-04-20T12:00:00.000Z',
    device_id: opts.device_id ?? 'dev-a',
    input_tokens: opts.input_tokens ?? 100,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: out,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 200,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation ----------------------------------------------------

test('output-token-decile-distribution: rejects bad since/until', () => {
  assert.throws(() => buildOutputTokenDecileDistribution([], { since: 'nope' }));
  assert.throws(() => buildOutputTokenDecileDistribution([], { until: 'nope' }));
});

// ---- empty / drops --------------------------------------------------------

test('output-token-decile-distribution: empty queue -> zero buckets, null stats', () => {
  const r = buildOutputTokenDecileDistribution([], { generatedAt: GEN });
  assert.equal(r.bucketCount, 0);
  assert.equal(r.totalOutputTokens, 0);
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

test('output-token-decile-distribution: drop counters attribute correctly', () => {
  const r = buildOutputTokenDecileDistribution(
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
  assert.equal(r.droppedInvalidOutput, 1);
  assert.equal(r.droppedZeroOutput, 1);
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.bucketCount, 1);
});

// ---- partitioning correctness --------------------------------------------

test('output-token-decile-distribution: 10 buckets -> exactly one per decile', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 10; i++) rows.push(ql(i * 100));
  const r = buildOutputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.bucketCount, 10);
  assert.equal(r.totalOutputTokens, 5500);
  for (let d = 0; d < 10; d++) {
    assert.equal(r.deciles[d]!.bucketCount, 1);
    assert.equal(r.deciles[d]!.tokensInDecile, (d + 1) * 100);
  }
  // D1 = 100/5500, D10 = 1000/5500
  assert.ok(Math.abs(r.deciles[0]!.shareOfTokens - 100 / 5500) < 1e-12);
  assert.ok(Math.abs(r.deciles[9]!.shareOfTokens - 1000 / 5500) < 1e-12);
});

test('output-token-decile-distribution: remainder distributes onto lowest deciles', () => {
  // 13 rows -> sizes [2,2,2,1,1,1,1,1,1,1] (3 extras spread onto D1..D3)
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 13; i++) rows.push(ql(i));
  const r = buildOutputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.equal(r.bucketCount, 13);
  const sizes = r.deciles.map((d) => d.bucketCount);
  assert.deepEqual(sizes, [2, 2, 2, 1, 1, 1, 1, 1, 1, 1]);
  // ascending sorted: 1..13. D1 = [1,2], D2 = [3,4], D3 = [5,6], D4=7,...
  assert.equal(r.deciles[0]!.tokensInDecile, 3);
  assert.equal(r.deciles[1]!.tokensInDecile, 7);
  assert.equal(r.deciles[2]!.tokensInDecile, 11);
  assert.equal(r.deciles[3]!.tokensInDecile, 7);
  assert.equal(r.deciles[9]!.tokensInDecile, 13);
});

test('output-token-decile-distribution: fewer than 10 rows -> only leading deciles populated', () => {
  // 3 rows -> sizes [1,1,1,0,0,0,0,0,0,0]
  const r = buildOutputTokenDecileDistribution(
    [ql(10), ql(20), ql(30)],
    { generatedAt: GEN },
  );
  const sizes = r.deciles.map((d) => d.bucketCount);
  assert.deepEqual(sizes, [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(r.deciles[0]!.tokensInDecile, 10);
  assert.equal(r.deciles[2]!.tokensInDecile, 30);
  assert.equal(r.deciles[9]!.bucketCount, 0);
});

// ---- decile per-row stats -------------------------------------------------

test('output-token-decile-distribution: per-decile min/mean/max correct', () => {
  // 20 buckets: 1..20. Each decile has 2 buckets.
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) rows.push(ql(i));
  const r = buildOutputTokenDecileDistribution(rows, { generatedAt: GEN });
  // D1 = [1,2] -> min 1, mean 1.5, max 2
  assert.equal(r.deciles[0]!.minOutput, 1);
  assert.equal(r.deciles[0]!.meanOutput, 1.5);
  assert.equal(r.deciles[0]!.maxOutput, 2);
  // D10 = [19,20] -> min 19, mean 19.5, max 20
  assert.equal(r.deciles[9]!.minOutput, 19);
  assert.equal(r.deciles[9]!.meanOutput, 19.5);
  assert.equal(r.deciles[9]!.maxOutput, 20);
});

// ---- Gini -----------------------------------------------------------------

test('output-token-decile-distribution: uniform distribution -> gini ~ 0', () => {
  const rows: QueueLine[] = [];
  for (let i = 0; i < 10; i++) rows.push(ql(100));
  const r = buildOutputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.ok(r.gini! < 1e-9, `expected gini ~ 0, got ${r.gini}`);
});

test('output-token-decile-distribution: highly skewed distribution -> gini close to (n-1)/n', () => {
  // n=10, all mass in one bucket -> classical max gini = (n-1)/n = 0.9
  const rows: QueueLine[] = [];
  for (let i = 0; i < 9; i++) rows.push(ql(1)); // tiny
  rows.push(ql(1_000_000));
  const r = buildOutputTokenDecileDistribution(rows, { generatedAt: GEN });
  assert.ok(r.gini! > 0.85 && r.gini! <= 0.9 + 1e-9, `gini=${r.gini}`);
});

// ---- top-K share ----------------------------------------------------------

test('output-token-decile-distribution: top-10% share equals D10 share when N % 10 == 0', () => {
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 30; i++) rows.push(ql(i));
  const r = buildOutputTokenDecileDistribution(rows, { generatedAt: GEN });
  // top 3 of 30 = ceil(30*0.10) = 3 -> 28+29+30=87, total = 465
  assert.ok(Math.abs(r.p90Share! - 87 / 465) < 1e-12);
  // p99 = ceil(30*0.01) = 1 -> 30/465
  assert.ok(Math.abs(r.p99Share! - 30 / 465) < 1e-12);
  // D10 should also be 87/465 (sizes uniform)
  assert.ok(Math.abs(r.deciles[9]!.shareOfTokens - r.p90Share!) < 1e-12);
});

// ---- window filtering -----------------------------------------------------

test('output-token-decile-distribution: since/until window respected', () => {
  const rows: QueueLine[] = [
    ql(100, { hour_start: '2026-04-20T00:00:00.000Z' }),
    ql(200, { hour_start: '2026-04-21T00:00:00.000Z' }),
    ql(300, { hour_start: '2026-04-22T00:00:00.000Z' }),
  ];
  const r = buildOutputTokenDecileDistribution(rows, {
    since: '2026-04-21T00:00:00.000Z',
    until: '2026-04-22T00:00:00.000Z',
    generatedAt: GEN,
  });
  assert.equal(r.bucketCount, 1);
  assert.equal(r.totalOutputTokens, 200);
});

// ---- determinism ----------------------------------------------------------

test('output-token-decile-distribution: input order does not affect output', () => {
  const a: QueueLine[] = [];
  for (let i = 1; i <= 25; i++) a.push(ql(i * 7));
  const b = [...a].reverse();
  const ra = buildOutputTokenDecileDistribution(a, { generatedAt: GEN });
  const rb = buildOutputTokenDecileDistribution(b, { generatedAt: GEN });
  assert.deepEqual(ra, rb);
});
