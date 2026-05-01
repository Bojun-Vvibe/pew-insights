import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  buildDailyTokenWolfsonPolarizationIndex,
  wolfsonOfVector,
} from '../src/dailytokenwolfsonpolarizationindex.js';
import { giniOfVector } from '../src/dailytokenginicoefficient.js';
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

// ---- wolfsonOfVector primitive ----------------------------------------

test('wolfsonOfVector: empty -> degenerate, W=0', () => {
  const r = wolfsonOfVector([]);
  assert.equal(r.wolfson, 0);
  assert.equal(r.degenerate, true);
});

test('wolfsonOfVector: n=1 -> degenerate, W=0', () => {
  const r = wolfsonOfVector([42]);
  assert.equal(r.wolfson, 0);
  assert.equal(r.degenerate, true);
});

test('wolfsonOfVector: all-zero -> degenerate, W=0', () => {
  const r = wolfsonOfVector([0, 0, 0, 0]);
  assert.equal(r.wolfson, 0);
  assert.equal(r.degenerate, true);
});

test('wolfsonOfVector: median=0 -> degenerate, W=0', () => {
  // [0,0,0,40]: sorted, n=4 even, median = (0+0)/2 = 0 -> degenerate
  const r = wolfsonOfVector([0, 0, 0, 40]);
  assert.equal(r.wolfson, 0);
  assert.equal(r.degenerate, true);
  assert.equal(r.median, 0);
});

test('wolfsonOfVector: perfect equality -> W=0 (T=G=0)', () => {
  const r = wolfsonOfVector([10, 10, 10, 10]);
  assert.ok(Math.abs(r.wolfson) < 1e-12);
  assert.equal(r.degenerate, false);
  assert.ok(Math.abs(r.gini) < 1e-12);
  assert.ok(Math.abs(r.halfLorenzGap) < 1e-12);
});

test('wolfsonOfVector: scale-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = wolfsonOfVector(v).wolfson;
  const b = wolfsonOfVector(v.map((x) => x * 100)).wolfson;
  assert.ok(Math.abs(a - b) < 1e-12);
});

test('wolfsonOfVector: permutation-invariant', () => {
  const v = [3, 7, 1, 11, 4, 9];
  const a = wolfsonOfVector(v).wolfson;
  const b = wolfsonOfVector([11, 4, 9, 3, 7, 1]).wolfson;
  assert.ok(Math.abs(a - b) < 1e-15);
});

test('wolfsonOfVector: throws on negative', () => {
  assert.throws(() => wolfsonOfVector([1, -2, 3]));
});

test('wolfsonOfVector: throws on non-finite', () => {
  assert.throws(() => wolfsonOfVector([1, Number.POSITIVE_INFINITY, 3]));
  assert.throws(() => wolfsonOfVector([1, Number.NaN, 3]));
});

test('wolfsonOfVector: bipolarized [1,1,9,9] reads HIGHER than uniform-spread of same Gini', () => {
  // [1,1,9,9]: sorted, mu=5, median=5, L(0.5) = 2/20 = 0.1, T=0.4
  // gini = (2*(1*1 + 2*1 + 3*9 + 4*9) - 5*20) / (4*20)
  //       = (2*(1+2+27+36) - 100)/80 = (2*66 - 100)/80 = 32/80 = 0.4
  // W = (5/5)*(2*0.4 - 0.4) = 0.4
  const r = wolfsonOfVector([1, 1, 9, 9]);
  assert.ok(Math.abs(r.gini - 0.4) < 1e-12);
  assert.ok(Math.abs(r.halfLorenzGap - 0.4) < 1e-12);
  assert.ok(Math.abs(r.wolfson - 0.4) < 1e-12);
});

test('wolfsonOfVector: anti-polarized [1,5,5,9] reads LOWER than [1,1,9,9] (same mean+median)', () => {
  // [1,5,5,9]: sorted, mu=5, median=5
  // L(0.5) = 6/20 = 0.3, T = 0.2
  // gini = (2*(1*1+2*5+3*5+4*9) - 5*20)/(4*20) = (2*(1+10+15+36)-100)/80 = (124-100)/80 = 0.3
  // W = (5/5)*(2*0.2 - 0.3) = 0.1
  const a = wolfsonOfVector([1, 1, 9, 9]).wolfson;
  const b = wolfsonOfVector([1, 5, 5, 9]).wolfson;
  assert.ok(b < a, `bipolarized W=${a} should be > anti-polarized W=${b}`);
  assert.ok(Math.abs(b - 0.1) < 1e-12);
});

test('wolfsonOfVector: right-skew amplifies via mu/m', () => {
  // [1,1,1,1,1,100]: heavy right tail
  // sorted [1,1,1,1,1,100], n=6, mu=105/6=17.5, median=(1+1)/2=1
  // mu/m = 17.5 amplifier
  const r = wolfsonOfVector([1, 1, 1, 1, 1, 100]);
  assert.ok(r.wolfson > 0);
  assert.ok(r.mean / r.median > 1, 'mu/m should exceed 1 for right-skew');
});

test('wolfsonOfVector: gini matches axis-32 giniOfVector', () => {
  for (const v of [
    [1, 2, 3, 4, 5],
    [1, 1, 9, 9],
    [1, 5, 5, 9],
    [3, 7, 1, 11, 4, 9],
    [10, 20, 30, 40, 50, 60],
  ]) {
    const w = wolfsonOfVector(v);
    const g = giniOfVector(v);
    assert.ok(
      Math.abs(w.gini - g) < 1e-12,
      `v=${v} wolfson.gini=${w.gini} giniOfVector=${g}`,
    );
  }
});

// ---- additional structural invariants (refinement) -------------------

test('wolfsonOfVector: half-Lorenz gap T is in [0, 0.5] for any non-negative vector', () => {
  for (const v of [
    [1, 2, 3, 4, 5],
    [1, 1, 9, 9],
    [1, 5, 5, 9],
    [3, 7, 1, 11, 4, 9],
    [10, 20, 30, 40, 50, 60],
    [0, 1, 2, 3, 100],
    [1, 1, 1, 1, 1, 100],
    [50, 50, 50, 50],
  ]) {
    const r = wolfsonOfVector(v);
    if (r.degenerate) continue;
    assert.ok(r.halfLorenzGap >= -1e-15, `v=${v} T=${r.halfLorenzGap} should be >=0`);
    assert.ok(
      r.halfLorenzGap <= 0.5 + 1e-15,
      `v=${v} T=${r.halfLorenzGap} should be <=0.5`,
    );
  }
});

test('wolfsonOfVector: cross-axis sanity W = (mu/m)*(2T - G) reproducible from primitives', () => {
  for (const v of [
    [1, 1, 9, 9],
    [1, 5, 5, 9],
    [3, 7, 1, 11, 4, 9],
    [10, 20, 30, 40, 50, 60, 100, 200],
  ]) {
    const r = wolfsonOfVector(v);
    if (r.degenerate) continue;
    const reconstructed =
      (r.mean / r.median) * (2 * r.halfLorenzGap - r.gini);
    assert.ok(
      Math.abs(r.wolfson - reconstructed) < 1e-12,
      `v=${v} W=${r.wolfson} reconstructed=${reconstructed}`,
    );
  }
});

test('wolfsonOfVector: equal-vector identity W(c * 1_n) = 0 for any constant c', () => {
  // The defining baseline: when every entry equals the same constant,
  // bipolarization is trivially 0 (mean == median, T == 0, G == 0).
  for (const c of [1, 5, 100, 12345.6789]) {
    for (const n of [2, 3, 4, 5, 7, 10, 50]) {
      const v = new Array<number>(n).fill(c);
      const r = wolfsonOfVector(v);
      assert.ok(
        Math.abs(r.wolfson) < 1e-12,
        `c=${c} n=${n} W=${r.wolfson} should be 0`,
      );
    }
  }
});

// ---- buildDailyTokenWolfsonPolarizationIndex ----------------------------

test('builder: empty queue -> no rows, totals zero', () => {
  const r = buildDailyTokenWolfsonPolarizationIndex([], { generatedAt: GEN });
  assert.equal(r.sources.length, 0);
  assert.equal(r.totalSources, 0);
  assert.equal(r.totalTokens, 0);
  assert.equal(r.minDays, 4);
  assert.equal(r.sort, 'wolfson');
});

test('builder: single source bipolarized 4-day vector', () => {
  // alpha gets per-day [1,1,9,9] (W = 0.4 from primitive test)
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 1),
    ql('2026-04-02T00:00:00Z', 'alpha', 1),
    ql('2026-04-03T00:00:00Z', 'alpha', 9),
    ql('2026-04-04T00:00:00Z', 'alpha', 9),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.equal(s.source, 'alpha');
  assert.equal(s.nDays, 4);
  assert.ok(Math.abs(s.wolfson - 0.4) < 1e-12);
  assert.ok(Math.abs(s.gini - 0.4) < 1e-12);
  assert.ok(Math.abs(s.halfLorenzGap - 0.4) < 1e-12);
  assert.equal(s.medianDailyTokens, 5);
  assert.equal(s.meanDailyTokens, 5);
});

test('builder: minDays drops sparse-day sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 100),
    ql('2026-04-02T00:00:00Z', 'alpha', 100),
    ql('2026-04-03T00:00:00Z', 'alpha', 100),
    ql('2026-04-04T00:00:00Z', 'alpha', 100),
    ql('2026-04-01T00:00:00Z', 'beta', 100),
    ql('2026-04-02T00:00:00Z', 'beta', 100),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.droppedBelowMinDays, 1);
});

test('builder: minTokens drops sparse-mass sources', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 5000),
    ql('2026-04-02T00:00:00Z', 'alpha', 5000),
    ql('2026-04-03T00:00:00Z', 'alpha', 5000),
    ql('2026-04-04T00:00:00Z', 'alpha', 5000),
    ql('2026-04-01T00:00:00Z', 'tiny', 1),
    ql('2026-04-02T00:00:00Z', 'tiny', 1),
    ql('2026-04-03T00:00:00Z', 'tiny', 1),
    ql('2026-04-04T00:00:00Z', 'tiny', 1),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 1000,
    minDays: 4,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.droppedSparseSources, 1);
});

test('builder: source filter restricts to one source', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 100),
    ql('2026-04-02T00:00:00Z', 'alpha', 100),
    ql('2026-04-03T00:00:00Z', 'alpha', 100),
    ql('2026-04-04T00:00:00Z', 'alpha', 100),
    ql('2026-04-01T00:00:00Z', 'beta', 100),
    ql('2026-04-02T00:00:00Z', 'beta', 100),
    ql('2026-04-03T00:00:00Z', 'beta', 100),
    ql('2026-04-04T00:00:00Z', 'beta', 100),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    source: 'beta',
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'beta');
  assert.equal(r.droppedSourceFilter, 4);
});

test('builder: includeMeanOverMedian refinement attaches mu/m', () => {
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 1),
    ql('2026-04-02T00:00:00Z', 'alpha', 1),
    ql('2026-04-03T00:00:00Z', 'alpha', 1),
    ql('2026-04-04T00:00:00Z', 'alpha', 1),
    ql('2026-04-05T00:00:00Z', 'alpha', 1),
    ql('2026-04-06T00:00:00Z', 'alpha', 100),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    includeMeanOverMedian: true,
  });
  assert.equal(r.sources.length, 1);
  const s = r.sources[0]!;
  assert.notEqual(s.meanOverMedian, undefined);
  // mu = 105/6 = 17.5, m = 1, mu/m = 17.5
  assert.ok(Math.abs((s.meanOverMedian ?? 0) - 17.5) < 1e-12);
});

test('builder: sort by halfLorenzGap orders by T desc', () => {
  // alpha: bipolarized [1,1,9,9] T=0.4
  // beta: anti-polarized [1,5,5,9] T=0.2
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 1),
    ql('2026-04-02T00:00:00Z', 'alpha', 1),
    ql('2026-04-03T00:00:00Z', 'alpha', 9),
    ql('2026-04-04T00:00:00Z', 'alpha', 9),
    ql('2026-04-01T00:00:00Z', 'beta', 1),
    ql('2026-04-02T00:00:00Z', 'beta', 5),
    ql('2026-04-03T00:00:00Z', 'beta', 5),
    ql('2026-04-04T00:00:00Z', 'beta', 9),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    sort: 'halfLorenzGap',
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.sources[1]!.source, 'beta');
});

test('builder: minWolfson display filter prunes low-W rows but keeps degenerates', () => {
  // alpha: bipolarized [1,1,9,9] W=0.4
  // beta: equal [5,5,5,5] W=0
  const queue: QueueLine[] = [
    ql('2026-04-01T00:00:00Z', 'alpha', 1),
    ql('2026-04-02T00:00:00Z', 'alpha', 1),
    ql('2026-04-03T00:00:00Z', 'alpha', 9),
    ql('2026-04-04T00:00:00Z', 'alpha', 9),
    ql('2026-04-01T00:00:00Z', 'beta', 5),
    ql('2026-04-02T00:00:00Z', 'beta', 5),
    ql('2026-04-03T00:00:00Z', 'beta', 5),
    ql('2026-04-04T00:00:00Z', 'beta', 5),
  ];
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    minWolfson: 0.2,
  });
  assert.equal(r.sources.length, 1);
  assert.equal(r.sources[0]!.source, 'alpha');
  assert.equal(r.droppedBelowMinWolfson, 1);
});

test('builder: top cap drops surplus rows', () => {
  const queue: QueueLine[] = [];
  for (const src of ['a', 'b', 'c', 'd', 'e']) {
    for (let day = 1; day <= 4; day += 1) {
      queue.push(
        ql(`2026-04-0${day}T00:00:00Z`, src, day === 4 ? 100 : 1),
      );
    }
  }
  const r = buildDailyTokenWolfsonPolarizationIndex(queue, {
    generatedAt: GEN,
    minTokens: 0,
    minDays: 4,
    top: 2,
  });
  assert.equal(r.sources.length, 2);
  assert.equal(r.droppedTopSources, 3);
});

test('builder: validation errors on bad knobs', () => {
  assert.throws(() =>
    buildDailyTokenWolfsonPolarizationIndex([], { minTokens: -1 }),
  );
  assert.throws(() =>
    buildDailyTokenWolfsonPolarizationIndex([], { minDays: 1 }),
  );
  assert.throws(() => buildDailyTokenWolfsonPolarizationIndex([], { top: -1 }));
  assert.throws(() =>
    buildDailyTokenWolfsonPolarizationIndex([], {
      minWolfson: Number.POSITIVE_INFINITY,
    }),
  );
  assert.throws(() =>
    buildDailyTokenWolfsonPolarizationIndex([], {
      sort: 'bogus' as DailyTokenWolfsonSort_,
    }),
  );
  assert.throws(() =>
    buildDailyTokenWolfsonPolarizationIndex([], { since: 'not-a-date' }),
  );
});

// type alias for the validation throw test (avoid `any`)
type DailyTokenWolfsonSort_ =
  | 'wolfson'
  | 'tokens'
  | 'days'
  | 'source'
  | 'meanDaily'
  | 'meanOverMedian'
  | 'halfLorenzGap';
