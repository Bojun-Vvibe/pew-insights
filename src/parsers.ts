import { createReadStream, promises as fs } from 'node:fs';
import { createInterface } from 'node:readline';
import { join } from 'node:path';
import type {
  Cursors,
  PewState,
  QueueLine,
  QueueState,
  Run,
  SessionLine,
  SessionQueueState,
  TrailingLock,
} from './types.js';
import type { PewPaths } from './paths.js';

// ---------------------------------------------------------------------------
// Model normalisation
// ---------------------------------------------------------------------------

/**
 * Normalise the wide variety of model id strings pew receives from different
 * producers into a single canonical name. See docs/PEW_INTERNALS.md §3.
 */
export function normaliseModel(raw: string): string {
  if (!raw) return 'unknown';
  const placeholders = new Set(['<synthetic>', 'opus', 'big-pickle', 'synthetic']);
  if (placeholders.has(raw)) return 'unknown';

  // Strip provider prefixes
  let m = raw;
  const prefixes = ['github_copilot/', 'github.copilot-chat/', 'copilot/', 'openrouter/'];
  for (const p of prefixes) {
    if (m.toLowerCase().startsWith(p)) {
      m = m.slice(p.length);
      break;
    }
  }

  // Lowercase + collapse spaces to dashes
  m = m.toLowerCase().replace(/\s+/g, '-');

  // claude-haiku-4-5-20251001 → claude-haiku-4.5  (drop trailing date suffix)
  m = m.replace(/-(\d{8})$/, '');

  // Convert dashes between digits to dots: -4-5 → -4.5, -4-7 → -4.7
  // Run twice in case of consecutive matches.
  for (let i = 0; i < 2; i++) {
    m = m.replace(/(\d)-(\d)/g, '$1.$2');
  }

  if (placeholders.has(m)) return 'unknown';
  return m;
}

// ---------------------------------------------------------------------------
// JSONL streaming
// ---------------------------------------------------------------------------

async function* readJsonlLines(path: string): AsyncIterable<string> {
  let stream;
  try {
    stream = createReadStream(path, { encoding: 'utf8' });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (line.trim().length === 0) continue;
    yield line;
  }
}

export async function readQueue(paths: PewPaths): Promise<QueueLine[]> {
  const out: QueueLine[] = [];
  try {
    for await (const line of readJsonlLines(paths.queueJsonl)) {
      try {
        const parsed = JSON.parse(line) as QueueLine;
        out.push(parsed);
      } catch {
        // skip malformed line
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  return out;
}

/**
 * Stream-parse session-queue.jsonl, dedupe by session_key keeping the row
 * with the largest snapshot_at.
 */
export async function readSessionQueue(paths: PewPaths): Promise<SessionLine[]> {
  const byKey = new Map<string, SessionLine>();
  try {
    for await (const line of readJsonlLines(paths.sessionQueueJsonl)) {
      let parsed: SessionLine;
      try {
        parsed = JSON.parse(line) as SessionLine;
      } catch {
        continue;
      }
      if (!parsed || !parsed.session_key) continue;
      const existing = byKey.get(parsed.session_key);
      if (!existing || parsed.snapshot_at > existing.snapshot_at) {
        byKey.set(parsed.session_key, parsed);
      }
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  return Array.from(byKey.values());
}

/**
 * Stream-parse session-queue.jsonl WITHOUT deduplicating. Returns
 * every well-formed JSON row, preserving file order. Needed by
 * commands that analyse multiple snapshots of the same
 * `session_key` (e.g. `model-switching`, where dedup destroys the
 * intra-session model-change signal).
 */
export async function readSessionQueueRaw(paths: PewPaths): Promise<SessionLine[]> {
  const out: SessionLine[] = [];
  try {
    for await (const line of readJsonlLines(paths.sessionQueueJsonl)) {
      let parsed: SessionLine;
      try {
        parsed = JSON.parse(line) as SessionLine;
      } catch {
        continue;
      }
      if (!parsed || !parsed.session_key) continue;
      out.push(parsed);
    }
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

export interface ReadRunsOptions {
  /** Lower-bound ISO timestamp (inclusive). Filename prefix is compared lexically. */
  since?: string;
  /** Stop after this many parsed runs. */
  limit?: number;
}

export async function* readRuns(
  paths: PewPaths,
  opts: ReadRunsOptions = {},
): AsyncIterable<Run> {
  let entries: string[];
  try {
    entries = await fs.readdir(paths.runsDir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw e;
  }

  // Filename format: <iso-timestamp>-<6char>.json — lexically sorts as time order.
  entries.sort();
  let count = 0;
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    if (opts.since) {
      // Compare the leading ISO timestamp portion.
      // Filename prefix length: 'YYYY-MM-DDTHH:MM:SS.sssZ' = 24 chars
      const prefix = name.slice(0, 24);
      if (prefix < opts.since) continue;
    }
    let raw: string;
    try {
      raw = await fs.readFile(join(paths.runsDir, name), 'utf8');
    } catch {
      continue;
    }
    try {
      yield JSON.parse(raw) as Run;
      count++;
      if (opts.limit && count >= opts.limit) return;
    } catch {
      // skip malformed
    }
  }
}

export async function countRuns(paths: PewPaths): Promise<number> {
  try {
    const entries = await fs.readdir(paths.runsDir);
    return entries.length;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return 0;
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Small JSON files
// ---------------------------------------------------------------------------

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(path, 'utf8');
    return JSON.parse(raw) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

async function readText(path: string): Promise<string | null> {
  try {
    return (await fs.readFile(path, 'utf8')).trim();
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function readCursors(paths: PewPaths): Promise<Cursors | null> {
  return readJson<Cursors>(paths.cursorsJson);
}

export async function readQueueState(paths: PewPaths): Promise<QueueState> {
  const v = await readJson<QueueState>(paths.queueStateJson);
  return v ?? { offset: 0, dirtyKeys: [] };
}

export async function readSessionQueueState(
  paths: PewPaths,
): Promise<SessionQueueState> {
  const v = await readJson<SessionQueueState>(paths.sessionQueueStateJson);
  return v ?? { offset: 0 };
}

export async function readLastSuccess(paths: PewPaths): Promise<string | null> {
  return readText(paths.lastSuccessJson);
}

export async function readLastRun(paths: PewPaths): Promise<Run | null> {
  return readJson<Run>(paths.lastRunJson);
}

export async function readTrailingLock(paths: PewPaths): Promise<TrailingLock | null> {
  return readJson<TrailingLock>(paths.trailingLock);
}

export async function readState(paths: PewPaths): Promise<PewState> {
  const [queue, sessionQueue, lastSuccess, lastRun, trailingLock] =
    await Promise.all([
      readQueueState(paths),
      readSessionQueueState(paths),
      readLastSuccess(paths),
      readLastRun(paths),
      readTrailingLock(paths),
    ]);
  return { queue, sessionQueue, lastSuccess, lastRun, trailingLock };
}

// ---------------------------------------------------------------------------
// Filesize helpers
// ---------------------------------------------------------------------------

export async function fileSize(path: string): Promise<number> {
  try {
    const s = await fs.stat(path);
    return s.size;
  } catch {
    return 0;
  }
}
