import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBudget, defaultBudgetPath, readBudgetFile } from '../src/budget.ts';
import { DEFAULT_RATES } from '../src/cost.ts';
import type { QueueLine } from '../src/types.ts';

function q(hour: string, input: number, output: number, model = 'gpt-5.4'): QueueLine {
  return {
    source: 'cli',
    model,
    hour_start: hour,
    device_id: 'd1',
    input_tokens: input,
    cached_input_tokens: 0,
    output_tokens: output,
    reasoning_output_tokens: 0,
    total_tokens: input + output,
  };
}

// ---------------------------------------------------------------------------
// Config / parsing
// ---------------------------------------------------------------------------

test('defaultBudgetPath: ends in budget.json under .config/pew-insights', () => {
  const p = defaultBudgetPath();
  assert.ok(p.endsWith('budget.json'), p);
  assert.ok(p.includes('pew-insights'), p);
});

test('readBudgetFile: missing file returns null', async () => {
  const p = join(tmpdir(), 'pew-insights-no-such-budget-' + Date.now() + '.json');
  const r = await readBudgetFile(p);
  assert.equal(r, null);
});

test('readBudgetFile: valid file returns parsed config', async () => {
  const p = join(tmpdir(), 'pew-insights-budget-' + Date.now() + '.json');
  await fs.writeFile(p, JSON.stringify({ dailyUsd: 5, monthlyUsd: 100 }));
  const r = await readBudgetFile(p);
  assert.deepEqual(r, { dailyUsd: 5, monthlyUsd: 100 });
  await fs.unlink(p);
});

test('readBudgetFile: snake_case aliases accepted', async () => {
  const p = join(tmpdir(), 'pew-insights-budget-snake-' + Date.now() + '.json');
  await fs.writeFile(p, JSON.stringify({ daily_usd: 3, monthly_usd: 50 }));
  const r = await readBudgetFile(p);
  assert.equal(r?.dailyUsd, 3);
  assert.equal(r?.monthlyUsd, 50);
  await fs.unlink(p);
});

test('readBudgetFile: rejects negative dailyUsd', async () => {
  const p = join(tmpdir(), 'pew-insights-budget-neg-' + Date.now() + '.json');
  await fs.writeFile(p, JSON.stringify({ dailyUsd: -1 }));
  await assert.rejects(() => readBudgetFile(p));
  await fs.unlink(p);
});

test('readBudgetFile: rejects non-number dailyUsd', async () => {
  const p = join(tmpdir(), 'pew-insights-budget-str-' + Date.now() + '.json');
  await fs.writeFile(p, JSON.stringify({ dailyUsd: 'lots' }));
  await assert.rejects(() => readBudgetFile(p));
  await fs.unlink(p);
});

// ---------------------------------------------------------------------------
// buildBudget
// ---------------------------------------------------------------------------

test('buildBudget: rejects negative dailyUsd', () => {
  assert.throws(() => buildBudget([], DEFAULT_RATES, { dailyUsd: -1 }));
});

test('buildBudget: rejects windowDays < 1', () => {
  assert.throws(() =>
    buildBudget([], DEFAULT_RATES, { dailyUsd: 5 }, { windowDays: 0, asOf: '2026-04-22T12:00:00Z' }),
  );
});

test('buildBudget: empty queue yields zero spend & under status', () => {
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 10 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.monthSpendUsd, 0);
  assert.equal(r.todaySpendUsd, 0);
  assert.equal(r.dailyBurnUsd, 0);
  assert.equal(r.status, 'under');
  assert.equal(r.etaBreachDay, null);
});

test('buildBudget: monthlyBudget defaults to daily × days-in-month', () => {
  // 2026-04 → 30 days.
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 5 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.monthlyBudgetUsd, 150);
});

test('buildBudget: explicit monthlyUsd overrides default', () => {
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 5, monthlyUsd: 200 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.monthlyBudgetUsd, 200);
});

test('buildBudget: counts spend only within current UTC month', () => {
  const queue: QueueLine[] = [
    q('2026-03-31T23:00:00.000Z', 1_000_000, 0), // last month
    q('2026-04-01T01:00:00.000Z', 1_000_000, 0), // this month, $5
    q('2026-04-22T08:00:00.000Z', 200_000, 0), // today, $1
  ];
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 10 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  // input gpt-5.4 = $5/M tokens.
  assert.ok(Math.abs(r.monthSpendUsd - 6) < 1e-6, `month=${r.monthSpendUsd}`);
  assert.ok(Math.abs(r.todaySpendUsd - 1) < 1e-6, `today=${r.todaySpendUsd}`);
});

test('buildBudget: status="over" when today between 1.0× and 1.5× daily', () => {
  // 1.2M input gpt-5.4 tokens today = $6 against $5 daily.
  const queue: QueueLine[] = [q('2026-04-22T05:00:00.000Z', 1_200_000, 0)];
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 5 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.status, 'over');
});

test('buildBudget: status="breached" when today >= 1.5× daily', () => {
  const queue: QueueLine[] = [q('2026-04-22T05:00:00.000Z', 2_000_000, 0)]; // $10 vs $5 daily
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 5, monthlyUsd: 1000 }, // big monthly so the today threshold is what triggers it
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.status, 'breached');
});

test('buildBudget: status="breached" when monthSpend > monthlyBudget', () => {
  // Tiny monthly budget; one event blows past it.
  const queue: QueueLine[] = [q('2026-04-22T05:00:00.000Z', 1_000_000, 0)];
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 100, monthlyUsd: 1 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.status, 'breached');
});

test('buildBudget: etaBreachDay is null if rate is zero', () => {
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 10 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.etaBreachDay, null);
});

test('buildBudget: etaBreachDay set when burn rate would breach within month', () => {
  // Build a 7-day burn averaging $50/day, monthly budget $1000, asOf early in month.
  // monthSpend ~$350, remaining ~$650, burn $50/day → ETA ~13 days from asOf, well within April.
  const queue: QueueLine[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date('2026-04-08T12:00:00Z');
    d.setUTCDate(d.getUTCDate() - i);
    const iso = d.toISOString().slice(0, 13) + ':00:00.000Z';
    // 10M input gpt-5.4 tokens = $50/day.
    queue.push(q(iso, 10_000_000, 0));
  }
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 100, monthlyUsd: 1000 },
    { asOf: '2026-04-08T23:00:00Z', windowDays: 7 },
  );
  assert.ok(r.dailyBurnUsd > 40, `burn=${r.dailyBurnUsd}`);
  assert.ok(r.etaBreachDay !== null, `expected non-null etaBreachDay; report=${JSON.stringify(r)}`);
  assert.ok(r.etaBreachDay! > '2026-04-08' && r.etaBreachDay! <= '2026-04-30');
});

test('buildBudget: dailySpendSeries length equals windowDays', () => {
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 5 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 10 },
  );
  assert.equal(r.dailySpendSeries.length, 10);
});

test('buildBudget: percentOfMonthBudgetUsed reflects month spend / cap', () => {
  // $5 spend, $50 cap → 0.10
  const queue: QueueLine[] = [q('2026-04-15T05:00:00.000Z', 1_000_000, 0)];
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 5, monthlyUsd: 50 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.ok(Math.abs(r.percentOfMonthBudgetUsed - 0.1) < 1e-6);
});

test('buildBudget: daysRemainingInMonth includes today', () => {
  // 2026-04-22 → days remaining = 30 - 22 + 1 = 9
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 5 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.daysRemainingInMonth, 9);
});

test('buildBudget: dailyUsd=0 → on-track is impossible; under when no spend', () => {
  const r = buildBudget(
    [],
    DEFAULT_RATES,
    { dailyUsd: 0, monthlyUsd: 100 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.status, 'under');
});

test('buildBudget: dailyUsd=0 with any spend → over', () => {
  const queue: QueueLine[] = [q('2026-04-22T05:00:00.000Z', 100_000, 0)];
  const r = buildBudget(
    queue,
    DEFAULT_RATES,
    { dailyUsd: 0, monthlyUsd: 100 },
    { asOf: '2026-04-22T12:00:00Z', windowDays: 7 },
  );
  assert.equal(r.status, 'over');
});
