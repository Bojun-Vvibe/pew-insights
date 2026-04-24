import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildProviderShare, classifyProvider } from '../src/providershare.js';
import type { SessionLine } from '../src/types.js';

function sl(startedAt: string, model: string, opts: Partial<SessionLine> = {}): SessionLine {
  return {
    session_key: opts.session_key ?? `s-${startedAt}-${model}`,
    source: opts.source ?? 'claude-code',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 60,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? '0000000000000000',
    model,
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

// ---- classifyProvider ------------------------------------------------------

test('classifyProvider: anthropic family', () => {
  assert.equal(classifyProvider('claude-opus-4.7'), 'anthropic');
  assert.equal(classifyProvider('claude-haiku-4.5'), 'anthropic');
  assert.equal(classifyProvider('claude-sonnet-4.6'), 'anthropic');
  assert.equal(classifyProvider('claude'), 'anthropic');
});

test('classifyProvider: openai family (gpt + chatgpt + o-series)', () => {
  assert.equal(classifyProvider('gpt-5'), 'openai');
  assert.equal(classifyProvider('gpt-5.3-codex'), 'openai');
  assert.equal(classifyProvider('chatgpt-4o'), 'openai');
  assert.equal(classifyProvider('o1'), 'openai');
  assert.equal(classifyProvider('o3-mini'), 'openai');
  assert.equal(classifyProvider('o4-preview'), 'openai');
});

test('classifyProvider: google / meta / mistral / xai / deepseek / qwen / cohere', () => {
  assert.equal(classifyProvider('gemini-2.5-pro'), 'google');
  assert.equal(classifyProvider('palm-2'), 'google');
  assert.equal(classifyProvider('llama-3.1-70b'), 'meta');
  assert.equal(classifyProvider('llama4-scout'), 'meta');
  assert.equal(classifyProvider('mistral-large'), 'mistral');
  assert.equal(classifyProvider('mixtral-8x22b'), 'mistral');
  assert.equal(classifyProvider('codestral-mamba'), 'mistral');
  assert.equal(classifyProvider('grok-2'), 'xai');
  assert.equal(classifyProvider('deepseek-v3'), 'deepseek');
  assert.equal(classifyProvider('qwen3-coder'), 'qwen');
  assert.equal(classifyProvider('command-r-plus'), 'cohere');
  assert.equal(classifyProvider('cohere-aya'), 'cohere');
});

test('classifyProvider: unknown / placeholder folds to unknown', () => {
  assert.equal(classifyProvider(''), 'unknown');
  assert.equal(classifyProvider('unknown'), 'unknown');
  assert.equal(classifyProvider('acp-runtime'), 'unknown');
  assert.equal(classifyProvider('big-pickle'), 'unknown');
  assert.equal(classifyProvider('something-else'), 'unknown');
});

// ---- buildProviderShare option validation ----------------------------------

test('provider-share: rejects bad topModels', () => {
  assert.throws(() => buildProviderShare([], { topModels: -1 }));
  assert.throws(() => buildProviderShare([], { topModels: 1.5 }));
  assert.throws(() => buildProviderShare([], { topModels: Number.NaN }));
});

test('provider-share: rejects bad since/until', () => {
  assert.throws(() => buildProviderShare([], { since: 'no' }));
  assert.throws(() => buildProviderShare([], { until: 'no' }));
});

// ---- empty / dropped -------------------------------------------------------

test('provider-share: empty input → empty report', () => {
  const r = buildProviderShare([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.consideredMessages, 0);
  assert.equal(r.providers.length, 0);
  assert.equal(r.topModels, 3);
  assert.equal(r.windowStart, null);
  assert.equal(r.windowEnd, null);
});

test('provider-share: drops bad started_at and bad messages', () => {
  const r = buildProviderShare(
    [
      sl('not-an-iso', 'claude-opus-4.7'),
      sl('2026-04-20T01:00:00Z', 'claude-opus-4.7', { total_messages: -1 }),
      sl('2026-04-20T02:00:00Z', 'claude-opus-4.7', {
        total_messages: Number.NaN as unknown as number,
      }),
      sl('2026-04-20T03:00:00Z', 'claude-opus-4.7', { total_messages: 5 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.droppedInvalidStartedAt, 1);
  assert.equal(r.droppedInvalidMessages, 2);
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.consideredMessages, 5);
  assert.equal(r.providers.length, 1);
  assert.equal(r.providers[0]!.provider, 'anthropic');
});

// ---- core aggregation ------------------------------------------------------

test('provider-share: per-provider session + message shares, sorted desc', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'claude-opus-4.7', { total_messages: 10 }),
      sl('2026-04-20T02:00:00Z', 'claude-haiku-4.5', { total_messages: 20 }),
      sl('2026-04-20T03:00:00Z', 'claude-sonnet-4.6', { total_messages: 30 }),
      sl('2026-04-20T04:00:00Z', 'gpt-5.3-codex', { total_messages: 40 }),
      sl('2026-04-20T05:00:00Z', 'gemini-2.5-pro', { total_messages: 100 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 5);
  assert.equal(r.consideredMessages, 200);
  // anthropic 3 sessions, openai 1, google 1 → sorted by sessions desc, then provider asc
  assert.deepEqual(
    r.providers.map((p) => p.provider),
    ['anthropic', 'google', 'openai'],
  );
  const a = r.providers[0]!;
  assert.equal(a.sessions, 3);
  assert.equal(a.sessionShare, 3 / 5);
  assert.equal(a.messages, 60);
  assert.equal(a.messageShare, 60 / 200);
  assert.equal(a.distinctModels, 3);
  // top 3 default — all three claude-* models present, sorted by sessions desc then model asc
  assert.deepEqual(
    a.topModels.map((m) => m.model),
    ['claude-haiku-4.5', 'claude-opus-4.7', 'claude-sonnet-4.6'],
  );
});

test('provider-share: top-models truncates and unknown is grouped', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'claude-opus-4.7'),
      sl('2026-04-20T02:00:00Z', 'claude-opus-4.7'),
      sl('2026-04-20T03:00:00Z', 'claude-haiku-4.5'),
      sl('2026-04-20T04:00:00Z', 'claude-sonnet-4.6'),
      sl('2026-04-20T05:00:00Z', '<synthetic>'),
      sl('2026-04-20T06:00:00Z', 'acp-runtime'),
    ],
    { generatedAt: GEN, topModels: 2 },
  );
  const a = r.providers.find((p) => p.provider === 'anthropic')!;
  assert.equal(a.distinctModels, 3);
  assert.equal(a.topModels.length, 2);
  assert.equal(a.topModels[0]!.model, 'claude-opus-4.7');
  assert.equal(a.topModels[0]!.sessions, 2);
  const u = r.providers.find((p) => p.provider === 'unknown')!;
  assert.equal(u.sessions, 2);
});

test('provider-share: topModels=0 disables the per-provider model breakdown', () => {
  const r = buildProviderShare(
    [sl('2026-04-20T01:00:00Z', 'claude-opus-4.7')],
    { generatedAt: GEN, topModels: 0 },
  );
  assert.equal(r.topModels, 0);
  assert.equal(r.providers[0]!.topModels.length, 0);
});

test('provider-share: window since/until is exclusive on upper bound', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-19T23:59:59Z', 'claude-opus-4.7'), // dropped (before since)
      sl('2026-04-20T00:00:00Z', 'claude-opus-4.7'), // included
      sl('2026-04-21T00:00:00Z', 'claude-opus-4.7'), // dropped (== until)
    ],
    {
      since: '2026-04-20T00:00:00Z',
      until: '2026-04-21T00:00:00Z',
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.windowStart, '2026-04-20T00:00:00Z');
  assert.equal(r.windowEnd, '2026-04-21T00:00:00Z');
});

test('provider-share: zero-message sessions count toward sessions but not messageShare denom contribution', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'claude-opus-4.7', { total_messages: 0 }),
      sl('2026-04-20T02:00:00Z', 'gpt-5', { total_messages: 0 }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.consideredMessages, 0);
  // both providers should report messageShare 0 (denominator 0 short-circuit)
  for (const p of r.providers) {
    assert.equal(p.messages, 0);
    assert.equal(p.messageShare, 0);
  }
});

test('provider-share: model normalisation runs (date suffix and dashes-between-digits collapse)', () => {
  // claude-opus-4-7 and claude-opus-4.7 must collapse to one normalised id.
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'claude-opus-4-7'),
      sl('2026-04-20T02:00:00Z', 'claude-opus-4.7'),
      sl('2026-04-20T03:00:00Z', 'claude-haiku-4-5-20251001'),
      sl('2026-04-20T04:00:00Z', 'claude-haiku-4.5'),
    ],
    { generatedAt: GEN, topModels: 5 },
  );
  const a = r.providers[0]!;
  assert.equal(a.provider, 'anthropic');
  assert.equal(a.sessions, 4);
  assert.equal(a.distinctModels, 2);
  const ids = a.topModels.map((m) => m.model).sort();
  assert.deepEqual(ids, ['claude-haiku-4.5', 'claude-opus-4.7']);
});

test('provider-share: deterministic ordering on session-count ties → provider asc', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'gpt-5'),
      sl('2026-04-20T02:00:00Z', 'claude-opus-4.7'),
      sl('2026-04-20T03:00:00Z', 'gemini-2.5-pro'),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.providers.map((p) => p.provider),
    ['anthropic', 'google', 'openai'],
  );
});

test('provider-share: report carries window/topModels echoed back', () => {
  const r = buildProviderShare([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    topModels: 7,
  });
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
  assert.equal(r.topModels, 7);
});

// ---- minSessions floor (0.4.30) -------------------------------------------

test('provider-share: rejects bad minSessions', () => {
  assert.throws(() => buildProviderShare([], { minSessions: -1 }));
  assert.throws(() => buildProviderShare([], { minSessions: 1.5 }));
  assert.throws(() => buildProviderShare([], { minSessions: Number.NaN }));
});

test('provider-share: minSessions hides small providers but keeps global denominators', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'claude-opus-4.7', { total_messages: 10 }),
      sl('2026-04-20T02:00:00Z', 'claude-opus-4.7', { total_messages: 10 }),
      sl('2026-04-20T03:00:00Z', 'claude-opus-4.7', { total_messages: 10 }),
      sl('2026-04-20T04:00:00Z', 'gpt-5', { total_messages: 50 }),
      sl('2026-04-20T05:00:00Z', 'gemini-2.5-pro', { total_messages: 7 }),
    ],
    { generatedAt: GEN, minSessions: 2 },
  );
  // anthropic has 3 → kept; openai has 1 → dropped; google has 1 → dropped.
  assert.equal(r.minSessions, 2);
  assert.deepEqual(r.providers.map((p) => p.provider), ['anthropic']);
  assert.equal(r.droppedProviders, 2);
  assert.equal(r.droppedProviderSessions, 2);
  assert.equal(r.droppedProviderMessages, 57);
  // global denominators unchanged: shares for the kept provider are
  // computed against the FULL considered population.
  assert.equal(r.consideredSessions, 5);
  assert.equal(r.consideredMessages, 87);
  const a = r.providers[0]!;
  assert.equal(a.sessionShare, 3 / 5);
  assert.equal(a.messageShare, 30 / 87);
});

test('provider-share: minSessions=0 (default) keeps every provider', () => {
  const r = buildProviderShare(
    [
      sl('2026-04-20T01:00:00Z', 'claude-opus-4.7'),
      sl('2026-04-20T02:00:00Z', 'gpt-5'),
      sl('2026-04-20T03:00:00Z', 'gemini-2.5-pro'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.minSessions, 0);
  assert.equal(r.providers.length, 3);
  assert.equal(r.droppedProviders, 0);
  assert.equal(r.droppedProviderSessions, 0);
  assert.equal(r.droppedProviderMessages, 0);
});
