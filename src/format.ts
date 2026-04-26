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
import type { DashboardReport } from './dashboard.js';
import { HEATMAP_DOW_LABELS, type HeatmapReport } from './heatmap.js';
import type { StreaksReport } from './streaks.js';
import type { SessionsReport } from './sessions.js';
import type { GapsReport } from './gaps.js';
import type { VelocityReport, VelocityStretch } from './velocity.js';
import type { ConcurrencyReport } from './concurrency.js';
import type { TransitionsReport } from './transitions.js';
import type { AgentMixReport } from './agentmix.js';
import type { SessionLengthsReport } from './sessionlengths.js';
import type { ModelTenureReport } from './modeltenure.js';
import type { ProviderTenureReport } from './providertenure.js';
import type { TailShareReport } from './tailshare.js';
import type { TenureDensityQuadrantReport } from './tenuredensityquadrant.js';
import type { SourceTenureReport } from './sourcetenure.js';
import type { BucketStreakLengthReport } from './bucketstreaklength.js';
import type { BucketGapDistributionReport } from './bucketgapdistribution.js';
import type { SourceDecayHalfLifeReport } from './sourcedecayhalflife.js';
import type { BucketHandoffFrequencyReport } from './buckethandofffrequency.js';
import type { InterSourceHandoffLatencyReport } from './intersourcehandofflatency.js';
import type { SourcePairCooccurrenceReport } from './sourcepaircooccurrence.js';
import type { ProviderSwitchingFrequencyReport } from './providerswitchingfrequency.js';
import type { FirstBucketOfDayReport } from './firstbucketofday.js';
import type { LastBucketOfDayReport } from './lastbucketofday.js';
import type { ActiveSpanPerDayReport } from './activespanperday.js';
import type { SourceBreadthPerDayReport } from './sourcebreadthperday.js';
import type { BucketDensityPercentileReport } from './bucketdensitypercentile.js';
import type { HourOfWeekReport } from './hourofweek.js';
import type { DeviceTenureReport } from './devicetenure.js';
import type { OutputTokenDecileDistributionReport } from './outputtokendeciledistribution.js';
import type { InputTokenDecileDistributionReport } from './inputtokendeciledistribution.js';
import type { SourceTokenMassHourCentroidReport } from './sourcetokenmasshourcentroid.js';
import type { SourceDayOfWeekTokenMassShareReport } from './sourcedayofweektokenmassshare.js';
import { dowName as dowNameFmt } from './sourcedayofweektokenmassshare.js';
import type { SourceDeadHourCountReport } from './sourcedeadhourcount.js';
import type { SourceActiveHourLongestRunReport } from './sourceactivehourlongestrun.js';
import type { SourceHourEntropyReport } from './sourcehourofdaytokenmassentropy.js';
import type { DailyTokenGiniReport } from './dailytokenginicoefficient.js';
import type { SourceHourTopKMassShareReport } from './sourcehourofdaytopkmassshare.js';
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

// ---------------------------------------------------------------------------
// Dashboard (composite operator view: status + anomalies + ratios + drift)
// ---------------------------------------------------------------------------

function formatPctSigned(n: number | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + '%';
}

function formatPctPointsSigned(n: number | null): string {
  if (n == null) return '—';
  const sign = n >= 0 ? '+' : '';
  return sign + n.toFixed(2) + 'pp';
}

/**
 * One-screen operator dashboard. Sections are deliberately compact so the
 * whole report stays under ~24 terminal rows for a typical pew-home — the
 * detailed views (`status`, `anomalies`, `ratios`) remain available as
 * separate subcommands when an operator wants to drill in.
 *
 * Section order is intentional: queue health first (is the pipeline
 * actually flowing?), then volume drift (are we burning more tokens than
 * usual?), then ratio drift (is the cache holding up?). Health → volume →
 * efficiency mirrors how an SRE would triage from coarse to fine.
 */
export function renderDashboard(d: DashboardReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights dashboard'));
  lines.push(chalk.dim(`as of: ${d.asOf}    pew home: ${d.status.pewHome}`));
  lines.push('');

  // --- Health row ---------------------------------------------------------
  lines.push(chalk.bold('Health'));
  const lockState = d.status.trailingLockHolder
    ? d.status.trailingLockAlive === false
      ? chalk.red('STALE')
      : chalk.green('alive')
    : chalk.dim('none');
  lines.push(
    renderTable(
      ['field', 'value'],
      [
        ['queue pending', `${formatBytes(d.status.pendingQueueBytes)} (${formatNumber(d.status.pendingQueueLines)} lines)`],
        ['session-queue pending', formatBytes(d.status.pendingSessionQueueBytes)],
        ['last success', `${d.status.lastSuccess ?? chalk.dim('never')} (${formatDuration(d.status.lastSuccessAgeSeconds)})`],
        ['trailing.lock', lockState],
        ['runs/ count', formatNumber(d.status.runsCountApprox)],
        ['lagging files', String(d.status.lagFiles.length)],
      ],
    ),
  );
  lines.push('');

  // --- Volume row ---------------------------------------------------------
  lines.push(chalk.bold('Volume (daily token totals)'));
  if (d.recentAnomaly == null) {
    lines.push(chalk.dim('  no scored days in window (warmup)'));
  } else {
    const a = d.recentAnomaly;
    const statusStr = anomalyColor(a.status)(a.status);
    const zStr = a.z == null ? '—' : (a.z >= 0 ? '+' : '') + a.z.toFixed(2);
    lines.push(
      renderTable(
        ['field', 'value'],
        [
          ['most recent day', a.day],
          ['tokens', formatTokens(a.tokens)],
          ['baseline mean', a.baselineMean == null ? '—' : formatTokens(Math.round(a.baselineMean))],
          ['drift vs baseline', formatPctSigned(d.tokenDriftPct)],
          ['z-score', zStr],
          ['status', statusStr],
          ['flagged in window', `${d.anomalies.flagged.length} (${d.anomalies.flagged.filter((x) => x.status === 'high').length} high, ${d.anomalies.flagged.filter((x) => x.status === 'low').length} low)`],
        ],
      ),
    );
    if (d.anomalies.recentHigh) {
      lines.push(chalk.red.bold('  ⚠ most recent day flagged HIGH'));
    }
  }
  lines.push('');

  // --- Efficiency row -----------------------------------------------------
  lines.push(chalk.bold('Efficiency (cache-hit ratio drift)'));
  if (d.recentRatio == null) {
    lines.push(chalk.dim('  no ratio days in window'));
  } else {
    const r = d.recentRatio;
    const statusStr = ratioColor(r.status)(r.status);
    const zStr = r.z == null ? '—' : (r.z >= 0 ? '+' : '') + r.z.toFixed(2);
    const baselineProb =
      r.baselineLogitMean == null
        ? null
        : 1 / (1 + Math.exp(-r.baselineLogitMean));
    lines.push(
      renderTable(
        ['field', 'value'],
        [
          ['current EWMA', formatRatio(d.ratios.currentEwma)],
          ['most recent day', r.day],
          ['day ratio', formatRatio(r.ratio)],
          ['day EWMA', formatRatio(r.ewma)],
          ['baseline EWMA', formatRatio(baselineProb)],
          ['drift vs baseline', formatPctPointsSigned(d.ratioDriftPctPoints)],
          ['z-score (logit)', zStr],
          ['status', statusStr],
          ['flagged in window', `${d.ratios.flagged.length} (${d.ratios.flagged.filter((x) => x.status === 'high').length} high, ${d.ratios.flagged.filter((x) => x.status === 'low').length} low)`],
        ],
      ),
    );
    if (d.ratios.recentHigh) {
      lines.push(chalk.green.bold('  ⬆ cache-hit climbed (HIGH)'));
    } else if (d.ratios.recentLow) {
      lines.push(chalk.red.bold('  ⬇ cache-hit dropped (LOW)'));
    }
  }
  lines.push('');

  // --- Footer alert summary ----------------------------------------------
  if (d.alerting) {
    lines.push(chalk.red.bold('ALERT — see flagged sections above'));
  } else {
    lines.push(chalk.green('✓ no alerts'));
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Heatmap
// ---------------------------------------------------------------------------

/**
 * Map a normalised intensity in [0, 1] to a Unicode block + chalk
 * color. Six bins: empty, low, low-mid, mid, mid-high, high. We use
 * the partial-block characters (▁..█) so the column width stays at
 * one cell per cell — important for the 24-wide grid to fit on a
 * standard 80-col terminal.
 *
 * Empty cells render as a centered dim dot to make zero-vs-low
 * obvious; the eye should read "nothing happened here", not "low".
 */
function heatmapGlyph(norm: number): string {
  if (!Number.isFinite(norm) || norm <= 0) return chalk.dim('·');
  if (norm < 0.10) return chalk.blue('▁');
  if (norm < 0.25) return chalk.cyan('▂');
  if (norm < 0.45) return chalk.green('▄');
  if (norm < 0.65) return chalk.yellow('▅');
  if (norm < 0.85) return chalk.magenta('▇');
  return chalk.red('█');
}

export function renderHeatmap(h: HeatmapReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights heatmap'));
  lines.push(
    chalk.dim(
      `as of: ${h.asOf}    window: ${h.windowStart} → ${h.windowEnd} (${h.lookbackDays}d)    metric: ${h.metric}    tz: ${h.tz}    events: ${formatNumber(h.events)}`,
    ),
  );
  lines.push('');

  if (h.grandTotal === 0) {
    lines.push(chalk.dim('  (no token activity in window)'));
    return lines.join('\n');
  }

  // Find the per-cell max so we can normalise. We deliberately
  // normalise against the grid max (not the row or col max) so the
  // glyph intensity is a global ranking — easier to read at a glance
  // than a per-row palette.
  let cellMax = 0;
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 24; c++) {
      const v = h.cells[r]![c]!;
      if (v > cellMax) cellMax = v;
    }
  }

  // Header row: hour labels 00..23, single-char to fit grid pitch.
  // We tag every 6 hours bold so the eye can find quartiles without
  // counting columns.
  const hourLabel = (n: number): string => {
    const s = String(n).padStart(2, '0').slice(-1); // last digit
    return n % 6 === 0 ? chalk.bold(s) : s;
  };
  const hourHeader = '     ' + Array.from({ length: 24 }, (_, i) => hourLabel(i)).join(' ');
  lines.push(hourHeader);
  lines.push('     ' + chalk.dim('─'.repeat(24 * 2 - 1)));

  for (let r = 0; r < 7; r++) {
    const label = chalk.bold(HEATMAP_DOW_LABELS[r]);
    const cells = h.cells[r]!;
    const glyphs = cells.map((v) => heatmapGlyph(v / cellMax)).join(' ');
    const rowTotal = formatTokens(h.rowTotals[r]!).padStart(7);
    lines.push(`  ${label}  ${glyphs}  ${chalk.dim(rowTotal)}`);
  }
  lines.push('     ' + chalk.dim('─'.repeat(24 * 2 - 1)));

  // Column totals row — abbreviated single-char K/M scale so the
  // 1-char-per-cell pitch is preserved. We show the order of
  // magnitude only; the JSON output has the precise numbers.
  const colDigit = (n: number): string => {
    if (n <= 0) return chalk.dim('·');
    if (n < 1_000) return chalk.dim('·');
    if (n < 10_000) return chalk.dim('K');
    if (n < 100_000) return chalk.cyan('K');
    if (n < 1_000_000) return chalk.green('K');
    if (n < 10_000_000) return chalk.yellow('M');
    if (n < 100_000_000) return chalk.magenta('M');
    return chalk.red('B');
  };
  const colMagnitudes = h.colTotals.map((v) => colDigit(v)).join(' ');
  lines.push(`  ${chalk.dim('mag')}  ${colMagnitudes}  ${chalk.dim('total')}`);
  lines.push('');

  // Summary block.
  const peakCellStr =
    h.peakCell == null
      ? '—'
      : `${HEATMAP_DOW_LABELS[h.peakCell.dow - 1]} ${String(h.peakCell.hour).padStart(2, '0')}:00 (${formatTokens(h.peakCell.tokens)})`;
  const peakDowStr = h.peakDow == null ? '—' : HEATMAP_DOW_LABELS[h.peakDow - 1]!;
  const peakHourStr = h.peakHour == null ? '—' : `${String(h.peakHour).padStart(2, '0')}:00`;
  const diurnalStr =
    h.diurnalConcentration == null
      ? '—'
      : `${(h.diurnalConcentration * 100).toFixed(1)}%  (uniform: 16.7%)`;
  const weeklyStr =
    h.weeklyConcentration == null
      ? '—'
      : `${(h.weeklyConcentration * 100).toFixed(1)}%  (uniform: 28.6%)`;

  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['grand total', formatTokens(h.grandTotal)],
        ['peak cell', peakCellStr],
        ['peak day', peakDowStr],
        ['peak hour', peakHourStr],
        ['top-4-hr share', diurnalStr],
        ['top-2-day share', weeklyStr],
      ],
    ),
  );
  return lines.join('\n');
}

export function renderStreaks(s: StreaksReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights streaks'));
  lines.push(
    chalk.dim(
      `as of: ${s.asOf}    window: ${s.windowStart} → ${s.windowEnd} (${s.lookbackDays}d)    minTokens: ${formatNumber(s.minTokens)}`,
    ),
  );
  lines.push('');

  // Cadence strip — one glyph per day in chronological order.
  // ' ' = idle, '█' = active. Color the *current* run so the
  // operator's eye lands on "where am I right now".
  const dayGlyphs: string[] = [];
  for (const r of s.runs) {
    const glyph = r.state === 'active' ? '█' : '·';
    const colored =
      r === s.currentRun
        ? r.state === 'active'
          ? chalk.green(glyph)
          : chalk.red(glyph)
        : r.state === 'active'
          ? chalk.cyan(glyph)
          : chalk.dim(glyph);
    for (let i = 0; i < r.length; i++) dayGlyphs.push(colored);
  }
  // Wrap to 50 chars/row so a 90-day window stays inside an 80-col TTY.
  const stripWidth = 50;
  for (let i = 0; i < dayGlyphs.length; i += stripWidth) {
    lines.push('  ' + dayGlyphs.slice(i, i + stripWidth).join(''));
  }
  lines.push('  ' + chalk.dim(`oldest → newest    █ active   · idle    (current run colored)`));
  lines.push('');

  // Summary table.
  const fmtRun = (r: typeof s.longestActive): string => {
    if (r == null) return '—';
    if (r.length === 1) return `${r.startDay} (1 day)`;
    return `${r.startDay} → ${r.endDay} (${r.length} days)`;
  };
  const currentRunStr =
    s.currentRun.state === 'active'
      ? `${s.currentRun.length}-day active streak (since ${s.currentRun.startDay})`
      : `${s.currentRun.length}-day idle gap (since ${s.currentRun.startDay})`;
  const median = s.medianActiveLength;
  const mean = s.meanActiveLength;

  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['active days', `${formatNumber(s.activeDays)} / ${formatNumber(s.lookbackDays)}  (${(s.activeFraction * 100).toFixed(1)}%)`],
        ['idle days', formatNumber(s.idleDays)],
        ['active runs', formatNumber(s.activeRunCount)],
        ['longest active', fmtRun(s.longestActive)],
        ['longest idle gap', fmtRun(s.longestIdle)],
        ['current', currentRunStr],
        ['median active run', median == null ? '—' : `${median} days`],
        ['mean active run', mean == null ? '—' : `${mean.toFixed(2)} days`],
      ],
    ),
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

function formatDurSeconds(s: number | null): string {
  if (s == null) return '—';
  if (s < 60) return `${s}s`;
  if (s < 3600) {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return sec === 0 ? `${m}m` : `${m}m${sec}s`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

function shortKey(k: string, max = 24): string {
  if (k.length <= max) return k;
  return k.slice(0, max - 1) + '…';
}

export function renderSessions(r: SessionsReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights sessions'));
  const win =
    r.since == null && r.until == null
      ? 'all time'
      : `${r.since ?? '—'} → ${r.until ?? 'now'}`;
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    window: ${win}    by: ${r.by}    minDuration: ${r.minDurationSeconds}s`,
    ),
  );
  lines.push('');

  if (r.totalSessions === 0) {
    lines.push(chalk.yellow('  no sessions match the current window/filter.'));
    return lines.join('\n');
  }

  // Top-line totals.
  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['total sessions', formatNumber(r.totalSessions)],
        ['total wall-clock', formatDurSeconds(r.totalDurationSeconds)],
        ['total messages', formatNumber(r.totalMessages)],
        [
          'longest session',
          r.longestSession == null
            ? '—'
            : `${formatDurSeconds(r.longestSession.durationSeconds)}  (${r.longestSession.source}/${r.longestSession.kind}, started ${r.longestSession.startedAt.slice(0, 16)}Z)`,
        ],
        [
          'chattiest session',
          r.chattiestSession == null
            ? '—'
            : `${formatNumber(r.chattiestSession.totalMessages)} msgs  (${r.chattiestSession.source}/${r.chattiestSession.kind}, started ${r.chattiestSession.startedAt.slice(0, 16)}Z)`,
        ],
      ],
    ),
  );
  lines.push('');

  // Distribution stats — duration first, then messages, both 5-stat.
  lines.push(chalk.bold('duration distribution (per session)'));
  lines.push(
    renderTable(
      ['stat', 'value'],
      [
        ['min', formatDurSeconds(r.durationStats.min)],
        ['median', formatDurSeconds(r.durationStats.median == null ? null : Math.round(r.durationStats.median))],
        ['mean', formatDurSeconds(r.durationStats.mean == null ? null : Math.round(r.durationStats.mean))],
        ['p95', formatDurSeconds(r.durationStats.p95)],
        ['max', formatDurSeconds(r.durationStats.max)],
      ],
    ),
  );
  lines.push('');

  lines.push(chalk.bold('messages distribution (per session)'));
  lines.push(
    renderTable(
      ['stat', 'value'],
      [
        ['min', r.messageStats.min == null ? '—' : formatNumber(r.messageStats.min)],
        ['median', r.messageStats.median == null ? '—' : (Math.round(r.messageStats.median * 10) / 10).toString()],
        ['mean', r.messageStats.mean == null ? '—' : r.messageStats.mean.toFixed(2)],
        ['p95', r.messageStats.p95 == null ? '—' : formatNumber(r.messageStats.p95)],
        ['max', r.messageStats.max == null ? '—' : formatNumber(r.messageStats.max)],
      ],
    ),
  );
  lines.push('');

  // Top-N grouped breakdown.
  const heading = `top ${Math.min(r.topN, r.topGroups.length)} of ${r.groupCardinality} ${r.by} value(s)`;
  lines.push(chalk.bold(heading));
  if (r.topGroups.length === 0) {
    lines.push(chalk.dim('  (no groups)'));
  } else {
    lines.push(
      renderTable(
        [r.by, 'sessions', 'wall-clock', 'msgs', 'median dur'],
        r.topGroups.map((g) => [
          shortKey(g.key),
          formatNumber(g.sessions),
          formatDurSeconds(g.totalDurationSeconds),
          formatNumber(g.totalMessages),
          formatDurSeconds(Math.round(g.medianDurationSeconds)),
        ]),
      ),
    );
  }

  return lines.join('\n');
}

export function renderGaps(r: GapsReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights gaps'));
  const win =
    r.since == null && r.until == null
      ? 'all time'
      : `${r.since ?? '—'} → ${r.until ?? 'now'}`;
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    window: ${win}    quantile: ${r.quantile}    minGap: ${r.minGapSeconds}s    top: ${r.topN}`,
    ),
  );
  lines.push('');

  if (r.totalGaps === 0) {
    lines.push(
      chalk.yellow(
        `  need >= 2 sessions to measure gaps (got ${r.totalSessions}).`,
      ),
    );
    return lines.join('\n');
  }

  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['sessions in window', formatNumber(r.totalSessions)],
        ['adjacent gaps', formatNumber(r.totalGaps)],
        [
          'threshold (nearest-rank)',
          r.thresholdSeconds == null ? '—' : formatDurSeconds(r.thresholdSeconds),
        ],
        [
          'median gap',
          r.medianGapSeconds == null
            ? '—'
            : formatDurSeconds(Math.round(r.medianGapSeconds)),
        ],
        ['max gap', formatDurSeconds(r.maxGapSeconds)],
        ['gaps tied at threshold', formatNumber(r.gapsAtThreshold)],
        ['flagged', formatNumber(r.flagged.length)],
      ],
    ),
  );
  lines.push('');

  if (r.flagged.length === 0) {
    lines.push(chalk.dim('  no gaps strictly exceeded the threshold.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`flagged gaps (>${formatDurSeconds(r.thresholdSeconds)}, gap_seconds desc)`));
  lines.push(
    renderTable(
      ['gap', 'qrank', 'before (last_msg)', 'after (started)', 'src/kind'],
      r.flagged.map((g) => [
        formatDurSeconds(g.gapSeconds),
        // Percentile rendering with 1 decimal so the operator can
        // distinguish "barely past threshold" (e.g. 90.2%) from a
        // true outlier (99.9%); the prior 2-decimal fraction
        // collapsed everything in a long tail to a flat "1.00".
        `${(g.quantileRank * 100).toFixed(1)}%`,
        g.before.lastMessageAt.slice(0, 16) + 'Z',
        g.after.startedAt.slice(0, 16) + 'Z',
        `${g.before.source}/${g.before.kind} → ${g.after.source}/${g.after.kind}`,
      ]),
    ),
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// velocity
// ---------------------------------------------------------------------------

function formatRate(tpm: number): string {
  // Tokens-per-minute. Compact for large values, decimals for small.
  if (!Number.isFinite(tpm) || tpm <= 0) return '0/min';
  if (tpm >= 10000) return `${(tpm / 1000).toFixed(1)}K/min`;
  if (tpm >= 100) return `${Math.round(tpm)}/min`;
  if (tpm >= 10) return `${tpm.toFixed(1)}/min`;
  return `${tpm.toFixed(2)}/min`;
}

function formatStretchSpan(s: VelocityStretch): string {
  const start = s.startHour.slice(0, 13) + 'Z';
  if (s.hours === 1) return start;
  const end = s.endHour.slice(0, 13) + 'Z';
  return `${start} → ${end}`;
}

export function renderVelocity(r: VelocityReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights velocity'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    window: ${r.windowStart.slice(0, 13)}Z → ${r.windowEnd.slice(0, 13)}Z    lookback: ${r.lookbackHours}h    minTokens/h: ${r.minTokensPerHour}    top: ${r.topN}`,
    ),
  );
  lines.push('');

  if (r.stretchCount === 0) {
    lines.push(
      chalk.yellow(
        `  no active hours in the last ${r.lookbackHours}h (>= ${r.minTokensPerHour} tokens). nothing to measure.`,
      ),
    );
    return lines.join('\n');
  }

  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['active hours', formatNumber(r.totalActiveHours)],
        ['active stretches', formatNumber(r.stretchCount)],
        ['active tokens (sum)', formatTokens(r.totalActiveTokens)],
        ['avg velocity (active)', formatRate(r.averageTokensPerMinute)],
        [
          'median stretch velocity',
          r.medianTokensPerMinute == null ? '—' : formatRate(r.medianTokensPerMinute),
        ],
        [
          'peak stretch',
          r.peakStretch == null
            ? '—'
            : `${formatRate(r.peakStretch.tokensPerMinute)}  (${r.peakStretch.hours}h, ${formatTokens(r.peakStretch.tokens)} tokens, ${formatStretchSpan(r.peakStretch)})`,
        ],
        [
          'longest stretch',
          r.longestStretch == null
            ? '—'
            : `${r.longestStretch.hours}h  (${formatRate(r.longestStretch.tokensPerMinute)}, ${formatTokens(r.longestStretch.tokens)} tokens, ${formatStretchSpan(r.longestStretch)})`,
        ],
      ],
    ),
  );
  lines.push('');

  lines.push(chalk.bold(`top stretches (tokens/min desc, top ${r.topN})`));
  lines.push(
    renderTable(
      ['span', 'hours', 'idle-before', 'tokens', 'in/out', 'rate'],
      r.topStretches.map((s) => [
        formatStretchSpan(s),
        String(s.hours),
        s.idleHoursBefore === 0 ? '—' : `${s.idleHoursBefore}h`,
        formatTokens(s.tokens),
        `${formatTokens(s.inputTokens)} / ${formatTokens(s.outputTokens)}`,
        formatRate(s.tokensPerMinute),
      ]),
    ),
  );

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// concurrency
// ---------------------------------------------------------------------------

function formatMs(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${(s / 3600).toFixed(1)}h`;
  return `${(s / 86400).toFixed(1)}d`;
}

function formatPercent(f: number): string {
  if (!Number.isFinite(f)) return '—';
  return `${(f * 100).toFixed(1)}%`;
}

export function renderConcurrency(r: ConcurrencyReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights concurrency'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    window: ${r.windowStart} → ${r.windowEnd}    span: ${formatMs(r.windowMs)}    sessions: ${formatNumber(r.consideredSessions)} considered, ${formatNumber(r.skippedSessions)} skipped    top: ${r.topN}`,
    ),
  );
  lines.push('');

  if (r.consideredSessions === 0 || r.windowMs === 0) {
    lines.push(
      chalk.yellow(
        `  no overlapping sessions in the window. nothing to measure.`,
      ),
    );
    return lines.join('\n');
  }

  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['peak concurrency', formatNumber(r.peakConcurrency)],
        ['peak first seen', r.peakAt ?? '—'],
        ['peak total time', formatMs(r.peakDurationMs)],
        ['avg concurrency', r.averageConcurrency.toFixed(2)],
        ['p95 concurrency', formatNumber(r.p95Concurrency)],
        ['coverage (>=1 open)', formatPercent(r.coverage)],
      ],
    ),
  );
  lines.push('');

  if (r.peakSessions.length > 0) {
    lines.push(chalk.bold(`sessions open at peak (${r.peakSessions.length} of ${r.peakConcurrency})`));
    lines.push(
      renderTable(
        ['session_key', 'source', 'kind', 'started_at', 'ended_at'],
        r.peakSessions.map((s) => [
          s.sessionKey.length > 16 ? s.sessionKey.slice(0, 13) + '…' : s.sessionKey,
          s.source,
          s.kind,
          s.startedAt,
          s.endedAt,
        ]),
      ),
    );
    lines.push('');
  }

  lines.push(chalk.bold('concurrency histogram (time spent at each level)'));
  lines.push(
    renderTable(
      ['level', 'time', 'share'],
      r.histogram.map((b) => [String(b.level), formatMs(b.totalMs), formatPercent(b.fraction)]),
    ),
  );

  return lines.join('\n');
}

export function renderTransitions(r: TransitionsReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights transitions'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    max-gap: ${r.maxGapSeconds}s    sessions: ${formatNumber(r.consideredSessions)}    pairs: ${formatNumber(r.adjacentPairs)} (${formatNumber(r.handoffs)} handoffs, ${formatNumber(r.breaks)} breaks, ${formatNumber(r.overlaps)} overlaps)    top: ${r.topN}`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.handoffs === 0) {
    lines.push(chalk.yellow('  no handoffs in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['groups observed', String(r.groups.length)],
        ['handoff rate', formatPercent(r.adjacentPairs === 0 ? 0 : r.handoffs / r.adjacentPairs)],
        ['overall median gap', formatMs(r.overallMedianGapMs)],
        ['overall p95 gap', formatMs(r.overallP95GapMs)],
      ],
    ),
  );
  lines.push('');

  lines.push(chalk.bold(`top transitions (${r.topTransitions.length} of ${r.handoffs} handoffs)`));
  lines.push(
    renderTable(
      ['from', 'to', 'count', 'median gap', 'p95 gap', 'overlaps'],
      r.topTransitions.map((c) => [
        c.from,
        c.to,
        formatNumber(c.count),
        formatMs(c.medianGapMs),
        formatMs(c.p95GapMs),
        formatNumber(c.overlapCount),
      ]),
    ),
  );
  lines.push('');

  lines.push(chalk.bold('stickiness (P(next = same group | from group))'));
  lines.push(
    renderTable(
      ['group', 'outgoing', 'self-loop', 'stickiness'],
      r.stickiness.map((s) => [
        s.group,
        formatNumber(s.outgoing),
        formatNumber(s.selfLoop),
        s.stickiness === null ? '—' : formatPercent(s.stickiness),
      ]),
    ),
  );

  return lines.join('\n');
}

export function renderAgentMix(r: AgentMixReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights agent-mix'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    metric: ${r.metric}    events: ${formatNumber(r.consideredEvents)}    tokens: ${formatNumber(r.totalTokens)}    groups: ${r.groupCount}    top: ${r.topN}`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.totalTokens === 0 || r.groupCount === 0) {
    lines.push(chalk.yellow('  no token activity in the window. nothing to chart.'));
    return lines.join('\n');
  }

  const uniformHHI = 1 / r.groupCount;
  lines.push(
    renderTable(
      ['summary', 'value'],
      [
        ['HHI (concentration)', `${r.hhi.toFixed(4)} (uniform = ${uniformHHI.toFixed(4)})`],
        ['Gini coefficient', r.gini.toFixed(4)],
        ['top-half share', formatPercent(r.topHalfShare)],
      ],
    ),
  );
  lines.push('');

  lines.push(chalk.bold(`top groups (${r.topGroups.length} of ${r.groupCount})`));
  lines.push(
    renderTable(
      ['group', 'tokens', 'share', 'events', 'active hours'],
      r.topGroups.map((g) => [
        g.group,
        formatNumber(g.tokens),
        formatPercent(g.share),
        formatNumber(g.events),
        formatNumber(g.activeHours),
      ]),
    ),
  );

  return lines.join('\n');
}

function fmtDur(sec: number): string {
  if (sec === 0) return '0s';
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) {
    const m = sec / 60;
    return Number.isInteger(m) ? `${m}m` : `${m.toFixed(1)}m`;
  }
  const h = sec / 3600;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
}

export type SessionLengthsUnit = 'auto' | 'seconds' | 'minutes' | 'hours';

function fmtDurUnit(sec: number, unit: SessionLengthsUnit): string {
  if (unit === 'auto') return fmtDur(sec);
  if (unit === 'seconds') return `${sec.toFixed(0)}s`;
  if (unit === 'minutes') {
    const m = sec / 60;
    return `${(Number.isInteger(m) ? m : Number(m.toFixed(2))).toString()}m`;
  }
  // hours
  const h = sec / 3600;
  return `${(Number.isInteger(h) ? h : Number(h.toFixed(3))).toString()}h`;
}

export function renderSessionLengths(
  r: SessionLengthsReport,
  opts: { unit?: SessionLengthsUnit } = {},
): string {
  const unit: SessionLengthsUnit = opts.unit ?? 'auto';
  const fd = (s: number) => fmtDurUnit(s, unit);
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights session-lengths'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    sessions: ${formatNumber(r.consideredSessions)}    edges: [${r.edgesSeconds.map(fmtDur).join(', ')}]    min-duration: ${fmtDur(r.minDurationSeconds)}    unit: ${unit}`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0 || r.distributions.length === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  for (const d of r.distributions) {
    if (r.by !== 'all') {
      lines.push(chalk.bold(`group: ${d.group}`));
    }
    lines.push(
      renderTable(
        ['summary', 'value'],
        [
          ['sessions', formatNumber(d.totalSessions)],
          ['total wall-clock', fd(Math.round(d.totalSeconds))],
          ['mean', fd(Math.round(d.meanSeconds))],
          ['p50', fd(d.p50Seconds)],
          ['p90', fd(d.p90Seconds)],
          ['p95', fd(d.p95Seconds)],
          ['p99', fd(d.p99Seconds)],
          ['max', fd(d.maxSeconds)],
          ['modal bin', d.modalBinIndex >= 0 ? d.bins[d.modalBinIndex]!.label : '—'],
        ],
      ),
    );
    lines.push('');
    lines.push(
      renderTable(
        ['bin', 'count', 'share', 'cum.', 'median', 'mean'],
        d.bins.map((b) => [
          b.label,
          formatNumber(b.count),
          formatPercent(b.share),
          formatPercent(b.cumulativeShare),
          b.count > 0 ? fd(b.medianSeconds) : '—',
          b.count > 0 ? fd(Math.round(b.meanSeconds)) : '—',
        ]),
      ),
    );
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { ReplyRatioReport } from './replyratio.js';

function fmtRatio(r: number): string {
  if (r === 0) return '0';
  if (Number.isInteger(r)) return String(r);
  return r < 1 ? r.toFixed(2) : r.toFixed(2);
}

export function renderReplyRatio(r: ReplyRatioReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights reply-ratio'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    sessions: ${formatNumber(r.consideredSessions)}    edges: [${r.edges.map(fmtRatio).join(', ')}]    min-total-messages: ${r.minTotalMessages}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedZeroUserMessages)} zero-user-msg, ${formatNumber(r.droppedMinMessages)} below min-total`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0 || r.distributions.length === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  for (const d of r.distributions) {
    if (r.by !== 'all') {
      lines.push(chalk.bold(`group: ${d.group}`));
    }
    lines.push(
      renderTable(
        ['summary', 'value'],
        [
          ['sessions', formatNumber(d.totalSessions)],
          ['mean ratio', fmtRatio(Number(d.meanRatio.toFixed(2)))],
          ['p50', fmtRatio(Number(d.p50Ratio.toFixed(2)))],
          ['p90', fmtRatio(Number(d.p90Ratio.toFixed(2)))],
          ['p95', fmtRatio(Number(d.p95Ratio.toFixed(2)))],
          ['p99', fmtRatio(Number(d.p99Ratio.toFixed(2)))],
          ['max', fmtRatio(Number(d.maxRatio.toFixed(2)))],
          ['modal bin', d.modalBinIndex >= 0 ? d.bins[d.modalBinIndex]!.label : '—'],
          ...(d.aboveThresholdShare !== null && r.threshold !== null
            ? [[`> ${fmtRatio(r.threshold)} share`, formatPercent(d.aboveThresholdShare)] as [string, string]]
            : []),
        ],
      ),
    );
    lines.push('');
    lines.push(
      renderTable(
        ['bin', 'count', 'share', 'cum.', 'median', 'mean'],
        d.bins.map((b) => [
          b.label,
          formatNumber(b.count),
          formatPercent(b.share),
          formatPercent(b.cumulativeShare),
          b.count > 0 ? fmtRatio(Number(b.medianRatio.toFixed(2))) : '—',
          b.count > 0 ? fmtRatio(Number(b.meanRatio.toFixed(2))) : '—',
        ]),
      ),
    );
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { TurnCadenceReport } from './turncadence.js';

function fmtSeconds(s: number): string {
  if (s === 0) return '0s';
  if (s < 1) return `${s.toFixed(2)}s`;
  if (s < 60) return `${s.toFixed(1)}s`;
  if (s < 3600) return `${(s / 60).toFixed(1)}m`;
  return `${(s / 3600).toFixed(1)}h`;
}

function formatPercentLocal(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function renderTurnCadence(r: TurnCadenceReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights turn-cadence'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    sessions: ${formatNumber(r.consideredSessions)}    edges(s): [${r.edges.join(', ')}]    min-duration: ${r.minDurationSeconds}s    min-user-msgs: ${r.minUserMessages}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedZeroUserMessages)} zero-user-msg, ${formatNumber(r.droppedMinDuration)} below min-duration, ${formatNumber(r.droppedMinUserMessages)} below min-user-msgs`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0 || r.distributions.length === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  for (const d of r.distributions) {
    if (r.by !== 'all') {
      lines.push(chalk.bold(`group: ${d.group}`));
    }
    lines.push(
      renderTableLocal(
        ['summary', 'value'],
        [
          ['sessions', formatNumber(d.totalSessions)],
          ['mean', fmtSeconds(d.meanSeconds)],
          ['stdev', fmtSeconds(d.stdevSeconds)],
          ['cv', d.totalSessions >= 2 ? d.cadenceCV.toFixed(2) : '—'],
          ['p50', fmtSeconds(d.p50Seconds)],
          ['p90', fmtSeconds(d.p90Seconds)],
          ['p95', fmtSeconds(d.p95Seconds)],
          ['p99', fmtSeconds(d.p99Seconds)],
          ['max', fmtSeconds(d.maxSeconds)],
          ['modal bin', d.modalBinIndex >= 0 ? d.bins[d.modalBinIndex]!.label : '—'],
        ],
      ),
    );
    lines.push('');
    lines.push(
      renderTableLocal(
        ['bin', 'count', 'share', 'cum.', 'median', 'mean'],
        d.bins.map((b) => [
          b.label,
          formatNumber(b.count),
          formatPercentLocal(b.share),
          formatPercentLocal(b.cumulativeShare),
          b.count > 0 ? fmtSeconds(b.medianSeconds) : '—',
          b.count > 0 ? fmtSeconds(b.meanSeconds) : '—',
        ]),
      ),
    );
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { MessageVolumeReport } from './messagevolume.js';

function fmtMessages(n: number): string {
  if (n === 0) return '0';
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

export function renderMessageVolume(r: MessageVolumeReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights message-volume'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    sessions: ${formatNumber(r.consideredSessions)}    edges: [${r.edges.join(', ')}]    min-total-messages: ${r.minTotalMessages}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedMinMessages)} below min-total, ${formatNumber(r.droppedInvalid)} invalid`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0 || r.distributions.length === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  for (const d of r.distributions) {
    if (r.by !== 'all') {
      lines.push(chalk.bold(`group: ${d.group}`));
    }
    lines.push(
      renderTableLocal(
        ['summary', 'value'],
        [
          ['sessions', formatNumber(d.totalSessions)],
          ['mean', fmtMessages(Number(d.meanMessages.toFixed(2)))],
          ['p50', fmtMessages(d.p50Messages)],
          ['p90', fmtMessages(d.p90Messages)],
          ['p95', fmtMessages(d.p95Messages)],
          ['p99', fmtMessages(d.p99Messages)],
          ['max', fmtMessages(d.maxMessages)],
          ['modal bin', d.modalBinIndex >= 0 ? d.bins[d.modalBinIndex]!.label : '—'],
          ...(d.aboveThresholdShare !== null && r.threshold !== null
            ? [[`> ${r.threshold} share`, formatPercentLocal(d.aboveThresholdShare)] as [string, string]]
            : []),
        ],
      ),
    );
    lines.push('');
    lines.push(
      renderTableLocal(
        ['bin', 'count', 'share', 'cum.', 'median', 'mean'],
        d.bins.map((b) => [
          b.label,
          formatNumber(b.count),
          formatPercentLocal(b.share),
          formatPercentLocal(b.cumulativeShare),
          b.count > 0 ? fmtMessages(b.medianMessages) : '—',
          b.count > 0 ? fmtMessages(Number(b.meanMessages.toFixed(2))) : '—',
        ]),
      ),
    );
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { ModelSwitchingReport } from './modelswitching.js';

export function renderModelSwitching(r: ModelSwitchingReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights model-switching'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    sessions: ${formatNumber(r.consideredSessions)}    switched: ${formatNumber(r.switchedSessions)} (${formatPercentLocal(r.switchedShare)})    transitions: ${formatNumber(r.totalTransitions)} across ${formatNumber(r.uniqueTransitionPairs)} pairs    top: ${r.top}    min-switches: ${r.minSwitches}`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  for (const d of r.distributions) {
    if (r.by !== 'all') {
      lines.push(chalk.bold(`group: ${d.group}`));
    }
    lines.push(
      renderTableLocal(
        ['summary', 'value'],
        [
          ['sessions', formatNumber(d.consideredSessions)],
          ['switched', formatNumber(d.switchedSessions)],
          ['switched share', formatPercentLocal(d.switchedShare)],
          ['transitions', formatNumber(d.totalTransitions)],
          [
            'mean models / switched session',
            d.switchedSessions === 0 ? '—' : d.meanModelsPerSwitchedSession.toFixed(2),
          ],
          ['p50 distinct models', formatNumber(d.p50DistinctModels)],
          ['p90 distinct models', formatNumber(d.p90DistinctModels)],
          ['p99 distinct models', formatNumber(d.p99DistinctModels)],
          ['max distinct models', formatNumber(d.maxDistinctModels)],
        ],
      ),
    );
    lines.push('');
    lines.push(
      renderTableLocal(
        ['distinct models', 'count', 'share'],
        d.distinctModelCountBuckets.map((b) => [
          b.label,
          formatNumber(b.count),
          formatPercentLocal(b.share),
        ]),
      ),
    );
    lines.push('');
  }

  if (r.topTransitions.length > 0) {
    lines.push(chalk.bold(`top transitions (from → to):`));
    lines.push(
      renderTableLocal(
        ['from', 'to', 'count', 'share'],
        r.topTransitions.map((t) => [
          t.from,
          t.to,
          formatNumber(t.count),
          formatPercentLocal(t.share),
        ]),
      ),
    );
    if (r.otherTransitionsCount > 0) {
      lines.push(
        chalk.dim(
          `  + ${formatNumber(r.uniqueTransitionPairs - r.topTransitions.length)} more pairs accounting for ${formatNumber(r.otherTransitionsCount)} transitions (use --top to expand).`,
        ),
      );
    }
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { IdleGapsReport } from './idlegaps.js';

export function renderIdleGaps(r: IdleGapsReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights idle-gaps'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    by: ${r.by}    sessions: ${formatNumber(r.consideredSessions)}    gaps: ${formatNumber(r.totalGaps)}    single-snapshot: ${formatNumber(r.singleSnapshotSessions)}    min-gap: ${r.minGapSeconds}s`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.totalGaps === 0) {
    lines.push(chalk.yellow('  no intra-session gap pairs in the window. nothing to chart.'));
    return lines.join('\n');
  }

  for (const d of r.distributions) {
    if (r.by !== 'all') {
      lines.push(chalk.bold(`group: ${d.group}`));
    }
    lines.push(
      renderTableLocal(
        ['summary', 'value'],
        [
          ['sessions', formatNumber(d.sessions)],
          ['gap pairs', formatNumber(d.totalGaps)],
          ['mean gap (s)', d.meanSeconds.toFixed(2)],
          ['p50 gap (s)', d.p50Seconds.toFixed(2)],
          ['p90 gap (s)', d.p90Seconds.toFixed(2)],
          ['p95 gap (s)', d.p95Seconds.toFixed(2)],
          ['p99 gap (s)', d.p99Seconds.toFixed(2)],
          ['max gap (s)', d.maxSeconds.toFixed(2)],
        ],
      ),
    );
    lines.push('');
    lines.push(
      renderTableLocal(
        ['gap', 'count', 'share', 'cum', 'median (s)'],
        d.bins.map((b) => [
          b.label,
          formatNumber(b.count),
          formatPercentLocal(b.share),
          formatPercentLocal(b.cumulativeShare),
          b.medianSeconds.toFixed(2),
        ]),
      ),
    );
    if (d.modalBinIndex >= 0) {
      lines.push(
        chalk.dim(`  modal bin: ${d.bins[d.modalBinIndex]!.label}`),
      );
    }
    lines.push('');
  }

  if (r.topSessions.length > 0) {
    lines.push(chalk.bold(`top sessions by max intra-session gap:`));
    lines.push(
      renderTableLocal(
        ['session_key', 'source', 'kind', 'gaps', 'max (s)', 'total (s)'],
        r.topSessions.map((t) => [
          t.session_key,
          t.source,
          t.kind,
          formatNumber(t.gapCount),
          t.maxGapSeconds.toFixed(2),
          t.totalGapSeconds.toFixed(2),
        ]),
      ),
    );
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { SourceMixReport } from './sourcemix.js';

export function renderSourceMix(r: SourceMixReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights session-source-mix'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    unit: ${r.unit}    sessions: ${formatNumber(r.consideredSessions)}    sources: ${formatNumber(r.sources.length)}    buckets: ${formatNumber(r.buckets.length)}    top: ${r.top === 0 ? 'all' : String(r.top)}    dropped: ${formatNumber(r.droppedInvalid)} invalid, ${formatNumber(r.droppedExcluded)} excluded`,
    ),
  );
  if (r.excludedSources.length > 0) {
    lines.push(chalk.dim(`excluded sources: ${r.excludedSources.join(', ')}`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0 || r.buckets.length === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('overall source mix'));
  lines.push(
    renderTableLocal(
      ['source', 'sessions', 'share'],
      r.sources.map((s) => [s.source, formatNumber(s.count), formatPercentLocal(s.share)]),
    ),
  );
  lines.push('');

  lines.push(chalk.bold(`per-${r.unit} mix`));
  // Per-bucket: bucket label, total, modal, modal share, then each source share inline.
  const headers = ['bucket', 'sessions', 'modal', 'modal share', 'mix'];
  const rows = r.buckets.map((b) => {
    const mix = b.shares
      .map((s) => `${s.source}=${formatPercentLocal(s.share)}`)
      .join('  ');
    return [
      b.bucket,
      formatNumber(b.totalSessions),
      b.modalSource,
      formatPercentLocal(b.modalShare),
      mix,
    ];
  });
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

import type { ProviderShareReport } from './providershare.js';

export function renderProviderShare(r: ProviderShareReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights provider-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sessions: ${formatNumber(r.consideredSessions)}    messages: ${formatNumber(r.consideredMessages)}    providers: ${formatNumber(r.providers.length)}    top-models: ${r.topModels}    min-sessions: ${r.minSessions}    dropped: ${formatNumber(r.droppedInvalidStartedAt)} bad started_at, ${formatNumber(r.droppedInvalidMessages)} bad messages, ${formatNumber(r.droppedProviders)} small providers (${formatNumber(r.droppedProviderSessions)} sess / ${formatNumber(r.droppedProviderMessages)} msg)`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0 || r.providers.length === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('provider mix'));
  lines.push(
    renderTableLocal(
      ['provider', 'sessions', 'sess.share', 'messages', 'msg.share', 'models'],
      r.providers.map((p) => [
        p.provider,
        formatNumber(p.sessions),
        formatPercentLocal(p.sessionShare),
        formatNumber(p.messages),
        formatPercentLocal(p.messageShare),
        formatNumber(p.distinctModels),
      ]),
    ),
  );

  if (r.topModels > 0) {
    lines.push('');
    lines.push(chalk.bold(`top ${r.topModels} models per provider`));
    const rows: string[][] = [];
    for (const p of r.providers) {
      if (p.topModels.length === 0) {
        rows.push([p.provider, '—', '—']);
        continue;
      }
      for (let i = 0; i < p.topModels.length; i++) {
        const m = p.topModels[i]!;
        rows.push([i === 0 ? p.provider : '', m.model, formatNumber(m.sessions)]);
      }
    }
    lines.push(renderTableLocal(['provider', 'model', 'sessions'], rows));
  }

  return lines.join('\n').replace(/\n+$/, '');
}

function renderTableLocal(headers: string[], rows: string[][]): string {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)),
  );
  const fmt = (cells: string[]) =>
    cells.map((c, i) => c.padEnd(widths[i]!)).join('  ').replace(/\s+$/, '');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [fmt(headers), sep, ...rows.map(fmt)].join('\n');
}

import type { TimeOfDayReport } from './timeofday.js';

export function renderTimeOfDay(r: TimeOfDayReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights time-of-day'));
  const hourLabel = (start: number) => {
    if (r.collapse === 1) return `${String(start).padStart(2, '0')}:00`;
    const end = (start + r.collapse) % 24;
    return `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`;
  };
  const peakLabel =
    r.peakHour < 0 ? '—' : `${hourLabel(r.peakHour)} (${formatNumber(r.peakSessions)} sess)`;
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sessions: ${formatNumber(r.consideredSessions)}    tz: ${r.tzOffset}    collapse: ${r.collapse}h    peak: ${peakLabel}    by-source: ${r.bySource ? 'on' : 'off'}    dropped: ${formatNumber(r.droppedInvalidStartedAt)} bad started_at`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredSessions === 0) {
    lines.push(chalk.yellow('  no sessions in the window. nothing to chart.'));
    return lines.join('\n');
  }

  const maxSessions = r.peakSessions;
  const barWidth = 24;

  lines.push(
    chalk.bold(r.collapse === 1 ? 'hour-of-day distribution' : `${r.collapse}h-bin distribution`),
  );
  const rows: string[][] = r.hours.map((h) => {
    const fill = maxSessions === 0 ? 0 : Math.round((h.sessions / maxSessions) * barWidth);
    const bar = '█'.repeat(fill) + '·'.repeat(barWidth - fill);
    return [hourLabel(h.hour), formatNumber(h.sessions), formatPercentLocal(h.share), bar];
  });
  lines.push(renderTableLocal(['hour', 'sessions', 'share', 'bar'], rows));

  if (r.bySource) {
    lines.push('');
    lines.push(chalk.bold('per-source breakdown (only buckets with sessions)'));
    const srcRows: string[][] = [];
    for (const h of r.hours) {
      const entries = Object.entries(h.bySource);
      if (entries.length === 0) continue;
      for (let i = 0; i < entries.length; i++) {
        const [src, n] = entries[i]!;
        srcRows.push([i === 0 ? hourLabel(h.hour) : '', src, formatNumber(n)]);
      }
    }
    if (srcRows.length === 0) {
      lines.push(chalk.dim('  (no source data)'));
    } else {
      lines.push(renderTableLocal(['hour', 'source', 'sessions'], srcRows));
    }
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { CacheHitRatioReport } from './cachehitratio.js';

export function renderCacheHitRatio(r: CacheHitRatioReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights cache-hit-ratio'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    rows: ${formatNumber(r.consideredRows)}    input: ${formatNumber(r.totalInputTokens)} tok    cached: ${formatNumber(r.totalCachedInputTokens)} tok    overall: ${formatPercentLocal(r.overallHitRatio)}    min-rows: ${r.minRows}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroInput)} zero-input, ${formatNumber(r.droppedInvalidTokens)} bad tokens, ${formatNumber(r.droppedModelRows)} below min-rows`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredRows === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows with input_tokens > 0 in the window. nothing to chart.'));
    return lines.join('\n');
  }

  const barWidth = 20;
  lines.push(chalk.bold('per-model token-weighted cache-hit ratio (sorted by input volume desc)'));
  const rows: string[][] = r.models.map((m) => {
    const fill = Math.round(Math.min(1, Math.max(0, m.hitRatio)) * barWidth);
    const bar = '█'.repeat(fill) + '·'.repeat(barWidth - fill);
    return [
      m.model,
      formatNumber(m.rows),
      formatNumber(m.inputTokens),
      formatNumber(m.cachedInputTokens),
      formatPercentLocal(m.hitRatio),
      bar,
    ];
  });
  lines.push(renderTableLocal(['model', 'rows', 'input', 'cached', 'hit-ratio', 'bar'], rows));

  if (r.bySource) {
    lines.push('');
    lines.push(chalk.bold('per-source breakdown (sources sorted by input volume desc)'));
    const srcRows: string[][] = [];
    for (const m of r.models) {
      const entries = Object.entries(m.bySource);
      if (entries.length === 0) continue;
      for (let i = 0; i < entries.length; i++) {
        const [src, s] = entries[i]!;
        srcRows.push([
          i === 0 ? m.model : '',
          src,
          formatNumber(s.rows),
          formatNumber(s.inputTokens),
          formatNumber(s.cachedInputTokens),
          formatPercentLocal(s.hitRatio),
        ]);
      }
    }
    if (srcRows.length === 0) {
      lines.push(chalk.dim('  (no source data)'));
    } else {
      lines.push(renderTableLocal(['model', 'source', 'rows', 'input', 'cached', 'hit-ratio'], srcRows));
    }
  }

  return lines.join('\n').replace(/\n+$/, '');
}

import type { ReasoningShareReport } from './reasoningshare.js';
import type { PromptSizeReport } from './promptsize.js';
import type { OutputSizeReport } from './outputsize.js';
import type { PeakHourReport } from './peakhour.js';
import type { WeekdayShareReport } from './weekdayshare.js';
import { WEEKDAY_LABELS_MON_FIRST } from './weekdayshare.js';
import type { BurstinessReport } from './burstiness.js';
import type { DeviceShareReport } from './deviceshare.js';
import type { OutputInputRatioReport } from './outputinputratio.js';
import type { ModelMixEntropyReport } from './modelmixentropy.js';
import type { WeekendVsWeekdayReport } from './weekendvsweekday.js';
import type { CacheHitByHourReport } from './cachehitbyhour.js';
import type { ModelCohabitationReport } from './modelcohabitation.js';
import type { InterarrivalTimeReport } from './interarrivaltime.js';
import {
  BUCKET_INTENSITY_EDGES,
  type BucketIntensityReport,
} from './bucketintensity.js';

function formatBucketLabel(from: number, to: number | null): string {
  const fmt = (n: number): string => {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1) + 'k';
    return String(n);
  };
  if (to === null) return `${fmt(from)}+`;
  return `${fmt(from)}–${fmt(to)}`;
}

export function renderPromptSize(r: PromptSizeReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights prompt-size'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    rows: ${formatNumber(r.consideredRows)}    input: ${formatNumber(r.totalInputTokens)} tok    mean: ${formatNumber(Math.round(r.overallMeanInputTokens))}    max: ${formatNumber(r.overallMaxInputTokens)}    min-rows: ${r.minRows}    at-least: ${formatNumber(r.atLeast)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroInput)} zero-input, ${formatNumber(r.droppedInvalidTokens)} bad tokens, ${formatNumber(r.droppedAtLeast)} below at-least, ${formatNumber(r.droppedModelRows)} below min-rows, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredRows === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows with input_tokens > 0 in the window. nothing to chart.'));
    return lines.join('\n');
  }

  // Overall histogram first — answers "what fraction of all my prompts
  // are above 200k?" in one glance.
  lines.push(chalk.bold('overall input_tokens distribution'));
  const overallRows: string[][] = r.overallBuckets.map((b) => [
    formatBucketLabel(b.from, b.to),
    formatNumber(b.rows),
    formatPercentLocal(b.share),
  ]);
  lines.push(renderTableLocal(['bucket', 'rows', 'share'], overallRows));
  lines.push('');

  // Per-model: rows, mean, p95, max, plus inline mini-bar for the
  // bucket distribution. Sorted by row count desc upstream.
  lines.push(chalk.bold('per-model prompt-size summary (sorted by row count desc)'));
  const bucketHeaders = r.edges.map((from, i) =>
    formatBucketLabel(from, i + 1 < r.edges.length ? r.edges[i + 1]! : null),
  );
  const headers = ['model', 'rows', 'mean', 'p95', 'max', ...bucketHeaders];
  const rows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.rows),
    formatNumber(Math.round(m.meanInputTokens)),
    formatNumber(m.p95InputTokens),
    formatNumber(m.maxInputTokens),
    ...m.buckets.map((b) => (b.rows === 0 ? '·' : formatNumber(b.rows))),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderOutputSize(r: OutputSizeReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights output-size'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    rows: ${formatNumber(r.consideredRows)}    output: ${formatNumber(r.totalOutputTokens)} tok    mean: ${formatNumber(Math.round(r.overallMeanOutputTokens))}    max: ${formatNumber(r.overallMaxOutputTokens)}    min-rows: ${r.minRows}    at-least: ${formatNumber(r.atLeast)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroOutput)} zero-output, ${formatNumber(r.droppedInvalidTokens)} bad tokens, ${formatNumber(r.droppedAtLeast)} below at-least, ${formatNumber(r.droppedModelRows)} below min-rows, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredRows === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows with output_tokens > 0 in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('overall output_tokens distribution'));
  const overallRows: string[][] = r.overallBuckets.map((b) => [
    formatBucketLabel(b.from, b.to),
    formatNumber(b.rows),
    formatPercentLocal(b.share),
  ]);
  lines.push(renderTableLocal(['bucket', 'rows', 'share'], overallRows));
  lines.push('');

  lines.push(chalk.bold(`per-${r.by} output-size summary (sorted by row count desc)`));
  const bucketHeaders = r.edges.map((from, i) =>
    formatBucketLabel(from, i + 1 < r.edges.length ? r.edges[i + 1]! : null),
  );
  const headers = [r.by, 'rows', 'mean', 'p95', 'max', ...bucketHeaders];
  const rows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.rows),
    formatNumber(Math.round(m.meanOutputTokens)),
    formatNumber(m.p95OutputTokens),
    formatNumber(m.maxOutputTokens),
    ...m.buckets.map((b) => (b.rows === 0 ? '·' : formatNumber(b.rows))),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderReasoningShare(r: ReasoningShareReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights reasoning-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    rows: ${formatNumber(r.consideredRows)}    output: ${formatNumber(r.totalOutputTokens)} tok    reasoning: ${formatNumber(r.totalReasoningTokens)} tok    overall: ${formatPercentLocal(r.overallReasoningShare)}    min-rows: ${r.minRows}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroOutput)} zero-output, ${formatNumber(r.droppedInvalidTokens)} bad tokens, ${formatNumber(r.droppedModelRows)} below min-rows, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredRows === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows with generated tokens > 0 in the window. nothing to chart.'));
    return lines.join('\n');
  }

  const barWidth = 20;
  lines.push(chalk.bold('per-model token-weighted reasoning share (sorted by generated volume desc)'));
  const rows: string[][] = r.models.map((m) => {
    const fill = Math.round(Math.min(1, Math.max(0, m.reasoningShare)) * barWidth);
    const bar = '█'.repeat(fill) + '·'.repeat(barWidth - fill);
    return [
      m.model,
      formatNumber(m.rows),
      formatNumber(m.outputTokens),
      formatNumber(m.reasoningTokens),
      formatNumber(m.generatedTokens),
      formatPercentLocal(m.reasoningShare),
      bar,
    ];
  });
  lines.push(
    renderTableLocal(
      ['model', 'rows', 'output', 'reasoning', 'generated', 'share', 'bar'],
      rows,
    ),
  );

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderPeakHourShare(r: PeakHourReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights peak-hour-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    days: ${formatNumber(r.consideredDays)}    tokens: ${formatNumber(r.totalTokens)}    overall mean peak-share: ${formatPercentLocal(r.overallMeanPeakShare)}    overall max: ${formatPercentLocal(r.overallMaxPeakShare)}    peak-window: ${r.peakWindowHours}h    min-days: ${r.minDays}    min-active-hours: ${r.minActiveHours}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSingletonDays)} below min-active-hours, ${formatNumber(r.droppedGroupRows)} below min-days, ${formatNumber(r.droppedTopGroups)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredDays === 0 || r.groups.length === 0) {
    lines.push(
      chalk.yellow('  no (group, day) pairs in the window with enough activity. nothing to chart.'),
    );
    return lines.join('\n');
  }

  const barWidth = 20;
  lines.push(chalk.bold(`per-${r.by} top-${r.peakWindowHours}h peak-window concentration (sorted by day count desc)`));
  const rows: string[][] = r.groups.map((g) => {
    const fill = Math.round(Math.min(1, Math.max(0, g.meanPeakShare)) * barWidth);
    const bar = '█'.repeat(fill) + '·'.repeat(barWidth - fill);
    const modal =
      g.modalPeakHour < 0
        ? '—'
        : `${String(g.modalPeakHour).padStart(2, '0')}:00 (${g.modalPeakHourCount}/${g.days})`;
    return [
      g.model,
      formatNumber(g.days),
      formatNumber(g.totalTokens),
      formatPercentLocal(g.meanPeakShare),
      formatPercentLocal(g.p50PeakShare),
      formatPercentLocal(g.p95PeakShare),
      formatPercentLocal(g.maxPeakShare),
      modal,
      bar,
    ];
  });
  lines.push(
    renderTableLocal(
      [r.by, 'days', 'tokens', 'mean', 'p50', 'p95', 'max', 'modal-hr (UTC)', 'bar'],
      rows,
    ),
  );

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderWeekdayShare(r: WeekdayShareReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights weekday-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    tokens: ${formatNumber(r.totalTokens)}    groups: ${formatNumber(r.groups.length)}    global peak: ${r.globalPeakWeekday < 0 ? '—' : WEEKDAY_LABELS_MON_FIRST[r.globalPeakWeekday]} ${formatPercentLocal(r.globalPeakShare)}    global hhi: ${r.globalHhi.toFixed(3)}    min-tokens: ${formatNumber(r.minTokens)}    min-active-weekdays: ${r.minActiveWeekdays}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedGroupRows)} below min-tokens, ${formatNumber(r.droppedSparseGroups)} below min-active-weekdays, ${formatNumber(r.droppedTopGroups)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.totalTokens === 0 || r.groups.length === 0) {
    lines.push(
      chalk.yellow('  no rows in the window with positive tokens. nothing to chart.'),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-${r.by} weekday share (UTC ISO weekday, sorted by total tokens desc; HHI in [1/7, 1])`,
    ),
  );
  const headers = [
    r.by,
    'tokens',
    ...WEEKDAY_LABELS_MON_FIRST,
    'peak',
    'active',
    'hhi',
  ];
  const rows: string[][] = r.groups.map((g) => {
    const cols = [g.model, formatNumber(g.totalTokens)];
    for (let i = 0; i < 7; i++) {
      cols.push(formatPercentLocal(g.sharePerWeekday[i] ?? 0));
    }
    cols.push(
      `${WEEKDAY_LABELS_MON_FIRST[g.peakWeekday]} ${formatPercentLocal(g.peakShare)}`,
    );
    cols.push(`${g.activeWeekdays}/7`);
    cols.push(g.hhi.toFixed(3));
    return cols;
  });
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderBurstiness(r: BurstinessReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights burstiness'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    tokens: ${formatNumber(r.totalTokens)}    groups: ${formatNumber(r.groups.length)}    global active hrs: ${formatNumber(r.globalActiveHours)}    global mean/hr: ${formatNumber(Math.round(r.globalMeanTokensPerHour))}    global cv: ${r.globalCv.toFixed(3)}    global max/hr: ${formatNumber(r.globalMaxTokensPerHour)}    min-tokens: ${formatNumber(r.minTokens)}    min-active-hours: ${r.minActiveHours}    min-cv: ${r.minCv.toFixed(3)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedGroupRows)} below min-tokens, ${formatNumber(r.droppedSparseGroups)} below min-active-hours, ${formatNumber(r.droppedLowCvGroups)} below min-cv, ${formatNumber(r.droppedTopGroups)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.totalTokens === 0 || r.groups.length === 0) {
    lines.push(
      chalk.yellow('  no rows in the window with positive tokens. nothing to chart.'),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-${r.by} hourly burstiness (active hour buckets only; cv = stddev/mean; burst = max/p50)`,
    ),
  );
  const headers = [
    r.by,
    'tokens',
    'active hrs',
    'mean/hr',
    'stddev/hr',
    'cv',
    'p50/hr',
    'p95/hr',
    'max/hr',
    'burst',
  ];
  const rows2: string[][] = r.groups.map((g) => [
    g.model,
    formatNumber(g.totalTokens),
    formatNumber(g.activeHours),
    formatNumber(Math.round(g.meanTokensPerHour)),
    formatNumber(Math.round(g.stddevTokensPerHour)),
    g.cv.toFixed(3),
    formatNumber(Math.round(g.p50TokensPerHour)),
    formatNumber(Math.round(g.p95TokensPerHour)),
    formatNumber(g.maxTokensPerHour),
    g.burstRatio > 0 ? g.burstRatio.toFixed(2) + '×' : '—',
  ]);
  lines.push(renderTableLocal(headers, rows2));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderDeviceShare(r: DeviceShareReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights device-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    tokens: ${formatNumber(r.totalTokens)}    devices: ${formatNumber(r.totalDevices)}    shown: ${formatNumber(r.devices.length)}    min-tokens: ${formatNumber(r.minTokens)}    top: ${r.top === 0 ? '∞' : formatNumber(r.top)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedEmptyDevice)} empty device_id, ${formatNumber(r.droppedMinTokens)} below min-tokens, ${formatNumber(r.droppedTopDevices)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.totalTokens === 0 || r.devices.length === 0) {
    lines.push(
      chalk.yellow('  no rows in the window with positive tokens. nothing to chart.'),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-device share of token mass (cache% = cached_input / input; models / sources = distinct count)`,
    ),
  );
  const headers = [
    'device_id',
    'tokens',
    'share',
    'rows',
    'active hrs',
    'models',
    'sources',
    'input',
    'cached',
    'output',
    'cache%',
    'first seen',
    'last seen',
  ];
  const rows: string[][] = r.devices.map((d) => [
    d.deviceId,
    formatNumber(d.totalTokens),
    (d.share * 100).toFixed(2) + '%',
    formatNumber(d.rows),
    formatNumber(d.activeHours),
    formatNumber(d.distinctModels),
    formatNumber(d.distinctSources),
    formatNumber(d.inputTokens),
    formatNumber(d.cachedInputTokens),
    formatNumber(d.outputTokens),
    (d.cacheHitRatio * 100).toFixed(1) + '%',
    d.firstSeen.slice(0, 16) + 'Z',
    d.lastSeen.slice(0, 16) + 'Z',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderOutputInputRatio(r: OutputInputRatioReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights output-input-ratio'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    rows: ${formatNumber(r.consideredRows)}    input: ${formatNumber(r.totalInputTokens)} tok    output: ${formatNumber(r.totalOutputTokens)} tok    overall: ${r.overallRatio.toFixed(4)}    min-rows: ${r.minRows}    top: ${r.top === 0 ? '∞' : r.top}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroInput)} zero-input, ${formatNumber(r.droppedInvalidTokens)} bad tokens, ${formatNumber(r.droppedModelRows)} below min-rows, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.consideredRows === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows with input_tokens > 0 in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      'per-model output/input ratio (token-weighted; sorted by input volume desc; chatty=high, terse=low)',
    ),
  );
  const ratioRows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.rows),
    formatNumber(m.inputTokens),
    formatNumber(m.outputTokens),
    m.ratio.toFixed(4),
    m.meanRowRatio.toFixed(4),
  ]);
  lines.push(
    renderTableLocal(
      ['model', 'rows', 'input', 'output', 'ratio', 'mean-row-ratio'],
      ratioRows,
    ),
  );

  if (r.bySource) {
    lines.push('');
    lines.push(chalk.bold('per-source breakdown (sources sorted by input volume desc)'));
    const srcRows: string[][] = [];
    for (const m of r.models) {
      const entries = Object.entries(m.bySource);
      if (entries.length === 0) continue;
      for (let i = 0; i < entries.length; i++) {
        const [src, s] = entries[i]!;
        srcRows.push([
          i === 0 ? m.model : '',
          src,
          formatNumber(s.rows),
          formatNumber(s.inputTokens),
          formatNumber(s.outputTokens),
          s.ratio.toFixed(4),
        ]);
      }
    }
    if (srcRows.length === 0) {
      lines.push(chalk.dim('  (no source data)'));
    } else {
      lines.push(
        renderTableLocal(['model', 'source', 'rows', 'input', 'output', 'ratio'], srcRows),
      );
    }
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderModelMixEntropy(r: ModelMixEntropyReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights model-mix-entropy'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)}    tokens: ${formatNumber(r.totalTokens)}    min-tokens: ${formatNumber(r.minTokens)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero/invalid tokens, ${formatNumber(r.droppedMinTokens)} below min-tokens`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no sources in window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      'per-source model-mix entropy (Shannon bits over per-model token share; sorted by tokens desc)',
    ),
  );
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.totalTokens),
    formatNumber(s.rows),
    String(s.distinctModels),
    s.entropyBits.toFixed(4),
    s.maxEntropyBits.toFixed(4),
    s.normalizedEntropy.toFixed(4),
    s.effectiveModels.toFixed(2),
    s.topModel,
    (s.topModelShare * 100).toFixed(1) + '%',
  ]);
  lines.push(
    renderTableLocal(
      [
        'source',
        'tokens',
        'rows',
        'k',
        'H(bits)',
        'Hmax',
        'H/Hmax',
        'eff-models',
        'top-model',
        'top-share',
      ],
      rows,
    ),
  );

  if (r.topK > 0) {
    lines.push('');
    lines.push(
      chalk.bold(
        `per-source top-${r.topK} models (sorted by tokens desc within each source)`,
      ),
    );
    const tkRows: string[][] = [];
    for (const s of r.sources) {
      if (s.topModels.length === 0) continue;
      for (let i = 0; i < s.topModels.length; i++) {
        const m = s.topModels[i]!;
        tkRows.push([
          i === 0 ? s.source : '',
          m.model,
          formatNumber(m.tokens),
          (m.share * 100).toFixed(1) + '%',
        ]);
      }
    }
    if (tkRows.length === 0) {
      lines.push(chalk.dim('  (no model data)'));
    } else {
      lines.push(renderTableLocal(['source', 'model', 'tokens', 'share'], tkRows));
    }
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderWeekendVsWeekday(r: WeekendVsWeekdayReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights weekend-vs-weekday'));
  const ratioStr = !Number.isFinite(r.weekendToWeekdayRatio)
    ? '∞'
    : r.weekendToWeekdayRatio.toFixed(3);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    tokens: ${formatNumber(r.totalTokens)}    weekend: ${formatNumber(r.weekendTokens)} (${(r.weekendShare * 100).toFixed(2)}%)    weekday: ${formatNumber(r.weekdayTokens)}    ratio (we/wd): ${ratioStr}    models: ${formatNumber(r.totalModels)}    shown: ${formatNumber(r.models.length)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedMinRows)} below min-rows, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(chalk.dim(`(weekend = Sat/Sun in UTC; "calendar-balanced" reference ratio is 2/5 = 0.400)`));
  lines.push('');

  if (r.totalTokens === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows in the window with positive tokens. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-model weekend vs weekday split (sorted by total tokens desc)`));
  const headers = [
    'model',
    'tokens',
    'we tok',
    'wd tok',
    'we%',
    'we/wd',
    'we rows',
    'wd rows',
    'sources',
    'first seen',
    'last seen',
  ];
  const rows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.totalTokens),
    formatNumber(m.weekendTokens),
    formatNumber(m.weekdayTokens),
    (m.weekendShare * 100).toFixed(1) + '%',
    !Number.isFinite(m.weekendToWeekdayRatio) ? '∞' : m.weekendToWeekdayRatio.toFixed(3),
    formatNumber(m.weekendRows),
    formatNumber(m.weekdayRows),
    formatNumber(m.distinctSources),
    m.firstSeen.slice(0, 16) + 'Z',
    m.lastSeen.slice(0, 16) + 'Z',
  ]);
  lines.push(renderTableLocal(headers, rows));

  if (r.bySource) {
    const subHeaders = ['model', 'source', 'tokens', 'we tok', 'wd tok', 'we%', 'we/wd', 'we rows', 'wd rows'];
    const subRows: string[][] = [];
    for (const m of r.models) {
      for (const s of m.bySource) {
        subRows.push([
          m.model,
          s.source,
          formatNumber(s.totalTokens),
          formatNumber(s.weekendTokens),
          formatNumber(s.weekdayTokens),
          (s.weekendShare * 100).toFixed(1) + '%',
          !Number.isFinite(s.weekendToWeekdayRatio) ? '∞' : s.weekendToWeekdayRatio.toFixed(3),
          formatNumber(s.weekendRows),
          formatNumber(s.weekdayRows),
        ]);
      }
    }
    if (subRows.length > 0) {
      lines.push('');
      lines.push(chalk.bold('per-model × source breakdown'));
      lines.push(renderTableLocal(subHeaders, subRows));
    }
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderCacheHitByHour(r: CacheHitByHourReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights cache-hit-by-hour'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    input: ${formatNumber(r.totalInputTokens)}    cached: ${formatNumber(r.totalCachedInputTokens)} (${(r.globalCacheRatio * 100).toFixed(2)}%)    sources: ${formatNumber(r.totalSources)}    shown: ${formatNumber(r.bySource.length)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroInput)} zero-input, ${formatNumber(r.droppedMinInputTokens)} below min-input, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  if (r.sourceFilter) {
    lines.push(chalk.dim(`source filter: ${r.sourceFilter}    droppedSourceFilter: ${formatNumber(r.droppedSourceFilter)}`));
  }
  lines.push(chalk.dim(`(hour-of-day in UTC; ratio = cached_input_tokens / input_tokens)`));
  lines.push('');

  if (r.totalInputTokens === 0) {
    lines.push(chalk.yellow('  no rows in the window with positive input_tokens. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('global cache ratio by hour-of-day (UTC)'));
  const headers = ['hr', 'input', 'cached', 'cache%', 'rows'];
  const rows: string[][] = r.byHour.map((b) => [
    String(b.hour).padStart(2, '0'),
    formatNumber(b.inputTokens),
    formatNumber(b.cachedInputTokens),
    b.inputTokens > 0 ? (b.cacheRatio * 100).toFixed(1) + '%' : '—',
    formatNumber(b.rows),
  ]);
  lines.push(renderTableLocal(headers, rows));

  if (r.bySource.length > 0) {
    lines.push('');
    lines.push(chalk.bold('per-source summary (sorted by input tokens desc)'));
    const sumHeaders = ['source', 'input', 'cached', 'daily%', 'peak hr', 'peak%', 'trough hr', 'trough%', 'spread'];
    const sumRows: string[][] = r.bySource.map((s) => [
      s.source,
      formatNumber(s.inputTokens),
      formatNumber(s.cachedInputTokens),
      (s.cacheRatio * 100).toFixed(1) + '%',
      s.peakHour >= 0 ? String(s.peakHour).padStart(2, '0') : '—',
      s.peakHour >= 0 ? (s.peakRatio * 100).toFixed(1) + '%' : '—',
      s.troughHour >= 0 ? String(s.troughHour).padStart(2, '0') : '—',
      s.troughHour >= 0 ? (s.troughRatio * 100).toFixed(1) + '%' : '—',
      (s.spread * 100).toFixed(1) + ' pp',
    ]);
    lines.push(renderTableLocal(sumHeaders, sumRows));
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderModelCohabitation(r: ModelCohabitationReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights model-cohabitation'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    buckets: ${formatNumber(r.totalBuckets)}    multi-model: ${formatNumber(r.multiModelBuckets)}    models: ${formatNumber(r.totalModels)}    pairs: ${formatNumber(r.totalPairs)} (shown ${formatNumber(r.pairs.length)})    tokens: ${formatNumber(r.totalTokens)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedMinCoBuckets)} below min-co-buckets, ${formatNumber(r.droppedByModelFilter)} by model filter, ${formatNumber(r.droppedTopPairs)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  if (r.byModel !== null) {
    lines.push(chalk.dim(`by-model filter: ${r.byModel}`));
  }
  lines.push(
    chalk.dim(
      `(buckets are UTC hour_start values; cohabIndex = Jaccard on bucket-presence sets, in [0,1])`,
    ),
  );
  lines.push('');

  if (r.totalBuckets === 0 || r.models.length === 0) {
    lines.push(chalk.yellow('  no rows in the window with positive tokens. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('per-model presence summary (sorted by tokens desc)'));
  const mHeaders = ['model', 'tokens', 'buckets', 'cohabitants'];
  const mRows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.tokens),
    formatNumber(m.bucketsActive),
    formatNumber(m.distinctCohabitants),
  ]);
  lines.push(renderTableLocal(mHeaders, mRows));

  lines.push('');
  if (r.pairs.length === 0) {
    lines.push(chalk.yellow('  no model pairs co-habit any bucket in the window.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('top model pairs by shared buckets (sorted by coBuckets desc, coTokens desc, lex)'));
  const pHeaders = [
    'modelA',
    'modelB',
    'coBuckets',
    'coTokens(min)',
    'cohabIndex',
    'P(B|A)',
    'P(A|B)',
  ];
  const pRows: string[][] = r.pairs.map((p) => [
    p.modelA,
    p.modelB,
    formatNumber(p.coBuckets),
    formatNumber(p.coTokens),
    p.cohabIndex.toFixed(3),
    (p.coShareA * 100).toFixed(1) + '%',
    (p.coShareB * 100).toFixed(1) + '%',
  ]);
  lines.push(renderTableLocal(pHeaders, pRows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtHoursEdge(h: number): string {
  if (!Number.isFinite(h)) return '+inf';
  if (h % 168 === 0 && h >= 168) return `${h / 168}w`;
  if (h % 24 === 0 && h >= 24) return `${h / 24}d`;
  return `${h}h`;
}

export function renderInterarrivalTime(r: InterarrivalTimeReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights interarrival-time'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    activeBuckets: ${formatNumber(r.totalActiveBuckets)}    gaps: ${formatNumber(r.totalGaps)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedMinActiveBuckets)} below min-active-buckets, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(gaps measured between consecutive distinct UTC hour_start values per source, in hours; min observable = 1h)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no sources with positive tokens in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source gap summary (sorted by ${r.sort} desc)`));
  const sHeaders = ['source', 'buckets', 'gaps', 'min(h)', 'p50(h)', 'p90(h)', 'max(h)', 'mean(h)', 'sum(h)'];
  const sRows: string[][] = r.sources.map((s) => [
    s.source === '' ? '(empty)' : s.source,
    formatNumber(s.activeBuckets),
    formatNumber(s.gapCount),
    formatNumber(s.minHours),
    formatNumber(s.p50Hours),
    formatNumber(s.p90Hours),
    formatNumber(s.maxHours),
    s.meanHours.toFixed(2),
    formatNumber(s.sumHours),
  ]);
  lines.push(renderTableLocal(sHeaders, sRows));

  lines.push('');
  lines.push(chalk.bold('per-source gap histogram'));
  const hHeaders = ['source', ...r.histogramEdgesHours.slice(0, -1).map((lo, i) => {
    const hi = r.histogramEdgesHours[i + 1] as number;
    return `[${fmtHoursEdge(lo)},${fmtHoursEdge(hi)})`;
  })];
  const hRows: string[][] = r.sources.map((s) => [
    s.source === '' ? '(empty)' : s.source,
    ...s.histogram.map((b) => formatNumber(b.count)),
  ]);
  lines.push(renderTableLocal(hHeaders, hRows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtTokenEdge(t: number): string {
  if (!Number.isFinite(t)) return '+inf';
  if (t >= 1_000_000) return `${(t / 1_000_000).toFixed(t % 1_000_000 === 0 ? 0 : 1)}M`;
  if (t >= 1_000) return `${(t / 1_000).toFixed(t % 1_000 === 0 ? 0 : 1)}k`;
  return `${t}`;
}

export function renderBucketIntensity(r: BucketIntensityReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights bucket-intensity'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    models: ${formatNumber(r.totalModels)} (shown ${formatNumber(r.models.length)})    buckets: ${formatNumber(r.totalBuckets)}    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedBucketTokensMin)} below bucket-tokens-min, ${formatNumber(r.droppedMinBuckets)} below min-buckets, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(observation = one (model, UTC hour_start) bucket; percentiles are nearest-rank R-1 over per-bucket total_tokens; spread = p99/p50)`,
    ),
  );
  lines.push('');

  if (r.models.length === 0) {
    lines.push(chalk.yellow('  no model rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-model bucket-size summary (sorted by ${r.sort} desc)`));
  const headers = [
    'model',
    'buckets',
    'tokens',
    'min',
    'p50',
    'p90',
    'p99',
    'max',
    'mean',
    'spread',
  ];
  const rows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.buckets),
    formatNumber(m.tokens),
    formatNumber(m.min),
    formatNumber(m.p50),
    formatNumber(m.p90),
    formatNumber(m.p99),
    formatNumber(m.max),
    m.mean.toFixed(0),
    m.spread > 0 ? m.spread.toFixed(2) : '-',
  ]);
  lines.push(renderTableLocal(headers, rows));

  lines.push('');
  lines.push(chalk.bold('per-model bucket-size histogram (counts per token-magnitude band)'));
  const edges = BUCKET_INTENSITY_EDGES as readonly number[];
  const hHeaders = [
    'model',
    ...edges.map((lo, i) => {
      const hi = i + 1 < edges.length ? edges[i + 1] : Number.POSITIVE_INFINITY;
      return `[${fmtTokenEdge(lo)},${fmtTokenEdge(hi as number)})`;
    }),
  ];
  const hRows: string[][] = r.models.map((m) => [
    m.model,
    ...m.histogram.map((b) => formatNumber(b.count)),
  ]);
  lines.push(renderTableLocal(hHeaders, hRows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderModelTenure(r: ModelTenureReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights model-tenure'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    models: ${formatNumber(r.totalModels)} (shown ${formatNumber(r.models.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedTopModels)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(spanHours = clock hours first->last, may be fractional; activeBuckets = distinct hour_start values; bucket width is whatever pew emits)`,
    ),
  );
  lines.push('');

  if (r.models.length === 0) {
    lines.push(chalk.yellow('  no model rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-model tenure (sorted by ${r.sort} desc)`));
  const headers = [
    'model',
    'first-seen (UTC)',
    'last-seen (UTC)',
    'span-hr',
    'active-buckets',
    'tokens',
    'tok/bucket',
    'tok/span-hr',
  ];
  const rows: string[][] = r.models.map((m) => [
    m.model,
    m.firstSeen,
    m.lastSeen,
    m.spanHours.toFixed(1),
    formatNumber(m.activeBuckets),
    formatNumber(m.tokens),
    formatNumber(Math.round(m.tokensPerActiveBucket)),
    formatNumber(Math.round(m.tokensPerSpanHour)),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderTailShare(r: TailShareReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights tail-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    buckets: ${formatNumber(r.totalBuckets)}    tokens: ${formatNumber(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSparseSources)} sparse sources (${formatNumber(r.droppedSparseBuckets)} buckets), ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  lines.push(
    chalk.dim(
      `(top K% = fraction of total tokens in the heaviest K% of buckets per source; giniLike in [0,1] = uniform-baseline-corrected mean of the four shares)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows survived filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('per-source token concentration (sorted by giniLike desc)'));
  const headers = ['source', 'buckets', 'tokens', 'top1%', 'top5%', 'top10%', 'top20%', 'giniLike'];
  const fmtPct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.bucketCount),
    formatNumber(s.tokens),
    fmtPct(s.top1Share),
    fmtPct(s.top5Share),
    fmtPct(s.top10Share),
    fmtPct(s.top20Share),
    s.giniLike.toFixed(3),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderTenureDensityQuadrant(r: TenureDensityQuadrantReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights tenure-vs-density-quadrant'));
  const med = (x: number | null, digits: number) =>
    x === null ? 'n/a' : x.toFixed(digits);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    models: ${formatNumber(r.totalModels)}    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `splits: medianSpanHours=${med(r.medianSpanHours, 2)}    medianDensity=${med(r.medianDensity, 0)}    (>= medianSpanHours -> long; >= medianDensity -> dense; ties go long/dense)`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedSparseModels)} sparse models (${formatNumber(r.droppedSparseBuckets)} buckets), ${formatNumber(r.droppedQuadrantModels)} models in suppressed quadrants (${formatNumber(r.droppedQuadrantTokens)} tokens)`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  if (r.quadrant !== null) {
    lines.push(chalk.dim(`quadrant filter: ${r.quadrant}`));
  }
  lines.push('');

  if (r.totalModels === 0) {
    lines.push(chalk.yellow('  no models survived filters. nothing to chart.'));
    return lines.join('\n');
  }

  // Quadrant summary table.
  lines.push(chalk.bold('quadrant summary'));
  const sumHeaders = ['quadrant', 'models', 'tokens', 'active-buckets'];
  const sumRows: string[][] = r.quadrants.map((q) => [
    q.quadrant,
    formatNumber(q.count),
    formatNumber(q.tokens),
    formatNumber(q.activeBuckets),
  ]);
  lines.push(renderTableLocal(sumHeaders, sumRows));
  lines.push('');

  // Per-quadrant model lists.
  for (const q of r.quadrants) {
    if (q.count === 0) continue;
    const capLabel = r.top > 0 ? ` (shown ${q.models.length} of ${q.count}; ${q.droppedTop} below top cap)` : '';
    lines.push(chalk.bold(`${q.quadrant}${capLabel}`));
    const headers = ['model', 'span-hr', 'active-buckets', 'tokens', 'density'];
    const rows: string[][] = q.models.map((m) => [
      m.model,
      m.spanHours.toFixed(1),
      formatNumber(m.activeBuckets),
      formatNumber(m.tokens),
      formatNumber(Math.round(m.density)),
    ]);
    lines.push(renderTableLocal(headers, rows));
    lines.push('');
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceTenure(r: SourceTenureReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-tenure'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}    minModels: ${formatNumber(r.minModels)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedModelFilter)} by model filter, ${formatNumber(r.droppedSparseSources)} sparse sources, ${formatNumber(r.droppedNarrowSources)} narrow sources (< minModels), ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.model !== null) {
    lines.push(chalk.dim(`model filter: ${r.model}`));
  }
  lines.push(
    chalk.dim(
      `(spanHours = clock hours first->last; activeBuckets = distinct hour_start values; distinctModels = unique normalised models seen under this source)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source tenure (sorted by ${r.sort} desc)`));
  const headers = [
    'source',
    'first-seen (UTC)',
    'last-seen (UTC)',
    'span-hr',
    'active-buckets',
    'tokens',
    'tok/bucket',
    'tok/span-hr',
    'models',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstSeen,
    s.lastSeen,
    s.spanHours.toFixed(1),
    formatNumber(s.activeBuckets),
    formatNumber(s.tokens),
    formatNumber(Math.round(s.tokensPerActiveBucket)),
    formatNumber(Math.round(s.tokensPerSpanHour)),
    formatNumber(s.distinctModels),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderBucketStreakLength(r: BucketStreakLengthReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights bucket-streak-length'));
  const widthMin = (r.bucketWidthMs / 60_000).toFixed(0);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    models: ${formatNumber(r.totalModels)} (shown ${formatNumber(r.models.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    bucket-width: ${widthMin}m${r.bucketWidthInferred ? ' (inferred)' : ''}    minBuckets: ${formatNumber(r.minBuckets)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedSparseModels)} sparse models`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(streak = maximal run of consecutive active buckets where each step is exactly bucketWidth apart; longestStreak is per-model)`,
    ),
  );
  lines.push('');

  if (r.models.length === 0) {
    lines.push(chalk.yellow('  no model rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-model bucket streaks (sorted by ${r.sort} desc)`));
  const headers = [
    'model',
    'active-buckets',
    'streaks',
    'longest',
    'mean-streak',
    'longest-start (UTC)',
    'longest-end (UTC)',
    'tokens',
  ];
  const rows: string[][] = r.models.map((m) => [
    m.model,
    formatNumber(m.activeBuckets),
    formatNumber(m.streakCount),
    formatNumber(m.longestStreak),
    m.meanStreakLength.toFixed(2),
    m.longestStreakStart,
    m.longestStreakEnd,
    formatNumber(m.tokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderBucketGapDistribution(
  r: BucketGapDistributionReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights bucket-gap-distribution'));
  const widthMin = (r.bucketWidthMs / 60_000).toFixed(0);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    gaps: ${formatNumber(r.totalGaps)}    tokens: ${formatNumber(r.totalTokens)}    bucket-width: ${widthMin}m${r.bucketWidthInferred ? ' (inferred)' : ''}    minGaps: ${formatNumber(r.minGaps)}    minGap: ${formatNumber(r.minGap)}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedModelFilter)} by model filter, ${formatNumber(r.droppedBelowMinGap)} gaps below min-gap floor, ${formatNumber(r.droppedAllGapsFloored)} sources with all gaps floored, ${formatNumber(r.droppedSparseSources)} sparse sources, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(
        `window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`,
      ),
    );
  }
  if (r.model !== null) {
    lines.push(chalk.dim(`model filter: ${r.model}`));
  }
  lines.push(
    chalk.dim(
      `(gap = #bucket-widths between consecutive distinct active buckets per source; 1 = contiguous; percentiles nearest-rank R-1)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(
      chalk.yellow(
        '  no source rows in the window after filters. nothing to chart.',
      ),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(`per-source bucket-gap distribution (sorted by ${r.sort} desc)`),
  );
  const headers = [
    'source',
    'buckets',
    'gaps',
    'minGap',
    'p50Gap',
    'p90Gap',
    'p99Gap',
    'maxGap',
    'meanGap',
    'contigShare',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((m) => [
    m.source,
    formatNumber(m.activeBuckets),
    formatNumber(m.gapCount),
    formatNumber(m.minGap),
    formatNumber(m.p50Gap),
    formatNumber(m.p90Gap),
    formatNumber(m.p99Gap),
    formatNumber(m.maxGap),
    m.meanGap.toFixed(2),
    m.contiguousShare.toFixed(3),
    formatNumber(m.tokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceDecayHalfLife(r: SourceDecayHalfLifeReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-decay-half-life'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}    top: ${r.top ?? '-'}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedModelFilter)} by model filter, ${formatNumber(r.droppedSparseSources)} sparse sources, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.model !== null) {
    lines.push(chalk.dim(`model filter: ${r.model}`));
  }
  lines.push(
    chalk.dim(
      `(halfLifeFraction = clock-hours from firstSeen to the bucket where cumulative tokens >= 50% / spanHours; < 0.5 = front-loaded, > 0.5 = back-loaded; frontLoadIndex = 0.5 - halfLifeFraction)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source token half-life (sorted by ${r.sort})`));
  const headers = [
    'source',
    'first-seen (UTC)',
    'last-seen (UTC)',
    'span-hr',
    'active-buckets',
    'tokens',
    'half-life (UTC)',
    'half-life-hr',
    'half-life-frac',
    'front-load-idx',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstSeen,
    s.lastSeen,
    s.spanHours.toFixed(1),
    formatNumber(s.activeBuckets),
    formatNumber(s.tokens),
    s.halfLifeIso,
    s.halfLifeHours.toFixed(1),
    s.halfLifeFraction.toFixed(3),
    (s.frontLoadIndex >= 0 ? '+' : '') + s.frontLoadIndex.toFixed(3),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderBucketHandoffFrequency(r: BucketHandoffFrequencyReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights bucket-handoff-frequency'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    active-buckets: ${formatNumber(r.activeBuckets)}    pairs: ${formatNumber(r.consideredPairs)}    handoffs: ${formatNumber(r.handoffPairs)} (${(r.handoffShare * 100).toFixed(1)}%)    minHandoffs: ${formatNumber(r.minHandoffs)}    topHandoffs: ${formatNumber(r.topHandoffs)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `split: ${formatNumber(r.contiguousPairs)} contiguous pairs (${formatNumber(r.contiguousHandoffs)} handoffs), ${formatNumber(r.gappedPairs)} gapped pairs (${formatNumber(r.gappedHandoffs)} handoffs)`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedEmptyModelBuckets)} empty-model buckets, ${formatNumber(r.droppedBelowMinHandoffs)} below min-handoffs, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  if (r.stickiestModel !== null) {
    lines.push(
      chalk.dim(
        `stickiest model: ${r.stickiestModel} (primary in ${formatNumber(r.stickiestModelBuckets)} of ${formatNumber(r.activeBuckets)} buckets)`,
      ),
    );
  }
  lines.push(
    chalk.dim(
      `(primary model per bucket = max-tokens model, ties broken lex; contiguous pair = exactly 1h apart; handoff = primary changed)`,
    ),
  );
  lines.push('');

  if (r.activeBuckets === 0) {
    lines.push(chalk.yellow('  no active buckets in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }
  if (r.pairs.length === 0) {
    lines.push(chalk.yellow('  no model handoffs detected (all consecutive buckets share a primary model, or topHandoffs=0).'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`top model handoffs (sorted by count desc)`));
  const headers = ['from-model', 'to-model', 'count', 'share-of-handoffs'];
  const rows: string[][] = r.pairs.map((p) => [
    p.from,
    p.to,
    formatNumber(p.count),
    r.handoffPairs > 0 ? ((p.count / r.handoffPairs) * 100).toFixed(1) + '%' : '0.0%',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderInterSourceHandoffLatency(
  r: InterSourceHandoffLatencyReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights inter-source-handoff-latency'));
  const fmtH = (v: number | null): string =>
    v === null ? '-' : v.toFixed(2) + 'h';
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    active-buckets: ${formatNumber(r.activeBuckets)}    pairs: ${formatNumber(r.consideredPairs)}    handoffs: ${formatNumber(r.handoffPairs)} (${(r.handoffShare * 100).toFixed(1)}%)    minHandoffs: ${formatNumber(r.minHandoffs)}    topHandoffs: ${formatNumber(r.topHandoffs)}    maxLatency: ${r.maxLatencyCap === null ? 'none' : r.maxLatencyCap.toFixed(2) + 'h'}`,
    ),
  );
  lines.push(
    chalk.dim(
      `latency: median ${fmtH(r.medianLatencyHours)}    mean ${fmtH(r.meanLatencyHours)}    min ${fmtH(r.minLatencyHours)}    max ${fmtH(r.maxLatencyHours)}    contiguous-handoffs (1h): ${formatNumber(r.contiguousHandoffs)}    gapped: ${formatNumber(r.gappedHandoffs)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedEmptySourceBuckets)} empty-source buckets, ${formatNumber(r.droppedAboveMaxLatency)} above max-latency, ${formatNumber(r.droppedBelowMinHandoffs)} below min-handoffs, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.dominantSource !== null) {
    lines.push(
      chalk.dim(
        `dominant source: ${r.dominantSource} (primary in ${formatNumber(r.dominantSourceBuckets)} of ${formatNumber(r.activeBuckets)} buckets)`,
      ),
    );
  }
  lines.push(
    chalk.dim(
      `(primary source per bucket = max-tokens source, ties broken lex; latency = (next.hour_start - prev.hour_start) in hours; handoff = primary source changed between adjacent active buckets)`,
    ),
  );
  lines.push('');

  if (r.activeBuckets === 0) {
    lines.push(
      chalk.yellow('  no active buckets in the window after filters. nothing to chart.'),
    );
    return lines.join('\n');
  }
  if (r.pairs.length === 0) {
    lines.push(
      chalk.yellow(
        '  no source handoffs detected (all consecutive buckets share a primary source, or topHandoffs=0).',
      ),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `top source handoffs (sorted by count desc, then median-latency asc)`,
    ),
  );
  const headers = [
    'from-source',
    'to-source',
    'count',
    'share-of-handoffs',
    'median-latency',
    'min',
    'max',
  ];
  const rows: string[][] = r.pairs.map((p) => [
    p.from,
    p.to,
    formatNumber(p.count),
    r.handoffPairs > 0
      ? ((p.count / r.handoffPairs) * 100).toFixed(1) + '%'
      : '0.0%',
    p.medianLatencyHours.toFixed(2) + 'h',
    p.minLatencyHours.toFixed(2) + 'h',
    p.maxLatencyHours.toFixed(2) + 'h',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourcePairCooccurrence(
  r: SourcePairCooccurrenceReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-pair-cooccurrence'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    active-buckets: ${formatNumber(r.activeBuckets)}    multi-source: ${formatNumber(r.multiSourceBuckets)} (${(r.cooccurrenceShare * 100).toFixed(1)}%)    total-pairs: ${formatNumber(r.totalPairs)}    distinct-pairs: ${formatNumber(r.distinctPairs)}    minCount: ${formatNumber(r.minCount)}    minJaccard: ${r.minJaccard.toFixed(3)}    topPairs: ${formatNumber(r.topPairs)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedEmptySource)} empty-source rows, ${formatNumber(r.droppedBelowMinCount)} below min-count, ${formatNumber(r.droppedBelowMinJaccard)} below min-jaccard, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.dominantPair !== null) {
    lines.push(
      chalk.dim(
        `dominant pair: ${r.dominantPair.a} + ${r.dominantPair.b} (co-active in ${formatNumber(r.dominantPair.count)} buckets)`,
      ),
    );
  }
  lines.push(
    chalk.dim(
      `(unordered pair {a,b}; count = buckets with both active; jaccard = |buckets(a) ∩ buckets(b)| / |union|; share = count / total-pairs)`,
    ),
  );
  lines.push('');

  if (r.activeBuckets === 0) {
    lines.push(
      chalk.yellow('  no active buckets in the window after filters. nothing to chart.'),
    );
    return lines.join('\n');
  }
  if (r.pairs.length === 0) {
    lines.push(
      chalk.yellow(
        '  no source co-occurrences detected (every bucket has a single source, or topPairs=0).',
      ),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `top source co-occurrences (sorted by count desc, then jaccard desc)`,
    ),
  );
  const headers = ['source-a', 'source-b', 'count', 'share', 'jaccard'];
  const rows: string[][] = r.pairs.map((p) => [
    p.a,
    p.b,
    formatNumber(p.count),
    (p.share * 100).toFixed(1) + '%',
    p.jaccard.toFixed(3),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderProviderTenure(r: ProviderTenureReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights provider-tenure'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    providers: ${formatNumber(r.totalProviders)} (shown ${formatNumber(r.providers.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedSparseProviders)} below min-buckets, ${formatNumber(r.droppedTopProviders)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(provider rolled up from normalised model id; spanHours = clock hours first->last across any model from this vendor; activeBuckets = distinct hour_start values touched)`,
    ),
  );
  lines.push('');

  if (r.providers.length === 0) {
    lines.push(chalk.yellow('  no provider rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-provider tenure (sorted by ${r.sort} desc)`));
  const headers = [
    'provider',
    'first-seen (UTC)',
    'last-seen (UTC)',
    'span-hr',
    'active-buckets',
    'distinct-models',
    'tokens',
    'tok/bucket',
    'tok/span-hr',
  ];
  const rows: string[][] = r.providers.map((p) => [
    p.provider,
    p.firstSeen,
    p.lastSeen,
    p.spanHours.toFixed(1),
    formatNumber(p.activeBuckets),
    formatNumber(p.distinctModels),
    formatNumber(p.tokens),
    formatNumber(Math.round(p.tokensPerActiveBucket)),
    formatNumber(Math.round(p.tokensPerSpanHour)),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderFirstBucketOfDay(r: FirstBucketOfDayReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights first-bucket-of-day'));
  const fmtH = (h: number | null) => (h === null ? '-' : h.toString().padStart(2, '0'));
  const fmtHF = (h: number | null) => (h === null ? '-' : h.toFixed(2));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    days: ${formatNumber(r.distinctDays)} (shown ${formatNumber(r.days.length)})    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `firstHour UTC: min=${fmtH(r.firstHourMin)} p25=${fmtH(r.firstHourP25)} median=${fmtH(r.firstHourMedian)} mean=${fmtHF(r.firstHourMean)} p75=${fmtH(r.firstHourP75)} max=${fmtH(r.firstHourMax)} mode=${fmtH(r.firstHourMode)} (n=${formatNumber(r.firstHourModeCount)}, share=${(r.firstHourModeShare * 100).toFixed(1)}%)`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedTopDays)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per UTC calendar day: firstBucket = earliest hour_start with positive total_tokens; firstHour = its UTC hour-of-day)`,
    ),
  );
  lines.push('');

  if (r.days.length === 0) {
    lines.push(chalk.yellow('  no day rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-day first bucket (sorted by ${r.sort}${r.sort === 'first-hour' ? ' asc' : ' desc'})`));
  const headers = [
    'day (UTC)',
    'first-bucket (UTC)',
    'first-hour',
    'buckets-on-day',
    'tokens-on-day',
  ];
  const rows: string[][] = r.days.map((d) => [
    d.day,
    d.firstBucket,
    d.firstHour.toString().padStart(2, '0'),
    formatNumber(d.bucketsOnDay),
    formatNumber(d.tokensOnDay),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderLastBucketOfDay(r: LastBucketOfDayReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights last-bucket-of-day'));
  const fmtH = (h: number | null) => (h === null ? '-' : h.toString().padStart(2, '0'));
  const fmtHF = (h: number | null) => (h === null ? '-' : h.toFixed(2));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    days: ${formatNumber(r.distinctDays)} (shown ${formatNumber(r.days.length)})    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `lastHour UTC: min=${fmtH(r.lastHourMin)} p25=${fmtH(r.lastHourP25)} median=${fmtH(r.lastHourMedian)} mean=${fmtHF(r.lastHourMean)} p75=${fmtH(r.lastHourP75)} max=${fmtH(r.lastHourMax)} mode=${fmtH(r.lastHourMode)} (n=${formatNumber(r.lastHourModeCount)}, share=${(r.lastHourModeShare * 100).toFixed(1)}%)`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedTopDays)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per UTC calendar day: lastBucket = latest hour_start with positive total_tokens; lastHour = its UTC hour-of-day; mode tiebreak: latest hour wins)`,
    ),
  );
  lines.push('');

  if (r.days.length === 0) {
    lines.push(chalk.yellow('  no day rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-day last bucket (sorted by ${r.sort}${r.sort === 'last-hour' ? ' desc' : ' desc'})`));
  const headers = [
    'day (UTC)',
    'last-bucket (UTC)',
    'last-hour',
    'buckets-on-day',
    'tokens-on-day',
  ];
  const rows: string[][] = r.days.map((d) => [
    d.day,
    d.lastBucket,
    d.lastHour.toString().padStart(2, '0'),
    formatNumber(d.bucketsOnDay),
    formatNumber(d.tokensOnDay),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderActiveSpanPerDay(r: ActiveSpanPerDayReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights active-span-per-day'));
  const fmtH = (h: number | null) => (h === null ? '-' : h.toString().padStart(2, '0'));
  const fmtN = (n: number | null) => (n === null ? '-' : String(n));
  const fmtF2 = (n: number | null) => (n === null ? '-' : n.toFixed(2));
  const fmtPct = (n: number | null) => (n === null ? '-' : (n * 100).toFixed(1) + '%');
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    days: ${formatNumber(r.distinctDays)} (shown ${formatNumber(r.days.length)})    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `spanHours: min=${fmtN(r.spanHoursMin)} p25=${fmtN(r.spanHoursP25)} median=${fmtN(r.spanHoursMedian)} mean=${fmtF2(r.spanHoursMean)} p75=${fmtN(r.spanHoursP75)} max=${fmtN(r.spanHoursMax)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dutyCycle: min=${fmtPct(r.dutyCycleMin)} p25=${fmtPct(r.dutyCycleP25)} median=${fmtPct(r.dutyCycleMedian)} mean=${fmtPct(r.dutyCycleMean)} p75=${fmtPct(r.dutyCycleP75)} max=${fmtPct(r.dutyCycleMax)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedShortSpanDays)} below min-span floor, ${formatNumber(r.droppedTopDays)} below top cap`,
    ),
  );
  if (r.minSpan > 0) {
    lines.push(chalk.dim(`min-span floor: ${r.minSpan} (drops days with spanHours < ${r.minSpan} from stats AND days[])`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per UTC calendar day: spanHours = lastHour - firstHour + 1; dutyCycle = activeBuckets / spanHours, in (0, 1])`,
    ),
  );
  lines.push('');

  if (r.days.length === 0) {
    lines.push(chalk.yellow('  no day rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  const sortLabel =
    r.sort === 'day' ? 'day desc' : r.sort + ' desc';
  lines.push(chalk.bold(`per-day active span (sorted by ${sortLabel})`));
  const headers = [
    'day (UTC)',
    'first-hour',
    'last-hour',
    'span-hours',
    'active-buckets',
    'duty-cycle',
    'tokens-on-day',
  ];
  const rows: string[][] = r.days.map((d) => [
    d.day,
    fmtH(d.firstHour),
    fmtH(d.lastHour),
    String(d.spanHours),
    String(d.activeBuckets),
    (d.dutyCycle * 100).toFixed(1) + '%',
    formatNumber(d.tokensOnDay),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceBreadthPerDay(r: SourceBreadthPerDayReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-breadth-per-day'));
  const fmtN = (n: number | null) => (n === null ? '-' : String(n));
  const fmtF2 = (n: number | null) => (n === null ? '-' : n.toFixed(2));
  const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    days: ${formatNumber(r.distinctDays)} (shown ${formatNumber(r.days.length)})    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `sourceCount: min=${fmtN(r.sourceCountMin)} p25=${fmtN(r.sourceCountP25)} median=${fmtN(r.sourceCountMedian)} mean=${fmtF2(r.sourceCountMean)} p75=${fmtN(r.sourceCountP75)} max=${fmtN(r.sourceCountMax)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `single-source: ${formatNumber(r.singleSourceDays)}    multi-source: ${formatNumber(r.multiSourceDays)}    multi-share: ${fmtPct(r.multiSourceShare)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedEmptySource)} empty source, ${formatNumber(r.droppedBelowMinSources)} below min-sources floor, ${formatNumber(r.droppedTopDays)} below top cap`,
    ),
  );
  if (r.minSources > 0) {
    lines.push(chalk.dim(`min-sources floor: ${r.minSources} (drops days with sourceCount < ${r.minSources} from stats AND days[])`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}    (note: degenerates sourceCount to 1 by definition)`));
  }
  lines.push(
    chalk.dim(
      `(per UTC calendar day: distinct sources with > 0 tokens; sourceCount in [1, N])`,
    ),
  );
  lines.push('');

  if (r.days.length === 0) {
    lines.push(chalk.yellow('  no day rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  const sortLabel = r.sort === 'day' ? 'day desc' : r.sort + ' desc';
  lines.push(chalk.bold(`per-day source breadth (sorted by ${sortLabel})`));
  const headers = [
    'day (UTC)',
    'sources',
    'source-list',
    'buckets',
    'tokens',
  ];
  const rows: string[][] = r.days.map((d) => [
    d.day,
    String(d.sourceCount),
    d.sources,
    String(d.bucketsOnDay),
    formatNumber(d.tokensOnDay),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderBucketDensityPercentile(
  r: BucketDensityPercentileReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights bucket-density-percentile'));
  const fmtN = (n: number | null) => (n === null ? '-' : formatNumber(n));
  const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    buckets: ${formatNumber(r.totalBuckets)}    tokens: ${formatNumber(r.totalTokens)}    mean: ${r.mean === null ? '-' : formatNumber(Math.round(r.mean))}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedBelowMinTokens)} below min-tokens floor, ${formatNumber(r.droppedTrimTop)} by trim-top`,
    ),
  );
  if (r.minTokens > 0) {
    lines.push(chalk.dim(`min-tokens floor: ${formatNumber(r.minTokens)} (drops buckets with total_tokens < ${formatNumber(r.minTokens)})`));
  }
  if (r.trimTopPct > 0) {
    lines.push(chalk.dim(`trim-top: ${r.trimTopPct}% (drops floor(N * pct/100) largest buckets before percentile/decile computation)`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push('');

  if (r.totalBuckets === 0) {
    lines.push(chalk.yellow('  no bucket observations after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('percentile ladder (tokens per bucket)'));
  const pHeaders = ['p', 'tokens'];
  const pRows: string[][] = [
    ['min', fmtN(r.min)],
    ['p1', fmtN(r.p1)],
    ['p5', fmtN(r.p5)],
    ['p10', fmtN(r.p10)],
    ['p25', fmtN(r.p25)],
    ['p50', fmtN(r.p50)],
    ['p75', fmtN(r.p75)],
    ['p90', fmtN(r.p90)],
    ['p95', fmtN(r.p95)],
    ['p99', fmtN(r.p99)],
    ['p99.9', fmtN(r.p999)],
    ['max', fmtN(r.max)],
  ];
  lines.push(renderTableLocal(pHeaders, pRows));
  lines.push('');
  lines.push(chalk.bold('decile mass distribution (D1 = smallest, D10 = top 10%)'));
  const dHeaders = ['decile', 'count', 'tokens', 'share', 'lower', 'upper'];
  const dRows: string[][] = r.deciles.map((d) => [
    'D' + String(d.decile),
    String(d.count),
    formatNumber(d.tokens),
    fmtPct(d.tokenShare),
    formatNumber(d.lowerEdge),
    formatNumber(d.upperEdge),
  ]);
  lines.push(renderTableLocal(dHeaders, dRows));

  return lines.join('\n').replace(/\n+$/, '');
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function renderHourOfWeek(r: HourOfWeekReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights hour-of-week'));
  const fmtPct = (n: number) => (n * 100).toFixed(1) + '%';
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    buckets: ${formatNumber(r.totalBuckets)}    tokens: ${formatNumber(r.totalTokens)}    populated: ${r.populatedCells}/168    dead: ${r.deadCells}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedModelFilter)} by model filter, ${formatNumber(r.droppedSparseCells)} cells by min-cell-tokens floor`,
    ),
  );
  if (r.minCellTokens > 0) {
    lines.push(chalk.dim(`min-cell-tokens floor: ${formatNumber(r.minCellTokens)} (drops cells with tokens < ${formatNumber(r.minCellTokens)} from topCells[])`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  if (r.model !== null) {
    lines.push(chalk.dim(`model filter: ${r.model}`));
  }
  lines.push('');

  if (r.totalTokens === 0) {
    lines.push(chalk.yellow('  no token observations after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('concentration metrics'));
  const cHeaders = ['metric', 'value'];
  const cRows: string[][] = [
    ['entropy (bits)', r.entropyBits.toFixed(3) + ' / 7.392 max'],
    ['normalised entropy', r.normalisedEntropy.toFixed(3) + '  (1.0 = uniform)'],
    ['gini', r.gini.toFixed(3) + '  (0 = uniform, 1 = single-cell)'],
    [`top-${r.topK} cell mass share`, fmtPct(r.topKShare)],
  ];
  lines.push(renderTableLocal(cHeaders, cRows));
  lines.push('');

  lines.push(chalk.bold(`top ${r.topCells.length} cells (UTC weekday × hour)`));
  const tHeaders = ['weekday', 'hour (UTC)', 'tokens', 'share', 'buckets'];
  const tRows: string[][] = r.topCells.map((c) => [
    WEEKDAY_LABELS[c.weekday - 1] ?? String(c.weekday),
    String(c.hour).padStart(2, '0') + ':00',
    formatNumber(c.tokens),
    fmtPct(c.tokenShare),
    String(c.buckets),
  ]);
  lines.push(renderTableLocal(tHeaders, tRows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderDeviceTenure(r: DeviceTenureReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights device-tenure'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    devices: ${formatNumber(r.totalDevices)} (shown ${formatNumber(r.devices.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}    sort: ${r.sort}    recentThreshold: ${r.recentThresholdHours}h    recentlyActive: ${formatNumber(r.recentlyActiveCount)}/${formatNumber(r.totalDevices)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedModelFilter)} by model filter, ${formatNumber(r.droppedSparseDevices)} sparse devices, ${formatNumber(r.droppedTopDevices)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  if (r.model !== null) {
    lines.push(chalk.dim(`model filter: ${r.model}`));
  }
  lines.push(
    chalk.dim(
      `(spanHours = clock hours first->last; activeBuckets = distinct hour_start values; distinctSources/Models = unique tags seen on this device)`,
    ),
  );
  lines.push('');

  if (r.devices.length === 0) {
    lines.push(chalk.yellow('  no device rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-device tenure (sorted by ${r.sort} desc)`));
  const headers = [
    'device',
    'first-seen (UTC)',
    'last-seen (UTC)',
    'span-hr',
    'active-buckets',
    'tokens',
    'tok/bucket',
    'tok/span-hr',
    'sources',
    'models',
    'longest-gap-hr',
    'hr-since-last',
    'recent',
  ];
  const rows: string[][] = r.devices.map((d) => [
    d.device,
    d.firstSeen,
    d.lastSeen,
    d.spanHours.toFixed(1),
    formatNumber(d.activeBuckets),
    formatNumber(d.tokens),
    formatNumber(Math.round(d.tokensPerActiveBucket)),
    formatNumber(Math.round(d.tokensPerSpanHour)),
    formatNumber(d.distinctSources),
    formatNumber(d.distinctModels),
    d.longestGapHours.toFixed(1),
    d.hoursSinceLastSeen.toFixed(1),
    d.recentlyActive ? 'yes' : 'no',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

import type { PromptOutputCorrelationReport } from './promptoutputcorrelation.js';

export function renderPromptOutputCorrelation(
  r: PromptOutputCorrelationReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights prompt-output-correlation'));
  const outLabel = r.includeReasoning ? 'out+r' : 'out';
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    groups: ${formatNumber(r.totalGroups)} (shown ${formatNumber(r.groups.length)})    active-buckets: ${formatNumber(r.totalActiveBuckets)}    tokens: ${formatNumber(r.totalTokens)}    in: ${formatNumber(r.totalInputTokens)}    ${outLabel}: ${formatNumber(r.totalOutputTokens)}    minBuckets: ${r.minBuckets}    minTokens: ${formatNumber(r.minTokens)}    sort: ${r.sort}    global r: ${r.globalDegenerate ? '—' : r.globalPearsonR.toFixed(3)}    global slope: ${r.globalDegenerate ? '—' : r.globalSlope.toFixed(3)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero/non-finite tokens, ${formatNumber(r.droppedBySourceFilter)} by source filter, ${formatNumber(r.droppedByModelFilter)} by model filter, ${formatNumber(r.droppedSparseGroups)} below min-buckets, ${formatNumber(r.droppedLowTokenGroups)} below min-tokens, ${formatNumber(r.droppedTopGroups)} below top cap`,
    ),
  );
  if (r.sourceFilter || r.modelFilter) {
    lines.push(
      chalk.dim(
        `filters: source=${r.sourceFilter ?? '*'}    model=${r.modelFilter ?? '*'}`,
      ),
    );
  }
  if (r.includeReasoning) {
    lines.push(
      chalk.dim(
        'y-axis includes reasoning_output_tokens (totalOutputTokens = visible output + reasoning)',
      ),
    );
  }
  lines.push(
    chalk.dim(
      '(pearson r in [-1,+1] over per-bucket (input_tokens, output_tokens) pairs; slope/intercept = OLS y = slope*x + intercept; degenerate=yes when stdInput or stdOutput is 0)',
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push('');

  if (r.groups.length === 0) {
    lines.push(
      chalk.yellow('  no groups passed the min-buckets floor. nothing to fit.'),
    );
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-${r.by} prompt→output correlation (sorted by ${r.sort} desc, lex tiebreak)`,
    ),
  );
  const headers = [
    r.by,
    'tokens',
    'in',
    r.includeReasoning ? 'out+r' : 'out',
    'buckets',
    'mean-in',
    r.includeReasoning ? 'mean-out+r' : 'mean-out',
    'std-in',
    r.includeReasoning ? 'std-out+r' : 'std-out',
    'r',
    'slope',
    'intercept',
    'degen',
  ];
  const rows: string[][] = r.groups.map((g) => [
    g.model,
    formatNumber(g.totalTokens),
    formatNumber(g.totalInputTokens),
    formatNumber(g.totalOutputTokens),
    String(g.activeBuckets),
    formatNumber(Math.round(g.meanInput)),
    formatNumber(Math.round(g.meanOutput)),
    formatNumber(Math.round(g.stdInput)),
    formatNumber(Math.round(g.stdOutput)),
    g.degenerate ? '—' : g.pearsonR.toFixed(3),
    g.degenerate ? '—' : g.slope.toFixed(3),
    g.degenerate ? '—' : Math.round(g.intercept).toString(),
    g.degenerate ? 'yes' : 'no',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderProviderSwitchingFrequency(
  r: ProviderSwitchingFrequencyReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights provider-switching-frequency'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    active-days: ${formatNumber(r.activeDays)}    active-buckets: ${formatNumber(r.activeBuckets)}    same-day-pairs: ${formatNumber(r.consideredPairs)}    switches: ${formatNumber(r.switchPairs)} (${(r.switchShare * 100).toFixed(1)}%)    mean/day: ${r.meanSwitchesPerActiveDay.toFixed(2)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `cross-day: ${formatNumber(r.crossDayPairs)} pairs, ${formatNumber(r.crossDaySwitches)} switches    days-with-any-switch: ${formatNumber(r.daysWithAnySwitch)}/${formatNumber(r.activeDays)} (${(r.dayCoverage * 100).toFixed(1)}%)    sort: ${r.sort}    topPairs: ${formatNumber(r.topPairs)}    topDays: ${formatNumber(r.topDays)}    minSwitches: ${formatNumber(r.minSwitches)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedEmptyModelBuckets)} empty-model buckets, ${formatNumber(r.droppedBelowTopCap)} pairs below top cap, ${formatNumber(r.droppedBelowMinSwitches)} days below min-switches, ${formatNumber(r.droppedTopDays)} days below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(primary provider per bucket = classifyProvider of max-tokens model; switch = same-day adjacent buckets with different primary provider)`,
    ),
  );
  lines.push('');

  if (r.activeBuckets === 0) {
    lines.push(chalk.yellow('  no active buckets in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  if (r.pairs.length > 0) {
    lines.push(chalk.bold(`top provider switches (sorted by count desc)`));
    const headers = ['from-provider', 'to-provider', 'count', 'share-of-switches'];
    const rows: string[][] = r.pairs.map((p) => [
      p.from,
      p.to,
      formatNumber(p.count),
      r.switchPairs > 0 ? ((p.count / r.switchPairs) * 100).toFixed(1) + '%' : '0.0%',
    ]);
    lines.push(renderTableLocal(headers, rows));
    lines.push('');
  } else {
    lines.push(chalk.yellow('  no same-day provider switches detected.'));
    lines.push('');
  }

  if (r.days.length > 0) {
    lines.push(chalk.bold(`per-day rows (sort: ${r.sort})`));
    const headers = [
      'day',
      'buckets',
      'pairs',
      'switches',
      'switch-share',
      'dominant-provider',
      'dom-buckets',
    ];
    const rows: string[][] = r.days.map((d) => [
      d.day,
      formatNumber(d.activeBuckets),
      formatNumber(d.consideredPairs),
      formatNumber(d.switchPairs),
      (d.switchShare * 100).toFixed(1) + '%',
      d.dominantProvider,
      formatNumber(d.dominantProviderBuckets),
    ]);
    lines.push(renderTableLocal(headers, rows));
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderOutputTokenDecileDistribution(
  r: OutputTokenDecileDistributionReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights output-token-decile-distribution'));
  const fmtPctN = (n: number | null) =>
    n === null ? '-' : (n * 100).toFixed(2) + '%';
  const fmtGini = (n: number | null) => (n === null ? '-' : n.toFixed(4));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    buckets: ${formatNumber(r.bucketCount)}    output-tokens: ${formatNumber(r.totalOutputTokens)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `concentration: gini=${fmtGini(r.gini)}    top-10% share=${fmtPctN(r.p90Share)}    top-1% share=${fmtPctN(r.p99Share)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedInvalidOutput)} bad output_tokens, ${formatNumber(r.droppedZeroOutput)} zero-output, ${formatNumber(r.droppedBelowMinOutput)} below min-output floor, ${formatNumber(r.droppedSourceFilter)} by source filter`,
    ),
  );
  if (r.minOutput > 0) {
    lines.push(chalk.dim(`min-output floor: ${formatNumber(r.minOutput)} (drops bucket rows with output_tokens < ${formatNumber(r.minOutput)} before partitioning)`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(
        `window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`,
      ),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(rank all positive-output buckets ascending; partition into 10 equal-sized deciles; D1 = lightest, D10 = heaviest)`,
    ),
  );
  lines.push('');

  if (r.bucketCount === 0) {
    lines.push(
      chalk.yellow(
        '  no positive-output bucket rows in the window after filters. nothing to chart.',
      ),
    );
    return lines.join('\n');
  }

  lines.push(chalk.bold('per-decile output-token mass'));
  const headers = [
    'decile',
    'buckets',
    'min-out',
    'mean-out',
    'max-out',
    'tokens-in-decile',
    'share',
  ];
  const rows: string[][] = r.deciles.map((d) => [
    'D' + d.decile,
    formatNumber(d.bucketCount),
    formatNumber(d.minOutput),
    d.bucketCount === 0 ? '0' : Math.round(d.meanOutput).toLocaleString('en-US'),
    formatNumber(d.maxOutput),
    formatNumber(d.tokensInDecile),
    (d.shareOfTokens * 100).toFixed(2) + '%',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderInputTokenDecileDistribution(
  r: InputTokenDecileDistributionReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights input-token-decile-distribution'));
  const fmtPctN = (n: number | null) =>
    n === null ? '-' : (n * 100).toFixed(2) + '%';
  const fmtGini = (n: number | null) => (n === null ? '-' : n.toFixed(4));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    buckets: ${formatNumber(r.bucketCount)}    input-tokens: ${formatNumber(r.totalInputTokens)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `concentration: gini=${fmtGini(r.gini)}    top-10% share=${fmtPctN(r.p90Share)}    top-1% share=${fmtPctN(r.p99Share)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedInvalidInput)} bad input_tokens, ${formatNumber(r.droppedZeroInput)} zero-input, ${formatNumber(r.droppedBelowMinInput)} below min-input floor, ${formatNumber(r.droppedSourceFilter)} by source filter`,
    ),
  );
  if (r.minInput > 0) {
    lines.push(chalk.dim(`min-input floor: ${formatNumber(r.minInput)} (drops bucket rows with input_tokens < ${formatNumber(r.minInput)} before partitioning)`));
  }
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(
        `window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`,
      ),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(rank all positive-input buckets ascending; partition into 10 equal-sized deciles; D1 = lightest, D10 = heaviest)`,
    ),
  );
  lines.push('');

  if (r.bucketCount === 0) {
    lines.push(
      chalk.yellow(
        '  no positive-input bucket rows in the window after filters. nothing to chart.',
      ),
    );
    return lines.join('\n');
  }

  lines.push(chalk.bold('per-decile input-token mass'));
  const headers = [
    'decile',
    'buckets',
    'min-in',
    'mean-in',
    'max-in',
    'tokens-in-decile',
    'share',
  ];
  const rows: string[][] = r.deciles.map((d) => [
    'D' + d.decile,
    formatNumber(d.bucketCount),
    formatNumber(d.minInput),
    d.bucketCount === 0 ? '0' : Math.round(d.meanInput).toLocaleString('en-US'),
    formatNumber(d.maxInput),
    formatNumber(d.tokensInDecile),
    (d.shareOfTokens * 100).toFixed(2) + '%',
  ]);
  lines.push(renderTableLocal(headers, rows));

  if (r.topBuckets.length > 0) {
    lines.push('');
    lines.push(chalk.bold(`top ${r.topBuckets.length} heaviest individual buckets`));
    const topHeaders = ['rank', 'hour_start', 'source', 'model', 'input-tokens', 'decile', 'share'];
    const topRows: string[][] = r.topBuckets.map((b, i) => [
      String(i + 1),
      b.hourStart,
      b.source,
      b.model,
      formatNumber(b.inputTokens),
      'D' + b.decile,
      (b.shareOfTotal * 100).toFixed(2) + '%',
    ]);
    lines.push(renderTableLocal(topHeaders, topRows));
  }

  if (r.bottomBuckets.length > 0) {
    lines.push('');
    lines.push(chalk.bold(`bottom ${r.bottomBuckets.length} lightest individual buckets`));
    const botHeaders = ['rank', 'hour_start', 'source', 'model', 'input-tokens', 'decile', 'share'];
    const botRows: string[][] = r.bottomBuckets.map((b, i) => [
      String(i + 1),
      b.hourStart,
      b.source,
      b.model,
      formatNumber(b.inputTokens),
      'D' + b.decile,
      (b.shareOfTotal * 100).toFixed(2) + '%',
    ]);
    lines.push(renderTableLocal(botHeaders, botRows));
  }

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderTokenVelocityPercentiles(
  r: import('./tokenvelocitypercentiles.js').TokenVelocityPercentilesReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights token-velocity-percentiles'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    buckets: ${formatNumber(r.totalBuckets)}    tokens: ${formatNumber(r.totalTokens)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedRateMin)} below rate-min, ${formatNumber(r.droppedMinBuckets)} below min-buckets, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(observation = one (source, UTC hour_start) bucket; rate = total_tokens / 60 minutes; percentiles are nearest-rank R-1)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source tokens-per-minute summary (sorted by ${r.sort} desc)`));
  const headers = [
    'source',
    'buckets',
    'tokens',
    'min/min',
    'p50/min',
    'p90/min',
    'p99/min',
    'max/min',
    'mean/min',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.buckets),
    formatNumber(s.tokens),
    s.min.toFixed(1),
    s.p50.toFixed(1),
    s.p90.toFixed(1),
    s.p99.toFixed(1),
    s.max.toFixed(1),
    s.mean.toFixed(1),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtUsd(n: number): string {
  if (!Number.isFinite(n)) return '-';
  if (n === 0) return '$0.00';
  if (Math.abs(n) < 0.01) return `$${n.toFixed(4)}`;
  if (Math.abs(n) < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function renderCostPerBucketPercentiles(
  r: import('./costperbucketpercentiles.js').CostPerBucketPercentilesReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights cost-per-bucket-percentiles'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    buckets: ${formatNumber(r.totalBuckets)}    cost: ${fmtUsd(r.totalCost)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.unknownModelRows)} unknown-model rows, ${formatNumber(r.droppedZeroCost)} zero-cost buckets, ${formatNumber(r.droppedMinCost)} below min-cost, ${formatNumber(r.droppedTopBuckets)} below top-buckets cap, ${formatNumber(r.droppedMinBuckets)} below min-buckets, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(observation = one (source, UTC hour_start) bucket; cost summed across rows in that bucket; percentiles are nearest-rank R-1)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows in the window after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source dollars-per-bucket summary (sorted by ${r.sort} desc)`));
  const headers = [
    'source',
    'buckets',
    'cost',
    'min',
    'p50',
    'p90',
    'p99',
    'max',
    'mean',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.buckets),
    fmtUsd(s.cost),
    fmtUsd(s.min),
    fmtUsd(s.p50),
    fmtUsd(s.p90),
    fmtUsd(s.p99),
    fmtUsd(s.max),
    fmtUsd(s.mean),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderRollingBucketCv(
  r: import('./rollingbucketcv.js').RollingBucketCvReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights rolling-bucket-cv'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    windows: ${formatNumber(r.totalWindows)}    tokens: ${formatNumber(r.totalTokens)}    window-size: ${r.windowSize} active buckets`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedSparseSources)} sources too sparse for window, ${formatNumber(r.droppedLowCvWindows)} below min-window-cv, ${formatNumber(r.droppedAllWindowsFloored)} sources with all windows floored, ${formatNumber(r.droppedMinBuckets)} below min-buckets, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(observation = CV (stddev/mean, pop) of token-per-bucket within a window of ${r.windowSize} consecutive active buckets per source; window slides by one active bucket; percentiles nearest-rank R-1)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('per-source rolling-window CV distribution (sorted by tokens desc)'));
  const headers = [
    'source',
    'buckets',
    'windows',
    'globalCv',
    'minCv',
    'p50Cv',
    'p90Cv',
    'maxCv',
    'meanCv',
    'peak window start',
  ];
  const rowsR: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.activeBuckets),
    formatNumber(s.windowCount),
    s.globalCv.toFixed(3),
    s.minCv.toFixed(3),
    s.p50Cv.toFixed(3),
    s.p90Cv.toFixed(3),
    s.maxCv.toFixed(3),
    s.meanCv.toFixed(3),
      s.peakWindowStart ?? '-',
  ]);
  lines.push(renderTableLocal(headers, rowsR));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderDailyTokenAutocorrelationLag1(
  r: import('./dailytokenautocorrelationlag1.js').DailyTokenAutocorrelationLag1Report,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights daily-token-autocorrelation-lag1'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedSparseSources)} below min-days, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(observation = lag-1 Pearson autocorrelation of per-source daily total_tokens; rho1Active uses consecutive *active* days, rho1Filled gap-fills missing calendar days inside [first, last] with 0; constant series surface as flat=true with rho1=0)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source lag-1 autocorrelation (sorted by ${r.sort} desc)`));
  const headers2 = [
    'source',
    'tokens',
    'nActive',
    'nFilled',
    'mean',
    'stddev',
    'rho1Active',
    'flatA',
    'rho1Filled',
    'flatF',
    'first',
    'last',
  ];
  const rowsR2: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.totalTokens),
    formatNumber(s.nActiveDays),
    formatNumber(s.nFilledDays),
    s.mean.toFixed(1),
    s.stddev.toFixed(1),
    s.rho1Active.toFixed(3),
    s.flatActive ? 'y' : '-',
    s.rho1Filled.toFixed(3),
    s.flatFilled ? 'y' : '-',
    s.firstActiveDay,
    s.lastActiveDay,
  ]);
  lines.push(renderTableLocal(headers2, rowsR2));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderDailyTokenZscoreExtremes(
  r: import('./dailytokenzscoreextremes.js').DailyTokenZscoreExtremesReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights daily-token-zscore-extremes'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    sigma: ${r.sigma}    min-extreme: ${r.minExtreme}    direction: ${r.direction ?? '\u2014'}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-days, ${formatNumber(r.droppedBelowMinExtreme)} below min-extreme, ${formatNumber(r.droppedByDirection)} by direction, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`));
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(z = (dailyTokens - sourceMean) / sourceStddev (population, 1/n divisor); high/low extreme = strict z > +sigma / z < -sigma; flat=y means stddev=0 across active days, so no z is defined)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold(`per-source z-score extremes (sorted by ${r.sort})`));
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'nDays',
    'mean',
    'stddev',
    'flat',
    'nHigh',
    'nLow',
    'nExtreme',
    'extFrac',
    'maxAbsZ',
    'maxZDay',
    'maxZTokens',
    'dir',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstActiveDay,
    s.lastActiveDay,
    formatNumber(s.nActiveDays),
    s.mean.toFixed(1),
    s.stddev.toFixed(1),
    s.flat ? 'y' : '-',
    formatNumber(s.nHighExtreme),
    formatNumber(s.nLowExtreme),
    formatNumber(s.nExtreme),
    s.extremeFraction.toFixed(3),
    s.maxAbsZ.toFixed(3),
    s.maxAbsZDay || '-',
    s.maxAbsZDay ? formatNumber(s.maxAbsZTokens) : '-',
    s.maxAbsZDirection,
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}
import type { SourceRunLengthsReport } from './sourcerunlengths.js';
import type {
  HourOfDaySourceMixEntropyReport,
  HourOfDaySourceMixEntropyRow,
} from './hourofdaysourcemixentropy.js';
import type {
  BucketTokenGiniReport,
  BucketTokenGiniRow,
} from './buckettokengini.js';
import type {
  HourOfDayTokenSkewReport,
  HourOfDayTokenSkewRow,
} from './hourofdaytokenskew.js';
import type {
  SourceRankChurnReport,
  SourceRankChurnSourceRow,
} from './sourcerankchurn.js';
import type {
  SourceDebutRecencyReport,
  SourceDebutRecencyRow,
} from './sourcedebutrecency.js';

function fmtRunLen(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}

function fmtBits(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

function fmtHour2(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

export function renderHourOfDaySourceMixEntropy(
  r: HourOfDaySourceMixEntropyReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights hour-of-day-source-mix-entropy'));
  const filterDesc = r.filterSources === null ? '—' : `[${r.filterSources.join(',')}]`;
  const topKDesc = r.topK === null ? '—' : String(r.topK);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    shown: ${formatNumber(r.hours.length)}    occupied: ${formatNumber(r.occupiedHours)}/24    tokens: ${formatTokens(r.totalTokens)}    minTokens: ${formatNumber(r.minTokens)}    topK: ${topKDesc}    filterSources: ${filterDesc}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedByFilterSource)} by filter, ${formatNumber(r.droppedSparseHours)} sparse hours, ${formatNumber(r.droppedBelowTopK)} below topK`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(
    chalk.dim(
      '(per UTC hour-of-day: H = -Σ p_i log2 p_i over per-source token share; max = log2(sources))',
    ),
  );
  lines.push('');

  if (r.hours.length === 0) {
    lines.push(chalk.yellow('  no occupied hours in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('global rollup (token-weighted, computed on full kept set pre-topK)'));
  lines.push(
    renderTableLocal(
      ['summary', 'value'],
      [
        ['occupiedHours', formatNumber(r.occupiedHours)],
        ['weightedMeanEntropyBits', fmtBits(r.weightedMeanEntropyBits)],
        ['weightedMeanNormalizedEntropy', formatPercentLocal(r.weightedMeanNormalizedEntropy)],
        ['monoSourceHourCount', formatNumber(r.monoSourceHourCount)],
      ],
    ),
  );
  lines.push('');

  lines.push(
    chalk.bold(
      r.topK === null
        ? 'per hour-of-day source-mix entropy (UTC, sorted by hour asc)'
        : `top ${r.topK} hour-of-day buckets by entropy bits desc (UTC, ties: hour asc)`,
    ),
  );
  const headers = [
    'hour',
    'tokens',
    'sources',
    'H bits',
    'maxH',
    'normH',
    'effSources',
    'topSource',
    'topShare',
  ];
  const rows: string[][] = r.hours.map((h: HourOfDaySourceMixEntropyRow) => [
    fmtHour2(h.hour),
    formatTokens(h.totalTokens),
    formatNumber(h.sourceCount),
    fmtBits(h.entropyBits),
    fmtBits(h.maxEntropyBits),
    formatPercentLocal(h.normalizedEntropy),
    fmtBits(h.effectiveSources),
    h.topSource,
    formatPercentLocal(h.topSourceShare),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceRunLengths(r: SourceRunLengthsReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-run-lengths'));
  const filterDesc = r.filterSources === null ? '—' : `[${r.filterSources.join(',')}]`;
  const topDesc = r.top === null ? '—' : String(r.top);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sessions: ${formatNumber(r.consideredSessions)}    runs: ${formatNumber(r.totalRuns)}    sources: ${formatNumber(r.sources.length)}    minRuns: ${r.minRuns}    top: ${topDesc}    filterSources: ${filterDesc}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidStart)} bad started_at, ${formatNumber(r.droppedEmptySource)} empty source, ${formatNumber(r.droppedByFilterSource)} by filter, ${formatNumber(r.droppedSparseSources)} sparse sources, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(
    chalk.dim(
      '(run = maximal contiguous stretch of same-source sessions ordered by started_at; percentiles nearest-rank)',
    ),
  );
  lines.push('');

  if (r.totalRuns === 0) {
    lines.push(chalk.yellow('  no runs in the window. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('global run-length rollup'));
  lines.push(
    renderTableLocal(
      ['summary', 'value'],
      [
        ['totalRuns', formatNumber(r.totalRuns)],
        ['mean', fmtRunLen(r.globalMeanRunLength)],
        ['p50', fmtRunLen(r.globalP50RunLength)],
        ['p90', fmtRunLen(r.globalP90RunLength)],
        ['p99', fmtRunLen(r.globalP99RunLength)],
        ['max', fmtRunLen(r.globalMaxRunLength)],
        ['singleSessionRunShare', formatPercentLocal(r.globalSingleSessionRunShare)],
      ],
    ),
  );
  lines.push('');

  lines.push(chalk.bold('per-source run-length distribution (sorted by maxRunLength desc)'));
  const headers = [
    'source',
    'runs',
    'sessions',
    'mean',
    'p50',
    'p90',
    'p99',
    'max',
    'singleShare',
    'longest run started_at',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    formatNumber(s.runCount),
    formatNumber(s.sessionCount),
    fmtRunLen(s.meanRunLength),
    fmtRunLen(s.p50RunLength),
    fmtRunLen(s.p90RunLength),
    fmtRunLen(s.p99RunLength),
    fmtRunLen(s.maxRunLength),
    formatPercentLocal(s.singleSessionRunShare),
    s.longestRunStartedAt,
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtGini(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(3);
}

export function renderBucketTokenGini(r: BucketTokenGiniReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights bucket-token-gini'));
  const filterDesc = r.filterSources === null ? '—' : `[${r.filterSources.join(',')}]`;
  const topKDesc = r.topK === null ? '—' : String(r.topK);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    shown: ${formatNumber(r.sources.length)}    observed: ${formatNumber(r.observedSources)}    tokens: ${formatTokens(r.totalTokens)}    minBuckets: ${formatNumber(r.minBuckets)}    topK: ${topKDesc}    filterSources: ${filterDesc}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedByFilterSource)} by filter, ${formatNumber(r.droppedBelowMinBuckets)} below minBuckets, ${formatNumber(r.droppedBelowTopK)} below topK`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(
    chalk.dim(
      '(per source: G = Σ(2i−n−1)x_i / (n·Σx_i) on ascending per-bucket totals; 0 = even, 1 = single bucket)',
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no sources met the floor. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('global rollup (full kept set, pre-topK)'));
  lines.push(
    renderTableLocal(
      ['summary', 'value'],
      [
        ['keptSources', formatNumber(r.sources.length + r.droppedBelowTopK)],
        ['weightedMeanGini', fmtGini(r.weightedMeanGini)],
        ['unweightedMeanGini', fmtGini(r.unweightedMeanGini)],
        ['singleBucketSourceCount', formatNumber(r.singleBucketSourceCount)],
      ],
    ),
  );
  lines.push('');

  lines.push(
    chalk.bold(
      r.topK === null
        ? 'per source: temporal token-distribution gini (sorted by gini desc; ties: tokens desc, source asc)'
        : `top ${r.topK} sources by temporal token-distribution gini (gini desc; ties: tokens desc, source asc)`,
    ),
  );
  const headers = [
    'source',
    'buckets',
    'tokens',
    'gini',
    'meanTokens',
    'maxBucket',
    'topShare',
    'firstActive',
    'lastActive',
  ];
  const rows: string[][] = r.sources.map((s: BucketTokenGiniRow) => [
    s.source,
    formatNumber(s.bucketCount),
    formatTokens(s.totalTokens),
    fmtGini(s.gini),
    formatTokens(s.meanTokens),
    formatTokens(s.maxBucketTokens),
    formatPercentLocal(s.topBucketShare),
    s.activeWindowStart ?? '-',
    s.activeWindowEnd ?? '-',
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtSkew(n: number): string {
  if (!Number.isFinite(n)) return '-';
  return n.toFixed(3);
}

export function renderHourOfDayTokenSkew(r: HourOfDayTokenSkewReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights hour-of-day-token-skew'));
  const topKDesc = r.topK === null ? '—' : String(r.topK);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    shown: ${formatNumber(r.hours.length)}    observed: ${formatNumber(r.observedHours)}    tokens: ${formatTokens(r.totalTokens)}    minDays: ${formatNumber(r.minDays)}    topK: ${topKDesc}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedBelowMinDays)} below minDays, ${formatNumber(r.droppedBelowTopK)} below topK`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(
    chalk.dim(
      '(per UTC hour: g1 = m3/m2^1.5 on per-day token totals; >0 right-skewed (rare bursts), <0 left-skewed)',
    ),
  );
  lines.push('');

  if (r.hours.length === 0) {
    lines.push(chalk.yellow('  no hours met the floor. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('global rollup (full kept set, pre-topK)'));
  lines.push(
    renderTableLocal(
      ['summary', 'value'],
      [
        ['keptHours', formatNumber(r.hours.length + r.droppedBelowTopK)],
        ['weightedMeanAbsSkewness', fmtSkew(r.weightedMeanAbsSkewness)],
        ['unweightedMeanSkewness', fmtSkew(r.unweightedMeanSkewness)],
        ['highlySkewedHourCount', formatNumber(r.highlySkewedHourCount)],
      ],
    ),
  );
  lines.push('');

  lines.push(
    chalk.bold(
      r.topK === null
        ? 'per hour-of-day: per-day token-total skewness (sorted by |skew| desc; ties: tokens desc, hour asc)'
        : `top ${r.topK} hours-of-day by |skew| (|skew| desc; ties: tokens desc, hour asc)`,
    ),
  );
  const headers = [
    'hour',
    'days',
    'tokens',
    'meanDay',
    'stddevDay',
    'skew',
    'maxDay',
    'minDay',
  ];
  const rows: string[][] = r.hours.map((h: HourOfDayTokenSkewRow) => [
    String(h.hour).padStart(2, '0'),
    formatNumber(h.observedDays),
    formatTokens(h.totalTokens),
    formatTokens(h.meanDailyTokens),
    formatTokens(h.stddevDailyTokens),
    fmtSkew(h.skewness),
    formatTokens(h.maxDailyTokens),
    formatTokens(h.minDailyTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtFootrule(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

function fmtRank(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function renderSourceRankChurn(r: SourceRankChurnReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-rank-churn'));
  const topKDesc = r.topK === null ? '—' : String(r.topK);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    shown: ${formatNumber(r.sources.length)}    keptSources: ${formatNumber(r.keptSources)}    consideredDays: ${formatNumber(r.consideredDays)}    dayPairs: ${formatNumber(r.dayPairs)}    minDays: ${formatNumber(r.minDays)}    topK: ${topKDesc}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedBelowMinDays)} below minDays, ${formatNumber(r.droppedBelowTopK)} below topK, ${formatNumber(r.droppedBelowMinPairUnion)} pairs below minPairUnion (=${formatNumber(r.minPairUnion)})`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(
    chalk.dim(
      '(per UTC-day pair: normalised Spearman footrule on tokens-rank; 0 = identical leaderboard, 1 = full reversal)',
    ),
  );
  lines.push('');

  if (r.dayPairs === 0) {
    lines.push(chalk.yellow('  no adjacent UTC-day pairs survived the filter. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(chalk.bold('global rollup (full kept set, pre-topK)'));
  lines.push(
    renderTableLocal(
      ['summary', 'value'],
      [
        ['dayPairs', formatNumber(r.dayPairs)],
        ['stableDayPairs (footrule == 0)', formatNumber(r.stableDayPairs)],
        ['chaosDayPairs (footrule >= 0.5)', formatNumber(r.chaosDayPairs)],
        ['meanFootrule', fmtFootrule(r.meanFootrule)],
        ['medianFootrule', fmtFootrule(r.medianFootrule)],
        ['p90Footrule', fmtFootrule(r.p90Footrule)],
        ['maxFootrule', fmtFootrule(r.maxFootrule)],
      ],
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    return lines.join('\n').replace(/\n+$/, '');
  }

  lines.push(
    chalk.bold(
      r.topK === null
        ? 'per-source rank volatility (sorted by meanRank asc; ties: source asc)'
        : `top ${r.topK} sources by meanRank asc (ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'days',
    'meanRank',
    'stddevRank',
    'bestRank',
    'worstRank',
    'distinctRanks',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s: SourceRankChurnSourceRow) => [
    s.source,
    formatNumber(s.daysObserved),
    fmtRank(s.meanRank),
    fmtRank(s.stddevRank),
    fmtRank(s.bestRank),
    fmtRank(s.worstRank),
    formatNumber(s.distinctRanks),
    formatTokens(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

function fmtFraction(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

function fmtDays(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2);
}

function fmtHours(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(1);
}

export function renderSourceDebutRecency(r: SourceDebutRecencyReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-debut-recency'));
  const topDesc = r.top === null ? '—' : String(r.top);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    asOf: ${r.asOf ?? '—'}    shown: ${formatNumber(r.sources.length)}    totalSources: ${formatNumber(r.totalSources)}    debutWindowFraction: ${fmtFraction(r.debutWindowFraction)}    minBuckets: ${formatNumber(r.minBuckets)}    top: ${topDesc}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedModelFilter)} model-filter, ${formatNumber(r.droppedSparseSources)} sparse sources, ${formatNumber(r.droppedBelowDebutShareMin)} below debutShareMin (=${fmtFraction(r.debutShareMin)}), ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`));
  }
  lines.push(
    chalk.dim(
      '(per source: daysSinceDebut/lastSeen relative to asOf; debutShare = tokens in first debutWindowFraction of own tenure / total tokens)',
    ),
  );
  lines.push('');

  const nr = r.newcomerRollup;
  lines.push(chalk.bold(`newcomer rollup (debut within last ${fmtDays(nr.newcomerWindowDays)} days)`));
  lines.push(
    renderTableLocal(
      ['summary', 'value'],
      [
        ['newcomerCutoff', nr.newcomerCutoffIso ?? '—'],
        ['newcomerSources', formatNumber(nr.newcomerSources)],
        ['newcomerTokens', formatTokens(nr.newcomerTokens)],
        ['newcomerTokenShare', fmtFraction(nr.newcomerTokenShare)],
        ['totalTokens (full kept set)', formatTokens(r.totalTokens)],
      ],
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no sources survived the filter. nothing to chart.'));
    return lines.join('\n').replace(/\n+$/, '');
  }

  lines.push(
    chalk.bold(
      r.top === null
        ? `per-source debut & recency (sorted by ${r.sort}; ties: source asc)`
        : `top ${r.top} sources by ${r.sort} (ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstSeen',
    'lastSeen',
    'tenureH',
    'buckets',
    'tokens',
    'daysSinceDebut',
    'daysIdle',
    'debutShare',
  ];
  const rows: string[][] = r.sources.map((s: SourceDebutRecencyRow) => [
    s.source,
    s.firstSeen,
    s.lastSeen,
    fmtHours(s.tenureHours),
    formatNumber(s.activeBuckets),
    formatTokens(s.tokens),
    fmtDays(s.daysSinceDebut),
    fmtDays(s.daysSinceLastSeen),
    fmtFraction(s.debutShare),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

import type {
  CumulativeTokensMidpointReport,
  CumulativeTokensMidpointRow,
} from './cumulativetokensmidpoint.js';
import type {
  SourceIoRatioStabilityReport,
  SourceIoRatioStabilityRow,
} from './sourceioratiostability.js';

export function renderSourceIoRatioStability(
  r: SourceIoRatioStabilityReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-io-ratio-stability'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    cv-min: ${r.cvMin.toFixed(3)}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedBelowMinDays)} below min-days, ${formatNumber(r.droppedBelowCvMin)} below cv-min, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(ratioCv = stddev(daily out/in ratio) / mean(daily out/in ratio); low CV = stable interaction shape day-over-day; high CV = swings between mostly-prompt and mostly-generation; flatLine=y means every kept day had output_tokens=0)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source io-ratio stability (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers2 = [
    'source',
    'tokens',
    'inTok',
    'outTok',
    'activeD',
    'ratioD',
    'zeroInD',
    'meanRatio',
    'stdRatio',
    'ratioCv',
    'flat',
  ];
  const rows2: string[][] = r.sources.map((s: SourceIoRatioStabilityRow) => [
    s.source,
    formatNumber(s.tokens),
    formatNumber(s.inputTokens),
    formatNumber(s.outputTokens),
    formatNumber(s.activeDays),
    formatNumber(s.daysWithRatio),
    formatNumber(s.daysWithZeroInput),
    s.meanRatio.toFixed(3),
    s.stdRatio.toFixed(3),
    s.ratioCv.toFixed(3),
    s.flatLine ? 'y' : '-',
  ]);
  lines.push(renderTableLocal(headers2, rows2));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderCumulativeTokensMidpoint(
  r: CumulativeTokensMidpointReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights cumulative-tokens-midpoint'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    sort: ${r.sort}    midpoint-band: [${r.midpointMin.toFixed(3)}, ${r.midpointMax.toFixed(3)}]`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero-tokens, ${formatNumber(r.droppedSourceFilter)} by source filter, ${formatNumber(r.droppedBelowMinDays)} below min-days, ${formatNumber(r.droppedBelowMidpointMin)} below midpoint-min, ${formatNumber(r.droppedAboveMidpointMax)} above midpoint-max, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(midpointPctTenure = position in [firstActiveDay, lastActiveDay] (gap-filled with 0) where cumulative tokens first crosses 50%; <0.5 = front-loaded, ~0.5 = uniform, >0.5 = back-loaded; singleDay sources reported as 0 with singleDay=y)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source cumulative-tokens midpoint (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers2 = [
    'source',
    'tokens',
    'firstDay',
    'lastDay',
    'tenureD',
    'activeD',
    'midIdx',
    'midDay',
    'midPct',
    'single',
  ];
  const rows2: string[][] = r.sources.map((s: CumulativeTokensMidpointRow) => [
    s.source,
    formatNumber(s.tokens),
    s.firstActiveDay.slice(0, 10),
    s.lastActiveDay.slice(0, 10),
    formatNumber(s.tenureDays),
    formatNumber(s.activeDays),
    formatNumber(s.midpointDayIndex),
    s.midpointDayIso.slice(0, 10),
    s.midpointPctTenure.toFixed(3),
    s.singleDay ? 'y' : '-',
  ]);
  lines.push(renderTableLocal(headers2, rows2));

  return lines.join('\n').replace(/\n+$/, '');
}

import type {
  SourceActiveDayStreakReport,
  SourceActiveDayStreakRow,
} from './sourceactivedaystreak.js';

export function renderSourceActiveDayStreak(
  r: SourceActiveDayStreakReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-active-day-streak'));
  const topDesc = r.top === null ? '—' : String(r.top);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    density-min: ${fmtFraction(r.densityMin)}    min-longest-streak: ${r.minLongestStreak}    top: ${topDesc}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedModelFilter)} model-filter, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedBelowMinDays)} below min-days, ${formatNumber(r.droppedBelowDensityMin)} below density-min, ${formatNumber(r.droppedBelowMinLongestStreak)} below min-longest-streak, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '−∞'} → ${r.windowEnd ?? '+∞'}`),
    );
  }
  lines.push(
    chalk.dim(
      '(longestStreak = max consecutive UTC calendar days the source had a positive-token bucket; density = activeDays / tenureDays; currentStreak = streak ending on lastDay)',
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(
      chalk.yellow('  no sources survived the filter. nothing to chart.'),
    );
    return lines.join('\n').replace(/\n+$/, '');
  }

  lines.push(
    chalk.bold(
      r.top === null
        ? `per-source active-day streaks (sorted by ${r.sort}; ties: source asc)`
        : `top ${r.top} sources by ${r.sort} (ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'tenureD',
    'activeD',
    'streaks',
    'meanRun',
    'longest',
    'longestStart',
    'longestEnd',
    'currentStreak',
    'density',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s: SourceActiveDayStreakRow) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.tenureDays),
    formatNumber(s.activeDays),
    formatNumber(s.streaks),
    s.meanStreak.toFixed(2),
    formatNumber(s.longestStreak),
    s.longestStreakStart,
    s.longestStreakEnd,
    formatNumber(s.currentStreak),
    fmtFraction(s.density),
    formatNumber(s.tokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderDailyTokenMonotoneRunLength(
  r: import('./dailytokenmonotonerunlength.js').DailyTokenMonotoneRunLengthReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights daily-token-monotone-run-length'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    min-longest-run: ${r.minLongestRun}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-days, ${formatNumber(r.droppedBelowMinLongestRun)} below min-longest-run, ${formatNumber(r.droppedByCurrentDirection)} by current-direction, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  if (r.currentDirectionFilter !== null) {
    lines.push(
      chalk.dim(`current-direction filter: ${r.currentDirectionFilter.join(',')}`),
    );
  }
  lines.push(
    chalk.dim(
      `(longestUpRun / longestDownRun = max consecutive UTC active days with strictly increasing / decreasing total_tokens; equal-valued neighbors break runs in both directions; currentRun is the trailing run ending on lastActiveDay)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(`per-source monotone runs (sorted by ${r.sort}; ties: source asc)`),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'nDays',
    'longestRun',
    'dir',
    'longestUp',
    'upStart',
    'upEnd',
    'longestDown',
    'downStart',
    'downEnd',
    'curDir',
    'curLen',
    'runs',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstActiveDay,
    s.lastActiveDay,
    formatNumber(s.nActiveDays),
    formatNumber(s.longestMonotoneRun),
    s.longestDirection,
    formatNumber(s.longestUpRun),
    s.longestUpStart || '-',
    s.longestUpEnd || '-',
    formatNumber(s.longestDownRun),
    s.longestDownStart || '-',
    s.longestDownEnd || '-',
    s.currentDirection,
    formatNumber(s.currentRunLength),
    formatNumber(s.runs),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

import type {
  SourceDrySpellReport,
  SourceDrySpellRow,
} from './sourcedryspell.js';

export function renderSourceDrySpell(r: SourceDrySpellReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-dry-spell'));
  const topDesc = r.top === null ? '\u2014' : String(r.top);
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    min-longest: ${r.minLongest}    min-fraction: ${fmtFraction(r.minFraction)}    top: ${topDesc}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedModelFilter)} model-filter, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedBelowMinDays)} below min-days, ${formatNumber(r.droppedBelowMinLongest)} below min-longest, ${formatNumber(r.droppedBelowMinFraction)} below min-fraction, ${formatNumber(r.droppedBelowTopCap)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  lines.push(
    chalk.dim(
      '(longestDrySpell = max consecutive UTC inactive days strictly inside tenure; drySpellFraction = inactiveDays/tenureDays; firstDay and lastDay are by definition active so fraction < 1)',
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(
      chalk.yellow('  no sources survived the filter. nothing to chart.'),
    );
    return lines.join('\n').replace(/\n+$/, '');
  }

  lines.push(
    chalk.bold(
      r.top === null
        ? `per-source dry spells (sorted by ${r.sort}; ties: source asc)`
        : `top ${r.top} sources by ${r.sort} (ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'tenureD',
    'activeD',
    'inactD',
    'longestDry',
    'dryStart',
    'dryEnd',
    'nDry',
    'meanDry',
    'dryFrac',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s: SourceDrySpellRow) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.tenureDays),
    formatNumber(s.activeDays),
    formatNumber(s.inactiveDays),
    formatNumber(s.longestDrySpell),
    s.longestDrySpellStart || '-',
    s.longestDrySpellEnd || '-',
    formatNumber(s.nDrySpells),
    s.meanDrySpell.toFixed(2),
    fmtFraction(s.drySpellFraction),
    formatNumber(s.tokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

import type {
  DailyTokenSecondDiffSignRunsReport,
} from './dailytokenseconddiffsignruns.js';

export function renderDailyTokenSecondDiffSignRuns(
  r: DailyTokenSecondDiffSignRunsReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights daily-token-second-difference-sign-runs'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-days: ${r.minDays}    min-current-run: ${r.minCurrentRun}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedZeroTokens)} zero tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-days, ${formatNumber(r.droppedBelowMinCurrentRun)} below min-current-run, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(d2[i] = v[i+2] - 2*v[i+1] + v[i]; sign(d2) > 0 = concaveup (acceleration), < 0 = concavedown (deceleration), == 0 = flat (linear segment); a "run" is a maximal same-sign d2 stretch; length is # of d2 points; current = the trailing run ending on the last d2 point)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source second-difference sign runs (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'nDays',
    'nD2',
    'longestRun',
    'regime',
    'longUp',
    'upStart',
    'upEnd',
    'longDown',
    'downStart',
    'downEnd',
    'longFlat',
    'flatStart',
    'flatEnd',
    'curRegime',
    'curLen',
    'runs',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstActiveDay,
    s.lastActiveDay,
    formatNumber(s.nActiveDays),
    formatNumber(s.nD2Points),
    formatNumber(s.longestRegimeRun),
    s.longestRegime,
    formatNumber(s.longestConcaveUpRun),
    s.longestConcaveUpStart || '-',
    s.longestConcaveUpEnd || '-',
    formatNumber(s.longestConcaveDownRun),
    s.longestConcaveDownStart || '-',
    s.longestConcaveDownEnd || '-',
    formatNumber(s.longestFlatRun),
    s.longestFlatStart || '-',
    s.longestFlatEnd || '-',
    s.currentRegime,
    formatNumber(s.currentRunLength),
    formatNumber(s.totalRuns),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

import type {
  SourceOutputTokenBenfordDeviationReport,
} from './sourceoutputtokenbenforddeviation.js';

export function renderSourceOutputTokenBenfordDeviation(
  r: SourceOutputTokenBenfordDeviationReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-output-token-benford-deviation'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    rows: ${formatNumber(r.totalRows)}    tokens: ${formatNumber(r.totalTokens)}    min-rows: ${r.minRows}    max-mad: ${r.maxMad === 0 ? '\u2014' : r.maxMad}    require-d1-mode: ${r.requireD1Mode ? 'yes' : 'no'}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveOutput)} non-positive output, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-rows, ${formatNumber(r.droppedAboveMaxMad)} above max-mad, ${formatNumber(r.droppedNonD1Mode)} non-d1-mode, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(P_benford(d) = log10(1 + 1/d), d in 1..9; chi2 has 8 d.o.f.; MAD% = mean_d|obs-exp|*100; Nigrini conformity: <0.6 close, 0.6-1.2 acceptable, 1.2-1.5 marginal, >1.5 nonconformity)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source Benford fit on output_tokens (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'nRows',
    'd1%',
    'd2%',
    'd3%',
    'd4%',
    'd5%',
    'd6%',
    'd7%',
    'd8%',
    'd9%',
    'mode',
    'modeFreq%',
    'chi2',
    'MAD%',
    'tokens',
  ];
  const fmtPct = (x: number): string => (x * 100).toFixed(2);
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nRows),
    fmtPct(s.digits[0]!.observedFreq),
    fmtPct(s.digits[1]!.observedFreq),
    fmtPct(s.digits[2]!.observedFreq),
    fmtPct(s.digits[3]!.observedFreq),
    fmtPct(s.digits[4]!.observedFreq),
    fmtPct(s.digits[5]!.observedFreq),
    fmtPct(s.digits[6]!.observedFreq),
    fmtPct(s.digits[7]!.observedFreq),
    fmtPct(s.digits[8]!.observedFreq),
    String(s.modeDigit),
    fmtPct(s.modeFreq),
    s.chi2.toFixed(2),
    s.madPercent.toFixed(3),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceTokenMassHourCentroid(
  r: SourceTokenMassHourCentroidReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-token-mass-hour-centroid'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-tokens: ${formatNumber(r.minTokens)}    max-spread: ${r.maxSpread === 0 ? '\u2014' : r.maxSpread}    min-r: ${r.minR === 0 ? '\u2014' : r.minR}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedAboveMaxSpread)} above max-spread, ${formatNumber(r.droppedBelowMinR)} below min-r, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(centroidHour = atan2(sum m*sin(theta), sum m*cos(theta)) on a 24h circle, theta=2*pi*h/24, m=total_tokens; R in [0,1] is concentration; spreadHrs = sqrt(-2*ln(R))*24/(2*pi); UTC hours)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source token-mass-weighted hour-of-day centroid (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'days',
    'buckets',
    'centroidHr',
    'R',
    'spreadHrs',
    'peakHr',
    'peakTokens',
    'tokens',
  ];
  const fmtH = (h: number): string => h.toFixed(2);
  const fmtSpread = (h: number): string =>
    Number.isFinite(h) ? h.toFixed(2) : '\u221e';
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nDays),
    formatNumber(s.nBuckets),
    fmtH(s.centroidHour),
    s.resultantLength.toFixed(4),
    fmtSpread(s.spreadHours),
    String(s.peakHour),
    formatNumber(s.peakHourTokens),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceDayOfWeekTokenMassShare(
  r: SourceDayOfWeekTokenMassShareReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-day-of-week-token-mass-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    uniformBaseline: ${r.uniformBaseline.toFixed(4)}    weekendBaseline: ${r.weekendUniformBaseline.toFixed(4)}    min-tokens: ${formatNumber(r.minTokens)}    min-weekend-share: ${r.minWeekendShare === 0 ? '\u2014' : r.minWeekendShare}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedBelowMinWeekendShare)} below min-weekend-share, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per-source share of total token mass across the 7 UTC weekdays; share_d sums to 1; weekendShare = Sun+Sat; entropy normalized by ln(7))`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source token-mass share by UTC weekday (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'days',
    'dominantDow',
    'dominantShare',
    'weekendShare',
    'entropyNorm',
    'Sun',
    'Mon',
    'Tue',
    'Wed',
    'Thu',
    'Fri',
    'Sat',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nDays),
    `${s.dominantDow}:${dowNameFmt(s.dominantDow)}`,
    s.dominantShare.toFixed(4),
    s.weekendShare.toFixed(4),
    s.normalizedEntropy.toFixed(4),
    s.shares[0].toFixed(3),
    s.shares[1].toFixed(3),
    s.shares[2].toFixed(3),
    s.shares[3].toFixed(3),
    s.shares[4].toFixed(3),
    s.shares[5].toFixed(3),
    s.shares[6].toFixed(3),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderDailyTokenGini(r: DailyTokenGiniReport): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights daily-token-gini-coefficient'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-tokens: ${formatNumber(r.minTokens)}    min-days: ${formatNumber(r.minDays)}    min-gini: ${r.minGini === 0 ? '\u2014' : r.minGini}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedBelowMinDays)} below min-days, ${formatNumber(r.droppedBelowMinGini)} below min-gini, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per-source Gini of per-day total_tokens; G = (2*sum_i i*D_(i) - (n+1)*S) / (n*S) over sorted day vector; range [0, (n-1)/n]; UTC days)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source Gini of per-day total_tokens (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'days',
    'gini',
    'meanDaily',
    'maxDay',
    'maxDayTokens',
    'maxShare',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nDays),
    s.gini.toFixed(4),
    formatNumber(Math.round(s.meanDailyTokens)),
    s.maxDay,
    formatNumber(s.maxDailyTokens),
    s.maxDayShare.toFixed(4),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceHourTopKMassShare(
  r: SourceHourTopKMassShareReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-hour-of-day-topk-mass-share'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    K: ${r.topHoursK}    uniformBaseline: ${r.uniformBaseline.toFixed(4)}    min-tokens: ${formatNumber(r.minTokens)}    min-hours: ${formatNumber(r.minHours)}    min-share: ${r.minShare === 0 ? '\u2014' : r.minShare}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedBelowMinHours)} below min-hours, ${formatNumber(r.droppedBelowMinShare)} below min-share, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per-source share of total token mass in the K busiest hours-of-day; share_K in [K/24, 1]; UTC hours)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source top-${r.topHoursK} hour-of-day mass share (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'hoursActive',
    `top${r.topHoursK}Share`,
    'topHours',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => {
    const hourSig = s.topHourBuckets
      .map((b) => `${String(b.hour).padStart(2, '0')}:${b.share.toFixed(3)}`)
      .join(' ');
    return [
      s.source,
      s.firstDay,
      s.lastDay,
      formatNumber(s.nHours),
      s.topKShare.toFixed(4),
      hourSig,
      formatNumber(s.totalTokens),
    ];
  });
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceDeadHourCount(
  r: SourceDeadHourCountReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-dead-hour-count'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-tokens: ${formatNumber(r.minTokens)}    min-dead-hours: ${r.minDeadHours === 0 ? '\u2014' : r.minDeadHours}    min-longest-run: ${r.minLongestRun === 0 ? '\u2014' : r.minLongestRun}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedBelowMinDeadHours)} below min-dead-hours, ${formatNumber(r.droppedBelowMinLongestRun)} below min-longest-run, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per-source count of UTC hours-of-day with zero token mass over the window; longestDeadRun and deadRunCount on the circular 24-cycle)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source dead-hour count by UTC hour-of-day (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'buckets',
    'deadHours',
    'liveHours',
    'deadShare',
    'longestDeadRun',
    'deadRunCount',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nBuckets),
    String(s.deadHours),
    String(s.liveHours),
    s.deadShare.toFixed(4),
    String(s.longestDeadRun),
    String(s.deadRunCount),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceActiveHourLongestRun(
  r: SourceActiveHourLongestRunReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-active-hour-longest-run'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-tokens: ${formatNumber(r.minTokens)}    min-longest-active-run: ${r.minLongestActiveRun === 0 ? '\u2014' : r.minLongestActiveRun}    min-active-hours: ${r.minActiveHours === 0 ? '\u2014' : r.minActiveHours}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedBelowMinLongestActiveRun)} below min-longest-active-run, ${formatNumber(r.droppedBelowMinActiveHours)} below min-active-hours, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per-source longest contiguous run of *active* hours-of-day on the circular 24-cycle; share = longestActiveRun / activeHours)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source longest active hour-of-day run (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'buckets',
    'activeHours',
    'longestActiveRun',
    'runStart',
    'activeRunCount',
    'activeRunShare',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nBuckets),
    String(s.activeHours),
    String(s.longestActiveRun),
    s.longestRunStart < 0 ? '-' : String(s.longestRunStart).padStart(2, '0'),
    String(s.activeRunCount),
    s.activeRunShare.toFixed(4),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}

export function renderSourceHourOfDayTokenMassEntropy(
  r: SourceHourEntropyReport,
): string {
  const lines: string[] = [];
  lines.push(chalk.bold.cyan('pew-insights source-hour-of-day-token-mass-entropy'));
  lines.push(
    chalk.dim(
      `as of: ${r.generatedAt}    sources: ${formatNumber(r.totalSources)} (shown ${formatNumber(r.sources.length)})    tokens: ${formatNumber(r.totalTokens)}    min-tokens: ${formatNumber(r.minTokens)}    min-normalized: ${r.minNormalized === 0 ? '\u2014' : r.minNormalized.toFixed(4)}    min-effective-hours: ${r.minEffectiveHours === 0 ? '\u2014' : r.minEffectiveHours.toFixed(4)}    top: ${r.top === 0 ? '\u2014' : r.top}    sort: ${r.sort}    H_max(bits): ${r.maxEntropyBits.toFixed(4)}`,
    ),
  );
  lines.push(
    chalk.dim(
      `dropped: ${formatNumber(r.droppedInvalidHourStart)} bad hour_start, ${formatNumber(r.droppedNonPositiveTokens)} non-positive tokens, ${formatNumber(r.droppedSourceFilter)} source-filter, ${formatNumber(r.droppedSparseSources)} below min-tokens, ${formatNumber(r.droppedBelowMinNormalized)} below min-normalized, ${formatNumber(r.droppedBelowMinEffectiveHours)} below min-effective-hours, ${formatNumber(r.droppedTopSources)} below top cap`,
    ),
  );
  if (r.windowStart || r.windowEnd) {
    lines.push(
      chalk.dim(`window: ${r.windowStart ?? '-inf'} -> ${r.windowEnd ?? '+inf'}`),
    );
  }
  if (r.source !== null) {
    lines.push(chalk.dim(`source filter: ${r.source}`));
  }
  lines.push(
    chalk.dim(
      `(per-source Shannon entropy in bits of token mass over UTC hour-of-day; effectiveHours = 2^H; concentrationGap = activeHours - effectiveHours)`,
    ),
  );
  lines.push('');

  if (r.sources.length === 0) {
    lines.push(chalk.yellow('  no source rows after filters. nothing to chart.'));
    return lines.join('\n');
  }

  lines.push(
    chalk.bold(
      `per-source UTC hour-of-day token-mass entropy (sorted by ${r.sort}; ties: source asc)`,
    ),
  );
  const headers = [
    'source',
    'firstDay',
    'lastDay',
    'buckets',
    'activeHours',
    'entropyBits',
    'normalized',
    'effectiveHours',
    'concGap',
    'topHour',
    'topShare',
    'tokens',
  ];
  const rows: string[][] = r.sources.map((s) => [
    s.source,
    s.firstDay,
    s.lastDay,
    formatNumber(s.nBuckets),
    String(s.activeHours),
    s.entropyBits.toFixed(4),
    s.entropyNormalized.toFixed(4),
    s.effectiveHours.toFixed(4),
    s.concentrationGap.toFixed(4),
    s.topHour < 0 ? '-' : String(s.topHour).padStart(2, '0'),
    s.topHourShare.toFixed(4),
    formatNumber(s.totalTokens),
  ]);
  lines.push(renderTableLocal(headers, rows));

  return lines.join('\n').replace(/\n+$/, '');
}
