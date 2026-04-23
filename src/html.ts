import type { Digest } from './report.js';
import type { Status } from './report.js';
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
  generatedAt: string;
}

export function renderHtmlReport(input: HtmlReportInput): string {
  const { pewHome, digest, status, generatedAt } = input;

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
