import { normaliseModel } from './parsers.js';
import type {
  Cursors,
  PewState,
  QueueLine,
  QueueState,
  SessionLine,
  SessionQueueState,
} from './types.js';

// ---------------------------------------------------------------------------
// Time windows
// ---------------------------------------------------------------------------

export type SinceSpec = string; // '24h' | '7d' | '30d' | 'all' | ISO

/** Resolve a --since spec to a lower-bound ISO-8601 string, or null for 'all'. */
export function resolveSince(spec: SinceSpec | undefined, now = new Date()): string | null {
  if (!spec || spec === 'all') return null;
  const m = /^(\d+)([hdwm])$/i.exec(spec);
  if (m) {
    const n = Number(m[1]);
    const unit = m[2]!.toLowerCase();
    const ms =
      unit === 'h' ? n * 3_600_000 :
      unit === 'd' ? n * 86_400_000 :
      unit === 'w' ? n * 7 * 86_400_000 :
      n * 30 * 86_400_000;
    return new Date(now.getTime() - ms).toISOString();
  }
  // Assume already an ISO string.
  const d = new Date(spec);
  if (!isNaN(d.getTime())) return d.toISOString();
  throw new Error(`Could not parse --since value: ${spec}`);
}

// ---------------------------------------------------------------------------
// Digest
// ---------------------------------------------------------------------------

export interface DigestRow {
  key: string;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  events: number;
}

export interface Digest {
  since: string | null;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  events: number;
  byDay: DigestRow[];
  bySource: DigestRow[];
  byModel: DigestRow[];
  byHour: DigestRow[]; // hour-of-day 0..23
  sessionCount: number;
  topProjectRefs: Array<{ projectRef: string; sessions: number; messages: number }>;
  topPairs: Array<{ source: string; model: string; totalTokens: number }>;
}

function emptyRow(key: string): DigestRow {
  return {
    key,
    totalTokens: 0,
    inputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    cachedInputTokens: 0,
    events: 0,
  };
}

function bump(row: DigestRow, q: QueueLine): void {
  row.totalTokens += q.total_tokens || 0;
  row.inputTokens += q.input_tokens || 0;
  row.outputTokens += q.output_tokens || 0;
  row.reasoningTokens += q.reasoning_output_tokens || 0;
  row.cachedInputTokens += q.cached_input_tokens || 0;
  row.events += 1;
}

export function buildDigest(
  queue: QueueLine[],
  sessions: SessionLine[],
  since: string | null,
): Digest {
  const filtered = since
    ? queue.filter((q) => q.hour_start >= since)
    : queue;

  const filteredSessions = since
    ? sessions.filter((s) => s.last_message_at >= since)
    : sessions;

  const byDay = new Map<string, DigestRow>();
  const bySource = new Map<string, DigestRow>();
  const byModel = new Map<string, DigestRow>();
  const byHour = new Map<string, DigestRow>();
  const byPair = new Map<string, DigestRow>();

  let totalTokens = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let reasoningTokens = 0;
  let cachedInputTokens = 0;

  for (const q of filtered) {
    const day = q.hour_start.slice(0, 10);
    const hour = q.hour_start.slice(11, 13);
    const src = q.source || 'unknown';
    const model = normaliseModel(q.model);
    const pairKey = `${src}\u0001${model}`;

    const dRow = byDay.get(day) ?? emptyRow(day);
    const sRow = bySource.get(src) ?? emptyRow(src);
    const mRow = byModel.get(model) ?? emptyRow(model);
    const hRow = byHour.get(hour) ?? emptyRow(hour);
    const pRow = byPair.get(pairKey) ?? emptyRow(pairKey);

    bump(dRow, q);
    bump(sRow, q);
    bump(mRow, q);
    bump(hRow, q);
    bump(pRow, q);

    byDay.set(day, dRow);
    bySource.set(src, sRow);
    byModel.set(model, mRow);
    byHour.set(hour, hRow);
    byPair.set(pairKey, pRow);

    totalTokens += q.total_tokens || 0;
    inputTokens += q.input_tokens || 0;
    outputTokens += q.output_tokens || 0;
    reasoningTokens += q.reasoning_output_tokens || 0;
    cachedInputTokens += q.cached_input_tokens || 0;
  }

  // Project ref aggregation
  const projects = new Map<string, { sessions: number; messages: number }>();
  for (const s of filteredSessions) {
    const ref = s.project_ref || 'unknown';
    const e = projects.get(ref) ?? { sessions: 0, messages: 0 };
    e.sessions += 1;
    e.messages += s.total_messages || 0;
    projects.set(ref, e);
  }

  const topProjectRefs = Array.from(projects.entries())
    .map(([projectRef, v]) => ({ projectRef, ...v }))
    .sort((a, b) => b.messages - a.messages)
    .slice(0, 10);

  const topPairs = Array.from(byPair.entries())
    .map(([k, v]) => {
      const [source, model] = k.split('\u0001') as [string, string];
      return { source, model, totalTokens: v.totalTokens };
    })
    .sort((a, b) => b.totalTokens - a.totalTokens)
    .slice(0, 15);

  const sortByTokensDesc = (a: DigestRow, b: DigestRow) => b.totalTokens - a.totalTokens;
  const sortByKeyAsc = (a: DigestRow, b: DigestRow) => a.key.localeCompare(b.key);

  return {
    since,
    totalTokens,
    inputTokens,
    outputTokens,
    reasoningTokens,
    cachedInputTokens,
    events: filtered.length,
    byDay: Array.from(byDay.values()).sort(sortByKeyAsc),
    bySource: Array.from(bySource.values()).sort(sortByTokensDesc),
    byModel: Array.from(byModel.values()).sort(sortByTokensDesc),
    byHour: Array.from(byHour.values()).sort(sortByKeyAsc),
    sessionCount: filteredSessions.length,
    topProjectRefs,
    topPairs,
  };
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export interface LagFile {
  path: string;
  missingBytes: number;
}

export interface Status {
  pewHome: string;
  pendingQueueBytes: number;
  pendingQueueLines: number;
  queueFileSize: number;
  queueOffset: number;
  dirtyKeys: string[];
  sessionQueueFileSize: number;
  sessionQueueOffset: number;
  pendingSessionQueueBytes: number;
  lastSuccess: string | null;
  lastSuccessAgeSeconds: number | null;
  trailingLockHolder: { pid: number; startedAt: string } | null;
  trailingLockAlive: boolean | null;
  lagFiles: LagFile[];
  runsCountApprox: number;
}

export interface StatusInputs {
  pewHome: string;
  state: PewState;
  queue: QueueLine[];
  queueFileSize: number;
  sessionQueueFileSize: number;
  cursors: Cursors | null;
  runsCountApprox: number;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'EPERM') return true;
    return false;
  }
}

export function buildStatus(inputs: StatusInputs): Status {
  const { pewHome, state, queue, queueFileSize, sessionQueueFileSize, cursors, runsCountApprox } = inputs;

  const queueOffset = (state.queue as QueueState).offset ?? 0;
  const sessionQueueOffset = (state.sessionQueue as SessionQueueState).offset ?? 0;

  // Approximate pending lines: count queue lines whose serialised JSON byte
  // length, in cumulative order, would exceed the offset. The pew docs make
  // it clear lines before offset are already-flushed.
  // Rather than re-stream, approximate using bytes.
  const pendingQueueBytes = Math.max(0, queueFileSize - queueOffset);
  const avgBytes = queue.length > 0 ? queueFileSize / queue.length : 0;
  const pendingQueueLines = avgBytes > 0 ? Math.round(pendingQueueBytes / avgBytes) : 0;

  const pendingSessionQueueBytes = Math.max(0, sessionQueueFileSize - sessionQueueOffset);

  const now = Date.now();
  const lastSuccessAgeSeconds = state.lastSuccess
    ? Math.max(0, Math.round((now - new Date(state.lastSuccess).getTime()) / 1000))
    : null;

  const trailingLockHolder = state.trailingLock
    ? { pid: state.trailingLock.pid, startedAt: state.trailingLock.startedAt }
    : null;
  const trailingLockAlive = trailingLockHolder ? isPidAlive(trailingLockHolder.pid) : null;

  const lagFiles: LagFile[] = [];
  if (cursors && cursors.files) {
    for (const [path, c] of Object.entries(cursors.files)) {
      // Only the full variant carries `size` and `offset`.
      const cur = c as { size?: number; offset?: number };
      if (typeof cur.size === 'number' && typeof cur.offset === 'number') {
        const missing = cur.size - cur.offset;
        if (missing > 0) lagFiles.push({ path, missingBytes: missing });
      }
    }
    lagFiles.sort((a, b) => b.missingBytes - a.missingBytes);
  }

  return {
    pewHome,
    pendingQueueBytes,
    pendingQueueLines,
    queueFileSize,
    queueOffset,
    dirtyKeys: state.queue.dirtyKeys ?? [],
    sessionQueueFileSize,
    sessionQueueOffset,
    pendingSessionQueueBytes,
    lastSuccess: state.lastSuccess,
    lastSuccessAgeSeconds,
    trailingLockHolder,
    trailingLockAlive,
    lagFiles: lagFiles.slice(0, 20),
    runsCountApprox,
  };
}

// ---------------------------------------------------------------------------
// Source × model pivot
// ---------------------------------------------------------------------------

export interface SourcesPivot {
  since: string | null;
  models: string[];
  rows: Array<{ source: string; total: number; perModel: Record<string, number> }>;
}

export function buildSourcesPivot(queue: QueueLine[], since: string | null): SourcesPivot {
  const filtered = since ? queue.filter((q) => q.hour_start >= since) : queue;
  const modelTotals = new Map<string, number>();
  const sourceModelTotals = new Map<string, Map<string, number>>();

  for (const q of filtered) {
    const src = q.source || 'unknown';
    const model = normaliseModel(q.model);
    modelTotals.set(model, (modelTotals.get(model) ?? 0) + (q.total_tokens || 0));
    let inner = sourceModelTotals.get(src);
    if (!inner) {
      inner = new Map();
      sourceModelTotals.set(src, inner);
    }
    inner.set(model, (inner.get(model) ?? 0) + (q.total_tokens || 0));
  }

  const models = Array.from(modelTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([m]) => m);

  const rows = Array.from(sourceModelTotals.entries())
    .map(([source, inner]) => {
      const perModel: Record<string, number> = {};
      let total = 0;
      for (const m of models) {
        const v = inner.get(m) ?? 0;
        perModel[m] = v;
        total += v;
      }
      return { source, total, perModel };
    })
    .sort((a, b) => b.total - a.total);

  return { since, models, rows };
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export type DoctorSeverity = 'info' | 'warn' | 'error';

export interface DoctorFinding {
  severity: DoctorSeverity;
  code: string;
  message: string;
  hint?: string;
}

export interface DoctorReport {
  pewHome: string;
  pewHomeExists: boolean;
  findings: DoctorFinding[];
}

export interface DoctorInputs {
  pewHome: string;
  pewHomeExists: boolean;
  status: Status | null;
  queueFileSize: number;
  queueOffset: number;
  runsCount: number;
}

export function buildDoctor(inputs: DoctorInputs): DoctorReport {
  const { pewHome, pewHomeExists, status, queueFileSize, queueOffset, runsCount } = inputs;
  const findings: DoctorFinding[] = [];

  if (!pewHomeExists) {
    findings.push({
      severity: 'error',
      code: 'PEW_HOME_MISSING',
      message: `pew home ${pewHome} does not exist`,
      hint: 'Install pew and run it at least once, or set PEW_HOME / pass --pew-home.',
    });
    return { pewHome, pewHomeExists, findings };
  }

  if (runsCount > 10_000) {
    findings.push({
      severity: 'warn',
      code: 'RUNS_DIR_LARGE',
      message: `runs/ contains ${runsCount.toLocaleString()} files`,
      hint: 'Run `pew-insights gc-runs --keep 1000` to archive older entries.',
    });
  }

  // Never-compacted queue: queue file is large but offset shows everything is flushed.
  const flushedBytes = Math.min(queueOffset, queueFileSize);
  if (flushedBytes > 100_000 && queueFileSize > 200_000) {
    findings.push({
      severity: 'warn',
      code: 'QUEUE_NEVER_COMPACTED',
      message: `queue.jsonl is ${queueFileSize.toLocaleString()} bytes; ${flushedBytes.toLocaleString()} bytes already flushed but not pruned`,
      hint: 'Run `pew-insights compact --confirm` to archive the flushed prefix and shrink the live file.',
    });
  }

  if (status) {
    if (status.dirtyKeys.length > 0) {
      findings.push({
        severity: 'warn',
        code: 'QUEUE_DIRTY_KEYS',
        message: `queue.state.json has ${status.dirtyKeys.length} dirty key(s)`,
        hint: 'A flush is in progress or a prior flush failed mid-write. Watch this for a few cycles.',
      });
    }
    if (status.trailingLockHolder) {
      if (status.trailingLockAlive === false) {
        findings.push({
          severity: 'error',
          code: 'STALE_TRAILING_LOCK',
          message: `trailing.lock held by pid ${status.trailingLockHolder.pid} (started ${status.trailingLockHolder.startedAt}) but that process is not alive`,
          hint: 'Safe to delete trailing.lock manually if no pew is currently running.',
        });
      } else {
        findings.push({
          severity: 'info',
          code: 'TRAILING_LOCK_HELD',
          message: `trailing.lock held by live pid ${status.trailingLockHolder.pid}`,
        });
      }
    }
    if (status.lastSuccessAgeSeconds !== null && status.lastSuccessAgeSeconds > 24 * 3600) {
      findings.push({
        severity: 'warn',
        code: 'LAST_SUCCESS_OLD',
        message: `last successful sync was ${Math.round(status.lastSuccessAgeSeconds / 3600)}h ago`,
      });
    }
    if (status.lagFiles.length > 0) {
      const total = status.lagFiles.reduce((s, f) => s + f.missingBytes, 0);
      findings.push({
        severity: total > 1_000_000 ? 'warn' : 'info',
        code: 'CURSOR_LAG',
        message: `${status.lagFiles.length} input file(s) have unread bytes (total ${total.toLocaleString()} bytes)`,
      });
    }
  }

  if (findings.length === 0) {
    findings.push({ severity: 'info', code: 'OK', message: 'no issues found' });
  }

  return { pewHome, pewHomeExists, findings };
}
