# Changelog

All notable changes to this project will be documented in this file.

# Changelog

All notable changes to this project will be documented in this file.

## 0.4.5 — 2026-04-24

Hour-of-day × day-of-week token-activity heatmap. Where `trend`
and `anomalies` collapse usage onto a single time axis, the new
`pew-insights heatmap` subcommand keeps the *cycle* dimension
separate so a steady night-owl regime doesn't false-positive as
a "late-night spike" — it reads as the shape of the work itself.
Closes a long-standing gap: `forecast` already uses
`dayOfWeek` for seasonal residuals internally, but never exposed
the day-of-week shape directly.

### Added

- `pew-insights heatmap` subcommand
  - Aggregates `QueueLine[]` into a 7×24 matrix (ISO dow rows
    Mon..Sun × hour cols 00..23). Bucketing is UTC by default
    (matches `hour_start` storage); pass `--tz local` to bucket
    in the host's calendar — useful when the operator wants
    "my actual workday shape" instead of UTC.
  - Renders as a colored Unicode-block ramp (▁▂▄▅▇█) with row
    totals on the right and per-column order-of-magnitude
    indicators along the bottom, sized to fit a standard
    80-column terminal.
  - `--metric total | input | cached | output` switches which
    token field feeds the matrix. `output` sums
    `output_tokens + reasoning_output_tokens` so reasoning models
    aren't undercounted.
  - Emits two concentration metrics:
    - **top-4-hr share** — fraction of `grandTotal` in the
      best 4 *consecutive* hours, with wrap-around (so a
      22:00–01:59 peak across midnight collapses to a single
      window). Uniform baseline = 4/24 = 16.7%.
    - **top-2-day share** — fraction of `grandTotal` in the
      top 2 days of the week (any 2, not consecutive). Uniform
      baseline = 2/7 = 28.6%.
  - JSON output includes the full matrix, marginal totals, peak
    cell, peak dow, peak hour, and both concentration metrics.
- `src/heatmap.ts`
  - `buildHeatmap(queue, opts)` — pure builder, deterministic
    on a given `asOf`. Throws on `lookbackDays < 1`. Returns
    null peaks/concentrations on empty matrices instead of `0`
    so consumers can distinguish "no data" from "uniform-zero".
  - `bucketOf` routes through `Date.getUTC*` for UTC and
    `Intl.DateTimeFormat` for local — never hand-rolls offsets.
  - `maxWindowSumCircular` — O(n) sliding-window sum over a
    circular array, used by `diurnalConcentration`.
- `renderHeatmap` in `src/format.ts` — six-bin glyph ramp with
  empty cells rendered as a dim center-dot to keep
  zero-vs-low visually distinct.

### Tests

- `test/heatmap.test.ts` — 17 new cases covering: 7×24 shape on
  empty queue, rowTotals/colTotals/grandTotal consistency, peak
  cell and peak marginal detection (with deterministic
  tie-breaking), all four metrics, lookback window edges
  (inclusive both ends), `lookbackDays < 1` rejection, uniform
  matrix concentration ≈ 4/24 and 2/7, single-cell concentration
  = 1.0, midnight-wrap circular peak window, ISO-dow mapping
  (Sun→7, Mon→1), weekend-vs-weekday isolation, repeated
  (dow, hour) aggregation, and tz=local invariants.

Total test count: 278 → 295.

## 0.4.4 — 2026-04-24

One-screen operator view. The new `pew-insights dashboard`
subcommand composes `status` + `anomalies` + `ratios` into a
single report sized for a normal terminal, with two derived drift
indicators that don't exist standalone: token-volume drift (% vs
trailing baseline mean) and cache-hit drift (signed percentage
points vs baseline EWMA recovered from logit space). Health →
volume → efficiency, in that order — coarse to fine, the way an
SRE would triage.

### Added

- `pew-insights dashboard` subcommand
  - Reads pew state once and runs `buildStatus`, `buildAnomalies`,
    and `buildRatiosReport` in parallel. Composition lives in a
    new pure builder (`buildDashboard`) so the renderer is a
    DashboardReport-in / string-out function and tests can inject
    fixtures directly without any filesystem.
  - Two derived indicators on the most recent day:
    - `tokenDriftPct` — `(tokens - baselineMean) / baselineMean × 100`.
      null on `warmup` / `flat` / zero baseline.
    - `ratioDriftPctPoints` — `ewma - inverseLogit(baselineLogitMean)` × 100.
      Reported in *percentage points* (not percent of percent), the
      operator-friendly unit. null on `warmup` / `flat` / `undefined`.
  - Exit-code contract mirrors the per-subcommand contracts:
    exit 2 if EITHER the most recent token day is `high` OR the
    most recent ratio day is `high`/`low`. Token `low` does NOT
    trigger — a slow day is not a page (matches `anomalies`).
  - `--lookback` / `--baseline` / `--threshold` / `--alpha` /
    `--json` flags pass through to the underlying builders with
    the same defaults (`30 / 7 / 2.0 / 0.3`).

### Tests

- `test/dashboard.test.ts` — 29 new cases, covering the drift
  math (including the live 04-24 cache-hit jump 48% → 77% which
  reproduces as ~+29pp), recentRatio walk-back to the most recent
  defined-baseline day, the OR-merge alerting truth table
  (token-high alone / ratio-high alone / ratio-low alone / both /
  neither / token-low alone → false / empty → false), and the
  inverseLogit numeric guard at extreme |logit|.

Total test count: 249 → 278.

## 0.4.3 — 2026-04-24

Wires the 0.4.2 logit-space EWMA helpers into a public surface:
the new `pew-insights ratios` subcommand scores cache-hit-ratio
drift over a window. Gives the previously-internal `ratios.ts`
module a user-visible reason to exist and lays the
efficiency-monitoring counterpart to `anomalies` (which watches
volume drift).

### Added

- `pew-insights ratios` subcommand
  - Composes `buildDailySeries` (trend.ts) for the day grid +
    zero-fill semantics, `safeLogit`/`expit`/`ewmaLogit` (ratios.ts)
    for the bounded-ratio math, and `mean`/`stdDev` (anomalies.ts)
    for the trailing-baseline z-score.
  - Flags each day as `high` (cache-hit climbed unusually), `low`
    (cache-hit dropped — usually bad operational news), `normal`,
    `flat` (logit-space σ ≈ 0), `warmup`, or `undefined` (no input
    tokens that day).
  - Exits with code 2 when the most recent scored day flagged in
    either direction. Mirrors `budget breached` and
    `anomalies recentHigh` so it composes into existing cron
    alerting.
  - Options: `--lookback` (default 30d), `--alpha` (EWMA
    newer-sample weight, default 0.3), `--baseline` (trailing
    window over EWMA values, default 7d), `--threshold` (|z| in
    logit space, default 2.0), `--json`.
- `src/ratiosreport.ts`
  - `aggregateCacheTokensByDay(queue)` — sums input + cached per
    UTC day, kept separate so the ratio is computed at the day
    level (not per-event).
  - `buildRatiosReport(queue, opts)` — pure builder, deterministic
    on a given `asOf`.
- `renderRatios` in `src/format.ts` — table view with raw daily
  ratio, smoothed EWMA, baseline summary in `[0, 1]` space, and
  z-score in logit space; coloring inverts the `anomalies` palette
  (high = green = good, low = red = bad).

### Design notes

- **Ratio definition.** We use `cached / (input + cached)` rather
  than `cached / input` because pew sources disagree on whether
  `input_tokens` includes the cached portion. Several sources
  report uncached-only, which means `cached / input` can exceed
  1 (observed: 3.25 against the live queue.jsonl) and immediately
  poisons the `[0, 1]` domain that `ratios.ts` is built on.
  `cached / (input + cached)` is unambiguously "fraction of total
  input tokens that came from the cache", always in `[0, 1]`.
- **Score the EWMA, not the raw ratios.** The trailing baseline is
  a window over recent EWMA values. A single noisy day shouldn't
  fire — only sustained drift should — and EWMA does that
  smoothing for free.
- **Only score days with new evidence.** Days with no
  `input_tokens` get the EWMA carried forward for human display
  (so the smoothed line doesn't disappear on days the user took
  off) but stay in `undefined` status — re-scoring a stale
  carried-forward value would mark the same day-of-no-data as
  drifted forever.
- **Walk-back semantics for `recentHigh`/`recentLow`.** Trailing
  `undefined` days don't suppress the exit-code signal: the
  builder walks backwards past undefined/warmup days to find the
  most recent scored day, so a Friday drop still fires Monday's
  cron even if Saturday/Sunday had no events.
- **Floating-point flat detection.** `stdDev` of n identical floats
  returns ~6e-17, not exactly 0. We treat logit-space σ < 1e-9 as
  `flat` to avoid spurious z-scores in the 1e+15 range.

### Tests

225 → 249 (+24) covering: per-day aggregation; option validation;
empty-queue / single-day / zero-input edge cases; EWMA convergence
on a stable series; carry-forward across undefined gaps; warmup
when not enough trailing history; flat detection past the
floating-point noise floor; flagged days during sharp transitions
in both directions; recovery clears `recentLow`; trailing
undefined days don't suppress an earlier flag; boundary clamp
keeps EWMA finite on raw 0.0 / 1.0; determinism on identical
inputs.

### Verified against the live queue

`pew-insights ratios --lookback 14 --baseline 5` against the local
queue.jsonl detected the cache-hit jump from ~48% (2026-04-13..20)
to ~77% on 2026-04-21 with z = +43.97, then naturally decayed the
z-score back toward 2 over the following two days as the new
regime was absorbed into the EWMA. Exit code 2 surfaced.

## 0.4.2 — 2026-04-24

Adds `ratios` — a small, internal helper module for bounded ratios
(metrics in [0, 1] like cache-hit ratio or reasoning-token share).
Lays the groundwork for 0.5's webhook scorer without wiring anything
new to the CLI yet.

### Added

- `src/ratios.ts` exports:
  - `clampProbability(p, eps?)` — symmetric epsilon clamp; maps 0 →
    eps and 1 → 1-eps so the round trip stays antisymmetric around
    0.5.
  - `logit(p)` — `ln(p / (1 - p))`. Refuses raw 0 / 1 by design so
    callers can't silently feed ±Infinity into a downstream EWMA.
  - `expit(z)` — inverse of logit; rewritten branch keeps it
    numerically stable for very negative z (where the naive form
    overflows in `Math.exp(-z)`).
  - `safeLogit(p, eps?)` — clamp then logit. The opt-in entry point
    for ratios that legitimately hit the boundaries.
  - `ewmaLogit(series, alpha, eps?)` — EWMA computed in logit space
    and mapped back into (0, 1). Stays inside the interval even on
    all-0 or all-1 input, which linear-space EWMA does not.
  - `ewmaLogitSeries(...)` — same as above but returns the running
    smoothed value at every step.

### Tests

187 → 225 (+38) covering clamp symmetry, logit antisymmetry, expit
numerical stability for large |z|, round-trip identities, safeLogit
boundary handling, EWMA determinism, alpha behavior, step-change
tracking, and boundary safety.

### Design notes

- The whole module exists because `anomalies` (0.4.1) scores raw
  token totals (unbounded counts where ±kσ is fine) but the next
  metrics we want to score live in a closed interval and break that
  assumption. Logit-space scoring is the standard fix.
- No `linearEwma` helper. Adding one would invite the boundary bug
  this module exists to avoid.
- No CLI command this release. 0.5's webhook scorer will compose
  `ewmaLogit` with the existing `mean` / `stdDev` from
  `anomalies.ts`.

## 0.4.1 — 2026-04-24

Adds `anomalies` — a small but standalone subcommand for flagging
days whose token usage deviates from a trailing baseline. Designed to
sit next to `budget` in a cron alerting pipeline.

### Added

- `pew-insights anomalies [--lookback N] [--baseline N] [--threshold Z]
  [--json]` — for each day in the lookback window (default 30), computes
  a z-score against the trailing `--baseline` days (default 7, sample
  stddev with Bessel's correction). Flags days with `|z| ≥ --threshold`
  (default 2.0) as `high` / `low`. Days where the baseline σ is 0 are
  reported as `flat` (no division-by-zero, no false alarms on perfectly
  flat history). The first `--baseline` days exist only to seed the
  baseline and are not visible in the output. Exits with code 2 when
  the most recent scored day is `high`, mirroring the `budget`
  exit-code contract so both commands compose into the same cron
  alert path.

### Tests

Test count grew from 169 → 187 (+18 across stats helpers, option
validation, detection accuracy, threshold-tightening behavior, and
determinism).

### Design notes

- Trailing (not global) baseline so regime shifts don't generate
  perpetual alerts: a permanent doubling of usage stops being flagged
  after `--baseline` days.
- Pure builder (`buildAnomalies`) takes `asOf` explicitly — same
  determinism contract as `forecast` and `budget`. No `Date.now()`
  inside scoring code.
- `anomalies` is intentionally CLI-only this release. The HTML report
  panel lands in 0.5 alongside the webhook poster.

## 0.4.0 — 2026-04-23

Adds forward-looking analysis (forecast, budget), A/B comparison
(compare), and a raw-events dump for downstream BI (export). The HTML
report grows two new sections — Forecast and Budget — that sit next
to the existing trend/cost sections.

### Added

- `pew-insights forecast [--lookback N] [--json]` — fits an OLS line
  through the last N daily token totals (zero-filled, default 14)
  and projects the rest of the current UTC ISO week with a 95 %
  prediction interval. Reports tomorrow's predicted total, the full
  week projection (observed + predicted), slope, and R². Flags the
  fit as low-confidence when the sample is too small or has zero
  variance.

- `pew-insights budget [--daily USD] [--monthly USD] [--config PATH]
  [--window N] [--rates PATH] [--json]` — tracks daily and monthly
  spend against a USD target, computes burn rate over the last N
  days, projects an ETA-to-breach day if burn outruns the cap, and
  classifies status as one of `under` / `on-track` / `over` /
  `breached`. Exits with code 2 on `breached` so it composes into
  cron alerting. Config can come from CLI flags or
  `~/.config/pew-insights/budget.json`.

- `pew-insights compare [--preset NAME | --a-from/--a-until/--b-from/
  --b-until ISO] [--by source|model] [--top N] [--min-tokens N]
  [--json]` — compares two named time windows side-by-side per source
  or per model. Three presets ship: `this-week-vs-last-week` (alias
  `wow`), `today-vs-yesterday` (alias `dod`), and `last-7d-vs-prior-7d`
  (alias `rolling-week`). Reports per-key delta, percent change, and
  a coarse Welch t-statistic over per-day token totals classified as
  `significant` / `weak` / `n/s` / `insufficient`. The hint is a
  directional cue, not a publication-grade test.

- `pew-insights export [--entity queue|sessions] [--format csv|ndjson]
  [--since SPEC] [--until ISO] [--source SUB] [--model SUB]
  [--out PATH] [--rates PATH]` — dumps filtered raw events. CSV uses
  RFC-4180-style escaping (LF line endings); NDJSON emits one JSON
  object per line, the format every Parquet ingest tool understands
  (`duckdb read_json_auto`, `pandas.read_json(lines=True)`, etc.).
  Queue exports include a per-row `usd` column when a rates table is
  loaded so BI tools can sum dollars without re-applying rates.

- HTML report (`pew-insights report`) now includes:
  - **Forecast** section with tomorrow's prediction, week projection
    with PI bands, slope/R² card, low-confidence warning when
    applicable, and a per-day prediction table.
  - **Budget** section with status badge, today/MTD spend, daily
    target, monthly cap, burn rate, ETA-to-breach, and a sparkline of
    daily spend. Rendered only when a budget config exists on disk.

### Tests

Test count grew from 75 → 169 (+94 across forecast, budget, compare,
export, and HTML extension suites).

## 0.3.0 — 2026-04-23

Adds dollar-cost estimation, trend analysis with sparklines, and a
top-projects ranking. The HTML report grows two new sections (cost,
trend) that drop in next to the existing digest sections.

### Added

- `pew-insights cost --since <window>` — estimates USD cost from queue
  tokens against a per-model rate table. Default rates ship for
  `claude-opus-4.7`, `claude-sonnet-4.6`, `gpt-5.4`, `gpt-5.2`, and
  `gpt-5-nano`. Cached input tokens are priced at the discounted
  cached rate, and the report surfaces a no-cache baseline + explicit
  cache savings. Override per-model via
  `~/.config/pew-insights/rates.json` or `--rates <path>`. Unknown
  models contribute zero cost and are listed separately so the user
  can extend the table.
- `pew-insights trend --since <window>` — day-over-day (24h vs prior
  24h) and week-over-week (7d vs prior 7d) deltas with absolute and
  pct-change figures, plus a unicode block sparkline of the last N
  (default 14) days. Per-model breakdown shows current vs previous
  half-window with its own per-model spark. Deltas use fixed offsets
  relative to `asOf` so headline numbers stay stable as the user
  changes the display window. `pct` is `null` (rendered as `n/a`)
  when the previous window is zero, never `+Inf%` or `NaN%`.
- `pew-insights top-projects --since <window> -n <N>` — ranks
  projects by attributed tokens (proportional message-share via
  `byproject.ts`) and labels each row using the cached project-ref
  lookup populated by `pew-insights projects`. Reuses both modules
  verbatim. Same denylist filter applies to every label, including
  in JSON output: denylisted projects keep their position but their
  basename becomes `<redacted>` and path becomes `null`. Unresolved
  refs show as `(unresolved)` and surface a hint to rebuild the cache.
- `pew-insights report` — HTML output now embeds the new cost and
  trend sections inline alongside the existing digest sections. The
  `HtmlReportInput.cost` / `.trend` fields are optional, so direct
  callers built against 0.2 keep compiling and rendering.

### Changed

- `report.html` is now gitignored (it's a build output, not source).

### Tests

- Test count grew from 41 → 75. New suites: `cost` (10), `trend`
  (11), `topprojects` (8), `html` (6). Coverage includes
  cache-savings math, default-rate completeness, sparkline edge
  cases (empty, constant, monotonic, negatives), DoD/WoW arithmetic,
  div-by-zero pct guard, denylist enforcement on the new
  top-projects path, XSS-safe HTML escaping in the cost table, and
  back-compat behaviour of `renderHtmlReport` when the new fields
  are omitted.

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
