import chalk from 'chalk';
import type { Digest, DigestRow, DoctorReport, SourcesPivot, Status } from './report.js';
import type { CostReport } from './cost.js';
import type { DeltaWindow, TrendReport } from './trend.js';

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
