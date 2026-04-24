/**
 * Provider-share: per-session model-provider mix derived from
 * `SessionLine.model`, plus the same mix re-weighted by total
 * messages so we can see how *traffic* (not just session counts)
 * splits between vendors.
 *
 * Why a new subcommand instead of folding into existing reports:
 *
 *   - `agent-mix` reports *kind* (human / agent / ...) — a
 *     workflow split, not a vendor split.
 *   - `model-switching` reports *within-session* model variety
 *     (how often a session touches >1 model id) but never
 *     aggregates the model ids into a vendor.
 *   - `session-source-mix` reports the *producer* (the local
 *     CLI / extension that wrote the session: `claude-code`,
 *     `opencode`, `codex`, ...) — orthogonal to which inference
 *     vendor served the tokens. The same producer can route to
 *     several providers, and the same provider can be reached
 *     through several producers.
 *   - `cost` reports per-model spend but not the rolled-up
 *     vendor share, and discards sessions whose model has no
 *     price entry.
 *
 * The provider-share view answers: *which inference vendor is
 * actually serving my work, by session count and by message
 * volume?* That is the input to "should I rebalance my routing"
 * decisions and to single-vendor-outage risk analysis.
 *
 * Provider classification (case-insensitive, applied after
 * `normaliseModel`):
 *
 *   - `anthropic` ← `claude-*`
 *   - `openai`    ← `gpt-*`, `o1*`, `o3*`, `o4*`, `chatgpt-*`
 *   - `google`    ← `gemini-*`, `palm-*`, `bard-*`
 *   - `meta`      ← `llama-*`, `llama3*`, `llama4*`
 *   - `mistral`   ← `mistral-*`, `mixtral-*`, `codestral-*`
 *   - `xai`       ← `grok-*`
 *   - `deepseek`  ← `deepseek-*`
 *   - `qwen`      ← `qwen-*`, `qwen2*`, `qwen3*`
 *   - `cohere`    ← `command-*`, `cohere-*`
 *   - `unknown`   ← anything else, plus the `'unknown'` sentinel
 *                   that `normaliseModel` already emits for
 *                   placeholder model ids (`<synthetic>`,
 *                   `acp-runtime`, etc.) so they don't pollute
 *                   real-vendor shares.
 *
 * What we emit:
 *
 *   - per-provider session count, share, and message-weighted
 *     share (sum of total_messages per provider / total messages
 *     across all considered sessions).
 *   - top distinct models seen for each provider (default 3),
 *     so the operator can confirm the classification did the
 *     right thing on their data.
 *   - dropped-session counters for visibility: bad started_at,
 *     non-finite total_messages, etc.
 *   - the resolved provider list, sorted by session count desc
 *     then provider name asc, so output is deterministic.
 *
 * Window semantics: filter by `started_at` to match `sessions`,
 * `gaps`, `session-lengths`, `reply-ratio`, `turn-cadence`,
 * `message-volume`, `model-switching`, `idle-gaps`,
 * `session-source-mix`.
 *
 * Determinism: pure builder. No `Date.now()` reads. All sorts
 * fully specified (count desc, then key asc).
 */
import type { SessionLine } from './types.js';
import { normaliseModel } from './parsers.js';

export interface ProviderShareOptions {
  /** Inclusive ISO lower bound on `started_at`. null = no lower bound. */
  since?: string | null;
  /** Exclusive ISO upper bound on `started_at`. null = no upper bound. */
  until?: string | null;
  /**
   * Number of distinct top-models to keep per provider in the
   * `topModels` field. Default 3. Must be a non-negative integer
   * (0 disables the per-provider model breakdown entirely).
   */
  topModels?: number;
  /** Override for tests; bypasses Date.now(). */
  generatedAt?: string;
}

export interface ProviderModelEntry {
  /** Normalised model id (output of `normaliseModel`). */
  model: string;
  sessions: number;
}

export interface ProviderRow {
  /** Canonical provider key. Lowercase, no whitespace. */
  provider: string;
  /** Number of sessions classified into this provider. */
  sessions: number;
  /** sessions / consideredSessions. 0 when input is empty. */
  sessionShare: number;
  /** Sum of `total_messages` across this provider's sessions. */
  messages: number;
  /** messages / sum of all considered messages. 0 when no messages. */
  messageShare: number;
  /** Distinct normalised model ids actually seen for this provider. */
  distinctModels: number;
  /**
   * Top normalised model ids by session count, length ≤ topModels.
   * Sorted by sessions desc, then model asc. Empty array when
   * topModels === 0.
   */
  topModels: ProviderModelEntry[];
}

export interface ProviderShareReport {
  generatedAt: string;
  windowStart: string | null;
  windowEnd: string | null;
  topModels: number;
  /** Sessions matched by window and used in shares. */
  consideredSessions: number;
  /** Sum of total_messages across `consideredSessions`. */
  consideredMessages: number;
  /** Sessions with non-parseable started_at. */
  droppedInvalidStartedAt: number;
  /** Sessions with non-finite / negative total_messages. */
  droppedInvalidMessages: number;
  /** One row per provider, sorted by sessions desc, provider asc. */
  providers: ProviderRow[];
}

/**
 * Map a normalised model id (output of `normaliseModel`) to its
 * provider. Public for tests and for re-use by future commands.
 */
export function classifyProvider(normalisedModel: string): string {
  if (!normalisedModel || normalisedModel === 'unknown') return 'unknown';
  const m = normalisedModel.toLowerCase();
  if (m.startsWith('claude-') || m === 'claude') return 'anthropic';
  if (
    m.startsWith('gpt-') ||
    m === 'gpt' ||
    m.startsWith('chatgpt-') ||
    /^o[134](?:[-.]|$)/.test(m)
  ) {
    return 'openai';
  }
  if (m.startsWith('gemini-') || m.startsWith('palm-') || m.startsWith('bard-')) {
    return 'google';
  }
  if (m.startsWith('llama-') || m.startsWith('llama3') || m.startsWith('llama4')) {
    return 'meta';
  }
  if (m.startsWith('mistral-') || m.startsWith('mixtral-') || m.startsWith('codestral-')) {
    return 'mistral';
  }
  if (m.startsWith('grok-') || m === 'grok') return 'xai';
  if (m.startsWith('deepseek-')) return 'deepseek';
  if (m.startsWith('qwen-') || m.startsWith('qwen2') || m.startsWith('qwen3')) return 'qwen';
  if (m.startsWith('command-') || m.startsWith('cohere-')) return 'cohere';
  return 'unknown';
}

export function buildProviderShare(
  sessions: SessionLine[],
  opts: ProviderShareOptions = {},
): ProviderShareReport {
  const topModels = opts.topModels ?? 3;
  if (!Number.isInteger(topModels) || topModels < 0) {
    throw new Error(`topModels must be a non-negative integer (got ${opts.topModels})`);
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

  // provider -> { sessions, messages, models: Map<model, count> }
  const agg = new Map<
    string,
    { sessions: number; messages: number; models: Map<string, number> }
  >();
  let consideredSessions = 0;
  let consideredMessages = 0;
  let droppedInvalidStartedAt = 0;
  let droppedInvalidMessages = 0;

  for (const s of sessions) {
    const startMs = Date.parse(s.started_at);
    if (!Number.isFinite(startMs)) {
      droppedInvalidStartedAt += 1;
      continue;
    }
    if (sinceMs !== null && startMs < sinceMs) continue;
    if (untilMs !== null && startMs >= untilMs) continue;

    const tm = Number(s.total_messages);
    if (!Number.isFinite(tm) || tm < 0) {
      droppedInvalidMessages += 1;
      continue;
    }

    const norm = normaliseModel(typeof s.model === 'string' ? s.model : '');
    const provider = classifyProvider(norm);

    consideredSessions += 1;
    consideredMessages += tm;

    let row = agg.get(provider);
    if (!row) {
      row = { sessions: 0, messages: 0, models: new Map() };
      agg.set(provider, row);
    }
    row.sessions += 1;
    row.messages += tm;
    row.models.set(norm, (row.models.get(norm) ?? 0) + 1);
  }

  const providers: ProviderRow[] = [];
  for (const [provider, row] of agg) {
    const top: ProviderModelEntry[] = [];
    if (topModels > 0) {
      const entries = Array.from(row.models.entries()).map(([model, sessions]) => ({
        model,
        sessions,
      }));
      entries.sort((a, b) => {
        if (b.sessions !== a.sessions) return b.sessions - a.sessions;
        return a.model < b.model ? -1 : a.model > b.model ? 1 : 0;
      });
      for (const e of entries.slice(0, topModels)) top.push(e);
    }
    providers.push({
      provider,
      sessions: row.sessions,
      sessionShare: consideredSessions === 0 ? 0 : row.sessions / consideredSessions,
      messages: row.messages,
      messageShare: consideredMessages === 0 ? 0 : row.messages / consideredMessages,
      distinctModels: row.models.size,
      topModels: top,
    });
  }
  providers.sort((a, b) => {
    if (b.sessions !== a.sessions) return b.sessions - a.sessions;
    return a.provider < b.provider ? -1 : a.provider > b.provider ? 1 : 0;
  });

  return {
    generatedAt,
    windowStart: opts.since ?? null,
    windowEnd: opts.until ?? null,
    topModels,
    consideredSessions,
    consideredMessages,
    droppedInvalidStartedAt,
    droppedInvalidMessages,
    providers,
  };
}
