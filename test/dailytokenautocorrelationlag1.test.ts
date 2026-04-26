import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { buildDailyTokenAutocorrelationLag1 } from '../src/dailytokenautocorrelationlag1.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, tokens: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: 0,
    reasoning_output_tokens: 0,
    total_tokens: tokens,
  };
}

const GEN = '2026-04-26T12:00:00.000Z';

// ---- option validation -----------------------------------------------------

test('daily-token-autocorrelation-lag1: rejects bad minDays', () => {
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { minDays: 2 }));
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { minDays: 1.5 }));
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { minDays: -1 }));
});

test('daily-token-autocorrelation-lag1: rejects bad top', () => {
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { top: -1 }));
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { top: 1.5 }));
});

test('daily-token-autocorrelation-lag1: rejects bad since/until', () => {
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { since: 'no' }));
  assert.throws(() => buildDailyTokenAutocorrelationLag1([], { until: 'nope' }));
});

// ---- empty / sparse --------------------------------------------------------

test('daily-token-autocorrelation-lag1: empty input', () => {
  const r = buildDailyTokenAutocorrelationLag1([], { generatedAt: GEN });
  assert.equal(r.totalSources, 0);
  assert.deepEqual(r.sources, []);
  assert.equal(r.generatedAt, GEN);
  assert.equal(r.minDays, 3);
});

test('daily-token-autocorrelation-lag1: source with fewer than minDays active days is dropped sparse', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'a', 100),
    ql('2026-04-02T01:00:00.000Z', 'a', 200),
  ];
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  assert.equal(r.totalSources, 1);
  assert.equal(r.droppedSparseSources, 1);
  assert.deepEqual(r.sources, []);
});

// ---- core math -------------------------------------------------------------

test('daily-token-autocorrelation-lag1: flat series -> flat=true, rho1=0', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const dd = d.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T05:00:00.000Z`, 'flat', 100));
  }
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 5);
  assert.equal(row.rho1Active, 0);
  assert.equal(row.flatActive, true);
  assert.equal(row.rho1Filled, 0);
  assert.equal(row.flatFilled, true);
  assert.equal(row.stddev, 0);
});

test('daily-token-autocorrelation-lag1: monotone series has positive rho1', () => {
  const queue: QueueLine[] = [];
  const vals = [100, 200, 300, 400, 500, 600];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'mono', t));
  });
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.flatActive, false);
  assert.ok(row.rho1Active >= 0.5, `monotone series should have rho1 >= 0.5, got ${row.rho1Active}`);
});

test('daily-token-autocorrelation-lag1: alternating high/low has negative rho1', () => {
  const queue: QueueLine[] = [];
  const vals = [100, 1000, 100, 1000, 100, 1000];
  vals.forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'zigzag', t));
  });
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.flatActive, false);
  assert.ok(row.rho1Active < -0.5, `zigzag should have rho1 < -0.5, got ${row.rho1Active}`);
});

test('daily-token-autocorrelation-lag1: known small example matches hand calc', () => {
  // Series: [1, 2, 3, 4]. mean=2.5. denom = sum((x-2.5)^2) = 1.5^2+0.5^2+0.5^2+1.5^2 = 5.
  // num = (1-2.5)*(2-2.5) + (2-2.5)*(3-2.5) + (3-2.5)*(4-2.5)
  //     = 0.75 - 0.25 + 0.75 = 1.25. rho1 = 0.25.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 1),
    ql('2026-04-02T00:00:00.000Z', 's', 2),
    ql('2026-04-03T00:00:00.000Z', 's', 3),
    ql('2026-04-04T00:00:00.000Z', 's', 4),
  ];
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.ok(Math.abs(row.rho1Active - 0.25) < 1e-9, `expected rho1 ~ 0.25, got ${row.rho1Active}`);
  assert.equal(row.mean, 2.5);
});

test('daily-token-autocorrelation-lag1: gap-fill diverges from active when there are calendar gaps', () => {
  // Active days (3): high, high, high on Apr 01, Apr 10, Apr 20.
  // Active series is constant -> flatActive = true, rho1Active = 0.
  // Filled: 20 days with mostly zeros and three spikes -> non-flat.
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 'sporadic', 1000),
    ql('2026-04-10T00:00:00.000Z', 'sporadic', 1000),
    ql('2026-04-20T00:00:00.000Z', 'sporadic', 1000),
  ];
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  const row = r.sources[0]!;
  assert.equal(row.nActiveDays, 3);
  assert.equal(row.nFilledDays, 20);
  assert.equal(row.flatActive, true);
  assert.equal(row.rho1Active, 0);
  assert.equal(row.flatFilled, false);
  assert.ok(row.rho1Filled !== 0, 'gap-filled should be non-zero on sporadic spikes');
});

test('daily-token-autocorrelation-lag1: per-source isolation', () => {
  const queue: QueueLine[] = [];
  // source A monotone
  [100, 200, 300, 400].forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'A', t));
  });
  // source B zigzag
  [100, 1000, 100, 1000].forEach((t, i) => {
    const dd = (i + 1).toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'B', t));
  });
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 2);
  const a = r.sources.find((s) => s.source === 'A')!;
  const b = r.sources.find((s) => s.source === 'B')!;
  assert.ok(a.rho1Active > 0, 'monotone A should be positive');
  assert.ok(b.rho1Active < 0, 'zigzag B should be negative');
});

// ---- filters / display -----------------------------------------------------

test('daily-token-autocorrelation-lag1: source filter excludes rows', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 5; d++) {
    const dd = d.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'keep', 100 * d));
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, 'drop', 100));
  }
  const r = buildDailyTokenAutocorrelationLag1(queue, {
    source: 'keep',
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'keep');
  assert.equal(r.droppedSourceFilter, 5);
  assert.equal(r.source, 'keep');
});

test('daily-token-autocorrelation-lag1: top cap truncates and accounts', () => {
  const queue: QueueLine[] = [];
  for (const src of ['big', 'mid', 'small']) {
    const mass = src === 'big' ? 1000 : src === 'mid' ? 500 : 100;
    for (let d = 1; d <= 4; d++) {
      const dd = d.toString().padStart(2, '0');
      queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, src, mass * d));
    }
  }
  const r = buildDailyTokenAutocorrelationLag1(queue, {
    top: 2,
    generatedAt: GEN,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.sources[1]!.source, 'mid');
  assert.equal(r.droppedTopSources, 1);
});

test('daily-token-autocorrelation-lag1: zero/negative tokens dropped', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00.000Z', 's', 100),
    ql('2026-04-02T00:00:00.000Z', 's', 0),
    ql('2026-04-03T00:00:00.000Z', 's', -5),
    ql('2026-04-04T00:00:00.000Z', 's', 100),
    ql('2026-04-05T00:00:00.000Z', 's', 100),
  ];
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  assert.equal(r.droppedZeroTokens, 2);
  assert.equal(r.sources[0]!.nActiveDays, 3);
});

test('daily-token-autocorrelation-lag1: empty source string buckets as (unknown)', () => {
  const queue: QueueLine[] = [];
  for (let d = 1; d <= 4; d++) {
    const dd = d.toString().padStart(2, '0');
    queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, '', 100 * d));
  }
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, '(unknown)');
});

test('daily-token-autocorrelation-lag1: report echoes resolved knobs', () => {
  const r = buildDailyTokenAutocorrelationLag1([], {
    generatedAt: GEN,
    minDays: 5,
    top: 3,
    since: '2026-04-01T00:00:00.000Z',
    until: '2026-04-30T00:00:00.000Z',
  });
  assert.equal(r.minDays, 5);
  assert.equal(r.top, 3);
  assert.equal(r.windowStart, '2026-04-01T00:00:00.000Z');
  assert.equal(r.windowEnd, '2026-04-30T00:00:00.000Z');
  assert.equal(r.source, null);
});

test('daily-token-autocorrelation-lag1: rows sorted by tokens desc then source asc', () => {
  const queue: QueueLine[] = [];
  for (const src of ['z', 'a', 'm']) {
    for (let d = 1; d <= 3; d++) {
      const dd = d.toString().padStart(2, '0');
      // identical mass per source so tie-break is alpha
      queue.push(ql(`2026-04-${dd}T00:00:00.000Z`, src, 100));
    }
  }
  const r = buildDailyTokenAutocorrelationLag1(queue, { generatedAt: GEN });
  assert.deepEqual(
    r.sources.map((s) => s.source),
    ['a', 'm', 'z'],
  );
});
