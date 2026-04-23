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
| HTML report + per-project breakdown        |   ❌    | 🛣️ roadmap   |
| Weekly digest, email-ready                 |   ❌    | 🛣️ roadmap   |

## Features

**v0.1 (this release):**

- `digest` — token totals by day, source, model, hour-of-day for any window
- `status` — pending queue lines, session-queue offset, last-success timestamp, trailing-lock holder, dirty cursor keys, runs/ size
- `sources` — pivot table of source × model token totals
- `doctor` — checks for huge `runs/` dir, never-compacted queue, stale trailing lock, missing pew home, etc.

**Roadmap (see [docs/ROADMAP.md](docs/ROADMAP.md)):**

- v0.2 — HTML report; project-ref reverse-mapping
- v0.3 — `pew-insights compact --confirm` to shrink `queue.jsonl`
- v0.4 — per-project breakdown via `cursors.json` paths
- v0.5 — sparkline trends + monthly rollup

## Install

```sh
npm i -g pew-insights
# or one-shot
npx pew-insights status
```

## Usage

```sh
# Last 7 days (default), human output
pew-insights digest

# Last 24 hours, JSON for piping into jq / your own tools
pew-insights digest --since 24h --json

# Sync queue + lock health
pew-insights status

# Source × model pivot
pew-insights sources --since 7d

# Health check
pew-insights doctor

# Point at a non-default pew home
pew-insights status --pew-home /tmp/pew-snapshot
```

`--since` accepts `24h`, `7d`, `30d`, or `all`.

## How it works

`pew-insights` reads (and only reads) the files under `~/.config/pew/` (or wherever `$PEW_HOME` points). It does **not** call the pew API, modify any pew state, take locks, or write back into the pew directory.

For the full schema of every file under `~/.config/pew/`, see [docs/PEW_INTERNALS.md](docs/PEW_INTERNALS.md).

## Disclaimer

This project is **not affiliated with `pew` or its maintainers**. It is a read-only third-party consumer of pew's on-disk state. Schemas may change between pew versions; if `pew-insights` breaks against a newer pew, please open an issue with the version of pew you are running.

## License

MIT © 2026 Bojun-Vvibe
