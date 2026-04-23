/**
 * Top-projects ranking.
 *
 * Combines:
 *   - per-project token attribution from byproject.ts (proportional
 *     by message-share within each (source, day) bucket); and
 *   - reverse-mapped (project_ref → path / basename) labels from the
 *     projects.ts cache.
 *
 * The denylist filter from projects.ts is applied to every label
 * before it is returned, even in the JSON output. Projects matching
 * the denylist are kept in the ranking (so the user still sees the
 * total token weight in the top-N) but their basename and path are
 * replaced with `<redacted>` and `null` respectively.
 */
import { attributeTokensByProject } from './byproject.js';
import { isPathDenylisted, readCache } from './projects.js';
import type { QueueLine, SessionLine } from './types.js';

export interface TopProjectRow {
  rank: number;
  projectRef: string;
  /** Filesystem basename of the resolved path, or '<redacted>' / null. */
  basename: string | null;
  /** Resolved path (only present when showPaths is true and not denylisted). */
  path: string | null;
  totalTokens: number;
  /** Share of the total displayed window (0..1). */
  share: number;
  bySource: Array<{ source: string; tokens: number }>;
}

export interface TopProjectsResult {
  since: string | null;
  totalTokens: number;
  unattributedTokens: number;
  resolvedCount: number;
  unresolvedCount: number;
  rows: TopProjectRow[];
}

export interface TopProjectsOptions {
  topN?: number;
  showPaths?: boolean;
  /** Override the cached lookup (for tests). When omitted, reads ~/.cache/... */
  lookup?: Map<string, { basename: string; path: string }>;
}

/**
 * Build the top-N ranking. The lookup is a (project_ref → {basename, path})
 * map; entries that are not in the lookup show as basename=null
 * (printed by the CLI as "(unresolved)").
 */
export async function buildTopProjects(
  queue: QueueLine[],
  sessions: SessionLine[],
  since: string | null,
  opts: TopProjectsOptions = {},
): Promise<TopProjectsResult> {
  const topN = opts.topN ?? 10;
  const showPaths = opts.showPaths ?? false;

  let lookup = opts.lookup;
  if (!lookup) {
    const cache = await readCache();
    lookup = new Map();
    if (cache) {
      for (const e of cache.entries) {
        lookup.set(e.projectRef, { basename: e.basename, path: e.path });
      }
    }
  }

  const attribution = attributeTokensByProject(queue, sessions, since);
  const total = attribution.rows.reduce((s, r) => s + r.totalTokens, 0);

  let resolved = 0;
  let unresolved = 0;
  for (const r of attribution.rows) {
    if (lookup.has(r.projectRef)) resolved++;
    else unresolved++;
  }

  const rows: TopProjectRow[] = attribution.rows.slice(0, topN).map((r, i) => {
    const hit = lookup!.get(r.projectRef);
    let basename: string | null;
    let path: string | null;
    if (!hit) {
      basename = null;
      path = null;
    } else if (isPathDenylisted(hit.path) || isPathDenylisted(hit.basename)) {
      basename = '<redacted>';
      path = null;
    } else {
      basename = hit.basename;
      path = showPaths ? hit.path : null;
    }
    return {
      rank: i + 1,
      projectRef: r.projectRef,
      basename,
      path,
      totalTokens: r.totalTokens,
      share: total > 0 ? r.totalTokens / total : 0,
      bySource: r.bySource.slice(0, 5),
    };
  });

  return {
    since,
    totalTokens: total,
    unattributedTokens: attribution.unattributedTokens,
    resolvedCount: resolved,
    unresolvedCount: unresolved,
    rows,
  };
}
