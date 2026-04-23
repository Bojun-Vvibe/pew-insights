/**
 * Budget tracking & burn-rate analysis.
 *
 * Design notes
 * ------------
 * The budget feature answers three questions:
 *   1. How much $ have I burned so far this period? (period == calendar UTC month)
 *   2. At my current daily burn rate, when will I hit the monthly budget?
 *   3. Am I currently over my daily target, and by how much?
 *
 * Inputs
 * ------
 *   - Daily budget (USD/day): user-configured, either via --daily flag or a
 *     config file at ~/.config/pew-insights/budget.json. Monthly cap derives
 *     from daily * (days in current UTC month).
 *   - The cost-priced queue rows (using the same RateTable as `cost`).
 *
 * Outputs
 * -------
 *   - currentMonthSpend, dailyBurn (avg over `windowDays`), today's spend,
 *     status (one of 'under' | 'on-track' | 'over' | 'breached'),
 *     etaBreach (ISO day when monthSpend will hit monthBudget if burn holds),
 *     percentOfMonthBudgetUsed.
 *
 * Status thresholds (today vs daily target):
 *   under     : todaySpend < 0.8 * dailyBudget
 *   on-track  : 0.8 ≤ todaySpend / dailyBudget < 1.0
 *   over      : 1.0 ≤ todaySpend / dailyBudget < 1.5
 *   breached  : todaySpend >= 1.5 * dailyBudget
 * Or whenever monthSpend > monthBudget → 'breached' regardless of today.
 */
import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { computeCost, type RateTable } from './cost.js';
import type { QueueLine } from './types.js';

export interface BudgetConfig {
  /** Daily target in USD. */
  dailyUsd: number;
  /** Optional explicit monthly cap; otherwise derived from dailyUsd × days-in-month. */
  monthlyUsd?: number;
}

export type BudgetStatus = 'under' | 'on-track' | 'over' | 'breached';

export interface BudgetReport {
  asOf: string;
  config: BudgetConfig;
  /** Daily target actually used (USD). */
  dailyBudgetUsd: number;
  /** Monthly cap (either user-supplied or daily × days-in-month). */
  monthlyBudgetUsd: number;
  /** USD spent so far this UTC calendar month (1st 00:00 UTC → asOf). */
  monthSpendUsd: number;
  /** USD spent in today's UTC calendar day (00:00 UTC → asOf). */
  todaySpendUsd: number;
  /** Average daily spend over the last `windowDays`. */
  dailyBurnUsd: number;
  /** windowDays used for the burn computation. */
  windowDays: number;
  /** monthSpendUsd / monthlyBudgetUsd, in [0, ∞). */
  percentOfMonthBudgetUsed: number;
  /** Number of UTC days remaining in the current month, including today. */
  daysRemainingInMonth: number;
  /**
   * ISO yyyy-mm-dd of the projected breach day, or null if either:
   *   - the cap is already breached (monthSpend > monthlyBudget) → status='breached'
   *   - the burn rate is zero (we'd never reach the cap)
   *   - the projected breach falls after the current month ends (we don't
   *     extrapolate beyond the month)
   */
  etaBreachDay: string | null;
  /** Status classification, see module docs. */
  status: BudgetStatus;
  /** Per-day spend over the last `windowDays` (oldest → newest). */
  dailySpendSeries: Array<{ day: string; usd: number }>;
}

export function defaultBudgetPath(): string {
  return join(homedir(), '.config', 'pew-insights', 'budget.json');
}

export async function readBudgetFile(path: string): Promise<BudgetConfig | null> {
  let raw: string;
  try {
    raw = await fs.readFile(path, 'utf8');
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`budget file ${path} must be a JSON object`);
  }
  const v = parsed as Record<string, unknown>;
  const daily = Number(v.dailyUsd ?? v.daily_usd ?? v.daily);
  if (!Number.isFinite(daily) || daily < 0) {
    throw new Error(`budget.dailyUsd must be a non-negative number`);
  }
  const cfg: BudgetConfig = { dailyUsd: daily };
  if (v.monthlyUsd != null || v.monthly_usd != null || v.monthly != null) {
    const monthly = Number(v.monthlyUsd ?? v.monthly_usd ?? v.monthly);
    if (!Number.isFinite(monthly) || monthly < 0) {
      throw new Error(`budget.monthlyUsd must be a non-negative number`);
    }
    cfg.monthlyUsd = monthly;
  }
  return cfg;
}

// ---------------------------------------------------------------------------
// Date helpers (UTC)
// ---------------------------------------------------------------------------

function daysInMonthUtc(year: number, monthZeroBased: number): number {
  // Day 0 of next month == last day of this month.
  return new Date(Date.UTC(year, monthZeroBased + 1, 0)).getUTCDate();
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function dailyBucketsUsd(
  queue: QueueLine[],
  rates: RateTable,
  fromIso: string,
  untilIso: string,
): Map<string, number> {
  const buckets = new Map<string, number>();
  // Use computeCost with a since-window then re-bucket per day. Simpler: iterate.
  for (const q of queue) {
    if (q.hour_start < fromIso || q.hour_start >= untilIso) continue;
    const day = q.hour_start.slice(0, 10);
    // Compute per-row cost via single-element computeCost to share rate logic.
    const sub = computeCost([q], null, rates);
    buckets.set(day, (buckets.get(day) ?? 0) + sub.totalCost);
  }
  return buckets;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface BudgetOptions {
  /** Cutoff timestamp (default now). */
  asOf?: string;
  /** Days used to compute the rolling daily-burn average (default 7). */
  windowDays?: number;
}

export function buildBudget(
  queue: QueueLine[],
  rates: RateTable,
  config: BudgetConfig,
  opts: BudgetOptions = {},
): BudgetReport {
  if (!Number.isFinite(config.dailyUsd) || config.dailyUsd < 0) {
    throw new Error('budget.dailyUsd must be a non-negative finite number');
  }
  const asOf = opts.asOf ?? new Date().toISOString();
  const windowDays = opts.windowDays ?? 7;
  if (windowDays < 1) throw new Error('windowDays must be >= 1');

  const asOfDate = new Date(asOf);
  const year = asOfDate.getUTCFullYear();
  const month = asOfDate.getUTCMonth();
  const dim = daysInMonthUtc(year, month);
  const monthlyBudgetUsd = config.monthlyUsd ?? config.dailyUsd * dim;

  // Month spend.
  const monthStartIso = new Date(Date.UTC(year, month, 1)).toISOString();
  const monthBuckets = dailyBucketsUsd(queue, rates, monthStartIso, asOf);
  const monthSpendUsd = Array.from(monthBuckets.values()).reduce((a, b) => a + b, 0);

  // Today spend (separate so todaySpend includes partial day correctly).
  const todayStartIso = new Date(Date.UTC(year, month, asOfDate.getUTCDate())).toISOString();
  const todaySpendUsd = monthBuckets.get(todayStartIso.slice(0, 10)) ?? 0;

  // Burn rate over windowDays.
  const burnFromMs = asOfDate.getTime() - windowDays * 86_400_000;
  const burnFromIso = new Date(burnFromMs).toISOString();
  const burnBuckets = dailyBucketsUsd(queue, rates, burnFromIso, asOf);
  const totalBurnSpend = Array.from(burnBuckets.values()).reduce((a, b) => a + b, 0);
  const dailyBurnUsd = totalBurnSpend / windowDays;

  // Daily series (oldest → newest), zero-filled.
  const dailySpendSeries: Array<{ day: string; usd: number }> = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(asOfDate.getTime() - i * 86_400_000);
    const k = isoDay(d);
    dailySpendSeries.push({ day: k, usd: burnBuckets.get(k) ?? 0 });
  }

  // ETA to breach: how many additional days at dailyBurnUsd before
  // cumulative monthSpend hits monthlyBudget?
  let etaBreachDay: string | null = null;
  const remaining = monthlyBudgetUsd - monthSpendUsd;
  const todayUtcDay = asOfDate.getUTCDate();
  const daysRemainingInMonth = dim - todayUtcDay + 1; // include today
  if (remaining > 0 && dailyBurnUsd > 0) {
    const daysToBreach = Math.ceil(remaining / dailyBurnUsd);
    if (daysToBreach <= dim - todayUtcDay) {
      // breach falls within this calendar month
      const breach = new Date(asOfDate.getTime() + daysToBreach * 86_400_000);
      etaBreachDay = isoDay(breach);
    }
    // else: at this rate we'd run out next month — not flagged here.
  }

  // Status classification.
  let status: BudgetStatus;
  if (monthSpendUsd > monthlyBudgetUsd || (monthSpendUsd === monthlyBudgetUsd && monthlyBudgetUsd > 0)) {
    status = 'breached';
  } else if (config.dailyUsd === 0) {
    // Zero budget → anything is "over"; nothing is "breached" until month cap exceeded.
    status = todaySpendUsd > 0 ? 'over' : 'under';
  } else {
    const ratio = todaySpendUsd / config.dailyUsd;
    if (ratio >= 1.5) status = 'breached';
    else if (ratio >= 1.0) status = 'over';
    else if (ratio >= 0.8) status = 'on-track';
    else status = 'under';
  }

  return {
    asOf,
    config,
    dailyBudgetUsd: config.dailyUsd,
    monthlyBudgetUsd,
    monthSpendUsd,
    todaySpendUsd,
    dailyBurnUsd,
    windowDays,
    percentOfMonthBudgetUsed: monthlyBudgetUsd === 0 ? 0 : monthSpendUsd / monthlyBudgetUsd,
    daysRemainingInMonth,
    etaBreachDay,
    status,
    dailySpendSeries,
  };
}
