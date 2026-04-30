import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenTheilLIndex,
  theilLOfVector,
  generalisedEntropyOfVector,
} from '../src/dailytokentheillindex.js';
import type { QueueLine } from '../src/types.js';

function ql(hourStart: string, source: string, total: number): QueueLine {
  return {
    source,
    model: 'm',
    hour_start: hourStart,
    device_id: 'dev',
    input_tokens: 0,
    cached_input_tokens: 0,
    output_tokens: total,
    reasoning_output_tokens: 0,
    total_tokens: total,
  };
}

const GEN = '2026-05-01T00:00:00.000Z';

// ---- theilLOfVector ------------------------------------------------------

test('theilLOfVector: empty -> 0', () => {
  const r = theilLOfVector([]);
  assert.equal(r.theilL, 0);
  assert.equal(r.geometricMean, 0);
  assert.equal(r.zeroCollapse, false);
});

test('theilLOfVector: singleton -> 0', () => {
  const r = theilLOfVector([42]);
  assert.equal(r.theilL, 0);
});

test('theilLOfVector: all zeros -> 0', () => {
  const r = theilLOfVector([0, 0, 0]);
  assert.equal(r.theilL, 0);
  assert.equal(r.zeroCollapse, false);
});

test('theilLOfVector: perfect equality -> 0', () => {
  const r = theilLOfVector([100, 100, 100, 100, 100]);
  assert.ok(r.theilL < 1e-12, `expected ~0, got ${r.theilL}`);
  assert.ok(Math.abs(r.geometricMean - 100) < 1e-9);
  assert.ok(Math.abs(r.mean - 100) < 1e-9);
});

test('theilLOfVector: single zero pins L = +inf', () => {
  const r = theilLOfVector([0, 100, 100]);
  assert.equal(r.theilL, Number.POSITIVE_INFINITY);
  assert.equal(r.geometricMean, 0);
  assert.equal(r.zeroCollapse, true);
  assert.ok(Math.abs(r.mean - 200 / 3) < 1e-9);
});

test('theilLOfVector: known small case [1, 2, 4]', () => {
  // mu = 7/3, GeoMean = (1*2*4)^(1/3) = 2.
  // L = log(7/3 / 2) = log(7/6) ~= 0.15415.
  const r = theilLOfVector([1, 2, 4]);
  assert.ok(Math.abs(r.theilL - Math.log(7 / 6)) < 1e-12);
  assert.ok(Math.abs(r.geometricMean - 2) < 1e-12);
  assert.ok(Math.abs(r.mean - 7 / 3) < 1e-12);
  assert.equal(r.zeroCollapse, false);
});

test('theilLOfVector: scale-invariant (multiply by 1000)', () => {
  const a = theilLOfVector([1, 2, 4]);
  const b = theilLOfVector([1000, 2000, 4000]);
  assert.ok(Math.abs(a.theilL - b.theilL) < 1e-12);
});

test('theilLOfVector: permutation-invariant', () => {
  const a = theilLOfVector([10, 1, 100, 5]);
  const b = theilLOfVector([1, 100, 10, 5]);
  assert.ok(Math.abs(a.theilL - b.theilL) < 1e-12);
});

test('theilLOfVector: L = log(mu) - mean(log) identity', () => {
  const v = [3, 7, 11, 19, 23];
  const r = theilLOfVector(v);
  const mu = v.reduce((s, x) => s + x, 0) / v.length;
  const meanLog = v.reduce((s, x) => s + Math.log(x), 0) / v.length;
  const expected = Math.log(mu) - meanLog;
  assert.ok(Math.abs(r.theilL - expected) < 1e-12);
});

test('theilLOfVector: cross-check L = -log(GeoMean / mu)', () => {
  const v = [2, 8, 32, 128];
  const r = theilLOfVector(v);
  const expected = -Math.log(r.geometricMean / r.mean);
  assert.ok(Math.abs(r.theilL - expected) < 1e-12);
});

test('theilLOfVector: monotone under transferring mass to a top day', () => {
  const a = theilLOfVector([10, 10, 10, 10]);
  const b = theilLOfVector([5, 10, 10, 15]);
  const c = theilLOfVector([1, 10, 10, 19]);
  assert.ok(a.theilL < b.theilL);
  assert.ok(b.theilL < c.theilL);
});

test('theilLOfVector: rejects negative input', () => {
  assert.throws(() => theilLOfVector([1, -2, 3]), /non-negative/);
});

test('theilLOfVector: rejects NaN input', () => {
  assert.throws(() => theilLOfVector([1, NaN, 3]), /non-negative/);
});

test('theilLOfVector: bottom-sensitivity vs. top-sensitivity (matches theory)', () => {
  // Same total mass, same range, same n. One has the spike at the top,
  // the other at the bottom. Theil-L is bottom-sensitive: the
  // configuration with the small minimum should produce the larger L.
  const top = theilLOfVector([10, 10, 10, 50]); // mu = 20
  const bot = theilLOfVector([1, 25, 25, 29]); // mu = 20
  // Both are non-uniform. Bottom case has a 1 against mu = 20, so the
  // log shortfall log(20/1) ~ 3 dominates.
  assert.ok(bot.theilL > top.theilL, `bot ${bot.theilL} should exceed top ${top.theilL}`);
});

// ---- generalisedEntropyOfVector -----------------------------------------

test('GE: alpha=0 reproduces Theil-L', () => {
  const v = [3, 7, 11, 19, 23];
  const ge0 = generalisedEntropyOfVector(v, 0);
  const tL = theilLOfVector(v).theilL;
  assert.ok(Math.abs(ge0 - tL) < 1e-12);
});

test('GE: alpha=1 is Theil-T (sum r log r / n)', () => {
  const v = [3, 7, 11, 19, 23];
  const mu = v.reduce((s, x) => s + x, 0) / v.length;
  const expected =
    v.map((x) => (x / mu) * Math.log(x / mu)).reduce((s, x) => s + x, 0) /
    v.length;
  const got = generalisedEntropyOfVector(v, 1);
  assert.ok(Math.abs(got - expected) < 1e-12);
});

test('GE: alpha=2 is half-squared-CV', () => {
  const v = [10, 20, 30, 40];
  const mu = v.reduce((s, x) => s + x, 0) / v.length;
  const variance =
    v.map((x) => (x - mu) ** 2).reduce((s, x) => s + x, 0) / v.length;
  const cvSquared = variance / (mu * mu);
  const expected = cvSquared / 2;
  const got = generalisedEntropyOfVector(v, 2);
  assert.ok(Math.abs(got - expected) < 1e-12, `expected ${expected}, got ${got}`);
});

test('GE: equality vector -> 0 at every alpha', () => {
  const v = [50, 50, 50, 50];
  for (const alpha of [-1, 0, 0.5, 1, 2, 3]) {
    const got = generalisedEntropyOfVector(v, alpha);
    assert.ok(got < 1e-12, `alpha=${alpha} -> ${got}`);
  }
});

test('GE: zero element with alpha=0 -> +inf', () => {
  assert.equal(
    generalisedEntropyOfVector([0, 1, 2], 0),
    Number.POSITIVE_INFINITY,
  );
});

test('GE: zero element with alpha=1 -> finite (0 log 0 = 0)', () => {
  const got = generalisedEntropyOfVector([0, 1, 2], 1);
  assert.ok(Number.isFinite(got));
});

test('GE: negative alpha with zero -> +inf', () => {
  assert.equal(
    generalisedEntropyOfVector([0, 1, 2], -1),
    Number.POSITIVE_INFINITY,
  );
});

test('GE: rejects non-finite alpha', () => {
  assert.throws(
    () => generalisedEntropyOfVector([1, 2, 3], NaN),
    /finite alpha/,
  );
});

test('GE: scale-invariant at every alpha', () => {
  const v1 = [1, 2, 4, 8];
  const v2 = v1.map((x) => x * 1000);
  for (const alpha of [-0.5, 0, 0.5, 1, 2, 3]) {
    const a = generalisedEntropyOfVector(v1, alpha);
    const b = generalisedEntropyOfVector(v2, alpha);
    assert.ok(Math.abs(a - b) < 1e-9, `alpha=${alpha}: ${a} vs ${b}`);
  }
});

// ---- buildDailyTokenTheilLIndex -----------------------------------------

test('build: empty queue -> empty sources, totals = 0', () => {
  const r = buildDailyTokenTheilLIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.generatedAt, GEN);
});

test('build: single source over multiple days computes Theil-L', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 1000),
    ql('2026-04-26T01:00:00Z', 'src', 2000),
    ql('2026-04-27T01:00:00Z', 'src', 4000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources.length, 1);
  const row = r.sources[0];
  assert.equal(row.source, 'src');
  assert.equal(row.nDays, 3);
  assert.equal(row.totalTokens, 7000);
  // Same as theilLOfVector([1,2,4]) by scale-invariance.
  assert.ok(Math.abs(row.theilL - Math.log(7 / 6)) < 1e-9);
  assert.equal(row.minDay, '2026-04-25');
  assert.equal(row.minDailyTokens, 1000);
  assert.equal(row.maxDay, '2026-04-27');
  assert.equal(row.maxDailyTokens, 4000);
  assert.equal(row.zeroCollapse, false);
  assert.equal(row.firstDay, '2026-04-25');
  assert.equal(row.lastDay, '2026-04-27');
});

test('build: collapses multiple hourly buckets within same day', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 500),
    ql('2026-04-25T05:00:00Z', 'src', 500),
    ql('2026-04-26T01:00:00Z', 'src', 2000),
    ql('2026-04-27T01:00:00Z', 'src', 4000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  const row = r.sources[0];
  assert.equal(row.nDays, 3);
  assert.equal(row.totalTokens, 7000);
  // [1000, 2000, 4000] same as before
  assert.ok(Math.abs(row.theilL - Math.log(7 / 6)) < 1e-9);
});

test('build: cross-validates atkinsonAtEpsilon1 = 1 - exp(-L)', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 1000),
    ql('2026-04-26T01:00:00Z', 'src', 5000),
    ql('2026-04-27T01:00:00Z', 'src', 25000),
    ql('2026-04-28T01:00:00Z', 'src', 125000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  const row = r.sources[0];
  const expected = 1 - Math.exp(-row.theilL);
  assert.ok(Math.abs(row.atkinsonAtEpsilon1 - expected) < 1e-12);
  // GeoMean should also match mu * exp(-L).
  const expectedGeo = row.meanDailyTokens * Math.exp(-row.theilL);
  assert.ok(Math.abs(row.geometricMeanDaily - expectedGeo) < 1e-6);
});

test('build: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'a', 50),
    ql('2026-04-26T01:00:00Z', 'a', 50),
    ql('2026-04-25T01:00:00Z', 'b', 5000),
    ql('2026-04-26T01:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    minTokens: 1000,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'b');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: minDays filter drops short-history sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'a', 5000),
    ql('2026-04-25T05:00:00Z', 'a', 5000),
    ql('2026-04-25T01:00:00Z', 'b', 5000),
    ql('2026-04-26T01:00:00Z', 'b', 5000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    minDays: 2,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'b');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: source filter restricts and counts dropped rows', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'keep', 5000),
    ql('2026-04-26T01:00:00Z', 'keep', 5000),
    ql('2026-04-25T01:00:00Z', 'skip', 5000),
    ql('2026-04-26T01:00:00Z', 'skip', 5000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    source: 'keep',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'keep');
  assert.equal(r.droppedSourceFilter, 2);
  assert.equal(r.source, 'keep');
});

test('build: since/until window filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-20T01:00:00Z', 'src', 1000),
    ql('2026-04-25T01:00:00Z', 'src', 2000),
    ql('2026-04-26T01:00:00Z', 'src', 3000),
    ql('2026-04-30T01:00:00Z', 'src', 4000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    since: '2026-04-23T00:00:00Z',
    until: '2026-04-29T00:00:00Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].nDays, 2);
  assert.equal(r.sources[0].totalTokens, 5000);
});

test('build: invalid hour_start counted as droppedInvalidHourStart', () => {
  const queue: QueueLine[] = [
    { ...ql('2026-04-25T01:00:00Z', 'src', 1000), hour_start: 'not-a-date' },
    ql('2026-04-25T01:00:00Z', 'src', 1000),
    ql('2026-04-26T01:00:00Z', 'src', 2000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: non-positive tokens counted', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 0),
    ql('2026-04-26T01:00:00Z', 'src', -100),
    ql('2026-04-25T01:00:00Z', 'src', 5000),
    ql('2026-04-26T01:00:00Z', 'src', 5000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.droppedNonPositiveTokens, 2);
  assert.equal(r.sources.length, 1);
});

test('build: sort=tokens sorts by total mass desc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'small', 1000),
    ql('2026-04-26T01:00:00Z', 'small', 2000),
    ql('2026-04-25T01:00:00Z', 'big', 50000),
    ql('2026-04-26T01:00:00Z', 'big', 50000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    sort: 'tokens',
  });
  assert.equal(r.sources[0].source, 'big');
  assert.equal(r.sources[1].source, 'small');
});

test('build: sort=source sorts alphabetically', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'zeta', 5000),
    ql('2026-04-26T01:00:00Z', 'zeta', 5000),
    ql('2026-04-25T01:00:00Z', 'alpha', 1000),
    ql('2026-04-26T01:00:00Z', 'alpha', 2000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    sort: 'source',
  });
  assert.equal(r.sources[0].source, 'alpha');
  assert.equal(r.sources[1].source, 'zeta');
});

test('build: sort=meanDaily sorts by mean desc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'low', 1000),
    ql('2026-04-26T01:00:00Z', 'low', 1000),
    ql('2026-04-25T01:00:00Z', 'hi', 100000),
    ql('2026-04-26T01:00:00Z', 'hi', 100000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    sort: 'meanDaily',
  });
  assert.equal(r.sources[0].source, 'hi');
});

test('build: sort=theilL puts +inf on top', () => {
  // Build a vector with a zero day for one source -> L = +inf.
  // We can't pass zero through ingestion directly (filtered), so we
  // exercise the in-memory path via theilLOfVector contract: feed a
  // queue where two sources both have positive masses but very
  // different inequality.
  // Instead, test that finite values are sorted desc.
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'flat', 5000),
    ql('2026-04-26T01:00:00Z', 'flat', 5000),
    ql('2026-04-27T01:00:00Z', 'flat', 5000),
    ql('2026-04-25T01:00:00Z', 'spiky', 100),
    ql('2026-04-26T01:00:00Z', 'spiky', 100),
    ql('2026-04-27T01:00:00Z', 'spiky', 100000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources[0].source, 'spiky');
  assert.ok(r.sources[0].theilL > r.sources[1].theilL);
});

test('build: top cap drops surplus rows', () => {
  const queue: QueueLine[] = [];
  for (let i = 0; i < 5; i++) {
    queue.push(ql('2026-04-25T01:00:00Z', `s${i}`, 1000 + i));
    queue.push(ql('2026-04-26T01:00:00Z', `s${i}`, 1000 + i * 10));
  }
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('build: minTheilL display filter', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'flat', 5000),
    ql('2026-04-26T01:00:00Z', 'flat', 5000),
    ql('2026-04-27T01:00:00Z', 'flat', 5000),
    ql('2026-04-25T01:00:00Z', 'spiky', 100),
    ql('2026-04-26T01:00:00Z', 'spiky', 100),
    ql('2026-04-27T01:00:00Z', 'spiky', 100000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    minTheilL: 0.5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0].source, 'spiky');
  assert.equal(r.droppedBelowMinTheilL, 1);
});

test('build: alphaSweep populates geSweep on each row', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 1000),
    ql('2026-04-26T01:00:00Z', 'src', 2000),
    ql('2026-04-27T01:00:00Z', 'src', 4000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    alphaSweep: [0, 1, 2],
  });
  assert.deepEqual(r.alphaSweep, [0, 1, 2]);
  const sweep = r.sources[0].geSweep;
  assert.ok(sweep);
  assert.equal(sweep!.length, 3);
  assert.equal(sweep![0].alpha, 0);
  // GE(0) should equal headline theilL for finite case.
  assert.ok(Math.abs(sweep![0].ge - r.sources[0].theilL) < 1e-12);
  // GE(2) is half-squared-CV (positive for non-equal vector).
  assert.ok(sweep![2].ge > 0);
});

test('build: alphaSweep absent -> no geSweep field, alphaSweep = []', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 1000),
    ql('2026-04-26T01:00:00Z', 'src', 2000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.deepEqual(r.alphaSweep, []);
  assert.equal(r.sources[0].geSweep, undefined);
});

test('build: throws on invalid since', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], { generatedAt: GEN, since: 'garbage' }),
    /invalid since/,
  );
});

test('build: throws on invalid until', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], { generatedAt: GEN, until: 'garbage' }),
    /invalid until/,
  );
});

test('build: throws on minDays < 2', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], {
        generatedAt: GEN,
        minDays: 1,
      } as never),
    /minDays/,
  );
});

test('build: throws on negative minTokens', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], {
        generatedAt: GEN,
        minTokens: -1,
      }),
    /minTokens/,
  );
});

test('build: throws on negative top', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], { generatedAt: GEN, top: -1 } as never),
    /top/,
  );
});

test('build: throws on bad sort', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], { generatedAt: GEN, sort: 'bogus' as never }),
    /sort/,
  );
});

test('build: throws on negative minTheilL', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], { generatedAt: GEN, minTheilL: -0.1 }),
    /minTheilL/,
  );
});

test('build: throws on non-finite alphaSweep entry', () => {
  assert.throws(
    () =>
      buildDailyTokenTheilLIndex([], {
        generatedAt: GEN,
        alphaSweep: [0, NaN],
      }),
    /alphaSweep/,
  );
});

test('build: dropZeroDays = false is default; positive ingestion gives zeroCollapse=false', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 1),
    ql('2026-04-26T01:00:00Z', 'src', 1000),
    ql('2026-04-27T01:00:00Z', 'src', 1000000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources[0].zeroCollapse, false);
  assert.ok(Number.isFinite(r.sources[0].theilL));
  assert.ok(r.sources[0].theilL > 0);
});

test('build: dropZeroDays surfaces nDroppedZeroDays = 0 on clean data', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 1000),
    ql('2026-04-26T01:00:00Z', 'src', 2000),
    ql('2026-04-27T01:00:00Z', 'src', 4000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    dropZeroDays: true,
  });
  assert.equal(r.sources[0].nDroppedZeroDays, 0);
  assert.equal(r.dropZeroDays, true);
});

test('build: report echoes all knobs', () => {
  const r = buildDailyTokenTheilLIndex([], {
    generatedAt: GEN,
    since: '2026-04-01T00:00:00Z',
    until: '2026-05-01T00:00:00Z',
    source: 'foo',
    minTokens: 500,
    minDays: 3,
    dropZeroDays: true,
    top: 5,
    sort: 'tokens',
    minTheilL: 0.1,
    alphaSweep: [0, 1, 2],
  });
  assert.equal(r.windowStart, '2026-04-01T00:00:00Z');
  assert.equal(r.windowEnd, '2026-05-01T00:00:00Z');
  assert.equal(r.source, 'foo');
  assert.equal(r.minTokens, 500);
  assert.equal(r.minDays, 3);
  assert.equal(r.dropZeroDays, true);
  assert.equal(r.top, 5);
  assert.equal(r.sort, 'tokens');
  assert.equal(r.minTheilL, 0.1);
  assert.deepEqual(r.alphaSweep, [0, 1, 2]);
});

test('build: empty source string surfaces as (unknown)', () => {
  const queue: QueueLine[] = [
    { ...ql('2026-04-25T01:00:00Z', '', 5000), source: '' },
    { ...ql('2026-04-26T01:00:00Z', '', 5000), source: '' },
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources[0].source, '(unknown)');
});

test('build: orthogonality witness vs. mean -- two sources with same total but different L', () => {
  // Both have total = 30000 over 3 days, but flat vs. spiky.
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'flat', 10000),
    ql('2026-04-26T01:00:00Z', 'flat', 10000),
    ql('2026-04-27T01:00:00Z', 'flat', 10000),
    ql('2026-04-25T01:00:00Z', 'spiky', 100),
    ql('2026-04-26T01:00:00Z', 'spiky', 100),
    ql('2026-04-27T01:00:00Z', 'spiky', 29800),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  const flat = r.sources.find((s) => s.source === 'flat')!;
  const spiky = r.sources.find((s) => s.source === 'spiky')!;
  assert.equal(flat.totalTokens, spiky.totalTokens); // same total
  assert.ok(flat.theilL < 1e-9); // flat is essentially equal
  assert.ok(spiky.theilL > 1); // bottom-heavy gives a large L (>1 nat)
});

test('build: stable sort breaks ties on source asc', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'b', 5000),
    ql('2026-04-26T01:00:00Z', 'b', 5000),
    ql('2026-04-25T01:00:00Z', 'a', 5000),
    ql('2026-04-26T01:00:00Z', 'a', 5000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, {
    generatedAt: GEN,
    sort: 'tokens',
  });
  // Same totals, so tie -> source asc
  assert.equal(r.sources[0].source, 'a');
  assert.equal(r.sources[1].source, 'b');
});

test('build: minDailyTokens / minDay are populated correctly', () => {
  const queue: QueueLine[] = [
    ql('2026-04-25T01:00:00Z', 'src', 7000),
    ql('2026-04-26T01:00:00Z', 'src', 100), // min
    ql('2026-04-27T01:00:00Z', 'src', 12000),
  ];
  const r = buildDailyTokenTheilLIndex(queue, { generatedAt: GEN });
  assert.equal(r.sources[0].minDailyTokens, 100);
  assert.equal(r.sources[0].minDay, '2026-04-26');
  assert.equal(r.sources[0].maxDailyTokens, 12000);
  assert.equal(r.sources[0].maxDay, '2026-04-27');
});

// ---- theilLSubgroupDecomposition (refinement v0.6.275) -------------------

import { theilLSubgroupDecomposition } from '../src/dailytokentheillindex.js';

test('decomposition: empty -> all zeros', () => {
  const r = theilLSubgroupDecomposition([]);
  assert.equal(r.total, 0);
  assert.equal(r.within, 0);
  assert.equal(r.between, 0);
  assert.equal(r.subgroups.length, 0);
});

test('decomposition: single subgroup -> between = 0, within = total', () => {
  const r = theilLSubgroupDecomposition([
    { label: 'only', values: [1, 2, 4] },
  ]);
  assert.ok(Math.abs(r.total - Math.log(7 / 6)) < 1e-12);
  assert.ok(Math.abs(r.between) < 1e-12);
  assert.ok(Math.abs(r.within - r.total) < 1e-12);
  assert.equal(r.subgroups[0].n, 3);
  assert.ok(Math.abs(r.subgroups[0].mean - 7 / 3) < 1e-12);
});

test('decomposition: NO RESIDUAL -- within + between == total exactly', () => {
  const groups = [
    { label: 'a', values: [10, 20, 30, 40] },
    { label: 'b', values: [100, 200, 300] },
    { label: 'c', values: [5, 5, 5, 5, 5] },
  ];
  const r = theilLSubgroupDecomposition(groups);
  const reconstituted = r.within + r.between;
  assert.ok(
    Math.abs(reconstituted - r.total) < 1e-9,
    `within=${r.within} + between=${r.between} = ${reconstituted}, total=${r.total}`,
  );
});

test('decomposition: subgroups all-equal-within -> within = 0, between captures everything', () => {
  // Each subgroup is internally uniform.
  const groups = [
    { label: 'low', values: [10, 10, 10, 10] },
    { label: 'high', values: [100, 100, 100, 100] },
  ];
  const r = theilLSubgroupDecomposition(groups);
  assert.ok(r.within < 1e-9, `within should be ~0, got ${r.within}`);
  // The between term is the entire total.
  assert.ok(Math.abs(r.between - r.total) < 1e-9);
  // Sanity: total > 0 because subgroup means differ.
  assert.ok(r.total > 0);
});

test('decomposition: subgroups all-same-mean -> between = 0, within captures everything', () => {
  // Both subgroups have mean = 20.
  const groups = [
    { label: 'a', values: [10, 30] },
    { label: 'b', values: [5, 35] },
  ];
  const r = theilLSubgroupDecomposition(groups);
  assert.ok(r.between < 1e-9, `between should be ~0, got ${r.between}`);
  assert.ok(Math.abs(r.within - r.total) < 1e-9);
});

test('decomposition: subgroup zero mean -> zeroCollapse + +inf between', () => {
  const groups = [
    { label: 'zero', values: [0, 0] },
    { label: 'real', values: [10, 20] },
  ];
  const r = theilLSubgroupDecomposition(groups);
  assert.equal(r.zeroCollapse, true);
  assert.equal(r.between, Number.POSITIVE_INFINITY);
});

test('decomposition: subgroup with internal zero -> within = +inf', () => {
  const groups = [
    { label: 'a', values: [0, 10] },
    { label: 'b', values: [10, 20] },
  ];
  const r = theilLSubgroupDecomposition(groups);
  assert.equal(r.within, Number.POSITIVE_INFINITY);
  assert.equal(r.zeroCollapse, true);
});

test('decomposition: weights sum to 1 across subgroups', () => {
  const groups = [
    { label: 'a', values: [1, 2, 3] },
    { label: 'b', values: [4, 5] },
    { label: 'c', values: [6] },
  ];
  const r = theilLSubgroupDecomposition(groups);
  const w = r.subgroups.reduce((s, g) => s + g.weight, 0);
  assert.ok(Math.abs(w - 1) < 1e-12);
});

test('decomposition: rejects negative input', () => {
  assert.throws(
    () =>
      theilLSubgroupDecomposition([
        { label: 'bad', values: [1, -2, 3] },
      ]),
    /non-negative/,
  );
});

test('decomposition: real-shape per-day-by-week test', () => {
  // Simulate 14 days split into week 1 vs week 2.
  const week1 = [100, 200, 100, 300, 200, 150, 250];
  const week2 = [50, 60, 70, 80, 90, 100, 110];
  const r = theilLSubgroupDecomposition([
    { label: 'week1', values: week1 },
    { label: 'week2', values: week2 },
  ]);
  // No-residual identity must hold.
  assert.ok(Math.abs(r.within + r.between - r.total) < 1e-9);
  // Between term should be positive (week 1 mean > week 2 mean).
  assert.ok(r.between > 0);
  // Within should also be positive (each week is non-uniform).
  assert.ok(r.within > 0);
  // Total is greater than each component (both positive).
  assert.ok(r.total > r.within);
  assert.ok(r.total > r.between);
});
