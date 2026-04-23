# Roadmap

## v0.1 — Foundations (shipped 2026-04-23)

- `digest`, `status`, `sources`, `doctor`
- `--pew-home` / `$PEW_HOME` override
- Model-name normalisation
- Internals doc

## v0.2 — Reports & project mapping

- `pew-insights report --html out.html` — single-file HTML digest with simple charts (no runtime deps; inline SVG).
- Project-ref reverse mapping: best-effort attempt to resolve the 16-hex `project_ref` values back to local project paths by hashing common roots (`~/Projects`, `~/Desktop`, `~/code`, etc.).
- `digest --by project` once mapping exists.

## v0.3 — Compaction

- `pew-insights compact --confirm` — atomically rewrites `queue.jsonl` to drop entries older than the last successful sync (using `queue.state.json.offset` and `last-success.json` as the safety frontier). Dry-run by default. Backs up to `queue.jsonl.bak.<ts>` first.

## v0.4 — Per-project breakdown

- Use `cursors.json` file paths to attribute session activity to project directories.
- `digest --by project` (real, not best-effort).
- `pew-insights projects` — list all projects pew has ever observed, with last-seen timestamps.

## v0.5 — Trends

- Sparkline graphs in terminal output (`digest --trend`).
- Monthly rollup table.
- Optional persistent cache at `~/.cache/pew-insights/` so we don't re-scan 36k+ runs/ files every invocation.

## Later / maybe

- Weekly email-ready digest (Markdown output suitable for `mail`/`mutt`).
- `pew-insights diff <since> <until>` — compare two windows.
- Webhook poster (Slack-formatted digest).
- Anomaly detection (token spikes, source going silent).
