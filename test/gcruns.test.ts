import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolvePewPaths } from '../src/paths.ts';
import { planGc, executeGc, archiveRunsDir } from '../src/gcruns.ts';

function mkRuns(home: string, files: Array<{ name: string; status: string }>): void {
  const runs = join(home, 'runs');
  mkdirSync(runs, { recursive: true });
  for (const f of files) {
    writeFileSync(
      join(runs, f.name),
      JSON.stringify({ runId: f.name, status: f.status, version: '1', triggers: [], startedAt: '', completedAt: '', durationMs: 0, coordination: {}, cycles: [] }),
    );
  }
}

test('planGc: no runs/ → empty plan', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pew-insights-gc-'));
  const paths = resolvePewPaths(home);
  const plan = await planGc(paths, { keep: 100 });
  assert.equal(plan.totalRuns, 0);
  assert.equal(plan.candidates.length, 0);
});

test('planGc: keeps N most recent', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pew-insights-gc-'));
  const paths = resolvePewPaths(home);
  // 5 runs, all on the same day, all failed (no daily-success keeper bonus).
  const files = [
    { name: '2026-04-20T10:00:00.000Z-aaaaaa.json', status: 'failed' },
    { name: '2026-04-20T11:00:00.000Z-bbbbbb.json', status: 'failed' },
    { name: '2026-04-20T12:00:00.000Z-cccccc.json', status: 'failed' },
    { name: '2026-04-20T13:00:00.000Z-dddddd.json', status: 'failed' },
    { name: '2026-04-20T14:00:00.000Z-eeeeee.json', status: 'failed' },
  ];
  mkRuns(home, files);
  const plan = await planGc(paths, { keep: 2 });
  assert.equal(plan.totalRuns, 5);
  // The two latest by lex (which is time order).
  const keptNames = new Set(plan.keepers);
  assert.ok(keptNames.has('2026-04-20T13:00:00.000Z-dddddd.json'));
  assert.ok(keptNames.has('2026-04-20T14:00:00.000Z-eeeeee.json'));
  assert.equal(plan.candidates.length, 3);
});

test('planGc: also keeps last successful run per day even outside the recent window', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pew-insights-gc-'));
  const paths = resolvePewPaths(home);
  const files = [
    { name: '2026-04-18T10:00:00.000Z-aaaaaa.json', status: 'succeeded' }, // keeper (daily success)
    { name: '2026-04-18T11:00:00.000Z-bbbbbb.json', status: 'failed' },
    { name: '2026-04-19T10:00:00.000Z-cccccc.json', status: 'failed' },
    { name: '2026-04-20T10:00:00.000Z-dddddd.json', status: 'succeeded' }, // keeper (daily success + recent)
    { name: '2026-04-20T11:00:00.000Z-eeeeee.json', status: 'failed' },     // keeper (recent)
  ];
  mkRuns(home, files);
  const plan = await planGc(paths, { keep: 2 });
  const keptNames = new Set(plan.keepers);
  assert.ok(keptNames.has('2026-04-18T10:00:00.000Z-aaaaaa.json'), 'last success on 04-18 kept');
  assert.ok(keptNames.has('2026-04-20T10:00:00.000Z-dddddd.json'), 'last success on 04-20 kept');
  assert.ok(keptNames.has('2026-04-20T11:00:00.000Z-eeeeee.json'), 'recent kept');
  // Candidates: bbbb (no success on 04-18 latest), cccc (failed, not recent).
  const candNames = plan.candidates.map((c) => c.name).sort();
  assert.deepEqual(candNames, [
    '2026-04-18T11:00:00.000Z-bbbbbb.json',
    '2026-04-19T10:00:00.000Z-cccccc.json',
  ]);
});

test('executeGc: moves files to archive dir, leaves keepers in place', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pew-insights-gc-'));
  const paths = resolvePewPaths(home);
  const files = [
    { name: '2026-04-20T10:00:00.000Z-aaaaaa.json', status: 'failed' },
    { name: '2026-04-20T11:00:00.000Z-bbbbbb.json', status: 'failed' },
    { name: '2026-04-20T12:00:00.000Z-cccccc.json', status: 'failed' },
  ];
  mkRuns(home, files);
  const plan = await planGc(paths, { keep: 1 });
  // Override archive into temp space so we don't touch real ~/.cache.
  const altArchive = join(home, 'archive');
  for (const c of plan.candidates) {
    c.archivePath = join(altArchive, c.name);
  }
  plan.archiveDir = altArchive;

  const result = await executeGc(plan);
  assert.equal(result.moved, 2);
  // Keeper still there.
  assert.ok(existsSync(join(home, 'runs', '2026-04-20T12:00:00.000Z-cccccc.json')));
  // Movees gone from runs/ and present in archive.
  assert.ok(!existsSync(join(home, 'runs', '2026-04-20T10:00:00.000Z-aaaaaa.json')));
  const archived = readdirSync(altArchive).sort();
  assert.deepEqual(archived, [
    '2026-04-20T10:00:00.000Z-aaaaaa.json',
    '2026-04-20T11:00:00.000Z-bbbbbb.json',
  ]);
});

test('executeGc: empty candidates → no-op', async () => {
  const home = mkdtempSync(join(tmpdir(), 'pew-insights-gc-'));
  const paths = resolvePewPaths(home);
  const plan = await planGc(paths, { keep: 100 });
  const r = await executeGc(plan);
  assert.equal(r.moved, 0);
});

test('archiveRunsDir: lives under ~/.cache/pew-insights/archive/runs', () => {
  assert.match(archiveRunsDir(), /\.cache\/pew-insights\/archive\/runs$/);
});
