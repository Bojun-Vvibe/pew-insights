/**
 * Garbage-collect entries from `~/.config/pew/runs/` while always keeping:
 *   - the N most recent runs (regardless of status), and
 *   - the most recent successful run for each calendar day in the data set.
 *
 * Older entries are moved (not deleted) to
 * `~/.cache/pew-insights/archive/runs/`. Filenames are preserved so they
 * can be restored by hand.
 *
 * Dry-run by default; `--confirm` required to mutate.
 */

import { promises as fs } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { PewPaths } from './paths.js';

export interface GcCandidate {
  name: string;       // filename
  path: string;       // absolute current path
  day: string;        // YYYY-MM-DD
  status: string;     // 'succeeded' | 'failed' | 'skipped' | …
  archivePath: string;
}

export interface GcPlan {
  totalRuns: number;
  keepRecent: number;
  keepers: string[];        // basenames retained
  candidates: GcCandidate[]; // entries that would be moved
  archiveDir: string;
}

export function archiveRunsDir(): string {
  return join(homedir(), '.cache', 'pew-insights', 'archive', 'runs');
}

export interface GcOptions {
  keep: number;
}

interface RunMeta {
  name: string;
  path: string;
  day: string;
  status: string;
}

async function loadMeta(paths: PewPaths): Promise<RunMeta[]> {
  let entries: string[];
  try {
    entries = await fs.readdir(paths.runsDir);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw e;
  }
  // Filename format YYYY-MM-DDTHH:MM:SS.sssZ-<6char>.json sorts lexically.
  entries.sort();
  const out: RunMeta[] = [];
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const day = name.slice(0, 10); // 'YYYY-MM-DD'
    let status = 'unknown';
    try {
      const raw = await fs.readFile(join(paths.runsDir, name), 'utf8');
      const parsed = JSON.parse(raw) as { status?: string };
      if (typeof parsed.status === 'string') status = parsed.status;
    } catch {
      // skip unreadable / malformed
    }
    out.push({ name, path: join(paths.runsDir, name), day, status });
  }
  return out;
}

export async function planGc(paths: PewPaths, opts: GcOptions): Promise<GcPlan> {
  const all = await loadMeta(paths);
  const keepRecent = Math.max(0, opts.keep);

  // 1. Keep the N most recent (sort is ascending; recent are at the end).
  const recent = new Set(all.slice(-keepRecent).map((r) => r.name));

  // 2. Keep the last 'succeeded' run per day.
  const lastSuccessByDay = new Map<string, string>();
  for (const r of all) {
    if (r.status === 'succeeded') {
      lastSuccessByDay.set(r.day, r.name);
    }
  }
  const dailyKeepers = new Set(lastSuccessByDay.values());

  const keepers = new Set<string>([...recent, ...dailyKeepers]);
  const archive = archiveRunsDir();
  const candidates: GcCandidate[] = [];
  for (const r of all) {
    if (keepers.has(r.name)) continue;
    candidates.push({
      name: r.name,
      path: r.path,
      day: r.day,
      status: r.status,
      archivePath: join(archive, r.name),
    });
  }

  return {
    totalRuns: all.length,
    keepRecent,
    keepers: Array.from(keepers).sort(),
    candidates,
    archiveDir: archive,
  };
}

export interface GcExecResult {
  moved: number;
  archiveDir: string;
}

export async function executeGc(plan: GcPlan): Promise<GcExecResult> {
  if (plan.candidates.length === 0) {
    return { moved: 0, archiveDir: plan.archiveDir };
  }
  await fs.mkdir(plan.archiveDir, { recursive: true });
  let moved = 0;
  for (const c of plan.candidates) {
    try {
      await fs.rename(c.path, c.archivePath);
      moved += 1;
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === 'EXDEV') {
        // Cross-device — fall back to copy + unlink.
        await fs.copyFile(c.path, c.archivePath);
        await fs.unlink(c.path);
        moved += 1;
      } else if (code === 'ENOENT') {
        // Already gone; treat as success.
      } else {
        throw e;
      }
    }
  }
  return { moved, archiveDir: plan.archiveDir };
}
