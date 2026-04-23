import type { Digest } from './report.js';
import type { Status } from './report.js';
import type { CostReport } from './cost.js';
import type { TrendReport } from './trend.js';
import type { ForecastReport } from './forecast.js';
import type { BudgetReport, BudgetStatus } from './budget.js';
import { sparkline, barChart, pieChart } from './svg.js';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return String(n);
}

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB';
  return n + ' B';
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  if (Math.abs(n) >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return '$' + n.toFixed(2);
  if (Math.abs(n) >= 0.01) return '$' + n.toFixed(4);
  if (n === 0) return '$0.00';
  return '$' + n.toFixed(6);
}

function fmtPct(p: number | null): string {
  if (p === null) return 'n/a';
  const sign = p > 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(1)}%`;
}

function pctClass(p: number | null): string {
  if (p === null) return 'muted';
  return p >= 0 ? 'ok' : 'err';
}

const STYLES = `
:root {
  --bg: #ffffff;
  --fg: #1a1a1a;
  --muted: #6b6b6b;
  --border: #e2e2e2;
  --accent: #2a5cdf;
  --row-alt: #f7f7f9;
}
@media (prefers-color-scheme: dark) {
  :root {
    --bg: #0e1117;
    --fg: #e6e6e6;
    --muted: #8b949e;
    --border: #2a2f37;
    --accent: #79a0ff;
    --row-alt: #161b22;
  }
}
* { box-sizing: border-box; }
body {
  margin: 0;
  padding: 24px 32px;
  background: var(--bg);
  color: var(--fg);
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  font-size: 13px;
  line-height: 1.5;
}
h1 { font-size: 20px; margin: 0 0 4px; }
h2 { font-size: 14px; margin: 28px 0 8px; border-bottom: 1px solid var(--border); padding-bottom: 4px; }
.meta { color: var(--muted); margin-bottom: 12px; }
.totals { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; margin: 16px 0; }
.totals .card {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px 12px;
  background: var(--row-alt);
}
.totals .card .label { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
.totals .card .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { padding: 4px 8px; text-align: left; }
th { color: var(--muted); font-weight: 600; border-bottom: 1px solid var(--border); }
tbody tr:nth-child(even) { background: var(--row-alt); }
td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
.row { display: flex; gap: 24px; flex-wrap: wrap; align-items: flex-start; }
.row > div { flex: 1 1 320px; min-width: 0; }
.spark { color: var(--accent); }
.muted { color: var(--muted); }
.warn { color: #d97706; }
.err { color: #dc2626; }
.ok { color: #16a34a; }
footer { margin-top: 32px; color: var(--muted); font-size: 11px; }
`;

export interface HtmlReportInput {
  pewHome: string;
  digest: Digest;
  status: Status | null;
  /** Optional cost report; section is omitted when absent. */
  cost?: CostReport | null;
  /** Optional trend report; section is omitted when absent. */
  trend?: TrendReport | null;
  /** Optional 7-day forecast; section is omitted when absent. */
  forecast?: ForecastReport | null;
  /** Optional budget report; section is omitted when absent. */
  budget?: BudgetReport | null;
  generatedAt: string;
}

export function renderHtmlReport(input: HtmlReportInput): string {
  const { pewHome, digest, status, cost, trend, forecast, budget, generatedAt } = input;

  const dayValues = digest.byDay.map((d) => d.totalTokens);
  const dayLabels = digest.byDay.map((d) => d.key);
  const sparkSvg = sparkline(dayValues, { width: 720, height: 60 });

  const sourceBars = barChart(
    digest.bySource.slice(0, 10).map((s) => ({ label: s.key, value: s.totalTokens })),
    { width: 480 },
  );
  const sourcePie = pieChart(
    digest.bySource.slice(0, 8).map((s) => ({ label: s.key, value: s.totalTokens })),
    { size: 180 },
  );

  const totalsCards = [
    ['Total tokens', fmtTokens(digest.totalTokens)],
    ['Input', fmtTokens(digest.inputTokens)],
    ['Cached input', fmtTokens(digest.cachedInputTokens)],
    ['Output', fmtTokens(digest.outputTokens)],
    ['Reasoning', fmtTokens(digest.reasoningTokens)],
    ['Events', fmt(digest.events)],
    ['Sessions', fmt(digest.sessionCount)],
  ]
    .map(
      ([label, value]) =>
        `<div class="card"><div class="label">${escapeHtml(label!)}</div><div class="value">${escapeHtml(value!)}</div></div>`,
    )
    .join('');

  const byDayRows = digest.byDay
    .map(
      (d, i) =>
        `<tr><td>${escapeHtml(dayLabels[i] ?? d.key)}</td><td class="num">${fmtTokens(d.totalTokens)}</td><td class="num">${fmt(d.events)}</td></tr>`,
    )
    .join('');

  const byModelRows = digest.byModel
    .map(
      (d) =>
        `<tr><td>${escapeHtml(d.key)}</td><td class="num">${fmtTokens(d.totalTokens)}</td><td class="num">${fmtTokens(d.inputTokens)}</td><td class="num">${fmtTokens(d.outputTokens)}</td><td class="num">${fmtTokens(d.reasoningTokens)}</td><td class="num">${fmt(d.events)}</td></tr>`,
    )
    .join('');

  const topPairsRows = digest.topPairs
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.source)}</td><td>${escapeHtml(p.model)}</td><td class="num">${fmtTokens(p.totalTokens)}</td></tr>`,
    )
    .join('');

  const topProjectsRows = digest.topProjectRefs
    .map(
      (p) =>
        `<tr><td>${escapeHtml(p.projectRef)}</td><td class="num">${fmt(p.sessions)}</td><td class="num">${fmt(p.messages)}</td></tr>`,
    )
    .join('');

  let lagSection = '';
  if (status) {
    const lockHtml = status.trailingLockHolder
      ? `pid ${status.trailingLockHolder.pid} (${escapeHtml(status.trailingLockHolder.startedAt)}) ${
          status.trailingLockAlive === false ? '<span class="err">[STALE]</span>' : '<span class="ok">[alive]</span>'
        }`
      : '<span class="muted">none</span>';

    const lagRows =
      status.lagFiles.length === 0
        ? '<tr><td colspan="2" class="muted">no lagging input files</td></tr>'
        : status.lagFiles
            .slice(0, 15)
            .map(
              (f) =>
                `<tr><td>${escapeHtml(f.path)}</td><td class="num">${fmtBytes(f.missingBytes)}</td></tr>`,
            )
            .join('');

    lagSection = `
<h2>Sync &amp; lag</h2>
<table>
  <tbody>
    <tr><td>queue.jsonl size</td><td class="num">${fmtBytes(status.queueFileSize)}</td></tr>
    <tr><td>queue offset (flushed)</td><td class="num">${fmtBytes(status.queueOffset)}</td></tr>
    <tr><td>queue pending bytes</td><td class="num">${fmtBytes(status.pendingQueueBytes)}</td></tr>
    <tr><td>session-queue.jsonl size</td><td class="num">${fmtBytes(status.sessionQueueFileSize)}</td></tr>
    <tr><td>session-queue offset</td><td class="num">${fmtBytes(status.sessionQueueOffset)}</td></tr>
    <tr><td>last success</td><td>${escapeHtml(status.lastSuccess ?? 'never')}</td></tr>
    <tr><td>trailing.lock</td><td>${lockHtml}</td></tr>
    <tr><td>runs/ count</td><td class="num">${fmt(status.runsCountApprox)}</td></tr>
  </tbody>
</table>

<h2>Lagging input files</h2>
<table>
  <thead><tr><th>path</th><th class="num">missing</th></tr></thead>
  <tbody>${lagRows}</tbody>
</table>`;
  }

  let costSection = '';
  if (cost) {
    const rateRows =
      cost.rows.length === 0
        ? '<tr><td colspan="6" class="muted">no priced events in window</td></tr>'
        : cost.rows
            .map(
              (r) =>
                `<tr><td>${escapeHtml(r.model)}</td><td class="num">${escapeHtml(fmtUsd(r.totalCost))}</td><td class="num">${escapeHtml(fmtUsd(r.inputCost))}</td><td class="num">${escapeHtml(fmtUsd(r.cachedInputCost))}</td><td class="num">${escapeHtml(fmtUsd(r.outputCost))}</td><td class="num">${escapeHtml(fmtUsd(r.reasoningCost))}</td></tr>`,
            )
            .join('');

    const unknownRows =
      cost.unknownModels.length === 0
        ? ''
        : `<h2>Unpriced models</h2>
<p class="muted">Add these to <code>~/.config/pew-insights/rates.json</code> to include them in the estimate.</p>
<table>
  <thead><tr><th>model</th><th class="num">tokens</th><th class="num">events</th></tr></thead>
  <tbody>${cost.unknownModels
    .map(
      (u) =>
        `<tr><td>${escapeHtml(u.model)}</td><td class="num">${fmtTokens(u.totalTokens)}</td><td class="num">${fmt(u.events)}</td></tr>`,
    )
    .join('')}</tbody>
</table>`;

    costSection = `
<h2>Estimated cost</h2>
<div class="totals">
  <div class="card"><div class="label">Estimated cost</div><div class="value">${escapeHtml(fmtUsd(cost.totalCost))}</div></div>
  <div class="card"><div class="label">No-cache baseline</div><div class="value">${escapeHtml(fmtUsd(cost.totalCostNoCache))}</div></div>
  <div class="card"><div class="label">Cache savings</div><div class="value ok">${escapeHtml(fmtUsd(cost.cacheSavings))}</div></div>
</div>
<table>
  <thead><tr><th>model</th><th class="num">total</th><th class="num">input</th><th class="num">cached</th><th class="num">output</th><th class="num">reasoning</th></tr></thead>
  <tbody>${rateRows}</tbody>
</table>
${unknownRows}`;
  }

  let trendSection = '';
  if (trend) {
    const trendSpark = sparkline(trend.series.map((s) => s.tokens), { width: 720, height: 60 });
    const dod = trend.dod;
    const wow = trend.wow;
    const modelRows =
      trend.byModel.length === 0
        ? '<tr><td colspan="5" class="muted">no model activity in window</td></tr>'
        : trend.byModel
            .map(
              (m) =>
                `<tr><td>${escapeHtml(m.model)}</td><td class="num">${fmtTokens(m.current)}</td><td class="num">${fmtTokens(m.previous)}</td><td class="num ${pctClass(m.pct)}">${escapeHtml(fmtPct(m.pct))}</td><td><code>${escapeHtml(m.sparkline)}</code></td></tr>`,
            )
            .join('');

    trendSection = `
<h2>Trend</h2>
<div class="totals">
  <div class="card">
    <div class="label">Day-over-day (24h)</div>
    <div class="value">${fmtTokens(dod.current)} <span class="muted">vs</span> ${fmtTokens(dod.previous)}</div>
    <div class="${pctClass(dod.pct)}">${escapeHtml(fmtPct(dod.pct))}</div>
  </div>
  <div class="card">
    <div class="label">Week-over-week (7d)</div>
    <div class="value">${fmtTokens(wow.current)} <span class="muted">vs</span> ${fmtTokens(wow.previous)}</div>
    <div class="${pctClass(wow.pct)}">${escapeHtml(fmtPct(wow.pct))}</div>
  </div>
</div>
<div class="spark">${trendSpark}</div>
<p class="muted">${escapeHtml(trend.series[0]?.day ?? '')} → ${escapeHtml(trend.series.at(-1)?.day ?? '')} (${trend.series.length}d window)</p>
<table>
  <thead><tr><th>model</th><th class="num">current</th><th class="num">previous</th><th class="num">Δ%</th><th>spark</th></tr></thead>
  <tbody>${modelRows}</tbody>
</table>`;
  }

  let forecastSection = '';
  if (forecast) {
    const histSpark = sparkline(
      forecast.history.map((h) => h.tokens),
      { width: 720, height: 60 },
    );
    const tomorrow = forecast.tomorrow;
    const weekRows =
      forecast.weekRemaining.length === 0
        ? '<tr><td colspan="4" class="muted">no remaining forecast days this week (already at week end)</td></tr>'
        : forecast.weekRemaining
            .map(
              (p) =>
                `<tr><td>${escapeHtml(p.day)}</td><td class="num">${fmtTokens(p.predicted)}</td><td class="num muted">${fmtTokens(p.lower)}</td><td class="num muted">${fmtTokens(p.upper)}</td></tr>`,
            )
            .join('');
    const lowConf = forecast.lowConfidence
      ? '<p class="warn">Low-confidence fit (small sample or zero variance) — predictions are very wide.</p>'
      : '';
    const r2Display = Number.isFinite(forecast.r2) ? forecast.r2.toFixed(3) : 'n/a';
    forecastSection = `
<h2>Forecast (next 7 days)</h2>
<div class="totals">
  <div class="card">
    <div class="label">Tomorrow (predicted)</div>
    <div class="value">${fmtTokens(tomorrow.predicted)}</div>
    <div class="muted">95% PI ${fmtTokens(tomorrow.lower)} – ${fmtTokens(tomorrow.upper)}</div>
  </div>
  <div class="card">
    <div class="label">Week observed (Mon→${escapeHtml(forecast.asOf.slice(0, 10))})</div>
    <div class="value">${fmtTokens(forecast.weekObserved)}</div>
  </div>
  <div class="card">
    <div class="label">Week projected (full Mon→Sun)</div>
    <div class="value">${fmtTokens(forecast.weekProjected)}</div>
    <div class="muted">95% PI ${fmtTokens(forecast.weekProjectedLower)} – ${fmtTokens(forecast.weekProjectedUpper)}</div>
  </div>
  <div class="card">
    <div class="label">Trend (slope · R²)</div>
    <div class="value">${forecast.slope >= 0 ? '+' : ''}${fmtTokens(Math.abs(forecast.slope))}/d</div>
    <div class="muted">R² = ${escapeHtml(r2Display)} · n=${forecast.n}d</div>
  </div>
</div>
${lowConf}
<div class="spark">${histSpark}</div>
<p class="muted">history: ${escapeHtml(forecast.history[0]?.day ?? '')} → ${escapeHtml(forecast.history.at(-1)?.day ?? '')}</p>
<table>
  <thead><tr><th>day</th><th class="num">predicted</th><th class="num">lower (95%)</th><th class="num">upper (95%)</th></tr></thead>
  <tbody>${weekRows}</tbody>
</table>`;
  }

  let budgetSection = '';
  if (budget) {
    const statusClass: Record<BudgetStatus, string> = {
      under: 'ok',
      'on-track': 'ok',
      over: 'warn',
      breached: 'err',
    };
    const pctUsed = (budget.percentOfMonthBudgetUsed * 100).toFixed(1) + '%';
    const burnSpark = sparkline(
      budget.dailySpendSeries.map((d) => d.usd),
      { width: 480, height: 50 },
    );
    const eta = budget.etaBreachDay
      ? `<span class="warn">${escapeHtml(budget.etaBreachDay)}</span>`
      : '<span class="muted">none in current month</span>';
    budgetSection = `
<h2>Budget</h2>
<div class="totals">
  <div class="card">
    <div class="label">Status</div>
    <div class="value ${statusClass[budget.status]}">${escapeHtml(budget.status)}</div>
    <div class="muted">${escapeHtml(pctUsed)} of monthly cap</div>
  </div>
  <div class="card">
    <div class="label">Today's spend</div>
    <div class="value">${escapeHtml(fmtUsd(budget.todaySpendUsd))}</div>
    <div class="muted">daily target ${escapeHtml(fmtUsd(budget.dailyBudgetUsd))}</div>
  </div>
  <div class="card">
    <div class="label">Month-to-date spend</div>
    <div class="value">${escapeHtml(fmtUsd(budget.monthSpendUsd))}</div>
    <div class="muted">cap ${escapeHtml(fmtUsd(budget.monthlyBudgetUsd))} · ${budget.daysRemainingInMonth}d left</div>
  </div>
  <div class="card">
    <div class="label">Burn rate (${budget.windowDays}d avg)</div>
    <div class="value">${escapeHtml(fmtUsd(budget.dailyBurnUsd))}/d</div>
    <div class="muted">ETA breach: ${eta}</div>
  </div>
</div>
<div class="spark">${burnSpark}</div>
<p class="muted">daily spend, last ${budget.dailySpendSeries.length} days</p>`;
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>pew-insights report</title>
<style>${STYLES}</style>
</head>
<body>
<h1>pew-insights report</h1>
<div class="meta">
  pew home: <code>${escapeHtml(pewHome)}</code> &middot;
  since: <code>${escapeHtml(digest.since ?? 'all')}</code> &middot;
  generated: <code>${escapeHtml(generatedAt)}</code>
</div>

<div class="totals">${totalsCards}</div>

${trendSection}

${forecastSection}

${budgetSection}

${costSection}

<h2>Tokens by day</h2>
<div class="spark">${sparkSvg}</div>
<table>
  <thead><tr><th>day</th><th class="num">tokens</th><th class="num">events</th></tr></thead>
  <tbody>${byDayRows || '<tr><td colspan="3" class="muted">no data</td></tr>'}</tbody>
</table>

<h2>Tokens by source</h2>
<div class="row">
  <div>${sourceBars}</div>
  <div>${sourcePie}</div>
</div>

<h2>By model</h2>
<table>
  <thead><tr><th>model</th><th class="num">total</th><th class="num">input</th><th class="num">output</th><th class="num">reasoning</th><th class="num">events</th></tr></thead>
  <tbody>${byModelRows || '<tr><td colspan="6" class="muted">no data</td></tr>'}</tbody>
</table>

<h2>Top source × model pairs</h2>
<table>
  <thead><tr><th>source</th><th>model</th><th class="num">tokens</th></tr></thead>
  <tbody>${topPairsRows || '<tr><td colspan="3" class="muted">no data</td></tr>'}</tbody>
</table>

<h2>Top project_refs</h2>
<table>
  <thead><tr><th>project_ref</th><th class="num">sessions</th><th class="num">messages</th></tr></thead>
  <tbody>${topProjectsRows || '<tr><td colspan="3" class="muted">no data</td></tr>'}</tbody>
</table>

${lagSection}

<footer>Generated by pew-insights. Read-only consumer of <code>${escapeHtml(pewHome)}</code>.</footer>
</body>
</html>
`;
}
