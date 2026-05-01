import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenQuintileShareRatio,
  quintileShareRatioOfVector,
} from '../src/dailytokenquintileshareratio.js';
import { decileShareGapOfVector } from '../src/dailytokendecilesharegap.js';
import { midSpreadRatioOfVector } from '../src/dailytokenmidspreadratio.js';
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

const GEN = '2026-05-01T09:00:00.000Z';

// ---- quintileShareRatioOfVector primitive ------------------------------

test('quintileShareRatioOfVector: empty -> degenerate, qsr=0', () => {
  const r = quintileShareRatioOfVector([]);
  assert.equal(r.qsr, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.bottomMass, 0);
  assert.equal(r.topMass, 0);
});

test('quintileShareRatioOfVector: singleton -> degenerate, qsr=0', () => {
  const r = quintileShareRatioOfVector([42]);
  assert.equal(r.qsr, 0);
  assert.equal(r.bottomMass, 42);
  assert.equal(r.topMass, 42);
  assert.equal(r.k, 1);
  assert.equal(r.degenerate, true);
});

test('quintileShareRatioOfVector: closed-form anchor on [1..10] -> 19/3', () => {
  const r = quintileShareRatioOfVector([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  // k = ceil(0.2 * 10) = 2
  // bottomMass = 1+2 = 3; topMass = 9+10 = 19; total = 55
  // qsr = 19 / 3
  assert.equal(r.k, 2);
  assert.equal(r.bottomMass, 3);
  assert.equal(r.topMass, 19);
  assert.ok(Math.abs(r.qsr - 19 / 3) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('quintileShareRatioOfVector: closed-form anchor on [1..20] -> k=4, (17+18+19+20)/(1+2+3+4)', () => {
  const v = [];
  for (let i = 1; i <= 20; i += 1) v.push(i);
  const r = quintileShareRatioOfVector(v);
  assert.equal(r.k, 4);
  assert.equal(r.bottomMass, 1 + 2 + 3 + 4);
  assert.equal(r.topMass, 17 + 18 + 19 + 20);
  assert.ok(Math.abs(r.qsr - 74 / 10) < 1e-12);
});

test('quintileShareRatioOfVector: all-equal vector -> qsr=1, degenerate', () => {
  const r = quintileShareRatioOfVector([7, 7, 7, 7, 7, 7, 7, 7, 7, 7]);
  // topMass == bottomMass, so qsr = 1 and degenerate=true
  assert.ok(Math.abs(r.qsr - 1) < 1e-12);
  assert.equal(r.bottomMass, r.topMass);
  assert.equal(r.degenerate, true);
});

test('quintileShareRatioOfVector: scale-invariance under c=10', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = a.map((x) => x * 10);
  const ra = quintileShareRatioOfVector(a);
  const rb = quintileShareRatioOfVector(b);
  assert.ok(Math.abs(ra.qsr - rb.qsr) < 1e-12);
});

test('quintileShareRatioOfVector: permutation-invariance', () => {
  const a = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const b = [10, 1, 5, 3, 7, 2, 9, 4, 8, 6];
  const ra = quintileShareRatioOfVector(a);
  const rb = quintileShareRatioOfVector(b);
  assert.ok(Math.abs(ra.qsr - rb.qsr) < 1e-12);
});

test('quintileShareRatioOfVector: rejects non-positive / non-finite values', () => {
  assert.throws(() => quintileShareRatioOfVector([1, 2, 0, 4]), /strictly-positive/);
  assert.throws(() => quintileShareRatioOfVector([1, 2, -3, 4]), /strictly-positive/);
  assert.throws(() => quintileShareRatioOfVector([1, 2, Number.NaN, 4]), /strictly-positive/);
  assert.throws(
    () => quintileShareRatioOfVector([1, 2, Number.POSITIVE_INFINITY, 4]),
    /strictly-positive/,
  );
});

test('quintileShareRatioOfVector: qsr >= 1 always on strictly-positive input', () => {
  const cases = [
    [1, 1, 1, 1, 1, 1, 1, 1, 1, 1000],
    [5, 4, 3, 2, 1, 6, 7, 8, 9, 10],
    [100, 100, 1, 100, 100, 100, 100, 100, 100, 100],
  ];
  for (const v of cases) {
    const r = quintileShareRatioOfVector(v);
    assert.ok(r.qsr >= 1 - 1e-12, `qsr ${r.qsr} should be >= 1`);
  }
});

test('quintileShareRatioOfVector: rank-flip witness vs DSG (axis 61)', () => {
  // From the docstring:
  //   A = [1,1,4,4,4,4,4,4,9,9]: QSR = 18/2 = 9.0; DSG = 8/44 = 0.1818...
  //   B = [1,3,3,3,3,3,3,3,3,20]: QSR = 23/4 = 5.75; DSG = 19/45 = 0.4222...
  // QSR ranks A > B; DSG ranks B > A.
  const A = [1, 1, 4, 4, 4, 4, 4, 4, 9, 9];
  const B = [1, 3, 3, 3, 3, 3, 3, 3, 3, 20];
  const qa = quintileShareRatioOfVector(A);
  const qb = quintileShareRatioOfVector(B);
  assert.ok(Math.abs(qa.qsr - 9.0) < 1e-12);
  assert.ok(Math.abs(qb.qsr - 23 / 4) < 1e-12);
  assert.ok(qa.qsr > qb.qsr, `A.qsr ${qa.qsr} should be > B.qsr ${qb.qsr}`);
  const da = decileShareGapOfVector(A);
  const db = decileShareGapOfVector(B);
  assert.ok(db.dsg > da.dsg, `B.dsg ${db.dsg} should be > A.dsg ${da.dsg}`);
});

test('quintileShareRatioOfVector: rank-flip witness vs MSR (axis 60)', () => {
  // A and B from the docstring witness pair vs MSR.
  const A = [1, 1, 4, 4, 4, 4, 4, 4, 9, 9];
  const B = [1, 3, 3, 3, 3, 3, 3, 3, 3, 20];
  const qa = quintileShareRatioOfVector(A);
  const qb = quintileShareRatioOfVector(B);
  assert.ok(qa.qsr > qb.qsr);
  const ma = midSpreadRatioOfVector(A);
  const mb = midSpreadRatioOfVector(B);
  // MSR for A: P10=1, P25=4, P50=4, P75=4, P90=9 => IQR=0, IDR=8 => MSR=0
  // MSR for B: tight body of 3's => degenerate
  assert.ok(ma.msr === 0 || ma.degenerate);
  assert.ok(mb.degenerate || Math.abs(mb.msr) < 1e-12);
});

test('quintileShareRatioOfVector: palma refinement nonzero on standard input', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  const r = quintileShareRatioOfVector(v);
  // Palma: k10=1 -> top10 = 10; k40=4 -> bot40 = 1+2+3+4 = 10; palma = 1
  assert.ok(Math.abs(r.palma - 1.0) < 1e-12);
});

test('quintileShareRatioOfVector: top/bottom share consistent with mass', () => {
  const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const r = quintileShareRatioOfVector(v);
  assert.ok(Math.abs(r.topShare - r.topMass / r.total) < 1e-12);
  assert.ok(Math.abs(r.bottomShare - r.bottomMass / r.total) < 1e-12);
  // qsr = topShare / bottomShare
  assert.ok(Math.abs(r.qsr - r.topShare / r.bottomShare) < 1e-9);
});

// ---- buildDailyTokenQuintileShareRatio ---------------------------------

test('build: empty queue -> empty report', () => {
  const r = buildDailyTokenQuintileShareRatio([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.generatedAt, GEN);
});

test('build: single-source 5-day vector hits qsr=topMax/botMin closed-form', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00.000Z', 'src-a', 1),
    ql('2026-05-02T00:00:00.000Z', 'src-a', 2),
    ql('2026-05-03T00:00:00.000Z', 'src-a', 3),
    ql('2026-05-04T00:00:00.000Z', 'src-a', 4),
    ql('2026-05-05T00:00:00.000Z', 'src-a', 5),
  ];
  // total=15; n=5; k=ceil(0.2*5)=1; bottomMass=1; topMass=5; qsr=5
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.k, 1);
  assert.equal(s.bottomMass, 1);
  assert.equal(s.topMass, 5);
  assert.ok(Math.abs(s.qsr - 5.0) < 1e-12);
  assert.equal(s.nDays, 5);
});

test('build: minDays filter drops short-history sources', () => {
  const queue: QueueLine[] = [
    ql('2026-05-01T00:00:00.000Z', 'short', 100),
    ql('2026-05-02T00:00:00.000Z', 'short', 200),
    ql('2026-05-03T00:00:00.000Z', 'short', 300),
    ql('2026-05-04T00:00:00.000Z', 'short', 400),
    ql('2026-05-01T00:00:00.000Z', 'long', 100),
    ql('2026-05-02T00:00:00.000Z', 'long', 200),
    ql('2026-05-03T00:00:00.000Z', 'long', 300),
    ql('2026-05-04T00:00:00.000Z', 'long', 400),
    ql('2026-05-05T00:00:00.000Z', 'long', 500),
  ];
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'long');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('build: minTokens filter drops sparse sources', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 6; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'big', 1000));
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'tiny', 1));
  }
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minDays: 5,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'big');
  assert.equal(r.droppedSparseSources, 1);
});

test('build: source filter restricts and surfaces droppedSourceFilter', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'a', 100));
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'b', 200));
  }
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    source: 'a',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.droppedSourceFilter, 5);
});

test('build: invalid hour_start counted', () => {
  const queue: QueueLine[] = [
    ql('not-a-date', 'a', 100),
    ql('2026-05-01T00:00:00.000Z', 'a', 100),
  ];
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 2,
  });
  assert.equal(r.droppedInvalidHourStart, 1);
});

test('build: includePalma surfaces palma alongside qsr', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-05-${day}T00:00:00.000Z`, 'a', i));
  }
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    includePalma: true,
  });
  assert.equal(r.sources.length, 1);
  assert.notEqual(r.sources[0]!.palma, undefined);
  // Palma on [1..10]: top10=k=1 -> 10; bot40=k=4 -> 10; palma=1
  assert.ok(Math.abs((r.sources[0]!.palma as number) - 1.0) < 1e-12);
});

test('build: minQsr display filter drops below threshold (degenerates retained)', () => {
  const queue: QueueLine[] = [];
  // src-flat: all equal -> qsr=1 degenerate, retained
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'flat', 100));
  }
  // src-mild: qsr ~ 5/1 = 5
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'mild', i));
  }
  // src-spike: 1,1,1,1,100 -> k=1 bot=1 top=100 qsr=100
  queue.push(ql('2026-05-01T00:00:00.000Z', 'spike', 1));
  queue.push(ql('2026-05-02T00:00:00.000Z', 'spike', 1));
  queue.push(ql('2026-05-03T00:00:00.000Z', 'spike', 1));
  queue.push(ql('2026-05-04T00:00:00.000Z', 'spike', 1));
  queue.push(ql('2026-05-05T00:00:00.000Z', 'spike', 100));

  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    minQsr: 10,
  });
  // mild (qsr=5) is filtered out; flat (degenerate) retained; spike retained.
  const names = r.sources.map((s) => s.source).sort();
  assert.deepEqual(names, ['flat', 'spike']);
  assert.equal(r.droppedBelowMinQsr, 1);
});

test('build: sort by qsr default (descending), source asc tiebreak', () => {
  const queue: QueueLine[] = [];
  // src-z: qsr=5
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'z', i));
  }
  // src-a: qsr=10 (1,1,1,1,10)
  queue.push(ql('2026-05-01T00:00:00.000Z', 'a', 1));
  queue.push(ql('2026-05-02T00:00:00.000Z', 'a', 1));
  queue.push(ql('2026-05-03T00:00:00.000Z', 'a', 1));
  queue.push(ql('2026-05-04T00:00:00.000Z', 'a', 1));
  queue.push(ql('2026-05-05T00:00:00.000Z', 'a', 10));
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'a');
  assert.equal(r.sources[1]!.source, 'z');
});

test('build: top cap applied after sort', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c']) {
    for (let i = 1; i <= 5; i += 1) {
      queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, src, i * 100));
    }
  }
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    top: 1,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedTopSources, 2);
});

test('build: invalid sort throws', () => {
  assert.throws(
    () =>
      buildDailyTokenQuintileShareRatio([], {
        generatedAt: GEN,
        sort: 'not-a-sort' as any,
      }),
    /sort must be one of/,
  );
});

test('build: minDays<2 throws', () => {
  assert.throws(
    () =>
      buildDailyTokenQuintileShareRatio([], { generatedAt: GEN, minDays: 1 }),
    /minDays must be an integer >= 2/,
  );
});

test('build: invalid since rejected', () => {
  assert.throws(
    () =>
      buildDailyTokenQuintileShareRatio([], {
        generatedAt: GEN,
        since: 'garbage',
      }),
    /invalid since/,
  );
});

// ---- Refinement edge cases (v0.6.307+) ---------------------------------

test('quintileShareRatioOfVector: n=2 -> k=1, qsr=top/bot exactly', () => {
  // Algebraic minimum: n=2, k=ceil(0.4)=1. bottomMass=min, topMass=max.
  const r = quintileShareRatioOfVector([3, 11]);
  assert.equal(r.k, 1);
  assert.equal(r.bottomMass, 3);
  assert.equal(r.topMass, 11);
  assert.ok(Math.abs(r.qsr - 11 / 3) < 1e-12);
  assert.equal(r.degenerate, false);
});

test('quintileShareRatioOfVector: n=3, k=1; non-overlapping body of size 1', () => {
  const r = quintileShareRatioOfVector([2, 5, 9]);
  assert.equal(r.k, 1);
  assert.equal(r.bottomMass, 2);
  assert.equal(r.topMass, 9);
  assert.ok(Math.abs(r.qsr - 9 / 2) < 1e-12);
});

test('quintileShareRatioOfVector: n=4, k=1; central body of size 2', () => {
  const r = quintileShareRatioOfVector([1, 5, 5, 10]);
  assert.equal(r.k, 1);
  assert.ok(Math.abs(r.qsr - 10) < 1e-12);
});

test('quintileShareRatioOfVector: palma reduces to qsr-style ratio when n in [3,4]', () => {
  // n=3: k10=1, k40=2 -> palma = max / (two smallest)
  const r = quintileShareRatioOfVector([2, 5, 9]);
  // palma = 9 / (2+5) = 9/7
  assert.ok(Math.abs(r.palma - 9 / 7) < 1e-12);
});

test('build: --sort=tokens orders by tokens descending', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'small', 1));
  }
  for (let i = 1; i <= 5; i += 1) {
    queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, 'large', 1000));
  }
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    sort: 'tokens',
  });
  assert.equal(r.sources[0]!.source, 'large');
  assert.equal(r.sources[1]!.source, 'small');
});

test('build: window filter (since/until) trims the day vector', () => {
  const queue: QueueLine[] = [];
  for (let i = 1; i <= 10; i += 1) {
    const day = i.toString().padStart(2, '0');
    queue.push(ql(`2026-05-${day}T00:00:00.000Z`, 'a', i * 10));
  }
  // window: keep days 03..07 inclusive (5 days)
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    since: '2026-05-03T00:00:00.000Z',
    until: '2026-05-08T00:00:00.000Z',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.nDays, 5);
  // values [30,40,50,60,70]; k=1 -> qsr=70/30
  assert.ok(Math.abs(r.sources[0]!.qsr - 70 / 30) < 1e-12);
});

test('build: top=0 sentinel means no cap (all rows surface)', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd', 'e']) {
    for (let i = 1; i <= 5; i += 1) {
      queue.push(ql(`2026-05-0${i}T00:00:00.000Z`, src, i * 100));
    }
  }
  const r = buildDailyTokenQuintileShareRatio(queue, {
    generatedAt: GEN,
    minTokens: 1,
    minDays: 5,
    top: 0,
  });
  assert.equal(r.sources.length, 5);
  assert.equal(r.droppedTopSources, 0);
});
