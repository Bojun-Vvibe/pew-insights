import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildAgentMix } from '../src/agentmix.js';
import type { QueueLine } from '../src/types.js';

function ql(
  source: string,
  hour: string,
  total: number,
  opts: Partial<QueueLine> = {},
): QueueLine {
  return {
    source,
    model: opts.model ?? 'm1',
    hour_start: hour,
    device_id: opts.device_id ?? 'd1',
    input_tokens: opts.input_tokens ?? Math.floor(total * 0.4),
    cached_input_tokens: opts.cached_input_tokens ?? 0,
    output_tokens: opts.output_tokens ?? Math.floor(total * 0.6),
    reasoning_output_tokens: opts.reasoning_output_tokens ?? 0,
    total_tokens: total,
  };
}

const GEN = '2026-04-24T12:00:00.000Z';

test('agent-mix: rejects bad topN', () => {
  assert.throws(() => buildAgentMix([], { topN: 0 }));
  assert.throws(() => buildAgentMix([], { topN: -1 }));
  assert.throws(() => buildAgentMix([], { topN: 1.5 }));
});

test('agent-mix: rejects bad by dimension', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildAgentMix([], { by: 'bogus' }));
});

test('agent-mix: rejects bad minTokens', () => {
  assert.throws(() => buildAgentMix([], { minTokens: -1 }));
  assert.throws(() => buildAgentMix([], { minTokens: Number.NaN }));
});

test('agent-mix: rejects invalid since/until', () => {
  assert.throws(() => buildAgentMix([], { since: 'not-a-date' }));
  assert.throws(() => buildAgentMix([], { until: 'also-bad' }));
});

test('agent-mix: empty input → zero everything', () => {
  const r = buildAgentMix([], { generatedAt: GEN });
  assert.equal(r.consideredEvents, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.groupCount, 0);
  assert.equal(r.hhi, 0);
  assert.equal(r.gini, 0);
  assert.equal(r.topHalfShare, 0);
  assert.equal(r.topGroups.length, 0);
});

test('agent-mix: single group → HHI = 1, Gini = 0', () => {
  const r = buildAgentMix(
    [
      ql('opencode', '2026-04-24T10:00:00.000Z', 100),
      ql('opencode', '2026-04-24T11:00:00.000Z', 200),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.groupCount, 1);
  assert.equal(r.totalTokens, 300);
  assert.equal(r.hhi, 1);
  assert.equal(r.gini, 0);
  assert.equal(r.topHalfShare, 1);
  assert.equal(r.topGroups[0]!.share, 1);
  assert.equal(r.topGroups[0]!.activeHours, 2);
});

test('agent-mix: perfect split between two groups → HHI = 0.5, Gini = 0', () => {
  const r = buildAgentMix(
    [
      ql('a', '2026-04-24T10:00:00.000Z', 100),
      ql('b', '2026-04-24T11:00:00.000Z', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.groupCount, 2);
  assert.equal(r.hhi, 0.5);
  // Two equal groups: Lorenz curve is the diagonal → Gini = 0.
  assert.equal(r.gini, 0);
  assert.equal(r.topHalfShare, 0.5);
});

test('agent-mix: 80/20 split has expected HHI and positive Gini', () => {
  const r = buildAgentMix(
    [
      ql('a', '2026-04-24T10:00:00.000Z', 80),
      ql('b', '2026-04-24T11:00:00.000Z', 20),
    ],
    { generatedAt: GEN },
  );
  // HHI = 0.8^2 + 0.2^2 = 0.68
  assert.equal(Number(r.hhi.toFixed(4)), 0.68);
  // Gini for {0.2, 0.8} two-point Lorenz: trapezoid sum = (0.2 + 0) + (1 + 0.2) = 1.4
  // Gini = 1 - 1.4/2 = 0.3
  assert.equal(Number(r.gini.toFixed(4)), 0.3);
  // top-half = ceil(2/2) = 1 largest = 0.8
  assert.equal(r.topHalfShare, 0.8);
});

test('agent-mix: groups dominated by one player → high HHI, high Gini', () => {
  const r = buildAgentMix(
    [
      ql('big', '2026-04-24T10:00:00.000Z', 1000),
      ql('small1', '2026-04-24T10:00:00.000Z', 10),
      ql('small2', '2026-04-24T10:00:00.000Z', 10),
      ql('small3', '2026-04-24T10:00:00.000Z', 10),
      ql('small4', '2026-04-24T10:00:00.000Z', 10),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.groupCount, 5);
  assert.ok(r.hhi > 0.9, `expected hhi > 0.9, got ${r.hhi}`);
  assert.ok(r.gini > 0.5, `expected gini > 0.5, got ${r.gini}`);
  // Top half = ceil(5/2) = 3 → big + 2 smalls → 1020/1040
  assert.equal(Number(r.topHalfShare.toFixed(4)), Number((1020 / 1040).toFixed(4)));
  // Largest group is first.
  assert.equal(r.topGroups[0]!.group, 'big');
});

test('agent-mix: by=model groups by model not source', () => {
  const r = buildAgentMix(
    [
      ql('a', '2026-04-24T10:00:00.000Z', 50, { model: 'gpt' }),
      ql('b', '2026-04-24T10:00:00.000Z', 50, { model: 'gpt' }),
      ql('a', '2026-04-24T11:00:00.000Z', 100, { model: 'sonnet' }),
    ],
    { by: 'model', generatedAt: GEN },
  );
  assert.equal(r.groupCount, 2);
  assert.equal(r.totalTokens, 200);
  assert.equal(r.topGroups[0]!.group, 'gpt');
  assert.equal(r.topGroups[0]!.tokens, 100);
  assert.equal(r.topGroups[1]!.group, 'sonnet');
  assert.equal(r.topGroups[1]!.tokens, 100);
});

test('agent-mix: empty/missing source bucketed as unknown', () => {
  const r = buildAgentMix(
    [
      ql('', '2026-04-24T10:00:00.000Z', 50),
      ql('opencode', '2026-04-24T10:00:00.000Z', 50),
    ],
    { generatedAt: GEN },
  );
  const groupNames = r.topGroups.map((g) => g.group);
  assert.ok(groupNames.includes('unknown'));
  assert.ok(groupNames.includes('opencode'));
});

test('agent-mix: since/until window filters by hour_start', () => {
  const r = buildAgentMix(
    [
      ql('a', '2026-04-24T08:00:00.000Z', 100),
      ql('a', '2026-04-24T10:00:00.000Z', 200),
      ql('a', '2026-04-24T12:00:00.000Z', 400),
    ],
    {
      since: '2026-04-24T09:00:00.000Z',
      until: '2026-04-24T12:00:00.000Z', // exclusive
      generatedAt: GEN,
    },
  );
  assert.equal(r.consideredEvents, 1);
  assert.equal(r.totalTokens, 200);
});

test('agent-mix: minTokens display filter does not affect HHI/Gini', () => {
  const lines = [
    ql('big', '2026-04-24T10:00:00.000Z', 1000),
    ql('tiny1', '2026-04-24T10:00:00.000Z', 5),
    ql('tiny2', '2026-04-24T10:00:00.000Z', 5),
    ql('tiny3', '2026-04-24T10:00:00.000Z', 5),
  ];
  const noFilter = buildAgentMix(lines, { generatedAt: GEN });
  const filtered = buildAgentMix(lines, { minTokens: 100, generatedAt: GEN });
  // Concentration math identical.
  assert.equal(filtered.hhi, noFilter.hhi);
  assert.equal(filtered.gini, noFilter.gini);
  assert.equal(filtered.groupCount, noFilter.groupCount);
  // Display table changed.
  assert.equal(filtered.topGroups.length, 1);
  assert.equal(filtered.topGroups[0]!.group, 'big');
  assert.equal(noFilter.topGroups.length, 4);
});

test('agent-mix: ties in tokens broken by group asc', () => {
  const r = buildAgentMix(
    [
      ql('zeta', '2026-04-24T10:00:00.000Z', 100),
      ql('alpha', '2026-04-24T10:00:00.000Z', 100),
      ql('beta', '2026-04-24T10:00:00.000Z', 100),
    ],
    { generatedAt: GEN },
  );
  assert.deepEqual(
    r.topGroups.map((g) => g.group),
    ['alpha', 'beta', 'zeta'],
  );
});

test('agent-mix: topN truncates surfaced table only', () => {
  const lines: QueueLine[] = [];
  for (let i = 0; i < 20; i++) {
    lines.push(ql(`s${String(i).padStart(2, '0')}`, '2026-04-24T10:00:00.000Z', 100 - i));
  }
  const r = buildAgentMix(lines, { topN: 3, generatedAt: GEN });
  assert.equal(r.groupCount, 20);
  assert.equal(r.topGroups.length, 3);
  // Sum of *all* shares is still 1.
  // Surface only had 3, but groupCount preserves the full count.
});

test('agent-mix: events and activeHours counted per group', () => {
  const r = buildAgentMix(
    [
      ql('a', '2026-04-24T10:00:00.000Z', 50),
      ql('a', '2026-04-24T10:00:00.000Z', 50), // same hour bucket
      ql('a', '2026-04-24T11:00:00.000Z', 100),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.topGroups[0]!.events, 3);
  assert.equal(r.topGroups[0]!.activeHours, 2);
});
