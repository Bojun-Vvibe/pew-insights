import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildModelCohabitation } from '../src/modelcohabitation.js';
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

const GEN = '2026-04-25T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('model-cohabitation: rejects bad minCoBuckets', () => {
  assert.throws(() => buildModelCohabitation([], { minCoBuckets: -1 }));
  assert.throws(() => buildModelCohabitation([], { minCoBuckets: 1.5 }));
});

test('model-cohabitation: rejects bad top', () => {
  assert.throws(() => buildModelCohabitation([], { top: -1 }));
  assert.throws(() => buildModelCohabitation([], { top: 2.5 }));
});

test('model-cohabitation: rejects bad since/until', () => {
  assert.throws(() => buildModelCohabitation([], { since: 'not-a-date' }));
  assert.throws(() => buildModelCohabitation([], { until: 'nope' }));
});

// ---- empty / edge ----------------------------------------------------------

test('model-cohabitation: empty queue returns zeros', () => {
  const r = buildModelCohabitation([], { generatedAt: GEN });
  assert.equal(r.totalBuckets, 0);
  assert.equal(r.multiModelBuckets, 0);
  assert.equal(r.totalModels, 0);
  assert.equal(r.totalPairs, 0);
  assert.deepEqual(r.models, []);
  assert.deepEqual(r.pairs, []);
});

test('model-cohabitation: single bucket with single model -> no pairs', () => {
  const r = buildModelCohabitation(
    [ql('2026-04-20T01:00:00Z', { model: 'gpt-5', total_tokens: 500 })],
    { generatedAt: GEN },
  );
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.multiModelBuckets, 0);
  assert.equal(r.totalModels, 1);
  assert.equal(r.totalPairs, 0);
  assert.equal(r.models[0].model, 'gpt-5');
  assert.equal(r.models[0].bucketsActive, 1);
  assert.equal(r.models[0].distinctCohabitants, 0);
});

test('model-cohabitation: drops zero-token rows and bad hour_start', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5', total_tokens: 0 }),
      ql('not-a-date', { model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalTokens, 100);
});

// ---- pair semantics --------------------------------------------------------

test('model-cohabitation: two models in same bucket -> one pair', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5', total_tokens: 200 }),
      ql('2026-04-20T01:00:00Z', { model: 'claude-opus-4.7', total_tokens: 300 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.multiModelBuckets, 1);
  assert.equal(r.totalPairs, 1);
  const p = r.pairs[0];
  // lex sort: 'claude-opus-4.7' < 'gpt-5'
  assert.equal(p.modelA, 'claude-opus-4.7');
  assert.equal(p.modelB, 'gpt-5');
  assert.equal(p.coBuckets, 1);
  assert.equal(p.coTokens, 200); // min(300, 200)
  assert.equal(p.cohabIndex, 1); // both appear in exactly the same buckets
  assert.equal(p.coShareA, 1);
  assert.equal(p.coShareB, 1);
});

test('model-cohabitation: cohabIndex = Jaccard on bucket-presence', () => {
  // model A in buckets 1,2,3; model B in buckets 2,3,4 -> co=2, |A|=3, |B|=3
  // jaccard = 2 / (3+3-2) = 2/4 = 0.5
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a' }),
      ql('2026-04-20T02:00:00Z', { model: 'a' }),
      ql('2026-04-20T03:00:00Z', { model: 'a' }),
      ql('2026-04-20T02:00:00Z', { model: 'b' }),
      ql('2026-04-20T03:00:00Z', { model: 'b' }),
      ql('2026-04-20T04:00:00Z', { model: 'b' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalBuckets, 4);
  assert.equal(r.multiModelBuckets, 2);
  assert.equal(r.pairs.length, 1);
  const p = r.pairs[0];
  assert.equal(p.coBuckets, 2);
  assert.equal(p.cohabIndex, 0.5);
  assert.equal(p.coShareA, 2 / 3);
  assert.equal(p.coShareB, 2 / 3);
});

test('model-cohabitation: coTokens uses min in each bucket', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'b', total_tokens: 1000 }),
      ql('2026-04-20T02:00:00Z', { model: 'a', total_tokens: 500 }),
      ql('2026-04-20T02:00:00Z', { model: 'b', total_tokens: 50 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.pairs[0].coBuckets, 2);
  // bucket1: min(100,1000)=100; bucket2: min(500,50)=50; sum=150
  assert.equal(r.pairs[0].coTokens, 150);
});

test('model-cohabitation: three models in one bucket -> 3 pairs', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a' }),
      ql('2026-04-20T01:00:00Z', { model: 'b' }),
      ql('2026-04-20T01:00:00Z', { model: 'c' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalPairs, 3);
  assert.deepEqual(
    r.pairs.map((p) => `${p.modelA}|${p.modelB}`).sort(),
    ['a|b', 'a|c', 'b|c'],
  );
  // each model has 2 distinct cohabitants
  for (const m of r.models) {
    assert.equal(m.distinctCohabitants, 2);
  }
});

test('model-cohabitation: rows of same model in same bucket sum tokens (do not double-count buckets)', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a', total_tokens: 100, source: 'codex' }),
      ql('2026-04-20T01:00:00Z', { model: 'a', total_tokens: 200, source: 'claude-code' }),
      ql('2026-04-20T01:00:00Z', { model: 'b', total_tokens: 50 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.models.find((m) => m.model === 'a')!.bucketsActive, 1);
  assert.equal(r.models.find((m) => m.model === 'a')!.tokens, 300);
  // pair coTokens = min(300, 50) = 50
  assert.equal(r.pairs[0].coTokens, 50);
});

// ---- filters ---------------------------------------------------------------

test('model-cohabitation: minCoBuckets hides low-co pairs but reports drop count', () => {
  const r = buildModelCohabitation(
    [
      // pair (a,b) co=2
      ql('2026-04-20T01:00:00Z', { model: 'a' }),
      ql('2026-04-20T01:00:00Z', { model: 'b' }),
      ql('2026-04-20T02:00:00Z', { model: 'a' }),
      ql('2026-04-20T02:00:00Z', { model: 'b' }),
      // pair (a,c) co=1
      ql('2026-04-20T03:00:00Z', { model: 'a' }),
      ql('2026-04-20T03:00:00Z', { model: 'c' }),
    ],
    { generatedAt: GEN, minCoBuckets: 2 },
  );
  assert.equal(r.totalPairs, 2);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.droppedMinCoBuckets, 1);
  assert.equal(r.pairs[0].coBuckets, 2);
});

test('model-cohabitation: top cap truncates after sort', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a' }),
      ql('2026-04-20T01:00:00Z', { model: 'b' }),
      ql('2026-04-20T01:00:00Z', { model: 'c' }),
      ql('2026-04-20T02:00:00Z', { model: 'a' }),
      ql('2026-04-20T02:00:00Z', { model: 'b' }),
    ],
    { generatedAt: GEN, top: 1 },
  );
  // pairs: (a,b)=2, (a,c)=1, (b,c)=1 -> top 1 keeps (a,b)
  assert.equal(r.totalPairs, 3);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.droppedTopPairs, 2);
  assert.equal(r.pairs[0].modelA, 'a');
  assert.equal(r.pairs[0].modelB, 'b');
});

test('model-cohabitation: source filter restricts rows', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a', source: 'codex' }),
      ql('2026-04-20T01:00:00Z', { model: 'b', source: 'codex' }),
      ql('2026-04-20T02:00:00Z', { model: 'a', source: 'claude-code' }),
      ql('2026-04-20T02:00:00Z', { model: 'b', source: 'claude-code' }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.source, 'codex');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.pairs.length, 1);
  assert.equal(r.pairs[0].coBuckets, 1);
});

test('model-cohabitation: null/empty source filter disables the filter', () => {
  const queue = [
    ql('2026-04-20T01:00:00Z', { model: 'a', source: 'codex' }),
    ql('2026-04-20T01:00:00Z', { model: 'b', source: 'claude-code' }),
  ];
  const r1 = buildModelCohabitation(queue, { generatedAt: GEN, source: null });
  const r2 = buildModelCohabitation(queue, { generatedAt: GEN, source: '' });
  assert.equal(r1.droppedSourceFilter, 0);
  assert.equal(r2.droppedSourceFilter, 0);
  assert.equal(r1.pairs.length, 1);
  assert.equal(r2.pairs.length, 1);
});

// ---- window ----------------------------------------------------------------

test('model-cohabitation: respects since/until window', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-19T23:00:00Z', { model: 'a' }),
      ql('2026-04-19T23:00:00Z', { model: 'b' }),
      ql('2026-04-20T01:00:00Z', { model: 'a' }),
      ql('2026-04-20T01:00:00Z', { model: 'b' }),
      ql('2026-04-21T01:00:00Z', { model: 'a' }),
      ql('2026-04-21T01:00:00Z', { model: 'b' }),
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
    },
  );
  assert.equal(r.totalBuckets, 1);
  assert.equal(r.pairs[0].coBuckets, 1);
});

// ---- determinism -----------------------------------------------------------

test('model-cohabitation: pair sort is deterministic (coBuckets desc, coTokens desc, lex)', () => {
  const r = buildModelCohabitation(
    [
      // (a,b): co=1, coTok=10
      ql('2026-04-20T01:00:00Z', { model: 'a', total_tokens: 10 }),
      ql('2026-04-20T01:00:00Z', { model: 'b', total_tokens: 100 }),
      // (c,d): co=1, coTok=50
      ql('2026-04-20T02:00:00Z', { model: 'c', total_tokens: 50 }),
      ql('2026-04-20T02:00:00Z', { model: 'd', total_tokens: 100 }),
      // (e,f): co=2, coTok=20
      ql('2026-04-20T03:00:00Z', { model: 'e', total_tokens: 10 }),
      ql('2026-04-20T03:00:00Z', { model: 'f', total_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', { model: 'e', total_tokens: 10 }),
      ql('2026-04-20T04:00:00Z', { model: 'f', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.pairs[0].modelA + '|' + r.pairs[0].modelB, 'e|f');
  assert.equal(r.pairs[1].modelA + '|' + r.pairs[1].modelB, 'c|d');
  assert.equal(r.pairs[2].modelA + '|' + r.pairs[2].modelB, 'a|b');
});

// ---- --by-model filter -----------------------------------------------------

test('model-cohabitation: byModel filter restricts pair rows to those including the model', () => {
  const queue: QueueLine[] = [
    // pairs: (a,b), (a,c), (b,c)
    ql('2026-04-20T01:00:00Z', { model: 'a' }),
    ql('2026-04-20T01:00:00Z', { model: 'b' }),
    ql('2026-04-20T02:00:00Z', { model: 'a' }),
    ql('2026-04-20T02:00:00Z', { model: 'c' }),
    ql('2026-04-20T03:00:00Z', { model: 'b' }),
    ql('2026-04-20T03:00:00Z', { model: 'c' }),
  ];
  const r = buildModelCohabitation(queue, { generatedAt: GEN, byModel: 'a' });
  assert.equal(r.byModel, 'a');
  assert.equal(r.totalPairs, 3);
  assert.equal(r.pairs.length, 2);
  assert.equal(r.droppedByModelFilter, 1);
  for (const p of r.pairs) {
    assert.ok(p.modelA === 'a' || p.modelB === 'a');
  }
  // top-level numbers are untouched
  assert.equal(r.totalBuckets, 3);
  assert.equal(r.multiModelBuckets, 3);
});

test('model-cohabitation: byModel filter null/empty disables the filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', { model: 'a' }),
    ql('2026-04-20T01:00:00Z', { model: 'b' }),
    ql('2026-04-20T02:00:00Z', { model: 'b' }),
    ql('2026-04-20T02:00:00Z', { model: 'c' }),
  ];
  const r1 = buildModelCohabitation(queue, { generatedAt: GEN, byModel: null });
  const r2 = buildModelCohabitation(queue, { generatedAt: GEN, byModel: '' });
  assert.equal(r1.byModel, null);
  assert.equal(r2.byModel, null);
  assert.equal(r1.pairs.length, 2);
  assert.equal(r2.pairs.length, 2);
  assert.equal(r1.droppedByModelFilter, 0);
});

test('model-cohabitation: byModel filter that matches nothing yields empty pairs and accounts for drops', () => {
  const r = buildModelCohabitation(
    [
      ql('2026-04-20T01:00:00Z', { model: 'a' }),
      ql('2026-04-20T01:00:00Z', { model: 'b' }),
    ],
    { generatedAt: GEN, byModel: 'no-such-model' },
  );
  assert.equal(r.totalPairs, 1);
  assert.equal(r.pairs.length, 0);
  assert.equal(r.droppedByModelFilter, 1);
});

test('model-cohabitation: byModel filter composes with --top (top is applied after filter)', () => {
  const queue: QueueLine[] = [
    // (a,b)=2
    ql('2026-04-20T01:00:00Z', { model: 'a' }),
    ql('2026-04-20T01:00:00Z', { model: 'b' }),
    ql('2026-04-20T02:00:00Z', { model: 'a' }),
    ql('2026-04-20T02:00:00Z', { model: 'b' }),
    // (a,c)=1
    ql('2026-04-20T03:00:00Z', { model: 'a' }),
    ql('2026-04-20T03:00:00Z', { model: 'c' }),
    // (b,c)=1
    ql('2026-04-20T04:00:00Z', { model: 'b' }),
    ql('2026-04-20T04:00:00Z', { model: 'c' }),
  ];
  const r = buildModelCohabitation(queue, {
    generatedAt: GEN,
    byModel: 'a',
    top: 1,
  });
  // After filter: (a,b)=2, (a,c)=1; top 1 keeps (a,b)
  assert.equal(r.pairs.length, 1);
  assert.equal(r.droppedByModelFilter, 1); // (b,c) dropped
  assert.equal(r.droppedTopPairs, 1); // (a,c) dropped after byModel
  assert.equal(r.pairs[0].modelA, 'a');
  assert.equal(r.pairs[0].modelB, 'b');
});
