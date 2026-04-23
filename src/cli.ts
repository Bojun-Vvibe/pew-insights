#!/usr/bin/env node
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
  renderDigest,
  renderDoctor,
  renderSources,
  renderStatus,
} from './format.js';

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
  .version('0.1.0')
  .option('--pew-home <path>', 'override pew state directory (default $PEW_HOME or ~/.config/pew)');

program
  .command('digest')
  .description('Token totals by day / source / model / hour for a window')
  .option('--since <spec>', 'window: 24h, 7d, 30d, all', '7d')
  .option('--json', 'emit JSON instead of a pretty table')
  .action(async (opts: { since: string; json?: boolean }, cmd) => {
    try {
      const common = cmd.optsWithGlobals() as CommonOpts & { since: string };
      const paths = resolvePewPaths(common.pewHome);
      const since = resolveSince(opts.since);
      const [queue, sessions] = await Promise.all([readQueue(paths), readSessionQueue(paths)]);
      const digest = buildDigest(queue, sessions, since);
      if (opts.json || common.json) {
        process.stdout.write(JSON.stringify(digest, null, 2) + '\n');
      } else {
        process.stdout.write(renderDigest(digest) + '\n');
      }
    } catch (e) {
      die(e);
    }
  });

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

function die(e: unknown): never {
  const msg = e instanceof Error ? e.stack ?? e.message : String(e);
  process.stderr.write(`pew-insights: ${msg}\n`);
  process.exit(1);
}

program.parseAsync(process.argv).catch(die);
