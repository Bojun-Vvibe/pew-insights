/**
 * Safely compact pew's append-only logs (`queue.jsonl`,
 * `session-queue.jsonl`).
 *
 * Strategy
 * --------
 * 1. Read `queue.state.json` → `offset`. Bytes [0, offset) are considered
 *    fully shipped and safe to evict.
 * 2. Move the [0, offset) prefix into
 *    `~/.cache/pew-insights/archive/queue.YYYY-MM-DD.jsonl.gz`.
 * 3. Rewrite the live file to start at `offset`.
 * 4. Update `queue.state.json` to `{ offset: 0 }` (preserving any other
 *    fields like dirtyKeys).
 *
 * Same flow for `session-queue.jsonl` (state contains only `offset`).
 *
 * Safety
 * ------
 * - Dry-run by default; `--confirm` required to mutate.
 * - Refuses to run if `trailing.lock` is present and the holding pid is
 *   still alive (pew is currently syncing).
 * - Writes archive first, syncs, then atomically replaces the live file
 *   via `rename(tmp → live)` — partial failure leaves either the original
 *   or the new file fully on disk, never a torn write.
 */

import { createReadStream, createWriteStream, promises as fs } from 'node:fs';
import { createGzip } from 'node:zlib';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { PewPaths } from './paths.js';
import type { TrailingLock } from './types.js';

export interface CompactPlanEntry {
  name: 'queue' | 'session-queue';
  livePath: string;
  statePath: string;
  liveSize: number;
  offset: number;
  evictableBytes: number;
  archivePath: string;
}

export interface CompactPlan {
  entries: CompactPlanEntry[];
  trailingLockHolder: TrailingLock | null;
  trailingLockAlive: boolean | null;
  blocked: boolean;
  blockReason: string | null;
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

export function archiveDir(): string {
  return join(homedir(), '.cache', 'pew-insights', 'archive');
}

function todayStamp(d: Date = new Date()): string {
  return d.toISOString().slice(0, 10);
}

async function readJsonSafe<T>(path: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(path, 'utf8')) as T;
  } catch {
    return null;
  }
}

async function fileSize(path: string): Promise<number> {
  try {
    return (await fs.stat(path)).size;
  } catch {
    return 0;
  }
}

export async function planCompaction(paths: PewPaths): Promise<CompactPlan> {
  const lock = await readJsonSafe<TrailingLock>(paths.trailingLock);
  const lockAlive = lock ? isPidAlive(lock.pid) : null;

  const entries: CompactPlanEntry[] = [];
  const today = todayStamp();
  const archive = archiveDir();

  // queue
  {
    const liveSize = await fileSize(paths.queueJsonl);
    const state = (await readJsonSafe<{ offset?: number }>(paths.queueStateJson)) ?? {};
    const offset = Math.max(0, Math.min(state.offset ?? 0, liveSize));
    const evictable = offset;
    entries.push({
      name: 'queue',
      livePath: paths.queueJsonl,
      statePath: paths.queueStateJson,
      liveSize,
      offset,
      evictableBytes: evictable,
      archivePath: join(archive, `queue.${today}.jsonl.gz`),
    });
  }
  // session-queue
  {
    const liveSize = await fileSize(paths.sessionQueueJsonl);
    const state = (await readJsonSafe<{ offset?: number }>(paths.sessionQueueStateJson)) ?? {};
    const offset = Math.max(0, Math.min(state.offset ?? 0, liveSize));
    const evictable = offset;
    entries.push({
      name: 'session-queue',
      livePath: paths.sessionQueueJsonl,
      statePath: paths.sessionQueueStateJson,
      liveSize,
      offset,
      evictableBytes: evictable,
      archivePath: join(archive, `session-queue.${today}.jsonl.gz`),
    });
  }

  let blocked = false;
  let blockReason: string | null = null;
  if (lock && lockAlive) {
    blocked = true;
    blockReason = `trailing.lock held by live pid ${lock.pid} (started ${lock.startedAt}); refusing to mutate`;
  }

  return {
    entries,
    trailingLockHolder: lock,
    trailingLockAlive: lockAlive,
    blocked,
    blockReason,
  };
}

export interface CompactExecResult {
  name: 'queue' | 'session-queue';
  archivedBytes: number;
  archivePath: string;
  newLiveBytes: number;
  skipped: boolean;
  reason?: string;
}

/**
 * Append a gzipped copy of `[0, offset)` from `livePath` to `archivePath`,
 * then atomically replace `livePath` with the suffix `[offset, end)`.
 * If `archivePath` already exists, the new chunk is concatenated as a
 * second gzip member (RFC 1952: a gzip file may be a concatenation of
 * gzip streams).
 */
async function archiveAndTruncate(
  livePath: string,
  archivePath: string,
  offset: number,
): Promise<{ archived: number; newLiveBytes: number }> {
  await fs.mkdir(dirname(archivePath), { recursive: true });

  // Step 1: append archive (offset bytes from start).
  if (offset > 0) {
    const reader = createReadStream(livePath, { start: 0, end: offset - 1 });
    const gz = createGzip();
    const writer = createWriteStream(archivePath, { flags: 'a' });
    await pipeline(reader, gz, writer);
  }

  // Step 2: write the suffix to a tmp file then rename.
  const tmp = `${livePath}.compact.tmp`;
  // Always create the tmp (may be empty).
  const reader = createReadStream(livePath, { start: offset });
  const writer = createWriteStream(tmp, { flags: 'w' });
  await pipeline(reader, writer);

  // Atomic-ish replacement.
  await fs.rename(tmp, livePath);

  const newSize = await fileSize(livePath);
  return { archived: offset, newLiveBytes: newSize };
}

export async function executeCompaction(
  paths: PewPaths,
  plan: CompactPlan,
): Promise<CompactExecResult[]> {
  if (plan.blocked) {
    throw new Error(plan.blockReason ?? 'compaction blocked');
  }

  const results: CompactExecResult[] = [];
  for (const e of plan.entries) {
    if (e.evictableBytes <= 0) {
      results.push({
        name: e.name,
        archivedBytes: 0,
        archivePath: e.archivePath,
        newLiveBytes: e.liveSize,
        skipped: true,
        reason: 'nothing to evict (offset is 0 or file is empty)',
      });
      continue;
    }
    const { archived, newLiveBytes } = await archiveAndTruncate(
      e.livePath,
      e.archivePath,
      e.evictableBytes,
    );
    // Reset offset in state file, preserving other fields.
    const stateRaw = (await readJsonSafe<Record<string, unknown>>(e.statePath)) ?? {};
    stateRaw['offset'] = 0;
    await fs.writeFile(e.statePath, JSON.stringify(stateRaw, null, 2));
    results.push({
      name: e.name,
      archivedBytes: archived,
      archivePath: e.archivePath,
      newLiveBytes,
      skipped: false,
    });
  }
  return results;
}
