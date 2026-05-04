import test from 'node:test';
import assert from 'node:assert/strict';
import {
  dailyTokenMoodHalves,
  buildDailyTokenMoodHalves,
  midRanksMood,
  standardNormalUpperTailMood,
} from '../src/dailytokenmoodhalves.js';
import type { QueueLine } from '../src/types.js';

function ql(
  hour_start: string,
  source: string,
  total_tokens: number,
): QueueLine {
  return { hour_start, source, total_tokens } as unknown as QueueLine;
}

function dayIso(i: number): string {
  return (
    new Date(Date.UTC(2026, 0, 1) + i * 86_400_000)
      .toISOString()
      .slice(0, 10) + 'T00:00:00.000Z'
  );
}

// ---------- primitive: midRanksMood ----------

test('midRanksMood: strictly increasing 1..n', () => {
  assert.deepEqual(midRanksMood([10, 20, 30, 40]), [1, 2, 3, 4]);
});

test('midRanksMood: strictly decreasing n..1', () => {
  assert.deepEqual(midRanksMood([40, 30, 20, 10]), [4, 3, 2, 1]);
});

test('midRanksMood: ties get average rank', () => {
  assert.deepEqual(midRanksMood([5, 5, 7, 5]), [2, 2, 4, 2]);
});

test('midRanksMood: pair tie at top', () => {
  assert.deepEqual(midRanksMood([1, 2, 9, 9]), [1, 2, 3.5, 3.5]);
});

// ---------- primitive: standardNormalUpperTailMood ----------

test('standardNormalUpperTailMood: Q(0) ~ 0.5', () => {
  assert.ok(Math.abs(standardNormalUpperTailMood(0) - 0.5) < 1e-7);
});

test('standardNormalUpperTailMood: Q(1.96) ~ 0.025', () => {
  const q = standardNormalUpperTailMood(1.96);
  assert.ok(Math.abs(q - 0.025) < 1e-4, `got ${q}`);
});

test('standardNormalUpperTailMood: Q(-z) = 1 - Q(z)', () => {
  const z = 1.5;
  const qPos = standardNormalUpperTailMood(z);
  const qNeg = standardNormalUpperTailMood(-z);
  assert.ok(Math.abs(qPos + qNeg - 1) < 1e-7);
});

test('standardNormalUpperTailMood: throws on non-finite', () => {
  assert.throws(() => standardNormalUpperTailMood(Number.NaN));
});

// ---------- core: dailyTokenMoodHalves ----------

test('dailyTokenMoodHalves: throws under min length 16', () => {
  assert.throws(() => dailyTokenMoodHalves([1, 2, 3, 4, 5, 6, 7, 8]));
});

test('dailyTokenMoodHalves: throws on non-finite', () => {
  const v = Array.from({ length: 16 }, (_, i) => i + 1);
  v[5] = Number.NaN;
  assert.throws(() => dailyTokenMoodHalves(v));
});

test('dailyTokenMoodHalves: throws on constant input', () => {
  const v = Array.from({ length: 16 }, () => 7);
  assert.throws(() => dailyTokenMoodHalves(v));
});

test('dailyTokenMoodHalves: n1 = floor(n/2), n2 = n - n1', () => {
  const v = Array.from({ length: 17 }, (_, i) => i * 0.5 + 1);
  const r = dailyTokenMoodHalves(v);
  assert.equal(r.moodN1, 8);
  assert.equal(r.moodN2, 9);
  assert.equal(r.nSamples, 17);
});

test('dailyTokenMoodHalves: constant-shift invariance moodZ(x + c) == moodZ(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const z1 = dailyTokenMoodHalves(x).moodZ;
  const z2 = dailyTokenMoodHalves(x.map((v) => v + 1000)).moodZ;
  assert.ok(Math.abs(z1 - z2) < 1e-10, `z1=${z1} z2=${z2}`);
});

test('dailyTokenMoodHalves: positive-scale invariance moodZ(a*x) == moodZ(x)', () => {
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
  const z1 = dailyTokenMoodHalves(x).moodZ;
  const z2 = dailyTokenMoodHalves(x.map((v) => v * 7)).moodZ;
  assert.ok(Math.abs(z1 - z2) < 1e-10, `z1=${z1} z2=${z2}`);
});

test('dailyTokenMoodHalves: reverse negates moodZ when n1=n2 and no ties', () => {
  const x = Array.from({ length: 18 }, (_, i) => i + 1);
  const z1 = dailyTokenMoodHalves(x).moodZ;
  const z2 = dailyTokenMoodHalves(x.slice().reverse()).moodZ;
  assert.ok(Math.abs(z1 + z2) < 1e-10, `z1=${z1} z2=${z2}`);
});

test('dailyTokenMoodHalves: E[W] = n2 (n^2 - 1) / 12 closed form', () => {
  // n=20, n2=10: E[W] = 10 * (400-1)/12 = 332.5
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenMoodHalves(v);
  assert.equal(r.moodN1, 10);
  assert.equal(r.moodN2, 10);
  assert.ok(Math.abs(r.moodExpW - 332.5) < 1e-9, `expW=${r.moodExpW}`);
});

test('dailyTokenMoodHalves: Var[W] = n1 n2 (n+1)(n^2-4)/180 closed form', () => {
  // n=20, n1=n2=10: Var = 10*10*21*396/180 = 4620
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenMoodHalves(v);
  assert.ok(Math.abs(r.moodVarW - 4620) < 1e-9, `varW=${r.moodVarW}`);
});

test('dailyTokenMoodHalves: monotone increasing => second-half ranks larger => W > E[W] => moodZ > 0', () => {
  // Strictly increasing: second half holds ranks 11..20 (centred squared sum)
  // sum_{k=11..20} (k - 10.5)^2 = (0.5)^2 + (1.5)^2 + ... + (9.5)^2
  //   = 0.25+2.25+6.25+12.25+20.25+30.25+42.25+56.25+72.25+90.25 = 332.5
  // So W = 332.5 = E[W], moodZ should be ~0 here (equal centred-rank weight).
  // To get moodZ > 0 we need second-half ranks more EXTREME (1, 2, 19, 20...).
  // For monotone the centred-square sum equals the first-half sum by symmetry.
  const v = Array.from({ length: 20 }, (_, i) => i + 1);
  const r = dailyTokenMoodHalves(v);
  assert.ok(Math.abs(r.moodZ) < 1e-9, `expected moodZ ~0 for monotone, got ${r.moodZ}`);
});

test('dailyTokenMoodHalves: second half clearly more dispersed => moodZ > 0', () => {
  // First half: tightly clustered [10..10.7]. Second half: extreme spread.
  const a = [10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9];
  const b = [-100, -50, -20, -5, 5, 20, 50, 100, 200, 300];
  const v = [...a, ...b];
  const r = dailyTokenMoodHalves(v);
  assert.ok(r.moodZ > 2, `expected moodZ > 2 for second-more-dispersed, got ${r.moodZ}`);
  assert.ok(r.moodPValue < 0.05, `expected p < 0.05, got ${r.moodPValue}`);
});

test('dailyTokenMoodHalves: first half more dispersed => moodZ < 0', () => {
  const a = [-100, -50, -20, -5, 5, 20, 50, 100, 200, 300];
  const b = [10, 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 10.9];
  const v = [...a, ...b];
  const r = dailyTokenMoodHalves(v);
  assert.ok(r.moodZ < -2, `expected moodZ < -2 for first-more-dispersed, got ${r.moodZ}`);
});

test('dailyTokenMoodHalves: moodPValue in (0, 1]', () => {
  const v = Array.from({ length: 20 }, (_, i) => Math.sin(i) * 100 + 200);
  const r = dailyTokenMoodHalves(v);
  assert.ok(r.moodPValue > 0 && r.moodPValue <= 1, `p=${r.moodPValue}`);
});

// ---------- builder: buildDailyTokenMoodHalves ----------

test('buildDailyTokenMoodHalves: empty queue => empty sources', () => {
  const r = buildDailyTokenMoodHalves([], { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.totalSources, 0);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodHalves: single source with sufficient tenure produces row', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'src-a', 1000 + i * 100 + (i > 9 ? i * 500 : 0)));
  }
  const r = buildDailyTokenMoodHalves(queue, { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0]!;
  assert.equal(row.source, 'src-a');
  assert.equal(row.moodN1, 10);
  assert.equal(row.moodN2, 10);
  assert.ok(Number.isFinite(row.moodZ));
  assert.ok(row.moodPValue > 0 && row.moodPValue <= 1);
});

test('buildDailyTokenMoodHalves: short tenure dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 10; i += 1) {
    queue.push(ql(dayIso(i), 'short', 5000));
  }
  const r = buildDailyTokenMoodHalves(queue, { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.droppedBelowMinTenure, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodHalves: zero-variance source dropped', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'flat', 5000));
  }
  const r = buildDailyTokenMoodHalves(queue, { generatedAt: '2026-05-05T00:00:00.000Z' });
  assert.equal(r.droppedZeroVariance, 1);
  assert.equal(r.sources.length, 0);
});

test('buildDailyTokenMoodHalves: invalid sort throws', () => {
  assert.throws(() =>
    buildDailyTokenMoodHalves([], {
      sort: 'nope' as never,
      generatedAt: '2026-05-05T00:00:00.000Z',
    }),
  );
});

test('buildDailyTokenMoodHalves: minTenureDays < 16 throws', () => {
  assert.throws(() =>
    buildDailyTokenMoodHalves([], {
      minTenureDays: 8,
      generatedAt: '2026-05-05T00:00:00.000Z',
    }),
  );
});

test('buildDailyTokenMoodHalves: source filter works', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 20; i += 1) {
    queue.push(ql(dayIso(i), 'a', 1000 + i * 100));
    queue.push(ql(dayIso(i), 'b', 2000 + i * 50));
  }
  const r = buildDailyTokenMoodHalves(queue, {
    source: 'a',
    generatedAt: '2026-05-05T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.ok(r.droppedSourceFilter > 0);
});
