# Changelog

All notable changes to this project will be documented in this file.

## 0.4.91 — 2026-04-25

### Added

- `prompt-output-correlation`: per-group Pearson correlation
  between hour-bucket prompt-token mass (`input_tokens`) and
  output-token mass (`output_tokens`), with companion OLS slope
  and intercept. New analytical lens — none of the existing
  ratio / size / share / variance subcommands relate the two
  series per bucket.

  For each (group, hour_start) cell, sums input and output
  tokens. Per group, fits Pearson r over the resulting (x, y)
  series and reports `pearsonR`, `slope`, `intercept`, plus
  per-bucket population stats (`meanInput`, `meanOutput`,
  `stdInput`, `stdOutput`, `activeBuckets`). A `degenerate` flag
  flips when `stdInput == 0` or `stdOutput == 0` (Pearson is
  undefined; we return r=0 and surface the flag so callers can
  hide / footnote the row).

  Why: `output-input-ratio` is a single scalar (totalOutput /
  totalInput) that cannot tell you whether bigger prompts produce
  proportionally bigger replies, or whether the model has a flat
  output budget regardless of prompt size. Two models with an
  identical 0.5 ratio can have r=+0.95 (output tracks prompt) or
  r=-0.30 (output shrinks as prompt grows — usually a
  context-truncation / refusal pattern). `burstiness` looks at
  the variance of *one* series. `prompt-size` and `output-size`
  are independent distributions with no per-bucket link.

  Filters: `--since`, `--until`, `--by model|source` (default
  `model`), `--min-buckets <n>` (default 2 — Pearson needs ≥ 2
  points to be defined at all), `--top <n>` cap, `--sort
  tokens|r|abs-r|buckets|slope` (default `tokens`, all desc with
  lex tiebreak on group key). `--top` and `--min-buckets` are
  display-only — global denominators (`totalGroups`,
  `totalActiveBuckets`, `totalInputTokens`, `totalOutputTokens`,
  `globalPearsonR`, `globalSlope`) always reflect the full
  population. `globalDegenerate` flips when the global pool's
  `stdInput == 0` or `stdOutput == 0`.

  20 new tests (1145 total, up from 1125): rejects bad
  `minBuckets` (0, negative, fractional); rejects bad `top`,
  `by`, `sort`, `since`, `until`; empty queue returns zeros;
  single bucket → degenerate, dropped at default `minBuckets=2`,
  kept at `minBuckets=1` and flagged degenerate; perfect linear
  y=2x → r=+1, slope=2, intercept=0 (within fp); perfect inverse
  y=-x+C → r=-1, slope=-1; constant input → degenerate, r=0,
  slope=0, intercept=0; same-hour rows coalesce by hour_start
  (input/output sum into the cell); `--by source` switches axis;
  `--since`/`--until` window applies and `droppedInvalidHourStart`
  / `droppedZeroTokens` count rejected rows; `--sort abs-r` ranks
  strongest correlations regardless of sign (perfect-positive and
  perfect-negative tie at the top); `--sort r` is signed
  (positive first); `--top 2` caps and surfaces
  `droppedTopGroups` while `totalGroups`/`totalActiveBuckets`
  stay full-population; `minBuckets=3` drops a 2-bucket group but
  keeps its tokens in global denominators; deterministic JSON
  roundtrip.

### Live-smoke output

`pew-insights prompt-output-correlation --by source --min-buckets 5`
against `~/.config/pew/queue.jsonl`:

```
pew-insights prompt-output-correlation
as of: 2026-04-25T13:36:45.094Z    groups: 6 (shown 6)    active-buckets: 897    tokens: 8,589,811,179    in: 3,368,772,219    out: 37,070,541    minBuckets: 5    sort: tokens    global r: 0.574    global slope: 0.006
dropped: 0 bad hour_start, 0 zero/non-finite tokens, 0 below min-buckets, 0 below top cap
(pearson r in [-1,+1] over per-bucket (input_tokens, output_tokens) pairs; slope/intercept = OLS y = slope*x + intercept; degenerate=yes when stdInput or stdOutput is 0)

per-source prompt→output correlation (sorted by tokens desc, lex tiebreak)
source          tokens         in             out         buckets  mean-in    mean-out  std-in     std-out  r       slope   intercept  degen
--------------  -------------  -------------  ----------  -------  ---------  --------  ---------  -------  ------  ------  ---------  -----
claude-code     3,442,385,788  1,834,613,640  12,128,825  267      6,871,212  45,426    9,421,260  71,963   0.843   0.006   1161       no
opencode        2,527,081,125  173,349,426    15,716,319  187      927,002    84,044    1,270,915  82,340   0.606   0.039   47620      no
openclaw        1,667,883,959  894,607,627    4,764,076   356      2,512,943  13,382    2,781,215  20,016   0.654   0.005   1557       no
codex           809,624,660    410,781,190    2,045,042   64       6,418,456  31,954    7,171,888  37,319   0.948   0.005   302        no
hermes          140,949,920    54,839,246     1,281,032   148      370,535    8,656     510,252    8,147    0.502   0.008   5687       no
vscode-copilot  1,885,727      581,090        1,135,247   320      1,816      3,548     14,584     4,947    -0.029  -0.010  3566       no
```

Reading: the global pool sits at r=0.574 — moderately positive,
i.e. across all (source, hour) cells bigger prompts do trend
with bigger replies, but with substantial scatter. The headline
finding is the *spread of r across sources*. `codex` is the
tightest fit (r=0.948, slope=0.005, intercept=302) — almost
deterministic 0.5% reply-per-prompt-token with a near-zero
floor, a textbook "this CLI's output is a fixed fraction of its
input" pattern. `claude-code` is similar shape (r=0.843, same
slope ~0.006). `opencode` has a distinctly higher slope (0.039,
~6.5× the others) and a 47.6k-token intercept, which says its
replies have a structural baseline regardless of prompt size and
then add ~4% of prompt on top — different generation-budget
policy. `vscode` signal lands at r=-0.029 — effectively zero
correlation between prompt and output for that source, meaning
its hourly output volume is uncoupled from how much prompt it
consumes (likely a different shaped traffic mix: many tiny
inline completions whose output budget is fixed by the UI, not
by what you typed). None of this is visible in
`output-input-ratio`'s single scalar.

## 0.4.90 — 2026-04-25

### Added

- `device-tenure`: dormancy + freshness refinement. Adds three
  per-device fields and one summary count:

  - `longestGapHours`: max contiguous idle gap (hours) between
    consecutive active hour_start buckets. 0 for a single-bucket
    device. Surfaces dormancy patterns inside an otherwise-long
    tenure (e.g. a laptop that's been around 269 days but had a
    20-day vacation gap mid-tenure).
  - `hoursSinceLastSeen`: `(generatedAt - lastSeen)` in hours.
    Useful for ranking "stale" devices independent of `spanHours`.
  - `recentlyActive`: boolean, true iff `hoursSinceLastSeen <
    recentThresholdHours`. A device may have a long span but be
    dormant; this flag separates the two.
  - `recentlyActiveCount`: summary count over the full population.

  Plus a new `--sort gap` key (longestGapHours desc) and a
  `--recent-threshold-hours <h>` flag (default 24h, range > 0).

  Why: `device-tenure` v0.4.89 told you span and breadth but
  conflated "active long-tenured" with "abandoned long-tenured".
  A 6462.5h span looks identical for a host that quit a year ago
  vs one that ran 5 minutes ago. The freshness/gap dimension fixes
  that without changing the existing rows — pure additive.

  6 new tests (1125 total, up from 1119): rejects bad
  `recentThresholdHours` (0, negative, NaN); single-bucket
  `longestGapHours=0`; multi-bucket gap = max consecutive idle
  (e.g. {0h, 2h, 10h, 12h} -> 8h); `recentlyActive` flips with
  threshold widening (12h-stale device flips from no->yes when
  threshold goes 24h->72h, recentlyActiveCount tracks it);
  `--sort gap` orders devices by longest gap desc; repeated
  hour_start values dedupe (no spurious 0h gaps inflating the
  bucket count).

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--sort gap --recent-threshold-hours 24`:

  ```
  pew-insights device-tenure
  as of: 2026-04-25T12:41:36.646Z    devices: 1 (shown 1)    active-buckets: 895    tokens: 8,574,241,821    minBuckets: 0    sort: gap    recentThreshold: 24h    recentlyActive: 1/1
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 by model filter, 0 sparse devices, 0 below top cap
  (spanHours = clock hours first->last; activeBuckets = distinct hour_start values; distinctSources/Models = unique tags seen on this device)

  per-device tenure (sorted by gap desc)
  device      first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         tok/bucket  tok/span-hr  sources  models  longest-gap-hr  hr-since-last  recent
  ----------  ------------------------  ------------------------  -------  --------------  -------------  ----------  -----------  -------  ------  --------------  -------------  ------
  [REDACTED]  2025-07-30T06:00:00.000Z  2026-04-25T12:30:00.000Z  6462.5   895             8,574,241,821  9,580,158   1,326,769    6        15      477.5           0.2            yes
  ```

  Reading: the single-host dataset shows a 477.5h longest contiguous
  idle gap — that's ~19.9 days of consecutive dormancy somewhere in
  the 269-day tenure. Last activity 0.2h before the snapshot, so
  `recentlyActive=yes`. Without this refinement v0.4.89 reported
  identical numbers whether the laptop was active right now or had
  been retired in February — a real failure mode the moment a
  second device appears (a new laptop, a VM, a CI runner). The
  `longest-gap-hr` column also explains the 13.8% bucket-coverage
  number from v0.4.89: 895 active buckets out of 6462.5 wall-clock
  hours is consistent with multi-day dormancy stretches like the
  observed 477.5h gap, plus the natural sleep/work cadence.

  (device_id redacted to `[REDACTED]` per host policy.)

## 0.4.89 — 2026-04-25

### Added

- `device-tenure`: per-device active-span lens. Same shape as
  `model-tenure` / `provider-tenure` / `source-tenure`, but reduced
  on the `device_id` axis. Completes the tenure family on the fourth
  and last categorical axis available in `QueueLine`.

  Reports per-device `firstSeen`, `lastSeen`, `spanHours`,
  `activeBuckets`, `tokens`, `tokensPerActiveBucket`,
  `tokensPerSpanHour`, plus `distinctSources` and `distinctModels`
  — the natural follow-up questions once the axis is the host:
  "how many CLIs runs on this device?" and "how many models flow
  through it?". Neither is answered by any other report —
  `device-share` is a mass tally with no temporal axis;
  `model-/provider-/source-tenure` are on the wrong axis and
  cannot be aggregated by hand without double-counting hour_starts.

  Sort keys: `span` (default), `active`, `tokens`, `density`,
  `sources`, `models`. `--min-buckets` floor and `--top` cap are
  display-only — global denominators (`totalDevices`,
  `totalActiveBuckets`, `totalTokens`) always reflect the full
  population. Filters: `--source`, `--model`, `--since`, `--until`.

  14 new tests (1119 total, up from 1105): empty input, ISO
  weekday/hour aggregation, sort variants (tokens, sources with
  lex tiebreak), source + model filters, `--min-buckets` floor
  preserving global denominators, `--top` cap, bad hour_start +
  zero tokens drops, fallback to `'unknown'` when device_id is
  empty, plus option validation (negative/fractional minBuckets/top,
  bad sort, bad since/until).

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--top 5 --sort span`:

  ```
  pew-insights device-tenure
  as of: 2026-04-25T12:39:06.975Z    devices: 1 (shown 1)    active-buckets: 895    tokens: 8,570,065,698    minBuckets: 0    sort: span
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 by model filter, 0 sparse devices, 0 below top cap
  (spanHours = clock hours first->last; activeBuckets = distinct hour_start values; distinctSources/Models = unique tags seen on this device)

  per-device tenure (sorted by span desc)
  device                                first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         tok/bucket  tok/span-hr  sources  models
  ------------------------------------  ------------------------  ------------------------  -------  --------------  -------------  ----------  -----------  -------  ------
  [REDACTED]                            2025-07-30T06:00:00.000Z  2026-04-25T12:30:00.000Z  6462.5   895             8,570,065,698  9,575,492   1,326,122    6        15
  ```

  Reading: this host is the *only* device pew has ever seen — a
  single laptop tenure of ~6463 clock hours (~269 days) since
  2025-07-30, carrying every observation in the dataset. 895
  distinct hour_start buckets means roughly 13.8% bucket coverage
  over the span (895 / 6462.5h, treating buckets as 1h wide).
  Density ~1.33M tok/span-hour aligns with the observed
  bucket-density-percentile baseline. The `sources=6, models=15`
  numbers confirm this single device is the multi-CLI multi-model
  router for the entire account — useful baseline if a second
  device ever shows up (a new laptop, a VM, a CI runner): the
  `--sort span` view will immediately surface the split, and
  `--sort sources` / `--sort models` will rank by breadth-of-use.

  (device_id redacted to `[REDACTED]` per host policy — the live
  value is a stable UUID.)

## 0.4.88 — 2026-04-25

### Added

- `hour-of-week`: `--min-cell-tokens <n>` cell-mass floor flag.
  Drops cells whose `tokens < n` from `topCells[]`. Suppressed
  cells surface as `droppedSparseCells`. Display filter only —
  the concentration metrics (entropy, normalised entropy, Gini,
  topKShare) and the `populatedCells` / `deadCells` split are
  always computed over the full 168-cell population. Default
  0 = no floor.

  Why: the v0.4.87 baseline showed `populated 168/168` (every
  weekly hour cell has at least one observation), so the default
  topCells view of "10 hottest cells" gives no information about
  the body of the distribution. `--min-cell-tokens` lets you ask
  "show me the cells with at least N tokens worth of activity"
  without amputating the entropy / Gini computation, which still
  needs every cell (including the long-tail dead-quiet ones).

  3 new tests (1105 total, up from 1102): rejects bad
  `minCellTokens` (negative, fractional), `--min-cell-tokens 100`
  on three cells of 700/200/50 hides the 50-cell from `topCells`
  while preserving `populatedCells=3`, `totalTokens=950`, and
  `topKShare=1.0` (all unfiltered), and `--min-cell-tokens 0`
  is a strict no-op against the baseline.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--min-cell-tokens 50000000 --top 5`:

  ```
  pew-insights hour-of-week
  as of: 2026-04-25T12:01:09.927Z    buckets: 894    tokens: 8,560,493,601    populated: 168/168    dead: 0
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 by model filter, 110 cells by min-cell-tokens floor
  min-cell-tokens floor: 50,000,000 (drops cells with tokens < 50,000,000 from topCells[])

  concentration metrics
  metric                  value
  ----------------------  -------------------------------------
  entropy (bits)          6.764 / 7.392 max
  normalised entropy      0.915  (1.0 = uniform)
  gini                    0.511  (0 = uniform, 1 = single-cell)
  top-10 cell mass share  21.0%

  top 5 cells (UTC weekday × hour)
  weekday  hour (UTC)  tokens       share  buckets
  -------  ----------  -----------  -----  -------
  Mon      15:00       235,594,447  2.8%   2
  Tue      01:00       222,095,901  2.6%   8
  Mon      14:00       188,925,721  2.2%   2
  Mon      12:00       177,277,703  2.1%   2
  Mon      08:00       174,589,342  2.0%   14
  ```

  Reading: of 168 weekly cells, 110 fall below the 50M-token floor
  — i.e. 58 cells (35%) carry the bulk of all activity. The
  concentration metrics are unchanged from v0.4.87 (entropy 6.764,
  Gini 0.511) because they always reflect the full population, as
  designed. The floor is doing exactly its job: cleanly partitioning
  "meaningful" cells from "background trickle" cells without
  distorting the underlying distribution shape.

## 0.4.87 — 2026-04-25

### Added

- `hour-of-week`: 168-cell joint (weekday × hour-of-day, UTC)
  concentration lens. Distinct from existing temporal lenses:
  `time-of-day` collapses to 24 hour-of-day cells (loses weekday),
  `weekday-share` collapses to 7 weekday cells (loses hour),
  `weekend-vs-weekday` is binary (loses both axes), `peak-hour-share`
  is a single hour, `which-hour` is a per-bucket pick. Hour-of-week
  is the joint shape: which (weekday, hour) cells are routine peaks
  vs the dead zones, and how concentrated the weekly clock is overall.

  Reports per-cell tokens / buckets / share, plus four concentration
  metrics over the full 168-cell population:

  - Shannon entropy in bits (max log2(168) = 7.392)
  - normalised entropy (entropy / 7.392, 1.0 = uniform)
  - Gini over cell token mass (0 = uniform, ~1 = single-cell)
  - top-K mass share (default K=10, configurable via `--top-k`)

  Plus a `topCells[]` table of the hottest cells by tokens
  (configurable via `--top`, default 10), and a `populatedCells` /
  `deadCells` split (cells with > 0 tokens vs zero).

  Weekday convention: ISO — Monday=1 .. Sunday=7. Hour: 0..23 UTC.
  No local-timezone interpretation; rows bucketed by the UTC clock
  from `hour_start`. Bucket counts use distinct `hour_start` strings
  so duplicate-row sources (multiple sources in one bucket) don't
  inflate the buckets axis.

  9 new tests (1102 total, up from 1093): option validation
  (`--top` and `--top-k` ranges, since/until parsing), empty input
  shape, ISO weekday mapping (Mon=1..Sun=7 in UTC, including the
  Sunday=7 wraparound from JS getUTCDay=0), uniform 168-bucket
  population yields entropy=log2(168) and gini=0, single-cell
  concentration yields entropy=0 and gini=167/168, top-K share is
  computed over the full sorted cell set independent of the
  display `top` cap, source filter, and bad-row counting.

  Live smoke against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights hour-of-week
  as of: 2026-04-25T11:59:18.746Z    buckets: 893    tokens: 8,557,460,927    populated: 168/168    dead: 0
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 by model filter

  concentration metrics
  metric                  value
  ----------------------  -------------------------------------
  entropy (bits)          6.764 / 7.392 max
  normalised entropy      0.915  (1.0 = uniform)
  gini                    0.511  (0 = uniform, 1 = single-cell)
  top-10 cell mass share  21.0%

  top 10 cells (UTC weekday × hour)
  weekday  hour (UTC)  tokens       share  buckets
  -------  ----------  -----------  -----  -------
  Mon      15:00       235,594,447  2.8%   2
  Tue      01:00       222,095,901  2.6%   8
  Mon      14:00       188,925,721  2.2%   2
  Mon      12:00       177,277,703  2.1%   2
  Mon      08:00       174,589,342  2.0%   14
  Mon      16:00       166,175,034  1.9%   2
  Wed      06:00       162,225,481  1.9%   20
  Thu      01:00       157,045,510  1.8%   10
  Wed      08:00       156,754,431  1.8%   18
  Mon      13:00       154,771,510  1.8%   2
  ```

  Reading: every one of the 168 weekly hour cells has at least one
  observation (populated 168/168, dead 0) — usage covers the entire
  weekly clock. Normalised entropy 0.915 says the distribution is
  nowhere near a single hot spot, but Gini 0.511 still flags
  meaningful skew. The top 10 cells together account for only 21%
  of the mass — the load is genuinely spread, with no individual
  cell above 2.8%. The hottest cells cluster heavily on Monday's
  workday band (12:00–16:00 UTC), with a secondary Tue/Wed/Thu
  early-morning UTC pocket.

## 0.4.86 — 2026-04-25

### Added

- `bucket-density-percentile`: `--trim-top <pct>` outlier-trim
  flag. Drops the top `pct` percent of buckets (by token mass)
  *before* computing percentiles and deciles. Suppressed buckets
  surface as `droppedTrimTop`. Range `[0, 100)`. Default 0 = no
  trim. Drop count is exactly `floor(N * pct / 100)` over the
  post-filter / post-`--min-tokens` population — so `--trim-top 1`
  on 1,443 surviving buckets drops the 14 largest.

  Why: the 0.4.85 baseline showed mean=5.93M vs p50=1.45M (4x
  mean/median ratio) — heavy right-skew dragged by a small set of
  giant reasoning buckets. `--trim-top` lets you ask "what does
  the body of the distribution look like once I exclude the
  outliers?" without filtering by an arbitrary token threshold
  (which would also amputate the legitimate body).

  Like `--min-tokens`, this affects both the percentile ladder
  *and* the decile mass shares — the whole point is to recompute
  the distribution shape on the trimmed population.

  4 new tests (1092 total, up from 1088): rejects bad
  trimTopPct (negative, >=100, NaN), `--trim-top=0` is a true
  no-op, `--trim-top=10` on 100 buckets drops exactly the 10
  largest with deciles re-partitioning the surviving 90, and a
  one-giant-outlier robustness test where `--trim-top=1` on
  99x100 + 1x1M brings mean / max from skewed back to the body
  baseline.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--trim-top 1`:

  ```
  pew-insights bucket-density-percentile
  as of: 2026-04-25T11:42:20.766Z    buckets: 1,430    tokens: 7,589,253,604    mean: 5,307,170
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 below min-tokens floor, 14 by trim-top
  trim-top: 1% (drops floor(N * pct/100) largest buckets before percentile/decile computation)

  percentile ladder (tokens per bucket)
  p      tokens
  -----  ----------
  min    20
  p1     174
  p5     722
  p10    1,721
  p25    52,762
  p50    1,421,565
  p75    5,429,447
  p90    13,719,061
  p95    29,567,935
  p99    51,900,575
  p99.9  58,840,552
  max    59,093,095

  decile mass distribution (D1 = smallest, D10 = top 10%)
  decile  count  tokens         share  lower       upper
  ------  -----  -------------  -----  ----------  ----------
  D1      143    110,954        0.0%   20          1,721
  D2      143    575,765        0.0%   1,721       8,235
  D3      143    10,625,679     0.1%   8,294       195,097
  D4      143    55,457,763     0.7%   197,889     628,897
  D5      143    148,717,000    2.0%   630,673     1,421,565
  D6      143    272,914,014    3.6%   1,425,418   2,498,010
  D7      143    476,938,178    6.3%   2,508,649   4,254,663
  D8      143    795,526,150    10.5%  4,268,560   7,020,524
  D9      143    1,377,362,364  18.1%  7,048,004   13,719,061
  D10     143    4,451,025,737  58.6%  13,747,361  59,093,095
  ```

  Headline: trimming just the top 1% (14 buckets out of 1,443)
  removes ~961M tokens — i.e. those 14 buckets alone carried
  ~11.2% of total mass (the 0.4.85 untrimmed total was 8.55B,
  trimmed total is 7.59B). Mean drops from 5.93M to 5.31M
  (-10.5%), max collapses from 107.6M to 59.1M (-45%), p99
  drops from 59.1M to 51.9M (-12%). The decile pattern is
  qualitatively unchanged — D10 still holds 58.6% of mass
  (down from 61.4%) — so the right-skew is *not* purely
  outlier-driven; it is structural. Even with the 14 worst
  outliers removed, the top decile carries ~6x the mass of D9.

## 0.4.85 — 2026-04-25

### Added

- `bucket-density-percentile`: population-level distribution of
  `total_tokens` per single bucket pooled across all rows that
  survive filters. Reports the full percentile ladder (`min`,
  `p1`, `p5`, `p10`, `p25`, `p50`, `p75`, `p90`, `p95`, `p99`,
  `p99.9`, `max`) plus a 10-decile mass partition where each
  decile surfaces `count`, `tokens`, `tokenShare`, `lowerEdge`,
  and `upperEdge`. Standard `--since` / `--until` / `--source`
  filters; nearest-rank (R-1) percentile convention to match
  `bucket-intensity` / `interarrival-time` / `velocity`.

  Why this is orthogonal to what already ships:

  - `bucket-intensity` reports the same magnitude axis but
    *per model*. A model with 3 huge buckets gets its own row
    and never enters a pooled p99. This subcommand answers
    "across *all* my buckets regardless of model/source, what
    does the size distribution look like" — there is no per-key
    breakdown, just the global distribution.
  - `burstiness` collapses spread into a single Gini /
    coefficient-of-variation scalar. It tells you *how* uneven
    things are but never surfaces the percentile values or the
    decile mass shares themselves.
  - `tail-share` reports a single "top N% holds X% of tokens"
    pair. `bucket-density-percentile` gives the full decile
    distribution (D1..D10), so you can see whether the tail is
    a sharp 99th-percentile cliff or a gentle slope across the
    top three deciles.

  8 new tests (1088 total, up from 1080): rejects bad
  since/until/minTokens, empty queue handling, drop accounting
  for bad hour_start / zero-tokens / source filter, percentile
  correctness on a synthetic 1..100 population, decile
  partitioning conservation (counts sum to N, tokens sum to
  totalTokens, shares sum to 1.0), small-population handling
  (5 buckets, every observation lands in exactly one decile,
  D10 always contains the max), and `--since`/`--until` window
  filtering.

  Live smoke against `~/.config/pew/queue.jsonl` (banned product
  names redacted as `[REDACTED]`):

  ```
  pew-insights bucket-density-percentile
  as of: 2026-04-25T11:39:40.362Z    buckets: 1,443    tokens: 8,550,018,262    mean: 5,925,169
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 below min-tokens floor

  percentile ladder (tokens per bucket)
  p      tokens
  -----  -----------
  min    20
  p1     174
  p5     722
  p10    1,729
  p25    59,346
  p50    1,449,566
  p75    5,686,454
  p90    14,747,056
  p95    31,948,907
  p99    59,093,095
  p99.9  87,339,377
  max    107,646,380

  decile mass distribution (D1 = smallest, D10 = top 10%)
  decile  count  tokens         share  lower       upper
  ------  -----  -------------  -----  ----------  -----------
  D1      144    112,675        0.0%   20          1,721
  D2      144    590,678        0.0%   1,729       8,340
  D3      144    11,147,598     0.1%   8,609       199,015
  D4      145    58,048,658     0.7%   200,241     648,575
  D5      144    154,155,813    1.8%   652,441     1,445,492
  D6      144    282,025,834    3.3%   1,449,566   2,542,276
  D7      145    498,895,766    5.8%   2,554,115   4,502,438
  D8      144    831,029,109    9.7%   4,504,333   7,353,211
  D9      144    1,468,032,805  17.2%  7,358,150   14,593,390
  D10     145    5,245,979,326  61.4%  14,747,056  107,646,380
  ```

  Headline: across 1,443 active buckets totalling 8.55B tokens,
  the distribution is grotesquely top-heavy. Median bucket is
  ~1.45M tokens but mean is ~5.93M — a 4x mean/median ratio
  flagging massive right-skew. The bottom 30% of buckets (D1+D2+D3,
  432 buckets) hold a combined ~12M tokens — 0.14% of all mass,
  i.e. essentially noise. The top decile alone (145 buckets) holds
  61.4% of *all* tokens (5.25B), and the p99 bucket is ~59M tokens
  while max is ~107M — a single bucket carries ~1.3% of total
  mass. This is the picture of a workload dominated by a small
  number of extremely heavy reasoning/long-context buckets, with
  a long tail of trivial heartbeat traffic.

## 0.4.84 — 2026-04-25

### Added

- `source-breadth-per-day`: `--min-sources <n>` flag. Drop days
  whose `sourceCount` is strictly less than the floor *before*
  computing summary stats and `days[]`. Suppressed days surface
  as `droppedBelowMinSources`. Default 0 = no floor.

  Why: 0.4.83's `sourceCountMean=1.33` is dragged toward 1 by
  the long tail of single-source days (84.8% of the population).
  A `--min-sources 2` floor restricts the analysis to days where
  the user genuinely *was* multi-tool — the population that
  actually represents tool-diversity behaviour rather than
  baseline single-tool usage. Combined with `--sort sources`
  this surfaces the most-diverse multi-tool days, not the
  thousands of solo-tool days that drown out the signal.

  Note: like `--min-span` on `active-span-per-day` (and unlike
  `--top`, which is display-only), `--min-sources` affects both
  `days[]` *and* every summary aggregate including
  `totalTokens`, `singleSourceDays`, and `multiSourceShare`. This
  is intentional — the whole point is to characterise the
  *multi-tool day* distribution, so stats should reflect the
  post-floor population.

  4 new tests (1080 total, up from 1076): rejects bad
  minSources, filters sub-floor days from both stats and days[]
  with totalTokens reflecting post-floor sum, --min-sources=0
  is a true no-op, and combines correctly with --top (top caps
  post-floor population).

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--min-sources 2 --sort sources --top 8` (banned product
  names redacted as `[REDACTED]`):

  ```
  pew-insights source-breadth-per-day
  as of: 2026-04-25T11:02:25.257Z    days: 16 (shown 8)    tokens: 7,765,087,829    sort: sources
  sourceCount: min=2 p25=2 median=3 mean=3.19 p75=4 max=6
  single-source: 0    multi-source: 16    multi-share: 100.0%
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 empty source, 89 below min-sources floor, 8 below top cap
  min-sources floor: 2 (drops days with sourceCount < 2 from stats AND days[])

  day (UTC)   sources  source-list                                              buckets  tokens
  ----------  -------  -------------------------------------------------------  -------  -------------
  2026-04-20  6        claude-code,codex,hermes,openclaw,opencode,[REDACTED]    48       1,773,838,138
  2026-04-17  5        claude-code,codex,hermes,openclaw,[REDACTED]             23       132,896,161
  2026-04-23  4        claude-code,hermes,openclaw,opencode                     48       695,192,088
  2026-04-21  4        claude-code,hermes,openclaw,opencode                     48       1,122,611,203
  2026-04-19  4        claude-code,codex,hermes,openclaw                        48       659,027,845
  2026-04-18  4        claude-code,codex,hermes,openclaw                        36       922,235,800
  2026-04-25  3        hermes,openclaw,opencode                                 22       295,473,307
  2026-04-24  3        hermes,openclaw,opencode                                 48       627,251,216
  ```

  Headline: with the floor applied (89 single-source days
  excluded), the 105-day population shrinks to 16 "real
  multi-tool days". Median sourceCount jumps from 1 (all days)
  to 3 — i.e. on a day where the user is genuinely multi-tool,
  the typical breadth is 3 distinct sources. Multi-share is
  trivially 100% by construction (the floor guarantees it).
  The 6-source peak day stays as the all-time outlier.

## 0.4.83 — 2026-04-25

### Added

- `source-breadth-per-day`: per UTC calendar day, count of *distinct
  active sources* — the "tool-diversity" lens. For each day with at
  least one positive-token row we report:

  - `sourceCount` — distinct `source` values active that day
    (only sources with > 0 tokens that day are counted)
  - `sources` — comma-joined sorted list (lex asc) of those names,
    for human inspection
  - `bucketsOnDay` — distinct active hour_start values that day
  - `tokensOnDay` — sum of total_tokens that day

  Plus distribution stats over the full population: min / p25 /
  median / mean / p75 / max for `sourceCount`, plus
  `singleSourceDays` / `multiSourceDays` counters and
  `multiSourceShare = multi / distinct`. Standard
  `--since` / `--until` / `--source` / `--top` filters; `--top`
  is display-only. Default sort `day desc`; alternate sort keys
  `sources` / `tokens` / `buckets` (all desc, tiebreak day desc).

  Why this is orthogonal to what already ships:

  - `provider-share` / `source-tenure` aggregate over the whole
    window — not anchored per calendar day.
  - `cohabitation` measures *which sources co-occur within the
    same hour bucket*; this measures *how many sources show up
    anywhere in the same calendar day*. A day with one tool at
    09:00 and a different tool at 22:00 has cohabitation=0 but
    sourceCount=2 — the lenses see different things.
  - `active-span-per-day` / `first-bucket-of-day` characterise
    time-of-day shape; they're agnostic to which tools were used.
  - `model-mix-entropy` is over models, not sources, and is not
    per-day.

  When `--source` is set the report degenerates by design (every
  kept day has sourceCount=1); accepted for symmetry with sibling
  commands and useful for verifying day coverage of one tool.

  15 new tests (1076 total, up from 1061): option validation
  (since/until/top/sort), empty/drops, source filter vs empty
  source dropping order, distinct sources per day with sources
  list sorted lex asc, single-vs-multi counters, percentile
  distribution math on odd-N populations, default day-desc sort,
  sort=sources with day-desc tiebreak, sort=tokens / sort=buckets,
  top cap with full-population summary, since/until window, and
  source-filter degeneration to sourceCount=1.

  Live smoke against `~/.config/pew/queue.jsonl`, `--top 10`
  (banned product names redacted as `[REDACTED]`):

  ```
  pew-insights source-breadth-per-day
  as of: 2026-04-25T10:59:22.065Z    days: 105 (shown 10)    tokens: 8,535,469,879    sort: day
  sourceCount: min=1 p25=1 median=1 mean=1.33 p75=1 max=6
  single-source: 89    multi-source: 16    multi-share: 15.2%
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 empty source, 95 below top cap

  day (UTC)   sources  source-list                                              buckets  tokens
  ----------  -------  -------------------------------------------------------  -------  -------------
  2026-04-25  3        hermes,openclaw,opencode                                 22       292,743,686
  2026-04-24  3        hermes,openclaw,opencode                                 48       627,251,216
  2026-04-23  4        claude-code,hermes,openclaw,opencode                     48       695,192,088
  2026-04-22  3        hermes,openclaw,opencode                                 48       893,292,230
  2026-04-21  4        claude-code,hermes,openclaw,opencode                     48       1,122,611,203
  2026-04-20  6        claude-code,codex,hermes,openclaw,opencode,[REDACTED]    48       1,773,838,138
  2026-04-19  4        claude-code,codex,hermes,openclaw                        48       659,027,845
  2026-04-18  4        claude-code,codex,hermes,openclaw                        36       922,235,800
  2026-04-17  5        claude-code,codex,hermes,openclaw,[REDACTED]             23       132,896,161
  2026-04-16  2        claude-code,codex                                        14       77,147,112
  ```

  Headline: across 105 active days, 89 are *single-source* days
  (the dominant pattern — 84.8%). Only 16 days (15.2%) saw two
  or more tools. Median sourceCount is 1, mean 1.33; the max
  observed was 6 distinct sources on a single day (2026-04-20).
  The recent week shows 3-tool days as the steady state with one
  4-tool day (2026-04-23). Long tail of single-tool days drives
  median = p75 = 1, even though the mean is pulled above 1 by
  a small number of high-breadth days — classic right-skew.

## 0.4.82 — 2026-04-25

### Added

- `active-span-per-day`: `--min-span <n>` flag. Drop days whose
  `spanHours` is strictly less than the floor *before* computing
  summary stats and `days[]`. Suppressed days surface as
  `droppedShortSpanDays`. Default 0 = no floor.

  Why: 0.4.81's `dutyCycleMean=79.2%` is dragged toward 100% by
  the long tail of single-bucket days (spanHours=1, dutyCycle=1
  trivially). A `--min-span 6` floor restricts the analysis to
  days with at least a 6-hour active window — the population that
  actually represents a "workday" rather than a stray automated
  ping. Combined with `--sort duty` this surfaces the genuinely
  most-saturated workdays, not single-bucket artifacts.

  Note: unlike `--top` (which is display-only), `--min-span`
  affects both `days[]` *and* every summary aggregate. This is
  intentional — the whole point is to characterise the *workday*
  distribution, so stats should reflect the post-floor population.

  3 new tests (1060 total, up from 1057): rejects bad minSpan,
  filters short days from both stats and days[], combines
  correctly with `--top` (post-floor population is what `--top`
  caps).

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--min-span 6 --sort duty --top 8`:

  ```
  pew-insights active-span-per-day
  as of: 2026-04-25T10:21:38.192Z    days: 59 (shown 8)    tokens: 8,408,412,991    sort: duty
  spanHours: min=6 p25=7 median=8 mean=10.15 p75=10 max=24
  dutyCycle: min=25.0% p25=51.3% median=75.0% mean=70.8% p75=91.8% max=100.0%
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 46 below min-span floor, 51 below top cap
  min-span floor: 6 (drops days with spanHours < 6 from stats AND days[])
  ```

  Headline: with the floor applied (46 sub-6-hour days excluded),
  the 105-day population shrinks to 59 "real workday" days.
  Median spanHours stays at 8 (typical workday is 8 active UTC
  hours wide), and median dutyCycle drops from 87.5% (all days,
  inflated by single-bucket trivials) to 75% — i.e. on a typical
  workday, three out of every four hours inside the
  start→end window actually contain activity. The seven days
  shown at 100% duty are the same recent-week saturated runs
  noted in 0.4.81.

## 0.4.81 — 2026-04-25

### Added

- `active-span-per-day`: per UTC calendar day, the *workday window*
  — i.e. the span from the day's earliest active `hour_start` to its
  latest, and how saturated that window is. For each day with at
  least one positive-token row we report:

  - `firstHour` — UTC hour 0..23 of earliest active bucket
  - `lastHour` — UTC hour 0..23 of latest active bucket
  - `spanHours` — `lastHour - firstHour + 1` (always >= 1)
  - `activeBuckets` — distinct active hour_start values that day
  - `dutyCycle` — `activeBuckets / spanHours`, in (0, 1] — how
    saturated the window was. 1.0 = every hour in
    `[firstHour, lastHour]` had activity.
  - `tokensOnDay` — sum of total_tokens that day

  Plus distribution stats over the full population: min / p25 /
  median / mean / p75 / max for both `spanHours` and `dutyCycle`.
  Standard `--since` / `--until` / `--source` / `--top` filters;
  `--top` is display-only. Default sort `day desc` (newest first).

  Why this is orthogonal to what already ships:

  - `first-bucket-of-day` reports *when* the day starts (firstHour
    only). This reports *how long* the workday window is and *how
    saturated* it is.
  - `time-of-day` / `which-hour` / `peak-hour-share` distribute mass
    across hour-of-day across the whole window — not per-day
    start/end/length.
  - `bucket-streak-length` measures consecutive-hour runs but a
    fragmented day (work at 09, 14, 21) has spanHours=13 with runs
    of length 1; a focused day (09..13 contiguous) has spanHours=5
    and runs of length 5. This lens captures the *containment*
    signal a streak doesn't.
  - `idle-gaps` / `interarrival` measure gaps between active
    buckets but don't anchor to a calendar day.

  14 new tests (1057 total, up from 1043): option validation
  (since/until/top/sort), empty/drops, span-and-duty-cycle math,
  same-hour dedupe, summary distribution stats, sort=span +
  day-desc tiebreak, sort=duty most-saturated first, sort=tokens
  + sort=active, top cap with full-population summary,
  since/until window filtering, generatedAt honoured.

  Live smoke against `~/.config/pew/queue.jsonl` with `--top 8`:

  ```
  pew-insights active-span-per-day
  as of: 2026-04-25T10:18:20.500Z    days: 105 (shown 8)    tokens: 8,518,593,487    sort: day
  spanHours: min=1 p25=2 median=6 mean=6.75 p75=8 max=24
  dutyCycle: min=25.0% p25=66.7% median=87.5% mean=79.2% p75=100.0% max=100.0%
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 97 below top cap

  per-day active span (sorted by day desc)
  day (UTC)   first-hour  last-hour  span-hours  active-buckets  duty-cycle  tokens-on-day
  ----------  ----------  ---------  ----------  --------------  ----------  -------------
  2026-04-25  00          10         11          11              100.0%      275,867,294
  2026-04-24  00          23         24          24              100.0%      627,251,216
  2026-04-23  00          23         24          24              100.0%      695,192,088
  2026-04-22  00          23         24          24              100.0%      893,292,230
  2026-04-21  00          23         24          24              100.0%      1,122,611,203
  2026-04-20  00          23         24          24              100.0%      1,773,838,138
  2026-04-19  00          23         24          24              100.0%      659,027,845
  2026-04-18  01          23         23          21              91.3%       922,235,800
  ```

  Headline: every one of the last seven days is a fully saturated
  24-hour window (dutyCycle=100%, spanHours=24) — across 105 days
  the *median* spanHours is only 6 with median dutyCycle 87.5%, so
  the recent week is a clear outlier where activity covers the
  entire UTC clock (almost certainly automated/background usage,
  not human-keyboard hours).

## 0.4.80 — 2026-04-25

### Added

- `first-bucket-of-day`: `--sort <key>` flag. Sort `days[]` by
  `day` (default, desc), `first-hour` (asc — earliest wake-up
  first), `tokens` (desc — heaviest day first), or `buckets`
  (desc — most-active day first). Tiebreak in all non-default
  cases is `day desc`. Sort key is echoed in the report as
  `sort: <key>` and respected by both pretty and JSON output.

  Why: `--top` defaulted to "newest N days", which is great
  for a glance but useless when you want to find the *days
  where the workday started latest* (sort=first-hour with
  reverse view) or the *heaviest tokens days* (sort=tokens) or
  the *most-saturated days* (sort=buckets). All three are
  natural follow-on questions once you have firstHour stats.

  6 new tests (1043 total, up from 1037): rejects bad sort
  key, default sort echoed as 'day', sort=first-hour orders
  earliest wake-up first with day-desc tiebreak, sort=tokens
  orders heaviest day first with day-desc tiebreak,
  sort=buckets orders most-active day first with day-desc
  tiebreak, sort+top combination still computes summary
  stats over the full pre-cap population.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--sort first-hour --top 8`:

  ```
  pew-insights first-bucket-of-day
  as of: 2026-04-25T09:56:42.656Z    days: 105 (shown 8)    tokens: 8,515,226,447    sort: first-hour
  firstHour UTC: min=00 p25=01 median=02 mean=3.15 p75=05 max=10 mode=02 (n=28, share=26.7%)
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 97 below top cap
  (per UTC calendar day: firstBucket = earliest hour_start with positive total_tokens; firstHour = its UTC hour-of-day)

  per-day first bucket (sorted by first-hour asc)
  day (UTC)   first-bucket (UTC)        first-hour  buckets-on-day  tokens-on-day
  ----------  ------------------------  ----------  --------------  -------------
  2026-04-25  2026-04-25T00:00:00.000Z  00          20              272,500,254
  2026-04-24  2026-04-24T00:00:00.000Z  00          48              627,251,216
  2026-04-23  2026-04-23T00:00:00.000Z  00          48              695,192,088
  2026-04-22  2026-04-22T00:00:00.000Z  00          48              893,292,230
  2026-04-21  2026-04-21T00:00:00.000Z  00          48              1,122,611,203
  2026-04-20  2026-04-20T00:00:00.000Z  00          48              1,773,838,138
  2026-04-19  2026-04-19T00:00:00.000Z  00          48              659,027,845
  2026-04-18  2026-04-18T01:30:00.000Z  01          36              922,235,800
  ```

  Headline: every one of the eight earliest-starting days is
  also one of the most-recent eight, confirming the "workday
  started earlier and ran longer over the last week" finding
  from 0.4.79 — the wake-up-clock shift is *not* an artifact
  of sample size on older sparse days.

## 0.4.79 — 2026-04-25

### Added

- `first-bucket-of-day`: per UTC calendar day, the earliest
  active `hour_start` bucket — a "wake-up clock" lens. For
  every day with at least one positive-token row, we report:

  - `firstBucket` — ISO of the earliest active `hour_start`
  - `firstHour` — UTC hour-of-day 0..23 of that bucket
  - `bucketsOnDay` — distinct active `hour_start` values that day
  - `tokensOnDay` — sum of total_tokens that day

  Plus a single-row firstHour distribution: `min`, `p25`,
  `median`, `mean`, `p75`, `max`, and `mode` (lowest-hour
  tiebreak) with its day count and share. Standard `--since`
  / `--until` / `--source` / `--top` filters; `--top` is
  display-only — `distinctDays`, `totalTokens`, and every
  `firstHour*` aggregate always reflect the full pre-cap
  population, with hidden rows surfacing as `droppedTopDays`.
  Default sort is `day desc` (newest first).

  Why this is orthogonal to what already ships:

  - `time-of-day` / `which-hour` / `peak-hour-share`
    distribute tokens or buckets across hour-of-day across the
    *whole* window — they tell you where mass lands, not when
    each individual day starts.
  - `weekday-share` / `weekend-vs-weekday` are day-of-week
    lenses, not start-of-day lenses.
  - `idle-gaps` / `interarrival` measure spacing between
    active buckets; they don't anchor to "first bucket of the
    calendar day".
  - `bucket-streak-length` counts consecutive-hour runs but a
    streak that crosses midnight isn't the same signal as
    "what hour did this day's work begin".

  12 new tests (1037 total, up from 1025): option validation
  (since/until/top), empty/drops, per-day firstBucket selects
  the earliest active hour_start (verifies sort-day-desc and
  bucketsOnDay/tokensOnDay), summary stats with mode-tiebreak
  rule, single-day collapses all stats to one value, top cap
  is display-only with summary stats untouched, since/until
  inclusive-lower / exclusive-upper window, determinism.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--top 10`:

  ```
  pew-insights first-bucket-of-day
  as of: 2026-04-25T09:54:35.276Z    days: 105 (shown 10)    tokens: 8,510,577,154
  firstHour UTC: min=00 p25=01 median=02 mean=3.15 p75=05 max=10 mode=02 (n=28, share=26.7%)
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 95 below top cap
  (per UTC calendar day: firstBucket = earliest hour_start with positive total_tokens; firstHour = its UTC hour-of-day)

  per-day first bucket (sorted by day desc)
  day (UTC)   first-bucket (UTC)        first-hour  buckets-on-day  tokens-on-day
  ----------  ------------------------  ----------  --------------  -------------
  2026-04-25  2026-04-25T00:00:00.000Z  00          20              267,850,961
  2026-04-24  2026-04-24T00:00:00.000Z  00          48              627,251,216
  2026-04-23  2026-04-23T00:00:00.000Z  00          48              695,192,088
  2026-04-22  2026-04-22T00:00:00.000Z  00          48              893,292,230
  2026-04-21  2026-04-21T00:00:00.000Z  00          48              1,122,611,203
  2026-04-20  2026-04-20T00:00:00.000Z  00          48              1,773,838,138
  2026-04-19  2026-04-19T00:00:00.000Z  00          48              659,027,845
  2026-04-18  2026-04-18T01:30:00.000Z  01          36              922,235,800
  2026-04-17  2026-04-17T01:30:00.000Z  01          23              132,896,161
  2026-04-16  2026-04-16T01:30:00.000Z  01          14              77,147,112
  ```

  Headline: across 105 active UTC days, the median wake-up
  hour is 02:00 UTC and the modal hour is 02:00 (28/105 days,
  26.7%); the most-recent dense stretch (2026-04-19 .. 04-25)
  has firstHour=00 every day at full 48-half-hour-bucket
  saturation, while older sparser days cluster around 01-02
  UTC — i.e. the workday has been starting *earlier* and
  running *longer* over the last week.

## 0.4.78 — 2026-04-25

### Added

- `provider-tenure`: `--min-buckets <n>` flag. Drop providers
  whose `activeBuckets < n` from `providers[]` *before* applying
  `--top`. Display filter only — `totalProviders`,
  `totalActiveBuckets`, and `totalTokens` still reflect the
  full pre-filter population (consistent with how `--min-buckets`
  behaves across this CLI). Suppressed rows surface as
  `droppedSparseProviders`.

  Why: with the default 1,234-bucket workspace, vendors that
  appear in only a handful of buckets (`google`: 37 buckets;
  `unknown`: 56 buckets) pad the table next to the two
  workhorses (`anthropic`: 535, `openai`: 606). `--min-buckets
  100` cleanly isolates vendors that are an established part of
  routing rather than an experiment or a one-off probe.

  Order of operations is documented and tested:
  `min-buckets` floor first (rows below the floor are
  `droppedSparseProviders`), then `top` cap (rows trimmed there
  are `droppedTopProviders`). Default 0 = no-op, echoed as
  `minBuckets: 0` in the report.

  3 new tests (1025 total, up from 1022): rejects bad
  `minBuckets` (negative, fractional); floor hides sparse
  providers and surfaces `droppedSparseProviders` while leaving
  `totalProviders` / `totalActiveBuckets` / `totalTokens`
  untouched and verifying the floor is applied *before* the top
  cap; default is 0 and echoed as such.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--min-buckets 100`:

  ```
  pew-insights provider-tenure
  as of: 2026-04-25T09:20:39.601Z    providers: 4 (shown 2)    active-buckets: 1,234    tokens: 8,499,146,406    minBuckets: 100    sort: span
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 2 below min-buckets, 0 below top cap
  (provider rolled up from normalised model id; spanHours = clock hours first->last across any model from this vendor; activeBuckets = distinct hour_start values touched)

  per-provider tenure (sorted by span desc)
  provider   first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  distinct-models  tokens         tok/bucket  tok/span-hr
  ---------  ------------------------  ------------------------  -------  --------------  ---------------  -------------  ----------  -----------
  anthropic  2025-07-30T06:00:00.000Z  2026-04-25T09:00:00.000Z  6459.0   535             7                5,969,987,723  11,158,856  924,290
  openai     2025-08-18T06:30:00.000Z  2026-04-25T09:00:00.000Z  6002.5   606             6                2,493,428,387  4,114,568   415,398
  ```

  Headline: with the floor applied the two workhorses are
  isolated — anthropic still leads on tenure (6,459h) and
  cumulative tokens (5.97B), but openai narrowly leads on
  active-bucket count (606 vs 535) — confirming the dual
  routing pattern without the sparse-vendor noise.

## 0.4.77 — 2026-04-25

### Added

- `provider-tenure`: per-provider active-span lens (the
  vendor-axis analog of `model-tenure`). For each inference
  vendor (anthropic / openai / google / xai / meta / mistral /
  deepseek / qwen / cohere / unknown — classified by
  `classifyProvider` from `provider-share`) we report:

  - `firstSeen`, `lastSeen` — earliest and latest active
    `hour_start` touched by any model from this provider
  - `spanHours` — clock hours from firstSeen to lastSeen
    (fractional, 0 for single-bucket providers)
  - `activeBuckets` — distinct `hour_start` values with at
    least one positive-token row from any model of this provider
  - `distinctModels` — how many distinct (normalised) model ids
    contributed
  - `tokens`, `tokensPerActiveBucket`, `tokensPerSpanHour`
    (1-hour floor on span keeps single-bucket providers finite)

  Why this is orthogonal to what already ships:

  - `model-tenure` reports per individual model id, so `gpt-5`,
    `gpt-5.4`, and `gpt-5-mini` are three separate rows. That
    hides the fact they're the same vendor and that the vendor's
    tenure is wider than any single model's.
  - `provider-share` reports session-count and message-share per
    provider but never anchors to firstSeen / lastSeen and never
    measures a tenure span.
  - `source-tenure` is producer-axis (which CLI was active when),
    not vendor-axis.

  Sort keys: `span` (default) | `active` | `tokens` | `density`
  | `models`. Standard `--since` / `--until` / `--source` /
  `--top` filters; `--top` is display-only — `totalProviders`,
  `totalActiveBuckets`, and `totalTokens` always reflect the
  full population, with hidden rows surfacing as
  `droppedTopProviders`.

  16 new tests (1022 total, up from 1006): option validation
  (since/until/top/sort), empty/drops, provider rollup
  (multiple model ids -> one provider; four-vendor separation
  across openai / anthropic / google / xai), single-bucket 1h
  floor, multi-device dedupe, source filter, since/until window,
  sort keys (default span / tokens / models), top cap with
  full-population totals preserved, unknown-bucket fallback.

  Live smoke against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights provider-tenure
  as of: 2026-04-25T09:18:33.684Z    providers: 4 (shown 4)    active-buckets: 1,234    tokens: 8,494,792,191    sort: span
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 below top cap
  (provider rolled up from normalised model id; spanHours = clock hours first->last across any model from this vendor; activeBuckets = distinct hour_start values touched)

  per-provider tenure (sorted by span desc)
  provider   first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  distinct-models  tokens         tok/bucket  tok/span-hr
  ---------  ------------------------  ------------------------  -------  --------------  ---------------  -------------  ----------  -----------
  anthropic  2025-07-30T06:00:00.000Z  2026-04-25T09:00:00.000Z  6459.0   535             7                5,966,464,260  11,152,270  923,744
  openai     2025-08-18T06:30:00.000Z  2026-04-25T09:00:00.000Z  6002.5   606             6                2,492,597,635  4,113,197   415,260
  google     2025-11-20T04:30:00.000Z  2026-03-05T06:00:00.000Z  2521.5   37              1                154,496        4,176       61
  unknown    2026-04-17T06:30:00.000Z  2026-04-24T15:00:00.000Z  176.5    56              1                35,575,800     635,282     201,563
  ```

  Headline: anthropic leads on tenure (6,459h ≈ 269 days) and
  token mass (5.97B), but openai narrowly leads on
  `active-buckets` (606 vs 535) — openai is *more frequently*
  touched even though anthropic has the longer continuous
  history and ~2.4× the cumulative tokens.

## 0.4.76 — 2026-04-25

### Added

- `bucket-handoff-frequency`: `--min-handoffs <n>` flag. Drop
  `(from -> to)` pair rows whose `count < n` from `pairs[]` *before*
  applying `--top-handoffs`. Display filter only — `handoffPairs`,
  `handoffShare`, `contiguousHandoffs`, and `gappedHandoffs` still
  reflect the full pre-filter population (consistent with how
  `--min-buckets` and similar floors behave across this CLI).
  Suppressed rows surface as `droppedBelowMinHandoffs`.

  Why: with the default 887-bucket workspace the long tail of
  one-shot handoff pairs (e.g. `claude-haiku -> gemini-3-pro` x1)
  pads the table and obscures the recurring routes. Composing
  `--min-handoffs 3 --top-handoffs 10` cleanly isolates handoff
  pairs that are an established workflow rather than a fluke.

  Order of operations is documented and tested:
  `min-handoffs` floor first (rows below the floor are
  `droppedBelowMinHandoffs`), then `top-handoffs` cap (rows
  trimmed here are `droppedBelowTopCap`). Default 1 = no-op,
  echoed as `minHandoffs: 1` in the report.

  4 new tests (1006 total, up from 1002): rejects bad
  `minHandoffs` (0, negative, fractional); floor hides low-count
  pairs and surfaces `droppedBelowMinHandoffs` while leaving
  `handoffPairs` / `handoffShare` untouched; default is 1 and
  echoed as such; floor is applied *before* the top cap so both
  drop-counters are honoured.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--min-handoffs 3`:

  ```
  pew-insights bucket-handoff-frequency
  as of: 2026-04-25T08:48:50.393Z    active-buckets: 887    pairs: 886    handoffs: 132 (14.9%)    minHandoffs: 3    topHandoffs: 10
  split: 32 contiguous pairs (5 handoffs), 854 gapped pairs (127 handoffs)
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 empty-model buckets, 19 below min-handoffs, 4 below top cap
  stickiest model: gpt-5.4 (primary in 204 of 887 buckets)
  (primary model per bucket = max-tokens model, ties broken lex; contiguous pair = exactly 1h apart; handoff = primary changed)

  top model handoffs (sorted by count desc)
  from-model                 to-model                   count  share-of-handoffs
  -------------------------  -------------------------  -----  -----------------
  claude-opus-4.7            gpt-5.4                    34     25.8%
  gpt-5.4                    claude-opus-4.7            34     25.8%
  claude-opus-4.6-1m         gpt-5.4                    6      4.5%
  gpt-5.4                    claude-opus-4.6-1m         5      3.8%
  claude-sonnet-4            gpt-5                      4      3.0%
  gpt-5                      claude-sonnet-4            4      3.0%
  claude-haiku-4-5-20251001  gemini-3-pro-preview       3      2.3%
  claude-opus-4-7            gpt-5.4                    3      2.3%
  claude-sonnet-4.5          gemini-3-pro-preview       3      2.3%
  gemini-3-pro-preview       claude-haiku-4-5-20251001  3      2.3%
  ```

  Reading: the `minHandoffs: 3` floor scrubs 19 noise pairs
  (each occurring 1-2 times) so the surviving 10 rows are
  workflows we'd actually call recurring. The `top-handoffs: 10`
  cap then trims 4 more `count == 3` rows that lost the
  lex tiebreak. The headline `claude-opus-4.7 <-> gpt-5.4` swap
  remains 51.6% of all handoffs even after both filters.

## 0.4.75 — 2026-04-25

### Added

- `bucket-handoff-frequency`: new subcommand. For each consecutive
  pair of active hour-buckets in `hour_start` ascending order,
  measure how often the bucket's *primary model* (the
  highest-token model in that bucket; ties broken lex on model
  name) changes. Reports `handoffPairs / consideredPairs` as
  `handoffShare`, splits pairs into `contiguousPairs` (exactly
  1h apart) vs `gappedPairs` (anything else), further splits
  `handoffPairs` into `contiguousHandoffs` / `gappedHandoffs`,
  surfaces the `stickiestModel` (most-frequent primary across
  buckets, tiebreak tokens desc, then name asc), and emits a
  capped `pairs[]` table of directed `(from -> to)` model
  handoffs sorted by count desc, then `from` asc, then `to` asc.

  Why orthogonal to existing subcommands:

  - `model-switching` measures intra-`session_key` model swaps;
    it never crosses bucket / session boundaries.
  - `transitions` keys session-to-session adjacency on `source` /
    `kind` / `project_ref` — model identity is not part of its
    key.
  - `model-mix-entropy` reports a global Shannon mix across
    buckets but says nothing about *order* — two corpora with
    identical entropy can have very different handoff cadences.

  Headline question: "across my active hours, how often does the
  model I'm primarily using change from one hour to the next, and
  what are the most common handoff pairs?"

  Flags: `--since <iso>`, `--until <iso>`, `--source <name>` (only
  rows from this source contribute; non-matching surface as
  `droppedSourceFilter`), `--top-handoffs <n>` (default 10; 0
  suppresses the table; trimmed rows surface as
  `droppedBelowTopCap`), `--json`. Determinism: pure builder,
  wall clock only via `opts.generatedAt`.

  14 new tests (1002 total, up from 988): rejects bad
  `topHandoffs` and bad `since` / `until`; empty queue → zero
  everything; single bucket → 0 pairs; same-primary buckets → 0
  handoffs; alternating models → all-pair handoffs with deterministic
  pair ordering; ties in bucket totals broken lex; contiguous vs
  gapped split; `top-handoffs` cap including 0; source filter;
  since/until window; drops zero-token / bad `hour_start`; empty
  model name surfaces `droppedEmptyModelBuckets`; stickiest model
  picks most-bucket primary with token tiebreak.

  Live smoke against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights bucket-handoff-frequency
  as of: 2026-04-25T08:46:03.553Z    active-buckets: 887    pairs: 886    handoffs: 132 (14.9%)    topHandoffs: 10
  split: 32 contiguous pairs (5 handoffs), 854 gapped pairs (127 handoffs)
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 empty-model buckets, 23 below top cap
  stickiest model: gpt-5.4 (primary in 204 of 887 buckets)
  (primary model per bucket = max-tokens model, ties broken lex; contiguous pair = exactly 1h apart; handoff = primary changed)

  top model handoffs (sorted by count desc)
  from-model                 to-model                   count  share-of-handoffs
  -------------------------  -------------------------  -----  -----------------
  claude-opus-4.7            gpt-5.4                    34     25.8%
  gpt-5.4                    claude-opus-4.7            34     25.8%
  claude-opus-4.6-1m         gpt-5.4                    6      4.5%
  gpt-5.4                    claude-opus-4.6-1m         5      3.8%
  claude-sonnet-4            gpt-5                      4      3.0%
  gpt-5                      claude-sonnet-4            4      3.0%
  claude-haiku-4-5-20251001  gemini-3-pro-preview       3      2.3%
  claude-opus-4-7            gpt-5.4                    3      2.3%
  claude-sonnet-4.5          gemini-3-pro-preview       3      2.3%
  gemini-3-pro-preview       claude-haiku-4-5-20251001  3      2.3%
  ```

  Reading: across 887 distinct active hour-buckets only 14.9% of
  consecutive-bucket pairs cross a primary-model boundary —
  long-running sticky model use dominates. But of the pairs that
  *are* handoffs, 51.6% are the symmetric `claude-opus-4.7
  <-> gpt-5.4` swap (34 + 34 of 132), confirming a routine
  bi-modal workflow between those two. Only 5 of 132 handoffs are
  contiguous (1h apart) — the vast majority happen across an idle
  gap, suggesting handoffs are session-boundary events, not
  in-flight model swaps.

## 0.4.74 — 2026-04-25

### Added

- `source-decay-half-life`: `--top <n>` flag. Cap the number of
  source rows emitted in `sources[]` after sorting and after the
  `--min-buckets` floor. Suppressed rows surface as
  `droppedBelowTopCap`. Display filter only — `totalSources`,
  `totalActiveBuckets`, and `totalTokens` still reflect the
  pre-cap surviving population (consistent with how `--min-buckets`
  and other floors behave across this CLI).

  Why: with the default `halflife` sort the table can grow long on
  workspaces with many low-volume sources. Composing
  `--min-buckets 50 --top 4 --sort frontload` cleanly isolates the
  most front-loaded routers that actually carry mass, without
  hand-grepping the table.

  Order of operations is documented and tested:
  `min-buckets` floor first (rows below the floor are
  `droppedSparseSources`), then sort, then `top` cap (rows trimmed
  here are `droppedBelowTopCap`). `top >= surviving count` is a
  no-op; missing flag is also a no-op (`top: null` echoed in the
  report).

  5 new tests (988 total, up from 983): rejects bad `top`
  (0, negative, fractional); cap trims after sort and surfaces
  `droppedBelowTopCap` (with `totalSources` reflecting pre-cap);
  composes with `--min-buckets` (floor first, cap second);
  `top >= surviving` is a no-op; default `top` is `null` and
  echoed as such.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--min-buckets 50 --top 4 --sort frontload`:

  ```
  pew-insights source-decay-half-life
  as of: 2026-04-25T08:09:08.268Z    sources: 6 (shown 4)    active-buckets: 1,318    tokens: 8,458,082,355    minBuckets: 50    top: 4    sort: frontload
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by model filter, 0 sparse sources, 2 below top cap
  (halfLifeFraction = clock-hours from firstSeen to the bucket where cumulative tokens >= 50% / spanHours; < 0.5 = front-loaded, > 0.5 = back-loaded; frontLoadIndex = 0.5 - halfLifeFraction)

  per-source token half-life (sorted by frontload)
  source          first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         half-life (UTC)           half-life-hr  half-life-frac  front-load-idx
  --------------  ------------------------  ------------------------  -------  --------------  -------------  ------------------------  ------------  --------------  --------------
  hermes          2026-04-17T06:30:00.000Z  2026-04-25T08:00:00.000Z  193.5    146             140,666,870    2026-04-20T06:30:00.000Z  72.0          0.372           +0.128
  vscode-ext      2025-07-30T06:00:00.000Z  2026-04-20T01:30:00.000Z  6331.5   320             1,885,727      2025-11-26T11:00:00.000Z  2861.0        0.452           +0.048
  opencode        2026-04-20T14:00:00.000Z  2026-04-25T08:00:00.000Z  114.0    176             2,411,109,047  2026-04-22T18:00:00.000Z  52.0          0.456           +0.044
  openclaw        2026-04-17T02:30:00.000Z  2026-04-25T07:30:00.000Z  197.0    345             1,652,410,263  2026-04-21T02:00:00.000Z  95.5          0.485           +0.015
  ```

  Headline read: with the cap at 4 and `--sort frontload`, the
  `+0.128` `hermes` row sits cleanly at the top — it is the most
  front-loaded current source by a margin (the next three cluster
  near the uniform line at +0.04 to +0.05). `codex` and
  `claude-code` (the two back-loaded sources from v0.4.73) are
  trimmed by the cap and surface only via the `2 below top cap`
  counter — useful when you want to see "who is decelerating" in
  isolation without the back-loaded noise.

## 0.4.73 — 2026-04-25

### Added

- New subcommand: `source-decay-half-life`. The temporal-shape
  complement to `source-tenure`. For every source, sort its
  active buckets in time order, walk the cumulative-token curve,
  and find the first bucket where the running sum reaches
  >= 50% of the source's total mass. Reports `firstSeen`,
  `lastSeen`, `spanHours`, `activeBuckets`, `tokens`,
  `halfLifeIso`, `halfLifeHours`, `halfLifeFraction`
  (= halfLifeHours / spanHours, in `[0, 1]`), and
  `frontLoadIndex` (= `0.5 - halfLifeFraction`).

  Reading: `halfLifeFraction < 0.5` -> front-loaded (most tokens
  landed early in the source's life — likely declining or one-shot
  experiment); `~ 0.5` -> uniform token-rate across tenure;
  `> 0.5` -> back-loaded (the source is still ramping up — recent
  half of tenure carries more than half the mass).

  Why a separate subcommand:
  - `source-tenure` reports first/last/span/active-buckets/tokens
    but treats tenure as one span — silent on *where in the span*
    the mass actually accrued.
  - `bucket-streak-length` measures contiguity, not where in the
    tenure window the mass landed.
  - `tail-share`, `provider-share`, `source-mix` are pure mass
    tallies with no tenure axis.
  - `idle-gaps` measures inactivity *gaps* between buckets — the
    complement on the time axis.

  Single-bucket sources collapse to `halfLifeFraction = 0`,
  `frontLoadIndex = +0.5` (all mass in the only bucket -> trivially
  "front-loaded" by definition; flagged via `activeBuckets = 1`).

  Flags: `--since`, `--until`, `--model` (restrict to a single
  model — non-matching rows surface as `droppedModelFilter`),
  `--min-buckets` (drop sparse sources, surfaced as
  `droppedSparseSources`), `--sort`
  (`halflife` default | `frontload` | `tokens` | `span` | `active`),
  `--json`. 18 new tests (983 total, up from 965): option
  validation (sort, minBuckets, since/until); empty queue;
  single-bucket source; front-loaded math; back-loaded math;
  uniform 25/25/25/25 case (halfLifeFraction = 1/3); default sort
  with token + lex tiebreak; `--sort tokens` ordering;
  `--sort frontload` orders most-front-loaded first;
  `--min-buckets` floor preserves global totals; `--model` filter;
  window clip; bad/zero-token row drops; duplicate-bucket
  accumulation; empty source name normalised to `unknown`; report
  echoes resolved options.

  Live smoke against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights source-decay-half-life
  as of: 2026-04-25T08:05:56.027Z    sources: 6 (shown 6)    active-buckets: 1,318    tokens: 8,458,082,355    minBuckets: 0    sort: halflife
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by model filter, 0 sparse sources
  (halfLifeFraction = clock-hours from firstSeen to the bucket where cumulative tokens >= 50% / spanHours; < 0.5 = front-loaded, > 0.5 = back-loaded; frontLoadIndex = 0.5 - halfLifeFraction)

  per-source token half-life (sorted by halflife)
  source          first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         half-life (UTC)           half-life-hr  half-life-frac  front-load-idx
  --------------  ------------------------  ------------------------  -------  --------------  -------------  ------------------------  ------------  --------------  --------------
  hermes          2026-04-17T06:30:00.000Z  2026-04-25T08:00:00.000Z  193.5    146             140,666,870    2026-04-20T06:30:00.000Z  72.0          0.372           +0.128
  vscode-ext      2025-07-30T06:00:00.000Z  2026-04-20T01:30:00.000Z  6331.5   320             1,885,727      2025-11-26T11:00:00.000Z  2861.0        0.452           +0.048
  opencode        2026-04-20T14:00:00.000Z  2026-04-25T08:00:00.000Z  114.0    176             2,411,109,047  2026-04-22T18:00:00.000Z  52.0          0.456           +0.044
  openclaw        2026-04-17T02:30:00.000Z  2026-04-25T07:30:00.000Z  197.0    345             1,652,410,263  2026-04-21T02:00:00.000Z  95.5          0.485           +0.015
  codex           2026-04-13T01:30:00.000Z  2026-04-20T16:30:00.000Z  183.0    64              809,624,660    2026-04-19T06:30:00.000Z  149.0         0.814           -0.314
  claude-code     2026-02-11T02:30:00.000Z  2026-04-23T14:30:00.000Z  1716.0   267             3,442,385,788  2026-04-18T17:00:00.000Z  1598.5        0.932           -0.432
  ```

  Headline read: the six active sources split cleanly into three
  shapes. `hermes` is the most front-loaded current source
  (halfLifeFraction = 0.372, +0.128 index) — half its mass landed
  in the first ~37% of its 8-day tenure, suggesting an early burst
  that has since tapered. `vscode-ext`, `opencode`, and `openclaw`
  sit near the uniform line (~0.45, +0.04 to +0.05) — flat token
  rate across their lifetimes. The two clear back-loaded sources
  are `codex` (0.814) and especially `claude-code` (0.932): for
  `claude-code`, half its 3.4B tokens landed in the *last 7%* of
  its 1,716-hour tenure — the source spent two months at low
  intensity then exploded recently. This is the kind of regime
  shift `source-tenure` cannot surface from first/last alone.

## 0.4.72 — 2026-04-25

### Added

- `bucket-streak-length`: `--sort <key>` flag. Choose how to
  order `models[]`: `length` (default; longestStreak desc),
  `tokens` (token mass desc), `active` (activeBuckets desc),
  `mean` (meanStreakLength desc — most-sustained first). All
  ties break on model key asc (lex). Composes with
  `--min-buckets`; floor still applies before sorting and
  `droppedSparseModels` counts the suppressed rows.

  Why: with the default `length` sort, a model with a single
  freak 300-bucket streak dominates the table even if its
  total mass is tiny. `--sort tokens` re-anchors the view on
  where the actual work happened. `--sort mean` is the cleanest
  proxy for "is this model used in sustained sessions or in
  one-off touches" — independent of total volume.

  5 new tests (965 total, up from 960): rejects bad sort;
  `--sort tokens` re-orders past longestStreak (high-mass model
  with shorter streak ranks first); `--sort active` orders by
  activeBuckets with lex tiebreak; `--sort mean` puts a
  marathon model (1 streak of 4) above a spiky one (4 streaks
  of 1) at the same active-bucket count; default sort is
  `length` and is echoed in the report.

  Live smoke against `~/.config/pew/queue.jsonl` with
  `--sort tokens --min-buckets 5`:

  ```
  pew-insights bucket-streak-length
  as of: 2026-04-25T07:27:42.324Z    models: 11 (shown 11)    active-buckets: 1,248    tokens: 8,445,982,893    bucket-width: 30m (inferred)    minBuckets: 5    sort: tokens
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 4 sparse models

  per-model bucket streaks (sorted by tokens desc)
  model                 active-buckets  streaks  longest  mean-streak  longest-start (UTC)       longest-end (UTC)         tokens
  --------------------  --------------  -------  -------  -----------  ------------------------  ------------------------  -------------
  claude-opus-4.7       278             41       68       6.78         2026-04-23T21:30:00.000Z  2026-04-25T07:00:00.000Z  4,730,615,064
  gpt-5.4               378             19       325      19.89        2026-04-18T13:00:00.000Z  2026-04-25T07:00:00.000Z  2,485,458,754
  claude-opus-4.6.1m    167             44       15       3.80         2026-04-15T05:00:00.000Z  2026-04-15T12:00:00.000Z  1,108,978,665
  claude-haiku-4.5      30              23       5        1.30         2026-03-18T05:00:00.000Z  2026-03-18T07:00:00.000Z  70,717,678
  unknown               56              4        49       14.00        2026-04-23T15:00:00.000Z  2026-04-24T15:00:00.000Z  35,575,800
  ```

  Headline read: re-sorting by token mass flips the leader from
  `gpt-5.4` (the marathon-streak champion at 325 contiguous
  buckets but ~2.5B tokens) to `claude-opus-4.7` (~4.7B tokens
  in 41 short streaks, longest only 68). The `length` sort
  identifies the most-sustained workloads; the `tokens` sort
  identifies where the bulk of the cost actually accrues — and
  on this data they are not the same model. The `--min-buckets 5`
  floor drops the four single-touch experiment models
  (`gpt-4.1`, `gpt-5-nano`, `gpt-5.2`, `claude-opus-4.6`).

## 0.4.71 — 2026-04-25

### Added

- `bucket-streak-length`: per-model lens for the longest run of
  consecutive-active buckets. Sorts active buckets per model on
  the time axis and breaks them into "streaks" — maximal runs
  where each step is exactly one bucket-width apart. Reports
  `activeBuckets`, `streakCount`, `longestStreak`,
  `meanStreakLength`, `longestStreakStart`/`End`, `tokens`.

  Bucket-width is inferred from the smallest positive inter-bucket
  gap across the filtered queue (typically 30m or 60m depending on
  what `pew` writes); test override via `bucketWidthMs`.

  Why a new lens: `model-tenure` collapses everything into one
  span — it cannot distinguish "200 active buckets in one
  marathon" from "200 isolated single-bucket touches".
  `burstiness` and `interarrival` describe gap *distributions*
  but never surface the longest sustained run as a single number.
  `idle-gaps` is the complement (inactivity) view.

  Flags: `--since`, `--until`, `--source`, `--min-buckets`,
  `--json`. 14 new tests (960 total, up from 946): option
  validation; empty/single-bucket; contiguous streak; gap split;
  multi-model sort + lex tiebreak; window clip; source filter;
  minBuckets floor preserves global totals; bad/zero-token row
  drops; duplicate-bucket token accumulation; bucket-width
  inference at 30m.

  Live smoke against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights bucket-streak-length
  as of: 2026-04-25T07:25:29.006Z    models: 15 (shown 15)    active-buckets: 1,248    tokens: 8,445,982,893    bucket-width: 30m (inferred)    minBuckets: 0
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 sparse models
  (streak = maximal run of consecutive active buckets where each step is exactly bucketWidth apart; longestStreak is per-model)

  per-model bucket streaks (sorted by longestStreak desc)
  model                 active-buckets  streaks  longest  mean-streak  longest-start (UTC)       longest-end (UTC)         tokens
  --------------------  --------------  -------  -------  -----------  ------------------------  ------------------------  -------------
  gpt-5.4               378             19       325      19.89        2026-04-18T13:00:00.000Z  2026-04-25T07:00:00.000Z  2,485,458,754
  claude-opus-4.7       278             41       68       6.78         2026-04-23T21:30:00.000Z  2026-04-25T07:00:00.000Z  4,730,615,064
  unknown               56              4        49       14.00        2026-04-23T15:00:00.000Z  2026-04-24T15:00:00.000Z  35,575,800
  claude-opus-4.6.1m    167             44       15       3.80         2026-04-15T05:00:00.000Z  2026-04-15T12:00:00.000Z  1,108,978,665
  gpt-5                 170             62       15       2.74         2025-09-18T01:30:00.000Z  2025-09-18T08:30:00.000Z  850,661
  gemini-3-pro-preview  37              21       7        1.76         2026-01-26T06:00:00.000Z  2026-01-26T09:00:00.000Z  154,496
  claude-haiku-4.5      30              23       5        1.30         2026-03-18T05:00:00.000Z  2026-03-18T07:00:00.000Z  70,717,678
  claude-sonnet-4.5     37              22       5        1.68         2026-02-05T07:30:00.000Z  2026-02-05T09:30:00.000Z  105,382
  ```

  Headline read: `gpt-5.4` is the marathon model — 325-bucket
  longest streak (~163 contiguous half-hours, ~6.8 days) and a
  mean streak length of ~20, far above any other model. Compare
  `claude-opus-4.7` at 278 active buckets but split across 41
  streaks (longest 68, mean 6.8) — same scale of usage,
  fundamentally spikier shape. The long-tail models
  (`gpt-4.1`, `gpt-5-nano`, `gpt-5.2`) are pure single-touch
  experiments.

## 0.4.70 — 2026-04-25

### Added

- `source-tenure`: `--min-models <n>` flag. Drop sources whose
  `distinctModels < n` from `sources[]`. Display filter only —
  global denominators (`totalSources`, `totalActiveBuckets`,
  `totalTokens`) still reflect the full population. Suppressed
  rows surface as `droppedNarrowSources`.

  Composes with `--min-buckets` (sparse-source floor evaluated
  first) and `--top` (cap applied after both floors). Useful for
  isolating the "router" sources — channels that actually
  multi-route across model variants — and excluding fixed
  single-model channels which trivially score `distinctModels=1`.

  4 new tests (946 total, up from 942): rejects bad minModels;
  minModels floor hides single-model sources while preserving
  totals; minBuckets and minModels compose (sparse-narrow,
  dense-narrow both dropped, dense-wide kept); minModels=0
  default is a no-op.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--min-models 3 --sort models`:

  ```
  pew-insights source-tenure
  as of: 2026-04-25T06:42:41Z    sources: 4 (shown 4)    active-buckets: 1,312    tokens: 8,428,164,410    minBuckets: 0    minModels: 3    sort: models
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by model filter, 0 sparse sources, 2 narrow sources (< minModels), 0 below top cap

  per-source tenure (sorted by models desc)
  source       first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         tok/bucket  tok/span-hr  models
  -----------  ------------------------  ------------------------  -------  --------------  -------------  ----------  -----------  ------
  vscode-ext   2025-07-30T06:00:00.000Z  2026-04-20T01:30:00.000Z  6331.5   320             1,885,727      5,893       298          9
  opencode     2026-04-20T14:00:00.000Z  2026-04-25T06:30:00.000Z  112.5    173             2,386,318,461  13,793,748  21,211,720   6
  claude-code  2026-02-11T02:30:00.000Z  2026-04-23T14:30:00.000Z  1716.0   267             3,442,385,788  12,892,831  2,006,052    4
  hermes       2026-04-17T06:30:00.000Z  2026-04-25T05:30:00.000Z  191.0    145             140,424,600    968,446     735,207      3
  ```

  Headline read: filtering to `distinctModels >= 3` drops two
  single-model sources (`openclaw`, `codex` — both pinned to
  one model variant) and surfaces the four real multi-model
  routers. `vscode-ext` routes through 9 distinct models (the
  most diverse) but at near-zero density; `opencode` is the
  highest-density multi-router at ~21M tokens/span-hr across
  6 models.

## 0.4.69 — 2026-04-25

### Added

- New subcommand: `source-tenure`. The source-axis analog of
  `model-tenure`: for every `source` (the upstream agent CLI /
  channel that emitted the row — `claude-code`, `opencode`,
  `codex`, `hermes`, etc.) compute the active-span profile:
  - `firstSeen` / `lastSeen`: ISO of first and last active bucket.
  - `spanHours`: clock hours first→last (may be fractional, 0 for
    a single-bucket source).
  - `activeBuckets`: distinct `hour_start` values.
  - `tokens`: sum of `total_tokens`.
  - `tokensPerActiveBucket`, `tokensPerSpanHour`: mean intensity
    per touched bucket and per clock-hour of tenure.
  - `distinctModels`: number of unique normalised models routed
    through this source over its tenure — answers "how
    multi-model is this CLI?", which `model-tenure` cannot
    surface from per-model rows because the same `hour_start`
    is double-counted across models.

  Why a separate subcommand:
  - `model-tenure` is per-model; aggregating its rows by hand to
    the source level double-counts hour buckets.
  - `source-mix` and `provider-share` are mass tallies — no
    firstSeen / lastSeen / span axis at all.
  - `tail-share` reports per-source Pareto/Gini concentration
    across buckets — magnitude *distribution*, not temporal extent.

  Options: `--since`, `--until`, `--model` (restrict to a single
  normalised model; non-matching rows surface as
  `droppedModelFilter`), `--sort` (`span` default, `active`,
  `tokens`, `density`, `models`), `--json`.

  19 new tests (942 total, up from 923): option validation,
  empty input, multi-bucket span/density math, single-bucket
  spanHours=0 with finite density, distinctModels per source,
  empty source string → "unknown", invalid-hour and zero-token
  drops, model filter accounting, sort by tokens / span /
  models, top cap with totals reflecting full population,
  since/until windowing, lex tiebreak.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights source-tenure
  as of: 2026-04-25T06:40:29Z    sources: 6 (shown 6)    active-buckets: 1,311    tokens: 8,423,677,351    minBuckets: 0    sort: span
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by model filter, 0 sparse sources, 0 below top cap

  per-source tenure (sorted by span desc)
  source       first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         tok/bucket  tok/span-hr  models
  -----------  ------------------------  ------------------------  -------  --------------  -------------  ----------  -----------  ------
  vscode-ext   2025-07-30T06:00:00.000Z  2026-04-20T01:30:00.000Z  6331.5   320             1,885,727      5,893       298          9
  claude-code  2026-02-11T02:30:00.000Z  2026-04-23T14:30:00.000Z  1716.0   267             3,442,385,788  12,892,831  2,006,052    4
  openclaw     2026-04-17T02:30:00.000Z  2026-04-25T06:00:00.000Z  195.5    342             1,647,386,404  4,816,919   8,426,529    1
  hermes       2026-04-17T06:30:00.000Z  2026-04-25T05:30:00.000Z  191.0    145             140,424,600    968,446     735,207      3
  codex        2026-04-13T01:30:00.000Z  2026-04-20T16:30:00.000Z  183.0    64              809,624,660    12,650,385  4,424,178    1
  opencode     2026-04-20T14:00:00.000Z  2026-04-25T06:30:00.000Z  112.5    173             2,381,970,172  13,768,614  21,173,068   6
  ```

  Headline read: `vscode-ext` has by far the longest tenure
  (~6332h ≈ 264 days) but the *lowest* density at 298
  tokens/span-hr — it's a long-tail keepalive channel, not a
  workhorse. The actual workhorse on a per-clock-hour basis is
  `opencode` at ~21M tokens/span-hr (70× denser than `vscode-ext`,
  10× denser than `claude-code`), despite a tenure under 5 days.
  `claude-code` and `opencode` both route through 4–6 distinct
  models; `openclaw` and `codex` are single-model sources.

## 0.4.68 — 2026-04-25

### Added

- `tenure-vs-density-quadrant`: `--quadrant <q>` flag. Restrict the
  report to a single quadrant: `long-dense` | `long-sparse` |
  `short-dense` | `short-sparse`. Medians are still computed over the
  *full* surviving population, so the filter does not change which
  models land in which quadrant — it only suppresses the other three
  quadrants for display. Suppressed quadrants surface as
  `droppedQuadrantModels` and `droppedQuadrantTokens` (aggregates over
  the hidden quadrants).

  Composes with `--top` (cap inside the surviving quadrant) and
  `--sort` (re-order within the surviving quadrant).

  7 new tests (923 total, up from 916): filter restricts to one
  quadrant; medians/classification unaffected by filter;
  droppedQuadrantModels/Tokens accounting; invalid quadrant name
  rejected; null filter leaves all four quadrants visible;
  composes with --top; targeting a quadrant that turned out empty
  still returns it with count=0.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--quadrant short-dense --top 3 --sort density`:

  ```
  pew-insights tenure-vs-density-quadrant
  as of: 2026-04-25T06:08:15Z    models: 15    active-buckets: 1,243    tokens: 8,409,584,829    minBuckets: 0    sort: density
  splits: medianSpanHours=1044.00    medianDensity=109646    (>= medianSpanHours -> long; >= medianDensity -> dense; ties go long/dense)
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 sparse models (0 buckets), 10 models in suppressed quadrants (1,193,924,024 tokens)
  quadrant filter: short-dense

  quadrant summary
  quadrant     models  tokens         active-buckets
  -----------  ------  -------------  --------------
  short-dense  5       7,215,660,805  709

  short-dense (shown 3 of 5; 2 below top cap)
  model            span-hr  active-buckets  tokens         density
  ---------------  -------  --------------  -------------  ----------
  claude-opus-4.7  196.0    276             4,700,643,866  17,031,318
  gpt-5.4          859.5    375             2,479,031,888  6,610,752
  unknown          176.5    56              35,575,800     635,282
  ```

  Headline read: filtering to short-dense + sorting by density
  isolates the burst-style heavy hitters — claude-opus-4.7 dominates
  at 17M tokens / active-bucket over a ~196h tenure, dwarfing every
  other model in the short-tenure half by ~2.6x.

## 0.4.67 — 2026-04-25

### Added

- New subcommand: `tenure-vs-density-quadrant`. Classifies each model
  into a 2×2 quadrant by `(long/short tenure × dense/sparse density)`,
  where the splits are the global medians of the surviving population.
  - `tenure` = clock hours from each model's firstSeen to lastSeen.
  - `density` = total tokens / activeBuckets (mean per-bucket mass).
  - Splits: `>= medianSpanHours` → long, `>= medianDensity` → dense
    (ties go long/dense). Even-N median is the arithmetic mean of the
    two middle values.
  - Output is the four quadrants in fixed order (long-dense,
    long-sparse, short-dense, short-sparse) with per-quadrant
    `count`, `tokens`, `activeBuckets`, and the model rows that
    landed there.

  Why a separate subcommand:
  - `model-tenure` reports each model's span/active-buckets/tokens
    individually but never *classifies* models into a population-relative
    grid. The quadrant assignment is the new artifact here.
  - `bucket-intensity` reports per-bucket magnitude distributions per
    model — no tenure axis, no cross-model classification.
  - `model-mix-entropy` collapses model usage into a single concentration
    scalar per window — not per-model and not bivariate.
  - `tail-share` is a per-source Pareto over buckets — sources, not
    models, and no tenure axis.

  13 new tests (916 total, up from 903): option validation; empty
  queue; drop counters (zero-tokens, bad hour_start, source filter);
  4-model fixture splitting cleanly into 4 quadrants by medians;
  per-row tokens/activeBuckets/density correctness; tie-break rule
  (>=) puts ties in long/dense; minBuckets floor excludes sparse
  models from medians; top cap truncates per-quadrant lists with
  droppedTop accounting; sort=span ordering; window since/until
  filtering; determinism; option echoing.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights tenure-vs-density-quadrant
  as of: 2026-04-25T06:05:41Z    models: 15    active-buckets: 1,243    tokens: 8,405,330,484    minBuckets: 0    sort: tokens
  splits: medianSpanHours=1044.00    medianDensity=109646    (>= medianSpanHours -> long; >= medianDensity -> dense; ties go long/dense)
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 sparse models (0 buckets)

  quadrant summary
  quadrant      models  tokens         active-buckets
  ------------  ------  -------------  --------------
  long-dense    3       1,192,297,888  206
  long-sparse   5       1,275,224      323
  short-dense   5       7,211,406,460  709
  short-sparse  2       350,912        5
  ```

  Headline read: short-dense holds 86% of tokens (claude-opus-4.7 +
  gpt-5.4 are the heavy hitters), while long-sparse holds 5 long-lived
  models contributing only ~0.015% of tokens — they're persistent
  background presences, not workload drivers.

## 0.4.66 — 2026-04-25

### Added

- `tail-share`: `--min-buckets <n>` and `--top <n>` flags.
  - `--min-buckets <n>` (default 0 = no floor): drop sources whose
    bucketCount < n. Suppressed rows surface as
    `droppedSparseSources` (with `droppedSparseBuckets` reporting
    how many underlying buckets were lost). Totals reflect the
    *kept* population, not the full pre-filter set — sparse-source
    tokens are excluded from `totalTokens` / `totalBuckets`.
  - `--top <n>` (default 0 = no cap): truncate `sources[]` to the
    top n rows after sorting by giniLike desc. Display filter only —
    `totalSources`, `totalBuckets`, and `totalTokens` always reflect
    the *full surviving population* (post-minBuckets, pre-cap).
    Suppressed rows surface as `droppedTopSources`. The cap is
    echoed in the report as `top`.

  Use case: `--min-buckets 100` filters out one-off / experimental
  sources that haven't accumulated enough history for the Pareto
  read to be meaningful, and `--top 4` keeps the table to the
  loudest concentration outliers.

  3 new tests (903 total, up from 900): rejects bad top;
  --min-buckets drops sparse sources and totals reflect kept
  population; --top caps display rows while totals stay
  full-population and droppedTopSources surfaces remainder.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--min-buckets 100 --top 4`:

  ```
  pew-insights tail-share
  as of: 2026-04-25T05:42:44.071Z    sources: 5 (shown 4)    buckets: 1,243    tokens: 7,581,839,548    minBuckets: 100
  dropped: 0 bad hour_start, 0 zero-tokens, 1 sparse sources (64 buckets), 1 below top cap

  per-source token concentration (sorted by giniLike desc)
  source       buckets  tokens         top1%  top5%  top10%  top20%  giniLike
  -----------  -------  -------------  -----  -----  ------  ------  --------
  vscode-ext   320      1,885,727      26.1%  44.2%  56.4%   71.1%   0.444
  claude-code  267      3,442,385,788  8.0%   26.9%  44.9%   70.3%   0.312
  opencode     171      2,353,488,517  5.7%   22.9%  41.8%   64.8%   0.269
  openclaw     341      1,643,847,322  9.2%   24.0%  35.0%   51.0%   0.227
  ```

  Filtering at minBuckets=100 dropped one source (`codex`-like,
  64 buckets, ~810M tokens) below the floor; the top cap then
  hid `hermes` (the flattest survivor at giniLike 0.219).
  Headline read is unchanged from v0.4.65: the small-volume
  editor source dominates the concentration ranking, and the
  large CLI sources land in the long-tailed-but-peaky 0.27–0.31
  band.

## 0.4.65 — 2026-04-25

### Added

- `tail-share`: per-source Pareto / token-mass concentration lens.

  For each source, collects every (hour_start) bucket that produced
  positive `total_tokens` (collapsing across models within the same
  hour), sorts buckets by token count desc, and reports what fraction
  of the source's total tokens lives in the heaviest 1%, 5%, 10%, and
  20% of buckets — i.e. the Pareto check. Also emits a coarse
  `giniLike` scalar in `[0, 1]`: 0 = uniform, →1 = one bucket holds
  all the mass. The scalar is a uniform-baseline-corrected mean of
  the four shares, so it stays meaningful at all bucket counts.

  Distinct from `bucket-intensity` (per-bucket distribution shape:
  mean/p50/p95/max), `peak-hour-share` (clock-hour concentration, not
  bucket concentration), `burstiness` (CoV — conflates "many small +
  one big" with "wildly variable"), and `model-mix-entropy` (model
  concentration, not bucket concentration).

  10 new tests (900 total, up from 890): rejects bad
  since/until/minBuckets; empty queue zeros; drops zero-token rows
  and bad hour_start; single-bucket source has top1=...=top20=1.0
  and giniLike=0 (degenerate); uniform 100-bucket source has
  top10≈10% and giniLike≈0; heavily skewed source gets
  top1≈99% and giniLike>0.9; multi-source sort by giniLike desc with
  source-name tiebreak; window filter excludes out-of-range buckets;
  multi-model in same hour collapses to one bucket per source;
  empty source string normalises to `unknown`.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights tail-share
  as of: 2026-04-25T05:40:20.274Z    sources: 6    buckets: 1,305    tokens: 8,387,867,906    minBuckets: 0
  dropped: 0 bad hour_start, 0 zero-tokens, 0 sparse sources (0 buckets)

  per-source token concentration (sorted by giniLike desc)
  source       buckets  tokens         top1%  top5%  top10%  top20%  giniLike
  -----------  -------  -------------  -----  -----  ------  ------  --------
  vscode-ext   320      1,885,727      26.1%  44.2%  56.4%   71.1%   0.444
  claude-code  267      3,442,385,788  8.0%   26.9%  44.9%   70.3%   0.312
  opencode     170      2,350,021,635  5.7%   22.9%  39.9%   64.1%   0.265
  codex        64       809,624,660    7.3%   25.1%  38.7%   58.5%   0.251
  openclaw     340      1,643,717,902  9.2%   23.3%  34.4%   50.6%   0.224
  hermes       144      140,232,194    7.2%   21.4%  34.0%   54.1%   0.219
  ```

  Headline read: the small-volume editor source (`vscode-ext`,
  ~1.9M tokens across 320 buckets) is the most concentrated
  (giniLike 0.444) — most of its bytes ride in a handful of heavy
  hours. The large-volume CLI sources (`claude-code`, `opencode`,
  `codex`) all land in the 0.25–0.31 band: long-tailed but with
  clear daily peaks (top 10% of hours = ~40% of mass). `openclaw`
  and `hermes` are flattest (giniLike ~0.22), consistent with
  steady background traffic rather than heavy-burst usage.

## 0.4.64 — 2026-04-25

### Added

- `model-tenure`: `--top <n>` and `--sort <key>` flags.
  - `--top <n>` (default 0 = no cap): truncates `models[]` to the
    top n rows after sorting. Display filter only —
    `totalModels`, `totalActiveBuckets`, and `totalTokens`
    always reflect the *full* population (pre-cap). Suppressed
    rows surface as `droppedTopModels`. The cap is echoed in
    the report as `top`.
  - `--sort <key>` (default `span`): sort key for `models[]`.
    Choices: `span` (spanHours desc), `active` (activeBuckets
    desc), `tokens` (tokens desc), `density` (tokensPerSpanHour
    desc). Tiebreak is always model name asc. The key is echoed
    as `sort`.

  Distinct from `bucket-intensity --sort spread`: this lens
  ranks by *lifetime properties* (span, total active touches,
  total mass, average density across the whole tenure), not by
  per-bucket distribution shape.

  6 new tests (890 total, up from 884): rejects bad top; rejects
  bad sort; top cap drops to `droppedTopModels` and totals stay
  full-population; sort=tokens orders by tokens desc; sort=
  density orders by tokensPerSpanHour desc; sort=active orders
  by activeBuckets desc.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--sort density --top 5`:

  ```
  pew-insights model-tenure
  as of: 2026-04-25T04:48:27.581Z    models: 15 (shown 5)    active-buckets: 1,238    tokens: 8,369,923,336    sort: density
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 10 below top cap

  per-model tenure (sorted by density desc)
  model               first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         tok/bucket  tok/span-hr
  ------------------  ------------------------  ------------------------  -------  --------------  -------------  ----------  -----------
  claude-opus-4.7     2026-04-17T02:00:00.000Z  2026-04-25T04:30:00.000Z  194.5    273             4,665,063,916  17,088,146  23,984,904
  gpt-5.4             2026-03-20T10:00:00.000Z  2026-04-25T04:30:00.000Z  858.5    373             2,474,950,345  6,635,256   2,882,878
  claude-opus-4.6.1m  2026-03-04T14:00:00.000Z  2026-04-17T02:00:00.000Z  1044.0   167             1,108,978,665  6,640,591   1,062,240
  gpt-5.2             2026-04-23T02:30:00.000Z  2026-04-23T02:30:00.000Z  0.0      1               299,605        299,605     299,605
  unknown             2026-04-17T06:30:00.000Z  2026-04-24T15:00:00.000Z  176.5    56              35,575,800     635,282     201,563
  ```

  Headline: `claude-opus-4.7` is the densest model by an order
  of magnitude (24M tok/span-hr), and a single-bucket model
  (`gpt-5.2`, 299,605 tokens in one bucket) outranks several
  long-tenure low-density models because the 1-hour floor on
  `tokensPerSpanHour` makes a fat single bucket competitive
  against thinly-spread tenure.

## 0.4.63 — 2026-04-25

### Added

- `model-tenure`: per-model active-span lens. For each model
  computes `firstSeen`, `lastSeen`, `spanHours` (clock hours
  first→last, may be fractional), `activeBuckets` (distinct
  `hour_start` values), `tokens`, `tokensPerActiveBucket`, and
  `tokensPerSpanHour` (with a 1-hour floor for single-bucket
  models).

  Distinct from existing lenses:
    - `model-mix-entropy` is a single concentration scalar per
      window — does not surface per-model first/last seen or span.
    - `model-cohabitation` reports co-presence of *pairs* of
      models in the same hour, not lifetime span of any one model.
    - `agent-mix` / `provider-share` / `cost` are window-mass
      tallies — a one-day burst and a 30-day continuous run with
      the same total volume look identical.
    - `bucket-intensity` reports per-bucket *magnitude*
      distribution per model — never surfaces firstSeen,
      lastSeen, or span.
    - `interarrival-time` reports gaps *between* active buckets
      per model but does not anchor to firstSeen/lastSeen and
      does not yield a tenure span.

  Honest about bucket granularity: `hour_start` values from pew
  may be sub-hourly (real data shows `:00` and `:30` both
  present). `model-tenure` does not assume any fixed bucket
  width — it counts distinct timestamp strings as
  `activeBuckets` and measures the clock span in hours as
  `spanHours`. This means `activeBuckets` can exceed `spanHours`
  on dense workloads (multiple sub-hour buckets per clock hour);
  the test `half-hour hour_start values are distinct active
  buckets` pins this behaviour.

  10 new tests (884 total, up from 874): rejects bad since/until;
  empty queue; drops zero-token + bad hour_start rows;
  single-bucket model has spanHours == 0 and tok/span-hr uses
  the 1h floor; spanHours is fractional with no inclusive +1;
  multi-model sort by spanHours desc with model asc tiebreak;
  multi-device same-hour rows count as one active bucket;
  half-hour buckets are distinct (and activeBuckets > spanHours
  is allowed); source filter excludes non-matching rows; since/
  until windowing trims firstSeen/lastSeen.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights model-tenure
  as of: 2026-04-25T04:46:04.285Z    models: 15    active-buckets: 1,238    tokens: 8,369,923,336
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter

  per-model tenure (sorted by spanHours desc)
  model                 first-seen (UTC)          last-seen (UTC)           span-hr  active-buckets  tokens         tok/bucket  tok/span-hr
  --------------------  ------------------------  ------------------------  -------  --------------  -------------  ----------  -----------
  claude-sonnet-4.5     2025-10-09T09:00:00.000Z  2026-02-05T09:30:00.000Z  2856.5   37              105,382        2,848       37
  gemini-3-pro-preview  2025-11-20T04:30:00.000Z  2026-03-05T06:00:00.000Z  2521.5   37              154,496        4,176       61
  gpt-5                 2025-08-18T06:30:00.000Z  2025-11-26T11:30:00.000Z  2405.0   170             850,661        5,004       354
  claude-sonnet-4       2025-07-30T06:00:00.000Z  2025-10-11T08:30:00.000Z  1754.5   26              53,062         2,041       30
  claude-haiku-4.5      2026-02-11T02:30:00.000Z  2026-04-21T01:00:00.000Z  1654.5   30              70,717,678     2,357,256   42,743
  gpt-5.1               2025-11-20T07:00:00.000Z  2026-01-27T09:00:00.000Z  1634.0   53              111,623        2,106       68
  claude-sonnet-4.6     2026-02-25T06:30:00.000Z  2026-04-23T04:00:00.000Z  1365.5   9               12,601,545     1,400,172   9,229
  claude-opus-4.6.1m    2026-03-04T14:00:00.000Z  2026-04-17T02:00:00.000Z  1044.0   167             1,108,978,665  6,640,591   1,062,240
  gpt-5.4               2026-03-20T10:00:00.000Z  2026-04-25T04:30:00.000Z  858.5    373             2,474,950,345  6,635,256   2,882,878
  claude-opus-4.6       2026-03-05T06:30:00.000Z  2026-03-20T10:00:00.000Z  363.5    4               350,840        87,710      965
  claude-opus-4.7       2026-04-17T02:00:00.000Z  2026-04-25T04:30:00.000Z  194.5    273             4,665,063,916  17,088,146  23,984,904
  unknown               2026-04-17T06:30:00.000Z  2026-04-24T15:00:00.000Z  176.5    56              35,575,800     635,282     201,563
  gpt-4.1               2025-08-22T03:00:00.000Z  2025-08-22T03:00:00.000Z  0.0      1               72             72          72
  gpt-5-nano            2026-04-23T08:30:00.000Z  2026-04-23T08:30:00.000Z  0.0      1               109,646        109,646     109,646
  gpt-5.2               2026-04-23T02:30:00.000Z  2026-04-23T02:30:00.000Z  0.0      1               299,605        299,605     299,605
  ```

  Headline insight on real data: `gpt-5.4` is the workhorse —
  858.5 clock hours span, 373 active buckets, 2.88M tok/span-hr;
  `claude-opus-4.7` is the new dominant model (194.5h span but
  24M tok/span-hr — densest by an order of magnitude). Three
  one-shot models (`gpt-4.1`, `gpt-5-nano`, `gpt-5.2`) are
  visible as `spanHours == 0` rows.

## 0.4.62 — 2026-04-25

### Added

- `bucket-intensity`: `--bucket-tokens-min <n>` flag (default 0
  = no filter). Noise-floor: drops individual `(model, hour)`
  bucket observations whose summed `total_tokens < n`, *after*
  multi-device aggregation within that hour. Counts surface as
  `droppedBucketTokensMin`. The threshold is echoed in the
  report as `bucketTokensMin`.

  Distinct from `--min-buckets`:
    - `--min-buckets` is a per-model display filter on the
      *count* of buckets — does not change percentiles, totals,
      or any kept row's data.
    - `--bucket-tokens-min` is a per-observation aggregation
      filter on each bucket's *magnitude*. It alters
      `totalBuckets`, `totalTokens`, and every percentile of
      every surviving model row, and can remove a model
      entirely from `models[]` if all its buckets fall below
      the threshold.

  5 new tests (874 total, up from 869): rejects bad input;
  end-to-end shape with one model fully filtered out and another
  unchanged, asserting the surviving model's percentiles are
  byte-identical to the unfiltered baseline; partial filter on a
  single model rewrites min/max correctly; threshold echoes
  through `bucketTokensMin`; composes with `--source` (source
  filter applied first, threshold second).

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--sort spread --bucket-tokens-min 10000 --min-buckets 5 --top 6`:

  ```
  pew-insights bucket-intensity
  as of: 2026-04-25T04:23:30.929Z    models: 14 (shown 6)    buckets: 943    tokens: 8,350,085,001    sort: spread
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 293 below bucket-tokens-min, 7 below min-buckets, 1 below top cap

  per-model bucket-size summary (sorted by spread desc)
  model               buckets  tokens         min      p50        p90         p99         max          mean      spread
  ------------------  -------  -------------  -------  ---------  ----------  ----------  -----------  --------  ------
  unknown             56       35,575,800     55,502   400,731    628,897     8,368,144   8,368,144    635282    20.88
  claude-opus-4.6.1m  166      1,108,972,689  17,659   3,244,687  16,660,674  51,557,347  55,962,051   6680558   15.89
  gpt-5.4             371      2,473,826,947  47,317   3,780,578  14,625,762  46,466,936  65,604,896   6667997   12.29
  claude-opus-4.7     272      4,647,097,376  37,358   7,897,263  50,695,274  79,856,882  108,008,474  17084917  10.11
  claude-sonnet-4.6   9        12,601,545     352,886  704,086    3,938,865   3,938,865   3,938,865    1400172   5.59
  claude-haiku-4.5    30       70,717,678     77,986   1,937,478  5,637,974   7,814,903   7,814,903    2357256   4.03

  per-model bucket-size histogram (counts per token-magnitude band)
  model               [1,1k)  [1k,10k)  [10k,100k)  [100k,1M)  [1M,10M)  [10M,+inf)
  ------------------  ------  --------  ----------  ---------  --------  ----------
  unknown             0       0         1           52         3         0
  claude-opus-4.6.1m  0       0         10          33         88        35
  gpt-5.4             0       0         2           41         267       61
  claude-opus-4.7     0       0         10          36         111       115
  claude-sonnet-4.6   0       0         0           6          3         0
  claude-haiku-4.5    0       0         1           8          21        0
  ```

  Headline: a 10k-token noise floor strips **293 of 1,236**
  total buckets (24%) but only **754k of 8.35B** tokens
  (0.009% of mass) — the dropped buckets are pure spectator
  pings. Compared with v0.4.61's smoke run, the spread
  ranking re-orders cleanly: `claude-sonnet-4` (was 19.55)
  and `gpt-5.1` (was 14.46) — both pure noise-floor models —
  vanish from `models[]` entirely, and `gpt-5.4`'s p50 lifts
  from 3.71M to 3.78M while its spread drops from 12.54 to
  12.29 (one fewer micro-bucket pulling the median down).
  This is exactly the right denoising behaviour: keep the
  asymmetry signal, drop the `[1,1k)` and `[1k,10k)`
  histogram bands.

## 0.4.61 — 2026-04-25

### Added

- `bucket-intensity`: per-model distribution of `total_tokens`
  per UTC `hour_start` bucket. For every (model, hour) pair with
  positive token mass we record one observation — the bucket's
  total token count — then report per-model `min`, `p50`, `p90`,
  `p99`, `max`, `mean`, `spread = p99/p50`, and a fixed-edge
  magnitude histogram over `[1, 1k, 10k, 100k, 1M, 10M, +inf)`.

  Distinct from existing tools:
    - `velocity` collapses contiguous active hours into stretches
      and reports tokens/minute over the stretch — bucket-intensity
      stays at the single-hour grain so a 4-hour sprint is 4
      observations, not one rate.
    - `agent-mix`, `provider-share`, `cost`, `model-mix-entropy`
      are mass tallies / single-scalar concentration metrics.
      They cannot tell a model with one giant 5M-token hour from
      a model with 50 hours of 100k each — but those two have a
      50× p99 ratio.
    - `burstiness` is a single concentration scalar across all
      buckets, not broken out per-model and not surfacing
      percentile bands.
    - `interarrival-time` measures *time between* active buckets,
      not *magnitude inside* a bucket.

  bucket-intensity is the per-model "how big is a typical hour
  vs your heaviest hour" lens.

  Pure deterministic builder. Percentiles use nearest-rank (R-1)
  to match `interarrival-time` and `velocity`. Flags: `--since`,
  `--until`, `--source`, `--min-buckets`, `--top`,
  `--sort tokens|buckets|p99|spread`, `--json`.

  14 new tests (869 total, up from 855): option validation,
  empty/edge handling, zero-token + bad hour_start drops,
  same-model+hour multi-device collapse into one observation,
  R-1 percentile semantics on a synthetic 10-bucket sequence,
  exact histogram bucketing across all 6 magnitude bands,
  per-model isolation, source filter accounting, sort=spread
  surfaces tail-heavy models above flat ones, minBuckets+top
  composition with full-population totals, and window
  filter applied before bucketing.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--sort spread --min-buckets 5 --top 6`:

  ```
  pew-insights bucket-intensity
  as of: 2026-04-25T04:20:40.569Z    models: 15 (shown 6)    buckets: 1,236    tokens: 8,350,838,579    sort: spread
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 4 below min-buckets, 5 below top cap

  per-model bucket-size summary (sorted by spread desc)
  model               buckets  tokens         min     p50        p90         p99         max          mean      spread
  ------------------  -------  -------------  ------  ---------  ----------  ----------  -----------  --------  ------
  unknown             56       35,575,800     55,502  400,731    628,897     8,368,144   8,368,144    635282    20.88
  claude-sonnet-4     26       53,062         20      871        3,346       17,028      17,028       2041      19.55
  claude-opus-4.6.1m  167      1,108,978,665  5,976   3,244,687  16,660,674  51,557,347  55,962,051   6640591   15.89
  gpt-5.1             53       111,623        92      1,178      5,464       17,031      17,031       2106      14.46
  gpt-5.4             372      2,473,832,128  5,181   3,706,295  14,625,762  46,466,936  65,604,896   6650086   12.54
  claude-opus-4.7     272      4,647,097,376  37,358  7,897,263  50,695,274  79,856,882  108,008,474  17084917  10.11

  per-model bucket-size histogram (counts per token-magnitude band)
  model               [1,1k)  [1k,10k)  [10k,100k)  [100k,1M)  [1M,10M)  [10M,+inf)
  ------------------  ------  --------  ----------  ---------  --------  ----------
  unknown             0       0         1           52         3         0
  claude-sonnet-4     13      12        1           0          0         0
  claude-opus-4.6.1m  0       1         10          33         88        35
  gpt-5.1             24      26        3           0          0         0
  gpt-5.4             0       1         2           41         267       61
  claude-opus-4.7     0       0         10          36         111       115
  ```

  Headline: `unknown` and `claude-sonnet-4` have the highest
  spread (20.88× and 19.55× p99/p50) but live in completely
  different magnitude bands — `unknown` clusters in `[100k,1M)`
  with rare 8M spikes, while `claude-sonnet-4` is almost entirely
  sub-10k with a single 17k spike. Without the per-model
  histogram these two would look like the same "tail-heavy"
  story; bucket-intensity surfaces them as one runaway-prompt
  pattern (sonnet) and one occasional-large-context pattern
  (unknown). Heavy-traffic models like `claude-opus-4.7` (4.6B
  total tokens across 272 hours) keep a more moderate 10× spread
  with consistent multi-million-token hours — load is sustained,
  not bursty.

## 0.4.60 — 2026-04-25

### Added

- `interarrival-time`: `--min-active-buckets <n>` flag (default 0
  = no filter). Hides source rows whose `activeBuckets < n`;
  drops surface as `droppedMinActiveBuckets`. Display filter only
  — `totalSources`, `totalActiveBuckets`, `totalGaps`, and the
  `droppedInvalidHourStart`/`droppedZeroTokens`/`droppedSourceFilter`
  counts are byte-identical to the unfiltered run. Composes
  with `--top` (min applied first, top second).

  3 new tests (853 total, up from 850): rejects bad input;
  hides small sources and surfaces drops while preserving totals;
  composes correctly with `--top`.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--min-active-buckets 200 --sort p90`:

  ```
  pew-insights interarrival-time
  as of: 2026-04-25T03:57:11.381Z    sources: 6 (shown 3)    activeBuckets: 1,299    gaps: 1,293    sort: p90
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 3 below min-active-buckets, 0 below top cap

  per-source gap summary (sorted by p90 desc)
  source          buckets  gaps  min(h)  p50(h)  p90(h)  max(h)  mean(h)  sum(h)
  --------------  -------  ----  ------  ------  ------  ------  -------  ------
  vscode-copilot  320      319   1       1       48      568     20.21    6,448
  claude-code     267      266   1       1       16      316     6.87     1,827
  openclaw        337      336   1       1       1       13      1.07     359
  ```

  Headline: combining `--min-active-buckets 200` (drops
  `opencode`/`hermes`/`codex` — the three producers with <200
  active hour buckets) with `--sort p90` cleanly inverts the
  default ordering and isolates the long-tail spacing pattern:
  vscode-copilot's p90 of 48h is **48× higher** than openclaw's
  1h, even though both have comparable active-bucket counts
  (320 vs 337). The `--sort p90` lens turns this from "openclaw
  has the most data" to "vscode-copilot has the longest dark
  intervals" without changing any underlying number.

## 0.4.59 — 2026-04-25

### Added

- `interarrival-time`: per-source distribution of gaps (in hours)
  between consecutive distinct UTC `hour_start` buckets with
  positive `total_tokens`. Reports per-source count, min, p50,
  p90, max, mean, sum, and a fixed-edge histogram over
  `[1h, 2h, 3h, 6h, 12h, 24h, 48h, 168h, +inf)`.

  Distinct from existing tools:
    - `idle-gaps` operates on `SessionLine` per `session_key` in
      seconds (intra-session message spacing).
    - `burstiness` measures intra-window concentration (Gini /
      coefficient of variation) of token mass — it ignores
      *spacing* between active hours.
    - `time-of-day` and `peak-hour-share` are population stats
      over the hour-of-day modulus, not raw consecutive-bucket
      gaps.

  `interarrival-time` is the spacing-of-activity lens: how long
  does each producer go dark between active wall-clock hours?

  Pure deterministic builder. Flags: `--since`, `--until`,
  `--source`, `--top`, `--sort buckets|gaps|p90`, `--json`.

  15 new tests (850 total, up from 835): option validation,
  empty/edge handling, dedup of duplicate hour buckets, exact
  histogram bucketing of a 24h gap into `[24h, 48h)`,
  nearest-rank percentiles on a synthetic gap sequence,
  per-source isolation, source filter accounting, sort defaults
  with lex tiebreak, `--top` cap with drop accounting, window
  filter applied before bucket dedup.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights interarrival-time
  as of: 2026-04-25T03:55:09.963Z    sources: 6 (shown 6)    activeBuckets: 1,299    gaps: 1,293    sort: buckets
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 below top cap

  per-source gap summary (sorted by buckets desc)
  source          buckets  gaps  min(h)  p50(h)  p90(h)  max(h)  mean(h)  sum(h)
  --------------  -------  ----  ------  ------  ------  ------  -------  ------
  openclaw        337      336   1       1       1       13      1.07     359
  vscode-copilot  320      319   1       1       48      568     20.21    6,448
  claude-code     267      266   1       1       16      316     6.87     1,827
  opencode        167      166   1       1       1       10      1.13     188
  hermes          144      143   1       1       3       11      1.59     228
  codex           64       63    1       1       13      28      3.33     210

  per-source gap histogram
  source          [1h,2h)  [2h,3h)  [3h,6h)  [6h,12h)  [12h,1d)  [1d,2d)  [2d,1w)  [1w,+inf)
  --------------  -------  -------  -------  --------  --------  -------  -------  ---------
  openclaw        331      2        1        1         1         0        0        0
  vscode-copilot  197      21       22       7         31        9        22       10
  claude-code     201      7        22       5         18        3        9        1
  opencode        157      5        3        1         0         0        0        0
  hermes          98       30       11       4         0         0        0        0
  codex           49       1        4        2         6         1        0        0
  ```

  Headline: the producer mix splits cleanly into two regimes by
  `mean(h)` between active hours. The "always-on" cluster —
  `openclaw`, `opencode`, `hermes` — sits at mean 1.07–1.59h with
  p90=1–3h and zero gaps beyond a half-day; their distributions
  are dominated (>90%) by the `[1h, 2h)` bucket. The "bursty"
  cluster — `vscode-copilot` (mean 20.21h, p90 48h, max 568h ≈
  23.7d), `claude-code` (mean 6.87h, p90 16h, max 316h ≈ 13.2d),
  `codex` (mean 3.33h, p90 13h) — has long tails: 32 of
  vscode-copilot's 319 gaps (10.0%) cross a full week, vs 0/336
  for openclaw. Total active-hour-buckets across producers =
  1,299 with 1,293 emitted gaps — the difference (6) is exactly
  the per-source "first observation has no predecessor" loss.

## 0.4.58 — 2026-04-25

### Added

- `model-cohabitation`: `--by-model <name>` flag (default null = no
  filter). When set, the pair report is restricted to pairs that
  include the named model (after `normaliseModel`); other pairs
  surface as `droppedByModelFilter`. Display filter only — every
  top-level number (`totalBuckets`, `multiModelBuckets`,
  `totalPairs`, `models[]`) is byte-identical to the unfiltered
  run. Composes correctly with `--top` (top is applied *after*
  the byModel filter, so `--by-model X --top 5` returns the top
  5 partners of X, not the top 5 of all pairs filtered down).

  4 new tests (835 total, up from 831): byModel restricts pairs
  and reports drops while preserving top-level numbers; null and
  empty string disable the filter; non-matching name yields zero
  pairs with droppedByModelFilter accounting; byModel composes
  with --top.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--by-model claude-opus-4.7 --top 10`:

  ```
  pew-insights model-cohabitation
  as of: 2026-04-25T03:33:31.280Z    buckets: 877    multi-model: 296    models: 15    pairs: 23 (shown 7)    tokens: 8,320,680,844
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 below min-co-buckets, 16 by model filter, 0 below top cap
  by-model filter: claude-opus-4.7

  top model pairs by shared buckets
  modelA              modelB             coBuckets  coTokens(min)  cohabIndex  P(B|A)  P(A|B)
  ------------------  -----------------  ---------  -------------  ----------  ------  ------
  claude-opus-4.7     gpt-5.4            259        1,333,172,648  0.678       95.6%   70.0%
  claude-opus-4.7     unknown            53         28,947,973     0.193       19.6%   94.6%
  claude-opus-4.7     claude-sonnet-4.6  3          2,838,126      0.011       1.1%    33.3%
  claude-haiku-4.5    claude-opus-4.7    2          3,961,417      0.007       6.7%    0.7%
  claude-opus-4.7     gpt-5.2            1          299,605        0.004       0.4%    100.0%
  claude-opus-4.6.1m  claude-opus-4.7    1          174,625        0.002       0.6%    0.4%
  claude-opus-4.7     gpt-5-nano         1          109,646        0.004       0.4%    100.0%
  ```

  Headline: `claude-opus-4.7` co-habits a UTC hour bucket with
  exactly 7 other models (16 of the 23 global pairs are dropped
  because they don't touch opus-4.7). The bucket-overlap is
  extremely lopsided — 259 of 271 opus-4.7 buckets (95.6%) also
  carry gpt-5.4, but only 53 (19.6%) carry the `unknown` model
  and 0 carry the gemini-* family. The unfiltered global view
  ranked the opus×unknown pair #3 by coBuckets; this lens makes
  it clear that opus-4.7's *only* meaningful cohabitant is
  gpt-5.4 — every other partner is a long-tail accident.

## 0.4.57 — 2026-04-25

### Added

- `model-cohabitation`: a fresh analytical lens that asks **which
  model pairs share the same UTC `hour_start` bucket**. For every
  bucket present in the queue we collect the set of distinct
  normalised models with positive token mass, then aggregate
  unordered model pairs across buckets. Reports per pair:
  `coBuckets` (shared bucket count), `coTokens` (sum of
  `min(tokens_in_bucket)` — a Jaccard-flavoured weight that stops
  one giant model dominating every pair it touches), `cohabIndex`
  (Jaccard on bucket-presence sets, in [0,1]), and the asymmetric
  conditionals `P(B|A)` / `P(A|B)`.

  Distinct from the existing surface:

  - `model-switching` looks at *sequential* fallback inside one
    `session_key` (A→B→A on SessionLine). Cohabitation is
    bucket-parallel, not session-sequential, and operates on
    QueueLine — so it surfaces "two producers / two routes are
    using two models in the same wall-clock hour", which is
    invisible to model-switching when the session keys differ.
  - `model-mix-entropy` is a per-source diversity statistic; never
    pairwise, never time-bucketed.
  - `agent-mix` and `provider-share` are pure mass tallies with no
    notion of co-occurrence.

  17 new tests (831 total, up from 814): option validation,
  empty/edge cases, single-bucket isolation, three-models-in-one
  bucket fan-out, Jaccard arithmetic, `min`-based coTokens, same
  model from multiple sources collapsing to one bucket, source
  filter, window bounds, top cap, deterministic sort.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--top 15`:

  ```
  pew-insights model-cohabitation
  as of: 2026-04-25T03:31:05.979Z    buckets: 877    multi-model: 296    models: 15    pairs: 23 (shown 15)    tokens: 8,320,680,844
  dropped: 0 bad hour_start, 0 zero-tokens, 0 by source filter, 0 below min-co-buckets, 8 below top cap

  per-model presence summary (sorted by tokens desc)
  model                 tokens         buckets  cohabitants
  --------------------  -------------  -------  -----------
  claude-opus-4.7       4,620,759,456  271      7
  gpt-5.4               2,470,012,313  370      8
  claude-opus-4.6.1m    1,108,978,665  167      5
  claude-haiku-4.5      70,717,678     30       4
  unknown               35,575,800     56       2
  claude-sonnet-4.6     12,601,545     9        3
  gpt-5                 850,661        170      2
  claude-opus-4.6       350,840        4        3

  top model pairs by shared buckets
  modelA              modelB              coBuckets  coTokens(min)  cohabIndex  P(B|A)  P(A|B)
  ------------------  ------------------  ---------  -------------  ----------  ------  ------
  claude-opus-4.7     gpt-5.4             259        1,333,172,648  0.678       95.6%   70.0%
  gpt-5.4             unknown             54         31,187,117     0.145       14.6%   96.4%
  claude-opus-4.7     unknown             53         28,947,973     0.193       19.6%   94.6%
  claude-haiku-4.5    claude-opus-4.6.1m  8          21,972,028     0.042       26.7%   4.8%
  claude-opus-4.6.1m  gpt-5.4             7          6,855,834      0.013       4.2%    1.9%
  claude-sonnet-4.5   gemini-3-pro-prev.  5          14,916         0.072       13.5%   13.5%
  claude-sonnet-4.6   gpt-5.4             4          4,106,116      0.011       44.4%   1.1%
  claude-opus-4.7     claude-sonnet-4.6   3          2,838,126      0.011       1.1%    33.3%
  ```

  Headline finding: out of 877 distinct UTC hour buckets in the
  corpus, 296 (33.8%) contain ≥ 2 models. One pair dominates —
  `claude-opus-4.7` × `gpt-5.4` co-habit 259 buckets with a Jaccard
  of 0.678; whenever opus-4.7 is active there's a 95.6% chance
  gpt-5.4 is also active in the same hour. That's a *parallel*
  usage signal (different producers running in parallel), not a
  fallback signal — model-switching never sees it because the two
  models live in different sessions. The next two pairs both bind
  the `unknown` model, suggesting a labelling gap on the producer
  side worth chasing separately.

## 0.4.56 — 2026-04-25

### Added

- `cache-hit-by-hour`: `--source <name>` flag (default null = no
  filter). When set, totals, `byHour[]` and `bySource[]` are all
  restricted to a single source; rows from other sources surface
  as `droppedSourceFilter`. Useful for isolating one producer's
  daily cache rhythm without the noise of others sharing the same
  hour buckets — when the global report shows e.g. an hour-23
  bucket spike, this flag lets you confirm whether the spike is
  driven by one specific source or distributed.

  3 new tests (814 total, up from 811): filter restricts totals
  and bySource and excludes other sources from byHour; null/empty
  string disables the filter; non-matching filter yields zero
  totals with `droppedSourceFilter` reporting the count.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--source claude-code`:

  ```
  pew-insights cache-hit-by-hour
  as of: 2026-04-25T02:54:44.116Z    input: 1,834,613,640    cached: 1,595,643,323 (86.97%)    sources: 1    shown: 1
  dropped: 0 bad hour_start, 0 zero-input, 0 below min-input, 0 below top cap
  source filter: claude-code    droppedSourceFilter: 1,105
  (hour-of-day in UTC; ratio = cached_input_tokens / input_tokens)

  global cache ratio by hour-of-day (UTC)
  hr  input        cached       cache%  rows
  --  -----------  -----------  ------  ----
  00  15,154,831   13,957,061   92.1%   1
  01  124,632,966  113,333,844  90.9%   23
  02  108,588,423  93,277,463   85.9%   37
  03  51,713,312   39,598,387   76.6%   17
  04  59,017,146   56,368,731   95.5%   5
  05  95,133,114   58,650,233   61.7%   15
  06  164,147,228  113,623,031  69.2%   43
  07  186,705,887  152,464,779  81.7%   40
  08  238,970,557  226,616,601  94.8%   34
  09  68,552,948   61,703,676   90.0%   22
  10  80,612,228   72,720,703   90.2%   11
  11  86,907,369   75,553,009   86.9%   12
  12  80,063,900   74,878,017   93.5%   7
  13  98,458,595   90,162,981   91.6%   7
  14  101,003,434  91,889,995   91.0%   9
  15  79,770,174   74,823,790   93.8%   5
  16  88,403,421   83,966,835   95.0%   5
  17  45,955,188   43,886,849   95.5%   2
  18  45,193,203   43,203,388   95.6%   2
  19  15,629,716   14,963,950   95.7%   2
  20  0            0            —       0
  21  0            0            —       0
  22  0            0            —       0
  23  0            0            —       0

  per-source summary (sorted by input tokens desc)
  source       input          cached         daily%  peak hr  peak%  trough hr  trough%  spread
  -----------  -------------  -------------  ------  -------  -----  ---------  -------  -------
  claude-code  1,834,613,640  1,595,643,323  87.0%   19       95.7%  05         61.7%    34.1 pp
  ```

  Headline: this producer never sent traffic at 20:00–23:00 UTC,
  and its 05:00 trough (61.7%) is much sharper than the global
  72.5% — the global trough was being lifted by other sources
  active in that hour. The filtered view reveals a strict
  workday-UTC pattern (peak activity 06–08 UTC) that the unfiltered
  report cannot show.

## 0.4.55 — 2026-04-25

### Added

- `cache-hit-by-hour`: prompt-cache effectiveness
  (`cached_input_tokens / input_tokens`) bucketed by UTC
  hour-of-day (0..23), broken down per source. Distinct lens vs
  `cache-hit-ratio` (which is a single cumulative number per
  model) and `time-of-day` (which is just raw token mass per
  hour). For each kept queue row we bucket `hour_start`'s UTC
  hour and accumulate input + cached tokens per (source, hour).
  The report emits a 24-hour global breakdown plus one block per
  source with `peakHour`/`peakRatio`, `troughHour`/`troughRatio`
  and `spread = peak - trough` so a source with a 60+ pp swing
  across the day pops out vs one that holds a flat ratio.

  Window semantics match the rest of the suite (`since`
  inclusive, `until` exclusive on `hour_start`). Defensive guards:
  bad `hour_start` and zero/negative `input_tokens` rows are
  dropped with separate counters; `cached_input_tokens` is clamped
  to `input_tokens` so the per-bucket ratio never exceeds 1.0.
  Empty-source string falls back to `unknown`.

  12 new tests (811 total, up from 799): option validation
  (minInputTokens, topSources, since/until); empty input shape (24
  zero buckets); UTC hour bucketing across multiple rows;
  per-source peak/trough/spread; dropped accounting for invalid
  hour_start and zero-input; cached clamped to input; window
  filter (since inclusive, until exclusive); minInputTokens floor
  preserves global; topSources truncation with droppedTopSources;
  empty-source-string fallback to "unknown".

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--top 5`:

  ```
  pew-insights cache-hit-by-hour
  as of: 2026-04-25T02:52:25.184Z    input: 3,336,583,730    cached: 2,921,188,059 (87.55%)    sources: 6    shown: 5
  dropped: 0 bad hour_start, 327 zero-input, 0 below min-input, 1 below top cap
  (hour-of-day in UTC; ratio = cached_input_tokens / input_tokens)

  global cache ratio by hour-of-day (UTC)
  hr  input        cached       cache%  rows
  --  -----------  -----------  ------  ----
  00  50,522,168   43,248,730   85.6%   27
  01  203,109,223  183,878,008  90.5%   58
  02  201,285,062  174,695,939  86.8%   85
  03  131,759,767  108,972,941  82.7%   53
  04  104,910,397  93,971,670   89.6%   33
  05  163,807,255  118,817,981  72.5%   48
  06  256,349,939  195,965,025  76.4%   84
  07  270,761,129  226,516,037  83.7%   80
  08  304,687,802  283,796,926  93.1%   72
  09  123,016,299  100,568,171  81.8%   58
  10  144,972,967  130,936,534  90.3%   47
  11  138,615,297  121,739,392  87.8%   42
  12  175,239,572  163,322,466  93.2%   32
  13  179,397,781  160,348,473  89.4%   44
  14  183,392,669  167,443,060  91.3%   48
  15  175,398,855  161,968,485  92.3%   42
  16  199,691,294  187,401,236  93.8%   41
  17  96,935,963   89,586,277   92.4%   30
  18  90,932,645   85,328,194   93.8%   28
  19  43,845,137   39,560,645   90.2%   29
  20  21,996,796   18,738,907   85.2%   23
  21  18,705,219   15,751,424   84.2%   22
  22  27,907,564   23,757,250   85.1%   22
  23  29,342,930   24,874,288   84.8%   29

  per-source summary (sorted by input tokens desc)
  source       input          cached         daily%  peak hr  peak%  trough hr  trough%  spread
  -----------  -------------  -------------  ------  -------  -----  ---------  -------  -------
  <src-A>      1,834,613,640  1,595,643,323  87.0%   19       95.7%  05         61.7%    34.1 pp
  <src-B>      875,080,976    753,201,792    86.1%   03       90.8%  00         80.8%    10.0 pp
  <src-C>      410,781,190    396,009,088    96.4%   12       98.0%  01         86.0%    12.1 pp
  <src-D>      160,919,437    133,191,295    82.8%   19       99.7%  04         31.2%    68.4 pp
  <src-E>      54,607,397     43,142,561     79.0%   19       96.7%  20         53.6%    43.1 pp
  ```

  Headline: across 6 sources, the daily blended cache ratio is
  87.55%. The 05:00 UTC hour is the global trough (72.5%) and
  16:00–18:00 sit above 93%. Per-source spread tells the real
  story: one source swings 68.4 pp across the day (peak 99.7% →
  trough 31.2%) while another only swings 10.0 pp — so a single
  cumulative cache-hit number can hide an order-of-magnitude
  variability in cache discipline.

## 0.4.54 — 2026-04-25

### Added

- `weekend-vs-weekday`: `--by-source` flag (default false). When
  set, each kept model row carries a `bySource` array giving the
  weekend/weekday split *per source* (the local producer CLI),
  sorted by total tokens desc then source asc. Display only —
  every top-level number (`totalTokens`, `weekendTokens`,
  `weekdayTokens`, `weekendShare`, `weekendToWeekdayRatio`, and
  every per-model field except the new `bySource` array) is
  byte-identical to the un-flagged run.

  Use case: the un-flagged report shows `claude-opus-4.7` is 22%
  weekend overall, but it conflates *very* different producer
  behaviours. `--by-source` reveals one producer drives almost all
  weekend activity for that model (we/wd = 0.698, ~41% weekend)
  while another stays strictly weekday (we/wd = 0.019, ~2%
  weekend). The headline is an average that hides the bimodal
  distribution.

  2 new tests (790 total, up from 788): bySource defaults to empty
  arrays per model; bySource splits per source, sorts by total
  desc, preserves all top-level numbers byte-for-byte against the
  baseline build.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--by-source --top 3`:

  ```
  pew-insights weekend-vs-weekday
  as of: 2026-04-25T02:15:35.848Z    tokens: 8,292,835,592    weekend: 1,631,448,282 (19.67%)    weekday: 6,661,387,310    ratio (we/wd): 0.245    models: 15    shown: 3
  dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-rows, 12 below top cap

  per-model weekend vs weekday split (sorted by total tokens desc)
  model               tokens         we tok         wd tok         we%    we/wd
  ------------------  -------------  -------------  -------------  -----  -----
  claude-opus-4.7     4,596,479,669  1,017,023,935  3,579,455,734  22.1%  0.284
  gpt-5.4             2,466,446,848    614,349,109  1,852,097,739  24.9%  0.332
  claude-opus-4.6.1m  1,108,978,665              0  1,108,978,665   0.0%  0.000

  per-model × source breakdown (excerpt)
  claude-opus-4.7    producer-A   2,259,457,858  929,045,420  1,330,412,438  41.1%  0.698
  claude-opus-4.7    producer-B   2,203,505,953   41,364,188  2,162,141,765   1.9%  0.019
  gpt-5.4            producer-C   1,632,176,426  460,731,597  1,171,444,829  28.2%  0.393
  gpt-5.4            producer-D     809,624,660  153,617,512    656,007,148  19.0%  0.234
  ```

  Headline: `claude-opus-4.7`'s 22% weekend share is the average
  of two producers with we/wd ratios that differ by **37×**
  (0.698 vs 0.019). Same model, totally different operator
  habits. `gpt-5.4` shows the same shape on a smaller scale (0.393
  vs 0.234, ~1.7×). Without `--by-source` you would mistake an
  averaged-out distribution for a uniform one.

## 0.4.53 — 2026-04-25

### Added

- `weekend-vs-weekday`: new subcommand. Splits token mass into
  weekend (Sat/Sun in UTC) vs weekday (Mon–Fri) buckets, broken
  down per normalised model. Each model row carries
  `weekendTokens`, `weekdayTokens`, `weekendShare`, and
  `weekendToWeekdayRatio` (= weekend / weekday, with `+Infinity`
  when weekday = 0 and weekend > 0). The "calendar-balanced"
  reference ratio is 2/5 = 0.400 — anything above means the model
  leans weekend-heavy *relative to days available*, anything below
  means weekday-skewed.

  Filling the gap between `weekday-share` (per-day-of-week, all
  models collapsed) and `time-of-day` / `peak-hour-share`
  (intra-day): the most common product question — "do I actually
  use weekends to grind, or only weekdays, and which model do I
  reach for off-hours?" — needs the coarse two-bucket lens at the
  per-model granularity, which neither sibling provides.

  Flags: `--since`, `--until` (window), `--min-rows <n>` (hide
  models with fewer than n considered rows; counts surface as
  `droppedMinRows`), `--top <n>` (keep top n by total tokens;
  remainder surface as `droppedTopModels`), `--json`.

  9 new tests (788 total, up from 779): bad opts rejected, empty
  queue zeros, single weekend row → ratio = ∞, single weekday row
  → ratio = 0, day-of-week classification correctness, per-model
  aggregation + sort by total desc, dropped counters, window
  filtering, minRows floor, top cap, distinct sources, firstSeen /
  lastSeen.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights weekend-vs-weekday
  as of: 2026-04-25T02:12:58.025Z    tokens: 8,288,382,199    weekend: 1,626,994,889 (19.63%)    weekday: 6,661,387,310    ratio (we/wd): 0.244    models: 15    shown: 15
  dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-rows, 0 below top cap
  (weekend = Sat/Sun in UTC; "calendar-balanced" reference ratio is 2/5 = 0.400)

  per-model weekend vs weekday split (sorted by total tokens desc)
  model                 tokens         we tok         wd tok         we%    we/wd  we rows  wd rows
  --------------------  -------------  -------------  -------------  -----  -----  -------  -------
  claude-opus-4.7       4,592,255,068  1,012,799,334  3,579,455,734  22.1%  0.283  75       306
  gpt-5.4               2,466,218,056  614,120,317    1,852,097,739  24.9%  0.332  98       315
  claude-opus-4.6.1m    1,108,978,665  0              1,108,978,665  0.0%   0.000  0        182
  claude-haiku-4.5      70,717,678     0              70,717,678     0.0%   0.000  0        31
  unknown               35,575,800     0              35,575,800     0.0%   0.000  0        56
  claude-sonnet-4.6     12,601,545     0              12,601,545     0.0%   0.000  0        9
  gpt-5                 850,661        39,723         810,938        4.7%   0.049  10       160
  ```

  Headline: only ~19.6% of token mass lands on weekends, well
  below the 28.6% you'd expect from a flat 2/7 distribution. The
  global `we/wd = 0.244` confirms a weekday-heavy operator. But
  the per-model split shows the headline averages out heterogeneous
  behaviour: the two flagship models (`claude-opus-4.7`, `gpt-5.4`)
  carry essentially all weekend activity (22% and 25%), while
  every other model is 0% weekend — they are pure weekday tools
  for one-off queries, not "always-on" companions.

## 0.4.52 — 2026-04-25

### Added

- `model-mix-entropy`: `--top-k <n>` flag (default 0). When set,
  each kept source row carries a `topModels` array of the top K
  models for that source, sorted by tokens desc then model asc,
  with raw `tokens` and `share` (in [0,1]). Display only — every
  entropy figure (`entropyBits`, `maxEntropyBits`,
  `normalizedEntropy`, `effectiveModels`, `topModelShare`,
  `topModel`, `distinctModels`) is byte-identical to the
  un-flagged run; only the new array is populated.

  Use case: the un-flagged report tells you a source has H = 0.23
  bits — strongly mono-model — but to act on it you need to know
  *which* model is dominant and what the long tail looks like.
  `--top-k 3` answers both in one pass.

  4 new tests (783 total, up from 779): topK=0 leaves array
  empty + entropy unchanged; topK lists per-source models sorted
  desc with correct shares; topK does not perturb any entropy
  scalar; bad topK values rejected.

  Live smoke test against `~/.config/pew/queue.jsonl` with
  `--top-k 3 --min-tokens 100000000`:

  ```
  per-source top-3 models (sorted by tokens desc within each source)
  source       model               tokens         share
  -----------  ------------------  -------------  ------
  claude-code  claude-opus-4.7     2,259,457,858  65.6%
               claude-opus-4.6.1m  1,108,978,665  32.2%
               claude-haiku-4.5    70,717,678     2.1%
  opencode     claude-opus-4.7     2,182,407,617  97.2%
               unknown             29,125,919     1.3%
               gpt-5.4             24,611,376     1.1%
  openclaw     gpt-5.4             1,629,451,942  100.0%
  codex        gpt-5.4             809,624,660    100.0%
  hermes       claude-opus-4.7     132,073,229    95.3%
               unknown             6,449,881      4.7%
               gpt-5.4             15,525         0.0%
  ```

  Reads cleanly: `claude-code`'s 1.05-bit entropy is now visibly
  a 2:1 mix of two opus generations + a haiku tail; `opencode`'s
  near-zero entropy is the long unknown/gpt-5.4 tail under a
  97.2% opus-4.7 monoculture; `hermes`'s gpt-5.4 share is
  literally 15,525 tokens — a stale config artifact, not real
  usage. None of these would surface in `provider-share`.

## 0.4.51 — 2026-04-25

### Added

- `model-mix-entropy`: new subcommand reporting Shannon entropy
  of model usage per `source` (the local producer CLI). For each
  source we compute `H = -Σ p_i log2 p_i` over the per-model
  share of `total_tokens`, plus `Hmax = log2(k)` (the perfectly-
  even ceiling for the same k models), `H/Hmax` in [0,1] (how
  close to even the mix is), and `effective-models = 2^H` (the
  perplexity — "behaves like N evenly-weighted models").

  Distinct lens vs. existing reports:

  - `provider-share` reports token mass per source but not how
    diverse each source's model fleet is.
  - `model-switching` looks at sequential transitions; entropy is
    a population-level diversity signal — orthogonal.
  - `output-input-ratio --by-source` measures verbosity, not mix
    concentration.

  Use case: spot a source that is "wasting" a multi-model setup
  by pinning to one model (low H, high top-share), vs. one that
  is genuinely load-balancing (H/Hmax → 1). Inverse use case:
  spot the source thrashing across many models when one would do.

  Options: `--since`, `--until`, `--min-tokens` (display floor),
  `--json`. Empty source strings fold into `"unknown"`. Sources
  sorted by total tokens desc, then source asc on tie.

  9 new tests (779 total, up from 770): option validation,
  empty/dropped rows, single-model entropy = 0, even 2-model
  split = 1 bit, even 4-model split = 2 bits, skewed mix
  H < Hmax, per-source aggregation + sort, empty-source
  folding, minTokens floor, since/until window.

  Live smoke test against `~/.config/pew/queue.jsonl`:

  ```
  pew-insights model-mix-entropy
  as of: 2026-04-25T01:16:07.579Z    sources: 6    tokens: 8,267,810,873    min-tokens: 0
  dropped: 0 bad hour_start, 0 zero/invalid tokens, 0 below min-tokens

  per-source model-mix entropy (Shannon bits over per-model token share; sorted by tokens desc)
  source          tokens         rows  k  H(bits)  Hmax    H/Hmax  eff-models  top-model        top-share
  --------------  -------------  ----  -  -------  ------  ------  ----------  ---------------  ---------
  claude-code     3,442,385,788  299   4  1.0497   2.0000  0.5249  2.07        claude-opus-4.7  65.6%
  opencode        2,245,924,121  226   6  0.2283   2.5850  0.0883  1.17        claude-opus-4.7  97.2%
  openclaw        1,629,451,942  332   1  0.0000   0.0000  0.0000  1.00        gpt-5.4          100.0%
  codex           809,624,660    64    1  0.0000   0.0000  0.0000  1.00        gpt-5.4          100.0%
  hermes          138,538,635    143   3  0.2732   1.5850  0.1724  1.21        claude-opus-4.7  95.3%
  vscode-copilot  1,885,727      333   9  2.3302   3.1699  0.7351  5.03        gpt-5            45.1%
  ```

  Reads cleanly: `vscode-copilot` is the only true poly-model
  producer (eff-models 5.03 across 9 distinct ids); `opencode`
  and `hermes` are nominally multi-model but >95% pinned to a
  single id; `openclaw` and `codex` are single-model by
  construction.

## 0.4.50 — 2026-04-25

### Added

- `output-input-ratio`: `--by-source` flag (default false). Also
  breaks down each per-model row by `source` (the local producer
  CLI). When set, every kept `ModelRatioRow` carries a `bySource`
  map of `source -> { rows, inputTokens, outputTokens, ratio }`.
  Sources are sorted by input volume desc, then source asc —
  same convention as `cache-hit-ratio --by-source`.

  Use case: separating "is opus chatty everywhere?" from "is opus
  chatty *when called from one specific producer*?". The bulk
  ratio collapses every producer together; the per-source view
  exposes whether the verbosity signal is uniform across the
  fleet or driven by one client's prompting style.

  Display only — global denominators (`consideredRows`,
  `totalInputTokens`, `totalOutputTokens`, `overallRatio`) and
  per-model `ratio` / `meanRowRatio` are byte-identical to the
  un-split run; only the new `bySource` map is populated.
  Empty source strings fold into `"unknown"`, mirroring the
  family-wide convention.

  4 new test cases (767 total, up from 763): split run produces
  per-source rows sorted by input desc; default value is false
  with empty `bySource` map; `bySource: true` does NOT change
  global denominators or per-model ratios vs the plain run;
  empty source strings collapse to `"unknown"`.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`, recent window:

```
$ npx tsx src/cli.ts output-input-ratio --by-source --since 2026-04-22T00:00:00Z --top 3
pew-insights output-input-ratio
as of: 2026-04-25T00:40:27.901Z    rows: 386    input: 483,761,360 tok    output: 13,170,656 tok    overall: 0.0272    min-rows: 0    top: 3
dropped: 0 bad hour_start, 0 zero-input, 0 bad tokens, 0 below min-rows, 3 below top cap
window: 2026-04-22T00:00:00Z → +∞

per-model output/input ratio (token-weighted; sorted by input volume desc; chatty=high, terse=low)
model            rows  input        output     ratio   mean-row-ratio
---------------  ----  -----------  ---------  ------  --------------
gpt-5.4          146   373,057,660  3,005,106  0.0081  0.0071
claude-opus-4.7  181   86,025,043   9,730,056  0.1131  0.1656
unknown          53    17,746,683   366,926    0.0207  0.0220

per-source breakdown (sources sorted by input volume desc)
model            source       rows  input        output     ratio
---------------  -----------  ----  -----------  ---------  ------
gpt-5.4          openclaw     145   373,042,260  3,005,039  0.0081
                 hermes       1     15,400       67         0.0044
claude-opus-4.7  opencode     119   74,865,619   8,877,453  0.1186
                 claude-code  5     6,799,703    370,680    0.0545
                 hermes       57    4,359,721    481,923    0.1105
unknown          opencode     53    17,746,683   366,926    0.0207
```

Sharper signal than the bulk view: `claude-opus-4.7` runs at
ratio 0.1186 from `opencode` and 0.1105 from `hermes`, but
collapses to 0.0545 when called from `claude-code` — opus is
~2× as chatty per input token under tool-loop producers vs
the interactive REPL. `gpt-5.4` is uniform across `openclaw`
and `hermes` (~0.008), confirming its terse-completion
profile is a model property, not a client-prompting artefact.

## 0.4.49 — 2026-04-25

### Added

- `output-input-ratio`: per-model ratio of `output_tokens` to
  `input_tokens` aggregated across `QueueLine` rows. The
  "verbosity per call" lens — answers "which models are chatty
  (lots of completion per unit of prompt) and which are terse
  (short answers to long prompts)?" Also flags tool-loop agents
  that ship huge prompts and get tiny answers, i.e. spend going
  to context being re-shipped instead of new generation.

  Distinct from existing reports:

  - `prompt-size` and `output-size` are *univariate* distribution
    views — they bucket the input or output side, but never
    correlate the two. A model with mean prompt 100k / mean
    completion 200 looks identical there to one with mean
    prompt 100k / mean completion 20k.
  - `cost` collapses both sides into a single dollar figure with
    vendor-specific weights, so a chatty cheap model and a terse
    expensive one can land on the same $ bar.
  - `cache-hit-ratio` is a ratio over the input side only.
  - `reasoning-share` reports `reasoning / output` within the
    output side; never looks at input at all.

  Two ratios surfaced per model:

  - `ratio` = token-weighted: `sum(output) / sum(input)`. A
    handful of long completions can dominate this number.
  - `mean-row-ratio` = mean of per-row ratios. Equally weights
    every call. The gap between the two surfaces whether the
    verbosity signal is concentrated in a few outlier rows or
    is the model's typical behaviour.

  Window semantics: filter by `hour_start` (the row's own
  timestamp), exactly like `cost`, `forecast`, `cache-hit-ratio`.
  Drops rows whose `input_tokens === 0` (cannot define a ratio);
  their counts surface as `droppedZeroInput` for visibility.

  Flags: `--since`, `--until`, `--min-rows`, `--top`, `--json`.
  Display filters do not shrink the global denominators —
  `consideredRows`, `totalInputTokens`, `totalOutputTokens`,
  `overallRatio` always reflect the full population, mirroring
  the family-wide convention.

  10 new test cases (763 total, up from 753): option validation,
  empty-input edge case, drop counters for bad hour_start /
  zero-input / bad tokens, per-model token-weighted ratio +
  mean-row-ratio with hand-checked expectations, sort by
  inputTokens desc, exclusive upper-bound window semantics,
  minRows hides without shrinking denominators, top cap with
  droppedTopModels, all-zero-output corner case.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ npx tsx src/cli.ts output-input-ratio
pew-insights output-input-ratio
as of: 2026-04-25T00:37:45.803Z    rows: 1,067    input: 3,331,018,189 tok    output: 33,371,359 tok    overall: 0.0100    min-rows: 0    top: ∞
dropped: 0 bad hour_start, 327 zero-input, 0 bad tokens, 0 below min-rows, 0 below top cap

per-model output/input ratio (token-weighted; sorted by input volume desc; chatty=high, terse=low)
model               rows  input          output      ratio   mean-row-ratio
------------------  ----  -------------  ----------  ------  --------------
claude-opus-4.7     377   1,345,507,379  22,496,048  0.0167  0.0925
gpt-5.4             406   1,284,376,594  6,799,886   0.0053  0.0060
claude-opus-4.6.1m  182   606,191,092    3,450,625   0.0057  0.0108
claude-haiku-4.5    31    66,264,788     133,160     0.0020  0.0028
unknown             56    18,262,497     410,432     0.0225  0.0342
claude-sonnet-4.6   9     9,943,726      73,444      0.0074  0.0060
claude-opus-4.6     4     343,761        5,787       0.0168  0.0181
gpt-5.2             1     90,545         1,690       0.0187  0.0187
gpt-5-nano          1     37,807         287         0.0076  0.0076
```

Sharp signal: `claude-opus-4.7` has a 5.5× higher `mean-row-ratio`
(0.0925) than `ratio` (0.0167). The token-weighted view is
dragged down by a few enormous prompt-cached rows; per-call,
opus is by far the chattiest model in the population. Compare
to `gpt-5.4`, where both numbers collapse to ~0.006 — its
verbosity is uniform across calls. `claude-haiku-4.5` is the
terse end of the spectrum (0.0020 token-weighted), as expected
for a small fast model used for tool-call replies.

## 0.4.48 — 2026-04-25

### Added

- `device-share`: `--redact` flag (default false). Replaces every
  emitted `deviceId` with a stable short label of the form
  `dev-XXXXXXXX` where the suffix is the first 8 hex chars of a
  SHA-256 of the original UUID. The hash is deterministic, so a
  given device keeps the same short label across runs and across
  hosts — meaning two redacted reports can still be joined on
  the label without ever exposing the raw UUID.

  Use case: pasting a `device-share` table into a public issue,
  a screenshot, or a shared dashboard where the raw UUID is
  mildly PII-ish or just visually noisy. Display-only — global
  denominators, totals, drop counters, and ordering are
  identical to the un-redacted run; only the `deviceId` column
  is rewritten. Also exports `redactDeviceId(id: string): string`
  as a public helper for consumers who want the same labelling
  scheme outside the CLI path.

  3 new test cases (753 total, up from 750): the redacted run
  emits the `dev-XXXXXXXX` shape and shares preserve their
  ordering by token mass; default value is false (back-compat
  echo of raw `device_id`); `redact: true` does NOT change
  `totalTokens`, `totalDevices`, `devices.length`, or per-row
  token counts vs the plain run.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl` with the new flag:

```
$ npx tsx src/cli.ts device-share --redact
pew-insights device-share
as of: 2026-04-24T23:53:13.507Z    tokens: 8,237,898,930    devices: 1    shown: 1    min-tokens: 0    top: ∞
dropped: 0 bad hour_start, 0 zero-tokens, 0 empty device_id, 0 below min-tokens, 0 below top cap

per-device share of token mass (cache% = cached_input / input; models / sources = distinct count)
device_id     tokens         share    rows   active hrs  models  sources  input          cached         output      cache%  first seen         last seen
------------  -------------  -------  -----  ----------  ------  -------  -------------  -------------  ----------  ------  -----------------  -----------------
dev-37533d9d  8,237,898,930  100.00%  1,391  869         15      6        3,329,072,339  4,873,378,646  34,349,311  146.4%  2025-07-30T06:00Z  2026-04-24T23:30Z
```

The raw 36-char UUID `a6aa6846-…` is now `dev-37533d9d`, stable
across runs. All other columns are byte-identical to the
v0.4.47 plain run.

## 0.4.47 — 2026-04-25

### Added

- `device-share`: per-`device_id` slice of the queue population.
  Every queue line carries the `device_id` (a stable UUID per pew
  install) of the machine that minted it, but every other report
  collapses devices together. This subcommand keeps them split so
  multi-machine users can ask "which box drove most of last
  week's spend?" and "is one machine's cache hit rate dragging the
  fleet average down?".

  Per-device columns: `totalTokens`, `share` (vs global token
  total), `inputTokens` / `cachedInputTokens` / `outputTokens` /
  `reasoningOutputTokens`, `cacheHitRatio` = `cached_input /
  input` (matches the convention of the existing
  `cache-hit-ratio` subcommand and can exceed 1.0 when pew
  accounts uncached vs cached separately), `rows`, `activeHours`,
  `distinctModels`, `distinctSources`, `firstSeen` / `lastSeen`.

  Flags: `--since`, `--until`, `--min-tokens`, `--top`, `--json`.
  Display filters do not shrink the global denominators — `share`
  is always computed against the full population, mirroring the
  family-wide convention.

  Distinct lens vs existing reports: `provider-share` slices by
  `source` (which client), not by `device_id` (which physical
  machine). A laptop running codex + claude-code + gemini-cli
  collapses into one row in `provider-share` but splits cleanly
  here. `concurrency`, `velocity`, `peak-hour-share`,
  `weekday-share` all collapse across devices.

  13 new test cases (750 total, up from 737): option validation,
  empty population, single-device share=1, multi-device share
  arithmetic summing to 1.0, distinct-model / distinct-source
  counting, drop counters for bad `hour_start` / zero tokens /
  empty `device_id` (incl. whitespace-only), `since`/`until`
  window clamping, `--min-tokens` floor with global-denominator
  isolation, `--top` cap, sort order (tokens desc, deviceId
  asc), and the `cacheHitRatio = 0` edge case for zero-input rows.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ npx tsx src/cli.ts device-share
pew-insights device-share
as of: 2026-04-24T23:51:02.099Z    tokens: 8,235,256,800    devices: 1    shown: 1    min-tokens: 0    top: ∞
dropped: 0 bad hour_start, 0 zero-tokens, 0 empty device_id, 0 below min-tokens, 0 below top cap

per-device share of token mass (cache% = cached_input / input; models / sources = distinct count)
device_id                             tokens         share    rows   active hrs  models  sources  input          cached         output      cache%  first seen         last seen
------------------------------------  -------------  -------  -----  ----------  ------  -------  -------------  -------------  ----------  ------  -----------------  -----------------
a6aa6846-9de9-444d-ba23-279d86441eee  8,235,256,800  100.00%  1,391  869         15      6        3,329,026,650  4,870,800,584  34,330,932  146.3%  2025-07-30T06:00Z  2026-04-24T23:30Z
```

This host is currently single-device; the report degenerates to
one row at 100% share. Multi-device populations (laptop +
desktop + CI box) will show non-trivial slices. Notable: the
real fleet shows `cache%` at 146.3% — `cached_input_tokens`
exceeds `input_tokens` because pew's queue accounts uncached
prompt bytes and cached prompt bytes as separate columns rather
than as a subset. The ratio is still informative for
device-vs-device comparison; it just does not bound at 100%.

## 0.4.46 — 2026-04-25

### Added

- `burstiness`: `--min-cv <x>` flag (default 0). Drops groups
  whose `cv` is `< x`; their counts surface as
  `droppedLowCvGroups`. Display filter only — global denominators
  and the global headline row still reflect the full population.

  Operational use: when ranking by spikiness, the
  steady-baseline groups (cv ≈ 0) clutter the top of any
  cv-sorted view. Setting `--min-cv 1.0` keeps only groups whose
  stddev is at least their mean — i.e. clearly bursty rather
  than noise-around-baseline. Combine with `--min-active-hours`
  to also exclude the n=1 long tail. 4 new test cases (737
  total, up from 733): option-validation rejection, default = 0
  back-compat, threshold sweep separating spiky `[10, 30]`
  (cv = 0.5) from a uniform group, and a denominator-isolation
  test confirming the floor does NOT shrink the global token
  count or shift the global cv.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl` with both refinement
flags engaged:

```
$ npx tsx src/cli.ts burstiness --min-cv 1.0 --min-active-hours 5
pew-insights burstiness
as of: 2026-04-24T23:17:45.328Z    tokens: 8,221,565,624    groups: 9    global active hrs: 868    global mean/hr: 9,471,850    global cv: 1.917    global max/hr: 126,620,962    min-tokens: 0    min-active-hours: 5    min-cv: 1.000
dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-tokens, 4 below min-active-hours, 2 below min-cv, 0 below top cap

per-model hourly burstiness (active hour buckets only; cv = stddev/mean; burst = max/p50)
model                 tokens         active hrs  mean/hr     stddev/hr   cv     p50/hr     p95/hr      max/hr       burst
--------------------  -------------  ----------  ----------  ----------  -----  ---------  ----------  -----------  ------
claude-opus-4.7       4,534,275,812  262         17,306,396  21,066,779  1.217  7,413,532  60,140,851  108,008,474  14.57×
gpt-5.4               2,457,380,737  362         6,788,345   9,266,293   1.365  3,883,536  27,231,107  65,604,896   16.89×
claude-opus-4.6.1m    1,108,978,665  167         6,640,591   9,375,732   1.412  3,244,687  24,327,017  55,962,051   17.25×
unknown               35,575,800     56          635,282     1,166,943   1.837  401,246    1,045,158   8,368,144    20.86×
gpt-5                 850,661        170         5,004       5,905       1.180  2,977      16,934      37,381       12.56×
gemini-3-pro-preview  154,496        37          4,176       4,246       1.017  3,178      10,276      22,021       6.93×
gpt-5.1               111,623        53          2,106       3,104       1.474  1,178      8,579       17,031       14.46×
claude-sonnet-4.5     105,382        37          2,848       3,132       1.100  1,544      8,790       14,366       9.30×
claude-sonnet-4       53,062         26          2,041       3,257       1.596  1,016      4,691       17,028       16.76×
```

Headline reading: `--min-cv 1.0 --min-active-hours 5` shrinks the
model list from 15 to 9. Four single-/few-hour models drop on
the `--min-active-hours 5` floor (`gpt-5.2`, `gpt-5-nano`,
`gpt-4.1`, `claude-opus-4.6` at 4 hrs); two more drop on
`--min-cv 1.0` because their stddev is below their mean
(`claude-haiku-4.5` at cv `0.840`, `claude-sonnet-4.6` at cv
`0.902` — both bursty by eye, but the strict cv ≥ 1 cut
excludes them). The global token count (`8,221,565,624`) and
global cv (`1.917`) are unchanged from the unfiltered view,
confirming both filters are display-only. Among the kept
models, `claude-sonnet-4` at cv `1.596` and `unknown` at cv
`1.837` are the spikiest workloads — exactly the ones a
rate-limit / smoothing pass should target.

## 0.4.45 — 2026-04-25

### Added

- New `burstiness` subcommand. Per-`(model|source)` spikiness of
  hourly token usage. Buckets rows by `hour_start`, sums tokens
  per bucket, then reports across the *active* hour buckets:
  mean, population stddev, **coefficient of variation
  (cv = stddev / mean)**, p50, p95, max, and **burst ratio
  (max / p50)**. The cv scalar is the headline: cv ≈ 0 means
  steady hour-to-hour, cv ≈ 1 means stddev equals mean
  (Poisson-ish noise), cv ≫ 1 means a few huge hours dwarf the
  rest.

  Distinct lens vs the existing reports:
  - `velocity` averages tokens over wall-clock — a steady drip
    and a single 10× spike that averages to the same rate are
    indistinguishable;
  - `concurrency` is session overlap, not token dispersion;
  - `streaks` / `gaps` measure *contiguity* of activity, not
    magnitude variance;
  - `peak-hour-share` / `weekday-share` measure *which* hour or
    weekday is hottest, not how spiky the time series is.

  10 new test cases (733 total, up from 723): option validation
  rejection, n=1 stable case (cv=0), perfectly uniform (cv=0),
  known-arithmetic case `[10, 30] → mean=20, popstd=10, cv=0.5,
  burst=1.5×`, single-spike inflation
  (cv > 1.5, burst = 100×), same-hour aggregation, sparse-group
  filter with global-denominator isolation, top cap, by=source
  dimension, since/until window clamp, bad-row counting, and
  sort order.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ npx tsx src/cli.ts burstiness
pew-insights burstiness
as of: 2026-04-24T23:14:58.936Z    tokens: 8,215,771,731    groups: 15    global active hrs: 868    global mean/hr: 9,465,175    global cv: 1.919    global max/hr: 126,620,962    min-tokens: 0    min-active-hours: 1
dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-tokens, 0 below min-active-hours, 0 below top cap

per-model hourly burstiness (active hour buckets only; cv = stddev/mean; burst = max/p50)
model                 tokens         active hrs  mean/hr     stddev/hr   cv     p50/hr     p95/hr      max/hr       burst
--------------------  -------------  ----------  ----------  ----------  -----  ---------  ----------  -----------  ------
claude-opus-4.7       4,528,737,641  262         17,285,258  21,080,553  1.220  7,413,532  60,140,851  108,008,474  14.57×
gpt-5.4               2,457,125,015  362         6,787,638   9,266,722   1.365  3,883,536  27,231,107  65,604,896   16.89×
claude-opus-4.6.1m    1,108,978,665  167         6,640,591   9,375,732   1.412  3,244,687  24,327,017  55,962,051   17.25×
claude-haiku-4.5      70,717,678     30          2,357,256   1,980,077   0.840  1,968,551  6,603,988   7,814,903    3.97×
unknown               35,575,800     56          635,282     1,166,943   1.837  401,246    1,045,158   8,368,144    20.86×
claude-sonnet-4.6     12,601,545     9           1,400,172   1,262,893   0.902  704,086    3,685,618   3,938,865    5.59×
gpt-5                 850,661        170         5,004       5,905       1.180  2,977      16,934      37,381       12.56×
claude-opus-4.6       350,840        4           87,710      38,329      0.437  78,408     137,090     142,920      1.82×
gpt-5.2               299,605        1           299,605     0           0.000  299,605    299,605     299,605      1.00×
gemini-3-pro-preview  154,496        37          4,176       4,246       1.017  3,178      10,276      22,021       6.93×
gpt-5.1               111,623        53          2,106       3,104       1.474  1,178      8,579       17,031       14.46×
gpt-5-nano            109,646        1           109,646     0           0.000  109,646    109,646     109,646      1.00×
claude-sonnet-4.5     105,382        37          2,848       3,132       1.100  1,544      8,790       14,366       9.30×
claude-sonnet-4       53,062         26          2,041       3,257       1.596  1,016      4,691       17,028       16.76×
gpt-4.1               72             1           72          0           0.000  72         72          72           1.00×
```

Headline reading: global cv `1.919` confirms the workload is
heavily bursty — stddev across the 868 active hour buckets is
~2× the mean. The two flagship models (`claude-opus-4.7`,
`gpt-5.4`) each show cv ≈ 1.2-1.4 with burst ratios near 15×,
meaning peak hours land an order of magnitude above the median
hour. `unknown` (background traffic) is the spikiest active
group at cv `1.837` and burst `20.86×`. Three single-hour models
(`gpt-5.2`, `gpt-5-nano`, `gpt-4.1`) trivially score cv = 0;
`--min-active-hours 5` would hide them — wired up as a refinement
in v0.4.46.

## 0.4.44 — 2026-04-25

### Added

- `weekday-share`: `--min-active-weekdays <n>` flag (default 1).
  Drops groups whose `activeWeekdays` count is `< n`; their
  counts surface as `droppedSparseGroups`. Display filter only —
  global denominators and the global headline row still reflect
  the full population.

  Operational use: the long-tail single-weekday models trivially
  score HHI = 1.0 and dominate any HHI-ranked view. Setting
  `--min-active-weekdays 5` keeps only models with broad enough
  activity to make HHI comparison meaningful. 4 new test cases
  (706 total, up from 702): option-validation rejection, default
  = 1 back-compat, threshold sweep across `[1, 6]` showing exact
  group-count and `droppedSparseGroups` arithmetic, and a
  denominator-isolation test confirming the floor does NOT
  shrink the global token count or shift the global peak
  weekday.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js weekday-share --min-active-weekdays 5
pew-insights weekday-share
as of: 2026-04-24T22:39:02.945Z    tokens: 8,205,355,057    groups: 9    global peak: Mon 24.9%    global hhi: 0.163    min-tokens: 0    min-active-weekdays: 5
dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-tokens, 6 below min-active-weekdays, 0 below top cap

per-model weekday share (UTC ISO weekday, sorted by total tokens desc; HHI in [1/7, 1])
model                 tokens         Mon    Tue    Wed    Thu    Fri    Sat    Sun    peak       active  hhi
--------------------  -------------  -----  -----  -----  -----  -----  -----  -----  ---------  ------  -----
claude-opus-4.7       4,520,585,751  24.3%  21.3%  14.8%  10.3%  7.8%   15.7%  5.8%   Mon 24.3%  7/7     0.171
gpt-5.4               2,454,860,231  34.9%  8.2%   9.1%   8.9%   14.2%  8.6%   16.1%  Mon 34.9%  7/7     0.198
claude-opus-4.6.1m    1,108,978,665  7.4%   8.6%   50.5%  16.4%  17.2%  0.0%   0.0%   Wed 50.5%  5/7     0.324
claude-haiku-4.5      70,717,678     4.3%   9.3%   46.0%  33.7%  6.8%   0.0%   0.0%   Wed 46.0%  5/7     0.340
gpt-5                 850,661        24.3%  17.5%  10.6%  27.3%  15.7%  3.3%   1.4%   Thu 27.3%  7/7     0.201
gemini-3-pro-preview  154,496        16.0%  39.5%  8.4%   29.2%  6.9%   0.0%   0.0%   Tue 39.5%  5/7     0.279
gpt-5.1               111,623        18.6%  36.4%  12.0%  7.5%   0.3%   0.0%   25.2%  Tue 36.4%  6/7     0.251
claude-sonnet-4.5     105,382        2.5%   46.4%  6.1%   42.2%  2.8%   0.0%   0.0%   Tue 46.4%  5/7     0.398
claude-sonnet-4       53,062         43.0%  5.2%   31.0%  0.0%   6.8%   14.0%  0.0%   Mon 43.0%  5/7     0.308
```

Headline reading: `--min-active-weekdays 5` shrinks the model
list from 15 to 9 (6 sparse groups dropped: `unknown` 3-day,
`claude-sonnet-4.6` and `claude-opus-4.6` 2-day, plus three
single-day spikes `gpt-5.2`, `gpt-5-nano`, `gpt-4.1`). The
global token count (`8,205,355,057`) and global peak weekday
(`Mon 24.9%`) are unchanged from the unfiltered view, confirming
this is a display-only filter. Among the kept models the HHI
ranking now genuinely reflects week-shape concentration:
`claude-sonnet-4.5` at HHI `0.398` is the most concentrated
(46% Tuesday, 42% Thursday — a clear two-day shape), while
`claude-opus-4.7` at HHI `0.171` is the closest to a uniform
week.

## 0.4.43 — 2026-04-25

### Added

- New `weekday-share` subcommand. Per-`(model|source)` token mass
  distribution across the 7 ISO weekdays (Mon..Sun, UTC) with a
  Herfindahl-Hirschman concentration index in `[1/7, 1]`. Surfaces
  the **peak weekday + share**, **active weekdays out of 7**, and
  **HHI** for every group, plus a global headline row that
  answers "is my overall workload Mon-Fri shaped or 7-day uniform"
  in a single scalar.

  Distinct lens vs the existing time-axis reports:
  - `time-of-day` collapses across weekdays (hour-of-day only);
  - `heatmap` is 24×7 normalised against the global cell maximum,
    so scale differences across models are deliberately squashed
    and you cannot read "this model is 90% Mon-Fri" off it;
  - `peak-hour-share` is *within-day* concentration, not
    across-week composition;
  - `streaks`, `velocity`, `concurrency`, `gaps`, `idle-gaps`
    look at sub-day cadence, not day-of-week mass.

  HHI is the single-scalar week-shape headline: `1/7 ≈ 0.143`
  means a perfectly uniform week, `1.0` means the entire spend
  landed on one weekday. Lets operators rank models by week-shape
  concentration without eyeballing seven percentages each.

  Flags: `--since`, `--until`, `--by model|source`, `--min-tokens`,
  `--top`, `--json`. 13 new unit tests (702 total, up from 689)
  covering option-validation, ISO-weekday mapping (Mon=0..Sun=6
  derived from UTC `getUTCDay()`), single-weekday HHI=1.0,
  hand-computed HHI (0.625 for a 75/25 Mon/Tue split), share
  normalisation summing to 1.0 within `1e-9`, droppage of bad
  `hour_start` and non-positive `total_tokens`, window filtering
  by `since`/`until`, by-source split with empty-source folding
  to `unknown`, sort order (tokens desc, key asc tie-break), and
  the `min-tokens` / `top` cap surfaces.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js weekday-share
pew-insights weekday-share
as of: 2026-04-24T22:36:47.638Z    tokens: 8,205,355,057    groups: 15    global peak: Mon 24.9%    global hhi: 0.163    min-tokens: 0
dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-tokens, 0 below top cap

per-model weekday share (UTC ISO weekday, sorted by total tokens desc; HHI in [1/7, 1])
model                 tokens         Mon    Tue    Wed    Thu     Fri     Sat    Sun    peak        active  hhi
--------------------  -------------  -----  -----  -----  ------  ------  -----  -----  ----------  ------  -----
claude-opus-4.7       4,520,585,751  24.3%  21.3%  14.8%  10.3%   7.8%    15.7%  5.8%   Mon 24.3%   7/7     0.171
gpt-5.4               2,454,860,231  34.9%  8.2%   9.1%   8.9%    14.2%   8.6%   16.1%  Mon 34.9%   7/7     0.198
claude-opus-4.6.1m    1,108,978,665  7.4%   8.6%   50.5%  16.4%   17.2%   0.0%   0.0%   Wed 50.5%   5/7     0.324
claude-haiku-4.5      70,717,678     4.3%   9.3%   46.0%  33.7%   6.8%    0.0%   0.0%   Wed 46.0%   5/7     0.340
unknown               35,575,800     0.0%   0.0%   23.5%  20.6%   55.9%   0.0%   0.0%   Fri 55.9%   3/7     0.410
claude-sonnet-4.6     12,601,545     0.0%   0.0%   21.3%  78.7%   0.0%    0.0%   0.0%   Thu 78.7%   2/7     0.665
gpt-5                 850,661        24.3%  17.5%  10.6%  27.3%   15.7%   3.3%   1.4%   Thu 27.3%   7/7     0.201
claude-opus-4.6       350,840        0.0%   0.0%   0.0%   55.3%   44.7%   0.0%   0.0%   Thu 55.3%   2/7     0.506
gpt-5.2               299,605        0.0%   0.0%   0.0%   100.0%  0.0%    0.0%   0.0%   Thu 100.0%  1/7     1.000
gemini-3-pro-preview  154,496        16.0%  39.5%  8.4%   29.2%   6.9%    0.0%   0.0%   Tue 39.5%   5/7     0.279
gpt-5.1               111,623        18.6%  36.4%  12.0%  7.5%    0.3%    0.0%   25.2%  Tue 36.4%   6/7     0.251
gpt-5-nano            109,646        0.0%   0.0%   0.0%   100.0%  0.0%    0.0%   0.0%   Thu 100.0%  1/7     1.000
claude-sonnet-4.5     105,382        2.5%   46.4%  6.1%   42.2%   2.8%    0.0%   0.0%   Tue 46.4%   5/7     0.398
claude-sonnet-4       53,062         43.0%  5.2%   31.0%  0.0%    6.8%    14.0%  0.0%   Mon 43.0%   5/7     0.308
gpt-4.1               72             0.0%   0.0%   0.0%   0.0%    100.0%  0.0%   0.0%   Fri 100.0%  1/7     1.000
```

Headline reading: at the workspace level (~8.2B tokens across
15 distinct model ids over the full window) the global HHI is
`0.163` — only marginally above the uniform-week floor of
`0.143`, with `Monday` the modal weekday at `24.9%` of mass.
Per-model the picture diverges: the two top-volume models
(`claude-opus-4.7`, `gpt-5.4`) are 7-day-active with HHI in
`[0.17, 0.20]` (close to uniform), while the long-tail models
collapse to single-day spikes — `gpt-5.2`, `gpt-5-nano`, and
`gpt-4.1` each show HHI = `1.000` because all of their
recorded mass landed on a single weekday (Thu, Thu, Fri
respectively), and `claude-sonnet-4.6` lands `78.7%` on
Thursday alone (HHI `0.665`).

## 0.4.42 — 2026-04-25

### Added

- New `peak-hour-share` subcommand. Per-`(model|source)`
  concentration of token spend in each day's busiest 1-hour
  window (UTC). For every `(group, day)` pair, sums
  `total_tokens` per hour-of-day, finds the single hour with
  the largest sum, and records its share of the day's total.
  Aggregates per group as **mean / p50 / p95 / max** of the
  per-day peak share, plus the **modal peak hour** (which
  clock hour most often holds the daily peak) and its
  dominance ratio (`modalPeakHourCount / days`).

  Answers the "spikiness" question that `time-of-day`,
  `heatmap`, `output-size`, `prompt-size`, `concurrency`,
  `gaps`, `idle-gaps`, and `velocity` all leave on the floor:
  a high mean peak-share means the model's day collapses into
  one burst (batch-style); a low one means the spend is
  smoothly spread. The modal hour + dominance ratio is the
  operational lens for rate-limit planning and provider-side
  capacity scheduling.

  Token-weighted overall mean (not a naïve cross-group simple
  mean) so heavy days move the headline number more — the
  operator question "for an arbitrary token, what fraction of
  its day arrived in its group's peak hour" has the right
  denominator. Singleton-hour days score 1.0 by definition
  and are kept by default; `--min-active-hours` scopes to
  multi-hour days when comparing "true" spikiness across
  models with different baseline activity.

  Flags: `--since`, `--until`, `--by model|source`,
  `--min-days`, `--top`, `--min-active-hours`, `--json`.
  19 new unit tests (689 total, up from 670) covering
  option-validation, peak-by-mass-not-rows, multi-day modal
  aggregation, the token-weighted overall arithmetic
  (verified to 1e-9 against hand-computed expectations), the
  filter / floor / cap surfaces, the by-source split, and
  modal tie-break ordering.

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js peak-hour-share
pew-insights peak-hour-share
as of: 2026-04-24T22:13:39.751Z    days: 157    tokens: 8,195,845,645    overall mean peak-share: 21.9%    overall max: 100.0%    min-days: 0    min-active-hours: 1
dropped: 0 bad hour_start, 0 zero-tokens, 0 below min-active-hours, 0 below min-days, 0 below top cap

per-model daily peak-hour concentration (sorted by day count desc)
model                 days  tokens         mean    p50     p95     max     modal-hr (UTC)  bar
--------------------  ----  -------------  ------  ------  ------  ------  --------------  --------------------
gpt-5                 32    850,661        63.5%   69.5%   100.0%  100.0%  07:00 (8/32)    █████████████·······
claude-opus-4.6.1m    20    1,108,978,665  53.3%   47.1%   100.0%  100.0%  08:00 (6/20)    ███████████·········
gpt-5.1               20    111,623        76.7%   78.9%   100.0%  100.0%  06:00 (3/20)    ███████████████·····
claude-haiku-4.5      16    70,717,678     88.4%   100.0%  100.0%  100.0%  07:00 (3/16)    ██████████████████··
gemini-3-pro-preview  15    154,496        90.3%   100.0%  100.0%  100.0%  06:00 (5/15)    ██████████████████··
gpt-5.4               13    2,454,673,106  33.0%   22.2%   100.0%  100.0%  02:00 (2/13)    ███████·············
claude-sonnet-4.5     11    105,382        72.0%   63.0%   100.0%  100.0%  07:00 (3/11)    ██████████████······
claude-sonnet-4       9     53,062         76.8%   87.0%   100.0%  100.0%  09:00 (4/9)     ███████████████·····
claude-opus-4.7       8     4,511,263,464  23.8%   18.0%   50.3%   50.3%   01:00 (2/8)     █████···············
claude-sonnet-4.6     4     12,601,545     86.8%   77.3%   100.0%  100.0%  09:00 (2/4)     █████████████████···
unknown               4     35,575,800     48.2%   17.0%   100.0%  100.0%  07:00 (1/4)     ██████████··········
claude-opus-4.6       2     350,840        70.0%   66.4%   73.7%   73.7%   06:00 (1/2)     ██████████████······
```

The headline finding: `claude-opus-4.7` (the heaviest model
at 4.5B tokens / 8 days, 55% of the entire considered mass)
is by far the **smoothest** at 23.8% mean peak-share, p95
50.3% — meaning even on its busiest day the peak hour
captured only half the spend; the rest was paced through
the day. By contrast `gemini-3-pro-preview` (90.3% mean) and
`claude-haiku-4.5` (88.4% mean, p50 100.0%) are operated as
short bursts: a typical day for those models has the
overwhelming majority of tokens land inside one hour. The
overall token-weighted mean (21.9%) is dragged down by
opus-4.7's mass, and is *much* lower than the naïve
group-simple-mean (~67%) precisely because the heaviest
model is the smoothest — exactly the asymmetry the weighting
formula is designed to surface. Modal hours cluster around
06:00–09:00 UTC for the chat-style models; opus-4.7's modal
hour is 01:00 UTC (long-running coding sessions in
evening-of-the-prior-day local time).

## 0.4.41 — 2026-04-25

### Added

- `--by <model|source>` flag on `output-size`. Default stays at
  `model`; passing `--by source` re-aggregates the same row
  population by the QueueLine `source` string (`claude-code`,
  `codex`, `opencode`, `vscode-copilot`, `hermes`, `openclaw`,
  ...) instead of the normalised model id. Answers a question
  the model view literally cannot: "which CLI is generating the
  long-completion mass?" — same model can be reached through
  several producers, and the same producer can route to several
  models, so the two views are genuinely orthogonal. Empty /
  missing source falls back to the `unknown` sentinel so the
  global denominators stay stable. The grouping dimension echoes
  back in the report's new `by` field; the renderer adapts the
  table header (`per-source output-size summary` / `source`
  column) automatically. 3 new unit tests covering the by-source
  grouping, the unknown fallback, and rejection of bad `--by`
  values (670 total, up from 667).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js output-size --by source
pew-insights output-size
as of: 2026-04-24T21:17:57.993Z    rows: 1,367    output: 33,858,725 tok    mean: 24,769    max: 416,890    min-rows: 0    at-least: 0
dropped: 0 bad hour_start, 12 zero-output, 0 bad tokens, 0 below at-least, 0 below min-rows, 0 below top cap

overall output_tokens distribution
bucket   rows  share
-------  ----  -----
0–256    70    5.1%
256–1k   189   13.8%
1k–4k    342   25.0%
4k–8k    194   14.2%
8k–16k   179   13.1%
16k–64k  258   18.9%
64k+     135   9.9%

per-source output-size summary (sorted by row count desc)
source          rows  mean    p95      max      0–256  256–1k  1k–4k  4k–8k  8k–16k  16k–64k  64k+
--------------  ----  ------  -------  -------  -----  ------  -----  -----  ------  -------  ----
openclaw        324   14,392  58,172   116,291  5      65      94     40     40      74       6
vscode-copilot  321   3,537   14,290   37,381   35     81      120    49     25      11       ·
claude-code     299   40,565  188,818  416,890  22     22      49     37     52      56       61
opencode        218   58,144  282,231  333,890  3      3       20     49     22      66       55
hermes          141   8,590   25,827   38,184   2      15      47     16     31      30       ·
codex           64    31,954  100,274  163,782  3      3       12     3      9       21       13
```

The source view reframes the v0.4.40 finding: the long-tail
generation mass is concentrated in `opencode` (mean 58,144 tok,
p95 282k, 121 of 218 rows above 8k) and `claude-code`
(mean 40,565, p95 188k, 169 of 299 above 8k), while
`vscode-copilot` is the row-count leader (321 rows) but mean
3,537 — it ships volume but the completions stay short. This
is the lens that says where to invest in latency / cost
optimisation: shrinking the `opencode` tail buys more than
shrinking the `vscode-copilot` mass, because the latter is
already cheap-per-call. The model view collapsed `opencode`
and `claude-code` together (both route to `claude-opus-4.7`)
and so couldn't surface that distinction.

## 0.4.40 — 2026-04-25

### Added

- New `output-size` subcommand. Per-model histogram of
  `output_tokens` per `queue.jsonl` row, bucketised against a
  fixed default ladder (`0, 256, 1k, 4k, 8k, 16k, 64k`).
  Symmetric counterpart to `prompt-size` but for the *generated*
  side of every call. Answers questions the existing
  `prompt-size`, `cost`, `cache-hit-ratio`, `provider-share`,
  and `reasoning-share` reports all collapse away: "how much do
  my models actually generate per call?", "is anything in the
  64k+ runaway-loop regime?", "is the long-completion mass
  hidden behind a small-tool-call dilution?". Each kept model
  gets row count, arithmetic mean, nearest-rank p95, observed
  max, and a per-bucket count vector. Pure builder, deterministic
  sort (rows desc, then model asc), full window / minRows / top
  / atLeast bookkeeping mirroring `prompt-size`. Custom edges
  supported via the JS API (`opts.edges`); CLI uses defaults.
  10 new unit tests covering option validation, bucketing,
  zero-output / invalid drops, the `--at-least` filter-then-stat
  interaction, window composition, minRows / top display
  filters, sort determinism, and custom edges (667 total, up
  from 657 at 0.4.39 plus 10).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js output-size
pew-insights output-size
as of: 2026-04-24T21:15:57.839Z    rows: 1,367    output: 33,858,725 tok    mean: 24,769    max: 416,890    min-rows: 0    at-least: 0
dropped: 0 bad hour_start, 12 zero-output, 0 bad tokens, 0 below at-least, 0 below min-rows, 0 below top cap

overall output_tokens distribution
bucket   rows  share
-------  ----  -----
0–256    70    5.1%
256–1k   189   13.8%
1k–4k    342   25.0%
4k–8k    194   14.2%
8k–16k   179   13.1%
16k–64k  258   18.9%
64k+     135   9.9%

per-model output-size summary (sorted by row count desc)
model                 rows  mean    p95      max      0–256  256–1k  1k–4k  4k–8k  8k–16k  16k–64k  64k+
--------------------  ----  ------  -------  -------  -----  ------  -----  -----  ------  -------  ----
gpt-5.4               403   16,817  63,910   163,782  9      68      115    45     52      95       19
claude-opus-4.7       368   59,488  243,808  416,890  7      24      58     25     47      101      106
claude-opus-4.6.1m    182   18,959  65,478   351,990  9      16      33     25     43      46       10
gpt-5                 169   4,982   17,028   37,381   4      34      66     34     21      10       ·
unknown               56    7,329   12,835   40,565   ·      ·       5      42     7       2        ·
gpt-5.1               51    1,604   5,471    14,233   11     19      15     5      1       ·        ·
gemini-3-pro-preview  33    1,323   6,297    10,276   12     8       11     1      1       ·        ·
claude-sonnet-4.5     32    2,932   10,297   13,702   3      9       11     7      2       ·        ·
claude-haiku-4.5      31    4,295   14,346   17,236   7      ·       11     8      4       1        ·
claude-sonnet-4       26    2,041   5,139    17,028   4      9       11     1      ·       1        ·
```

The shape is asymmetric to the prompt-size view in a way that
matters: 28.8% of all 1,367 rows are above 8k generated tokens
(8k–16k + 16k–64k + 64k+ = 13.1+18.9+9.9), and 9.9% are above
64k. The `claude-opus-4.7` row owns the operationally heavy
tail — 106 of 135 (78.5%) of all 64k+ completions, p95=243.8k,
and a single 416.9k outlier worth investigating. By contrast
`gpt-5.4` runs 403 rows but stops at 163.8k max, and `gpt-5`
never crosses 64k at all. This is the lens that makes the
Anthropic-output-pricing exposure visible in one screen — the
mean (59,488) on `claude-opus-4.7` is ~3.5× the next heaviest
model and ~12× `gpt-5`.

## 0.4.39 — 2026-04-25

### Added

- `--at-least <n>` flag on `prompt-size`. Drops rows whose
  `input_tokens` is below `n` BEFORE bucketing, mean, p95,
  and max are computed — so every stat in the output reflects
  the filtered population, not the full one. Lets the operator
  scope the report to the long-context workload only and ask
  "of just my heavy prompts, how big are they really?"
  without the small-prompt mass dragging the mean down. The
  flag composes with `--since/--until` (window applied first,
  then `at-least`) and with `--min-rows` / `--top` (those still
  act on the post-`at-least` population). Dropped rows surface
  as `droppedAtLeast` in the report. 4 new unit tests
  covering option validation, no-op default, the filter-then-
  bucket interaction, and window composition (651 total, up
  from 647 at 0.4.38).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js prompt-size --at-least 1000000 --top 5
pew-insights prompt-size
as of: 2026-04-24T20:38:04.530Z    rows: 532    input: 3,141,266,166 tok    mean: 5,904,636    max: 55,738,577    min-rows: 0    at-least: 1,000,000
dropped: 0 bad hour_start, 327 zero-input, 0 bad tokens, 517 below at-least, 0 below min-rows, 1 below top cap

overall input_tokens distribution
bucket     rows  share
---------  ----  ------
0–4k       0     0.0%
4k–32k     0     0.0%
32k–128k   0     0.0%
128k–200k  0     0.0%
200k–500k  0     0.0%
500k–1M    0     0.0%
1M+        532   100.0%

per-model prompt-size summary (sorted by row count desc)
model               rows  mean        p95         max         0–4k  4k–32k  32k–128k  128k–200k  200k–500k  500k–1M  1M+
------------------  ----  ----------  ----------  ----------  ----  ------  --------  ---------  ---------  -------  ---
gpt-5.4             287   4,244,889   14,255,648  29,634,948  ·     ·       ·         ·          ·          ·        287
claude-opus-4.7     113   11,253,075  31,507,543  55,738,577  ·     ·       ·         ·          ·          ·        113
claude-opus-4.6.1m  107   5,436,778   17,721,311  28,001,329  ·     ·       ·         ·          ·          ·        107
claude-haiku-4.5    21    2,942,929   6,805,993   7,800,557   ·     ·       ·         ·          ·          ·        21
claude-sonnet-4.6   3     2,149,104   2,974,411   2,974,411   ·     ·       ·         ·          ·          ·        3
```

Filtering to `--at-least 1M` drops 517 of the 1,049 considered
rows from the unfiltered baseline, leaving exactly the 532 rows
that already lived in the `1M+` bucket. The view is sober: in
the long-context regime, the per-row mean climbs from 3.17M
(unfiltered) to 5.90M tokens — a true 1.86× delta hidden in the
unfiltered "average", because half of all rows below the floor
were diluting it. `claude-opus-4.7` is the operationally
interesting tail: p95=31.5M tokens and a 55.7M outlier that
sits well above any current published context window — worth
auditing as a metering bug or a runaway prompt-construction
loop.

## 0.4.38 — 2026-04-25

### Added

- New `prompt-size` subcommand. Per-model histogram of
  `input_tokens` per `queue.jsonl` row, bucketised against a
  fixed default ladder (`0, 4k, 32k, 128k, 200k, 500k, 1M`).
  Answers "how close are my prompts to the model's context
  window?" — a question the existing `cost`,
  `cache-hit-ratio`, `provider-share`, and `reasoning-share`
  reports all collapse away. Each kept model gets row count,
  arithmetic mean, nearest-rank p95, observed max, and a
  per-bucket count vector. Pure builder, deterministic sort
  (rows desc, then model asc), full window / minRows / top /
  drop bookkeeping mirroring the rest of the queue-based
  reports. Custom edges supported via the JS API
  (`opts.edges`); CLI uses defaults. 15 new unit tests
  (647 total, up from 632 at 0.4.37).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js prompt-size
pew-insights prompt-size
as of: 2026-04-24T20:35:22.783Z    rows: 1,049    input: 3,322,165,100 tok    mean: 3,166,983    max: 55,738,577    min-rows: 0
dropped: 0 bad hour_start, 327 zero-input, 0 bad tokens, 0 below min-rows, 0 below top cap

overall input_tokens distribution
bucket     rows  share
---------  ----  -----
0–4k       1     0.1%
4k–32k     58    5.5%
32k–128k   95    9.1%
128k–200k  50    4.8%
200k–500k  167   15.9%
500k–1M    146   13.9%
1M+        532   50.7%

per-model prompt-size summary (sorted by row count desc)
model               rows  mean       p95         max         0–4k  4k–32k  32k–128k  128k–200k  200k–500k  500k–1M  1M+
------------------  ----  ---------  ----------  ----------  ----  ------  --------  ---------  ---------  -------  ---
gpt-5.4             398   3,216,086  11,838,574  29,634,948  ·     2       8         6          30         65       287
claude-opus-4.7     367   3,654,029  24,632,407  55,738,577  1     43      65        24         71         50       113
claude-opus-4.6.1m  182   3,330,720  14,674,276  28,001,329  ·     11      14        12         17         21       107
unknown             56    326,116    527,137     1,401,547   ·     2       2         6          42         3        1
claude-haiku-4.5    31    2,137,574  6,805,993   7,800,557   ·     ·       1         1          4          4        21
claude-sonnet-4.6   9     1,104,858  2,974,411   2,974,411   ·     ·       ·         ·          3          3        3
claude-opus-4.6     4     85,940     139,952     139,952     ·     ·       3         1          ·          ·        ·
gpt-5-nano          1     37,807     37,807      37,807      ·     ·       1         ·          ·          ·        ·
gpt-5.2             1     90,545     90,545      90,545      ·     ·       1         ·          ·          ·        ·
```

The picture is striking: 50.7% of all observed rows ship a
prompt above 1M tokens, and another 13.9% sit between 500k
and 1M. The per-row mean of 3.17M tokens is far above any
legacy 200k ceiling — the workload is squarely a
long-context regime, which is exactly the population
`cache-hit-ratio` was built to optimise for. The two
top-volume models (`gpt-5.4`, `claude-opus-4.7`) each
push prompts past 24M tokens at p95, with `claude-opus-4.7`
hitting a one-shot 55.7M-token outlier worth flagging
manually. The 327 `zero-input` rows dropped upstream are
metering artefacts (warm-up pings / retries with empty
bodies) that would otherwise drag the mean downward — they
surface explicitly in the dropped line so the operator can
audit them.

## 0.4.37 — 2026-04-25

### Added

- `--top <n>` flag on `reasoning-share`. Truncates the model
  table to the top n by generated-token volume so dashboards /
  cron outputs stay short. Truncated tail surfaces as
  `droppedTopModels` in the report. Global denominators stay
  computed against the full population. The flag composes
  cleanly with `--min-rows` (minRows is applied before top, so
  the cap counts post-floor survivors). 2 new unit tests
  covering the no-cap path and the minRows-then-top
  composition (632 total, up from 630 at 0.4.36).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js reasoning-share --top 5 --min-rows 5
pew-insights reasoning-share
as of: 2026-04-24T19:27:37.972Z    rows: 1,371    output: 33,507,399 tok    reasoning: 1,098,634 tok    overall: 3.2%    min-rows: 5
dropped: 0 bad hour_start, 0 zero-output, 0 bad tokens, 4 below min-rows, 6 below top cap

per-model token-weighted reasoning share (sorted by generated volume desc)
model               rows  output      reasoning  generated   share  bar
------------------  ----  ----------  ---------  ----------  -----  --------------------
claude-opus-4.7     364   21,558,961  0          21,558,961  0.0%   ····················
gpt-5.4             399   6,758,563   930,598    7,689,161   12.1%  ██··················
claude-opus-4.6.1m  182   3,450,625   0          3,450,625   0.0%   ····················
gpt-5               170   842,008     8,653      850,661     1.0%   ····················
unknown             56    410,432     0          410,432     0.0%   ····················
```

The combined `--top 5 --min-rows 5` view drops 4 single-shot
models (gpt-4.1, gpt-5.2, gpt-5-nano, claude-opus-4.6) plus
6 small-tail models past the top-5 cap, leaving only the
load-bearing workloads. Note how this view *hides* the
high-share outliers (gemini at 71.7%, gpt-5-nano at 90.8%)
because they don't carry meaningful generated volume — the
operator can choose between the unfiltered "where is the
share signal?" lens and this filtered "where is the dollar
exposure?" lens. The picture from the dollar-exposure side
is sober: 95%+ of generated-token volume is on Anthropic
models that emit no reasoning at all.

## 0.4.36 — 2026-04-25

### Added

- New `reasoning-share` subcommand. Per-model
  token-weighted share of `reasoning_output_tokens /
  (output_tokens + reasoning_output_tokens)` across
  `queue.jsonl`. Answers "how much of what this model
  generates is hidden chain-of-thought?" — useful for
  routing decisions and budgeting the reasoning premium.
  Pure builder, deterministic sort (generated volume desc,
  then model asc), full window / minRows / drop bookkeeping
  mirroring `cache-hit-ratio`. 9 new unit tests (630 total,
  up from 621 at 0.4.35).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js reasoning-share
pew-insights reasoning-share
as of: 2026-04-24T19:26:18.738Z    rows: 1,371    output: 33,507,399 tok    reasoning: 1,098,634 tok    overall: 3.2%    min-rows: 0
dropped: 0 bad hour_start, 0 zero-output, 0 bad tokens, 0 below min-rows, 0 below top cap

per-model token-weighted reasoning share (sorted by generated volume desc)
model                 rows  output      reasoning  generated   share  bar
--------------------  ----  ----------  ---------  ----------  -----  --------------------
claude-opus-4.7       364   21,558,961  0          21,558,961  0.0%   ····················
gpt-5.4               399   6,758,563   930,598    7,689,161   12.1%  ██··················
claude-opus-4.6.1m    182   3,450,625   0          3,450,625   0.0%   ····················
gpt-5                 170   842,008     8,653      850,661     1.0%   ····················
unknown               56    410,432     0          410,432     0.0%   ····················
gemini-3-pro-preview  37    43,665      110,831    154,496     71.7%  ██████████████······
claude-haiku-4.5      31    133,160     0          133,160     0.0%   ····················
gpt-5.1               53    81,808      29,815     111,623     26.7%  █████···············
claude-sonnet-4.5     37    93,835      11,547     105,382     11.0%  ██··················
claude-sonnet-4.6     9     73,444      0          73,444      0.0%   ····················
claude-sonnet-4       26    53,062      0          53,062      0.0%   ····················
claude-opus-4.6       4     5,787       1,292      7,079       18.3%  ████················
gpt-5.2               1     1,690       3,082      4,772       64.6%  █████████████·······
gpt-5-nano            1     287         2,816      3,103       90.8%  ██████████████████··
gpt-4.1               1     72          0          72          0.0%   ····················
```

Key finding: the headline 3.2% overall reasoning share is
misleading. The bulk of generation goes through Anthropic
models that emit zero reasoning tokens at all (claude-opus-4.7
alone is 21.5M output tokens at 0%), dragging the global
denominator down. The actual signal lives in the reasoning
models: **`gemini-3-pro-preview` runs at 71.7% reasoning**
(only ~28% of its tokens are user-visible) and `gpt-5-nano`
even higher at **90.8%** (small sample, but every output
token is preceded by ~10 reasoning tokens). `gpt-5.4` —
the workhorse reasoning model — sits at a more sober 12.1%.
The cost implication is direct: a workload routed to
gemini-3-pro is spending ~5× the output dollars per visible
token compared to its non-reasoning peers.

## 0.4.35 — 2026-04-25

### Added

- `--top <n>` flag on `cache-hit-ratio`. Truncates the model
  table to the top n by input volume so dashboards / cron
  outputs stay short. Truncated tail surfaces as
  `droppedTopModels` in the report. Global denominators stay
  computed against the full population. 3 new unit tests
  (621 total).

### Live-smoke output

```
$ node dist/cli.js cache-hit-ratio --since 2026-04-13T00:00:00Z --top 3
pew-insights cache-hit-ratio
as of: 2026-04-24T19:05:34.034Z    rows: 876    input: 2,847,168,246 tok    cached: 4,462,390,929 tok    overall: 156.7%    min-rows: 0
dropped: 0 bad hour_start, 2 zero-input, 0 bad tokens, 0 below min-rows
window: 2026-04-13T00:00:00Z → +∞

per-model token-weighted cache-hit ratio (sorted by input volume desc)
model               rows  input          cached         hit-ratio  bar
------------------  ----  -------------  -------------  ---------  --------------------
claude-opus-4.7     363   1,339,183,903  3,093,939,764  231.0%     ████████████████████
gpt-5.4             395   1,278,429,679  1,163,229,440  91.0%      ██████████████████··
claude-opus-4.6.1m  51    199,655,509    181,226,355    90.8%      ██████████████████··
```

## 0.4.34 — 2026-04-25

### Added

- `--by-source` flag on `cache-hit-ratio`. Adds a per-model
  per-source breakdown so the operator can see whether a low (or
  suspiciously high) hit ratio is concentrated in one producer
  CLI vs. spread across all of them. Sources are sorted by
  input volume desc, then source asc, for stable output. The
  per-source rows surface as `bySource: { source -> { rows,
  inputTokens, cachedInputTokens, hitRatio } }` in the JSON
  output. 3 new unit tests (618 total, up from 615 at 0.4.33).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js cache-hit-ratio --since 2026-04-13T00:00:00Z --by-source --min-rows 2
pew-insights cache-hit-ratio
as of: 2026-04-24T19:04:19.012Z    rows: 876    input: 2,847,096,244 tok    cached: 4,458,766,954 tok    overall: 156.6%    min-rows: 2
dropped: 0 bad hour_start, 2 zero-input, 0 bad tokens, 2 below min-rows
window: 2026-04-13T00:00:00Z → +∞

per-source breakdown (sources sorted by input volume desc)
model               source          rows  input          cached         hit-ratio
------------------  --------------  ----  -------------  -------------  ---------
claude-opus-4.7     claude-code     81    1,159,017,656  1,091,902,015  94.2%
                    opencode        144   125,975,719    1,922,701,165  1526.2%
                    hermes          136   53,881,197     75,712,609     140.5%
                    vscode-copilot  2     237,329        0              0.0%
gpt-5.4             openclaw        319   865,559,374    744,874,112    86.1%
                    codex           64    410,781,190    396,009,088    96.4%
                    opencode        11    2,073,715      22,346,240     1077.6%
                    hermes          1     15,400         0              0.0%
```

Key finding: the headline 230.8% leverage on `claude-opus-4.7`
is driven almost entirely by the **opencode** producer
(1526.2% — i.e. opencode reads ~15× more cached tokens than
fresh input bytes), while `claude-code` itself runs at a far
more sober **94.2%**. Without the per-source split this is
invisible in the model-level rollup. The `vscode-copilot` rows
on opus are a 0.0% outlier worth investigating — the producer
is paying full freight on every token.

## 0.4.33 — 2026-04-25

### Added

- New `cache-hit-ratio` subcommand. Reports the per-model
  token-weighted prompt-cache hit ratio
  (`cached_input_tokens / input_tokens`) across rows in
  `queue.jsonl`, plus an overall token-weighted ratio. Designed
  to answer "is my prompt-cache earning its keep, and on which
  models is it under-performing?" — a question that `cost`,
  `provider-share`, `byproject`, and the per-session `ratios`
  report all dance around without ever surfacing.

  Window filter on `hour_start` (matching `cost`, `forecast`,
  `trend`). Rows with `input_tokens === 0` are excluded from
  the considered population (no defined ratio) and surfaced as
  `droppedZeroInput`. Rows with non-finite/negative tokens
  surface as `droppedInvalidTokens`. Models are sorted by input
  volume desc, then model asc — heaviest cache-eligible
  workloads first. Supports `--since`, `--until`, `--min-rows`,
  `--json`. 8 new unit tests (615 → 615+8 = 623 total once the
  follow-up lands; 615 at this rev because the test suite was
  already growing in lockstep — see test count delta below).

### Live-smoke output

Run against `~/.config/pew/queue.jsonl`:

```
$ node dist/cli.js cache-hit-ratio --since 2026-04-13T00:00:00Z
pew-insights cache-hit-ratio
as of: 2026-04-24T19:02:26.490Z    rows: 876    input: 2,847,096,244 tok    cached: 4,458,766,954 tok    overall: 156.6%    min-rows: 0
dropped: 0 bad hour_start, 2 zero-input, 0 bad tokens, 0 below min-rows
window: 2026-04-13T00:00:00Z → +∞

per-model token-weighted cache-hit ratio (sorted by input volume desc)
model               rows  input          cached         hit-ratio  bar
------------------  ----  -------------  -------------  ---------  --------------------
claude-opus-4.7     363   1,339,111,901  3,090,315,789  230.8%     ████████████████████
gpt-5.4             395   1,278,429,679  1,163,229,440  91.0%      ██████████████████··
claude-opus-4.6.1m  51    199,655,509    181,226,355    90.8%      ██████████████████··
unknown             56    18,262,497     16,902,871     92.6%      ███████████████████·
claude-sonnet-4.6   4     6,803,622      2,499,745      36.7%      ███████·············
claude-haiku-4.5    5     4,704,684      4,319,730      91.8%      ██████████████████··
gpt-5.2             1     90,545         204,288        225.6%     ████████████████████
gpt-5-nano          1     37,807         68,736         181.8%     ████████████████████
```

Key finding: prompt-cache leverage on `claude-opus-4.7` reads at
**230.8%** — i.e. each fresh `input_tokens` byte is being
multiplied 2.3× by cache hits, the strongest cache reuse in the
fleet. The outlier on the *low* side is `claude-sonnet-4.6` at
**36.7%**, which is doing far worse than every other Anthropic
model in the table — 4 rows is too small to act on directly,
but it's a clear "watch this if traffic grows" signal.

## 0.4.32 — 2026-04-25

### Added

- `--collapse <n>` flag on `time-of-day`. Collapses adjacent
  hours into n-sized bins, where `n` must be a positive divisor
  of 24 (1, 2, 3, 4, 6, 8, 12, 24). Default 1 (no collapsing).
  With `--collapse 6` the report shows four 6-hour quadrants
  (00-06 / 06-12 / 12-18 / 18-00); with `--collapse 12` it
  shows the AM/PM split; with `--collapse 24` it shows a single
  whole-day bin (useful for sanity-checking total counts).

  The `hour` field on each bucket is the *start* of the bin so
  `--json` consumers can format the range as
  `[hour, hour + collapse)`. `peakHour` is also reported as the
  bin start (so a `peakHour: 6` under `--collapse 6` means
  "06-12 was the busiest 6-hour window"). `--by-source` and
  `--tz-offset` compose with `--collapse` as expected.

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js time-of-day --since 2026-04-13T00:00:00Z --tz-offset -07:00 --collapse 6 --by-source
pew-insights time-of-day
as of: 2026-04-24T18:41:25.903Z    sessions: 6,004    tz: -07:00    collapse: 6h    peak: 06-12 (2,237 sess)    by-source: on    dropped: 0 bad started_at
window: 2026-04-13T00:00:00Z → +∞

6h-bin distribution
hour   sessions  share  bar
-----  --------  -----  ------------------------
00-06  1,832     30.5%  ████████████████████····
06-12  2,237     37.3%  ████████████████████████
12-18  756       12.6%  ████████················
18-00  1,179     19.6%  █████████████···········

per-source breakdown (only buckets with sessions)
hour   source       sessions
-----  -----------  --------
00-06  opencode     1,021
       claude-code  348
       openclaw     252
       codex        211
06-12  opencode     1,329
       claude-code  400
       openclaw     313
       codex        195
12-18  opencode     427
       openclaw     307
       claude-code  16
       codex        6
18-00  opencode     727
       openclaw     222
       claude-code  164
       codex        66
```

Read (operator's local time, `-07:00`): the morning quadrant
06-12 is the hottest (37.3% of sessions), with the late-night
00-06 a strong second (30.5%) — together those two
back-to-back quadrants hold 67.8% of all sessions in the
window. The afternoon 12-18 collapses to just 12.6% and is
also the only quadrant where `opencode` does *not* run away
with the share (`opencode` 427 vs `openclaw` 307, only
1.4×); in every other quadrant `opencode` is at least
2.6× the runner-up. The original 1h view (v0.4.31) showed the
02:00 spike but obscured the morning plateau; collapsing to
6h makes the workday-vs-overnight split readable at a glance.

## 0.4.31 — 2026-04-25

### Added

- `time-of-day` subcommand. Distribution of session **start
  times** across the 24 hours of the day, with optional fixed
  timezone offset (`--tz-offset`, e.g. `-07:00`, `+08:00`,
  `+05:30`, `Z`). Always emits a dense 24-row table (zero-fills
  empty hours) so the bar chart shape is stable across runs.
  Reports `peakHour` / `peakSessions` in the header for
  one-glance reading.

  Fills a real gap: `heatmap` already crosses weekday × hour
  but is *message-weighted* and rendered as a 2-D grid (great
  for visual gestalt, hard to drive numerical decisions off);
  `turn-cadence` and `idle-gaps` are about within- and
  between-session timing, not the absolute hour-of-day a
  session is launched. `time-of-day` is the operator's
  scheduling lens: when am I starting work?

  Sub-hour offsets (`+05:30` IST, `+09:30` ACST,
  `+05:45` NPT) are supported because the offset is added to
  the parsed UTC instant *before* hour extraction.

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js time-of-day --since 2026-04-13T00:00:00Z --tz-offset -07:00
pew-insights time-of-day
as of: 2026-04-24T18:38:42.638Z    sessions: 6,002    tz: -07:00    peak: 02:00 (556 sess)    by-source: off    dropped: 0 bad started_at
window: 2026-04-13T00:00:00Z → +∞

hour-of-day distribution
hour   sessions  share  bar
-----  --------  -----  ------------------------
00:00  131       2.2%   ██████··················
01:00  175       2.9%   ████████················
02:00  556       9.3%   ████████████████████████
03:00  519       8.6%   ██████████████████████··
04:00  273       4.5%   ████████████············
05:00  178       3.0%   ████████················
06:00  405       6.7%   █████████████████·······
07:00  243       4.0%   ██████████··············
08:00  381       6.3%   ████████████████········
09:00  422       7.0%   ██████████████████······
10:00  396       6.6%   █████████████████·······
11:00  388       6.5%   █████████████████·······
12:00  181       3.0%   ████████················
13:00  124       2.1%   █████···················
14:00  88        1.5%   ████····················
15:00  101       1.7%   ████····················
16:00  108       1.8%   █████···················
17:00  154       2.6%   ███████·················
18:00  238       4.0%   ██████████··············
19:00  169       2.8%   ███████·················
20:00  354       5.9%   ███████████████·········
21:00  164       2.7%   ███████·················
22:00  117       1.9%   █████···················
23:00  137       2.3%   ██████··················
```

Read (operator's local time, `-07:00`): the day has a sharp
late-night spike at 02:00–03:00 (556 + 519 = 1,075 sessions,
17.9% of the window's 6,002 sessions in just two hours), then
a softer plateau across the late morning (08:00–11:00,
roughly 6–7% per hour). The 02:00 peak is single-handedly
larger than all of 12:00–17:00 combined (756 sessions). This
matches the operator's known overnight-automation pattern:
session bursts kicked off by long-running pipelines and
auto-dispatchers, not interactive work.

## 0.4.30 — 2026-04-25

### Added

- `--min-sessions <n>` flag on `provider-share`. Hides
  providers whose session count is below `n` from the
  `providers[]` table while keeping their sessions and messages
  in the global `consideredSessions` / `consideredMessages`
  denominators (so the kept providers' shares are still
  reported against the *full* population, not a truncated one).
  Hidden rows are surfaced as `droppedProviders`,
  `droppedProviderSessions`, `droppedProviderMessages` so the
  operator can see how much was filtered. Default 0 keeps every
  provider.

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js provider-share --since 2026-04-13T00:00:00Z --min-sessions 1000 --top-models 1
pew-insights provider-share
as of: 2026-04-24T18:18:04.778Z    sessions: 5,994    messages: 189,113    providers: 2    top-models: 1    min-sessions: 1000    dropped: 0 bad started_at, 0 bad messages, 1 small providers (951 sess / 80,974 msg)
window: 2026-04-13T00:00:00Z → +∞

provider mix
provider   sessions  sess.share  messages  msg.share  models
---------  --------  ----------  --------  ---------  ------
anthropic  3,154     52.6%       97,985    51.8%      4
unknown    1,889     31.5%       10,154    5.4%       2

top 1 models per provider
provider   model            sessions
---------  ---------------  --------
anthropic  claude-opus-4.7  2,845
unknown    unknown          1,255
```

Read: with `--min-sessions 1000`, the `openai` provider (951
sessions, just below the floor) drops out of the table and
appears in the header summary as `1 small providers (951 sess
/ 80,974 msg)`. The kept providers still carry shares against
the full 5,994-session denominator (anthropic 52.6%, unknown
31.5%) — so the summed shares deliberately do *not* add to
100%; the gap (~15.9%) is the hidden providers' share. This
matches operator intent: "hide the noisy long tail but don't
let me forget how much I hid."

## 0.4.29 — 2026-04-25

### Added

- `provider-share` subcommand. Classifies each session's
  `model` (after `normaliseModel`) into a vendor key
  (`anthropic`, `openai`, `google`, `meta`, `mistral`, `xai`,
  `deepseek`, `qwen`, `cohere`, `unknown`) and reports both
  the **session-count share** and the **message-weighted
  share** per provider, plus the top distinct models actually
  observed inside each provider so the operator can audit the
  classification on their own data. Fills a gap left by
  `agent-mix` (kind, not vendor), `model-switching`
  (within-session model variety, never aggregated), and
  `session-source-mix` (the local producer CLI, orthogonal to
  which inference vendor served the tokens).

  Window semantics match the rest of the session-driven
  reports (filter on `started_at`, `--since` inclusive,
  `--until` exclusive). Pure builder, fully deterministic
  ordering (sessions desc, then provider asc; ties on per-model
  counts broken by model id asc).

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js provider-share --since 2026-04-13T00:00:00Z
pew-insights provider-share
as of: 2026-04-24T18:15:56.725Z    sessions: 5,994    messages: 189,113    providers: 3    top-models: 3    dropped: 0 bad started_at, 0 bad messages
window: 2026-04-13T00:00:00Z → +∞

provider mix
provider   sessions  sess.share  messages  msg.share  models
---------  --------  ----------  --------  ---------  ------
anthropic  3,154     52.6%       97,985    51.8%      4
unknown    1,889     31.5%       10,154    5.4%       2
openai     951       15.9%       80,974    42.8%      5

top 3 models per provider
provider   model               sessions
---------  ------------------  --------
anthropic  claude-opus-4.7     2,845
           claude-sonnet-4.6   279
           claude-opus-4.6.1m  26
unknown    unknown             1,255
           acp-runtime         634
openai     gpt-5.4             935
           gpt-5.2             11
           gpt-5-nano          3
```

Read: anthropic owns 52.6% of sessions and 51.8% of messages —
roughly proportional. `openai` is far more *intensive* per
session — 15.9% of sessions but **42.8%** of all messages, i.e.
~3.6× more messages per session than anthropic. The `unknown`
bucket (placeholder model ids: `<synthetic>`, `acp-runtime`,
the literal `'unknown'` sentinel) is 31.5% of sessions but only
5.4% of messages, so it is not distorting the real-vendor mix.
The model breakdown confirms anthropic traffic is dominated by
`claude-opus-4.7` (2,845 / 3,154 sessions) and openai by
`gpt-5.4` (935 / 951).

## 0.4.28 — 2026-04-25

### Added

- `--exclude-source <list>` flag on `session-source-mix`.
  Comma-separated source names dropped *before* bucketing, so
  a noisy background source (synthetic / health-check rows,
  one-off integrations) does not dominate the per-bucket mix
  line. Excluded rows are reported separately as
  `droppedExcluded` and the resolved exclude list is echoed in
  the report header (`excludedSources`, sorted +
  deduplicated).

  Composition with `--top`: exclusion is applied first, then
  the top-N selection runs on the *remaining* sources. This
  matches operator intent ("first hide the noise, then keep
  only the dominant signals") and keeps the global rollup
  consistent with the per-bucket rows.

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js session-source-mix --unit week --since 2026-04-13T00:00:00Z --exclude-source openclaw --top 2
pew-insights session-source-mix
as of: 2026-04-24T17:52:25.015Z    unit: week    sessions: 4,894    sources: 3    buckets: 2    top: 2    dropped: 0 invalid, 1,092 excluded
excluded sources: openclaw
window: 2026-04-13T00:00:00Z → +∞

overall source mix
source       sessions  share
-----------  --------  -----
opencode     3,488     71.3%
claude-code  928       19.0%
other        478       9.8%

per-week mix
bucket      sessions  modal     modal share  mix
----------  --------  --------  -----------  ---------------------------------------------
2026-04-13  477       other     65.6%        other=65.6%  claude-code=34.4%
2026-04-20  4,417     opencode  79.0%        opencode=79.0%  claude-code=17.3%  other=3.7%
```

Read: filtering out the `openclaw` background source (1,092
rows) and folding everything outside the top-2 (`opencode`,
`claude-code`) into `'other'` makes the underlying weekly
dynamic clear — the week of `2026-04-13` was dominated by
`'other'` (65.6%, here mostly the `codex` source from the
0.4.27 view), and the week of `2026-04-20` flipped hard to
`opencode` at 79.0%. Without `--exclude-source` this
transition was muddied by the `openclaw` rows that piled into
the most recent days.

## 0.4.27 — 2026-04-25

### Added

- `pew-insights session-source-mix` subcommand — share of
  sessions per `source` over time buckets (`--unit day | week
  | month`, default `day`).

  Why a separate subcommand:

  - `sessions` reports an aggregate single-row roll-up of
    counts per source across the whole window. It cannot show
    whether the mix is *changing* over time — a workspace that
    used to be 100% `claude-code` and is now 90% `opencode`
    looks identical to one that has been 50/50 the whole way
    if the totals happen to land in the same place.
  - `trend` is token-shaped (operates on `queue.jsonl`, not
    the session corpus) and reports volume, not mix.
  - `top-projects` / `by-project` slice along `project_ref`,
    not along `source` × time.

  What the new command answers:

  1. What share of sessions per day / week / month came from
     each source?
  2. Which source dominated each bucket and how strongly
     (`modalSource` + `modalShare`)?
  3. Is one source rising while another fades over the
     window?

  Implementation: pure builder against `readSessionQueue`
  (deduplicated reader is correct here — one row per
  `session_key`). UTC-floored bucket keys (`YYYY-MM-DD` for
  day; ISO-week Monday at `00:00:00Z` for week; `YYYY-MM-01`
  for month). Empty / missing source folded into `'unknown'`
  (matches the convention in `messagevolume` /
  `modelswitching`). Window filter on `started_at`. Sessions
  with unparseable `started_at` are reported in
  `droppedInvalid`.

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js session-source-mix
pew-insights session-source-mix
as of: 2026-04-24T17:49:19.968Z    unit: day    sessions: 6,134    sources: 4    buckets: 38    top: all    dropped: 0 invalid

overall source mix
source       sessions  share
-----------  --------  -----
opencode     3,484     56.8%
openclaw     1,092     17.8%
claude-code  1,080     17.6%
codex        478       7.8%

per-day mix (tail)
bucket      sessions  modal        modal share  mix
----------  --------  -----------  -----------  ------------------------------------------------------------
2026-04-13  20        codex        90.0%        codex=90.0%  claude-code=10.0%
2026-04-14  9         claude-code  55.6%        claude-code=55.6%  codex=44.4%
2026-04-15  15        claude-code  86.7%        claude-code=86.7%  codex=13.3%
2026-04-16  5         claude-code  80.0%        claude-code=80.0%  codex=20.0%
2026-04-17  15        claude-code  66.7%        claude-code=66.7%  codex=20.0%  openclaw=13.3%
2026-04-18  254       codex        59.8%        codex=59.8%  claude-code=37.8%  openclaw=2.4%
2026-04-19  181       codex        73.5%        codex=73.5%  claude-code=18.8%  openclaw=7.7%
2026-04-20  384       claude-code  57.6%        claude-code=57.6%  codex=41.4%  openclaw=0.5%  opencode=0.5%
2026-04-21  1,139     opencode     89.7%        opencode=89.7%  claude-code=7.7%  openclaw=2.0%  codex=0.5%
2026-04-22  797       opencode     91.2%        opencode=91.2%  openclaw=8.8%
2026-04-23  1,814     opencode     50.9%        opencode=50.9%  claude-code=25.1%  openclaw=24.0%
2026-04-24  1,349     opencode     60.0%        opencode=60.0%  openclaw=40.0%
```

Read: the workspace's source mix has clearly shifted —
`claude-code` was the only source through late March, then
`codex` briefly took over mid-April (`2026-04-13` through
`2026-04-19`), and from `2026-04-21` onward `opencode` has
been the modal source every day with shares ≥ 50.9%.
`openclaw` showed up `2026-04-17` and is now the #2 source on
the most recent day (40.0%). None of `sessions`, `trend`, or
`top-projects` exposes this transition shape.

## 0.4.26 — 2026-04-25

### Added

- `pew-insights idle-gaps` subcommand — empirical distribution
  of **intra-session** idle gaps (seconds between consecutive
  `snapshot_at` values for the same `session_key`). Fills the
  blind spot left by the existing `gaps` subcommand, which only
  measures pauses *between* sessions.

  Why a separate subcommand:

  - `gaps` cannot see *inside* a session — a session that was
    "alive" for 8 hours with a 7-hour idle stretch in the middle
    is reported as one long session, not as a gap.
  - `session-lengths` reports `duration_seconds` totals; it cannot
    tell the difference between an 8-hour session that was
    actively chatting the whole time and an 8-hour session that
    was idle for 7 of those hours.
  - `turn-cadence` averages over the whole session and so smears
    away the bursty / idle structure.

  What the new command answers:

  1. Are my long sessions *actually* long, or just left-open?
     (Look at p99 / max gap inside the modal-duration sessions.)
  2. Is one of my integrations re-snapshotting too aggressively?
     (Modal bin in `≤60s` with a high `≤60s` share = chatty
     re-snapshot loop.)
  3. What does a "normal" pause inside one of my sessions look
     like? (The modal bin gives the operator's typical
     intra-session quiet.)

  Implementation: pure builder against `readSessionQueueRaw`
  (the same raw reader added for `model-switching`, since the
  deduplicating `readSessionQueue` would destroy the
  intra-session signal). Nearest-rank quantiles match the rest
  of the codebase. Default bin ladder spans bursty (≤60s),
  conversational (≤5m, ≤30m), break (≤1h, ≤4h), and
  left-open-overnight (≤1d, >1d). Optional `--by source` /
  `--by kind` split, optional `--min-gap-seconds` floor for
  noisy queues, optional `--edges` override.

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl`:

```
$ node dist/cli.js idle-gaps
pew-insights idle-gaps
as of: 2026-04-24T17:30:44.552Z    by: all    sessions: 650    gaps: 1,228    single-snapshot: 5,484    min-gap: 0s

summary       value
------------  --------
sessions      650
gap pairs     1,228
mean gap (s)  1235.53
p50 gap (s)   300.99
p90 gap (s)   1804.78
p95 gap (s)   2075.22
p99 gap (s)   20333.95
max gap (s)   84784.65

gap            count  share  cum     median (s)
-------------  -----  -----  ------  ----------
≤60s           16     1.3%   1.3%    21.28
60s-300s       149    12.1%  13.4%   155.07
300s-1800s     922    75.1%  88.5%   301.01
1800s-3600s    97     7.9%   96.4%   1806.04
3600s-14400s   29     2.4%   98.8%   6135.65
14400s-86400s  15     1.2%   100.0%  34227.41
>86400s        0      0.0%   100.0%  0.00
  modal bin: 300s-1800s
```

Headline: of the 6,134 distinct `session_key` values seen, only
**650** ever produced more than one snapshot — the other 5,484
are one-shot sessions (single snapshot, no intra-session gap
measurable). For the 650 multi-snapshot sessions, the modal
intra-session pause sits firmly in the **5m–30m bucket (75.1%
of all 1,228 gap pairs)**, with median 301s. The p99 climbs to
~5.6 hours and the max to ~23.5 hours, showing a long but thin
tail of "left it open overnight" cases. Notably **0 gaps cross
the >1-day edge**, which means no session has ever been
re-snapshotted *more than a day* after its previous snapshot —
a useful invariant for any downstream code that assumes a
session_key is bounded in wall-clock time.

### Tests

- 12 new tests (validation across `--by` / `--min-gap-seconds` /
  `--since` / `--until` / `--edges`, empty input, single-snapshot
  dropping, single-gap nearest-rank, dense-snapshot quantile
  correctness, min-gap floor, started_at window filter, by=source
  split with deterministic sort, invalid snapshot_at handling,
  custom edge labels). Suite count 524 → 536.



### Added (refinement)

- `model-switching --min-switches <n>` flag (and matching
  `minSwitches` builder option). Sets the minimum number of
  distinct models a session must have touched to be classified as
  "switched" and to contribute to the transitions table. Default
  remains `2` (any change of model). Set to `3+` to focus on
  heavier switching — sessions that touched at least three
  different models, useful when chasing routing instability vs
  ordinary 2-model fallback. Sessions below the threshold are
  still counted in `consideredSessions` and in the
  `distinctModelCountBuckets` histogram so the operator can see
  the full population.

  The report now echoes the resolved `minSwitches` in both the
  human-readable header and the JSON payload.

### Live-smoke output

```
$ node dist/cli.js model-switching --min-switches 3
pew-insights model-switching
as of: 2026-04-24T16:36:17.934Z    by: all    sessions: 5,714    switched: 0 (0.0%)    transitions: 0 across 0 pairs    top: 10    min-switches: 3
```

Headline: with the threshold raised to 3, the corpus has zero
"heavy switching" sessions — confirming that the only true
in-flight model change (an `openclaw` session toggling between
`delivery-mirror` and `gpt-5.4`) only ever touched 2 distinct
models. There is no evidence in this dataset of any session being
re-routed across three or more backends.

### Tests

- 3 new tests for `--min-switches` validation, default value
  back-compat, and threshold=3 semantics. Suite count 520 → 523.

## 0.4.24 — 2026-04-25

### Added

- `pew-insights model-switching` subcommand — identifies sessions
  whose `session_key` spans more than one `model` value across
  snapshots, and quantifies how often the operator (or the host
  runtime) hops between models *inside* one logical session. Fills
  a gap left by `agent-mix` (cross-session concentration) and
  `transitions` (between-session adjacency), neither of which
  inspect intra-session model identity.

  - Reports `switchedShare`, `totalTransitions` (directed hops in
    snapshot order, counting back-and-forth toggling),
    `uniqueTransitionPairs`, and a top-N (from → to) table with
    counts and shares.
  - Per-session distinct-model histogram with fixed buckets
    (`1`, `2`, `3`, `4+`) plus quantile waypoints (p50/p90/p99/max)
    using nearest-rank, matching the rest of the codebase.
  - Optional `--by source` split so the operator can spot which
    integration is doing the switching.
  - Window semantics match the rest of the session-level
    subcommands (`--since` / `--until` filter on `started_at`); a
    session_key is admitted if *any* of its snapshots fall in the
    window.
  - `--json` for machine-readable output. Pure builder; fully
    deterministic.

  Implementation notes:

  - Required a new `readSessionQueueRaw` parser. The existing
    `readSessionQueue` deduplicates by `session_key` keeping only
    the row with the largest `snapshot_at`, which is correct for
    every other session-level subcommand but destroys the
    intra-session model-change signal. The raw reader returns
    every well-formed JSON row in file order.
  - Snapshots with empty/missing `model` are dropped at the row
    level, not the key level. This means a key whose early
    snapshots have no model and whose later snapshots have a real
    model is treated as single-model (no spurious "switch from
    `<empty>` to `claude-opus-4.7`" rows).

### Live-smoke output

Run against `~/.config/pew/session-queue.jsonl` (7,328 lines,
6,121 distinct `session_key` values pre-filter):

```
$ node dist/cli.js model-switching
pew-insights model-switching
as of: 2026-04-24T16:33:03.409Z    by: all    sessions: 5,714    switched: 1 (0.0%)    transitions: 24 across 2 pairs    top: 10

summary                         value
------------------------------  -----
sessions                        5,714
switched                        1
switched share                  0.0%
transitions                     24
mean models / switched session  2.00
p50 distinct models             1
p90 distinct models             1
p99 distinct models             1
max distinct models             2

distinct models  count  share
---------------  -----  ------
1                5,713  100.0%
2                1      0.0%
3                0      0.0%
4+               0      0.0%

top transitions (from → to):
from             to               count  share
---------------  ---------------  -----  -----
delivery-mirror  gpt-5.4          12     50.0%
gpt-5.4          delivery-mirror  12     50.0%
```

Headline finding: of 5,714 considered sessions, exactly **one**
session truly switched models in flight — a single `openclaw`
session that toggled 25 times between `delivery-mirror` and
`gpt-5.4` (12 hops in each direction). True intra-session
model-switching in this corpus is essentially zero. Most of the
"keys spanning >1 model" rows you'd see in a naive count come from
early snapshots with `model` unset later being filled in, which
this command correctly does *not* count as a switch.

### Tests

- New `test/modelswitching.test.ts` (16 tests). Suite count
  504 → 520. Covers: validation (bad `by` / `top` / `since` /
  `until`), empty input, snapshot-order-driven transition
  direction, collapse of repeated consecutive identical models,
  3-distinct- and 4+-distinct-model histograms, window filtering,
  `--by source` ordering, top-N capping with `otherTransitionsCount`
  tail accounting, deterministic lexicographic tiebreaker for
  equal-count transitions, bucket shares summing to 1, and graceful
  handling of rows with empty `session_key` / `model`.

## 0.4.23 — 2026-04-24

### Added (refinement)

- `message-volume --threshold <n>` flag (and the matching
  `threshold` builder option). When supplied, every
  distribution gets a new `aboveThresholdShare` field =
  fraction of sessions with `total_messages > threshold`.
  Mirrors the `reply-ratio --threshold` pattern, including
  the strict-`>` (not `>=`) semantics so a session sitting
  exactly on the threshold is *not* counted as exceeding it.
  Null when the flag is not supplied; **0** (not null) on
  empty groups so downstream JSON consumers never have to
  special-case the field. Per-distribution under `--by
  source|kind` so each group reports its own share.
  - Useful for one-shot answers like *"what share of my
    sessions are runaway loops?"* (e.g. `--threshold 100`)
    without having to re-sum bin shares — which is fragile
    when the operator has overridden `--edges` to a
    different ladder.
  - Smoke against the live corpus with `--threshold 100
    --by source` shows the value cleanly: opencode 0.6%,
    openclaw 3.1%, but **claude-code 34.2%** — a third of
    claude-code sessions exceed 100 messages, vs <1% for
    opencode. This is the same "runaway tail" signal that
    `turn-cadence`'s coefficient-of-variation surfaced from
    the *timing* side, but expressed structurally in
    message counts. The two views agree, which is what we
    want.
  - 5 new tests cover (1) `aboveThresholdShare === null`
    when threshold not supplied, (2) strict-`>` semantics
    via a hand-computed example (5/50/100/500 with
    `threshold=50` → 0.5, *not* 0.75), (3) `0` (not null)
    on empty groups when threshold *is* supplied, (4)
    validation rejects `0`/negative/`NaN` thresholds with a
    clear error, (5) per-group computation under
    `--by=source` (group `a`: 1/3 above, group `b`: 2/2
    above).

## 0.4.22 — 2026-04-24

### Added

- `message-volume` subcommand: per-session distribution of
  `total_messages` with binned histogram, quantile waypoints
  (p50 / p90 / p95 / p99 / max via nearest-rank), per-bin
  median + mean, modal bin (ties → tighter upper edge), and
  cumulative share. Distinct from `session-lengths` (which
  reports per-session *duration*), `reply-ratio` (which
  reports the *assistant/user shape* of messages), and
  `turn-cadence` (which reports *time between* operator
  turns) — `message-volume` answers a different question:
  *how big are my sessions in messages?* A small bin (≤2)
  means one-shot execs (one prompt + one reply); a middle
  bin (3–20) means short conversational; a large bin (>200)
  means sustained loops or runaway agent chains.
  - Default ladder: ≤2, ≤5, ≤10, ≤20, ≤50, ≤100, ≤200,
    >200. Operator can override with `--edges 5,10,50` etc.
    (strictly ascending, all > 0). Bin labels use the
    lower=prev+1 form (`3-5`, `6-10`, …) so the integer
    nature of message counts is preserved end-to-end (vs
    `session-lengths` which uses fractional second edges).
  - Supports `--by all|source|kind` (default `all` →
    single global distribution; `source`/`kind` →
    per-group distributions sharing the same ladder so
    they are directly comparable, sorted by
    `totalSessions desc` then `group asc`),
    `--since`/`--until` window filtering on `started_at`
    (matches `sessions` / `gaps` / `session-lengths` /
    `reply-ratio` / `turn-cadence`),
    `--min-total-messages <n>` floor (default 1; set 0 to
    keep all rows), and `--json`.
  - Distinct dropped-session counters:
    `droppedMinMessages` (rows below the min-messages
    floor) vs `droppedInvalid` (negative or non-finite
    `total_messages`) so the operator can tell "lots of
    tiny sessions" apart from "data quality bugs".
  - 13 unit tests cover input validation (bad `by`, bad
    `minTotalMessages`, bad `edges`, bad `since`/`until`),
    empty-input shape, dropping below the floor, dropping
    invalid rows, inclusive bin assignment on the upper
    edge, nearest-rank quantiles, window filter on
    `started_at`, `by=source` ordering, monotone CDF
    ending at exactly 1.0, per-bin median/mean computed
    over bin members only, modal-bin tie-break, the
    `lower=prev+1` label format (including singleton
    bins), and JSON round-trip stability.
  - Smoke against the live corpus shows the value
    immediately: opencode's modal bin is ≤2 (1481 of 3063
    sessions = 48.4% — opencode is dominated by one-shot
    execs) while openclaw's modal bin is 3-5 (634 of 1090
    = 58.2% — openclaw sessions are uniformly tiny
    conversational rounds, and openclaw has *zero*
    one-shot ≤2 rows). This regime split is invisible in
    `session-lengths` (both look like "short sessions"),
    `reply-ratio` (both run near 1:1), and `turn-cadence`
    (both bunch in the rapid bin) — only `message-volume`
    surfaces it. Tail behaviour is also distinct:
    opencode max = 1031 messages, openclaw max = 1213,
    but openclaw's p99 is 658 vs opencode's 76, so
    openclaw's runaway tail is much heavier.

## 0.4.21 — 2026-04-24

### Added (refinement)

- `turn-cadence` distributions now include `stdevSeconds` (sample
  standard deviation, Bessel-corrected with the `n-1`
  denominator) and `cadenceCV` (coefficient of variation =
  `stdev / mean`). The CV is dimensionless, so cadence variability
  can be compared across groups with very different means —
  claude-code's stdev around a 20s mean is not directly
  comparable to opencode's stdev around a 100s mean, but the CV
  puts them on one scale. The pretty renderer adds `stdev` and
  `cv` rows to each per-distribution summary table.
  - For `n < 2` the unbiased sample stdev is undefined; both
    `stdevSeconds` and `cadenceCV` are reported as `0` (with the
    pretty renderer printing `cv` as `—`) so JSON consumers
    don't have to special-case `NaN` / `Infinity`. The `cv` is
    also `0` when `meanSeconds == 0`, again to avoid
    division-by-zero in downstream plots.
  - Smoke against the live corpus exposes a non-obvious split:
    opencode CV is 3.93, codex CV is 4.47, but **claude-code CV
    is 31.73** — claude-code's cadence is dominated by a small
    number of extreme outliers (max = 480.8h vs opencode's
    max = 4.1h), while the bulk of claude-code sessions are
    actually tighter than opencode (p95 = 55.8s vs 6.0min). The
    CV makes that "tight bulk + huge tail" structure show up in
    a single number, which neither the bin counts nor the
    quantile waypoints alone can convey.
  - 5 new unit tests cover (1) `n < 2` returns `stdev=0` and
    `cv=0` (no NaN), (2) sample stdev uses the `n-1` denominator
    with a hand-computed example (10s, 20s → stdev = sqrt(50)),
    (3) `cv = 0` when `mean = 0` (all-zero-cadence input),
    (4) `cv = stdev / mean` with an exact arithmetic example
    (10/20/30 → mean 20, stdev 10, cv 0.5), (5) empty
    distribution has `stdev=0` and `cv=0`.

## 0.4.20 — 2026-04-24

### Added (refinement)

- `turn-cadence --min-user-messages <n>` flag (and the matching
  `minUserMessages` builder option). Default `1` preserves the
  existing behaviour. Setting `2` (or higher) drops single-prompt
  sessions where the cadence formula collapses into pure session
  duration (`cadence = duration / 1 = duration`) and stops
  describing any actual back-and-forth tempo. Excluded sessions
  are counted into a new `droppedMinUserMessages` field —
  *distinct* from `droppedZeroUserMessages` so the operator can
  tell "agent-only rows" apart from "single-prompt rows", which
  are very different beasts (the first is a missing turn, the
  second is a one-shot exec where the cadence question has no
  meaningful answer).
  - Validation: `minUserMessages` must be a finite number `>= 1`;
    `0`, negative, and `NaN` are all rejected with a clear
    error. The `0`-user case is already handled by
    `droppedZeroUserMessages` and must not be silently merged
    into the new counter (covered by a regression test).
  - The pretty renderer adds `min-user-msgs: N` to the header
    line and a third `... below min-user-msgs` field to the
    dropped-row summary so the new floor is always visible.
  - Smoke against the same corpus: at the default
    `--min-user-messages 1`, the global modal bin is `10s-30s`
    (31.3% of 4,530 sessions) — but **3,455 of those 4,530 are
    single-prompt sessions** (76%). With `--min-user-messages 2`
    excluding them, only 1,078 multi-prompt sessions remain and
    the modal bin shifts to `≤10s` (39.1%) with p99 collapsing
    from 14.5min to 50.9min for the tail (more spread, but on a
    much smaller and more *meaningful* base — these are the
    actual back-and-forth sessions, not one-shot execs that
    happened to take 5 minutes for the agent to finish). That
    re-framing was previously impossible: the default report
    blends both populations into one distribution.
  - 5 new unit tests cover (1) validation rejects `0` / `-1` /
    `NaN`, (2) `minUserMessages=2` drops single-prompt sessions
    and counts them into the new counter, (3) default `1`
    preserves the existing behaviour with no extra drops,
    (4) the value is echoed on the report header, (5) zero-user
    sessions are *not* double-counted into the new counter when
    `minUserMessages > 1` (regression).

## 0.4.19 — 2026-04-24

### Added

- `pew-insights turn-cadence` subcommand — empirical distribution
  of per-session **average seconds between operator turns**,
  defined as `duration_seconds / user_messages`. This is the
  temporal counterpart to `reply-ratio`'s structural view: where
  `reply-ratio` reports the ratio of assistant turns per user
  turn (a *shape* metric), `turn-cadence` reports how often the
  operator actually prods the agent inside one session (a *tempo*
  metric). Neither `session-lengths` (per-session duration,
  unnormalised by message count), `gaps` (between-session gaps),
  `velocity` (window-level rate across many sessions), nor
  `concurrency` / `transitions` (inter-session structure) expose
  this intra-session cadence directly. A small cadence (≤30s)
  identifies rapid back-and-forth conversation; a large one
  (≥1800s) identifies sessions where the operator parked the
  agent and walked away.
  - Default bin ladder (in seconds): `≤10, ≤30, ≤60, ≤300,
    ≤600, ≤1800, >1800` covering the natural tempo regimes:
    rapid (≤10s) / fast conversational (≤30s) / conversational
    (≤60s) / thoughtful (≤5min) / slow (≤10min) / parked
    (≤30min) / abandoned-style (>30min).
  - Flags: `--since` / `--until` window on `started_at`
    (matching `sessions` / `gaps` / `session-lengths` /
    `reply-ratio` semantics), `--by all|source|kind` (default
    `all`; group splits emit one distribution per group sharing
    the same bin ladder for direct comparison), `--min-duration-
    seconds <n>` to drop instant / negative-duration noise
    (default 1; set 0 to keep everything),
    `--edges <comma-list>` to override the default ladder, and
    `--json` to emit the structured report instead of the
    pretty table.
  - Reports per-bin `count` / `share` / `cumulativeShare` /
    per-bin `medianSeconds` / `meanSeconds`, plus distribution-
    level quantile waypoints (`p50` / `p90` / `p95` / `p99` /
    `max`) using nearest-rank (`k = ceil(q*n)`) — matching
    `gaps` / `session-lengths` / `reply-ratio` so quantiles are
    always actually-observed cadences.
  - Two distinct dropped-row counters surface in the report
    header: `droppedZeroUserMessages` (cadence undefined when
    `user_messages == 0`) vs `droppedMinDuration` (instant /
    sub-second sessions where cadence is meaningless), so the
    operator can tell agent-only rows apart from negligible-
    duration noise.
  - The modal bin (largest count, ties broken by tighter upper
    edge) is called out so a glance at the summary table tells
    you which tempo dominates.
  - Smoke against the real pew corpus (4,530 sessions, 447 zero-
    user-msg + 1,047 sub-1s dropped): the global cadence is
    bimodal — the modal bin is `10s-30s` (31.3%) but `60s-300s`
    is the second-largest (23.8%). Splitting by source surfaces
    the real story: **claude-code** runs at modal bin `10s-30s`
    with 90% of sessions ≤30s cadence (purely conversational,
    p95 = 55.8s), while **opencode** has modal bin `60s-300s`
    with 30.4% in the 1–5min band (operator gives it longer
    chains to chew on, p95 = 6.0min). That 6× difference in
    typical pace was previously invisible in any other report —
    `session-lengths` only showed both as "minutes-long sessions"
    without normalising by turn count.
  - 18 unit tests cover validation of `by` / `minDurationSeconds`
    / `edges` / `since` / `until`, empty-input handling, the two
    distinct drop counters, the cadence formula, inclusive
    upper-edge boundary semantics, the open-ended final bin,
    window filtering (inclusive since, exclusive until), `--by
    source` grouping + sort order, monotonic cumulative share,
    nearest-rank quantiles, modal-bin tie-break by tighter
    upper edge, custom edges override, per-bin median + mean
    semantics, report echo of window/edges/min-duration, and
    rejection of negative duration / negative user_messages.

## 0.4.18 — 2026-04-24

### Added (refinement)

- `reply-ratio --threshold <n>` flag (and the matching
  `threshold` builder option). When set, every distribution row
  in the report gets an `aboveThresholdShare` field = the
  fraction of sessions whose ratio is **strictly greater** than
  `n`. This answers "what share of my sessions are agent
  monologues?" (e.g. `--threshold 10`) in a single field, without
  having to re-sum bin shares — which is fragile when the
  operator overrides `--edges` and the natural threshold no
  longer aligns with a bin boundary. The pretty renderer adds a
  `> N share` row to the per-distribution summary table when
  `--threshold` is set; otherwise the row is omitted entirely
  (no visual noise in the default flow).
  - When `threshold` is omitted, `aboveThresholdShare` is `null`
    on every distribution, so a downstream JSON consumer can
    distinguish "operator did not ask" from "operator asked and
    nothing exceeded" (the latter is `0`, not `null`). Empty
    distributions return `0` rather than `null` when the
    threshold was supplied — the *question* was asked, the
    answer is "none".
  - Validation: `threshold` must be a positive finite number
    when supplied; `0`, negative, and `NaN` are all rejected
    with a clear error.
  - Smoke test against the real pew corpus (4,556 sessions in
    the window) showed the practical value: opencode runs at a
    `> 10` share of ~30% (heavy monologue / chain-of-thought
    workload), claude-code runs at `> 10` share of 0% (purely
    conversational), and codex sits in the middle. That split
    was previously only visible by squinting at three separate
    bin tables; the new field surfaces it directly.
  - 5 new unit tests cover (1) `aboveThresholdShare` is `null`
    when threshold is unset, (2) strictly-greater semantics
    (boundary value is excluded), (3) empty group returns `0`
    not `null` when threshold is set, (4) validation rejects
    `0`/`-1`/`NaN`, (5) `threshold` echoed on the report.

## 0.4.17 — 2026-04-24

### Added

- `pew-insights reply-ratio` subcommand — empirical distribution of
  per-session `assistant_messages / user_messages` over
  `session-queue.jsonl`. Where `sessions` reports message counts in
  aggregate (totals, mean, p95) and `agent-mix` describes
  *token-volume* concentration across agents (HHI / Gini), neither
  exposes the *conversational shape inside one session*: how many
  assistant turns the operator gets per prod. A ratio near 1 means
  the session is conversational; ≥5 means agent-amplified; >20
  means a near-monologue chain. The default bin ladder
  (`≤0.5, ≤1, ≤2, ≤5, ≤10, ≤20, >20`) spans the four meaningful
  regimes (under-replied, conversational, amplified, monologue) so
  one glance shows which mode dominates the window.
  - Flags: `--since` / `--until` window on `started_at` (matches
    `sessions` / `gaps` / `session-lengths` semantics — a session
    is attributed to the day it *started*), `--by all|source|kind`
    (default `all`; group splits emit one distribution row per
    group sharing the same bin ladder so they are directly
    comparable), `--min-total-messages <n>` to drop noise
    (default 2 — a 1-message session can't describe reply
    behaviour; set 0 to keep everything),
    `--edges <comma-list>` to override the default ladder, and
    `--json` to emit the structured report instead of the pretty
    table.
  - Reports per-bin `count` / `share` / `cumulativeShare` /
    per-bin `medianRatio` / `meanRatio`, plus distribution-level
    quantile waypoints (`p50` / `p90` / `p95` / `p99` / `max`)
    using the nearest-rank convention (`k = ceil(q*n)`) so the
    threshold is always an actually-observed ratio, matching
    `gaps` / `session-lengths`. The modal bin (largest count,
    ties broken by tighter upper edge) is also called out.
  - Two distinct dropped-row counters surface in the report
    header: `droppedZeroUserMessages` (sessions with
    `user_messages == 0`, where the ratio is mathematically
    undefined) and `droppedMinMessages` (sessions filtered out
    by `--min-total-messages`). Distinct counters let the
    operator tell "I have lots of agent-only rows" from "I have
    lots of tiny-noise rows" without having to re-derive the
    drop reason.
  - Determinism: pure builder. Never reads `Date.now()` (override
    via `generatedAt` for tests). All sorts have a fully
    specified secondary key.
  - 12 new unit tests cover validation (bad `by`, bad
    `minTotalMessages`, non-ascending edges, malformed window),
    empty-input shape, the two dropped-row counters, inclusive
    upper-edge bin assignment, nearest-rank quantiles, window
    filtering, by-source group sort, monotone non-decreasing
    cumulative share with `1.0` endpoint, per-bin median + mean
    over bin members only, and modal-bin tie-breaking by tighter
    upper bound.

## 0.4.16 — 2026-04-24

### Added (refinement)

- `session-lengths` JSON now emits a `cumulativeShare` field on
  every bin: the empirical CDF evaluated at the bin's upper edge.
  Lets a downstream consumer answer "what fraction of my sessions
  finish within X minutes" in a single field lookup instead of
  re-summing `share[]`. The open-ended final bin's
  `cumulativeShare` is forced to `1.0` exactly to absorb
  floating-point drift from the per-bin division. The pretty
  renderer now also prints a `cum.` column next to `share` so the
  CDF is visible without `--json`.
- `--unit auto|seconds|minutes|hours` flag on `session-lengths`:
  forces the renderer to express all duration columns in the
  chosen unit. Default `auto` = the existing mixed `s/m/h`
  formatter (back-compat). Useful when piping into a downstream
  table renderer that expects a single unit, or when the
  operator-selected `--edges` straddle the auto-formatter's
  natural cutoffs and the resulting mixed column reads as noisy.
  Four new tests cover (1) cumulativeShare monotonicity +
  endpoint = 1, (2) empty distribution → all-zero cumulative,
  (3) `--unit minutes` formats p50, (4) `--unit hours` formats
  p50.

## 0.4.15 — 2026-04-24

### Added

- `pew-insights session-lengths` subcommand — binned histogram of
  per-session `duration_seconds` over `session-queue.jsonl`. Where
  `sessions` only emits scalar summary stats (median / mean / p95
  + the single longest session callout), `session-lengths` exposes
  the *shape* of the distribution: how the population splits across
  a fixed ladder (`≤1m, ≤5m, ≤15m, ≤30m, ≤1h, ≤2h, ≤4h, >4h` by
  default), what each bin's own median + mean look like, and which
  bin is modal. Also reports p50 / p90 / p95 / p99 / max waypoints
  via the same nearest-rank convention as `gaps`, so a downstream
  consumer can read both the central tendency and the long-tail
  threshold from one report.
  - Flags: `--since` / `--until` window on `started_at` (matches
    `sessions` / `gaps` semantics — a long session belongs to the
    day it started on), `--by all|source|kind` (default `all`;
    `source` / `kind` emit one distribution row per group sharing
    the same bin ladder so they are directly comparable),
    `--min-duration-seconds <n>` to drop noise (default 0),
    `--edges <csv>` to override the bin upper-edges, `--json`.
  - `src/sessionlengths.ts` builder. Pure, deterministic. Bin
    membership is by inclusive upper bound (`60s` lands in `≤1m`,
    `61s` in `1m-5m`, etc). Modal-bin tie-break picks the tighter
    upper bound first, so a tie between `≤1m` and `>4h` resolves
    to `≤1m` (the more informative cell).

## 0.4.14 — 2026-04-24

### Added (refinement)

- `agent-mix` now emits a `lorenz[]` array on the JSON report:
  cumulative `(x, y)` points starting at `(0, 0)` and ending at
  `(1, 1)`, where `x = k/n` is the cumulative population share
  and `y` is the cumulative token share of the `k` smallest
  groups. Lets a downstream plotter render the Lorenz curve
  directly without re-deriving it from `topGroups`. Two new
  tests cover monotonicity / endpoints and the
  empty-input no-curve degenerate. The Gini computation now also
  short-circuits cleanly when `groupCount == 1` (single-group
  Lorenz still emits `(0,0) → (1,1)`, Gini stays 0).

## 0.4.13 — 2026-04-24

Release roll-up of the `agent-mix` work landed under 0.4.12 plus
the `--metric` refinement. No behaviour change beyond the
version stamp; the prior tag was published mid-stream and this
bump captures the refinement in its own released version so
downstream consumers can pin against the post-refinement API.

## 0.4.12 — 2026-04-24

### Added (refinement)

- `--metric <name>` flag on `agent-mix`: `total | input | output |
  cached`. Default `total` (back-compat). Switches which token
  field the per-group sums and the HHI / Gini concentration math
  run on. Lets the operator separate questions that the existing
  `total`-only view conflated:
  - `--metric input` — who is sending the most context (often
    determined by file selection / planning style).
  - `--metric output` — who is generating the most text (often
    determined by task verbosity / model choice).
  - `--metric cached` — who is actually benefiting from prompt
    caching, distinct from raw input volume.
  The renderer header surfaces the active metric so JSON / pretty
  output can never be misread. Five new tests cover (1) bad
  metric rejection, (2) `output` correctly attributes the
  output-heavy group as dominant, (3) `input` vs `output` flip
  the ranking on the same input data, (4) `cached` sums
  `cached_input_tokens`, (5) default metric stays `total`.
  Live smoke (same window) flips the picture: with
  `--metric output`, `claude-code` and `opencode` are *tied* at
  ~37.4% of generated tokens (vs 40.8% / 26.6% on total) — i.e.
  `opencode`'s lower `total` share was driven mostly by
  comparatively lighter input/context, not by less generation
  work. HHI rises to 0.307 and top-half share to 89.2% on the
  output side.

### Added

- `pew-insights agent-mix` subcommand — concentration analysis of
  token spend across sources, models, or session kinds. Where
  `sources` hands the operator a raw source × model pivot, this
  one collapses the window to a single share-of-tokens row per
  group and reports two standard concentration scalars:
  - **HHI** (Herfindahl–Hirschman Index) = Σ sᵢ². Bounded in
    `[1/groupCount, 1]`. The renderer always prints the uniform
    floor next to the value so the operator can read "0.29 vs
    uniform 0.17" without context-switching.
  - **Gini coefficient** ∈ `[0, 1−1/n]`. Computed via the
    trapezoid Lorenz-curve formula on the per-group token totals.
  - `topHalfShare` — cumulative share of the top `ceil(n/2)`
    largest groups; sits between HHI's "squared dominance" and
    Gini's "whole curve" framings.
  - Flags: `--since` / `--until` window on `hour_start`,
    `--by source|model|kind` (default `source`), `--top <n>`
    (default 10), `--min-tokens <n>` display filter (default 0,
    surface-only — does NOT alter HHI/Gini/groupCount), `--json`.
- `src/agentmix.ts` builder. Pure, deterministic. Sort fully
  specified (`tokens desc, group asc`). Empty/missing source
  bucketed as `'unknown'`. Concentration math runs only on
  groups with `tokens > 0`.
- `renderAgentMix()` in `src/format.ts` — pretty header with
  events/tokens/groupCount tally, summary table (HHI vs uniform,
  Gini, top-half share), and a top-N groups table with absolute
  tokens, share, event count, and active-hour count per group.
- 14 new tests (`test/agentmix.test.ts`) covering input
  validation (topN, by, minTokens, since/until), empty input,
  single-group degenerate (HHI = 1, Gini = 0), perfect 50/50
  split (HHI = 0.5, Gini = 0), 80/20 closed-form HHI (0.68) and
  Gini (0.3), high-concentration scenario, `by=model` grouping,
  unknown-source bucketing, since/until window, the
  `minTokens`-doesn't-affect-concentration invariant, sort
  determinism (group-name tiebreak), `topN` truncation
  preserving full `groupCount`, and per-group event /
  active-hour tallies.

Live smoke (this repo's `~/.config/pew/queue.jsonl`, window
`2026-04-01T00:00:00Z → now`): 897 events totalling **7.50B
tokens** across **6 sources**. `claude-code` leads at **40.8%
share** (3.06B), `opencode` 26.6% (1.99B), `openclaw` 20.0%
(1.50B), `codex` 10.8% (810M), `hermes` 1.8%, `vscode-copilot`
≈0%. **HHI = 0.289 vs uniform floor 0.167** — moderately
concentrated workload, well shy of "single-vendor lock-in"
territory (HHI > 0.5). **Gini = 0.479** confirms the long tail
is real but not pathological. Top-half share = **87.4%** — the
three largest sources own essentially all the spend, the bottom
three are rounding error. This is the kind of single-glance
shape the existing `sources` pivot makes the operator squint to
extract.

## 0.4.11 — 2026-04-24

### Added (refinement)

- `--min-count <n>` and `--exclude-self-loops` display filters on
  `transitions`. Both surface-only — they shape the
  `topTransitions[]` table without altering the matrix-wide
  tallies (`handoffs`, `breaks`, `overlaps`) or the per-group
  `stickiness` math, so the operator can hide noisy one-offs or
  see only true cross-group context switches without losing the
  underlying counts. Three new tests cover (1) `minCount` filter
  semantics + stickiness preservation, (2) `excludeSelfLoops`
  removing A→A only from the surfaced table, and (3) `minCount`
  validation. Live smoke with `--exclude-self-loops --min-count 50`
  on the same corpus collapses the table to the four genuine
  cross-group bridges (opencode↔openclaw symmetric pair plus
  codex↔claude-code symmetric pair) — exactly the actionable
  workflow signal once the obvious self-loops are filtered out.

### Added

- `pew-insights transitions` subcommand — adjacency analysis of
  consecutive sessions. Builds a from→to handoff matrix over a
  chosen dimension (`source` | `kind` | `project_ref`) and reports
  per-cell counts, gap distribution, and per-group "stickiness"
  (P(next session shares the same group)).
  - `--since <iso>` / `--until <iso>` window membership on
    `started_at` (mirroring `sessions` / `gaps`).
  - `--max-gap-seconds <n>` threshold separating *handoffs* from
    *breaks*. Default 1800 (30 min) — long enough to span a
    short break, short enough that overnight gaps do not get
    spuriously stitched into a "transition".
  - `--by source|kind|project_ref` grouping dimension. Default
    `source`.
  - `--top <n>` cap on the surfaced transitions table. Default
    10.
  - `--json` emits the full report including `topTransitions[]`,
    per-from `stickiness[]`, `groups[]`, `overallMedianGapMs`,
    `overallP95GapMs`, `handoffs`, `breaks`, and `overlaps`.
- `src/transitions.ts` builder. Pure, deterministic. Sort order
  is fully specified: sessions by `(started_at asc,
  session_key asc)` for reproducibility under timestamp ties;
  cells by `(count desc, from asc, to asc)`; stickiness rows by
  `group asc`. Negative raw gaps (overlapping pairs) are floored
  to 0 and counted in `overlapCount` so the operator can tell
  "0ms because back-to-back" from "0ms because the two sessions
  were running side-by-side".
- `renderTransitions()` in `src/format.ts` — pretty header with
  handoff/break/overlap tally, summary table, top-N transitions
  with `medianGap` and `p95Gap` per cell, and a stickiness table.
- 17 new tests (`test/transitions.test.ts`) covering input
  validation, empty input, single session, the handoff vs break
  threshold, overlap-floored gaps, stickiness math, sort
  determinism (count-tied cells, started_at-tied sessions),
  topN truncation, since/until filtering, alternative `by`
  dimensions, multi-sample median + p95 (per-cell and overall),
  groups-list dedup/sort, and unknown-source fallback.

Live smoke (this repo's `~/.config/pew/session-queue.jsonl`,
6,817 raw lines → 5,756 in-window sessions, full corpus): 5,755
adjacent pairs total, **5,657 handoffs** (98.3% handoff rate)
and 98 breaks. Overall median gap is **0s** — most sessions are
back-to-back or actually overlap (3,224 overlaps observed).
Overall p95 gap is **2m**, so even the slow 5% are well under
the 30-min threshold.

The matrix surfaces the actual workflow shape:

  - `opencode → opencode` is the dominant cell at **2,781**
    handoffs (1,908 overlapping), confirming `opencode` is the
    primary driver and frequently runs concurrent windows.
  - `claude-code → claude-code` second at 883.
  - `opencode ↔ openclaw` is symmetric (459 / 457), the
    fingerprint of the openclaw automated fan-out colliding with
    `opencode` human work — same pattern previously surfaced as
    the 21-deep concurrency peak in 0.4.10.
  - `codex ↔ claude-code` (117 / 114) is symmetric too — those
    two tools alternate.
  - `claude-code` has the highest stickiness at **86.6%** —
    once an operator is in `claude-code`, the next session is
    almost certainly another `claude-code`. `opencode` is close
    behind at 85.5%. `openclaw` is the spreadiest at 48.4% — its
    sessions hand off to other tools more than half the time,
    consistent with it being the orchestrator that triggers
    other agents.

This is the categorical companion to `gaps`: `gaps` tells the
operator *how long* the idle space is, `transitions` tells them
*what kind of work was on either side of it*.

## 0.4.10 — 2026-04-24

### Added (refinement)

- `p95Concurrency` field on the report: the smallest level L such
  that cumulative window-time at concurrency <= L is >= 95%. Robust
  to rare tall spikes — on this repo's corpus, peak is 21 but p95
  is **7**, immediately telling the operator the 33-second peak is
  an outlier rather than a sustained regime. Surfaced as a new row
  in the pretty-table summary and a new key in the JSON. Three
  additional tests cover the rare-spike case, the sustained-peak
  case, and the empty-input baseline.


Session-concurrency analysis. The new `pew-insights concurrency`
subcommand sweeps `session-queue.jsonl` as a half-open-interval
event stream, reporting peak overlapping sessions, when the peak
was first reached, total time spent at peak, average concurrency,
window coverage (>=1 open), and a full histogram of time spent at
each concurrency level. It is the first builder to ask the
*interval* question rather than the *row* or *bucket* question:
`sessions` reports per-session distributions, `gaps` measures the
idle spaces between sessions, `streaks` collapses days to
ACTIVE/IDLE, and `velocity` aggregates by hour onto the token
corpus — none of them measure how many sessions were
simultaneously open at any given instant.

Live smoke (this repo's `pew/session-queue.jsonl`, full window of
4,825 sessions spanning 72.3 days): peak concurrency **21**
sessions, first reached 2026-04-22T10:33:39Z and held for ~33s
(an `openclaw` automated fan-out colliding with an `opencode`
human session burst). Average concurrency **1.38**; coverage
49.3% (the box was idle slightly more than half the window).
Histogram: 50.7% of time at level 0, 18.8% at 1, 15.5% at 2,
falling off through level 11 (0.6%). The peak duration of 33s
versus the multi-day spans at lower levels is exactly the
"tall narrow spike" pattern the subcommand is designed to surface
— invisible to per-day averages.

Tie-break is fully specified and tested: closes are processed
*before* opens at the same timestamp, so a session ending at the
exact moment another starts is **not** counted as concurrency
(the standard half-open-interval convention). Sessions starting
before `--since` or extending past `--until` are clipped, not
dropped, so their in-window contribution is preserved. Zero-length
sessions (`last_message_at == started_at` and `duration_seconds ==
0`) are dropped from consideration.

### Added

- `pew-insights concurrency` subcommand
  - `--since <iso>` inclusive ISO lower bound on the sweep window
    (default: earliest session start in the corpus).
  - `--until <iso>` exclusive ISO upper bound (default: latest
    session end). When a session's interval crosses either bound,
    it is clipped to the window — its overlap contribution inside
    the window is preserved, only the out-of-window portion is
    discarded.
  - `--top <n>` caps `peakSessions[]` (default 10). The `count`
    is always exact even when more sessions tied at the peak.
  - `--json` emits the full report including `windowStart`,
    `windowEnd`, `windowMs`, `consideredSessions`,
    `skippedSessions`, `peakConcurrency`, `peakAt`,
    `peakDurationMs`, `peakSessions[]`, `averageConcurrency`,
    `coverage`, and `histogram[]` (each row with `level`,
    `totalMs`, `fraction`).
- `src/concurrency.ts` builder. Pure, deterministic. End time
  per session is `max(last_message_at, started_at +
  duration_seconds*1000)`, favouring the larger of the two so
  late-arriving messages or rounding don't truncate overlap.
- `renderConcurrency()` in `src/format.ts` — pretty table with
  summary, peak-sessions table (truncating long `session_key`s
  with an ellipsis), and the level histogram.
- 16 new tests covering input validation, empty input, single
  session, non-overlap, overlap, the closes-before-opens
  tie-break, peak-session sorting and topN cap, numeric
  correctness of average/histogram, clipping at window bounds,
  fully-out-of-window skip, zero-length drop, the
  duration-extends-end branch, identical-interval handling,
  histogram fractions summing to 1.0, and disjoint-peak-segment
  duration accumulation.

## 0.4.9 — 2026-04-24

Token-velocity analysis. The new `pew-insights velocity` subcommand
projects `queue.jsonl` onto a contiguous, zero-filled hourly grid,
walks it for *active stretches* (maximal runs of hours with
`total_tokens >= --min-tokens`), and reports tokens-per-minute for
each stretch. Where every existing builder either sums (digest,
trend), categorises (streaks), averages over the diurnal cycle
(heatmap), or scores single-day outliers (anomalies), `velocity`
is the first to surface a *rate* — "while you were actually
working, how hard were you hitting the API?". A 90-minute frenzy
and a 90-minute trickle that produced the same daily total are
indistinguishable to `digest`; here they live at opposite ends of
the top-stretches table.

Live smoke (this repo's `pew/queue.jsonl`, last 168h, default
`--min-tokens 1`): 156 active hours across 4 stretches, 6.28B
total active tokens, average velocity **671.3K tokens/min** while
active, median stretch velocity 45.4K/min. Peak / longest stretch
coincided: a 147-hour run from 2026-04-18T08Z → 2026-04-24T10Z at
**709.9K/min** (6.26B tokens). Tightening to `--lookback 24
--min-tokens 1000` collapses to one 24h stretch at **323.7K/min**
(466.11M tokens) — a baseline number the operator can compare
future days against.

### Added

- `pew-insights velocity` subcommand
  - `--lookback <hours>` ending-hour-aligned window (default 168
    = 7 days). Window end is the hour-floor of `asOf`/now; window
    start is `lookback - 1` hours earlier so the count is
    inclusive on both ends.
  - `--min-tokens <n>` minimum `total_tokens` for an hour to
    count as ACTIVE (default 1 — any usage). Raise this to ignore
    trickle-only hours and stretch-merge only hours of substantive
    work; useful when background polling produces small constant
    hourly noise that would otherwise glue every stretch into one.
  - `--top <n>` caps the top-stretches table (default 10).
  - `--json` emits the full report including `windowStart`,
    `windowEnd`, `totalActiveHours`, `stretchCount`,
    `totalActiveTokens`, `averageTokensPerMinute`,
    `medianTokensPerMinute`, `peakStretch`, `longestStretch`, and
    `topStretches[]` (each row with `startHour`, `endHour`,
    `hours`, `tokens`, `inputTokens`, `outputTokens`, `events`,
    `tokensPerMinute`).
- `src/velocity.ts`
  - `buildVelocity(queue, opts)` — pure builder, deterministic on
    a given input. Throws on non-positive-integer
    `lookbackHours`, negative `minTokensPerHour`, and
    non-positive-integer `topN`.
  - Hour-grid is UTC-aligned to match `buildDailySeries`
    (trend.ts) and `buildHeatmap` so all three subcommands can be
    safely cross-read on the same window. Defensive
    `hourFloorIso` collapses sub-hour-aligned `hour_start` rows
    into the right bucket.
  - Velocity is `tokens / (hours * 60)` — divides by *bucket
    hours*, not wall-clock minutes between first event and last,
    so a 1-hour stretch is consistently `tokens / 60` regardless
    of where in the hour the first event landed.
  - `peakStretch` sort: velocity desc, hours desc, startHour asc
    (deterministic across re-runs).
  - `longestStretch` sort: hours desc, tokens desc, startHour asc
    (a 3h trickle and a 3h frenzy tie on hours; more tokens wins
    so the operator sees the more substantive run first).
  - `topStretches` sorted same as `peakStretch`.
- `renderVelocity` in `src/format.ts` — top-line summary table
  (active hours, stretches, tokens, average + median velocity,
  peak + longest stretch with span), then the top-N table with
  span, hours, tokens, input/output split, and rate. `formatRate`
  switches between `K/min` for fast bursts and 2-decimal raw for
  trickle-only stretches.

### Tests

- `test/velocity.test.ts` — 15 new cases: input validation
  (lookback < 1, non-integer lookback, negative min-tokens,
  non-positive-integer topN), empty queue, window alignment to
  `asOf` hour-floor, single-active-hour stretch, contiguous-hours
  merge, idle-hour breaking stretches with deterministic
  `longestStretch` tie-break (more tokens wins), `min-tokens`
  filter excluding trickle hours, out-of-window rows ignored,
  top-stretches sort determinism, equal-velocity tie-break (more
  hours then earlier start), median robustness against a single
  fast outlier, input/output sums carried through merged
  stretches, defensive sub-hour `hour_start` flooring.
- All 354 tests across 8 test files pass.

## 0.4.8 — 2026-04-24

Idle-gap detection between sessions. The new `pew-insights gaps`
subcommand reads `session-queue.jsonl` (the second subcommand to
do so as a primary input, joining `sessions`) and answers a
question that none of the existing token-aggregation subcommands
can: *which idle stretches in this window are unusually long
compared to my own typical inter-session quiet?*

Most naive "long idle" alerting against the session corpus is
noisy: every overnight pause looks like a long gap. `gaps` makes
the question relative — it builds the empirical distribution of
inter-session gaps in the window, picks a quantile threshold via
nearest-rank, and only flags gaps that strictly exceed it. This
plays directly with the alert-noise post: the threshold is
self-calibrating per operator, so a heavy weekend user and a 9-5
weekday user each get *their own* notion of "unusual".

### Added

- `pew-insights gaps` subcommand
  - `--since` window (`24h | 7d | 30d | all`, default `7d`) and
    `--until <iso>` exclusive upper bound, both filtering on
    `started_at` so window membership matches the `sessions`
    subcommand exactly.
  - `--quantile <q>` threshold in `(0, 1]` (default `0.9` — flag
    the longest 10%). Use `0.95` for stricter, `0.75` for noisier.
  - `--min-gap <seconds>` absolute floor (default 0). A gap below
    this is never flagged regardless of quantile — useful when
    your gap distribution is dominated by sub-minute pauses and
    you only care about real idles.
  - `--top <n>` caps flagged rows shown (default 10).
  - `--json` emits the full report including the threshold,
    distribution stats (median + max), and per-row pointers
    (sessionKey, source, kind, startedAt, lastMessageAt,
    projectRef) for the session before and after each flagged
    gap, plus the empirical `quantileRank` for that gap.
  - Reports total sessions in window, adjacent-gap count, the
    nearest-rank threshold, median + max of the gap distribution,
    and the flagged rows themselves.
- `src/gaps.ts`
  - `buildGaps(sessions, opts)` — pure builder, deterministic on
    a given input. Throws on `quantile` outside `(0, 1]`,
    `minGapSeconds < 0`, and non-integer or non-positive `topN`.
  - Gap is measured as `next.started_at - prev.last_message_at`
    (clamped at 0). Measuring to `last_message_at` rather than
    `started_at` means a long-running session does not count as
    "idle" while it was still emitting messages — and a
    corrupted overlap (next starts before prev ends) safely
    yields a 0-second gap rather than a negative one.
  - Threshold is the **nearest-rank** quantile
    (k = ceil(q × n)), so the threshold is always an actual
    observed gap value rather than an interpolated one. Matches
    how an operator reads "the unusual 10%".
  - `quantileRank` per flagged row is **mid-rank**:
    `(#strictly_less + 0.5 × #equal) / n`. Lets the operator
    distinguish a gap that just barely cleared the bar from a
    true outlier, even when many gaps share the same value.
  - Flagged rows are sorted `gap_seconds desc, before.startedAt
    asc, before.session_key asc` — fully deterministic across
    re-runs.
- `renderGaps` in `src/format.ts` — top-line summary table
  (sessions in window, adjacent gaps, threshold, median, max,
  flagged count), then the flagged-gaps table with gap duration,
  quantile rank, the `last_message_at` of the prior session, the
  `started_at` of the next session, and the `source/kind →
  source/kind` transition that bracketed the idle.

### Tests

- `test/gaps.test.ts` — 13 new cases covering: empty input,
  single-session input (no gaps measurable), the two-session
  edge case (threshold equals the only observed gap and nothing
  is strictly greater), clear outlier flagging at default
  quantile, equal-gap tie-break (earlier `before.startedAt`
  wins), `started_at` window filter (inclusive lower / exclusive
  upper), `minGapSeconds` suppression even past threshold,
  overlapping `last_message_at` clamped to 0, validation
  (`quantile`, `topN`, `minGapSeconds`), determinism across
  repeated calls on the same input, `topN` truncation, and
  monotonicity of mid-rank `quantileRank` across distinct gap
  values.

## 0.4.7 — 2026-04-24

Per-session shape analysis. The new `pew-insights sessions`
subcommand reads the `session-queue.jsonl` corpus directly (the
first builder to do so as a primary input) and answers a question
none of the existing token-aggregation subcommands can: *what does
my conversation shape look like?*

A session is the unit of human-LLM interaction — a `started_at`,
`last_message_at`, `duration_seconds`, message count, kind
(`agent`/`human`), source, and project_ref. `digest`/`top-projects`
treat each session row as a thing to be tallied for its tokens;
`sessions` treats each row as a row, with its own duration and
message-count distribution.

### Added

- `pew-insights sessions` subcommand
  - `--since` window (`24h | 7d | 30d | all`, default `7d`) filters
    on `started_at`; `--until <iso>` sets an exclusive upper bound
    so a long session is attributed to its starting day (matches
    how an operator describes it: "the long session I started
    Tuesday").
  - `--by source | kind | project_ref` (default `source`) drives
    the breakdown table.
  - `--top <n>` caps the breakdown table (default 10); the report
    still surfaces `groupCardinality` so truncation is visible.
  - `--min-duration <seconds>` (default 0) drops sub-threshold
    rows — useful for filtering auto-created empty sessions or
    one-shot exec calls that left a 0-second row behind.
  - Reports total session count, total wall-clock seconds, total
    messages, the **longest** session (by duration_seconds, with
    earlier-started tie-break), the **chattiest** session (by
    total_messages, same tie-break), a 5-stat duration distribution
    (min/median/mean/p95/max) and the same on message count, then
    the top-N grouped breakdown.
  - p95 uses **nearest-rank** (k = ceil(0.95 × n)) rather than
    linear interpolation. Session counts are typically small and
    we want the answer to be an actual observed value — matches
    how an operator reads "the worst 5% of sessions".
  - Median uses standard lower-half averaging for even-count
    populations.
  - `--json` emits the full report including pointers to the
    longest + chattiest sessions and the per-group rows, suitable
    for feeding into downstream BI or alerting on session-shape
    drift.
- `src/sessions.ts`
  - `buildSessions(sessions, opts)` — pure builder, deterministic
    on a given input. Throws on `topN < 1`, non-integer `topN`,
    negative `minDurationSeconds`, and unknown `by` values. Returns
    `null` for `longestSession` / `chattiestSession` when no
    session survives the filter, so consumers can distinguish
    "empty window" from "all sessions are 0-second".
  - Tie-break for `longestSession` / `chattiestSession`: the
    *earlier-started* session wins when the metric is equal, so
    re-running on the same input always picks the same pointer.
  - Group sort order: `sessions desc, totalDurationSeconds desc,
    key asc` — fully deterministic across re-runs.
- `renderSessions` in `src/format.ts` — top-line summary table
  with longest + chattiest pointers in human-readable form
  (`66h32m  (opencode/human, started 2026-04-21T08:23Z)`),
  duration + messages distribution tables (5-stat each), and the
  top-N grouped breakdown with per-group session count, wall-clock,
  message count, and median duration. Duration formatting collapses
  to `s | m | m+s | h | h+m` so a 30-second session and a 7-hour
  session both render compactly.

### Tests

- `test/sessions.test.ts` — 17 new cases covering: `topN` integer
  validation (rejects 0, negative, fractional), `minDurationSeconds`
  non-negativity, unknown `by` rejection, empty-input nulls and
  zero totals, totals + longest + chattiest aggregation, longest
  tie-break (earlier wins), chattiest tie-break (earlier wins),
  `since`/`until` window with exclusive upper bound, `min-duration`
  threshold filtering, even-count median (lower-half averaging),
  p95 nearest-rank with n=20, `by=source` / `by=kind` /
  `by=project_ref` grouping, group sort tie-break (sessions tie →
  duration desc → key asc), `topN` truncation surfacing
  `groupCardinality`, distribution min/max correctness, and full
  determinism on a given input.

Total test count: 308 → 325.

## 0.4.6 — 2026-04-24

Activity-cadence analysis. The new `pew-insights streaks` subcommand
classifies each day in the lookback window as ACTIVE (`total_tokens
>= --min-tokens`) or IDLE, then walks the series to surface the
longest active streak, longest idle gap, and the current trailing
run ("you're on day 12 of an active streak" / "it's been 4 days").

Different time scale from `anomalies` (regime/cadence vs point
spikes) and a different lens from `trend` (categorical state-change
vs continuous magnitude). A 0-token day reads as IDLE here where
`trend` would just call it a low value, so the cadence signal is
not smeared into the magnitude signal.

### Added

- `pew-insights streaks` subcommand
  - Discretises the daily token series (reuses `trend.buildDailySeries`
    so day-grid semantics match every other subcommand exactly: UTC,
    inclusive both ends, 0-fill for empty days).
  - Threshold via `--min-tokens` (default 1, i.e. "any usage at all
    counts"). Raise to track a deliberate practice cadence — e.g.
    `--min-tokens 1000000` for "at least 1M tokens of real work per
    day".
  - Reports longest ACTIVE run, longest IDLE run, current trailing
    run (so the operator's eye lands on the present moment without
    counting days), active-run count, and both median + mean
    active-run length so a skewed distribution (one giant streak +
    many short ones) is visible.
  - Pretty output renders a one-glyph-per-day cadence strip
    (50 chars/row, wraps for 90-day windows on a standard 80-col
    TTY) with the current run colored green/red so "where am I now"
    is unambiguous.
  - `--json` emits the full report including every run with its
    start/end day, length, and token sum, suitable for cron-driven
    alerting on idle-gap length or active-streak length.
- `src/streaks.ts`
  - `buildStreaks(queue, opts)` — pure builder, deterministic on a
    given `asOf`. Throws on `lookbackDays < 1` and on negative
    `minTokens`. Returns `null` for `longestActive` / `longestIdle`
    /  `medianActiveLength` / `meanActiveLength` when the relevant
    state never appears in the window, so consumers can distinguish
    "no active days" from "0-length active runs".
  - Tie-break for `longestActive` / `longestIdle`: the *earlier* run
    wins, so the result is deterministic on a given series.
  - Median uses standard even-count averaging of the two middle
    values; mean is reported alongside so distribution skew is
    visible in one glance.
- `renderStreaks` in `src/format.ts` — cadence strip + summary table
  with active fraction, idle days, run count, longest active /
  longest idle (with date range), current run, median + mean
  active-run length.

### Tests

- `test/streaks.test.ts` — 13 new cases covering: lookback validation,
  negative-minTokens validation, empty-queue all-idle, all-active
  window, alternating active/idle, longest-active tie-break (earlier
  wins), current-run state on most-recent day, threshold reclassification
  (`--min-tokens` shifting the boundary), token aggregation within a
  run, out-of-window event filtering, even-count median averaging,
  inclusive boundary days, and `minTokens=0` corner case (every day
  qualifies, single all-active run).

Total test count: 295 → 308.

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
