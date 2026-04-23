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
| Top-N projects ranking with paths          |   ❌    |      ✅      |
| Day-over-day / week-over-week trends       |   ❌    |      ✅      |
| $-cost estimation with cache savings       |   ❌    |      ✅      |
| Safe queue/runs compaction                 |   ❌    |      ✅      |

## Features

**v0.4 (this release):**

- `forecast` — OLS over last N daily totals (zero-filled); projects the rest of the current UTC week with 95 % prediction intervals; reports tomorrow, full-week projection, slope, R², low-confidence flag
- `budget` — daily / monthly USD targets, MTD spend, burn rate, ETA-to-breach, status (`under` / `on-track` / `over` / `breached`); exits with code 2 on `breached` so it composes into cron alerting
- `compare` — A/B over two named windows by source or model; presets `wow` / `dod` / `rolling-week` plus arbitrary ISO ranges; coarse Welch-t significance hint per row
- `export` — dump filtered queue or sessions as CSV (RFC-4180-style) or NDJSON (Parquet-friendly); `usd` column populated from rates table
- `anomalies` *(0.4.1)* — flags days whose token total deviates ≥ N σ from a trailing baseline (default 7-day baseline, threshold |z| ≥ 2.0); exits with code 2 when the most recent day spiked HIGH so it composes into cron alerting alongside `budget`
- HTML report now includes Forecast and Budget sections alongside the existing Trend / Cost panels

**v0.3:**

- `digest` — token totals by day, source, model, hour-of-day for any window
  - `--by-project` adds a top-10 projects breakdown via proportional attribution
- `cost` — estimate $ cost with per-model rates; cache savings vs no-cache baseline
- `trend` — DoD / WoW deltas + ASCII sparklines + per-model breakdown
- `top-projects` — top N projects by tokens with reverse-mapped paths
- `status` — pending queue lines, session-queue offset, last-success timestamp, trailing-lock holder, dirty cursor keys, runs/ size
- `sources` — pivot table of source × model token totals
- `doctor` — health checks; suggests `compact` and `gc-runs` when applicable
- `report` — self-contained HTML report with inline SVG charts (no CDNs)
- `projects` — reverse-map `project_ref` hashes to project paths (cached, denylist-filtered)
- `compact` — archive flushed prefix of `queue.jsonl` / `session-queue.jsonl` and shrink the live file (dry-run by default)
- `gc-runs` — move old `runs/` entries to a cache dir while keeping recent + daily-success entries (dry-run by default)

**Roadmap (see [docs/ROADMAP.md](docs/ROADMAP.md)):**

- v0.5 — webhook poster (Slack-formatted digest), HTML anomalies panel

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

### Cost estimation

```sh
# Estimate $ cost for the last 7 days using built-in default rates.
pew-insights cost --since 7d

# Override rates per-model. File format:
# { "claude-opus-4.7": { "input": 12, "cachedInput": 1.2, "output": 60, "reasoning": 60 } }
pew-insights cost --rates ~/.config/pew-insights/rates.json
```

The default rate table covers `claude-opus-4.7`, `claude-sonnet-4.6`,
`gpt-5.4`, `gpt-5.2`, and `gpt-5-nano` — treat the numbers as a starting
point, not gospel; provider pricing changes frequently. Cached input
tokens are billed at the cached rate, and the report shows both the
no-cache baseline and the savings the cache earned. Models that aren't
in your rate table contribute zero cost and are listed separately so
you can extend the table.

### Trends

```sh
# Day-over-day, week-over-week deltas + 14-day sparkline.
pew-insights trend

# Custom display window (deltas always use fixed 24h / 7d offsets).
pew-insights trend --window 30
```

The sparkline uses Unicode block characters (`▁▂▃▄▅▆▇█`) so it pastes
cleanly into emails and chat. `pct` is reported as `n/a` when the
previous window is zero — never `+Inf%` or `NaN%`.

### Top projects

```sh
# Top 10 projects by attributed tokens (last 7d).
pew-insights top-projects

# Top 25 projects with full paths (denylist still applies).
pew-insights top-projects -n 25 --show-paths --since 30d
```

Reuses the project_ref reverse-mapping cache built by `pew-insights
projects`. Run `pew-insights projects --refresh` first if a lot of
your refs show up as `(unresolved)`.

### Forecast

```sh
# OLS over the last 14 days; project the rest of this UTC week.
pew-insights forecast

# Longer lookback for a smoother fit.
pew-insights forecast --lookback 30 --json
```

Reports tomorrow's predicted total with a 95 % prediction interval, the
full-week projection (observed + predicted), slope (tokens/day), and
R². Flagged as `low-confidence` when the sample is too small or all-zero.
The PI is a directional band, not a calibrated guarantee.

### Budget

```sh
# Inline target.
pew-insights budget --daily 5

# Both daily and explicit monthly cap.
pew-insights budget --daily 5 --monthly 120 --window 14

# Read from ~/.config/pew-insights/budget.json
echo '{"dailyUsd": 5}' > ~/.config/pew-insights/budget.json
pew-insights budget
```

Status is one of `under` / `on-track` / `over` / `breached`. Exit code
is 2 on `breached`, suitable for cron alerting (`pew-insights budget
|| send-alert`). ETA-to-breach is reported in UTC `yyyy-mm-dd` form
when the burn rate would breach the cap inside the current month.

### Anomalies

```sh
# Default: 30-day lookback, 7-day baseline, |z| ≥ 2.0.
pew-insights anomalies

# Tighter threshold + longer baseline.
pew-insights anomalies --threshold 1.5 --baseline 14 --lookback 60

# JSON for piping into jq / dashboards.
pew-insights anomalies --json | jq '.flagged'
```

For each day in the lookback window we compute a z-score against the
trailing `--baseline` days (sample stddev with Bessel's correction).
Days are tagged `high` (z ≥ +threshold), `low` (z ≤ −threshold),
`normal`, or `flat` (baseline σ = 0 — no scale). Exit code is 2 when
the most recent day spiked HIGH so the command composes into cron
alerting alongside `budget`:

```sh
pew-insights anomalies --json > /tmp/anom.json || curl -X POST $WEBHOOK -d @/tmp/anom.json
```

The trailing baseline tracks regime shifts: if usage permanently
doubles, the baseline catches up after `--baseline` days and stops
flagging the new normal.

### Compare

```sh
# This week vs last week, per source.
pew-insights compare --preset wow

# Today vs yesterday, per model.
pew-insights compare --preset dod --by model

# Arbitrary windows in ISO.
pew-insights compare \
  --a-from 2026-04-15T00:00:00Z --a-until 2026-04-22T00:00:00Z \
  --b-from 2026-04-08T00:00:00Z --b-until 2026-04-15T00:00:00Z \
  --by model --top 10
```

Each row reports tokens in window A, tokens in window B, delta,
percent change, and a coarse Welch-t hint over per-day token totals:
`significant` (|t| ≥ 1.96), `weak` (|t| ≥ 1.28), `n/s`, or
`insufficient`. Treat the hint as a directional cue — it's a t-stat
without df correction, not a publication-grade test.

### Export

```sh
# Last 7 days of queue events, CSV.
pew-insights export --since 7d > events.csv

# NDJSON for DuckDB / pandas / Parquet ingest.
pew-insights export --format ndjson --since 30d > events.ndjson

# Filter by source + model.
pew-insights export --source cli --model gpt --since 7d --out cli-gpt.csv

# Sessions instead of queue rows.
pew-insights export --entity sessions --format ndjson --since 30d
```

CSV uses RFC-4180-style escaping with LF line endings. NDJSON emits
one JSON object per line — the format every Parquet ingest tool
understands. Queue exports include a per-row `usd` column when a
rates table is loaded so BI tools can sum dollars without re-applying
rates.

### HTML report

```sh
# Render the last 7 days into a single self-contained HTML file
pew-insights report --since 7d --out report.html
open report.html
```

The output uses inline CSS (light + dark via `prefers-color-scheme`) and
hand-rolled inline SVG charts — no external resources are loaded. The
report includes everything from `digest`, plus the `cost` and `trend`
sections.

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
