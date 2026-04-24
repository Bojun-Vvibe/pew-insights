import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildGaps } from '../src/gaps.js';
import type { SessionLine } from '../src/types.js';

function sl(
  startedAt: string,
  durationSeconds: number,
  opts: Partial<SessionLine> = {},
): SessionLine {
  const lastMessage = new Date(
    new Date(startedAt).getTime() + durationSeconds * 1000,
  ).toISOString();
  return {
    session_key: opts.session_key ?? `sk-${startedAt}`,
    source: opts.source ?? 'opencode',
    kind: opts.kind ?? 'agent',
    started_at: startedAt,
    last_message_at: opts.last_message_at ?? lastMessage,
    duration_seconds: durationSeconds,
    user_messages: opts.user_messages ?? 1,
    assistant_messages: opts.assistant_messages ?? 1,
    total_messages: opts.total_messages ?? 2,
    project_ref: opts.project_ref ?? 'aaaaaaaaaaaaaaaa',
    model: opts.model ?? 'gpt-x',
    snapshot_at: opts.snapshot_at ?? startedAt,
  };
}

const FIXED_GEN = '2026-04-24T00:00:00.000Z';

test('gaps: empty input → totalGaps=0, threshold null, no flagged', () => {
  const r = buildGaps([], { generatedAt: FIXED_GEN });
  assert.equal(r.totalSessions, 0);
  assert.equal(r.totalGaps, 0);
  assert.equal(r.thresholdSeconds, null);
  assert.equal(r.medianGapSeconds, null);
  assert.equal(r.maxGapSeconds, null);
  assert.deepEqual(r.flagged, []);
});

test('gaps: single session → no gaps measurable', () => {
  const r = buildGaps([sl('2026-04-20T10:00:00.000Z', 60)], { generatedAt: FIXED_GEN });
  assert.equal(r.totalSessions, 1);
  assert.equal(r.totalGaps, 0);
  assert.equal(r.thresholdSeconds, null);
  assert.deepEqual(r.flagged, []);
});

test('gaps: two sessions → one gap, threshold == that gap, nothing strictly exceeds', () => {
  const sessions = [
    sl('2026-04-20T10:00:00.000Z', 60), // ends 10:01
    sl('2026-04-20T10:10:00.000Z', 60), // gap = 540s
  ];
  const r = buildGaps(sessions, { quantile: 0.9, generatedAt: FIXED_GEN });
  assert.equal(r.totalGaps, 1);
  assert.equal(r.thresholdSeconds, 540);
  assert.equal(r.maxGapSeconds, 540);
  // Nothing flagged because 540 > 540 is false.
  assert.equal(r.flagged.length, 0);
});

test('gaps: clear outlier flagged at default 0.9 quantile', () => {
  // 19 small gaps of 60s, 1 huge gap of 3600s. p90 nearest-rank picks the
  // 18th element (60s); the huge gap (3600s) is strictly greater → flagged.
  const sessions: SessionLine[] = [];
  let t = new Date('2026-04-20T10:00:00.000Z').getTime();
  for (let i = 0; i < 20; i += 1) {
    sessions.push(sl(new Date(t).toISOString(), 30));
    t += 30_000; // session lasted 30s
    if (i === 9) {
      t += 3600_000; // inject one big idle here
    } else {
      t += 60_000;
    }
  }
  const r = buildGaps(sessions, { quantile: 0.9, topN: 5, generatedAt: FIXED_GEN });
  assert.equal(r.totalGaps, 19);
  assert.equal(r.thresholdSeconds, 60);
  assert.equal(r.flagged.length, 1);
  assert.equal(r.flagged[0]!.gapSeconds, 3600);
  assert.ok(r.flagged[0]!.quantileRank > 0.9);
});

test('gaps: tie-break — equal gap_seconds sorted by before.startedAt asc', () => {
  // Build sessions such that two flagged gaps have identical gap_seconds.
  // Each session is 0s long for predictable arithmetic.
  const sessions = [
    sl('2026-04-20T10:00:00.000Z', 0, { session_key: 'a' }), // gap1 starts
    sl('2026-04-20T11:00:00.000Z', 0, { session_key: 'b' }), // gap1 = 3600
    sl('2026-04-20T11:00:30.000Z', 0, { session_key: 'c' }), // gap2 = 30 (small)
    sl('2026-04-20T12:00:30.000Z', 0, { session_key: 'd' }), // gap3 = 3600
  ];
  // Quantile 0.5 → median of [30, 3600, 3600] = 3600. Threshold 3600. Flag none > 3600.
  // Use 0.1 → smallest = 30; flag both 3600s.
  const r = buildGaps(sessions, { quantile: 0.1, topN: 10, generatedAt: FIXED_GEN });
  assert.equal(r.flagged.length, 2);
  // Earlier started_at must come first.
  assert.ok(r.flagged[0]!.before.startedAt < r.flagged[1]!.before.startedAt);
  assert.equal(r.flagged[0]!.gapSeconds, 3600);
  assert.equal(r.flagged[1]!.gapSeconds, 3600);
});

test('gaps: window filter on started_at — drops out-of-window sessions', () => {
  const sessions = [
    sl('2026-04-19T10:00:00.000Z', 30), // before window
    sl('2026-04-20T10:00:00.000Z', 30),
    sl('2026-04-20T11:00:00.000Z', 30),
    sl('2026-04-21T10:00:00.000Z', 30), // at upper bound (exclusive) → out
  ];
  const r = buildGaps(sessions, {
    since: '2026-04-20T00:00:00.000Z',
    until: '2026-04-21T10:00:00.000Z',
    generatedAt: FIXED_GEN,
  });
  assert.equal(r.totalSessions, 2);
  assert.equal(r.totalGaps, 1);
});

test('gaps: minGapSeconds suppresses small flagged gaps even past threshold', () => {
  // All gaps are 10s; threshold@0.5 == 10. Push one to 11s. Without
  // minGap it would flag; minGap=20 suppresses it.
  const sessions = [
    sl('2026-04-20T10:00:00.000Z', 0),
    sl('2026-04-20T10:00:10.000Z', 0),
    sl('2026-04-20T10:00:20.000Z', 0),
    sl('2026-04-20T10:00:31.000Z', 0), // gap 11
  ];
  const flag = buildGaps(sessions, { quantile: 0.5, generatedAt: FIXED_GEN });
  assert.equal(flag.flagged.length, 1);
  const noFlag = buildGaps(sessions, { quantile: 0.5, minGapSeconds: 20, generatedAt: FIXED_GEN });
  assert.equal(noFlag.flagged.length, 0);
});

test('gaps: overlapping last_message_at past next started_at → gap clamped to 0', () => {
  // prev "ends" at 12:00, next started at 11:00 (data corruption / overlap).
  // Raw diff is negative; we clamp to 0 rather than throw.
  const sessions = [
    sl('2026-04-20T10:00:00.000Z', 7200), // last_msg = 12:00
    sl('2026-04-20T11:00:00.000Z', 60),
  ];
  const r = buildGaps(sessions, { generatedAt: FIXED_GEN });
  assert.equal(r.totalGaps, 1);
  assert.equal(r.maxGapSeconds, 0);
});

test('gaps: validation — quantile must be in (0,1]', () => {
  assert.throws(() => buildGaps([], { quantile: 0 }));
  assert.throws(() => buildGaps([], { quantile: 1.5 }));
  assert.throws(() => buildGaps([], { quantile: Number.NaN }));
  // 1.0 is allowed (flags only the strict max which can never strictly exceed itself → 0 flagged).
  const sessions = [
    sl('2026-04-20T10:00:00.000Z', 0, { session_key: 'a' }),
    sl('2026-04-20T10:01:00.000Z', 0, { session_key: 'b' }),
  ];
  const r = buildGaps(sessions, { quantile: 1, generatedAt: FIXED_GEN });
  assert.equal(r.flagged.length, 0);
});

test('gaps: validation — topN must be a positive integer; minGap >= 0', () => {
  assert.throws(() => buildGaps([], { topN: 0 }));
  assert.throws(() => buildGaps([], { topN: -1 }));
  assert.throws(() => buildGaps([], { topN: 1.5 }));
  assert.throws(() => buildGaps([], { minGapSeconds: -1 }));
});

test('gaps: deterministic across re-runs (same input, same flagged sequence)', () => {
  const sessions = [
    sl('2026-04-20T10:00:00.000Z', 0),
    sl('2026-04-20T11:00:00.000Z', 0), // gap 3600
    sl('2026-04-20T11:00:10.000Z', 0), // gap 10
    sl('2026-04-20T13:00:10.000Z', 0), // gap 7200
    sl('2026-04-20T13:00:20.000Z', 0), // gap 10
  ];
  const r1 = buildGaps(sessions, { quantile: 0.5, generatedAt: FIXED_GEN });
  const r2 = buildGaps(sessions, { quantile: 0.5, generatedAt: FIXED_GEN });
  assert.deepEqual(r1.flagged, r2.flagged);
  // Sorted gap_seconds desc.
  assert.equal(r1.flagged[0]!.gapSeconds, 7200);
  assert.equal(r1.flagged[1]!.gapSeconds, 3600);
});

test('gaps: topN truncates flagged list and report echoes topN', () => {
  // Generate 5 large gaps after a baseline of small ones.
  const sessions: SessionLine[] = [];
  let t = new Date('2026-04-20T10:00:00.000Z').getTime();
  for (let i = 0; i < 6; i += 1) {
    sessions.push(sl(new Date(t).toISOString(), 0));
    t += 60_000; // 60s gap
  }
  for (let i = 0; i < 5; i += 1) {
    sessions.push(sl(new Date(t).toISOString(), 0));
    t += 3600_000; // 1h gap
  }
  const r = buildGaps(sessions, { quantile: 0.5, topN: 3, generatedAt: FIXED_GEN });
  assert.equal(r.topN, 3);
  assert.equal(r.flagged.length, 3);
});

test('gaps: quantileRank is mid-rank — strictly increasing for distinct gaps', () => {
  const sessions: SessionLine[] = [];
  let t = new Date('2026-04-20T10:00:00.000Z').getTime();
  for (let i = 0; i < 5; i += 1) {
    sessions.push(sl(new Date(t).toISOString(), 0));
    t += (i + 1) * 60_000; // 60, 120, 180, 240s gaps
  }
  // Gaps: [60, 120, 180, 240]. Quantile 0.25 → nearest-rank k=ceil(0.25*4)=1 → 60.
  const r = buildGaps(sessions, { quantile: 0.25, generatedAt: FIXED_GEN });
  assert.equal(r.thresholdSeconds, 60);
  // Three flagged: 120, 180, 240. Sorted desc.
  assert.equal(r.flagged.length, 3);
  assert.ok(r.flagged[0]!.quantileRank > r.flagged[1]!.quantileRank);
  assert.ok(r.flagged[1]!.quantileRank > r.flagged[2]!.quantileRank);
});

test('gaps: gapsAtThreshold counts ties at the threshold value', () => {
  // 4 gaps all equal to 60s. Quantile 0.5 → threshold = 60.
  // gapsAtThreshold should equal 4 and flagged should be empty
  // (strict-greater never matches a tie at the threshold).
  const sessions: SessionLine[] = [];
  let t = new Date('2026-04-20T10:00:00.000Z').getTime();
  for (let i = 0; i < 5; i += 1) {
    sessions.push(sl(new Date(t).toISOString(), 0));
    t += 60_000;
  }
  const r = buildGaps(sessions, { quantile: 0.5, generatedAt: FIXED_GEN });
  assert.equal(r.totalGaps, 4);
  assert.equal(r.thresholdSeconds, 60);
  assert.equal(r.gapsAtThreshold, 4);
  assert.equal(r.flagged.length, 0);
});
