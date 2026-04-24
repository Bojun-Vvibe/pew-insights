import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildModelSwitching } from '../src/modelswitching.js';
import type { SessionLine } from '../src/types.js';

function sl(
  sessionKey: string,
  startedAt: string,
  model: string,
  opts: Partial<SessionLine> = {},
): SessionLine {
  return {
    session_key: sessionKey,
    source: opts.source ?? 'src1',
    kind: opts.kind ?? 'human',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? startedAt,
    duration_seconds: opts.duration_seconds ?? 100,
    user_messages: opts.user_messages ?? 5,
    assistant_messages: opts.assistant_messages ?? 5,
    total_messages: opts.total_messages ?? 10,
    project_ref: opts.project_ref ?? '0000000000000000',
    model,
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const GEN = '2026-04-25T12:00:00.000Z';

test('model-switching: rejects bad by', () => {
  // @ts-expect-error testing runtime validation
  assert.throws(() => buildModelSwitching([], { by: 'bogus' }));
});

test('model-switching: rejects bad top', () => {
  assert.throws(() => buildModelSwitching([], { top: 0 }));
  assert.throws(() => buildModelSwitching([], { top: -1 }));
  assert.throws(() => buildModelSwitching([], { top: 1.5 }));
  assert.throws(() => buildModelSwitching([], { top: Number.NaN }));
});

test('model-switching: rejects bad since/until', () => {
  assert.throws(() => buildModelSwitching([], { since: 'not-an-iso' }));
  assert.throws(() => buildModelSwitching([], { until: 'not-an-iso' }));
});

test('model-switching: empty input → empty report', () => {
  const r = buildModelSwitching([], { generatedAt: GEN });
  assert.equal(r.consideredSessions, 0);
  assert.equal(r.switchedSessions, 0);
  assert.equal(r.switchedShare, 0);
  assert.equal(r.totalTransitions, 0);
  assert.equal(r.uniqueTransitionPairs, 0);
  assert.equal(r.topTransitions.length, 0);
  assert.equal(r.distributions.length, 1);
  assert.equal(r.distributions[0]!.group, 'all');
  assert.equal(r.distributions[0]!.consideredSessions, 0);
  // Buckets always present in fixed schema.
  assert.deepEqual(
    r.distributions[0]!.distinctModelCountBuckets.map((b) => b.label),
    ['1', '2', '3', '4+'],
  );
});

test('model-switching: deduplicates session_key across snapshots', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'opus'),
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T11:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T12:00:00Z' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.switchedSessions, 0);
  assert.equal(r.switchedShare, 0);
});

test('model-switching: detects switch when distinct models appear', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T10:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'sonnet', { snapshot_at: '2026-04-20T10:30:00Z' }),
      sl('k2', '2026-04-20T11:00:00Z', 'opus'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 2);
  assert.equal(r.switchedSessions, 1);
  assert.equal(r.switchedShare, 0.5);
  assert.equal(r.totalTransitions, 1);
  assert.equal(r.uniqueTransitionPairs, 1);
  assert.equal(r.topTransitions[0]!.from, 'opus');
  assert.equal(r.topTransitions[0]!.to, 'sonnet');
  assert.equal(r.topTransitions[0]!.count, 1);
  assert.equal(r.topTransitions[0]!.share, 1);
});

test('model-switching: snapshot order drives transition direction', () => {
  // Insert in reverse so we know ordering is by snapshot_at, not insertion order.
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'sonnet', { snapshot_at: '2026-04-20T11:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T10:00:00Z' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.topTransitions[0]!.from, 'opus');
  assert.equal(r.topTransitions[0]!.to, 'sonnet');
});

test('model-switching: collapses repeated consecutive identical models (no spurious self-transition)', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T10:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T10:30:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'sonnet', { snapshot_at: '2026-04-20T11:00:00Z' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.totalTransitions, 1);
  assert.equal(r.topTransitions.length, 1);
  assert.equal(r.topTransitions[0]!.from, 'opus');
  assert.equal(r.topTransitions[0]!.to, 'sonnet');
});

test('model-switching: 3-distinct-model session contributes 2 transitions', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T10:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'sonnet', { snapshot_at: '2026-04-20T10:30:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'haiku', { snapshot_at: '2026-04-20T11:00:00Z' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.switchedSessions, 1);
  assert.equal(r.totalTransitions, 2);
  assert.equal(r.uniqueTransitionPairs, 2);
  // Distinct-model bucket '3' = 1.
  const d = r.distributions[0]!;
  assert.equal(d.distinctModelCountBuckets.find((b) => b.label === '3')!.count, 1);
  assert.equal(d.maxDistinctModels, 3);
  assert.equal(d.meanModelsPerSwitchedSession, 3);
});

test('model-switching: 4+ bucket', () => {
  const lines: SessionLine[] = [];
  const models = ['m1', 'm2', 'm3', 'm4', 'm5'];
  for (let i = 0; i < models.length; i++) {
    lines.push(
      sl('k1', '2026-04-20T10:00:00Z', models[i]!, {
        snapshot_at: `2026-04-20T10:${String(i).padStart(2, '0')}:00Z`,
      }),
    );
  }
  const r = buildModelSwitching(lines, { generatedAt: GEN });
  const d = r.distributions[0]!;
  assert.equal(d.maxDistinctModels, 5);
  assert.equal(d.distinctModelCountBuckets.find((b) => b.label === '4+')!.count, 1);
});

test('model-switching: window filters by started_at', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-19T23:59:59Z', 'opus'),
      sl('k1', '2026-04-19T23:59:59Z', 'sonnet', { snapshot_at: '2026-04-20T01:00:00Z' }),
      sl('k2', '2026-04-20T10:00:00Z', 'opus'),
      sl('k2', '2026-04-20T10:00:00Z', 'sonnet', { snapshot_at: '2026-04-20T10:30:00Z' }),
      sl('k3', '2026-04-21T00:00:00Z', 'opus'),
    ],
    { since: '2026-04-20T00:00:00Z', until: '2026-04-21T00:00:00Z', generatedAt: GEN },
  );
  // k1 excluded (started before window), k3 excluded (started at/after exclusive upper).
  assert.equal(r.consideredSessions, 1);
  assert.equal(r.switchedSessions, 1);
});

test('model-switching: by source produces one distribution per source, sorted', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'opus', { source: 'src-a' }),
      sl('k1', '2026-04-20T10:00:00Z', 'sonnet', { source: 'src-a', snapshot_at: '2026-04-20T11:00:00Z' }),
      sl('k2', '2026-04-20T10:00:00Z', 'opus', { source: 'src-a' }),
      sl('k3', '2026-04-20T10:00:00Z', 'opus', { source: 'src-b' }),
    ],
    { by: 'source', generatedAt: GEN },
  );
  assert.equal(r.distributions.length, 2);
  // src-a has more sessions → first.
  assert.equal(r.distributions[0]!.group, 'src-a');
  assert.equal(r.distributions[0]!.consideredSessions, 2);
  assert.equal(r.distributions[0]!.switchedSessions, 1);
  assert.equal(r.distributions[1]!.group, 'src-b');
  assert.equal(r.distributions[1]!.switchedSessions, 0);
});

test('model-switching: top caps the transition table; otherTransitionsCount sums the tail', () => {
  // 3 unique transition pairs with counts 3, 2, 1.
  const lines: SessionLine[] = [];
  // pair (a→b) x3
  for (let i = 0; i < 3; i++) {
    const k = `kab-${i}`;
    lines.push(sl(k, '2026-04-20T10:00:00Z', 'a', { snapshot_at: '2026-04-20T10:00:00Z' }));
    lines.push(sl(k, '2026-04-20T10:00:00Z', 'b', { snapshot_at: '2026-04-20T10:30:00Z' }));
  }
  // pair (c→d) x2
  for (let i = 0; i < 2; i++) {
    const k = `kcd-${i}`;
    lines.push(sl(k, '2026-04-20T10:00:00Z', 'c', { snapshot_at: '2026-04-20T10:00:00Z' }));
    lines.push(sl(k, '2026-04-20T10:00:00Z', 'd', { snapshot_at: '2026-04-20T10:30:00Z' }));
  }
  // pair (e→f) x1
  lines.push(sl('kef', '2026-04-20T10:00:00Z', 'e', { snapshot_at: '2026-04-20T10:00:00Z' }));
  lines.push(sl('kef', '2026-04-20T10:00:00Z', 'f', { snapshot_at: '2026-04-20T10:30:00Z' }));

  const r = buildModelSwitching(lines, { top: 1, generatedAt: GEN });
  assert.equal(r.uniqueTransitionPairs, 3);
  assert.equal(r.topTransitions.length, 1);
  assert.equal(r.topTransitions[0]!.from, 'a');
  assert.equal(r.topTransitions[0]!.to, 'b');
  assert.equal(r.topTransitions[0]!.count, 3);
  // Tail: 2 + 1 = 3.
  assert.equal(r.otherTransitionsCount, 3);
});

test('model-switching: deterministic tiebreaker for equal-count transitions', () => {
  // Two pairs with the same count; expect lexicographic by (from, to).
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'z', { snapshot_at: '2026-04-20T10:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'y', { snapshot_at: '2026-04-20T10:30:00Z' }),
      sl('k2', '2026-04-20T10:00:00Z', 'a', { snapshot_at: '2026-04-20T10:00:00Z' }),
      sl('k2', '2026-04-20T10:00:00Z', 'b', { snapshot_at: '2026-04-20T10:30:00Z' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.topTransitions.length, 2);
  // (a,b) sorts before (z,y).
  assert.equal(r.topTransitions[0]!.from, 'a');
  assert.equal(r.topTransitions[0]!.to, 'b');
  assert.equal(r.topTransitions[1]!.from, 'z');
  assert.equal(r.topTransitions[1]!.to, 'y');
});

test('model-switching: shares sum to ~1 across distinct-model buckets', () => {
  const lines: SessionLine[] = [];
  for (let i = 0; i < 10; i++) {
    lines.push(sl(`k${i}`, '2026-04-20T10:00:00Z', 'opus'));
  }
  for (let i = 0; i < 3; i++) {
    const k = `s${i}`;
    lines.push(sl(k, '2026-04-20T10:00:00Z', 'opus', { snapshot_at: '2026-04-20T10:00:00Z' }));
    lines.push(sl(k, '2026-04-20T10:00:00Z', 'sonnet', { snapshot_at: '2026-04-20T10:30:00Z' }));
  }
  const r = buildModelSwitching(lines, { generatedAt: GEN });
  const sum = r.distributions[0]!.distinctModelCountBuckets.reduce((a, b) => a + b.share, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `bucket shares should sum to 1, got ${sum}`);
});

test('model-switching: ignores rows with missing/empty session_key or model', () => {
  const r = buildModelSwitching(
    [
      sl('', '2026-04-20T10:00:00Z', 'opus'),
      sl('k1', '2026-04-20T10:00:00Z', ''),
      sl('k1', '2026-04-20T10:00:00Z', 'opus'),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.consideredSessions, 1);
});

test('model-switching: rejects bad minSwitches', () => {
  assert.throws(() => buildModelSwitching([], { minSwitches: 1 }));
  assert.throws(() => buildModelSwitching([], { minSwitches: 0 }));
  assert.throws(() => buildModelSwitching([], { minSwitches: -2 }));
  assert.throws(() => buildModelSwitching([], { minSwitches: 2.5 }));
  assert.throws(() => buildModelSwitching([], { minSwitches: Number.NaN }));
});

test('model-switching: minSwitches=3 excludes 2-distinct sessions from switched but keeps them in considered', () => {
  const lines: SessionLine[] = [
    // k1: 2 distinct models
    sl('k1', '2026-04-20T10:00:00Z', 'a', { snapshot_at: '2026-04-20T10:00:00Z' }),
    sl('k1', '2026-04-20T10:00:00Z', 'b', { snapshot_at: '2026-04-20T10:30:00Z' }),
    // k2: 3 distinct models
    sl('k2', '2026-04-20T10:00:00Z', 'a', { snapshot_at: '2026-04-20T10:00:00Z' }),
    sl('k2', '2026-04-20T10:00:00Z', 'b', { snapshot_at: '2026-04-20T10:30:00Z' }),
    sl('k2', '2026-04-20T10:00:00Z', 'c', { snapshot_at: '2026-04-20T11:00:00Z' }),
    // k3: 1 model
    sl('k3', '2026-04-20T10:00:00Z', 'a'),
  ];
  const r = buildModelSwitching(lines, { minSwitches: 3, generatedAt: GEN });
  assert.equal(r.minSwitches, 3);
  assert.equal(r.consideredSessions, 3);
  assert.equal(r.switchedSessions, 1);
  assert.equal(r.distributions[0]!.switchedSessions, 1);
  // Histogram still reports the full population.
  const buckets = r.distributions[0]!.distinctModelCountBuckets;
  assert.equal(buckets.find((b) => b.label === '1')!.count, 1);
  assert.equal(buckets.find((b) => b.label === '2')!.count, 1);
  assert.equal(buckets.find((b) => b.label === '3')!.count, 1);
  // Transitions: only k2 contributes (a→b, b→c) = 2 directed hops.
  assert.equal(r.totalTransitions, 2);
  assert.equal(r.uniqueTransitionPairs, 2);
});

test('model-switching: minSwitches default is 2 (back-compat)', () => {
  const r = buildModelSwitching(
    [
      sl('k1', '2026-04-20T10:00:00Z', 'a', { snapshot_at: '2026-04-20T10:00:00Z' }),
      sl('k1', '2026-04-20T10:00:00Z', 'b', { snapshot_at: '2026-04-20T10:30:00Z' }),
    ],
    { generatedAt: GEN },
  );
  assert.equal(r.minSwitches, 2);
  assert.equal(r.switchedSessions, 1);
});
