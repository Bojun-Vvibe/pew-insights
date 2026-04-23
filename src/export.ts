/**
 * Export: dump filtered events as CSV or NDJSON for downstream BI / Parquet.
 *
 * Design notes
 * ------------
 * Two entities can be exported:
 *   - 'queue'    — token events from queue.jsonl (one row per source × model × hour bucket)
 *   - 'sessions' — sessions from session-queue.jsonl
 *
 * Two formats:
 *   - 'csv'    — RFC-4180-style: comma-separated, header row, double-quote
 *                escaping (CRLF *not* used; we emit LF for sane diffs).
 *                Numbers are emitted unquoted; strings are quoted only when
 *                they contain comma, quote, newline, or leading/trailing
 *                whitespace.
 *   - 'ndjson' — one JSON object per line. This is the format every Parquet
 *                ingest tool understands (DuckDB `read_json_auto`,
 *                `pandas.read_json(lines=True)`, etc.). The CLI flag is
 *                `--format ndjson` but the help text calls it
 *                "Parquet-friendly JSON" because that is the user-facing
 *                purpose.
 *
 * Filtering
 * ---------
 * Independent of format we accept --since (ISO or relative spec via the same
 * `resolveSince` used by other commands) and an optional --until. Plus
 * `--source` and `--model` substring filters (case-insensitive). For queue
 * exports we additionally compute and emit a per-row `usd` column when a
 * RateTable is supplied so BI tools can sum dollars without re-applying rates.
 *
 * Pure functions return strings; the CLI writes them to stdout or a file.
 */
import { computeCost, type RateTable } from './cost.js';
import { normaliseModel } from './parsers.js';
import type { QueueLine, SessionLine } from './types.js';

export type ExportEntity = 'queue' | 'sessions';
export type ExportFormat = 'csv' | 'ndjson';

export interface ExportFilters {
  since?: string | null;
  until?: string | null;
  /** Substring (case-insensitive) match on the source field. */
  source?: string;
  /** Substring (case-insensitive) match on the *normalised* model name. */
  model?: string;
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

function lc(s: string | undefined): string {
  return (s ?? '').toLowerCase();
}

export function filterQueue(queue: QueueLine[], filters: ExportFilters): QueueLine[] {
  const src = lc(filters.source);
  const mdl = lc(filters.model);
  return queue.filter((q) => {
    if (filters.since && q.hour_start < filters.since) return false;
    if (filters.until && q.hour_start >= filters.until) return false;
    if (src && !lc(q.source).includes(src)) return false;
    if (mdl && !lc(normaliseModel(q.model)).includes(mdl)) return false;
    return true;
  });
}

export function filterSessions(sessions: SessionLine[], filters: ExportFilters): SessionLine[] {
  const src = lc(filters.source);
  const mdl = lc(filters.model);
  return sessions.filter((s) => {
    if (filters.since && s.last_message_at < filters.since) return false;
    if (filters.until && s.last_message_at >= filters.until) return false;
    if (src && !lc(s.source).includes(src)) return false;
    if (mdl && !lc(normaliseModel(s.model)).includes(mdl)) return false;
    return true;
  });
}

// ---------------------------------------------------------------------------
// CSV serialisation
// ---------------------------------------------------------------------------

/**
 * RFC-4180-ish escaper. Returns the raw value as a string suitable for direct
 * concatenation into a CSV cell (quoted only when necessary).
 */
export function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  const s = String(v);
  if (/[",\n\r]/.test(s) || /^\s|\s$/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function rowsToCsv(headers: string[], rows: Array<Record<string, unknown>>): string {
  const out: string[] = [];
  out.push(headers.map(csvEscape).join(','));
  for (const r of rows) {
    out.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  return out.join('\n') + '\n';
}

function rowsToNdjson(rows: Array<Record<string, unknown>>): string {
  return rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length > 0 ? '\n' : '');
}

// ---------------------------------------------------------------------------
// Row shaping
// ---------------------------------------------------------------------------

const QUEUE_HEADERS = [
  'hour_start',
  'source',
  'model',
  'normalised_model',
  'device_id',
  'input_tokens',
  'cached_input_tokens',
  'output_tokens',
  'reasoning_output_tokens',
  'total_tokens',
  'usd', // optional when no rates table — emitted as empty cell
] as const;

const SESSION_HEADERS = [
  'session_key',
  'source',
  'kind',
  'started_at',
  'last_message_at',
  'duration_seconds',
  'user_messages',
  'assistant_messages',
  'total_messages',
  'project_ref',
  'model',
  'normalised_model',
  'snapshot_at',
] as const;

function queueRow(q: QueueLine, rates: RateTable | null): Record<string, unknown> {
  const usd = rates ? computeCost([q], null, rates).totalCost : null;
  return {
    hour_start: q.hour_start,
    source: q.source,
    model: q.model,
    normalised_model: normaliseModel(q.model),
    device_id: q.device_id,
    input_tokens: q.input_tokens,
    cached_input_tokens: q.cached_input_tokens,
    output_tokens: q.output_tokens,
    reasoning_output_tokens: q.reasoning_output_tokens,
    total_tokens: q.total_tokens,
    usd: usd === null ? '' : Number(usd.toFixed(8)),
  };
}

function sessionRow(s: SessionLine): Record<string, unknown> {
  return {
    session_key: s.session_key,
    source: s.source,
    kind: s.kind,
    started_at: s.started_at,
    last_message_at: s.last_message_at,
    duration_seconds: s.duration_seconds,
    user_messages: s.user_messages,
    assistant_messages: s.assistant_messages,
    total_messages: s.total_messages,
    project_ref: s.project_ref,
    model: s.model,
    normalised_model: normaliseModel(s.model),
    snapshot_at: s.snapshot_at,
  };
}

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export interface ExportOptions {
  entity: ExportEntity;
  format: ExportFormat;
  filters?: ExportFilters;
  /** Required for entity='queue' if you want a populated `usd` column. */
  rates?: RateTable | null;
}

export interface ExportResult {
  body: string;
  rowCount: number;
}

export function exportQueue(
  queue: QueueLine[],
  format: ExportFormat,
  filters: ExportFilters = {},
  rates: RateTable | null = null,
): ExportResult {
  const filtered = filterQueue(queue, filters);
  const rows = filtered.map((q) => queueRow(q, rates));
  const body = format === 'csv' ? rowsToCsv([...QUEUE_HEADERS], rows) : rowsToNdjson(rows);
  return { body, rowCount: rows.length };
}

export function exportSessions(
  sessions: SessionLine[],
  format: ExportFormat,
  filters: ExportFilters = {},
): ExportResult {
  const filtered = filterSessions(sessions, filters);
  const rows = filtered.map(sessionRow);
  const body = format === 'csv' ? rowsToCsv([...SESSION_HEADERS], rows) : rowsToNdjson(rows);
  return { body, rowCount: rows.length };
}
