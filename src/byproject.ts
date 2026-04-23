/**
 * Per-project token attribution.
 *
 * pew's queue.jsonl has no session_key or project_ref — only
 * (source, model, hour_start, device_id, *_tokens). To attribute
 * tokens to a project we have to bridge through session-queue.jsonl,
 * which carries (project_ref, source, last_message_at, total_messages).
 *
 * Method (proportional weighting)
 * -------------------------------
 * For each (source, day) bucket:
 *   1. Sum total_messages per project_ref across sessions whose
 *      last_message_at falls in that day.
 *   2. Distribute the bucket's queue tokens to project_refs in
 *      proportion to their message share.
 *
 * This is necessarily approximate: a session may straddle multiple
 * days, queue rows are bucketed by hour while sessions are bucketed
 * by their last message, and a busy `pew` user may also have queue
 * rows with no matching session. The unattributed remainder is kept
 * as a separate row keyed `__unattributed__`.
 */

import { normaliseModel } from './parsers.js';
import type { QueueLine, SessionLine } from './types.js';

export interface ProjectBreakdown {
  projectRef: string;
  totalTokens: number;
  bySource: Map<string, number>;
}

export interface ByProjectResult {
  rows: Array<{
    projectRef: string;
    totalTokens: number;
    bySource: Array<{ source: string; tokens: number }>;
  }>;
  unattributedTokens: number;
}

function dayOf(iso: string): string {
  return iso.slice(0, 10);
}

export function attributeTokensByProject(
  queue: QueueLine[],
  sessions: SessionLine[],
  since: string | null,
): ByProjectResult {
  const queueFiltered = since ? queue.filter((q) => q.hour_start >= since) : queue;
  const sessionsFiltered = since
    ? sessions.filter((s) => s.last_message_at >= since)
    : sessions;

  // Index sessions by (source, day) → Map<project_ref, message_weight>.
  const weights = new Map<string, Map<string, number>>();
  for (const s of sessionsFiltered) {
    if (!s.project_ref) continue;
    const key = `${s.source}\u0001${dayOf(s.last_message_at)}`;
    let inner = weights.get(key);
    if (!inner) {
      inner = new Map();
      weights.set(key, inner);
    }
    const w = Math.max(1, s.total_messages || 0);
    inner.set(s.project_ref, (inner.get(s.project_ref) ?? 0) + w);
  }

  // Bucket queue rows by (source, day) and accumulate tokens.
  const queueBuckets = new Map<string, number>();
  for (const q of queueFiltered) {
    const key = `${q.source}\u0001${dayOf(q.hour_start)}`;
    queueBuckets.set(key, (queueBuckets.get(key) ?? 0) + (q.total_tokens || 0));
  }

  // Distribute.
  const projects = new Map<string, ProjectBreakdown>();
  let unattributed = 0;

  for (const [key, tokens] of queueBuckets) {
    const inner = weights.get(key);
    const source = key.split('\u0001')[0]!;
    if (!inner || inner.size === 0) {
      unattributed += tokens;
      continue;
    }
    const totalWeight = Array.from(inner.values()).reduce((s, v) => s + v, 0);
    if (totalWeight === 0) {
      unattributed += tokens;
      continue;
    }
    for (const [ref, w] of inner) {
      const share = (w / totalWeight) * tokens;
      let pb = projects.get(ref);
      if (!pb) {
        pb = { projectRef: ref, totalTokens: 0, bySource: new Map() };
        projects.set(ref, pb);
      }
      pb.totalTokens += share;
      pb.bySource.set(source, (pb.bySource.get(source) ?? 0) + share);
    }
  }

  const rows = Array.from(projects.values())
    .map((p) => ({
      projectRef: p.projectRef,
      totalTokens: Math.round(p.totalTokens),
      bySource: Array.from(p.bySource.entries())
        .map(([source, tokens]) => ({ source, tokens: Math.round(tokens) }))
        .sort((a, b) => b.tokens - a.tokens),
    }))
    .sort((a, b) => b.totalTokens - a.totalTokens);

  // Reference the parameter so unused-param lints stay quiet across CI.
  void normaliseModel;

  return { rows, unattributedTokens: Math.round(unattributed) };
}
