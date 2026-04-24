# pew internals reference

> **Reverse-engineered from pew v2.20.3 install on 2026-04-23. Filed by Bojun-Vvibe. PRs welcome to keep this current.**
>
> This document describes the on-disk state pew maintains under `~/.config/pew/` (overridable via `$PEW_HOME`). It is based on direct read-only inspection of a real install and is not derived from any pew source code or internal docs. Sensitive values (auth token, device id) are redacted in the examples below.

## 1. Directory map

```
~/.config/pew/
├── config.json                              # account auth token
├── device.json                              # this device's stable id
├── last-run.json                            # detailed record of the most recent sync attempt
├── last-success.json                        # ISO-8601 timestamp of the last fully-successful sync
├── notify.signal                            # touch-file: external producers nudge pew here
├── trailing.lock                            # advisory single-writer lock; { pid, startedAt }
├── queue.jsonl                              # append-only token-usage events (pending + already-flushed)
├── queue.state.json                         # { offset, dirtyKeys[] } — byte cursor into queue.jsonl
├── session-queue.jsonl                      # append-only session snapshots (pending + already-flushed)
├── session-queue.state.json                 # { offset } — byte cursor into session-queue.jsonl
├── cursors.json                             # rich per-input-file cursor (inode, mtime, size, offset)
├── session-cursors.json                     # lightweight per-input-file cursor (mtime, size only)
├── openclaw.session-sync.trigger-state.json # { lastTriggeredAt: epoch_ms }
├── openclaw-plugin/
│   └── pew-session-sync                     # native helper binary / shim
├── bin/
│   ├── notify.cjs                           # node shim other tools call to ping pew
│   └── notify.cjs.bak.<iso>                 # automatic backups when shim is rewritten
└── runs/                                    # one JSON file per sync run; ~36k files in this install
    └── <iso-timestamp>-<6char-suffix>.json
```

## 2. Files in detail

### 2.1 `config.json`

```json
{ "token": "pk_<REDACTED>" }
```

Single string field `token`. Format `pk_` + 32 hex chars. This is the account-level auth token used against the pew.md API. **Treat as a secret.** `pew-insights` never reads this field.

### 2.2 `device.json`

```json
{ "device_id": "<REDACTED-uuid-v4>" }
```

Stable per-machine UUID v4. Echoed into every `queue.jsonl` line (`device_id` field) so the server can attribute usage to a device. `pew-insights` reads it only to display it in `status` (truncated/redacted).

### 2.3 `last-run.json`

Detailed structured record of the most recent sync attempt — succeeded or not.

```json
{
  "runId": "2026-04-23T08:46:58.052Z-n9oids",
  "version": "2.20.3",
  "triggers": [{ "kind": "notify", "source": "opencode", "fileHint": null }],
  "startedAt": "2026-04-23T08:46:58.052Z",
  "completedAt": "2026-04-23T08:46:58.053Z",
  "durationMs": 1,
  "coordination": {
    "waitedForLock": false,
    "skippedSync": true,
    "skippedReason": "cooldown",
    "cooldownRemainingMs": 71563,
    "hadFollowUp": false,
    "followUpCount": 0,
    "degradedToUnlocked": false
  },
  "cycles": [],
  "status": "skipped"
}
```

Fields seen so far:

- `runId` — `<iso>-<6char>`; matches the filename in `runs/`.
- `version` — pew CLI semver.
- `triggers[]` — what kicked the run. `kind` ∈ `notify`, `interval`, `manual`, … ; `source` is the producer name (e.g. `opencode`, `claude-code`); `fileHint` is an optional path the producer wants pew to look at first.
- `startedAt`, `completedAt`, `durationMs`.
- `coordination` — lock + cooldown bookkeeping. `skippedReason` ∈ `cooldown`, `lock-held`, … (full enum unknown).
- `cycles[]` — populated when actual sync work happened. Empty when `status === "skipped"`.
- `status` — `succeeded`, `skipped`, `failed`, … (full enum unknown).

### 2.4 `last-success.json`

A single bare ISO-8601 timestamp string, no JSON wrapping object:

```
2026-04-23T08:43:09.616Z
```

Updated only on a fully successful sync. `pew-insights status` reports this verbatim.

### 2.5 `notify.signal`

Touch-file. External tools (claude-code, opencode, copilot, etc.) write something — typically a short JSON or just a timestamp — to nudge pew that there is new data to sync. Pew watches mtime, not contents. Safe to ignore for read-only consumers.

### 2.6 `trailing.lock`

Advisory single-writer lock. Either absent (no run in progress) or contains:

```json
{ "pid": 33339, "startedAt": "2026-04-23T08:43:15.518Z" }
```

If `pid` is not alive on the host, the lock is **stale** and likely from a crashed sync. `pew-insights doctor` flags stale locks.

### 2.7 `queue.jsonl` — token-usage events

Append-only. One JSON object per line. **Lines before `queue.state.json.offset` have already been flushed to the server but are not deleted** — pew never compacts this file (one of the gaps `pew-insights` exists to fill).

Schema:

```jsonc
{
  "source": "claude-code",                 // producer; see catalogue below
  "model": "claude-opus-4.7",              // provider model id; see normalisation below
  "hour_start": "2026-04-20T12:00:00.000Z",// 30-minute or 1-hour bucket start
  "device_id": "<uuid>",
  "input_tokens": 22374827,
  "cached_input_tokens": 20780746,
  "output_tokens": 177825,
  "reasoning_output_tokens": 0,
  "total_tokens": 43333398
}
```

Notes:

- Buckets are sometimes 30-minute (`:00:00.000Z` / `:30:00.000Z`) — pew aggregates client-side before queueing.
- `total_tokens` ≈ `input + cached_input + output + reasoning_output` but **trust the field**, don't recompute (some sources round differently).
- Multiple lines may exist for the same `(source, model, hour_start, device_id)` if the bucket got re-flushed. The server-side dedupe key is presumed to be all five non-token fields.

### 2.8 `queue.state.json`

```json
{ "offset": 300709, "dirtyKeys": [] }
```

- `offset` — byte position; everything before this in `queue.jsonl` has been acknowledged by the server.
- `dirtyKeys[]` — usually empty. When non-empty, pew is mid-flush on those bucket keys; do not assume those rows are persisted server-side.

### 2.9 `session-queue.jsonl` — session snapshots

Append-only. One JSON object per line, one **snapshot of one chat session** per object.

```jsonc
{
  "session_key": "claude:0a716108-c9a3-4879-aee8-f13934df7cb2",
  "source": "claude-code",
  "kind": "human",                          // "human" | "agent" | ... ?
  "started_at":      "2026-04-20T12:01:51.037Z",
  "last_message_at": "2026-04-20T12:04:52.541Z",
  "duration_seconds": 181,
  "user_messages": 19,
  "assistant_messages": 37,
  "total_messages": 104,
  "project_ref": "45de70d31f768901",        // 16-hex hash of the project root
  "model": "claude-opus-4.7",
  "snapshot_at": "2026-04-22T14:50:22.808Z"
}
```

Important: **the same `session_key` appears multiple times** as the session grows; `snapshot_at` is what disambiguates. To get the canonical view of a session, group by `session_key` and keep the row with the largest `snapshot_at`. `pew-insights` does this by default.

`project_ref` is a stable 16-character lowercase hex string; we believe it is a hash of the project root path, but the hash function is not yet known (see Open Questions §5.1).

### 2.10 `session-queue.state.json`

```json
{ "offset": 1418246 }
```

Same byte-cursor semantics as `queue.state.json`, no `dirtyKeys`.

### 2.11 `cursors.json`

Rich per-input-file cursor. One entry per source-file that pew tails (e.g. each Claude Code transcript JSONL). Used by the **token usage** ingestor.

```json
{
  "version": 1,
  "files": {
    "/Users/bojun/.claude/projects/.../<uuid>.jsonl": {
      "inode": 136866716,
      "mtimeMs": 1776686693758.9158,
      "size": 145756,
      "offset": 145756,
      "updatedAt": "2026-04-22T14:50:19.684Z"
    }
  }
}
```

Three field shapes (`FileCursor` variants) observed across pew installs:

1. **Full** — `{ inode, mtimeMs, size, offset, updatedAt }` (used in `cursors.json`).
2. **Lightweight** — `{ mtimeMs, size }` only (used in `session-cursors.json`).
3. **Legacy** — `{ offset, mtimeMs }` (seen in older pew dumps shared in the community; not present here).

`pew-insights` accepts all three and normalises to the full shape internally.

### 2.12 `session-cursors.json`

Same `version`/`files` envelope as `cursors.json` but each entry is the **lightweight** variant — only `mtimeMs` and `size`. Used by the **session** ingestor.

### 2.13 `openclaw.session-sync.trigger-state.json`

```json
{ "lastTriggeredAt": 1776933578021 }
```

Epoch milliseconds. State for the openclaw → pew session-sync trigger; rate-limits how often the openclaw plugin nudges pew.

### 2.14 `openclaw-plugin/pew-session-sync`

Native helper / shim binary. Out of scope for `pew-insights`.

### 2.15 `bin/notify.cjs` (+ `.bak.<iso>` backups)

Node shim that other tools `require`/`exec` to politely notify pew of new data. Backups are auto-created when pew rewrites the shim (presumably on upgrade). `pew-insights doctor` may surface stale `.bak.*` files in a future release.

### 2.16 `runs/`

One JSON file per sync run, named `<iso-timestamp>-<6char-suffix>.json`. Schema is the same as `last-run.json` (§2.3) — `last-run.json` is just a copy of the newest `runs/` entry.

In this install: **36,966 files**. Pew never prunes this directory. `pew-insights doctor` flags counts > 10,000 as a "consider archiving" warning (and a `runs/` archive helper is on the roadmap).

## 3. Source / model catalogue (this install)

Counts come from the still-present (un-compacted) entries in `queue.jsonl` at the time of analysis.

### Sources

| Source           | Lines |
| ---------------- | ----: |
| `vscode-copilot` |   333 |
| `claude-code`    |   294 |
| `openclaw`       |   251 |
| `hermes`         |   121 |
| `opencode`       |    99 |
| `codex`          |    64 |

### Models (top, pre-normalisation)

| Raw model id                              | Lines |
| ----------------------------------------- | ----: |
| `gpt-5.4`                                 |   330 |
| `claude-opus-4.7`                         |   200 |
| `gpt-5`                                   |   170 |
| `claude-opus-4.6-1m`                      |   167 |
| `claude-opus-4-7`                         |    73 |
| `gpt-5.1`                                 |    53 |
| `gemini-3-pro-preview`                    |    37 |
| `claude-sonnet-4.5`                       |    37 |
| `claude-haiku-4-5-20251001`               |    26 |
| `github.copilot-chat/claude-sonnet-4`     |    18 |
| `github_copilot/claude-opus-4.6-1m`       |    15 |
| `claude-sonnet-4`                         |     8 |
| `claude-sonnet-4.6`                       |     6 |
| `github_copilot/claude-opus-4.7`          |     4 |
| `claude-opus-4.6`                         |     4 |
| `claude-haiku-4.5`                        |     4 |
| `opus`                                    |     3 |
| `claude-sonnet-4-6`                       |     3 |
| `gpt-5.2`                                 |     1 |
| `gpt-4.1`                                 |     1 |
| `github_copilot/Claude Haiku 4.5`         |     1 |
| `big-pickle`                              |     1 |
| `<synthetic>` (seen elsewhere)            |     – |

### Normalisation rules `pew-insights` applies

- Strip provider prefixes: `github_copilot/`, `github.copilot-chat/`.
- Collapse `-` ↔ `.` in version segments: `claude-opus-4-7` → `claude-opus-4.7`, `claude-sonnet-4-6` → `claude-sonnet-4.6`, `claude-haiku-4-5-20251001` → `claude-haiku-4.5`.
- Collapse case for human-typed labels: `Claude Haiku 4.5` → `claude-haiku-4.5`.
- Map placeholders `<synthetic>`, `opus`, `big-pickle` → bucket `unknown`.

## 4. Recommended read strategy

1. **Take an atomic snapshot before reading.** Pew may rotate offsets / write the queues mid-read. The cheap and correct approach: `cp -r` the whole `~/.config/pew/` to a tmpdir first, then read from there. `pew-insights` does **not** do this today (it relies on the fact that lines are append-only and offset-truncation-safe), but a future flag may.
2. **Don't take pew's lock.** `trailing.lock` is for pew itself. Read-only consumers stay out of it.
3. **Stream, don't slurp.** `queue.jsonl` and especially `session-queue.jsonl` can grow large (1.4 MB here, will be much larger on a never-compacted install).
4. **Dedupe sessions by `(session_key, max(snapshot_at))`.**
5. **For "what's pending sync" use `state.offset`, not file size.**
6. **For "is pew healthy" use** `last-success.json` age + `trailing.lock` PID liveness + `queue.state.json.dirtyKeys.length`.
7. **Cache the runs/ scan.** 36k files is real I/O. v0.5 will introduce a `~/.cache/pew-insights/` cache keyed on directory mtime.

## 5. Open questions

1. **`project_ref` hash function.** 16 lowercase hex chars; suspected `sha256(absolute_project_root).slice(0, 16)` but unconfirmed. Need a known input/output pair.
2. **Full enum of `coordination.skippedReason`.** Seen: `cooldown`. Suspected: `lock-held`, `no-work`, `auth-failure`.
3. **Full enum of run `status`.** Seen: `skipped`. Suspected: `succeeded`, `failed`, `partial`.
4. **Schema of `notify.signal` contents.** Is it ever read by pew, or purely an mtime touch?
5. **30-min vs 1-hour bucketing in `queue.jsonl`.** Which sources emit 30-min? Probably claude-code; need to confirm.
6. **Server-side dedupe key for queue lines.** Assumed `(source, model, hour_start, device_id)` — confirm.
7. **Does pew ever compact `queue.jsonl` on upgrade?** Empirically no in 2.20.3, but a future version might.
8. **`session-queue.jsonl` retention policy.** Are old snapshots ever pruned? Empirically no.
9. **`cycles[]` shape inside a real (non-skipped) `runs/` entry.** Need a captured non-skipped run.
10. **Plugin ABI for `openclaw-plugin/pew-session-sync`.** Out of scope but worth documenting.

PRs welcome.

## Note on `cache_input_tokens` semantics (observed 2026-04)

Empirically, summing `cached_input_tokens / input_tokens` per `(model,
source)` pair across `queue.jsonl` produces ratios well above 1.0 for
some producers (most notably `opencode`, where the ratio on
`claude-opus-4.7` runs above 15×). This is consistent with
`cached_input_tokens` being reported as the **count of tokens served
from cache** — which can exceed `input_tokens` (treated as a
"fresh-only" or "uncached" counter) when the same prompt prefix is
reused many times.

The `cache-hit-ratio` subcommand intentionally does **not** clamp the
ratio to `[0,1]`: ratios > 1 are a real signal (high cache leverage),
not data corruption, and clamping would hide producer-level
differences. The progress bar in the pretty renderer *does* clamp to
`[0,1]` for visual sanity, but the numeric `hit-ratio` column is
unmodified.
