# Changelog

All notable changes to this project will be documented in this file.

## 0.2.0 — 2026-04-23

Adds an HTML report, project-ref reverse mapping, and the first two safe
mutation commands (`compact`, `gc-runs`). All mutating commands are
dry-run by default and require `--confirm` to actually touch the
filesystem.

### Added

- `pew-insights report --since 7d --out report.html` — self-contained HTML
  report with inline CSS (light + dark via `prefers-color-scheme`) and
  hand-rolled inline SVG charts. Sections: totals, by-day sparkline,
  by-source bar + pie, by-model breakdown, top source × model pairs, top
  project_refs, sync/lag report. No external CDN dependencies.
- `pew-insights projects` — reverse-maps `project_ref` hashes from
  `session-queue.jsonl` back to project paths. Scans `~/Projects`,
  `~/Desktop`, `~/Code`, `~/src`, `~/work`, then probes
  sha256/sha1/md5 over (absolute path, absolute path with trailing
  slash, claude-code `-`-encoded path) until a hash matches. Caches the
  resolved table at `~/.cache/pew-insights/project-refs.json`. Privacy:
  full paths require `--show-paths`; both basenames and paths are
  filtered through a denylist before display.
- `pew-insights compact [--confirm]` — archives the already-flushed
  prefix of `queue.jsonl` / `session-queue.jsonl` to
  `~/.cache/pew-insights/archive/queue.YYYY-MM-DD.jsonl.gz`, truncates
  the live file to start at the new offset, and resets
  `queue.state.json` `offset` to `0`. Dry-run by default; refuses to run
  while `trailing.lock` holds a live pid.
- `pew-insights digest --by-project` — adds a top-projects breakdown
  using proportional attribution: queue tokens are split among
  `project_ref`s by message-share within each `(source, day)` bucket;
  unmapped tokens land in an explicit `unattributedTokens` counter.
  Project labels come from the cached lookup and are denylist-filtered.
- `pew-insights gc-runs --keep N [--confirm]` — moves older `runs/`
  entries into `~/.cache/pew-insights/archive/runs/` while always
  keeping (a) the N most recent runs and (b) the last `succeeded` run
  per calendar day. Dry-run by default.
- New module `src/svg.ts` — dependency-free `sparkline`, `barChart`,
  `pieChart` with deterministic output suitable for snapshot testing.

### Changed

- `pew-insights doctor` hint copy refreshed: `RUNS_DIR_LARGE` now
  recommends `pew-insights gc-runs --keep 1000`; `QUEUE_NEVER_COMPACTED`
  now recommends `pew-insights compact --confirm`. The
  `STALE_TRAILING_LOCK` check (already present in 0.1) is unchanged.

### Tests

- Test count grew from 5 → 41. New suites: `svg`, `projects`, `compact`,
  `byproject`, `gcruns`. All filesystem-mutating tests use isolated
  temp pew-homes; `~/.config/pew/` is never written during the test
  run.

## 0.1.0 — 2026-04-23 — Initial release

- `pew-insights digest` — token totals by day, source, model, hour-of-day, with `--since` window and `--json` output.
- `pew-insights status` — sync queue + session queue health, last-success timestamp, trailing lock holder, dirty cursor keys, runs/ count.
- `pew-insights sources` — source × model pivot table.
- `pew-insights doctor` — health checks: missing pew home, oversized runs/ dir, never-compacted `queue.jsonl`, stale trailing lock, dirty cursor keys.
- Read-only consumer of `~/.config/pew/`; supports `$PEW_HOME` and `--pew-home` overrides.
- Model-name normalisation table to merge variants like `claude-opus-4-7` / `github_copilot/claude-opus-4.7` → `claude-opus-4.7`.
- Reverse-engineered pew internals reference at `docs/PEW_INTERNALS.md`.
