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
  .version('0.4.7')
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

program.parseAsync(process.argv).catch(die);

