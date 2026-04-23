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
  .version('0.4.0')
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
      const cost = computeCost(queue, since, mergeRates(DEFAULT_RATES, userRates));
      const trend = buildTrend(queue, since, { windowDays: 14 });
      const html = renderHtmlReport({
        pewHome: paths.home,
        digest,
        status,
        cost,
        trend,
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

program.parseAsync(process.argv).catch(die);
