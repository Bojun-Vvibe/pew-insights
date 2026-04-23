import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderHtmlReport } from '../src/html.ts';
import { buildDigest } from '../src/report.ts';
import { computeCost, DEFAULT_RATES } from '../src/cost.ts';
import { buildTrend } from '../src/trend.ts';
import type { QueueLine, SessionLine } from '../src/types.ts';

function q(o: Partial<QueueLine>): QueueLine {
  return {
    source: 'claude-code',
    model: 'claude-opus-4.7',
    hour_start: '2026-04-20T12:00:00.000Z',
    device_id: 'd1',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: 0,
    ...o,
  };
}

function s(o: Partial<SessionLine>): SessionLine {
  return {
    session_key: 'k',
    source: 'claude-code',
    kind: 'human',
    started_at: '2026-04-20T11:00:00.000Z',
    last_message_at: '2026-04-20T12:30:00.000Z',
    duration_seconds: 90,
    user_messages: 1,
    assistant_messages: 1,
    total_messages: 2,
    project_ref: 'aaaa',
    model: 'claude-opus-4.7',
    snapshot_at: '2026-04-20T13:00:00.000Z',
    ...o,
  };
}

test('renderHtmlReport: omits cost + trend sections when not provided (back-compat)', () => {
  const queue: QueueLine[] = [q({ total_tokens: 100, input_tokens: 100 })];
  const sessions: SessionLine[] = [s({ total_messages: 1 })];
  const html = renderHtmlReport({
    pewHome: '/tmp/pew',
    digest: buildDigest(queue, sessions, null),
    status: null,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });
  assert.ok(!html.includes('Estimated cost'));
  assert.ok(!html.includes('Day-over-day'));
  // Existing sections still present.
  assert.ok(html.includes('Tokens by day'));
  assert.ok(html.includes('By model'));
});

test('renderHtmlReport: includes cost section when cost is provided', () => {
  const queue: QueueLine[] = [
    q({
      model: 'claude-opus-4.7',
      input_tokens: 1_000_000,
      cached_input_tokens: 500_000,
      output_tokens: 100_000,
      total_tokens: 1_600_000,
    }),
  ];
  const sessions: SessionLine[] = [s()];
  const cost = computeCost(queue, null, DEFAULT_RATES);
  const html = renderHtmlReport({
    pewHome: '/tmp/pew',
    digest: buildDigest(queue, sessions, null),
    status: null,
    cost,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });
  assert.ok(html.includes('Estimated cost'));
  assert.ok(html.includes('Cache savings'));
  assert.ok(html.includes('No-cache baseline'));
  // Model row rendered.
  assert.ok(html.includes('claude-opus-4.7'));
  // Dollar values present.
  assert.match(html, /\$[\d,]+\.\d{2}/);
});

test('renderHtmlReport: cost section lists unknown models when present', () => {
  const queue: QueueLine[] = [q({ model: 'mystery-9000', total_tokens: 1234 })];
  const sessions: SessionLine[] = [s()];
  const cost = computeCost(queue, null, DEFAULT_RATES);
  const html = renderHtmlReport({
    pewHome: '/tmp/pew',
    digest: buildDigest(queue, sessions, null),
    status: null,
    cost,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });
  assert.ok(html.includes('Unpriced models'));
  assert.ok(html.includes('mystery-9000'));
});

test('renderHtmlReport: includes trend section when trend is provided', () => {
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-19T05:00:00.000Z', total_tokens: 100 }),
    q({ hour_start: '2026-04-20T05:00:00.000Z', total_tokens: 200 }),
  ];
  const sessions: SessionLine[] = [s()];
  const trend = buildTrend(queue, null, {
    asOf: '2026-04-21T00:00:00.000Z',
    windowDays: 7,
  });
  const html = renderHtmlReport({
    pewHome: '/tmp/pew',
    digest: buildDigest(queue, sessions, null),
    status: null,
    trend,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });
  assert.ok(html.includes('Day-over-day'));
  assert.ok(html.includes('Week-over-week'));
  // SVG sparkline embedded (from svg.ts sparkline()).
  assert.match(html, /<svg/);
});

test('renderHtmlReport: html-escapes model names in cost rows (XSS guard)', () => {
  const queue: QueueLine[] = [
    q({ model: '<script>x</script>', input_tokens: 100, total_tokens: 100 }),
  ];
  const customRates = { '<script>x</script>': { input: 1, cachedInput: 0, output: 1, reasoning: 1 } };
  const cost = computeCost(queue, null, customRates);
  const html = renderHtmlReport({
    pewHome: '/tmp/pew',
    digest: buildDigest(queue, [s()], null),
    status: null,
    cost,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(html.includes('&lt;script&gt;x&lt;/script&gt;'));
});

test('renderHtmlReport: trend section renders when previous window is zero (pct=null)', () => {
  // Only "current" window has data → previous is 0 → pct null.
  const queue: QueueLine[] = [
    q({ hour_start: '2026-04-20T05:00:00.000Z', total_tokens: 100 }),
  ];
  const trend = buildTrend(queue, null, {
    asOf: '2026-04-21T00:00:00.000Z',
    windowDays: 4,
  });
  assert.equal(trend.dod.pct, null);
  const html = renderHtmlReport({
    pewHome: '/tmp/pew',
    digest: buildDigest(queue, [s()], null),
    status: null,
    trend,
    generatedAt: '2026-04-23T00:00:00.000Z',
  });
  // 'n/a' must appear (rather than NaN% or +Infinity%).
  assert.ok(html.includes('n/a'));
  assert.ok(!html.includes('NaN'));
  assert.ok(!html.includes('Infinity'));
});
