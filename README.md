# pew-insights

> Local-first reports and analytics for your [`pew`](https://www.npmjs.com/package/pew) CLI usage.

`pew` tracks your AI tool usage (Claude Code, Copilot, Codex, OpenCode, …) and ships everything to a hosted dashboard at <https://pew.md/dashboard>. That's great — but if you want to **inspect, export, or compute on the local data without a round-trip to the cloud**, the official CLI gives you very little.

`pew-insights` is a third-party, read-only consumer of pew's local state directory (`~/.config/pew/`). It turns that pile of JSONL into useful, scriptable reports right in your terminal.

## Why

What pew gives you out of the box, vs. what `pew-insights` adds:

| Need                                       | pew CLI | pew-insights |
| ------------------------------------------ | :-----: | :----------: |
| Hosted web dashboard                       |   ✅    |      —       |
| Local terminal digest (last N days)        |   ❌    |      ✅      |
| Per-source / per-model breakdown offline   |   ❌    |      ✅      |
| Sync queue health & lag detection          |   ❌    |      ✅      |
| Detect stale `trailing.lock`               |   ❌    |      ✅      |
| Find never-compacted `queue.jsonl`         |   ❌    |      ✅      |
| Self-contained HTML report                 |   ❌    |      ✅      |
| Reverse-map `project_ref` → project path   |   ❌    |      ✅      |
| Per-project token breakdown                |   ❌    |      ✅      |
| Safe queue/runs compaction                 |   ❌    |      ✅      |

## Features

**v0.2 (this release):**

- `digest` — token totals by day, source, model, hour-of-day for any window
  - `--by-project` adds a top-10 projects breakdown via proportional attribution
- `status` — pending queue lines, session-queue offset, last-success timestamp, trailing-lock holder, dirty cursor keys, runs/ size
- `sources` — pivot table of source × model token totals
- `doctor` — health checks; suggests `compact` and `gc-runs` when applicable
- `report` — self-contained HTML report with inline SVG charts (no CDNs)
- `projects` — reverse-map `project_ref` hashes to project paths (cached, denylist-filtered)
- `compact` — archive flushed prefix of `queue.jsonl` / `session-queue.jsonl` and shrink the live file (dry-run by default)
- `gc-runs` — move old `runs/` entries to a cache dir while keeping recent + daily-success entries (dry-run by default)

**Roadmap (see [docs/ROADMAP.md](docs/ROADMAP.md)):**

- v0.3 — weekly email-ready digest, monthly rollup
- v0.4 — sparkline trends embedded in `digest` terminal output
- v0.5 — exporters (CSV, Parquet) for the queue / session data

## Install

```sh
npm i -g pew-insights
# or one-shot
npx pew-insights status
```

## Usage

### Read-only commands

```sh
# Last 7 days (default), human output
pew-insights digest

# Last 24 hours, JSON for piping into jq / your own tools
pew-insights digest --since 24h --json

# Top 10 projects (uses cached project-ref lookup; run `projects` first to build it)
pew-insights digest --by-project --since 30d

# Sync queue + lock health
pew-insights status

# Source × model pivot
pew-insights sources --since 7d

# Health check
pew-insights doctor

# Point at a non-default pew home
pew-insights status --pew-home /tmp/pew-snapshot
```

### HTML report

```sh
# Render the last 7 days into a single self-contained HTML file
pew-insights report --since 7d --out report.html
open report.html
```

The output uses inline CSS (light + dark via `prefers-color-scheme`) and
hand-rolled inline SVG charts — no external resources are loaded.

### Project-ref reverse mapping

```sh
# First run scans ~/Projects, ~/Desktop, ~/Code, ~/src, ~/work and caches
# the resolved table at ~/.cache/pew-insights/project-refs.json.
pew-insights projects

# Show full paths (still denylist-filtered for privacy):
pew-insights projects --show-paths

# Force a fresh scan (cache invalidation):
pew-insights projects --refresh

# Use custom scan roots:
pew-insights projects --scan-root /opt/work --scan-root ~/Projects
```

The hash function is probed across sha256 / sha1 / md5 over (absolute
path, absolute path with trailing slash, claude-code `-`-encoded path).
Resolved entries print `project_ref → basename`; unresolved refs are
silently dropped from output. The denylist (see source) blanks both
basenames and full paths that match Microsoft-internal substrings before
display, even with `--show-paths`.

### Safe mutations

Every mutating command is **dry-run by default** and requires
`--confirm` to actually touch the filesystem.

```sh
# Preview what would be archived from queue.jsonl / session-queue.jsonl:
pew-insights compact

# Actually compact (refuses if pew is currently syncing):
pew-insights compact --confirm
# → archives the flushed prefix into ~/.cache/pew-insights/archive/queue.YYYY-MM-DD.jsonl.gz
# → truncates queue.jsonl to start at the new offset
# → resets queue.state.json offset to 0 (preserving dirtyKeys)

# Preview which runs/ entries would be archived:
pew-insights gc-runs --keep 1000

# Actually move them to ~/.cache/pew-insights/archive/runs/:
pew-insights gc-runs --keep 1000 --confirm
# Always keeps: the N most recent + the last `succeeded` run per calendar day.
```

`--since` accepts `24h`, `7d`, `30d`, or `all`.

## How it works

By default, `pew-insights` only reads files under `~/.config/pew/` (or
wherever `$PEW_HOME` points). It does **not** call the pew API or take
pew's locks.

The two mutating commands shipped in 0.2 — `compact` and `gc-runs` — are
both **dry-run by default**, refuse to run when pew is actively syncing
(via `trailing.lock`), and only ever move data to
`~/.cache/pew-insights/archive/` (never delete). See `--help` on each
command for details.

For the full schema of every file under `~/.config/pew/`, see [docs/PEW_INTERNALS.md](docs/PEW_INTERNALS.md).

## Disclaimer

This project is **not affiliated with `pew` or its maintainers**. It is a read-only third-party consumer of pew's on-disk state. Schemas may change between pew versions; if `pew-insights` breaks against a newer pew, please open an issue with the version of pew you are running.

## License

MIT © 2026 Bojun-Vvibe
