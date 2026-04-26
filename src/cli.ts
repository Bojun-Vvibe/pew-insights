#!/usr/bin/env node
import chalk from 'chalk';
import { Command } from 'commander';
import { promises as fs } from 'node:fs';
import { resolvePewPaths } from './paths.js';
import {
  countRuns,
  fileSize,
  readCursors,
  readQueue,
  readSessionQueue,
  readSessionQueueRaw,
  readState,
} from './parsers.js';
import {
  buildDigest,
  buildDoctor,
  buildSourcesPivot,
  buildStatus,
  resolveSince,
} from './report.js';
import {
  renderBudget,
  renderCompare,
  renderCost,
  renderDigest,
  renderDoctor,
  renderForecast,
  renderSources,
  renderStatus,
  renderTopProjects,
  renderTrend,
  renderAnomalies,
  renderRatios,
  renderDashboard,
  renderHeatmap,
  renderStreaks,
  renderSessions,
  renderGaps,
  renderVelocity,
  renderConcurrency,
  renderTransitions,
  renderAgentMix,
  renderSessionLengths,
  type SessionLengthsUnit,
  renderReplyRatio,
  renderTurnCadence,
  renderMessageVolume,
  renderModelSwitching,
  renderIdleGaps,
  renderSourceMix,
  renderProviderShare,
  renderTimeOfDay,
  renderCacheHitRatio,
  renderReasoningShare,
  renderPromptSize,
  renderOutputSize,
  renderPeakHourShare,
  renderWeekdayShare,
  renderBurstiness,
  renderDeviceShare,
  renderOutputInputRatio,
  renderModelMixEntropy,
  renderWeekendVsWeekday,
  renderCacheHitByHour,
  renderModelCohabitation,
  renderInterarrivalTime,
  renderBucketIntensity,
  renderTokenVelocityPercentiles,
  renderCostPerBucketPercentiles,
  renderRollingBucketCv,
  renderDailyTokenAutocorrelationLag1,
  renderDailyTokenMonotoneRunLength,
  renderDailyTokenZscoreExtremes,
  renderDailyTokenSecondDiffSignRuns,
  renderSourceOutputTokenBenfordDeviation,
  renderSourceTokenMassHourCentroid,
  renderDailyTokenGini,
  renderSourceHourTopKMassShare,
  renderCumulativeTokensMidpoint,
  renderSourceIoRatioStability,
  renderModelTenure,
  renderProviderTenure,
  renderTailShare,
  renderTenureDensityQuadrant,
  renderSourceTenure,
  renderBucketStreakLength,
  renderBucketGapDistribution,
  renderSourceDecayHalfLife,
  renderBucketHandoffFrequency,
  renderInterSourceHandoffLatency,
  renderSourcePairCooccurrence,
  renderProviderSwitchingFrequency,
  renderFirstBucketOfDay,
  renderLastBucketOfDay,
  renderActiveSpanPerDay,
  renderSourceBreadthPerDay,
  renderBucketDensityPercentile,
  renderHourOfWeek,
  renderDeviceTenure,
  renderPromptOutputCorrelation,
  renderOutputTokenDecileDistribution,
  renderInputTokenDecileDistribution,
  renderSourceRunLengths,
  renderHourOfDaySourceMixEntropy,
  renderBucketTokenGini,
  renderHourOfDayTokenSkew,
  renderSourceRankChurn,
  renderSourceDebutRecency,
  renderSourceActiveDayStreak,
  renderSourceDrySpell,
} from './format.js';
import { renderHtmlReport } from './html.js';
import {
  computeCost,
  DEFAULT_RATES,
  defaultRatesPath,
  mergeRates,
  readRatesFile,
} from './cost.js';
import {
  buildLookup,
  defaultCachePath,
  isPathDenylisted,
  readCache,
  redactPath,
  scanCandidates,
  writeCache,
  type ResolvedRef,
} from './projects.js';
import { executeCompaction, planCompaction } from './compact.js';
import { attributeTokensByProject } from './byproject.js';
import { executeGc, planGc } from './gcruns.js';
import { buildTrend } from './trend.js';
import { buildTopProjects } from './topprojects.js';
import { buildForecast } from './forecast.js';
import { buildBudget, defaultBudgetPath, readBudgetFile } from './budget.js';
import { buildCompare, resolveComparePreset, type CompareDimension, type CompareWindow } from './compare.js';
import { exportQueue, exportSessions, type ExportFormat } from './export.js';
import { buildAnomalies } from './anomalies.js';
import { buildRatiosReport } from './ratiosreport.js';
import { buildDashboard } from './dashboard.js';
import { buildHeatmap, type HeatmapMetric, type HeatmapTz } from './heatmap.js';
import { buildStreaks } from './streaks.js';
import { buildSessions, type SessionsDimension } from './sessions.js';
import { buildGaps } from './gaps.js';
import { buildVelocity } from './velocity.js';
import { buildConcurrency } from './concurrency.js';
import { buildTransitions, type TransitionsDimension } from './transitions.js';
import { buildAgentMix, type AgentMixDimension, type AgentMixMetric } from './agentmix.js';
import {
  buildSessionLengths,
  DEFAULT_LENGTH_EDGES_SECONDS,
  type SessionLengthsDimension,
} from './sessionlengths.js';
import {
  buildReplyRatio,
  DEFAULT_RATIO_EDGES,
  type ReplyRatioDimension,
} from './replyratio.js';
import {
  buildTurnCadence,
  DEFAULT_CADENCE_EDGES_SECONDS,
  type TurnCadenceDimension,
} from './turncadence.js';
import { buildSourceRunLengths } from './sourcerunlengths.js';
import { buildHourOfDaySourceMixEntropy } from './hourofdaysourcemixentropy.js';
import { buildBucketTokenGini } from './buckettokengini.js';
import { buildHourOfDayTokenSkew } from './hourofdaytokenskew.js';
import { buildSourceRankChurn } from './sourcerankchurn.js';
import { buildSourceDebutRecency } from './sourcedebutrecency.js';
import { buildSourceActiveDayStreak } from './sourceactivedaystreak.js';
import { buildSourceDrySpell } from './sourcedryspell.js';
import {
  buildMessageVolume,
  DEFAULT_VOLUME_EDGES,
  type MessageVolumeDimension,
} from './messagevolume.js';
import {
  buildModelSwitching,
  type ModelSwitchingDimension,
} from './modelswitching.js';
import {
  buildIdleGaps,
  DEFAULT_IDLE_GAP_EDGES_SECONDS,
  type IdleGapsDimension,
} from './idlegaps.js';
import {
  buildSourceMix,
  type SourceMixBucketUnit,
} from './sourcemix.js';
import { buildProviderShare } from './providershare.js';
import { buildCacheHitRatio } from './cachehitratio.js';
import { buildReasoningShare } from './reasoningshare.js';
import { buildPromptSize } from './promptsize.js';
import { buildOutputSize } from './outputsize.js';
import { buildPeakHourShare } from './peakhour.js';
import { buildWeekdayShare } from './weekdayshare.js';
import { buildBurstiness } from './burstiness.js';
import { buildDeviceShare } from './deviceshare.js';
import { buildPromptOutputCorrelation } from './promptoutputcorrelation.js';
import { buildWeekendVsWeekday } from './weekendvsweekday.js';
import { buildCacheHitByHour } from './cachehitbyhour.js';
import { buildModelCohabitation } from './modelcohabitation.js';
import { buildInterarrivalTime } from './interarrivaltime.js';
import { buildBucketIntensity } from './bucketintensity.js';
import { buildTokenVelocityPercentiles } from './tokenvelocitypercentiles.js';
import { buildCostPerBucketPercentiles } from './costperbucketpercentiles.js';
import { buildRollingBucketCv } from './rollingbucketcv.js';
import { buildDailyTokenAutocorrelationLag1 } from './dailytokenautocorrelationlag1.js';
import { buildDailyTokenMonotoneRunLength } from './dailytokenmonotonerunlength.js';
import { buildDailyTokenSecondDiffSignRuns } from './dailytokenseconddiffsignruns.js';
import { buildSourceOutputTokenBenfordDeviation } from './sourceoutputtokenbenforddeviation.js';
import { buildSourceTokenMassHourCentroid } from './sourcetokenmasshourcentroid.js';
import { buildDailyTokenGini } from './dailytokenginicoefficient.js';
import { buildSourceHourTopKMassShare } from './sourcehourofdaytopkmassshare.js';
import { buildDailyTokenZscoreExtremes } from './dailytokenzscoreextremes.js';
import { buildCumulativeTokensMidpoint } from './cumulativetokensmidpoint.js';
import { buildSourceIoRatioStability } from './sourceioratiostability.js';
import { buildModelTenure } from './modeltenure.js';
import { buildProviderTenure } from './providertenure.js';
import { buildTenureDensityQuadrant } from './tenuredensityquadrant.js';
import { buildSourceTenure } from './sourcetenure.js';
import { buildBucketStreakLength } from './bucketstreaklength.js';
import { buildBucketGapDistribution } from './bucketgapdistribution.js';
import { buildSourceDecayHalfLife } from './sourcedecayhalflife.js';
import { buildBucketHandoffFrequency } from './buckethandofffrequency.js';
import { buildInterSourceHandoffLatency } from './intersourcehandofflatency.js';
import { buildSourcePairCooccurrence } from './sourcepaircooccurrence.js';
import { buildProviderSwitchingFrequency } from './providerswitchingfrequency.js';
import { buildFirstBucketOfDay } from './firstbucketofday.js';
import { buildLastBucketOfDay } from './lastbucketofday.js';
import { buildOutputTokenDecileDistribution } from './outputtokendeciledistribution.js';
import { buildInputTokenDecileDistribution } from './inputtokendeciledistribution.js';
import { buildActiveSpanPerDay } from './activespanperday.js';
import { buildSourceBreadthPerDay } from './sourcebreadthperday.js';
import { buildBucketDensityPercentile } from './bucketdensitypercentile.js';
import { buildHourOfWeek } from './hourofweek.js';
import { buildDeviceTenure } from './devicetenure.js';
import { buildTailShare } from './tailshare.js';
import { buildOutputInputRatio } from './outputinputratio.js';
import { buildModelMixEntropy } from './modelmixentropy.js';
import { buildTimeOfDay } from './timeofday.js';

interface CommonOpts {
  pewHome?: string;
  json?: boolean;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

const program = new Command();

program
  .name('pew-insights')
  .description('Local-first reports and analytics for your `pew` CLI usage.')
  .version('0.5.6')
  .option('--pew-home <path>', 'override pew state directory (default $PEW_HOME or ~/.config/pew)');

program
  .command('digest')
  .description('Token totals by day / source / model / hour for a window')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--by-project', 'add a top-projects breakdown using project_ref reverse mapping')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(
    async (
      opts: { since: string; json?: boolean; byProject?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);
        const since = resolveSince(opts.since);
        const [queue, sessions] = await Promise.all([readQueue(paths), readSessionQueue(paths)]);
        const digest = buildDigest(queue, sessions, since);

        let byProject: ReturnType<typeof attributeTokensByProject> | null = null;
        let labels: Map<string, string> | null = null;
        if (opts.byProject) {
          byProject = attributeTokensByProject(queue, sessions, since);
          // Resolve project labels via cached lookup (do not rescan).
          const cache = await readCache();
          labels = new Map();
          if (cache) {
            for (const e of cache.entries) {
              const safeBase = isPathDenylisted(e.basename) ? '<redacted>' : e.basename;
              labels.set(e.projectRef, safeBase);
            }
          }
        }

        if (opts.json || common.json) {
          const enriched = byProject
            ? {
                ...digest,
                byProject: {
                  unattributedTokens: byProject.unattributedTokens,
                  rows: byProject.rows.slice(0, 10).map((r) => ({
                    projectRef: r.projectRef,
                    label: labels?.get(r.projectRef) ?? null,
                    totalTokens: r.totalTokens,
                    bySource: r.bySource,
                  })),
                },
              }
            : digest;
          process.stdout.write(JSON.stringify(enriched, null, 2) + '\n');
        } else {
          process.stdout.write(renderDigest(digest) + '\n');
          if (byProject) {
            process.stdout.write('\nTop projects (proportional attribution)\n');
            process.stdout.write(
              `unattributed: ${byProject.unattributedTokens.toLocaleString()} tokens\n\n`,
            );
            const top = byProject.rows.slice(0, 10);
            for (const r of top) {
              const label = labels?.get(r.projectRef) ?? '(unresolved)';
              process.stdout.write(
                `  ${r.projectRef}  ${r.totalTokens.toLocaleString().padStart(14)}  ${label}\n`,
              );
              for (const s of r.bySource.slice(0, 5)) {
                process.stdout.write(
                  `      ${s.source.padEnd(18)} ${s.tokens.toLocaleString().padStart(12)}\n`,
                );
              }
            }
          }
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('status')
  .description('Sync queue + lock health')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const [state, queue, queueSize, sessionQueueSize, cursors, runsCount] = await Promise.all([
        readState(paths),
        readQueue(paths),
        fileSize(paths.queueJsonl),
        fileSize(paths.sessionQueueJsonl),
        readCursors(paths),
        countRuns(paths),
      ]);
      const status = buildStatus({
        pewHome: paths.home,
        state,
        queue,
        queueFileSize: queueSize,
        sessionQueueFileSize: sessionQueueSize,
        cursors,
        runsCountApprox: runsCount,
      });
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(status, null, 2) + '\n');
      } else {
        process.stdout.write(renderStatus(status) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('sources')
  .description('Source × model token totals (pivot)')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const queue = await readQueue(paths);
      const since = resolveSince(opts.since);
      const pivot = buildSourcesPivot(queue, since);
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(pivot, null, 2) + '\n');
      } else {
        process.stdout.write(renderSources(pivot) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('report')
  .description('Render a self-contained HTML report')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--out <path>', 'output HTML file (default report.html)', 'report.html')
  .action(async (opts: { since: string; out: string }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const [queue, sessions, qSize, sqSize, state, cursors, runsCount] = await Promise.all([
        readQueue(paths),
        readSessionQueue(paths),
        fileSize(paths.queueJsonl),
        fileSize(paths.sessionQueueJsonl),
        readState(paths),
        readCursors(paths),
        countRuns(paths),
      ]);
      const digest = buildDigest(queue, sessions, since);
      const status = buildStatus({
        pewHome: paths.home,
        state,
        queue,
        queueFileSize: qSize,
        sessionQueueFileSize: sqSize,
        cursors,
        runsCountApprox: runsCount,
      });
      // Cost + trend always populated for the HTML view; cheap to compute.
      const userRates = await readRatesFile(defaultRatesPath());
      const mergedRates = mergeRates(DEFAULT_RATES, userRates);
      const cost = computeCost(queue, since, mergedRates);
      const trend = buildTrend(queue, since, { windowDays: 14 });
      // Forecast: 14d lookback for the OLS fit; the forecast itself spans the
      // current UTC week. Always rendered — cheap and adds operational signal.
      const forecast = buildForecast(queue, { lookbackDays: 14 });
      // Budget: only render if the user has a budget config on disk. We never
      // synthesise a daily target for the HTML view (would mis-represent intent).
      const budgetCfg = await readBudgetFile(defaultBudgetPath());
      const budget = budgetCfg
        ? buildBudget(queue, mergedRates, budgetCfg, { windowDays: 14 })
        : null;
      const html = renderHtmlReport({
        pewHome: paths.home,
        digest,
        status,
        cost,
        trend,
        forecast,
        budget,
        generatedAt: new Date().toISOString(),
      });
      await fs.writeFile(opts.out, html, 'utf8');
      process.stdout.write(`wrote ${opts.out} (${html.length} bytes)\n`);
    } catch (e) {
      die(e);
    }
  });

program
  .command('top-projects')
  .description('Top N projects by attributed tokens, with reverse-mapped paths')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('-n, --top <n>', 'number of projects to show (default 10)', '10')
  .option('--show-paths', 'include resolved paths (still denylist-filtered)')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(
    async (
      opts: { since: string; top: string; showPaths?: boolean; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);
        const since = resolveSince(opts.since);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const [queue, sessions] = await Promise.all([
          readQueue(paths),
          readSessionQueue(paths),
        ]);
        const result = await buildTopProjects(queue, sessions, since, {
          topN,
          showPaths: opts.showPaths,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(result, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderTopProjects(result, { showPaths: opts.showPaths }) + '\n',
          );
          if (result.unresolvedCount > 0) {
            process.stdout.write(
              chalk.dim(
                `\n${result.unresolvedCount} project_ref(s) unresolved — run \`pew-insights projects --refresh\` to rebuild the lookup.\n`,
              ),
            );
          }
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('trend')
  .description('Day-over-day and week-over-week token deltas with ASCII sparklines')
  .option('--since <spec>', 'display window: 24h, 7d, 30d, all (deltas always use fixed 24h/7d offsets)', '14d')
  .option('--window <days>', 'number of days in the displayed sparkline (default 14)', '14')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; window: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const windowDays = Number.parseInt(opts.window, 10);
      if (!Number.isFinite(windowDays) || windowDays < 2) {
        throw new Error(`--window must be an integer >= 2 (got ${opts.window})`);
      }
      const queue = await readQueue(paths);
      const report = buildTrend(queue, since, { windowDays });
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        process.stdout.write(renderTrend(report) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('cost')
  .description('Estimate $ cost from queue tokens × per-model rate table')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--rates <path>', 'JSON rates file (defaults to ~/.config/pew-insights/rates.json)')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; rates?: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const ratesPath = opts.rates ?? defaultRatesPath();
      const userRates = await readRatesFile(ratesPath);
      const rates = mergeRates(DEFAULT_RATES, userRates);
      const queue = await readQueue(paths);
      const report = computeCost(queue, since, rates);
      if (opts.json || common.json) {
        process.stdout.write(
          JSON.stringify(
            {
              ...report,
              ratesSource: userRates ? ratesPath : 'defaults',
              modelsPriced: Object.keys(rates).length,
            },
            null,
            2,
          ) + '\n',
        );
      } else {
        process.stdout.write(renderCost(report) + '\n');
        process.stdout.write(
          chalk.dim(
            `\nrates source: ${userRates ? ratesPath : 'built-in defaults'}  (${Object.keys(rates).length} models priced)\n`,
          ),
        );
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('doctor')
  .description('Health checks against the pew state directory')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const exists = await pathExists(paths.home);

      let status = null;
      let queueSize = 0;
      let queueOffset = 0;
      let runsCount = 0;

      if (exists) {
        const [state, queue, qSize, sqSize, cursors, rCount] = await Promise.all([
          readState(paths),
          readQueue(paths),
          fileSize(paths.queueJsonl),
          fileSize(paths.sessionQueueJsonl),
          readCursors(paths),
          countRuns(paths),
        ]);
        queueSize = qSize;
        queueOffset = state.queue.offset;
        runsCount = rCount;
        status = buildStatus({
          pewHome: paths.home,
          state,
          queue,
          queueFileSize: qSize,
          sessionQueueFileSize: sqSize,
          cursors,
          runsCountApprox: rCount,
        });
      }

      const report = buildDoctor({
        pewHome: paths.home,
        pewHomeExists: exists,
        status,
        queueFileSize: queueSize,
        queueOffset,
        runsCount,
      });

      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        process.stdout.write(renderDoctor(report) + '\n');
      }
      // Non-zero exit if any errors.
      if (report.findings.some((f) => f.severity === 'error')) {
        process.exitCode = 2;
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('projects')
  .description('Reverse-map session-queue project_ref hashes to project paths')
  .option('--show-paths', 'show full filesystem paths (still denylist-filtered)')
  .option('--refresh', 'force a fresh scan even if a cache exists')
  .option('--json', 'emit JSON instead of a pretty table')
  .option('--scan-root <path...>', 'override scan roots (repeatable)')
  .action(
    async (
      opts: { showPaths?: boolean; refresh?: boolean; json?: boolean; scanRoot?: string[] },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const sessions = await readSessionQueue(paths);

        // Tally sessions per project_ref so we can sort & summarise.
        const sessionsByRef = new Map<string, number>();
        for (const s of sessions) {
          const ref = s.project_ref || 'unknown';
          sessionsByRef.set(ref, (sessionsByRef.get(ref) ?? 0) + 1);
        }
        const observed = new Set(sessionsByRef.keys());

        let resolved: ResolvedRef[];
        const cachePath = defaultCachePath();

        if (!opts.refresh) {
          const cache = await readCache(cachePath);
          if (cache) {
            resolved = cache.entries.filter((e) => observed.has(e.projectRef));
          } else {
            resolved = await freshScan(observed, opts.scanRoot);
            await writeCache(
              { version: 1, generatedAt: new Date().toISOString(), entries: resolved },
              cachePath,
            );
          }
        } else {
          resolved = await freshScan(observed, opts.scanRoot);
          await writeCache(
            { version: 1, generatedAt: new Date().toISOString(), entries: resolved },
            cachePath,
          );
        }

        const rows = resolved
          .map((e) => ({
            ...e,
            sessions: sessionsByRef.get(e.projectRef) ?? 0,
          }))
          .sort((a, b) => b.sessions - a.sessions);

        if (opts.json || common.json) {
          // JSON output never includes denylisted paths.
          const safe = rows.map((r) => ({
            projectRef: r.projectRef,
            basename: isPathDenylisted(r.basename) ? '<redacted>' : r.basename,
            ...(opts.showPaths && !isPathDenylisted(r.path) ? { path: r.path } : {}),
            algo: r.algo,
            variant: r.variant,
            sessions: r.sessions,
          }));
          process.stdout.write(
            JSON.stringify(
              {
                cachePath,
                totalRefs: observed.size,
                resolvedRefs: rows.length,
                entries: safe,
              },
              null,
              2,
            ) + '\n',
          );
        } else {
          process.stdout.write(`pew-insights projects\n`);
          process.stdout.write(
            `cache: ${cachePath}\nresolved ${rows.length} of ${observed.size} project_refs\n\n`,
          );
          const headers = opts.showPaths
            ? ['project_ref', 'sessions', 'basename', 'path']
            : ['project_ref', 'sessions', 'basename'];
          process.stdout.write(headers.join('\t') + '\n');
          for (const r of rows) {
            const safeBase = isPathDenylisted(r.basename) ? '<redacted>' : r.basename;
            const cols = [
              r.projectRef,
              String(r.sessions),
              safeBase,
              ...(opts.showPaths ? [redactPath(r.path)] : []),
            ];
            process.stdout.write(cols.join('\t') + '\n');
          }
        }
      } catch (e) {
        die(e);
      }
    },
  );

async function freshScan(
  observed: Set<string>,
  scanRoots: string[] | undefined,
): Promise<ResolvedRef[]> {
  const candidates = await scanCandidates(scanRoots ? { roots: scanRoots } : {});
  const lookup = buildLookup(candidates, observed);
  return Array.from(lookup.values());
}

program
  .command('compact')
  .description('Archive flushed prefix of queue.jsonl / session-queue.jsonl and truncate the live file')
  .option('--confirm', 'actually mutate; without this the command is dry-run')
  .option('--json', 'emit JSON')
  .action(async (opts: { confirm?: boolean; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const plan = await planCompaction(paths);

      const summary = {
        pewHome: paths.home,
        dryRun: !opts.confirm,
        blocked: plan.blocked,
        blockReason: plan.blockReason,
        trailingLockHolder: plan.trailingLockHolder,
        trailingLockAlive: plan.trailingLockAlive,
        plan: plan.entries.map((e) => ({
          name: e.name,
          liveSize: e.liveSize,
          offset: e.offset,
          evictableBytes: e.evictableBytes,
          archivePath: e.archivePath,
        })),
        executed: [] as Awaited<ReturnType<typeof executeCompaction>>,
      };

      if (opts.confirm && !plan.blocked) {
        summary.executed = await executeCompaction(paths, plan);
      }

      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
      } else {
        process.stdout.write(`pew-insights compact ${opts.confirm ? '(LIVE)' : '(dry-run)'}\n`);
        process.stdout.write(`pew home: ${paths.home}\n`);
        if (plan.blocked) {
          process.stdout.write(`BLOCKED: ${plan.blockReason}\n`);
          process.exitCode = 2;
          return;
        }
        for (const e of plan.entries) {
          process.stdout.write(
            `  ${e.name}: live=${e.liveSize}B  offset=${e.offset}B  evictable=${e.evictableBytes}B  → ${e.archivePath}\n`,
          );
        }
        if (!opts.confirm) {
          process.stdout.write(`\nDry-run only. Re-run with --confirm to actually compact.\n`);
        } else {
          process.stdout.write('\nResults:\n');
          for (const r of summary.executed) {
            if (r.skipped) {
              process.stdout.write(`  ${r.name}: skipped (${r.reason})\n`);
            } else {
              process.stdout.write(
                `  ${r.name}: archived ${r.archivedBytes}B → ${r.archivePath}; live now ${r.newLiveBytes}B\n`,
              );
            }
          }
        }
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('gc-runs')
  .description('Move old runs/ entries into ~/.cache/pew-insights/archive/runs/')
  .option('--keep <n>', 'keep the most recent N runs (default 1000)', '1000')
  .option('--confirm', 'actually move files; without this the command is dry-run')
  .option('--json', 'emit JSON')
  .action(async (opts: { keep: string; confirm?: boolean; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const keep = Number.parseInt(opts.keep, 10);
      if (!Number.isFinite(keep) || keep < 0) {
        throw new Error(`--keep must be a non-negative integer (got ${opts.keep})`);
      }
      const plan = await planGc(paths, { keep });
      let moved = 0;
      if (opts.confirm) {
        const r = await executeGc(plan);
        moved = r.moved;
      }
      if (opts.json || common.json) {
        process.stdout.write(
          JSON.stringify(
            {
              dryRun: !opts.confirm,
              totalRuns: plan.totalRuns,
              keepRecent: plan.keepRecent,
              keepers: plan.keepers.length,
              candidatesToMove: plan.candidates.length,
              archiveDir: plan.archiveDir,
              moved,
            },
            null,
            2,
          ) + '\n',
        );
      } else {
        process.stdout.write(`pew-insights gc-runs ${opts.confirm ? '(LIVE)' : '(dry-run)'}\n`);
        process.stdout.write(`runs/ entries: ${plan.totalRuns}\n`);
        process.stdout.write(`keep most recent: ${plan.keepRecent}\n`);
        process.stdout.write(`total keepers (recent ∪ daily-success): ${plan.keepers.length}\n`);
        process.stdout.write(`candidates to move: ${plan.candidates.length}\n`);
        process.stdout.write(`archive dir: ${plan.archiveDir}\n`);
        if (!opts.confirm) {
          process.stdout.write('\nDry-run only. Re-run with --confirm to actually move files.\n');
        } else {
          process.stdout.write(`\nMoved ${moved} files.\n`);
        }
      }
    } catch (e) {
      die(e);
    }
  });

function die(e: unknown): never {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  process.stderr.write(`pew-insights: ${msg}\n`);
  process.exit(1);
}

program
  .command('forecast')
  .description('Linear-regression forecast: tomorrow + week-end token totals with 95% CI')
  .option('--lookback <days>', 'days of history to fit on (default 14)', '14')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { lookback: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts;
      const paths = resolvePewPaths(common.pewHome);
      const lookback = Number.parseInt(opts.lookback, 10);
      if (!Number.isFinite(lookback) || lookback < 2) {
        throw new Error(`--lookback must be an integer >= 2 (got ${opts.lookback})`);
      }
      const queue = await readQueue(paths);
      const report = buildForecast(queue, { lookbackDays: lookback });
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(report, null, 2) + '\n');
      } else {
        process.stdout.write(renderForecast(report) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

program
  .command('budget')
  .description('Track $ burn against a daily budget; show ETA to monthly breach')
  .option('--daily <usd>', 'daily budget in USD (overrides config file)')
  .option('--monthly <usd>', 'monthly cap in USD (otherwise daily × days-in-month)')
  .option('--config <path>', 'budget config file (default ~/.config/pew-insights/budget.json)')
  .option('--window <days>', 'rolling window for burn-rate average (default 7)', '7')
  .option('--rates <path>', 'rates file (defaults to cost rates path)')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        daily?: string;
        monthly?: string;
        config?: string;
        window: string;
        rates?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        // Load budget config: --daily wins; else config file; else error.
        let cfgFromFile = await readBudgetFile(opts.config ?? defaultBudgetPath());
        let dailyUsd: number | undefined;
        if (opts.daily != null) dailyUsd = Number(opts.daily);
        else if (cfgFromFile) dailyUsd = cfgFromFile.dailyUsd;
        if (dailyUsd == null || !Number.isFinite(dailyUsd) || dailyUsd < 0) {
          throw new Error(
            `no budget configured. Pass --daily <usd> or write {"dailyUsd": N} to ${opts.config ?? defaultBudgetPath()}`,
          );
        }
        let monthlyUsd: number | undefined;
        if (opts.monthly != null) monthlyUsd = Number(opts.monthly);
        else if (cfgFromFile?.monthlyUsd != null) monthlyUsd = cfgFromFile.monthlyUsd;

        const windowDays = Number.parseInt(opts.window, 10);
        if (!Number.isFinite(windowDays) || windowDays < 1) {
          throw new Error(`--window must be a positive integer (got ${opts.window})`);
        }

        const ratesPath = opts.rates ?? defaultRatesPath();
        const userRates = await readRatesFile(ratesPath);
        const rates = mergeRates(DEFAULT_RATES, userRates);
        const queue = await readQueue(paths);

        const report = buildBudget(queue, rates, { dailyUsd, monthlyUsd }, { windowDays });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBudget(report) + '\n');
        }

        if (report.status === 'breached') process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('compare')
  .description('A/B compare two windows by source or model with significance hint')
  .option('--preset <name>', 'preset window pair: this-week-vs-last-week | today-vs-yesterday | last-7d-vs-prior-7d')
  .option('--a-from <iso>', 'window A inclusive start (ISO)')
  .option('--a-until <iso>', 'window A exclusive end (ISO)')
  .option('--b-from <iso>', 'window B inclusive start (ISO)')
  .option('--b-until <iso>', 'window B exclusive end (ISO)')
  .option('--by <dim>', 'dimension: source | model (default model)', 'model')
  .option('--top <n>', 'cap rows shown (default 20)', '20')
  .option('--min-tokens <n>', 'drop keys whose A+B tokens < this threshold (default 0)', '0')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        preset?: string;
        aFrom?: string;
        aUntil?: string;
        bFrom?: string;
        bUntil?: string;
        by: string;
        top: string;
        minTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        let a: CompareWindow;
        let b: CompareWindow;
        if (opts.preset) {
          const pr = resolveComparePreset(opts.preset);
          if (!pr) throw new Error(`unknown --preset: ${opts.preset}`);
          a = pr.a;
          b = pr.b;
        } else {
          if (!opts.aFrom || !opts.aUntil || !opts.bFrom || !opts.bUntil) {
            throw new Error('either --preset or all of --a-from --a-until --b-from --b-until are required');
          }
          a = { label: 'A', from: new Date(opts.aFrom).toISOString(), until: new Date(opts.aUntil).toISOString() };
          b = { label: 'B', from: new Date(opts.bFrom).toISOString(), until: new Date(opts.bUntil).toISOString() };
        }

        const dim = opts.by as CompareDimension;
        if (dim !== 'source' && dim !== 'model') {
          throw new Error(`--by must be 'source' or 'model' (got ${opts.by})`);
        }
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }

        const queue = await readQueue(paths);
        const report = buildCompare(queue, a, b, dim, { topN, minTokens });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCompare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('export')
  .description('Dump filtered events as CSV or Parquet-friendly NDJSON for downstream BI')
  .option('--entity <name>', 'queue | sessions (default queue)', 'queue')
  .option('--format <fmt>', 'csv | ndjson (default csv)', 'csv')
  .option('--since <spec>', 'lower bound: 24h, 7d, 30d, all, or ISO')
  .option('--until <iso>', 'upper bound (exclusive); ISO timestamp')
  .option('--source <substr>', 'case-insensitive substring filter on source')
  .option('--model <substr>', 'case-insensitive substring filter on normalised model name')
  .option('--out <path>', 'write to file instead of stdout')
  .option('--rates <path>', 'rates JSON; populates the `usd` column for queue exports')
  .action(
    async (
      opts: {
        entity: string;
        format: string;
        since?: string;
        until?: string;
        source?: string;
        model?: string;
        out?: string;
        rates?: string;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.entity !== 'queue' && opts.entity !== 'sessions') {
          throw new Error(`--entity must be 'queue' or 'sessions' (got ${opts.entity})`);
        }
        if (opts.format !== 'csv' && opts.format !== 'ndjson') {
          throw new Error(`--format must be 'csv' or 'ndjson' (got ${opts.format})`);
        }
        const since = opts.since ? resolveSince(opts.since) : null;
        const until = opts.until ? new Date(opts.until).toISOString() : null;
        const filters = { since, until, source: opts.source, model: opts.model };

        let result;
        if (opts.entity === 'queue') {
          let rates = null;
          if (opts.rates !== undefined || opts.format === 'ndjson' || opts.format === 'csv') {
            // Try the user rates file (or default) but fall back to nothing — the
            // `usd` column is optional.
            const ratesPath = opts.rates ?? defaultRatesPath();
            try {
              const userRates = await readRatesFile(ratesPath);
              rates = mergeRates(DEFAULT_RATES, userRates);
            } catch {
              rates = DEFAULT_RATES;
            }
          }
          const queue = await readQueue(paths);
          result = exportQueue(queue, opts.format as ExportFormat, filters, rates);
        } else {
          const sessions = await readSessionQueue(paths);
          result = exportSessions(sessions, opts.format as ExportFormat, filters);
        }

        if (opts.out) {
          await fs.writeFile(opts.out, result.body, 'utf8');
          process.stderr.write(
            `wrote ${result.rowCount} rows (${result.body.length} bytes) to ${opts.out}\n`,
          );
        } else {
          process.stdout.write(result.body);
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('anomalies')
  .description('Flag days whose token total deviates >threshold σ from a trailing baseline')
  .option('--lookback <days>', 'days of history to score (default 30)', '30')
  .option('--baseline <days>', 'trailing baseline window size (default 7)', '7')
  .option('--threshold <z>', '|z| threshold for flagging (default 2.0)', '2.0')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: { lookback: string; baseline: string; threshold: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        const baseline = Number.parseInt(opts.baseline, 10);
        const threshold = Number(opts.threshold);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        if (!Number.isFinite(baseline) || baseline < 1) {
          throw new Error(`--baseline must be a positive integer (got ${opts.baseline})`);
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
          throw new Error(`--threshold must be > 0 (got ${opts.threshold})`);
        }

        const queue = await readQueue(paths);
        const report = buildAnomalies(queue, {
          lookbackDays: lookback,
          baselineDays: baseline,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderAnomalies(report) + '\n');
        }

        // Compose with cron alerting: non-zero exit when the most
        // recent day spiked HIGH. Mirrors `budget breached` (exit 2).
        if (report.recentHigh) process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('ratios')
  .description('Score cache-hit-ratio drift over a window using logit-space EWMA')
  .option('--lookback <days>', 'days of history to score (default 30)', '30')
  .option('--alpha <a>', 'EWMA alpha in (0, 1] — newer-sample weight (default 0.3)', '0.3')
  .option('--baseline <days>', 'trailing baseline window over EWMA values (default 7)', '7')
  .option('--threshold <z>', '|z| threshold for flagging in logit space (default 2.0)', '2.0')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        lookback: string;
        alpha: string;
        baseline: string;
        threshold: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        const alpha = Number(opts.alpha);
        const baseline = Number.parseInt(opts.baseline, 10);
        const threshold = Number(opts.threshold);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          throw new Error(`--alpha must be in (0, 1] (got ${opts.alpha})`);
        }
        if (!Number.isFinite(baseline) || baseline < 1) {
          throw new Error(`--baseline must be a positive integer (got ${opts.baseline})`);
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
          throw new Error(`--threshold must be > 0 (got ${opts.threshold})`);
        }

        const queue = await readQueue(paths);
        const report = buildRatiosReport(queue, {
          lookbackDays: lookback,
          alpha,
          baselineDays: baseline,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderRatios(report) + '\n');
        }

        // Compose with cron alerting: non-zero exit when the most
        // recent scored day drifted in either direction. Mirrors
        // `anomalies` (exit 2 on recent high). We exit on `recentLow`
        // too because a falling cache-hit ratio is the operational
        // signal that matters most — costs are climbing.
        if (report.recentHigh || report.recentLow) process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('dashboard')
  .description('One-screen operator view: queue health + token volume drift + cache-hit drift')
  .option('--lookback <days>', 'days of history for anomalies + ratios (default 30)', '30')
  .option('--baseline <days>', 'trailing baseline window for both (default 7)', '7')
  .option('--threshold <z>', '|z| threshold for flagging in both (default 2.0)', '2.0')
  .option('--alpha <a>', 'EWMA alpha for ratios in (0, 1] (default 0.3)', '0.3')
  .option('--json', 'emit JSON')
  .action(
    async (
      opts: {
        lookback: string;
        baseline: string;
        threshold: string;
        alpha: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        const baseline = Number.parseInt(opts.baseline, 10);
        const threshold = Number(opts.threshold);
        const alpha = Number(opts.alpha);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        if (!Number.isFinite(baseline) || baseline < 1) {
          throw new Error(`--baseline must be a positive integer (got ${opts.baseline})`);
        }
        if (!Number.isFinite(threshold) || threshold <= 0) {
          throw new Error(`--threshold must be > 0 (got ${opts.threshold})`);
        }
        if (!Number.isFinite(alpha) || alpha <= 0 || alpha > 1) {
          throw new Error(`--alpha must be in (0, 1] (got ${opts.alpha})`);
        }

        // Read everything in parallel — each builder is pure and
        // independent. Mirrors the parallelism `status` already does.
        const [state, queue, queueSize, sessionQueueSize, cursors, runsCount] =
          await Promise.all([
            readState(paths),
            readQueue(paths),
            fileSize(paths.queueJsonl),
            fileSize(paths.sessionQueueJsonl),
            readCursors(paths),
            countRuns(paths),
          ]);
        const status = buildStatus({
          pewHome: paths.home,
          state,
          queue,
          queueFileSize: queueSize,
          sessionQueueFileSize: sessionQueueSize,
          cursors,
          runsCountApprox: runsCount,
        });
        const anomalies = buildAnomalies(queue, {
          lookbackDays: lookback,
          baselineDays: baseline,
          threshold,
        });
        const ratios = buildRatiosReport(queue, {
          lookbackDays: lookback,
          baselineDays: baseline,
          threshold,
          alpha,
        });
        const dash = buildDashboard({ status, anomalies, ratios });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(dash, null, 2) + '\n');
        } else {
          process.stdout.write(renderDashboard(dash) + '\n');
        }

        // Exit 2 if EITHER dimension flags the most recent day —
        // mirrors the per-subcommand contract so existing cron
        // glue behaves the same when swapped to `dashboard`.
        if (dash.alerting) process.exitCode = 2;
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('heatmap')
  .description('Hour-of-day × day-of-week token-activity matrix (surfaces diurnal/weekly cycles)')
  .option('--lookback <days>', 'days of history to include (default 30)', '30')
  .option('--metric <name>', 'token field: total | input | cached | output', 'total')
  .option('--tz <name>', 'bucket in utc | local (default utc)', 'utc')
  .option('--json', 'emit JSON instead of a colored grid')
  .action(
    async (
      opts: {
        lookback: string;
        metric: string;
        tz: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        const metric = opts.metric as HeatmapMetric;
        if (!['total', 'input', 'cached', 'output'].includes(metric)) {
          throw new Error(
            `--metric must be one of total | input | cached | output (got ${opts.metric})`,
          );
        }
        const tz = opts.tz as HeatmapTz;
        if (!['utc', 'local'].includes(tz)) {
          throw new Error(`--tz must be one of utc | local (got ${opts.tz})`);
        }

        const queue = await readQueue(paths);
        const heatmap = buildHeatmap(queue, {
          lookbackDays: lookback,
          metric,
          tz,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(heatmap, null, 2) + '\n');
        } else {
          process.stdout.write(renderHeatmap(heatmap) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('streaks')
  .description('Activity-cadence runs: longest active streak, longest gap, current run')
  .option('--lookback <days>', 'days of history to include (default 30)', '30')
  .option(
    '--min-tokens <n>',
    'minimum total_tokens for a day to count as ACTIVE (default 1)',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        lookback: string;
        minTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);

        const lookback = Number.parseInt(opts.lookback, 10);
        if (!Number.isFinite(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }

        const queue = await readQueue(paths);
        const report = buildStreaks(queue, {
          lookbackDays: lookback,
          minTokens,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderStreaks(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('sessions')
  .description('Per-session shape: counts, durations, message volume, top groups by source/kind/project_ref')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at (default: open-ended)')
  .option('--by <dim>', 'group dimension: source | kind | project_ref (default source)', 'source')
  .option('--top <n>', 'cap groups shown in the breakdown (default 10)', '10')
  .option(
    '--min-duration <seconds>',
    'drop sessions whose duration_seconds < this (default 0)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since: string;
        until?: string;
        by: string;
        top: string;
        minDuration: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);

        const since = resolveSince(opts.since);
        const until = opts.until ? new Date(opts.until).toISOString() : null;
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minDuration = Number.parseInt(opts.minDuration, 10);
        if (!Number.isFinite(minDuration) || minDuration < 0) {
          throw new Error(
            `--min-duration must be a non-negative integer in seconds (got ${opts.minDuration})`,
          );
        }
        if (opts.by !== 'source' && opts.by !== 'kind' && opts.by !== 'project_ref') {
          throw new Error(
            `--by must be one of source | kind | project_ref (got ${opts.by})`,
          );
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSessions(sessions, {
          since,
          until,
          by: opts.by as SessionsDimension,
          topN,
          minDurationSeconds: minDuration,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSessions(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('gaps')
  .description('Find unusually long idle periods between sessions via empirical-quantile thresholds')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at (default: open-ended)')
  .option('--quantile <q>', 'quantile threshold in (0,1] (default 0.9 — flag the longest 10%)', '0.9')
  .option('--min-gap <seconds>', 'absolute floor; gaps below this never flagged (default 0)', '0')
  .option('--top <n>', 'cap flagged rows shown (default 10)', '10')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since: string;
        until?: string;
        quantile: string;
        minGap: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
        const paths = resolvePewPaths(common.pewHome);

        const since = resolveSince(opts.since);
        const until = opts.until ? new Date(opts.until).toISOString() : null;
        const quantile = Number.parseFloat(opts.quantile);
        if (!Number.isFinite(quantile) || quantile <= 0 || quantile > 1) {
          throw new Error(`--quantile must be in (0,1] (got ${opts.quantile})`);
        }
        const minGap = Number.parseInt(opts.minGap, 10);
        if (!Number.isFinite(minGap) || minGap < 0) {
          throw new Error(`--min-gap must be a non-negative integer (got ${opts.minGap})`);
        }
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildGaps(sessions, {
          since,
          until,
          quantile,
          minGapSeconds: minGap,
          topN,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderGaps(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('velocity')
  .description('Tokens-per-minute during active hour-stretches (intensity, not totals)')
  .option('--lookback <hours>', 'hours of history ending at now (default 168)', '168')
  .option('--min-tokens <n>', 'minimum total_tokens for an hour to count as ACTIVE (default 1)', '1')
  .option('--top <n>', 'cap top-stretches table (default 10)', '10')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { lookback: string; minTokens: string; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const lookback = Number.parseInt(opts.lookback, 10);
        if (!Number.isInteger(lookback) || lookback < 1) {
          throw new Error(`--lookback must be a positive integer (got ${opts.lookback})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be >= 0 (got ${opts.minTokens})`);
        }
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }

        const queue = await readQueue(paths);
        const report = buildVelocity(queue, {
          lookbackHours: lookback,
          minTokensPerHour: minTokens,
          topN,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderVelocity(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('concurrency')
  .description('Peak overlapping sessions and time-at-each-level histogram')
  .option('--since <iso>', 'inclusive ISO lower bound on the sweep window')
  .option('--until <iso>', 'exclusive ISO upper bound on the sweep window')
  .option('--top <n>', 'cap on peakSessions[] (default 10)', '10')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildConcurrency(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topN,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderConcurrency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('transitions')
  .description('Adjacency matrix of source-to-source session handoffs (with gap distribution)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "grouping dimension: source | kind | project_ref (default 'source')", 'source')
  .option('--max-gap-seconds <n>', 'max gap to count as a handoff (default 1800 = 30 min)', '1800')
  .option('--top <n>', 'top-N transitions to surface (default 10)', '10')
  .option('--min-count <n>', 'drop cells with count < n from the surfaced table (default 0)', '0')
  .option('--exclude-self-loops', 'drop A→A cells from the surfaced table', false)
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        maxGapSeconds: string;
        top: string;
        minCount: string;
        excludeSelfLoops?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minCount = Number.parseInt(opts.minCount, 10);
        if (!Number.isInteger(minCount) || minCount < 0) {
          throw new Error(`--min-count must be a non-negative integer (got ${opts.minCount})`);
        }
        const maxGapSeconds = Number.parseFloat(opts.maxGapSeconds);
        if (!Number.isFinite(maxGapSeconds) || maxGapSeconds < 0) {
          throw new Error(`--max-gap-seconds must be a non-negative finite number (got ${opts.maxGapSeconds})`);
        }
        if (opts.by !== 'source' && opts.by !== 'kind' && opts.by !== 'project_ref') {
          throw new Error(`--by must be 'source' | 'kind' | 'project_ref' (got ${opts.by})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildTransitions(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as TransitionsDimension,
          maxGapSeconds,
          topN,
          minCount,
          excludeSelfLoops: opts.excludeSelfLoops ?? false,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTransitions(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('agent-mix')
  .description('Per-group token share with HHI + Gini concentration scalars')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--by <dim>', "grouping dimension: source | model | kind (default 'source')", 'source')
  .option('--metric <name>', "token field: total | input | output | cached (default 'total')", 'total')
  .option('--top <n>', 'top-N groups to surface (default 10)', '10')
  .option('--min-tokens <n>', 'drop groups with tokens < n from the surfaced table (default 0)', '0')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        metric: string;
        top: string;
        minTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topN = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(topN) || topN < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        if (opts.by !== 'source' && opts.by !== 'model' && opts.by !== 'kind') {
          throw new Error(`--by must be 'source' | 'model' | 'kind' (got ${opts.by})`);
        }
        if (
          opts.metric !== 'total' &&
          opts.metric !== 'input' &&
          opts.metric !== 'output' &&
          opts.metric !== 'cached'
        ) {
          throw new Error(`--metric must be 'total' | 'input' | 'output' | 'cached' (got ${opts.metric})`);
        }

        const queue = await readQueue(paths);
        const report = buildAgentMix(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as AgentMixDimension,
          metric: opts.metric as AgentMixMetric,
          topN,
          minTokens,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderAgentMix(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('session-lengths')
  .description('Binned histogram of session duration_seconds with quantile waypoints (p50/p90/p95/p99/max)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-duration-seconds <n>', 'drop sessions shorter than this (default 0)', '0')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in seconds, strictly ascending (default ${DEFAULT_LENGTH_EDGES_SECONDS.join(',')})`,
  )
  .option('--unit <name>', "display unit for durations: auto | seconds | minutes | hours (default 'auto')", 'auto')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minDurationSeconds: string;
        edges?: string;
        unit: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDurationSeconds = Number.parseFloat(opts.minDurationSeconds);
        if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
          throw new Error(`--min-duration-seconds must be a non-negative finite number (got ${opts.minDurationSeconds})`);
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        if (
          opts.unit !== 'auto' &&
          opts.unit !== 'seconds' &&
          opts.unit !== 'minutes' &&
          opts.unit !== 'hours'
        ) {
          throw new Error(`--unit must be 'auto' | 'seconds' | 'minutes' | 'hours' (got ${opts.unit})`);
        }
        let edgesSeconds: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edgesSeconds = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSessionLengths(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as SessionLengthsDimension,
          minDurationSeconds,
          edgesSeconds,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(
            renderSessionLengths(report, { unit: opts.unit as SessionLengthsUnit }) + '\n',
          );
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('reply-ratio')
  .description('Distribution of per-session assistant_messages / user_messages with quantile waypoints')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-total-messages <n>', 'drop sessions with total_messages < n (default 2)', '2')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges on the ratio scale, strictly ascending (default ${DEFAULT_RATIO_EDGES.join(',')})`,
  )
  .option(
    '--threshold <n>',
    'report aboveThresholdShare = fraction of sessions with ratio > n (default unset)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTotalMessages: string;
        edges?: string;
        threshold?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTotalMessages = Number.parseFloat(opts.minTotalMessages);
        if (!Number.isFinite(minTotalMessages) || minTotalMessages < 0) {
          throw new Error(`--min-total-messages must be a non-negative finite number (got ${opts.minTotalMessages})`);
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }
        let threshold: number | undefined;
        if (opts.threshold != null && opts.threshold.length > 0) {
          const v = Number.parseFloat(opts.threshold);
          if (!Number.isFinite(v) || v <= 0) {
            throw new Error(`--threshold must be a positive finite number (got '${opts.threshold}')`);
          }
          threshold = v;
        }

        const sessions = await readSessionQueue(paths);
        const report = buildReplyRatio(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as ReplyRatioDimension,
          minTotalMessages,
          edges,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderReplyRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('turn-cadence')
  .description('Distribution of per-session avg seconds between operator turns (duration_seconds / user_messages)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-duration-seconds <n>', 'drop sessions with duration_seconds < n (default 1)', '1')
  .option(
    '--min-user-messages <n>',
    'drop sessions with user_messages < n (default 1; set 2 to exclude single-prompt sessions where cadence collapses into pure duration)',
    '1',
  )
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in seconds, strictly ascending (default ${DEFAULT_CADENCE_EDGES_SECONDS.join(',')})`,
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minDurationSeconds: string;
        minUserMessages: string;
        edges?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDurationSeconds = Number.parseFloat(opts.minDurationSeconds);
        if (!Number.isFinite(minDurationSeconds) || minDurationSeconds < 0) {
          throw new Error(
            `--min-duration-seconds must be a non-negative finite number (got ${opts.minDurationSeconds})`,
          );
        }
        const minUserMessages = Number.parseFloat(opts.minUserMessages);
        if (!Number.isFinite(minUserMessages) || minUserMessages < 1) {
          throw new Error(
            `--min-user-messages must be a finite number >= 1 (got ${opts.minUserMessages})`,
          );
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }

        const sessions = await readSessionQueue(paths);
        const report = buildTurnCadence(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as TurnCadenceDimension,
          minDurationSeconds,
          minUserMessages,
          edges,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTurnCadence(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-run-lengths')
  .description(
    'Distribution of consecutive same-source session run-lengths (operator stickiness on a source before switching)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option(
    '--min-runs <n>',
    'drop sources whose post-window run-count is < n (default 1; sparse sources counted as droppedSparseSources)',
    '1',
  )
  .option(
    '--top <n>',
    'display cap on the per-source list after sort + min-runs filter; hidden rows surface as droppedBelowTopCap',
  )
  .option(
    '--filter-source <list>',
    'comma-separated source allowlist; sessions whose source is not in the list are dropped before run computation and counted as droppedByFilterSource',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minRuns: string;
        top?: string;
        filterSource?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRuns = Number.parseFloat(opts.minRuns);
        if (!Number.isFinite(minRuns) || minRuns < 1) {
          throw new Error(`--min-runs must be a finite number >= 1 (got ${opts.minRuns})`);
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        let filterSources: string[] | undefined;
        if (opts.filterSource != null && opts.filterSource.trim().length > 0) {
          filterSources = opts.filterSource
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (filterSources.length === 0) {
            throw new Error(`--filter-source must contain at least one non-empty source`);
          }
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSourceRunLengths(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRuns,
          top,
          filterSources,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRunLengths(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('hour-of-day-source-mix-entropy')
  .description(
    'Per UTC hour-of-day Shannon entropy of per-source token share (mono- vs poly-source hours)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-tokens <n>',
    'hide hours with fewer than n total tokens; their counts surface as droppedSparseHours (default 0)',
    '0',
  )
  .option(
    '--top-k <n>',
    'cap hours[] to the top K by entropyBits desc (most poly-source hours first); ties by hour asc; hidden hours surface as droppedBelowTopK; global rollup unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minTokens: string; topK?: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative finite number (got ${opts.minTokens})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        const queue = await readQueue(paths);
        const report = buildHourOfDaySourceMixEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minTokens,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderHourOfDaySourceMixEntropy(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-token-gini')
  .description(
    "Per-source Gini coefficient of token mass across the source's active UTC hour buckets (steady vs bursty tools)",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-buckets <n>',
    'hide sources active in fewer than n hour buckets; suppressed sources surface as droppedBelowMinBuckets (default 1)',
    '1',
  )
  .option(
    '--filter-source <list>',
    'comma-separated source allowlist; rows whose source is not in the list are dropped before per-source aggregation',
  )
  .option(
    '--top-k <n>',
    'cap sources[] to the top K by gini desc (then tokens desc, source asc); hidden sources surface as droppedBelowTopK; global rollup unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minBuckets: string;
        filterSource?: string;
        topK?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isFinite(minBuckets) || minBuckets < 1) {
          throw new Error(
            `--min-buckets must be a positive integer (got ${opts.minBuckets})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        let filterSources: string[] | undefined;
        if (opts.filterSource != null && opts.filterSource.trim().length > 0) {
          filterSources = opts.filterSource
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (filterSources.length === 0) {
            throw new Error('--filter-source must contain at least one non-empty source');
          }
        }
        const queue = await readQueue(paths);
        const report = buildBucketTokenGini(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minBuckets,
          filterSources,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketTokenGini(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('hour-of-day-token-skew')
  .description(
    'Per UTC hour-of-day, sample skewness (Fisher–Pearson g1) of per-day total_tokens — separates steady hours from rare-burst hours',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-days <n>',
    'hide hours observed on fewer than n distinct UTC days; suppressed hours surface as droppedBelowMinDays (default 2 — structural minimum for a non-zero m2)',
    '2',
  )
  .option(
    '--top-k <n>',
    'cap hours[] to the top K by |skew| desc (then tokens desc, hour asc); hidden hours surface as droppedBelowTopK; global rollup unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minDays: string;
        topK?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 2) {
          throw new Error(
            `--min-days must be an integer >= 2 (got ${opts.minDays})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        const queue = await readQueue(paths);
        const report = buildHourOfDayTokenSkew(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minDays,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderHourOfDayTokenSkew(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-rank-churn')
  .description(
    'Day-over-day instability of the source-by-tokens leaderboard via normalised Spearman footrule on adjacent UTC dates',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-days <n>',
    'drop sources observed on fewer than n distinct UTC days; suppressed sources surface as droppedBelowMinDays (default 1)',
    '1',
  )
  .option(
    '--top-k <n>',
    'cap sources[] to the top K by meanRank asc (then source asc); hidden sources surface as droppedBelowTopK; global rollup unchanged',
  )
  .option(
    '--min-pair-union <n>',
    'drop adjacent UTC-day pairs whose union of sources is below n (default 2; raise to 3 to suppress the polarising n=2 case where footrule is forced to 0 or 1)',
    '2',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minDays: string;
        topK?: string;
        minPairUnion: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be an integer >= 1 (got ${opts.minDays})`,
          );
        }
        let topK: number | null = null;
        if (opts.topK != null) {
          const t = Number.parseFloat(opts.topK);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top-k must be a positive integer (got ${opts.topK})`);
          }
          topK = t;
        }
        const minPairUnion = Number.parseInt(opts.minPairUnion, 10);
        if (!Number.isFinite(minPairUnion) || minPairUnion < 2) {
          throw new Error(
            `--min-pair-union must be an integer >= 2 (got ${opts.minPairUnion})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceRankChurn(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minDays,
          topK,
          minPairUnion,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceRankChurn(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-debut-recency')
  .description(
    'Per-source debut/recency on the calendar plus a corpus-end newcomer rollup (debutShare = tokens in first debutWindowFraction of own tenure)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <id>', 'restrict to a single normalised model id')
  .option(
    '--min-buckets <n>',
    'drop sources with fewer than n distinct active buckets from the per-source table (default 0); newcomer rollup is unaffected',
    '0',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort and min-buckets; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'recency' (default) | 'tokens' | 'tenure' | 'debutshare' | 'idle'",
    'recency',
  )
  .option(
    '--debut-window-fraction <f>',
    'fraction of each source\u2019s tenure used as its debut window for debutShare; must be in (0, 1] (default 0.25)',
    '0.25',
  )
  .option(
    '--debut-share-min <f>',
    'drop sources whose debutShare is below f from the per-source table; must be in [0, 1] (default 0); suppressed rows surface as droppedBelowDebutShareMin',
    '0',
  )
  .option(
    '--newcomer-window-days <n>',
    'days back from corpus end (asOf) to count as the newcomer cohort for the global rollup; must be > 0 (default 7)',
    '7',
  )
  .option(
    '--as-of <iso>',
    'override the corpus-end anchor; defaults to the latest hour_start across the kept window',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minBuckets: string;
        top?: string;
        sort: string;
        debutWindowFraction: string;
        debutShareMin: string;
        newcomerWindowDays: string;
        asOf?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isFinite(minBuckets) || minBuckets < 0) {
          throw new Error(
            `--min-buckets must be a non-negative integer (got ${opts.minBuckets})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'recency' &&
          sort !== 'tokens' &&
          sort !== 'tenure' &&
          sort !== 'debutshare' &&
          sort !== 'idle'
        ) {
          throw new Error(
            `--sort must be 'recency' | 'tokens' | 'tenure' | 'debutshare' | 'idle' (got ${opts.sort})`,
          );
        }
        const debutWindowFraction = Number.parseFloat(opts.debutWindowFraction);
        if (
          !Number.isFinite(debutWindowFraction) ||
          debutWindowFraction <= 0 ||
          debutWindowFraction > 1
        ) {
          throw new Error(
            `--debut-window-fraction must be in (0, 1] (got ${opts.debutWindowFraction})`,
          );
        }
        const debutShareMin = Number.parseFloat(opts.debutShareMin);
        if (
          !Number.isFinite(debutShareMin) ||
          debutShareMin < 0 ||
          debutShareMin > 1
        ) {
          throw new Error(
            `--debut-share-min must be in [0, 1] (got ${opts.debutShareMin})`,
          );
        }
        const newcomerWindowDays = Number.parseFloat(opts.newcomerWindowDays);
        if (!Number.isFinite(newcomerWindowDays) || newcomerWindowDays <= 0) {
          throw new Error(
            `--newcomer-window-days must be > 0 (got ${opts.newcomerWindowDays})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDebutRecency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minBuckets,
          top,
          sort: sort as
            | 'recency'
            | 'tokens'
            | 'tenure'
            | 'debutshare'
            | 'idle',
          debutWindowFraction,
          debutShareMin,
          newcomerWindowDays,
          asOf: opts.asOf ?? null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDebutRecency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-active-day-streak')
  .description(
    "Per-source longest run of consecutive UTC calendar days with at least one positive-token bucket (habit-consistency lens orthogonal to source-tenure / source-run-lengths / bucket-streak-length)",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <id>', 'restrict to a single normalised model id')
  .option('--source <key>', 'restrict to a single source key')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n active days from the per-source table (default 1); display filter only',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + min-days; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'streak' | 'density' | 'current' | 'days' | 'source'",
    'tokens',
  )
  .option(
    '--density-min <f>',
    'drop rows whose density (activeDays/tenureDays) is below f from the per-source table; must be in [0, 1] (default 0); suppressed rows surface as droppedBelowDensityMin',
    '0',
  )
  .option(
    '--min-longest-streak <n>',
    'drop rows whose longestStreak is strictly below n from the per-source table; must be a positive integer (default 1 = no-op); suppressed rows surface as droppedBelowMinLongestStreak',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        densityMin: string;
        minLongestStreak: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'streak' &&
          sort !== 'density' &&
          sort !== 'current' &&
          sort !== 'days' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'streak' | 'density' | 'current' | 'days' | 'source' (got ${opts.sort})`,
          );
        }
        const densityMin = Number.parseFloat(opts.densityMin);
        if (!Number.isFinite(densityMin) || densityMin < 0 || densityMin > 1) {
          throw new Error(
            `--density-min must be in [0, 1] (got ${opts.densityMin})`,
          );
        }
        const minLongestStreak = Number.parseInt(opts.minLongestStreak, 10);
        if (
          !Number.isFinite(minLongestStreak) ||
          minLongestStreak < 1 ||
          !Number.isInteger(minLongestStreak)
        ) {
          throw new Error(
            `--min-longest-streak must be a positive integer (got ${opts.minLongestStreak})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceActiveDayStreak(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as
            | 'tokens'
            | 'streak'
            | 'density'
            | 'current'
            | 'days'
            | 'source',
          densityMin,
          minLongestStreak,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceActiveDayStreak(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-dry-spell')
  .description(
    "Per-source longest run of consecutive UTC inactive days strictly inside tenure (worst-gap geometry — orthogonal complement to source-active-day-streak)",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <id>', 'restrict to a single normalised model id')
  .option('--source <key>', 'restrict to a single source key')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n active days (default 1); display filter only',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + filters',
  )
  .option(
    '--sort <key>',
    "sort key: 'longest' (default) | 'fraction' | 'tokens' | 'inactive' | 'mean' | 'source'",
    'longest',
  )
  .option(
    '--min-longest <n>',
    'drop rows whose longestDrySpell is strictly below n; non-negative integer (default 0 = no-op); use 1 to hide perfect-attendance sources',
    '0',
  )
  .option(
    '--min-fraction <f>',
    'drop rows whose drySpellFraction (inactiveDays/tenureDays) is strictly below f; must be in [0, 1) (default 0 = no-op); use 0.5 to keep only sources whose inactivity dominates tenure',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        minLongest: string;
        minFraction: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isFinite(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'longest' &&
          sort !== 'fraction' &&
          sort !== 'tokens' &&
          sort !== 'inactive' &&
          sort !== 'mean' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'longest' | 'fraction' | 'tokens' | 'inactive' | 'mean' | 'source' (got ${opts.sort})`,
          );
        }
        const minLongest = Number.parseInt(opts.minLongest, 10);
        if (
          !Number.isFinite(minLongest) ||
          minLongest < 0 ||
          !Number.isInteger(minLongest)
        ) {
          throw new Error(
            `--min-longest must be a non-negative integer (got ${opts.minLongest})`,
          );
        }
        const minFraction = Number.parseFloat(opts.minFraction);
        if (
          !Number.isFinite(minFraction) ||
          minFraction < 0 ||
          minFraction >= 1
        ) {
          throw new Error(
            `--min-fraction must be in [0, 1) (got ${opts.minFraction})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDrySpell(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as
            | 'longest'
            | 'fraction'
            | 'tokens'
            | 'inactive'
            | 'mean'
            | 'source',
          minLongest,
          minFraction,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDrySpell(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('message-volume')
  .description('Distribution of per-session total_messages with quantile waypoints')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-total-messages <n>', 'drop sessions with total_messages < n (default 1)', '1')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in messages, strictly ascending (default ${DEFAULT_VOLUME_EDGES.join(',')})`,
  )
  .option(
    '--threshold <n>',
    'report aboveThresholdShare = fraction of sessions with total_messages > n (default unset)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTotalMessages: string;
        edges?: string;
        threshold?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTotalMessages = Number.parseFloat(opts.minTotalMessages);
        if (!Number.isFinite(minTotalMessages) || minTotalMessages < 0) {
          throw new Error(
            `--min-total-messages must be a non-negative finite number (got ${opts.minTotalMessages})`,
          );
        }
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }
        let threshold: number | undefined;
        if (opts.threshold != null && opts.threshold.length > 0) {
          const v = Number.parseFloat(opts.threshold);
          if (!Number.isFinite(v) || v <= 0) {
            throw new Error(
              `--threshold must be a positive finite number (got '${opts.threshold}')`,
            );
          }
          threshold = v;
        }

        const sessions = await readSessionQueue(paths);
        const report = buildMessageVolume(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as MessageVolumeDimension,
          minTotalMessages,
          edges,
          threshold,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderMessageVolume(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-switching')
  .description('Sessions whose snapshots span >1 model; switched-share, distinct-model histogram, top from→to transitions')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source (default 'all')", 'all')
  .option('--top <n>', 'max number of (from→to) transition pairs to emit (default 10)', '10')
  .option(
    '--min-switches <n>',
    "minimum distinct models a session must touch to count as 'switched' (default 2; set 3+ to focus on heavier switching)",
    '2',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        top: string;
        minSwitches: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.by !== 'all' && opts.by !== 'source') {
          throw new Error(`--by must be 'all' | 'source' (got ${opts.by})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(top) || top <= 0) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const minSwitches = Number.parseInt(opts.minSwitches, 10);
        if (!Number.isFinite(minSwitches) || minSwitches < 2) {
          throw new Error(
            `--min-switches must be an integer >= 2 (got ${opts.minSwitches})`,
          );
        }

        const sessions = await readSessionQueueRaw(paths);
        const report = buildModelSwitching(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as ModelSwitchingDimension,
          top,
          minSwitches,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelSwitching(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('idle-gaps')
  .description('Distribution of intra-session idle gaps between consecutive snapshots')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--by <dim>', "split dimension: all | source | kind (default 'all')", 'all')
  .option('--min-gap-seconds <n>', 'drop intra-session gaps shorter than n seconds (default 0)', '0')
  .option(
    '--edges <list>',
    `comma-separated bin upper-edges in seconds, strictly ascending (default ${DEFAULT_IDLE_GAP_EDGES_SECONDS.join(',')})`,
  )
  .option(
    '--top-sessions <n>',
    'also emit the top-N session_keys ranked by max intra-session gap (default 0 = skip)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minGapSeconds: string;
        edges?: string;
        topSessions: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.by !== 'all' && opts.by !== 'source' && opts.by !== 'kind') {
          throw new Error(`--by must be 'all' | 'source' | 'kind' (got ${opts.by})`);
        }
        const minGapSeconds = Number.parseFloat(opts.minGapSeconds);
        if (!Number.isFinite(minGapSeconds) || minGapSeconds < 0) {
          throw new Error(
            `--min-gap-seconds must be a non-negative finite number (got ${opts.minGapSeconds})`,
          );
        }
        const topSessions = Number.parseInt(opts.topSessions, 10);
        if (!Number.isFinite(topSessions) || topSessions < 0) {
          throw new Error(
            `--top-sessions must be a non-negative integer (got ${opts.topSessions})`,
          );
        }
        let edges: number[] | undefined;
        if (opts.edges != null && opts.edges.trim().length > 0) {
          edges = opts.edges.split(',').map((s) => {
            const v = Number.parseFloat(s.trim());
            if (!Number.isFinite(v) || v <= 0) {
              throw new Error(`--edges entries must be positive finite numbers (got '${s}')`);
            }
            return v;
          });
        }

        const sessions = await readSessionQueueRaw(paths);
        const report = buildIdleGaps(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as IdleGapsDimension,
          minGapSeconds,
          edges,
          topSessions,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderIdleGaps(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('session-source-mix')
  .description('Share of sessions per source over time buckets (day | week | month)')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--unit <u>', "bucket granularity: day | week | month (default 'day')", 'day')
  .option(
    '--top <n>',
    "keep only the top-N sources by total sessions in window; fold the rest into 'other' (default 0 = no folding)",
    '0',
  )
  .option(
    '--exclude-source <list>',
    'comma-separated source names to drop *before* bucketing (e.g. synthetic,health-check)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        unit: string;
        top: string;
        excludeSource?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        if (opts.unit !== 'day' && opts.unit !== 'week' && opts.unit !== 'month') {
          throw new Error(`--unit must be 'day' | 'week' | 'month' (got ${opts.unit})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isFinite(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        let excludeSources: string[] | undefined;
        if (opts.excludeSource != null && opts.excludeSource.trim().length > 0) {
          excludeSources = opts.excludeSource
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (excludeSources.length === 0) {
            throw new Error('--exclude-source must contain at least one non-empty entry');
          }
        }

        const sessions = await readSessionQueue(paths);
        const report = buildSourceMix(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          unit: opts.unit as SourceMixBucketUnit,
          top,
          excludeSources,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceMix(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('provider-share')
  .description('Per-session model-provider mix (anthropic / openai / google / ...) by sessions and by message volume')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option('--top-models <n>', 'top distinct models reported per provider (default 3, 0 disables)', '3')
  .option(
    '--min-sessions <n>',
    'hide providers with fewer than n sessions; their counts are surfaced as droppedProviders* but not in the table (default 0)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; topModels: string; minSessions: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topModels = Number.parseInt(opts.topModels, 10);
        if (!Number.isInteger(topModels) || topModels < 0) {
          throw new Error(`--top-models must be a non-negative integer (got ${opts.topModels})`);
        }
        const minSessions = Number.parseInt(opts.minSessions, 10);
        if (!Number.isInteger(minSessions) || minSessions < 0) {
          throw new Error(`--min-sessions must be a non-negative integer (got ${opts.minSessions})`);
        }

        const sessions = await readSessionQueue(paths);
        const report = buildProviderShare(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topModels,
          minSessions,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderProviderShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('time-of-day')
  .description('Distribution of session start times across the 24 hours of the day')
  .option('--since <iso>', 'inclusive ISO lower bound on started_at')
  .option('--until <iso>', 'exclusive ISO upper bound on started_at')
  .option(
    '--tz-offset <offset>',
    'timezone offset for hour bucketing (e.g. -07:00, +08:00, Z). default Z (UTC)',
    'Z',
  )
  .option('--by-source', 'also break down each hour by session source (producer CLI)')
  .option(
    '--collapse <n>',
    'collapse adjacent hours into n-sized bins; n must divide 24 (default 1)',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        tzOffset: string;
        bySource?: boolean;
        collapse: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const collapse = Number.parseInt(opts.collapse, 10);
        if (!Number.isInteger(collapse) || collapse < 1 || collapse > 24 || 24 % collapse !== 0) {
          throw new Error(
            `--collapse must be a positive divisor of 24 (1, 2, 3, 4, 6, 8, 12, 24); got ${opts.collapse}`,
          );
        }

        const sessions = await readSessionQueue(paths);
        const report = buildTimeOfDay(sessions, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          tzOffset: opts.tzOffset,
          bySource: opts.bySource === true,
          collapse,
        });

        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTimeOfDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cache-hit-ratio')
  .description('Per-model prompt-cache hit ratio (cached_input_tokens / input_tokens) across queue.jsonl')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option('--by-source', 'also break down each model row by source (producer CLI)')
  .option(
    '--top <n>',
    'show only the top n models by input volume; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; bySource?: boolean; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildCacheHitRatio(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          bySource: opts.bySource === true,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCacheHitRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('reasoning-share')
  .description('Per-model token-weighted share of reasoning_output_tokens / (output + reasoning) across queue.jsonl')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by generated volume; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildReasoningShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderReasoningShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('prompt-size')
  .description('Per-model distribution of input_tokens per row across queue.jsonl (context-window pressure)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by row count; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--at-least <n>',
    'drop rows whose input_tokens < n BEFORE bucketing/mean/p95; lets you scope to long-context workloads only (default 0 = no floor)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; atLeast: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const atLeast = Number.parseInt(opts.atLeast, 10);
        if (!Number.isFinite(atLeast) || atLeast < 0) {
          throw new Error(`--at-least must be a non-negative integer (got ${opts.atLeast})`);
        }
        const queue = await readQueue(paths);
        const report = buildPromptSize(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          atLeast,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderPromptSize(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('output-size')
  .description('Per-model distribution of output_tokens per row across queue.jsonl (completion size, latency / cost geometry)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n rows; their counts surface as droppedModelRows but not in the table (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by row count; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--at-least <n>',
    'drop rows whose output_tokens < n BEFORE bucketing/mean/p95; lets you scope to heavy-completion workloads only (default 0 = no floor)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .option(
    '--by <dim>',
    'group rows by model | source (default model). Source-grouping answers "which CLI is generating the long-completion mass?"',
    'model',
  )
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; atLeast: string; by: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const atLeast = Number.parseInt(opts.atLeast, 10);
        if (!Number.isFinite(atLeast) || atLeast < 0) {
          throw new Error(`--at-least must be a non-negative integer (got ${opts.atLeast})`);
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildOutputSize(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          atLeast,
          by: opts.by as 'model' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderOutputSize(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('peak-hour-share')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model). Source-grouping answers "which CLI is bursty?"',
    'model',
  )
  .option(
    '--min-days <n>',
    'hide groups with fewer than n contributing days; their counts surface as droppedGroupRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by day count; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-active-hours <n>',
    'drop (group, day) pairs with fewer than n distinct active hours BEFORE peak-share is recorded; default 1 keeps singleton-hour days at 100%',
    '1',
  )
  .option(
    '--peak-window <k>',
    'width of the peak window in hours, in [1, 24] (default 1 = busiest single hour). Sums the K highest-token hours per day before dividing by the day total — answers "what fraction of the day landed in my busiest K hours?"',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minDays: string;
        top: string;
        minActiveHours: string;
        peakWindow: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 0) {
          throw new Error(`--min-days must be a non-negative integer (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minActiveHours = Number.parseInt(opts.minActiveHours, 10);
        if (!Number.isInteger(minActiveHours) || minActiveHours < 1 || minActiveHours > 24) {
          throw new Error(
            `--min-active-hours must be an integer in [1, 24] (got ${opts.minActiveHours})`,
          );
        }
        const peakWindow = Number.parseInt(opts.peakWindow, 10);
        if (!Number.isInteger(peakWindow) || peakWindow < 1 || peakWindow > 24) {
          throw new Error(
            `--peak-window must be an integer in [1, 24] (got ${opts.peakWindow})`,
          );
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildPeakHourShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minDays,
          top,
          minActiveHours,
          peakWindowHours: peakWindow,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderPeakHourShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('weekday-share')
  .description('Per-model token mass distribution across ISO weekdays (Mon..Sun, UTC) with HHI concentration')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model)',
    'model',
  )
  .option(
    '--min-tokens <n>',
    'hide groups with fewer than n total tokens; their counts surface as droppedGroupRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by total tokens; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-active-weekdays <n>',
    'hide groups whose activeWeekdays count is < n; their counts surface as droppedSparseGroups. Default 1 keeps every group with any activity. Bump to 5 to hide single-weekday models that trivially score HHI = 1.0',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTokens: string;
        top: string;
        minActiveWeekdays: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minActiveWeekdays = Number.parseInt(opts.minActiveWeekdays, 10);
        if (
          !Number.isInteger(minActiveWeekdays) ||
          minActiveWeekdays < 1 ||
          minActiveWeekdays > 7
        ) {
          throw new Error(
            `--min-active-weekdays must be an integer in [1, 7] (got ${opts.minActiveWeekdays})`,
          );
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildWeekdayShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minTokens,
          top,
          minActiveWeekdays,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderWeekdayShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('burstiness')
  .description('Per-model coefficient-of-variation of hourly token usage (cv = stddev/mean over active hour buckets)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model)',
    'model',
  )
  .option(
    '--min-tokens <n>',
    'hide groups with fewer than n total tokens; their counts surface as droppedGroupRows (default 0)',
    '0',
  )
  .option(
    '--min-active-hours <n>',
    'hide groups with fewer than n distinct active hour buckets; their counts surface as droppedSparseGroups (default 1)',
    '1',
  )
  .option(
    '--min-cv <x>',
    'hide groups whose coefficient of variation is < x; their counts surface as droppedLowCvGroups. Default 0 keeps every group. Bump to 1.0 to keep only clearly bursty groups (stddev >= mean)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by total tokens; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minTokens: string;
        minActiveHours: string;
        minCv: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const minActiveHours = Number.parseInt(opts.minActiveHours, 10);
        if (!Number.isInteger(minActiveHours) || minActiveHours < 1) {
          throw new Error(
            `--min-active-hours must be a positive integer (got ${opts.minActiveHours})`,
          );
        }
        const minCv = Number.parseFloat(opts.minCv);
        if (!Number.isFinite(minCv) || minCv < 0) {
          throw new Error(`--min-cv must be a non-negative number (got ${opts.minCv})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const queue = await readQueue(paths);
        const report = buildBurstiness(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minTokens,
          minActiveHours,
          minCv,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBurstiness(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('device-share')
  .description('Per-device_id share of token mass with model/source/cache breakdown')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-tokens <n>',
    'hide devices with fewer than n total tokens; their counts surface as droppedMinTokens (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n devices by total tokens; remainder surface as droppedTopDevices (default 0 = no cap)',
    '0',
  )
  .option(
    '--redact',
    'replace each device_id with a stable short label (dev-XXXXXXXX, sha256/8) for shareable output',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minTokens: string;
        top: string;
        redact?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildDeviceShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minTokens,
          top,
          redact: opts.redact ?? false,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDeviceShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('output-input-ratio')
  .description('Per-model output/input token ratio (chatty vs terse) over a window')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n considered rows; their counts surface as droppedModelRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by input volume; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--by-source',
    'also break down each per-model row by source (the local producer CLI); display only, global ratios unchanged',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minRows: string;
        top: string;
        bySource?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildOutputInputRatio(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          bySource: opts.bySource ?? false,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderOutputInputRatio(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-mix-entropy')
  .description('Per-source Shannon entropy of model usage (mono- vs poly-model producers)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-tokens <n>',
    'hide sources with fewer than n total tokens; their counts surface as droppedMinTokens (default 0)',
    '0',
  )
  .option(
    '--top-k <n>',
    'also list the top k models per source (display only; entropy figures unchanged) (default 0 = no breakdown)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minTokens: string; topK: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const topK = Number.parseInt(opts.topK, 10);
        if (!Number.isInteger(topK) || topK < 0) {
          throw new Error(`--top-k must be a non-negative integer (got ${opts.topK})`);
        }
        const queue = await readQueue(paths);
        const report = buildModelMixEntropy(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minTokens,
          topK,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelMixEntropy(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('weekend-vs-weekday')
  .description('Per-model weekend (Sat/Sun UTC) vs weekday token mass split with ratio')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-rows <n>',
    'hide models with fewer than n considered rows (weekend+weekday); counts surface as droppedMinRows (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models by total tokens; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--by-source',
    'also break down each kept model row by source (display only; top-level numbers unchanged)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: { since?: string; until?: string; minRows: string; top: string; bySource?: boolean; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 0) {
          throw new Error(`--min-rows must be a non-negative integer (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildWeekendVsWeekday(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minRows,
          top,
          bySource: opts.bySource ?? false,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderWeekendVsWeekday(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cache-hit-by-hour')
  .description('Prompt-cache effectiveness (cached/input ratio) bucketed by hour-of-day (UTC), per source')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-input <n>',
    'hide sources whose total input_tokens is below n (display only; counts surface as droppedMinInputTokens) (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources by input tokens; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .option('--source <name>', 'restrict to a single source (e.g. "codex"); totals and byHour reflect only that source')
  .action(
    async (
      opts: { since?: string; until?: string; minInput: string; top: string; source?: string; json?: boolean },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minInput = Number.parseFloat(opts.minInput);
        if (!Number.isFinite(minInput) || minInput < 0) {
          throw new Error(`--min-input must be a non-negative number (got ${opts.minInput})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildCacheHitByHour(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minInputTokens: minInput,
          topSources: top,
          source: opts.source ?? null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCacheHitByHour(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-cohabitation')
  .description('Pairs of models that share the same UTC hour bucket; cohabIndex = Jaccard on bucket presence')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-co-buckets <n>',
    'hide pairs with fewer than n shared buckets; counts surface as droppedMinCoBuckets (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n pairs by coBuckets; remainder surface as droppedTopPairs (default 0 = no cap)',
    '0',
  )
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option('--by-model <name>', 'restrict pair report to pairs that include this model (post-normalisation); display only')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minCoBuckets: string;
        top: string;
        source?: string;
        byModel?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minCoBuckets = Number.parseInt(opts.minCoBuckets, 10);
        if (!Number.isInteger(minCoBuckets) || minCoBuckets < 0) {
          throw new Error(`--min-co-buckets must be a non-negative integer (got ${opts.minCoBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildModelCohabitation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minCoBuckets,
          top,
          source: opts.source ?? null,
          byModel: opts.byModel ?? null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelCohabitation(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('interarrival-time')
  .description('Per-source distribution of gaps (hours) between consecutive distinct UTC hour buckets with positive token mass')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-active-buckets <n>',
    'hide sources with fewer than n active hour buckets; counts surface as droppedMinActiveBuckets (default 0)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'buckets' (default) | 'gaps' | 'p90'",
    'buckets',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        minActiveBuckets: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minActiveBuckets = Number.parseInt(opts.minActiveBuckets, 10);
        if (!Number.isInteger(minActiveBuckets) || minActiveBuckets < 0) {
          throw new Error(`--min-active-buckets must be a non-negative integer (got ${opts.minActiveBuckets})`);
        }
        if (opts.sort !== 'buckets' && opts.sort !== 'gaps' && opts.sort !== 'p90') {
          throw new Error(`--sort must be 'buckets' | 'gaps' | 'p90' (got ${opts.sort})`);
        }
        const queue = await readQueue(paths);
        const report = buildInterarrivalTime(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          minActiveBuckets,
          sort: opts.sort as 'buckets' | 'gaps' | 'p90',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderInterarrivalTime(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-intensity')
  .description('Per-model distribution of total_tokens per UTC hour bucket; percentiles + magnitude histogram')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'hide model rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--bucket-tokens-min <n>',
    'noise-floor: drop individual (model, hour) buckets whose summed total_tokens < n; counts surface as droppedBucketTokensMin (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n models after sorting; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for models[]: 'tokens' (default) | 'buckets' | 'p99' | 'spread'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        bucketTokensMin: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const bucketTokensMin = Number.parseInt(opts.bucketTokensMin, 10);
        if (!Number.isInteger(bucketTokensMin) || bucketTokensMin < 0) {
          throw new Error(
            `--bucket-tokens-min must be a non-negative integer (got ${opts.bucketTokensMin})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'p99' &&
          opts.sort !== 'spread'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'buckets' | 'p99' | 'spread' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketIntensity(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          bucketTokensMin,
          top,
          sort: opts.sort as 'tokens' | 'buckets' | 'p99' | 'spread',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketIntensity(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('model-tenure')
  .description('Per-model active span: firstSeen, lastSeen, spanHours, activeBuckets, tokens, tokensPerSpanHour')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'show only the top n models after sorting; remainder surface as droppedTopModels (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for models[]: 'span' (default) | 'active' | 'tokens' | 'density'",
    'span',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'span' &&
          opts.sort !== 'active' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'density'
        ) {
          throw new Error(
            `--sort must be 'span' | 'active' | 'tokens' | 'density' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildModelTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'span' | 'active' | 'tokens' | 'density',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderModelTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('provider-tenure')
  .description('Per-provider active span: firstSeen, lastSeen, spanHours, activeBuckets, distinctModels, tokens, tokensPerSpanHour (vendor-axis analog of model-tenure)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'drop providers whose activeBuckets < n; suppressed rows surface as droppedSparseProviders (applied before --top; default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n providers after sorting; remainder surface as droppedTopProviders (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for providers[]: 'span' (default) | 'active' | 'tokens' | 'density' | 'models'",
    'span',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'span' &&
          opts.sort !== 'active' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'density' &&
          opts.sort !== 'models'
        ) {
          throw new Error(
            `--sort must be 'span' | 'active' | 'tokens' | 'density' | 'models' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildProviderTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          sort: opts.sort as 'span' | 'active' | 'tokens' | 'density' | 'models',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderProviderTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('first-bucket-of-day')
  .description('Per UTC calendar day, the earliest active hour bucket — wake-up clock lens with min/max/mean/median/p25/p75/mode firstHour stats')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'show only the most-recent n days; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'first-hour' (asc) | 'tokens' (desc) | 'buckets' (desc)",
    'day',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'first-hour' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets'
        ) {
          throw new Error(
            `--sort must be 'day' | 'first-hour' | 'tokens' | 'buckets' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildFirstBucketOfDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'first-hour' | 'tokens' | 'buckets',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderFirstBucketOfDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('last-bucket-of-day')
  .description('Per UTC calendar day, the latest active hour bucket — shutdown-clock lens with min/max/mean/median/p25/p75/mode lastHour stats')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'cap days[] after sorting; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'last-hour' (desc) | 'tokens' (desc) | 'buckets' (desc)",
    'day',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'last-hour' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets'
        ) {
          throw new Error(
            `--sort must be 'day' | 'last-hour' | 'tokens' | 'buckets' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildLastBucketOfDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'last-hour' | 'tokens' | 'buckets',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderLastBucketOfDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('output-token-decile-distribution')
  .description('Rank all positive-output buckets ascending and partition into 10 equal-sized deciles; report per-decile mass + Gini + top-10%/top-1% concentration')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-output <n>',
    'drop bucket rows whose output_tokens < n before partitioning; suppressed rows surface as droppedBelowMinOutput. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minOutput: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minOutput = Number.parseInt(opts.minOutput, 10);
        if (!Number.isInteger(minOutput) || minOutput < 0) {
          throw new Error(`--min-output must be a non-negative integer (got ${opts.minOutput})`);
        }
        const queue = await readQueue(paths);
        const report = buildOutputTokenDecileDistribution(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minOutput,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderOutputTokenDecileDistribution(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('input-token-decile-distribution')
  .description('Rank all positive-input buckets ascending and partition into 10 equal-sized deciles; report per-decile mass + Gini + top-10%/top-1% concentration on input_tokens (the context/prompt side of cost)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-input <n>',
    'drop bucket rows whose input_tokens < n before partitioning; suppressed rows surface as droppedBelowMinInput. Default 0 = no floor.',
    '0',
  )
  .option(
    '--top <n>',
    'surface the heaviest N individual buckets (with hour_start/source/model/decile) under topBuckets, for D10 outlier drill-down. Default 0 = no top list.',
    '0',
  )
  .option(
    '--bottom <n>',
    'surface the lightest N individual buckets under bottomBuckets, sorted ascending. Default 0 = no bottom list.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minInput: string;
        top: string;
        bottom: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minInput = Number.parseInt(opts.minInput, 10);
        if (!Number.isInteger(minInput) || minInput < 0) {
          throw new Error(`--min-input must be a non-negative integer (got ${opts.minInput})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const bottom = Number.parseInt(opts.bottom, 10);
        if (!Number.isInteger(bottom) || bottom < 0) {
          throw new Error(`--bottom must be a non-negative integer (got ${opts.bottom})`);
        }
        const queue = await readQueue(paths);
        const report = buildInputTokenDecileDistribution(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minInput,
          top,
          bottom,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderInputTokenDecileDistribution(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );


program
  .command('active-span-per-day')
  .description('Per UTC calendar day, the workday window: firstHour, lastHour, spanHours, activeBuckets, and dutyCycle (= activeBuckets / spanHours)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top <n>',
    'cap days[] after sorting; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'span' (desc) | 'duty' (desc) | 'tokens' (desc) | 'active' (desc)",
    'day',
  )
  .option(
    '--min-span <n>',
    'drop days whose spanHours < n before computing summary stats; suppressed days surface as droppedShortSpanDays. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        minSpan: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minSpan = Number.parseInt(opts.minSpan, 10);
        if (!Number.isInteger(minSpan) || minSpan < 0) {
          throw new Error(`--min-span must be a non-negative integer (got ${opts.minSpan})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'span' &&
          opts.sort !== 'duty' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'active'
        ) {
          throw new Error(
            `--sort must be 'day' | 'span' | 'duty' | 'tokens' | 'active' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildActiveSpanPerDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'span' | 'duty' | 'tokens' | 'active',
          minSpan,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderActiveSpanPerDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('tail-share')
  .description('Per-source Pareto: fraction of total tokens in the top 1/5/10/20% of buckets, with giniLike concentration scalar')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--min-buckets <n>',
    'drop sources whose bucketCount < n; suppressed rows surface as droppedSparseSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting by giniLike desc; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        minBuckets: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildTailShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          minBuckets,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTailShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('tenure-vs-density-quadrant')
  .description('Classify each model into a 2×2 quadrant by (long/short tenure × dense/sparse density), with global medians as splits')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'drop models whose activeBuckets < n before computing medians; suppressed rows surface as droppedSparseModels (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap each quadrant\'s displayed model list to the top n rows; remainder surface as droppedTop per quadrant (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key inside each quadrant's models[]: 'tokens' (default) | 'span' | 'density' | 'active'",
    'tokens',
  )
  .option(
    '--quadrant <q>',
    "restrict the report to a single quadrant: 'long-dense' | 'long-sparse' | 'short-dense' | 'short-sparse' (medians still computed over the full population)",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        sort: string;
        quadrant?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'span' &&
          opts.sort !== 'density' &&
          opts.sort !== 'active'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'span' | 'density' | 'active' (got ${opts.sort})`,
          );
        }
        if (
          opts.quadrant !== undefined &&
          opts.quadrant !== 'long-dense' &&
          opts.quadrant !== 'long-sparse' &&
          opts.quadrant !== 'short-dense' &&
          opts.quadrant !== 'short-sparse'
        ) {
          throw new Error(
            `--quadrant must be 'long-dense' | 'long-sparse' | 'short-dense' | 'short-sparse' (got ${opts.quadrant})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildTenureDensityQuadrant(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          sort: opts.sort as 'tokens' | 'span' | 'density' | 'active',
          quadrant: (opts.quadrant ?? null) as
            | 'long-dense'
            | 'long-sparse'
            | 'short-dense'
            | 'short-sparse'
            | null,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTenureDensityQuadrant(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-tenure')
  .description('Per-source active span: firstSeen, lastSeen, spanHours, activeBuckets, tokens, distinctModels (the source-axis analog of model-tenure)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <name>', 'restrict analysis to a single (normalised) model; non-matching rows surface as droppedModelFilter')
  .option(
    '--min-buckets <n>',
    'drop sources whose activeBuckets < n; suppressed rows surface as droppedSparseSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--min-models <n>',
    'drop sources whose distinctModels < n; suppressed rows surface as droppedNarrowSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'span' (default) | 'active' | 'tokens' | 'density' | 'models'",
    'span',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minBuckets: string;
        minModels: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const minModels = Number.parseInt(opts.minModels, 10);
        if (!Number.isInteger(minModels) || minModels < 0) {
          throw new Error(`--min-models must be a non-negative integer (got ${opts.minModels})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (
          opts.sort !== 'span' &&
          opts.sort !== 'active' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'density' &&
          opts.sort !== 'models'
        ) {
          throw new Error(
            `--sort must be 'span' | 'active' | 'tokens' | 'density' | 'models' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minBuckets,
          minModels,
          top,
          sort: opts.sort as 'span' | 'active' | 'tokens' | 'density' | 'models',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-streak-length')
  .description('Per-model longest consecutive-active-bucket runs (sustained vs spiky usage)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'drop models whose activeBuckets < n; suppressed rows surface as droppedSparseModels (default 0 = no floor)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for models[]: 'length' (default) | 'tokens' | 'active' | 'mean'",
    'length',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        if (
          opts.sort !== 'length' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'active' &&
          opts.sort !== 'mean'
        ) {
          throw new Error(
            `--sort must be 'length' | 'tokens' | 'active' | 'mean' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketStreakLength(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          sort: opts.sort as 'length' | 'tokens' | 'active' | 'mean',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketStreakLength(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-gap-distribution')
  .description('Per-source distribution of gap sizes (in bucket-widths) between consecutive active buckets')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <name>', 'restrict analysis to a single model; non-matching rows surface as droppedModelFilter')
  .option(
    '--min-gaps <n>',
    'drop sources whose gapCount < n; suppressed rows surface as droppedSparseSources (default 0 = no floor; 1 also suppresses single-bucket sources)',
    '0',
  )
  .option(
    '--min-gap <n>',
    'floor on individual gap size in bucket-widths; gaps below n are dropped before percentile/mean/contiguousShare; counts surface as droppedBelowMinGap and droppedAllGapsFloored (default 0 = no per-gap floor; 2 = "ignore contiguous gaps, describe only true idle stretches")',
    '0',
  )
  .option(
    '--top <n>',
    'cap displayed sources to top n after sort and the min-gaps filter; suppressed rows surface as droppedBelowTopCap (default unset = no cap)',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'gaps' | 'p50' | 'max' | 'contiguous'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minGaps: string;
        minGap: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minGaps = Number.parseInt(opts.minGaps, 10);
        if (!Number.isInteger(minGaps) || minGaps < 0) {
          throw new Error(`--min-gaps must be a non-negative integer (got ${opts.minGaps})`);
        }
        const minGap = Number.parseInt(opts.minGap, 10);
        if (!Number.isInteger(minGap) || minGap < 0) {
          throw new Error(`--min-gap must be a non-negative integer (got ${opts.minGap})`);
        }
        let top: number | null = null;
        if (opts.top !== undefined) {
          top = Number.parseInt(opts.top, 10);
          if (!Number.isInteger(top) || top < 1) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'gaps' &&
          opts.sort !== 'p50' &&
          opts.sort !== 'max' &&
          opts.sort !== 'contiguous'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketGapDistribution(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minGaps,
          minGap,
          top,
          sort: opts.sort as 'tokens' | 'gaps' | 'p50' | 'max' | 'contiguous',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketGapDistribution(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-decay-half-life')
  .description('Per-source token "half-life" along the tenure axis (front-loaded vs back-loaded usage)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--model <name>', 'restrict analysis to a single model; non-matching rows surface as droppedModelFilter')
  .option(
    '--min-buckets <n>',
    'drop sources whose activeBuckets < n; suppressed rows surface as droppedSparseSources (default 0 = no floor)',
    '0',
  )
  .option(
    '--top <n>',
    'cap the number of source rows after sort and the min-buckets floor; suppressed rows surface as droppedBelowTopCap (default unset = no cap)',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'halflife' (default) | 'frontload' | 'tokens' | 'span' | 'active'",
    'halflife',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        model?: string;
        minBuckets: string;
        top?: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        let top: number | null = null;
        if (opts.top !== undefined) {
          top = Number.parseInt(opts.top, 10);
          if (!Number.isInteger(top) || top < 1) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
        }
        if (
          opts.sort !== 'halflife' &&
          opts.sort !== 'frontload' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'span' &&
          opts.sort !== 'active'
        ) {
          throw new Error(
            `--sort must be 'halflife' | 'frontload' | 'tokens' | 'span' | 'active' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceDecayHalfLife(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          model: opts.model ?? null,
          minBuckets,
          top,
          sort: opts.sort as 'halflife' | 'frontload' | 'tokens' | 'span' | 'active',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceDecayHalfLife(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-handoff-frequency')
  .description('How often the primary model changes between consecutive active hour-buckets in time order')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top-handoffs <n>',
    'cap the number of (from -> to) handoff pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--min-handoffs <n>',
    'drop pairs whose count is below n before applying --top-handoffs; suppressed rows surface as droppedBelowMinHandoffs (default 1 = no floor)',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topHandoffs: string;
        minHandoffs: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topHandoffs = Number.parseInt(opts.topHandoffs, 10);
        if (!Number.isInteger(topHandoffs) || topHandoffs < 0) {
          throw new Error(
            `--top-handoffs must be a non-negative integer (got ${opts.topHandoffs})`,
          );
        }
        const minHandoffs = Number.parseInt(opts.minHandoffs, 10);
        if (!Number.isInteger(minHandoffs) || minHandoffs < 1) {
          throw new Error(
            `--min-handoffs must be a positive integer (got ${opts.minHandoffs})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildBucketHandoffFrequency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topHandoffs,
          minHandoffs,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketHandoffFrequency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('inter-source-handoff-latency')
  .description(
    'Median wall-clock time between adjacent active hour-buckets whose primary source (CLI tool) changed — tool-handoff cadence lens with min/median/mean/max latency, contiguous-vs-gapped split, and top (from -> to) source pairs',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--top-handoffs <n>',
    'cap the number of (from -> to) source-handoff pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--min-handoffs <n>',
    'drop pairs whose count is below n before applying --top-handoffs; suppressed rows surface as droppedBelowMinHandoffs (default 1 = no floor)',
    '1',
  )
  .option(
    '--max-latency-hours <n>',
    'exclude handoffs whose latency in hours is strictly greater than n from ALL counters and stats (handoffPairs, latency stats, pairs[], contiguous/gapped split). Suppressed handoffs surface as droppedAboveMaxLatency. Default unset = no cap. Use to focus on live in-session swaps (e.g. 4 drops overnight gaps).',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        topHandoffs: string;
        minHandoffs: string;
        maxLatencyHours?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topHandoffs = Number.parseInt(opts.topHandoffs, 10);
        if (!Number.isInteger(topHandoffs) || topHandoffs < 0) {
          throw new Error(
            `--top-handoffs must be a non-negative integer (got ${opts.topHandoffs})`,
          );
        }
        const minHandoffs = Number.parseInt(opts.minHandoffs, 10);
        if (!Number.isInteger(minHandoffs) || minHandoffs < 1) {
          throw new Error(
            `--min-handoffs must be a positive integer (got ${opts.minHandoffs})`,
          );
        }
        let maxLatencyHours: number | null = null;
        if (opts.maxLatencyHours !== undefined) {
          const v = Number.parseFloat(opts.maxLatencyHours);
          if (!Number.isFinite(v) || v <= 0) {
            throw new Error(
              `--max-latency-hours must be a positive finite number (got ${opts.maxLatencyHours})`,
            );
          }
          maxLatencyHours = v;
        }
        const queue = await readQueue(paths);
        const report = buildInterSourceHandoffLatency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topHandoffs,
          minHandoffs,
          maxLatencyHours,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderInterSourceHandoffLatency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('provider-switching-frequency')
  .description(
    'Per UTC day, how often the primary provider (anthropic / openai / ...) of consecutive active hour-buckets changes — same-day vendor-churn lens with cross-day swap split, top (from -> to) pairs, and per-day rows',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--top-pairs <n>',
    'cap the number of (from -> to) provider-switch pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--top-days <n>',
    'cap the number of days[] rows after sort; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'switches' (desc) | 'buckets' (desc) | 'share' (desc)",
    'day',
  )
  .option(
    '--min-switches <n>',
    'drop days[] rows whose switchPairs count is below n. Display filter only — summary stats still reflect the full population. Suppressed rows surface as droppedBelowMinSwitches. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topPairs: string;
        topDays: string;
        sort: string;
        minSwitches: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topPairs = Number.parseInt(opts.topPairs, 10);
        if (!Number.isInteger(topPairs) || topPairs < 0) {
          throw new Error(
            `--top-pairs must be a non-negative integer (got ${opts.topPairs})`,
          );
        }
        const topDays = Number.parseInt(opts.topDays, 10);
        if (!Number.isInteger(topDays) || topDays < 0) {
          throw new Error(
            `--top-days must be a non-negative integer (got ${opts.topDays})`,
          );
        }
        const minSwitches = Number.parseInt(opts.minSwitches, 10);
        if (!Number.isInteger(minSwitches) || minSwitches < 0) {
          throw new Error(
            `--min-switches must be a non-negative integer (got ${opts.minSwitches})`,
          );
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'switches' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'share'
        ) {
          throw new Error(
            `--sort must be 'day' | 'switches' | 'buckets' | 'share' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildProviderSwitchingFrequency(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topPairs,
          topDays,
          sort: opts.sort as 'day' | 'switches' | 'buckets' | 'share',
          minSwitches,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderProviderSwitchingFrequency(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-breadth-per-day')
  .description('Per UTC calendar day, count of distinct active sources — tool-diversity lens with min/p25/median/mean/p75/max sourceCount stats and single/multi-source day split')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter (degenerates sourceCount to 1)')
  .option(
    '--top <n>',
    'cap days[] after sorting; remainder surface as droppedTopDays. Summary stats always reflect the full population. Default 0 = no cap.',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for days[]: 'day' (default, desc) | 'sources' (desc) | 'tokens' (desc) | 'buckets' (desc)",
    'day',
  )
  .option(
    '--min-sources <n>',
    'drop days whose sourceCount < n before computing summary stats AND days[]; suppressed days surface as droppedBelowMinSources. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        top: string;
        sort: string;
        minSources: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minSources = Number.parseInt(opts.minSources, 10);
        if (!Number.isInteger(minSources) || minSources < 0) {
          throw new Error(`--min-sources must be a non-negative integer (got ${opts.minSources})`);
        }
        if (
          opts.sort !== 'day' &&
          opts.sort !== 'sources' &&
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets'
        ) {
          throw new Error(
            `--sort must be 'day' | 'sources' | 'tokens' | 'buckets' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceBreadthPerDay(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          top,
          sort: opts.sort as 'day' | 'sources' | 'tokens' | 'buckets',
          minSources,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceBreadthPerDay(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('bucket-density-percentile')
  .description('Population-level distribution of total_tokens per bucket pooled across all rows: full percentile ladder (p1..p99.9, max) plus 10-decile mass shares (D1=smallest, D10=top 10%)')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-tokens <n>',
    'drop buckets whose total_tokens < n before percentile and decile computation; suppressed buckets surface as droppedBelowMinTokens. Default 0 = no floor.',
    '0',
  )
  .option(
    '--trim-top <pct>',
    'outlier-trim: drop the top P percent of buckets (by token mass) before percentile and decile computation; suppressed buckets surface as droppedTrimTop. Range [0, 100). Default 0 = no trim.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        trimTop: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(`--min-tokens must be a non-negative integer (got ${opts.minTokens})`);
        }
        const trimTopPct = Number.parseFloat(opts.trimTop);
        if (!Number.isFinite(trimTopPct) || trimTopPct < 0 || trimTopPct >= 100) {
          throw new Error(`--trim-top must be a finite number in [0, 100) (got ${opts.trimTop})`);
        }
        const queue = await readQueue(paths);
        const report = buildBucketDensityPercentile(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          trimTopPct,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderBucketDensityPercentile(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('hour-of-week')
  .description('168-cell joint (weekday × hour-of-day, UTC) concentration lens: Shannon entropy in bits, normalised entropy, Gini, top-K mass share, populated vs dead cells, and top cells by token mass')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option('--model <name>', 'restrict analysis to a single normalised model; non-matching rows surface as droppedModelFilter')
  .option('--top <n>', 'truncate topCells[] to the top N by tokens desc; concentration metrics always reflect the full 168-cell population. Default 10.', '10')
  .option('--top-k <n>', 'mass-share concentration window: report tokenShare of the top K cells. Range [1, 168]. Default 10.', '10')
  .option(
    '--min-cell-tokens <n>',
    'drop cells whose total_tokens < n from topCells[]; suppressed cells surface as droppedSparseCells. Display filter only — entropy / gini / topKShare always reflect the full 168-cell population. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        model?: string;
        top: string;
        topK: string;
        minCellTokens: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 1) {
          throw new Error(`--top must be a positive integer (got ${opts.top})`);
        }
        const topK = Number.parseInt(opts.topK, 10);
        if (!Number.isInteger(topK) || topK < 1 || topK > 168) {
          throw new Error(`--top-k must be an integer in [1, 168] (got ${opts.topK})`);
        }
        const minCellTokens = Number.parseInt(opts.minCellTokens, 10);
        if (!Number.isInteger(minCellTokens) || minCellTokens < 0) {
          throw new Error(`--min-cell-tokens must be a non-negative integer (got ${opts.minCellTokens})`);
        }
        const queue = await readQueue(paths);
        const report = buildHourOfWeek(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          model: opts.model ?? null,
          top,
          topK,
          minCellTokens,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderHourOfWeek(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('device-tenure')
  .description('Per-device active-span lens: firstSeen / lastSeen / spanHours / activeBuckets / tokens / density / distinctSources / distinctModels — completes the tenure family on the device_id axis')
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict to a single source; non-matching rows surface as droppedSourceFilter')
  .option('--model <name>', 'restrict to a single normalised model; non-matching rows surface as droppedModelFilter')
  .option('--min-buckets <n>', 'drop devices with activeBuckets < n from devices[]; counts surface as droppedSparseDevices. Default 0 = keep every device.', '0')
  .option('--top <n>', 'truncate devices[] to the top N after sort; 0 = no cap. Default 0.', '0')
  .option('--sort <key>', 'sort key: span | active | tokens | density | sources | models | gap. Default span.', 'span')
  .option('--recent-threshold-hours <h>', 'hours threshold for the recentlyActive flag. Default 24.', '24')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        model?: string;
        minBuckets: string;
        top: string;
        sort: string;
        recentThresholdHours: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const sort = opts.sort;
        if (
          sort !== 'span' &&
          sort !== 'active' &&
          sort !== 'tokens' &&
          sort !== 'density' &&
          sort !== 'sources' &&
          sort !== 'models' &&
          sort !== 'gap'
        ) {
          throw new Error(`--sort must be one of span | active | tokens | density | sources | models | gap (got ${opts.sort})`);
        }
        const recentThresholdHours = Number(opts.recentThresholdHours);
        if (!Number.isFinite(recentThresholdHours) || recentThresholdHours <= 0) {
          throw new Error(`--recent-threshold-hours must be > 0 (got ${opts.recentThresholdHours})`);
        }
        const queue = await readQueue(paths);
        const report = buildDeviceTenure(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          model: opts.model ?? null,
          minBuckets,
          top,
          sort,
          recentThresholdHours,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDeviceTenure(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('prompt-output-correlation')
  .description(
    'Per-group Pearson correlation between hourly prompt-token mass and output-token mass (with OLS slope/intercept)',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--by <dim>',
    'group rows by model | source (default model)',
    'model',
  )
  .option(
    '--min-buckets <n>',
    'hide groups with fewer than n active hour buckets; their counts surface as droppedSparseGroups (default 2 — Pearson r needs >= 2 points)',
    '2',
  )
  .option(
    '--min-tokens <n>',
    'hide groups whose totalTokens is < n; their counts surface as droppedLowTokenGroups (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n groups by sort key; remainder surface as droppedTopGroups (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort by tokens|r|abs-r|buckets|slope (default tokens, all desc with lex tiebreak on group)',
    'tokens',
  )
  .option(
    '--source <name>',
    'only include rows whose source matches exactly (narrows global denominators too)',
  )
  .option(
    '--model <name>',
    'only include rows whose model matches (post-normaliseModel; narrows global denominators too)',
  )
  .option(
    '--include-reasoning',
    'add reasoning_output_tokens to the y-axis so the correlation describes total reply work, not just visible output (default false)',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        by: string;
        minBuckets: string;
        minTokens: string;
        top: string;
        sort: string;
        source?: string;
        model?: string;
        includeReasoning?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 1) {
          throw new Error(
            `--min-buckets must be a positive integer (got ${opts.minBuckets})`,
          );
        }
        const minTokens = Number.parseInt(opts.minTokens, 10);
        if (!Number.isInteger(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative integer (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        if (opts.by !== 'model' && opts.by !== 'source') {
          throw new Error(`--by must be 'model' or 'source' (got ${opts.by})`);
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'r' &&
          sort !== 'abs-r' &&
          sort !== 'buckets' &&
          sort !== 'slope'
        ) {
          throw new Error(
            `--sort must be one of tokens|r|abs-r|buckets|slope (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildPromptOutputCorrelation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          by: opts.by as 'model' | 'source',
          minBuckets,
          minTokens,
          top,
          sort,
          source: opts.source ?? null,
          model: opts.model ?? null,
          includeReasoning: opts.includeReasoning === true,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderPromptOutputCorrelation(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-pair-cooccurrence')
  .description(
    'Unordered pairs of sources (CLI tools) that are co-active in the same hour-bucket — multi-tool concurrency lens with raw count, share-of-pairs, and Jaccard similarity per pair, plus a multi-source-bucket share',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--top-pairs <n>',
    'cap the number of {a,b} co-occurrence pairs in the table (default 10; use 0 to suppress the table)',
    '10',
  )
  .option(
    '--min-count <n>',
    'drop pairs whose count is below n before applying --top-pairs; suppressed rows surface as droppedBelowMinCount (default 1 = no floor)',
    '1',
  )
  .option(
    '--min-jaccard <n>',
    'drop pairs whose jaccard is below n (in [0,1]); applied after --min-count and before --top-pairs. Suppressed rows surface as droppedBelowMinJaccard. Use to filter out high-count low-jaccard "noise" pairs (a tool that runs everywhere and incidentally overlaps with everything). Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        topPairs: string;
        minCount: string;
        minJaccard: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topPairs = Number.parseInt(opts.topPairs, 10);
        if (!Number.isInteger(topPairs) || topPairs < 0) {
          throw new Error(
            `--top-pairs must be a non-negative integer (got ${opts.topPairs})`,
          );
        }
        const minCount = Number.parseInt(opts.minCount, 10);
        if (!Number.isInteger(minCount) || minCount < 1) {
          throw new Error(
            `--min-count must be a positive integer (got ${opts.minCount})`,
          );
        }
        const minJaccard = Number.parseFloat(opts.minJaccard);
        if (!Number.isFinite(minJaccard) || minJaccard < 0 || minJaccard > 1) {
          throw new Error(
            `--min-jaccard must be a finite number in [0, 1] (got ${opts.minJaccard})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourcePairCooccurrence(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          topPairs,
          minCount,
          minJaccard,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourcePairCooccurrence(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('token-velocity-percentiles')
  .description(
    'Per-source distribution of tokens-per-minute computed at the single UTC hour bucket grain (rate = total_tokens / 60); percentiles p50/p90/p99 plus min/max/mean per source',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'hide source rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--rate-min <n>',
    'noise-floor: drop individual (source, hour) buckets whose tokens-per-minute rate is < n; counts surface as droppedRateMin (default 0)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'buckets' | 'p99' | 'mean'",
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        rateMin: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const rateMin = Number.parseFloat(opts.rateMin);
        if (!Number.isFinite(rateMin) || rateMin < 0) {
          throw new Error(`--rate-min must be a non-negative finite number (got ${opts.rateMin})`);
        }
        if (
          opts.sort !== 'tokens' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'p99' &&
          opts.sort !== 'mean'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'buckets' | 'p99' | 'mean' (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildTokenVelocityPercentiles(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          rateMin,
          sort: opts.sort as 'tokens' | 'buckets' | 'p99' | 'mean',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderTokenVelocityPercentiles(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cost-per-bucket-percentiles')
  .description(
    'Per-source distribution of estimated USD cost per (source, UTC hour) bucket; reports p50/p90/p99 dollars-per-bucket plus min/max/mean per source',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-buckets <n>',
    'hide source rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sorting; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--min-cost <usd>',
    'noise-floor: drop individual (source, hour) buckets whose USD cost is < n; counts surface as droppedMinCost (default 0)',
    '0',
  )
  .option(
    '--top-buckets <n>',
    'tail-zoom: keep only the top n highest-cost buckets *per source* before percentile computation; counts surface as droppedTopBuckets (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'cost' (default) | 'buckets' | 'p99' | 'mean'",
    'cost',
  )
  .option('--rates <path>', 'override rates JSON path (default ~/.config/pew-insights/rates.json)')
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minBuckets: string;
        top: string;
        minCost: string;
        topBuckets: string;
        sort: string;
        rates?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minCost = Number.parseFloat(opts.minCost);
        if (!Number.isFinite(minCost) || minCost < 0) {
          throw new Error(`--min-cost must be a non-negative finite number (got ${opts.minCost})`);
        }
        const topBuckets = Number.parseInt(opts.topBuckets, 10);
        if (!Number.isInteger(topBuckets) || topBuckets < 0) {
          throw new Error(`--top-buckets must be a non-negative integer (got ${opts.topBuckets})`);
        }
        if (
          opts.sort !== 'cost' &&
          opts.sort !== 'buckets' &&
          opts.sort !== 'p99' &&
          opts.sort !== 'mean'
        ) {
          throw new Error(
            `--sort must be 'cost' | 'buckets' | 'p99' | 'mean' (got ${opts.sort})`,
          );
        }
        const ratesPath = opts.rates ?? defaultRatesPath();
        const userRates = await readRatesFile(ratesPath);
        const rates = mergeRates(DEFAULT_RATES, userRates);
        const queue = await readQueue(paths);
        const report = buildCostPerBucketPercentiles(queue, rates, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minBuckets,
          top,
          minCost,
          topBuckets,
          sort: opts.sort as 'cost' | 'buckets' | 'p99' | 'mean',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCostPerBucketPercentiles(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('rolling-bucket-cv')
  .description(
    'Per-source distribution of rolling-window coefficient-of-variation (CV) of token-per-bucket; reveals how spikiness evolves over a source\'s tenure rather than collapsing it to a single scalar like burstiness',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--window-size <n>',
    'rolling window width measured in consecutive active buckets (default 12, must be >= 2)',
    '12',
  )
  .option(
    '--min-buckets <n>',
    'hide source rows with fewer than n active buckets; counts surface as droppedMinBuckets (default 0)',
    '0',
  )
  .option(
    '--min-window-cv <x>',
    'noise-floor: drop individual rolling windows whose CV is < x before per-source aggregation; counts surface as droppedLowCvWindows. Sources whose every window falls below the floor surface as droppedAllWindowsFloored. Default 0 keeps every window.',
    '0',
  )
  .option(
    '--top <n>',
    'show only the top n sources by total tokens; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        windowSize: string;
        minBuckets: string;
        minWindowCv: string;
        top: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const windowSize = Number.parseInt(opts.windowSize, 10);
        if (!Number.isInteger(windowSize) || windowSize < 2) {
          throw new Error(`--window-size must be an integer >= 2 (got ${opts.windowSize})`);
        }
        const minBuckets = Number.parseInt(opts.minBuckets, 10);
        if (!Number.isInteger(minBuckets) || minBuckets < 0) {
          throw new Error(`--min-buckets must be a non-negative integer (got ${opts.minBuckets})`);
        }
        const minWindowCv = Number.parseFloat(opts.minWindowCv);
        if (!Number.isFinite(minWindowCv) || minWindowCv < 0) {
          throw new Error(`--min-window-cv must be a non-negative finite number (got ${opts.minWindowCv})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const queue = await readQueue(paths);
        const report = buildRollingBucketCv(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          windowSize,
          minBuckets,
          minWindowCv,
          top,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderRollingBucketCv(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-autocorrelation-lag1')
  .description(
    'Per-source lag-1 (Pearson) autocorrelation of daily token totals; reveals day-to-day persistence (does today predict tomorrow?) which is invisible to magnitude-only metrics like burstiness or rolling-bucket-cv',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days; counts surface as droppedSparseSources (default 3, must be >= 3)',
    '3',
  )
  .option(
    '--top <n>',
    'show only the top n sources by total tokens; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key for the per-source table: tokens | rho1active | rho1filled | ndays (default tokens). Applied before --top so it changes which sources are kept under a non-zero cap.',
    'tokens',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 3) {
          throw new Error(`--min-days must be an integer >= 3 (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const sort = opts.sort as 'tokens' | 'rho1active' | 'rho1filled' | 'ndays';
        if (!['tokens', 'rho1active', 'rho1filled', 'ndays'].includes(sort)) {
          throw new Error(`--sort must be one of tokens|rho1active|rho1filled|ndays (got ${opts.sort})`);
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenAutocorrelationLag1(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenAutocorrelationLag1(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-monotone-run-length')
  .description(
    "Per-source longest run of strictly monotone (increasing or decreasing) consecutive daily total-token values, plus the live trailing run direction & length. Trajectory-shape statistic orthogonal to autocorrelation (mean-shape) and burstiness/gini (dispersion).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days (default 2, must be >= 2); counts surface as droppedSparseSources',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | longest | up | down | current | ndays | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-longest-run <n>',
    'display filter: hide sources whose longestMonotoneRun is below n; counts surface as droppedBelowMinLongestRun (default 0 = no floor)',
    '0',
  )
  .option(
    '--current-direction <dirs>',
    "display filter: keep only sources whose currentDirection is in this comma-separated list (one or more of 'up','down','flat'); counts surface as droppedByCurrentDirection. Useful for surfacing sources currently climbing / falling / plateaued.",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        minLongestRun: string;
        currentDirection?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 2) {
          throw new Error(`--min-days must be an integer >= 2 (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minLongestRun = Number.parseInt(opts.minLongestRun, 10);
        if (!Number.isInteger(minLongestRun) || minLongestRun < 0) {
          throw new Error(
            `--min-longest-run must be a non-negative integer (got ${opts.minLongestRun})`,
          );
        }
        const sort = opts.sort as
          | 'tokens'
          | 'longest'
          | 'up'
          | 'down'
          | 'current'
          | 'ndays'
          | 'source';
        const validSorts = ['tokens', 'longest', 'up', 'down', 'current', 'ndays', 'source'];
        if (!validSorts.includes(sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        let currentDirection: ('up' | 'down' | 'flat')[] | null = null;
        if (opts.currentDirection != null && opts.currentDirection !== '') {
          const parts = opts.currentDirection
            .split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0);
          if (parts.length === 0) {
            throw new Error(
              `--current-direction must be a non-empty comma-separated list (got '${opts.currentDirection}')`,
            );
          }
          for (const p of parts) {
            if (p !== 'up' && p !== 'down' && p !== 'flat') {
              throw new Error(
                `--current-direction entries must be 'up'|'down'|'flat' (got '${p}')`,
              );
            }
          }
          currentDirection = parts as ('up' | 'down' | 'flat')[];
        }
        const report = buildDailyTokenMonotoneRunLength(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort,
          minLongestRun,
          currentDirection,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenMonotoneRunLength(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-zscore-extremes')
  .description(
    "Per-source count of daily total-token values whose population z-score exceeds ±sigma. Tail-event statistic that surfaces individual extreme days (heavy or light) — orthogonal to aggregate dispersion (burstiness, rolling-bucket-cv), serial correlation (autocorrelation-lag1), and direction-persistence (monotone-run-length).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <name>', 'restrict to a single source; non-matching rows surface as droppedSourceFilter')
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days (default 3, must be >= 2); counts surface as droppedSparseSources',
    '3',
  )
  .option(
    '--sigma <f>',
    'strict z-score threshold; days with |z| > sigma count as extreme. Must be > 0. Default 2.',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | extreme | fraction | maxabsz | ndays | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-extreme <n>',
    'display filter: hide sources whose nExtreme is below n; counts surface as droppedBelowMinExtreme (default 0 = no floor)',
    '0',
  )
  .option(
    '--direction <dir>',
    "display filter: keep only sources with at least one extreme of the given direction. One of high|low|either. Default unset = no direction gate.",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        sigma: string;
        top: string;
        sort: string;
        minExtreme: string;
        direction?: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 2) {
          throw new Error(`--min-days must be an integer >= 2 (got ${opts.minDays})`);
        }
        const sigma = Number.parseFloat(opts.sigma);
        if (!Number.isFinite(sigma) || sigma <= 0) {
          throw new Error(`--sigma must be a positive finite number (got ${opts.sigma})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minExtreme = Number.parseInt(opts.minExtreme, 10);
        if (!Number.isInteger(minExtreme) || minExtreme < 0) {
          throw new Error(`--min-extreme must be a non-negative integer (got ${opts.minExtreme})`);
        }
        let direction: 'high' | 'low' | 'either' | null = null;
        if (opts.direction != null && opts.direction !== '') {
          if (!['high', 'low', 'either'].includes(opts.direction)) {
            throw new Error(`--direction must be one of high|low|either (got ${opts.direction})`);
          }
          direction = opts.direction as 'high' | 'low' | 'either';
        }
        const sort = opts.sort as
          | 'tokens'
          | 'extreme'
          | 'fraction'
          | 'maxabsz'
          | 'ndays'
          | 'source';
        const validSorts = ['tokens', 'extreme', 'fraction', 'maxabsz', 'ndays', 'source'];
        if (!validSorts.includes(sort)) {
          throw new Error(`--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`);
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenZscoreExtremes(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          sigma,
          top,
          sort,
          minExtreme,
          direction,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenZscoreExtremes(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('cumulative-tokens-midpoint')
  .description(
    'Per-source: day at which cumulative tokens crosses 50% of lifetime, expressed as a percentile of the source\u2019s own calendar tenure (gap-filled with zero days). <0.5 = front-loaded, ~0.5 = uniform, >0.5 = back-loaded.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n distinct tokens-bearing days from the per-source table (default 1)',
    '1',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + minDays; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'midpoint' | 'tenure' | 'source'",
    'tokens',
  )
  .option(
    '--midpoint-min <f>',
    'drop sources whose midpointPctTenure is below f from the per-source table; must be in [0, 1] (default 0); suppressed rows surface as droppedBelowMidpointMin',
    '0',
  )
  .option(
    '--midpoint-max <f>',
    'drop sources whose midpointPctTenure is above f from the per-source table; must be in [0, 1] (default 1); suppressed rows surface as droppedAboveMidpointMax',
    '1',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        midpointMin: string;
        midpointMax: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'midpoint' &&
          sort !== 'tenure' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'midpoint' | 'tenure' | 'source' (got ${opts.sort})`,
          );
        }
        const midpointMin = Number.parseFloat(opts.midpointMin);
        if (!Number.isFinite(midpointMin) || midpointMin < 0 || midpointMin > 1) {
          throw new Error(
            `--midpoint-min must be in [0, 1] (got ${opts.midpointMin})`,
          );
        }
        const midpointMax = Number.parseFloat(opts.midpointMax);
        if (!Number.isFinite(midpointMax) || midpointMax < 0 || midpointMax > 1) {
          throw new Error(
            `--midpoint-max must be in [0, 1] (got ${opts.midpointMax})`,
          );
        }
        if (midpointMin > midpointMax) {
          throw new Error(
            `--midpoint-min (${midpointMin}) must be <= --midpoint-max (${midpointMax})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildCumulativeTokensMidpoint(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as 'tokens' | 'midpoint' | 'tenure' | 'source',
          midpointMin,
          midpointMax,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderCumulativeTokensMidpoint(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-io-ratio-stability')
  .description(
    "Per-source coefficient of variation (stddev/mean) of the daily output_tokens/input_tokens ratio across the source's active calendar days. Low CV = stable interaction shape day-over-day; high CV = swings between mostly-prompt and mostly-generation. Distinct from output-input-ratio (single global mean) and from autocorrelation (magnitude persistence).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option('--source <id>', 'restrict to a single source id')
  .option(
    '--min-days <n>',
    'drop sources with fewer than n ratio-bearing days (input_tokens > 0) from the per-source table (default 3)',
    '3',
  )
  .option(
    '--top <n>',
    'cap the per-source table to the top N rows after sort + minDays; suppressed rows surface as droppedBelowTopCap',
  )
  .option(
    '--sort <key>',
    "sort key for sources[]: 'tokens' (default) | 'cv' | 'mean' | 'days' | 'source'",
    'tokens',
  )
  .option(
    '--cv-min <f>',
    'drop sources whose ratioCv is below f (non-negative finite); useful for surfacing the wild ones; suppressed rows surface as droppedBelowCvMin (default 0)',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top?: string;
        sort: string;
        cvMin: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        let top: number | null = null;
        if (opts.top != null) {
          const t = Number.parseFloat(opts.top);
          if (!Number.isFinite(t) || t < 1 || !Number.isInteger(t)) {
            throw new Error(`--top must be a positive integer (got ${opts.top})`);
          }
          top = t;
        }
        const sort = opts.sort;
        if (
          sort !== 'tokens' &&
          sort !== 'cv' &&
          sort !== 'mean' &&
          sort !== 'days' &&
          sort !== 'source'
        ) {
          throw new Error(
            `--sort must be 'tokens' | 'cv' | 'mean' | 'days' | 'source' (got ${opts.sort})`,
          );
        }
        const cvMin = Number.parseFloat(opts.cvMin);
        if (!Number.isFinite(cvMin) || cvMin < 0) {
          throw new Error(`--cv-min must be a non-negative finite number (got ${opts.cvMin})`);
        }
        const queue = await readQueue(paths);
        const report = buildSourceIoRatioStability(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          sort: sort as 'tokens' | 'cv' | 'mean' | 'days' | 'source',
          cvMin,
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceIoRatioStability(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-second-difference-sign-runs')
  .description(
    "Per-source longest run of consecutive same-sign second differences of daily total tokens — concavity-regime persistence (concaveup = accelerating, concavedown = decelerating, flat = locally linear). Trajectory-curvature statistic orthogonal to monotone-run-length (velocity-sign), autocorrelation (mean-shape), and z-score-extremes (tail events).",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-days <n>',
    'hide source rows with fewer than n active calendar days (default 3, must be >= 3); counts surface as droppedSparseSources',
    '3',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | longest | concaveup | concavedown | flat | current | ndays | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--min-current-run <n>',
    'display filter: hide sources whose currentRunLength is below n (the trailing same-sign d2 stretch). Useful for surfacing only sources sitting in a deeply persistent regime right now. Counts surface as droppedBelowMinCurrentRun. Default 0 = no floor.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minDays: string;
        top: string;
        sort: string;
        minCurrentRun: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 3) {
          throw new Error(`--min-days must be an integer >= 3 (got ${opts.minDays})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minCurrentRun = Number.parseInt(opts.minCurrentRun, 10);
        if (!Number.isInteger(minCurrentRun) || minCurrentRun < 0) {
          throw new Error(
            `--min-current-run must be a non-negative integer (got ${opts.minCurrentRun})`,
          );
        }
        const validSorts = [
          'tokens',
          'longest',
          'concaveup',
          'concavedown',
          'flat',
          'current',
          'ndays',
          'source',
        ];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenSecondDiffSignRuns(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minDays,
          top,
          minCurrentRun,
          sort: opts.sort as
            | 'tokens'
            | 'longest'
            | 'concaveup'
            | 'concavedown'
            | 'flat'
            | 'current'
            | 'ndays'
            | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenSecondDiffSignRuns(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-output-token-benford-deviation')
  .description(
    "Per-source goodness-of-fit of output_tokens leading-digit distribution to Benford's law (P(d)=log10(1+1/d)). Reports chi-square (8 d.o.f.) and Nigrini MAD%. Scale-free fingerprint of value-shape orthogonal to every magnitude/order statistic.",
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-rows <n>',
    'hide source rows with fewer than n positive-output rows (default 30, must be >= 9); counts surface as droppedSparseSources',
    '30',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | mad | chi2 | rows | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--max-mad <pct>',
    'display filter: hide sources whose MAD% strictly exceeds this value (default 0 = no filter). Useful for surfacing only sources that conform to Benford.',
    '0',
  )
  .option(
    '--require-d1-mode',
    "display filter: hide sources whose mode leading digit is not 1. Benford's most basic prediction is that d=1 dominates (~30.10%); a source with any other mode digit is structurally non-Benford regardless of MAD/chi2. Counts surface as droppedNonD1Mode. Default off.",
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minRows: string;
        top: string;
        sort: string;
        maxMad: string;
        requireD1Mode?: boolean;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minRows = Number.parseInt(opts.minRows, 10);
        if (!Number.isInteger(minRows) || minRows < 9) {
          throw new Error(`--min-rows must be an integer >= 9 (got ${opts.minRows})`);
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const maxMad = Number.parseFloat(opts.maxMad);
        if (!Number.isFinite(maxMad) || maxMad < 0) {
          throw new Error(
            `--max-mad must be a non-negative number (got ${opts.maxMad})`,
          );
        }
        const validSorts = ['tokens', 'mad', 'chi2', 'rows', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceOutputTokenBenfordDeviation(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minRows,
          top,
          maxMad,
          requireD1Mode: opts.requireD1Mode === true,
          sort: opts.sort as 'tokens' | 'mad' | 'chi2' | 'rows' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceOutputTokenBenfordDeviation(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-token-mass-hour-centroid')
  .description(
    'Per-source token-mass-weighted circular centroid on the 24-hour clock. Reports centroidHour, resultant length R (concentration), and circular SD in hours. Treats hour-of-day as circular (23 and 0 adjacent), unlike every other hour-of-day stat which uses linear bins.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: tokens (default) | centroid | r | spread | source. Applied before --top.',
    'tokens',
  )
  .option(
    '--max-spread <hrs>',
    'display filter: hide sources whose circular spread (hours) strictly exceeds this value. Useful for surfacing only sources with tightly-clustered hour-of-day token mass. Default 0 = no filter. Rows with R=0 (spread=infinity) are also dropped when active.',
    '0',
  )
  .option(
    '--min-r <r>',
    'display filter: hide sources whose resultant length R is strictly below this value. R in [0,1] is the canonical circular concentration measure (1=sharp peak, 0=uniform). Default 0 = no filter. Counts surface as droppedBelowMinR. Applied after --max-spread.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        top: string;
        sort: string;
        maxSpread: string;
        minR: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const maxSpread = Number.parseFloat(opts.maxSpread);
        if (!Number.isFinite(maxSpread) || maxSpread < 0) {
          throw new Error(
            `--max-spread must be a non-negative number (got ${opts.maxSpread})`,
          );
        }
        const minR = Number.parseFloat(opts.minR);
        if (!Number.isFinite(minR) || minR < 0 || minR > 1) {
          throw new Error(
            `--min-r must be a number in [0, 1] (got ${opts.minR})`,
          );
        }
        const validSorts = ['tokens', 'centroid', 'r', 'spread', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceTokenMassHourCentroid(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          top,
          maxSpread,
          minR,
          sort: opts.sort as 'tokens' | 'centroid' | 'r' | 'spread' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceTokenMassHourCentroid(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('daily-token-gini-coefficient')
  .description(
    'Per-source Gini coefficient of the per-day total_tokens distribution. Collapses hourly buckets to UTC days, then computes Gini over the day vector. Range [0, (n-1)/n]. Order-invariant — orthogonal to z-score / monotone-run / autocorrelation / 2nd-diff sign-runs which read the daily series in order.',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--min-days <n>',
    'hide source rows whose nDays is below n (default 2); Gini on n=1 is 0 by definition. Counts surface as droppedBelowMinDays.',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: gini (default) | tokens | days | source. Applied before --top.',
    'gini',
  )
  .option(
    '--min-gini <g>',
    'display filter: hide sources whose Gini is strictly below this value. g in [0,1]. Default 0 = no filter. Applied after --min-tokens and --min-days. Counts surface as droppedBelowMinGini.',
    '0',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        minTokens: string;
        minDays: string;
        top: string;
        sort: string;
        minGini: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const minDays = Number.parseInt(opts.minDays, 10);
        if (!Number.isInteger(minDays) || minDays < 1) {
          throw new Error(
            `--min-days must be a positive integer (got ${opts.minDays})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const minGini = Number.parseFloat(opts.minGini);
        if (!Number.isFinite(minGini) || minGini < 0 || minGini > 1) {
          throw new Error(
            `--min-gini must be a number in [0, 1] (got ${opts.minGini})`,
          );
        }
        const validSorts = ['gini', 'tokens', 'days', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildDailyTokenGini(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          minTokens,
          minDays,
          top,
          minGini,
          sort: opts.sort as 'gini' | 'tokens' | 'days' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderDailyTokenGini(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program
  .command('source-hour-of-day-topk-mass-share')
  .description(
    'Per-source share of total token mass concentrated in the K busiest hours-of-day (default K=3) on the 24-hour clock. Range [K/24, 1]. Orthogonal to peak-hour-share (per-day spikiness), source-token-mass-hour-centroid (circular mean position), hour-of-day-token-skew (3rd moment), and bucket-token-gini (mixes hour-of-day with day axis).',
  )
  .option('--since <iso>', 'inclusive ISO lower bound on hour_start')
  .option('--until <iso>', 'exclusive ISO upper bound on hour_start')
  .option(
    '--source <name>',
    'restrict analysis to a single source; non-matching rows surface as droppedSourceFilter',
  )
  .option(
    '--top-hours <k>',
    'K, the number of busiest hours-of-day to sum (default 3). Integer in [1, 24]. Lower bound on share is K/24.',
    '3',
  )
  .option(
    '--min-tokens <n>',
    'hide source rows with total_tokens below n (default 1000); counts surface as droppedSparseSources',
    '1000',
  )
  .option(
    '--min-hours <n>',
    'hide source rows whose nHours (distinct populated hours-of-day) is below n (default 2). Counts surface as droppedBelowMinHours.',
    '2',
  )
  .option(
    '--top <n>',
    'show only the top n sources after sort; remainder surface as droppedTopSources (default 0 = no cap)',
    '0',
  )
  .option(
    '--sort <key>',
    'sort key: share (default) | tokens | hours | source. Applied before --top.',
    'share',
  )
  .option('--json', 'emit JSON instead of a pretty report')
  .action(
    async (
      opts: {
        since?: string;
        until?: string;
        source?: string;
        topHours: string;
        minTokens: string;
        minHours: string;
        top: string;
        sort: string;
        json?: boolean;
      },
      cmd,
    ) => {
      try {
        const common = cmd.optsWithGlobals() as CommonOpts;
        const paths = resolvePewPaths(common.pewHome);
        const topHours = Number.parseInt(opts.topHours, 10);
        if (!Number.isInteger(topHours) || topHours < 1 || topHours > 24) {
          throw new Error(
            `--top-hours must be an integer in [1, 24] (got ${opts.topHours})`,
          );
        }
        const minTokens = Number.parseFloat(opts.minTokens);
        if (!Number.isFinite(minTokens) || minTokens < 0) {
          throw new Error(
            `--min-tokens must be a non-negative number (got ${opts.minTokens})`,
          );
        }
        const minHours = Number.parseInt(opts.minHours, 10);
        if (!Number.isInteger(minHours) || minHours < 1 || minHours > 24) {
          throw new Error(
            `--min-hours must be an integer in [1, 24] (got ${opts.minHours})`,
          );
        }
        const top = Number.parseInt(opts.top, 10);
        if (!Number.isInteger(top) || top < 0) {
          throw new Error(`--top must be a non-negative integer (got ${opts.top})`);
        }
        const validSorts = ['share', 'tokens', 'hours', 'source'];
        if (!validSorts.includes(opts.sort)) {
          throw new Error(
            `--sort must be one of ${validSorts.join('|')} (got ${opts.sort})`,
          );
        }
        const queue = await readQueue(paths);
        const report = buildSourceHourTopKMassShare(queue, {
          since: opts.since ?? null,
          until: opts.until ?? null,
          source: opts.source ?? null,
          topHours,
          minTokens,
          minHours,
          top,
          sort: opts.sort as 'share' | 'tokens' | 'hours' | 'source',
        });
        if (opts.json || common.json) {
          process.stdout.write(JSON.stringify(report, null, 2) + '\n');
        } else {
          process.stdout.write(renderSourceHourTopKMassShare(report) + '\n');
        }
      } catch (e) {
        die(e);
      }
    },
  );

program.parseAsync(process.argv).catch(die);

