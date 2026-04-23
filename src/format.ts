import chalk from 'chalk';
import type { Digest, DigestRow, DoctorReport, SourcesPivot, Status } from './report.js';
import type { CostReport } from './cost.js';
import type { DeltaWindow, TrendReport } from './trend.js';
import type { TopProjectsResult } from './topprojects.js';
import type { ForecastReport } from './forecast.js';
import type { BudgetReport, BudgetStatus } from './budget.js';
import type { CompareReport, SignificanceHint } from './compare.js';
import type { AnomaliesReport, AnomalyStatus } from './anomalies.js';
import type { RatiosReport, RatioStatus } from './ratiosreport.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(2) + 'K';
  return String(n);
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024 * 1024) return (n / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  if (n >= 1024 * 1024) return (n / (1024 * 1024)).toFixed(2) + ' MB';
  if (n >= 1024) return (n / 1024).toFixed(2) + ' KB';
  return n + ' B';
}

export function formatDuration(seconds: number | null): string {
  if (seconds === null) return 'never';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function padRight(s: string, n: number): string {
  if (s.length >= n) return s;
  return s + ' '.repeat(n - s.length);
}

function padLeft(s: string, n: number): string {
  if (s.length >= n) return s;
  return ' '.repeat(n - s.length) + s;
}

function renderTable(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) => {
    let w = h.length;
    for (const row of rows) {
      const cell = row[i] ?? '';
      if (cell.length > w) w = cell.length;
    }
    return w;
  });

  const headerLine = headers
    .map((h, i) => chalk.bold(i === 0 ? padRight(h, widths[i]!) : padLeft(h, widths[i]!)))
    .join('  ');
  const sep = widths.map((w) => '─'.repeat(w)).join('  ');

  const body = rows
    .map((row) =>
      row
        .map((cell, i) =>
          i === 0 ? padRight(cell, widths[i]!) : padLeft(cell, widths[i]!),
        )
        .join('  '),
    )
    .join('\n');

  return [headerLine, chalk.dim(sep), body].join('\n');
}

function digestRowsToTable(rows: DigestRow[], keyHeader: string, max = 25): string {
  const top = rows.slice(0, max);
  const tableRows = top.map((r) => [
    r.key,
    formatTokens(r.totalTokens),
    formatTokens(r.inputTokens),
    formatTokens(r.outputTokens),
    formatNumber(r.events),
  ]);
  return renderTable([keyHeader, 'total', 'input', 'output', 'events'], tableRows);
}

// ---------------------------------------------------------------------------
// Renderers
// ---------------------------------------------------------------------------

export function renderDigest(d: Digest): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights digest'));
  lines.push(
    chalk.dim(
      `since: ${d.since ?? 'all'}    events: ${formatNumber(d.events)}    sessions: ${formatNumber(d.sessionCount)}`,
    ),
  );
  lines.push('');

  lines.push(chalk.bold('Totals'));
  lines.push(
    renderTable(
      ['metric', 'tokens'],
      [
        ['total', formatTokens(d.totalTokens)],
        ['input', formatTokens(d.inputTokens)],
        ['cached_input', formatTokens(d.cachedInputTokens)],
        ['output', formatTokens(d.outputTokens)],
        ['reasoning_output', formatTokens(d.reasoningTokens)],
      ],
    ),
  );
  lines.push('');

  if (d.byDay.length > 0) {
    lines.push(chalk.bold('By day'));
    lines.push(digestRowsToTable(d.byDay, 'day'));
    lines.push('');
  }

  if (d.bySource.length > 0) {
    lines.push(chalk.bold('By source'));
    lines.push(digestRowsToTable(d.bySource, 'source'));
    lines.push('');
  }

  if (d.byModel.length > 0) {
    lines.push(chalk.bold('By model'));
    lines.push(digestRowsToTable(d.byModel, 'model'));
    lines.push('');
  }

  if (d.byHour.length > 0) {
    lines.push(chalk.bold('By hour-of-day (UTC)'));
    lines.push(digestRowsToTable(d.byHour, 'hour'));
    lines.push('');
  }

  if (d.topPairs.length > 0) {
    lines.push(chalk.bold('Top source × model pairs'));
    lines.push(
      renderTable(
        ['source', 'model', 'tokens'],
        d.topPairs.map((p) => [p.source, p.model, formatTokens(p.totalTokens)]),
      ),
    );
    lines.push('');
  }

  if (d.topProjectRefs.length > 0) {
    lines.push(chalk.bold('Top project_refs (sessions)'));
    lines.push(
      renderTable(
        ['project_ref', 'sessions', 'messages'],
        d.topProjectRefs.map((p) => [
          p.projectRef,
          formatNumber(p.sessions),
          formatNumber(p.messages),
        ]),
      ),
    );
    lines.push('');
  }

  return lines.join('\n');
}

export function renderStatus(s: Status): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights status'));
  lines.push(chalk.dim(`pew home: ${s.pewHome}`));
  lines.push('');

  const lockStr = s.trailingLockHolder
    ? `${s.trailingLockHolder.pid} (started ${s.trailingLockHolder.startedAt}) ${
        s.trailingLockAlive === false ? chalk.red('[STALE]') : chalk.green('[alive]')
      }`
    : chalk.dim('none');

  lines.push(
    renderTable(
      ['field', 'value'],
      [
        ['queue.jsonl size', formatBytes(s.queueFileSize)],
        ['queue offset (flushed)', formatBytes(s.queueOffset)],
        ['queue pending bytes', formatBytes(s.pendingQueueBytes)],
        ['queue pending lines (~)', formatNumber(s.pendingQueueLines)],
        ['queue dirty keys', String(s.dirtyKeys.length)],
        ['session-queue.jsonl size', formatBytes(s.sessionQueueFileSize)],
        ['session-queue offset', formatBytes(s.sessionQueueOffset)],
        ['session-queue pending bytes', formatBytes(s.pendingSessionQueueBytes)],
        ['last success', s.lastSuccess ?? chalk.dim('never')],
        ['last success age', formatDuration(s.lastSuccessAgeSeconds)],
        ['trailing.lock', lockStr],
        ['runs/ count', formatNumber(s.runsCountApprox)],
        ['lagging input files', String(s.lagFiles.length)],
      ],
    ),
  );

  if (s.lagFiles.length > 0) {
    lines.push('');
    lines.push(chalk.bold('Top lagging input files'));
    lines.push(
      renderTable(
        ['path', 'missing'],
        s.lagFiles.slice(0, 10).map((f) => [f.path, formatBytes(f.missingBytes)]),
      ),
    );
  }

  return lines.join('\n');
}

export function renderSources(p: SourcesPivot): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights sources — source × model token totals'));
  lines.push(chalk.dim(`since: ${p.since ?? 'all'}`));
  lines.push('');

  if (p.rows.length === 0) {
    lines.push(chalk.dim('no data in window'));
    return lines.join('\n');
  }

  // Cap models shown to keep the table readable.
  const models = p.models.slice(0, 8);
  const headers = ['source', 'total', ...models];
  const rows = p.rows.map((r) => [
    r.source,
    formatTokens(r.total),
    ...models.map((m) => {
      const v = r.perModel[m] ?? 0;
      return v === 0 ? chalk.dim('·') : formatTokens(v);
    }),
  ]);
  lines.push(renderTable(headers, rows));

  if (p.models.length > models.length) {
    lines.push('');
    lines.push(
      chalk.dim(`(+${p.models.length - models.length} more models elided; use --json for full data)`),
    );
  }

  return lines.join('\n');
}

export function renderDoctor(r: DoctorReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights doctor'));
  lines.push(chalk.dim(`pew home: ${r.pewHome} ${r.pewHomeExists ? chalk.green('[exists]') : chalk.red('[MISSING]')}`));
  lines.push('');

  for (const f of r.findings) {
    const tag =
      f.severity === 'error' ? chalk.red.bold('ERROR') :
      f.severity === 'warn' ? chalk.yellow.bold('WARN ') :
      chalk.green.bold('INFO ');
    lines.push(`${tag} ${chalk.bold(f.code)}  ${f.message}`);
    if (f.hint) lines.push(chalk.dim(`     hint: ${f.hint}`));
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Cost
// ---------------------------------------------------------------------------

export function formatUsd(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  if (Math.abs(n) >= 1000) return '$' + n.toLocaleString('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (Math.abs(n) >= 1) return '$' + n.toFixed(2);
  if (Math.abs(n) >= 0.01) return '$' + n.toFixed(4);
  if (n === 0) return '$0.00';
  return '$' + n.toFixed(6);
}

export function renderCost(c: CostReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights cost'));
  lines.push(chalk.dim(`since: ${c.since ?? 'all'}`));
  lines.push('');
  lines.push(
    renderTable(
      ['metric', 'value'],
      [
        ['estimated cost', formatUsd(c.totalCost)],
        ['no-cache baseline', formatUsd(c.totalCostNoCache)],
        ['cache savings', formatUsd(c.cacheSavings)],
      ],
    ),
  );
  lines.push('');

  if (c.rows.length === 0) {
    lines.push(chalk.dim('no priced events in window'));
  } else {
    lines.push(chalk.bold('By model'));
    lines.push(
      renderTable(
        ['model', 'total', 'input', 'cached', 'output', 'reasoning', '$/1M', 'events'],
        c.rows.map((r) => [
          r.model,
          formatUsd(r.totalCost),
          formatUsd(r.inputCost),
          formatUsd(r.cachedInputCost),
          formatUsd(r.outputCost),
          formatUsd(r.reasoningCost),
          formatUsd(r.blendedRatePerMillion),
          formatNumber(r.events),
        ]),
      ),
    );
  }

  if (c.unknownModels.length > 0) {
    lines.push('');
    lines.push(chalk.yellow.bold('Unpriced models (add to ~/.config/pew-insights/rates.json)'));
    lines.push(
      renderTable(
        ['model', 'tokens', 'events'],
        c.unknownModels.map((u) => [u.model, formatTokens(u.totalTokens), formatNumber(u.events)]),
      ),
    );
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Trend
// ---------------------------------------------------------------------------

export function formatPct(pct: number | null): string {
  if (pct === null) return 'n/a';
  const sign = pct > 0 ? '+' : '';
  return `${sign}${(pct * 100).toFixed(1)}%`;
}

function deltaCell(d: DeltaWindow): string {
  const arrow = d.delta > 0 ? chalk.green('▲') : d.delta < 0 ? chalk.red('▼') : chalk.dim('•');
  const pctStr = d.pct === null ? chalk.dim('n/a') : (d.pct >= 0 ? chalk.green : chalk.red)(formatPct(d.pct));
  return `${formatTokens(d.current)}  vs  ${formatTokens(d.previous)}  ${arrow} ${pctStr}`;
}

export function renderTrend(t: TrendReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights trend'));
  lines.push(chalk.dim(`as of: ${t.asOf}`));
  lines.push('');
  lines.push(
    renderTable(
      ['window', 'current vs previous'],
      [
        ['day-over-day (24h)', deltaCell(t.dod)],
        ['week-over-week (7d)', deltaCell(t.wow)],
      ],
    ),
  );
  lines.push('');
  lines.push(chalk.bold(`Daily tokens (${t.series.length}d)`));
  lines.push(`  ${chalk.cyan(t.sparkline)}`);
  lines.push(
    `  ${chalk.dim(t.series[0]?.day ?? '')}` +
      ' '.repeat(Math.max(1, t.series.length - (t.series[0]?.day.length ?? 10) - (t.series.at(-1)?.day.length ?? 10))) +
      `${chalk.dim(t.series.at(-1)?.day ?? '')}`,
  );
  lines.push('');
  if (t.byModel.length > 0) {
    lines.push(chalk.bold('By model (current half vs previous half)'));
    lines.push(
      renderTable(
        ['model', 'current', 'previous', 'Δ%', 'spark'],
        t.byModel.map((m) => [
          m.model,
          formatTokens(m.current),
          formatTokens(m.previous),
          formatPct(m.pct),
          m.sparkline,
        ]),
      ),
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Top projects
// ---------------------------------------------------------------------------

export function renderTopProjects(t: TopProjectsResult, opts: { showPaths?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights top-projects'));
  lines.push(
    chalk.dim(
      `since: ${t.since ?? 'all'}    attributed: ${formatTokens(t.totalTokens)}    unattributed: ${formatTokens(t.unattributedTokens)}    resolved: ${t.resolvedCount}/${t.resolvedCount + t.unresolvedCount}`,
    ),
  );
  lines.push('');
  if (t.rows.length === 0) {
    lines.push(chalk.dim('no projects in window'));
    return lines.join('\n');
  }
  const headers = opts.showPaths
    ? ['#', 'project_ref', 'tokens', 'share', 'basename', 'path']
    : ['#', 'project_ref', 'tokens', 'share', 'basename'];
  const rows = t.rows.map((r) => {
    const base = r.basename ?? chalk.dim('(unresolved)');
    const cols = [
      String(r.rank),
      r.projectRef,
      formatTokens(r.totalTokens),
      (r.share * 100).toFixed(1) + '%',
      base,
    ];
    if (opts.showPaths) cols.push(r.path ?? chalk.dim('—'));
    return cols;
  });
  lines.push(renderTable(headers, rows));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Forecast
// ---------------------------------------------------------------------------

export function renderForecast(f: ForecastReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights forecast'));
  lines.push(
    chalk.dim(
      `as of: ${f.asOf}    lookback: ${f.lookbackDays}d    n=${f.n}    R²=${Number.isFinite(f.r2) ? f.r2.toFixed(3) : 'n/a'}`,
    ),
  );
  if (f.lowConfidence) {
    lines.push(chalk.yellow('  ⚠ low confidence: small sample or all-zero history'));
  }
  lines.push('');

  lines.push(chalk.bold('Tomorrow'));
  lines.push(
    `  ${f.tomorrow.day}: ${formatTokens(Math.round(f.tomorrow.predicted))}  (95% CI ${formatTokens(Math.round(f.tomorrow.lower))} – ${formatTokens(Math.round(f.tomorrow.upper))})`,
  );
  lines.push('');

  lines.push(chalk.bold('Week-end projection (UTC week)'));
  lines.push(
    `  observed-so-far: ${formatTokens(f.weekObserved)}  ` +
      `+ projected: ${formatTokens(Math.round(f.weekProjected - f.weekObserved))}  ` +
      `= total: ${formatTokens(Math.round(f.weekProjected))}  ` +
      `(95% CI ${formatTokens(Math.round(f.weekProjectedLower))} – ${formatTokens(Math.round(f.weekProjectedUpper))})`,
  );
  if (f.weekRemaining.length > 0) {
    lines.push('');
    lines.push(
      renderTable(
        ['day', 'predicted', 'low', 'high'],
        f.weekRemaining.map((p) => [
          p.day,
          formatTokens(Math.round(p.predicted)),
          formatTokens(Math.round(p.lower)),
          formatTokens(Math.round(p.upper)),
        ]),
      ),
    );
  }
  lines.push('');
  lines.push(
    chalk.dim(`slope: ${f.slope >= 0 ? '+' : ''}${formatTokens(Math.round(f.slope))}/day  intercept: ${formatTokens(Math.round(f.intercept))}`),
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

function statusColor(s: BudgetStatus): (s: string) => string {
  switch (s) {
    case 'under':    return chalk.green;
    case 'on-track': return chalk.cyan;
    case 'over':     return chalk.yellow;
    case 'breached': return chalk.red.bold;
  }
}

export function renderBudget(b: BudgetReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights budget'));
  lines.push(chalk.dim(`as of: ${b.asOf}    window: ${b.windowDays}d`));
  lines.push('');

  const color = statusColor(b.status);
  const pct = (b.percentOfMonthBudgetUsed * 100).toFixed(1) + '%';
  lines.push(
    renderTable(
      ['metric', 'value'],
      [
        ['daily budget', formatUsd(b.dailyBudgetUsd) + '/day'],
        ['monthly budget', formatUsd(b.monthlyBudgetUsd)],
        ['month spend so far', formatUsd(b.monthSpendUsd) + '   (' + pct + ' of monthly)'],
        ['today spend', formatUsd(b.todaySpendUsd)],
        ['daily burn (avg)', formatUsd(b.dailyBurnUsd) + '/day'],
        ['days remaining in month', String(b.daysRemainingInMonth)],
        ['ETA to monthly breach', b.etaBreachDay ?? chalk.dim('— (not within this month)')],
        ['status', color(b.status.toUpperCase())],
      ],
    ),
  );

  if (b.dailySpendSeries.length > 0) {
    lines.push('');
    lines.push(chalk.bold(`Daily spend (${b.windowDays}d window)`));
    lines.push(
      renderTable(
        ['day', 'usd'],
        b.dailySpendSeries.map((p) => [p.day, formatUsd(p.usd)]),
      ),
    );
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Compare
// ---------------------------------------------------------------------------

function hintColor(h: SignificanceHint): (s: string) => string {
  switch (h) {
    case 'significant':  return chalk.green.bold;
    case 'weak':         return chalk.yellow;
    case 'n/s':          return chalk.dim;
    case 'insufficient': return chalk.dim;
  }
}

export function renderCompare(c: CompareReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights compare'));
  lines.push(
    chalk.dim(
      `dim: ${c.dimension}    A=${c.a.label} (${c.a.from} → ${c.a.until})    B=${c.b.label} (${c.b.from} → ${c.b.until})`,
    ),
  );
  lines.push(
    chalk.dim(
      `A total: ${formatTokens(c.aTotalTokens)}    B total: ${formatTokens(c.bTotalTokens)}    Δ: ${formatTokens(c.aTotalTokens - c.bTotalTokens)}`,
    ),
  );
  lines.push('');
  if (c.rows.length === 0) {
    lines.push(chalk.dim('no rows in either window'));
    return lines.join('\n');
  }
  lines.push(
    renderTable(
      [c.dimension, `A (${c.a.label})`, `B (${c.b.label})`, 'Δ', 'Δ%', 't', 'hint'],
      c.rows.map((r) => [
        r.key,
        formatTokens(r.aTokens),
        formatTokens(r.bTokens),
        formatTokens(r.delta),
        formatPct(r.pct),
        r.t === null ? '—' : Number.isFinite(r.t) ? r.t.toFixed(2) : '∞',
        hintColor(r.hint)(r.hint),
      ]),
    ),
  );
  lines.push('');
  lines.push(chalk.dim('hint = coarse Welch-t classifier on per-day totals; not a real p-value.'));
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Anomalies
// ---------------------------------------------------------------------------

function anomalyColor(s: AnomalyStatus): (s: string) => string {
  switch (s) {
    case 'high':   return chalk.red.bold;
    case 'low':    return chalk.yellow.bold;
    case 'normal': return chalk.green;
    case 'flat':   return chalk.dim;
    case 'warmup': return chalk.dim;
  }
}

export function renderAnomalies(a: AnomaliesReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights anomalies'));
  lines.push(
    chalk.dim(
      `as of: ${a.asOf}    lookback: ${a.lookbackDays}d    baseline: ${a.baselineDays}d    threshold: |z| ≥ ${a.threshold.toFixed(1)}`,
    ),
  );
  lines.push('');

  if (a.series.length === 0) {
    lines.push(chalk.dim('no scored days in window'));
    return lines.join('\n');
  }

  const flaggedCount = a.flagged.length;
  if (flaggedCount === 0) {
    lines.push(chalk.green(`✓ no anomalies in last ${a.lookbackDays}d`));
  } else {
    const high = a.flagged.filter((d) => d.status === 'high').length;
    const low = a.flagged.filter((d) => d.status === 'low').length;
    lines.push(
      chalk.bold(`Flagged: ${flaggedCount}`) +
        chalk.dim(`  (${high} high, ${low} low)`),
    );
  }
  if (a.recentHigh) {
    lines.push(chalk.red.bold('  ⚠ most recent day flagged HIGH'));
  }
  lines.push('');

  lines.push(
    renderTable(
      ['day', 'tokens', 'baseline', 'σ', 'z', 'status'],
      a.series.map((d) => [
        d.day,
        formatTokens(d.tokens),
        d.baselineMean == null ? '—' : formatTokens(Math.round(d.baselineMean)),
        d.baselineStdDev == null ? '—' : formatTokens(Math.round(d.baselineStdDev)),
        d.z == null ? '—' : (d.z >= 0 ? '+' : '') + d.z.toFixed(2),
        anomalyColor(d.status)(d.status),
      ]),
    ),
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Ratios (cache-hit-ratio drift)
// ---------------------------------------------------------------------------

function ratioColor(s: RatioStatus): (s: string) => string {
  switch (s) {
    case 'high':      return chalk.green.bold;  // cache-hit climbed = good news
    case 'low':       return chalk.red.bold;    // cache-hit dropped = bad news
    case 'normal':    return chalk.green;
    case 'flat':      return chalk.dim;
    case 'warmup':    return chalk.dim;
    case 'undefined': return chalk.dim;
  }
}

function formatRatio(r: number | null): string {
  if (r == null) return '—';
  return (r * 100).toFixed(2) + '%';
}

export function renderRatios(r: RatiosReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights ratios (cache-hit drift)'));
  lines.push(
    chalk.dim(
      `as of: ${r.asOf}    lookback: ${r.lookbackDays}d    α: ${r.alpha.toFixed(2)}    baseline: ${r.baselineDays}d    threshold: |z| ≥ ${r.threshold.toFixed(1)}`,
    ),
  );
  lines.push('');

  if (r.series.length === 0) {
    lines.push(chalk.dim('no days in window'));
    return lines.join('\n');
  }

  if (r.currentEwma != null) {
    lines.push(
      chalk.bold(`Current cache-hit EWMA: ${formatRatio(r.currentEwma)}`),
    );
  } else {
    lines.push(chalk.dim('no defined ratios in window (no input_tokens)'));
  }

  const high = r.flagged.filter((d) => d.status === 'high').length;
  const low = r.flagged.filter((d) => d.status === 'low').length;
  if (r.flagged.length === 0) {
    lines.push(chalk.green(`✓ no drift in last ${r.lookbackDays}d`));
  } else {
    lines.push(
      chalk.bold(`Flagged: ${r.flagged.length}`) +
        chalk.dim(`  (${high} high, ${low} low)`),
    );
  }
  if (r.recentHigh) {
    lines.push(chalk.green.bold('  ⬆ most recent day flagged HIGH (cache-hit climbed)'));
  } else if (r.recentLow) {
    lines.push(chalk.red.bold('  ⬇ most recent day flagged LOW (cache-hit dropped)'));
  }
  lines.push('');

  lines.push(
    renderTable(
      ['day', 'ratio', 'ewma', 'baseline', 'σ(logit)', 'z', 'status'],
      r.series.map((d) => [
        d.day,
        formatRatio(d.ratio),
        formatRatio(d.ewma),
        d.baselineLogitMean == null
          ? '—'
          : formatRatio(1 / (1 + Math.exp(-d.baselineLogitMean))),
        d.baselineLogitStdDev == null ? '—' : d.baselineLogitStdDev.toFixed(3),
        d.z == null ? '—' : (d.z >= 0 ? '+' : '') + d.z.toFixed(2),
        ratioColor(d.status)(d.status),
      ]),
    ),
  );
  return lines.join('\n');
}
