import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildProviderTenure } from '../src/providertenure.js';
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

// ---- option validation ----------------------------------------------------

test('provider-tenure: rejects bad since/until', () => {
  assert.throws(() => buildProviderTenure([], { since: 'not-a-date' }));
  assert.throws(() => buildProviderTenure([], { until: 'nope' }));
});

test('provider-tenure: rejects bad top', () => {
  assert.throws(() => buildProviderTenure([], { top: -1 }));
  assert.throws(() => buildProviderTenure([], { top: 1.5 }));
});

test('provider-tenure: rejects bad sort', () => {
  assert.throws(() =>
    buildProviderTenure([], { sort: 'bogus' as unknown as 'span' }),
  );
});

// ---- empty / drops --------------------------------------------------------

test('provider-tenure: empty queue returns zeros', () => {
  const r = buildProviderTenure([], { generatedAt: GEN });
  assert.equal(r.totalProviders, 0);
  assert.equal(r.totalActiveBuckets, 0);
  assert.equal(r.totalTokens, 0);
  assert.deepEqual(r.providers, []);
});

test('provider-tenure: drops zero-token rows and bad hour_start', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T01:00:00Z', { total_tokens: 0 }),
      ql('not-a-date', { total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { total_tokens: 500 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedZeroTokens, 1);
  assert.equal(r.droppedInvalidHourStart, 1);
  assert.equal(r.totalActiveBuckets, 1);
  assert.equal(r.totalTokens, 500);
});

// ---- provider rollup is the whole point ----------------------------------

test('provider-tenure: rolls multiple model ids into the same provider', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T00:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5-mini', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { model: 'gpt-4o', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.providers.length, 1);
  const p = r.providers[0]!;
  assert.equal(p.provider, 'openai');
  assert.equal(p.activeBuckets, 3);
  assert.equal(p.distinctModels, 3);
  assert.equal(p.tokens, 300);
  assert.equal(p.spanHours, 2);
});

test('provider-tenure: separates anthropic vs openai vs google vs xai', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T00:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'claude-opus-4.7', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { model: 'gemini-3-pro-preview', total_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', { model: 'grok-4', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.providers.length, 4);
  const names = new Set(r.providers.map((p) => p.provider));
  assert.ok(names.has('openai'));
  assert.ok(names.has('anthropic'));
  assert.ok(names.has('google'));
  assert.ok(names.has('xai'));
});

// ---- single-bucket --------------------------------------------------------

test('provider-tenure: single-bucket provider has spanHours == 0, tok/span-hr uses 1h floor', () => {
  const r = buildProviderTenure(
    [ql('2026-04-20T05:00:00Z', { model: 'gpt-5', total_tokens: 100 })],
    { generatedAt: GEN },
  );
  assert.equal(r.providers.length, 1);
  const p = r.providers[0]!;
  assert.equal(p.spanHours, 0);
  assert.equal(p.activeBuckets, 1);
  assert.equal(p.tokens, 100);
  assert.equal(p.tokensPerSpanHour, 100);
  assert.equal(p.distinctModels, 1);
});

// ---- multi-device dedupe ---------------------------------------------------

test('provider-tenure: same provider+hour from multiple devices counts as one active bucket', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5', device_id: 'dev-a', total_tokens: 300 }),
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5-mini', device_id: 'dev-b', total_tokens: 200 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.providers.length, 1);
  assert.equal(r.providers[0]!.activeBuckets, 1);
  assert.equal(r.providers[0]!.tokens, 500);
  assert.equal(r.providers[0]!.distinctModels, 2);
});

// ---- source filter --------------------------------------------------------

test('provider-tenure: source filter excludes non-matching rows and counts them', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T01:00:00Z', { source: 'codex', model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { source: 'cursor', model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', { source: 'codex', model: 'gpt-5', total_tokens: 100 }),
    ],
    { generatedAt: GEN, source: 'codex' },
  );
  assert.equal(r.droppedSourceFilter, 1);
  assert.equal(r.source, 'codex');
  assert.equal(r.providers.length, 1);
  assert.equal(r.providers[0]!.activeBuckets, 2);
});

// ---- since/until window ---------------------------------------------------

test('provider-tenure: since/until windowing trims firstSeen/lastSeen', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-19T23:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T05:00:00Z', { total_tokens: 100 }),
      ql('2026-04-20T15:00:00Z', { total_tokens: 100 }),
      ql('2026-04-21T05:00:00Z', { total_tokens: 100 }),
    ],
    {
      generatedAt: GEN,
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
    },
  );
  const p = r.providers[0]!;
  assert.equal(p.firstSeen, '2026-04-20T05:00:00.000Z');
  assert.equal(p.lastSeen, '2026-04-20T15:00:00.000Z');
  assert.equal(p.activeBuckets, 2);
  assert.equal(p.spanHours, 10);
});

// ---- sort keys ------------------------------------------------------------

test('provider-tenure: default sort=span orders by spanHours desc with name tiebreak', () => {
  const r = buildProviderTenure(
    [
      // openai: span 4h
      ql('2026-04-20T00:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
      // anthropic: span 9h
      ql('2026-04-20T00:00:00Z', { model: 'claude-opus-4.7', total_tokens: 100 }),
      ql('2026-04-20T09:00:00Z', { model: 'claude-opus-4.7', total_tokens: 100 }),
      // google: span 4h (tie with openai)
      ql('2026-04-20T00:00:00Z', { model: 'gemini-3-pro-preview', total_tokens: 100 }),
      ql('2026-04-20T04:00:00Z', { model: 'gemini-3-pro-preview', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  // anthropic 9h > google 4h == openai 4h; tiebreak google < openai (lex)
  assert.deepEqual(
    r.providers.map((p) => p.provider),
    ['anthropic', 'google', 'openai'],
  );
});

test('provider-tenure: sort=tokens orders by tokens desc', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T00:00:00Z', { model: 'gpt-5', total_tokens: 5000 }),
      ql('2026-04-20T01:00:00Z', { model: 'claude-opus-4.7', total_tokens: 100 }),
    ],
    { generatedAt: GEN, sort: 'tokens' },
  );
  assert.equal(r.sort, 'tokens');
  assert.deepEqual(r.providers.map((p) => p.provider), ['openai', 'anthropic']);
});

test('provider-tenure: sort=models orders by distinctModels desc', () => {
  const r = buildProviderTenure(
    [
      // openai: 3 distinct models
      ql('2026-04-20T00:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5-mini', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { model: 'gpt-4o', total_tokens: 100 }),
      // anthropic: 1 model
      ql('2026-04-20T00:00:00Z', { model: 'claude-opus-4.7', total_tokens: 100 }),
    ],
    { generatedAt: GEN, sort: 'models' },
  );
  assert.equal(r.sort, 'models');
  assert.deepEqual(r.providers.map((p) => p.provider), ['openai', 'anthropic']);
  assert.equal(r.providers[0]!.distinctModels, 3);
  assert.equal(r.providers[1]!.distinctModels, 1);
});

// ---- top cap --------------------------------------------------------------

test('provider-tenure: top cap drops to droppedTopProviders, totals stay full-population', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T00:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'claude-opus-4.7', total_tokens: 100 }),
      ql('2026-04-20T02:00:00Z', { model: 'gemini-3-pro-preview', total_tokens: 100 }),
      ql('2026-04-20T03:00:00Z', { model: 'grok-4', total_tokens: 100 }),
    ],
    { generatedAt: GEN, top: 2 },
  );
  assert.equal(r.totalProviders, 4);
  assert.equal(r.totalActiveBuckets, 4);
  assert.equal(r.totalTokens, 400);
  assert.equal(r.droppedTopProviders, 2);
  assert.equal(r.providers.length, 2);
  assert.equal(r.top, 2);
});

// ---- unknown bucket -------------------------------------------------------

test('provider-tenure: unrecognised models map to provider=unknown', () => {
  const r = buildProviderTenure(
    [
      ql('2026-04-20T00:00:00Z', { model: 'some-weird-model-x', total_tokens: 100 }),
      ql('2026-04-20T01:00:00Z', { model: 'gpt-5', total_tokens: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.providers.length, 2);
  const names = new Set(r.providers.map((p) => p.provider));
  assert.ok(names.has('unknown'));
  assert.ok(names.has('openai'));
});
