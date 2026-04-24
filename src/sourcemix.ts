/**
 * Session source-mix over time windows.
 *
 * Where existing reports stop:
 *
 *   - `sessions` reports an aggregate count of sessions per
 *     source over the whole window — it cannot answer "is the
 *     mix of which agent I use *changing* over time".
 *   - `top-projects` and `by-project` slice along `project_ref`,
 *     not along `source` × time.
 *   - `trend` is token-shaped (it operates on the raw queue, not
 *     the session queue) and reports volume, not mix.
 *
 * `session-source-mix` answers:
 *
 *   1. What share of my sessions per day / week / month came
 *      from each source (claude-code / opencode / codex / ...) ?
 *   2. Is one source taking over (rising share) or fading out
 *      (falling share) over the window?
 *   3. What is the dominant source per bucket and how dominant
 *      is it (the modal source's share)?
 *
 * Bucket semantics: each session is placed in exactly one
 * bucket determined by `started_at` floored to the bucket's
 * lower edge in **UTC**:
 *
 *   - `day`   → YYYY-MM-DD
 *   - `week`  → ISO-week-aligned Monday at 00:00:00Z, labelled
 *               YYYY-MM-DD (the Monday).
 *   - `month` → YYYY-MM-01.
 *
 * Output: one `SourceMixBucket` per non-empty time bucket,
 * sorted ascending by bucket start. Each bucket carries one
 * `share` row per source seen in that bucket, sorted by share
 * desc then source asc, plus the modal source and its share.
 *
 * Determinism: pure builder. No `Date.now()` reads. Window
 * filtering on `started_at`. Sessions with unparseable
 * `started_at` are counted in `droppedInvalid`. Sessions whose
 * source is empty / non-string are bucketed under the literal
 * group `'unknown'` (matches `pickGroup` in `messagevolume`).
 */
import type { SessionLine } from './types.js';

export type SourceMixBucketUnit = 'day' | 'week' | 'month';

export interface SourceMixOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /** Bucket granularity. Default 'day'. */
  unit?: SourceMixBucketUnit;
  /**
   * If set, only the top-N sources by *total sessions in the
   * window* are reported per bucket; the remaining sources are
   * folded into a single synthetic source labelled `'other'`.
   * Default: 0 = no folding (every source kept).
   */
  top?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface SourceMixShareRow {
  source: string;
  count: number;
  /** count / bucket totalSessions, in [0, 1]. */
  share: number;
}

export interface SourceMixBucket {
  /**
   * Canonical bucket label.
   *
   *   - `day`   → 'YYYY-MM-DD'
   *   - `week`  → 'YYYY-MM-DD'  (the Monday at 00:00:00Z)
   *   - `month` → 'YYYY-MM-01'
   */
  bucket: string;
  /** ISO start of the bucket in UTC. */
  bucketStart: string;
  totalSessions: number;
  /** Distinct sources observed in this bucket. */
  uniqueSources: number;
  /** Share rows, sorted by share desc then source asc. */
  shares: SourceMixShareRow[];
  /** Source with the largest count in this bucket. '' when empty. */
  modalSource: string;
  /** Share of `modalSource` in this bucket. 0 when empty. */
  modalShare: number;
}

export interface SourceMixReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  unit: SourceMixBucketUnit;
  top: number;
  /** Total sessions matched by window and bucketed. */
  consideredSessions: number;
  /** Sessions with unparseable `started_at`. */
  droppedInvalid: number;
  /** All sources seen across the window, sorted by total desc then source asc. */
  sources: SourceMixShareRow[];
  /** Buckets in ascending order by bucketStart. */
  buckets: SourceMixBucket[];
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function bucketKeyFor(ms: number, unit: SourceMixBucketUnit): { key: string; startMs: number } {
  const d = new Date(ms);
  if (unit === 'day') {
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const da = d.getUTCDate();
    const startMs = Date.UTC(y, mo, da);
    return { key: `${y}-${pad2(mo + 1)}-${pad2(da)}`, startMs };
  }
  if (unit === 'month') {
    const y = d.getUTCFullYear();
    const mo = d.getUTCMonth();
    const startMs = Date.UTC(y, mo, 1);
    return { key: `${y}-${pad2(mo + 1)}-01`, startMs };
  }
  // week: ISO week — Monday as start of week.
  // getUTCDay(): Sun=0, Mon=1, ..., Sat=6. Monday offset = (dow + 6) % 7.
  const dow = d.getUTCDay();
  const offset = (dow + 6) % 7;
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - offset));
  const y = monday.getUTCFullYear();
  const mo = monday.getUTCMonth();
  const da = monday.getUTCDate();
  return {
    key: `${y}-${pad2(mo + 1)}-${pad2(da)}`,
    startMs: monday.getTime(),
  };
}

function pickSource(s: SessionLine): string {
  return typeof s.source === 'string' && s.source.length > 0 ? s.source : 'unknown';
}

export function buildSourceMix(
  sessions: SessionLine[],
  opts: SourceMixOptions = {},
): SourceMixReport {
  const unit: SourceMixBucketUnit = opts.unit ?? 'day';
  if (unit !== 'day' && unit !== 'week' && unit !== 'month') {
    throw new Error(`unit must be 'day' | 'week' | 'month' (got ${String(opts.unit)})`);
  }

  const top = opts.top ?? 0;
  if (!Number.isFinite(top) || top < 0 || !Number.isInteger(top)) {
    throw new Error(`top must be a non-negative integer (got ${opts.top})`);
  }

  const sinceMs = opts.since != null ? Date.parse(opts.since) : null;
  const untilMs = opts.until != null ? Date.parse(opts.until) : null;
  if (opts.since != null && (sinceMs === null || !Number.isFinite(sinceMs))) {
    throw new Error(`invalid since: ${opts.since}`);
  }
  if (opts.until != null && (untilMs === null || !Number.isFinite(untilMs))) {
    throw new Error(`invalid until: ${opts.until}`);
  }

  const generatedAt = opts.generatedAt ?? new Date().toISOString();

  // bucketKey -> { startMs, sourceCounts }
  const bucketState = new Map<
    string,
    { startMs: number; counts: Map<string, number>; total: number }
  >();
  const totalsBySource = new Map<string, number>();
  let consideredSessions = 0;
  let droppedInvalid = 0;

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) {
      droppedInvalid += 1;
      continue;
    }
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    const { key, startMs: bStart } = bucketKeyFor(startMs, unit);
    const src = pickSource(s);
    let st = bucketState.get(key);
    if (!st) {
      st = { startMs: bStart, counts: new Map(), total: 0 };
      bucketState.set(key, st);
    }
    st.counts.set(src, (st.counts.get(src) ?? 0) + 1);
    st.total += 1;
    totalsBySource.set(src, (totalsBySource.get(src) ?? 0) + 1);
    consideredSessions += 1;
  }

  // Determine the keep-set when --top is in effect.
  const totalSourcesSorted: SourceMixShareRow[] = [...totalsBySource.entries()]
    .map(([source, count]) => ({
      source,
      count,
      share: consideredSessions === 0 ? 0 : count / consideredSessions,
    }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
    });

  const keepSet: Set<string> | null =
    top > 0 && totalSourcesSorted.length > top
      ? new Set(totalSourcesSorted.slice(0, top).map((r) => r.source))
      : null;

  const buckets: SourceMixBucket[] = [];
  for (const [bucket, st] of bucketState) {
    // Apply top-N folding into 'other' if active.
    let folded: Map<string, number>;
    if (keepSet === null) {
      folded = st.counts;
    } else {
      folded = new Map();
      for (const [src, n] of st.counts) {
        if (keepSet.has(src)) {
          folded.set(src, (folded.get(src) ?? 0) + n);
        } else {
          folded.set('other', (folded.get('other') ?? 0) + n);
        }
      }
    }

    const shares: SourceMixShareRow[] = [...folded.entries()]
      .map(([source, count]) => ({
        source,
        count,
        share: st.total === 0 ? 0 : count / st.total,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
      });

    const modal = shares[0];
    buckets.push({
      bucket,
      bucketStart: new Date(st.startMs).toISOString(),
      totalSessions: st.total,
      uniqueSources: shares.length,
      shares,
      modalSource: modal ? modal.source : '',
      modalShare: modal ? modal.share : 0,
    });
  }

  buckets.sort((a, b) => (a.bucketStart < b.bucketStart ? -1 : a.bucketStart > b.bucketStart ? 1 : 0));

  // Re-fold the top-level `sources` rollup the same way the buckets are folded.
  let sources: SourceMixShareRow[];
  if (keepSet === null) {
    sources = totalSourcesSorted;
  } else {
    const foldedTotals = new Map<string, number>();
    for (const r of totalSourcesSorted) {
      const k = keepSet.has(r.source) ? r.source : 'other';
      foldedTotals.set(k, (foldedTotals.get(k) ?? 0) + r.count);
    }
    sources = [...foldedTotals.entries()]
      .map(([source, count]) => ({
        source,
        count,
        share: consideredSessions === 0 ? 0 : count / consideredSessions,
      }))
      .sort((a, b) => {
        if (b.count !== a.count) return b.count - a.count;
        return a.source < b.source ? -1 : a.source > b.source ? 1 : 0;
      });
  }

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    unit,
    top,
    consideredSessions,
    droppedInvalid,
    sources,
    buckets,
  };
}
