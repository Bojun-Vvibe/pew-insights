import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildPromptSize,
  DEFAULT_PROMPT_SIZE_EDGES,
} from '../src/promptsize.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, model: string, opts: Partial<QueueLine> = {}): QueueLine {
  return {
    source: opts.source ?? 'codex',
    model,
    hour_start: hourStart,
    device_id: opts.device_id ?? 'dev',
    input_tokens: opts.input_tokens ?? 1000,
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? 100,
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: opts.total_tokens ?? 1100,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('prompt-size: rejects bad minRows', () => {
  assert.throws(() => buildPromptSize([], { minRows: -1 }));
  assert.throws(() => buildPromptSize([], { minRows: 1.5 }));
  assert.throws(() => buildPromptSize([], { minRows: Number.NaN }));
});

test('prompt-size: rejects bad top', () => {
  assert.throws(() => buildPromptSize([], { top: -1 }));
  assert.throws(() => buildPromptSize([], { top: 2.5 }));
});

test('prompt-size: rejects bad since/until', () => {
  assert.throws(() => buildPromptSize([], { since: 'no' }));
  assert.throws(() => buildPromptSize([], { until: 'nope' }));
});

test('prompt-size: rejects bad edges (empty / non-zero-first / non-monotonic / negative)', () => {
  assert.throws(() => buildPromptSize([], { edges: [] }));
  assert.throws(() => buildPromptSize([], { edges: [100] }));
  assert.throws(() => buildPromptSize([], { edges: [0, 100, 100] }));
  assert.throws(() => buildPromptSize([], { edges: [0, 100, 50] }));
  assert.throws(() => buildPromptSize([], { edges: [0, -1] }));
  assert.throws(() => buildPromptSize([], { edges: [0, Number.POSITIVE_INFINITY] }));
});

// ---- empty / dropped -------------------------------------------------------

test('prompt-size: empty input → empty report (but ladder still echoed)', () => {
  const r = buildPromptSize([], { generatedAt: GEN });
  assert.equal(r.consideredRows, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.overallMeanInputTokens, 0);
  assert.equal(r.overallMaxInputTokens, 0);
  assert.equal(r.models.length, 0);
  assert.deepEqual(r.edges, DEFAULT_PROMPT_SIZE_EDGES);
  assert.equal(r.overallBuckets.length, DEFAULT_PROMPT_SIZE_EDGES.length);
  assert.ok(r.overallBuckets.every((b) => b.rows === 0 && b.share === 0));
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
});

test('prompt-size: drops bad hour_start, zero-input, and bad token rows', () => {
  const r = buildPromptSize(
    [
      ql('not-iso', 'gpt-5'),
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 0 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: -5 }),
      ql(
        '2026-04-20T03:00:00Z',
        'gpt-5',
        { input_tokens: Number.NaN as unknown as number },
      ),
      ql('2026-04-20T04:00:00Z', 'gpt-5', { input_tokens: 5000 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.droppedZeroInput, 1);
  assert.equal(r.droppedInvalidTokens, 2);
  assert.equal(r.consideredRows, 1);
  assert.equal(r.totalInputTokens, 5000);
  assert.equal(r.overallMaxInputTokens, 5000);
  assert.equal(r.overallMeanInputTokens, 5000);
});

// ---- core aggregation + bucketing ------------------------------------------

test('prompt-size: bucketises by edges and reports per-model mean/p95/max', () => {
  // Custom edges so the math is obvious: 0, 1k, 10k, 100k.
  const edges = [0, 1_000, 10_000, 100_000];
  const r = buildPromptSize(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 500 }), // bucket 0 (0–1k)
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 5_000 }), // bucket 1 (1k–10k)
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 50_000 }), // bucket 2 (10k–100k)
      ql('2026-04-20T04:00:00Z', 'gpt-5', { input_tokens: 500_000 }), // bucket 3 (100k+)
    ],
    { edges, generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 4);
  assert.equal(r.models.length, 1);
  const m = r.models[0]!;
  assert.equal(m.model, 'gpt-5');
  assert.equal(m.rows, 4);
  assert.equal(m.totalInputTokens, 555_500);
  assert.equal(m.meanInputTokens, 138_875);
  assert.equal(m.maxInputTokens, 500_000);
  // p95 with n=4: ceil(0.95*4)=4, idx=3, value 500_000.
  assert.equal(m.p95InputTokens, 500_000);
  // bucket counts: one row in each.
  assert.deepEqual(
    m.buckets.map((b) => b.rows),
    [1, 1, 1, 1],
  );
  // Bucket boundaries echo the edges, with `to=null` on the last.
  assert.deepEqual(
    m.buckets.map((b) => [b.from, b.to]),
    [
      [0, 1_000],
      [1_000, 10_000],
      [10_000, 100_000],
      [100_000, null],
    ],
  );
  // Overall buckets mirror per-model in the single-model case.
  assert.deepEqual(
    r.overallBuckets.map((b) => b.rows),
    [1, 1, 1, 1],
  );
  // Overall shares each = 0.25.
  assert.ok(r.overallBuckets.every((b) => b.share === 0.25));
});

test('prompt-size: sorts models by row count desc, then by model asc', () => {
  const r = buildPromptSize(
    [
      // gpt-5: 1 row
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      // claude-x: 3 rows (heaviest by count → first)
      ql('2026-04-20T02:00:00Z', 'claude-x', { input_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', 'claude-x', { input_tokens: 200 }),
      ql('2026-04-20T04:00:00Z', 'claude-x', { input_tokens: 300 }),
      // bbb: 2 rows
      ql('2026-04-20T05:00:00Z', 'bbb', { input_tokens: 100 }),
      ql('2026-04-20T06:00:00Z', 'bbb', { input_tokens: 200 }),
      // aaa: 2 rows — ties bbb on row count, sorts before by model asc.
      ql('2026-04-20T07:00:00Z', 'aaa', { input_tokens: 100 }),
      ql('2026-04-20T08:00:00Z', 'aaa', { input_tokens: 200 }),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['claude-x', 'aaa', 'bbb', 'gpt-5'],
  );
});

// ---- minRows filter --------------------------------------------------------

test('prompt-size: minRows hides low-row models without affecting global denom', () => {
  const r = buildPromptSize(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 200 }),
      ql('2026-04-20T03:00:00Z', 'one-shot', { input_tokens: 1000 }),
    ],
    { minRows: 2, generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 3);
  assert.equal(r.totalInputTokens, 1300);
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'gpt-5');
  assert.equal(r.droppedModelRows, 1);
  // Overall buckets still count the dropped model's row.
  const totalOverallRows = r.overallBuckets.reduce((s, b) => s + b.rows, 0);
  assert.equal(totalOverallRows, 3);
});

// ---- window filter ---------------------------------------------------------

test('prompt-size: since/until window filters by hour_start', () => {
  const r = buildPromptSize(
    [
      ql('2026-04-19T23:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T00:00:00Z', 'gpt-5', { input_tokens: 200 }),
      ql('2026-04-20T05:00:00Z', 'gpt-5', { input_tokens: 300 }),
      ql('2026-04-20T06:00:00Z', 'gpt-5', { input_tokens: 400 }),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-20T06:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredRows, 2);
  assert.equal(r.totalInputTokens, 500);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-20T06:00:00Z');
});

// ---- top filter ------------------------------------------------------------

test('prompt-size: top truncates models[] but preserves global denom', () => {
  const r = buildPromptSize(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', 'claude-x', { input_tokens: 100 }),
      ql('2026-04-20T05:00:00Z', 'gemini', { input_tokens: 100 }),
    ],
    { top: 1, generatedAt: GEN },
  );
  assert.equal(r.models.length, 1);
  assert.equal(r.models[0]!.model, 'gpt-5');
  assert.equal(r.droppedTopModels, 2);
  assert.equal(r.totalInputTokens, 500);
});

test('prompt-size: top=0 means no cap, droppedTopModels stays 0', () => {
  const r = buildPromptSize(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'claude-x', { input_tokens: 100 }),
    ],
    { top: 0, generatedAt: GEN },
  );
  assert.equal(r.models.length, 2);
  assert.equal(r.droppedTopModels, 0);
});

test('prompt-size: top combines with minRows correctly (minRows applied first)', () => {
  const r = buildPromptSize(
    [
      // gpt-5: 2 rows — survives minRows
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 200 }),
      // single-row big model — dropped by minRows even though row count
      // would otherwise tie with the survivors.
      ql('2026-04-20T03:00:00Z', 'one-shot-big', { input_tokens: 9999 }),
      // claude-x: 2 rows — survives minRows
      ql('2026-04-20T04:00:00Z', 'claude-x', { input_tokens: 100 }),
      ql('2026-04-20T05:00:00Z', 'claude-x', { input_tokens: 100 }),
    ],
    { minRows: 2, top: 1, generatedAt: GEN },
  );
  assert.equal(r.droppedModelRows, 1);
  assert.equal(r.models.length, 1);
  // Tie on rows (2 vs 2) → secondary sort is model asc, so claude-x wins.
  assert.equal(r.models[0]!.model, 'claude-x');
  assert.equal(r.droppedTopModels, 1);
});

// ---- p95 sanity ------------------------------------------------------------

test('prompt-size: p95 uses nearest-rank on the per-row sample', () => {
  // 20 rows: 1..20. nearest-rank p95 = ceil(0.95*20)=19 → value 19.
  const rows: QueueLine[] = [];
  for (let i = 1; i <= 20; i++) {
    rows.push(ql(`2026-04-20T${String(i).padStart(2, '0')}:00:00Z`, 'gpt-5', { input_tokens: i }));
  }
  const r = buildPromptSize(rows, { generatedAt: GEN });
  assert.equal(r.models[0]!.p95InputTokens, 19);
  assert.equal(r.models[0]!.maxInputTokens, 20);
});

// ---- determinism -----------------------------------------------------------

test('prompt-size: deterministic — same input, same output', () => {
  const input: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 5_000 }),
    ql('2026-04-20T02:00:00Z', 'claude-x', { input_tokens: 50_000 }),
    ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 250_000 }),
  ];
  const a = buildPromptSize(input, { generatedAt: GEN });
  const b = buildPromptSize(input, { generatedAt: GEN });
  assert.deepEqual(a, b);
});

// ---- atLeast filter --------------------------------------------------------

test('prompt-size: rejects bad atLeast', () => {
  assert.throws(() => buildPromptSize([], { atLeast: -1 }));
  assert.throws(() => buildPromptSize([], { atLeast: Number.NaN }));
  assert.throws(() => buildPromptSize([], { atLeast: Number.POSITIVE_INFINITY }));
});

test('prompt-size: atLeast=0 is the default and changes nothing', () => {
  const rows: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 1 }),
    ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 1_000_000 }),
  ];
  const a = buildPromptSize(rows, { generatedAt: GEN });
  const b = buildPromptSize(rows, { atLeast: 0, generatedAt: GEN });
  assert.deepEqual(a, b);
  assert.equal(a.atLeast, 0);
  assert.equal(a.droppedAtLeast, 0);
});

test('prompt-size: atLeast filters BEFORE bucketing/mean/p95', () => {
  // 5 rows: 100, 1k, 100k, 500k, 2M. atLeast=200_000 keeps the last two.
  const r = buildPromptSize(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 1_000 }),
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 100_000 }),
      ql('2026-04-20T04:00:00Z', 'gpt-5', { input_tokens: 500_000 }),
      ql('2026-04-20T05:00:00Z', 'gpt-5', { input_tokens: 2_000_000 }),
    ],
    { atLeast: 200_000, generatedAt: GEN },
  );
  assert.equal(r.atLeast, 200_000);
  assert.equal(r.droppedAtLeast, 3);
  assert.equal(r.consideredRows, 2);
  assert.equal(r.totalInputTokens, 2_500_000);
  // Mean reflects ONLY the survivors.
  assert.equal(r.overallMeanInputTokens, 1_250_000);
  assert.equal(r.overallMaxInputTokens, 2_000_000);
  // The two survivors land in 200k-500k and 1M+ buckets respectively.
  const m = r.models[0]!;
  assert.equal(m.rows, 2);
  // Default ladder edges = [0, 4k, 32k, 128k, 200k, 500k, 1M].
  // 500_000 → bucket index 5 (500k–1M); 2_000_000 → bucket index 6 (1M+).
  assert.equal(m.buckets[5]!.rows, 1);
  assert.equal(m.buckets[6]!.rows, 1);
  assert.equal(m.buckets[0]!.rows, 0);
});

test('prompt-size: atLeast composes with window filter', () => {
  const r = buildPromptSize(
    [
      // outside window → not counted in any drop bucket
      ql('2026-04-19T23:00:00Z', 'gpt-5', { input_tokens: 100 }),
      // inside window, below atLeast → droppedAtLeast
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      // inside window, above atLeast → counted
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 5_000 }),
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-20T06:00:00Z',
      atLeast: 1_000,
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredRows, 1);
  assert.equal(r.droppedAtLeast, 1);
  assert.equal(r.totalInputTokens, 5_000);
});

test('prompt-size: atLeast above every observed row leaves an empty considered population', () => {
  // Pathological knob: nobody can clear the floor. The report should
  // still come back coherently shaped — empty models, zero-row buckets,
  // and droppedAtLeast accounting for the full kept-by-window set.
  const r = buildPromptSize(
    [
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', 'claude-x', { input_tokens: 50_000 }),
      ql('2026-04-20T03:00:00Z', 'gemini', { input_tokens: 999_999 }),
    ],
    { atLeast: 1_000_000, generatedAt: GEN },
  );
  assert.equal(r.consideredRows, 0);
  assert.equal(r.droppedAtLeast, 3);
  assert.equal(r.models.length, 0);
  assert.equal(r.totalInputTokens, 0);
  assert.equal(r.overallMeanInputTokens, 0);
  assert.equal(r.overallMaxInputTokens, 0);
  assert.ok(r.overallBuckets.every((b) => b.rows === 0 && b.share === 0));
});

test('prompt-size: atLeast composes with top — top still acts on filtered survivors', () => {
  const r = buildPromptSize(
    [
      // gpt-5: 3 rows, all clearing atLeast=1000
      ql('2026-04-20T01:00:00Z', 'gpt-5', { input_tokens: 5_000 }),
      ql('2026-04-20T02:00:00Z', 'gpt-5', { input_tokens: 6_000 }),
      ql('2026-04-20T03:00:00Z', 'gpt-5', { input_tokens: 7_000 }),
      // claude: 2 rows, clearing atLeast
      ql('2026-04-20T04:00:00Z', 'claude-x', { input_tokens: 5_000 }),
      ql('2026-04-20T05:00:00Z', 'claude-x', { input_tokens: 5_000 }),
      // gemini: 1 row clearing atLeast
      ql('2026-04-20T06:00:00Z', 'gemini', { input_tokens: 9_999_999 }),
      // small-fry: 5 rows BELOW atLeast — drop them entirely so they
      // can't game the per-model row count rankings.
      ql('2026-04-20T07:00:00Z', 'small-fry', { input_tokens: 100 }),
      ql('2026-04-20T08:00:00Z', 'small-fry', { input_tokens: 100 }),
      ql('2026-04-20T09:00:00Z', 'small-fry', { input_tokens: 100 }),
      ql('2026-04-20T10:00:00Z', 'small-fry', { input_tokens: 100 }),
      ql('2026-04-20T11:00:00Z', 'small-fry', { input_tokens: 100 }),
    ],
    { atLeast: 1_000, top: 2, generatedAt: GEN },
  );
  assert.equal(r.droppedAtLeast, 5);
  // top=2 keeps gpt-5 (3 rows) + claude-x (2 rows); gemini (1 row) drops.
  assert.equal(r.models.length, 2);
  assert.deepEqual(
    r.models.map((m) => m.model),
    ['gpt-5', 'claude-x'],
  );
  assert.equal(r.droppedTopModels, 1);
});
