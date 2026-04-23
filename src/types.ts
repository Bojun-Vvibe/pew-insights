/**
 * On-disk types for pew v2.20.3 state.
 * See docs/PEW_INTERNALS.md for full schema documentation.
 */

export interface QueueLine {
  source: string;
  model: string;
  hour_start: string; // ISO-8601
  device_id: string;
  input_tokens: number;
  cached_input_tokens: number;
  output_tokens: number;
  reasoning_output_tokens: number;
  total_tokens: number;
}

export type SessionKind = 'human' | 'agent' | string;

export interface SessionLine {
  session_key: string;
  source: string;
  kind: SessionKind;
  started_at: string;
  last_message_at: string;
  duration_seconds: number;
  user_messages: number;
  assistant_messages: number;
  total_messages: number;
  project_ref: string; // 16-hex
  model: string;
  snapshot_at: string;
}

export interface RunTrigger {
  kind: string; // 'notify' | 'interval' | 'manual' | ...
  source: string | null;
  fileHint: string | null;
}

export interface RunCoordination {
  waitedForLock: boolean;
  skippedSync: boolean;
  skippedReason: string | null;
  cooldownRemainingMs: number;
  hadFollowUp: boolean;
  followUpCount: number;
  degradedToUnlocked: boolean;
}

export interface Run {
  runId: string;
  version: string;
  triggers: RunTrigger[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
  coordination: RunCoordination;
  cycles: unknown[];
  status: 'skipped' | 'succeeded' | 'failed' | string;
}

/** Full cursor variant — used in cursors.json. */
export interface FileCursorFull {
  inode: number;
  mtimeMs: number;
  size: number;
  offset: number;
  updatedAt: string;
}

/** Lightweight cursor variant — used in session-cursors.json. */
export interface FileCursorLight {
  mtimeMs: number;
  size: number;
}

/** Legacy cursor variant — seen in older pew installs. */
export interface FileCursorLegacy {
  offset: number;
  mtimeMs: number;
}

export type FileCursor = FileCursorFull | FileCursorLight | FileCursorLegacy;

export interface CursorsFile<T extends FileCursor = FileCursor> {
  version: number;
  files: Record<string, T>;
}

export type Cursors = CursorsFile<FileCursorFull>;
export type SessionCursors = CursorsFile<FileCursorLight>;

export interface QueueState {
  offset: number;
  dirtyKeys: string[];
}

export interface SessionQueueState {
  offset: number;
}

export interface TrailingLock {
  pid: number;
  startedAt: string;
}

export interface PewConfig {
  token: string;
}

export interface PewDevice {
  device_id: string;
}

export interface PewState {
  queue: QueueState;
  sessionQueue: SessionQueueState;
  lastSuccess: string | null;
  lastRun: Run | null;
  trailingLock: TrailingLock | null;
}
