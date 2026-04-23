import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  readFileSync,
  existsSync,
  statSync,
  promises as fs,
} from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join } from 'node:path';
import { createGunzip } from 'node:zlib';
import { createReadStream } from 'node:fs';
import { resolvePewPaths } from '../src/paths.ts';
import { planCompaction, executeCompaction, archiveDir } from '../src/compact.ts';

function mkPewHome(): string {
  return mkdtempSync(join(tmpdir(), 'pew-insights-compact-'));
}

async function readGz(path: string): Promise<string> {
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    createReadStream(path)
      .pipe(createGunzip())
      .on('data', (c) => chunks.push(c as Buffer))
      .on('end', () => resolve())
      .on('error', reject);
  });
  return Buffer.concat(chunks).toString('utf8');
}

test('planCompaction: reports evictable bytes from offset', async () => {
  const home = mkPewHome();
  const paths = resolvePewPaths(home);
  const lines = ['{"a":1}\n', '{"a":2}\n', '{"a":3}\n'];
  writeFileSync(paths.queueJsonl, lines.join(''));
  const evictable = lines[0]!.length + lines[1]!.length;
  writeFileSync(paths.queueStateJson, JSON.stringify({ offset: evictable, dirtyKeys: ['k'] }));
  writeFileSync(paths.sessionQueueJsonl, '');
  writeFileSync(paths.sessionQueueStateJson, JSON.stringify({ offset: 0 }));

  const plan = await planCompaction(paths);
  assert.equal(plan.blocked, false);
  const q = plan.entries.find((e) => e.name === 'queue')!;
  assert.equal(q.evictableBytes, evictable);
  assert.equal(q.liveSize, lines.join('').length);
});

test('planCompaction: blocks when trailing.lock holds an alive pid', async () => {
  const home = mkPewHome();
  const paths = resolvePewPaths(home);
  writeFileSync(paths.queueJsonl, '{}\n');
  writeFileSync(paths.queueStateJson, JSON.stringify({ offset: 0 }));
  writeFileSync(paths.sessionQueueJsonl, '');
  writeFileSync(paths.sessionQueueStateJson, JSON.stringify({ offset: 0 }));
  writeFileSync(
    paths.trailingLock,
    JSON.stringify({ pid: process.pid, startedAt: '2026-01-01T00:00:00Z' }),
  );
  const plan = await planCompaction(paths);
  assert.equal(plan.blocked, true);
  assert.match(plan.blockReason ?? '', /trailing\.lock held by live pid/);
});

test('planCompaction: does not block on stale lock (dead pid)', async () => {
  const home = mkPewHome();
  const paths = resolvePewPaths(home);
  writeFileSync(paths.queueJsonl, '');
  writeFileSync(paths.queueStateJson, JSON.stringify({ offset: 0 }));
  writeFileSync(paths.sessionQueueJsonl, '');
  writeFileSync(paths.sessionQueueStateJson, JSON.stringify({ offset: 0 }));
  // pid 999999 is almost certainly dead.
  writeFileSync(paths.trailingLock, JSON.stringify({ pid: 999999, startedAt: 'x' }));
  const plan = await planCompaction(paths);
  assert.equal(plan.blocked, false);
});

test('executeCompaction: archives prefix, truncates live, resets offset', async () => {
  const home = mkPewHome();
  const paths = resolvePewPaths(home);
  const a = '{"i":1}\n';
  const b = '{"i":2}\n';
  const c = '{"i":3}\n';
  writeFileSync(paths.queueJsonl, a + b + c);
  writeFileSync(
    paths.queueStateJson,
    JSON.stringify({ offset: a.length + b.length, dirtyKeys: ['preserved'] }),
  );
  writeFileSync(paths.sessionQueueJsonl, '');
  writeFileSync(paths.sessionQueueStateJson, JSON.stringify({ offset: 0 }));

  const plan = await planCompaction(paths);
  // Override archive paths into our temp dir to avoid touching real ~/.cache.
  for (const e of plan.entries) {
    e.archivePath = join(home, `archive-${e.name}.gz`);
  }
  const results = await executeCompaction(paths, plan);

  // Live file now contains only the unflushed suffix.
  assert.equal(readFileSync(paths.queueJsonl, 'utf8'), c);
  // Offset reset to 0, dirtyKeys preserved.
  const newState = JSON.parse(readFileSync(paths.queueStateJson, 'utf8'));
  assert.equal(newState.offset, 0);
  assert.deepEqual(newState.dirtyKeys, ['preserved']);

  // Archive contains the evicted prefix.
  const qResult = results.find((r) => r.name === 'queue')!;
  assert.equal(qResult.archivedBytes, a.length + b.length);
  const archived = await readGz(qResult.archivePath);
  assert.equal(archived, a + b);

  // session-queue had nothing to evict → marked skipped.
  const sResult = results.find((r) => r.name === 'session-queue')!;
  assert.equal(sResult.skipped, true);
});

test('executeCompaction: refuses when plan is blocked', async () => {
  const home = mkPewHome();
  const paths = resolvePewPaths(home);
  writeFileSync(paths.queueJsonl, 'x\n');
  writeFileSync(paths.queueStateJson, JSON.stringify({ offset: 2 }));
  writeFileSync(paths.sessionQueueJsonl, '');
  writeFileSync(paths.sessionQueueStateJson, JSON.stringify({ offset: 0 }));
  writeFileSync(
    paths.trailingLock,
    JSON.stringify({ pid: process.pid, startedAt: 'x' }),
  );
  const plan = await planCompaction(paths);
  await assert.rejects(() => executeCompaction(paths, plan), /trailing\.lock held/);
});

test('archiveDir: lives under ~/.cache/pew-insights/archive', () => {
  const d = archiveDir();
  assert.ok(d.startsWith(homedir()));
  assert.match(d, /\.cache\/pew-insights\/archive$/);
});
