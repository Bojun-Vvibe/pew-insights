# Changelog

All notable changes to this project will be documented in this file.

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
